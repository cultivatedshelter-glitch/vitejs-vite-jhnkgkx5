import assert from 'node:assert/strict'
import test from 'node:test'

import { resolvePythonCommand } from './phase1-inspection-vertical-slice.mjs'
import { runInspectionEvidenceCache } from './phase1-inspection-evidence-cache.mjs'

test('shared inspection evidence cache can find the shared PDF-capable Python runtime', () => {
  const python = resolvePythonCommand()
  assert.ok(python)
})

test('shared inspection evidence cache passes synthetic parser and routing self-test', () => {
  const { result } = runInspectionEvidenceCache(['--self-test'])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /self-test passed/)
  assert.equal(result.stderr, '')
})
