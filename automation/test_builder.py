from hashlib import sha256
from pathlib import Path
import tempfile
import unittest
from builder import BuilderBlocked, context_files, path_allowed, request_proposal, validate_proposal


class BuilderTests(unittest.TestCase):
    def test_paths_cannot_modify_cloud_or_authorization_controls(self):
        for path in ['.env', '.github/workflows/x.yml', 'automation/engineering_loop.py',
                     '../server/x.mjs', 'src/../server/x.mjs', 'src//x.ts',
                     '/src/x.ts', 'server/phase1SupabaseRepository.mjs', 'src/main.tsx']:
            self.assertFalse(path_allowed(path), path)
        self.assertTrue(path_allowed('src/Phase1Experience.tsx'))

    def test_duplicate_paths_rejected(self):
        entry = {'path': 'public/engineering-smoke.txt', 'content': 'synthetic\n'}
        with self.assertRaises(BuilderBlocked):
            validate_proposal({'summary': 'synthetic', 'files': [entry, entry]})

    def test_no_file_proposal_blocks_instead_of_claiming_success(self):
        with self.assertRaises(BuilderBlocked):
            validate_proposal({'summary': 'cannot safely change protected code', 'files': []})

    def test_model_cannot_return_commands(self):
        with self.assertRaises(BuilderBlocked):
            validate_proposal({'summary': 'x', 'files': [], 'command': 'deploy-production'})

    def test_credential_bearing_source_is_not_sent_to_model(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'src').mkdir()
            (root / 'src/example.ts').write_text("const key='sb_secret_syntheticcredential12345'")
            with self.assertRaises(BuilderBlocked):
                context_files(root, ['src/example.ts'])

    def test_symlink_context_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'src').mkdir()
            (root / 'outside.txt').write_text('synthetic')
            (root / 'src/example.ts').symlink_to(root / 'outside.txt')
            with self.assertRaises(BuilderBlocked):
                context_files(root, ['src/example.ts'])

    def test_digest_mismatch_blocks_before_request(self):
        with self.assertRaises(BuilderBlocked):
            request_proposal(api_key='synthetic', model='configured-model', task_text='x',
                task_digest='0' * 64, files={}, doctrine='',
                transport=lambda _: self.fail('must not call model'))

    def test_structured_response_can_propose_harmless_synthetic_change(self):
        import json
        task = 'Add newline to synthetic engineering smoke fixture.'
        proposal = {'summary': 'Normalize synthetic fixture newline',
                    'files': [{'path': 'public/engineering-smoke.txt', 'content': 'synthetic\n'}]}
        def transport(payload):
            self.assertFalse(payload['store'])
            self.assertEqual(payload['max_output_tokens'], 8000)
            self.assertNotIn('synthetic-api-credential', repr(payload))
            return {'status': 'completed', 'output': [{'type': 'message',
                'content': [{'type': 'output_text', 'text': json.dumps(proposal)}]}]}
        result = request_proposal(api_key='synthetic-api-credential', model='configured-model',
            task_text=task, task_digest=sha256(task.encode()).hexdigest(),
            files={'public/engineering-smoke.txt': 'synthetic'}, doctrine='', transport=transport)
        self.assertEqual(result, proposal)

    def test_incomplete_model_generation_blocks(self):
        with self.assertRaises(BuilderBlocked):
            request_proposal(api_key='synthetic', model='configured-model', task_text='x',
                task_digest=sha256(b'x').hexdigest(), files={}, doctrine='',
                transport=lambda _: {'status': 'incomplete'})


if __name__ == '__main__':
    unittest.main()
