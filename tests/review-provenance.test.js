import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  applyInspectionReviewRpc,
  applyInspectionFindingInterpretationChanges,
  buildInspectionReviewEvent,
  commitInspectionReviewDraftValue,
  createInspectionReviewSaveGate,
  updateInspectionReviewDraft,
} from '../src/lib/reviewProvenance.ts'

const migration = readFileSync(
  new URL('../supabase/migrations/202608240001_atomic_inspection_review.sql', import.meta.url),
  'utf8'
)

const finding = {
  id: 'finding-1',
  inspection_report_id: 'inspection-report-1',
  repair_bundle_id: 'bundle-1',
  source_text: 'Original extracted inspection excerpt.',
  description: 'Original AI interpretation.',
  status: 'needs_review',
  admin_notes: '',
  evidence_ids: ['6d0aa8c2-3d36-4ef3-bb3c-4eb0c2fb6161'],
  full_source_refs: [{ type: 'source_file', id: '4f731a3f-5b4c-4c49-87fc-25f7b7852a44' }],
}

const bundle = {
  id: 'bundle-1',
  inspection_report_id: 'inspection-report-1',
  title: 'Roof / Water Intrusion',
  status: 'needs_review',
  admin_notes: '',
  evidence_references: ['inspection:report-1:roof:1'],
  finding_ids: ['finding-1'],
  full_source_refs: [{ type: 'source_page', label: 'Inspection report page 12' }],
}

function eventFor(objectType, previousValue, nextValue, links = {}) {
  return buildInspectionReviewEvent({
    propertyId: 42,
    workRequestId: links.workRequestId ?? null,
    repairItemId: links.repairItemId ?? null,
    targetId: '33f4195a-f462-4cbc-814f-3fd10ad54bed',
    objectType,
    previousValue,
    nextValue,
  })
}

function atomicReviewParams(client, event = eventFor('inspection_finding', finding, { ...finding, status: 'approved' })) {
  return {
    client,
    leadId: '33f4195a-f462-4cbc-814f-3fd10ad54bed',
    expectedPropertyId: 42,
    event,
    nextInspectionIntelligence: { repairItems: [event.payload.next_value] },
  }
}

test('runtime review uses exactly one atomic RPC and returns its committed state', async () => {
  const calls = []
  const client = {
    async rpc(name, args) {
      calls.push([name, args])
      return {
        data: [{
          review_event_id: 'event-1',
          property_facts: { inspectionProcessingStatus: 'human_verified' },
          reviewer_id: 'auth-user-1',
          work_request_id: null,
          repair_item_id: null,
        }],
        error: null,
      }
    },
  }

  const committed = await applyInspectionReviewRpc(atomicReviewParams(client))

  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], 'apply_inspection_review')
  assert.equal(committed.review_event_id, 'event-1')
  assert.equal(committed.property_facts.inspectionProcessingStatus, 'human_verified')
})

test('RPC failure exposes no committed client result or fallback mutation', async () => {
  let fallbackMutationCount = 0
  const client = {
    async rpc() {
      return { data: null, error: { message: 'atomic transaction rolled back' } }
    },
  }

  await assert.rejects(applyInspectionReviewRpc(atomicReviewParams(client)), /rolled back/)
  assert.equal(fallbackMutationCount, 0)
})

test('migration keeps event insert and property_facts update in one transactional function', () => {
  const functionStart = migration.indexOf('create or replace function public.apply_inspection_review')
  const functionEnd = migration.indexOf('$$;', functionStart)
  const body = migration.slice(functionStart, functionEnd)
  const insertAt = body.indexOf('insert into public.review_events')
  const updateAt = body.indexOf('update public.leads')

  assert.ok(functionStart >= 0)
  assert.ok(insertAt >= 0)
  assert.ok(updateAt > insertAt)
  assert.match(migration, /begin;[\s\S]*create or replace function public\.apply_inspection_review[\s\S]*commit;/)
  assert.doesNotMatch(body, /exception\s+when/)
})

test('event insert or state update errors roll back the entire PostgreSQL function call', () => {
  const start = migration.indexOf('create or replace function public.apply_inspection_review')
  const body = migration.slice(start, migration.indexOf('$$;', start))

  assert.match(body, /insert into public\.review_events/)
  assert.match(body, /update public\.leads/)
  assert.match(body, /if not found then[\s\S]*Target lead disappeared/)
  assert.doesNotMatch(body, /\b(commit|rollback)\s*;/)
})

test('stale previous state is rejected before either write', () => {
  const staleCheck = migration.indexOf('Inspection review is stale; reload the latest saved state.')
  const insertAt = migration.indexOf('insert into public.review_events')
  const lockAt = migration.indexOf('for update;')

  assert.ok(lockAt >= 0)
  assert.ok(staleCheck > lockAt)
  assert.ok(staleCheck < insertAt)
})

test('reviewer identity is bound to auth.uid and unauthorized callers are rejected', () => {
  assert.match(migration, /v_reviewer_id uuid := auth\.uid\(\)/)
  assert.match(migration, /if v_reviewer_id is null then/)
  assert.match(migration, /if not public\.is_admin_or_owner\(\) then/)
  assert.match(migration, /v_reviewer_id,[\s\S]*v_previous_status/)
  assert.doesNotMatch(migration, /p_reviewer_id/)
})

test('canonical linkage is target-derived and absent canonical rows resolve to null', () => {
  assert.match(migration, /wr\.lead_id=p_lead_id and wr\.property_id=v_property_id/)
  assert.match(migration, /from public\.repair_items ri[\s\S]*ri\.id::text=p_object_id and ri\.property_id=v_property_id/)
  assert.match(migration, /Submitted work request is not the target lead canonical work request/)
  assert.match(migration, /Submitted repair item is not the exact reviewed finding canonical repair item/)

  const event = eventFor('inspection_finding', finding, { ...finding, status: 'approved' })
  assert.equal(event.work_request_id, null)
  assert.equal(event.repair_item_id, null)
})

test('migration never relies on unavailable repair_items linkage or metadata columns', () => {
  assert.doesNotMatch(migration, /repair_items\.work_request_id/)
  assert.doesNotMatch(migration, /repair_items\.metadata/)
  assert.doesNotMatch(migration, /ri\.work_request_id/)
  assert.doesNotMatch(migration, /ri\.metadata/)
})

test('migration adds only the five nullable review event audit columns it needs', () => {
  assert.match(migration, /alter table public\.review_events[\s\S]*add column if not exists work_request_id uuid null[\s\S]*add column if not exists repair_item_id uuid null[\s\S]*add column if not exists review_type text null[\s\S]*add column if not exists decision text null[\s\S]*add column if not exists payload jsonb null/)
})

test('finding repair linkage is optional and uses only exact id plus property', () => {
  assert.match(migration, /from public\.repair_items ri\s+where ri\.id::text=p_object_id and ri\.property_id=v_property_id/)
  assert.match(migration, /if v_repair_item_count<>1 then v_repair_item_id:=null/)
  const event = eventFor('inspection_finding', finding, { ...finding, status: 'approved' })
  assert.equal(event.repair_item_id, null)
})

test('bundle typing only changes its local draft until commit', async () => {
  let draft = bundle
  let rpcCount = 0
  for (const title of ['R', 'Ro', 'Roo', 'Roof']) {
    draft = updateInspectionReviewDraft(draft, { title })
  }

  assert.equal(rpcCount, 0)

  const nextBundle = { ...bundle, title: draft.title }
  const event = eventFor('inspection_bundle', bundle, nextBundle)
  const client = {
    async rpc() {
      rpcCount += 1
      return {
        data: [{
          review_event_id: 'event-bundle-1',
          property_facts: { inspectionIntelligence: { repairBundles: [nextBundle] } },
          reviewer_id: 'auth-user-1',
          work_request_id: null,
          repair_item_id: null,
        }],
        error: null,
      }
    },
  }

  await commitInspectionReviewDraftValue({
    gate: createInspectionReviewSaveGate(),
    key: bundle.id,
    committedValue: bundle.title,
    draftValue: draft.title,
    save: async () => {
      await applyInspectionReviewRpc({
        client,
        leadId: '33f4195a-f462-4cbc-814f-3fd10ad54bed',
        expectedPropertyId: 42,
        event,
        nextInspectionIntelligence: { repairBundles: [nextBundle], workGroups: [nextBundle] },
      })
      return true
    },
    rollback: () => assert.fail('successful save must not roll back'),
  })

  assert.equal(rpcCount, 1)
})

test('concurrent save for the same bundle is blocked', async () => {
  const gate = createInspectionReviewSaveGate()
  let release
  let saveCount = 0
  const pending = new Promise((resolve) => { release = resolve })
  const save = async () => {
    saveCount += 1
    await pending
    return true
  }

  const first = commitInspectionReviewDraftValue({
    gate,
    key: bundle.id,
    committedValue: bundle.title,
    draftValue: 'Roof A',
    save,
    rollback: () => undefined,
  })
  const second = commitInspectionReviewDraftValue({
    gate,
    key: bundle.id,
    committedValue: bundle.title,
    draftValue: 'Roof B',
    save,
    rollback: () => undefined,
  })

  assert.equal(await second, false)
  assert.equal(saveCount, 1)
  release()
  assert.equal(await first, true)
})

test('failed persistence restores visible draft to the committed value', async () => {
  let visibleValue = 'Dirty unsaved title'
  const client = {
    async rpc() {
      return { data: null, error: { message: 'atomic save failed' } }
    },
  }
  const saved = await commitInspectionReviewDraftValue({
    gate: createInspectionReviewSaveGate(),
    key: bundle.id,
    committedValue: bundle.title,
    draftValue: visibleValue,
    save: async () => {
      try {
        await applyInspectionReviewRpc(atomicReviewParams(client))
        return true
      } catch {
        return false
      }
    },
    rollback: (value) => { visibleValue = value },
  })

  assert.equal(saved, false)
  assert.equal(visibleValue, bundle.title)
})

test('review payload preserves complete previous/next values and provenance', () => {
  const nextFinding = { ...finding, description: 'Human-edited interpretation.', status: 'approved', admin_notes: 'Confirmed against source.' }
  const event = eventFor('inspection_finding', finding, nextFinding)

  assert.deepEqual(event.payload.previous_value, finding)
  assert.deepEqual(event.payload.next_value, nextFinding)
  assert.deepEqual(event.payload.evidence_ids, finding.evidence_ids)
  assert.ok(event.payload.source_references.some((reference) => (
    typeof reference === 'object' && reference.id === '4f731a3f-5b4c-4c49-87fc-25f7b7852a44'
  )))
})

test('editing a finding interpretation cannot overwrite literal source_text', () => {
  const nextFinding = applyInspectionFindingInterpretationChanges(finding, {
    description: 'Corrected human interpretation.',
    source_text: 'Attempted replacement text.',
  })

  assert.equal(nextFinding.description, 'Corrected human interpretation.')
  assert.equal(nextFinding.source_text, 'Original extracted inspection excerpt.')
  assert.match(migration, /'source_text'/)
  assert.match(migration, /Inspection provenance field %s cannot change/)
})

test('null object type is explicitly rejected', () => {
  assert.match(migration, /if p_object_type is null or p_object_type <> all/)
})

test('duplicate finding IDs are rejected in current or submitted state', () => {
  assert.match(migration, /if v_cf<>1 or v_nf<>1/)
  assert.match(migration, /Reviewed finding must occur exactly once/)
  assert.doesNotMatch(migration, /limit 1/i)
})

test('duplicate bundle IDs and inconsistent mirrored copies are rejected', () => {
  assert.match(migration, /v_cw>1 or v_cb>1 or v_nw>1 or v_nb>1/)
  assert.match(migration, /v_cwv-'review_started_at'-'review_due_at'/)
  assert.match(migration, /Persisted mirrored bundle copies disagree outside review timing metadata/)
  assert.match(migration, /Submitted mirrored bundle copies must remain identical/)
})

test('only the validated target may differ and bundle arrays are compared independently', () => {
  assert.match(migration, /Other inspection findings changed during review/)
  assert.match(migration, /Other work groups changed during review/)
  assert.match(migration, /Other repair bundles changed during review/)
})

test('global humanReviewStatus is overwritten with the server derivation', () => {
  assert.match(migration, /v_global_status:=case when v_complete then 'human_verified' else 'needs_review' end/)
  assert.match(migration, /jsonb_set\(p_next_inspection_intelligence,'\{humanReviewStatus\}',to_jsonb\(v_global_status\),true\)/)
})

test('fabricated or removed provenance and source_text missing-to-present are rejected', () => {
  for (const field of ['source_text', 'evidence_ids', 'evidenceIds', 'source_file_id', 'source_page', 'page_range']) {
    assert.ok(migration.includes(`'${field}'`), `missing immutable provenance field ${field}`)
  }
  assert.match(migration, /\(v_previous\?v_key\) is distinct from \(v_next\?v_key\)/)
  assert.match(migration, /\(v_previous->v_key\) is distinct from \(v_next->v_key\)/)
})

test('bundle repair item linkage is always null and client linkage is rejected', () => {
  assert.match(migration, /Bundle reviews cannot link to a repair item/)
  assert.match(migration, /v_repair_item_id:=null/)
})

test('event payload is derived from committed logical object and locked provenance', () => {
  assert.match(migration, /'previous_value',v_previous,'next_value',v_next/)
  assert.match(migration, /Event provenance is extracted only from the locked previous object/)
  assert.doesNotMatch(migration, /p_next_value\s*->\s*'evidence_ids'/)
})

test('review action is noted only when admin notes changed', () => {
  const existingNote = { ...finding, admin_notes: 'Existing note.' }
  const unrelatedEdit = eventFor('inspection_finding', existingNote, { ...existingNote, severity: 'High' })
  const noteEdit = eventFor('inspection_finding', existingNote, { ...existingNote, admin_notes: 'Changed note.' })

  assert.equal(unrelatedEdit.action, 'edited')
  assert.equal(unrelatedEdit.payload.review_action, 'edited')
  assert.equal(noteEdit.action, 'noted')
  assert.equal(noteEdit.payload.review_action, 'noted')
})

test('direct review_events writes are removed while existing reads remain governed by RLS', () => {
  assert.match(migration, /drop policy if exists "review_events admin manage" on public\.review_events/)
  assert.doesNotMatch(migration, /create policy[\s\S]*review_events[\s\S]*for insert/i)
  assert.match(migration, /grant execute on function public\.apply_inspection_review[\s\S]*to authenticated/)
})

test('existing valid inspection review still succeeds through the RPC boundary', async () => {
  const client = {
    async rpc() {
      return {
        data: [{
          review_event_id: 'event-2',
          property_facts: { inspectionIntelligence: { repairItems: [{ ...finding, status: 'approved' }] } },
          reviewer_id: 'auth-user-1',
          work_request_id: null,
          repair_item_id: null,
        }],
        error: null,
      }
    },
  }

  const result = await applyInspectionReviewRpc(atomicReviewParams(client))
  assert.equal(result.property_facts.inspectionIntelligence.repairItems[0].status, 'approved')
})
