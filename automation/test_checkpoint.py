from copy import deepcopy
import json
from pathlib import Path
import tempfile
import unittest

from checkpoint import BINDINGS, TASK_ID, read_bindings, record
from engineering_loop import Blocked, Conflict, approved_task


class Store:
    def __init__(self):
        task = approved_task(TASK_ID, 'approval', 'founder', {'founder'}, 'a' * 40, 'e' * 64)
        task['stage'] = 'blocked'
        self.document, self.version = {TASK_ID: task}, 0
        self.writes = 0

    def read(self):
        return deepcopy(self.document), self.version

    def write(self, document, version):
        if version != self.version:
            raise Conflict()
        self.document, self.version = deepcopy(document), self.version + 1
        self.writes += 1


class CheckpointTests(unittest.TestCase):
    def test_checkpoint_persists_blockers_without_clearing_approvals(self):
        store = Store()
        before = deepcopy(store.document[TASK_ID])
        result = record(store, dict.fromkeys(BINDINGS, False), '123-1')
        task = store.document[TASK_ID]
        self.assertEqual(result['status'], 'BLOCKED')
        self.assertEqual(task['stage'], 'blocked')
        self.assertEqual(task['blocker_status'], 'production_autodeploy_unverified')
        for name in ['approval_id', 'approved_by', 'commit', 'task_spec_sha256',
                     'founder_approval_status', 'production_approval']:
            self.assertEqual(task[name], before[name])
        self.assertEqual(task['audit'][-1]['event'], 'hosted_prerequisites_recorded')

    def test_presence_cannot_establish_scope_or_clear_production_gate(self):
        store = Store()
        record(store, dict.fromkeys(BINDINGS, True), '123-1')
        task = store.document[TASK_ID]
        self.assertEqual(task['stage'], 'blocked')
        for value in task['prerequisites']['credential_bindings'].values():
            self.assertEqual(value['least_privilege_scope'], 'unverified')

    def test_same_hosted_attempt_is_idempotent(self):
        store = Store()
        record(store, dict.fromkeys(BINDINGS, False), '123-1')
        self.assertTrue(record(store, dict.fromkeys(BINDINGS, False), '123-1')['replayed'])
        self.assertEqual(store.writes, 1)

    def test_does_not_overwrite_active_work(self):
        store = Store()
        store.document[TASK_ID]['stage'] = 'qa'
        with self.assertRaises(Blocked):
            record(store, dict.fromkeys(BINDINGS, False), '123-1')
        self.assertEqual(store.writes, 0)

    def test_cas_conflicts_are_bounded(self):
        store = Store()
        calls = []
        def conflict(document, version):
            calls.append(1)
            raise Conflict()
        store.write = conflict
        with self.assertRaises(Blocked):
            record(store, dict.fromkeys(BINDINGS, False), '123-1')
        self.assertEqual(len(calls), 3)

    def test_rejects_secret_strings_instead_of_boolean_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory) / 'credential-readiness.json'
            p.write_text(json.dumps({'scope': 'binding_presence_only',
                'credential_values_recorded': False, 'environment': 'engineering-builder',
                'bindings': {'OPENAI_API_KEY': 'not-a-boolean'}}))
            with self.assertRaises(Blocked):
                read_bindings(directory)

    def test_reads_all_three_environment_artifacts(self):
        with tempfile.TemporaryDirectory() as directory:
            for env, key in BINDINGS.items():
                p = Path(directory) / env
                p.mkdir()
                (p / 'credential-readiness.json').write_text(json.dumps({
                    'scope': 'binding_presence_only', 'credential_values_recorded': False,
                    'environment': env, 'bindings': {key: False}}))
            self.assertEqual(read_bindings(directory), dict.fromkeys(BINDINGS, False))


if __name__ == '__main__':
    unittest.main()
