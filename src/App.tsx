import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import Gallery from './components/Gallery'

type RequestStatus = 'new' | 'needs_info' | 'estimate_ready' | 'pending_approval'

type Tab = 'new' | 'gallery' | 'dashboard' | 'invoices' | 'materials' | 'labor' | 'estimates'

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
  aiEstimate?: AiEstimate
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

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('new')
  const [showLogin, setShowLogin] = useState(false)
  const [adminPinInput, setAdminPinInput] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  const [requests, setRequests] = useState<WorkRequest[]>([])
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
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setRequests(JSON.parse(raw))
    } catch {
      setRequests([])
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests))
  }, [requests])

  useEffect(() => {
    if (isAdmin && activeTab === 'invoices') loadInvoices()
    if (isAdmin && activeTab === 'materials') loadMaterials()
    if (isAdmin && activeTab === 'labor') loadLaborRates()
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

  function updateStatus(id: string, status: RequestStatus) {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
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
                style={activeTab === 'dashboard' ? styles.navActive : styles.navButton}
                onClick={() => requireAdmin('dashboard')}
              >
                Dashboard
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
                      </div>
                    ))}
                  </div>
                )
              })}
            </section>
          </>
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
