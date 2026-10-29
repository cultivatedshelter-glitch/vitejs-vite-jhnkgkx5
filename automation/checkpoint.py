"""Persist hosted prerequisite evidence for the existing synthetic task.

This recorder cannot clear production isolation, grant approvals, run Builder,
deploy, or attest QA PASS. Its only write target is GitHubState.BRANCH.
It receives no model, Railway, Supabase, or mail credential.
"""
from copy import deepcopy
import json
import os
from pathlib import Path
import re

from engineering_loop import Blocked, Conflict, GitHubState, audit


REPOSITORY = 'cultivatedshelter-glitch/vitejs-vite-jhnkgkx5'
TASK_ID = 'github-issue-8'
BINDINGS = {
    'engineering-builder': 'OPENAI_API_KEY',
    'engineering-staging-deploy': 'RAILWAY_STAGING_TOKEN',
    'engineering-qa': 'SUPABASE_DEV_SECRET_KEY',
}


def read_bindings(directory):
    result = {}
    for path in Path(directory).rglob('credential-readiness.json'):
        if path.is_symlink() or path.stat().st_size > 8192:
            raise Blocked('invalid_binding_evidence')
        data = json.loads(path.read_text())
        environment = data.get('environment')
        secret_name = BINDINGS.get(environment)
        values = data.get('bindings')
        if (data.get('scope') != 'binding_presence_only'
                or data.get('credential_values_recorded') is not False
                or not secret_name or not isinstance(values, dict)
                or set(values) != {secret_name}
                or type(values[secret_name]) is not bool
                or environment in result):
            raise Blocked('invalid_binding_evidence')
        result[environment] = values[secret_name]
    if set(result) != set(BINDINGS):
        raise Blocked('missing_binding_evidence')
    return result


def record(store, bindings, run_key, *, max_conflicts=3):
    if (not re.fullmatch(r'[0-9]{1,20}-[0-9]{1,3}', run_key)
            or set(bindings) != set(BINDINGS)
            or any(type(v) is not bool for v in bindings.values())):
        raise Blocked('invalid_checkpoint_input')
    for _ in range(max_conflicts):
        document, version = store.read()
        if TASK_ID not in document:
            raise Blocked('approved_task_missing')
        task = document[TASK_ID]
        if task.get('last_prerequisite_run') == run_key:
            return {'status': 'BLOCKED', 'task_id': TASK_ID,
                    'revision': task['revision'], 'persisted': True, 'replayed': True}
        # A prerequisite recorder cannot overwrite active work, QA, or approval.
        if (task['stage'] != 'blocked' or task['lease'] is not None
                or task['founder_approval_status'] != 'task_approved_only'
                or any(task.get(k + '_approval') is not False for k in (
                    'production', 'customer_mail', 'customer_data', 'destructive'))):
            raise Blocked('task_not_available_for_checkpoint')
        task = deepcopy(task)
        task.update(current_agent='orchestrator', blocker_status='production_autodeploy_unverified',
                    last_prerequisite_run=run_key, revision=task['revision'] + 1)
        task['prerequisites'] = {
            'production_autodeploy_disabled': 'unverified',
            'credential_bindings': {
                env: {'secret_name': BINDINGS[env], 'available': bindings[env],
                      'least_privilege_scope': 'unverified'} for env in sorted(BINDINGS)
            },
            'hosted_run': run_key,
        }
        audit(task, 'hosted_prerequisites_recorded')
        document[TASK_ID] = task
        try:
            store.write(document, version)
            return {'status': 'BLOCKED', 'task_id': TASK_ID,
                    'revision': task['revision'], 'persisted': True, 'replayed': False}
        except Conflict:
            continue
    raise Blocked('checkpoint_conflict_budget_exhausted')


def main():
    try:
        if os.environ.get('GITHUB_REPOSITORY') != REPOSITORY:
            raise Blocked('repository_not_allowed')
        bindings = read_bindings('binding-evidence')
        store = GitHubState(REPOSITORY, os.environ['GITHUB_TOKEN'])
        run_key = os.environ['GITHUB_RUN_ID'] + '-' + os.environ['GITHUB_RUN_ATTEMPT']
        result = record(store, bindings, run_key)
        Path('engineering-evidence').mkdir(exist_ok=True)
        Path('engineering-evidence/checkpoint.json').write_text(json.dumps(result) + '\n')
        print(json.dumps(result))
        return 0  # Recording succeeded; the recorded engineering status is BLOCKED.
    except Exception:
        # Provider responses, exceptions, and credential values never enter logs.
        print('{"status":"BLOCKED","persisted":false,"reason":"checkpoint_failed"}')
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
