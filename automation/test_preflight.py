import unittest
from preflight import configuration_checks, live_preflight, public_https_origin


class PreflightTests(unittest.TestCase):
    def test_origin_rejects_credentials_queries_paths_and_non_https(self):
        for origin in ['http://staging.example', 'https://key@staging.example',
                       'https://staging.example/?token=secret', 'https://staging.example/path']:
            with self.assertRaises(ValueError):
                public_https_origin(origin)

    def test_different_origin_is_rejected_before_network(self):
        with self.assertRaises(ValueError):
            live_preflight('https://production.example', allowed_origin='https://staging.example',
                           fetch=lambda _: self.fail('must not make a request'))

    def test_partial_checks_never_attest_full_qa_pass(self):
        def fetch(url):
            if url.endswith('/healthz'):
                return 200, {'status': 'ok', 'notifications': 'disabled'}
            return 401, None
        evidence = live_preflight('https://staging.example',
                                 allowed_origin='https://staging.example', fetch=fetch)
        self.assertEqual(set(evidence['prerequisite_checks'].values()), {'pass'})
        self.assertEqual(evidence['status'], 'BLOCKED')
        self.assertEqual(set(evidence['qa_checks'].values()), {'blocked'})

    def test_html_or_redirect_is_not_health_success(self):
        for status, body in [(200, None), (302, None), (0, None)]:
            evidence = live_preflight('https://staging.example',
                allowed_origin='https://staging.example', fetch=lambda _: (status, body))
            self.assertEqual(evidence['prerequisite_checks']['staging_health'], 'fail')

    def test_successful_unauthenticated_access_is_failure(self):
        evidence = live_preflight('https://staging.example',
            allowed_origin='https://staging.example', fetch=lambda _: (200, {}))
        self.assertEqual(evidence['prerequisite_checks']['unauthenticated_identity_denied'], 'fail')

    def variables(self):
        return {'SUPABASE_URL': 'https://' + 'a' * 20 + '.supabase.co',
                'VITE_SUPABASE_URL': 'https://' + 'a' * 20 + '.supabase.co',
                'SUPABASE_EXPECTED_PROJECT_REF': 'a' * 20,
                'SUPABASE_SECRET_KEY': 'synthetic-not-a-credential',
                'VITE_SUPABASE_ANON_KEY': 'synthetic-public-key'}

    def audit(self, variables):
        return configuration_checks(variables, 'a' * 20,
            staging_origin='https://staging.example', forbidden_origins=['https://production.example'])

    def test_names_and_urls_cannot_attest_secret_provenance(self):
        evidence = self.audit(self.variables())
        self.assertEqual(evidence['server_key_development_provenance'], 'blocked')
        self.assertNotIn('synthetic-not-a-credential', repr(evidence))

    def test_wrong_project_and_mail_fail(self):
        variables = {**self.variables(), 'SUPABASE_URL': 'https://' + 'b' * 20 + '.supabase.co',
                     'RESEND_API_KEY': 'synthetic-mail-key'}
        evidence = self.audit(variables)
        self.assertEqual(evidence['development_server_url'], 'fail')
        self.assertEqual(evidence['no_mail_capability'], 'fail')
        self.assertNotIn('synthetic-mail-key', repr(evidence))

    def test_extra_cloud_authority_is_rejected(self):
        evidence = self.audit({**self.variables(), 'RAILWAY_API_TOKEN': 'synthetic-token'})
        self.assertEqual(evidence['no_extra_cloud_credentials'], 'fail')

    def test_unknown_variable_fails_closed(self):
        evidence = self.audit({**self.variables(), 'UNREVIEWED_SECRET': 'synthetic-token'})
        self.assertEqual(evidence['only_reviewed_variables'], 'fail')

    def test_production_origin_rejected(self):
        with self.assertRaises(ValueError):
            configuration_checks({}, 'a' * 20, staging_origin='https://production.example',
                                 forbidden_origins=['https://production.example'])


if __name__ == '__main__':
    unittest.main()
