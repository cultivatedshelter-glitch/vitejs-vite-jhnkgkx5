import assert from 'node:assert/strict'
import test from 'node:test'

import { resolvePythonCommand } from './phase1-inspection-vertical-slice.mjs'
import { runElectricalSlice } from './phase1-multi-system-electrical-slice.mjs'

test('Step 6 electrical adapter can find the shared PDF-capable Python runtime', () => {
  const python = resolvePythonCommand()
  assert.ok(python)
})

test('Step 6 electrical adapter passes synthetic parser and routing self-test', () => {
  const { result } = runElectricalSlice(['--self-test'])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /self-test passed/)
  assert.equal(result.stderr, '')
})
