#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const CASE_SCHEMA_VERSION = 'inspection-benchmark-case.v1'
export const TRUTH_SCHEMA_VERSION = 'inspection-benchmark-truth.v1'
export const SYSTEM_OUTPUT_SCHEMA_VERSION = 'inspection-benchmark-system-output.v1'
export const RESULT_SCHEMA_VERSION = 'inspection-benchmark-result.v1'

const DEFAULT_BENCHMARK_DIR = 'benchmarks/inspection-reports'
const DEFAULT_CASES_DIR = `${DEFAULT_BENCHMARK_DIR}/cases`
const DEFAULT_RUNS_DIR = `${DEFAULT_BENCHMARK_DIR}/runs`

const PASS = 'Pass'
const PARTIAL = 'Partial'
const FAIL = 'Fail'
const NEEDS_WORK = 'Needs Work'
const NOT_REVIEWED = 'Not Reviewed'
const NOT_MEASURED = 'NOT MEASURED'
const NOT_SUPPORTED = 'Not Supported'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function text(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ''))]
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`Could not read JSON at ${path}: ${error.message}`)
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function resolveFrom(baseDir, path) {
  if (!path) return null
  return isAbsolute(path) ? path : resolve(baseDir, path)
}

function parseArgs(argv) {
  const parsed = { _: [] }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      parsed._.push(token)
      continue
    }

    const key = token.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      parsed[key] = true
      continue
    }

    parsed[key] = next
    index += 1
  }

  return parsed
}

function runId(value = new Date().toISOString()) {
  return value.replace(/[:.]/g, '-')
}

export function inspectPdfWithPdfinfo(pdfPath) {
  if (!pdfPath) {
    return { status: 'not_provided', pageCount: null, sizeBytes: null, error: null }
  }

  if (!existsSync(pdfPath)) {
    return { status: 'not_found', pageCount: null, sizeBytes: null, error: `PDF not found at ${pdfPath}` }
  }

  const sizeBytes = statSync(pdfPath).size
  const result = spawnSync('pdfinfo', [pdfPath], { encoding: 'utf8' })

  if (result.error?.code === 'ENOENT') {
    return { status: 'not_available', pageCount: null, sizeBytes, error: 'pdfinfo is not available on PATH.' }
  }

  if (result.error) {
    return { status: 'failed', pageCount: null, sizeBytes, error: result.error.message }
  }

  if (result.status !== 0) {
    const error = text(result.stderr) || text(result.stdout) || `pdfinfo exited with status ${result.status}`
    return { status: 'failed', pageCount: null, sizeBytes, error }
  }

  const match = result.stdout.match(/^Pages:\s+(\d+)\s*$/m)
  if (!match) {
    return { status: 'unknown', pageCount: null, sizeBytes, error: 'pdfinfo did not report a page count.' }
  }

  return { status: 'measured', pageCount: Number(match[1]), sizeBytes, error: null }
}

function normalizePassPartialFail(value) {
  const raw = text(value).toLowerCase().replace(/[_-]/g, ' ')
  if (raw === 'pass' || raw === 'passed' || raw === 'complete') return PASS
  if (raw === 'partial' || raw === 'partially supported' || raw === 'needs work') return PARTIAL
  if (raw === 'fail' || raw === 'failed') return FAIL
  if (raw === 'not supported') return NOT_SUPPORTED
  if (raw === 'not measured') return NOT_MEASURED
  return NOT_REVIEWED
}

function normalizeFinalAcceptance(value) {
  const raw = text(value).toLowerCase().replace(/[_-]/g, ' ')
  if (raw === 'pass' || raw === 'passed') return PASS
  if (raw === 'needs work' || raw === 'partial' || raw === 'needs review') return NEEDS_WORK
  if (raw === 'fail' || raw === 'failed') return FAIL
  return null
}

function normalizeBurden(value) {
  const raw = text(value).toLowerCase().replace(/[_-]/g, ' ')
  if (raw === 'low') return 'Low'
  if (raw === 'medium') return 'Medium'
  if (raw === 'high') return 'High'
  return NOT_REVIEWED
}

function normalizeFindingMatchStatus(value) {
  const raw = text(value).toLowerCase().replace(/[_-]/g, ' ')
  if (raw === 'captured' || raw === 'matched' || raw === 'found') return 'captured'
  if (raw === 'partial' || raw === 'partially captured') return 'partial'
  if (raw === 'missed' || raw === 'not captured') return 'missed'
  return 'not_reviewed'
}

function listCorrectionItems(truth, key) {
  return asArray(truth?.manualAssessment?.[key] ?? truth?.reviewCorrections?.[key])
}

function correctionTruthIds(items) {
  return unique(items.map((item) => {
    if (typeof item === 'string') return item
    return text(item?.truthId ?? item?.expectedFindingId ?? item?.id)
  }))
}

function normalizeExpectedFindings(truth) {
  return asArray(truth?.meaningfulFindingsExpected ?? truth?.expectedFindings).map((finding, index) => {
    const truthId = text(finding.truthId ?? finding.id ?? `T${index + 1}`)
    const matchedIds = asArray(
      finding.systemMatch?.systemFindingIds ??
        finding.matchedSystemFindingIds ??
        finding.systemFindingIds ??
        finding.capturedBy
    ).map(text)

    return {
      truthId,
      title: text(finding.title ?? finding.finding ?? `Expected finding ${index + 1}`),
      critical: Boolean(finding.critical) || text(finding.severity).toLowerCase() === 'critical',
      expectedPages: asArray(finding.expectedPages ?? finding.pages).map(numberOrNull).filter((value) => value !== null),
      matchedSystemFindingIds: matchedIds,
      matchStatus: normalizeFindingMatchStatus(finding.systemMatch?.status ?? finding.matchStatus ?? finding.status),
    }
  })
}

function normalizeSystemFindings(systemOutput) {
  if (!systemOutput) return []

  const candidates = [
    systemOutput.findings,
    systemOutput.repairItems,
    systemOutput.repair_items,
    systemOutput.items,
    systemOutput.sellerPrepItems,
    systemOutput.seller_prep_items,
    systemOutput.sellerPrepReview?.items,
    systemOutput.analysis?.items,
    systemOutput.output?.findings,
    systemOutput.output?.repairItems,
    systemOutput.output?.items,
  ].find((value) => Array.isArray(value))

  return asArray(candidates).map((finding, index) => {
    const findingId = text(
      finding.findingId ??
        finding.finding_id ??
        finding.id ??
        finding.repair_item_id ??
        finding.item_id ??
        `S${index + 1}`
    )
    const evidenceRefs = asArray(
      finding.evidenceRefs ??
        finding.evidence_refs ??
        finding.evidence_ids ??
        finding.evidence_references ??
        finding.source_reference_ids
    ).map(text)
    const sourcePage = numberOrNull(
      finding.sourcePage ??
        finding.source_page ??
        finding.page ??
        finding.pageNumber ??
        finding.page_number
    )
    const sourceExcerpt = text(
      finding.sourceExcerpt ??
        finding.source_excerpt ??
        finding.source_text ??
        finding.original_report_excerpt ??
        finding.excerpt
    )
    const sourceDocument = text(
      finding.sourceDocument ??
        finding.source_document ??
        finding.source_file_id ??
        finding.file_id
    )

    return {
      findingId,
      title: text(finding.title ?? finding.repair_item ?? finding.item_name ?? finding.description ?? `System finding ${index + 1}`),
      tradeCategory: text(finding.tradeCategory ?? finding.trade_category ?? finding.trade),
      systemCategory: text(finding.systemCategory ?? finding.system_category ?? finding.category),
      sourcePage,
      sourceExcerpt,
      sourceDocument,
      evidenceRefs,
      known: asArray(finding.known ?? finding.known_facts).map(text),
      unknown: asArray(finding.unknown ?? finding.unknowns ?? finding.missing_info).map(text),
      reviewStatus: text(finding.reviewStatus ?? finding.review_status ?? finding.status),
      hasEvidenceLink: Boolean(sourcePage || sourceExcerpt || sourceDocument || evidenceRefs.length),
    }
  })
}

function normalizeExtractedPages(systemOutput) {
  if (!systemOutput) return []

  const extraction = systemOutput.extraction ?? systemOutput.output?.extraction ?? {}
  const candidates = [
    extraction.extractedPages,
    extraction.pages,
    systemOutput.extractedPages,
    systemOutput.pages,
    systemOutput.output?.pages,
  ].find((value) => Array.isArray(value))

  return asArray(candidates).map((page, index) => {
    const pageNumber = numberOrNull(page.page ?? page.pageNumber ?? page.page_number) ?? index + 1
    const pageText = typeof page.text === 'string' ? page.text : ''
    const charCount = numberOrNull(
      page.charCount ??
        page.textLength ??
        page.extractedCharacterCount ??
        page.extracted_character_count
    ) ?? pageText.length
    const explicitStatus = text(page.status ?? page.extraction_status).toLowerCase().replace(/[_-]/g, ' ')
    const status = explicitStatus || (page.error ? 'failed' : charCount > 0 ? 'extracted' : 'empty')

    return {
      page: pageNumber,
      status,
      charCount,
      error: text(page.error),
    }
  })
}

function numberFromAny(...values) {
  for (const value of values) {
    const number = numberOrNull(value)
    if (number !== null) return number
  }
  return null
}

function normalizeExtractionMetrics({ manifest, truth, systemOutput, pdfInfo }) {
  const extraction = systemOutput?.extraction ?? systemOutput?.output?.extraction ?? {}
  const evidenceSource = asArray(systemOutput?.evidenceSources ?? systemOutput?.output?.evidenceSources)[0] ?? {}
  const extractedPages = normalizeExtractedPages(systemOutput)

  const expectedPages = numberOrNull(truth?.expectedPageCount)
  const hasExtractedPageEvidence = Boolean(
    extractedPages.length > 0 ||
      numberOrNull(extraction.pagesSuccessfullyExtracted) !== null ||
      numberOrNull(extraction.extractedPageCount) !== null ||
      numberOrNull(extraction.extracted_page_count) !== null ||
      numberOrNull(extraction.processedPageCount) !== null ||
      numberOrNull(extraction.processed_page_count) !== null ||
      numberOrNull(evidenceSource.processed_page_count) !== null
  )
  const reportedSourcePages = numberFromAny(
    extraction.pageCount,
    extraction.page_count,
    systemOutput?.sourceDocument?.pageCount,
    systemOutput?.source_document?.page_count,
    evidenceSource.page_count
  )
  const pagesSuccessfullyExtracted = numberFromAny(
    extraction.pagesSuccessfullyExtracted,
    extraction.extractedPageCount,
    extraction.extracted_page_count,
    extraction.processedPageCount,
    extraction.processed_page_count,
    evidenceSource.processed_page_count
  ) ?? extractedPages.filter((page) => ['extracted', 'complete', 'success'].includes(page.status) && page.charCount > 0).length

  const failedPageList = asArray(extraction.failedPages ?? extraction.failed_pages).map(numberOrNull).filter((value) => value !== null)
  const failedPages = numberFromAny(extraction.failedPageCount, extraction.failed_page_count, evidenceSource.parser_error_count) ?? failedPageList.length

  const contentExpectedPages = asArray(
    truth?.pagesExpectedToHaveContent ?? truth?.extractionExpectations?.pagesExpectedToHaveContent
  ).map(numberOrNull).filter((value) => value !== null)
  const emptyPagesWhereContentExpected = numberFromAny(
    extraction.emptyPagesWhereContentExpected,
    extraction.empty_pages_where_content_expected
  ) ?? (
    contentExpectedPages.length
      ? extractedPages.filter((page) => contentExpectedPages.includes(page.page) && ['empty', 'blank'].includes(page.status)).length
      : null
  )

  const textCharacterCount = numberFromAny(
    extraction.textCharacterCount,
    extraction.textSize,
    extraction.extractedCharacterCount,
    extraction.extracted_character_count,
    evidenceSource.extracted_character_count
  ) ?? extractedPages.reduce((sum, page) => sum + page.charCount, 0)

  const explicitStatus = normalizePassPartialFail(
    extraction.extractionCompleteness ??
      extraction.completenessStatus ??
      extraction.status ??
      evidenceSource.extraction_status
  )

  let completeness = explicitStatus === NOT_REVIEWED ? null : explicitStatus
  if (!systemOutput) {
    completeness = FAIL
  } else if (!completeness && expectedPages !== null) {
    completeness = NOT_MEASURED
  }

  if (systemOutput && expectedPages !== null) {
    let expectedPageGate = NOT_MEASURED
    if (hasExtractedPageEvidence) {
      if (pagesSuccessfullyExtracted >= expectedPages && failedPages === 0 && (emptyPagesWhereContentExpected ?? 0) === 0) {
        expectedPageGate = PASS
      } else if (pagesSuccessfullyExtracted > 0) {
        expectedPageGate = PARTIAL
      } else {
        expectedPageGate = FAIL
      }
    }

    if (explicitStatus === FAIL || expectedPageGate === FAIL) {
      completeness = FAIL
    } else if (explicitStatus === PARTIAL || expectedPageGate === PARTIAL) {
      completeness = PARTIAL
    } else {
      completeness = expectedPageGate
    }
  } else if (!completeness) {
    completeness = pagesSuccessfullyExtracted > 0 ? PARTIAL : NOT_MEASURED
  }

  const warnings = []
  if (!systemOutput) warnings.push('No system-output.json was found for this case.')
  if (expectedPages !== null && pdfInfo.pageCount !== null && expectedPages !== pdfInfo.pageCount) {
    warnings.push(`Human expected page count ${expectedPages} does not match pdfinfo page count ${pdfInfo.pageCount}.`)
  }
  if (expectedPages !== null && reportedSourcePages !== null && expectedPages !== reportedSourcePages) {
    warnings.push(`Human expected page count ${expectedPages} does not match system-reported page count ${reportedSourcePages}.`)
  }
  if (manifest?.sourceDocument?.documentType !== 'real_inspection_report') {
    warnings.push('Case is not marked as a real inspection report.')
  }

  return {
    expectedPages,
    actualPdfPageCount: pdfInfo.pageCount,
    systemReportedPageCount: reportedSourcePages,
    pagesSuccessfullyExtracted,
    failedPages,
    failedPageList,
    emptyPagesWhereContentExpected,
    textCharacterCount,
    extractionCompleteness: completeness,
    pdfInfo,
    warnings,
  }
}

function evaluateFindingMetrics(truth, systemFindings) {
  const expectedFindings = normalizeExpectedFindings(truth)
  const missedCorrections = listCorrectionItems(truth, 'missedFindings')
  const missedTruthIds = correctionTruthIds(missedCorrections)
  const hasReviewedMatches =
    expectedFindings.some((finding) => finding.matchStatus !== 'not_reviewed' || finding.matchedSystemFindingIds.length > 0) ||
    missedCorrections.length > 0

  let capturedMeaningfulFindings = null
  let partialMeaningfulFindings = null
  let missedFindingsCount = null
  let findingRecall = NOT_MEASURED

  if (hasReviewedMatches) {
    const missedIdsFromStatus = expectedFindings
      .filter((finding) => finding.matchStatus === 'missed')
      .map((finding) => finding.truthId)
    const combinedMissedIds = unique([...missedTruthIds, ...missedIdsFromStatus])

    partialMeaningfulFindings = expectedFindings.filter((finding) => finding.matchStatus === 'partial').length
    capturedMeaningfulFindings = expectedFindings.filter((finding) =>
      finding.matchStatus === 'captured' || finding.matchedSystemFindingIds.length > 0
    ).length
    missedFindingsCount = combinedMissedIds.length

    if (capturedMeaningfulFindings + partialMeaningfulFindings + missedFindingsCount === 0 && expectedFindings.length > 0) {
      missedFindingsCount = expectedFindings.length
    }

    if (expectedFindings.length > 0) {
      findingRecall = Math.round((capturedMeaningfulFindings / expectedFindings.length) * 1000) / 1000
    } else {
      findingRecall = 'N/A'
    }
  }

  const unsupportedClaims = listCorrectionItems(truth, 'unsupportedClaims')
  const duplicateFindings = listCorrectionItems(truth, 'duplicateFindings')
  const incorrectClassifications = listCorrectionItems(truth, 'incorrectClassifications')
  const evidenceLinkageErrors = listCorrectionItems(truth, 'evidenceLinkageErrors')
  const organizationErrors = listCorrectionItems(truth, 'organizationErrors')
  const knownUnknownErrors = listCorrectionItems(truth, 'knownUnknownErrors')
  const systemFindingsWithoutEvidence = systemFindings.filter((finding) => !finding.hasEvidenceLink)

  return {
    expectedMeaningfulFindings: expectedFindings.length,
    criticalFindingsExpected: expectedFindings.filter((finding) => finding.critical).length,
    systemFindingsProduced: systemFindings.length,
    capturedMeaningfulFindings,
    partialMeaningfulFindings,
    missedFindingsCount,
    findingRecall,
    unsupportedClaimsCount: unsupportedClaims.length,
    duplicateFindingsCount: duplicateFindings.length,
    incorrectClassificationCount: incorrectClassifications.length,
    evidenceLinkageErrorCount: evidenceLinkageErrors.length,
    organizationErrorCount: organizationErrors.length,
    knownUnknownErrorCount: knownUnknownErrors.length,
    systemFindingsWithoutEvidenceCount: systemFindingsWithoutEvidence.length,
  }
}

function normalizeLatency(systemOutput) {
  const extraction = systemOutput?.extraction ?? systemOutput?.output?.extraction ?? {}
  const organization = systemOutput?.organization ?? systemOutput?.output?.organization ?? {}
  const pipeline = systemOutput?.pipeline ?? {}

  const extractionMs = numberFromAny(extraction.latencyMs, extraction.durationMs, extraction.processingTimeMs)
  const organizationMs = numberFromAny(organization.latencyMs, organization.durationMs, organization.processingTimeMs)
  let totalMs = numberFromAny(pipeline.totalLatencyMs, pipeline.totalDurationMs, systemOutput?.latencyMs, systemOutput?.durationMs)

  if (totalMs === null && pipeline.startedAt && pipeline.completedAt) {
    const started = Date.parse(pipeline.startedAt)
    const completed = Date.parse(pipeline.completedAt)
    if (Number.isFinite(started) && Number.isFinite(completed) && completed >= started) {
      totalMs = completed - started
    }
  }

  return {
    extractionMs: extractionMs ?? NOT_MEASURED,
    organizationMs: organizationMs ?? NOT_MEASURED,
    totalMs: totalMs ?? NOT_MEASURED,
  }
}

function normalizeCost(systemOutput) {
  const cost = systemOutput?.cost ?? systemOutput?.pipeline?.cost ?? systemOutput?.usage?.cost
  const amountUsd = numberFromAny(cost?.amountUsd, cost?.usd, cost?.totalUsd, systemOutput?.usage?.costUsd)

  if (amountUsd === null) {
    return {
      status: NOT_MEASURED,
      amountUsd: null,
      currency: 'USD',
      source: text(cost?.source),
    }
  }

  return {
    status: 'Measured',
    amountUsd,
    currency: text(cost?.currency) || 'USD',
    source: text(cost?.source),
  }
}

function qualityMetrics(truth, systemOutput, findingMetrics, systemFindings) {
  const manual = truth?.manualAssessment ?? truth?.reviewCorrections ?? {}
  const knownUnknownSupported = Boolean(
    systemOutput?.organization?.knownUnknownSupported ??
      systemOutput?.knownUnknownSupported ??
      systemFindings.some((finding) => finding.known.length > 0 || finding.unknown.length > 0)
  )

  let evidenceFidelity = normalizePassPartialFail(manual.evidenceFidelity)
  if (evidenceFidelity === NOT_REVIEWED && systemOutput) {
    if (findingMetrics.evidenceLinkageErrorCount > 0 || findingMetrics.unsupportedClaimsCount > 0) {
      evidenceFidelity = PARTIAL
    } else if (systemFindings.length > 0 && findingMetrics.systemFindingsWithoutEvidenceCount === 0) {
      evidenceFidelity = PASS
    }
  }

  let knownUnknownFidelity = normalizePassPartialFail(manual.knownUnknownFidelity)
  if (knownUnknownFidelity === NOT_REVIEWED && !knownUnknownSupported) {
    knownUnknownFidelity = NOT_SUPPORTED
  }

  const organizationUsefulnessScore = numberOrNull(manual.organizationUsefulnessScore)
  const boundedOrganizationScore =
    organizationUsefulnessScore !== null && organizationUsefulnessScore >= 1 && organizationUsefulnessScore <= 5
      ? organizationUsefulnessScore
      : null

  return {
    evidenceFidelity,
    knownUnknownSupported,
    knownUnknownFidelity,
    organizationUsefulnessScore: boundedOrganizationScore ?? NOT_REVIEWED,
    humanCorrectionBurden: normalizeBurden(manual.humanCorrectionBurden),
    reviewTimeMinutes: numberOrNull(manual.reviewTimeMinutes) ?? NOT_MEASURED,
    correctionCount: numberOrNull(manual.correctionCount) ?? NOT_MEASURED,
    reviewerNotes: text(manual.notes ?? truth?.notes),
  }
}

function deriveFinalAcceptance({ truth, systemOutput, extractionMetrics, findingMetrics, quality }) {
  const manualFinal = normalizeFinalAcceptance(truth?.manualAssessment?.finalAcceptance ?? truth?.finalAcceptance)
  if (manualFinal) return manualFinal

  const truthStatus = text(truth?.truthStatus ?? truth?.reviewStatus).toLowerCase().replace(/[_-]/g, ' ')
  const humanReviewed = truthStatus === 'human reviewed' || truthStatus === 'human verified'

  if (!systemOutput) return FAIL
  if (extractionMetrics.extractionCompleteness === FAIL) return FAIL
  if (quality.evidenceFidelity === FAIL || findingMetrics.unsupportedClaimsCount > 0) return FAIL
  if (!humanReviewed) return NEEDS_WORK
  if (
    extractionMetrics.extractionCompleteness !== PASS ||
    findingMetrics.findingRecall === NOT_MEASURED ||
    (findingMetrics.missedFindingsCount ?? 0) > 0 ||
    findingMetrics.duplicateFindingsCount > 0 ||
    findingMetrics.evidenceLinkageErrorCount > 0 ||
    findingMetrics.knownUnknownErrorCount > 0 ||
    quality.knownUnknownFidelity === FAIL ||
    quality.knownUnknownFidelity === PARTIAL ||
    (typeof quality.organizationUsefulnessScore === 'number' && quality.organizationUsefulnessScore < 3)
  ) {
    return NEEDS_WORK
  }

  return PASS
}

export function evaluateInspectionBenchmarkCase({ manifest, truth, systemOutput = null, caseDir, now = new Date() }) {
  const sourcePath = resolveFrom(caseDir, manifest?.sourceDocument?.path)
  const pdfInfo = inspectPdfWithPdfinfo(sourcePath)
  const systemFindings = normalizeSystemFindings(systemOutput)
  const extractionMetrics = normalizeExtractionMetrics({ manifest, truth, systemOutput, pdfInfo })
  const findingMetrics = evaluateFindingMetrics(truth, systemFindings)
  const quality = qualityMetrics(truth, systemOutput, findingMetrics, systemFindings)
  const latency = normalizeLatency(systemOutput)
  const cost = normalizeCost(systemOutput)
  const finalAcceptance = deriveFinalAcceptance({
    truth,
    systemOutput,
    extractionMetrics,
    findingMetrics,
    quality,
  })

  const warnings = [
    ...extractionMetrics.warnings,
    ...(findingMetrics.findingRecall === NOT_MEASURED ? ['Finding recall is not measured until human match/correction data is recorded.'] : []),
    ...(cost.status === NOT_MEASURED ? ['Processing cost is NOT MEASURED by the supplied system output.'] : []),
  ]

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    reportId: text(manifest.reportId ?? truth?.reportId),
    filename: text(manifest.filename ?? basename(sourcePath || '')),
    reportCharacteristics: asArray(manifest.reportCharacteristics ?? manifest.characteristics).map(text),
    sourceDocument: {
      path: manifest?.sourceDocument?.path ?? null,
      documentType: manifest?.sourceDocument?.documentType ?? null,
      containsPrivateData: Boolean(manifest?.sourceDocument?.containsPrivateData),
    },
    extraction: extractionMetrics,
    findings: findingMetrics,
    evidence: {
      fidelity: quality.evidenceFidelity,
      systemFindingsWithoutEvidenceCount: findingMetrics.systemFindingsWithoutEvidenceCount,
    },
    knownUnknown: {
      supportedByCurrentOutput: quality.knownUnknownSupported,
      fidelity: quality.knownUnknownFidelity,
    },
    organization: {
      usefulnessScore: quality.organizationUsefulnessScore,
      errorCount: findingMetrics.organizationErrorCount,
    },
    humanReview: {
      correctionBurden: quality.humanCorrectionBurden,
      reviewTimeMinutes: quality.reviewTimeMinutes,
      correctionCount: quality.correctionCount,
      notes: quality.reviewerNotes,
    },
    latency,
    cost,
    finalAcceptance,
    warnings,
  }
}

export function loadBenchmarkCase(caseDir) {
  const manifestPath = join(caseDir, 'manifest.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`No manifest.json found in ${caseDir}`)
  }

  const manifest = readJson(manifestPath)
  const truthPath = resolveFrom(caseDir, manifest.truthPath || 'expected-truth.json')
  if (!existsSync(truthPath)) {
    throw new Error(`No expected truth file found for ${manifest.reportId || caseDir}: ${truthPath}`)
  }

  const systemOutputPath = resolveFrom(caseDir, manifest.systemOutputPath || 'system-output.json')
  const systemOutput = systemOutputPath && existsSync(systemOutputPath) ? readJson(systemOutputPath) : null

  return {
    caseDir,
    manifest,
    truth: readJson(truthPath),
    systemOutput,
    paths: {
      manifestPath,
      truthPath,
      systemOutputPath,
    },
  }
}

export function findBenchmarkCaseDirs(casesDir = DEFAULT_CASES_DIR) {
  const resolvedCasesDir = resolve(casesDir)
  if (!existsSync(resolvedCasesDir)) return []

  return readdirSync(resolvedCasesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(resolvedCasesDir, entry.name))
    .filter((caseDir) => existsSync(join(caseDir, 'manifest.json')))
    .sort()
}

function resolveCaseDirs(args) {
  const casesDir = resolve(String(args['cases-dir'] || DEFAULT_CASES_DIR))
  if (args.all || !args.case) return findBenchmarkCaseDirs(casesDir)

  const requested = String(args.case)
  const direct = resolve(requested)
  if (existsSync(direct)) return [direct]
  return [join(casesDir, requested)]
}

function printCaseSummary(result, outputPath) {
  console.log(`\n${result.reportId || 'Unnamed report'}`)
  console.log(`  File: ${result.filename || 'Not set'}`)
  console.log(`  Extraction: ${result.extraction.extractionCompleteness}`)
  console.log(`  Pages: expected ${result.extraction.expectedPages ?? NOT_REVIEWED}, extracted ${result.extraction.pagesSuccessfullyExtracted}`)
  console.log(`  Findings: expected ${result.findings.expectedMeaningfulFindings}, captured ${result.findings.capturedMeaningfulFindings ?? NOT_MEASURED}, missed ${result.findings.missedFindingsCount ?? NOT_MEASURED}`)
  console.log(`  Unsupported claims: ${result.findings.unsupportedClaimsCount}`)
  console.log(`  Evidence fidelity: ${result.evidence.fidelity}`)
  console.log(`  Known/Unknown fidelity: ${result.knownUnknown.fidelity}`)
  console.log(`  Correction burden: ${result.humanReview.correctionBurden}`)
  console.log(`  Final acceptance: ${result.finalAcceptance}`)
  if (outputPath) console.log(`  Result: ${outputPath}`)
  for (const warning of result.warnings) console.log(`  Warning: ${warning}`)
}

export function runBenchmark(args = {}) {
  const selectedCaseDirs = resolveCaseDirs(args)
  const id = runId(String(args['run-id'] || new Date().toISOString()))
  const outputDir = resolve(String(args['output-dir'] || join(DEFAULT_RUNS_DIR, id)))

  if (selectedCaseDirs.length === 0) {
    console.log('No inspection benchmark cases found.')
    console.log(`Add a case under ${DEFAULT_CASES_DIR}/<report-id>/, or run npm run benchmark:inspection:init -- --report-id <id> --report-path <pdf>.`)
    return { runId: id, outputDir, results: [] }
  }

  const results = []
  for (const caseDir of selectedCaseDirs) {
    const loaded = loadBenchmarkCase(caseDir)
    const result = evaluateInspectionBenchmarkCase({
      manifest: loaded.manifest,
      truth: loaded.truth,
      systemOutput: loaded.systemOutput,
      caseDir,
    })
    const outputPath = join(outputDir, `${result.reportId || basename(caseDir)}.result.json`)
    writeJson(outputPath, result)
    printCaseSummary(result, outputPath)
    results.push({ caseDir, outputPath, result })
  }

  const aggregate = {
    schemaVersion: 'inspection-benchmark-run.v1',
    runId: id,
    generatedAt: new Date().toISOString(),
    resultCount: results.length,
    reportIds: results.map((entry) => entry.result.reportId),
    finalAcceptanceCounts: results.reduce((counts, entry) => {
      counts[entry.result.finalAcceptance] = (counts[entry.result.finalAcceptance] || 0) + 1
      return counts
    }, {}),
    results: results.map((entry) => ({
      reportId: entry.result.reportId,
      filename: entry.result.filename,
      extractionCompleteness: entry.result.extraction.extractionCompleteness,
      findingRecall: entry.result.findings.findingRecall,
      unsupportedClaimsCount: entry.result.findings.unsupportedClaimsCount,
      evidenceFidelity: entry.result.evidence.fidelity,
      knownUnknownFidelity: entry.result.knownUnknown.fidelity,
      organizationUsefulnessScore: entry.result.organization.usefulnessScore,
      humanCorrectionBurden: entry.result.humanReview.correctionBurden,
      finalAcceptance: entry.result.finalAcceptance,
      outputPath: relative(process.cwd(), entry.outputPath),
    })),
  }
  writeJson(join(outputDir, 'aggregate.result.json'), aggregate)

  return { runId: id, outputDir, results, aggregate }
}

function createSkeletonTruth(reportId) {
  return {
    schemaVersion: TRUTH_SCHEMA_VERSION,
    reportId,
    truthStatus: 'draft',
    reviewer: '',
    reviewedAt: null,
    expectedPageCount: null,
    pagesExpectedToHaveContent: [],
    meaningfulFindingsExpected: [
      {
        truthId: 'T1',
        title: '',
        critical: false,
        expectedPages: [],
        expectedEvidence: [
          {
            sourceDocument: '',
            page: null,
            excerpt: '',
          },
        ],
        tradeCategory: '',
        systemCategory: '',
        known: [],
        unknown: [],
        systemMatch: {
          status: 'not_reviewed',
          systemFindingIds: [],
          notes: '',
        },
        notes: '',
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
      reviewTimeMinutes: null,
      correctionCount: null,
      finalAcceptance: 'needs_work',
      notes: '',
    },
  }
}

function createSkeletonSystemOutput(reportId, filename) {
  return {
    schemaVersion: SYSTEM_OUTPUT_SCHEMA_VERSION,
    reportId,
    pipeline: {
      name: 'current-shelter-prep-inspection-pipeline',
      runId: '',
      startedAt: null,
      completedAt: null,
      notes: 'Paste or export the current Shelter Prep system output here. Do not use this file as ground truth.',
    },
    sourceDocument: {
      filename,
      pageCount: null,
    },
    extraction: {
      status: 'not_measured',
      pages: [],
      failedPages: [],
      emptyPagesWhereContentExpected: null,
      textCharacterCount: null,
      latencyMs: null,
    },
    findings: [],
    organization: {
      groups: [],
      knownUnknownSupported: false,
      latencyMs: null,
    },
    cost: {
      status: NOT_MEASURED,
      amountUsd: null,
      currency: 'USD',
      source: '',
    },
  }
}

function createManifest({ reportId, reportPath, characteristics }) {
  const filename = reportPath ? basename(reportPath) : ''
  return {
    schemaVersion: CASE_SCHEMA_VERSION,
    reportId,
    filename,
    reportCharacteristics: characteristics,
    sourceDocument: {
      path: reportPath,
      documentType: 'real_inspection_report',
      containsPrivateData: true,
    },
    truthPath: 'expected-truth.json',
    systemOutputPath: 'system-output.json',
    notes: 'Real reports and run outputs are ignored by Git by default. Keep human-reviewed truth local unless sanitized for sharing.',
  }
}

export function initCase(args = {}) {
  const reportId = text(args['report-id'])
  if (!reportId) throw new Error('init-case requires --report-id <id>.')

  const casesDir = resolve(String(args['cases-dir'] || DEFAULT_CASES_DIR))
  const benchmarkDir = resolve(String(args['benchmark-dir'] || dirname(casesDir)))
  const caseDir = join(casesDir, reportId)
  mkdirSync(caseDir, { recursive: true })

  const rawReportPath = text(args['report-path'])
  const absReportPath = rawReportPath ? resolve(rawReportPath) : ''
  const defaultPrivateReportPath = join(benchmarkDir, 'private-reports', reportId, 'inspection-report.pdf')
  const reportPathForManifest = absReportPath ? relative(caseDir, absReportPath) : relative(caseDir, defaultPrivateReportPath)
  const characteristics = text(args.characteristics)
    ? text(args.characteristics).split(',').map((item) => item.trim()).filter(Boolean)
    : ['real_report']

  const manifestPath = join(caseDir, 'manifest.json')
  const truthPath = join(caseDir, 'expected-truth.json')
  const systemOutputPath = join(caseDir, 'system-output.json')
  const force = Boolean(args.force)

  for (const path of [manifestPath, truthPath, systemOutputPath]) {
    if (existsSync(path) && !force) {
      throw new Error(`${path} already exists. Use --force to overwrite the case skeleton.`)
    }
  }

  const manifest = createManifest({
    reportId,
    reportPath: reportPathForManifest,
    characteristics,
  })

  writeJson(manifestPath, manifest)
  writeJson(truthPath, createSkeletonTruth(reportId))
  writeJson(systemOutputPath, createSkeletonSystemOutput(reportId, basename(reportPathForManifest)))

  const privateDir = join(benchmarkDir, 'private-reports', reportId)
  mkdirSync(privateDir, { recursive: true })

  console.log(`Created benchmark case: ${caseDir}`)
  console.log(`Put the real report at: ${resolveFrom(caseDir, reportPathForManifest)}`)
  console.log('Then fill expected-truth.json from human review and system-output.json from the current Shelter Prep pipeline output.')

  return { caseDir, manifestPath, truthPath, systemOutputPath }
}

function help() {
  console.log(`Shelter Prep inspection report capability benchmark

Commands:
  run --all
  run --case <report-id-or-case-dir>
  init-case --report-id <id> [--report-path <pdf>] [--characteristics short_report,photo_heavy]

Default folders:
  cases: ${DEFAULT_CASES_DIR}
  runs:  ${DEFAULT_RUNS_DIR}
`)
}

function main(argv) {
  const [command = 'help', ...rest] = argv
  const args = parseArgs(rest)

  if (command === 'run') {
    runBenchmark(args)
    return
  }

  if (command === 'init-case') {
    initCase(args)
    return
  }

  help()
}

const thisFile = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === thisFile) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
