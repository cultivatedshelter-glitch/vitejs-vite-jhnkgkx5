import { supabase } from './supabase'
import type { Phase1PropertyContext } from './phase1PropertyContext'

export type LiveProcessingState = 'draft' | 'uploaded' | 'queued' | 'processing' | 'completed' | 'under_review' | 'ready' | 'failed'

export type EvidenceReference = { id: string; sourceFileId: string }
export type Phase1RecipientReadinessIssue = { observationId: string; title: string; reasons: string[] }
export type Phase1RecipientReadiness = { ready: boolean; issueCount: number; issues: Phase1RecipientReadinessIssue[] }
export type ProcessingResponse = {
  id: string
  propertyId: string
  processingStatus: LiveProcessingState
  artifact?: unknown
  error?: string | null
  audience?: 'reviewer' | 'agent'
  totalFindingCount?: number
  submission?: Phase1SubmissionMetadata
  recipientReadiness?: Phase1RecipientReadiness
}

export type Phase1Identity = { id: string; email: string | null; fullName: string | null; role: string; active: boolean; isReviewer: boolean }
export type Phase1SubmissionMetadata = {
  propertyAddress: string
  submitterName: string | null
  submitterEmail: string | null
  submittedAt: string | null
  note: string
  evidence: Array<{ id: string; sourceFileId: string; name: string; mediaType: string | null }>
  deliveryRecipientName: string | null
  deliveryRecipientEmail: string | null
  deliveryRecipientSource: 'submitter_default' | 'manually_changed'
  workflowState: string | null
  nextResponsibleRole: string | null
  nextAction: string | null
  lastActivityAt: string | null
  lastViewedObservationId: string | null
  releasedArtifactVersion: string | null
  releasedAt: string | null
  delivery: Phase1DeliveryRecord | null
}

export type Phase1ReviewSummary = { total: number; reviewed: number; approved: number; needsInfo: number; rejected: number; remaining: number }
export type Phase1ReviewedReportPreview = {
  reportId?: string
  reportVersion?: number
  reportStatus?: string
  report?: Phase1DurableReportDocument
  requestId: string
  propertyId: string
  artifact: unknown
  submission: Phase1SubmissionMetadata
  summary: Phase1ReviewSummary
}

export type Phase1LocalProfessional = { providerId: string; name: string; address: string | null; rating: number | null; reviewCount: number | null; latestReviewAt?: string | null; source: string; sourceUrl: string | null; retrievedAt: string; qualificationStatus: string }
export type Phase1BriefSource = { id: string; name: string; url: string | null; reference: string | null; geography: string | null; date: string | null; scopeBasis: string | null }
export type Phase1BriefPath = { id: string; label: string; status: 'priced' | 'blocked'; low: number | null; high: number | null; unit: string; confidence: string; sourceCount: number; sources: Phase1BriefSource[]; geography: string | null; assumptions: string[]; exclusions: string[] }
export type Phase1BriefFinding = { id: string; findingId: string | null; reviewEventId: string | null; status: 'approved' | 'rejected' | 'needs_more_information'; statusLabel: string; title: string; category: string; trade: string; priorityLabels: string[]; found: string; view: string; keyEvidence: string; keyUnknowns: string[]; paths: Phase1BriefPath[]; nextStep: string; why: string; inspectionSource: { document: string; page: number | null; item: string | null; section: string | null }; researchSources: Phase1BriefSource[]; technicalDetails: { known: string[]; unknowns: string[]; inspectorRecommendation: string; fullSourceText: string; fullInterpretation: string; fullNextStep: string; fullWhy: string; affectedLocation: Record<string, unknown> | null; reviewerReason: string | null; reviewedAt: string | null } }
export type Phase1DecisionBrief = { schemaVersion: string; summary: Phase1ReviewSummary; overview: { keyDecisions: Array<{ findingId: string; title: string; decision: string }>; immediateFollowUp: Array<{ findingId: string; title: string; task: string }>; majorTrades: Array<{ trade: string; count: number }>; largestCostUncertainties: Array<{ findingId: string; title: string; path: string; low: number | null; high: number | null; status: string; keyUnknown: string }> }; groups: Array<{ label: string; findings: Phase1BriefFinding[] }>; appendix: { findings: Phase1BriefFinding[] }; universalCaveats: string[] }
export type Phase1DurableReportDocument = { decisionBrief?: Phase1DecisionBrief; localProfessionals: { groups: Array<{ trade: string; professionals: Phase1LocalProfessional[] }>; lookups: Array<Record<string, unknown>> } }

export type Phase1ReviewAction = 'approve' | 'edit' | 'needs_more_info' | 'reject'
export type Phase1ReviewQueueItem = {
  requestId: string
  propertyId: string
  propertyAddress: string
  submittingAgent: string
  findingCount: number
  reviewedCount: number
  remainingCount: number
  reviewPriority: 'quick_review' | 'careful_review' | 'waiting_for_evidence'
  queueStatus: 'processing' | 'needs_review' | 'in_review' | 'waiting_for_evidence' | 'failed' | 'released'
  createdAt: string
  lastActivityAt: string
  lastViewedObservationId: string | null
  nextResponsibleRole: string
  nextAction: string
  deliveryRecipientEmail: string | null
  releasedArtifactVersion: string | null
  releasedAt: string | null
  delivery: Phase1DeliveryRecord | null
  error: string | null
  latestReportId?: string | null
  latestReportVersion?: number | null
  archivedAt?: string | null
  archivedBy?: string | null
  archiveReason?: string | null
}

export type Phase1DeliveryRecord = {
  recipient: string
  delivery_status: 'pending' | 'sending' | 'sent' | 'failed'
  sent_at: string | null
  provider_message_id: string | null
  failure_reason: string | null
  attempt_count: number
}

export type Phase1PropertyHistoryItem = {
  requestId: string
  propertyId: string
  propertyAddress: string
  submittedAt: string
  lastActivityAt: string
  status: 'Submitted' | 'Processing' | 'Under Review' | 'Needs Information' | 'Ready'
  resultRecipientName: string | null
  resultRecipientEmail: string | null
  nextResponsibleRole: string
  nextAction: string
  releasedArtifactVersion: string | null
  releasedAt: string | null
  delivery: Phase1DeliveryRecord | null
  latestReportId?: string | null
  latestReportVersion?: number | null
}

async function authContext(forceRefresh = false, verifySession = false): Promise<{ token: string; userId: string }> {
  const { data, error } = await supabase.auth.getSession()
  let session = data.session
  if (error || !session?.access_token) throw new Error('Authorization failed. Sign in before processing property evidence.')

  const expiresSoon = !session.expires_at || session.expires_at <= Math.floor(Date.now() / 1000) + 60
  if (forceRefresh || expiresSoon) {
    const refreshed = await supabase.auth.refreshSession()
    if (refreshed.error || !refreshed.data.session?.access_token) {
      throw new Error('Your session expired. Sign in again before uploading evidence.')
    }
    session = refreshed.data.session
  }

  if (!verifySession) return { token: session.access_token, userId: session.user.id }

  const verified = await supabase.auth.getUser(session.access_token)
  if (verified.error || !verified.data.user) {
    if (forceRefresh) throw new Error('Your session expired. Sign in again before uploading evidence.')
    return authContext(true, true)
  }
  return { token: session.access_token, userId: verified.data.user.id }
}

async function jsonRequest<T>(url: string, init: RequestInit, { verifySession = false } = {}): Promise<T> {
  async function send(forceRefresh = false) {
    const { token } = await authContext(forceRefresh, verifySession || forceRefresh)
    const response = await fetch(url, { ...init, headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...init.headers } })
    const body = await response.json().catch(() => null)
    return { response, body }
  }

  let result = await send()
  if (result.response.status === 401) result = await send(true)
  if (!result.response.ok) {
    throw new Error(result.body?.error?.message || `The processing request failed with status ${result.response.status}.`)
  }
  return result.body as T
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

export async function resolvePhase1Property(address: string): Promise<Phase1PropertyContext> {
  const { userId } = await authContext(false, true)
  let property: { id: string; address: string }
  try {
    property = await jsonRequest<{ id: string; address: string }>(
      '/api/phase1/properties/resolve',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address }) },
    )
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Property workspace service is unavailable. Durable property creation must be configured before continuing.')
    }
    throw error
  }
  if (!property.id) throw new Error('Property workspace creation did not return a property identifier.')
  return { id: property.id, address: property.address || address.trim(), userId }
}

export async function loadPhase1Identity(): Promise<Phase1Identity> {
  return jsonRequest<Phase1Identity>('/api/phase1/me', { method: 'GET' }, { verifySession: true })
}

export async function uploadPhase1Evidence({ propertyId, files }: { propertyId: string; files: File[] }) {
  if (!propertyId) throw new Error('Property context is required before evidence can be uploaded.')
  if (!files.length) throw new Error('Choose at least one evidence file.')
  const form = new FormData()
  form.set('propertyId', propertyId)
  files.forEach((file) => form.append('evidence', file))
  return jsonRequest<{ evidenceReferences: EvidenceReference[] }>(
    '/api/phase1/evidence',
    { method: 'POST', body: form },
    { verifySession: true },
  )
}

export async function createPhase1SubmissionDraft({ propertyId, evidenceReferences, note, deliveryRecipient }: {
  propertyId: string
  evidenceReferences: EvidenceReference[]
  note: string
  deliveryRecipient: { name?: string; email: string }
}) {
  return jsonRequest<ProcessingResponse>('/api/phase1/submissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ propertyId, evidenceReferences, note, deliveryRecipient }),
  }, { verifySession: true })
}

export async function submitPhase1SubmissionDraft(requestId: string, deliveryRecipient: { name?: string; email: string }) {
  return jsonRequest<ProcessingResponse>(`/api/phase1/submissions/${encodeURIComponent(requestId)}/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deliveryRecipient }),
  }, { verifySession: true })
}

export async function updatePhase1SubmissionDraft(requestId: string, { propertyId, evidenceReferences, note, deliveryRecipient }: {
  propertyId: string
  evidenceReferences: EvidenceReference[]
  note: string
  deliveryRecipient: { name?: string; email: string }
}) {
  return jsonRequest<ProcessingResponse>(`/api/phase1/submissions/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ propertyId, evidenceReferences, note, deliveryRecipient }),
  }, { verifySession: true })
}

export async function waitForPhase1Processing(requestId: string, onState: (state: LiveProcessingState) => void) {
  for (;;) {
    await wait(750)
    const status = await loadPhase1ProcessingRequest(requestId)
    onState(status.processingStatus)
    if (['under_review', 'ready', 'completed'].includes(status.processingStatus)) return status
    if (status.processingStatus === 'failed') throw new Error(status.error || 'Processing failed.')
  }
}

export async function processPhase1Evidence({
  propertyId,
  files,
  note,
  onState,
}: {
  propertyId: string
  files: File[]
  note: string
  onState: (state: LiveProcessingState) => void
}): Promise<ProcessingResponse> {
  if (!propertyId) throw new Error('Property context is required before evidence can be processed.')
  if (!files.length) throw new Error('The live processor currently requires one PDF inspection report.')
  const upload = await uploadPhase1Evidence({ propertyId, files })
  onState('uploaded')
  const request = await jsonRequest<ProcessingResponse>(
    '/api/phase1/processing-requests',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ propertyId, evidenceReferences: upload.evidenceReferences, note }) },
  )
  onState(request.processingStatus)

  for (;;) {
    await wait(750)
    const status = await jsonRequest<ProcessingResponse>(`/api/phase1/processing-requests/${encodeURIComponent(request.id)}`, { method: 'GET' })
    onState(status.processingStatus)
    if (status.processingStatus === 'under_review') return status
    if (status.processingStatus === 'ready' || status.processingStatus === 'completed') {
      if (!status.artifact) throw new Error('Reasoning artifact invalid. Processing completed without an artifact.')
      return status
    }
    if (status.processingStatus === 'failed') throw new Error(status.error || 'Processing failed.')
  }
}

export async function loadPhase1ProcessingRequest(requestId: string): Promise<ProcessingResponse> {
  if (!requestId) throw new Error('A processing request is required for review.')
  return jsonRequest<ProcessingResponse>(
    `/api/phase1/processing-requests/${encodeURIComponent(requestId)}`,
    { method: 'GET' },
  )
}

export async function loadPhase1ReviewQueue(): Promise<Phase1ReviewQueueItem[]> {
  const response = await jsonRequest<{ items: Phase1ReviewQueueItem[] }>('/api/phase1/review-queue', { method: 'GET' })
  return response.items
}

export async function loadPhase1Dashboard(archived = false): Promise<Phase1ReviewQueueItem[]> {
  const response = await jsonRequest<{ items: Phase1ReviewQueueItem[] }>(`/api/phase1/dashboard${archived ? '?archived=true' : ''}`, { method: 'GET' })
  return response.items
}

export async function setPhase1PropertyArchived(propertyId: string, archived: boolean, reason: string | null = null) {
  return jsonRequest<{ id: string; status: string; archived_at: string | null; archived_by: string | null; archive_reason: string | null }>(
    `/api/phase1/properties/${encodeURIComponent(propertyId)}/archive`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ archived, reason }) },
  )
}

export async function loadPhase1MyProperties(): Promise<Phase1PropertyHistoryItem[]> {
  const response = await jsonRequest<{ items: Phase1PropertyHistoryItem[] }>('/api/phase1/my-properties', { method: 'GET' })
  return response.items
}

export async function savePhase1ReviewPosition(requestId: string, observationId: string) {
  return jsonRequest<{ id: string; last_viewed_observation_id: string; last_activity_at: string }>(
    `/api/phase1/processing-requests/${encodeURIComponent(requestId)}/review-position`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ observationId }) },
  )
}

export async function openPhase1SourceDocument(requestId: string, page?: number | null) {
  const { token } = await authContext(false, true)
  const response = await fetch(`/api/phase1/processing-requests/${encodeURIComponent(requestId)}/source-document`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error?.message || 'The source report could not be opened.')
  }
  const url = URL.createObjectURL(await response.blob())
  window.open(`${url}${page ? `#page=${page}` : ''}`, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function reviewPhase1Finding({
  requestId,
  observationId,
  action,
  corrections = {},
  reason = '',
  fieldsApproved = [],
  expectedReviewEventId = null,
}: {
  requestId: string
  observationId: string
  action: Phase1ReviewAction
  corrections?: Record<string, unknown>
  reason?: string
  fieldsApproved?: string[]
  expectedReviewEventId?: string | null
}) {
  return jsonRequest<{ findingId: string; status: string; eventId: string; completion?: Phase1ReviewSummary; recipientReadiness?: Phase1RecipientReadiness }>(
    `/api/phase1/processing-requests/${encodeURIComponent(requestId)}/findings/${encodeURIComponent(observationId)}/review`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, corrections, reason, fieldsApproved, expectedReviewEventId }),
    },
    { verifySession: true },
  )
}

export async function previewPhase1ReviewedReport(requestId: string) {
  return jsonRequest<Phase1ReviewedReportPreview>(
    `/api/phase1/processing-requests/${encodeURIComponent(requestId)}/reviewed-report/preview`,
    { method: 'POST' },
    { verifySession: true },
  )
}

export async function releasePhase1ReviewedReport(requestId: string, reportId?: string | null) {
  return jsonRequest<{ ready: boolean; released: boolean; releasedAt: string | null; summary: Phase1ReviewSummary; submission: Phase1SubmissionMetadata }>(
    `/api/phase1/processing-requests/${encodeURIComponent(requestId)}/reviewed-report/release`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reportId }) },
    { verifySession: true },
  )
}

export async function sendPhase1ReviewedResult(requestId: string, reportId?: string | null) {
  return jsonRequest<{ delivery: { status: string; duplicate?: boolean }; submission: Phase1SubmissionMetadata }>(
    `/api/phase1/processing-requests/${encodeURIComponent(requestId)}/reviewed-report/send`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reportId }) },
    { verifySession: true },
  )
}

export async function openPhase1ReviewedReportPdf(reportId: string) {
  const access = await jsonRequest<{ url: string; expiresIn: number }>(`/api/phase1/reviewed-reports/${encodeURIComponent(reportId)}/access`, { method: 'POST' }, { verifySession: true })
  window.open(access.url, '_blank', 'noopener,noreferrer')
}

export async function loadPhase1PropertyReports(propertyId: string) {
  const response = await jsonRequest<{ items: Array<{ id: string; property_id: string; processing_request_id: string | null; report_version: number; report_status: string; recipient: string; reviewer_name: string; generated_at: string | null; released_at: string | null; delivery_status: string; sent_at: string | null; created_at: string }> }>(`/api/phase1/properties/${encodeURIComponent(propertyId)}/reports`, { method: 'GET' })
  return response.items
}

export async function loadPhase1ReviewedReport(reportId: string) {
  return jsonRequest<{ id: string; property_id: string; processing_request_id: string | null; report_version: number; report_status: string; reviewed_artifact: { artifact: unknown; propertyAddress: string; generatedAt: string; decisionBrief?: Phase1DecisionBrief; localProfessionals: Phase1DurableReportDocument['localProfessionals'] }; released_at: string | null }>(`/api/phase1/reviewed-reports/${encodeURIComponent(reportId)}`, { method: 'GET' })
}
