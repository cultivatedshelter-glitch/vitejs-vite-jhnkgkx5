import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import ts from 'typescript'
import { validatePhase1Artifact } from '../server/phase1ArtifactValidator.mjs'
import { createPhase1HttpHandler } from '../server/phase1HttpServer.mjs'
import { createPhase1ProcessingService } from '../server/phase1ProcessingService.mjs'
import { runExistingPhase1Reasoning } from '../server/phase1ReasoningRunner.mjs'

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111'
const PYTHON = process.env.SHELTER_PREP_PYTHON || join(process.env.HOME, '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3')

function repository(root) {
  const evidence = new Map()
  const requests = new Map()
  const properties = new Map()
  let sequence = 0
  return {
    uploadedAt: null,
    lastStoredEvidence: null,
    async authenticate(token) { return token === 'authorized-token' || token === 'other-token' ? { id: token } : null },
    async resolveOrCreateProperty({ actor, address }) {
      const normalized = address.trim().toLowerCase().replace(/\s+/g, ' ')
      const existing = properties.get(`${actor.id}:${normalized}`)
      if (existing) return { ...existing, created: false }
      const property = { id: PROPERTY_ID, address: address.trim(), actorId: actor.id }
      properties.set(`${actor.id}:${normalized}`, property)
      return { ...property, created: true }
    },
    async canAccessProperty(actor, property) { return actor === 'authorized-token' && property === PROPERTY_ID && [...properties.values()].some((item) => item.actorId === actor && item.id === property) },
    async storeEvidence({ actor, propertyId, file }) {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const id = `evidence-${++sequence}-${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}`
      const localPath = join(root, `${id}.pdf`)
      await writeFile(localPath, bytes)
      this.uploadedAt = new Date().toISOString()
      const item = { id, sourceFileId: id, actorId: actor.id, propertyId, localPath, mediaType: file.type, uploadedAt: this.uploadedAt }
      evidence.set(id, item)
      this.lastStoredEvidence = item
      return { id, sourceFileId: id }
    },
    async resolveEvidence({ actor, propertyId, evidenceReferences }) {
      return evidenceReferences.map(({ id }) => evidence.get(id)).filter((item) => item?.actorId === actor.id && item.propertyId === propertyId)
    },
    async createProcessingRequest({ actor, propertyId, evidenceReferences, note }) {
      const request = { id: `request-${++sequence}`, actorId: actor.id, propertyId, evidenceReferences, note, processingStatus: 'queued', artifact: null, error: null }
      requests.set(request.id, request)
      return { id: request.id, propertyId, processingStatus: 'queued' }
    },
    async markProcessing(id) { requests.get(id).processingStatus = 'processing' },
    async completeProcessing(id, artifact) { Object.assign(requests.get(id), { processingStatus: 'completed', artifact }) },
    async failProcessing(id, error) { Object.assign(requests.get(id), { processingStatus: 'failed', error }) },
    async getProcessingRequest({ actor, requestId }) {
      const request = requests.get(requestId)
      return request?.actorId === actor.id ? request : null
    },
  }
}

async function generatePdf(path) {
  const code = `
from reportlab.pdfgen import canvas
c = canvas.Canvas(${JSON.stringify(path)})
lines = [
  'Example Inspection Co', 'Inspection date:', 'Address:', 'Inspector:', 'Client:',
  '01/02/2030', '10 Test Ave', 'Exampletown, OR 97000', 'Inspector One', 'Client One',
  'Home Inspection Report', 'General Information (per Zillow)', 'Year Built',
  'Square Footage', 'Bedrooms', 'Bathrooms', '1999', '1200', '3', '2'
]
y = 760
for line in lines:
  c.drawString(72, y, line); y -= 18
c.showPage()
lines = ['Exterior Issues', 'Rot damaged siding', '5) Repair/replace rot damaged siding.', 'Split caulking on exterior', '7) Repair split caulking.']
y = 760
for line in lines:
  c.drawString(72, y, line); y -= 22
c.save()
`
  const result = spawnSync(PYTHON, ['-c', code], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
}

async function generateUnparseablePdf(path) {
  const code = `
from reportlab.pdfgen import canvas
c = canvas.Canvas(${JSON.stringify(path)})
c.drawString(72, 760, 'Inspection document with readable text but no supported finding structure.')
c.save()
`
  const result = spawnSync(PYTHON, ['-c', code], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
}

async function requestJson(handle, url, init) {
  const response = await handle(new Request(url, init))
  return { status: response.status, body: await response.json() }
}

async function waitForCompletion(handle, requestId, token = 'authorized-token') {
  for (let index = 0; index < 100; index += 1) {
    const result = await requestJson(handle, `http://test/api/phase1/processing-requests/${requestId}`, { headers: { authorization: `Bearer ${token}` } })
    if (result.body.processingStatus === 'completed' || result.body.processingStatus === 'failed') return result
    await new Promise((resolveWait) => setTimeout(resolveWait, 50))
  }
  throw new Error('Processing did not complete in time.')
}

async function loadAdapter(root) {
  const source = await readFile(resolve('src/phase1ReasoningAdapter.ts'), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  const path = join(root, 'phase1ReasoningAdapter.mjs')
  await writeFile(path, output)
  return import(`${new URL(`file://${path}`).href}?test=${Date.now()}`)
}

test('real private PDF travels through authorized processing, validation, and the frontend adapter', async () => {
  const root = await mkdtemp(join(tmpdir(), 'phase1-boundary-test-'))
  try {
    const pdfPath = join(root, 'inspection.pdf')
    await generatePdf(pdfPath)
    const repo = repository(root)
    const notificationCalls = []
    const notifications = { async notifyNeedsReview(value) { notificationCalls.push(['needs_review', value]) }, async notifyProcessingFailed(value) { notificationCalls.push(['processing_failed', value]) } }
    const service = createPhase1ProcessingService({ repository: repo, reasoningRunner: runExistingPhase1Reasoning, notifications })
    const handle = createPhase1HttpHandler(service)
    const property = await requestJson(handle, 'http://test/api/phase1/properties/resolve', {
      method: 'POST', headers: { authorization: 'Bearer authorized-token', 'content-type': 'application/json' },
      body: JSON.stringify({ address: '10 Test Ave, Exampletown, OR 97000' }),
    })
    assert.equal(property.status, 200)
    assert.equal(property.body.id, PROPERTY_ID)
    const form = new FormData()
    form.set('propertyId', property.body.id)
    form.append('evidence', new File([await readFile(pdfPath)], 'inspection.pdf', { type: 'application/pdf' }))
    const upload = await requestJson(handle, 'http://test/api/phase1/evidence', { method: 'POST', headers: { authorization: 'Bearer authorized-token' }, body: form })
    assert.equal(upload.status, 201)
    assert.equal(upload.body.processingStatus, 'uploaded')
    assert.match(upload.body.evidenceReferences[0].id, /^evidence-/)
    assert.equal(repo.lastStoredEvidence.propertyId, property.body.id)

    const submit = await requestJson(handle, 'http://test/api/phase1/processing-requests', {
      method: 'POST',
      headers: { authorization: 'Bearer authorized-token', 'content-type': 'application/json' },
      body: JSON.stringify({ propertyId: PROPERTY_ID, evidenceReferences: upload.body.evidenceReferences, note: 'Review the exterior evidence.' }),
    })
    assert.equal(submit.status, 202)
    assert.equal(submit.body.processingStatus, 'queued')
    const completed = await waitForCompletion(handle, submit.body.id)
    assert.equal(completed.body.processingStatus, 'completed', completed.body.error)
    validatePhase1Artifact(completed.body.artifact, { propertyId: PROPERTY_ID })
    const observation = completed.body.artifact.atomicObservations[0]
    assert.ok(observation.finding_card.source_evidence.page_previews.length > 0)
    assert.equal(observation.finding_card.source_evidence.page_previews[0].relationship, 'source_page')
    assert.equal(observation.source_chronology.observation_date, '01/02/2030')
    assert.notEqual(observation.source_chronology.observation_date, repo.uploadedAt)
    assert.equal(observation.source_chronology.upload_date_used_as_observation_date, false)

    const adapter = await loadAdapter(root)
    const viewModel = adapter.adaptPhase1ReasoningArtifact(completed.body.artifact, { mode: 'live' })
    assert.ok(viewModel.findings.length > 0)
    assert.equal(viewModel.isFixture, false)
    assert.ok(viewModel.findings[0].known.length > 0)
    assert.ok(viewModel.findings[0].unknown.length > 0)
    assert.equal(notificationCalls.length, 1)
    assert.equal(notificationCalls[0][0], 'needs_review')
    assert.equal(notificationCalls[0][1].requestId, submit.body.id)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('address resolution creates once and reuses the accessible Property workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'phase1-property-test-'))
  try {
    const service = createPhase1ProcessingService({ repository: repository(root), reasoningRunner: async () => ({}) })
    const handle = createPhase1HttpHandler(service)
    const resolve = (address) => requestJson(handle, 'http://test/api/phase1/properties/resolve', {
      method: 'POST', headers: { authorization: 'Bearer authorized-token', 'content-type': 'application/json' }, body: JSON.stringify({ address }),
    })
    const created = await resolve('10 Test Ave, Exampletown, OR 97000')
    const reused = await resolve('  10 TEST AVE, EXAMPLETOWN, OR 97000  ')
    assert.equal(created.status, 200)
    assert.equal(created.body.created, true)
    assert.equal(reused.body.created, false)
    assert.equal(reused.body.id, created.body.id)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('live repository does not combine Property insertion with an RLS returning-row select', async () => {
  const repository = await readFile(resolve('server/phase1SupabaseRepository.mjs'), 'utf8')
  const creation = repository.slice(repository.indexOf("const { error } = await client.from('properties').insert"), repository.indexOf('async storeEvidence'))
  assert.doesNotMatch(creation, /\.insert\([\s\S]*?\)\.select\(/)
  assert.match(creation, /\.eq\('created_by', actor\.id\)/)
  assert.match(creation, /Created Property could not be resolved uniquely/)
})

test('review processing cannot run without resolved property context', async () => {
  const root = await mkdtemp(join(tmpdir(), 'phase1-missing-property-test-'))
  try {
    const service = createPhase1ProcessingService({ repository: repository(root), reasoningRunner: async () => ({}) })
    await assert.rejects(
      service.submit({ token: 'authorized-token', propertyId: '', evidenceReferences: [], note: 'Question' }),
      (error) => error.code === 'authorization_failed' && error.status === 403,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('unauthorized users and cross-property evidence are rejected', async () => {
  const root = await mkdtemp(join(tmpdir(), 'phase1-auth-test-'))
  try {
    const repo = repository(root)
    const service = createPhase1ProcessingService({ repository: repo, reasoningRunner: async () => ({}) })
    const handle = createPhase1HttpHandler(service)
    await service.resolveProperty({ token: 'authorized-token', address: '10 Test Ave' })
    const forbidden = await requestJson(handle, 'http://test/api/phase1/processing-requests', {
      method: 'POST', headers: { authorization: 'Bearer other-token', 'content-type': 'application/json' },
      body: JSON.stringify({ propertyId: PROPERTY_ID, evidenceReferences: [{ id: 'evidence-from-another-property' }] }),
    })
    assert.equal(forbidden.status, 403)
    assert.equal(forbidden.body.error.code, 'authorization_failed')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('malformed and fixture artifacts are rejected and become an explicit failed state', async () => {
  assert.throws(() => validatePhase1Artifact({ schemaVersion: 'bad', atomicObservations: [] }), /atomic observations are missing/)
  assert.throws(() => validatePhase1Artifact({ schemaVersion: 'bad', fixture_backed: true, atomicObservations: [{}] }), /fixture-backed/)
  const root = await mkdtemp(join(tmpdir(), 'phase1-failure-test-'))
  try {
    const repo = repository(root)
    const notificationCalls = []
    const notifications = { async notifyNeedsReview(value) { notificationCalls.push(['needs_review', value]) }, async notifyProcessingFailed(value) { notificationCalls.push(['processing_failed', value]) } }
    const service = createPhase1ProcessingService({ repository: repo, reasoningRunner: async () => ({ schemaVersion: 'bad', atomicObservations: [] }), notifications })
    await service.resolveProperty({ token: 'authorized-token', address: '10 Test Ave' })
    const ref = await repo.storeEvidence({ actor: { id: 'authorized-token' }, propertyId: PROPERTY_ID, file: new File(['bad'], 'bad.pdf', { type: 'application/pdf' }) })
    const request = await service.submit({ token: 'authorized-token', propertyId: PROPERTY_ID, evidenceReferences: [ref] })
    await new Promise((resolveWait) => setTimeout(resolveWait, 0))
    const status = await service.status({ token: 'authorized-token', requestId: request.id })
    assert.equal(status.processingStatus, 'failed')
    assert.match(status.error, /Reasoning artifact invalid/)
    assert.deepEqual(notificationCalls, [['processing_failed', { requestId: request.id }]])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('readable PDFs with no parseable findings fail at extraction instead of artifact validation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'phase1-parser-failure-test-'))
  try {
    const pdfPath = join(root, 'unsupported-inspection.pdf')
    await generateUnparseablePdf(pdfPath)
    await assert.rejects(
      runExistingPhase1Reasoning({ evidence: [{ mediaType: 'application/pdf', localPath: pdfPath }] }),
      /Inspection parser found no normalized findings/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('live frontend flow does not use an artifact URL or silently fall back to fixture data', async () => {
  const experience = await readFile(resolve('src/Phase1Experience.tsx'), 'utf8')
  const client = await readFile(resolve('src/phase1ProcessingClient.ts'), 'utf8')
  assert.doesNotMatch(experience, /VITE_PHASE1_REASONING_ARTIFACT_URL/)
  assert.match(experience, /if \(fixtureMode\)[\s\S]*await loadPhase1ReasoningArtifact/)
  assert.match(experience, /processPhase1Evidence/)
  assert.match(experience, /resolvePhase1Property\(address\)/)
  assert.match(experience, /propertyId: propertyContext\?\.id \|\| ''/)
  assert.doesNotMatch(experience, /URLSearchParams\(window\.location\.search\).*property/)
  assert.doesNotMatch(client, /phase1-round1g-moisture\.fixture\.json/)
})

test('retained property context survives refresh and is rejected for a changed address', async () => {
  const root = await mkdtemp(join(tmpdir(), 'phase1-context-test-'))
  try {
    const source = await readFile(resolve('src/phase1PropertyContext.ts'), 'utf8')
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    const path = join(root, 'phase1PropertyContext.mjs')
    await writeFile(path, output)
    const contextModule = await import(`${new URL(`file://${path}`).href}?test=${Date.now()}`)
    const values = new Map()
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
    const context = { id: PROPERTY_ID, address: '10 Test Ave, Exampletown, OR 97000', userId: 'authorized-user-id' }
    contextModule.writePhase1PropertyContext(storage, context)
    assert.deepEqual(contextModule.readPhase1PropertyContext(storage), context)
    assert.equal(contextModule.propertyContextMatchesAddress(context, '  10 TEST Ave, Exampletown, OR 97000 '), true)
    assert.equal(contextModule.propertyContextMatchesAddress(context, '11 Test Ave, Exampletown, OR 97000'), false)
    assert.equal(contextModule.propertyContextBelongsToUser(context, 'authorized-user-id'), true)
    assert.equal(contextModule.propertyContextBelongsToUser(context, 'different-user-id'), false)
    contextModule.clearPhase1PropertyContext(storage)
    assert.equal(contextModule.readPhase1PropertyContext(storage), null)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('review actions are server-authoritative, preserve source layers, and validate price provenance', async () => {
  const calls = []
  const artifact = { schemaVersion: 'phase1-test', atomicObservations: [{ id: 'observation-1' }] }
  const repo = {
    async authenticate(token) { return token === 'authorized-token' ? { id: 'reviewer-1' } : null },
    async getProcessingRequest() { return { id: 'request-1', artifactVersion: artifact.schemaVersion, artifact } },
    async reviewFinding(value) { calls.push(value); return { findingId: 'finding-1', status: 'human_reviewed', eventId: 'event-1' } },
  }
  const service = createPhase1ProcessingService({ repository: repo, reasoningRunner: async () => artifact })
  const result = await service.review({
    token: 'authorized-token', requestId: 'request-1', observationId: 'observation-1', action: 'edit',
    corrections: { title: 'Corrected title', price: { low: 1200, high: 2400, source_reference: 'Licensed contractor proposal dated 2026-09-18' } },
    reason: 'Corrected against the attached proposal.',
  })
  assert.equal(result.status, 'human_reviewed')
  assert.equal(calls[0].newValue.source_layer_preserved, true)
  assert.equal(calls[0].newValue.ai_draft_preserved, true)
  assert.equal(calls[0].newValue.delivery_eligible, true)
  assert.deepEqual(artifact, { schemaVersion: 'phase1-test', atomicObservations: [{ id: 'observation-1' }] })
  await assert.rejects(
    service.review({
      token: 'authorized-token', requestId: 'request-1', observationId: 'observation-1', action: 'edit',
      corrections: { price: { low: 2400, high: 1200 } }, reason: 'Bad range.',
    }),
    (error) => error.code === 'invalid_price_correction',
  )
  await assert.rejects(
    service.review({ token: '', requestId: 'request-1', observationId: 'observation-1', action: 'approve' }),
    (error) => error.code === 'authorization_failed',
  )
  for (const action of ['approve', 'needs_more_info', 'reject']) {
    const reason = action === 'approve' ? '' : `${action} reason`
    await service.review({
      token: 'authorized-token', requestId: 'request-1', observationId: 'observation-1', action,
      reason, fieldsApproved: action === 'approve' ? ['title', 'next_step'] : [],
    })
  }
  assert.deepEqual(calls.slice(1).map((call) => call.action), ['approve', 'needs_more_info', 'reject'])
  assert.equal(calls[1].newValue.delivery_eligible, true)
  assert.deepEqual(calls[1].newValue.fields_approved, ['title', 'next_step'])
  assert.equal(calls[2].newValue.delivery_eligible, false)
  assert.equal(calls[3].newValue.delivery_eligible, false)
})

test('completed human review releases once and delivery failure cannot erase approval', async () => {
  const deliveries = []
  let releaseCalls = 0
  const artifact = { schemaVersion: 'phase1-test', atomicObservations: [{ id: 'observation-1' }] }
  const repo = {
    async authenticate() { return { id: 'reviewer-1' } },
    async getProcessingRequest() { return { id: 'request-1', artifactVersion: artifact.schemaVersion, artifact } },
    async reviewFinding() { return { findingId: 'finding-1', status: 'human_verified', eventId: 'event-1' } },
    async releaseIfReviewComplete() { releaseCalls += 1; return { ready: true, released: releaseCalls === 1 } },
  }
  const notifications = { async notifyReviewedResult(value) { deliveries.push(value); throw new Error('provider unavailable') } }
  const errors = []
  const service = createPhase1ProcessingService({ repository: repo, reasoningRunner: async () => artifact, notifications, logger: { error: (...values) => errors.push(values) } })
  const first = await service.review({ token: 'reviewer-token', requestId: 'request-1', observationId: 'observation-1', action: 'approve' })
  const duplicate = await service.review({ token: 'reviewer-token', requestId: 'request-1', observationId: 'observation-1', action: 'approve' })
  assert.equal(first.release.released, true)
  assert.equal(duplicate.release.released, false)
  assert.equal(deliveries.length, 1)
  assert.equal(errors.length, 1)
  assert.equal(first.status, 'human_verified')
})
