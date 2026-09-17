import assert from 'node:assert/strict'
import test from 'node:test'

import { resolvePythonCommand } from './phase1-inspection-vertical-slice.mjs'
import { runPhase1PricingContract } from './phase1-pricing-contract.mjs'

test('Phase 1 pricing contract can find the shared Python runtime', () => {
  assert.ok(resolvePythonCommand())
})

test('Phase 1 pricing contract passes range, provenance, history, geography, quote, conflict, and review tests', () => {
  const { result } = runPhase1PricingContract(['--self-test'])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /self-test passed/)
  assert.equal(result.stderr, '')
})
