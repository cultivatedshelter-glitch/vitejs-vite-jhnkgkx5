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

type EstimateItem = {
  id: string
  label: string
  qty: number
  unitCost: number
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
  photos: StoredFile[] | null
  documents: StoredFile[] | null
  status: RequestStatus
}

const SETTINGS_KEY = 'shelter-prep-settings-v3'
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

const STATUS_META: Record<
  RequestStatus,
  { label: string; pillBg: string; cardBg: string; border: string }
> = {
  new: {
    label: 'New Lead',
    pillBg: '#e8f1fb',
    cardBg: '#eef5ff',
    border: '#c8d9f2',
  },
  needs_info: {
    label: 'Needs Info',
    pillBg: '#fdeaea',
    cardBg: '#fff3f3',
    border: '#efc5c5',
  },
  estimate_ready: {
    label: 'Estimate Ready',
    pillBg: '#e8f6ea',
    cardBg: '#f1fbf2',
    border: '#c9e3ce',
  },
  pending_approval: {
    label: 'Pending Approval',
    pillBg: '#f3ece3',
    cardBg: '#fbf6f0',
    border: '#e2d0bc',
  },
}

const initialEstimateItems: EstimateItem[] = [
  { id: crypto.randomUUID(), label: 'Labor', qty: 1, unitCost: 250 },
  { id: crypto.randomUUID(), label: 'Materials', qty: 1, unitCost: 150 },
]

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
  const [successMessage, setSuccessMessage] = useState('')
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [dashboardSearch, setDashboardSearch] = useState('')
  const [estimateClient, setEstimateClient] = useState('')
  const [estimateProperty, setEstimateProperty] = useState('')
  const [estimateTax, setEstimateTax] = useState(0)
  const [estimateDiscount, setEstimateDiscount] = useState(0)
  const [estimateItems, setEstimateItems] = useState<EstimateItem[]>(initialEstimateItems)

  useEffect(() => {
    const rawSettings = localStorage.getItem(SETTINGS_KEY)
    if (!rawSettings) return

    try {
      const parsed = JSON.parse(rawSettings)
      setEmailAlerts(Boolean(parsed.emailAlerts))
      setSmsAlerts(Boolean(parsed.smsAlerts))
      setAdminAlerts(Boolean(parsed.adminAlerts))
    } catch {
      // ignore malformed settings
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ emailAlerts, smsAlerts, adminAlerts })
    )
  }, [emailAlerts, smsAlerts, adminAlerts])

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

    setRequests((data || []).map(mapDbRowToRequest))
    setLoadingRequests(false)
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

  const groupedRequests = useMemo(() => {
    return {
      new: filteredRequests.filter((r) => r.status === 'new'),
      needs_info: filteredRequests.filter((r) => r.status === 'needs_info'),
      estimate_ready: filteredRequests.filter((r) => r.status === 'estimate_ready'),
      pending_approval: filteredRequests.filter((r) => r.status === 'pending_approval'),
    }
  }, [filteredRequests])

  const subtotal = useMemo(
    () => estimateItems.reduce((sum, item) => sum + item.qty * item.unitCost, 0),
    [estimateItems]
  )
  const taxAmount = subtotal * (estimateTax / 100)
  const discountAmount = subtotal * (estimateDiscount / 100)
  const total = subtotal + taxAmount - discountAmount

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
      const safeName = `${Date.now()}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
      const path = `${category}s/${safeName}`

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
        })

      if (uploadError) {
        throw new Error(`${category} upload failed: ${uploadError.message}`)
      }

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

    if (!requesterName || !email || !workType || !propertyAddress || !city || !state || !zip || !description) {
      alert('Please complete all required fields.')
      return
    }

    try {
      setSubmitting(true)

      const photos = await uploadFiles(photoFiles, 'photo')
      const documents = await uploadFiles(documentFiles, 'document')

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
        photos,
        documents,
        status: 'new' as RequestStatus,
      }

      const { data, error } = await supabase
        .from('work_requests')
        .insert(payload)
        .select('*')
        .single()

      if (error) {
        throw new Error(`insert failed: ${error.message}`)
      }

      setRequests((prev) => [mapDbRowToRequest(data), ...prev])
      setSuccessMessage('Work request submitted and files uploaded successfully.')
      resetForm()
    } catch (error: any) {
      console.error('SUBMIT ERROR:', error)
      alert(error?.message || JSON.stringify(error))
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
      alert('No requests to export yet.')
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
        r.workType,
        r.propertyAddress,
        r.city,
        r.state,
        r.zip,
        r.urgency,
        r.occupancy,
        r.timeline,
        r.description,
        r.photos.map((file) => file.url).join(' | '),
        r.documents.map((file) => file.url).join(' | '),
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
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) return

    const rows = estimateItems
      .map(
        (item) => `
          <tr>
            <td style="padding:8px;border:1px solid #d7ddd8;">${item.label || 'Line Item'}</td>
            <td style="padding:8px;border:1px solid #d7ddd8;text-align:right;">${item.qty}</td>
            <td style="padding:8px;border:1px solid #d7ddd8;text-align:right;">$${item.unitCost.toFixed(2)}</td>
            <td style="padding:8px;border:1px solid #d7ddd8;text-align:right;">$${(item.qty * item.unitCost).toFixed(2)}</td>
          </tr>`
      )
      .join('')

    printWindow.document.write(`
      <html>
        <head>
          <title>Shelter Prep Estimate</title>
        </head>
        <body style="font-family:Arial,sans-serif;padding:24px;color:#1f2a30;">
          <h1 style="margin-bottom:4px;">Shelter Prep Estimate</h1>
          <p style="margin-top:0;color:#52606b;">${estimateClient || 'Client'}${estimateProperty ? ` • ${estimateProperty}` : ''}</p>
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
    printWindow.document.close()
  }

  const navButton = (tab: Tab, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      style={{
        ...styles.navButton,
        ...(activeTab === tab ? styles.navButtonActive : {}),
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.logoWrap}>
          <div style={styles.logoMark}>│││</div>
          <div>
            <div style={styles.brand}>SHELTER PREP</div>
            <div style={styles.brandSub}>HOME SERVICES</div>
          </div>
        </div>

        <div style={styles.topNav}>
          {navButton('request', 'New Request')}
          {navButton('dashboard', 'Dashboard')}
          {navButton('estimates', 'Estimates')}
        </div>

        <div style={styles.topActions}>
          <button style={styles.secondaryBtn} onClick={exportCsv}>Export CSV</button>
          {isAdmin ? (
            <button style={styles.primaryBtn} onClick={() => setIsAdmin(false)}>Log Out</button>
          ) : (
            <button style={styles.primaryBtn} onClick={() => setShowLogin(true)}>Admin Login</button>
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
                <div style={styles.sectionHead}>
                  <div>
                    <h2 style={styles.sectionTitle}>New Work Request</h2>
                    <p style={styles.sectionText}>Fields marked with * are required.</p>
                  </div>
                </div>

                {successMessage ? <div style={styles.success}>{successMessage}</div> : null}

                <form onSubmit={submitRequest}>
                  <div style={styles.grid2}>
                    <input style={styles.input} placeholder="Your name *" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} />
                    <input style={styles.input} placeholder="Your email *" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>

                  <div style={styles.grid2}>
                    <input style={styles.input} placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    <select style={styles.input} value={workType} onChange={(e) => setWorkType(e.target.value)}>
                      <option value="">Work type *</option>
                      {WORK_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <input style={styles.input} placeholder="Property address *" value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} />

                  <div style={styles.grid3}>
                    <input style={styles.input} placeholder="City *" value={city} onChange={(e) => setCity(e.target.value)} />
                    <input style={styles.input} placeholder="State *" value={state} onChange={(e) => setState(e.target.value)} />
                    <input style={styles.input} placeholder="ZIP code *" value={zip} onChange={(e) => setZip(e.target.value)} />
                  </div>

                  <div style={styles.grid3}>
                    <select style={styles.input} value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                      <option>Standard</option>
                      <option>Urgent</option>
                      <option>ASAP</option>
                    </select>
                    <select style={styles.input} value={occupancy} onChange={(e) => setOccupancy(e.target.value)}>
                      <option>Occupied</option>
                      <option>Vacant</option>
                      <option>Tenant Occupied</option>
                      <option>Unknown</option>
                    </select>
                    <input style={styles.input} placeholder="Desired timeline" value={timeline} onChange={(e) => setTimeline(e.target.value)} />
                  </div>

                  <textarea
                    style={{ ...styles.input, minHeight: 130, resize: 'vertical' }}
                    placeholder="Describe the work needed. Please include as much detail as possible. *"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />

                  <div style={styles.grid2}>
                    <label style={styles.uploadBox}>
                      <div style={styles.uploadTitle}>Upload photos / videos</div>
                      <div style={styles.uploadText}>JPG, PNG, MP4, MOV up to 20MB each</div>
                      <input
                        type="file"
                        accept="image/*,video/mp4,video/quicktime"
                        multiple
                        onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))}
                      />
                      {photoFiles.length ? <div style={styles.fileList}>{photoFiles.map((f) => f.name).join(', ')}</div> : null}
                    </label>

                    <label style={styles.uploadBox}>
                      <div style={styles.uploadTitle}>Upload documents</div>
                      <div style={styles.uploadText}>PDF, DOC, DOCX up to 20MB each</div>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        multiple
                        onChange={(e) => setDocumentFiles(Array.from(e.target.files || []))}
                      />
                      {documentFiles.length ? <div style={styles.fileList}>{documentFiles.map((f) => f.name).join(', ')}</div> : null}
                    </label>
                  </div>

                  <div style={styles.formFooter}>
                    <button type="submit" style={styles.primarySubmit} disabled={submitting}>
                      {submitting ? 'Uploading...' : 'Submit Work Request'}
                    </button>
                    <div style={styles.footerNote}>Your request will be reviewed by our team.</div>
                    <div style={styles.footerNote}>Your information is secure and will not be shared.</div>
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
                  <p style={styles.sectionText}>
                    Track every job across new leads, estimate-ready work, approvals, and follow-up.
                  </p>
                </div>
                {!isAdmin ? <div style={styles.locked}>Admin login required to manage jobs</div> : null}
              </div>

              <input
                style={styles.input}
                placeholder="Search by name, address, email, work type"
                value={dashboardSearch}
                onChange={(e) => setDashboardSearch(e.target.value)}
              />

              {!isAdmin ? (
                <div style={styles.emptyState}>Use the Admin Login button to unlock the dashboard.</div>
              ) : loadingRequests ? (
                <div style={styles.emptyState}>Loading requests...</div>
              ) : (
                <div style={styles.kanban}>
                  {(['new', 'estimate_ready', 'pending_approval', 'needs_info'] as RequestStatus[]).map((status) => (
                    <div
                      key={status}
                      style={{
                        ...styles.column,
                        background: STATUS_META[status].cardBg,
                        borderColor: STATUS_META[status].border,
                      }}
                    >
                      <div style={styles.columnHead}>
                        <span>{STATUS_META[status].label}</span>
                        <span style={{ ...styles.countPill, background: STATUS_META[status].pillBg }}>
                          {groupedRequests[status].length}
                        </span>
                      </div>

                      <div style={styles.columnBody}>
                        {groupedRequests[status].length === 0 ? (
                          <div style={styles.emptyColumn}>No requests</div>
                        ) : (
                          groupedRequests[status].map((request) => (
                            <div key={request.id} style={styles.leadCard}>
                              <div style={styles.leadAddress}>{request.propertyAddress}</div>
                              <div style={styles.leadMeta}>{request.city}, {request.state} {request.zip}</div>
                              <div style={styles.leadMeta}>{request.requesterName} • {request.email}</div>
                              <div style={styles.leadMeta}>{request.workType} • {request.urgency}</div>
                              <p style={styles.leadDesc}>{request.description}</p>

                              {request.photos.length > 0 ? (
                                <div style={styles.fileSection}>
                                  <strong>Photos:</strong>
                                  <div style={styles.linkList}>
                                    {request.photos.map((file) => (
                                      <a key={file.path} href={file.url} target="_blank" rel="noreferrer" style={styles.fileLink}>
                                        {file.name}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {request.documents.length > 0 ? (
                                <div style={styles.fileSection}>
                                  <strong>Files:</strong>
                                  <div style={styles.linkList}>
                                    {request.documents.map((file) => (
                                      <a key={file.path} href={file.url} target="_blank" rel="noreferrer" style={styles.fileLink}>
                                        {file.name}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              <div style={styles.smallText}>{request.createdAt}</div>
                              <select
                                style={{ ...styles.input, marginBottom: 0, marginTop: 10 }}
                                value={request.status}
                                onChange={(e) => updateStatus(request.id, e.target.value as RequestStatus)}
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
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'estimates' && (
            <section style={styles.card}>
              <div style={styles.sectionHead}>
                <div>
                  <h2 style={styles.sectionTitle}>Estimate Builder</h2>
                  <p style={styles.sectionText}>Add line items, taxes, and discounts, then print a clean estimate.</p>
                </div>
              </div>

              <div style={styles.grid2}>
                <input style={styles.input} placeholder="Client name" value={estimateClient} onChange={(e) => setEstimateClient(e.target.value)} />
                <input style={styles.input} placeholder="Property address" value={estimateProperty} onChange={(e) => setEstimateProperty(e.target.value)} />
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
                    onChange={(e) => updateEstimateItem(item.id, { qty: Number(e.target.value) || 1 })}
                  />
                  <input
                    style={{ ...styles.input, marginBottom: 0 }}
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitCost}
                    onChange={(e) => updateEstimateItem(item.id, { unitCost: Number(e.target.value) || 0 })}
                  />
                  <button style={styles.secondaryBtn} onClick={() => removeEstimateItem(item.id)} type="button">Remove</button>
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
                <button type="button" style={styles.secondaryBtn} onClick={addEstimateItem}>Add Line Item</button>
                <button type="button" style={styles.primarySubmit} onClick={openPrintableEstimate}>Print Estimate</button>
              </div>
            </section>
          )}
        </div>

        <aside style={styles.sidebar}>
          <section style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Instant Notifications</h3>
            <ToggleRow label="Email Alerts" text="Get instant email notifications when new requests come in." checked={emailAlerts} onChange={setEmailAlerts} />
            <ToggleRow label="Text Message Alerts" text="Receive SMS notifications on your mobile phone." checked={smsAlerts} onChange={setSmsAlerts} />
            <ToggleRow label="Admin Alerts" text="Stay updated on status changes, new messages, and more." checked={adminAlerts} onChange={setAdminAlerts} />
          </section>

          <section style={styles.sideCardSoft}>
            <h3 style={styles.sideTitle}>Estimate Builder</h3>
            <p style={styles.sideText}>Create professional estimates quickly and send to clients.</p>
            <ul style={styles.featureList}>
              <li>Add line items and materials</li>
              <li>Set labor, taxes, and discounts</li>
              <li>Professional printable estimates</li>
              <li>Send and track client approvals</li>
            </ul>
            <button style={styles.secondaryWideBtn} onClick={() => setActiveTab('estimates')}>Go to Estimate Builder</button>
          </section>

          <section style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Need Help?</h3>
            <p style={styles.sideText}>Contact our support team for assistance.</p>
            <a href="mailto:support@shelterprep.com?subject=Shelter%20Prep%20Support" style={styles.supportBtn}>Contact Support</a>
          </section>
        </aside>
      </main>

      <section style={styles.bottomBand}>
        <BottomFeature title="Instant Email Alerts" text="Get notified immediately when new work requests are submitted." />
        <BottomFeature title="Text Message Alerts" text="Receive real-time text notifications so you never miss a request." />
        <BottomFeature title="Estimate Builder" text="Build, send, and track estimates all in one place." />
        <BottomFeature title="Track Every Job" text="Manage requests, status updates, and client communication easily." />
      </section>

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
              <button style={styles.primaryBtn} onClick={doAdminLogin}>Sign In</button>
              <button style={styles.secondaryBtn} onClick={() => setShowLogin(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function mapDbRowToRequest(row: DbLeadRow): WorkRequest {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).toLocaleString(),
    requesterName: row.requester_name,
    email: row.email,
    phone: row.phone || '',
    workType: row.work_type,
    propertyAddress: row.property_address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    urgency: row.urgency,
    occupancy: row.occupancy,
    timeline: row.timeline || '',
    description: row.description,
    photos: row.photos || [],
    documents: row.documents || [],
    status: row.status,
  }
}

function ToggleRow({
  label,
  text,
  checked,
  onChange,
}: {
  label: string
  text: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div style={styles.toggleRow}>
      <div style={{ flex: 1 }}>
        <div style={styles.toggleLabel}>{label}</div>
        <div style={styles.toggleText}>{text}</div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
          ...styles.toggle,
          justifyContent: checked ? 'flex-end' : 'flex-start',
          background: checked ? '#77a66a' : '#ccd6cf',
        }}
      >
        <span style={styles.toggleKnob} />
      </button>
    </div>
  )
}

function BottomFeature({ title, text }: { title: string; text: string }) {
  return (
    <div style={styles.bottomFeature}>
      <div style={styles.bottomFeatureTitle}>{title}</div>
      <div style={styles.bottomFeatureText}>{text}</div>
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
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  logoMark: {
    width: 44,
    height: 58,
    border: '3px solid #164f2d',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottom: 'none',
    color: '#164f2d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    letterSpacing: -2,
  },
  brand: {
    fontSize: 36,
    fontWeight: 800,
    color: '#113c22',
    letterSpacing: 1,
  },
  brandSub: {
    fontSize: 16,
    letterSpacing: 4,
    color: '#2e6b3f',
    fontWeight: 700,
  },
  topNav: {
    display: 'flex',
    justifyContent: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  navButton: {
    border: 'none',
    background: 'transparent',
    padding: '12px 14px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 700,
    color: '#24352b',
  },
  navButtonActive: {
    boxShadow: 'inset 0 -3px 0 #295f36',
    color: '#123a21',
  },
  topActions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  primaryBtn: {
    border: 'none',
    background: '#134b26',
    color: '#fff',
    padding: '14px 20px',
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
    gridTemplateColumns: 'minmax(0, 1fr) 380px',
    gap: 18,
    alignItems: 'start',
  },
  hero: {
    background: 'linear-gradient(135deg, #103c21 0%, #0a2e1a 55%, #204c30 100%)',
    color: '#fff',
    borderRadius: 24,
    padding: 36,
    marginBottom: 16,
    boxShadow: '0 20px 50px rgba(16,60,33,0.18)',
  },
  heroBadge: {
    display: 'inline-block',
    padding: '8px 14px',
    background: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    marginBottom: 16,
    fontSize: 14,
    fontWeight: 700,
  },
  heroTitle: {
    margin: '0 0 12px',
    fontSize: 34,
    lineHeight: 1.12,
  },
  heroText: {
    margin: 0,
    fontSize: 18,
    lineHeight: 1.6,
    maxWidth: 720,
    color: 'rgba(255,255,255,0.92)',
  },
  card: {
    background: '#fff',
    borderRadius: 24,
    padding: 24,
    border: '1px solid #dde3dd',
    boxShadow: '0 12px 28px rgba(27,46,35,0.06)',
  },
  sideCard: {
    background: '#fff',
    borderRadius: 22,
    padding: 22,
    border: '1px solid #dde3dd',
    boxShadow: '0 12px 28px rgba(27,46,35,0.05)',
    marginBottom: 14,
  },
  sideCardSoft: {
    background: '#edf0e8',
    borderRadius: 22,
    padding: 22,
    border: '1px solid #d8ded6',
    boxShadow: '0 12px 28px rgba(27,46,35,0.05)',
    marginBottom: 14,
  },
  sidebar: {
    position: 'sticky',
    top: 16,
  },
  sideTitle: {
    marginTop: 0,
    marginBottom: 14,
    fontSize: 20,
    color: '#213428',
  },
  sideText: {
    marginTop: 0,
    color: '#5f6d63',
    lineHeight: 1.55,
  },
  sectionHead: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 34,
    color: '#213428',
  },
  sectionText: {
    margin: '8px 0 0',
    color: '#66756c',
  },
  success: {
    background: '#e7f7ea',
    border: '1px solid #cce4d0',
    color: '#1b6a37',
    borderRadius: 14,
    padding: '14px 16px',
    fontWeight: 700,
    marginBottom: 14,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid #d5ddd6',
    background: '#fff',
    boxSizing: 'border-box',
    fontSize: 15,
    marginBottom: 12,
  },
  uploadBox: {
    display: 'block',
    border: '1px dashed #cfd7d1',
    borderRadius: 14,
    padding: 18,
    background: '#fcfcfa',
    cursor: 'pointer',
  },
  uploadTitle: {
    fontWeight: 800,
    marginBottom: 4,
  },
  uploadText: {
    color: '#6a776f',
    fontSize: 14,
    marginBottom: 10,
  },
  fileList: {
    marginTop: 10,
    color: '#415148',
    fontSize: 13,
    lineHeight: 1.5,
  },
  formFooter: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 14,
  },
  primarySubmit: {
    border: 'none',
    background: '#0e5424',
    color: '#fff',
    padding: '16px 22px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 800,
  },
  footerNote: {
    color: '#627066',
    fontSize: 14,
  },
  toggleRow: {
    display: 'flex',
    gap: 14,
    alignItems: 'center',
    padding: '14px 0',
    borderTop: '1px solid #e6ebe6',
  },
  toggleLabel: {
    fontWeight: 800,
    marginBottom: 4,
  },
  toggleText: {
    color: '#66756c',
    lineHeight: 1.45,
    fontSize: 14,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 999,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    padding: 3,
    cursor: 'pointer',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#fff',
    display: 'block',
  },
  featureList: {
    paddingLeft: 18,
    color: '#435248',
    lineHeight: 1.8,
  },
  secondaryWideBtn: {
    width: '100%',
    border: '1px solid #8aa18d',
    background: '#fff',
    color: '#1a3423',
    padding: '14px 16px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 800,
    marginTop: 10,
  },
  supportBtn: {
    display: 'inline-block',
    textDecoration: 'none',
    border: '1px solid #263a2e',
    color: '#263a2e',
    background: '#fff',
    padding: '12px 16px',
    borderRadius: 12,
    fontWeight: 800,
  },
  kanban: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 14,
    marginTop: 8,
  },
  column: {
    border: '1px solid',
    borderRadius: 18,
    padding: 14,
    minHeight: 260,
  },
  columnHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    fontWeight: 800,
    color: '#203128',
  },
  countPill: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
  },
  columnBody: {
    display: 'grid',
    gap: 12,
  },
  emptyColumn: {
    background: 'rgba(255,255,255,0.7)',
    borderRadius: 12,
    padding: 14,
    color: '#627066',
  },
  emptyState: {
    marginTop: 8,
    border: '1px dashed #cfd7d1',
    borderRadius: 16,
    padding: 18,
    color: '#5f6d63',
  },
  leadCard: {
    background: '#fff',
    borderRadius: 14,
    padding: 14,
    border: '1px solid rgba(0,0,0,0.05)',
    boxShadow: '0 8px 18px rgba(25,40,31,0.05)',
  },
  leadAddress: {
    fontWeight: 800,
    marginBottom: 4,
  },
  leadMeta: {
    fontSize: 13,
    color: '#5f6d63',
    marginBottom: 4,
    lineHeight: 1.45,
  },
  leadDesc: {
    fontSize: 14,
    lineHeight: 1.5,
    color: '#213428',
  },
  smallText: {
    fontSize: 12,
    color: '#5e6a62',
    lineHeight: 1.45,
    marginTop: 6,
  },
  fileSection: {
    marginTop: 8,
    fontSize: 12,
    color: '#435248',
  },
  linkList: {
    display: 'grid',
    gap: 6,
    marginTop: 6,
  },
  fileLink: {
    color: '#0d5b7a',
    textDecoration: 'underline',
    wordBreak: 'break-word',
  },
  locked: {
    padding: '10px 12px',
    background: '#f3f0ea',
    borderRadius: 999,
    color: '#6b655d',
    fontSize: 13,
    fontWeight: 700,
  },
  estimateRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 0.7fr 0.9fr auto',
    gap: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  estimateTotals: {
    marginTop: 6,
    display: 'grid',
    gap: 8,
    color: '#324139',
  },
  totalLine: {
    fontSize: 20,
    marginTop: 4,
  },
  bottomBand: {
    maxWidth: 1440,
    margin: '16px auto 0',
    background: '#eee8df',
    border: '1px solid #ddd5ca',
    borderRadius: 20,
    padding: 18,
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
  },
  bottomFeature: {
    padding: '8px 12px',
    borderRight: '1px solid #d8d0c4',
  },
  bottomFeatureTitle: {
    fontWeight: 800,
    marginBottom: 6,
  },
  bottomFeatureText: {
    color: '#5f6d63',
    lineHeight: 1.45,
    fontSize: 14,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    background: '#fff',
    borderRadius: 20,
    padding: 24,
    boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
  },
}
