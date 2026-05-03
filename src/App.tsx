import React, { useEffect, useMemo, useState } from 'react'
import AiEstimator from './components/AiEstimator'
import BidMemory from './components/BidMemory'
import { supabase } from './lib/supabase'

type RequestStatus =
  | 'new'
  | 'needs_info'
  | 'estimate_ready'
  | 'pending_approval'
  | 'scheduled'
  | 'completed'

type UploadedFile = {
  name: string
  path: string
  type: string
}

type AiEstimate = {
  projectSummary?: string
  lowPrice?: number
  standardPrice?: number
  premiumPrice?: number
  pricingRationale?: string
  riskFactors?: string[]
  missingInfo?: string[]
  recommendedScope?: string[]
  exclusions?: string[]
  clientMessage?: string
  contractorNotes?: string
}

type WorkRequest = {
  id: string
  createdAt: string
  requesterName: string
  email: string
  phone: string
  propertyAddress: string
  city: string
  state: string
  zip: string
  workType: string
  urgency: string
  occupancy: string
  timeline: string
  description: string
  photos: UploadedFile[]
  documents: UploadedFile[]
  status: RequestStatus
  aiEstimate?: AiEstimate
}

const ADMIN_PIN = '4242'
const STORAGE_KEY = 'shelter-prep-private-files-v1'
const STORAGE_BUCKET = 'lead-uploads'

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
  'Pre-Listing Repairs',
  'Home Services',
]

const STATUS_LABELS: Record<RequestStatus, string> = {
  new: 'New Request',
  needs_info: 'Needs Info',
  estimate_ready: 'Estimate Ready',
  pending_approval: 'Pending Approval',
  scheduled: 'Scheduled',
  completed: 'Completed',
}

export default function App() {
  const [tab, setTab] = useState<
    'new' | 'dashboard' | 'bidMemory' | 'ai'
  >('new')

  const [isAdmin, setIsAdmin] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [pin, setPin] = useState('')

  const [requests, setRequests] = useState<WorkRequest[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | RequestStatus>('all')

  const [requesterName, setRequesterName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [city, setCity] = useState('')
  const [stateValue, setStateValue] = useState('')
  const [zip, setZip] = useState('')
  const [workType, setWorkType] = useState(WORK_TYPES[0])
  const [urgency, setUrgency] = useState('Standard')
  const [occupancy, setOccupancy] = useState('Occupied')
  const [timeline, setTimeline] = useState('')
  const [description, setDescription] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [documentFiles, setDocumentFiles] = useState<File[]>([])
  const [successMessage, setSuccessMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null)

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

  function requireAdmin(nextTab: 'dashboard' | 'bidMemory' | 'ai') {
    if (!isAdmin) {
      setShowLogin(true)
      return
    }

    setTab(nextTab)
  }

  function login() {
    if (pin === ADMIN_PIN) {
      setIsAdmin(true)
      setShowLogin(false)
      setPin('')
      setTab('dashboard')
    } else {
      alert('Wrong admin PIN')
    }
  }

  function logout() {
    setIsAdmin(false)
    setTab('new')
  }

  function makeId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }

    return String(Date.now())
  }

  function resetForm() {
    setRequesterName('')
    setEmail('')
    setPhone('')
    setPropertyAddress('')
    setCity('')
    setStateValue('')
    setZip('')
    setWorkType(WORK_TYPES[0])
    setUrgency('Standard')
    setOccupancy('Occupied')
    setTimeline('')
    setDescription('')
    setPhotoFiles([])
    setDocumentFiles([])
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhotoFiles(Array.from(e.target.files || []))
  }

  function handleDocumentChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDocumentFiles(Array.from(e.target.files || []))
  }

  async function uploadLeadFiles(files: File[], folder: string) {
    const uploaded: UploadedFile[] = []

    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const path = `${folder}/${Date.now()}-${safeName}`

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file)

      if (error) {
        console.error(error)
        throw error
      }

      uploaded.push({
        name: file.name,
        path,
        type: file.type,
      })
    }

    return uploaded
  }

  async function openPrivateFile(file: UploadedFile) {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(file.path, 60 * 10)

    if (error || !data?.signedUrl) {
      console.error(error)
      alert('Could not open file. Check Supabase storage policies.')
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
      const uploadedPhotos = await uploadLeadFiles(photoFiles, 'photos')
      const uploadedDocuments = await uploadLeadFiles(documentFiles, 'documents')

      const newRequest: WorkRequest = {
        id: makeId(),
        createdAt: new Date().toLocaleString(),
        requesterName,
        email,
        phone,
        propertyAddress,
        city,
        state: stateValue,
        zip,
        workType,
        urgency,
        occupancy,
        timeline,
        description,
        photos: uploadedPhotos,
        documents: uploadedDocuments,
        status: 'new',
      }

      setRequests((prev) => [newRequest, ...prev])
      setSuccessMessage('Request submitted. Shelter Prep will review and follow up.')
      resetForm()
    } catch (error) {
      console.error(error)
      alert('Upload failed. Check Supabase storage policies and bucket name.')
    } finally {
      setSubmitting(false)
    }
  }

  function updateStatus(id: string, status: RequestStatus) {
    setRequests((prev) =>
      prev.map((request) =>
        request.id === id ? { ...request, status } : request
      )
    )
  }

  async function runAiEstimate(request: WorkRequest) {
    setAiLoadingId(request.id)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        alert('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
        return
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/ai-estimator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          projectType: request.workType,
          location: `${request.city}, ${request.state} ${request.zip}`,
          scope: request.description,
          measurements: '',
          accessNotes: `Occupancy: ${request.occupancy}`,
          materialsBy: 'unknown',
          disposalNeeded: false,
          timeline: request.timeline,
          budget: '',
          notes: `Urgency: ${request.urgency}. Address: ${request.propertyAddress}`,
          files: [...request.photos, ...request.documents],
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error(data)
        alert(data.error || 'AI estimator failed.')
        return
      }

      setRequests((prev) =>
        prev.map((item) =>
          item.id === request.id
            ? {
                ...item,
                aiEstimate: data.estimate,
                status: 'estimate_ready',
              }
            : item
        )
      )
    } catch (error) {
      console.error(error)
      alert('AI estimator failed. Check Supabase logs.')
    } finally {
      setAiLoadingId(null)
    }
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

    const rows = requests.map((request) =>
      [
        request.createdAt,
        request.status,
        request.requesterName,
        request.email,
        request.phone,
        request.propertyAddress,
        request.city,
        request.state,
        request.zip,
        request.workType,
        request.urgency,
        request.occupancy,
        request.timeline,
        request.description,
        request.photos.map((file) => file.name).join(' | '),
        request.documents.map((file) => file.name).join(' | '),
      ]
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
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
    return requests.filter((request) => {
      const matchesFilter = filter === 'all' ? true : request.status === filter

      const haystack = [
        request.requesterName,
        request.email,
        request.phone,
        request.propertyAddress,
        request.city,
        request.state,
        request.zip,
        request.workType,
        request.description,
      ]
        .join(' ')
        .toLowerCase()

      return matchesFilter && haystack.includes(search.toLowerCase())
    })
  }, [requests, filter, search])

  const columns: RequestStatus[] = [
    'new',
    'needs_info',
    'estimate_ready',
    'pending_approval',
    'scheduled',
    'completed',
  ]

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div style={brandStyle}>
          <div style={logoMarkStyle}>
            <span style={logoLineStyle}></span>
            <span style={logoLineStyle}></span>
            <span style={logoLineStyle}></span>
          </div>

          <div>
            <div style={brandNameStyle}>SHELTER PREP</div>
            <div style={brandSubStyle}>HOME SERVICES</div>
          </div>
        </div>

        <nav style={navStyle}>
          <button
            style={tab === 'new' ? navActiveStyle : navButtonStyle}
            onClick={() => setTab('new')}
          >
            New Request
          </button>

          <button
            style={tab === 'dashboard' ? navActiveStyle : navButtonStyle}
            onClick={() => requireAdmin('dashboard')}
          >
            Dashboard
          </button>

          <button
            style={tab === 'bidMemory' ? navActiveStyle : navButtonStyle}
            onClick={() => requireAdmin('bidMemory')}
          >
            Bid Memory
          </button>

          <button
            style={tab === 'ai' ? navActiveStyle : navButtonStyle}
            onClick={() => requireAdmin('ai')}
          >
            AI Estimator
          </button>
        </nav>

        <div style={topActionsStyle}>
          {isAdmin && (
            <button style={outlineButtonStyle} onClick={exportCsv}>
              Export CSV
            </button>
          )}

          {isAdmin ? (
            <button style={primaryButtonStyle} onClick={logout}>
              Log Out
            </button>
          ) : (
            <button style={primaryButtonStyle} onClick={() => setShowLogin(true)}>
              Admin Login
            </button>
          )}
        </div>
      </header>

      <main style={mainStyle}>
        {tab === 'new' && (
          <div style={twoColumnStyle}>
            <div>
              <section style={heroCardStyle}>
                <div style={heroBadgeStyle}>Property work intake</div>
                <h1 style={heroTitleStyle}>Submit a work request in one place.</h1>
                <p style={heroTextStyle}>
                  Enter the property details, describe the work needed, and upload photos,
                  documents, or video for Shelter Prep review.
                </p>
              </section>

              <section style={cardStyle}>
                <h2 style={sectionTitleStyle}>New Work Request</h2>
                <p style={sectionTextStyle}>Fields marked with * are required.</p>

                {successMessage && <div style={successStyle}>{successMessage}</div>}

                <form onSubmit={handleSubmit}>
                  <div style={grid2Style}>
                    <input
                      style={inputStyle}
                      placeholder="Your name *"
                      value={requesterName}
                      onChange={(e) => setRequesterName(e.target.value)}
                    />
                    <input
                      style={inputStyle}
                      placeholder="Your email *"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div style={grid2Style}>
                    <input
                      style={inputStyle}
                      placeholder="Phone number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                    <select
                      style={inputStyle}
                      value={workType}
                      onChange={(e) => setWorkType(e.target.value)}
                    >
                      {WORK_TYPES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    style={inputStyle}
                    placeholder="Property address *"
                    value={propertyAddress}
                    onChange={(e) => setPropertyAddress(e.target.value)}
                  />

                  <div style={grid3Style}>
                    <input
                      style={inputStyle}
                      placeholder="City *"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                    <input
                      style={inputStyle}
                      placeholder="State *"
                      value={stateValue}
                      onChange={(e) => setStateValue(e.target.value)}
                    />
                    <input
                      style={inputStyle}
                      placeholder="ZIP code *"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                    />
                  </div>

                  <div style={grid3Style}>
                    <select
                      style={inputStyle}
                      value={urgency}
                      onChange={(e) => setUrgency(e.target.value)}
                    >
                      <option value="Standard">Standard</option>
                      <option value="Urgent">Urgent</option>
                      <option value="ASAP">ASAP</option>
                    </select>

                    <select
                      style={inputStyle}
                      value={occupancy}
                      onChange={(e) => setOccupancy(e.target.value)}
                    >
                      <option value="Occupied">Occupied</option>
                      <option value="Vacant">Vacant</option>
                      <option value="Unknown">Unknown</option>
                    </select>

                    <input
                      style={inputStyle}
                      placeholder="Desired timeline"
                      value={timeline}
                      onChange={(e) => setTimeline(e.target.value)}
                    />
                  </div>

                  <textarea
                    style={{ ...inputStyle, minHeight: 140, resize: 'vertical' }}
                    placeholder="Describe the work needed *"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />

                  <div style={grid2Style}>
                    <div style={uploadBoxStyle}>
                      <label style={uploadLabelStyle}>Photos</label>
                      <input type="file" multiple accept="image/*" onChange={handlePhotoChange} />
                      {photoFiles.length > 0 && (
                        <div style={fileTextStyle}>
                          {photoFiles.map((file) => file.name).join(', ')}
                        </div>
                      )}
                    </div>

                    <div style={uploadBoxStyle}>
                      <label style={uploadLabelStyle}>Documents / Video / Inspection Notes</label>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.mov"
                        onChange={handleDocumentChange}
                      />
                      {documentFiles.length > 0 && (
                        <div style={fileTextStyle}>
                          {documentFiles.map((file) => file.name).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={buttonRowStyle}>
                    <button type="submit" style={primaryButtonStyle} disabled={submitting}>
                      {submitting ? 'Submitting...' : 'Submit Property Issue'}
                    </button>
                    <button type="button" style={outlineButtonStyle} onClick={resetForm}>
                      Clear Form
                    </button>
                  </div>
                </form>
              </section>
            </div>

            <aside style={sideColumnStyle}>
              <section style={cardStyle}>
                <h3 style={sideTitleStyle}>Private Status Updates</h3>
                <p style={sectionTextStyle}>
                  After submitting, Shelter Prep will follow up by email or phone.
                  Job details are not shown publicly on this website.
                </p>
              </section>

              <section style={softCardStyle}>
                <h3 style={sideTitleStyle}>Bid Memory</h3>
                <p style={sectionTextStyle}>
                  Admin-only memory for old bids, invoices, lessons learned, and pricing history.
                </p>
                <button style={wideOutlineButtonStyle} onClick={() => requireAdmin('bidMemory')}>
                  Open Bid Memory
                </button>
              </section>

              <section style={softCardStyle}>
                <h3 style={sideTitleStyle}>AI Estimator</h3>
                <p style={sectionTextStyle}>
                  Create smarter bid ranges using past jobs, project scope, and risk notes.
                </p>
                <button style={wideOutlineButtonStyle} onClick={() => requireAdmin('ai')}>
                  Open AI Estimator
                </button>
              </section>
            </aside>
          </div>
        )}

        {isAdmin && tab === 'dashboard' && (
          <>
            <section style={cardStyle}>
              <div style={dashboardHeaderStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>Admin Dashboard</h2>
                  <p style={sectionTextStyle}>
                    Review submitted requests, open private files, and run AI estimates.
                  </p>
                </div>

                <div style={filterBarStyle}>
                  <input
                    style={inputStyle}
                    placeholder="Search requests"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />

                  <select
                    style={inputStyle}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as 'all' | RequestStatus)}
                  >
                    <option value="all">All Statuses</option>
                    {columns.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section style={kanbanWrapStyle}>
              {columns.map((status) => {
                const items = filteredRequests.filter((request) => request.status === status)

                return (
                  <div key={status} style={{ ...columnStyle, ...columnByStatus[status] }}>
                    <div style={columnHeaderStyle}>
                      <span>{STATUS_LABELS[status]}</span>
                      <span style={countBadgeStyle}>{items.length}</span>
                    </div>

                    <div style={columnBodyStyle}>
                      {items.length === 0 ? (
                        <div style={emptyColumnStyle}>No requests</div>
                      ) : (
                        items.map((request) => (
                          <div key={request.id} style={requestCardStyle}>
                            <strong>{request.propertyAddress}</strong>
                            <p style={smallMutedStyle}>
                              {request.city}, {request.state} {request.zip}
                            </p>
                            <p style={smallMutedStyle}>
                              {request.requesterName} • {request.email}
                            </p>
                            <p style={cardTextStyle}>{request.description}</p>

                            {request.photos.length > 0 && (
                              <div style={fileLinkGroupStyle}>
                                <strong>Photos:</strong>
                                {request.photos.map((file) => (
                                  <div key={file.path}>
                                    <button
                                      style={linkButtonStyle}
                                      onClick={() => openPrivateFile(file)}
                                    >
                                      Open {file.name}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {request.documents.length > 0 && (
                              <div style={fileLinkGroupStyle}>
                                <strong>Documents:</strong>
                                {request.documents.map((file) => (
                                  <div key={file.path}>
                                    <button
                                      style={linkButtonStyle}
                                      onClick={() => openPrivateFile(file)}
                                    >
                                      Open {file.name}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <button
                              style={widePrimaryButtonStyle}
                              onClick={() => runAiEstimate(request)}
                              disabled={aiLoadingId === request.id}
                            >
                              {aiLoadingId === request.id ? 'Running AI...' : 'Run AI Estimate'}
                            </button>

                            {request.aiEstimate && (
                              <div style={aiBoxStyle}>
                                <strong>AI Estimate</strong>
                                <p>{request.aiEstimate.projectSummary || 'Estimate ready.'}</p>
                                <p>
                                  Low: ${request.aiEstimate.lowPrice || 0} • Standard: $
                                  {request.aiEstimate.standardPrice || 0} • Premium: $
                                  {request.aiEstimate.premiumPrice || 0}
                                </p>
                              </div>
                            )}

                            <select
                              style={{ ...inputStyle, marginBottom: 0, marginTop: 12 }}
                              value={request.status}
                              onChange={(e) =>
                                updateStatus(request.id, e.target.value as RequestStatus)
                              }
                            >
                              {columns.map((nextStatus) => (
                                <option key={nextStatus} value={nextStatus}>
                                  {STATUS_LABELS[nextStatus]}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </section>
          </>
        )}

        {isAdmin && tab === 'bidMemory' && <BidMemory />}
        {isAdmin && tab === 'ai' && <AiEstimator />}
      </main>

      {showLogin && (
        <div style={overlayStyle} onClick={() => setShowLogin(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Admin Login</h2>
            <p style={sectionTextStyle}>Demo PIN: 4242</p>

            <input
              style={inputStyle}
              placeholder="Enter admin PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />

            <div style={buttonRowStyle}>
              <button style={primaryButtonStyle} onClick={login}>
                Sign In
              </button>
              <button style={outlineButtonStyle} onClick={() => setShowLogin(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const COLORS = {
  background: '#f4f1ec',
  card: '#ffffff',
  soft: '#eef3ea',
  green: '#0f542d',
  darkGreen: '#07391f',
  ink: '#173425',
  muted: '#5f6f63',
  border: '#d7dfd3',
  paleGreen: '#e7f3e5',
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: COLORS.background,
  color: COLORS.ink,
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const headerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1.2fr 1fr',
  alignItems: 'center',
  gap: 20,
  padding: '34px 46px 24px',
}

const brandStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
}

const logoMarkStyle: React.CSSProperties = {
  width: 54,
  height: 68,
  border: `4px solid ${COLORS.green}`,
  borderBottom: 'none',
  borderRadius: '22px 22px 0 0',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 6,
}

const logoLineStyle: React.CSSProperties = {
  width: 3,
  height: 28,
  background: COLORS.green,
  borderRadius: 999,
}

const brandNameStyle: React.CSSProperties = {
  fontSize: 32,
  letterSpacing: 3,
  fontWeight: 900,
  color: COLORS.green,
  lineHeight: 1,
}

const brandSubStyle: React.CSSProperties = {
  marginTop: 10,
  fontSize: 13,
  letterSpacing: 6,
  fontWeight: 800,
  color: COLORS.green,
}

const navStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 18,
  flexWrap: 'wrap',
}

const navButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: COLORS.ink,
  padding: '12px 18px',
  borderRadius: 999,
  fontSize: 16,
  fontWeight: 800,
  cursor: 'pointer',
}

const navActiveStyle: React.CSSProperties = {
  ...navButtonStyle,
  borderBottom: `3px solid ${COLORS.green}`,
  boxShadow: `0 14px 0 -11px ${COLORS.green}`,
}

const topActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 14,
  flexWrap: 'wrap',
}

const mainStyle: React.CSSProperties = {
  padding: '10px 46px 60px',
}

const twoColumnStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 0.7fr',
  gap: 22,
}

const sideColumnStyle: React.CSSProperties = {
  display: 'grid',
  gap: 18,
  alignContent: 'start',
}

const heroCardStyle: React.CSSProperties = {
  background: `linear-gradient(135deg, ${COLORS.green} 0%, ${COLORS.darkGreen} 100%)`,
  color: 'white',
  borderRadius: 28,
  padding: 32,
  marginBottom: 22,
}

const heroBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 18px',
  background: 'rgba(255,255,255,0.16)',
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 13,
  marginBottom: 18,
}

const heroTitleStyle: React.CSSProperties = {
  fontSize: 34,
  lineHeight: 1.1,
  margin: '0 0 12px',
}

const heroTextStyle: React.CSSProperties = {
  fontSize: 18,
  lineHeight: 1.55,
  margin: 0,
}

const cardStyle: React.CSSProperties = {
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 24,
  boxShadow: '0 10px 28px rgba(15, 84, 45, 0.06)',
}

const softCardStyle: React.CSSProperties = {
  background: COLORS.soft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 24,
}

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 30,
  color: COLORS.ink,
}

const sideTitleStyle: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: 22,
  color: COLORS.ink,
}

const sectionTextStyle: React.CSSProperties = {
  margin: '10px 0 20px',
  color: COLORS.muted,
  fontSize: 16,
  lineHeight: 1.5,
}

const smallMutedStyle: React.CSSProperties = {
  margin: '6px 0',
  color: COLORS.muted,
  fontSize: 14,
  lineHeight: 1.45,
}

const cardTextStyle: React.CSSProperties = {
  color: COLORS.ink,
  lineHeight: 1.55,
}

const grid2Style: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 14,
}

const grid3Style: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 14,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '16px 18px',
  borderRadius: 13,
  border: `1px solid ${COLORS.border}`,
  background: 'white',
  color: COLORS.ink,
  fontSize: 15,
  outline: 'none',
  marginBottom: 14,
  boxSizing: 'border-box',
}

const uploadBoxStyle: React.CSSProperties = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: 16,
  background: '#fbfcfa',
  padding: 18,
  marginBottom: 14,
}

const uploadLabelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 800,
  marginBottom: 10,
}

const fileTextStyle: React.CSSProperties = {
  marginTop: 10,
  fontSize: 13,
  color: COLORS.muted,
}

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 10,
}

const primaryButtonStyle: React.CSSProperties = {
  border: 'none',
  background: COLORS.green,
  color: 'white',
  padding: '15px 22px',
  borderRadius: 12,
  cursor: 'pointer',
  fontWeight: 900,
  fontSize: 15,
}

const widePrimaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  width: '100%',
  marginTop: 12,
}

const outlineButtonStyle: React.CSSProperties = {
  border: `1px solid ${COLORS.border}`,
  background: 'white',
  color: COLORS.ink,
  padding: '15px 22px',
  borderRadius: 12,
  cursor: 'pointer',
  fontWeight: 900,
  fontSize: 15,
}

const wideOutlineButtonStyle: React.CSSProperties = {
  ...outlineButtonStyle,
  width: '100%',
  marginTop: 10,
}

const successStyle: React.CSSProperties = {
  margin: '16px 0',
  padding: '14px 16px',
  borderRadius: 14,
  background: COLORS.paleGreen,
  color: COLORS.green,
  fontWeight: 800,
}

const dashboardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 18,
  flexWrap: 'wrap',
}

const filterBarStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.3fr 1fr',
  gap: 12,
  minWidth: 420,
}

const kanbanWrapStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: 16,
  marginTop: 18,
}

const columnStyle: React.CSSProperties = {
  borderRadius: 22,
  padding: 16,
  minHeight: 250,
}

const columnByStatus: Record<RequestStatus, React.CSSProperties> = {
  new: { background: '#e9f1fb', border: '1px solid #cdddf5' },
  needs_info: { background: '#fdecec', border: '1px solid #f3c7c7' },
  estimate_ready: { background: '#ebf8ef', border: '1px solid #cce8d4' },
  pending_approval: { background: '#f7efe7', border: '1px solid #ead8c7' },
  scheduled: { background: '#f1eefb', border: '1px solid #d9d0f2' },
  completed: { background: '#edf7f3', border: '1px solid #cce7dd' },
}

const columnHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontWeight: 900,
  marginBottom: 14,
}

const countBadgeStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 999,
  padding: '4px 9px',
  fontSize: 12,
}

const columnBodyStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
}

const emptyColumnStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 16,
  background: 'rgba(255,255,255,0.8)',
  color: COLORS.muted,
}

const requestCardStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 18,
  padding: 16,
  border: `1px solid ${COLORS.border}`,
}

const fileLinkGroupStyle: React.CSSProperties = {
  marginTop: 10,
  color: COLORS.muted,
  fontSize: 14,
}

const linkButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: COLORS.green,
  padding: '4px 0',
  cursor: 'pointer',
  fontWeight: 800,
  textDecoration: 'underline',
}

const aiBoxStyle: React.CSSProperties = {
  background: COLORS.paleGreen,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 14,
  padding: 12,
  marginTop: 12,
  color: COLORS.ink,
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  zIndex: 1000,
}

const modalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 430,
  background: 'white',
  borderRadius: 22,
  padding: 24,
}