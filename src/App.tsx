import React, { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase, supabaseAnonKey, supabaseUrl } from './supabase'
import Gallery from './components/Gallery'
import HistoricalUpload from './components/historical/HistoricalUpload'
import { emptyPropertyFacts, lookupPropertyFacts, type PropertyFacts, type PropertyLookupStatus } from './propertyLookup'
import { buildPropertyResearchPack } from './propertyIntelligence'
import {
  buildEstimateIntelligence,
  type EstimateIntelligenceResult,
} from './estimateIntelligence'

type RequestStatus = 'new' | 'needs_info' | 'estimate_ready' | 'pending_approval'

type Tab = 'new' | 'gallery' | 'intake' | 'messages' | 'dashboard' | 'archived' | 'invoices' | 'history' | 'sellerPrep' | 'pricingMemory' | 'materials' | 'labor' | 'estimates'

type StoredFile = {
  id?: string
  name: string
  path: string
  url?: string
  bucket?: string
  type: 'photo' | 'document'
}

type AiEstimate = {
  projectSummary?: string
  lowPrice?: number
  standardPrice?: number
  premiumPrice?: number
  pricingRationale?: string
}

type WorkRequest = {
  id: string
  createdAt: string
  requesterName: string
  email: string
  phone: string
  workType: string
  propertyAddress: string
  city: string
  state: string
  zip: string
  urgency: string
  occupancy: string
  timeline: string
  propertyFacts?: PropertyFacts
  description: string
  photos: StoredFile[]
  documents: StoredFile[]
  status: RequestStatus
  archived?: boolean
  archivedAt?: string
  archiveReason?: string
  aiEstimate?: AiEstimate
}

type IntakeDraft = {
  requesterName?: string
  email?: string
  phone?: string
  workType?: string
  propertyAddress?: string
  city?: string
  state?: string
  zip?: string
  urgency?: string
  occupancy?: string
  timeline?: string
  description?: string
  missingInfo?: string[]
  suggestedReply?: string
  confidence?: string
  notes?: string
}

type Invoice = {
  id: string
  created_at: string
  file_name: string
  file_url: string
  storage_path: string
  vendor_name: string | null
  invoice_number?: string | null
  invoice_date?: string | null
  property_address: string | null
  extraction_status: string | null
  extraction_error?: string | null
  subtotal?: number | null
  tax?: number | null
  total: number | null
}

type InvoiceCostAnalysis = {
  id: string
  created_at: string
  invoice_id: string
  risk_level: 'low' | 'medium' | 'high' | string | null
  summary: string | null
  client_summary: string | null
  overcharge_flags: any[] | null
  scope_gaps: any[] | null
  pricing_risks: any[] | null
  recommended_actions: string[] | null
}

type MaterialCost = {
  id: string
  created_at?: string | null
  updated_at: string | null

  item_name?: string | null
  material_name?: string | null
  normalized_name?: string | null
  category: string | null
  unit: string | null

  low_price?: number | null
  typical_price?: number | null
  high_price?: number | null
  current_price?: number | null
  previous_price?: number | null
  percent_change?: number | null

  source: string | null
  source_url?: string | null
  store_name?: string | null
  zip?: string | null
  region?: string | null

  confidence?: string | null
  human_verified?: boolean | null
  last_checked?: string | null
  notes?: string | null
}

type MaterialEditorDraft = {
  name: string
  unit: string
  typicalPrice: string
  lowPrice: string
  highPrice: string
  category: string
  zip: string
  source: string
}

type SellerPrepAnalysisV1 = {
  id: string
  lead_id?: string | null
  property_address: string | null
  summary: string | null
  total_low_estimate: number | null
  total_high_estimate: number | null
  seller_net_impact: string | null
  confidence: string | null
  human_review_status: string
  created_at?: string | null
  updated_at?: string | null
}

type SellerPrepItemV1 = {
  id: string
  analysis_id: string
  repair_item: string
  trade_category: string | null
  estimated_low: number | null
  estimated_high: number | null
  buyer_impact_score: number | null
  inspection_risk_score: number | null
  recommendation: string | null
  missing_info: string | null
  ai_notes: string | null
  human_review_status: string
  created_at?: string | null
}

type PricingMemoryEntry = {
  id: string
  created_at?: string | null
  item_name: string | null
  category: string | null
  unit: string | null
  verified_price: number | null
  zip: string | null
  source: string | null
  human_verified: boolean | null
  notes: string | null
  last_checked?: string | null
}

type MaterialEstimateDraftLine = {
  materialName: string
  category: string
  requiredQuantity: number
  requiredUnit: string
  packageSize: number
  packageUnit: string
  packageCoverage: number
  packageCoverageUnit: string
  packagePrice: number
  packagesNeeded: number
  extendedTotal: number
  sourceUrl: string
  source: string
  sourceStatus: 'pricing_memory' | 'needs_source_review'
  confidence: string
  reviewStatus: string
  quantityReason: string
}

type LeadPropertyProfile = {
  beds?: string
  baths?: string
  sqft?: string
  yearBuilt?: string
  propertyType?: string
  jurisdiction?: string
  parcelNumber?: string
  raw?: unknown
}

type LaborRate = {
  id: string
  created_at?: string | null
  updated_at?: string | null

  trade: string
  job_type?: string | null
  unit?: string | null

  low_rate?: number | null
  typical_rate?: number | null
  high_rate?: number | null

  minimum_charge?: number | null
  trip_charge?: number | null
  disposal_fee?: number | null

  zip?: string | null
  region?: string | null

  source?: string | null
  confidence?: string | null
  human_verified?: boolean | null
  last_checked?: string | null
  notes?: string | null
}

function getLaborConfidenceLabel(value: string | null | undefined, verified?: boolean | null) {
  if (verified) return 'labor_verified'
  return value || 'needs_review'
}

function normalizeLaborText(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeScopeText(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getRequestPropertyId(request: WorkRequest | null | undefined) {
  return request?.id || ''
}

function getDefaultRepairItemId(request: WorkRequest | null | undefined, itemName = '') {
  if (!request) return ''
  const seed = normalizeScopeText(itemName || request.workType || request.description || 'repair')
    .replace(/\s+/g, '-')
    .slice(0, 60)
  return `${request.id}:${seed || 'repair-item'}`
}

function getCurrentScopeReason(request: WorkRequest | null | undefined) {
  if (!request) return 'current estimate scope'
  return [request.workType, request.description].filter(Boolean).join(' — ') || 'current estimate scope'
}

function getEstimateInclusionReason(item: EstimateItem) {
  return (
    item.relevance_reason ||
    item.quantity_reason ||
    (item.scope_source ? item.scope_source.replace(/_/g, ' ') : '') ||
    (item.repair_item_id ? `repair item ${item.repair_item_id}` : '') ||
    'current job scope'
  )
}

function isEstimateItemRejected(item: EstimateItem) {
  return item.review_status === 'rejected'
}

function isHumanScopedMaterial(item: EstimateItem) {
  const confidence = String(item.confidence || '')
  return confidence.includes('human') || Boolean(item.human_approved)
}

function estimateItemMatchesCurrentScope(item: EstimateItem, request: WorkRequest | null) {
  if (!request) return true
  if (isEstimateItemRejected(item)) return false

  const propertyId = getRequestPropertyId(request)
  const matchesCurrentJob =
    item.lead_id === request.id ||
    item.request_id === request.id ||
    item.job_id === request.id ||
    item.property_id === propertyId ||
    (!item.request_id && !item.job_id && !item.property_id)

  if (!matchesCurrentJob) return false

  if (isHumanScopedMaterial(item)) return true

  const scopeText = normalizeScopeText([request.workType, request.description].join(' '))
  const itemText = normalizeScopeText(
    [
      item.item_name,
      item.category,
      item.quantity_reason,
      item.scope_source,
      item.relevance_reason,
    ].join(' ')
  )

  if (!scopeText || !itemText) return Boolean(item.repair_item_id || item.quantity_reason)

  const scopeWords = scopeText.split(' ').filter((word) => word.length > 3)
  const hasScopeMatch = scopeWords.some((word) => itemText.includes(word))
  const hasScopeLink = Boolean(item.repair_item_id || item.scope_source || item.relevance_reason || item.quantity_reason)
  const confidence = String(item.confidence || '')
  const hasReviewableConfidence =
    confidence.includes('verified') ||
    confidence.includes('review') ||
    confidence.includes('source') ||
    confidence.includes('draft') ||
    confidence.includes('memory')

  return hasScopeLink && hasScopeMatch && hasReviewableConfidence
}

function getLaborKeywordMatches(request: WorkRequest) {
  const text = normalizeLaborText(
    [request.workType, request.description, request.timeline, request.urgency].join(' ')
  )

  const keywords: Record<string, string[]> = {
    roofing: ['roof', 'roofing', 'shingle', 'leak', 'flashing', 'gutter'],
    painting: ['paint', 'painting', 'primer', 'interior paint', 'exterior paint'],
    concrete: ['concrete', 'slab', 'demo', 'remove concrete', 'post block'],
    decking: ['deck', 'decking', 'framing deck', 'post base', '2x6'],
    drywall: ['drywall', 'sheetrock', 'patch', 'joint compound', 'texture'],
    plumbing: ['plumb', 'plumbing', 'leak', 'fixture', 'toilet', 'sink'],
    electrical: ['electric', 'electrical', 'outlet', 'panel', 'breaker', 'light'],
    flooring: ['floor', 'flooring', 'vinyl', 'lvp', 'tile floor'],
    tile: ['tile', 'grout', 'thinset', 'backsplash', 'shower'],
    landscaping: ['landscape', 'yard', 'lawn', 'tree', 'mulch'],
    cleaning: ['clean', 'cleaning', 'turnover', 'debris'],
  }

  return Object.entries(keywords)
    .filter(([, words]) => words.some((word) => text.includes(word)))
    .map(([trade]) => trade)
}

function scoreLaborRateForRequest(rate: LaborRate, request: WorkRequest) {
  const workText = normalizeLaborText([request.workType, request.description].join(' '))
  const trade = normalizeLaborText(rate.trade || '')
  const jobType = normalizeLaborText(rate.job_type || '')
  const matches = getLaborKeywordMatches(request)

  let score = 0

  if (rate.human_verified) score += 100
  if (rate.zip && request.zip && rate.zip === request.zip) score += 30
  if (!rate.zip) score += 5
  if (trade && workText.includes(trade)) score += 30
  if (jobType && workText.includes(jobType)) score += 35
  if (matches.some((match) => trade.includes(match) || match.includes(trade))) score += 40
  if (matches.some((match) => jobType.includes(match) || match.includes(jobType))) score += 25
  if (Number(rate.typical_rate || 0) > 0) score += 10

  return score
}

function getDefaultLaborUnits(rate: LaborRate | null, request?: WorkRequest | null) {
  const unit = normalizeLaborText(rate?.unit || 'hour')
  const text = normalizeLaborText([request?.workType || '', request?.description || ''].join(' '))

  if (unit.includes('sqft') || unit.includes('sq ft') || unit.includes('square')) {
    const sqftMatch = text.match(/(\d{2,5})\s*(sqft|sq ft|square feet|sf)/)
    return sqftMatch ? Number(sqftMatch[1]) : 100
  }

  if (unit.includes('day')) return 1
  if (unit.includes('job') || unit.includes('project') || unit.includes('flat')) return 1

  if (text.includes('asap') || text.includes('urgent')) return 6
  return 4
}

function calculateLaborTotalFromRate(
  rate: LaborRate | null,
  unitsText: string,
  minimumText: string,
  tripText: string,
  disposalText: string
) {
  if (!rate) return 0

  const units = Number(unitsText || 0)
  const typicalRate = Number(rate.typical_rate || 0)
  const minimumCharge = Number(minimumText || 0)
  const tripCharge = Number(tripText || 0)
  const disposalFee = Number(disposalText || 0)
  const baseLabor = typicalRate * units

  return Math.round((Math.max(baseLabor, minimumCharge) + tripCharge + disposalFee) * 100) / 100
}

type EstimateItem = {
  id: string
  research_id?: string | null
  lead_id: string
  created_at?: string
  property_id?: string | null
  job_id?: string | null
  request_id?: string | null
  repair_item_id?: string | null
  item_name: string
  category?: string | null
  source: string | null
  source_url: string | null
  quantity: number | null
  unit_price: number | null
  original_unit_price?: number | null
  total_price: number | null
  required_quantity?: number | null
  required_unit?: string | null
  package_size?: number | null
  package_unit?: string | null
  package_coverage?: number | null
  package_coverage_unit?: string | null
  packages_needed?: number | null
  package_price?: number | null
  extended_total?: number | null
  quantity_reason?: string | null
  scope_source?: string | null
  relevance_reason?: string | null
  source_status?: string | null
  review_status?: string | null
  rejection_reason?: string | null
  admin_notes?: string | null
  confidence: string | null
  human_approved: boolean | null
}

type MaterialReviewAction =
  | 'approved'
  | 'rejected'
  | 'edited'
  | 'added'
  | 'saved_for_next_time'

type ManualMaterialDraft = {
  itemName: string
  vendor: string
  quantity: string
  unitCost: string
  totalCost: string
  sourceUrl: string
  notes: string
  reviewStatus: 'approved' | 'needs_review'
  repairItemId: string
}

const MATERIAL_REJECTION_REASONS = [
  'Wrong job',
  'Wrong material',
  'Duplicate',
  'Bad source',
  'Not needed for scope',
  'Price too high',
  'Other',
]

const EMPTY_MANUAL_MATERIAL_DRAFT: ManualMaterialDraft = {
  itemName: '',
  vendor: '',
  quantity: '1',
  unitCost: '',
  totalCost: '',
  sourceUrl: '',
  notes: '',
  reviewStatus: 'needs_review',
  repairItemId: '',
}

type EstimateResearchRow = {
  id: string
  lead_id: string
  created_at?: string
  status: string | null
  source: string | null
  search_query: string | null
  screenshot_url: string | null
  notes: string | null
  human_approved: boolean | null
}

type MessageLog = {
  id: string
  created_at?: string | null
  lead_id?: string | null
  direction?: string | null
  channel?: string | null
  recipient_name?: string | null
  recipient_email?: string | null
  recipient_phone?: string | null
  message_type?: string | null
  message_body: string
  ai_generated?: boolean | null
  auto_sent?: boolean | null
  human_reviewed?: boolean | null
  human_approved?: boolean | null
  status?: string | null
  notes?: string | null
}

type MissingInfoRequest = {
  id: string
  created_at?: string | null
  lead_id?: string | null
  missing_address?: boolean | null
  missing_photos?: boolean | null
  missing_inspection_report?: boolean | null
  missing_deadline?: boolean | null
  missing_access_info?: boolean | null
  missing_scope_clarity?: boolean | null
  generated_message?: string | null
  status?: string | null
  auto_send_allowed?: boolean | null
  sent_at?: string | null
  human_reviewed?: boolean | null
}

const STORAGE_KEY = 'shelter-prep-requests-v1'
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || ''
const REQUEST_FILES_BUCKET = 'job-files'
const INVOICE_BUCKET = 'invoices'

const AGENT_API_URL =
  import.meta.env.VITE_AGENT_API_URL || 'https://shelter-prep-agent-production.up.railway.app'
const AGENT_API_KEY = import.meta.env.VITE_AGENT_API_KEY || ''
const isAgentApiKeyConfigured = Boolean(AGENT_API_KEY && AGENT_API_KEY !== 'PASTE_YOUR_AGENT_API_KEY_HERE')

console.info('[agent-env]', {
  hasAgentApiUrl: Boolean(AGENT_API_URL),
  hasAgentApiKey: isAgentApiKeyConfigured,
})

function createAgentHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AGENT_API_KEY}`,
    'X-Agent-Api-Key': AGENT_API_KEY,
    'x-agent-key': AGENT_API_KEY,
  }
}

const WORK_TYPES = [
  'General Repair',
  'Painting',
  'Roofing',
  'Electrical',
  'Plumbing',
  'Cleaning',
  'Landscaping',
  'Inspection Repairs',
  'Turnover Work',
  'Home Services',
]

const STATUS_META: Record<
  RequestStatus,
  { label: string; cardBg: string; border: string }
> = {
  new: { label: 'New Lead', cardBg: '#eef5ff', border: '#c8d9f2' },
  needs_info: { label: 'Needs Info', cardBg: '#fff3f3', border: '#efc5c5' },
  estimate_ready: { label: 'Estimate Ready', cardBg: '#f1fbf2', border: '#c9e3ce' },
  pending_approval: { label: 'Pending Approval', cardBg: '#fbf6f0', border: '#e2d0bc' },
}

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return String(Date.now())
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function storagePathFromPublicUrl(fileUrl = '', bucket = REQUEST_FILES_BUCKET) {
  const marker = `/storage/v1/object/public/${bucket}/`
  const index = fileUrl.indexOf(marker)
  if (index === -1) return ''
  return decodeURIComponent(fileUrl.slice(index + marker.length))
}

function inferStoredFileType(row: any): 'photo' | 'document' {
  const rawType = String(row.file_type || row.type || '').toLowerCase()
  const path = String(row.storage_path || row.file_url || row.file_name || '').toLowerCase()
  const mime = String(row.mime_type || '').toLowerCase()

  if (rawType === 'photo' || path.includes('/photos/') || mime.startsWith('image/')) return 'photo'
  if (/\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(path)) return 'photo'
  return 'document'
}

function mapFileRowToStoredFile(row: any): StoredFile {
  const bucket = row.storage_bucket || row.bucket || REQUEST_FILES_BUCKET
  const path = row.storage_path || storagePathFromPublicUrl(row.file_url || '', bucket)

  return {
    id: row.id,
    name: row.file_name || row.name || path.split('/').pop() || 'Uploaded file',
    path,
    url: row.file_url || '',
    bucket,
    type: inferStoredFileType(row),
  }
}

async function attachFilesToRequests(items: WorkRequest[]) {
  const ids = items.map((item) => item.id).filter(Boolean)

  if (ids.length === 0) return items

  const { data, error } = await supabase
    .from('files')
    .select('*')
    .in('lead_id', ids)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('Leads loaded, but uploaded files could not be loaded:', error)
    return items
  }

  const grouped = (data || []).reduce((acc: Record<string, StoredFile[]>, row: any) => {
    const leadId = row.lead_id
    if (!leadId) return acc
    acc[leadId] = [...(acc[leadId] || []), mapFileRowToStoredFile(row)]
    return acc
  }, {})

  return items.map((item) => {
    const files = grouped[item.id] || []
    return {
      ...item,
      photos: files.filter((file) => file.type === 'photo'),
      documents: files.filter((file) => file.type === 'document'),
    }
  })
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Not set'
  return `$${Number(value).toFixed(2)}`
}

function propertyLookupStatusLabel(status: PropertyLookupStatus) {
  if (status === 'function_missing') return 'function missing'
  if (status === 'function_unavailable') return 'function unavailable'
  if (status === 'provider_not_configured') return 'provider missing'
  if (status === 'no_records_found') return 'provider returned no data'
  if (status === 'data_found') return 'data found'
  if (status === 'error') return 'lookup error'
  return 'not pulled'
}

function parseMoneyInput(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value === null || value === undefined) return 0

  const cleaned = String(value)
    .replace(/,/g, '')
    .match(/-?\d+(?:\.\d+)?/)

  if (!cleaned) return 0

  const parsed = Number(cleaned[0])
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeMaterialName(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getMaterialName(item: MaterialCost) {
  return item.item_name || item.material_name || 'Unnamed material'
}

function getMaterialTypicalPrice(item: MaterialCost) {
  return item.typical_price ?? item.current_price ?? 0
}

function getConfidenceLabel(value: string | null | undefined, verified?: boolean | null) {
  if (verified) return 'database_verified'
  return value || 'needs_review'
}

function ceilToPackage(requiredQuantity: number, packageCoverage: number) {
  if (!packageCoverage || packageCoverage <= 0) return 0
  return Math.ceil(requiredQuantity / packageCoverage)
}

function searchUrl(query: string) {
  return `https://www.homedepot.com/s/${encodeURIComponent(query)}`
}

function inferDeckSquareFeet(request: WorkRequest) {
  const text = [request.description, request.workType].join(' ')
  const sqftMatch = text.match(/(\d{2,5})\s*(?:sq\.?\s*ft|sqft|square feet|sf)/i)
  if (sqftMatch?.[1]) return Number(sqftMatch[1])
  if (/deck/i.test(text)) return 400
  return 0
}

function getPricingMemoryMatch(entries: PricingMemoryEntry[], name: string, zip: string) {
  const normalized = normalizeMaterialName(name)
  const zipPrefix = zip.slice(0, 3)

  return entries
    .filter((entry) => entry.human_verified && Number(entry.verified_price || entry.unit_cost || 0) > 0)
    .map((entry) => {
      const entryName = normalizeMaterialName([entry.item_name, entry.category].filter(Boolean).join(' '))
      let score = 0
      if (entryName === normalized) score += 6
      if (entryName.includes(normalized) || normalized.includes(entryName)) score += 4
      for (const word of normalized.split(' ')) {
        if (word.length > 2 && entryName.includes(word)) score += 1
      }
      if (entry.zip && entry.zip === zip) score += 2
      else if (entry.zip && zipPrefix && entry.zip.startsWith(zipPrefix)) score += 1

      return { entry, score }
    })
    .filter((item) => item.score >= 4)
    .sort((a, b) => b.score - a.score)[0]?.entry || null
}

function applyPricingMemory(
  draft: Omit<MaterialEstimateDraftLine, 'packagesNeeded' | 'extendedTotal' | 'sourceStatus' | 'confidence' | 'reviewStatus'>,
  entries: PricingMemoryEntry[],
  zip: string
): MaterialEstimateDraftLine {
  const memory = getPricingMemoryMatch(entries, draft.materialName, zip)
  const packagePrice = Number(memory?.verified_price || memory?.unit_cost || draft.packagePrice)
  const packagesNeeded = ceilToPackage(draft.requiredQuantity, draft.packageCoverage)
  const fromMemory = Boolean(memory)

  return {
    ...draft,
    packagePrice,
    packagesNeeded,
    extendedTotal: packagesNeeded * packagePrice,
    source: fromMemory ? 'pricing_memory' : draft.source,
    sourceUrl: memory?.source || draft.sourceUrl,
    sourceStatus: fromMemory ? 'pricing_memory' : 'needs_source_review',
    confidence: fromMemory ? 'pricing_memory_verified' : 'needs_source_review',
    reviewStatus: 'needs_review',
  }
}

function buildDeckMaterialEstimateLines(
  request: WorkRequest,
  entries: PricingMemoryEntry[]
): MaterialEstimateDraftLine[] {
  const deckSqft = inferDeckSquareFeet(request) || 400
  const framingWasteFactor = 1.1
  const estimatedBoardCount = Math.ceil((deckSqft / 400) * 50 * framingWasteFactor)
  const rimBlockingCount = Math.ceil((deckSqft / 400) * 14 * framingWasteFactor)
  const pierBlockCount = Math.ceil(deckSqft / 25)
  const hangerCount = Math.ceil(estimatedBoardCount * 1.6)
  const gravelBags = Math.ceil(pierBlockCount * 0.5)

  const baseLines: Array<Omit<MaterialEstimateDraftLine, 'packagesNeeded' | 'extendedTotal' | 'sourceStatus' | 'confidence' | 'reviewStatus'>> = [
    {
      materialName: '2x6 pressure-treated framing lumber',
      category: 'Deck Framing',
      requiredQuantity: estimatedBoardCount,
      requiredUnit: 'boards',
      packageSize: 1,
      packageUnit: '2x6 board',
      packageCoverage: 1,
      packageCoverageUnit: 'board',
      packagePrice: 11.98,
      sourceUrl: searchUrl('2x6 pressure treated lumber 12 ft'),
      source: 'fallback_product_search',
      quantityReason: `Floating deck framing draft for ${deckSqft} sqft at roughly 16 in. OC plus 10% waste. Verify span, beam layout, board lengths, and local code.`,
    },
    {
      materialName: '2x6 pressure-treated rim boards and blocking',
      category: 'Deck Framing',
      requiredQuantity: rimBlockingCount,
      requiredUnit: 'boards',
      packageSize: 1,
      packageUnit: '2x6 board',
      packageCoverage: 1,
      packageCoverageUnit: 'board',
      packagePrice: 11.98,
      sourceUrl: searchUrl('2x6 pressure treated lumber 12 ft'),
      source: 'fallback_product_search',
      quantityReason: `Rim boards, blocking, and layout waste allowance scaled from a ${deckSqft} sqft floating deck. Human layout review required.`,
    },
    {
      materialName: 'concrete deck pier blocks',
      category: 'Deck Foundation',
      requiredQuantity: pierBlockCount,
      requiredUnit: 'blocks',
      packageSize: 1,
      packageUnit: 'pier block',
      packageCoverage: 1,
      packageCoverageUnit: 'block',
      packagePrice: 10.98,
      sourceUrl: searchUrl('concrete deck block pier block'),
      source: 'fallback_product_search',
      quantityReason: `Draft pier block count uses approximately one support point per 25 sqft for a floating deck. Verify load path, soil, and code.`,
    },
    {
      materialName: 'joist hangers and galvanized framing hardware',
      category: 'Deck Hardware',
      requiredQuantity: hangerCount,
      requiredUnit: 'pieces',
      packageSize: 1,
      packageUnit: 'hardware piece',
      packageCoverage: 1,
      packageCoverageUnit: 'piece',
      packagePrice: 1.78,
      sourceUrl: searchUrl('2x6 joist hanger galvanized'),
      source: 'fallback_product_search',
      quantityReason: `Hardware count approximates joist ends, rim connections, and blocking hardware. Final connector schedule needs human review.`,
    },
    {
      materialName: 'exterior structural/deck screws',
      category: 'Deck Fasteners',
      requiredQuantity: deckSqft,
      requiredUnit: 'sqft deck area',
      packageSize: 1,
      packageUnit: '10 lb box',
      packageCoverage: 250,
      packageCoverageUnit: 'sqft deck area',
      packagePrice: 89,
      sourceUrl: searchUrl('exterior deck screws 10 lb box'),
      source: 'fallback_product_search',
      quantityReason: `Fastener count uses deck area coverage per bulk screw box. Verify screw type, coating, and approved structural uses.`,
    },
    {
      materialName: 'weed barrier landscape fabric roll',
      category: 'Deck Ground Prep',
      requiredQuantity: deckSqft,
      requiredUnit: 'sqft',
      packageSize: 1,
      packageUnit: 'roll',
      packageCoverage: 400,
      packageCoverageUnit: 'sqft',
      packagePrice: 25,
      sourceUrl: searchUrl('weed barrier landscape fabric 400 sq ft roll'),
      source: 'fallback_product_search',
      quantityReason: `Weed barrier is package-priced by roll coverage: ${deckSqft} sqft required / 400 sqft per roll. This prevents the wrong 400 sqft x $25 calculation.`,
    },
    {
      materialName: 'gravel/base material under pier blocks',
      category: 'Deck Ground Prep',
      requiredQuantity: gravelBags,
      requiredUnit: '0.5 cu ft bags',
      packageSize: 1,
      packageUnit: 'bag',
      packageCoverage: 1,
      packageCoverageUnit: '0.5 cu ft bag',
      packagePrice: 5.48,
      sourceUrl: searchUrl('0.5 cu ft gravel bag paver base'),
      source: 'fallback_product_search',
      quantityReason: `Draft base allowance uses about 0.5 cu ft of compacted base per pier block. Verify excavation depth and drainage.`,
    },
  ]

  return baseLines.map((line) => applyPricingMemory(line, entries, request.zip || ''))
}

function countItems(value: unknown[] | null | undefined) {
  return Array.isArray(value) ? value.length : 0
}

function calculateEstimateTotals(
  items: EstimateItem[],
  laborCost: string,
  markupPercent: string,
  contingencyPercent: string
) {
  const activeItems = items.filter((item) => !isEstimateItemRejected(item))
  const materialSubtotal = activeItems.reduce(
    (sum, item) => sum + Number(item.total_price || 0),
    0
  )
  const labor = Number(laborCost || 0)
  const markup = Number(markupPercent || 0)
  const contingency = Number(contingencyPercent || 0)
  const directCost = materialSubtotal + labor
  const markupDollars = directCost * (markup / 100)
  const contingencyDollars = directCost * (contingency / 100)
  const standardTotal = directCost + markupDollars + contingencyDollars

  return {
    materialSubtotal,
    labor,
    markup,
    contingency,
    directCost,
    markupDollars,
    contingencyDollars,
    standardTotal,
    lowTotal: standardTotal * 0.9,
    premiumTotal: standardTotal * 1.15,
    approvedCount: activeItems.filter((item) => item.human_approved).length,
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read image file.'))
    reader.readAsDataURL(file)
  })
}

function getBestWorkType(value = '', description = '') {
  const text = [value, description].join(' ').toLowerCase()
  const exact = WORK_TYPES.find((item) => item.toLowerCase() === value.toLowerCase())
  if (exact) return exact

  const matchers: Array<[string, string[]]> = [
    ['Roofing', ['roof', 'shingle', 'leak', 'flashing', 'gutter']],
    ['Painting', ['paint', 'primer', 'interior paint', 'exterior paint']],
    ['Electrical', ['electrical', 'outlet', 'breaker', 'panel', 'light fixture']],
    ['Plumbing', ['plumbing', 'leak', 'toilet', 'sink', 'faucet', 'water heater']],
    ['Landscaping', ['landscape', 'yard', 'lawn', 'tree', 'mulch']],
    ['Cleaning', ['clean', 'cleaning', 'debris', 'turnover']],
    ['Inspection Repairs', ['inspection', 'repair request', 'buyer', 'seller']],
    ['Turnover Work', ['turnover', 'move out', 'tenant', 'unit']],
  ]

  const found = matchers.find(([_, words]) => words.some((word) => text.includes(word)))
  return found?.[0] || WORK_TYPES[0]
}

function localIntakeFallback(text = ''): IntakeDraft {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  const lower = cleaned.toLowerCase()

  const emailMatch = cleaned.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const phoneMatch = cleaned.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)
  const zipMatch = cleaned.match(/\b\d{5}(?:-\d{4})?\b/)
  const addressMatch = cleaned.match(/\b\d{1,6}\s+[A-Za-z0-9.'\-\s]+\s+(?:Ave|Avenue|St|Street|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Way|Blvd|Boulevard|Pl|Place|Terrace|Ter|Loop|Cir|Circle)\b[^,.\n]*/i)

  const missing: string[] = []
  if (!addressMatch) missing.push('property address')
  if (!lower.includes('photo') && !lower.includes('pic') && !lower.includes('image')) missing.push('photos')
  if (!lower.includes('deadline') && !lower.includes('tonight') && !lower.includes('tomorrow') && !lower.includes('asap')) missing.push('deadline')
  if (!lower.includes('inspection')) missing.push('inspection report')
  if (!lower.includes('access') && !lower.includes('lockbox')) missing.push('access instructions')

  const workType = getBestWorkType('', cleaned)
  const urgency = lower.includes('asap') || lower.includes('urgent') || lower.includes('tonight') || lower.includes('tight') ? 'Urgent' : 'Standard'

  return {
    requesterName: '',
    email: emailMatch?.[0] || '',
    phone: phoneMatch?.[0] || '',
    workType,
    propertyAddress: addressMatch?.[0]?.trim() || '',
    city: '',
    state: '',
    zip: zipMatch?.[0] || '',
    urgency,
    occupancy: 'Unknown',
    timeline: lower.includes('tonight') ? 'Tonight' : lower.includes('tomorrow') ? 'Tomorrow' : '',
    description: cleaned || 'Imported from text/screenshot intake. Review required.',
    missingInfo: missing,
    suggestedReply: `Thanks — I have the ${workType.toLowerCase()} request started. Please send ${missing.length ? missing.join(', ') : 'any photos, deadline, access instructions, and inspection notes'} so we can prepare a more accurate estimate.`,
    confidence: 'local_draft',
    notes: 'Local fallback parser used. Human review required.',
  }
}


function normalizeRequestStatus(value: string | null | undefined): RequestStatus {
  const raw = String(value || '').toLowerCase().trim()

  if (raw === 'needs info' || raw === 'needs_info' || raw === 'need info' || raw === 'missing info') {
    return 'needs_info'
  }

  if (raw === 'estimate ready' || raw === 'estimate_ready' || raw === 'ready' || raw === 'complete') {
    return 'estimate_ready'
  }

  if (raw === 'pending approval' || raw === 'pending_approval' || raw === 'pending' || raw === 'review') {
    return 'pending_approval'
  }

  return 'new'
}

function mapLeadRowToWorkRequest(row: any): WorkRequest {
  const rowPropertyFacts = row.property_facts && typeof row.property_facts === 'object'
    ? row.property_facts
    : {}

  return {
    id: row.id,
    createdAt: row.created_at ? new Date(row.created_at).toLocaleString() : '',
    requesterName: row.name || row.requester_name || row.client_name || '',
    email: row.email || row.client_email || row.requester_email || row.contact_email || '',
    phone: row.phone || row.client_phone || row.requester_phone || '',
    workType: row.work_type || row.workType || row.project_type || 'Home Services',
    propertyAddress: row.address || row.property_address || row.project_address || '',
    city: row.city || '',
    state: row.state || '',
    zip: row.zip || row.postal_code || '',
    urgency: row.urgency || 'Standard',
    occupancy: row.occupancy || 'Unknown',
    timeline: row.timeline || '',
    propertyFacts: {
      ...emptyPropertyFacts(),
      ...rowPropertyFacts,
      propertyType: row.property_type || rowPropertyFacts.propertyType || '',
      jurisdiction: row.property_jurisdiction || rowPropertyFacts.jurisdiction || '',
      zoning: row.zoning || rowPropertyFacts.zoning || '',
      parcelNumber: row.parcel_number || rowPropertyFacts.parcelNumber || '',
      verified: Boolean(row.property_verified || rowPropertyFacts.verified),
    },
    description: row.description || row.scope || row.notes || '',
    photos: [],
    documents: [],
    status: normalizeRequestStatus(row.status),
    archived: Boolean(row.archived),
    archivedAt: row.archived_at || '',
    archiveReason: row.archive_reason || '',
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('new')
  const [showLogin, setShowLogin] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [adminPinInput, setAdminPinInput] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isCompact, setIsCompact] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(max-width: 760px)').matches
  )

  const [requests, setRequests] = useState<WorkRequest[]>([])
  const [archivedRequests, setArchivedRequests] = useState<WorkRequest[]>([])
  const [archivedSearch, setArchivedSearch] = useState('')
  const [archivedLoading, setArchivedLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | RequestStatus>('all')

  const [requesterName, setRequesterName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [workType, setWorkType] = useState(WORK_TYPES[0])
  const [propertyAddress, setPropertyAddress] = useState('')
  const [propertyFacts, setPropertyFacts] = useState<PropertyFacts>(emptyPropertyFacts())
  const [propertyLookupLoading, setPropertyLookupLoading] = useState(false)
  const [propertyLookupMessage, setPropertyLookupMessage] = useState('')
  const [propertyLookupStatus, setPropertyLookupStatus] = useState<PropertyLookupStatus>('idle')
  const [propertyProfilesByLeadId, setPropertyProfilesByLeadId] = useState<Record<string, LeadPropertyProfile>>({})
  const [propertyProfileLoadingByLeadId, setPropertyProfileLoadingByLeadId] = useState<Record<string, boolean>>({})
  const [propertyProfileErrorsByLeadId, setPropertyProfileErrorsByLeadId] = useState<Record<string, string>>({})
  const [propertyType, setPropertyType] = useState('')
  const [jurisdiction, setJurisdiction] = useState('')
  const [zoning, setZoning] = useState('')
  const [parcelNumber, setParcelNumber] = useState('')
  const [verificationNotes, setVerificationNotes] = useState('')
  const [city, setCity] = useState('')
  const [stateValue, setStateValue] = useState('')
  const [zip, setZip] = useState('')
  const [urgency, setUrgency] = useState('Standard')
  const [occupancy, setOccupancy] = useState('Occupied')
  const [timeline, setTimeline] = useState('')
  const [description, setDescription] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [documentFiles, setDocumentFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null)
  const [researchingId, setResearchingId] = useState<string | null>(null)
  const [materialListLoadingId, setMaterialListLoadingId] = useState<string | null>(null)
  const [takeoffLoadingId, setTakeoffLoadingId] = useState<string | null>(null)
  const [materialEstimateLoadingId, setMaterialEstimateLoadingId] = useState<string | null>(null)
  const [autoWorkflowLoadingId, setAutoWorkflowLoadingId] = useState<string | null>(null)
  const [sellerPrepLoadingId, setSellerPrepLoadingId] = useState<string | null>(null)
const [sellerPrepReview, setSellerPrepReview] = useState<any | null>(null)
  const [intakeText, setIntakeText] = useState('')
  const [intakeScreenshotFile, setIntakeScreenshotFile] = useState<File | null>(null)
  const [intakeDraft, setIntakeDraft] = useState<IntakeDraft | null>(null)
  const [intakeAnalyzing, setIntakeAnalyzing] = useState(false)

  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([])
  const [missingInfoRequests, setMissingInfoRequests] = useState<MissingInfoRequest[]>([])
  const [messageLoading, setMessageLoading] = useState(false)
  const [messageSavingId, setMessageSavingId] = useState<string | null>(null)
  const [messageFilter, setMessageFilter] = useState<'all' | 'draft' | 'sent' | 'approved'>('all')

  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoiceVendor, setInvoiceVendor] = useState('')
  const [invoiceAddress, setInvoiceAddress] = useState('')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoiceAnalyses, setInvoiceAnalyses] = useState<Record<string, InvoiceCostAnalysis>>({})
  const [invoiceUploading, setInvoiceUploading] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [extractingInvoiceId, setExtractingInvoiceId] = useState<string | null>(null)
  const [analyzingInvoiceId, setAnalyzingInvoiceId] = useState<string | null>(null)

  const [materials, setMaterials] = useState<MaterialCost[]>([])
  const [materialName, setMaterialName] = useState('')
  const [materialCategory, setMaterialCategory] = useState('')
  const [materialUnit, setMaterialUnit] = useState('')
  const [materialPrice, setMaterialPrice] = useState('')
  const [materialSource, setMaterialSource] = useState('')
  const [materialLoading, setMaterialLoading] = useState(false)
  const [materialUpdating, setMaterialUpdating] = useState(false)
  const [materialSavingId, setMaterialSavingId] = useState<string | null>(null)
  const [materialEditorItem, setMaterialEditorItem] = useState<MaterialCost | null>(null)
  const [materialEditorDraft, setMaterialEditorDraft] = useState<MaterialEditorDraft | null>(null)

  const [sellerPrepSelectedId, setSellerPrepSelectedId] = useState('')
  const [sellerPrepAnalysisV1, setSellerPrepAnalysisV1] = useState<SellerPrepAnalysisV1 | null>(null)
  const [sellerPrepItemsV1, setSellerPrepItemsV1] = useState<SellerPrepItemV1[]>([])
  const [sellerPrepSavingId, setSellerPrepSavingId] = useState<string | null>(null)
  const [pricingMemoryEntries, setPricingMemoryEntries] = useState<PricingMemoryEntry[]>([])
  const [pricingMemoryLoading, setPricingMemoryLoading] = useState(false)

  const [laborRates, setLaborRates] = useState<LaborRate[]>([])
  const [laborTrade, setLaborTrade] = useState('')
  const [laborJobType, setLaborJobType] = useState('')
  const [laborUnit, setLaborUnit] = useState('hour')
  const [laborTypicalRate, setLaborTypicalRate] = useState('')
  const [laborMinimumCharge, setLaborMinimumCharge] = useState('')
  const [laborTripCharge, setLaborTripCharge] = useState('')
  const [laborDisposalFee, setLaborDisposalFee] = useState('')
  const [laborRegion, setLaborRegion] = useState('')
  const [laborLoading, setLaborLoading] = useState(false)
  const [laborSavingId, setLaborSavingId] = useState<string | null>(null)


  const [selectedEstimateRequest, setSelectedEstimateRequest] = useState<WorkRequest | null>(null)
  const [estimateItems, setEstimateItems] = useState<EstimateItem[]>([])
  const [estimateResearchRows, setEstimateResearchRows] = useState<EstimateResearchRow[]>([])
  const [estimateLoading, setEstimateLoading] = useState(false)
  const [estimateSavingId, setEstimateSavingId] = useState<string | null>(null)
  const [estimateLaborCost, setEstimateLaborCost] = useState('0')
  const [appliedLaborRate, setAppliedLaborRate] = useState<LaborRate | null>(null)
  const [estimateLaborUnits, setEstimateLaborUnits] = useState('4')
  const [estimateMinimumCharge, setEstimateMinimumCharge] = useState('0')
  const [estimateTripCharge, setEstimateTripCharge] = useState('0')
  const [estimateDisposalFee, setEstimateDisposalFee] = useState('0')
  const [estimateLaborMessage, setEstimateLaborMessage] = useState('No labor rate applied yet.')
  const [estimateMarkupPercent, setEstimateMarkupPercent] = useState('20')
  const [estimateContingencyPercent, setEstimateContingencyPercent] = useState('10')
  const [estimateNotes, setEstimateNotes] = useState('Draft estimate. Final price requires human review and site verification.')
  const [estimateIntelligence, setEstimateIntelligence] = useState<EstimateIntelligenceResult | null>(null)
  const [showRejectedEstimateItems, setShowRejectedEstimateItems] = useState(false)
  const [showManualMaterialForm, setShowManualMaterialForm] = useState(false)
  const [manualMaterialDraft, setManualMaterialDraft] = useState<ManualMaterialDraft>(EMPTY_MANUAL_MATERIAL_DRAFT)

  useEffect(() => {
    loadRequestsFromSupabase()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const query = window.matchMedia('(max-width: 760px)')
    const updateCompactMode = () => setIsCompact(query.matches)

    updateCompactMode()
    query.addEventListener('change', updateCompactMode)

    return () => query.removeEventListener('change', updateCompactMode)
  }, [])

  // Requests are now loaded from Supabase so phone + desktop stay in sync.
  // Do not save dashboard requests to browser localStorage.

  useEffect(() => {
    if (isAdmin && activeTab === 'invoices') loadInvoices()
    if (isAdmin && activeTab === 'materials') loadMaterials()
    if (isAdmin && activeTab === 'labor') loadLaborRates()
    if (isAdmin && activeTab === 'messages') loadMessageCenter()
    if (isAdmin && activeTab === 'archived') loadArchivedRequestsFromSupabase()
    if (isAdmin && activeTab === 'pricingMemory') loadPricingMemoryEntries()
  }, [isAdmin, activeTab])

  useEffect(() => {
    if (!appliedLaborRate) return

    const nextLaborTotal = calculateLaborTotalFromRate(
      appliedLaborRate,
      estimateLaborUnits,
      estimateMinimumCharge,
      estimateTripCharge,
      estimateDisposalFee
    )

    setEstimateLaborCost(String(nextLaborTotal))
  }, [
    appliedLaborRate,
    estimateLaborUnits,
    estimateMinimumCharge,
    estimateTripCharge,
    estimateDisposalFee,
  ])

  function requireAdmin(tab: Tab) {
    if (!isAdmin) {
      setShowLogin(true)
      return
    }

    setActiveTab(tab)
  }

  function handleLogin() {
    if (!ADMIN_PIN) {
      alert('Admin PIN is not configured. Add VITE_ADMIN_PIN to your environment variables.')
      return
    }

    if (adminPinInput === ADMIN_PIN) {
      setIsAdmin(true)
      setShowLogin(false)
      setAdminPinInput('')
      setActiveTab('dashboard')
    } else {
      alert('Wrong admin PIN')
    }
  }

  function handleLogout() {
    setIsAdmin(false)
    setActiveTab('new')
  }

  function resetForm() {
    setRequesterName('')
    setEmail('')
    setPhone('')
    setWorkType(WORK_TYPES[0])
    setPropertyAddress('')
    setPropertyFacts(emptyPropertyFacts())
    setPropertyLookupMessage('')
    setPropertyType('')
    setJurisdiction('')
    setZoning('')
    setParcelNumber('')
    setVerificationNotes('')
    setCity('')
    setStateValue('')
    setZip('')
    setUrgency('Standard')
    setOccupancy('Occupied')
    setTimeline('')
    setDescription('')
    setPhotoFiles([])
    setDocumentFiles([])
  }


  async function analyzeIntake() {
    if (!intakeText.trim() && !intakeScreenshotFile) {
      alert('Paste a message or upload a screenshot first.')
      return
    }

    if (intakeScreenshotFile && intakeScreenshotFile.size > 7 * 1024 * 1024) {
      alert('Screenshot is too large. Please upload an image under 7 MB.')
      return
    }

    setIntakeAnalyzing(true)

    try {
      let imageDataUrl = ''
      if (intakeScreenshotFile) {
        imageDataUrl = await fileToDataUrl(intakeScreenshotFile)
      }

      if (!AGENT_API_KEY || AGENT_API_KEY === 'PASTE_YOUR_AGENT_API_KEY_HERE') {
        const fallback = localIntakeFallback(intakeText)
        setIntakeDraft(fallback)
        alert('Agent key is missing. I created a local draft, but AI screenshot reading requires the Railway agent key.')
        return
      }

      const response = await fetch(`${AGENT_API_URL}/analyze-intake`, {
        method: 'POST',
        headers: createAgentHeaders(),
        body: JSON.stringify({
          text: intakeText,
          imageDataUrl,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'AI intake analysis failed.')
      }

      setIntakeDraft(result.draft || result)
    } catch (error: any) {
      console.error(error)
      const fallback = localIntakeFallback(intakeText)
      setIntakeDraft(fallback)
      alert(`${error?.message || 'AI intake failed.'} I created a local draft instead.`)
    } finally {
      setIntakeAnalyzing(false)
    }
  }

  function applyIntakeDraftToNewRequest() {
    if (!intakeDraft) return

    const nextDescription = intakeDraft.description || intakeText || ''

    setRequesterName(intakeDraft.requesterName || requesterName || '')
    setEmail(intakeDraft.email || email || '')
    setPhone(intakeDraft.phone || phone || '')
    setWorkType(getBestWorkType(intakeDraft.workType || '', nextDescription))
    setPropertyAddress(intakeDraft.propertyAddress || '')
    setCity(intakeDraft.city || '')
    setStateValue(intakeDraft.state || '')
    setZip(intakeDraft.zip || '')
    setUrgency(intakeDraft.urgency || 'Standard')
    setOccupancy(intakeDraft.occupancy || 'Unknown')
    setTimeline(intakeDraft.timeline || '')
    setDescription(nextDescription)

    if (intakeScreenshotFile) {
      setPhotoFiles([intakeScreenshotFile])
    }

    setSuccessMessage('AI intake draft copied into the request form. Review it, add anything missing, then submit.')
    setActiveTab('new')
  }

  async function copyToClipboard(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      alert('Copied.')
    } catch {
      alert(value)
    }
  }

  async function pullPropertyInfo() {
    setPropertyLookupMessage('')
    setPropertyLookupStatus('idle')
    setPropertyLookupLoading(true)

    try {
      const facts = await lookupPropertyFacts(propertyAddress, city, stateValue, zip)
      const lookupStatus = facts.lookupStatus || (facts.source === 'api' ? 'data_found' : 'error')
      setPropertyFacts(facts)
      setPropertyType(facts.propertyType || propertyType)
      setJurisdiction(facts.jurisdiction || jurisdiction || propertyResearchPack.jurisdiction)
      setZoning(facts.zoning || zoning)
      setParcelNumber(facts.parcelNumber || parcelNumber)
      setVerificationNotes(facts.verificationNotes || verificationNotes)
      setPropertyLookupStatus(lookupStatus)
      setPropertyLookupMessage(
        lookupStatus === 'data_found'
          ? `data found — property info pulled with ${facts.confidence} confidence.`
          : `${propertyLookupStatusLabel(lookupStatus)} — ${facts.notes || 'Manual entry still works.'}`
      )
    } catch (error: any) {
      setPropertyLookupStatus('error')
      setPropertyLookupMessage(error?.message || 'Property lookup failed.')
    } finally {
      setPropertyLookupLoading(false)
    }
  }

  async function refreshLeadPropertyProfile(lead: WorkRequest, force = false) {
    if (!lead.id || !lead.propertyAddress.trim()) return
    if (!force && (propertyProfilesByLeadId[lead.id] || propertyProfileLoadingByLeadId[lead.id])) return

    const functionUrl = `${supabaseUrl}/functions/v1/property-lookup`
    const requestBody = {
      address_line_1: lead.propertyAddress,
      city: lead.city,
      state: lead.state,
      zip: lead.zip,
      address1: lead.propertyAddress,
      address2: [lead.city, [lead.state, lead.zip].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    }

    setPropertyProfileLoadingByLeadId((prev) => ({ ...prev, [lead.id]: true }))
    setPropertyProfileErrorsByLeadId((prev) => {
      const next = { ...prev }
      delete next[lead.id]
      return next
    })

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase frontend env vars are missing.')
      }

      console.info('[lead property-lookup] calling function', { leadId: lead.id, url: functionUrl })
      console.info('[lead property-lookup] request body', requestBody)
      console.info('[lead property-lookup] env', {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasSupabaseAnonKey: Boolean(supabaseAnonKey),
      })

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify(requestBody),
      })

      const responseText = await response.text()
      let data: any = null

      try {
        data = responseText ? JSON.parse(responseText) : null
      } catch {
        data = null
      }

      console.info('[lead property-lookup] raw response', {
        leadId: lead.id,
        status: response.status,
        ok: response.ok,
        data,
        raw: responseText,
      })

      if (!response.ok) {
        throw new Error(data?.message || data?.error || `Function returned ${response.status}.`)
      }

      if (data?.status !== 'data_found' || !data?.property) {
        throw new Error(data?.message || 'Property lookup returned no data.')
      }

      const property = data.property
      setPropertyProfilesByLeadId((prev) => ({
        ...prev,
        [lead.id]: {
          beds: property.bedrooms || property.beds,
          baths: property.bathrooms || property.baths,
          sqft: property.squareFeet || property.sqft,
          yearBuilt: property.yearBuilt,
          propertyType: property.propertyType,
          jurisdiction: property.jurisdiction,
          parcelNumber: property.parcelNumber,
          raw: data,
        },
      }))
    } catch (error: any) {
      console.error('[lead property-lookup] failed', { leadId: lead.id, error })
      setPropertyProfileErrorsByLeadId((prev) => ({
        ...prev,
        [lead.id]: error?.message || 'Property lookup failed.',
      }))
    } finally {
      setPropertyProfileLoadingByLeadId((prev) => ({ ...prev, [lead.id]: false }))
    }
  }

  function getRequestLabel(leadId?: string | null) {
    if (!leadId) return 'No linked job yet'
    const request = requests.find((item) => item.id === leadId)
    if (!request) return leadId
    return request.propertyAddress || request.description.slice(0, 60) || leadId
  }

  async function loadMessageCenter() {
    setMessageLoading(true)

    try {
      const [{ data: logs, error: logsError }, { data: missingRows, error: missingError }] = await Promise.all([
        supabase.from('message_logs').select('*').order('created_at', { ascending: false }),
        supabase.from('missing_info_requests').select('*').order('created_at', { ascending: false }),
      ])

      if (logsError) throw logsError
      if (missingError) throw missingError

      setMessageLogs((logs || []) as MessageLog[])
      setMissingInfoRequests((missingRows || []) as MissingInfoRequest[])
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not load message center. Make sure message_logs and missing_info_requests tables exist.')
    } finally {
      setMessageLoading(false)
    }
  }

  function getMissingInfoItems(request: WorkRequest) {
    const text = [request.workType, request.description, request.timeline, request.urgency].join(' ').toLowerCase()
    const items: string[] = []

    if (!request.propertyAddress || !request.city || !request.state || !request.zip) items.push('property address')
    if (request.photos.length === 0 && !text.includes('photo') && !text.includes('picture')) items.push('photos')
    if (!request.timeline && !text.includes('deadline') && !text.includes('asap') && !text.includes('urgent')) items.push('deadline')
    if ((text.includes('inspection') || text.includes('buyer') || text.includes('seller') || text.includes('roof')) && !text.includes('report')) {
      items.push('inspection report')
    }
    if (!text.includes('access') && !text.includes('lockbox') && !text.includes('vacant') && !text.includes('occupied')) {
      items.push('access instructions')
    }
    if (!request.description || request.description.trim().length < 35) items.push('scope clarity')

    return [...new Set(items)]
  }

  function buildMissingInfoMessage(request: WorkRequest, missingItems: string[]) {
    const greeting = request.requesterName ? `Hi ${request.requesterName},` : 'Hi,'
    const scope = request.workType ? request.workType.toLowerCase() : 'work'
    const needed = missingItems.length
      ? missingItems.join(', ')
      : 'any photos, deadline, access instructions, and inspection notes'

    return `${greeting} thanks — I have the ${scope} request started for ${
      request.propertyAddress || 'the property'
    }. Please send ${needed} so we can prepare a more accurate estimate. I’ll review it before any proposal or estimate is sent.`
  }

  async function saveIntakeReplyDraft() {
    if (!intakeDraft?.suggestedReply) {
      alert('Analyze an intake message first so there is a reply draft to save.')
      return
    }

    setMessageSavingId('intake-draft')

    try {
      const { error } = await supabase.from('message_logs').insert({
        lead_id: null,
        direction: 'outbound',
        channel: 'manual',
        recipient_name: intakeDraft.requesterName || '',
        recipient_email: intakeDraft.email || '',
        recipient_phone: intakeDraft.phone || '',
        message_type: 'missing_info_request',
        message_body: intakeDraft.suggestedReply,
        ai_generated: true,
        auto_sent: false,
        human_reviewed: false,
        human_approved: false,
        status: 'draft',
        notes: `Saved from AI Intake. Missing info: ${(intakeDraft.missingInfo || []).join(', ') || 'not listed'}`,
      })

      if (error) throw error

      await loadMessageCenter()
      alert('Reply draft saved to Message Center.')
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save reply draft.')
    } finally {
      setMessageSavingId(null)
    }
  }

  async function generateMissingInfoRequest(request: WorkRequest) {
    const missingItems = getMissingInfoItems(request)
    const messageBody = buildMissingInfoMessage(request, missingItems)

    setMessageSavingId(request.id)

    try {
      await ensureLeadExists(request)

      const missingPayload = {
        lead_id: request.id,
        missing_address: missingItems.includes('property address'),
        missing_photos: missingItems.includes('photos'),
        missing_inspection_report: missingItems.includes('inspection report'),
        missing_deadline: missingItems.includes('deadline'),
        missing_access_info: missingItems.includes('access instructions'),
        missing_scope_clarity: missingItems.includes('scope clarity'),
        generated_message: messageBody,
        status: 'draft',
        auto_send_allowed: missingItems.length > 0 && missingItems.every((item) =>
          ['property address', 'photos', 'inspection report', 'deadline', 'access instructions', 'scope clarity'].includes(item)
        ),
        human_reviewed: false,
      }

      const { error: missingError } = await supabase
        .from('missing_info_requests')
        .insert(missingPayload)

      if (missingError) throw missingError

      const { error: logError } = await supabase.from('message_logs').insert({
        lead_id: request.id,
        direction: 'outbound',
        channel: 'manual',
        recipient_name: request.requesterName,
        recipient_email: request.email,
        recipient_phone: request.phone,
        message_type: 'missing_info_request',
        message_body: messageBody,
        ai_generated: true,
        auto_sent: false,
        human_reviewed: false,
        human_approved: false,
        status: 'draft',
        notes: `Missing info requested: ${missingItems.join(', ') || 'general clarification'}`,
      })

      if (logError) throw logError

      if (missingItems.length > 0) {
        updateStatus(request.id, 'needs_info')
        await supabase.from('leads').update({ status: 'needs_info' }).eq('id', request.id)
      }

      await loadMessageCenter()
      setActiveTab('messages')
      alert('Missing-info request draft created. Review before sending.')
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not create missing-info request.')
    } finally {
      setMessageSavingId(null)
    }
  }

  async function sendMessageEmail(log: MessageLog) {
    if (!log.recipient_email) {
      alert('This message does not have a recipient email. Add an email to the linked request first.')
      return
    }

    if (!confirm(`Send this message by email to ${log.recipient_email}?`)) return

    setMessageSavingId(log.id)

    try {
      const response = await fetch(`${AGENT_API_URL}/send-message-email`, {
        method: 'POST',
        headers: createAgentHeaders(),
        body: JSON.stringify({
          messageLogId: log.id,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result?.error || 'Email failed to send.')
      }

      await loadMessageCenter()
      alert('Email sent and message log updated.')
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not send email.')
    } finally {
      setMessageSavingId(null)
    }
  }

  async function markMessageLog(log: MessageLog, nextStatus: 'draft' | 'approved' | 'sent') {
    setMessageSavingId(log.id)

    try {
      const patch: Partial<MessageLog> = {
        status: nextStatus,
        human_reviewed: nextStatus === 'approved' || nextStatus === 'sent',
        human_approved: nextStatus === 'approved' || nextStatus === 'sent',
        auto_sent: false,
      }

      const { error } = await supabase.from('message_logs').update(patch).eq('id', log.id)

      if (error) throw error

      await loadMessageCenter()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not update message log.')
    } finally {
      setMessageSavingId(null)
    }
  }

  async function loadRequestsFromSupabase() {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .or('archived.is.null,archived.eq.false')
        .order('created_at', { ascending: false })

      if (error) throw error

      const mapped = await attachFilesToRequests((data || []).map(mapLeadRowToWorkRequest))
      setRequests(mapped)
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not load requests from Supabase.')
    }
  }

  async function loadArchivedRequestsFromSupabase() {
    setArchivedLoading(true)
  
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('archived', true)
        .order('archived_at', { ascending: false })
  
      if (error) {
        console.error('Archived leads load error:', error)
        setArchivedRequests([])
        return
      }
  
      const mapped = await attachFilesToRequests((data || []).map(mapLeadRowToWorkRequest))
      setArchivedRequests(mapped)
    } catch (error: any) {
      console.error('Archived leads fetch failed:', error)
      setArchivedRequests([])
    } finally {
      setArchivedLoading(false)
    }
  }

  async function restoreArchivedLead(request: WorkRequest) {
    const confirmed = window.confirm(
      `Restore this archived lead?\n\n${request.propertyAddress || 'Untitled lead'}\n\nIt will return to the active Dashboard.`
    )

    if (!confirmed) return

    setRestoringId(request.id)

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          archived: false,
          archived_at: null,
          archive_reason: null,
        })
        .eq('id', request.id)

      if (error) throw error

      setArchivedRequests((prev) => prev.filter((item) => item.id !== request.id))
      await loadRequestsFromSupabase()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not restore archived lead.')
      await loadArchivedRequestsFromSupabase()
    } finally {
      setRestoringId(null)
    }
  }

  async function uploadRequestFiles(
    files: File[],
    folder: 'photos' | 'documents',
    type: 'photo' | 'document',
    leadId?: string
  ) {
    const uploaded: StoredFile[] = []

    for (const file of files) {
      const path = `${folder}/${leadId || 'unlinked'}/${Date.now()}-${safeFileName(file.name)}`

      const { error } = await supabase.storage
        .from(REQUEST_FILES_BUCKET)
        .upload(path, file)

      if (error) throw error

      const { data: publicUrlData } = supabase.storage
        .from(REQUEST_FILES_BUCKET)
        .getPublicUrl(path)

      if (leadId) {
        const { error: fileInsertError } = await supabase.from('files').insert({
          lead_id: leadId,
          file_url: publicUrlData.publicUrl,
          file_name: file.name,
          storage_path: path,
          file_type: type,
          mime_type: file.type || null,
          file_size: file.size,
        })

        if (fileInsertError) {
          console.warn('File uploaded, but file database row was not saved:', fileInsertError)
        }
      }

      uploaded.push({
        name: file.name,
        path,
        url: publicUrlData.publicUrl,
        bucket: REQUEST_FILES_BUCKET,
        type,
      })
    }

    return uploaded
  }

  async function createRequestFileUrl(file: StoredFile, download = false) {
    const bucket = file.bucket || REQUEST_FILES_BUCKET
    const path = file.path || storagePathFromPublicUrl(file.url || '', bucket)

    if (!path) {
      if (file.url) return file.url
      throw new Error('Missing file storage path.')
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 10, download ? { download: file.name } : undefined)

    if (error || !data?.signedUrl) {
      throw error || new Error('Signed URL was not returned.')
    }

    return data.signedUrl
  }

  async function openRequestFile(file: StoredFile, download = false) {
    try {
      const signedUrl = await createRequestFileUrl(file, download)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      console.error(error)
      alert('Could not open file. Check Supabase storage bucket/policies.')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuccessMessage('')

    if (!requesterName || !email || !propertyAddress || !city || !stateValue || !zip || !description) {
      alert('Please fill out all required fields.')
      return
    }

    setSubmitting(true)

    try {
      const { data: leadRow, error: leadError } = await supabase
        .from('leads')
        .insert({
          name: requesterName,
          email,
          phone,
          address: propertyAddress,
          city,
          state: stateValue,
          zip,
          description,
          status: 'new',
        })
        .select('id, created_at')
        .single()

      if (leadError) throw leadError

      const verifiedPropertyFacts = {
        ...propertyFacts,
        propertyType,
        jurisdiction: jurisdiction || propertyResearchPack.jurisdiction,
        zoning,
        parcelNumber,
        verified: true,
        verificationNotes,
      }

      const { error: propertyUpdateError } = await supabase
        .from('leads')
        .update({
          property_facts: verifiedPropertyFacts,
          property_verified: true,
          property_jurisdiction: verifiedPropertyFacts.jurisdiction,
          property_type: propertyType,
          zoning,
          parcel_number: parcelNumber,
        })
        .eq('id', leadRow.id)

      if (propertyUpdateError) {
        console.warn('Lead saved, but property intelligence fields were not saved:', propertyUpdateError)
      }

      const photos = await uploadRequestFiles(photoFiles, 'photos', 'photo', leadRow.id)
      const documents = await uploadRequestFiles(documentFiles, 'documents', 'document', leadRow.id)

      const newRequest: WorkRequest = {
        id: leadRow?.id || makeId(),
        createdAt: leadRow?.created_at
          ? new Date(leadRow.created_at).toLocaleString()
          : new Date().toLocaleString(),
        requesterName,
        email,
        phone,
        workType,
        propertyAddress,
        city,
        state: stateValue,
        zip,
        urgency,
        occupancy,
        timeline,
        propertyFacts: verifiedPropertyFacts,
        description,
        photos,
        documents,
        status: 'new',
      }

      setRequests((prev) => [newRequest, ...prev])
      setSuccessMessage('Request submitted. Shelter Prep will review and follow up.')
      resetForm()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Upload failed. Check Supabase storage bucket/policies.')
    } finally {
      setSubmitting(false)
    }
  }

  async function updateStatus(id: string, status: RequestStatus) {
    try {
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))

      const { error } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', id)

      if (error) throw error
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not update lead status.')
      await loadRequestsFromSupabase()
    }
  }

  async function archiveLead(request: WorkRequest) {
    const confirmed = window.confirm(
      `Archive this lead?

${request.propertyAddress || 'Untitled lead'}

This will hide it from the dashboard without deleting linked estimates, files, messages, or research.`
    )

    if (!confirmed) return

    try {
      setRequests((prev) => prev.filter((item) => item.id !== request.id))

      const { error } = await supabase
        .from('leads')
        .update({
          archived: true,
          archived_at: new Date().toISOString(),
        })
        .eq('id', request.id)

      if (error) throw error

      if (activeTab === 'archived') {
        await loadArchivedRequestsFromSupabase()
      }

      if (selectedEstimateRequest?.id === request.id) {
        setSelectedEstimateRequest(null)
        setEstimateItems([])
        setEstimateResearchRows([])
        setEstimateIntelligence(null)
      }
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not archive lead.')
      await loadRequestsFromSupabase()
    }
  }

  async function runAiEstimate(request: WorkRequest) {
    setAiLoadingId(request.id)

    try {
      const { data, error } = await supabase.functions.invoke('ai-estimator', {
        body: {
          projectType: request.workType,
          location: `${request.city}, ${request.state} ${request.zip}`,
          scope: request.description,
          timeline: request.timeline,
          notes: `Urgency: ${request.urgency}. Occupancy: ${request.occupancy}. Address: ${request.propertyAddress}`,
          files: [...request.photos, ...request.documents],
        },
      })
      
      if (error) {
        console.error(error)
        alert('AI error: ' + error.message)
        return
      }

      const estimate: AiEstimate = data?.estimate || {
        projectSummary: data?.summary || 'AI estimate completed.',
        lowPrice: data?.lowEstimate || 0,
        standardPrice: data?.standardEstimate || data?.highEstimate || 0,
        premiumPrice: data?.premiumEstimate || data?.highEstimate || 0,
        pricingRationale: data?.pricingRationale || '',
      }

      setRequests((prev) =>
        prev.map((r) =>
          r.id === request.id
            ? { ...r, status: 'estimate_ready', aiEstimate: estimate }
            : r
        )
      )

      alert(estimate.projectSummary || 'AI estimate completed.')
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'AI estimator failed.')
    } finally {
      setAiLoadingId(null)
    }
  }
  
  
  // PASTE SELLER PREP FUNCTION HERE
  async function runSellerPrepAnalysis(request: WorkRequest) {
    const confirmStart = window.confirm(
      'This will create Seller Prep Intelligence: buyer impact score, inspection risk score, repair-vs-credit recommendation, and seller net impact. Continue?'
    )
  
    if (!confirmStart) return
  
    if (!AGENT_API_KEY || AGENT_API_KEY === 'PASTE_YOUR_AGENT_API_KEY_HERE') {
      alert('Please add VITE_AGENT_API_KEY to your environment variables first.')
      return
    }
  
    setSellerPrepLoadingId(request.id)

    try {
      const response = await fetch(`${AGENT_API_URL}/run-seller-prep-analysis`, {
        method: 'POST',
        headers: createAgentHeaders(),
        body: JSON.stringify({
          leadId: request.id,
          description: request.description,
          workType: request.workType || '',
          zip: request.zip || '',
          request,
        }),
      })
  
      const result = await response.json()
  
      if (!response.ok) {
        throw new Error(result.error || 'Seller Prep analysis failed.')
      }
  
      alert(
        `Seller Prep analysis created. Items: ${result.itemCount || 0}. Human review required.`
      )
  
      await loadRequestsFromSupabase()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Seller Prep analysis failed.')
    } finally {
      setSellerPrepLoadingId(null)
    }
  }


  function formatSellerPrepMoney(value: any) {
    const number = Number(value || 0)
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(number)
  }

  function cleanSellerPrepText(value: any) {
    return escapeHtml(value)
  }

  function sellerPrepLabel(value: any) {
    return String(value || 'needs_human_review')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  }

  function printSellerPrepReport() {
    if (!sellerPrepReview) {
      alert('Open a Seller Prep Review first.')
      return
    }

    const analysis = sellerPrepReview.analysis || {}
    const items = sellerPrepReview.items || []

    const itemRows = items
      .map(
        (item: any) => `
          <div class="item">
            <h3>${cleanSellerPrepText(item.repair_item)}</h3>
            <p>${cleanSellerPrepText(item.scope_summary || 'No scope summary.')}</p>
            <div class="grid">
              <div><strong>Trade:</strong> ${cleanSellerPrepText(item.trade_category || 'General')}</div>
              <div><strong>Cost Range:</strong> ${formatSellerPrepMoney(item.estimated_cost_low)} - ${formatSellerPrepMoney(item.estimated_cost_high)}</div>
              <div><strong>Buyer Impact:</strong> ${item.buyer_impact_score || 0}/10</div>
              <div><strong>Inspection Risk:</strong> ${item.inspection_risk_score || 0}/10</div>
              <div><strong>Value / Negotiation Impact:</strong> ${formatSellerPrepMoney(item.estimated_value_impact_low)} - ${formatSellerPrepMoney(item.estimated_value_impact_high)}</div>
              <div><strong>Seller Net Impact:</strong> ${formatSellerPrepMoney(item.seller_net_impact_low)} - ${formatSellerPrepMoney(item.seller_net_impact_high)}</div>
              <div><strong>Recommendation:</strong> ${sellerPrepLabel(item.recommendation)}</div>
              <div><strong>Confidence:</strong> ${sellerPrepLabel(item.confidence)}</div>
            </div>
          </div>
        `
      )
      .join('')

    const html = `
      <!doctype html>
      <html>
        <head>
          <title>Seller Prep Report</title>
          <style>
            body { font-family: Arial, sans-serif; color: #123225; padding: 36px; line-height: 1.45; }
            .brand { letter-spacing: 8px; color: #06542d; font-size: 28px; font-weight: 800; margin-bottom: 4px; }
            .subbrand { letter-spacing: 5px; font-size: 12px; font-weight: 700; margin-bottom: 28px; }
            .summary { background: #e8f5eb; border: 1px solid #b7dfc1; border-radius: 14px; padding: 18px; margin: 18px 0; }
            .warning { background: #fff7df; border: 1px solid #eed38a; color: #6b4a00; border-radius: 14px; padding: 14px; margin: 18px 0; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; }
            .item { border: 1px solid #ddd; border-radius: 14px; padding: 16px; margin: 14px 0; page-break-inside: avoid; }
            h1, h2, h3 { color: #06542d; }
            .footer { margin-top: 32px; font-size: 12px; color: #555; border-top: 1px solid #ddd; padding-top: 12px; }
            @media print { button { display: none; } body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="brand">SHELTER PREP</div>
          <div class="subbrand">HOME SERVICES</div>
          <h1>Seller Prep Report</h1>
          <p><strong>Powered by AI. Approved by humans.</strong></p>
          <div class="summary">
            <h2>Property Summary</h2>
            <p><strong>Address:</strong> ${cleanSellerPrepText(analysis.property_address || 'Not provided')}</p>
            <p><strong>Total Repair Range:</strong> ${formatSellerPrepMoney(analysis.total_repair_low)} - ${formatSellerPrepMoney(analysis.total_repair_high)}</p>
            <p><strong>Possible Value / Negotiation Impact:</strong> ${formatSellerPrepMoney(analysis.total_value_impact_low)} - ${formatSellerPrepMoney(analysis.total_value_impact_high)}</p>
            <p><strong>Seller Net Impact:</strong> ${formatSellerPrepMoney(analysis.seller_net_low)} - ${formatSellerPrepMoney(analysis.seller_net_high)}</p>
            <p><strong>Average Buyer Impact:</strong> ${analysis.average_buyer_impact_score || 0}/10</p>
            <p><strong>Average Inspection Risk:</strong> ${analysis.average_inspection_risk_score || 0}/10</p>
          </div>
          <div class="warning">AI-assisted analysis only. Human review is required before sending, approving, ordering materials, submitting proposals, or making final recommendations.</div>
          <h2>Agent Summary</h2>
          <p>${cleanSellerPrepText(analysis.agent_summary || 'No agent summary available.')}</p>
          <h2>Seller Summary</h2>
          <p>${cleanSellerPrepText(analysis.seller_summary || 'No seller summary available.')}</p>
          <h2>Repair Items</h2>
          ${itemRows || '<p>No seller prep items found.</p>'}
          <div class="footer">Shelter Prep report. AI-assisted draft. Human review required.</div>
          <script>window.onload = function () { window.print() }</script>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Popup blocked. Please allow popups, then try again.')
      return
    }

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  async function openSellerPrepReview(request: WorkRequest) {
    setSellerPrepLoadingId(request.id)
  
    try {
      const { data: analyses, error: analysisError } = await supabase
        .from('seller_prep_analyses')
        .select('*')
        .eq('lead_id', request.id)
        .order('created_at', { ascending: false })
        .limit(1)
  
      if (analysisError) throw analysisError
  
      const analysis = analyses?.[0]
  
      if (!analysis) {
        alert('No Seller Prep analysis found yet. Click Run Seller Prep Analysis first.')
        return
      }
      const { data: items, error: itemsError } = await supabase
        .from('seller_prep_items')
        .select('*')
        .eq('analysis_id', analysis.id)
        .order('sort_order', { ascending: true })
  
      if (itemsError) throw itemsError
  
      setSellerPrepReview({
        analysis,
        items: items || [],
      })
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not open Seller Prep Review.')
    } finally {
      setSellerPrepLoadingId(null)
    }
  }

  function buildSellerPrepDraft(request: WorkRequest) {
    const intelligence = buildEstimateIntelligence({
      id: request.id,
      workType: request.workType,
      description: request.description,
      urgency: request.urgency,
      occupancy: request.occupancy,
      timeline: request.timeline,
      city: request.city,
      state: request.state,
      zip: request.zip,
      propertyFacts: request.propertyFacts,
      photoCount: request.photos.length,
      documentCount: request.documents.length,
    })

    const missing = getMissingInfoItems(request)
    const highRisk = normalizeLaborText([request.description, request.workType].join(' '))
    const baseItems = intelligence.draftItems.slice(0, 4).map((item, index) => {
      const total = Number(item.quantity || 0) * Number(item.unitPrice || 0)
      const mustFix =
        highRisk.includes('inspection') ||
        highRisk.includes('roof') ||
        highRisk.includes('leak') ||
        highRisk.includes('electrical') ||
        highRisk.includes('plumb')

      return {
        id: makeId(),
        analysis_id: '',
        repair_item: item.itemName.replace(/\s*\([^)]*\)\s*$/, ''),
        trade_category: intelligence.tradeBreakdown[index] || intelligence.primaryTrade,
        estimated_low: Math.round(total * 0.9),
        estimated_high: Math.round(total * 1.25 + intelligence.laborSubtotal / Math.max(intelligence.draftItems.length, 1)),
        buyer_impact_score: mustFix ? 8 : index === 0 ? 7 : 5,
        inspection_risk_score: mustFix ? 8 : missing.length ? 6 : 4,
        recommendation: mustFix ? 'must_fix' : index % 2 === 0 ? 'optional' : 'buyer_credit_candidate',
        missing_info: missing.join(', ') || 'None obvious',
        ai_notes: `Rule-based V1 draft. Quantity basis: ${intelligence.quantityBasis.join('; ')}`,
        human_review_status: 'needs_review',
      } satisfies SellerPrepItemV1
    })

    const items = baseItems.length
      ? baseItems
      : [
          {
            id: makeId(),
            analysis_id: '',
            repair_item: request.workType || 'General seller prep repair',
            trade_category: 'General Repair',
            estimated_low: Math.round(intelligence.suggestedLow),
            estimated_high: Math.round(intelligence.suggestedHigh),
            buyer_impact_score: 6,
            inspection_risk_score: missing.length ? 6 : 4,
            recommendation: 'needs_human_review',
            missing_info: missing.join(', ') || 'None obvious',
            ai_notes: 'Rule-based V1 fallback item. Human review required.',
            human_review_status: 'needs_review',
          },
        ]

    const totalLow = items.reduce((sum, item) => sum + Number(item.estimated_low || 0), 0)
    const totalHigh = items.reduce((sum, item) => sum + Number(item.estimated_high || 0), 0)
    const analysis: SellerPrepAnalysisV1 = {
      id: makeId(),
      lead_id: request.id,
      property_address: request.propertyAddress,
      summary: `${request.workType} seller-prep draft for ${request.propertyAddress || 'the property'}. Review ${items.length} item(s), missing info, likely buyer impact, and inspection risk before sharing.`,
      total_low_estimate: totalLow,
      total_high_estimate: totalHigh,
      seller_net_impact:
        totalHigh > 0
          ? `Draft prep range is ${money(totalLow)} - ${money(totalHigh)}. Must-fix items may reduce buyer credits or inspection friction, but human review is required before recommendations.`
          : 'No priced seller-prep range yet. Add details and review manually.',
      confidence: missing.length ? 'medium_with_missing_info' : 'medium_rule_based',
      human_review_status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    return { analysis, items }
  }

  async function runSellerPrepDraftV1(request: WorkRequest) {
    const { analysis, items } = buildSellerPrepDraft(request)
    setSellerPrepAnalysisV1(analysis)
    setSellerPrepItemsV1(items)
    setSellerPrepSelectedId(request.id)
    setActiveTab('sellerPrep')

    try {
      const { data: savedAnalysis, error: analysisError } = await supabase
        .from('seller_prep_analyses')
        .insert({
          lead_id: request.id,
          property_address: request.propertyAddress,
          summary: analysis.summary,
          total_low_estimate: analysis.total_low_estimate,
          total_high_estimate: analysis.total_high_estimate,
          seller_net_impact: analysis.seller_net_impact,
          confidence: analysis.confidence,
          human_review_status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (analysisError) throw analysisError

      const nextItems = items.map((item) => ({
        analysis_id: savedAnalysis.id,
        repair_item: item.repair_item,
        trade_category: item.trade_category,
        estimated_low: item.estimated_low,
        estimated_high: item.estimated_high,
        buyer_impact_score: item.buyer_impact_score,
        inspection_risk_score: item.inspection_risk_score,
        recommendation: item.recommendation,
        missing_info: item.missing_info,
        ai_notes: item.ai_notes,
        human_review_status: 'needs_review',
      }))

      const { data: savedItems, error: itemsError } = await supabase
        .from('seller_prep_items')
        .insert(nextItems)
        .select()

      if (itemsError) throw itemsError

      setSellerPrepAnalysisV1(savedAnalysis as SellerPrepAnalysisV1)
      setSellerPrepItemsV1((savedItems || []) as SellerPrepItemV1[])
      alert('Seller Prep draft saved. Human approval is required before final report/send.')
    } catch (error: any) {
      console.error(error)
      alert(
        `${error?.message || 'Could not save Seller Prep draft to Supabase.'} Showing local draft only. Run the Seller Prep migration if needed.`
      )
    }
  }

  async function loadSellerPrepDraftForRequest(request: WorkRequest) {
    setSellerPrepSelectedId(request.id)
    setActiveTab('sellerPrep')

    const { data: analyses, error } = await supabase
      .from('seller_prep_analyses')
      .select('*')
      .eq('lead_id', request.id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !analyses?.[0]) {
      runSellerPrepDraftV1(request)
      return
    }

    const analysis = analyses[0] as SellerPrepAnalysisV1
    const { data: items, error: itemsError } = await supabase
      .from('seller_prep_items')
      .select('*')
      .eq('analysis_id', analysis.id)
      .order('created_at', { ascending: true })

    if (itemsError) {
      alert(itemsError.message)
      return
    }

    setSellerPrepAnalysisV1(analysis)
    setSellerPrepItemsV1((items || []) as SellerPrepItemV1[])
  }

  function updateSellerPrepItemLocal(id: string, changes: Partial<SellerPrepItemV1>) {
    setSellerPrepItemsV1((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...changes } : item))
    )
  }

  async function saveSellerPrepItem(item: SellerPrepItemV1) {
    setSellerPrepSavingId(item.id)

    try {
      const { data, error } = await supabase
        .from('seller_prep_items')
        .update({
          estimated_low: Number(item.estimated_low || 0),
          estimated_high: Number(item.estimated_high || 0),
          recommendation: item.recommendation || 'needs_human_review',
          human_review_status: item.human_review_status || 'needs_review',
          missing_info: item.missing_info || '',
          ai_notes: item.ai_notes || '',
        })
        .eq('id', item.id)
        .select()
        .single()

      if (error) throw error

      updateSellerPrepItemLocal(item.id, data as SellerPrepItemV1)
    } catch (error: any) {
      alert(error?.message || 'Could not save Seller Prep item.')
    } finally {
      setSellerPrepSavingId(null)
    }
  }

  async function markSellerPrepAnalysisApproved() {
    if (!sellerPrepAnalysisV1) return
    const unapproved = sellerPrepItemsV1.some((item) => item.human_review_status !== 'approved')

    if (unapproved) {
      alert('Approve or reject each Seller Prep item before marking the analysis human approved.')
      return
    }

    const { data, error } = await supabase
      .from('seller_prep_analyses')
      .update({ human_review_status: 'human_approved', updated_at: new Date().toISOString() })
      .eq('id', sellerPrepAnalysisV1.id)
      .select()
      .single()

    if (error) {
      alert(error.message)
      return
    }

    setSellerPrepAnalysisV1(data as SellerPrepAnalysisV1)
  }

  async function saveSellerPrepItemAsPricingMemory(item: SellerPrepItemV1) {
    const selected = requests.find((request) => request.id === sellerPrepSelectedId)

    if (item.human_review_status !== 'approved') {
      alert('Approve the Seller Prep item before saving it as pricing memory.')
      return
    }

    const verifiedPrice = Number(item.estimated_high || item.estimated_low || 0)
    if (verifiedPrice <= 0) {
      alert('Add a verified estimate amount before saving pricing memory.')
      return
    }

    const { error } = await supabase.from('pricing_memory_entries').insert({
      item_name: item.repair_item,
      category: item.recommendation || 'seller_prep',
      trade: item.trade_category || '',
      repair_type: item.repair_item,
      description: item.ai_notes || '',
      city: selected?.city || '',
      state: selected?.state || '',
      zip: selected?.zip || '',
      property_type: selected?.propertyFacts?.propertyType || '',
      unit: 'project',
      verified_price: verifiedPrice,
      unit_cost: verifiedPrice,
      total_cost: verifiedPrice,
      source: 'seller_prep_human_approved',
      confidence_level: 'medium',
      human_verified: true,
      notes: `Saved from Seller Prep item ${item.id}. Human approved before pricing memory.`,
      last_checked: new Date().toISOString(),
    })

    if (error) {
      alert(error.message)
      return
    }

    alert('Saved as verified pricing memory.')
    await loadPricingMemoryEntries()
  }

  async function ensureLeadExists(request: WorkRequest) {
    const { data: existing, error: selectError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', request.id)
      .maybeSingle()

    if (selectError) throw selectError
    if (existing?.id) return

    const { error: insertError } = await supabase.from('leads').insert({
      id: request.id,
      name: request.requesterName,
      email: request.email,
      phone: request.phone,
      address: request.propertyAddress,
      city: request.city,
      state: request.state,
      zip: request.zip,
      description: request.description,
      status: request.status,
    })

    if (insertError) throw insertError
  }

  async function researchMaterials(request: WorkRequest) {
    const confirmStart = window.confirm(
      'This will create an AI material research draft only. Human review is required before any estimate, proposal, purchase order, email, or submission is sent.'
    )

    if (!confirmStart) return

    if (!AGENT_API_KEY || AGENT_API_KEY === 'PASTE_YOUR_AGENT_API_KEY_HERE') {
      alert('Please add VITE_AGENT_API_KEY to your environment variables first.')
      return
    }

    setResearchingId(request.id)

    try {
      await ensureLeadExists(request)

      const response = await fetch(`${AGENT_API_URL}/research-materials`, {
        method: 'POST',
        headers: createAgentHeaders(),
        body: JSON.stringify({
          leadId: request.id,
          description: request.description,
          zip: request.zip,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'AI material research failed.')
      }

      alert(
        `AI research draft created. ${result.itemCount || 0} estimate items saved. Human review required.`
      )
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'AI material research failed.')
    } finally {
      setResearchingId(null)
    }
  }


  async function generateRoughMaterialList(request: WorkRequest) {
    const confirmStart = window.confirm(
      'This will create a rough material list with draft quantities and prices. Human review is required before any estimate, proposal, purchase order, email, submission, or material order.'
    )

    if (!confirmStart) return

    if (!AGENT_API_KEY || AGENT_API_KEY === 'PASTE_YOUR_AGENT_API_KEY_HERE') {
      alert('Please add VITE_AGENT_API_KEY to your environment variables first.')
      return
    }

    setMaterialListLoadingId(request.id)

    try {
      await ensureLeadExists(request)

      const response = await fetch(`${AGENT_API_URL}/generate-material-list`, {
        method: 'POST',
        headers: createAgentHeaders(),
        body: JSON.stringify({
          leadId: request.id,
          description: request.description,
          workType: request.workType,
          zip: request.zip,
          request,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result?.error || 'Rough material list failed.')
      }

      alert(
        `Rough material list created. ${result.itemCount || 0} priced material items saved to Estimate Review. Human review required.`
      )
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Rough material list failed.')
    } finally {
      setMaterialListLoadingId(null)
    }
  }


  async function generateAiTakeoff(request: WorkRequest) {
    const confirmStart = window.confirm(
      'This will create a rough AI quantity takeoff for sqft, linear feet, cubic yards, gallons, bundles, sheets, and draft material quantities. Human/site verification is required before any estimate, proposal, purchase order, email, submission, or material order.'
    )

    if (!confirmStart) return

    if (!AGENT_API_KEY || AGENT_API_KEY === 'PASTE_YOUR_AGENT_API_KEY_HERE') {
      alert('Please add VITE_AGENT_API_KEY to your environment variables first.')
      return
    }

    setTakeoffLoadingId(request.id)

    try {
      await ensureLeadExists(request)

      const response = await fetch(`${AGENT_API_URL}/generate-takeoff`, {
        method: 'POST',
        headers: createAgentHeaders(),
        body: JSON.stringify({
          leadId: request.id,
          description: request.description,
          workType: request.workType,
          zip: request.zip,
          request,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result?.error || 'AI takeoff failed.')
      }

      alert(
        `AI quantity takeoff created. ${result.measurementCount || 0} measurements and ${result.itemCount || 0} priced material items saved. Open Estimate Review to review/edit/approve. Human verification required.`
      )
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'AI takeoff failed.')
    } finally {
      setTakeoffLoadingId(null)
    }
  }

  async function buildMaterialEstimate(request: WorkRequest) {
    const confirmStart = window.confirm(
      'Build one material estimate draft: scope, quantity takeoff, product/package matching, package math, pricing, and review lines. AI drafts only; human approval is required before estimates, proposals, or material orders.'
    )

    if (!confirmStart) return

    setMaterialEstimateLoadingId(request.id)

    try {
      await ensureLeadExists(request)

      const { data: memoryRows, error: memoryError } = await supabase
        .from('pricing_memory_entries')
        .select('*')
        .eq('human_verified', true)
        .order('last_checked', { ascending: false })

      if (memoryError) throw memoryError

      const sourceText = [request.workType, request.description].join(' ').toLowerCase()
      if (!sourceText.includes('deck')) {
        alert('No current-scope material package template matched this job yet. Add materials manually or use AI Research Materials for this request.')
        return
      }

      const draftLines = buildDeckMaterialEstimateLines(request, (memoryRows || []) as PricingMemoryEntry[])

      const inserts = draftLines.map((line) => ({
        property_id: getRequestPropertyId(request),
        job_id: request.id,
        request_id: request.id,
        repair_item_id: getDefaultRepairItemId(request, line.materialName),
        lead_id: request.id,
        item_name: line.materialName,
        category: line.category,
        source: line.source,
        source_url: line.sourceUrl,
        quantity: line.packagesNeeded,
        unit_price: line.packagePrice,
        original_unit_price: line.packagePrice,
        total_price: line.extendedTotal,
        required_quantity: line.requiredQuantity,
        required_unit: line.requiredUnit,
        package_size: line.packageSize,
        package_unit: line.packageUnit,
        package_coverage: line.packageCoverage,
        package_coverage_unit: line.packageCoverageUnit,
        packages_needed: line.packagesNeeded,
        package_price: line.packagePrice,
        extended_total: line.extendedTotal,
        quantity_reason: line.quantityReason,
        scope_source: 'current_request_scope',
        relevance_reason: `${request.workType || 'Deck'} scope: ${line.category}`,
        source_status: line.sourceStatus,
        review_status: line.reviewStatus,
        confidence: line.confidence,
        human_approved: false,
      }))

      const { data, error } = await supabase
        .from('estimate_items')
        .insert(inserts)
        .select()

      if (error) {
        if (String(error.message || '').includes('column')) {
          throw new Error('Material package columns are missing. Run migration 202605110003_material_package_estimates.sql first.')
        }
        throw error
      }

      setActiveTab('estimates')
      setSelectedEstimateRequest(request)
      setEstimateItems((data || []) as EstimateItem[])
      setEstimateResearchRows([])
      setEstimateIntelligence(null)
      await applyBestLaborRateForRequest(request, false)

      alert(
        `Material estimate built with ${draftLines.length} review lines. Package math was used for roll/box/bag pricing. Human review is required before use.`
      )
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not build material estimate.')
    } finally {
      setMaterialEstimateLoadingId(null)
    }
  }

  async function autoProcessLead(request: WorkRequest) {
    const confirmStart = window.confirm(
      'This will auto-process the lead: AI intake review, quantity takeoff, material pricing, missing-info draft, and status update. It will NOT send emails, submit proposals, order materials, or approve estimates. Human review is still required.'
    )
  
    if (!confirmStart) return
  
    if (!AGENT_API_KEY || AGENT_API_KEY === 'PASTE_YOUR_AGENT_API_KEY_HERE') {
      alert('Please add VITE_AGENT_API_KEY to your environment variables first.')
      return
    }
  
    setAutoWorkflowLoadingId(request.id)
  
    try {
      await ensureLeadExists(request)
  
      const response = await fetch(`${AGENT_API_URL}/auto-process-lead`, {
        method: 'POST',
        headers: createAgentHeaders(),
        body: JSON.stringify({
          leadId: request.id,
          description: request.description,
          workType: request.workType,
          zip: request.zip,
          request,
        }),
      })
  
      const result = await response.json().catch(() => ({}))
  
      if (!response.ok) {
        throw new Error(result?.error || 'Auto workflow failed.')
      }
  
      alert(
        `Auto workflow complete. Status: ${
          result.nextStatus || 'review'
        }. ${result.itemCount || 0} draft items created. ${
          result.missingInfo?.length || 0
        } missing-info items found. Human review required.`
      )
  
      await loadRequestsFromSupabase()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Auto workflow failed.')
    } finally {
      setAutoWorkflowLoadingId(null)
    }
  }

  async function applyBestLaborRateForRequest(request: WorkRequest, showAlert = true) {
    try {
      const { data, error } = await supabase
        .from('labor_rates')
        .select('*')
        .eq('human_verified', true)
        .gt('typical_rate', 0)
        .order('last_checked', { ascending: false })

      if (error) throw error

      const rates = ((data || []) as LaborRate[]).filter((rate) =>
        Number(rate.typical_rate || 0) > 0
      )

      const scored = rates
        .map((rate) => ({ rate, score: scoreLaborRateForRequest(rate, request) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)

      const best = scored[0]?.rate || null

      if (!best) {
        setAppliedLaborRate(null)
        setEstimateLaborUnits('4')
        setEstimateMinimumCharge('0')
        setEstimateTripCharge('0')
        setEstimateDisposalFee('0')
        setEstimateLaborMessage(
          'No verified labor rate matched this job yet. Add or approve a labor rate, or enter labor manually.'
        )

        if (showAlert) {
          alert('No verified labor rate matched this job yet. Add/approve one in Labor Rates or enter labor manually.')
        }

        return null
      }

      const defaultUnits = getDefaultLaborUnits(best, request)
      const minimum = Number(best.minimum_charge || 0)
      const trip = Number(best.trip_charge || 0)
      const disposal = Number(best.disposal_fee || 0)
      const calculatedTotal = calculateLaborTotalFromRate(
        best,
        String(defaultUnits),
        String(minimum),
        String(trip),
        String(disposal)
      )

      setAppliedLaborRate(best)
      setEstimateLaborUnits(String(defaultUnits))
      setEstimateMinimumCharge(String(minimum))
      setEstimateTripCharge(String(trip))
      setEstimateDisposalFee(String(disposal))
      setEstimateLaborCost(String(calculatedTotal))
      setEstimateLaborMessage(
        `Applied verified labor rate: ${best.trade}${best.job_type ? ` / ${best.job_type}` : ''} at ${money(Number(best.typical_rate || 0))}/${best.unit || 'hour'}.`
      )

      return best
    } catch (error: any) {
      console.error(error)
      setEstimateLaborMessage(error?.message || 'Could not load labor rates.')

      if (showAlert) {
        alert(error?.message || 'Could not load labor rates.')
      }

      return null
    }
  }

  async function openEstimateReview(request: WorkRequest) {
    setActiveTab('estimates')
    setSelectedEstimateRequest(request)
    setEstimateLoading(true)

    try {
      await ensureLeadExists(request)

      const { data: items, error: itemError } = await supabase
        .from('estimate_items')
        .select('*')
        .eq('lead_id', request.id)
        .order('created_at', { ascending: true })

      if (itemError) throw itemError

      const { data: researchRows, error: researchError } = await supabase
        .from('estimate_research')
        .select('*')
        .eq('lead_id', request.id)
        .order('created_at', { ascending: false })

      if (researchError) throw researchError

      setEstimateItems((items || []) as EstimateItem[])
      setEstimateResearchRows((researchRows || []) as EstimateResearchRow[])
      setEstimateIntelligence(null)
      await applyBestLaborRateForRequest(request, false)

      if (!items || items.length === 0) {
        alert('No estimate items found yet. Click AI Research Materials on this request first, or add manual line items in the estimator.')
      }
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not load estimate review.')
    } finally {
      setEstimateLoading(false)
    }
  }

  async function buildLocalEstimateIntelligence(request: WorkRequest) {
    const confirmStart = window.confirm(
      'This will build a local Shelter Prep estimate intelligence draft: rough quantities, material allowances, urgency labor, overhead, coordination, risk buffers, and a contractor packet. Human review is required before use.'
    )

    if (!confirmStart) return

    const result = buildEstimateIntelligence({
      id: request.id,
      workType: request.workType,
      description: request.description,
      urgency: request.urgency,
      occupancy: request.occupancy,
      timeline: request.timeline,
      city: request.city,
      state: request.state,
      zip: request.zip,
      propertyFacts: request.propertyFacts,
      photoCount: request.photos.length,
      documentCount: request.documents.length,
    })

    setEstimateIntelligence(result)
    setEstimateLaborUnits(String(result.laborHours))
    setEstimateLaborCost(String(result.laborSubtotal))
    setEstimateMinimumCharge('0')
    setEstimateTripCharge('0')
    setEstimateDisposalFee('0')
    setAppliedLaborRate(null)
    setEstimateMarkupPercent(String(result.overheadPercent + result.coordinationPercent))
    setEstimateContingencyPercent(String(result.riskPercent))
    setEstimateLaborMessage(
      `Applied Shelter Prep ${result.primaryTrade} intelligence: ${result.laborHours} hours at ${money(result.laborRate)}/hr blended ${result.urgencyMultiplier > 1 ? 'urgent' : 'standard'} rate.`
    )
    setEstimateNotes(
      [
        'Shelter Prep Estimate Intelligence draft. Human/site verification required.',
        `Trades: ${result.tradeBreakdown.join(', ')}`,
        `Quantity basis: ${result.quantityBasis.join('; ')}`,
        `Missing info: ${result.missingInfo.join(', ') || 'none obvious'}`,
        `Risk flags: ${result.riskFlags.join('; ') || 'standard risk'}`,
      ].join('\n')
    )

    const shouldSaveItems = window.confirm(
      `Draft range: ${money(result.suggestedLow)} - ${money(result.suggestedHigh)}. Save ${result.draftItems.length} draft material/allowance line items into Estimate Review?`
    )

    if (!shouldSaveItems) {
      setActiveTab('estimates')
      setSelectedEstimateRequest(request)
      return
    }

    try {
      await ensureLeadExists(request)

      const inserts = result.draftItems.map((item) => ({
        property_id: getRequestPropertyId(request),
        job_id: request.id,
        request_id: request.id,
        repair_item_id: getDefaultRepairItemId(request, item.itemName),
        lead_id: request.id,
        item_name: `${item.itemName} (${item.unit})`,
        source: item.source,
        source_url: null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        original_unit_price: item.unitPrice,
        total_price: item.quantity * item.unitPrice,
        scope_source: 'estimate_intelligence_current_scope',
        relevance_reason: `${request.workType || 'Current'} scope: ${item.itemName}`,
        source_status: item.source === 'fallback_product_search' ? 'needs_source_review' : 'current_scope',
        review_status: 'needs_review',
        confidence: item.confidence,
        human_approved: false,
      }))

      const { data, error } = await supabase
        .from('estimate_items')
        .insert(inserts)
        .select()

      if (error) throw error

      setActiveTab('estimates')
      setSelectedEstimateRequest(request)
      setEstimateItems((prev) => [...prev, ...((data || []) as EstimateItem[])])
      alert('Estimate intelligence draft saved. Review and approve line items before sending anything.')
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save estimate intelligence draft items.')
    }
  }

  function updateLocalEstimateItem(id: string, changes: Partial<EstimateItem>) {
    setEstimateItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const next = { ...item, ...changes }
        const qty = Number(next.quantity || 0)
        const unit = Number(next.unit_price || 0)
        return { ...next, total_price: qty * unit }
      })
    )
  }

  function updateManualMaterialDraft(changes: Partial<ManualMaterialDraft>) {
    setManualMaterialDraft((prev) => {
      const next = { ...prev, ...changes }
      const quantity = Number(next.quantity || 0)
      const unitCost = Number(next.unitCost || 0)

      if (
        (changes.quantity !== undefined || changes.unitCost !== undefined) &&
        quantity > 0 &&
        unitCost >= 0
      ) {
        next.totalCost = String(Math.round(quantity * unitCost * 100) / 100)
      }

      return next
    })
  }

  async function recordMaterialReviewLearning(
    item: EstimateItem,
    action: MaterialReviewAction,
    overrides: Partial<EstimateItem> = {}
  ) {
    const request = selectedEstimateRequest
    const reviewedItem = { ...item, ...overrides }
    const originalUnitPrice = Number(reviewedItem.original_unit_price ?? item.original_unit_price ?? item.unit_price ?? 0)
    const reviewedUnitPrice = Number(reviewedItem.unit_price || 0)
    const quantity = Number(reviewedItem.quantity || 0)
    const finalTotal = Number(reviewedItem.total_price || quantity * reviewedUnitPrice || 0)
    const now = new Date().toISOString()

    const memoryRecord = {
      property_id: reviewedItem.property_id || getRequestPropertyId(request),
      job_id: reviewedItem.job_id || request?.id || reviewedItem.lead_id,
      request_id: reviewedItem.request_id || request?.id || reviewedItem.lead_id,
      repair_item_id: reviewedItem.repair_item_id || getDefaultRepairItemId(request, reviewedItem.item_name),
      work_type: request?.workType || reviewedItem.category || 'Material estimate',
      repair_description: getCurrentScopeReason(request),
      material_name: reviewedItem.item_name,
      vendor_source: reviewedItem.source || '',
      source_url: reviewedItem.source_url || '',
      original_unit_price: originalUnitPrice,
      reviewed_unit_price: reviewedUnitPrice,
      quantity,
      final_total: finalTotal,
      admin_action: action,
      rejection_reason: reviewedItem.rejection_reason || null,
      admin_notes: reviewedItem.admin_notes || null,
      confidence_before: item.confidence || 'needs_review',
      confidence_after: reviewedItem.confidence || (action === 'rejected' ? 'human_rejected' : 'human_reviewed'),
      created_at: now,
      reviewed_at: now,
    }

    try {
      const { error } = await supabase.from('material_review_memory').insert(memoryRecord)
      if (error) throw error
    } catch (error) {
      console.warn('Material review memory table unavailable; storing local learning record.', error)
      const storageKey = 'shelter-prep-material-review-memory-v1'
      const existing = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
      window.localStorage.setItem(storageKey, JSON.stringify([memoryRecord, ...existing].slice(0, 200)))
    }
  }

  async function saveEstimateItem(item: EstimateItem, action: MaterialReviewAction = 'edited', logLearning = true) {
    setEstimateSavingId(item.id)

    const quantity = Number(item.quantity || 0)
    const unitPrice = Number(item.unit_price || 0)
    const totalPrice = quantity * unitPrice

    try {
      const { data, error } = await supabase
        .from('estimate_items')
        .update({
          property_id: item.property_id || getRequestPropertyId(selectedEstimateRequest),
          job_id: item.job_id || selectedEstimateRequest?.id || item.lead_id,
          request_id: item.request_id || selectedEstimateRequest?.id || item.lead_id,
          repair_item_id: item.repair_item_id || getDefaultRepairItemId(selectedEstimateRequest, item.item_name),
          item_name: item.item_name,
          category: item.category || null,
          source: item.source,
          source_url: item.source_url,
          quantity,
          unit_price: unitPrice,
          original_unit_price: item.original_unit_price ?? unitPrice,
          total_price: totalPrice,
          required_quantity: item.required_quantity ?? quantity,
          required_unit: item.required_unit || null,
          package_size: item.package_size ?? null,
          package_unit: item.package_unit || null,
          package_coverage: item.package_coverage ?? null,
          package_coverage_unit: item.package_coverage_unit || null,
          packages_needed: item.packages_needed ?? quantity,
          package_price: item.package_price ?? unitPrice,
          extended_total: item.extended_total ?? totalPrice,
          quantity_reason: item.quantity_reason || null,
          scope_source: item.scope_source || 'current_request_scope',
          relevance_reason: item.relevance_reason || getEstimateInclusionReason(item),
          source_status: item.source_status || 'needs_source_review',
          review_status: item.review_status === 'rejected' ? 'rejected' : item.human_approved ? 'approved' : item.review_status || 'needs_review',
          rejection_reason: item.rejection_reason || null,
          admin_notes: item.admin_notes || null,
          confidence: item.confidence || 'human_reviewed',
          human_approved: item.review_status === 'rejected' ? false : item.human_approved || false,
        })
        .eq('id', item.id)
        .select()
        .single()

      if (error) throw error

      setEstimateItems((prev) =>
        prev.map((existing) => (existing.id === item.id ? (data as EstimateItem) : existing))
      )
      if (logLearning) {
        await recordMaterialReviewLearning(data as EstimateItem, action, {
          total_price: totalPrice,
          unit_price: unitPrice,
        })
      }
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not save estimate item.')
    } finally {
      setEstimateSavingId(null)
    }
  }

  async function addManualEstimateItem() {
    if (!selectedEstimateRequest) {
      alert('Open a request in the estimate review first.')
      return
    }

    if (!manualMaterialDraft.itemName.trim()) {
      alert('Add a material name first.')
      return
    }

    try {
      await ensureLeadExists(selectedEstimateRequest)

      const quantity = Number(manualMaterialDraft.quantity || 0)
      const unitPrice = Number(manualMaterialDraft.unitCost || 0)
      const totalPrice = Number(manualMaterialDraft.totalCost || quantity * unitPrice || 0)
      const repairItemId =
        manualMaterialDraft.repairItemId.trim() ||
        getDefaultRepairItemId(selectedEstimateRequest, manualMaterialDraft.itemName)

      const { data, error } = await supabase
        .from('estimate_items')
        .insert({
          property_id: getRequestPropertyId(selectedEstimateRequest),
          job_id: selectedEstimateRequest.id,
          request_id: selectedEstimateRequest.id,
          repair_item_id: repairItemId,
          lead_id: selectedEstimateRequest.id,
          item_name: manualMaterialDraft.itemName.trim(),
          source: manualMaterialDraft.vendor.trim() || 'Human Review',
          source_url: manualMaterialDraft.sourceUrl.trim() || null,
          quantity,
          unit_price: unitPrice,
          original_unit_price: unitPrice,
          total_price: totalPrice,
          required_quantity: quantity,
          required_unit: 'units',
          packages_needed: quantity,
          package_price: unitPrice,
          extended_total: totalPrice,
          quantity_reason: manualMaterialDraft.notes.trim() || 'Human-added material for current job scope.',
          scope_source: 'human_added_current_scope',
          relevance_reason: `${selectedEstimateRequest.workType || 'Current'} scope: human-added material`,
          source_status: manualMaterialDraft.reviewStatus === 'approved' ? 'human_added' : 'needs_source_review',
          review_status: manualMaterialDraft.reviewStatus,
          confidence: 'human_added',
          human_approved: manualMaterialDraft.reviewStatus === 'approved',
          admin_notes: manualMaterialDraft.notes.trim() || null,
        })
        .select()
        .single()

      if (error) throw error

      const addedItem = data as EstimateItem
      setEstimateItems((prev) => [...prev, addedItem])
      setManualMaterialDraft(EMPTY_MANUAL_MATERIAL_DRAFT)
      setShowManualMaterialForm(false)
      await recordMaterialReviewLearning(addedItem, 'added')
    } catch (error: any) {
      console.error(error)
      if (String(error?.message || '').includes('column')) {
        alert('Material review columns are missing. Run migration 202605120002_material_review_learning.sql first.')
      } else {
        alert(error?.message || 'Could not add manual estimate item.')
      }
    }
  }

  async function toggleEstimateItemApproved(item: EstimateItem) {
    const nextApproved = !item.human_approved
    const updated = {
      ...item,
      human_approved: nextApproved,
      review_status: nextApproved ? 'approved' : 'needs_review',
      rejection_reason: nextApproved ? null : item.rejection_reason,
      confidence: nextApproved ? 'human_approved' : item.confidence,
    }
    updateLocalEstimateItem(item.id, updated)
    await saveEstimateItem(updated, nextApproved ? 'approved' : 'edited', false)
    if (nextApproved) await recordMaterialReviewLearning(updated, 'approved')
  }

  async function rejectEstimateItem(item: EstimateItem) {
    const reason = item.rejection_reason || 'Wrong material'
    if (!MATERIAL_REJECTION_REASONS.includes(reason)) {
      alert('Choose a rejection reason first.')
      return
    }

    const updated: EstimateItem = {
      ...item,
      human_approved: false,
      review_status: 'rejected',
      rejection_reason: reason,
      confidence: 'human_rejected',
    }

    updateLocalEstimateItem(item.id, updated)
    await saveEstimateItem(updated, 'rejected', false)
    await recordMaterialReviewLearning(updated, 'rejected')
  }

  async function approveAllEstimateItems() {
    const confirmApprove = window.confirm(
      'Approve all current line items for this draft? This still does not send a proposal or purchase order.'
    )

    if (!confirmApprove) return

    try {
      const approvableItems = currentScopeEstimateItems.filter((item) => !isEstimateItemRejected(item))
      const updates = approvableItems.map((item) =>
        supabase
          .from('estimate_items')
          .update({ human_approved: true, confidence: 'human_approved', review_status: 'approved', rejection_reason: null })
          .eq('id', item.id)
      )

      const results = await Promise.all(updates)
      const failed = results.find((result) => result.error)
      if (failed?.error) throw failed.error

      setEstimateItems((prev) =>
        prev.map((item) => ({
          ...item,
          ...(approvableItems.some((approved) => approved.id === item.id)
            ? {
                human_approved: true,
                confidence: 'human_approved',
                review_status: 'approved',
                rejection_reason: null,
              }
            : {}),
        }))
      )
      await Promise.all(
        approvableItems.map((item) =>
          recordMaterialReviewLearning(
            { ...item, human_approved: true, confidence: 'human_approved', review_status: 'approved' },
            'approved'
          )
        )
      )
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not approve estimate items.')
    }
  }

  async function saveEstimateItemAsPricingMemory(item: EstimateItem) {
    if (isEstimateItemRejected(item)) {
      alert('Rejected materials cannot be saved as approved pricing memory.')
      return
    }

    if (!item.human_approved) {
      alert('Approve this material line before saving it as pricing memory.')
      return
    }

    const verifiedPrice = Number(item.package_price || item.unit_price || 0)
    if (verifiedPrice <= 0) {
      alert('Add a package/unit price before saving this line as pricing memory.')
      return
    }

    const { error } = await supabase.from('pricing_memory_entries').insert({
      item_name: item.item_name,
      category: item.category || 'Material',
      trade: item.category || 'Material',
      repair_type: selectedEstimateRequest?.workType || 'Material estimate',
      description: item.relevance_reason || item.quantity_reason || getCurrentScopeReason(selectedEstimateRequest),
      city: selectedEstimateRequest?.city || '',
      state: selectedEstimateRequest?.state || '',
      zip: selectedEstimateRequest?.zip || '',
      property_type: selectedEstimateRequest?.propertyFacts?.propertyType || '',
      quantity: item.package_coverage || item.package_size || 1,
      unit: item.package_coverage_unit || item.package_unit || 'package',
      unit_cost: verifiedPrice,
      verified_price: verifiedPrice,
      total_cost: verifiedPrice,
      source: item.source_url || item.source || 'estimate_item_human_approved',
      confidence_level: 'high',
      human_verified: true,
      notes: `Price support only. Saved from material estimate line ${item.id}. Package unit: ${item.package_unit || 'package'}; required unit: ${item.required_unit || 'not set'}.`,
      last_checked: new Date().toISOString(),
    })

    if (error) {
      alert(error.message)
      return
    }

    alert('Saved. Future material estimates will use this human-approved local price first.')
    await recordMaterialReviewLearning(item, 'saved_for_next_time', {
      confidence: 'saved_for_next_time',
    })
    await loadPricingMemoryEntries()
  }

  function generateEstimatePdf() {
    if (!selectedEstimateRequest) {
      alert('Open a request in the estimate review first.')
      return
    }

    const totals = calculateEstimateTotals(
      currentScopeEstimateItems,
      estimateLaborCost,
      estimateMarkupPercent,
      estimateContingencyPercent
    )
    const laborRateLabel = appliedLaborRate
      ? `${appliedLaborRate.trade}${appliedLaborRate.job_type ? ` / ${appliedLaborRate.job_type}` : ''} at ${money(Number(appliedLaborRate.typical_rate || 0))}/${appliedLaborRate.unit || 'hour'}`
      : 'Manual labor entry'
    const laborUnits = Number(estimateLaborUnits || 0)
    const laborMinimum = Number(estimateMinimumCharge || 0)
    const laborTrip = Number(estimateTripCharge || 0)
    const laborDisposal = Number(estimateDisposalFee || 0)
    const allApproved = currentScopeEstimateItems.length > 0 && totals.approvedCount === currentScopeEstimateItems.length

    const rows = currentScopeEstimateItems
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.item_name)}</td>
            <td>${escapeHtml(item.source)}</td>
            <td>${Number(item.quantity || 0).toFixed(2)}</td>
            <td>${money(Number(item.unit_price || 0))}</td>
            <td>${money(Number(item.total_price || 0))}</td>
            <td>${item.human_approved ? 'Approved' : 'Needs review'}</td>
          </tr>
        `
      )
      .join('')

    const html = `
      <html>
        <head>
          <title>Shelter Prep Estimate Draft</title>
          <style>
            body { font-family: Arial, sans-serif; color: #173425; padding: 32px; }
            h1 { color: #0f542d; margin-bottom: 4px; }
            .muted { color: #66736a; }
            .box { border: 1px solid #d7dfd3; border-radius: 14px; padding: 16px; margin: 18px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border-bottom: 1px solid #d7dfd3; text-align: left; padding: 10px; font-size: 13px; }
            th { background: #f4f1ec; }
            .warning { background: #fff7e6; border: 1px solid #e2c47e; padding: 12px; border-radius: 12px; }
            .total { font-size: 22px; font-weight: bold; color: #0f542d; }
          </style>
        </head>
        <body>
          <h1>Shelter Prep Estimate Draft</h1>
          <div class="muted">Powered by AI. Approved by humans.</div>
          <div class="box">
            <strong>Client:</strong> ${escapeHtml(selectedEstimateRequest.requesterName)}<br />
            <strong>Email:</strong> ${escapeHtml(selectedEstimateRequest.email)}<br />
            <strong>Phone:</strong> ${escapeHtml(selectedEstimateRequest.phone || 'Not provided')}<br />
            <strong>Property:</strong> ${escapeHtml(selectedEstimateRequest.propertyAddress)}, ${escapeHtml(selectedEstimateRequest.city)}, ${escapeHtml(selectedEstimateRequest.state)} ${escapeHtml(selectedEstimateRequest.zip)}<br />
            <strong>Work Type:</strong> ${escapeHtml(selectedEstimateRequest.workType)}<br />
            <strong>Urgency:</strong> ${escapeHtml(selectedEstimateRequest.urgency)}
          </div>
          <div class="box">
            <strong>Scope Summary</strong><br />
            ${escapeHtml(selectedEstimateRequest.description)}
          </div>
          <div class="warning">
            ${allApproved ? 'All line items are human-approved.' : 'Draft only: some line items still require human review before sending.'}
          </div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Source</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="box">
            <p><strong>Materials:</strong> ${money(totals.materialSubtotal)}</p>
            <p><strong>Labor:</strong> ${money(totals.labor)}</p>
            <p><strong>Labor source:</strong> ${escapeHtml(laborRateLabel)}</p>
            <p><strong>Labor units:</strong> ${laborUnits}</p>
            <p><strong>Minimum / Trip / Disposal:</strong> ${money(laborMinimum)} / ${money(laborTrip)} / ${money(laborDisposal)}</p>
            <p><strong>Markup:</strong> ${totals.markup}% = ${money(totals.markupDollars)}</p>
            <p><strong>Contingency:</strong> ${totals.contingency}% = ${money(totals.contingencyDollars)}</p>
            <p class="total">Standard Estimate: ${money(totals.standardTotal)}</p>
            <p><strong>Suggested Range:</strong> ${money(totals.lowTotal)} - ${money(totals.premiumTotal)}</p>
          </div>
          <div class="box">
            <strong>Notes / Assumptions</strong><br />
            ${escapeHtml(estimateNotes)}
          </div>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Popup blocked. Allow popups to generate the PDF.')
      return
    }

    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }


  function generateInvoicePdf() {
    if (!selectedEstimateRequest) {
      alert('Open a request in the estimate review first.')
      return
    }

    const totals = calculateEstimateTotals(
      currentScopeEstimateItems,
      estimateLaborCost,
      estimateMarkupPercent,
      estimateContingencyPercent
    )
    const amountDue = totals.standardTotal
    const allApproved = currentScopeEstimateItems.length === 0 || totals.approvedCount === currentScopeEstimateItems.length

    if (amountDue <= 0) {
      alert('Add estimate items or labor before generating an invoice.')
      return
    }

    const invoiceNumber = `SP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
    const invoiceDate = new Date().toLocaleDateString()

    const html = `
      <html>
        <head>
          <title>Shelter Prep Invoice</title>
          <style>
            body { font-family: Arial, sans-serif; color: #173425; padding: 32px; }
            h1 { color: #0f542d; margin-bottom: 4px; }
            .muted { color: #66736a; }
            .top { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
            .box { border: 1px solid #d7dfd3; border-radius: 14px; padding: 16px; margin: 18px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border-bottom: 1px solid #d7dfd3; text-align: left; padding: 10px; font-size: 13px; }
            th { background: #f4f1ec; }
            .right { text-align: right; }
            .totalBox { border: 2px solid #0f542d; border-radius: 14px; padding: 16px; margin-top: 20px; }
            .total { font-size: 24px; font-weight: bold; color: #0f542d; }
            .notice { background: #fff7e6; border: 1px solid #e2c47e; padding: 12px; border-radius: 12px; margin-top: 16px; }
            @media print { body { padding: 18px; } }
          </style>
        </head>
        <body>
          <div class="top">
            <div>
              <h1>Shelter Prep Invoice</h1>
              <div class="muted">Professional services invoice</div>
            </div>
            <div class="box">
              <strong>Invoice #:</strong> ${escapeHtml(invoiceNumber)}<br />
              <strong>Date:</strong> ${escapeHtml(invoiceDate)}<br />
              <strong>Status:</strong> Draft / Review
            </div>
          </div>

          <div class="box">
            <strong>Bill To:</strong> ${escapeHtml(selectedEstimateRequest.requesterName)}<br />
            <strong>Email:</strong> ${escapeHtml(selectedEstimateRequest.email)}<br />
            <strong>Phone:</strong> ${escapeHtml(selectedEstimateRequest.phone || 'Not provided')}<br />
            <strong>Property:</strong> ${escapeHtml(selectedEstimateRequest.propertyAddress)}, ${escapeHtml(selectedEstimateRequest.city)}, ${escapeHtml(selectedEstimateRequest.state)} ${escapeHtml(selectedEstimateRequest.zip)}<br />
            <strong>Work Type:</strong> ${escapeHtml(selectedEstimateRequest.workType)}
          </div>

          <div class="box">
            <strong>Scope / Description</strong><br />
            ${escapeHtml(selectedEstimateRequest.description)}
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Project work per approved scope</td>
                <td class="right">${money(amountDue)}</td>
              </tr>
            </tbody>
          </table>

          <div class="totalBox">
            <div class="muted">Amount Due</div>
            <div class="total">${money(amountDue)}</div>
          </div>

          ${allApproved ? '' : '<div class="notice">Internal note: Some underlying estimate line items still need review before this invoice is sent.</div>'}

          <div class="box">
            <strong>Payment Notes</strong><br />
            Payment due upon receipt unless otherwise agreed. Please reference the invoice number with payment.
          </div>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Popup blocked. Allow popups to generate the invoice.')
      return
    }

    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  async function uploadInvoice() {
    if (!invoiceFile) {
      alert('Choose a PDF invoice first.')
      return
    }

    setInvoiceUploading(true)

    try {
      const path = `invoices/${Date.now()}-${safeFileName(invoiceFile.name)}`

      const { error: uploadError } = await supabase.storage
        .from(INVOICE_BUCKET)
        .upload(path, invoiceFile)

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from(INVOICE_BUCKET)
        .getPublicUrl(path)

      const { error: insertError } = await supabase.from('invoices').insert({
        file_name: invoiceFile.name,
        file_url: publicUrlData.publicUrl,
        storage_path: path,
        vendor_name: invoiceVendor,
        property_address: invoiceAddress,
        extraction_status: 'pending',
      })

      if (insertError) throw insertError

      alert('Invoice uploaded.')
      setInvoiceFile(null)
      setInvoiceVendor('')
      setInvoiceAddress('')
      await loadInvoices()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Invoice upload failed.')
    } finally {
      setInvoiceUploading(false)
    }
  }

  async function loadInvoiceAnalyses(invoiceIds: string[]) {
    if (invoiceIds.length === 0) {
      setInvoiceAnalyses({})
      return
    }

    try {
      const { data, error } = await supabase
        .from('invoice_cost_analyses')
        .select('*')
        .in('invoice_id', invoiceIds)
        .order('created_at', { ascending: false })

      if (error) throw error

      const map: Record<string, InvoiceCostAnalysis> = {}
      ;((data || []) as InvoiceCostAnalysis[]).forEach((analysis) => {
        if (!map[analysis.invoice_id]) map[analysis.invoice_id] = analysis
      })

      setInvoiceAnalyses(map)
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not load invoice analyses.')
    }
  }

  async function loadInvoices() {
    setInvoiceLoading(true)

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows = (data || []) as Invoice[]
      setInvoices(rows)
      await loadInvoiceAnalyses(rows.map((invoice) => invoice.id))
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not load invoices.')
    } finally {
      setInvoiceLoading(false)
    }
  }

  async function extractInvoiceData(invoiceId: string) {
    setExtractingInvoiceId(invoiceId)

    const { data, error } = await supabase.functions.invoke('extract-invoice', {
      body: { invoiceId },
    })

    if (error) {
      console.error(error)
      alert('Invoice extraction failed: ' + error.message)
      setExtractingInvoiceId(null)
      return
    }

    console.log('Invoice extraction result:', data)
    alert('Invoice extracted.')
    await loadInvoices()
    setExtractingInvoiceId(null)
  }

  async function analyzeInvoiceCosts(invoiceId: string) {
    setAnalyzingInvoiceId(invoiceId)

    const { data, error } = await supabase.functions.invoke('analyze-invoice-costs', {
      body: { invoiceId },
    })

    if (error) {
      console.error(error)
      alert('Invoice analysis failed: ' + error.message)
      setAnalyzingInvoiceId(null)
      return
    }

    console.log('Invoice analysis result:', data)

    const analysis = data?.analysis as InvoiceCostAnalysis | undefined

    if (analysis?.invoice_id) {
      setInvoiceAnalyses((prev) => ({ ...prev, [analysis.invoice_id]: analysis }))
    }

    alert(analysis?.summary || 'Invoice cost analysis complete.')
    await loadInvoices()
    setAnalyzingInvoiceId(null)
  }

  async function loadMaterials() {
    setMaterialLoading(true)

    try {
      const { data, error } = await supabase
        .from('material_costs')
        .select('*')
        .order('human_verified', { ascending: true })
        .order('updated_at', { ascending: false })

      if (error) throw error
      setMaterials((data || []) as MaterialCost[])
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not load material costs.')
    } finally {
      setMaterialLoading(false)
    }
  }

  async function loadPricingMemoryEntries() {
    setPricingMemoryLoading(true)

    try {
      const { data, error } = await supabase
        .from('pricing_memory_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      setPricingMemoryEntries((data || []) as PricingMemoryEntry[])
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not load pricing memory. Run the pricing memory migration if needed.')
    } finally {
      setPricingMemoryLoading(false)
    }
  }

  async function updateMaterialCostsNow() {
    setMaterialUpdating(true)

    const { data, error } = await supabase.functions.invoke('update-material-costs', {
      body: {},
    })

    if (error) {
      console.error(error)
      alert('Material update failed: ' + error.message)
      setMaterialUpdating(false)
      return
    }

    console.log('Material update result:', data)
    alert('Material costs updated from FRED/API.')
    await loadMaterials()
    setMaterialUpdating(false)
  }

  async function addMaterialCost() {
    if (!materialName || !materialPrice) {
      alert('Material name and typical price are required.')
      return
    }

    const price = Number(materialPrice)
    const normalizedName = normalizeMaterialName(materialName)

    const { error } = await supabase.from('material_costs').insert({
      item_name: materialName,
      normalized_name: normalizedName,
      category: materialCategory || 'Material',
      unit: materialUnit || 'each',
      low_price: Math.round(price * 0.9 * 100) / 100,
      typical_price: price,
      high_price: Math.round(price * 1.15 * 100) / 100,
      source: materialSource || 'manual_admin_entry',
      store_name: materialSource || 'Manual entry',
      zip: '',
      confidence: 'database_review',
      human_verified: false,
      last_checked: new Date().toISOString(),
      notes: 'Manual draft material cost. Human approval required before reuse.',
    })

    if (error) {
      alert(error.message)
      return
    }

    setMaterialName('')
    setMaterialCategory('')
    setMaterialUnit('')
    setMaterialPrice('')
    setMaterialSource('')
    await loadMaterials()
  }

  function editMaterialCost(item: MaterialCost) {
    const currentName = getMaterialName(item)
    const currentTypical = getMaterialTypicalPrice(item)
    const typical = currentTypical || 0

    setMaterialEditorItem(item)
    setMaterialEditorDraft({
      name: currentName,
      unit: item.unit || 'each',
      typicalPrice: String(typical),
      lowPrice: String(item.low_price ?? Math.round(typical * 0.9 * 100) / 100),
      highPrice: String(item.high_price ?? Math.round(typical * 1.15 * 100) / 100),
      category: item.category || 'Material',
      zip: item.zip || '',
      source: item.source || item.store_name || 'admin_review',
    })
  }

  function closeMaterialEditor() {
    setMaterialEditorItem(null)
    setMaterialEditorDraft(null)
  }

  async function saveMaterialEditor() {
    if (!materialEditorItem || !materialEditorDraft) return

    const nextTypical = parseMoneyInput(materialEditorDraft.typicalPrice)
    if (!Number.isFinite(nextTypical) || nextTypical <= 0) {
      alert('Please enter a valid typical price.')
      return
    }

    setMaterialSavingId(materialEditorItem.id)

    const { error } = await supabase
      .from('material_costs')
      .update({
        item_name: materialEditorDraft.name,
        normalized_name: normalizeMaterialName(materialEditorDraft.name),
        category: materialEditorDraft.category || 'Material',
        unit: materialEditorDraft.unit || 'each',
        low_price: parseMoneyInput(materialEditorDraft.lowPrice) || nextTypical,
        typical_price: nextTypical,
        high_price: parseMoneyInput(materialEditorDraft.highPrice) || nextTypical,
        source: materialEditorDraft.source || 'admin_review',
        store_name: materialEditorDraft.source || 'Admin review',
        zip: materialEditorDraft.zip || '',
        confidence: materialEditorItem.human_verified ? 'database_verified' : 'database_review',
        last_checked: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: 'Edited in Material Cost Review. Human review required unless approved as verified.',
      })
      .eq('id', materialEditorItem.id)

    if (error) {
      alert(error.message)
    } else {
      closeMaterialEditor()
      await loadMaterials()
    }

    setMaterialSavingId(null)
  }

  async function approveMaterialCost(item: MaterialCost) {
    const currentName = getMaterialName(item)
    const currentTypical = getMaterialTypicalPrice(item)

    const approvedPrice = currentTypical
    if (!Number.isFinite(approvedPrice) || approvedPrice <= 0) {
      alert('Edit this material and add a valid typical price before approving it.')
      return
    }

    setMaterialSavingId(item.id)

    const { error } = await supabase
      .from('material_costs')
      .update({
        item_name: currentName,
        normalized_name: normalizeMaterialName(currentName),
        unit: item.unit || 'each',
        low_price: Math.round(approvedPrice * 0.95 * 100) / 100,
        typical_price: approvedPrice,
        high_price: Math.round(approvedPrice * 1.1 * 100) / 100,
        confidence: 'database_verified',
        human_verified: true,
        last_checked: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: 'Approved as human-verified pricing memory. Future estimates may reuse this price first.',
      })
      .eq('id', item.id)

    if (error) alert(error.message)
    else {
      alert('Material cost approved as verified. Future AI estimates can reuse this price first.')
      await loadMaterials()
    }

    setMaterialSavingId(null)
  }


  async function loadLaborRates() {
    setLaborLoading(true)

    const { data, error } = await supabase
      .from('labor_rates')
      .select('*')
      .order('human_verified', { ascending: true })
      .order('updated_at', { ascending: false })

    if (error) alert(error.message)
    else setLaborRates((data || []) as LaborRate[])

    setLaborLoading(false)
  }

  async function addLaborRate() {
    if (!laborTrade || !laborTypicalRate) {
      alert('Trade and typical rate are required.')
      return
    }

    const typical = parseMoneyInput(laborTypicalRate)
    if (!Number.isFinite(typical) || typical <= 0) {
      alert('Please enter a valid typical rate.')
      return
    }

    const { error } = await supabase.from('labor_rates').insert({
      trade: laborTrade,
      job_type: laborJobType || 'General',
      unit: laborUnit || 'hour',
      low_rate: Math.round(typical * 0.85 * 100) / 100,
      typical_rate: typical,
      high_rate: Math.round(typical * 1.25 * 100) / 100,
      minimum_charge: parseMoneyInput(laborMinimumCharge),
      trip_charge: parseMoneyInput(laborTripCharge),
      disposal_fee: parseMoneyInput(laborDisposalFee),
      zip: '',
      region: laborRegion || '',
      source: 'manual_admin_entry',
      confidence: 'labor_review',
      human_verified: false,
      last_checked: new Date().toISOString(),
      notes: 'Manual draft labor rate. Human approval required before reuse.',
    })

    if (error) {
      alert(error.message)
      return
    }

    setLaborTrade('')
    setLaborJobType('')
    setLaborUnit('hour')
    setLaborTypicalRate('')
    setLaborMinimumCharge('')
    setLaborTripCharge('')
    setLaborDisposalFee('')
    setLaborRegion('')
    await loadLaborRates()
  }

  async function editLaborRate(rate: LaborRate) {
    const nextTrade = window.prompt('Trade', rate.trade || '')
    if (nextTrade === null) return

    const nextJobType = window.prompt('Job type / scope', rate.job_type || 'General')
    if (nextJobType === null) return

    const nextUnit = window.prompt('Unit, ex: hour / sqft / day / fixed', rate.unit || 'hour')
    if (nextUnit === null) return

    const nextTypicalText = window.prompt('Typical labor rate', String(rate.typical_rate || 0))
    if (nextTypicalText === null) return

    const nextTypical = parseMoneyInput(nextTypicalText)
    if (!Number.isFinite(nextTypical) || nextTypical <= 0) {
      alert('Please enter a valid typical labor rate.')
      return
    }

    const nextLowText = window.prompt(
      'Low rate',
      String(rate.low_rate ?? Math.round(nextTypical * 0.85 * 100) / 100)
    )
    if (nextLowText === null) return

    const nextHighText = window.prompt(
      'High rate',
      String(rate.high_rate ?? Math.round(nextTypical * 1.25 * 100) / 100)
    )
    if (nextHighText === null) return

    const nextMinimumText = window.prompt('Minimum charge', String(rate.minimum_charge || 0))
    if (nextMinimumText === null) return

    const nextTripText = window.prompt('Trip charge', String(rate.trip_charge || 0))
    if (nextTripText === null) return

    const nextDisposalText = window.prompt('Disposal fee', String(rate.disposal_fee || 0))
    if (nextDisposalText === null) return

    const nextZip = window.prompt('ZIP or service area', rate.zip || '')
    if (nextZip === null) return

    const nextRegion = window.prompt('Region', rate.region || '')
    if (nextRegion === null) return

    setLaborSavingId(rate.id)

    const { error } = await supabase
      .from('labor_rates')
      .update({
        trade: nextTrade,
        job_type: nextJobType || 'General',
        unit: nextUnit || 'hour',
        low_rate: parseMoneyInput(nextLowText) || nextTypical,
        typical_rate: nextTypical,
        high_rate: parseMoneyInput(nextHighText) || nextTypical,
        minimum_charge: parseMoneyInput(nextMinimumText),
        trip_charge: parseMoneyInput(nextTripText),
        disposal_fee: parseMoneyInput(nextDisposalText),
        zip: nextZip || '',
        region: nextRegion || '',
        source: rate.source || 'admin_review',
        confidence: rate.human_verified ? 'labor_verified' : 'labor_review',
        last_checked: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: 'Edited in Labor Rate Review. Human review required unless approved as verified.',
      })
      .eq('id', rate.id)

    if (error) alert(error.message)
    else await loadLaborRates()

    setLaborSavingId(null)
  }

  async function approveLaborRate(rate: LaborRate) {
    const approvedTypical = Number(rate.typical_rate || 0)
    if (!Number.isFinite(approvedTypical) || approvedTypical <= 0) {
      alert('Edit this labor rate and add a valid typical rate before approving it.')
      return
    }

    setLaborSavingId(rate.id)

    const { error } = await supabase
      .from('labor_rates')
      .update({
        unit: rate.unit || 'hour',
        low_rate: Math.round(approvedTypical * 0.9 * 100) / 100,
        typical_rate: approvedTypical,
        high_rate: Math.round(approvedTypical * 1.15 * 100) / 100,
        confidence: 'labor_verified',
        human_verified: true,
        last_checked: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: 'Approved as human-verified labor memory. Future estimates may reuse this rate first.',
      })
      .eq('id', rate.id)

    if (error) alert(error.message)
    else {
      alert('Labor rate approved as verified. Future estimates can reuse this labor memory.')
      await loadLaborRates()
    }

    setLaborSavingId(null)
  }

  function exportCsv() {
    if (!isAdmin) {
      setShowLogin(true)
      return
    }

    if (requests.length === 0) {
      alert('No requests to export.')
      return
    }

    const headers = [
      'createdAt',
      'status',
      'requesterName',
      'email',
      'phone',
      'propertyAddress',
      'city',
      'state',
      'zip',
      'workType',
      'urgency',
      'occupancy',
      'timeline',
      'description',
      'photos',
      'documents',
    ]

    const rows = requests.map((r) =>
      [
        r.createdAt,
        r.status,
        r.requesterName,
        r.email,
        r.phone,
        r.propertyAddress,
        r.city,
        r.state,
        r.zip,
        r.workType,
        r.urgency,
        r.occupancy,
        r.timeline,
        r.description,
        r.photos.map((f) => f.name).join(' | '),
        r.documents.map((f) => f.name).join(' | '),
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'shelter-prep-requests.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (r.archived) return false

      const matchesFilter = filter === 'all' || r.status === filter
      const text = [
        r.requesterName,
        r.email,
        r.phone,
        r.propertyAddress,
        r.city,
        r.state,
        r.zip,
        r.workType,
        r.description,
      ]
        .join(' ')
        .toLowerCase()

      return matchesFilter && text.includes(search.toLowerCase())
    })
  }, [requests, filter, search])

  useEffect(() => {
    if (!isAdmin || activeTab !== 'dashboard') return

    filteredRequests.forEach((request) => {
      if (!request.propertyAddress.trim()) return
      if (propertyProfilesByLeadId[request.id]) return
      if (propertyProfileLoadingByLeadId[request.id]) return
      if (propertyProfileErrorsByLeadId[request.id]) return
      refreshLeadPropertyProfile(request)
    })
  }, [
    activeTab,
    filteredRequests,
    isAdmin,
    propertyProfileErrorsByLeadId,
    propertyProfileLoadingByLeadId,
    propertyProfilesByLeadId,
  ])

  const filteredArchivedRequests = useMemo(() => {
    return archivedRequests.filter((r) => {
      const text = [
        r.requesterName,
        r.email,
        r.phone,
        r.propertyAddress,
        r.city,
        r.state,
        r.zip,
        r.workType,
        r.description,
        r.archiveReason,
      ]
        .join(' ')
        .toLowerCase()

      return text.includes(archivedSearch.toLowerCase())
    })
  }, [archivedRequests, archivedSearch])

  const sellerPrepSelectedRequest = useMemo(() => {
    return requests.find((request) => request.id === sellerPrepSelectedId) || requests[0] || null
  }, [requests, sellerPrepSelectedId])

  const columns: RequestStatus[] = [
    'new',
    'needs_info',
    'estimate_ready',
    'pending_approval',
  ]

  const currentScopeEstimateItems = useMemo(
    () =>
      estimateItems.filter((item) =>
        estimateItemMatchesCurrentScope(item, selectedEstimateRequest)
      ),
    [estimateItems, selectedEstimateRequest]
  )

  const visibleEstimateItems = useMemo(
    () =>
      showRejectedEstimateItems
        ? estimateItems.filter((item) => {
            if (!selectedEstimateRequest) return true
            const propertyId = getRequestPropertyId(selectedEstimateRequest)
            return (
              item.lead_id === selectedEstimateRequest.id ||
              item.request_id === selectedEstimateRequest.id ||
              item.job_id === selectedEstimateRequest.id ||
              item.property_id === propertyId
            )
          })
        : currentScopeEstimateItems,
    [currentScopeEstimateItems, estimateItems, selectedEstimateRequest, showRejectedEstimateItems]
  )

  const rejectedEstimateCount = estimateItems.filter(isEstimateItemRejected).length

  const estimateTotals = calculateEstimateTotals(
    currentScopeEstimateItems,
    estimateLaborCost,
    estimateMarkupPercent,
    estimateContingencyPercent
  )
  const estimateMaterialSubtotal = estimateTotals.materialSubtotal
  const estimateLaborNumber = estimateTotals.labor
  const estimateLaborUnitsNumber = Number(estimateLaborUnits || 0)
  const estimateLaborBaseNumber = appliedLaborRate
    ? Number(appliedLaborRate.typical_rate || 0) * estimateLaborUnitsNumber
    : estimateLaborNumber
  const estimateLaborMinimumNumber = Number(estimateMinimumCharge || 0)
  const estimateTripChargeNumber = Number(estimateTripCharge || 0)
  const estimateDisposalFeeNumber = Number(estimateDisposalFee || 0)
  const estimateMarkupNumber = estimateTotals.markup
  const estimateContingencyNumber = estimateTotals.contingency
  const estimateDirectCost = estimateTotals.directCost
  const estimateMarkupDollars = estimateTotals.markupDollars
  const estimateContingencyDollars = estimateTotals.contingencyDollars
  const estimateStandardTotal = estimateTotals.standardTotal
  const estimateLowTotal = estimateTotals.lowTotal
  const estimatePremiumTotal = estimateTotals.premiumTotal
  const approvedEstimateCount = estimateTotals.approvedCount
  const allEstimateItemsApproved =
    currentScopeEstimateItems.length > 0 && approvedEstimateCount === currentScopeEstimateItems.length
  const propertyResearchPack = useMemo(
    () => buildPropertyResearchPack(propertyAddress, city, stateValue || 'OR', zip),
    [propertyAddress, city, stateValue, zip]
  )

  return (
    <div style={isCompact ? { ...styles.page, ...styles.mobilePage } : styles.page}>
      <header style={isCompact ? { ...styles.header, ...styles.mobileHeader } : styles.header}>
        <div>
          <div style={isCompact ? { ...styles.brand, ...styles.mobileBrand } : styles.brand}>SHELTER PREP</div>
          <div style={isCompact ? { ...styles.subBrand, ...styles.mobileSubBrand } : styles.subBrand}>HOME SERVICES</div>
        </div>

        <nav style={isCompact ? { ...styles.nav, ...styles.mobileNav } : styles.nav}>
          <button
            style={activeTab === 'new' ? { ...styles.navActive, ...(isCompact ? styles.mobileNavPill : {}) } : { ...styles.navButton, ...(isCompact ? styles.mobileNavPill : {}) }}
            onClick={() => setActiveTab('new')}
          >
            New Request
          </button>

          <div style={{ position: 'relative' }}>
	  <button
	    type="button"
	    style={{ ...styles.navButton, ...(isCompact ? styles.mobileNavPill : {}) }}
    onClick={() => setShowMoreMenu((current) => !current)}
  >
    More ▾
  </button>

  {showMoreMenu && (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        minWidth: 220,
        background: '#ffffff',
        border: '1px solid #d8cfc4',
        borderRadius: 16,
        boxShadow: '0 18px 45px rgba(0,0,0,0.14)',
        padding: 8,
        zIndex: 100,
      }}
    >
      {[
        { label: 'Gallery', tab: 'gallery' },
        ...(isAdmin
          ? [
              { label: 'AI Intake', tab: 'intake' },
              { label: 'Messages', tab: 'messages' },
              { label: 'Archived Leads', tab: 'archived' },
              { label: 'Invoices', tab: 'invoices' },
              { label: 'Historical Upload', tab: 'history' },
              { label: 'Seller Prep', tab: 'sellerPrep' },
              { label: 'Pricing Memory', tab: 'pricingMemory' },
              { label: 'Material Costs', tab: 'materials' },
              { label: 'Labor Rates', tab: 'labor' },
              { label: 'AI Estimator', tab: 'estimates' },
            ]
          : []),
      ].map((item) => (
        <button
          key={item.tab}
          type="button"
          style={{
            width: '100%',
            textAlign: 'left',
            padding: '12px 14px',
            border: 'none',
            borderRadius: 12,
            background: activeTab === item.tab ? '#e8f5eb' : '#ffffff',
            color: '#123225',
            fontWeight: 800,
            cursor: 'pointer',
            minHeight: 48,
          }}
          onClick={() => {
            setActiveTab(item.tab as Tab)
            setShowMoreMenu(false)
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )}
</div>


          {isAdmin && (
            <>
	              <button
	                style={activeTab === 'intake' ? { ...styles.navActive, ...(isCompact ? styles.mobileNavPill : {}) } : { ...styles.navButton, ...(isCompact ? styles.mobileNavPill : {}) }}
                onClick={() => requireAdmin('intake')}
              >
                AI Intake
              </button>

	              <button
	                style={activeTab === 'messages' ? { ...styles.navActive, ...(isCompact ? styles.mobileNavPill : {}) } : { ...styles.navButton, ...(isCompact ? styles.mobileNavPill : {}) }}
                onClick={() => requireAdmin('messages')}
              >
                Messages
              </button>
            </>
          )}

          {isAdmin && (
            <>
	              <button
	                style={activeTab === 'dashboard' ? { ...styles.navActive, ...(isCompact ? styles.mobileNavPill : {}) } : { ...styles.navButton, ...(isCompact ? styles.mobileNavPill : {}) }}
                onClick={() => requireAdmin('dashboard')}
              >
                Dashboard
              </button>

	              <button
	                style={activeTab === 'archived' ? { ...styles.navActive, ...(isCompact ? styles.mobileNavPill : {}) } : { ...styles.navButton, ...(isCompact ? styles.mobileNavPill : {}) }}
                onClick={() => requireAdmin('archived')}
              >
                Archived Leads
              </button>

	              <button
	                style={activeTab === 'invoices' ? { ...styles.navActive, ...(isCompact ? styles.mobileNavPill : {}) } : { ...styles.navButton, ...(isCompact ? styles.mobileNavPill : {}) }}
                onClick={() => requireAdmin('invoices')}
              >
                Invoices
              </button>

	              <button
	                style={activeTab === 'history' ? { ...styles.navActive, ...(isCompact ? styles.mobileNavPill : {}) } : { ...styles.navButton, ...(isCompact ? styles.mobileNavPill : {}) }}
                onClick={() => requireAdmin('history')}
              >
                Historical Upload
              </button>

	              <button
	                style={activeTab === 'sellerPrep' ? { ...styles.navActive, ...(isCompact ? styles.mobileNavPill : {}) } : { ...styles.navButton, ...(isCompact ? styles.mobileNavPill : {}) }}
                onClick={() => requireAdmin('sellerPrep')}
              >
                Seller Prep
              </button>

	              <button
	                style={activeTab === 'pricingMemory' ? { ...styles.navActive, ...(isCompact ? styles.mobileNavPill : {}) } : { ...styles.navButton, ...(isCompact ? styles.mobileNavPill : {}) }}
                onClick={() => requireAdmin('pricingMemory')}
              >
                Pricing Memory
              </button>

	              <button
	                style={activeTab === 'materials' ? { ...styles.navActive, ...(isCompact ? styles.mobileNavPill : {}) } : { ...styles.navButton, ...(isCompact ? styles.mobileNavPill : {}) }}
                onClick={() => requireAdmin('materials')}
              >
                Material Costs
              </button>

	              <button
	                style={activeTab === 'labor' ? { ...styles.navActive, ...(isCompact ? styles.mobileNavPill : {}) } : { ...styles.navButton, ...(isCompact ? styles.mobileNavPill : {}) }}
                onClick={() => requireAdmin('labor')}
              >
                Labor Rates
              </button>

	              <button
	                style={activeTab === 'estimates' ? { ...styles.navActive, ...(isCompact ? styles.mobileNavPill : {}) } : { ...styles.navButton, ...(isCompact ? styles.mobileNavPill : {}) }}
                onClick={() => requireAdmin('estimates')}
              >
                AI Estimator
              </button>
            </>
          )}
        </nav>

        <div style={isCompact ? { ...styles.headerActions, ...styles.mobileHeaderActions } : styles.headerActions}>
          {isAdmin && (
            <button style={styles.outlineButton} onClick={exportCsv}>
              Export CSV
            </button>
          )}

          {isAdmin ? (
            <button style={styles.primaryButton} onClick={handleLogout}>
              Log Out
            </button>
          ) : (
            <button style={styles.primaryButton} onClick={() => setShowLogin(true)}>
              Admin Login
            </button>
          )}
        </div>
      </header>

      {!isSupabaseConfigured && (
        <div style={styles.previewBanner}>
          <strong>Admin warning:</strong> Supabase env vars are missing. Add{' '}
          <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> or{' '}
          <strong>VITE_SUPABASE_PUBLISHABLE_KEY</strong>.
          Preview/manual entry still works, but saving, uploads, dashboards, and signed file links need Supabase.
        </div>
      )}

      <main style={isCompact ? { ...styles.main, ...styles.mobileMain } : styles.main}>
        {activeTab === 'new' && (
          <div style={styles.twoColumn}>
            <section style={styles.card}>
              <div style={styles.hero}>Submit a property work request</div>

              <p style={styles.muted}>
                Upload photos, documents, videos, and notes for Shelter Prep review.
              </p>

              {successMessage && <div style={styles.success}>{successMessage}</div>}

              <form onSubmit={handleSubmit}>
                <div style={styles.grid2}>
                  <input
                    style={styles.input}
                    placeholder="Your name *"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                  />

                  <input
                    style={styles.input}
                    placeholder="Email *"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div style={styles.grid2}>
                  <input
                    style={styles.input}
                    placeholder="Phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />

                  <select
                    style={styles.input}
                    value={workType}
                    onChange={(e) => setWorkType(e.target.value)}
                  >
                    {WORK_TYPES.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>

                <input
                  style={styles.input}
                  placeholder="Property address *"
                  value={propertyAddress}
                  onChange={(e) => {
                    setPropertyAddress(e.target.value)
                    setPropertyLookupMessage('')
                    setPropertyLookupStatus('idle')
                  }}
                />

                <div style={styles.propertyInfoPanel}>
                  <div>
                    <strong>Property report facts</strong>
                    <p style={{ ...styles.small, margin: '6px 0 0' }}>
                      Pull public-record style facts into the agent report, then verify before sending.
                    </p>
                  </div>
                  <button
                    type="button"
                    style={styles.outlineButton}
                    onClick={pullPropertyInfo}
                    disabled={propertyLookupLoading}
                  >
                    {propertyLookupLoading ? 'Pulling...' : 'Pull property info'}
                  </button>
                </div>

                <div style={styles.grid5}>
                  {[
                    ['Sq ft', propertyFacts.squareFeet],
                    ['Built', propertyFacts.yearBuilt],
                    ['Beds', propertyFacts.bedrooms],
                    ['Baths', propertyFacts.bathrooms],
                    ['Lot', propertyFacts.lotSize],
                  ].map(([label, value]) => (
                    <div key={label} style={styles.factCard}>
                      <span>{label}</span>
                      <strong>{value || 'Not pulled'}</strong>
                    </div>
                  ))}
                </div>

                {propertyLookupMessage && (
                  <div style={{ ...styles.noticeBox, marginTop: 0 }}>
                    <strong>Property lookup status: {propertyLookupStatusLabel(propertyLookupStatus)}</strong>
                    <p style={{ margin: '6px 0 0' }}>{propertyLookupMessage}</p>
                    {propertyLookupStatus === 'provider_not_configured' && (
                      <p style={{ margin: '6px 0 0' }}>
                        No property data provider connected yet. Use county/ORMAP links or enter facts manually.
                      </p>
                    )}
                  </div>
                )}

                <div style={styles.reviewBox}>
                  <h3 style={{ marginTop: 0 }}>Verified Property Profile</h3>
                  <p style={styles.small}>
                    Confirm or edit the facts before Shelter Prep uses them for renovation planning, permit checks, or estimates.
                  </p>

                  <div style={styles.grid3}>
                    <input
                      style={styles.input}
                      placeholder="Bedrooms"
                      value={propertyFacts.bedrooms}
                      onChange={(e) => setPropertyFacts((prev) => ({ ...prev, bedrooms: e.target.value, verified: true }))}
                    />
                    <input
                      style={styles.input}
                      placeholder="Bathrooms"
                      value={propertyFacts.bathrooms}
                      onChange={(e) => setPropertyFacts((prev) => ({ ...prev, bathrooms: e.target.value, verified: true }))}
                    />
                    <input
                      style={styles.input}
                      placeholder="Square feet"
                      value={propertyFacts.squareFeet}
                      onChange={(e) => setPropertyFacts((prev) => ({ ...prev, squareFeet: e.target.value, verified: true }))}
                    />
                  </div>

                  <div style={styles.grid3}>
                    <input
                      style={styles.input}
                      placeholder="Lot size"
                      value={propertyFacts.lotSize}
                      onChange={(e) => setPropertyFacts((prev) => ({ ...prev, lotSize: e.target.value, verified: true }))}
                    />
                    <input
                      style={styles.input}
                      placeholder="Year built"
                      value={propertyFacts.yearBuilt}
                      onChange={(e) => setPropertyFacts((prev) => ({ ...prev, yearBuilt: e.target.value, verified: true }))}
                    />
                    <input
                      style={styles.input}
                      placeholder="Property type, ex: single-family"
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value)}
                    />
                  </div>

                  <div style={styles.grid3}>
                    <input
                      style={styles.input}
                      placeholder="Jurisdiction"
                      value={jurisdiction || propertyResearchPack.jurisdiction}
                      onChange={(e) => setJurisdiction(e.target.value)}
                    />
                    <input
                      style={styles.input}
                      placeholder="Zoning"
                      value={zoning}
                      onChange={(e) => setZoning(e.target.value)}
                    />
                    <input
                      style={styles.input}
                      placeholder="Parcel / account #"
                      value={parcelNumber}
                      onChange={(e) => setParcelNumber(e.target.value)}
                    />
                  </div>

                  <textarea
                    style={{ ...styles.input, minHeight: 90 }}
                    placeholder="Verification notes, ex: finished basement, converted garage, addition, ADU, access constraints"
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                  />

                  <div style={styles.noticeBox}>
                    Permit office: <strong>{propertyResearchPack.permitOffice}</strong>
                  </div>

                  <div style={styles.grid2}>
                    {propertyResearchPack.links.map((link) => (
                      <button
                        key={link.label}
                        type="button"
                        style={styles.linkPanel}
                        onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                      >
                        <strong>{link.label}</strong>
                        <span>{link.note}</span>
                      </button>
                    ))}
                  </div>

                  <ul style={styles.mutedList}>
                    {propertyResearchPack.riskFlags.map((flag) => (
                      <li key={flag}>{flag}</li>
                    ))}
                  </ul>
                </div>

                <div style={styles.grid3}>
                  <input
                    style={styles.input}
                    placeholder="City *"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />

                  <input
                    style={styles.input}
                    placeholder="State *"
                    value={stateValue}
                    onChange={(e) => setStateValue(e.target.value)}
                  />

                  <input
                    style={styles.input}
                    placeholder="ZIP *"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                  />
                </div>

                <div style={styles.grid3}>
                  <select
                    style={styles.input}
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                  >
                    <option>Standard</option>
                    <option>Urgent</option>
                    <option>ASAP</option>
                  </select>

                  <select
                    style={styles.input}
                    value={occupancy}
                    onChange={(e) => setOccupancy(e.target.value)}
                  >
                    <option>Occupied</option>
                    <option>Vacant</option>
                    <option>Unknown</option>
                  </select>

                  <input
                    style={styles.input}
                    placeholder="Desired timeline"
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                  />
                </div>

                <textarea
                  style={{ ...styles.input, minHeight: 140 }}
                  placeholder="Describe the work needed *"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />

                <div style={styles.grid2}>
                  <div style={styles.uploadBox}>
                    <strong>Photos</strong>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))}
                    />
                    {photoFiles.length > 0 && (
                      <p style={styles.small}>
                        {photoFiles.map((f) => f.name).join(', ')}
                      </p>
                    )}
                  </div>

                  <div style={styles.uploadBox}>
                    <strong>Documents / Video</strong>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.mov"
                      onChange={(e) => setDocumentFiles(Array.from(e.target.files || []))}
                    />
                    {documentFiles.length > 0 && (
                      <p style={styles.small}>
                        {documentFiles.map((f) => f.name).join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                <button type="submit" style={styles.primaryButton} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>

                <button
                  type="button"
                  style={{ ...styles.outlineButton, marginLeft: 10 }}
                  onClick={resetForm}
                >
                  Clear
                </button>
              </form>
            </section>

            {isAdmin && (
              <aside style={styles.sideCard}>
                <h2>Service Health</h2>
                <div style={styles.healthGrid}>
                  <div style={styles.healthRow}>
                    <span>Supabase</span>
                    <strong style={isSupabaseConfigured ? styles.healthOk : styles.healthNeedsSetup}>
                      {isSupabaseConfigured ? 'Connected' : 'Needs setup'}
                    </strong>
                  </div>
                  <div style={styles.healthRow}>
                    <span>Property Lookup</span>
                    <strong style={isSupabaseConfigured ? styles.healthOk : styles.healthNeedsSetup}>
                      {isSupabaseConfigured ? 'Ready to call Edge Function' : 'Fallback only'}
                    </strong>
                  </div>
                </div>

                {!isSupabaseConfigured && (
                  <p style={styles.small}>
                    Add <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> or{' '}
                    <strong>VITE_SUPABASE_PUBLISHABLE_KEY</strong> in StackBlitz secrets to enable saved app data.
                  </p>
                )}

                <h2>AI Foundation</h2>
                <p style={styles.muted}>
                  Invoice upload, extraction, cost analysis, material monitoring, and AI
                  estimate calls are wired into the app.
                </p>

                <button style={styles.wideButton} onClick={() => requireAdmin('invoices')}>
                  Open Invoices
                </button>

                <button style={styles.wideButton} onClick={() => requireAdmin('materials')}>
                  Open Material Costs
                </button>

                <button style={styles.wideButton} onClick={() => requireAdmin('labor')}>
                  Open Labor Rates
                </button>
              </aside>
            )}
          </div>
        )}

        {activeTab === 'gallery' && <Gallery />}

        {isAdmin && activeTab === 'intake' && (
          <section style={styles.card}>
            <h2>AI Text Message / Screenshot Intake</h2>
            <p style={styles.muted}>
              Paste a text message or upload a screenshot from iMessage, email, or a client thread. AI will extract the address, work type, urgency, missing info, and a safe reply draft. Review everything before submitting.
            </p>

            <div style={styles.warningBox}>
              Intake drafts are not sent automatically. AI can draft missing-info requests, but a human must review before any estimate, proposal, purchase order, email, or submission is used.
            </div>

            <textarea
              style={{ ...styles.input, minHeight: 180 }}
              placeholder="Paste the agent/client text here. Example: Hi John, can you quote a roof repair at 183 SW Wright Ave? Tight inspection deadline."
              value={intakeText}
              onChange={(e) => setIntakeText(e.target.value)}
            />

            <div style={styles.uploadBox}>
              <strong>Screenshot upload</strong>
              <p style={styles.small}>
                Optional. Upload a screenshot of a text thread, inspection note, email, or job request.
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setIntakeScreenshotFile(e.target.files?.[0] || null)}
              />
              {intakeScreenshotFile && (
                <p style={styles.small}>{intakeScreenshotFile.name}</p>
              )}
            </div>

            <div style={{ ...styles.buttonRow, marginTop: 14 }}>
              <button style={styles.primaryButton} onClick={analyzeIntake} disabled={intakeAnalyzing}>
                {intakeAnalyzing ? 'Analyzing Intake...' : 'Analyze Intake'}
              </button>
              <button
                style={styles.outlineButton}
                onClick={() => {
                  setIntakeText('')
                  setIntakeScreenshotFile(null)
                  setIntakeDraft(null)
                }}
              >
                Clear Intake
              </button>
            </div>

            {intakeDraft && (
              <div style={{ ...styles.reviewBox, marginTop: 24 }}>
                <h3>AI Intake Draft</h3>

                <div style={styles.grid2}>
                  <div>
                    <strong>Work Type</strong>
                    <p style={styles.muted}>{intakeDraft.workType || 'Needs review'}</p>
                  </div>
                  <div>
                    <strong>Urgency</strong>
                    <p style={styles.muted}>{intakeDraft.urgency || 'Needs review'}</p>
                  </div>
                </div>

                <div style={styles.grid2}>
                  <div>
                    <strong>Address</strong>
                    <p style={styles.muted}>{intakeDraft.propertyAddress || 'Missing'}</p>
                  </div>
                  <div>
                    <strong>ZIP</strong>
                    <p style={styles.muted}>{intakeDraft.zip || 'Missing'}</p>
                  </div>
                </div>

                <div style={styles.grid2}>
                  <div>
                    <strong>Contact</strong>
                    <p style={styles.muted}>
                      {[intakeDraft.requesterName, intakeDraft.email, intakeDraft.phone].filter(Boolean).join(' • ') || 'Missing'}
                    </p>
                  </div>
                  <div>
                    <strong>Timeline</strong>
                    <p style={styles.muted}>{intakeDraft.timeline || 'Needs review'}</p>
                  </div>
                </div>

                <strong>Clean Scope Draft</strong>
                <p style={styles.scopeText}>{intakeDraft.description || 'No scope extracted.'}</p>

                <strong>Missing Info Checklist</strong>
                {intakeDraft.missingInfo && intakeDraft.missingInfo.length > 0 ? (
                  <ul style={styles.mutedList}>
                    {intakeDraft.missingInfo.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={styles.muted}>No obvious missing info detected. Still review before use.</p>
                )}

                <strong>Suggested Reply Draft</strong>
                <div style={styles.replyDraftBox}>
                  {intakeDraft.suggestedReply || 'No reply draft generated.'}
                </div>

                <p style={styles.small}>
                  Confidence: {intakeDraft.confidence || 'needs_review'}
                  {intakeDraft.notes ? ` • ${intakeDraft.notes}` : ''}
                </p>

                <div style={styles.buttonRow}>
                  <button style={styles.primaryButton} onClick={applyIntakeDraftToNewRequest}>
                    Use Draft in New Request
                  </button>
                  <button
                    style={styles.outlineButton}
                    onClick={() => copyToClipboard(intakeDraft.suggestedReply || '')}
                  >
                    Copy Suggested Reply
                  </button>
                  <button
                    style={styles.outlineButton}
                    onClick={saveIntakeReplyDraft}
                    disabled={messageSavingId === 'intake-draft'}
                  >
                    {messageSavingId === 'intake-draft' ? 'Saving...' : 'Save Reply Draft'}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {isAdmin && activeTab === 'messages' && (
          <section style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <h2>Message Center</h2>
                <p style={styles.muted}>AI-drafted replies and missing-info requests. Human review is required before sending.</p>
              </div>
              <button style={styles.outlineButton} disabled={messageLoading} onClick={loadMessageCenter}>
                {messageLoading ? 'Loading...' : 'Refresh Messages'}
              </button>
            </div>

            <div style={styles.noticeBox}>
              Safe automation rule: AI can draft missing-info requests, but it cannot send prices, proposals, purchase orders, contractor commitments, or final approvals without human review.
            </div>

            <select
              style={styles.input}
              value={messageFilter}
              onChange={(e) => setMessageFilter(e.target.value as 'all' | 'draft' | 'sent' | 'approved')}
            >
              <option value="all">All messages</option>
              <option value="draft">Drafts</option>
              <option value="approved">Approved</option>
              <option value="sent">Marked Sent</option>
            </select>

            <h3>Drafts + Message Logs</h3>
            {messageLogs.filter((log) => messageFilter === 'all' || log.status === messageFilter).length === 0 && (
              <p style={styles.muted}>No messages yet. Generate a missing-info request from a dashboard card, or save an AI Intake reply draft.</p>
            )}

            {messageLogs
              .filter((log) => messageFilter === 'all' || log.status === messageFilter)
              .map((log) => (
                <div key={log.id} style={styles.requestCard}>
                  <div style={styles.grid3}>
                    <div>
                      <strong>Status</strong>
                      <p style={styles.small}>{log.status || 'draft'}</p>
                    </div>
                    <div>
                      <strong>Linked Job</strong>
                      <p style={styles.small}>{getRequestLabel(log.lead_id)}</p>
                    </div>
                    <div>
                      <strong>Recipient</strong>
                      <p style={styles.small}>
                        {[log.recipient_name, log.recipient_email, log.recipient_phone].filter(Boolean).join(' • ') || 'Not set'}
                      </p>
                    </div>
                  </div>

                  <p style={styles.scopeText}>{log.message_body}</p>
                  {log.notes && <p style={styles.small}>Notes: {log.notes}</p>}
                  <p style={styles.small}>Created: {log.created_at ? new Date(log.created_at).toLocaleString() : 'Not set'}</p>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button style={styles.outlineButton} onClick={() => copyToClipboard(log.message_body)}>
                      Copy Message
                    </button>
                    <button
                      style={styles.outlineButton}
                      disabled={messageSavingId === log.id}
                      onClick={() => markMessageLog(log, 'approved')}
                    >
                      Approve Draft
                    </button>
                    <button
                      style={styles.primaryButton}
                      disabled={messageSavingId === log.id}
                      onClick={() => markMessageLog(log, 'sent')}
                    >
                      Mark Sent
                    </button>
                    <button
                      style={styles.primaryButton}
                      disabled={messageSavingId === log.id || !log.recipient_email}
                      onClick={() => sendMessageEmail(log)}
                    >
                      Send Email
                    </button>
                  </div>
                </div>
              ))}

            <hr style={styles.divider} />

            <h3>Missing Info Requests</h3>
            {missingInfoRequests.length === 0 && <p style={styles.muted}>No missing-info request records yet.</p>}
            {missingInfoRequests.map((item) => {
              const flags = [
                item.missing_address ? 'address' : '',
                item.missing_photos ? 'photos' : '',
                item.missing_inspection_report ? 'inspection report' : '',
                item.missing_deadline ? 'deadline' : '',
                item.missing_access_info ? 'access info' : '',
                item.missing_scope_clarity ? 'scope clarity' : '',
              ].filter(Boolean)

              return (
                <div key={item.id} style={styles.requestCard}>
                  <strong>{getRequestLabel(item.lead_id)}</strong>
                  <p style={styles.small}>Status: {item.status || 'draft'} • Auto-send safe: {item.auto_send_allowed ? 'Yes' : 'No'}</p>
                  <p style={styles.small}>Missing: {flags.join(', ') || 'None listed'}</p>
                  {item.generated_message && <p style={styles.scopeText}>{item.generated_message}</p>}
                  <button
                    style={styles.outlineButton}
                    onClick={() => copyToClipboard(item.generated_message || '')}
                  >
                    Copy Request
                  </button>
                </div>
              )
            })}
          </section>
        )}

        {isAdmin && activeTab === 'dashboard' && (
          <>
            <section style={isCompact ? { ...styles.card, ...styles.mobileCard } : styles.card}>
              <h2>Admin Dashboard</h2>

              <div style={isCompact ? styles.mobileStack : styles.grid2}>
                <input
                  style={styles.input}
                  placeholder="Search requests"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <select
                  style={styles.input}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as 'all' | RequestStatus)}
                >
                  <option value="all">All Statuses</option>
                  {columns.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_META[status].label}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section style={isCompact ? { ...styles.kanban, ...styles.mobileKanban } : styles.kanban}>
              {filteredRequests.length === 0 && (
                <div style={styles.empty}>No requests match this search.</div>
              )}

              {columns.map((status) => {
                const items = filteredRequests.filter((request) => request.status === status)

                if (items.length === 0) return null

                return (
                  <div
                    key={status}
	                    style={{
	                      ...styles.column,
                        ...(isCompact ? styles.mobileColumn : {}),
	                      background: STATUS_META[status].cardBg,
	                      border: `1px solid ${STATUS_META[status].border}`,
	                    }}
                  >
                    <h3>
                      {STATUS_META[status].label} ({items.length})
                    </h3>

                    {items.length === 0 && <div style={styles.empty}>No requests</div>}

                    {items.map((request) => {
                      const profile = propertyProfilesByLeadId[request.id]
                      const profileLoading = Boolean(propertyProfileLoadingByLeadId[request.id])
                      const profileError = propertyProfileErrorsByLeadId[request.id]

                      return (
	                      <div key={request.id} style={isCompact ? { ...styles.requestCard, ...styles.mobileRequestCard } : styles.requestCard}>
	                        <strong style={isCompact ? styles.mobileRequestTitle : undefined}>{request.propertyAddress}</strong>
                        <p style={styles.small}>
                          {request.city}, {request.state} {request.zip}
                        </p>
                        <p style={styles.small}>
                          {request.requesterName} • {request.email}
                        </p>
                        <p>{request.description}</p>

                        {request.propertyFacts && (
	                          <div style={isCompact ? { ...styles.propertyProfileCard, ...styles.mobilePropertyProfileCard } : styles.propertyProfileCard}>
	                            <strong>Verified Property Profile</strong>
	                            <div style={isCompact ? { ...styles.compactFactGrid, ...styles.mobileCompactFactGrid } : styles.compactFactGrid}>
                              <span>Beds: {profile?.beds || request.propertyFacts.bedrooms || 'TBD'}</span>
                              <span>Baths: {profile?.baths || request.propertyFacts.bathrooms || 'TBD'}</span>
                              <span>Sq ft: {profile?.sqft || request.propertyFacts.squareFeet || 'TBD'}</span>
                              <span>Built: {profile?.yearBuilt || request.propertyFacts.yearBuilt || 'TBD'}</span>
                              <span>Type: {profile?.propertyType || request.propertyFacts.propertyType || 'TBD'}</span>
                              <span>Jurisdiction: {profile?.jurisdiction || request.propertyFacts.jurisdiction || 'Review'}</span>
                            </div>
                            {profileLoading && <p style={styles.small}>Loading property profile...</p>}
                            {profileError && (
                              <p style={styles.small}>Property lookup failed: {profileError}</p>
                            )}
                            {request.propertyFacts.verificationNotes && (
                              <p style={styles.small}>Notes: {request.propertyFacts.verificationNotes}</p>
                            )}
                            <div style={styles.buttonRow}>
	                              <button
	                                type="button"
	                                style={isCompact ? { ...styles.linkButton, ...styles.mobileLinkButton } : styles.linkButton}
                                disabled={profileLoading}
                                onClick={() => refreshLeadPropertyProfile(request, true)}
                              >
                                Refresh Property Profile
                              </button>
                              {buildPropertyResearchPack(
                                request.propertyAddress,
                                request.city,
                                request.state,
                                request.zip
                              ).links.slice(0, 3).map((link) => (
	                                <button
	                                  key={`${request.id}-${link.label}`}
	                                  type="button"
	                                  style={isCompact ? { ...styles.linkButton, ...styles.mobileLinkButton } : styles.linkButton}
                                  onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                                >
                                  {link.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {request.photos.length > 0 && <strong>Photos</strong>}
                        {request.photos.map((file) => (
	                          <div key={file.id || file.path || file.name} style={isCompact ? { ...styles.fileActionRow, ...styles.mobileFileActionRow } : styles.fileActionRow}>
                            <span style={styles.fileName}>{file.name}</span>
                            <button
                              type="button"
	                              style={isCompact ? { ...styles.linkButton, ...styles.mobileLinkButton } : styles.linkButton}
                              onClick={() => openRequestFile(file)}
                            >
                              View Photo
                            </button>
                            <button
                              type="button"
	                              style={isCompact ? { ...styles.linkButton, ...styles.mobileLinkButton } : styles.linkButton}
                              onClick={() => openRequestFile(file, true)}
                            >
                              Download
                            </button>
                          </div>
                        ))}

                        {request.documents.length > 0 && <strong>Documents</strong>}
                        {request.documents.map((file) => (
	                          <div key={file.id || file.path || file.name} style={isCompact ? { ...styles.fileActionRow, ...styles.mobileFileActionRow } : styles.fileActionRow}>
                            <span style={styles.fileName}>{file.name}</span>
                            <button
                              type="button"
	                              style={isCompact ? { ...styles.linkButton, ...styles.mobileLinkButton } : styles.linkButton}
                              onClick={() => openRequestFile(file)}
                            >
                              Open File
                            </button>
                            <button
                              type="button"
	                              style={isCompact ? { ...styles.linkButton, ...styles.mobileLinkButton } : styles.linkButton}
                              onClick={() => openRequestFile(file, true)}
                            >
                              Download
                            </button>
                          </div>
                        ))}

<details
  style={{
    marginTop: 12,
    border: '1px solid #d8c2ad',
    borderRadius: 16,
    background: '#ffffff',
    overflow: 'hidden',
  }}
>
  <summary
    style={{
      padding: '14px 16px',
      cursor: 'pointer',
      fontWeight: 900,
      color: '#06542d',
      listStyle: 'none',
    }}
  >
    Actions ▾
  </summary>

  <div
    style={{
      display: 'grid',
      gap: 10,
      padding: 12,
      borderTop: '1px solid #eee1d4',
      background: '#fbf8f2',
    }}
  >
    <button
      type="button"
      style={styles.wideButton}
      disabled={aiLoadingId === request.id}
      onClick={() => runAiEstimate(request)}
    >
      {aiLoadingId === request.id ? 'Running AI...' : 'Run AI Estimate'}
    </button>

    <button
      type="button"
      style={{
        ...styles.wideButton,
        background: '#ffffff',
        color: '#06542d',
        border: '1px solid #06542d',
      }}
      disabled={sellerPrepLoadingId === request.id}
      onClick={() => runSellerPrepDraftV1(request)}
    >
      {sellerPrepLoadingId === request.id
        ? 'Running Seller Prep...'
        : 'Run Seller Prep Draft'}
    </button>

    <button
      type="button"
      style={{
        ...styles.wideButton,
        background: '#f7efe7',
        color: '#4c3b2f',
        border: '1px solid #d8c2ad',
      }}
      disabled={sellerPrepLoadingId === request.id}
      onClick={() => loadSellerPrepDraftForRequest(request)}
    >
      {sellerPrepLoadingId === request.id
        ? 'Opening Seller Prep...'
        : 'Open Seller Prep V1'}
    </button>

    <button
      type="button"
      style={{
        ...styles.wideButton,
        background: '#0f542d',
        color: '#ffffff',
        border: '1px solid #0f542d',
      }}
      disabled={materialEstimateLoadingId === request.id}
      onClick={() => buildMaterialEstimate(request)}
    >
      {materialEstimateLoadingId === request.id
        ? 'Building Material Estimate...'
        : 'Build Material Estimate'}
    </button>

    <button
      type="button"
      style={{
        ...styles.wideButton,
        background: '#0f542d',
        color: '#ffffff',
        border: '1px solid #0f542d',
      }}
      onClick={() => buildLocalEstimateIntelligence(request)}
    >
      Build Estimate Intelligence
    </button>

    <button
      type="button"
      style={{
        ...styles.wideButton,
        background: '#f4f1ec',
        color: '#173425',
        border: '1px solid #d7dfd3',
      }}
      onClick={() => openEstimateReview(request)}
    >
      Open Estimate Review
      
    </button>

    <button
      type="button"
      style={{
        ...styles.wideButton,
        background: '#173425',
        color: '#ffffff',
        border: '1px solid #173425',
      }}
      disabled={autoWorkflowLoadingId === request.id}
      onClick={() => autoProcessLead(request)}
    >
      {autoWorkflowLoadingId === request.id
        ? 'Auto Processing...'
        : 'Auto Run Research + Takeoff'}
    </button>

    <button
      type="button"
      style={{
        ...styles.wideButton,
        background: '#fff8e8',
        color: '#6f4f14',
        border: '1px solid #ecd9a7',
      }}
      disabled={messageSavingId === request.id}
      onClick={() => generateMissingInfoRequest(request)}
    >
      {messageSavingId === request.id
        ? 'Creating Message...'
        : 'Generate Missing Info Request'}
    </button>

    <div style={styles.noticeBox}>
      AI research drafts only. Human approval is required before any estimate,
      proposal, purchase order, email, or submission.
    </div>
  </div>
</details>

                        {request.aiEstimate && (
                          <div style={styles.aiBox}>
                            <strong>AI Estimate</strong>
                            <p>{request.aiEstimate.projectSummary}</p>
                            <p>
                              Low: {money(request.aiEstimate.lowPrice)} • Standard:{' '}
                              {money(request.aiEstimate.standardPrice)} • Premium:{' '}
                              {money(request.aiEstimate.premiumPrice)}
                            </p>
                          </div>
                        )}

                        <select
                          style={styles.input}
                          value={request.status}
                          onChange={(e) => updateStatus(request.id, e.target.value as RequestStatus)}
                        >
                          {columns.map((next) => (
                            <option key={next} value={next}>
                              {STATUS_META[next].label}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          style={{
                            ...styles.outlineButton,
                            width: '100%',
                            borderColor: '#c9a9a9',
                            color: '#8a2f2f',
                            marginTop: 10,
                          }}
                          onClick={() => archiveLead(request)}
                        >
                          Archive Lead
                        </button>
                      </div>
                      )
                    })}
                  </div>
                )
              })}
            </section>
          </>
        )}


        {isAdmin && activeTab === 'archived' && (
          <section style={styles.card}>
            <div style={styles.buttonRow}>
              <div style={{ flex: 1 }}>
                <h2>Archived Leads</h2>
                <p style={styles.muted}>
                  Archived leads are hidden from the Dashboard, but their files, estimates,
                  messages, and research stay saved in Supabase.
                </p>
              </div>

              <button
                type="button"
                style={styles.outlineButton}
                disabled={archivedLoading}
                onClick={loadArchivedRequestsFromSupabase}
              >
                {archivedLoading ? 'Loading...' : 'Refresh Archived'}
              </button>
            </div>

            <input
              style={styles.input}
              placeholder="Search archived leads"
              value={archivedSearch}
              onChange={(e) => setArchivedSearch(e.target.value)}
            />

            {filteredArchivedRequests.length === 0 ? (
              <div style={styles.empty}>No archived leads found.</div>
            ) : (
              <div style={styles.fileGrid}>
                {filteredArchivedRequests.map((request) => (
                  <div key={request.id} style={styles.requestCard}>
                    <strong>{request.propertyAddress || 'Untitled lead'}</strong>

                    <p style={styles.small}>
                      {request.city}, {request.state} {request.zip}
                    </p>

                    <p style={styles.small}>
                      {request.requesterName || 'No name'} • {request.email || 'No email'}
                    </p>

                    <p style={styles.small}>
                      Status before archive: {STATUS_META[request.status]?.label || request.status}
                    </p>

                    <p style={styles.small}>
                      Archived: {request.archivedAt ? new Date(request.archivedAt).toLocaleString() : 'Unknown date'}
                    </p>

                    {request.archiveReason && (
                      <p style={styles.small}>Reason: {request.archiveReason}</p>
                    )}

                    <p>{request.description || 'No description saved.'}</p>

                    <button
                      type="button"
                      style={styles.primaryButton}
                      disabled={restoringId === request.id}
                      onClick={() => restoreArchivedLead(request)}
                    >
                      {restoringId === request.id ? 'Restoring...' : 'Restore to Dashboard'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {isAdmin && activeTab === 'invoices' && (
          <section style={styles.card}>
            <h2>Invoice Upload + AI Extraction</h2>

            <input
              style={styles.input}
              placeholder="Vendor name"
              value={invoiceVendor}
              onChange={(e) => setInvoiceVendor(e.target.value)}
            />

            <input
              style={styles.input}
              placeholder="Property address"
              value={invoiceAddress}
              onChange={(e) => setInvoiceAddress(e.target.value)}
            />

            <input
              style={styles.input}
              type="file"
              accept="application/pdf"
              onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
            />

            <button style={styles.primaryButton} disabled={invoiceUploading} onClick={uploadInvoice}>
              {invoiceUploading ? 'Uploading...' : 'Upload Invoice'}
            </button>

            <button
              style={{ ...styles.outlineButton, marginLeft: 10 }}
              disabled={invoiceLoading}
              onClick={loadInvoices}
            >
              {invoiceLoading ? 'Loading...' : 'Refresh'}
            </button>

            <div style={{ marginTop: 20 }}>
              {invoices.length === 0 && <p style={styles.muted}>No invoices uploaded yet.</p>}

              {invoices.map((invoice) => {
                const analysis = invoiceAnalyses[invoice.id]

                return (
                  <div key={invoice.id} style={styles.requestCard}>
                    <strong>{invoice.file_name}</strong>
                    <p style={styles.small}>Vendor: {invoice.vendor_name || 'Not entered'}</p>
                    <p style={styles.small}>Property: {invoice.property_address || 'Not entered'}</p>
                    <p style={styles.small}>Invoice #: {invoice.invoice_number || 'Not extracted yet'}</p>
                    <p style={styles.small}>Status: {invoice.extraction_status || 'pending'}</p>
                    <p style={styles.small}>Subtotal: {money(invoice.subtotal)}</p>
                    <p style={styles.small}>Tax: {money(invoice.tax)}</p>
                    <p style={styles.small}>Total: {money(invoice.total)}</p>

                    {invoice.extraction_error && (
                      <p style={{ ...styles.small, color: '#b42318' }}>
                        Error: {invoice.extraction_error}
                      </p>
                    )}

                    <a href={invoice.file_url} target="_blank" rel="noreferrer">
                      Open / Download PDF
                    </a>

                    <button
                      style={styles.wideButton}
                      disabled={extractingInvoiceId === invoice.id}
                      onClick={() => extractInvoiceData(invoice.id)}
                    >
                      {extractingInvoiceId === invoice.id
                        ? 'Extracting...'
                        : 'Extract Invoice Data'}
                    </button>

                    <button
                      style={styles.wideButton}
                      disabled={analyzingInvoiceId === invoice.id}
                      onClick={() => analyzeInvoiceCosts(invoice.id)}
                    >
                      {analyzingInvoiceId === invoice.id
                        ? 'Analyzing...'
                        : 'Analyze Invoice Costs'}
                    </button>

                    {analysis && (
                      <div style={styles.aiBox}>
                        <strong>Cost Analysis: {analysis.risk_level || 'unknown'} risk</strong>
                        <p>{analysis.summary}</p>
                        <p style={styles.small}>{analysis.client_summary}</p>
                        <p style={styles.small}>
                          Overcharge flags: {countItems(analysis.overcharge_flags)} • Scope gaps:{' '}
                          {countItems(analysis.scope_gaps)} • Pricing risks:{' '}
                          {countItems(analysis.pricing_risks)}
                        </p>

                        {Array.isArray(analysis.recommended_actions) && analysis.recommended_actions.length > 0 && (
                          <ul style={styles.smallList}>
                            {analysis.recommended_actions.map((action, index) => (
                              <li key={`${analysis.id}-action-${index}`}>{action}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {isAdmin && activeTab === 'history' && <HistoricalUpload />}

        {isAdmin && activeTab === 'sellerPrep' && (
          <section style={styles.card}>
            <div style={styles.buttonRow}>
              <div style={{ flex: 1 }}>
                <h2>Seller Prep Intelligence V1</h2>
                <p style={styles.muted}>
                  Rule-based draft for seller-prep scope, buyer impact, inspection risk, and net-impact notes.
                  Powered by AI-style logic. Approved by humans.
                </p>
              </div>
              <select
                style={{ ...styles.input, maxWidth: 360, marginBottom: 0 }}
                value={sellerPrepSelectedRequest?.id || ''}
                onChange={(event) => {
                  const next = requests.find((request) => request.id === event.target.value)
                  if (next) loadSellerPrepDraftForRequest(next)
                }}
              >
                <option value="">Select lead</option>
                {requests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.propertyAddress || request.description.slice(0, 50) || request.id}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.noticeBox}>
              Safety rule: final report/send actions stay disabled until a human approves the Seller Prep analysis.
              This V1 draft does not send emails, submit proposals, order materials, approve contractor bids, or make final decisions.
            </div>

            {sellerPrepSelectedRequest ? (
              <>
                <div style={styles.requestCard}>
                  <strong>{sellerPrepSelectedRequest.propertyAddress || 'Untitled property'}</strong>
                  <p style={styles.small}>
                    {sellerPrepSelectedRequest.city}, {sellerPrepSelectedRequest.state} {sellerPrepSelectedRequest.zip} •{' '}
                    {sellerPrepSelectedRequest.workType}
                  </p>
                  <p>{sellerPrepSelectedRequest.description}</p>
                  <div style={styles.buttonRow}>
                    <button
                      type="button"
                      style={styles.primaryButton}
                      onClick={() => runSellerPrepDraftV1(sellerPrepSelectedRequest)}
                    >
                      Run Seller Prep Draft
                    </button>
                    <button
                      type="button"
                      style={styles.outlineButton}
                      onClick={() => loadSellerPrepDraftForRequest(sellerPrepSelectedRequest)}
                    >
                      Load Latest Draft
                    </button>
                  </div>
                </div>

                {sellerPrepAnalysisV1 && (
                  <div style={styles.aiBox}>
                    <div style={styles.buttonRow}>
                      <div style={{ flex: 1 }}>
                        <strong>Property Summary</strong>
                        <p>{sellerPrepAnalysisV1.summary}</p>
                        <p>
                          Total prep range: {money(sellerPrepAnalysisV1.total_low_estimate)} -{' '}
                          {money(sellerPrepAnalysisV1.total_high_estimate)}
                        </p>
                        <p>Seller net impact: {sellerPrepAnalysisV1.seller_net_impact}</p>
                        <p style={styles.small}>
                          Confidence: {sellerPrepAnalysisV1.confidence || 'draft'} • Human review:{' '}
                          {sellerPrepAnalysisV1.human_review_status}
                        </p>
                      </div>
                      <button
                        type="button"
                        style={styles.primaryButton}
                        onClick={markSellerPrepAnalysisApproved}
                        disabled={sellerPrepAnalysisV1.human_review_status === 'human_approved'}
                      >
                        Mark Analysis Human Approved
                      </button>
                    </div>

                    <div style={styles.noticeBox}>
                      Final Report / Send buttons:{' '}
                      <strong>
                        {sellerPrepAnalysisV1.human_review_status === 'human_approved'
                          ? 'Enabled for future report workflow'
                          : 'Disabled until human approved'}
                      </strong>
                    </div>
                  </div>
                )}

                {sellerPrepItemsV1.length === 0 ? (
                  <div style={styles.empty}>No Seller Prep draft loaded yet.</div>
                ) : (
                  sellerPrepItemsV1.map((item) => (
                    <div key={item.id} style={styles.requestCard}>
                      <div style={styles.grid3}>
                        <div>
                          <strong>{item.repair_item}</strong>
                          <p style={styles.small}>{item.trade_category || 'General'} • {item.recommendation || 'needs review'}</p>
                        </div>
                        <div>
                          <strong>Buyer Impact</strong>
                          <p style={styles.small}>{item.buyer_impact_score || 0}/10</p>
                        </div>
                        <div>
                          <strong>Inspection Risk</strong>
                          <p style={styles.small}>{item.inspection_risk_score || 0}/10</p>
                        </div>
                      </div>

                      <div style={styles.grid3}>
                        <input
                          style={styles.input}
                          type="number"
                          value={Number(item.estimated_low || 0)}
                          onChange={(event) => updateSellerPrepItemLocal(item.id, { estimated_low: Number(event.target.value) })}
                        />
                        <input
                          style={styles.input}
                          type="number"
                          value={Number(item.estimated_high || 0)}
                          onChange={(event) => updateSellerPrepItemLocal(item.id, { estimated_high: Number(event.target.value) })}
                        />
                        <select
                          style={styles.input}
                          value={item.human_review_status || 'needs_review'}
                          onChange={(event) => updateSellerPrepItemLocal(item.id, { human_review_status: event.target.value })}
                        >
                          <option value="needs_review">needs_review</option>
                          <option value="approved">approved</option>
                          <option value="revise">revise</option>
                          <option value="rejected">rejected</option>
                        </select>
                      </div>

                      <input
                        style={styles.input}
                        value={item.recommendation || ''}
                        placeholder="Recommendation"
                        onChange={(event) => updateSellerPrepItemLocal(item.id, { recommendation: event.target.value })}
                      />

                      <p style={styles.small}>Missing info: {item.missing_info || 'None obvious'}</p>
                      <p style={styles.small}>Notes: {item.ai_notes || 'No notes.'}</p>

                      <div style={styles.buttonRow}>
                        <button
                          type="button"
                          style={styles.primaryButton}
                          disabled={sellerPrepSavingId === item.id}
                          onClick={() => saveSellerPrepItem(item)}
                        >
                          {sellerPrepSavingId === item.id ? 'Saving...' : 'Save Item'}
                        </button>
                        <button
                          type="button"
                          style={styles.outlineButton}
                          onClick={() => saveSellerPrepItemAsPricingMemory(item)}
                          disabled={item.human_review_status !== 'approved'}
                        >
                          Approve as Pricing Memory
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            ) : (
              <div style={styles.empty}>No leads loaded yet.</div>
            )}
          </section>
        )}

        {isAdmin && activeTab === 'pricingMemory' && (
          <section style={styles.card}>
            <div style={styles.buttonRow}>
              <div style={{ flex: 1 }}>
                <h2>Pricing Memory</h2>
                <p style={styles.muted}>
                  Human-verified prices saved from Seller Prep and historical/project review.
                </p>
              </div>
              <button type="button" style={styles.outlineButton} disabled={pricingMemoryLoading} onClick={loadPricingMemoryEntries}>
                {pricingMemoryLoading ? 'Loading...' : 'Refresh Pricing Memory'}
              </button>
            </div>

            {pricingMemoryEntries.length === 0 ? (
              <div style={styles.empty}>No pricing memory yet. Approve a Seller Prep item first.</div>
            ) : (
              <div style={styles.fileGrid}>
                {pricingMemoryEntries.map((entry) => (
                  <div key={entry.id} style={styles.requestCard}>
                    <strong>{entry.item_name || 'Unnamed pricing item'}</strong>
                    <p style={styles.small}>
                      {entry.category || 'seller_prep'} • {entry.unit || 'project'} • ZIP {entry.zip || 'not set'}
                    </p>
                    <p>Verified price: {money(entry.verified_price)}</p>
                    <p style={styles.small}>Source: {entry.source || 'not set'}</p>
                    <p style={styles.small}>
                      Human verified: {entry.human_verified ? 'Yes' : 'No'} • Last checked:{' '}
                      {entry.last_checked ? new Date(entry.last_checked).toLocaleDateString() : 'not set'}
                    </p>
                    {entry.notes && <p style={styles.small}>Notes: {entry.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {isAdmin && activeTab === 'materials' && (
          <section style={styles.card}>
            <h2>Material Cost Review</h2>
            <p style={styles.muted}>
              Review AI-found, database, and fallback material costs. Approving a price saves
              your judgment as pricing memory so future estimates can reuse it first.
            </p>

            <div style={styles.noticeBox}>
              Confidence labels: <strong>database_verified</strong> = you approved it,{' '}
              <strong>database_review</strong> = saved draft from database,{' '}
              <strong>medium</strong> = AI saw a visible web price,{' '}
              <strong>needs_review</strong> = uncertain AI/web price, and{' '}
              <strong>fallback_review</strong> = rough fallback price used.
            </div>

            <button
              style={styles.primaryButton}
              disabled={materialUpdating}
              onClick={updateMaterialCostsNow}
            >
              {materialUpdating ? 'Updating...' : 'Update Market Data'}
            </button>

            <button
              style={{ ...styles.outlineButton, marginLeft: 10 }}
              disabled={materialLoading}
              onClick={loadMaterials}
            >
              {materialLoading ? 'Loading...' : 'Refresh Material Database'}
            </button>

            <hr style={styles.divider} />

            <h3>Add Manual Draft Cost</h3>
            <p style={styles.small}>
              Optional. You can still let the AI agent add most draft prices automatically.
            </p>

            <input
              style={styles.input}
              placeholder="Material name, ex: concrete deck block"
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
            />

            <input
              style={styles.input}
              placeholder="Category, ex: Concrete / Lumber / Hardware"
              value={materialCategory}
              onChange={(e) => setMaterialCategory(e.target.value)}
            />

            <input
              style={styles.input}
              placeholder="Unit, ex: each / bag / sqft"
              value={materialUnit}
              onChange={(e) => setMaterialUnit(e.target.value)}
            />

            <input
              style={styles.input}
              placeholder="Typical price"
              value={materialPrice}
              onChange={(e) => setMaterialPrice(e.target.value)}
            />

            <input
              style={styles.input}
              placeholder="Source, ex: Home Depot / Lowe's / local supplier"
              value={materialSource}
              onChange={(e) => setMaterialSource(e.target.value)}
            />

            <button style={styles.primaryButton} onClick={addMaterialCost}>
              Add Draft Material Cost
            </button>

            <hr style={styles.divider} />

            <h3>Review Saved Material Costs</h3>

            <div style={{ marginTop: 16 }}>
              {materials.length === 0 && (
                <p style={styles.muted}>
                  No material costs yet. Run AI Research Materials on a job first, then refresh this screen.
                </p>
              )}

              {materials.map((item) => {
                const itemName = getMaterialName(item)
                const typicalPrice = getMaterialTypicalPrice(item)
                const confidence = getConfidenceLabel(item.confidence, item.human_verified)
                const lowPrice = item.low_price ?? null
                const highPrice = item.high_price ?? null
                const isVerified = Boolean(item.human_verified)

                return (
                  <div
                    key={item.id}
                    style={{
                      ...styles.requestCard,
                      border: isVerified ? '2px solid #0f542d' : '1px solid #d7dfd3',
                      background: isVerified ? '#f1fbf2' : 'white',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <strong>{itemName}</strong>
                        <p style={styles.small}>
                          {item.category || 'Material'} • {item.unit || 'each'} • ZIP:{' '}
                          {item.zip || item.region || 'Not set'}
                        </p>
                      </div>

                      <div
                        style={{
                          background: isVerified ? '#0f542d' : '#fff8e8',
                          color: isVerified ? 'white' : '#6f4f14',
                          borderRadius: 999,
                          padding: '8px 12px',
                          fontWeight: 900,
                          fontSize: 12,
                          height: 'fit-content',
                        }}
                      >
                        {confidence}
                      </div>
                    </div>

                    <div style={styles.grid3}>
                      <div style={styles.aiBox}>
                        <strong>Low</strong>
                        <p>{money(lowPrice)}</p>
                      </div>
                      <div style={styles.aiBox}>
                        <strong>Typical</strong>
                        <p>{money(typicalPrice)}</p>
                      </div>
                      <div style={styles.aiBox}>
                        <strong>High</strong>
                        <p>{money(highPrice)}</p>
                      </div>
                    </div>

                    <p style={styles.small}>
                      Source: {item.store_name || item.source || 'Not entered'}
                      {item.source_url ? ' • ' : ''}
                      {item.source_url && (
                        <a href={item.source_url} target="_blank" rel="noreferrer">
                          Open source
                        </a>
                      )}
                    </p>

                    <p style={styles.small}>
                      Last checked: {item.last_checked || item.updated_at || 'Not set'}
                    </p>

                    {item.notes && <p style={styles.small}>{item.notes}</p>}

                    <div style={styles.buttonRow}>
                      <button
                        style={styles.outlineButton}
                        disabled={materialSavingId === item.id}
                        onClick={() => editMaterialCost(item)}
                      >
                        {materialSavingId === item.id ? 'Saving...' : 'Edit / Save Price'}
                      </button>

                      <button
                        style={styles.primaryButton}
                        disabled={materialSavingId === item.id || isVerified}
                        onClick={() => approveMaterialCost(item)}
                      >
                        {isVerified ? 'Verified' : 'Approve as Verified'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {isAdmin && activeTab === 'labor' && (
          <section style={styles.card}>
            <h2>Labor Rate Review</h2>
            <p style={styles.muted}>
              Review and approve labor rates by trade, job type, unit, ZIP, and region.
              This becomes labor memory so estimates can use your verified rates instead
              of guessing.
            </p>

            <div style={styles.noticeBox}>
              Confidence labels: <strong>labor_verified</strong> = you approved it,{' '}
              <strong>labor_review</strong> = draft rate that needs review, and{' '}
              <strong>needs_review</strong> = incomplete or uncertain rate. AI can draft,
              but human approval is required before any proposal, estimate, purchase order,
              email, or submission is sent.
            </div>

            <button
              style={styles.outlineButton}
              disabled={laborLoading}
              onClick={loadLaborRates}
            >
              {laborLoading ? 'Loading...' : 'Refresh Labor Rates'}
            </button>

            <hr style={styles.divider} />

            <h3>Add Manual Draft Labor Rate</h3>
            <p style={styles.small}>
              Use this for local rates you know. Later the AI estimator can pull from this
              table when building the labor side of estimates.
            </p>

            <div style={styles.grid2}>
              <input
                style={styles.input}
                placeholder="Trade, ex: Roofing / Decking / Painting"
                value={laborTrade}
                onChange={(e) => setLaborTrade(e.target.value)}
              />

              <input
                style={styles.input}
                placeholder="Job type, ex: roof repair / deck framing"
                value={laborJobType}
                onChange={(e) => setLaborJobType(e.target.value)}
              />
            </div>

            <div style={styles.grid3}>
              <input
                style={styles.input}
                placeholder="Unit, ex: hour / sqft / day / fixed"
                value={laborUnit}
                onChange={(e) => setLaborUnit(e.target.value)}
              />

              <input
                style={styles.input}
                placeholder="Typical rate"
                value={laborTypicalRate}
                onChange={(e) => setLaborTypicalRate(e.target.value)}
              />

              <input
                style={styles.input}
                placeholder="Region, ex: Portland Metro"
                value={laborRegion}
                onChange={(e) => setLaborRegion(e.target.value)}
              />
            </div>

            <div style={styles.grid3}>
              <input
                style={styles.input}
                placeholder="Minimum charge"
                value={laborMinimumCharge}
                onChange={(e) => setLaborMinimumCharge(e.target.value)}
              />

              <input
                style={styles.input}
                placeholder="Trip charge"
                value={laborTripCharge}
                onChange={(e) => setLaborTripCharge(e.target.value)}
              />

              <input
                style={styles.input}
                placeholder="Disposal fee"
                value={laborDisposalFee}
                onChange={(e) => setLaborDisposalFee(e.target.value)}
              />
            </div>

            <button style={styles.primaryButton} onClick={addLaborRate}>
              Add Draft Labor Rate
            </button>

            <hr style={styles.divider} />

            <h3>Review Saved Labor Rates</h3>

            <div style={{ marginTop: 16 }}>
              {laborRates.length === 0 && (
                <p style={styles.muted}>
                  No labor rates yet. Add a few draft rates for your local market, then
                  approve them as verified when you are comfortable using them.
                </p>
              )}

              {laborRates.map((rate) => {
                const isVerified = Boolean(rate.human_verified)
                const confidence = getLaborConfidenceLabel(rate.confidence, rate.human_verified)

                return (
                  <div
                    key={rate.id}
                    style={{
                      ...styles.requestCard,
                      border: isVerified ? '2px solid #0f542d' : '1px solid #d7dfd3',
                      background: isVerified ? '#f1fbf2' : 'white',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <strong>{rate.trade}</strong>
                        <p style={styles.small}>
                          {rate.job_type || 'General'} • {rate.unit || 'hour'} • ZIP:{' '}
                          {rate.zip || rate.region || 'Not set'}
                        </p>
                      </div>

                      <div
                        style={{
                          background: isVerified ? '#0f542d' : '#fff8e8',
                          color: isVerified ? 'white' : '#6f4f14',
                          borderRadius: 999,
                          padding: '8px 12px',
                          fontWeight: 900,
                          fontSize: 12,
                          height: 'fit-content',
                        }}
                      >
                        {confidence}
                      </div>
                    </div>

                    <div style={styles.grid3}>
                      <div style={styles.aiBox}>
                        <strong>Low</strong>
                        <p>{money(rate.low_rate)}</p>
                      </div>
                      <div style={styles.aiBox}>
                        <strong>Typical</strong>
                        <p>{money(rate.typical_rate)}</p>
                      </div>
                      <div style={styles.aiBox}>
                        <strong>High</strong>
                        <p>{money(rate.high_rate)}</p>
                      </div>
                    </div>

                    <div style={styles.grid3}>
                      <div style={styles.aiBox}>
                        <strong>Minimum</strong>
                        <p>{money(rate.minimum_charge)}</p>
                      </div>
                      <div style={styles.aiBox}>
                        <strong>Trip</strong>
                        <p>{money(rate.trip_charge)}</p>
                      </div>
                      <div style={styles.aiBox}>
                        <strong>Disposal</strong>
                        <p>{money(rate.disposal_fee)}</p>
                      </div>
                    </div>

                    <p style={styles.small}>
                      Source: {rate.source || 'Shelter Prep'} • Last checked:{' '}
                      {rate.last_checked || rate.updated_at || 'Not set'}
                    </p>

                    {rate.notes && <p style={styles.small}>{rate.notes}</p>}

                    <div style={styles.buttonRow}>
                      <button
                        style={styles.outlineButton}
                        disabled={laborSavingId === rate.id}
                        onClick={() => editLaborRate(rate)}
                      >
                        {laborSavingId === rate.id ? 'Saving...' : 'Edit / Save Rate'}
                      </button>

                      <button
                        style={styles.primaryButton}
                        disabled={laborSavingId === rate.id || isVerified}
                        onClick={() => approveLaborRate(rate)}
                      >
                        {isVerified ? 'Verified' : 'Approve as Verified'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {isAdmin && activeTab === 'estimates' && (
          <section style={styles.card}>
            <h2>AI Estimate Review</h2>
            <p style={styles.muted}>
              AI can research and draft. A human must review and approve line items before
              any proposal, estimate, purchase order, email, or submission is sent.
            </p>

            {!selectedEstimateRequest && (
              <div style={styles.noticeBox}>
                Open a job from the Dashboard, then click Open Estimate Review. You can also
                run AI Research Materials first to fill this panel with draft material items.
              </div>
            )}

            {selectedEstimateRequest && (
              <>
                <div style={styles.requestCard}>
                  <strong>{selectedEstimateRequest.propertyAddress}</strong>
                  <p style={styles.small}>
                    {selectedEstimateRequest.city}, {selectedEstimateRequest.state}{' '}
                    {selectedEstimateRequest.zip}
                  </p>
                  <p style={styles.small}>
                    {selectedEstimateRequest.requesterName} • {selectedEstimateRequest.email}
                  </p>
                  <p>{selectedEstimateRequest.description}</p>
                  <div style={styles.noticeBox}>
                    Estimate status: {approvedEstimateCount}/{currentScopeEstimateItems.length} current-scope line items
                    approved. {allEstimateItemsApproved ? 'Ready for draft PDF.' : 'Still needs human review.'}
                    {rejectedEstimateCount > 0 ? ` ${rejectedEstimateCount} rejected item(s) hidden by default.` : ''}
                  </div>
                </div>

                {estimateIntelligence && (
                  <div style={styles.intelligencePanel}>
                    <div style={styles.buttonRow}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ marginTop: 0 }}>Estimate Intelligence Core</h3>
                        <p style={styles.small}>
                          Draft only. Quantities, labor, materials, overhead, and risk buffers need human/site review.
                        </p>
                      </div>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        onClick={() => copyToClipboard(estimateIntelligence.contractorPacket)}
                      >
                        Copy Contractor Packet
                      </button>
                    </div>

                    <div style={styles.grid3}>
                      <div style={styles.factCard}>
                        <span>Trades</span>
                        <strong>{estimateIntelligence.tradeBreakdown.join(', ')}</strong>
                      </div>
                      <div style={styles.factCard}>
                        <span>Labor</span>
                        <strong>
                          {estimateIntelligence.laborHours} hrs @ {money(estimateIntelligence.laborRate)}/hr
                        </strong>
                      </div>
                      <div style={styles.factCard}>
                        <span>Draft Range</span>
                        <strong>
                          {money(estimateIntelligence.suggestedLow)} - {money(estimateIntelligence.suggestedHigh)}
                        </strong>
                      </div>
                    </div>

                    <div style={styles.grid3}>
                      <div>
                        <strong>Quantity Basis</strong>
                        <ul style={styles.smallList}>
                          {estimateIntelligence.quantityBasis.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <strong>Missing Info</strong>
                        <ul style={styles.smallList}>
                          {(estimateIntelligence.missingInfo.length
                            ? estimateIntelligence.missingInfo
                            : ['None obvious']).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <strong>Risk Flags</strong>
                        <ul style={styles.smallList}>
                          {(estimateIntelligence.riskFlags.length
                            ? estimateIntelligence.riskFlags
                            : ['Standard risk']).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <pre style={styles.packetBox}>{estimateIntelligence.contractorPacket}</pre>
                  </div>
                )}

                <div style={styles.aiBox}>
                  <strong>Labor Rate Auto-Fill</strong>
                  <p style={styles.small}>{estimateLaborMessage}</p>

                  {appliedLaborRate ? (
                    <div style={styles.noticeBox}>
                      <strong>Matched labor memory:</strong> {appliedLaborRate.trade}
                      {appliedLaborRate.job_type ? ` / ${appliedLaborRate.job_type}` : ''} •{' '}
                      {money(Number(appliedLaborRate.typical_rate || 0))}/{appliedLaborRate.unit || 'hour'} •{' '}
                      {getLaborConfidenceLabel(appliedLaborRate.confidence, appliedLaborRate.human_verified)}
                    </div>
                  ) : (
                    <div style={styles.noticeBox}>
                      No verified labor rate is currently applied. You can enter labor manually, or approve rates in Labor Rates first.
                    </div>
                  )}

                  <div style={styles.grid3}>
                    <input
                      style={styles.input}
                      type="number"
                      placeholder="Labor units / hours"
                      value={estimateLaborUnits}
                      onChange={(e) => setEstimateLaborUnits(e.target.value)}
                    />
                    <input
                      style={styles.input}
                      type="number"
                      placeholder="Minimum charge"
                      value={estimateMinimumCharge}
                      onChange={(e) => setEstimateMinimumCharge(e.target.value)}
                    />
                    <input
                      style={styles.input}
                      type="number"
                      placeholder="Trip charge"
                      value={estimateTripCharge}
                      onChange={(e) => setEstimateTripCharge(e.target.value)}
                    />
                  </div>

                  <div style={styles.grid2}>
                    <input
                      style={styles.input}
                      type="number"
                      placeholder="Disposal fee"
                      value={estimateDisposalFee}
                      onChange={(e) => setEstimateDisposalFee(e.target.value)}
                    />
                    <button
                      type="button"
                      style={styles.outlineButton}
                      onClick={() => selectedEstimateRequest && applyBestLaborRateForRequest(selectedEstimateRequest, true)}
                    >
                      Re-Apply Best Labor Rate
                    </button>
                  </div>
                </div>

                <div style={styles.grid2}>
                  <input
                    style={styles.input}
                    type="number"
                    placeholder="Labor total / manual override"
                    value={estimateLaborCost}
                    onChange={(e) => setEstimateLaborCost(e.target.value)}
                  />
                  <input
                    style={styles.input}
                    type="number"
                    placeholder="Markup %"
                    value={estimateMarkupPercent}
                    onChange={(e) => setEstimateMarkupPercent(e.target.value)}
                  />
                </div>

                <input
                  style={styles.input}
                  type="number"
                  placeholder="Contingency %"
                  value={estimateContingencyPercent}
                  onChange={(e) => setEstimateContingencyPercent(e.target.value)}
                />

                <textarea
                  style={{ ...styles.input, minHeight: 100 }}
                  placeholder="Estimate notes and assumptions"
                  value={estimateNotes}
                  onChange={(e) => setEstimateNotes(e.target.value)}
                />

                <div style={styles.aiBox}>
                  <strong>Estimate Summary</strong>
                  <p>Materials: {money(estimateMaterialSubtotal)}</p>
                  <p>Labor: {money(estimateLaborNumber)}</p>
                  {appliedLaborRate && (
                    <p style={styles.small}>
                      Labor base: {money(estimateLaborBaseNumber)} • Minimum:{' '}
                      {money(estimateLaborMinimumNumber)} • Trip:{' '}
                      {money(estimateTripChargeNumber)} • Disposal:{' '}
                      {money(estimateDisposalFeeNumber)}
                    </p>
                  )}
                  <p>
                    Markup: {estimateMarkupPercent}% = {money(estimateMarkupDollars)}
                  </p>
                  <p>
                    Contingency: {estimateContingencyPercent}% ={' '}
                    {money(estimateContingencyDollars)}
                  </p>
                  <p>
                    Suggested range: {money(estimateLowTotal)} - {money(estimatePremiumTotal)}
                  </p>
                  <h3>Standard estimate: {money(estimateStandardTotal)}</h3>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={() => setShowManualMaterialForm((current) => !current)}
                  >
                    + Add Material
                  </button>
                  <label style={{ ...styles.outlineButton, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={showRejectedEstimateItems}
                      onChange={(event) => setShowRejectedEstimateItems(event.target.checked)}
                    />
                    Show rejected items
                  </label>
                  <button
                    style={styles.primaryButton}
                    onClick={() => selectedEstimateRequest && buildLocalEstimateIntelligence(selectedEstimateRequest)}
                  >
                    Build Estimate Intelligence
                  </button>
                  <button style={styles.outlineButton} onClick={approveAllEstimateItems}>
                    Approve All Line Items
                  </button>
                  <button style={styles.primaryButton} onClick={generateEstimatePdf}>
                    Generate Draft PDF
                  </button>
                  <button style={styles.outlineButton} onClick={generateInvoicePdf}>
                    Generate Draft Invoice
                  </button>
                  <button
                    style={styles.outlineButton}
                    onClick={() => selectedEstimateRequest && openEstimateReview(selectedEstimateRequest)}
                    disabled={estimateLoading}
                  >
                    {estimateLoading ? 'Loading...' : 'Refresh Items'}
                  </button>
                </div>

                {showManualMaterialForm && (
                  <div style={styles.requestCard}>
                    <div style={styles.badgeRow}>
                      <span style={styles.badge}>Human-added material</span>
                      <span style={styles.badgeMuted}>Current job only</span>
                    </div>
                    <div style={isCompact ? styles.mobileStack : styles.grid2}>
                      <input
                        style={styles.input}
                        placeholder="Material name"
                        value={manualMaterialDraft.itemName}
                        onChange={(e) => updateManualMaterialDraft({ itemName: e.target.value })}
                      />
                      <input
                        style={styles.input}
                        placeholder="Vendor/source"
                        value={manualMaterialDraft.vendor}
                        onChange={(e) => updateManualMaterialDraft({ vendor: e.target.value })}
                      />
                    </div>
                    <div style={isCompact ? styles.mobileStack : styles.grid3}>
                      <input
                        style={styles.input}
                        type="number"
                        placeholder="Quantity"
                        value={manualMaterialDraft.quantity}
                        onChange={(e) => updateManualMaterialDraft({ quantity: e.target.value })}
                      />
                      <input
                        style={styles.input}
                        type="number"
                        placeholder="Unit cost"
                        value={manualMaterialDraft.unitCost}
                        onChange={(e) => updateManualMaterialDraft({ unitCost: e.target.value })}
                      />
                      <input
                        style={styles.input}
                        type="number"
                        placeholder="Total cost"
                        value={manualMaterialDraft.totalCost}
                        onChange={(e) => updateManualMaterialDraft({ totalCost: e.target.value })}
                      />
                    </div>
                    <div style={isCompact ? styles.mobileStack : styles.grid2}>
                      <input
                        style={styles.input}
                        placeholder="Source URL"
                        value={manualMaterialDraft.sourceUrl}
                        onChange={(e) => updateManualMaterialDraft({ sourceUrl: e.target.value })}
                      />
                      <input
                        style={styles.input}
                        placeholder="Repair item / scope link"
                        value={manualMaterialDraft.repairItemId}
                        onChange={(e) => updateManualMaterialDraft({ repairItemId: e.target.value })}
                      />
                    </div>
                    <select
                      style={styles.input}
                      value={manualMaterialDraft.reviewStatus}
                      onChange={(e) =>
                        updateManualMaterialDraft({ reviewStatus: e.target.value as ManualMaterialDraft['reviewStatus'] })
                      }
                    >
                      <option value="needs_review">needs_review</option>
                      <option value="approved">approved</option>
                    </select>
                    <textarea
                      style={{ ...styles.input, minHeight: 90 }}
                      placeholder="Notes"
                      value={manualMaterialDraft.notes}
                      onChange={(e) => updateManualMaterialDraft({ notes: e.target.value })}
                    />
                    <div style={styles.buttonRow}>
                      <button type="button" style={styles.primaryButton} onClick={addManualEstimateItem}>
                        Save Material
                      </button>
                      <button
                        type="button"
                        style={styles.outlineButton}
                        onClick={() => {
                          setManualMaterialDraft(EMPTY_MANUAL_MATERIAL_DRAFT)
                          setShowManualMaterialForm(false)
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {visibleEstimateItems.length === 0 && (
                  <div style={styles.empty}>
                    No current-scope material items are visible. Add a material, run current-scope research, or show rejected items.
                  </div>
                )}

                {visibleEstimateItems.map((item) => (
                  <div key={item.id} style={isCompact ? { ...styles.requestCard, ...styles.mobileRequestCard } : styles.requestCard}>
                    <div style={styles.badgeRow}>
                      <span style={isEstimateItemRejected(item) ? styles.badgeDanger : styles.badge}>
                        {isEstimateItemRejected(item) ? 'Rejected' : item.confidence === 'human_added' ? 'Human-added material' : item.source_status === 'needs_source_review' ? 'Needs source review' : 'Included because...'}
                      </span>
                      {item.human_approved && <span style={styles.badge}>Learned from approval</span>}
                      {isEstimateItemRejected(item) && <span style={styles.badgeMuted}>Learned from rejection</span>}
                      {item.source_status === 'pricing_memory' && <span style={styles.badgeMuted}>Price support only</span>}
                    </div>
                    <p style={styles.small}>Included because: {getEstimateInclusionReason(item)}</p>

                    <div style={isCompact ? styles.mobileStack : styles.grid2}>
                      <input
                        style={styles.input}
                        value={item.item_name || ''}
                        onChange={(e) =>
                          updateLocalEstimateItem(item.id, { item_name: e.target.value })
                        }
                      />
                      <input
                        style={styles.input}
                        value={item.source || ''}
                        placeholder="Source"
                        onChange={(e) =>
                          updateLocalEstimateItem(item.id, { source: e.target.value })
                        }
                      />
                    </div>

                    {(item.required_quantity || item.package_coverage || item.packages_needed) && (
                      <div style={styles.aiBox}>
                        <strong>Package Math</strong>
                        <div style={styles.grid3}>
                          <p style={styles.small}>
                            Required: {Number(item.required_quantity || item.quantity || 0).toLocaleString()}{' '}
                            {item.required_unit || 'units'}
                          </p>
                          <p style={styles.small}>
                            Package: {Number(item.package_coverage || item.package_size || 1).toLocaleString()}{' '}
                            {item.package_coverage_unit || item.package_unit || 'per package'}
                          </p>
                          <p style={styles.small}>
                            Packages: {Number(item.packages_needed || item.quantity || 0).toLocaleString()} ×{' '}
                            {money(Number(item.package_price || item.unit_price || 0))}
                          </p>
                        </div>
                        <p style={styles.small}>
                          {item.quantity_reason || 'Quantity draft needs human review.'}
                        </p>
                        <p style={styles.small}>
                          Source status: <strong>{item.source_status || 'needs_source_review'}</strong>
                          {item.source_status === 'needs_source_review'
                            ? ' • Product/search price is not verified. Do not approve automatically.'
                            : ' • Human-approved pricing memory used.'}
                        </p>
                      </div>
                    )}

                    <div style={isCompact ? styles.mobileStack : styles.grid3}>
                      <input
                        style={styles.input}
                        type="number"
                        value={Number(item.quantity || 0)}
                        onChange={(e) =>
                          updateLocalEstimateItem(item.id, {
                            quantity: Number(e.target.value),
                          })
                        }
                      />
                      <input
                        style={styles.input}
                        type="number"
                        value={Number(item.unit_price || 0)}
                        onChange={(e) =>
                          updateLocalEstimateItem(item.id, {
                            unit_price: Number(e.target.value),
                          })
                        }
                      />
                      <input
                        style={styles.input}
                        value={money(Number(item.total_price || 0))}
                        readOnly
                      />
                    </div>

                    <input
                      style={styles.input}
                      placeholder="Source URL"
                      value={item.source_url || ''}
                      onChange={(e) =>
                        updateLocalEstimateItem(item.id, { source_url: e.target.value })
                      }
                    />

                    <div style={isCompact ? styles.mobileStack : styles.grid2}>
                      <select
                        style={styles.input}
                        value={item.rejection_reason || ''}
                        disabled={item.human_approved}
                        onChange={(e) => updateLocalEstimateItem(item.id, { rejection_reason: e.target.value })}
                      >
                        <option value="">Rejection reason</option>
                        {MATERIAL_REJECTION_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                      <input
                        style={styles.input}
                        placeholder="Admin notes"
                        value={item.admin_notes || ''}
                        onChange={(e) => updateLocalEstimateItem(item.id, { admin_notes: e.target.value })}
                      />
                    </div>

                    <p style={styles.small}>
                      Confidence: {item.confidence || 'needs_review'} • Status:{' '}
                      {item.human_approved ? 'Human approved' : item.review_status || 'Needs review'}
                    </p>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        style={styles.primaryButton}
                        onClick={() => saveEstimateItem(item)}
                        disabled={estimateSavingId === item.id}
                      >
                        {estimateSavingId === item.id ? 'Saving...' : 'Save Line Item'}
                      </button>
                      <button
                        style={styles.outlineButton}
                        onClick={() => toggleEstimateItemApproved(item)}
                        disabled={isEstimateItemRejected(item)}
                      >
                        {item.human_approved ? 'Unapprove' : 'Approve'}
                      </button>
                      <button
                        style={styles.outlineButton}
                        onClick={() => rejectEstimateItem(item)}
                        disabled={item.human_approved || estimateSavingId === item.id}
                      >
                        Reject / Remove
                      </button>
                      <button
                        style={styles.outlineButton}
                        onClick={() => saveEstimateItemAsPricingMemory(item)}
                        disabled={!item.human_approved || isEstimateItemRejected(item)}
                      >
                        Use this price next time
                      </button>
                      {item.source_url && (
                        <button
                          style={styles.linkButton}
                          onClick={() => window.open(item.source_url || '', '_blank')}
                        >
                          Open Source
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {estimateResearchRows.length > 0 && (
                  <div style={{ marginTop: 22 }}>
                    <h3>Research Screenshots</h3>
                    <div style={styles.fileGrid}>
                      {estimateResearchRows.map((row) => (
                        <div key={row.id} style={styles.fileBox}>
                          <strong>{row.source || 'Source'}</strong>
                          <p style={styles.small}>{row.search_query}</p>
                          {row.screenshot_url ? (
                            <button
                              style={styles.linkButton}
                              onClick={() => window.open(row.screenshot_url || '', '_blank')}
                            >
                              Open Screenshot
                            </button>
                          ) : (
                            <p style={styles.small}>No screenshot saved.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </main>
      {materialEditorItem && materialEditorDraft && (
        <div style={styles.overlay} onClick={closeMaterialEditor}>
          <div style={{ ...styles.modal, maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <h2>Edit Material Cost</h2>
            <div style={styles.grid2}>
              <input
                style={styles.input}
                placeholder="Material name"
                value={materialEditorDraft.name}
                onChange={(e) =>
                  setMaterialEditorDraft((draft) => draft ? { ...draft, name: e.target.value } : draft)
                }
              />
              <input
                style={styles.input}
                placeholder="Unit"
                value={materialEditorDraft.unit}
                onChange={(e) =>
                  setMaterialEditorDraft((draft) => draft ? { ...draft, unit: e.target.value } : draft)
                }
              />
              <input
                style={styles.input}
                placeholder="Typical price"
                value={materialEditorDraft.typicalPrice}
                onChange={(e) =>
                  setMaterialEditorDraft((draft) => draft ? { ...draft, typicalPrice: e.target.value } : draft)
                }
              />
              <input
                style={styles.input}
                placeholder="Category"
                value={materialEditorDraft.category}
                onChange={(e) =>
                  setMaterialEditorDraft((draft) => draft ? { ...draft, category: e.target.value } : draft)
                }
              />
              <input
                style={styles.input}
                placeholder="Low price"
                value={materialEditorDraft.lowPrice}
                onChange={(e) =>
                  setMaterialEditorDraft((draft) => draft ? { ...draft, lowPrice: e.target.value } : draft)
                }
              />
              <input
                style={styles.input}
                placeholder="High price"
                value={materialEditorDraft.highPrice}
                onChange={(e) =>
                  setMaterialEditorDraft((draft) => draft ? { ...draft, highPrice: e.target.value } : draft)
                }
              />
              <input
                style={styles.input}
                placeholder="ZIP or service area"
                value={materialEditorDraft.zip}
                onChange={(e) =>
                  setMaterialEditorDraft((draft) => draft ? { ...draft, zip: e.target.value } : draft)
                }
              />
              <input
                style={styles.input}
                placeholder="Source / store"
                value={materialEditorDraft.source}
                onChange={(e) =>
                  setMaterialEditorDraft((draft) => draft ? { ...draft, source: e.target.value } : draft)
                }
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" style={styles.secondaryButton} onClick={closeMaterialEditor}>
                Cancel
              </button>
              <button
                type="button"
                style={styles.primaryButton}
                disabled={materialSavingId === materialEditorItem.id}
                onClick={saveMaterialEditor}
              >
                {materialSavingId === materialEditorItem.id ? 'Saving...' : 'Save Material'}
              </button>
            </div>
          </div>
        </div>
      )}
      {sellerPrepReview && (
  <div style={styles.overlay} onClick={() => setSellerPrepReview(null)}>
    <div
      style={{
        ...styles.modal,
        maxWidth: 980,
        maxHeight: '90vh',
        overflow: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ marginTop: 0, color: '#06542d' }}>
            Seller Prep Review
          </h2>
          <p style={{ marginTop: 0 }}>
            Powered by AI. Approved by humans.
          </p>
        </div>
        <button
  type="button"
  style={{
    background: '#06542d',
    color: '#ffffff',
    border: '1px solid #06542d',
    borderRadius: 12,
    padding: '10px 14px',
    fontWeight: 800,
    cursor: 'pointer',
  }}
  onClick={printSellerPrepReport}
>
  Print / Save PDF Report
</button>
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={() => setSellerPrepReview(null)}
        >
          Close
        </button>
      </div>

      <div
        style={{
          background: '#e8f5eb',
          border: '1px solid #b7dfc1',
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <strong>Total Repair Range:</strong>{' '}
        ${sellerPrepReview.analysis.total_repair_low || 0} - $
        {sellerPrepReview.analysis.total_repair_high || 0}
        <br />

        <strong>Possible Value / Negotiation Impact:</strong>{' '}
        ${sellerPrepReview.analysis.total_value_impact_low || 0} - $
        {sellerPrepReview.analysis.total_value_impact_high || 0}
        <br />

        <strong>Seller Net Impact:</strong>{' '}
        ${sellerPrepReview.analysis.seller_net_low || 0} - $
        {sellerPrepReview.analysis.seller_net_high || 0}
        <br />

        <strong>Average Buyer Impact:</strong>{' '}
        {sellerPrepReview.analysis.average_buyer_impact_score || 0}/10
        <br />

        <strong>Average Inspection Risk:</strong>{' '}
        {sellerPrepReview.analysis.average_inspection_risk_score || 0}/10
      </div>

      <div
        style={{
          background: '#fff7df',
          border: '1px solid #eed38a',
          borderRadius: 16,
          padding: 14,
          marginBottom: 16,
          color: '#6b4a00',
        }}
      >
        AI-assisted analysis only. Human review is required before sending,
        approving, ordering, submitting, or making final recommendations.
      </div>

      <h3>Agent Summary</h3>
      <p>{sellerPrepReview.analysis.agent_summary || 'No summary available.'}</p>

      <h3>Seller Summary</h3>
      <p>{sellerPrepReview.analysis.seller_summary || 'No summary available.'}</p>

      <h3>Repair Items</h3>

      <div style={{ display: 'grid', gap: 12 }}>
        {sellerPrepReview.items.length === 0 ? (
          <div>No seller prep items found.</div>
        ) : (
          sellerPrepReview.items.map((item: any) => (
            <div
              key={item.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: 16,
                padding: 16,
                background: '#fff',
              }}
            >
              <h4 style={{ margin: '0 0 8px 0', color: '#06542d' }}>
                {item.repair_item}
              </h4>

              <p style={{ marginTop: 0 }}>
                {item.scope_summary || 'No scope summary.'}
              </p>

              <div style={{ display: 'grid', gap: 6 }}>
                <div>
                  <strong>Trade:</strong> {item.trade_category || 'General'}
                </div>

                <div>
                  <strong>Cost Range:</strong> ${item.estimated_cost_low || 0} - $
                  {item.estimated_cost_high || 0}
                </div>

                <div>
                  <strong>Buyer Impact Score:</strong>{' '}
                  {item.buyer_impact_score || 0}/10
                </div>

                <div>
                  <strong>Inspection Risk Score:</strong>{' '}
                  {item.inspection_risk_score || 0}/10
                </div>

                <div>
                  <strong>Possible Value / Negotiation Impact:</strong>{' '}
                  ${item.estimated_value_impact_low || 0} - $
                  {item.estimated_value_impact_high || 0}
                </div>

                <div>
                  <strong>Seller Net Impact:</strong>{' '}
                  ${item.seller_net_impact_low || 0} - $
                  {item.seller_net_impact_high || 0}
                </div>

                <div>
                  <strong>Recommendation:</strong>{' '}
                  {String(item.recommendation || 'needs_human_review').replace(/_/g, ' ')}
                </div>

                <div>
                  <strong>Confidence:</strong>{' '}
                  {String(item.confidence || 'needs_review').replace(/_/g, ' ')}
                </div>

                <div>
                  <strong>Human Review:</strong>{' '}
                  {String(item.human_review_status || 'needs_review').replace(/_/g, ' ')}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
)}
      {showLogin && (
        <div style={styles.overlay} onClick={() => setShowLogin(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Admin Login</h2>
            <p style={styles.muted}>Enter the admin PIN to continue.</p>
            <p style={styles.muted}>Admin PIN: 2750</p>

            <input
              style={styles.input}
              placeholder="Enter admin PIN"
              value={adminPinInput}
              onChange={(e) => setAdminPinInput(e.target.value)}
            />

            <button style={styles.primaryButton} onClick={handleLogin}>
              Sign In
            </button>

            <button
              style={{ ...styles.outlineButton, marginLeft: 10 }}
              onClick={() => setShowLogin(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {

  buttonRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  warningBox: {
    border: '1px solid #d9b35f',
    background: '#fff8e8',
    color: '#5b410b',
    borderRadius: 14,
    padding: 14,
    margin: '14px 0 18px',
    lineHeight: 1.5,
  },
  reviewBox: {
    border: '1px solid #d7dfd3',
    background: '#fbfdf9',
    borderRadius: 18,
    padding: 18,
  },
  scopeText: {
    whiteSpace: 'pre-wrap',
    lineHeight: 1.55,
    color: '#123524',
    background: '#f7faf5',
    border: '1px solid #dfe8da',
    borderRadius: 12,
    padding: 12,
  },
  mutedList: {
    color: '#536056',
    lineHeight: 1.6,
    marginTop: 8,
  },
  replyDraftBox: {
    marginTop: 8,
    whiteSpace: 'pre-wrap',
    lineHeight: 1.55,
    background: '#f5f7fb',
    border: '1px solid #dce3ee',
    borderRadius: 12,
    padding: 12,
    color: '#1f2a30',
  },
  linkPanel: {
    border: '1px solid #cbd8ca',
    background: '#ffffff',
    borderRadius: 8,
    padding: 14,
    textAlign: 'left',
    cursor: 'pointer',
    color: '#173425',
    display: 'grid',
    gap: 6,
    lineHeight: 1.4,
  },
  propertyProfileCard: {
    border: '1px solid #cbd8ca',
    background: '#fbfdf9',
    borderRadius: 8,
    padding: 12,
    margin: '12px 0',
  },
  mobilePropertyProfileCard: {
    borderRadius: 20,
    padding: 14,
    background: '#fbfdf9',
  },
  compactFactGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 8,
    marginTop: 10,
    fontSize: 13,
    color: '#36463b',
  },
  mobileCompactFactGrid: {
    gridTemplateColumns: '1fr',
    gap: 7,
    fontSize: 15,
  },
  intelligencePanel: {
    border: '1px solid #9fc6a7',
    background: '#f4fbf5',
    borderRadius: 8,
    padding: 16,
    margin: '16px 0',
  },
  packetBox: {
    whiteSpace: 'pre-wrap',
    background: '#ffffff',
    border: '1px solid #d7dfd3',
    borderRadius: 8,
    padding: 12,
    color: '#173425',
    fontFamily: 'Inter, Arial, sans-serif',
    fontSize: 13,
    lineHeight: 1.5,
  },
  page: {
    minHeight: '100vh',
    background: '#f6f4ef',
    color: '#173425',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "SF Pro Display", "Segoe UI", Arial, sans-serif',
    WebkitTextSizeAdjust: '100%' as any,
  },
  mobilePage: {
    background: '#f7f5f0',
    paddingBottom: 'calc(env(safe-area-inset-bottom) + 18px)',
  },
  header: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.4fr 1fr',
    gap: 20,
    alignItems: 'center',
    padding: '28px 42px 18px',
  },
  mobileHeader: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 12,
    padding: '18px 16px 10px',
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: 'rgba(247,245,240,0.96)',
    backdropFilter: 'blur(18px)',
    borderBottom: '1px solid rgba(15,84,45,0.08)',
  },
  brand: {
    fontSize: 30,
    letterSpacing: 3,
    fontWeight: 900,
    color: '#0f542d',
  },
  mobileBrand: {
    fontSize: 22,
    letterSpacing: 1.5,
  },
  subBrand: {
    marginTop: 8,
    fontSize: 12,
    letterSpacing: 5,
    fontWeight: 800,
    color: '#0f542d',
  },
  mobileSubBrand: {
    marginTop: 4,
    fontSize: 10,
    letterSpacing: 3,
  },
  nav: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  mobileNav: {
    justifyContent: 'flex-start',
    flexWrap: 'nowrap',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch' as any,
    paddingBottom: 4,
    marginLeft: -2,
    marginRight: -2,
  },
  navButton: {
    border: 'none',
    background: 'transparent',
    padding: '11px 14px',
    borderRadius: 999,
    fontWeight: 800,
    cursor: 'pointer',
    color: '#173425',
    minHeight: 44,
  },
  navActive: {
    border: '1px solid #0f542d',
    background: '#e7f3e5',
    padding: '11px 14px',
    borderRadius: 999,
    fontWeight: 900,
    cursor: 'pointer',
    color: '#0f542d',
    minHeight: 44,
  },
  mobileNavPill: {
    flex: '0 0 auto',
    padding: '11px 15px',
    minHeight: 48,
    whiteSpace: 'nowrap',
  },
  headerActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  mobileHeaderActions: {
    justifyContent: 'stretch',
  },
  main: {
    padding: '12px 42px 60px',
  },
  mobileMain: {
    padding: '12px 14px calc(env(safe-area-inset-bottom) + 28px)',
  },
  previewBanner: {
    margin: '0 42px 18px',
    padding: '14px 18px',
    border: '1px solid #d9b35f',
    borderRadius: 16,
    background: '#fff8e8',
    color: '#5b410b',
    lineHeight: 1.45,
  },
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: '1fr 0.45fr',
    gap: 22,
  },
  card: {
    background: 'white',
    border: '1px solid #d7dfd3',
    borderRadius: 22,
    padding: 24,
    boxShadow: '0 10px 28px rgba(15,84,45,0.06)',
    marginBottom: 18,
  },
  mobileCard: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    boxShadow: '0 10px 30px rgba(15,84,45,0.08)',
  },
  sideCard: {
    background: '#eef3ea',
    border: '1px solid #d7dfd3',
    borderRadius: 22,
    padding: 24,
    alignSelf: 'start',
  },
  healthGrid: {
    display: 'grid',
    gap: 10,
    margin: '12px 0 16px',
  },
  healthRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    background: '#ffffff',
    border: '1px solid #d7dfd3',
    borderRadius: 12,
    padding: '10px 12px',
  },
  healthOk: {
    color: '#0f542d',
  },
  healthNeedsSetup: {
    color: '#8a5b00',
  },
  hero: {
    background: 'linear-gradient(135deg,#0f542d,#07391f)',
    color: 'white',
    padding: 28,
    borderRadius: 24,
    fontSize: 34,
    fontWeight: 900,
    marginBottom: 18,
  },
  muted: {
    color: '#5f6f63',
    lineHeight: 1.5,
  },
  small: {
    color: '#5f6f63',
    fontSize: 14,
    lineHeight: 1.4,
  },
  smallList: {
    color: '#5f6f63',
    fontSize: 14,
    lineHeight: 1.5,
    paddingLeft: 18,
  },
  input: {
    width: '100%',
    minHeight: 52,
    padding: '14px 16px',
    borderRadius: 16,
    border: '1px solid #d7dfd3',
    marginBottom: 12,
    boxSizing: 'border-box',
    fontSize: 16,
    color: '#173425',
    background: '#ffffff',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
    gap: 12,
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
    gap: 12,
  },
  grid5: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))',
    gap: 10,
    marginBottom: 12,
  },
  mobileStack: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 12,
  },
  propertyInfoPanel: {
    border: '1px solid #d7dfd3',
    background: '#fbfcfa',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  factCard: {
    border: '1px solid #d7dfd3',
    background: '#f7faf5',
    borderRadius: 14,
    padding: 12,
    display: 'grid',
    gap: 4,
    color: '#173425',
  },
  uploadBox: {
    border: '1px solid #d7dfd3',
    borderRadius: 16,
    padding: 16,
    background: '#fbfcfa',
    marginBottom: 12,
  },
  primaryButton: {
    border: 'none',
    background: '#0f542d',
    color: 'white',
    padding: '13px 18px',
    borderRadius: 16,
    cursor: 'pointer',
    fontWeight: 900,
    minHeight: 48,
  },
  outlineButton: {
    border: '1px solid #d7dfd3',
    background: 'white',
    color: '#173425',
    padding: '13px 18px',
    borderRadius: 16,
    cursor: 'pointer',
    fontWeight: 900,
    minHeight: 48,
  },
  secondaryButton: {
    border: '1px solid #d7dfd3',
    background: '#f8faf7',
    color: '#173425',
    padding: '10px 14px',
    borderRadius: 16,
    cursor: 'pointer',
    fontWeight: 800,
    minHeight: 48,
  },
  wideButton: {
    width: '100%',
    border: 'none',
    background: '#0f542d',
    color: 'white',
    padding: '13px 18px',
    borderRadius: 16,
    cursor: 'pointer',
    fontWeight: 900,
    marginTop: 10,
    minHeight: 50,
  },
  success: {
    background: '#e7f3e5',
    color: '#0f542d',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    fontWeight: 800,
  },
  kanban: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: 18,
  },
  mobileKanban: {
    gap: 14,
  },
  column: {
    borderRadius: 20,
    padding: 18,
    minHeight: 0,
  },
  mobileColumn: {
    borderRadius: 24,
    padding: 12,
  },
  empty: {
    background: 'rgba(255,255,255,0.8)',
    borderRadius: 14,
    padding: 14,
    color: '#5f6f63',
  },
  requestCard: {
    background: 'white',
    border: '1px solid #d7dfd3',
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
    maxWidth: 920,
  },
  mobileRequestCard: {
    borderRadius: 24,
    padding: 18,
    maxWidth: 'none',
    marginBottom: 12,
    boxShadow: '0 8px 22px rgba(15,84,45,0.07)',
  },
  mobileRequestTitle: {
    display: 'block',
    fontSize: 20,
    lineHeight: 1.2,
    marginBottom: 6,
    letterSpacing: 0,
  },
  fileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
    gap: 14,
  },
  fileBox: {
    background: '#fbfcfa',
    border: '1px solid #d7dfd3',
    borderRadius: 14,
    padding: 14,
  },
  fileActionRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
    alignItems: 'center',
    gap: 12,
    padding: '10px 0',
    borderBottom: '1px solid #edf1ea',
  },
  mobileFileActionRow: {
    gridTemplateColumns: '1fr',
    gap: 8,
    padding: '12px 0',
  },
  fileName: {
    color: '#173425',
    fontSize: 14,
    fontWeight: 800,
    overflowWrap: 'anywhere',
    minWidth: 0,
  },
  linkButton: {
    display: 'block',
    border: 'none',
    background: 'transparent',
    color: '#0f542d',
    padding: '4px 0',
    fontWeight: 800,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  mobileLinkButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    padding: '10px 12px',
    borderRadius: 14,
    background: '#eef6ec',
    textDecoration: 'none',
  },
  noticeBox: {
    background: '#fff8e8',
    border: '1px solid #ecd9a7',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    marginBottom: 10,
    color: '#6f4f14',
    fontSize: 12,
    lineHeight: 1.45,
  },
  aiBox: {
    background: '#e7f3e5',
    border: '1px solid #d7dfd3',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #d7dfd3',
    margin: '22px 0',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 1000,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    background: 'white',
    borderRadius: 20,
    padding: 24,
  },
}
