from copy import deepcopy
import unittest
from engineering_loop import (CHECKS, VALIDATION, Conflict, GitHubState,
                              Loop, approved_task, canonical, sha256)


COMMIT = 'a' * 40
NEW = 'b' * 40


class MemoryCAS:
    def __init__(self):
        self.document, self.version = {}, 0

    def read(self):
        return deepcopy(self.document), self.version

    def write(self, document, version):
        if version != self.version:
            raise Conflict()
        self.document, self.version = deepcopy(document), self.version + 1


def task():
    return approved_task('synthetic-1', 'approval-1', 'founder', {'founder'}, COMMIT, 'e' * 64)


def builder(t, operation):
    return {'commit': NEW, 'validation': dict.fromkeys(VALIDATION, 'pass')}


def deployer(t, operation):
    return {'commit': t['commit'], 'deployment_id': 'synthetic-deployment',
            'target': 'staging', 'status': 'success'}


def qa(t, operation):
    return {'commit': t['commit'], 'deployment_id': t['staging_deployment'],
            'checks': dict.fromkeys(CHECKS, 'pass'), 'evidence_id': 'evidence-1'}


class LoopTests(unittest.TestCase):
    def setUp(self):
        self.store = MemoryCAS()
        self.adapters = {'builder': builder, 'deployer': deployer, 'qa': qa}
        self.loop = Loop(self.store, self.adapters, founders={'founder'})
        self.loop.enqueue(task())

    def current(self):
        return self.store.document['synthetic-1']

    def tick(self, worker='builder-1'):
        return self.loop.tick('synthetic-1', worker)

    def candidate(self):
        self.assertEqual(self.tick(), 'deploying')
        self.assertEqual(self.tick('deployer-1'), 'qa')

    def test_complete_simulated_cycle_requires_human_approval(self):
        self.candidate()
        self.assertEqual(self.tick('qa-1'), 'ready')
        self.assertEqual(self.current()['founder_approval_status'], 'READY FOR HUMAN APPROVAL')
        for gate in ['production', 'customer_mail', 'customer_data', 'destructive']:
            self.assertFalse(self.current()[gate + '_approval'])
        self.assertEqual(self.tick('qa-1'), 'ready')

    def test_failure_routes_back_and_survives_worker_recreation(self):
        def failing(t, operation):
            result = qa(t, operation)
            result['checks']['uploads'] = 'fail'
            return result
        self.adapters['qa'] = failing
        self.candidate()
        self.assertEqual(self.tick('qa-1'), 'building')
        self.assertEqual(self.current()['defects'][0]['failed_checks'], ['uploads'])
        self.adapters['qa'] = qa
        self.loop = Loop(self.store, self.adapters, founders={'founder'})
        self.candidate()
        self.assertEqual(self.tick('qa-2'), 'ready')

    def test_incomplete_qa_cannot_pass(self):
        self.candidate()
        self.adapters['qa'] = lambda t, o: {**qa(t, o), 'checks': {'auth': 'pass'}}
        self.assertEqual(self.tick('qa-1'), 'blocked')

    def test_missing_live_coverage_is_blocked(self):
        self.candidate()
        def incomplete(t, o):
            result = qa(t, o)
            result['checks']['mobile_routes'] = 'blocked'
            return result
        self.adapters['qa'] = incomplete
        self.assertEqual(self.tick('qa-1'), 'blocked')
        self.assertEqual(self.current()['blocker_status'], 'qa_coverage_unavailable')

    def test_stale_candidate_rejected(self):
        self.candidate()
        self.adapters['qa'] = lambda t, o: {**qa(t, o), 'commit': COMMIT}
        self.assertEqual(self.tick('qa-1'), 'blocked')

    def test_production_target_rejected(self):
        self.tick()
        self.adapters['deployer'] = lambda t, o: {**deployer(t, o), 'target': 'production'}
        self.assertEqual(self.tick('deployer-1'), 'blocked')

    def test_independent_qa_required(self):
        self.candidate()
        self.assertEqual(self.tick('builder-1'), 'blocked')

    def test_validation_must_pass_before_deployment(self):
        self.adapters['builder'] = lambda t, o: {**builder(t, o), 'validation': {'tests': 'pass'}}
        self.assertEqual(self.tick(), 'blocked')
        self.assertIsNone(self.current()['staging_deployment'])

    def test_duplicate_enqueue_is_idempotent(self):
        self.assertFalse(self.loop.enqueue(task()))
        self.assertEqual(len(self.store.document), 1)

    def test_unapproved_task_rejected(self):
        with self.assertRaises(ValueError):
            approved_task('x', 'approval', 'untrusted', {'founder'}, COMMIT, 'e' * 64)

    def test_intake_cannot_preapprove_production(self):
        injected = task()
        injected['production_approval'] = True
        with self.assertRaises(ValueError):
            self.loop.enqueue(injected)

    def test_intake_defaults_to_no_authorized_founders(self):
        with self.assertRaises(ValueError):
            Loop(MemoryCAS(), self.adapters).enqueue(task())

    def test_intake_rejects_arbitrary_payload(self):
        injected = task()
        injected['secret'] = 'must-not-be-persisted'
        with self.assertRaises(ValueError):
            self.loop.enqueue(injected)

    def test_live_lease_prevents_duplicate_work(self):
        document, version = self.store.read()
        document['synthetic-1']['lease'] = {'id': 'x', 'until': 1000, 'worker': 'other'}
        self.store.write(document, version)
        self.loop.clock = lambda: 100
        self.assertEqual(self.tick(), 'leased')

    def test_expired_lease_reuses_operation_identity(self):
        seen = []
        document, version = self.store.read()
        document['synthetic-1']['lease'] = {'id': 'old', 'until': 0, 'worker': 'other'}
        self.store.write(document, version)
        def record(t, operation):
            seen.append(operation)
            return builder(t, operation)
        self.adapters['builder'] = record
        self.tick()
        self.assertEqual(seen, ['synthetic-1:0:queued'])

    def test_expired_worker_cannot_commit(self):
        now = [100]
        self.loop.clock = lambda: now[0]
        def slow(t, operation):
            now[0] = 10000
            return builder(t, operation)
        self.adapters['builder'] = slow
        with self.assertRaises(Conflict):
            self.tick()
        self.assertEqual(self.current()['revision'], 0)

    def test_secret_bearing_exception_not_persisted(self):
        def explode(t, operation):
            raise RuntimeError('SECRET-MUST-NOT-APPEAR')
        self.adapters['builder'] = explode
        self.assertEqual(self.tick(), 'blocked')
        self.assertNotIn(b'SECRET-MUST-NOT-APPEAR', canonical(self.store.document))

    def test_audit_hash_chain(self):
        self.candidate()
        self.tick('qa-1')
        previous = None
        for event in self.current()['audit']:
            self.assertEqual(event['previous'], previous)
            payload = {k: v for k, v in event.items() if k != 'hash'}
            self.assertEqual(sha256(canonical(payload)).hexdigest(), event['hash'])
            previous = event['hash']

    def test_retry_limit_is_explicit_blocker(self):
        self.loop.max_attempts = 0
        self.assertEqual(self.tick(), 'blocked')
        self.assertEqual(self.current()['blocker_status'], 'retry_limit')

    def test_state_store_only_updates_dedicated_branch_without_force(self):
        calls = []
        def transport(method, path, payload=None):
            calls.append((method, path, payload))
            if path.startswith('/git/commits/'):
                return {'tree': {'sha': 'c' * 40}}
            return {'sha': 'd' * 40}
        store = GitHubState('owner/private', 'not-a-real-token', transport)
        store.write({'task': {}}, COMMIT)
        self.assertEqual(calls[-1], ('PATCH', '/git/refs/heads/automation/engineering-state',
                                   {'sha': 'd' * 40, 'force': False}))
        self.assertNotIn('not-a-real-token', repr(calls))


if __name__ == '__main__':
    unittest.main()
