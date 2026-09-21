import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createPhase1HttpHandler } from '../server/phase1HttpServer.mjs'
import { createPhase1ProcessingService } from '../server/phase1ProcessingService.mjs'

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111'

function archiveRepository() {
  const state = { archived: false, status: 'needs_review', evidenceCount: 1, reports: 1, events: [] }
  return {
    state,
    async authenticate(token) {
      if (token === 'admin-token') return { id: 'admin-id', email: 'admin@example.com' }
      if (token === 'agent-token') return { id: 'agent-id', email: 'agent@example.com' }
      return null
    },
    async isReviewer(actorId) { return actorId === 'admin-id' },
    async getActorProfile({ actor }) { return { ...actor, active: true, role: actor.id === 'admin-id' ? 'admin' : 'viewer', isReviewer: actor.id === 'admin-id' } },
    async canAccessProperty(_actorId, propertyId) { return propertyId === PROPERTY_ID },
    async canUseActiveProperty(_actorId, propertyId) { return propertyId === PROPERTY_ID && !state.archived },
    async setPropertyArchived({ actor, propertyId, archived, reason }) {
      assert.equal(actor.id, 'admin-id')
      assert.equal(propertyId, PROPERTY_ID)
      state.archived = archived
      state.reason = archived ? reason : null
      state.events.push({ action: archived ? 'property_archived' : 'property_restored', preservedStatus: state.status })
      return { id: propertyId, status: state.status, archived_at: archived ? '2030-01-01T00:00:00.000Z' : null, archive_reason: state.reason }
    },
    async listReviewQueue({ archived }) {
      if (archived !== state.archived) return []
      return [{ requestId: 'request-1', propertyId: PROPERTY_ID, queueStatus: state.status, archivedAt: state.archived ? '2030-01-01T00:00:00.000Z' : null }]
    },
    async storeEvidence() { state.evidenceCount += 1; return { id: 'evidence-2', sourceFileId: 'source-2' } },
  }
}

async function call(handle, path, { token = 'admin-token', method = 'GET', body } = {}) {
  const response = await handle(new Request(`http://test${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }))
  return { status: response.status, body: await response.json() }
}

test('admin archive hides active work, preserves history state, and restore returns it', async () => {
  const repository = archiveRepository()
  const service = createPhase1ProcessingService({ repository, reasoningRunner: async () => ({}) })
  const handle = createPhase1HttpHandler(service)

  const archived = await call(handle, `/api/phase1/properties/${PROPERTY_ID}/archive`, { method: 'POST', body: { archived: true, reason: 'Pilot cleanup' } })
  assert.equal(archived.status, 200)
  assert.equal(repository.state.events[0].action, 'property_archived')
  assert.equal(repository.state.status, 'needs_review')
  assert.equal(repository.state.evidenceCount, 1)
  assert.equal(repository.state.reports, 1)

  assert.deepEqual((await call(handle, '/api/phase1/dashboard')).body.items, [])
  assert.equal((await call(handle, '/api/phase1/dashboard?archived=true')).body.items.length, 1)

  const evidenceForm = new FormData()
  evidenceForm.set('propertyId', PROPERTY_ID)
  const blockedUploadResponse = await handle(new Request('http://test/api/phase1/evidence', { method: 'POST', headers: { authorization: 'Bearer agent-token' }, body: evidenceForm }))
  const blockedUpload = await blockedUploadResponse.json()
  assert.equal(blockedUploadResponse.status, 409)
  assert.equal(blockedUpload.error.code, 'property_archived')
  assert.equal(repository.state.evidenceCount, 1)

  const restored = await call(handle, `/api/phase1/properties/${PROPERTY_ID}/archive`, { method: 'POST', body: { archived: false } })
  assert.equal(restored.status, 200)
  assert.equal(repository.state.events[1].action, 'property_restored')
  assert.equal(repository.state.status, 'needs_review')
  assert.equal((await call(handle, '/api/phase1/dashboard')).body.items.length, 1)
})

test('non-reviewers cannot archive a Property', async () => {
  const repository = archiveRepository()
  const service = createPhase1ProcessingService({ repository, reasoningRunner: async () => ({}) })
  const result = await call(createPhase1HttpHandler(service), `/api/phase1/properties/${PROPERTY_ID}/archive`, {
    token: 'agent-token', method: 'POST', body: { archived: true },
  })
  assert.equal(result.status, 403)
  assert.equal(repository.state.events.length, 0)
})

test('archive migration and production wiring keep archive state server-authoritative', async () => {
  const migration = await readFile('supabase/migrations/20260921090000_phase1_property_archive.sql', 'utf8')
  const repository = await readFile('server/phase1SupabaseRepository.mjs', 'utf8')
  const experience = await readFile('src/Phase1Experience.tsx', 'utf8')
  assert.match(migration, /add column if not exists archived_at timestamptz/)
  assert.match(migration, /phase1_guard_property_archive_fields/)
  assert.match(migration, /status in \('draft', 'queued', 'running'\)/)
  assert.match(migration, /grant execute on function public\.phase1_set_property_archive[\s\S]*to service_role/)
  assert.match(migration, /revoke all on function public\.phase1_set_property_archive[\s\S]*from public, anon, authenticated/)
  assert.doesNotMatch(migration, /delete from public\./i)
  assert.match(repository, /admin\.rpc\('phase1_set_property_archive'/)
  assert.match(repository, /archived \? Boolean\(item\.archived_at\) : !item\.archived_at/)
  assert.match(repository, /\.is\('archived_at', null\)/)
  assert.match(repository, /const visibleRequests = \(requests \|\| \[\]\)\.filter\(\(item\) => propertyById\.has\(item\.property_id\)\)/)
  assert.match(experience, /Archive this Property\? It will be hidden from active work but all history will be preserved\./)
})
