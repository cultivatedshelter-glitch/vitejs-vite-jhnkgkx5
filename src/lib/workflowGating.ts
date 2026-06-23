import type { PropertyReportStatusLabel, RoleBasedShareView, WorkflowAccessState } from '../types/app'

export const PROPERTY_REPORT_STATUS_LABELS: PropertyReportStatusLabel[] = [
  'AI Draft',
  'Needs Review',
  'Human Reviewed',
  'Contractor Reviewed',
  'Seller Ready',
  'Finalized',
]

export const WORKFLOW_ACCESS_STATES: WorkflowAccessState[] = [
  'preview',
  'workspace_active',
  'reviewed_report',
  'contractor_packet',
  'finalized_report',
]

export const ROLE_BASED_SHARE_VIEWS: RoleBasedShareView[] = [
  'Agent View',
  'Seller View',
  'Contractor View',
  'Admin View',
]

type WorkflowAccessInput = {
  reportStatus: PropertyReportStatusLabel
  hasPropertyRecord: boolean
  hasSourceFile: boolean
  hasEvidenceReferences: boolean
  hasHumanReview: boolean
  hasContractorReview: boolean
  hasApprovalEvent: boolean
}

export function isDraftReportStatus(status: PropertyReportStatusLabel) {
  return status === 'AI Draft' || status === 'Needs Review'
}

export function isReviewedReportStatus(status: PropertyReportStatusLabel) {
  return status === 'Human Reviewed' ||
    status === 'Contractor Reviewed' ||
    status === 'Seller Ready' ||
    status === 'Finalized'
}

export function isSellerReadyReportStatus(status: PropertyReportStatusLabel) {
  return status === 'Seller Ready' || status === 'Finalized'
}

export function isContractorReadyReportStatus(status: PropertyReportStatusLabel) {
  return status === 'Contractor Reviewed' || status === 'Seller Ready' || status === 'Finalized'
}

export function outputNeedsDraftStamp(status: PropertyReportStatusLabel) {
  return !isReviewedReportStatus(status)
}

export function workflowStateLabel(state: WorkflowAccessState) {
  const labels: Record<WorkflowAccessState, string> = {
    preview: 'Preview',
    workspace_active: 'Active Property Workspace',
    reviewed_report: 'Reviewed Report',
    contractor_packet: 'Contractor Packet',
    finalized_report: 'Finalized Report',
  }
  return labels[state]
}

export function deriveWorkflowAccessState(input: WorkflowAccessInput): WorkflowAccessState {
  if (input.reportStatus === 'Finalized' && input.hasApprovalEvent) return 'finalized_report'
  if (input.hasContractorReview && input.hasPropertyRecord && input.hasSourceFile) return 'contractor_packet'
  if (isReviewedReportStatus(input.reportStatus) && input.hasHumanReview && input.hasPropertyRecord) return 'reviewed_report'
  if (input.hasPropertyRecord && input.hasSourceFile && input.hasEvidenceReferences) return 'workspace_active'
  return 'preview'
}

export function roleViewsForWorkflowState(state: WorkflowAccessState): RoleBasedShareView[] {
  if (state === 'preview') return []
  if (state === 'workspace_active') return ['Admin View', 'Agent View']
  if (state === 'contractor_packet') return ['Admin View', 'Agent View', 'Contractor View']
  return ROLE_BASED_SHARE_VIEWS
}

export function workflowStateUnlocks(state: WorkflowAccessState) {
  const unlocks: Record<WorkflowAccessState, string[]> = {
    preview: [
      'Top issue categories',
      'Draft repair roadmap preview',
      'Limited missing-info questions',
      'Evidence-linked sample findings',
      'AI Draft / Needs Review status',
    ],
    workspace_active: [
      'Full repair roadmap',
      'Full missing-info checklist',
      'Status tracking',
      'Evidence chain and uploaded files',
      'Admin review workflow',
    ],
    reviewed_report: [
      'Seller-ready report draft',
      'Reviewed repair-vs-credit guidance',
      'Reviewed estimate range when available',
      'Role-based share links',
      'Decision history',
    ],
    contractor_packet: [
      'Contractor-ready scope packet',
      'Photos/files and inspection excerpts',
      'Missing info and site/access notes',
      'Contractor walkthrough and upload workflow',
      'Contractor feedback tracking',
    ],
    finalized_report: [
      'Final report generation',
      'Controlled share link',
      'Approval history',
      'Property memory candidate context',
      'Live workflow status',
    ],
  }
  return unlocks[state]
}

export function roleViewPolicy(view: RoleBasedShareView) {
  const policies: Record<RoleBasedShareView, string[]> = {
    'Agent View': [
      'Transaction strategy',
      'Seller talking points',
      'Status and next steps',
      'Reviewed repair-vs-credit guidance when available',
    ],
    'Seller View': [
      'Plain-language summary',
      'Priority repairs',
      'Approved repair-vs-credit options',
      'Reviewed estimate range when available',
      'No internal notes or unverified AI reasoning',
    ],
    'Contractor View': [
      'Scope packet',
      'Photos/files and inspection excerpts',
      'Missing info and site/access notes',
      'Walkthrough request and estimate/scope upload actions',
      'No seller strategy or unrelated property data',
    ],
    'Admin View': [
      'Full evidence',
      'AI drafts and review controls',
      'Contractor feedback',
      'Approval history',
      'Internal notes',
    ],
  }
  return policies[view]
}
