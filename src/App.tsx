import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

type RequestStatus = 'new' | 'needs_info' | 'estimate_ready' | 'pending_approval'
type Tab = 'request' | 'dashboard' | 'estimates'

type StoredFile = {
  name: string
  path: string
  url: string
  type: 'photo' | 'document'
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
}

type DbLeadRow = {
  id: string
  created_at: string
  requester_name: string
  email: string
  phone: string | null
  work_type: string
  property_address: string
  city: string
  state: string
  zip: string
  urgency: string
  occupancy: string
  timeline: string | null
  description: string
  photos: unknown
  documents: unknown
  status: RequestStatus
}

type EstimateItem = {
  id: string
  label: string
  qty: number
  unitCost: number
}

const ADMIN_PIN = '4242'
const STORAGE_BUCKET = 'request-files'

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

const STATUS_LABELS: Record<RequestStatus, string> = {
  new: 'New Lead',
  estimate_ready: 'Estimate Ready',
  pending_approval: 'Pending Approval',
  needs_info: 'Needs Info',
}

const STATUS_COLORS: Record<RequestStatus, React.CSSProperties> = {
  new: { background: '#eaf1fb', border: '1px solid #cddcf1' },
  estimate_ready: { background: '#eef8ef', border: '1px solid #cfe4d1' },
  pending_approval: { background: '#f7f1e8', border: '1px solid #e5d4c1' },
  needs_info: { background: '#fdeeee', border: '1px solid #f0cccc' },
}

const initialEstimateItems: EstimateItem[] = [
  { id: crypto.randomUUID(), label: 'Labor', qty: 1, unitCost: 250 },
  { id: crypto.randomUUID(), label: 'Materials', qty: 1, unitCost: 150 },
]

function normalizeStoredFiles(value: unknown, fallbackType: 'photo' | 'document'): StoredFile[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return {
          name: item,
          path: item,
          url: item.startsWith('http') ? item : '',
          type: fallbackType,
        } satisfies StoredFile
      }

      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>
        return {
          name: String(record.name ?? 'file'),
          path: String(record.path ?? record.name ?? crypto.randomUUID()),
          url: typeof record.url === 'string' ? record.url : '',
          type:
            record.type === 'photo' || record.type === 'document'
              ? record.type
              : fallbackType,
        } satisfies StoredFile
      }

      return null
    })
    .filter(Boolean) as StoredFile[]
}

function mapDbRowToRequest(row: DbLeadRow): WorkRequest {
  return {
    id: row.id,
    createdAt: row.created_at ? new Date(row.created_at).toLocaleString() : '',
    requesterName: row.requester_name ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    workType: row.work_type ?? '',
    propertyAddress: row.property_address ?? '',
    city: row.city ?? '',
    state: row.state ?? '',
    zip: row.zip ?? '',
    urgency: row.urgency ?? 'Standard',
    occupancy: row.occupancy ?? 'Occupied',
    timeline: row.timeline ?? '',
    description: row.description ?? '',
    photos: normalizeStoredFiles(row.photos, 'photo'),
    documents: normalizeStoredFiles(row.documents, 'document'),
    status: row.status ?? 'new',
  }
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 54,
        height: 30,
        borderRadius: 999,
        border: 'none',
        padding: 4,
        background: checked ? '#7aa66d' : '#cfd8d2',
        display: 'flex',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        alignItems: 'center',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: '#fff',
          display: 'block',
        }}
      />
    </button>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('request')
  const [showLogin, setShowLogin] = useState(false)
  const [adminPinInput, setAdminPinInput] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  const [emailAlerts, setEmailAlerts] = useState(true)
  const [smsAlerts, setSmsAlerts] = useState(true)
  const [adminAlerts, setAdminAlerts] = useState(true)

  const [requesterName, setRequesterName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [workType, setWorkType] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [urgency, setUrgency] = useState('Standard')
  const [occupancy, setOccupancy] = useState('Occupied')
  const [timeline, setTimeline] = useState('')
  const [description, setDescription] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [documentFiles, setDocumentFiles] = useState<File[]>([])

  const [requests, setRequests] = useState<WorkRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const [dashboardSearch, setDashboardSearch] = useState('')

  const [estimateClient, setEstimateClient] = useState('')
  const [estimateProperty, setEstimateProperty] = useState('')
  const [estimateTax, setEstimateTax] = useState(0)
  const [estimateDiscount, setEstimateDiscount] = useState(0)
  const [estimateItems, setEstimateItems] = useState<EstimateItem[]>(initialEstimateItems)

  useEffect(() => {
    loadRequests()
  }, [])

  async function loadRequests() {
    setLoadingRequests(true)

    const { data, error } = await supabase
      .from('work_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      alert('Could not load requests from Supabase.')
      setLoadingRequests(false)
      return
    }

    setRequests((data ?? []).map((row) => mapDbRowToRequest(row as DbLeadRow)))
    setLoadingRequests(false)
  }

  function resetForm() {
    setRequesterName('')
    setEmail('')
    setPhone('')
    setWorkType('')
    setPropertyAddress('')
    setCity('')
    setState('')
    setZip('')
    setUrgency('Standard')
    setOccupancy('Occupied')
    setTimeline('')
    setDescription('')
    setPhotoFiles([])
    setDocumentFiles([])
  }

  async function uploadFiles(files: File[], category: 'photo' | 'document') {
    const uploaded: StoredFile[] = []

    for (const file of files) {
      const cleanedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const path = `${category}s/${Date.now()}-${crypto.randomUUID()}-${cleanedName}`

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: false })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)

      uploaded.push({
        name: file.name,
        path,
        url: data.publicUrl,
        type: category,
      })
    }

    return uploaded
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault()
    setSuccessMessage('')

    if (
      !requesterName ||
      !email ||
      !workType ||
      !propertyAddress ||
      !city ||
      !state ||
      !zip ||
      !description
    ) {
      alert('Please complete all required fields.')
      return
    }

    try {
      setSubmitting(true)

      const uploadedPhotos = await uploadFiles(photoFiles, 'photo')
      const uploadedDocuments = await uploadFiles(documentFiles, 'document')

      const payload = {
        requester_name: requesterName,
        email,
        phone: phone || null,
        work_type: workType,
        property_address: propertyAddress,
        city,
        state,
        zip,
        urgency,
        occupancy,
        timeline: timeline || null,
        description,
        photos: uploadedPhotos,
        documents: uploadedDocuments,
        status: 'new' as RequestStatus,
      }

      const { data, error } = await supabase
        .from('work_requests')
        .insert(payload)
        .select('*')
        .single()

      if (error) throw error

      setRequests((prev) => [mapDbRowToRequest(data as DbLeadRow), ...prev])
      setSuccessMessage('Work request submitted successfully.')
      resetForm()
    } catch (error) {
      console.error(error)
      alert('Could not submit request. Check your Supabase table columns and storage policies.')
    } finally {
      setSubmitting(false)
    }
  }

  async function updateStatus(id: string, status: RequestStatus) {
    const previous = requests
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))

    const { error } = await supabase
      .from('work_requests')
      .update({ status })
      .eq('id', id)

    if (error) {
      console.error(error)
      setRequests(previous)
      alert('Could not update status.')
    }
  }

  function doAdminLogin() {
    if (adminPinInput === ADMIN_PIN) {
      setIsAdmin(true)
      setShowLogin(false)
      setAdminPinInput('')
      setActiveTab('dashboard')
      return
    }

    alert('Wrong admin PIN.')
  }

  function exportCsv() {
    if (!requests.length) {
      alert('No requests to export.')
      return
    }

    const headers = [
      'createdAt',
      'status',
      'requesterName',
      'email',
      'phone',
      'workType',
      'propertyAddress',
      'city',
      'state',
      'zip',
      'urgency',
      'occupancy',
      'timeline',
      'description',
      'photoUrls',
      'documentUrls',
    ]

    const rows = requests.map((r) =>
      [
        r.createdAt,
        r.status,
        r.requesterName,
        r.email,
        r.phone,
        r.workType,
        r.propertyAddress,
        r.city,
        r.state,
        r.zip,
        r.urgency,
        r.occupancy,
        r.timeline,
        r.description,
        r.photos.map((f) => f.url).join(' | '),
        r.documents.map((f) => f.url).join(' | '),
      ]
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'shelter-prep-requests.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredRequests = useMemo(() => {
    const q = dashboardSearch.trim().toLowerCase()
    if (!q) return requests

    return requests.filter((request) =>
      [
        request.requesterName,
        request.email,
        request.phone,
        request.workType,
        request.propertyAddress,
        request.city,
        request.state,
        request.zip,
        request.description,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [dashboardSearch, requests])

  const groupedRequests = useMemo(
    () => ({
      new: filteredRequests.filter((r) => r.status === 'new'),
      estimate_ready: filteredRequests.filter((r) => r.status === 'estimate_ready'),
      pending_approval: filteredRequests.filter((r) => r.status === 'pending_approval'),
      needs_info: filteredRequests.filter((r) => r.status === 'needs_info'),
    }),
    [filteredRequests]
  )

  const subtotal = useMemo(
    () => estimateItems.reduce((sum, item) => sum + item.qty * item.unitCost, 0),
    [estimateItems]
  )
  const taxAmount = subtotal * (estimateTax / 100)
  const discountAmount = subtotal * (estimateDiscount / 100)
  const total = subtotal + taxAmount - discountAmount

  function addEstimateItem() {
    setEstimateItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: '', qty: 1, unitCost: 0 },
    ])
  }

  function updateEstimateItem(id: string, patch: Partial<EstimateItem>) {
    setEstimateItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function removeEstimateItem(id: string) {
    setEstimateItems((prev) => prev.filter((item) => item.id !== id))
  }

  function openPrintableEstimate() {
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return

    const rows = estimateItems
      .map(
        (item) => `
        <tr>
          <td style="padding:8px;border:1px solid #d7ddd8;">${item.label || 'Line Item'}</td>
          <td style="padding:8px;border:1px solid #d7ddd8;text-align:right;">${item.qty}</td>
          <td style="padding:8px;border:1px solid #d7ddd8;text-align:right;">$${item.unitCost.toFixed(2)}</td>
          <td style="padding:8px;border:1px solid #d7ddd8;text-align:right;">$${(item.qty * item.unitCost).toFixed(2)}</td>
        </tr>
      `
      )
      .join('')

    w.document.write(`
      <html>
        <head><title>Shelter Prep Estimate</title></head>
        <body style="font-family:Arial,sans-serif;padding:24px;color:#1f2a30;">
          <h1>Shelter Prep Estimate</h1>
          <p>${estimateClient || 'Client'}${estimateProperty ? ` • ${estimateProperty}` : ''}</p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;">
            <thead>
              <tr>
                <th style="padding:8px;border:1px solid #d7ddd8;text-align:left;">Item</th>
                <th style="padding:8px;border:1px solid #d7ddd8;text-align:right;">Qty</th>
                <th style="padding:8px;border:1px solid #d7ddd8;text-align:right;">Unit Cost</th>
                <th style="padding:8px;border:1px solid #d7ddd8;text-align:right;">Line Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="margin-top:20px;max-width:320px;margin-left:auto;">
            <p>Subtotal: <strong>$${subtotal.toFixed(2)}</strong></p>
            <p>Tax (${estimateTax}%): <strong>$${taxAmount.toFixed(2)}</strong></p>
            <p>Discount (${estimateDiscount}%): <strong>-$${discountAmount.toFixed(2)}</strong></p>
            <p style="font-size:20px;">Total: <strong>$${total.toFixed(2)}</strong></p>
          </div>
          <script>window.print()</script>
        </body>
      </html>
    `)
    w.document.close()
  }

  function renderFiles(files: StoredFile[], label: string) {
    if (!files.length) return null

    return (
      <div style={{ marginTop: 10 }}>
        <strong>{label}:</strong>
        <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
          {files.map((file) =>
            file.url ? (
              <a
                key={file.path}
                href={file.url}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#0f5ea8', textDecoration: 'underline', wordBreak: 'break-all' }}
              >
                {file.name}
              </a>
            ) : (
              <div key={file.path} style={{ color: '#7a5c33' }}>
                {file.name} (old entry with no saved URL)
              </div>
            )
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.brand}>SHELTER PREP</div>
          <div style={styles.subBrand}>HOME SERVICES</div>
        </div>

        <div style={styles.nav}>
          <button
            onClick={() => setActiveTab('request')}
            style={{ ...styles.navBtn, ...(activeTab === 'request' ? styles.navBtnActive : {}) }}
          >
            New Request
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            style={{ ...styles.navBtn, ...(activeTab === 'dashboard' ? styles.navBtnActive : {}) }}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('estimates')}
            style={{ ...styles.navBtn, ...(activeTab === 'estimates' ? styles.navBtnActive : {}) }}
          >
            Estimates
          </button>
        </div>

        <div style={styles.headerActions}>
          <button style={styles.secondaryBtn} onClick={exportCsv}>
            Export CSV
          </button>
          {isAdmin ? (
            <button style={styles.primaryBtn} onClick={() => setIsAdmin(false)}>
              Log Out
            </button>
          ) : (
            <button style={styles.primaryBtn} onClick={() => setShowLogin(true)}>
              Admin Login
            </button>
          )}
        </div>
      </header>

      <main style={styles.mainGrid}>
        <div>
          {activeTab === 'request' && (
            <>
              <section style={styles.hero}>
                <div style={styles.heroBadge}>Property work intake</div>
                <h1 style={styles.heroTitle}>Submit a work request in one place.</h1>
                <p style={styles.heroText}>
                  Enter the property details, describe the work needed, and upload photos,
                  documents, or video for admin review.
                </p>
              </section>

              <section style={styles.card}>
                <h2 style={styles.sectionTitle}>New Work Request</h2>
                <p style={styles.sectionText}>Fields marked with * are required.</p>

                {successMessage ? <div style={styles.success}>{successMessage}</div> : null}

                <form onSubmit={submitRequest}>
                  <div style={styles.grid2}>
                    <input
                      style={styles.input}
                      placeholder="Your name *"
                      value={requesterName}
                      onChange={(e) => setRequesterName(e.target.value)}
                    />
                    <input
                      style={styles.input}
                      placeholder="Your email *"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div style={styles.grid2}>
                    <input
                      style={styles.input}
                      placeholder="Phone number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                    <select
                      style={styles.input}
                      value={workType}
                      onChange={(e) => setWorkType(e.target.value)}
                    >
                      <option value="">Work type *</option>
                      {WORK_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
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
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                    />
                    <input
                      style={styles.input}
                      placeholder="ZIP code *"
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
                      <option>Tenant Occupied</option>
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
                    style={{ ...styles.input, minHeight: 140, resize: 'vertical' }}
                    placeholder="Describe the work needed *"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />

                  <div style={styles.grid2}>
                    <label style={styles.uploadBox}>
                      <div style={styles.uploadTitle}>Upload photos / videos</div>
                      <div style={styles.uploadText}>JPG, PNG, MP4, MOV</div>
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/mp4,video/quicktime"
                        onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))}
                      />
                      {photoFiles.length > 0 ? (
                        <div style={styles.fileList}>{photoFiles.map((f) => f.name).join(', ')}</div>
                      ) : null}
                    </label>

                    <label style={styles.uploadBox}>
                      <div style={styles.uploadTitle}>Upload documents</div>
                      <div style={styles.uploadText}>PDF, DOC, DOCX</div>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setDocumentFiles(Array.from(e.target.files || []))}
                      />
                      {documentFiles.length > 0 ? (
                        <div style={styles.fileList}>{documentFiles.map((f) => f.name).join(', ')}</div>
                      ) : null}
                    </label>
                  </div>

                  <div style={styles.formFooter}>
                    <button type="submit" style={styles.primaryBtn} disabled={submitting}>
                      {submitting ? 'Uploading...' : 'Submit Work Request'}
                    </button>
                    <button type="button" style={styles.secondaryBtn} onClick={resetForm}>
                      Clear Form
                    </button>
                  </div>
                </form>
              </section>
            </>
          )}

          {activeTab === 'dashboard' && (
            <section style={styles.card}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Admin Dashboard</h2>
                  <p style={styles.sectionText}>Open documents and photos directly from each request.</p>
                </div>
                {!isAdmin ? <div style={styles.locked}>Admin login required</div> : null}
              </div>

              <input
                style={styles.input}
                placeholder="Search by name, address, email, work type"
                value={dashboardSearch}
                onChange={(e) => setDashboardSearch(e.target.value)}
              />

              {!isAdmin ? (
                <div style={styles.emptyState}>Use Admin Login to unlock the dashboard.</div>
              ) : loadingRequests ? (
                <div style={styles.emptyState}>Loading requests...</div>
              ) : (
                <div style={styles.kanban}>
                  {(['new', 'estimate_ready', 'pending_approval', 'needs_info'] as RequestStatus[]).map(
                    (status) => (
                      <div key={status} style={{ ...styles.column, ...STATUS_COLORS[status] }}>
                        <div style={styles.columnHead}>
                          <span>{STATUS_LABELS[status]}</span>
                          <span style={styles.countPill}>{groupedRequests[status].length}</span>
                        </div>

                        <div style={styles.columnBody}>
                          {groupedRequests[status].length === 0 ? (
                            <div style={styles.emptyColumn}>No requests</div>
                          ) : (
                            groupedRequests[status].map((request) => (
                              <div key={request.id} style={styles.leadCard}>
                                <div style={styles.leadAddress}>{request.propertyAddress}</div>
                                <div style={styles.leadMeta}>
                                  {request.city}, {request.state} {request.zip}
                                </div>
                                <div style={styles.leadMeta}>
                                  {request.requesterName} • {request.email}
                                  {request.phone ? ` • ${request.phone}` : ''}
                                </div>
                                <div style={styles.leadMeta}>
                                  {request.workType} • {request.urgency} • {request.occupancy}
                                </div>
                                <p style={styles.leadDesc}>{request.description}</p>

                                {renderFiles(request.photos, 'Photos')}
                                {renderFiles(request.documents, 'Files')}

                                <div style={styles.smallText}>{request.createdAt}</div>

                                <select
                                  style={{ ...styles.input, marginBottom: 0, marginTop: 10 }}
                                  value={request.status}
                                  onChange={(e) =>
                                    updateStatus(request.id, e.target.value as RequestStatus)
                                  }
                                >
                                  <option value="new">New Lead</option>
                                  <option value="estimate_ready">Estimate Ready</option>
                                  <option value="pending_approval">Pending Approval</option>
                                  <option value="needs_info">Needs Info</option>
                                </select>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>
          )}

          {activeTab === 'estimates' && (
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Estimate Builder</h2>
              <p style={styles.sectionText}>Build and print a simple estimate.</p>

              <div style={styles.grid2}>
                <input
                  style={styles.input}
                  placeholder="Client name"
                  value={estimateClient}
                  onChange={(e) => setEstimateClient(e.target.value)}
                />
                <input
                  style={styles.input}
                  placeholder="Property address"
                  value={estimateProperty}
                  onChange={(e) => setEstimateProperty(e.target.value)}
                />
              </div>

              {estimateItems.map((item) => (
                <div key={item.id} style={styles.estimateRow}>
                  <input
                    style={{ ...styles.input, marginBottom: 0 }}
                    placeholder="Line item"
                    value={item.label}
                    onChange={(e) => updateEstimateItem(item.id, { label: e.target.value })}
                  />
                  <input
                    style={{ ...styles.input, marginBottom: 0 }}
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) =>
                      updateEstimateItem(item.id, { qty: Number(e.target.value) || 1 })
                    }
                  />
                  <input
                    style={{ ...styles.input, marginBottom: 0 }}
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitCost}
                    onChange={(e) =>
                      updateEstimateItem(item.id, { unitCost: Number(e.target.value) || 0 })
                    }
                  />
                  <button
                    type="button"
                    style={styles.secondaryBtn}
                    onClick={() => removeEstimateItem(item.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}

              <div style={styles.grid2}>
                <input
                  style={styles.input}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Tax %"
                  value={estimateTax}
                  onChange={(e) => setEstimateTax(Number(e.target.value) || 0)}
                />
                <input
                  style={styles.input}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Discount %"
                  value={estimateDiscount}
                  onChange={(e) => setEstimateDiscount(Number(e.target.value) || 0)}
                />
              </div>

              <div style={styles.estimateTotals}>
                <div>Subtotal: <strong>${subtotal.toFixed(2)}</strong></div>
                <div>Tax: <strong>${taxAmount.toFixed(2)}</strong></div>
                <div>Discount: <strong>-${discountAmount.toFixed(2)}</strong></div>
                <div style={styles.totalLine}>Total: <strong>${total.toFixed(2)}</strong></div>
              </div>

              <div style={styles.formFooter}>
                <button type="button" style={styles.secondaryBtn} onClick={addEstimateItem}>
                  Add Line Item
                </button>
                <button type="button" style={styles.primaryBtn} onClick={openPrintableEstimate}>
                  Print Estimate
                </button>
              </div>
            </section>
          )}
        </div>

        <aside style={styles.sidebar}>
          <section style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Notifications</h3>

            <div style={styles.toggleRow}>
              <div>
                <div style={styles.toggleLabel}>Email Alerts</div>
                <div style={styles.toggleText}>Get notified when new requests come in.</div>
              </div>
              <Toggle checked={emailAlerts} onChange={setEmailAlerts} />
            </div>

            <div style={styles.toggleRow}>
              <div>
                <div style={styles.toggleLabel}>Text Message Alerts</div>
                <div style={styles.toggleText}>Receive SMS-style status notifications.</div>
              </div>
              <Toggle checked={smsAlerts} onChange={setSmsAlerts} />
            </div>

            <div style={styles.toggleRow}>
              <div>
                <div style={styles.toggleLabel}>Admin Alerts</div>
                <div style={styles.toggleText}>Stay updated on changes and follow-ups.</div>
              </div>
              <Toggle checked={adminAlerts} onChange={setAdminAlerts} />
            </div>
          </section>

          <section style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Help</h3>
            <p style={styles.sideText}>Need support with a request or estimate?</p>
            <a
              href="mailto:support@shelterprep.com?subject=Shelter%20Prep%20Support"
              style={styles.supportBtn}
            >
              Contact Support
            </a>
          </section>
        </aside>
      </main>

      {showLogin ? (
        <div style={styles.overlay} onClick={() => setShowLogin(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Admin Login</h3>
            <p style={{ color: '#60706f' }}>Demo PIN: 4242</p>
            <input
              style={styles.input}
              placeholder="Enter admin PIN"
              value={adminPinInput}
              onChange={(e) => setAdminPinInput(e.target.value)}
            />
            <div style={styles.formFooter}>
              <button style={styles.primaryBtn} onClick={doAdminLogin}>
                Sign In
              </button>
              <button style={styles.secondaryBtn} onClick={() => setShowLogin(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f6f4ef',
    color: '#1d2a22',
    fontFamily: 'Inter, Arial, sans-serif',
    padding: 20,
  },
  header: {
    maxWidth: 1440,
    margin: '0 auto 20px',
    display: 'grid',
    gridTemplateColumns: '1.1fr 1fr auto',
    gap: 16,
    alignItems: 'center',
  },
  brand: {
    fontSize: 34,
    fontWeight: 800,
    color: '#113c22',
    letterSpacing: 1,
  },
  subBrand: {
    fontSize: 14,
    letterSpacing: 4,
    color: '#2e6b3f',
    fontWeight: 700,
  },
  nav: {
    display: 'flex',
    justifyContent: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  navBtn: {
    border: 'none',
    background: 'transparent',
    padding: '12px 14px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 700,
    color: '#24352b',
  },
  navBtnActive: {
    boxShadow: 'inset 0 -3px 0 #295f36',
    color: '#123a21',
  },
  headerActions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  primaryBtn: {
    border: 'none',
    background: '#134b26',
    color: '#fff',
    padding: '14px 18px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 800,
  },
  secondaryBtn: {
    border: '1px solid #c7d0c9',
    background: '#fff',
    color: '#24352b',
    padding: '14px 18px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 700,
  },
  mainGrid: {
    maxWidth: 1440,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 340px',
    gap: 18,
    alignItems: 'start',
  },
  hero: {
    background: 'linear-gradient(135deg, #204e31 0%, #15361f 100%)',
    color: '#fff',
    borderRadius: 24,
    padding: 28,
    marginBottom: 18,
  },
  heroBadge: {
    display: 'inline-block',
    background: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 12,
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 38,
    lineHeight: 1.08,
    margin: '0 0 10px 0',
  },
  heroText: {
    margin: 0,
    lineHeight: 1.6,
    color: 'rgba(255,255,255,0.92)',
  },
  card: {
    background: '#fff',
    borderRadius: 24,
    padding: 22,
    border: '1px solid #e2e7e3',
    boxShadow: '0 10px 28px rgba(0,0,0,0.05)',
  },
  sectionHead: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 28,
    color: '#173522',
  },
  sectionText: {
    margin: '6px 0 14px 0',
    color: '#66756c',
  },
  success: {
    marginBottom: 16,
    padding: '14px 16px',
    borderRadius: 12,
    background: '#e8f7ec',
    color: '#205f37',
    fontWeight: 700,
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 14,
    border: '1px solid #d5ddd8',
    background: '#fafbfa',
    fontSize: 14,
    outline: 'none',
    marginBottom: 12,
    boxSizing: 'border-box',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12,
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
  },
  uploadBox: {
    display: 'block',
    border: '1px solid #d5ddd8',
    borderRadius: 16,
    background: '#fafbfa',
    padding: 16,
    marginBottom: 12,
  },
  uploadTitle: {
    fontWeight: 800,
    color: '#173522',
    marginBottom: 4,
  },
  uploadText: {
    fontSize: 12,
    color: '#6d7a72',
    marginBottom: 10,
  },
  fileList: {
    marginTop: 10,
    fontSize: 12,
    color: '#4d5b53',
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  formFooter: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
  },
  locked: {
    padding: '10px 12px',
    borderRadius: 12,
    background: '#fff7df',
    color: '#7a6314',
    fontWeight: 700,
    fontSize: 13,
  },
  emptyState: {
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    background: '#f7f8f7',
    color: '#66756c',
  },
  kanban: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 16,
  },
  column: {
    borderRadius: 22,
    padding: 16,
  },
  columnHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    fontWeight: 800,
  },
  countPill: {
    minWidth: 30,
    height: 30,
    borderRadius: 999,
    background: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 800,
  },
  columnBody: {
    display: 'grid',
    gap: 12,
  },
  emptyColumn: {
    borderRadius: 16,
    background: 'rgba(255,255,255,0.78)',
    padding: 14,
    color: '#66756c',
  },
  leadCard: {
    background: '#fff',
    borderRadius: 18,
    padding: 16,
    boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
    border: '1px solid rgba(0,0,0,0.05)',
  },
  leadAddress: {
    fontWeight: 800,
    color: '#173522',
    marginBottom: 4,
  },
  leadMeta: {
    fontSize: 13,
    color: '#59685f',
    lineHeight: 1.5,
    marginBottom: 5,
  },
  leadDesc: {
    margin: '8px 0',
    color: '#223128',
    lineHeight: 1.55,
  },
  smallText: {
    fontSize: 12,
    color: '#809086',
    marginTop: 10,
  },
  estimateRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 110px 140px auto',
    gap: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  estimateTotals: {
    display: 'grid',
    gap: 6,
    marginTop: 10,
    marginBottom: 16,
  },
  totalLine: {
    fontSize: 20,
    color: '#173522',
  },
  sidebar: {
    display: 'grid',
    gap: 18,
  },
  sideCard: {
    background: '#fff',
    borderRadius: 22,
    padding: 20,
    border: '1px solid #e2e7e3',
    boxShadow: '0 10px 28px rgba(0,0,0,0.05)',
  },
  sideTitle: {
    marginTop: 0,
    marginBottom: 14,
    fontSize: 28,
    color: '#173522',
  },
  sideText: {
    color: '#66756c',
    lineHeight: 1.5,
  },
  supportBtn: {
    display: 'inline-block',
    marginTop: 8,
    border: '1px solid #173522',
    color: '#173522',
    padding: '12px 16px',
    borderRadius: 12,
    textDecoration: 'none',
    fontWeight: 700,
  },
  toggleRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 12,
    alignItems: 'center',
    padding: '12px 0',
    borderTop: '1px solid #edf0ee',
  },
  toggleLabel: {
    fontWeight: 800,
    color: '#173522',
    marginBottom: 4,
  },
  toggleText: {
    color: '#66756c',
    lineHeight: 1.5,
    fontSize: 14,
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
    background: '#fff',
    borderRadius: 20,
    padding: 24,
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
}