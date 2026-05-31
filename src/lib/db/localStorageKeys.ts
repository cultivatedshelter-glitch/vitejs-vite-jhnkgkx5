import type { AiResearchDraft, JobExecutionStep, JobPacketMetadata, PropertyAgentResult, WorkRequest } from '../../types/app'

export const JOB_SCOPE_LOCAL_STORAGE_KEY = 'shelter-prep-job-execution-steps-v1'
export const JOB_PACKET_METADATA_LOCAL_STORAGE_KEY = 'shelter-prep-job-packets-v1'
export const AI_RESEARCH_DRAFT_LOCAL_STORAGE_KEY = 'shelter-prep-ai-research-drafts-v1'
export const PROPERTY_AGENT_OUTPUT_LOCAL_STORAGE_KEY = 'shelter-prep-property-agent-outputs-v1'
export let propertyAgentOutputsTableUnavailable = false
let propertyAgentOutputsTableWarningShown = false
let contractorAssignmentsWarningShown = false

export function getJobScopeStorageKey(requestId: string) {
  return `${JOB_SCOPE_LOCAL_STORAGE_KEY}:${requestId}`
}
export function getAiResearchDraftStorageKey(requestId: string) {
  return `${AI_RESEARCH_DRAFT_LOCAL_STORAGE_KEY}:${requestId}`
}
export function getPropertyAgentOutputStorageKey(requestId: string) {
  return `${PROPERTY_AGENT_OUTPUT_LOCAL_STORAGE_KEY}:${requestId}`
}
export function isMissingPropertyAgentOutputsTableError(error: unknown) {
  const text = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null
      ? JSON.stringify(error)
      : String(error || '')
  return /property_intelligence_agent_outputs|schema cache|relation .* does not exist|table .* does not exist|404|not found/i.test(text)
}
export function markPropertyAgentOutputsTableUnavailable(error: unknown) {
  propertyAgentOutputsTableUnavailable = true
  if (!propertyAgentOutputsTableWarningShown) {
    propertyAgentOutputsTableWarningShown = true
    console.info('Property intelligence agent output table unavailable; using local/empty state until schema repair is applied.', error)
  }
}
export function quietOptionalContractorAssignmentsWarning(error: unknown) {
  if (contractorAssignmentsWarningShown) return
  contractorAssignmentsWarningShown = true
  console.info('Contractor assignments unavailable; showing an empty assignment state.', error)
}

export function sortJobExecutionSteps(steps: JobExecutionStep[]) {
  return [...steps].sort((a, b) => a.step_number - b.step_number)
}

export function loadLocalPropertyAgentOutputs(request: WorkRequest) {
  try {
    return JSON.parse(
      window.localStorage.getItem(getPropertyAgentOutputStorageKey(request.id)) || '[]'
    ) as PropertyAgentResult[]
  } catch {
    return []
  }
}

export function saveLocalPropertyAgentOutputs(request: WorkRequest, outputs: PropertyAgentResult[]) {
  window.localStorage.setItem(getPropertyAgentOutputStorageKey(request.id), JSON.stringify(outputs))
}

export function loadLocalJobScopeSteps(request: WorkRequest) {
  try {
    return JSON.parse(
      window.localStorage.getItem(getJobScopeStorageKey(request.id)) || '[]'
    ) as JobExecutionStep[]
  } catch {
    return []
  }
}

export function saveLocalJobScopeSteps(request: WorkRequest, steps: JobExecutionStep[]) {
  window.localStorage.setItem(
    getJobScopeStorageKey(request.id),
    JSON.stringify(sortJobExecutionSteps(steps))
  )
}

export function loadLocalAiResearchDrafts(request: WorkRequest) {
  try {
    return JSON.parse(
      window.localStorage.getItem(getAiResearchDraftStorageKey(request.id)) || '[]'
    ) as AiResearchDraft[]
  } catch {
    return []
  }
}

export function saveLocalAiResearchDrafts(request: WorkRequest, drafts: AiResearchDraft[]) {
  window.localStorage.setItem(getAiResearchDraftStorageKey(request.id), JSON.stringify(drafts))
}

export function saveLocalJobPacketMetadata(metadata: JobPacketMetadata) {
  try {
    const existing = JSON.parse(window.localStorage.getItem(JOB_PACKET_METADATA_LOCAL_STORAGE_KEY) || '[]')
    window.localStorage.setItem(
      JOB_PACKET_METADATA_LOCAL_STORAGE_KEY,
      JSON.stringify([metadata, ...existing].slice(0, 200))
    )
  } catch {
    window.localStorage.setItem(JOB_PACKET_METADATA_LOCAL_STORAGE_KEY, JSON.stringify([metadata]))
  }
}
