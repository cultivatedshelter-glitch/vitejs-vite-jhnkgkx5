import assert from 'node:assert/strict'
import test from 'node:test'

import { resolvePythonCommand } from './phase1-inspection-vertical-slice.mjs'
import { runPhase1LiveSourceIntegration } from './phase1-live-source-integration.mjs'

test('Phase 1 live source integration can find the shared Python runtime', () => {
  assert.ok(resolvePythonCommand())
})

test('Phase 1 source integration passes pricing, weather, persistence, and end-to-end fixture tests', () => {
  const { result } = runPhase1LiveSourceIntegration(['--self-test'])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /self-test passed/)
  assert.equal(result.stderr, '')
})
