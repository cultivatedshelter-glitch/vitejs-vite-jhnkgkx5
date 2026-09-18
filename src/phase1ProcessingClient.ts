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
  const form = new FormData()
  form.set('propertyId', propertyId)
  files.forEach((file) => form.append('evidence', file))
  const upload = await jsonRequest<{ evidenceReferences: EvidenceReference[] }>(
    '/api/phase1/evidence',
    { method: 'POST', body: form },
    { verifySession: true },
  )
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
    if (status.processingStatus === 'completed') {
      if (!status.artifact) throw new Error('Reasoning artifact invalid. Processing completed without an artifact.')
      return status.artifact
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
