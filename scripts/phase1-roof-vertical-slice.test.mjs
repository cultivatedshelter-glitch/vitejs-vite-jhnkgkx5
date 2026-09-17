import assert from 'node:assert/strict'
import test from 'node:test'

import { resolvePythonCommand, runVerticalSlice } from './phase1-inspection-vertical-slice.mjs'

test('Step 4 roof adapter can find a PDF-capable Python runtime', () => {
  const python = resolvePythonCommand()
  assert.ok(python)
})

test('Step 4 roof adapter passes synthetic parser self-test without private fixture', () => {
  const { result } = runVerticalSlice(['--self-test'])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /self-test passed/)
  assert.equal(result.stderr, '')
})
