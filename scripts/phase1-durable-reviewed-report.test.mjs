import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import test from 'node:test'
import { buildReviewedReportDocument, reviewedFindingVersions, reviewedPricingVersions } from '../server/phase1ReviewedReport.mjs'
import { createLocalProfessionalResearch } from '../server/phase1LocalProfessionals.mjs'
import { createPhase1HttpHandler } from '../server/phase1HttpServer.mjs'
import { createPhase1ProcessingService } from '../server/phase1ProcessingService.mjs'
import { createPhase1SupabaseRepository } from '../server/phase1SupabaseRepository.mjs'

const reviewedArtifact = {
  schemaVersion: 'phase1-test',
  external_sources: [{ id: 'source-1', source_name: 'Qualified repair guide', source_url: 'https://example.com/source', scope_basis: 'Fixture reset and flange decision context.' }],
  atomicObservations: [{ id: 'obs-1', source: { source_page: 7, inspector_statement: 'Fixture moved.' }, epistemic_states: { source_observation: 'Fixture moved.', shelter_prep_interpretation: 'Movement at the fixture can reflect mounting, flange, seal, or floor conditions; those conditions select reset, flange repair, or replacement.' }, finding_card: { finding_title: 'Loose fixture', next_step_owner: 'Plumber', research_source_refs: ['source-1'], what_we_know: ['Movement was reported.'], what_we_dont_know: ['Flange condition is unknown.'], recommended_next_step: 'Confirm fixture, flange, seal, and floor condition.', why_next_step: 'This separates reset from concealed repair.', repair_paths: [{ id: 'reset', label: 'Reset fixture', price_low: 250, price_high: 600, price_unit: 'project', price_source_refs: ['source-1'], price_geography: { level: 'metro', label: 'Portland metro' }, assumptions: ['Fixture reusable'], major_exclusions: ['Floor repair'], range_status: 'broad_preliminary' }] } }],
  reviewState: { 'obs-1': { findingId: 'finding-1', event: { id: 'event-1', review_action: 'approve', created_at: '2030-01-01T00:00:00Z', new_value: { corrections: {} } } } },
}

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

test('reviewed report snapshots require terminal review and retain review-event identity', () => {
  const document = buildReviewedReportDocument({
    report: { id: 'report-1', report_version: 2, recipient: 'agent@example.com' },
    request: { id: 'request-1', propertyId: 'property-1', artifact: reviewedArtifact, submission: { propertyAddress: '1150 Greentree Rd', deliveryRecipientEmail: 'agent@example.com' } },
    reviewer: { id: 'reviewer-1', fullName: 'Reviewer' },
    localProfessionals: { groups: [], lookups: [] },
  })
  assert.equal(document.reportVersion, 2)
  assert.equal(document.summary.approved, 1)
  assert.deepEqual(reviewedFindingVersions(document), [{ observationId: 'obs-1', findingId: 'finding-1', reviewEventId: 'event-1', action: 'approve', reviewedAt: '2030-01-01T00:00:00Z' }])
  assert.equal(reviewedPricingVersions(document).length, 1)
  assert.deepEqual(reviewedPricingVersions(document)[0].sourceIds, ['source-1'])
})

test('local professional research is optional and never fabricates listings without a key', async () => {
  const result = await createLocalProfessionalResearch({ apiKey: '' })({ artifact: reviewedArtifact, propertyAddress: '1150 Greentree Rd' })
  assert.deepEqual(result.groups, [])
  assert.equal(result.lookups[0].status, 'skipped_not_configured')
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
