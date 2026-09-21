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
    lastRequest: null,
    async authenticate(token) { return token === 'authorized-token' || token === 'other-token' ? { id: token, email: `${token}@example.com` } : null },
    async getActorProfile({ actor }) { return { id: actor.id, email: actor.email, fullName: 'Pilot User', role: 'viewer', active: true, isReviewer: false } },
    async resolveOrCreateProperty({ actor, address }) {
      const normalized = address.trim().toLowerCase().replace(/\s+/g, ' ')
      const existing = properties.get(`${actor.id}:${normalized}`)
      if (existing) return { ...existing, created: false }
      const property = { id: PROPERTY_ID, address: address.trim(), actorId: actor.id }
      properties.set(`${actor.id}:${normalized}`, property)
      return { ...property, created: true }
    },
    async canAccessProperty(actor, property) { return actor === 'authorized-token' && property === PROPERTY_ID && [...properties.values()].some((item) => item.actorId === actor && item.id === property) },
    async getPropertyAddress({ actor, propertyId }) {
      return [...properties.values()].find((item) => item.actorId === actor.id && item.id === propertyId)?.address || null
    },
    async isReviewer() { return false },
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
    async validateEvidenceReferences({ actor, propertyId, evidenceReferences }) {
      return evidenceReferences.every(({ id, sourceFileId }) => {
        const item = evidence.get(id)
        return item?.actorId === actor.id && item.propertyId === propertyId && item.sourceFileId === sourceFileId
      })
    },
    async createProcessingRequest({ actor, propertyId, evidenceReferences, note, deliveryRecipient, draft = false }) {
      const request = { id: `request-${++sequence}`, actorId: actor.id, propertyId, property_id: propertyId, evidenceReferences, note, processingStatus: draft ? 'draft' : 'queued', status: draft ? 'draft' : 'queued', artifact: null, error: null, deliveryRecipient }
      requests.set(request.id, request)
      this.lastRequest = request
      return { id: request.id, propertyId, processingStatus: request.processingStatus }
    },
    async finalizeSubmission({ actor, requestId, deliveryRecipient }) {
      const request = requests.get(requestId)
      if (!request || request.actorId !== actor.id || request.status !== 'draft') return null
      Object.assign(request, { status: 'queued', processingStatus: 'queued', deliveryRecipient })
      return { ...request, evidenceReferences: request.evidenceReferences, note: request.note }
    },
    async updateSubmissionDraft({ actor, requestId, propertyId, evidenceReferences, note, deliveryRecipient }) {
      const request = requests.get(requestId)
      if (!request || request.actorId !== actor.id || request.propertyId !== propertyId || request.status !== 'draft') return null
      Object.assign(request, { evidenceReferences, note, deliveryRecipient })
      return { id: request.id, propertyId, processingStatus: 'draft' }
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
    const professionalResearchCalls = []
    const notifications = { async notifyNeedsReview(value) { notificationCalls.push(['needs_review', value]) }, async notifyProcessingFailed(value) { notificationCalls.push(['processing_failed', value]) } }
    const localProfessionalResearch = async (input) => {
      professionalResearchCalls.push(input)
      return { groups: [], lookups: [{ trade: 'Exterior / Siding', status: 'sourced', provider: 'Test Places' }] }
    }
    const service = createPhase1ProcessingService({ repository: repo, reasoningRunner: runExistingPhase1Reasoning, notifications, localProfessionalResearch })
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
      body: JSON.stringify({ propertyId: PROPERTY_ID, evidenceReferences: upload.body.evidenceReferences, note: 'Buyer asks us to review the exterior evidence.' }),
    })
    assert.equal(submit.status, 202)
    assert.equal(submit.body.processingStatus, 'queued')
    const completed = await waitForCompletion(handle, submit.body.id)
    assert.equal(completed.body.processingStatus, 'completed', completed.body.error)
    validatePhase1Artifact(completed.body.artifact, { propertyId: PROPERTY_ID })
    const observation = completed.body.artifact.atomicObservations[0]
    const unitPricedArtifact = structuredClone(completed.body.artifact)
    Object.assign(unitPricedArtifact.atomicObservations[0].finding_card, {
      price_low: null,
      price_high: null,
      pricing_contract_status: 'BLOCKED_MISSING_SOURCED_RANGE',
      path_pricing_status: 'PATH_PRICING_AVAILABLE_QUANTITY_REQUIRED',
    })
    assert.doesNotThrow(() => validatePhase1Artifact(unitPricedArtifact, { propertyId: PROPERTY_ID }))
    assert.ok(observation.finding_card.source_evidence.page_previews.length > 0)
    assert.equal(observation.finding_card.source_evidence.page_previews[0].relationship, 'source_page')
    assert.equal(observation.source_chronology.observation_date, '01/02/2030')
    assert.notEqual(observation.source_chronology.observation_date, repo.uploadedAt)
    assert.equal(observation.source_chronology.upload_date_used_as_observation_date, false)
    assert.equal(completed.body.artifact.humanObservations.length, 1)
    assert.equal(completed.body.artifact.humanObservations[0].observation, 'Buyer asks us to review the exterior evidence.')
    assert.equal(completed.body.artifact.humanObservations[0].source.identity, 'authorized-token')
    assert.equal(completed.body.artifact.humanObservations[0].source.professional_status, 'not_established')
    assert.equal(completed.body.artifact.humanObservations[0].source.verification_status, 'source_material_needs_review')
    assert.equal(completed.body.artifact.transactionContext.perspective, 'buyer')
    assert.match(observation.finding_card.transaction_considerations[0], /longer-term reliability/i)
    assert.ok(observation.finding_card.repair_paths.length > 0)
    assert.ok(observation.finding_card.repair_paths[0].price_source_refs.length > 0)
    assert.ok(!observation.finding_card.review_workflow.reasons.includes('missing_price_source'))
    assert.ok(observation.finding_card.review_workflow.reasons.includes('sourced_path_range_needs_review'))
    assert.ok(observation.finding_card.what_we_dont_know.some((value) => /contractor pricing remain unverified/i.test(value)))
    assert.equal(completed.body.artifact.decisionOverview.total_findings, completed.body.artifact.atomicObservations.length)
    assert.equal(professionalResearchCalls.length, 1)
    assert.equal(professionalResearchCalls[0].propertyAddress, '10 Test Ave, Exampletown, OR 97000')
    assert.equal(professionalResearchCalls[0].reviewedOnly, false)
    assert.equal(completed.body.artifact.localProfessionals.lookups[0].provider, 'Test Places')

    const adapter = await loadAdapter(root)
    const viewModel = adapter.adaptPhase1ReasoningArtifact(completed.body.artifact, { mode: 'live' })
    assert.ok(viewModel.findings.length > 0)
    assert.equal(viewModel.isFixture, false)
    assert.ok(viewModel.findings[0].known.length > 0)
    assert.ok(viewModel.findings[0].unknown.length > 0)
    assert.ok(viewModel.findings[0].repairPaths[0].sources[0].url)
    assert.equal(viewModel.humanObservations[0].professionalStatus, 'Not Established')
    assert.equal(viewModel.localProfessionals.lookups[0].status, 'sourced')
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

test('submission review persists recipient metadata before processing and admin routes stay role-gated', async () => {
  const root = await mkdtemp(join(tmpdir(), 'phase1-submission-test-'))
  try {
    const repo = repository(root)
    const service = createPhase1ProcessingService({ repository: repo, reasoningRunner: async () => ({}) })
    const handle = createPhase1HttpHandler(service)
    await service.resolveProperty({ token: 'authorized-token', address: '10 Test Ave' })
    const file = new File([new Uint8Array([1, 2, 3])], 'inspection.pdf', { type: 'application/pdf' })
    const uploaded = await service.upload({ token: 'authorized-token', propertyId: PROPERTY_ID, files: [file] })
    const draft = await requestJson(handle, 'http://test/api/phase1/submissions', {
      method: 'POST',
      headers: { authorization: 'Bearer authorized-token', 'content-type': 'application/json' },
      body: JSON.stringify({ propertyId: PROPERTY_ID, evidenceReferences: uploaded.evidenceReferences, note: 'Seller timing matters.', deliveryRecipient: { email: 'recipient@example.com' } }),
    })
    assert.equal(draft.status, 201)
    assert.equal(draft.body.processingStatus, 'draft')
    assert.equal(repo.lastRequest.deliveryRecipient.email, 'recipient@example.com')
    assert.equal(repo.lastRequest.deliveryRecipient.source, 'manually_changed')

    const updated = await requestJson(handle, `http://test/api/phase1/submissions/${draft.body.id}`, {
      method: 'PATCH',
      headers: { authorization: 'Bearer authorized-token', 'content-type': 'application/json' },
      body: JSON.stringify({ propertyId: PROPERTY_ID, evidenceReferences: uploaded.evidenceReferences, note: 'Updated context.', deliveryRecipient: { email: 'authorized-token@example.com' } }),
    })
    assert.equal(updated.status, 200)
    assert.equal(repo.lastRequest.note, 'Updated context.')
    assert.equal(repo.lastRequest.deliveryRecipient.source, 'submitter_default')

    const dashboard = await requestJson(handle, 'http://test/api/phase1/dashboard', { headers: { authorization: 'Bearer authorized-token' } })
    assert.equal(dashboard.status, 403)
    assert.equal(dashboard.body.error.code, 'authorization_failed')
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

test('editing a submission draft refreshes its processing identity and primary evidence', async () => {
  const repository = await readFile(resolve('server/phase1SupabaseRepository.mjs'), 'utf8')
  const update = repository.slice(repository.indexOf('async updateSubmissionDraft'), repository.indexOf('async markProcessing'))
  assert.match(update, /inspection_report_id: primary\.id/)
  assert.match(update, /source_file_id: primary\.sourceFileId/)
  assert.match(update, /input_hash: inputHash/)
  assert.match(update, /JSON\.stringify\(\{ propertyId, evidenceReferences, note \}\)/)
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

test('processing status exposes server-authoritative recipient readiness separately from completion', async () => {
  const artifact = {
    atomicObservations: [{ id: 'obs-1', epistemic_states: { shelter_prep_interpretation: 'Shelter Prep can organize it as a repair item.' }, finding_card: { finding_title: 'Trip hazard', recommended_next_step: 'Identify the specific unresolved fact.', research_source_refs: [] } }],
    reviewState: { 'obs-1': { event: { review_action: 'approve', new_value: { corrections: {} } } } },
  }
  const service = createPhase1ProcessingService({
    repository: {
      async authenticate() { return { id: 'reviewer-1' } },
      async getProcessingRequest() { return { id: 'request-1', processingStatus: 'completed', artifact } },
    },
    reasoningRunner: async () => artifact,
  })
  const status = await service.status({ token: 'reviewer-token', requestId: 'request-1' })
  assert.equal(status.recipientReadiness.ready, false)
  assert.equal(status.recipientReadiness.issueCount, 1)
  assert.equal(status.recipientReadiness.issues[0].observationId, 'obs-1')
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
  assert.match(experience, /uploadPhase1Evidence/)
  assert.match(experience, /createPhase1SubmissionDraft/)
  assert.match(experience, /submitPhase1SubmissionDraft/)
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
  const artifact = { schemaVersion: 'phase1-test', atomicObservations: [{ id: 'observation-1', finding_card: { repair_paths: [{ id: 'path-a', price_source_refs: ['source-a'] }] } }] }
  const repo = {
    async authenticate(token) { return token === 'authorized-token' ? { id: 'reviewer-1' } : null },
    async getProcessingRequest() { return { id: 'request-1', artifactVersion: artifact.schemaVersion, artifact } },
    async reviewFinding(value) { calls.push(value); return { findingId: 'finding-1', status: 'human_reviewed', eventId: 'event-1' } },
  }
  const service = createPhase1ProcessingService({ repository: repo, reasoningRunner: async () => artifact })
  const result = await service.review({
    token: 'authorized-token', requestId: 'request-1', observationId: 'observation-1', action: 'edit',
    corrections: { title: 'Corrected title', price: { low: 1200, high: 2400, confidence_status: 'moderate_confidence', source_type: 'external_sources', supporting_source_ids: ['source-a'], assumptions: ['Accessible routine scope'], exclusions: ['Concealed damage'], geography: 'Portland metro', path_id: 'path-a' } },
    reason: 'Corrected against the attached proposal.',
  })
  assert.equal(result.status, 'human_reviewed')
  assert.equal(calls[0].newValue.source_layer_preserved, true)
  assert.equal(calls[0].newValue.ai_draft_preserved, true)
  assert.equal(calls[0].newValue.delivery_eligible, true)
  assert.equal(calls[0].newValue.processing_request_id, 'request-1')
  assert.equal(calls[0].newValue.expected_review_event_id, null)
  assert.deepEqual(artifact, { schemaVersion: 'phase1-test', atomicObservations: [{ id: 'observation-1', finding_card: { repair_paths: [{ id: 'path-a', price_source_refs: ['source-a'] }] } }] })
  await assert.rejects(
    service.review({
      token: 'authorized-token', requestId: 'request-1', observationId: 'observation-1', action: 'edit',
      corrections: { price: { low: 2400, high: 1200 } }, reason: 'Bad range.',
    }),
    (error) => error.code === 'invalid_price_correction',
  )
  await assert.rejects(
    service.review({
      token: 'authorized-token', requestId: 'request-1', observationId: 'observation-1', action: 'edit',
      corrections: { price: { low: 1200, high: 2400, source_reference: 'Local proposal', geography: 'Portland metro' } }, reason: 'Missing path.',
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

test('failed atomic finding persistence does not continue review completion', async () => {
  let releaseCalls = 0
  const artifact = { schemaVersion: 'phase1-test', atomicObservations: [{ id: 'observation-1', finding_card: { repair_paths: [] } }] }
  const repo = {
    async authenticate() { return { id: 'reviewer-1' } },
    async getProcessingRequest() { return { id: 'request-1', artifactVersion: artifact.schemaVersion, artifact } },
    async reviewFinding() { throw new Error('Corrected finding could not be persisted') },
    async releaseIfReviewComplete() { releaseCalls += 1; return { ready: false, released: false } },
  }
  const service = createPhase1ProcessingService({ repository: repo, reasoningRunner: async () => artifact })
  await assert.rejects(
    service.review({
      token: 'reviewer-token', requestId: 'request-1', observationId: 'observation-1', action: 'edit',
      corrections: { title: 'Corrected title' }, reason: 'Source review corrected the issue.', expectedReviewEventId: 'event-before-edit',
    }),
    /Corrected finding could not be persisted/,
  )
  assert.equal(releaseCalls, 0)
})

test('review completion requires explicit preview, release, and idempotent delivery commands', async () => {
  const deliveries = []
  let releaseCalls = 0
  const artifact = { schemaVersion: 'phase1-test', atomicObservations: [{ id: 'observation-1' }], reviewState: { 'observation-1': { event: { review_action: 'approve' } } } }
  const repo = {
    async authenticate() { return { id: 'reviewer-1' } },
    async isReviewer() { return true },
    async getProcessingRequest() { return { id: 'request-1', propertyId: 'property-1', processingStatus: 'completed', artifactVersion: artifact.schemaVersion, artifact, submission: { deliveryRecipientEmail: 'agent@example.com', releasedAt: releaseCalls ? '2030-01-01T00:00:00Z' : null } } },
    async reviewFinding() { return { findingId: 'finding-1', status: 'human_verified', eventId: 'event-1' } },
    async releaseReviewedReport() { releaseCalls += 1; return { id: 'report-1', report_version: 1, released_at: '2030-01-01T00:00:00Z' } },
  }
  const notifications = { async notifyReviewedResult(value) { deliveries.push(value); return { status: 'sent', duplicate: deliveries.length > 1 } } }
  const service = createPhase1ProcessingService({ repository: repo, reasoningRunner: async () => artifact, notifications })
  const decision = await service.review({ token: 'reviewer-token', requestId: 'request-1', observationId: 'observation-1', action: 'approve' })
  assert.equal(decision.completion.remaining, 0)
  assert.equal(releaseCalls, 0)
  assert.equal(deliveries.length, 0)
  const preview = await service.previewReviewedReport({ token: 'reviewer-token', requestId: 'request-1' })
  assert.equal(preview.summary.approved, 1)
  assert.equal(releaseCalls, 0)
  await assert.rejects(
    service.sendReviewedResult({ token: 'reviewer-token', requestId: 'request-1' }),
    (error) => error.code === 'report_not_released' && error.status === 409,
  )
  assert.equal(deliveries.length, 0)
  const release = await service.releaseReviewedReport({ token: 'reviewer-token', requestId: 'request-1' })
  assert.equal(release.released, true)
  assert.equal(releaseCalls, 1)
  await service.sendReviewedResult({ token: 'reviewer-token', requestId: 'request-1' })
  assert.equal(deliveries.length, 1)
})

test('normal agents cannot invoke review mutations', async () => {
  let mutationCalled = false
  const repo = {
    async authenticate() { return { id: 'agent-1' } },
    async isReviewer() { return false },
    async reviewFinding() { mutationCalled = true },
  }
  const service = createPhase1ProcessingService({ repository: repo, reasoningRunner: async () => ({}) })
  await assert.rejects(
    service.review({ token: 'agent-token', requestId: 'request-1', observationId: 'observation-1', action: 'approve' }),
    (error) => error.code === 'authorization_failed' && error.status === 403,
  )
  assert.equal(mutationCalled, false)
})
