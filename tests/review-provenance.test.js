import assert from 'node:assert/strict'
import test from 'node:test'

import {
  appendInspectionReviewBeforeMutation,
  applyInspectionFindingInterpretationChanges,
  buildInspectionReviewEvent,
} from '../src/lib/reviewProvenance.ts'

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

function eventFor(objectType, previousValue, nextValue) {
  return buildInspectionReviewEvent({
    propertyId: 42,
    workRequestId: '33f4195a-f462-4cbc-814f-3fd10ad54bed',
    repairItemId: objectType === 'inspection_finding' ? 'fd10131c-105b-4539-91b1-ae5ddd6d4b0b' : null,
    targetId: '33f4195a-f462-4cbc-814f-3fd10ad54bed',
    reviewerId: 'c082325c-c5da-48f7-acbf-a1228ba8e202',
    objectType,
    previousValue,
    nextValue,
    createdAt: '2026-08-24T12:00:00.000Z',
  })
}

test('finding review inserts exactly one review event before current-state update', async () => {
  const calls = []
  const event = eventFor('inspection_finding', finding, { ...finding, status: 'approved' })

  await appendInspectionReviewBeforeMutation({
    event,
    insertReviewEvent: async (inserted) => calls.push(['insert', inserted]),
    mutateCurrentState: async () => calls.push(['mutate']),
  })

  assert.equal(calls.filter(([name]) => name === 'insert').length, 1)
  assert.deepEqual(calls.map(([name]) => name), ['insert', 'mutate'])
  assert.equal(calls[0][1].payload.object_type, 'inspection_finding')
})

test('bundle review inserts exactly one review event before current-state update', async () => {
  const calls = []
  const event = eventFor('inspection_bundle', bundle, { ...bundle, status: 'approved' })

  await appendInspectionReviewBeforeMutation({
    event,
    insertReviewEvent: async (inserted) => calls.push(['insert', inserted]),
    mutateCurrentState: async () => calls.push(['mutate']),
  })

  assert.equal(calls.filter(([name]) => name === 'insert').length, 1)
  assert.deepEqual(calls.map(([name]) => name), ['insert', 'mutate'])
  assert.equal(calls[0][1].payload.object_type, 'inspection_bundle')
})

test('review payload preserves complete previous and resulting values', () => {
  const nextFinding = { ...finding, description: 'Human-edited interpretation.', status: 'approved', admin_notes: 'Confirmed against source.' }
  const event = eventFor('inspection_finding', finding, nextFinding)

  assert.deepEqual(event.payload.previous_value, finding)
  assert.deepEqual(event.payload.next_value, nextFinding)
  assert.equal(event.previous_status, 'needs_review')
  assert.equal(event.next_status, 'approved')
  assert.equal(event.notes, 'Confirmed against source.')
})

test('review payload preserves existing evidence IDs and source references without inventing replacements', () => {
  const event = eventFor('inspection_bundle', bundle, { ...bundle, status: 'approved' })

  assert.deepEqual(event.payload.evidence_ids, [])
  assert.deepEqual(event.payload.source_references, [
    { type: 'source_page', label: 'Inspection report page 12' },
    'inspection:report-1:roof:1',
    'finding-1',
    'inspection-report-1',
  ])

  const findingEvent = eventFor('inspection_finding', finding, { ...finding, status: 'approved' })
  assert.deepEqual(findingEvent.payload.evidence_ids, ['6d0aa8c2-3d36-4ef3-bb3c-4eb0c2fb6161'])
  assert.ok(findingEvent.payload.source_references.some((reference) => (
    typeof reference === 'object' && reference.id === '4f731a3f-5b4c-4c49-87fc-25f7b7852a44'
  )))
})

test('review-event failure prevents current-state mutation', async () => {
  let mutationCount = 0
  const event = eventFor('inspection_finding', finding, { ...finding, status: 'approved' })

  await assert.rejects(
    appendInspectionReviewBeforeMutation({
      event,
      insertReviewEvent: async () => {
        throw new Error('review_events insert failed')
      },
      mutateCurrentState: async () => {
        mutationCount += 1
      },
    }),
    /review_events insert failed/
  )
  assert.equal(mutationCount, 0)
})

test('editing a finding interpretation cannot overwrite literal source_text', () => {
  const nextFinding = applyInspectionFindingInterpretationChanges(finding, {
    description: 'Corrected human interpretation.',
    source_text: 'Attempted replacement text.',
  })

  assert.equal(nextFinding.description, 'Corrected human interpretation.')
  assert.equal(nextFinding.source_text, 'Original extracted inspection excerpt.')
})

test('existing current-state review mutation still succeeds after review-event insert succeeds', async () => {
  let savedStatus = 'needs_review'
  const event = eventFor('inspection_bundle', bundle, { ...bundle, status: 'approved' })

  await appendInspectionReviewBeforeMutation({
    event,
    insertReviewEvent: async () => undefined,
    mutateCurrentState: async () => {
      savedStatus = 'approved'
    },
  })

  assert.equal(savedStatus, 'approved')
})
