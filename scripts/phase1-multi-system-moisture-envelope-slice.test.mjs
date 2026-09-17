import assert from 'node:assert/strict'
import test from 'node:test'

import { resolvePythonCommand } from './phase1-inspection-vertical-slice.mjs'
import { runMoistureEnvelopeSlice } from './phase1-multi-system-moisture-envelope-slice.mjs'

test('Step 6 moisture/envelope adapter can find the shared PDF-capable Python runtime', () => {
  const python = resolvePythonCommand()
  assert.ok(python)
})

test('Step 6 moisture/envelope adapter passes synthetic parser and routing self-test', () => {
  const { result } = runMoistureEnvelopeSlice(['--self-test'])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /self-test passed/)
  assert.equal(result.stderr, '')
})
