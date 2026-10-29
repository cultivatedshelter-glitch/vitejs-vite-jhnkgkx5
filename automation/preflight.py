"""Read-only prerequisites and partial live QA. Never attests full QA PASS.

No customer endpoints, release/send operations, or authenticated data queries.
The CLI prints only fixed check names and statuses. Provider bodies stay private.
"""
import argparse
import json
import os
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request

from engineering_loop import CHECKS


def public_https_origin(value):
    parsed = urllib.parse.urlsplit(value)
    if (parsed.scheme != 'https' or parsed.username or parsed.password
            or parsed.path not in ('', '/') or parsed.query or parsed.fragment
            or not parsed.hostname or parsed.port not in (None, 443)):
        raise ValueError('invalid_https_origin')
    return f'https://{parsed.hostname}'


def configuration_checks(variables, expected_ref, *, staging_origin,
                         forbidden_origins, expected_commit=None):
    """Call inside a trusted credential-bearing job; never log variables.

    Name checks alone cannot verify the project provenance of a modern secret
    key. A live key validation against the development API remains required.
    """
    if not re.fullmatch(r'[a-z]{20}', expected_ref):
        raise ValueError('invalid_expected_project')
    origin = public_https_origin(staging_origin)
    if origin in {public_https_origin(v) for v in forbidden_origins}:
        raise ValueError('production_origin_rejected')
    development_url = f'https://{expected_ref}.supabase.co'
    checks = {
        'development_server_url': variables.get('SUPABASE_URL') == development_url,
        'development_browser_url': variables.get('VITE_SUPABASE_URL') == development_url,
        'expected_project_guard': variables.get('SUPABASE_EXPECTED_PROJECT_REF') == expected_ref,
        'no_mail_capability': not any(variables.get(k) for k in (
            'RESEND_API_KEY', 'SMTP_PASSWORD', 'SENDGRID_API_KEY',
            'POSTMARK_SERVER_TOKEN', 'MAILGUN_API_KEY')),
        'no_extra_cloud_credentials': not any(variables.get(k) for k in (
            'GH_TOKEN', 'GITHUB_TOKEN', 'RAILWAY_TOKEN', 'RAILWAY_API_TOKEN',
            'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY')),
        'server_key_present': bool(variables.get('SUPABASE_SECRET_KEY')),
        'browser_key_present': bool(variables.get('VITE_SUPABASE_ANON_KEY')),
    }
    if expected_commit is not None:
        if not re.fullmatch(r'[a-f0-9]{40}', expected_commit):
            raise ValueError('invalid_candidate_commit')
        checks['candidate_commit'] = variables.get('SHELTER_PREP_BUILD_COMMIT') == expected_commit
    # Unknown variables are not silently approved as harmless.
    permitted = {
        'NODE_ENV', 'PORT', 'HOST', 'PHASE1_EVIDENCE_BUCKET',
        'SHELTER_PREP_BUILD_COMMIT', 'SHELTER_PREP_ENABLE_LIVE_WEATHER',
        'SHELTER_PREP_PUBLIC_URL', 'SHELTER_PREP_PYTHON',
        'SUPABASE_EXPECTED_PROJECT_REF', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY',
        'SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL',
    }
    checks['only_reviewed_variables'] = all(
        key in permitted or key.startswith('RAILWAY_') for key in variables)
    checks['server_key_development_provenance'] = 'blocked'
    checks['synthetic_data_only_attestation'] = 'blocked'
    return {k: ('pass' if v is True else 'fail' if v is False else v)
            for k, v in checks.items()}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never follow staging redirects to production or a third party.
        return None


def probe(url):
    opener = urllib.request.build_opener(NoRedirect)
    request = urllib.request.Request(url, headers={'Accept': 'application/json'})
    try:
        with opener.open(request, timeout=25) as response:
            raw = response.read(32769)
            if len(raw) > 32768:
                return response.status, None
            try:
                return response.status, json.loads(raw)
            except (ValueError, UnicodeDecodeError):
                return response.status, None
    except urllib.error.HTTPError as error:
        return error.code, None
    except Exception:
        return 0, None


def live_preflight(origin, *, allowed_origin, fetch=probe):
    origin = public_https_origin(origin)
    if origin != public_https_origin(allowed_origin):
        raise ValueError('unapproved_origin')
    status, body = fetch(origin + '/healthz')
    checks = {
        'staging_health': 'pass' if status == 200 and isinstance(body, dict)
            and body.get('status') == 'ok' else 'fail',
        'notifications_disabled': 'pass' if isinstance(body, dict)
            and body.get('notifications') == 'disabled' else 'fail',
    }
    for name, path in {
        'unauthenticated_identity_denied': '/api/phase1/me',
        'unauthenticated_review_queue_denied': '/api/phase1/review-queue',
        'unauthenticated_dashboard_denied': '/api/phase1/dashboard',
    }.items():
        code, _ = fetch(origin + path)
        checks[name] = 'pass' if code in (401, 403) else 'fail'
    return {
        'schema': 'shelter-prep-engineering-preflight.v1',
        'status': 'BLOCKED',
        'prerequisite_checks': checks,
        # Partial unauthenticated probes do not verify end-to-end auth or QA.
        'qa_checks': dict.fromkeys(sorted(CHECKS), 'blocked'),
        'blocker_codes': ['cloud_identity_not_verified',
                          'staging_secret_provenance_not_verified',
                          'synthetic_live_cycle_not_executed'],
        'production_changed': False,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='engineering-evidence/preflight.json')
    args = parser.parse_args()
    origin = os.environ.get('STAGING_URL', '')
    allowed = os.environ.get('APPROVED_STAGING_URL', '')
    try:
        evidence = live_preflight(origin, allowed_origin=allowed)
    except ValueError:
        evidence = {'schema': 'shelter-prep-engineering-preflight.v1',
                    'status': 'BLOCKED', 'blocker_codes': ['staging_origin_not_configured'],
                    'qa_checks': dict.fromkeys(sorted(CHECKS), 'blocked')}
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(evidence, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'status': evidence['status'],
                      'blocker_codes': evidence['blocker_codes']}))
    # Until complete live QA and provenance are installed, never greenlight release.
    return 2


if __name__ == '__main__':
    raise SystemExit(main())
