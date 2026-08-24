import type { InspectionRepairItemDraft } from '../agents/inspectionIntelligence'

export type ContractorScopeStatus = 'needs_review' | 'contractor_ready' | 'rejected'
export type ContractorScopeReviewAction = 'approve' | 'reject' | 'return_for_correction'

export type ContractorScopeDraft = {
  title: string
  repair_objective: string
  unknown_conditions: string[]
  field_verification_items: string[]
  missing_information: string[]
  access_setup_notes: string[]
  sequencing_dependencies: string[]
  cleanup_disposal_expectations: string[]
  exclusions: string[]
}

export type ContractorScopeItem = ContractorScopeDraft & {
  id: string
  property_id: string | number
  lead_id: string
  source_finding_id: string
  source_review_event_id: string
  source_evidence_ids: unknown[]
  source_references: unknown[]
  known_conditions: string[]
  reviewed_interpretation: string
  trade_category: string
  scope_status: ContractorScopeStatus
  generation_provenance: Record<string, unknown>
  created_at: string
  created_by: string
  reviewed_by: string | null
  reviewed_at: string | null
  updated_at?: string
  admin_notes?: string | null
  [key: string]: unknown
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

export function isScopeEligibleFinding(finding: Pick<InspectionRepairItemDraft, 'status'>) {
  return finding.status === 'approved' || finding.status === 'human_verified'
}

export function buildContractorScopeDraft(finding: InspectionRepairItemDraft): ContractorScopeDraft {
  const titleParts = [finding.location, finding.category || finding.trade].filter(Boolean)
  const title = titleParts.length
    ? `${titleParts.join(' / ')} Investigation`
    : 'Reviewed Inspection Finding Investigation'
  const missingInformation = strings(finding.missing_info)
  const conservativeUnknown = 'Repair extent and concealed conditions are not established by the reviewed inspection finding.'
  const fieldVerify = 'Verify the observed condition, concealed conditions, and final repair extent onsite before pricing or execution.'

  return {
    title,
    repair_objective: `Investigate the reviewed condition, identify the cause and repair extent, and provide a professional corrective recommendation.`,
    unknown_conditions: missingInformation.length ? missingInformation : [conservativeUnknown],
    field_verification_items: [...missingInformation, fieldVerify].filter((item, index, values) => values.indexOf(item) === index),
    missing_information: missingInformation,
    access_setup_notes: [],
    sequencing_dependencies: ['Complete field verification before final scope, pricing, or execution.'],
    cleanup_disposal_expectations: [],
    exclusions: ['Pricing, concealed-condition conclusions, and repair guarantees are not established by this draft.'],
  }
}

export function normalizeContractorScope(row: Record<string, unknown>): ContractorScopeItem {
  return {
    ...row,
    id: String(row.id || ''),
    property_id: row.property_id as string | number,
    lead_id: String(row.lead_id || ''),
    source_finding_id: String(row.source_finding_id || ''),
    source_review_event_id: String(row.source_review_event_id || ''),
    source_evidence_ids: Array.isArray(row.source_evidence_ids) ? row.source_evidence_ids : [],
    source_references: Array.isArray(row.source_references) ? row.source_references : [],
    title: String(row.title || ''),
    repair_objective: String(row.repair_objective || ''),
    trade_category: String(row.trade_category || ''),
    known_conditions: strings(row.known_conditions),
    reviewed_interpretation: String(row.reviewed_interpretation || ''),
    unknown_conditions: strings(row.unknown_conditions),
    field_verification_items: strings(row.field_verification_items),
    missing_information: strings(row.missing_information),
    access_setup_notes: strings(row.access_setup_notes),
    sequencing_dependencies: strings(row.sequencing_dependencies),
    cleanup_disposal_expectations: strings(row.cleanup_disposal_expectations),
    exclusions: strings(row.exclusions),
    scope_status: row.scope_status === 'contractor_ready' || row.scope_status === 'rejected'
      ? row.scope_status
      : 'needs_review',
    generation_provenance: row.generation_provenance && typeof row.generation_provenance === 'object'
      ? row.generation_provenance as Record<string, unknown>
      : {},
    created_at: String(row.created_at || ''),
    created_by: String(row.created_by || ''),
    reviewed_by: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
  }
}

type ContractorScopeRpcClient = {
  rpc: (
    name: 'prepare_contractor_scope' | 'apply_contractor_scope_review',
    args: Record<string, unknown>
  ) => PromiseLike<{ data: Record<string, unknown>[] | null; error: { message?: string } | null }>
}

export async function prepareContractorScopeRpc(params: {
  client: ContractorScopeRpcClient
  leadId: string
  expectedPropertyId: string | number
  sourceFindingId: string
  draft: ContractorScopeDraft
}): Promise<ContractorScopeItem> {
  const { data, error } = await params.client.rpc('prepare_contractor_scope', {
    p_lead_id: params.leadId,
    p_expected_property_id: params.expectedPropertyId,
    p_source_finding_id: params.sourceFindingId,
    p_draft: params.draft,
  })
  if (error) throw new Error(error.message || 'Contractor scope preparation failed.')
  if (!data?.[0]) throw new Error('Contractor scope preparation returned no committed draft.')
  return normalizeContractorScope(data[0])
}

export async function applyContractorScopeReviewRpc(params: {
  client: ContractorScopeRpcClient
  scopeId: string
  previousScope: ContractorScopeItem
  nextScope: ContractorScopeItem
  action: ContractorScopeReviewAction
}): Promise<{ reviewEventId: string; scope: ContractorScopeItem; reviewerId: string }> {
  const { data, error } = await params.client.rpc('apply_contractor_scope_review', {
    p_scope_id: params.scopeId,
    p_previous_scope: params.previousScope,
    p_next_scope: params.nextScope,
    p_review_action: params.action,
  })
  if (error) throw new Error(error.message || 'Atomic contractor scope review failed.')
  const result = data?.[0]
  if (!result) throw new Error('Atomic contractor scope review returned no committed result.')
  return {
    reviewEventId: String(result.review_event_id || ''),
    scope: normalizeContractorScope(result.scope as Record<string, unknown>),
    reviewerId: String(result.reviewer_id || ''),
  }
}
