import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const python = process.env.SHELTER_PREP_PYTHON || '.venv/bin/python'

function artifact({ interpretation, research = ['technical-source'] }) {
  return {
    schemaVersion: 'investigation-test',
    external_sources: [{ id: 'technical-source', source_name: 'Technical source', source_url: 'https://example.com', scope_basis: 'Issue-specific guidance.' }],
    atomicObservations: [{
      id: 'observation-1',
      source: { source_item_number: '1.1' },
      organization: { building_system: 'Plumbing' },
      epistemic_states: { shelter_prep_interpretation: interpretation },
      finding_card: {
        finding_title: 'Loose toilet', next_step_owner: 'Licensed plumber', research_source_refs: research,
        what_we_dont_know: ['Flange and floor condition are unknown.'],
        recommended_next_step: 'Confirm whether the flange is intact and the floor is sound.',
        repair_paths: [{ label: 'Reset existing toilet', price_source_refs: ['technical-source'], price_low: 250, price_high: 600, price_unit: 'project', range_status: 'broad_preliminary' }],
      },
    }],
  }
}

test('finding investigation audit distinguishes sourced synthesis from paraphrase-only output', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'phase1-investigation-audit-'))
  try {
    const good = join(directory, 'good.json'); const goodOutput = join(directory, 'good-audit.json'); const bad = join(directory, 'bad.json')
    await writeFile(good, JSON.stringify(artifact({ interpretation: 'Fixture movement can reflect mounting, flange, seal, or floor conditions; those facts select reset, flange repair, or replacement.' })))
    await writeFile(bad, JSON.stringify(artifact({ interpretation: 'The inspector reported movement. Shelter Prep can organize it as a plumbing item.', research: [] })))
    const goodRun = spawnSync(python, ['scripts/phase1_investigation_audit.py', good, '--output', goodOutput], { encoding: 'utf8' })
    const badRun = spawnSync(python, ['scripts/phase1_investigation_audit.py', bad], { encoding: 'utf8' })
    assert.equal(goodRun.status, 0, goodRun.stderr)
    const audit = JSON.parse(await readFile(goodOutput, 'utf8'))
    assert.equal(audit.paraphrase_only_count, 0)
    assert.equal(audit.findings_with_research_sources, 1)
    assert.equal(audit.findings[0].pricing_source_count, undefined)
    assert.equal(audit.findings[0].repair_paths[0].pricing_source_count, 1)
    assert.notEqual(badRun.status, 0)
    assert.match(badRun.stdout, /"paraphrase_only_count": 1/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
