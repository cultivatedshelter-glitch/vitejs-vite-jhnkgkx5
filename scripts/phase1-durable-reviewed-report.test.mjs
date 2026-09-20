import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import test from 'node:test'
import { buildReviewedReportDocument, reviewedFindingVersions, reviewedPricingVersions } from '../server/phase1ReviewedReport.mjs'
import { createLocalProfessionalResearch } from '../server/phase1LocalProfessionals.mjs'

const reviewedArtifact = {
  schemaVersion: 'phase1-test',
  atomicObservations: [{ id: 'obs-1', source: { source_page: 7, inspector_statement: 'Fixture moved.' }, epistemic_states: { source_observation: 'Fixture moved.', shelter_prep_interpretation: 'Movement may indicate a loose connection.' }, finding_card: { finding_title: 'Loose fixture', next_step_owner: 'Plumber', what_we_know: ['Movement was reported.'], what_we_dont_know: ['Flange condition is unknown.'], recommended_next_step: 'Confirm flange condition.', why_next_step: 'This separates reset from concealed repair.', repair_paths: [{ id: 'reset', label: 'Reset fixture', price_low: 250, price_high: 600, price_unit: 'project', price_source_refs: ['source-1'], price_geography: { level: 'metro', label: 'Portland metro' }, assumptions: ['Fixture reusable'], major_exclusions: ['Floor repair'], range_status: 'broad_preliminary' }] } }],
  reviewState: { 'obs-1': { findingId: 'finding-1', event: { id: 'event-1', review_action: 'approve', created_at: '2030-01-01T00:00:00Z', new_value: { corrections: {} } } } },
}

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
