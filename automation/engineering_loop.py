"""Fail-closed orchestration core. Live Builder/deploy/QA adapters are not installed.

State is a GitHub branch, not runner memory. Workers must implement idempotent
operations keyed by operation_id. The core never executes task-supplied commands.
"""
from copy import deepcopy
from hashlib import sha256
import json
import re
import time
import urllib.error
import urllib.request
from uuid import uuid4


CHECKS = frozenset({
    'auth', 'user_isolation', 'private_storage', 'uploads', 'processing',
    'reviewer_boundaries', 'immutable_reports', 'pdf_retrieval',
    'synthetic_email_auth', 'no_release_delivery', 'mobile_routes',
    'production_untouched',
})
VALIDATION = frozenset({'targeted', 'tests', 'typecheck', 'build',
                        'bundle_scan', 'python_self_test', 'diff_check'})
STAGES = {'queued': 'builder', 'building': 'builder',
          'deploying': 'deployer', 'qa': 'qa'}
SHA = re.compile(r'^[a-f0-9]{40}$')
IDENTIFIER = re.compile(r'^[A-Za-z0-9_.:-]{1,160}$')


class Conflict(Exception):
    pass


class Blocked(Exception):
    """Only a safe, predefined blocker code may be persisted."""


def identifier(value):
    if not isinstance(value, str) or not IDENTIFIER.fullmatch(value):
        raise ValueError('invalid identifier')
    return value


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def audit(task, event):
    previous = task['audit'][-1]['hash'] if task['audit'] else None
    entry = {'event': identifier(event), 'revision': task['revision'],
             'stage': task['stage'], 'commit': task['commit'],
             'deployment': task['staging_deployment'], 'previous': previous}
    entry['hash'] = sha256(canonical(entry)).hexdigest()
    task['audit'].append(entry)


def approved_task(task_id, approval_id, approver, founders, source_commit, spec_digest):
    # The authenticated intake adapter must resolve approver from the provider's
    # verified event, never an issue body or user-supplied actor field.
    if (approver not in founders or not SHA.fullmatch(source_commit)
            or not re.fullmatch(r'[a-f0-9]{64}', spec_digest)):
        raise ValueError('verified founder approval and source commit required')
    return {
        'task_id': identifier(task_id), 'current_agent': 'builder',
        'stage': 'queued', 'commit': source_commit, 'staging_deployment': None,
        'qa_status': 'pending', 'blocker_status': None,
        'founder_approval_status': 'task_approved_only',
        'approval_id': identifier(approval_id), 'approved_by': identifier(approver),
        'task_spec_sha256': spec_digest,
        'production_approval': False, 'customer_mail_approval': False,
        'customer_data_approval': False, 'destructive_approval': False,
        'revision': 0, 'attempt': 0, 'lease': None, 'builder_identity': None,
        'qa_evidence': None, 'defects': [], 'audit': [],
    }


class Loop:
    """One persisted transition per tick; caller schedules ticks in the cloud.

    store.read -> (document, revision token); store.write uses compare-and-swap.
    adapters are trusted code, deployed independently of candidate source.
    """
    def __init__(self, store, adapters, *, founders=(), clock=time.time, lease_seconds=900,
                 max_attempts=3):
        self.store, self.adapters, self.clock = store, adapters, clock
        self.lease_seconds, self.max_attempts = lease_seconds, max_attempts
        self.founders = frozenset(founders)

    def enqueue(self, task):
        # Refuse injected state, preapproved releases, arbitrary extra fields,
        # and task IDs containing control characters or URLs.
        clean = approved_task(task['task_id'], task['approval_id'], task['approved_by'],
                              self.founders, task['commit'], task['task_spec_sha256'])
        if task != clean:
            raise ValueError('intake must contain a clean approved task')
        document, version = self.store.read()
        if task['task_id'] in document:
            return False
        document[task['task_id']] = deepcopy(task)
        audit(document[task['task_id']], 'approved_task_enqueued')
        self.store.write(document, version)
        return True

    def tick(self, task_id, worker_id):
        identifier(worker_id)
        document, version = self.store.read()
        task = document[task_id]
        if task['stage'] not in STAGES:
            return task['stage']
        now = self.clock()
        if task['lease'] and task['lease']['until'] > now:
            return 'leased'
        # Stable across lease expiry/restart: external side effects must dedupe.
        operation_id = f"{task_id}:{task['revision']}:{task['stage']}"
        lease = {'id': uuid4().hex, 'until': now + self.lease_seconds,
                 'worker': worker_id}
        task['lease'] = lease
        self.store.write(document, version)
        claimed = deepcopy(task)
        role = STAGES[claimed['stage']]
        try:
            # Enforce the budget before a model call, command, or external effect.
            result = ({} if role == 'builder' and claimed['attempt'] >= self.max_attempts
                      else self.adapters[role](deepcopy(claimed), operation_id))
        except Exception:
            # Never persist provider/command exceptions: they may contain secrets.
            result = {'blocked': 'adapter_failure'}

        document, version = self.store.read()
        task = document[task_id]
        if task['lease'] != lease or self.clock() >= lease['until']:
            raise Conflict('stale worker cannot complete this operation')
        task['lease'] = None
        try:
            event = self._transition(task, role, result, worker_id)
        except (ValueError, KeyError, TypeError):
            task['stage'] = 'blocked'
            task['blocker_status'] = 'invalid_adapter_evidence'
            event = 'invalid_adapter_evidence'
        task['revision'] += 1
        audit(task, event)
        self.store.write(document, version)
        return task['stage']

    def _transition(self, task, role, result, worker_id):
        if role == 'builder' and task['attempt'] >= self.max_attempts:
            task['stage'], task['blocker_status'] = 'blocked', 'retry_limit'
            return 'retry_limit'
        if not isinstance(result, dict):
            raise ValueError('adapter result must be structured evidence')
        if result.get('blocked'):
            # Do not copy arbitrary adapter error text into the audit trail.
            task['stage'] = 'blocked'
            task['blocker_status'] = 'adapter_blocked'
            return 'adapter_blocked'
        if role == 'builder':
            if not SHA.fullmatch(result['commit']):
                raise ValueError('commit required')
            if set(result['validation']) != VALIDATION or not all(
                    v == 'pass' for v in result['validation'].values()):
                raise ValueError('all required validation must pass')
            task.update(commit=result['commit'], stage='deploying',
                        current_agent='deployer', staging_deployment=None,
                        qa_status='pending', qa_evidence=None,
                        builder_identity=worker_id)
            task['attempt'] += 1
            return 'builder_validated'
        if role == 'deployer':
            if result['commit'] != task['commit'] or result['target'] != 'staging':
                raise ValueError('wrong deployment target or commit')
            # Deployment adapter must wait for Railway SUCCESS, never only enqueue.
            if result['status'] != 'success':
                raise ValueError('deployment not complete')
            task.update(staging_deployment=identifier(result['deployment_id']),
                        stage='qa', current_agent='qa')
            return 'staging_deployment_completed'
        if role == 'qa':
            if worker_id == task['builder_identity']:
                raise ValueError('QA must be independent')
            if result['commit'] != task['commit'] or result['deployment_id'] != task['staging_deployment']:
                raise ValueError('stale candidate')
            checks = result['checks']
            if set(checks) != CHECKS or any(v not in {'pass', 'fail', 'blocked'} for v in checks.values()):
                raise ValueError('complete QA evidence required')
            task['qa_evidence'] = {k: checks[k] for k in sorted(CHECKS)}
            if all(v == 'pass' for v in checks.values()):
                task.update(stage='ready', current_agent=None, qa_status='pass',
                            founder_approval_status='READY FOR HUMAN APPROVAL')
                return 'qa_pass'
            if 'blocked' in checks.values():
                task.update(stage='blocked', qa_status='blocked',
                            blocker_status='qa_coverage_unavailable')
                return 'qa_blocked'
            failed = sorted(k for k, value in checks.items() if value == 'fail')
            task['defects'].append({
                'id': f"{task['task_id']}.qa.{task['attempt']}",
                'commit': task['commit'], 'deployment_id': task['staging_deployment'],
                'failed_checks': failed,
                'evidence_id': identifier(result['evidence_id']),
                'expected': 'all_required_checks_pass',
            })
            task.update(stage='building', current_agent='builder', qa_status='fail')
            return 'qa_defect_returned_to_builder'
        raise ValueError('unsupported role')


class GitHubState:
    """Private GitHub branch store with non-forced, atomic ref updates.

    Provision the dedicated state branch once from a reviewed source commit.
    Its history retains every state transition. The token belongs to the broker,
    never Builder, QA, a model prompt, candidate code, or the test environment.
    """
    BRANCH = 'automation/engineering-state'
    PATH = 'engineering-state.json'

    def __init__(self, repository, token, transport=None):
        if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository):
            raise ValueError('invalid repository')
        self.base = f'https://api.github.com/repos/{repository}'
        self.token = token
        self.transport = transport or self._request

    def _request(self, method, path, payload=None):
        data = canonical(payload) if payload is not None else None
        request = urllib.request.Request(self.base + path, data=data, method=method,
            headers={'Authorization': f'Bearer {self.token}',
                     'Accept': 'application/vnd.github+json',
                     'Content-Type': 'application/json',
                     'X-GitHub-Api-Version': '2022-11-28'})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            # No response body, URL, headers, or credential-bearing exception.
            if error.code in {409, 422}:
                raise Conflict('state write conflict') from None
            raise Blocked('state_transport_failure') from None
        except Exception:
            raise Blocked('state_transport_failure') from None

    def read(self):
        import base64
        head = self.transport('GET', f'/git/ref/heads/{self.BRANCH}')['object']['sha']
        commit = self.transport('GET', f'/git/commits/{head}')
        tree = self.transport('GET', f"/git/trees/{commit['tree']['sha']}")
        entry = next((e for e in tree['tree'] if e['path'] == self.PATH), None)
        if entry is None:
            return {}, head
        blob = self.transport('GET', f"/git/blobs/{entry['sha']}")
        return json.loads(base64.b64decode(blob['content'])), head

    def write(self, document, expected):
        if not SHA.fullmatch(expected):
            raise ValueError('expected commit required')
        commit = self.transport('GET', f'/git/commits/{expected}')
        tree = self.transport('POST', '/git/trees', {
            'base_tree': commit['tree']['sha'],
            'tree': [{'path': self.PATH, 'mode': '100644', 'type': 'blob',
                      'content': canonical(document).decode()}]})
        created = self.transport('POST', '/git/commits', {
            'message': 'Engineering state transition', 'tree': tree['sha'],
            'parents': [expected]})
        # Concurrent writers share the same parent. Only one sibling can advance
        # the ref without a force update; losers reread on the next cloud tick.
        self.transport('PATCH', f'/git/refs/heads/{self.BRANCH}',
                       {'sha': created['sha'], 'force': False})
