import { supabase } from './supabase'
import type { Phase1PropertyContext } from './phase1PropertyContext'

export type LiveProcessingState = 'uploaded' | 'queued' | 'processing' | 'completed' | 'failed'

type EvidenceReference = { id: string; sourceFileId: string }
export type ProcessingResponse = {
  id: string
  propertyId: string
  processingStatus: LiveProcessingState
  artifact?: unknown
  error?: string | null
}

async function authContext(): Promise<{ token: string; userId: string }> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) throw new Error('Authorization failed. Sign in before processing property evidence.')
  return { token: data.session.access_token, userId: data.session.user.id }
}

async function jsonRequest<T>(url: string, init: RequestInit, token: string): Promise<T> {
  const response = await fetch(url, { ...init, headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...init.headers } })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error?.message || `The processing request failed with status ${response.status}.`)
  return body as T
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

export async function resolvePhase1Property(address: string): Promise<Phase1PropertyContext> {
  const { token, userId } = await authContext()
  let property: { id: string; address: string }
  try {
    property = await jsonRequest<{ id: string; address: string }>(
      '/api/phase1/properties/resolve',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address }) },
      token,
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
}): Promise<unknown> {
  if (!propertyId) throw new Error('Property context is required before evidence can be processed.')
  if (!files.length) throw new Error('The live processor currently requires one PDF inspection report.')
  const { token } = await authContext()
  const form = new FormData()
  form.set('propertyId', propertyId)
  files.forEach((file) => form.append('evidence', file))
  const upload = await jsonRequest<{ evidenceReferences: EvidenceReference[] }>(
    '/api/phase1/evidence',
    { method: 'POST', body: form },
    token,
  )
  onState('uploaded')
  const request = await jsonRequest<ProcessingResponse>(
    '/api/phase1/processing-requests',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ propertyId, evidenceReferences: upload.evidenceReferences, note }) },
    token,
  )
  onState(request.processingStatus)

  for (;;) {
    await wait(750)
    const status = await jsonRequest<ProcessingResponse>(`/api/phase1/processing-requests/${encodeURIComponent(request.id)}`, { method: 'GET' }, token)
    onState(status.processingStatus)
    if (status.processingStatus === 'completed') {
      if (!status.artifact) throw new Error('Reasoning artifact invalid. Processing completed without an artifact.')
      return status.artifact
    }
    if (status.processingStatus === 'failed') throw new Error(status.error || 'Processing failed.')
  }
}

export async function loadPhase1ProcessingRequest(requestId: string): Promise<ProcessingResponse> {
  if (!requestId) throw new Error('A processing request is required for review.')
  const { token } = await authContext()
  return jsonRequest<ProcessingResponse>(
    `/api/phase1/processing-requests/${encodeURIComponent(requestId)}`,
    { method: 'GET' },
    token,
  )
}
