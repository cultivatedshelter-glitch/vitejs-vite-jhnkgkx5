import assert from 'node:assert/strict'
import test from 'node:test'

import { resolvePythonCommand } from './phase1-inspection-vertical-slice.mjs'
import { runRound1cHumanReview } from './phase1-round1c-human-review.mjs'

test('Round 1C human-review prototype can find the shared Python runtime', () => {
  assert.ok(resolvePythonCommand())
})

test('Round 1C human-review prototype passes sanitized border-crossing self-test', () => {
  const { result } = runRound1cHumanReview(['--self-test'])

  assert.equal(result.status, 0)
  assert.match(result.stdout, /self-test passed/)
  assert.equal(result.stderr, '')
})
