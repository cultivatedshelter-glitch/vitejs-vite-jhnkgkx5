export type EvidenceLike = {
  id?: string | null
  name?: string | null
  path?: string | null
  bucket?: string | null
  sizeBytes?: number | null
  mimeType?: string | null
  contentSha256?: string | null
}

export type ExtractionCompleteness = 'complete' | 'partial' | 'failed'

export type EvidenceProcessingSummary = {
  file_id: string | null
  file_name: string
  upload_status: 'uploaded'
  retrieval_status: 'retrieved' | 'failed'
  extraction_status: ExtractionCompleteness
  bytes_read: number
  total_bytes: number
  page_count: number | null
  processed_page_count: number
  page_representation_count: number
  attempted_all_pages: boolean
  parser_error_count: number
  extraction_terminated_early: boolean
  extracted_character_count: number
  warning: string | null
}

export type PdfProcessingCoverage = {
  pageCount: number | null
  processedPageCount: number
  pageRepresentationCount: number
  attemptedAllPages: boolean
  parserErrorCount: number
  extractionTerminatedEarly: boolean
}

function normalizedText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export function normalizeExactPropertyIdentity(address = '', city = '', state = '', zip = '') {
  const normalizedZip = normalizedText(zip).match(/\d{5}/)?.[0] || normalizedText(zip)
  return [address, city, state, normalizedZip]
    .map((value, index) => index === 2 ? normalizedText(value).toUpperCase() : normalizedText(value).toLowerCase())
    .filter(Boolean)
    .join('|')
}

export function evidenceIdentity(file: EvidenceLike) {
  if (file.contentSha256) return `sha256:${file.contentSha256.toLowerCase()}`
  if (file.id) return `id:${file.id}`
  if (file.path) return `${file.bucket || ''}:${file.path}`
  return `file:${normalizedText(file.name).toLowerCase()}:${file.sizeBytes ?? ''}:${normalizedText(file.mimeType).toLowerCase()}`
}

export function uniqueEligibleEvidence<T extends EvidenceLike>(files: T[]) {
  const seen = new Set<string>()
  return files.filter((file) => {
    const key = evidenceIdentity(file)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return Boolean(file.id || file.path || file.name)
  })
}

export async function sha256Hex(value: Blob | ArrayBuffer | string) {
  const bytes = typeof value === 'string'
    ? new TextEncoder().encode(value)
    : value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(await value.arrayBuffer())
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function requestSubmissionKey(params: {
  address: string
  city?: string
  state?: string
  zip?: string
  description?: string
  fileHashes?: string[]
}) {
  const payload = JSON.stringify({
    property: normalizeExactPropertyIdentity(params.address, params.city, params.state, params.zip),
    description: normalizedText(params.description).toLowerCase(),
    files: [...(params.fileHashes || [])].map((hash) => hash.toLowerCase()).sort(),
  })
  return sha256Hex(payload)
}

export function deterministicUuidFromHex(hex: string) {
  const clean = hex.toLowerCase().replace(/[^0-9a-f]/g, '').padEnd(32, '0').slice(0, 32).split('')
  clean[12] = '5'
  clean[16] = ((parseInt(clean[16], 16) & 0x3) | 0x8).toString(16)
  const value = clean.join('')
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

export async function deterministicProcessingId(parts: Array<string | number | null | undefined>) {
  return deterministicUuidFromHex(await sha256Hex(parts.map((part) => normalizedText(part)).join('|')))
}

export function extractPdfLiteralText(raw: string, maxCharacters = 200_000) {
  const literalStrings = Array.from(raw.matchAll(/\(([^()]{3,})\)/g)).map((match) => match[1]).join(' ')
  const arrayStrings = Array.from(raw.matchAll(/\[((?:\s*\([^()]{2,}\)\s*){2,})\]/g))
    .map((match) => Array.from(match[1].matchAll(/\(([^()]{2,})\)/g)).map((item) => item[1]).join(' '))
    .join(' ')
  return `${literalStrings} ${arrayStrings} ${raw}`
    .replace(/\u0000/g, ' ')
    .replace(/\\r|\\n|\\t|\r|\n|\t/g, ' ')
    .replace(/\\([()\\])/g, '$1')
    .replace(/[<>[\]{}]/g, ' ')
    .replace(/Tj|TJ|ET|BT|Td|Tm/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxCharacters)
}

export function estimatePdfPageCount(raw: string) {
  const matches = raw.match(/\/Type\s*\/Page\b/g)
  return matches?.length || null
}

export function inspectPdfProcessingCoverage(raw: string): PdfProcessingCoverage {
  const pageCount = estimatePdfPageCount(raw)
  const pageRepresentationCount = pageCount || 0

  return {
    pageCount,
    processedPageCount: pageRepresentationCount,
    pageRepresentationCount,
    attemptedAllPages: pageRepresentationCount > 0,
    parserErrorCount: 0,
    extractionTerminatedEarly: false,
  }
}

export function classifyPdfExtraction(params: {
  fileId?: string | null
  fileName: string
  bytesRead: number
  totalBytes: number
  pageCount?: number | null
  processedPageCount?: number
  pageRepresentationCount?: number
  attemptedAllPages?: boolean
  parserErrorCount?: number
  extractionTerminatedEarly?: boolean
  extractedText: string
  retrievalFailed?: boolean
}): EvidenceProcessingSummary {
  // Completeness describes document-processing coverage, not whether every finding was detected.
  const fullyRead = params.totalBytes > 0 && params.bytesRead === params.totalBytes
  const pageCount = params.pageCount && params.pageCount > 0 ? params.pageCount : null
  const processedPageCount = Math.max(0, params.processedPageCount || 0)
  const pageRepresentationCount = Math.max(0, params.pageRepresentationCount || 0)
  const attemptedAllPages = params.attemptedAllPages === true
  const parserErrorCount = Math.max(0, params.parserErrorCount || 0)
  const extractionTerminatedEarly = params.extractionTerminatedEarly === true
  const hasUsableEvidence = params.extractedText.trim().length >= 20 || pageRepresentationCount > 0
  const failed = Boolean(params.retrievalFailed) || !hasUsableEvidence
  const complete = !failed
    && fullyRead
    && pageCount !== null
    && attemptedAllPages
    && processedPageCount === pageCount
    && pageRepresentationCount === pageCount
    && parserErrorCount === 0
    && !extractionTerminatedEarly
  const extractionStatus: ExtractionCompleteness = failed ? 'failed' : complete ? 'complete' : 'partial'
  const partialReasons = [
    !fullyRead ? 'the complete file payload was not read' : '',
    pageCount === null ? 'the PDF page count could not be established' : '',
    pageCount !== null && !attemptedAllPages ? 'not every detected page was attempted' : '',
    pageCount !== null && processedPageCount !== pageCount
      ? `${processedPageCount} of ${pageCount} pages were processed`
      : '',
    pageCount !== null && pageRepresentationCount !== pageCount
      ? `${pageRepresentationCount} of ${pageCount} page representations were available`
      : '',
    parserErrorCount > 0 ? `${parserErrorCount} parser or extraction error${parserErrorCount === 1 ? '' : 's'} remain` : '',
    extractionTerminatedEarly ? 'extraction terminated early' : '',
  ].filter(Boolean)
  const warning = failed
    ? 'The PDF could not be retrieved or parsed sufficiently to produce usable evidence.'
    : extractionStatus === 'partial'
      ? `PDF processing was partial: ${partialReasons.join('; ')}.`
      : null

  return {
    file_id: params.fileId || null,
    file_name: params.fileName,
    upload_status: 'uploaded',
    retrieval_status: params.retrievalFailed ? 'failed' : 'retrieved',
    extraction_status: extractionStatus,
    bytes_read: params.bytesRead,
    total_bytes: params.totalBytes,
    page_count: pageCount,
    processed_page_count: processedPageCount,
    page_representation_count: pageRepresentationCount,
    attempted_all_pages: attemptedAllPages,
    parser_error_count: parserErrorCount,
    extraction_terminated_early: extractionTerminatedEarly,
    extracted_character_count: params.extractedText.length,
    warning,
  }
}
