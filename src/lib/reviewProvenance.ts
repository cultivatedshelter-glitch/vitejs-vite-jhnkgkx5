import type { InspectionRepairItemDraft } from '../agents/inspectionIntelligence'

export type InspectionReviewObjectType = 'inspection_finding' | 'inspection_bundle'

type ReviewableInspectionObject = Record<string, unknown> & {
  id?: string
  status?: string | null
  review_status?: string | null
  admin_notes?: string | null
}

export type InspectionReviewEventInsert = {
  property_id: string | number
  work_request_id: string | null
  repair_item_id: string | null
  target_table: 'leads'
  target_id: string | null
  review_type: 'human_review'
  decision: 'needs_review' | 'approved' | 'rejected' | 'needs_more_info'
  action: string
  reviewer_id: string | null
  created_at: string
  previous_status: string | null
  next_status: string | null
  notes: string | null
  payload: {
    previous_value: ReviewableInspectionObject
    next_value: ReviewableInspectionObject
    evidence_ids: unknown[]
    source_references: unknown[]
    review_action: string
    object_type: InspectionReviewObjectType
    object_id: string | null
  }
}

function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function uniqueValues(values: unknown[]) {
  const seen = new Set<string>()
  return values.filter((value) => {
    if (value === null || value === undefined || value === '') return false
    const key = typeof value === 'string' ? `string:${value}` : `json:${JSON.stringify(value)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function provenanceFrom(value: ReviewableInspectionObject) {
  const fullSourceRefs = arrayValue(value.full_source_refs)
  const evidenceIds = [
    ...arrayValue(value.evidence_ids),
    ...fullSourceRefs.flatMap((reference) => {
      if (!reference || typeof reference !== 'object') return []
      const row = reference as Record<string, unknown>
      const type = String(row.type || '').toLowerCase()
      if (!type.includes('evidence')) return []
      return [row.id, row.evidence_id, row.evidenceItemId].filter(Boolean)
    }),
  ]
  const sourceReferences = [
    ...fullSourceRefs,
    ...arrayValue(value.evidence_references),
    ...arrayValue(value.finding_ids),
    value.inspection_report_id,
    value.repair_bundle_id,
    value.source_page,
  ]

  return {
    evidenceIds: uniqueValues(evidenceIds),
    sourceReferences: uniqueValues(sourceReferences),
  }
}

function reviewStatus(value: ReviewableInspectionObject) {
  const status = value.status || value.review_status
  return status ? String(status) : null
}

function reviewAction(previousStatus: string | null, nextStatus: string | null, notes: string | null) {
  if (previousStatus !== nextStatus && nextStatus) return nextStatus
  return notes ? 'noted' : 'edited'
}

function reviewDecision(status: string | null): InspectionReviewEventInsert['decision'] {
  if (status === 'approved' || status === 'human_verified') return 'approved'
  if (status === 'rejected') return 'rejected'
  if (status === 'needs_more_info') return 'needs_more_info'
  return 'needs_review'
}

export function applyInspectionFindingInterpretationChanges(
  previousValue: InspectionRepairItemDraft,
  changes: Partial<InspectionRepairItemDraft>
): InspectionRepairItemDraft {
  const { source_text: _ignoredSourceText, ...interpretationChanges } = changes
  return {
    ...previousValue,
    ...interpretationChanges,
    source_text: previousValue.source_text,
  }
}

export function buildInspectionReviewEvent(params: {
  propertyId: string | number
  workRequestId: string | null
  repairItemId: string | null
  targetId: string | null
  reviewerId: string | null
  objectType: InspectionReviewObjectType
  previousValue: ReviewableInspectionObject
  nextValue: ReviewableInspectionObject
  createdAt?: string
}): InspectionReviewEventInsert {
  const previousValue = snapshot(params.previousValue)
  const nextValue = snapshot(params.nextValue)
  const previousStatus = reviewStatus(previousValue)
  const nextStatus = reviewStatus(nextValue)
  const notes = typeof nextValue.admin_notes === 'string' && nextValue.admin_notes.trim()
    ? nextValue.admin_notes.trim()
    : null
  const action = reviewAction(previousStatus, nextStatus, notes)
  const previousProvenance = provenanceFrom(previousValue)
  const nextProvenance = provenanceFrom(nextValue)

  return {
    property_id: params.propertyId,
    work_request_id: params.workRequestId,
    repair_item_id: params.repairItemId,
    target_table: 'leads',
    target_id: params.targetId,
    review_type: 'human_review',
    decision: reviewDecision(nextStatus),
    action,
    reviewer_id: params.reviewerId,
    created_at: params.createdAt || new Date().toISOString(),
    previous_status: previousStatus,
    next_status: nextStatus,
    notes,
    payload: {
      previous_value: previousValue,
      next_value: nextValue,
      evidence_ids: uniqueValues([...previousProvenance.evidenceIds, ...nextProvenance.evidenceIds]),
      source_references: uniqueValues([...previousProvenance.sourceReferences, ...nextProvenance.sourceReferences]),
      review_action: action,
      object_type: params.objectType,
      object_id: nextValue.id ? String(nextValue.id) : previousValue.id ? String(previousValue.id) : null,
    },
  }
}

export async function appendInspectionReviewBeforeMutation(params: {
  event: InspectionReviewEventInsert
  insertReviewEvent: (event: InspectionReviewEventInsert) => Promise<void>
  mutateCurrentState: () => Promise<void>
}) {
  await params.insertReviewEvent(params.event)
  await params.mutateCurrentState()
}
