import assert from 'node:assert/strict'
import test from 'node:test'

import { resolvePythonCommand } from './phase1-inspection-vertical-slice.mjs'
import { runRound1ReasoningBenchmark } from './phase1-round1-reasoning-benchmark.mjs'

test('Round 1 reasoning benchmark can find the shared PDF-capable Python runtime', () => {
  const python = resolvePythonCommand()
  assert.ok(python)
})

test('Round 1 reasoning benchmark passes synthetic reasoning self-test', () => {
  const { result } = runRound1ReasoningBenchmark(['--self-test'])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /self-test passed/)
  assert.equal(result.stderr, '')
})
