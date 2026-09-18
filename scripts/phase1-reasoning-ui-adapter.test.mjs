import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  Phase1ArtifactError,
  adaptPhase1ReasoningArtifact,
} from '../src/phase1ReasoningAdapter.ts'
import { runPhase1LiveSourceIntegration } from './phase1-live-source-integration.mjs'

const fixture = JSON.parse(await readFile(new URL('../public/phase1-round1g-moisture.fixture.json', import.meta.url), 'utf8'))

test('committed UI fixture retains the actual Round 1G integration contract values', () => {
  const { result } = runPhase1LiveSourceIntegration(['--print-fixture'])
  assert.equal(result.status, 0)
  const generated = JSON.parse(result.stdout)
  assert.equal(fixture.schema_version, generated.schema_version)
  for (const field of [
    'finding_title',
    'price_low',
    'price_high',
    'price_stage',
    'price_geography',
    'price_source_refs',
    'price_range_explanation',
    'what_we_know',
    'what_we_dont_know',
    'recommended_next_step',
    'next_step_owner',
    'why_next_step',
    'review_status',
    'pricing_contract_status',
    'contractor_quote',
  ]) {
    assert.deepEqual(fixture.finding_card[field], generated.finding_card[field], field)
  }
  assert.deepEqual(fixture.finding_card.range_history[0].new_low, generated.finding_card.range_history[0].new_low)
  assert.deepEqual(fixture.finding_card.range_history[0].new_high, generated.finding_card.range_history[0].new_high)
  assert.deepEqual(fixture.finding_card.weather_context.claim.claim_text, generated.finding_card.weather_context.claim.claim_text)
  assert.deepEqual(
    fixture.external_sources.map((source) => source.source_id),
    generated.external_sources.map((source) => source.source_id),
  )
  assert.deepEqual(
    fixture.claims.map((claim) => [claim.claim_id, claim.claim_text, claim.source_refs]),
    generated.claims.map((claim) => [claim.claim_id, claim.claim_text, claim.source_refs]),
  )
})

function unpricedCard(title, weatherContext) {
  return {
    finding_title: title,
    price_low: null,
    price_high: null,
    price_stage: 'blocked_missing_sourced_range',
    price_geography: { most_defensible_available_geography: 'city', label: 'Portland, OR' },
    price_source_refs: [],
    price_range_explanation: 'No sourced repair-cost range has been supplied.',
    range_history: [],
    what_we_know: [`Inspector reports: ${title}`],
    what_we_dont_know: ['Whether the condition is active.'],
    weather_context: weatherContext,
    recommended_next_step: 'Collect one targeted photo.',
    next_step_owner: 'field reviewer',
    why_next_step: 'The photo would establish current condition and location.',
    review_status: 'needs_human_review',
    evidence_refs: { image_ids: ['image-1'] },
    source_refs: { source_file_id: 'report-1', source_page: 4, source_section: 'Exterior' },
    pricing_contract_status: 'BLOCKED_MISSING_SOURCED_RANGE',
  }
}

const liveArtifact = {
  schemaVersion: 'shelter-prep-phase1-round1g-source-integration-contract.v1',
  propertyReportReconstruction: {
    property: { address_line1: '100 Main St', city: 'Portland', state: 'OR', zip: '97201' },
  },
  atomicObservations: [
    {
      id: 'observation-1',
      source: { inspector_statement: 'Damaged roof flashing.', when_observed: '2026-05-14' },
      organization: { building_system: 'Roofing' },
      epistemic_states: { source_observation: 'Damaged flashing is visible.' },
      smallest_useful_next_evidence: { next_evidence_needed: 'Obtain a close flashing photo.' },
      finding_card: unpricedCard('Damaged roof flashing.', {
        status: 'not_researched_local_round1',
        is_relevant_to_interpretation: true,
        weather_sources: [],
        weather_claims: [],
      }),
    },
    {
      id: 'observation-2',
      source: { inspector_statement: 'Loose handrail.', when_observed: '2026-05-14' },
      organization: { building_system: 'Interior Safety' },
      epistemic_states: { source_observation: 'The stair handrail is loose.' },
      finding_card: unpricedCard('Loose handrail.', {
        status: 'not_relevant_to_current_source_observation',
        is_relevant_to_interpretation: false,
      }),
    },
  ],
  relationshipCandidates: [
    {
      type: 'potential_condition_relationship',
      related_atomic_observation_ids: ['observation-1', 'observation-2'],
    },
  ],
}

test('actual Round 1G bundle maps into one complete finding view model', () => {
  const result = adaptPhase1ReasoningArtifact(fixture, { mode: 'fixture' })
  assert.equal(result.findings.length, 1)
  assert.equal(result.isFixture, true)
  const finding = result.findings[0]
  assert.equal(finding.price.label, '$900–$3,000')
  assert.equal(finding.price.geography, 'Exampletown')
  assert.equal(finding.contractorQuote?.label, '$1,475')
  assert.notEqual(finding.contractorQuote?.sourceId, finding.price.sourceIds[0])
  assert.match(finding.weather?.text ?? '', /does not establish cause/i)
  assert.equal(finding.rangeHistory.length, 1)
  assert.equal(finding.reviewStatusLabel, 'Needs Human Review')
  assert.deepEqual(finding.sources.map((source) => source.id).sort(), [
    'fixture-city-repair-benchmark',
    'fixture-contractor-quote',
    'weather-source-61fe69b84e7f79140f74',
  ])
})

test('fixture-backed output cannot masquerade as live output', () => {
  assert.throws(
    () => adaptPhase1ReasoningArtifact(fixture, { mode: 'live' }),
    (error) => error instanceof Phase1ArtifactError && /explicit development\/test mode/.test(error.message),
  )
})

test('Round 1 artifact derives dynamic counts, categories, blocked pricing, and relationships', () => {
  const result = adaptPhase1ReasoningArtifact(liveArtifact, { mode: 'live' })
  assert.equal(result.findings.length, 2)
  assert.equal(result.categories.length, 2)
  assert.equal(result.openQuestionCount, 2)
  assert.equal(result.propertyAddress, '100 Main St, Portland, OR, 97201')
  assert.equal(result.findings[0].price.status, 'blocked')
  assert.equal(result.findings[0].price.label, 'Not yet sourced')
  assert.equal(result.findings[0].weather?.status, 'unavailable')
  assert.equal(result.findings[1].weather, null)
  assert.deepEqual(result.findings[0].relatedFindings, ['Loose handrail.'])
})

test('human correction overlays preserve the draft and agent output includes only reviewed delivery-eligible findings', () => {
  const reviewed = structuredClone(liveArtifact)
  reviewed.reviewState = {
    'observation-1': {
      findingId: 'finding-1',
      status: 'human_reviewed',
      event: {
        review_action: 'edit',
        reviewer_id: 'reviewer-1',
        created_at: '2026-09-18T12:00:00Z',
        reason: 'Corrected from source review.',
        new_value: {
          delivery_eligible: true,
          source_layer_preserved: true,
          ai_draft_preserved: true,
          corrections: {
            title: 'Reviewed flashing damage',
            known: ['Flashing damage is visible in the report.'],
            unknown: ['Whether water entered the assembly.'],
            affected_location: { location_text: 'West roof edge' },
            price: { low: 1200, high: 2400, source_reference: 'Contractor proposal 2026-09-18' },
          },
        },
      },
    },
  }
  const reviewer = adaptPhase1ReasoningArtifact(reviewed, { mode: 'live', audience: 'reviewer' })
  assert.equal(reviewer.findings[0].title, 'Reviewed flashing damage')
  assert.deepEqual(reviewer.findings[0].known, ['Flashing damage is visible in the report.'])
  assert.equal(reviewer.findings[0].affectedLocation.sourceBasis, 'human_entered')
  assert.equal(reviewer.findings[0].price.label, '$1,200–$2,400')

  const agent = adaptPhase1ReasoningArtifact(reviewed, { mode: 'live', audience: 'agent' })
  assert.equal(agent.totalFindingCount, 2)
  assert.equal(agent.findings.length, 1)
  assert.equal(agent.findings[0].id, 'observation-1')

  const released = structuredClone(liveArtifact)
  released.atomicObservations = [released.atomicObservations[0]]
  released.atomicObservations[0].finding_card.review_status = 'human_reviewed'
  released.atomicObservations[0].finding_card.released_to_agent = true
  released.atomicObservations[0].finding_card.released_price_correction = {
    low: 1200,
    high: 2400,
    source_reference: 'Reviewed local proposal',
    geography: 'Portland metro',
    path_id: 'repair-flashing',
  }
  released.atomicObservations[0].finding_card.repair_paths = [{
    id: 'repair-flashing', label: 'Repair the flashing', price_low: 200, price_high: 500,
    price_unit: 'project', price_geography: { label: 'United States' }, price_source_refs: [],
  }]
  const releasedAgent = adaptPhase1ReasoningArtifact(released, { mode: 'live', audience: 'agent' })
  assert.equal(releasedAgent.findings.length, 1)
  assert.equal(releasedAgent.findings[0].repairPaths[0].priceLabel, '$1,200–$2,400')
  assert.equal(releasedAgent.findings[0].repairPaths[0].geography, 'Portland metro')
  assert.equal(releasedAgent.findings[0].repairPaths[0].sources[0].label, 'Reviewed local proposal')
})

test('missing optional fields fail gracefully without inventing money or provenance', () => {
  const result = adaptPhase1ReasoningArtifact({
    schema_version: 'minimal',
    finding_card: {
      finding_title: 'Minimal finding',
      pricing_contract_status: 'BLOCKED_MISSING_SOURCED_RANGE',
    },
  }, { mode: 'live' })
  const finding = result.findings[0]
  assert.equal(finding.title, 'Minimal finding')
  assert.equal(finding.price.label, 'Not yet sourced')
  assert.equal(finding.sources.length, 0)
  assert.equal(finding.contractorQuote, null)
  assert.equal(finding.weather, null)
  assert.match(finding.nextStep, /Human review/i)
})

test('candidate evidence and page previews remain unconfirmed until a human correction', () => {
  const artifact = structuredClone(liveArtifact)
  artifact.atomicObservations[0].finding_card.source_evidence = {
    document_name: 'inspection.pdf',
    source_page: 12,
    candidate_photos: [{ image_id: 'image-12-1', source_page: 13, association_strength: 'strong', association_reason: 'Follows the finding.', confirmation_required: true }],
    page_previews: [{ page: 12, relationship: 'source_page', text_excerpt: 'Inspector source text.' }, { page: 13, relationship: 'next_page', text_excerpt: 'Adjacent report content.' }],
    full_report_available: true,
  }
  const draft = adaptPhase1ReasoningArtifact(artifact, { mode: 'live' }).findings[0]
  assert.equal(draft.sourceEvidence.primaryPhoto, null)
  assert.equal(draft.sourceEvidence.candidatePhotos[0].strength, 'strong')
  assert.equal(draft.sourceEvidence.candidatePhotos[0].confirmationRequired, true)
  assert.equal(draft.sourceEvidence.pagePreviews.length, 2)
  assert.equal(draft.sourceEvidence.confirmedEvidence, null)

  artifact.reviewState = { 'observation-1': { status: 'human_reviewed', event: { review_action: 'edit', new_value: { delivery_eligible: true, corrections: { evidence_relationship: 'Confirmed against the report.', confirmed_evidence: { image_id: 'image-12-1' } } } } } }
  const reviewed = adaptPhase1ReasoningArtifact(artifact, { mode: 'live' }).findings[0]
  assert.equal(reviewed.sourceEvidence.confirmedEvidence?.imageId, 'image-12-1')
})
