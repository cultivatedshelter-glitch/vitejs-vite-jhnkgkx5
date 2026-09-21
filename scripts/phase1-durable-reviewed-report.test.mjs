import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import test from 'node:test'
import { buildReviewedReportDocument, recipientReadiness, reviewedFindingVersions, reviewedPricingVersions } from '../server/phase1ReviewedReport.mjs'
import { createLocalProfessionalResearch } from '../server/phase1LocalProfessionals.mjs'
import { createPhase1HttpHandler } from '../server/phase1HttpServer.mjs'
import { createPhase1ProcessingService } from '../server/phase1ProcessingService.mjs'
import { createPhase1SupabaseRepository } from '../server/phase1SupabaseRepository.mjs'
import { buildDecisionBrief } from '../server/phase1DecisionBrief.mjs'

const reviewedArtifact = {
  schemaVersion: 'phase1-test',
  external_sources: [{ id: 'source-1', source_name: 'Qualified repair guide', source_url: 'https://example.com/source', scope_basis: 'Fixture reset and flange decision context.' }],
  atomicObservations: [{ id: 'obs-1', source: { source_page: 7, inspector_statement: 'Fixture moved.' }, epistemic_states: { source_observation: 'Fixture moved.', shelter_prep_interpretation: 'Movement at the fixture can reflect mounting, flange, seal, or floor conditions; those conditions select reset, flange repair, or replacement.' }, finding_card: { finding_title: 'Loose fixture', next_step_owner: 'Plumber', research_source_refs: ['source-1'], what_we_know: ['Movement was reported.'], what_we_dont_know: ['Flange condition is unknown.'], recommended_next_step: 'Confirm fixture, flange, seal, and floor condition.', why_next_step: 'This separates reset from concealed repair.', repair_paths: [{ id: 'reset', label: 'Reset fixture', price_low: 250, price_high: 600, price_unit: 'project', price_source_refs: ['source-1'], price_geography: { level: 'metro', label: 'Portland metro' }, assumptions: ['Fixture reusable'], major_exclusions: ['Floor repair'], range_status: 'broad_preliminary' }] } }],
  reviewState: { 'obs-1': { findingId: 'finding-1', event: { id: 'event-1', review_action: 'approve', created_at: '2030-01-01T00:00:00Z', new_value: { corrections: {} } } } },
}

async function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args)
    let stdout = ''; let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(`${command} exited ${code}: ${stderr}`)))
  })
}

function artifactWithFindingCount(count) {
  const artifact = structuredClone(reviewedArtifact)
  artifact.atomicObservations = []
  artifact.reviewState = {}
  for (let index = 1; index <= count; index += 1) {
    const observation = structuredClone(reviewedArtifact.atomicObservations[0])
    observation.id = `obs-${index}`
    observation.source.source_page = index + 3
    observation.source.inspector_statement = `Qualied inspector reported movement at oor fixture ${index}.`
    observation.epistemic_states.source_observation = observation.source.inspector_statement
    observation.finding_card.finding_title = `Fixture finding ${index}`
    observation.finding_card.source_refs = { source_page: index + 3, source_item_number: `2.${index}` }
    artifact.atomicObservations.push(observation)
    artifact.reviewState[observation.id] = { findingId: `finding-${index}`, event: { id: `event-${index}`, review_action: index === count ? 'reject' : 'approve', created_at: '2030-01-01T00:00:00Z', new_value: { corrections: {} } } }
  }
  return artifact
}

test('legacy reviewed artifacts receive only verified recipient-facing source relevance corrections', () => {
  const artifact = artifactWithFindingCount(4)
  artifact.external_sources = [
    { id: 'homeguide-siding-repair', source_name: 'Siding repair guide', source_url: 'https://example.com/siding', price_low: 200, price_high: 1200, price_unit: 'project', source_geography: { label: 'United States' } },
    { id: 'homeguide-roof-minor', source_name: 'Roof repair guide', source_url: 'https://example.com/roof', price_low: 150, price_high: 1000 },
    { id: 'angi-roof-repair', source_name: 'Second roof repair guide', source_url: 'https://example.com/roof-2', price_low: 395, price_high: 1967 },
    { id: 'homeguide-roof-flashing', source_name: 'Flashing guide', source_url: 'https://example.com/flashing', price_low: 200, price_high: 500 },
    { id: 'angi-outlet-repair', source_name: 'Outlet repair guide', source_url: 'https://example.com/outlet', price_low: 60, price_high: 250 },
    { id: 'homeguide-electrical-small', source_name: 'Electrical work guide', source_url: 'https://example.com/electrical', price_low: 141, price_high: 419 },
    { id: 'homeguide-afci-breaker', source_name: 'AFCI breaker guide', source_url: 'https://example.com/afci', price_low: 150, price_high: 310 },
  ]
  const [hardSurface, fasteners, knockout, afci] = artifact.atomicObservations
  Object.assign(hardSurface.finding_card, { finding_title: 'HARD SURFACES- DETERIORATION', repair_paths: [{ id: 'resurface-hard-surface', label: 'Resurface concrete', price_low: 3, price_high: 7, price_unit: 'square_foot', price_source_refs: ['homeguide-concrete-resurfacing'] }] })
  hardSurface.source.inspector_statement = 'The patio or walk is touching the wood structure and deterioration exists due to contact.'
  hardSurface.epistemic_states.source_observation = hardSurface.source.inspector_statement
  Object.assign(fasteners.finding_card, { finding_title: 'EXPOSED FASTENERS', research_source_refs: ['doe-drip-edge'], repair_paths: [{ id: 'targeted-roof-repair', label: 'Localized roof repair', price_low: 395, price_high: 1000, price_source_refs: ['homeguide-roof-minor', 'angi-roof-repair'] }, { id: 'repair-flashing', label: 'Repair flashing', price_low: 200, price_high: 500, price_source_refs: ['homeguide-roof-flashing'] }] })
  Object.assign(knockout.finding_card, { finding_title: 'UNPROTECTED KNOCKOUT OPENING', repair_paths: [{ id: 'close-panel-opening', label: 'Close panel opening', price_low: 141, price_high: 250, price_source_refs: ['homeguide-electrical-small', 'angi-outlet-repair'] }] })
  Object.assign(afci.finding_card, { finding_title: 'AFCI: NONE INSTALLED', repair_paths: [{ id: 'evaluate-afci', label: 'Evaluate AFCI', price_low: 141, price_high: 250, price_source_refs: ['homeguide-electrical-small', 'angi-outlet-repair'] }, { id: 'retrofit-afci-breaker', label: 'Retrofit AFCI breaker', price_low: 150, price_high: 310, price_source_refs: ['homeguide-afci-breaker'] }] })

  const brief = buildDecisionBrief(artifact, { total: 4, reviewed: 4, approved: 3, rejected: 1, needsInfo: 0, remaining: 0 })
  const findings = new Map(brief.appendix.findings.map((finding) => [finding.id, finding]))
  assert.deepEqual(findings.get(hardSurface.id).paths.map((path) => path.id), ['repair-contact-damage', 'restore-wall-clearance'])
  assert.equal(findings.get(hardSurface.id).category, 'Exterior / Envelope')
  assert.deepEqual(findings.get(fasteners.id).paths.map((path) => path.id), ['targeted-roof-repair'])
  assert.ok(findings.get(fasteners.id).researchSources.some((source) => source.id === 'gaf-exposed-fasteners'))
  assert.deepEqual(findings.get(knockout.id).paths[0].sources.map((source) => source.id), ['homeguide-electrical-small'])
  assert.equal(findings.get(knockout.id).paths[0].high, 419)
  assert.ok(findings.get(afci.id).researchSources.some((source) => source.id === 'esfi-afci'))
  assert.ok(findings.get(afci.id).paths.every((path) => path.sources.every((source) => source.id !== 'angi-outlet-repair')))
})

test('reviewed report generation rejects paraphrase-only findings without independent research', () => {
  const artifact = structuredClone(reviewedArtifact)
  artifact.atomicObservations[0].epistemic_states.shelter_prep_interpretation = 'Shelter Prep can organize it as a repair item.'
  artifact.atomicObservations[0].finding_card.research_source_refs = []
  assert.throws(() => buildReviewedReportDocument({
    report: { id: 'report-bad', report_version: 1, recipient: 'agent@example.com' },
    request: { id: 'request-bad', propertyId: 'property-1', artifact, submission: { propertyAddress: '1150 Greentree Rd' } },
    reviewer: { id: 'reviewer-1' },
    localProfessionals: { groups: [], lookups: [] },
  }), /paraphrase-only reasoning|independent research source/)
})

test('recipient readiness is separate from review completion and honors canonical human corrections', () => {
  const artifact = structuredClone(reviewedArtifact)
  artifact.atomicObservations[0].epistemic_states.shelter_prep_interpretation = 'Shelter Prep can organize it as a repair item.'
  artifact.atomicObservations[0].finding_card.recommended_next_step = 'Identify the specific unresolved fact.'
  const blocked = recipientReadiness(artifact)
  assert.equal(blocked.ready, false)
  assert.equal(blocked.issueCount, 1)
  assert.equal(blocked.issues[0].observationId, 'obs-1')
  assert.ok(blocked.issues[0].reasons.includes('internal_or_generic_language'))

  artifact.reviewState['obs-1'].event.new_value.corrections = {
    interpretation: 'Movement at the fixture can reflect mounting, flange, seal, or floor conditions.',
    next_step: 'Confirm fixture, flange, seal, and floor condition.',
    unknown: ['Flange and concealed floor condition remain unknown.'],
  }
  assert.deepEqual(recipientReadiness(artifact), { ready: true, issueCount: 0, issues: [] })
  assert.doesNotThrow(() => buildReviewedReportDocument({
    report: { id: 'report-corrected', report_version: 1, recipient: 'agent@example.com' },
    request: { id: 'request-corrected', propertyId: 'property-1', artifact, submission: { propertyAddress: '1150 Greentree Rd' } },
    reviewer: { id: 'reviewer-1' },
    localProfessionals: { groups: [], lookups: [] },
  }))
})

test('reviewed report snapshots require terminal review and retain review-event identity', () => {
  const document = buildReviewedReportDocument({
    report: { id: 'report-1', report_version: 2, recipient: 'agent@example.com' },
    request: { id: 'request-1', propertyId: 'property-1', artifact: reviewedArtifact, submission: { propertyAddress: '1150 Greentree Rd', deliveryRecipientEmail: 'agent@example.com' } },
    reviewer: { id: 'reviewer-1', fullName: 'Reviewer' },
    localProfessionals: { groups: [], lookups: [] },
  })
  assert.equal(document.reportVersion, 2)
  assert.equal(document.summary.approved, 1)
  assert.equal(document.decisionBrief.schemaVersion, 'phase1-reviewed-decision-brief.v1')
  assert.equal(document.decisionBrief.groups[0].findings[0].paths[0].confidence, 'Low')
  assert.equal(document.artifact.atomicObservations[0].finding_card.repair_paths[0].range_status, 'broad_preliminary')
  assert.deepEqual(reviewedFindingVersions(document), [{ observationId: 'obs-1', findingId: 'finding-1', reviewEventId: 'event-1', action: 'approve', reviewedAt: '2030-01-01T00:00:00Z' }])
  assert.equal(reviewedPricingVersions(document).length, 1)
  assert.deepEqual(reviewedPricingVersions(document)[0].sourceIds, ['source-1'])
})

test('local professional research is optional and never fabricates listings without a key', async () => {
  const result = await createLocalProfessionalResearch({ apiKey: '' })({ artifact: reviewedArtifact, propertyAddress: '1150 Greentree Rd' })
  assert.deepEqual(result.groups, [])
  assert.equal(result.lookups[0].status, 'skipped_not_configured')
})

test('local professional research accepts a fresh unreviewed artifact', async () => {
  const research = createLocalProfessionalResearch({ apiKey: '' })
  const result = await research({
    artifact: { atomicObservations: [{ id: 'finding-draft', finding_card: { next_step_owner: 'Licensed electrician' } }] },
    propertyAddress: '100 Main St',
  })
  assert.deepEqual(result.groups, [])
  assert.deepEqual(result.lookups, [{ trade: 'Licensed electrician', status: 'skipped_not_configured', provider: 'Google Places' }])
})

test('local professional research deduplicates and caps sourced businesses per trade', async () => {
  const research = createLocalProfessionalResearch({ apiKey: 'server-only', fetchImpl: async () => new Response(JSON.stringify({ places: [
    { id: 'a', displayName: { text: 'A Plumbing' }, businessStatus: 'OPERATIONAL', rating: 4.8, userRatingCount: 100, googleMapsUri: 'https://maps.example/a' },
    { id: 'b', displayName: { text: 'B Plumbing' }, businessStatus: 'OPERATIONAL', rating: 4.7, userRatingCount: 90 },
    { id: 'c', displayName: { text: 'C Plumbing' }, businessStatus: 'OPERATIONAL', rating: 5, userRatingCount: 1 },
  ] }), { status: 200, headers: { 'content-type': 'application/json' } }) })
  const result = await research({ artifact: reviewedArtifact, propertyAddress: '1150 Greentree Rd' })
  assert.equal(result.groups[0].professionals.length, 2)
  assert.equal(new Set(result.groups[0].professionals.map((item) => item.providerId)).size, 2)
  assert.match(JSON.stringify(result), /Not verified by Shelter Prep/)
})

test('reviewed report migration keeps browser roles out and report snapshots immutable', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260920184539_phase1_durable_reviewed_reports.sql', import.meta.url), 'utf8')
  assert.match(sql, /revoke all on public\.phase1_reviewed_reports from anon, authenticated/i)
  assert.match(sql, /phase1_reviewed_reports_storage_deny_browser_select/i)
  assert.match(sql, /phase1_protect_reviewed_report_snapshot/i)
  assert.match(sql, /phase1_notifications_report_delivery_dedupe_idx/i)
})

test('ReportLab renderer produces a real PDF from the canonical reviewed document', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'phase1-report-test-'))
  try {
    const input = join(directory, 'input.json'); const output = join(directory, 'output.pdf')
    const document = buildReviewedReportDocument({ report: { id: 'report-1', report_version: 1, recipient: 'agent@example.com' }, request: { id: 'request-1', propertyId: 'property-1', artifact: reviewedArtifact, submission: { propertyAddress: '1150 Greentree Rd' } }, reviewer: { id: 'reviewer-1' }, localProfessionals: { groups: [], lookups: [] } })
    await writeFile(input, JSON.stringify(document))
    await new Promise((resolve, reject) => { const child = spawn(process.env.SHELTER_PREP_PYTHON || '.venv/bin/python', ['scripts/phase1_reviewed_report_pdf.py', input, output]); let stderr = ''; child.stderr.on('data', (chunk) => { stderr += chunk }); child.on('error', reject); child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`renderer exited ${code}: ${stderr}`))) })
    const pdf = await readFile(output)
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
    assert.ok(pdf.length > 1500)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('31-finding decision brief stays within the primary-page target and retains the technical appendix', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'phase1-report-pagination-'))
  try {
    const input = join(directory, 'input.json'); const output = join(directory, 'output.pdf')
    const artifact = artifactWithFindingCount(31)
    const document = buildReviewedReportDocument({ report: { id: 'report-31', report_version: 4, recipient: 'agent@example.com' }, request: { id: 'request-31', propertyId: 'property-1', artifact, submission: { propertyAddress: '1150 Greentree Rd' } }, reviewer: { id: 'reviewer-1' }, localProfessionals: { groups: [], lookups: [] } })
    assert.equal(document.decisionBrief.summary.total, 31)
    assert.equal(document.decisionBrief.summary.rejected, 1)
    assert.match(document.decisionBrief.groups[0].findings[0].found, /qualified inspector reported movement at floor fixture 1\./i)
    assert.match(artifact.atomicObservations[0].source.inspector_statement, /Qualied.*oor/)
    await writeFile(input, JSON.stringify(document))
    await run(process.env.SHELTER_PREP_PYTHON || '.venv/bin/python', ['scripts/phase1_reviewed_report_pdf.py', input, output])
    const inspection = JSON.parse(await run(process.env.SHELTER_PREP_PYTHON || '.venv/bin/python', ['-c', 'import json,sys; from pypdf import PdfReader; r=PdfReader(sys.argv[1]); t=[p.extract_text() or "" for p in r.pages]; print(json.dumps({"pages":len(t),"appendix":next((i+1 for i,v in enumerate(t) if "Technical Appendix" in v),None),"text":"\\n".join(t)}))', output]))
    const primaryPages = inspection.appendix - 1
    assert.ok(primaryPages >= 6 && primaryPages <= 10, `primary brief used ${primaryPages} pages`)
    assert.match(inspection.text, /Fixture finding 31/)
    assert.match(inspection.text, /Technical Appendix/)
    assert.match(inspection.text, /Pricing source: Qualified repair guide/)
    assert.doesNotMatch(inspection.text, /broad_preliminary|Qualied|\boor\b/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('production repository factory releases the generated report for current and stale clients', async () => {
  const reportLookups = []
  const rpcCalls = []
  const admin = {
    auth: { async getUser() { return { data: { user: { id: 'reviewer-1', email: 'reviewer@example.com' } }, error: null } } },
    from(table) {
      const filters = {}
      const query = {
        select() { return query },
        eq(column, value) { filters[column] = value; return query },
        order() { return query },
        limit() { return query },
        async maybeSingle() {
          if (table === 'profiles') return { data: { role: 'admin', active: true }, error: null }
          if (table === 'phase1_reviewed_reports') {
            reportLookups.push({ ...filters })
            return { data: { id: filters.id || 'report-latest', processing_request_id: filters.processing_request_id, report_version: 3, report_status: filters.report_status || 'draft' }, error: null }
          }
          throw new Error(`Unexpected production repository table: ${table}`)
        },
      }
      return query
    },
    async rpc(name, values) {
      rpcCalls.push({ name, values })
      return { data: { id: values.target_report_id, report_version: 3, released_at: '2030-01-02T00:00:00Z' }, error: null }
    },
  }
  const repository = createPhase1SupabaseRepository({
    createClientImpl: () => admin,
    environment: { SUPABASE_URL: 'https://production.example', SUPABASE_PUBLISHABLE_KEY: 'publishable', SUPABASE_SECRET_KEY: 'secret' },
  })
  const service = createPhase1ProcessingService({ repository, reasoningRunner: async () => ({}) })
  const handle = createPhase1HttpHandler(service)
  const release = async (body) => {
    const response = await handle(new Request('https://shelterprep.com/api/phase1/processing-requests/request-1/reviewed-report/release', {
      method: 'POST', headers: { authorization: 'Bearer reviewer-token', 'content-type': 'application/json' }, body: JSON.stringify(body),
    }))
    return { status: response.status, body: await response.json() }
  }

  const currentClient = await release({ reportId: 'report-3' })
  const staleClient = await release({})
  assert.equal(currentClient.status, 200)
  assert.equal(currentClient.body.reportId, 'report-3')
  assert.equal(staleClient.status, 200)
  assert.equal(staleClient.body.reportId, 'report-latest')
  assert.deepEqual(reportLookups, [
    { processing_request_id: 'request-1', id: 'report-3' },
    { processing_request_id: 'request-1', report_status: 'draft' },
  ])
  assert.deepEqual(rpcCalls.map((call) => call.name), ['phase1_release_reviewed_report', 'phase1_release_reviewed_report'])
})
