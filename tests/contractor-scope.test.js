import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  applyContractorScopeReviewRpc,
  buildContractorScopeDraft,
  isScopeEligibleFinding,
  prepareContractorScopeRpc,
} from '../src/lib/contractorScope.ts'

const migration = readFileSync(
  new URL('../supabase/migrations/202608240002_verified_finding_contractor_scope.sql', import.meta.url),
  'utf8'
)

const finding = {
  id: 'finding-1',
  property_id: 42,
  inspection_report_id: 'report-1',
  repair_bundle_id: 'bundle-1',
  source_text: 'Inspector documented moisture staining below the bathroom exhaust penetration.',
  category: 'Roof / moisture',
  trade: 'Roofing',
  description: 'Possible failure at the roof-side vent termination or flashing.',
  location: 'Bathroom exhaust',
  severity: 'Needs review',
  urgency: 'Standard',
  buyer_impact_score: 4,
  inspection_risk_score: 5,
  recommendation: 'contractor_review',
  estimate_low: 0,
  estimate_high: 0,
  confidence: 'Low',
  missing_info: ['Condition of roof sheathing', 'Attic-side duct connection'],
  status: 'approved',
  admin_notes: '',
}

const scope = {
  id: 'a4f79e4b-978d-44cb-bb64-935526e6a523',
  property_id: 42,
  lead_id: '33f4195a-f462-4cbc-814f-3fd10ad54bed',
  source_finding_id: finding.id,
  source_review_event_id: 'c4a5d69a-f7d5-40cf-965b-1504532ecf0d',
  source_evidence_ids: ['evidence-1'],
  source_references: ['report-1'],
  title: 'Bathroom exhaust investigation',
  repair_objective: 'Investigate and provide a professional corrective recommendation.',
  trade_category: 'Roofing',
  known_conditions: [finding.source_text],
  reviewed_interpretation: finding.description,
  unknown_conditions: [...finding.missing_info],
  field_verification_items: ['Inspect the roof penetration and attic-side duct connection.'],
  missing_information: [...finding.missing_info],
  access_setup_notes: [],
  sequencing_dependencies: ['Field verify before final scope.'],
  cleanup_disposal_expectations: [],
  exclusions: ['Pricing is not included.'],
  scope_status: 'needs_review',
  generation_provenance: { generator: 'verified_finding_scope_v1' },
  created_at: '2026-08-24T00:00:00Z',
  created_by: 'admin-1',
  reviewed_by: null,
  reviewed_at: null,
}

test('unverified or rejected findings are not scope eligible', () => {
  assert.equal(isScopeEligibleFinding({ status: 'needs_review' }), false)
  assert.equal(isScopeEligibleFinding({ status: 'rejected' }), false)
  assert.match(migration, /Only a human-verified inspection finding can produce contractor scope/)
})

test('eligible verified finding produces a conservative scope draft', () => {
  assert.equal(isScopeEligibleFinding(finding), true)
  const draft = buildContractorScopeDraft(finding)
  assert.match(draft.title, /Bathroom exhaust/)
  assert.match(draft.repair_objective, /Investigate/)
  assert.doesNotMatch(draft.repair_objective, /confirmed hidden damage/i)
})

test('scope provenance is derived from the locked finding review event', () => {
  assert.match(migration, /e\.payload->'next_value'=v_finding/)
  assert.match(migration, /'source_finding_id',p_source_finding_id,'source_review_event_id',v_source_review\.id/)
  assert.match(migration, /v_evidence_ids:=coalesce\(v_source_review\.payload->'evidence_ids'/)
})

test('missing source and review provenance are rejected', () => {
  assert.match(migration, /Verified finding source_text is required/)
  assert.match(migration, /no matching authoritative approval event/)
  assert.match(migration, /missing required evidence\/source provenance/)
})

test('unknown facts remain explicitly unknown', () => {
  const draft = buildContractorScopeDraft(finding)
  assert.deepEqual(draft.unknown_conditions, finding.missing_info)
  assert.match(migration, /Unknown conditions and field verification must remain explicit/)
})

test('field verification requirements persist into the draft and approval boundary', () => {
  const draft = buildContractorScopeDraft(finding)
  assert.ok(draft.field_verification_items.some((item) => /onsite/i.test(item)))
  assert.match(migration, /Approved scope must retain its objective, unknowns, and field verification/)
})

test('scope generation remains needs_review and never accepts a client status', async () => {
  let submitted
  const client = {
    async rpc(name, args) {
      submitted = { name, args }
      return { data: [scope], error: null }
    },
  }
  const result = await prepareContractorScopeRpc({
    client,
    leadId: scope.lead_id,
    expectedPropertyId: 42,
    sourceFindingId: finding.id,
    draft: buildContractorScopeDraft(finding),
  })
  assert.equal(result.scope_status, 'needs_review')
  assert.equal(submitted.name, 'prepare_contractor_scope')
  assert.equal('scope_status' in submitted.args.p_draft, false)
  assert.match(migration, /v_exclusions,'needs_review'/)
})

test('human approval RPC is required before Contractor Ready', async () => {
  const calls = []
  const client = {
    async rpc(name, args) {
      calls.push([name, args])
      return { data: [{ review_event_id: 'event-2', scope: { ...scope, scope_status: 'contractor_ready' }, reviewer_id: 'admin-1' }], error: null }
    },
  }
  const result = await applyContractorScopeReviewRpc({ client, scopeId: scope.id, previousScope: scope, nextScope: scope, action: 'approve' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], 'apply_contractor_scope_review')
  assert.equal(result.scope.scope_status, 'contractor_ready')
  assert.match(migration, /p_review_action='approve' then 'contractor_ready'/)
})

test('browser cannot directly bypass authoritative approval', () => {
  assert.match(migration, /revoke insert,update,delete on table public\.contractor_scope_packets from anon,authenticated/)
  assert.match(migration, /drop policy if exists "contractor_scope_packets admin manage"/)
  assert.match(migration, /v_actor_id uuid := auth\.uid\(\)/)
  assert.doesNotMatch(migration, /p_reviewer_id/)
})

test('stale or provenance-changing approval fails before writes', () => {
  const staleAt = migration.indexOf('Contractor scope review is stale; reload the latest saved state.')
  const immutableAt = migration.indexOf('Contractor scope provenance or server-managed state cannot be changed by the client.')
  const updateAt = migration.indexOf('update public.contractor_scope_packets set')
  assert.ok(staleAt > 0 && staleAt < updateAt)
  assert.ok(immutableAt > staleAt && immutableAt < updateAt)
})

test('approval event and committed scope state are one atomic function transition', () => {
  const start = migration.indexOf('create or replace function public.apply_contractor_scope_review')
  const end = migration.indexOf('$$;', start)
  const body = migration.slice(start, end)
  const stateAt = body.indexOf('update public.contractor_scope_packets set')
  const eventAt = body.indexOf('insert into public.review_events')
  assert.ok(stateAt > 0 && eventAt > stateAt)
  assert.doesNotMatch(body, /exception\s+when|\bcommit\s*;|\brollback\s*;/i)
  assert.match(body, /'previous_value',v_previous,'next_value',v_next/)
})

test('contractor scope transition does not mutate unrelated lead or finding data', () => {
  const start = migration.indexOf('create or replace function public.apply_contractor_scope_review')
  const end = migration.indexOf('$$;', start)
  const body = migration.slice(start, end)
  assert.doesNotMatch(body, /update public\.leads|update public\.inspection_findings|update public\.repair_items/)
  assert.match(body, /where id=p_scope_id returning \* into v_scope/)
})

test('failed RPC exposes no committed client result or fallback write', async () => {
  const client = { async rpc() { return { data: null, error: { message: 'stale state rolled back' } } } }
  await assert.rejects(
    applyContractorScopeReviewRpc({ client, scopeId: scope.id, previousScope: scope, nextScope: scope, action: 'approve' }),
    /rolled back/
  )
})
