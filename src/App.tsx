import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import Gallery from './components/Gallery'

type RequestStatus = 'new' | 'needs_info' | 'estimate_ready' | 'pending_approval'

type Tab = 'new' | 'gallery' | 'intake' | 'messages' | 'dashboard' | 'archived' | 'invoices' | 'materials' | 'labor' | 'estimates'

type StoredFile = {
  name: string
  path: string
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
  item_name: string
  source: string | null
  source_url: string | null
  quantity: number | null
  unit_price: number | null
  total_price: number | null
  confidence: string | null
  human_approved: boolean | null
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
const ADMIN_PIN = '0202'
const REQUEST_FILES_BUCKET = 'job-files'
const INVOICE_BUCKET = 'invoices'

const AGENT_API_URL = 'https://shelter-prep-agent-production.up.railway.app'
const AGENT_API_KEY = 'PASTE_YOUR_AGENT_API_KEY_HERE'

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

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Not set'
  return `$${Number(value).toFixed(2)}`
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

function countItems(value: any[] | null | undefined) {
  return Array.isArray(value) ? value.length : 0
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


function normalizeRequestStatus(value: any): RequestStatus {
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
  const [adminPinInput, setAdminPinInput] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

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

  useEffect(() => {
    loadRequestsFromSupabase()
  }, [])

  // Requests are now loaded from Supabase so phone + desktop stay in sync.
  // Do not save dashboard requests to browser localStorage.

  useEffect(() => {
    if (isAdmin && activeTab === 'invoices') loadInvoices()
    if (isAdmin && activeTab === 'materials') loadMaterials()
    if (isAdmin && activeTab === 'labor') loadLaborRates()
    if (isAdmin && activeTab === 'messages') loadMessageCenter()
    if (isAdmin && activeTab === 'archived') loadArchivedRequestsFromSupabase()
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
        headers: {
          'Content-Type': 'application/json',
          'x-agent-key': AGENT_API_KEY,
        },
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
        headers: {
          'Content-Type': 'application/json',
          'x-agent-key': AGENT_API_KEY,
        },
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

      const mapped = (data || []).map(mapLeadRowToWorkRequest)
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

      if (error) throw error

      const mapped = (data || []).map(mapLeadRowToWorkRequest)
      setArchivedRequests(mapped)
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not load archived leads from Supabase.')
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
    type: 'photo' | 'document'
  ) {
    const uploaded: StoredFile[] = []

    for (const file of files) {
      const path = `${folder}/${Date.now()}-${safeFileName(file.name)}`

      const { error } = await supabase.storage
        .from(REQUEST_FILES_BUCKET)
        .upload(path, file)

      if (error) throw error

      uploaded.push({
        name: file.name,
        path,
        type,
      })
    }

    return uploaded
  }

  async function openRequestFile(file: StoredFile) {
    const { data, error } = await supabase.storage
      .from(REQUEST_FILES_BUCKET)
      .createSignedUrl(file.path, 60 * 10)

    if (error || !data?.signedUrl) {
      alert('Could not open file. Check Supabase storage bucket/policies.')
      return
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
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

      const photos = await uploadRequestFiles(photoFiles, 'photos', 'photo')
      const documents = await uploadRequestFiles(documentFiles, 'documents', 'document')

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
      alert('Please add your AGENT_API_KEY at the top of App.tsx first.')
      return
    }

    setResearchingId(request.id)

    try {
      await ensureLeadExists(request)

      const response = await fetch(`${AGENT_API_URL}/research-materials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-key': AGENT_API_KEY,
        },
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

  async function saveEstimateItem(item: EstimateItem) {
    setEstimateSavingId(item.id)

    const quantity = Number(item.quantity || 0)
    const unitPrice = Number(item.unit_price || 0)
    const totalPrice = quantity * unitPrice

    try {
      const { data, error } = await supabase
        .from('estimate_items')
        .update({
          item_name: item.item_name,
          source: item.source,
          source_url: item.source_url,
          quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
          confidence: item.confidence || 'human_reviewed',
          human_approved: item.human_approved || false,
        })
        .eq('id', item.id)
        .select()
        .single()

      if (error) throw error

      setEstimateItems((prev) =>
        prev.map((existing) => (existing.id === item.id ? (data as EstimateItem) : existing))
      )
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

    try {
      await ensureLeadExists(selectedEstimateRequest)

      const { data, error } = await supabase
        .from('estimate_items')
        .insert({
          lead_id: selectedEstimateRequest.id,
          item_name: 'New estimate item',
          source: 'Human Review',
          source_url: null,
          quantity: 1,
          unit_price: 0,
          total_price: 0,
          confidence: 'human_added',
          human_approved: false,
        })
        .select()
        .single()

      if (error) throw error

      setEstimateItems((prev) => [...prev, data as EstimateItem])
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not add manual estimate item.')
    }
  }

  async function toggleEstimateItemApproved(item: EstimateItem) {
    const nextApproved = !item.human_approved
    const updated = { ...item, human_approved: nextApproved, confidence: nextApproved ? 'human_approved' : item.confidence }
    updateLocalEstimateItem(item.id, updated)
    await saveEstimateItem(updated)
  }

  async function approveAllEstimateItems() {
    const confirmApprove = window.confirm(
      'Approve all current line items for this draft? This still does not send a proposal or purchase order.'
    )

    if (!confirmApprove) return

    try {
      const updates = estimateItems.map((item) =>
        supabase
          .from('estimate_items')
          .update({ human_approved: true, confidence: 'human_approved' })
          .eq('id', item.id)
      )

      const results = await Promise.all(updates)
      const failed = results.find((result) => result.error)
      if (failed?.error) throw failed.error

      setEstimateItems((prev) =>
        prev.map((item) => ({ ...item, human_approved: true, confidence: 'human_approved' }))
      )
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Could not approve estimate items.')
    }
  }

  function generateEstimatePdf() {
    if (!selectedEstimateRequest) {
      alert('Open a request in the estimate review first.')
      return
    }

    const materialSubtotal = estimateItems.reduce(
      (sum, item) => sum + Number(item.total_price || 0),
      0
    )
    const labor = Number(estimateLaborCost || 0)
    const laborRateLabel = appliedLaborRate
      ? `${appliedLaborRate.trade}${appliedLaborRate.job_type ? ` / ${appliedLaborRate.job_type}` : ''} at ${money(Number(appliedLaborRate.typical_rate || 0))}/${appliedLaborRate.unit || 'hour'}`
      : 'Manual labor entry'
    const laborUnits = Number(estimateLaborUnits || 0)
    const laborMinimum = Number(estimateMinimumCharge || 0)
    const laborTrip = Number(estimateTripCharge || 0)
    const laborDisposal = Number(estimateDisposalFee || 0)
    const markupPercent = Number(estimateMarkupPercent || 0)
    const contingencyPercent = Number(estimateContingencyPercent || 0)
    const directCost = materialSubtotal + labor
    const markup = directCost * (markupPercent / 100)
    const contingency = directCost * (contingencyPercent / 100)
    const standardTotal = directCost + markup + contingency
    const lowTotal = standardTotal * 0.9
    const premiumTotal = standardTotal * 1.15
    const approvedCount = estimateItems.filter((item) => item.human_approved).length
    const allApproved = estimateItems.length > 0 && approvedCount === estimateItems.length

    const rows = estimateItems
      .map(
        (item) => `
          <tr>
            <td>${item.item_name || ''}</td>
            <td>${item.source || ''}</td>
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
            <strong>Client:</strong> ${selectedEstimateRequest.requesterName}<br />
            <strong>Email:</strong> ${selectedEstimateRequest.email}<br />
            <strong>Phone:</strong> ${selectedEstimateRequest.phone || 'Not provided'}<br />
            <strong>Property:</strong> ${selectedEstimateRequest.propertyAddress}, ${selectedEstimateRequest.city}, ${selectedEstimateRequest.state} ${selectedEstimateRequest.zip}<br />
            <strong>Work Type:</strong> ${selectedEstimateRequest.workType}<br />
            <strong>Urgency:</strong> ${selectedEstimateRequest.urgency}
          </div>
          <div class="box">
            <strong>Scope Summary</strong><br />
            ${selectedEstimateRequest.description}
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
            <p><strong>Materials:</strong> ${money(materialSubtotal)}</p>
            <p><strong>Labor:</strong> ${money(labor)}</p>
            <p><strong>Labor source:</strong> ${laborRateLabel}</p>
            <p><strong>Labor units:</strong> ${laborUnits}</p>
            <p><strong>Minimum / Trip / Disposal:</strong> ${money(laborMinimum)} / ${money(laborTrip)} / ${money(laborDisposal)}</p>
            <p><strong>Markup:</strong> ${markupPercent}% = ${money(markup)}</p>
            <p><strong>Contingency:</strong> ${contingencyPercent}% = ${money(contingency)}</p>
            <p class="total">Standard Estimate: ${money(standardTotal)}</p>
            <p><strong>Suggested Range:</strong> ${money(lowTotal)} - ${money(premiumTotal)}</p>
          </div>
          <div class="box">
            <strong>Notes / Assumptions</strong><br />
            ${estimateNotes}
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

    const materialSubtotal = estimateItems.reduce(
      (sum, item) => sum + Number(item.total_price || 0),
      0
    )
    const labor = Number(estimateLaborCost || 0)
    const markupPercent = Number(estimateMarkupPercent || 0)
    const contingencyPercent = Number(estimateContingencyPercent || 0)
    const directCost = materialSubtotal + labor
    const adjustmentTotal =
      directCost * (markupPercent / 100) + directCost * (contingencyPercent / 100)
    const amountDue = directCost + adjustmentTotal
    const approvedCount = estimateItems.filter((item) => item.human_approved).length
    const allApproved = estimateItems.length === 0 || approvedCount === estimateItems.length

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
              <strong>Invoice #:</strong> ${invoiceNumber}<br />
              <strong>Date:</strong> ${invoiceDate}<br />
              <strong>Status:</strong> Draft / Review
            </div>
          </div>

          <div class="box">
            <strong>Bill To:</strong> ${selectedEstimateRequest.requesterName}<br />
            <strong>Email:</strong> ${selectedEstimateRequest.email}<br />
            <strong>Phone:</strong> ${selectedEstimateRequest.phone || 'Not provided'}<br />
            <strong>Property:</strong> ${selectedEstimateRequest.propertyAddress}, ${selectedEstimateRequest.city}, ${selectedEstimateRequest.state} ${selectedEstimateRequest.zip}<br />
            <strong>Work Type:</strong> ${selectedEstimateRequest.workType}
          </div>

          <div class="box">
            <strong>Scope / Description</strong><br />
            ${selectedEstimateRequest.description}
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

    const { data, error } = await supabase
      .from('invoice_cost_analyses')
      .select('*')
      .in('invoice_id', invoiceIds)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    const map: Record<string, InvoiceCostAnalysis> = {}
    ;((data || []) as InvoiceCostAnalysis[]).forEach((analysis) => {
      if (!map[analysis.invoice_id]) map[analysis.invoice_id] = analysis
    })

    setInvoiceAnalyses(map)
  }

  async function loadInvoices() {
    setInvoiceLoading(true)

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      alert(error.message)
    } else {
      const rows = (data || []) as Invoice[]
      setInvoices(rows)
      await loadInvoiceAnalyses(rows.map((invoice) => invoice.id))
    }

    setInvoiceLoading(false)
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

    const { data, error } = await supabase
      .from('material_costs')
      .select('*')
      .order('human_verified', { ascending: true })
      .order('updated_at', { ascending: false })

    if (error) alert(error.message)
    else setMaterials((data || []) as MaterialCost[])

    setMaterialLoading(false)
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
      zip: zip || '',
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

  async function editMaterialCost(item: MaterialCost) {
    const currentName = getMaterialName(item)
    const currentTypical = getMaterialTypicalPrice(item)

    const nextName = window.prompt('Material name', currentName)
    if (nextName === null) return

    const nextUnit = window.prompt('Unit, ex: each / bag / sqft', item.unit || 'each')
    if (nextUnit === null) return

    const nextTypicalText = window.prompt('Typical price', String(currentTypical || 0))
    if (nextTypicalText === null) return

    const nextTypical = parseMoneyInput(nextTypicalText)
    if (!Number.isFinite(nextTypical) || nextTypical <= 0) {
      alert('Please enter a valid typical price.')
      return
    }

    const nextLowText = window.prompt(
      'Low price',
      String(item.low_price ?? Math.round(nextTypical * 0.9 * 100) / 100)
    )
    if (nextLowText === null) return

    const nextHighText = window.prompt(
      'High price',
      String(item.high_price ?? Math.round(nextTypical * 1.15 * 100) / 100)
    )
    if (nextHighText === null) return

    const nextCategory = window.prompt('Category', item.category || 'Material')
    if (nextCategory === null) return

    const nextZip = window.prompt('ZIP or service area', item.zip || '')
    if (nextZip === null) return

    const nextSource = window.prompt('Source/store', item.source || item.store_name || 'admin_review')
    if (nextSource === null) return

    setMaterialSavingId(item.id)

    const { error } = await supabase
      .from('material_costs')
      .update({
        item_name: nextName,
        normalized_name: normalizeMaterialName(nextName),
        category: nextCategory || 'Material',
        unit: nextUnit || 'each',
        low_price: Number(nextLowText) || nextTypical,
        typical_price: nextTypical,
        high_price: Number(nextHighText) || nextTypical,
        source: nextSource || 'admin_review',
        store_name: nextSource || 'Admin review',
        zip: nextZip || '',
        confidence: item.human_verified ? 'database_verified' : 'database_review',
        last_checked: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: 'Edited in Material Cost Review. Human review required unless approved as verified.',
      })
      .eq('id', item.id)

    if (error) alert(error.message)
    else await loadMaterials()

    setMaterialSavingId(null)
  }

  async function approveMaterialCost(item: MaterialCost) {
    const currentName = getMaterialName(item)
    const currentTypical = getMaterialTypicalPrice(item)

    const approvedPriceText = window.prompt(
      `Approve verified typical price for ${currentName}`,
      String(currentTypical || 0)
    )

    if (approvedPriceText === null) return

    const approvedPrice = parseMoneyInput(approvedPriceText)
    if (!Number.isFinite(approvedPrice) || approvedPrice <= 0) {
      alert('Please enter a valid approved price.')
      return
    }

    const approvedUnit = window.prompt('Approved unit', item.unit || 'each')
    if (approvedUnit === null) return

    setMaterialSavingId(item.id)

    const { error } = await supabase
      .from('material_costs')
      .update({
        item_name: currentName,
        normalized_name: normalizeMaterialName(currentName),
        unit: approvedUnit || 'each',
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
      zip: zip || '',
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
    const approvedTypicalText = window.prompt(
      `Approve verified labor rate for ${rate.trade}`,
      String(rate.typical_rate || 0)
    )

    if (approvedTypicalText === null) return

    const approvedTypical = parseMoneyInput(approvedTypicalText)
    if (!Number.isFinite(approvedTypical) || approvedTypical <= 0) {
      alert('Please enter a valid approved labor rate.')
      return
    }

    const approvedUnit = window.prompt('Approved unit', rate.unit || 'hour')
    if (approvedUnit === null) return

    setLaborSavingId(rate.id)

    const { error } = await supabase
      .from('labor_rates')
      .update({
        unit: approvedUnit || 'hour',
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

  const columns: RequestStatus[] = [
    'new',
    'needs_info',
    'estimate_ready',
    'pending_approval',
  ]

  const estimateMaterialSubtotal = estimateItems.reduce(
    (sum, item) => sum + Number(item.total_price || 0),
    0
  )
  const estimateLaborNumber = Number(estimateLaborCost || 0)
  const estimateLaborUnitsNumber = Number(estimateLaborUnits || 0)
  const estimateLaborBaseNumber = appliedLaborRate
    ? Number(appliedLaborRate.typical_rate || 0) * estimateLaborUnitsNumber
    : estimateLaborNumber
  const estimateLaborMinimumNumber = Number(estimateMinimumCharge || 0)
  const estimateTripChargeNumber = Number(estimateTripCharge || 0)
  const estimateDisposalFeeNumber = Number(estimateDisposalFee || 0)
  const estimateMarkupNumber = Number(estimateMarkupPercent || 0)
  const estimateContingencyNumber = Number(estimateContingencyPercent || 0)
  const estimateDirectCost = estimateMaterialSubtotal + estimateLaborNumber
  const estimateMarkupDollars = estimateDirectCost * (estimateMarkupNumber / 100)
  const estimateContingencyDollars = estimateDirectCost * (estimateContingencyNumber / 100)
  const estimateStandardTotal =
    estimateDirectCost + estimateMarkupDollars + estimateContingencyDollars
  const estimateLowTotal = estimateStandardTotal * 0.9
  const estimatePremiumTotal = estimateStandardTotal * 1.15
  const approvedEstimateCount = estimateItems.filter((item) => item.human_approved).length
  const allEstimateItemsApproved =
    estimateItems.length > 0 && approvedEstimateCount === estimateItems.length

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.brand}>SHELTER PREP</div>
          <div style={styles.subBrand}>HOME SERVICES</div>
        </div>

        <nav style={styles.nav}>
          <button
            style={activeTab === 'new' ? styles.navActive : styles.navButton}
            onClick={() => setActiveTab('new')}
          >
            New Request
          </button>

          <button
            style={activeTab === 'gallery' ? styles.navActive : styles.navButton}
            onClick={() => setActiveTab('gallery')}
          >
            Gallery
          </button>


          {isAdmin && (
            <>
              <button
                style={activeTab === 'intake' ? styles.navActive : styles.navButton}
                onClick={() => requireAdmin('intake')}
              >
                AI Intake
              </button>

              <button
                style={activeTab === 'messages' ? styles.navActive : styles.navButton}
                onClick={() => requireAdmin('messages')}
              >
                Messages
              </button>
            </>
          )}

          {isAdmin && (
            <>
              <button
                style={activeTab === 'dashboard' ? styles.navActive : styles.navButton}
                onClick={() => requireAdmin('dashboard')}
              >
                Dashboard
              </button>

              <button
                style={activeTab === 'archived' ? styles.navActive : styles.navButton}
                onClick={() => requireAdmin('archived')}
              >
                Archived Leads
              </button>

              <button
                style={activeTab === 'invoices' ? styles.navActive : styles.navButton}
                onClick={() => requireAdmin('invoices')}
              >
                Invoices
              </button>

              <button
                style={activeTab === 'materials' ? styles.navActive : styles.navButton}
                onClick={() => requireAdmin('materials')}
              >
                Material Costs
              </button>

              <button
                style={activeTab === 'labor' ? styles.navActive : styles.navButton}
                onClick={() => requireAdmin('labor')}
              >
                Labor Rates
              </button>

              <button
                style={activeTab === 'estimates' ? styles.navActive : styles.navButton}
                onClick={() => requireAdmin('estimates')}
              >
                AI Estimator
              </button>
            </>
          )}
        </nav>

        <div style={styles.headerActions}>
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

      <main style={styles.main}>
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
                  onChange={(e) => setPropertyAddress(e.target.value)}
                />

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
            <section style={styles.card}>
              <h2>Admin Dashboard</h2>

              <div style={styles.grid2}>
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

            <section style={styles.kanban}>
              {columns.map((status) => {
                const items = filteredRequests.filter((request) => request.status === status)

                return (
                  <div
                    key={status}
                    style={{
                      ...styles.column,
                      background: STATUS_META[status].cardBg,
                      border: `1px solid ${STATUS_META[status].border}`,
                    }}
                  >
                    <h3>
                      {STATUS_META[status].label} ({items.length})
                    </h3>

                    {items.length === 0 && <div style={styles.empty}>No requests</div>}

                    {items.map((request) => (
                      <div key={request.id} style={styles.requestCard}>
                        <strong>{request.propertyAddress}</strong>
                        <p style={styles.small}>
                          {request.city}, {request.state} {request.zip}
                        </p>
                        <p style={styles.small}>
                          {request.requesterName} • {request.email}
                        </p>
                        <p>{request.description}</p>

                        {request.photos.length > 0 && <strong>Photos</strong>}
                        {request.photos.map((file) => (
                          <button
                            key={file.path}
                            style={styles.linkButton}
                            onClick={() => openRequestFile(file)}
                          >
                            Open {file.name}
                          </button>
                        ))}

                        {request.documents.length > 0 && <strong>Documents</strong>}
                        {request.documents.map((file) => (
                          <button
                            key={file.path}
                            style={styles.linkButton}
                            onClick={() => openRequestFile(file)}
                          >
                            Open {file.name}
                          </button>
                        ))}

                        <button
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
                            color: '#0f542d',
                            border: '1px solid #0f542d',
                          }}
                          disabled={researchingId === request.id}
                          onClick={() => researchMaterials(request)}
                        >
                          {researchingId === request.id
                            ? 'Researching Materials...'
                            : 'AI Research Materials'}
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
                          AI research drafts only. Human approval is required before any
                          estimate, proposal, purchase order, email, or submission.
                        </div>

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
                    ))}
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
                    Estimate status: {approvedEstimateCount}/{estimateItems.length} line items
                    approved. {allEstimateItemsApproved ? 'Ready for draft PDF.' : 'Still needs human review.'}
                  </div>
                </div>

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
                  <button style={styles.primaryButton} onClick={addManualEstimateItem}>
                    Add Manual Line Item
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

                {estimateItems.length === 0 && (
                  <div style={styles.empty}>
                    No estimate items yet. Run AI Research Materials from the Dashboard, or add a
                    manual line item.
                  </div>
                )}

                {estimateItems.map((item) => (
                  <div key={item.id} style={styles.requestCard}>
                    <div style={styles.grid2}>
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

                    <div style={styles.grid3}>
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

                    <p style={styles.small}>
                      Confidence: {item.confidence || 'needs_review'} • Status:{' '}
                      {item.human_approved ? 'Human approved' : 'Needs review'}
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
                      >
                        {item.human_approved ? 'Unapprove' : 'Approve'}
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

      {showLogin && (
        <div style={styles.overlay} onClick={() => setShowLogin(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Admin Login</h2>
            <p style={styles.muted}>Admin PIN: 0202</p>

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
  page: {
    minHeight: '100vh',
    background: '#f4f1ec',
    color: '#173425',
    fontFamily: 'Inter, Arial, sans-serif',
  },
  header: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.4fr 1fr',
    gap: 20,
    alignItems: 'center',
    padding: '28px 42px 18px',
  },
  brand: {
    fontSize: 30,
    letterSpacing: 3,
    fontWeight: 900,
    color: '#0f542d',
  },
  subBrand: {
    marginTop: 8,
    fontSize: 12,
    letterSpacing: 5,
    fontWeight: 800,
    color: '#0f542d',
  },
  nav: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  navButton: {
    border: 'none',
    background: 'transparent',
    padding: '11px 14px',
    borderRadius: 999,
    fontWeight: 800,
    cursor: 'pointer',
    color: '#173425',
  },
  navActive: {
    border: '1px solid #0f542d',
    background: '#e7f3e5',
    padding: '11px 14px',
    borderRadius: 999,
    fontWeight: 900,
    cursor: 'pointer',
    color: '#0f542d',
  },
  headerActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  main: {
    padding: '12px 42px 60px',
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
  sideCard: {
    background: '#eef3ea',
    border: '1px solid #d7dfd3',
    borderRadius: 22,
    padding: 24,
    alignSelf: 'start',
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
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid #d7dfd3',
    marginBottom: 12,
    boxSizing: 'border-box',
    fontSize: 15,
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
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 900,
  },
  outlineButton: {
    border: '1px solid #d7dfd3',
    background: 'white',
    color: '#173425',
    padding: '13px 18px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 900,
  },
  wideButton: {
    width: '100%',
    border: 'none',
    background: '#0f542d',
    color: 'white',
    padding: '13px 18px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 900,
    marginTop: 10,
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
    gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))',
    gap: 16,
  },
  column: {
    borderRadius: 20,
    padding: 16,
    minHeight: 220,
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
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  fileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
    gap: 14,
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
