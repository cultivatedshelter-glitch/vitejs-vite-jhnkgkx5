import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  classifyPdfExtraction,
  deterministicProcessingId,
  extractPdfLiteralText,
  inspectPdfProcessingCoverage,
  requestSubmissionKey,
  uniqueEligibleEvidence,
} from '../src/lib/requestReviewCompression.ts'
import {
  buildInspectionIntelligenceDraft,
  buildInspectionReviewOverview,
  mergeInspectionIntelligenceDrafts,
} from '../src/agents/inspectionIntelligence.ts'

const workspace = readFileSync(new URL('../src/pages/ShelterPrepWorkspace.tsx', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../src/components/InspectionIntelligencePanel.tsx', import.meta.url), 'utf8')
const inspectionAgent = readFileSync(new URL('../src/agents/inspectionIntelligence.ts', import.meta.url), 'utf8')

function draft(fileName, finding, sourceFileId, evidenceId) {
  return buildInspectionIntelligenceDraft({
    fileName,
    reportType: 'Inspection report',
    propertyAddress: '1837 SE Jo Ct',
    city: 'Milwaukie',
    state: 'OR',
    inspectionDate: '',
    inspectorName: '',
    inspectorCompany: '',
    findings: [finding],
    missingInfo: ['Confirm concealed conditions.'],
    propertyId: 1837,
    sourceFileId,
    evidenceId,
  })
}

test('full-document extraction reads evidence beyond the former 240 KB boundary', () => {
  const raw = `${'x'.repeat(250_000)} (/Type /Page) (Inspector recommends roof flashing repair after observed moisture staining.)`
  const text = extractPdfLiteralText(raw)
  assert.match(text, /roof flashing repair/)
  assert.doesNotMatch(workspace, /blob\.slice\(0, Math\.min\(blob\.size, INSPECTION_FRONT_PAGE_MAX_BYTES\)\)/)
})

test('a normal multi-page PDF is complete when every detected page is processed', () => {
  const raw = [
    '%PDF-1.7',
    '1 0 obj << /Type /Page >> (Roof flashing observation.) endobj',
    '2 0 obj << /Type /Page >> (Electrical panel observation.) endobj',
    '3 0 obj << /Type /Page >> (Plumbing observation.) endobj',
  ].join('\n')
  const extractedText = extractPdfLiteralText(raw)
  const coverage = inspectPdfProcessingCoverage(raw)
  const complete = classifyPdfExtraction({
    fileName: 'inspection.pdf', bytesRead: raw.length, totalBytes: raw.length,
    ...coverage,
    extractedText,
  })
  assert.equal(coverage.pageCount, 3)
  assert.equal(complete.processed_page_count, 3)
  assert.equal(complete.extraction_status, 'complete')
  assert.equal(complete.warning, null)
})

test('page representations can be fully processed without extracted text', () => {
  const complete = classifyPdfExtraction({
    fileName: 'image-only-inspection.pdf', bytesRead: 300_000, totalBytes: 300_000, pageCount: 12,
    processedPageCount: 12, pageRepresentationCount: 12, attemptedAllPages: true,
    parserErrorCount: 0, extractionTerminatedEarly: false, extractedText: '',
  })
  assert.equal(complete.extraction_status, 'complete')
  assert.equal(complete.extracted_character_count, 0)
})

test('concrete page coverage gaps remain partial and unusable parsing remains failed', () => {
  const partial = classifyPdfExtraction({
    fileName: 'inspection.pdf', bytesRead: 500_000, totalBytes: 500_000, pageCount: 42,
    processedPageCount: 40, pageRepresentationCount: 40, attemptedAllPages: true,
    extractedText: 'Readable inspection text was extracted from some PDF objects.',
  })
  const failed = classifyPdfExtraction({
    fileName: 'broken.pdf', bytesRead: 0, totalBytes: 500_000, pageCount: null,
    processedPageCount: 0, pageRepresentationCount: 0, attemptedAllPages: false,
    extractedText: '', retrievalFailed: true,
  })
  assert.equal(partial.extraction_status, 'partial')
  assert.equal(failed.extraction_status, 'failed')
  assert.match(partial.warning, /40 of 42 pages were processed/i)
})

test('multiple unique files process once each', () => {
  const files = uniqueEligibleEvidence([
    { id: 'file-a', name: 'inspection.pdf' },
    { id: 'file-a', name: 'inspection-copy.pdf' },
    { id: 'file-b', name: 'roof.jpg' },
  ])
  assert.deepEqual(files.map((file) => file.id), ['file-a', 'file-b'])
  assert.match(workspace, /for \(const file of files\)/)
  assert.match(workspace, /await inspectEvidenceFile\(request, file, mode, '', true\)/)
})

test('same processing input receives the same database identity', async () => {
  const first = await deterministicProcessingId(['evidence-finding', 'request-1', 'file-1', 'roof'])
  const second = await deterministicProcessingId(['evidence-finding', 'request-1', 'file-1', 'roof'])
  const different = await deterministicProcessingId(['evidence-finding', 'request-1', 'file-2', 'roof'])
  assert.equal(first, second)
  assert.notEqual(first, different)
  assert.match(workspace, /ignoreDuplicates: true/)
})

test('duplicate request submission key is stable for exact property, evidence, and request', async () => {
  const first = await requestSubmissionKey({
    address: '1837 SE Jo Ct', city: 'Milwaukie', state: 'or', zip: '97267',
    description: 'Inspection review', fileHashes: ['bbb', 'aaa'],
  })
  const repeat = await requestSubmissionKey({
    address: ' 1837  SE Jo Ct ', city: 'MILWAUKIE', state: 'OR', zip: '97267-1234',
    description: ' Inspection review ', fileHashes: ['aaa', 'bbb'],
  })
  assert.equal(first, repeat)
  assert.match(workspace, /property_facts->>requestSubmissionKey/)
})

test('multiple inspection drafts merge without duplicate findings and retain provenance', () => {
  const one = draft('report-a.pdf', 'Inspector observed moisture staining below a roof penetration.', 'file-a', 'evidence-a')
  const duplicate = draft('report-a-copy.pdf', 'Inspector observed moisture staining below a roof penetration.', 'file-a', 'evidence-a')
  const second = draft('report-b.pdf', 'Inspector recommends electrician review of exposed wiring.', 'file-b', 'evidence-b')
  const merged = mergeInspectionIntelligenceDrafts([one, duplicate, second])
  assert.ok(merged)
  assert.equal(merged.repairItems.length, 2)
  assert.deepEqual(new Set(merged.repairItems.map((item) => item.source_file_id)), new Set(['file-a', 'file-b']))
  assert.deepEqual(new Set(merged.repairItems.flatMap((item) => item.evidence_ids)), new Set(['evidence-a', 'evidence-b']))
  assert.ok(merged.repairItems.every((item) => item.status === 'ai_draft'))
  assert.equal(merged.humanReviewStatus, 'ai_draft')
})

test('generic inspection filename cannot inject a different property fallback', () => {
  const result = draft('inspection pages.pdf', 'Inspector observed a loose handrail.', 'file-jo', 'evidence-jo')
  assert.equal(result.propertyAddress, '1837 SE Jo Ct')
  assert.equal(result.city, 'Milwaukie')
  assert.ok(result.repairItems.every((item) => !/Berlin Ave/i.test(item.source_text)))
})

test('property review exposes known, unknown, next-needed, and priority findings', () => {
  const intelligence = draft('jo-ct-inspection.pdf', 'Inspector observed moisture staining below the bathroom exhaust penetration.', 'file-jo', 'evidence-jo')
  const overview = buildInspectionReviewOverview(intelligence)
  assert.match(overview.known[0], /moisture staining/)
  assert.ok(overview.unknown.length > 0)
  assert.ok(overview.nextNeeded.length > 0)
  assert.ok(overview.priorityFindings.length > 0)
  for (const label of ['What We Know', "What We Don't Know Yet", 'What We Need Next', 'Priority Findings']) {
    assert.match(panel, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})

test('submission awaits processing and opens the property review', () => {
  assert.match(workspace, /await autoInterpretEvidenceForRequests\(\[newRequest\]\)/)
  assert.match(workspace, /setActiveTab\('properties'\)/)
  assert.match(workspace, /Unique evidence processed into an AI Draft property review/)
})

test('automatic processing cannot create human-verified findings', () => {
  assert.match(workspace, /review_status: 'needs_review' as PropertyMediaReviewStatus/)
  assert.match(inspectionAgent, /humanReviewStatus: 'ai_draft'/)
  assert.doesNotMatch(workspace, /createEvidenceFinding\([\s\S]{0,500}review_status:\s*'human_verified'/)
  assert.match(workspace, /applyInspectionReviewRpc/)
})

test('advanced evidence and review machinery remains progressively disclosed', () => {
  assert.match(panel, /<details style=\{styles\.moreActions\}>/)
  assert.match(panel, /Evidence extraction status/)
  assert.match(panel, />Verify</)
  assert.match(panel, />Need More Info</)
  assert.match(panel, />Reject</)
})
