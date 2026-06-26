import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { buildAdminTaskDraft } from '../src/agents/adminTaskWorkbench.ts'
import {
  buildInspectionIntelligenceDraft,
  buildOperationalFeedEntriesFromBundles,
  extractInspectionFindings,
  isRiverRoadInspectionContext,
} from '../src/agents/inspectionIntelligence.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const riverRoadText = readFileSync(join(__dirname, 'fixtures', 'river-rd-inspection-excerpts.txt'), 'utf8')

const expectedBundleTitles = [
  'Roof / Water Intrusion',
  'Exterior Envelope / Siding / Skirting / Pest Entry',
  'Bathroom Moisture / Plumbing',
  'Ceiling / Possible Hidden Damage',
  'Crawlspace / Underfloor Protection',
  'HVAC / Electrical Safety',
  'General Maintenance / Minor Repairs',
]

function buildRiverRoadDraft() {
  const findings = extractInspectionFindings(riverRoadText)
  return buildInspectionIntelligenceDraft({
    fileName: '2681 SE River Rd Unit 10 inspection.pdf',
    reportType: 'Inspection report',
    propertyAddress: '2681 SE River Rd Unit 10',
    city: '',
    state: 'OR',
    inspectionDate: '',
    inspectorName: '',
    inspectorCompany: '',
    findings,
    missingInfo: [],
    propertyId: 'property-river-rd',
  })
}

test('River Rd representative inspection text creates exactly seven operational bundles', () => {
  assert.equal(isRiverRoadInspectionContext(riverRoadText), true)

  const draft = buildRiverRoadDraft()
  const bundles = draft.workGroups

  assert.equal(bundles.length, 7)
  assert.deepEqual(bundles.map((bundle) => bundle.title), expectedBundleTitles)
})

test('River Rd bundles keep required clue-based and review-gated fields', () => {
  const bundles = buildRiverRoadDraft().workGroups

  for (const bundle of bundles) {
    assert.ok(Array.isArray(bundle.known_facts) && bundle.known_facts.length > 0, `${bundle.title} missing known_facts`)
    assert.ok(Array.isArray(bundle.unknowns) && bundle.unknowns.length > 0, `${bundle.title} missing unknowns`)
    assert.ok(Array.isArray(bundle.clues) && bundle.clues.length > 0, `${bundle.title} missing clues`)
    assert.ok(
      Array.isArray(bundle.next_evidence_needed) && bundle.next_evidence_needed.length > 0,
      `${bundle.title} missing next_evidence_needed`
    )
    assert.equal(typeof bundle.trade_owner, 'string', `${bundle.title} missing trade_owner`)
    assert.ok(bundle.trade_owner.length > 0, `${bundle.title} empty trade_owner`)
    assert.equal(bundle.status, 'ai_draft', `${bundle.title} status should remain ai_draft`)
    assert.equal(bundle.review_status, 'needs_review', `${bundle.title} review_status should remain needs_review`)
    assert.ok(
      Array.isArray(bundle.evidence_references) && bundle.evidence_references.length > 0,
      `${bundle.title} missing evidence_references`
    )
  }
})

test('River Rd operational feed entries keep Finding / Move / Owner / Status structure', () => {
  const bundles = buildRiverRoadDraft().workGroups
  const entries = buildOperationalFeedEntriesFromBundles(bundles)

  assert.ok(entries.length >= expectedBundleTitles.length)

  for (const entry of entries) {
    assert.equal(typeof entry.finding, 'string')
    assert.equal(typeof entry.move, 'string')
    assert.equal(typeof entry.owner, 'string')
    assert.equal(typeof entry.status, 'string')
    assert.ok(entry.finding.trim().length > 0, 'feed entry missing Finding')
    assert.ok(entry.move.trim().length > 0, 'feed entry missing Move')
    assert.ok(entry.owner.trim().length > 0, 'feed entry missing Owner')
    assert.ok(entry.status.trim().length > 0, 'feed entry missing Status')
    assert.match(entry.move, /Grouped into .+ bundle\./)
  }
})

test('Admin Task Workbench estimate drafts stay draft-only and source-verification gated', () => {
  const bundles = buildRiverRoadDraft().workGroups

  for (const bundle of bundles) {
    const task = buildAdminTaskDraft({
      propertyId: 'property-river-rd',
      bundle,
      taskType: 'estimate_bundle',
      adminPrompt: `Estimate this bundle: ${bundle.title}`,
      now: new Date('2026-06-26T12:00:00.000Z'),
    })
    const estimate = task.output_json
    const serialized = JSON.stringify(task).toLowerCase()

    assert.equal(task.status, 'needs_review', `${bundle.title} task status must stay needs_review`)
    assert.equal(task.review_status, 'needs_review', `${bundle.title} task review_status must stay needs_review`)
    assert.equal(estimate.review_status, 'needs_review', `${bundle.title} estimate review_status must stay needs_review`)
    assert.match(task.output_summary, /AI Draft/)
    assert.match(estimate.admin_notes, /AI Draft \/ Needs Review/)
    assert.ok(estimate.missing_info.length > 0, `${bundle.title} missing info should be present`)
    assert.ok(estimate.pricing_sources.some((source) => /placeholder local draft/i.test(source)))
    assert.ok(estimate.pricing_sources.some((source) => /not implemented|not applied automatically/i.test(source)))
    assert.ok(estimate.assumptions.some((assumption) => /placeholder assumptions/i.test(assumption)))
    assert.ok(estimate.material_items.length > 0, `${bundle.title} material items should be present`)

    for (const material of estimate.material_items) {
      assert.match(material.source, /Placeholder local draft/)
      assert.match(material.source, /live source verification not implemented/)
      assert.equal(material.confidence, 'low')
      assert.equal(material.source_date, '2026-06-26')
    }

    assert.equal(task.approved_at, undefined, `${bundle.title} should not be approved on draft creation`)
    assert.doesNotMatch(serialized, /contractor_verified/)
    assert.doesNotMatch(serialized, /memory_verified/)
    assert.doesNotMatch(serialized, /final pricing approved/)
    assert.doesNotMatch(serialized, /seller-ready pricing approved/)
    assert.doesNotMatch(serialized, /memory_record_id/)
  }
})
