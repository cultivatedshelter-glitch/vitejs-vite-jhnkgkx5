import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import Gallery from './components/Gallery'

type RequestStatus = 'new' | 'needs_info' | 'estimate_ready' | 'pending_approval'

type Tab = 'new' | 'gallery' | 'dashboard' | 'invoices' | 'materials' | 'estimates'

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
  material_name: string
  category: string | null
  unit: string | null
  current_price: number | null
  previous_price: number | null
  percent_change?: number | null
  source: string | null
  region: string | null
  updated_at: string
}

const STORAGE_KEY = 'shelter-prep-requests-v1'
const ADMIN_PIN = '0202'
const REQUEST_FILES_BUCKET = 'job-files'
const INVOICE_BUCKET = 'invoices'

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
  }, [isAdmin, activeTab])

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
      const photos = await uploadRequestFiles(photoFiles, 'photos', 'photo')
      const documents = await uploadRequestFiles(documentFiles, 'documents', 'document')

      const newRequest: WorkRequest = {
        id: makeId(),
        createdAt: new Date().toLocaleString(),
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
      alert('Material name and current price are required.')
      return
    }

    const { error } = await supabase.from('material_costs').insert({
      material_name: materialName,
      category: materialCategory,
      unit: materialUnit,
      current_price: Number(materialPrice),
      source: materialSource,
      region: 'Portland / Lake Oswego',
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
            <h2>Material Cost Monitor</h2>
            <p style={styles.muted}>
              Add manual material costs or pull updated market/index data from the weekly
              automation function.
            </p>

            <button
              style={styles.primaryButton}
              disabled={materialUpdating}
              onClick={updateMaterialCostsNow}
            >
              {materialUpdating ? 'Updating...' : 'Update Material Costs Now'}
            </button>

            <button
              style={{ ...styles.outlineButton, marginLeft: 10 }}
              disabled={materialLoading}
              onClick={loadMaterials}
            >
              {materialLoading ? 'Loading...' : 'Refresh'}
            </button>

            <hr style={styles.divider} />

            <input
              style={styles.input}
              placeholder="Material name, ex: 2x4 lumber"
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
            />

            <input
              style={styles.input}
              placeholder="Category, ex: lumber"
              value={materialCategory}
              onChange={(e) => setMaterialCategory(e.target.value)}
            />

            <input
              style={styles.input}
              placeholder="Unit, ex: each / sq ft / sheet"
              value={materialUnit}
              onChange={(e) => setMaterialUnit(e.target.value)}
            />

            <input
              style={styles.input}
              placeholder="Current price"
              value={materialPrice}
              onChange={(e) => setMaterialPrice(e.target.value)}
            />

            <input
              style={styles.input}
              placeholder="Source, ex: Home Depot / supplier / RSMeans"
              value={materialSource}
              onChange={(e) => setMaterialSource(e.target.value)}
            />

            <button style={styles.primaryButton} onClick={addMaterialCost}>
              Add Material Cost
            </button>

            <div style={{ marginTop: 20 }}>
              {materials.length === 0 && (
                <p style={styles.muted}>No material costs yet.</p>
              )}

              {materials.map((item) => {
                const dollarChange =
                  item.previous_price && item.current_price
                    ? item.current_price - item.previous_price
                    : null

                return (
                  <div key={item.id} style={styles.requestCard}>
                    <strong>{item.material_name}</strong>
                    <p style={styles.small}>
                      {item.category || 'Uncategorized'} • {item.unit || 'unit not set'}
                    </p>
                    <p style={styles.small}>Current: {money(item.current_price)}</p>
                    <p style={styles.small}>Previous: {money(item.previous_price)}</p>
                    <p style={styles.small}>
                      Change:{' '}
                      {dollarChange === null
                        ? 'No previous price'
                        : `${dollarChange >= 0 ? '+' : ''}${dollarChange.toFixed(2)}`}
                    </p>
                    <p style={styles.small}>
                      Percent change:{' '}
                      {item.percent_change === null || item.percent_change === undefined
                        ? 'Not calculated'
                        : `${item.percent_change >= 0 ? '+' : ''}${item.percent_change.toFixed(2)}%`}
                    </p>
                    <p style={styles.small}>Source: {item.source || 'Not entered'}</p>
                    <p style={styles.small}>Region: {item.region || 'Not set'}</p>
                    <p style={styles.small}>Updated: {item.updated_at}</p>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {isAdmin && activeTab === 'estimates' && (
          <section style={styles.card}>
            <h2>AI Estimator</h2>
            <p style={styles.muted}>
              Use the Run AI Estimate button from a dashboard request. Invoice extraction,
              invoice cost analysis, and material monitoring are connected for the next
              estimator upgrade.
            </p>
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
