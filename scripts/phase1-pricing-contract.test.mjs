import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
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

test('repair paths and sources stay relevant to the source-reported condition', () => {
  const python = resolvePythonCommand()
  const code = `
import json
from scripts.phase1_decision_support import _matching_research_rule, _matching_rule, comparison_sources

def audit(title, statement):
    record = {"finding_card": {"finding_title": title}, "source": {"inspector_statement": statement}}
    profile = _matching_research_rule(record)
    paths, _ = _matching_rule(record)
    return {
        "research": profile["source_ids"] if profile else [],
        "paths": [{"id": path["id"], "sources": [source["id"] for source in comparison_sources(path["source_id"])]} for path in paths],
    }

print(json.dumps({
    "hard_surface": audit("Hard Surfaces- Deterioration", "Patio or walk touches the wood structure and deterioration is visible."),
    "fasteners": audit("Exposed Fasteners", "Exposed roof fasteners should have grommets or caulking."),
    "knockout": audit("Unprotected Knockout Opening", "An electrical panel knockout is oversized and lacks protection."),
    "afci": audit("AFCI: None Installed (Modern Stds.)", "No AFCI protection was installed."),
}))
`
  const result = spawnSync(python, ['-c', code], { cwd: process.cwd(), encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const audit = JSON.parse(result.stdout)
  assert.deepEqual(audit.hard_surface.research, ['hardie-clearance', 'homeguide-siding-repair'])
  assert.deepEqual(audit.hard_surface.paths.map((path) => path.id), ['repair-contact-damage', 'restore-wall-clearance'])
  assert.equal(audit.hard_surface.paths[1].sources.length, 0)
  assert.deepEqual(audit.fasteners.research, ['gaf-exposed-fasteners', 'homeguide-roof-minor', 'angi-roof-repair'])
  assert.deepEqual(audit.fasteners.paths.map((path) => path.id), ['targeted-roof-fastener-repair'])
  assert.deepEqual(audit.knockout.research, ['schneider-panel-filler', 'homeguide-electrical-small'])
  assert.deepEqual(audit.knockout.paths[0].sources, ['homeguide-electrical-small'])
  assert.ok(audit.afci.research.includes('esfi-afci'))
  assert.ok(audit.afci.paths.every((path) => !path.sources.includes('angi-outlet-repair')))
})
