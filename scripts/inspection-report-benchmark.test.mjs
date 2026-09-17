import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'

import {
  CASE_SCHEMA_VERSION,
  RESULT_SCHEMA_VERSION,
  SYSTEM_OUTPUT_SCHEMA_VERSION,
  TRUTH_SCHEMA_VERSION,
  evaluateInspectionBenchmarkCase,
  initCase,
  loadBenchmarkCase,
  runBenchmark,
} from './inspection-report-benchmark.mjs'

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'shelter-prep-benchmark-'))
}

function baseManifest(reportId = 'synthetic-unit-case') {
  return {
    schemaVersion: CASE_SCHEMA_VERSION,
    reportId,
    filename: 'synthetic-inspection.pdf',
    reportCharacteristics: ['synthetic_unit_fixture'],
    sourceDocument: {
      path: 'synthetic-inspection.pdf',
      documentType: 'synthetic_fixture',
      containsPrivateData: false,
    },
    truthPath: 'expected-truth.json',
    systemOutputPath: 'system-output.json',
  }
}

function humanTruth(overrides = {}) {
  return {
    schemaVersion: TRUTH_SCHEMA_VERSION,
    reportId: 'synthetic-unit-case',
    truthStatus: 'human_reviewed',
    expectedPageCount: 2,
    pagesExpectedToHaveContent: [1, 2],
    meaningfulFindingsExpected: [
      {
        truthId: 'T1',
        title: 'Roof leak at vent flashing',
        critical: true,
        expectedPages: [1],
        systemMatch: { status: 'captured', systemFindingIds: ['S1'] },
      },
      {
        truthId: 'T2',
        title: 'Missing GFCI protection',
        critical: false,
        expectedPages: [2],
        systemMatch: { status: 'missed', systemFindingIds: [] },
      },
    ],
    manualAssessment: {
      missedFindings: [{ truthId: 'T2', notes: 'System did not produce the electrical finding.' }],
      unsupportedClaims: [{ systemFindingId: 'S3', notes: 'No report evidence for mold claim.' }],
      duplicateFindings: [{ systemFindingIds: ['S1', 'S2'] }],
      incorrectClassifications: [],
      evidenceLinkageErrors: [{ systemFindingId: 'S1', expectedPage: 1, actualPage: 2 }],
      organizationErrors: [],
      knownUnknownErrors: [{ systemFindingId: 'S1', notes: 'Concealed damage stated as known.' }],
      evidenceFidelity: 'partial',
      knownUnknownFidelity: 'fail',
      organizationUsefulnessScore: 2,
      humanCorrectionBurden: 'high',
      reviewTimeMinutes: 18,
      correctionCount: 5,
      finalAcceptance: 'fail',
      notes: 'Synthetic unit test truth.',
    },
    ...overrides,
  }
}

function systemOutput() {
  return {
    schemaVersion: SYSTEM_OUTPUT_SCHEMA_VERSION,
    reportId: 'synthetic-unit-case',
    pipeline: {
      name: 'unit-test-pipeline',
      startedAt: '2026-08-28T12:00:00.000Z',
      completedAt: '2026-08-28T12:00:05.000Z',
    },
    sourceDocument: { filename: 'synthetic-inspection.pdf', pageCount: 2 },
    extraction: {
      status: 'pass',
      pages: [
        { page: 1, status: 'extracted', text: 'Roof leak observed at vent flashing.' },
        { page: 2, status: 'extracted', text: 'Electrical finding text.' },
      ],
      latencyMs: 1200,
    },
    findings: [
      {
        findingId: 'S1',
        title: 'Roof leak at vent flashing',
        sourcePage: 1,
        sourceExcerpt: 'Roof leak observed at vent flashing.',
        evidenceRefs: ['page-1'],
        tradeCategory: 'roofing',
        known: ['Leak observed at roof vent flashing.'],
        unknown: ['Concealed sheathing damage unknown.'],
      },
      {
        findingId: 'S2',
        title: 'Roof water intrusion duplicate',
        sourcePage: 1,
        sourceExcerpt: 'Roof leak observed at vent flashing.',
        evidenceRefs: ['page-1'],
      },
      {
        findingId: 'S3',
        title: 'Unsupported mold claim',
      },
    ],
    organization: {
      knownUnknownSupported: true,
      latencyMs: 900,
    },
  }
}

test('benchmark separates system output from human-reviewed truth and reports critical defects', () => {
  const result = evaluateInspectionBenchmarkCase({
    manifest: baseManifest(),
    truth: humanTruth(),
    systemOutput: systemOutput(),
    caseDir: tempDir(),
    now: new Date('2026-08-28T12:00:10.000Z'),
  })

  assert.equal(result.schemaVersion, RESULT_SCHEMA_VERSION)
  assert.equal(result.extraction.extractionCompleteness, 'Pass')
  assert.equal(result.findings.expectedMeaningfulFindings, 2)
  assert.equal(result.findings.criticalFindingsExpected, 1)
  assert.equal(result.findings.capturedMeaningfulFindings, 1)
  assert.equal(result.findings.missedFindingsCount, 1)
  assert.equal(result.findings.findingRecall, 0.5)
  assert.equal(result.findings.unsupportedClaimsCount, 1)
  assert.equal(result.findings.duplicateFindingsCount, 1)
  assert.equal(result.evidence.fidelity, 'Partial')
  assert.equal(result.knownUnknown.fidelity, 'Fail')
  assert.equal(result.humanReview.correctionBurden, 'High')
  assert.equal(result.latency.totalMs, 5000)
  assert.equal(result.cost.status, 'NOT MEASURED')
  assert.equal(result.finalAcceptance, 'Fail')
})

test('benchmark does not fabricate recall without human match or missed-finding data', () => {
  const truth = humanTruth({
    meaningfulFindingsExpected: [
      {
        truthId: 'T1',
        title: 'Expected roof issue',
        systemMatch: { status: 'not_reviewed', systemFindingIds: [] },
      },
    ],
    manualAssessment: {
      missedFindings: [],
      unsupportedClaims: [],
      duplicateFindings: [],
      incorrectClassifications: [],
      evidenceLinkageErrors: [],
      organizationErrors: [],
      knownUnknownErrors: [],
      evidenceFidelity: 'not_reviewed',
      knownUnknownFidelity: 'not_reviewed',
      organizationUsefulnessScore: null,
      humanCorrectionBurden: 'not_reviewed',
      finalAcceptance: 'needs_work',
    },
  })

  const result = evaluateInspectionBenchmarkCase({
    manifest: baseManifest(),
    truth,
    systemOutput: systemOutput(),
    caseDir: tempDir(),
  })

  assert.equal(result.findings.capturedMeaningfulFindings, null)
  assert.equal(result.findings.missedFindingsCount, null)
  assert.equal(result.findings.findingRecall, 'NOT MEASURED')
  assert.ok(result.warnings.some((warning) => /Finding recall is not measured/i.test(warning)))
  assert.equal(result.finalAcceptance, 'Needs Work')
})

test('missing system output fails the benchmark instead of claiming pipeline success', () => {
  const result = evaluateInspectionBenchmarkCase({
    manifest: baseManifest(),
    truth: humanTruth(),
    systemOutput: null,
    caseDir: tempDir(),
  })

  assert.equal(result.extraction.extractionCompleteness, 'Fail')
  assert.equal(result.findings.systemFindingsProduced, 0)
  assert.equal(result.finalAcceptance, 'Fail')
  assert.ok(result.warnings.some((warning) => /No system-output\.json/i.test(warning)))
})

test('system-declared extraction pass does not override missing page extraction evidence', () => {
  const output = systemOutput()
  output.extraction = {
    status: 'pass',
    pages: [],
    failedPages: [],
  }

  const result = evaluateInspectionBenchmarkCase({
    manifest: baseManifest(),
    truth: humanTruth({
      manualAssessment: {
        ...humanTruth().manualAssessment,
        finalAcceptance: 'needs_work',
      },
    }),
    systemOutput: output,
    caseDir: tempDir(),
  })

  assert.equal(result.extraction.extractionCompleteness, 'NOT MEASURED')
  assert.equal(result.finalAcceptance, 'Needs Work')
})

test('init-case writes reviewable skeletons without copying the real report', () => {
  const dir = tempDir()
  const reportPath = join(dir, 'private.pdf')
  writeFileSync(reportPath, 'not a real pdf for this unit test')

  const created = initCase({
    'cases-dir': join(dir, 'cases'),
    'report-id': 'founder-real-report',
    'report-path': reportPath,
    characteristics: 'real_report,photo_heavy',
  })

  assert.ok(existsSync(created.manifestPath))
  assert.ok(existsSync(created.truthPath))
  assert.ok(existsSync(created.systemOutputPath))

  const loaded = loadBenchmarkCase(created.caseDir)
  assert.equal(loaded.manifest.reportId, 'founder-real-report')
  assert.equal(loaded.truth.truthStatus, 'draft')
  assert.equal(loaded.systemOutput.pipeline.name, 'current-shelter-prep-inspection-pipeline')

  rmSync(dir, { recursive: true, force: true })
})

test('runBenchmark persists per-report and aggregate result artifacts', () => {
  const dir = tempDir()
  const casesDir = join(dir, 'cases')
  const caseDir = join(casesDir, 'synthetic-unit-case')
  mkdirSync(caseDir, { recursive: true })

  writeFileSync(join(caseDir, 'manifest.json'), `${JSON.stringify(baseManifest(), null, 2)}\n`)
  writeFileSync(join(caseDir, 'expected-truth.json'), `${JSON.stringify(humanTruth(), null, 2)}\n`)
  writeFileSync(join(caseDir, 'system-output.json'), `${JSON.stringify(systemOutput(), null, 2)}\n`)

  const outputDir = join(dir, 'runs', 'unit-run')
  const run = runBenchmark({
    all: true,
    'cases-dir': casesDir,
    'output-dir': outputDir,
    'run-id': 'unit-run',
  })

  assert.equal(run.results.length, 1)
  assert.ok(existsSync(join(outputDir, 'synthetic-unit-case.result.json')))
  assert.ok(existsSync(join(outputDir, 'aggregate.result.json')))

  rmSync(dir, { recursive: true, force: true })
})
