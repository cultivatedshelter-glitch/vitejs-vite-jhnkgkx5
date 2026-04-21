import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

type RequestStatus = 'new' | 'needs_info' | 'estimate_ready' | 'pending_approval'

type StoredFile = {
  name: string
  url: string
  path: string
  type: 'photo' | 'document'
}

type WorkRequest = {
  id: string
  created_at: string
  requester_name: string
  email: string
  phone: string
  property_address: string
  city: string
  state: string
  zip: string
  work_type: string
  urgency: string
  occupancy: string
  timeline: string
  description: string
  status: RequestStatus
  files: StoredFile[]
}

const ADMIN_PIN = '4242'
const BUCKET_NAME = 'job-files'

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
]

const STATUS_LABELS: Record<RequestStatus, string> = {
  new: 'New Lead',
  needs_info: 'Needs Info',
  estimate_ready: 'Estimate Ready',
  pending_approval: 'Pending Approval',
}

export default function App() {
  const [requesterName, setRequesterName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [workType, setWorkType] = useState(WORK_TYPES[0])
  const [urgency, setUrgency] = useState('Standard')
  const [occupancy, setOccupancy] = useState('Occupied')
  const [timeline, setTimeline] = useState('')
  const [description, setDescription] = useState('')

  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [documentFiles, setDocumentFiles] = useState<File[]>([])

  const [requests, setRequests] = useState<WorkRequest[]>([])
  const [filter, setFilter] = useState<'all' | RequestStatus>('all')
  const [search, setSearch] = useState('')

  const [showLogin, setShowLogin] = useState(false)
  const [adminPinInput, setAdminPinInput] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    loadRequests()
  }, [])

  async function loadRequests() {
    setIsLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('work_requests')
      .select('*')
      .order('created_at', { ascending: false })

      if (error) {
        console.error('SUPABASE LOAD ERROR:', error)
        setErrorMessage(`Supabase load error: ${error.message}`)
        setRequests([])
        setIsLoading(false)
        return
      }
    const normalized: WorkRequest[] = (data || []).map((item: any) => ({
      id: item.id,
      created_at: item.created_at,
      requester_name: item.requester_name,
      email: item.email,
      phone: item.phone ?? '',
      property_address: item.property_address,
      city: item.city ?? '',
      state: item.state ?? '',
      zip: item.zip,
      work_type: item.work_type,
      urgency: item.urgency,
      occupancy: item.occupancy,
      timeline: item.timeline ?? '',
      description: item.description,
      status: item.status as RequestStatus,
      files: Array.isArray(item.files) ? item.files : [],
    }))

    setRequests(normalized)
    setIsLoading(false)
  }

  function resetForm() {
    setRequesterName('')
    setEmail('')
    setPhone('')
    setPropertyAddress('')
    setCity('')
    setState('')
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
    const files = Array.from(e.target.files || [])
    setPhotoFiles(files)
  }

  function handleDocumentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setDocumentFiles(files)
  }

  async function uploadFiles(files: File[], kind: 'photo' | 'document') {
    const uploaded: StoredFile[] = []

    for (const file of files) {
      const safeName = file.name.replace(/\s+/g, '-')
      const filePath = `leads/${Date.now()}-${crypto.randomUUID()}-${safeName}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file)

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath)

      uploaded.push({
        name: file.name,
        url: data.publicUrl,
        path: filePath,
        type: kind,
      })
    }

    return uploaded
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuccessMessage('')
    setErrorMessage('')

    if (!requesterName || !email || !propertyAddress || !zip || !description) {
      setErrorMessage('Please fill out all required fields.')
      return
    }

    try {
      setIsSubmitting(true)

      const uploadedPhotos = await uploadFiles(photoFiles, 'photo')
      const uploadedDocuments = await uploadFiles(documentFiles, 'document')
      const allFiles = [...uploadedPhotos, ...uploadedDocuments]

      const payload = {
        requester_name: requesterName,
        email,
        phone,
        property_address: propertyAddress,
        city,
        state,
        zip,
        work_type: workType,
        urgency,
        occupancy,
        timeline,
        description,
        status: 'new',
        files: allFiles,
      }

      const { error } = await supabase.from('work_requests').insert(payload)

      if (error) {
        throw new Error(error.message)
      }

      setSuccessMessage('Work request submitted and files uploaded.')
      resetForm()
      await loadRequests()
    } catch (err: any) {
      setErrorMessage(err?.message || 'Upload failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleAdminLogin() {
    if (adminPinInput === ADMIN_PIN) {
      setIsAdmin(true)
      setShowLogin(false)
      setAdminPinInput('')
    } else {
      setErrorMessage('Wrong admin PIN')
    }
  }

  async function updateStatus(id: string, nextStatus: RequestStatus) {
    const { error } = await supabase
      .from('work_requests')
      .update({ status: nextStatus })
      .eq('id', id)

    if (error) {
      setErrorMessage('Could not update status.')
      return
    }

    setRequests((prev) =>
      prev.map((request) =>
        request.id === id ? { ...request, status: nextStatus } : request
      )
    )
  }

  function exportCsv() {
    if (requests.length === 0) {
      setErrorMessage('No requests to export.')
      return
    }

    const headers = [
      'created_at',
      'status',
      'requester_name',
      'email',
      'phone',
      'property_address',
      'city',
      'state',
      'zip',
      'work_type',
      'urgency',
      'occupancy',
      'timeline',
      'description',
      'photo_urls',
      'document_urls',
    ]

    const rows = requests.map((request) => {
      const photoUrls = request.files
        .filter((file) => file.type === 'photo')
        .map((file) => file.url)
        .join(' | ')

      const documentUrls = request.files
        .filter((file) => file.type === 'document')
        .map((file) => file.url)
        .join(' | ')

      return [
        request.created_at,
        request.status,
        request.requester_name,
        request.email,
        request.phone,
        request.property_address,
        request.city,
        request.state,
        request.zip,
        request.work_type,
        request.urgency,
        request.occupancy,
        request.timeline,
        request.description,
        photoUrls,
        documentUrls,
      ]
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',')
    })

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
        request.requester_name,
        request.email,
        request.phone,
        request.property_address,
        request.city,
        request.state,
        request.zip,
        request.work_type,
        request.description,
      ]
        .join(' ')
        .toLowerCase()

      const matchesSearch = haystack.includes(search.toLowerCase())
      return matchesFilter && matchesSearch
    })
  }, [requests, filter, search])

  const columns: RequestStatus[] = [
    'new',
    'needs_info',
    'estimate_ready',
    'pending_approval',
  ]

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div style={headerInnerStyle}>
          <div>
            <div style={eyebrowStyle}>SHELTER PREP</div>
            <h1 style={titleStyle}>Work Request Intake</h1>
            <p style={subtitleStyle}>
              Supabase version with real file uploads and admin access.
            </p>
          </div>

          <div style={headerActionsStyle}>
            {isAdmin ? (
              <>
                <button style={secondaryButtonStyle} onClick={exportCsv}>
                  Export CSV
                </button>
                <button style={primaryButtonStyle} onClick={() => setIsAdmin(false)}>
                  Log Out
                </button>
              </>
            ) : (
              <button style={primaryButtonStyle} onClick={() => setShowLogin(true)}>
                Admin Login
              </button>
            )}
          </div>
        </div>
      </header>

      <main style={mainStyle}>
        <section style={heroCardStyle}>
          <div style={heroBadgeStyle}>Property work intake</div>
          <h2 style={heroTitleStyle}>Submit a work request in one place.</h2>
          <p style={heroTextStyle}>
            Enter the property details, describe the work needed, and upload photos,
            documents, or video for admin review.
          </p>
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h3 style={sectionTitleStyle}>New Work Request</h3>
              <p style={sectionTextStyle}>Fields marked with * are required.</p>
            </div>
          </div>

          {successMessage && <div style={successStyle}>{successMessage}</div>}
          {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

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
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <input
                style={inputStyle}
                placeholder="State"
                value={state}
                onChange={(e) => setState(e.target.value)}
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
                placeholder="Preferred timeline"
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
                <label style={uploadLabelStyle}>Documents / Video</label>
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
              <button type="submit" style={primaryButtonStyle} disabled={isSubmitting}>
                {isSubmitting ? 'Uploading...' : 'Submit Request'}
              </button>
              <button type="button" style={secondaryButtonStyle} onClick={resetForm}>
                Clear Form
              </button>
            </div>
          </form>
        </section>

        {isAdmin && (
          <>
            <section style={cardStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h3 style={sectionTitleStyle}>Admin Dashboard</h3>
                  <p style={sectionTextStyle}>
                    Requests and files are loaded from Supabase.
                  </p>
                </div>
              </div>

              <div style={filterBarStyle}>
                <input
                  style={{ ...inputStyle, margin: 0 }}
                  placeholder="Search requests"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  style={{ ...inputStyle, margin: 0 }}
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
            </section>

            {isLoading ? (
              <section style={cardStyle}>
                <div style={sectionTextStyle}>Loading requests...</div>
              </section>
            ) : (
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
                          items.map((request) => {
                            const photos = request.files.filter((file) => file.type === 'photo')
                            const documents = request.files.filter(
                              (file) => file.type === 'document'
                            )

                            return (
                              <div key={request.id} style={adminCardStyle}>
                                <div style={adminAddressStyle}>{request.property_address}</div>

                                <div style={adminMetaStyle}>
                                  {request.city}
                                  {request.city && request.state ? ', ' : ''}
                                  {request.state} {request.zip}
                                </div>

                                <div style={adminMetaStyle}>
                                  {request.requester_name} • {request.email}
                                  {request.phone ? ` • ${request.phone}` : ''}
                                </div>

                                <div style={adminMetaStyle}>
                                  {request.work_type} • {request.urgency} • {request.occupancy}
                                </div>

                                <p style={adminDescriptionStyle}>{request.description}</p>

                                {photos.length > 0 && (
                                  <div style={adminFilesStyle}>
                                    <strong>Photos:</strong>
                                    <div style={thumbGridStyle}>
                                      {photos.map((file) => (
                                        <a
                                          key={file.path}
                                          href={file.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={thumbLinkStyle}
                                        >
                                          <img
                                            src={file.url}
                                            alt={file.name}
                                            style={thumbImageStyle}
                                          />
                                          <div style={fileNameStyle}>{file.name}</div>
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {documents.length > 0 && (
                                  <div style={adminFilesStyle}>
                                    <strong>Files:</strong>
                                    <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                                      {documents.map((file) => (
                                        <a
                                          key={file.path}
                                          href={file.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={fileLinkStyle}
                                        >
                                          Open {file.name}
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div style={adminMetaSmallStyle}>
                                  {new Date(request.created_at).toLocaleString()}
                                </div>

                                <select
                                  style={{ ...inputStyle, marginTop: 12, marginBottom: 0 }}
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
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </section>
            )}
          </>
        )}
      </main>

      {showLogin && (
        <div style={overlayStyle} onClick={() => setShowLogin(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#213846' }}>Admin Login</h3>
            <p style={{ color: '#6b7280', marginTop: 0 }}>Demo PIN: 4242</p>

            <input
              style={inputStyle}
              placeholder="Enter admin PIN"
              value={adminPinInput}
              onChange={(e) => setAdminPinInput(e.target.value)}
            />

            <div style={buttonRowStyle}>
              <button style={primaryButtonStyle} onClick={handleAdminLogin}>
                Sign In
              </button>
              <button style={secondaryButtonStyle} onClick={() => setShowLogin(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #f4efe6 0%, #eef3f6 58%, #f7f4ee 100%)',
  color: '#1f2a30',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const headerStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 20,
  backdropFilter: 'blur(10px)',
  background: 'rgba(255,255,255,0.72)',
  borderBottom: '1px solid rgba(31, 42, 48, 0.08)',
}

const headerInnerStyle: React.CSSProperties = {
  maxWidth: 1180,
  margin: '0 auto',
  padding: '20px 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
}

const eyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 2,
  color: '#6b7280',
  marginBottom: 6,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 30,
  color: '#4c3b2f',
}

const subtitleStyle: React.CSSProperties = {
  margin: '8px 0 0 0',
  color: '#6b7280',
}

const headerActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
}

const mainStyle: React.CSSProperties = {
  maxWidth: 1180,
  margin: '0 auto',
  padding: '28px 24px 56px',
}

const heroCardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #345a73 0%, #213846 100%)',
  color: 'white',
  borderRadius: 24,
  padding: 32,
  boxShadow: '0 20px 60px rgba(33, 56, 70, 0.25)',
  marginBottom: 22,
}

const heroBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '8px 12px',
  background: 'rgba(255,255,255,0.12)',
  borderRadius: 999,
  fontSize: 12,
  marginBottom: 16,
}

const heroTitleStyle: React.CSSProperties = {
  margin: '0 0 12px 0',
  fontSize: 40,
  lineHeight: 1.05,
}

const heroTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  lineHeight: 1.6,
  color: 'rgba(255,255,255,0.88)',
  maxWidth: 760,
}

const cardStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 24,
  padding: 24,
  border: '1px solid rgba(31, 42, 48, 0.08)',
  boxShadow: '0 16px 40px rgba(31, 42, 48, 0.08)',
  marginBottom: 22,
}

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  marginBottom: 16,
}

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  color: '#4c3b2f',
}

const sectionTextStyle: React.CSSProperties = {
  margin: '8px 0 0 0',
  color: '#6b7280',
}

const successStyle: React.CSSProperties = {
  marginBottom: 18,
  padding: '14px 16px',
  borderRadius: 14,
  background: '#e8f7ec',
  color: '#1f6b3a',
  fontWeight: 700,
}

const errorStyle: React.CSSProperties = {
  marginBottom: 18,
  padding: '14px 16px',
  borderRadius: 14,
  background: '#fdecec',
  color: '#a12626',
  fontWeight: 700,
}

const grid2Style: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 12,
  marginBottom: 12,
}

const grid3Style: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
  marginBottom: 12,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid rgba(31, 42, 48, 0.12)',
  background: '#fafafa',
  color: '#1f2a30',
  fontSize: 14,
  outline: 'none',
  marginBottom: 12,
  boxSizing: 'border-box',
}

const uploadBoxStyle: React.CSSProperties = {
  border: '1px solid rgba(31, 42, 48, 0.12)',
  borderRadius: 16,
  background: '#fafafa',
  padding: 16,
}

const uploadLabelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 700,
  marginBottom: 8,
  color: '#4c3b2f',
}

const fileTextStyle: React.CSSProperties = {
  marginTop: 10,
  fontSize: 12,
  color: '#6b7280',
  lineHeight: 1.5,
}

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 8,
}

const primaryButtonStyle: React.CSSProperties = {
  border: 'none',
  background: '#4c3b2f',
  color: 'white',
  padding: '12px 16px',
  borderRadius: 999,
  cursor: 'pointer',
  fontWeight: 700,
}

const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(31, 42, 48, 0.12)',
  background: 'white',
  color: '#213846',
  padding: '12px 16px',
  borderRadius: 999,
  cursor: 'pointer',
  fontWeight: 700,
}

const filterBarStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '2fr 1fr',
  gap: 12,
}

const kanbanWrapStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: 16,
}

const columnStyle: React.CSSProperties = {
  borderRadius: 22,
  padding: 16,
  minHeight: 240,
}

const columnByStatus: Record<RequestStatus, React.CSSProperties> = {
  new: {
    background: '#e9f1fb',
    border: '1px solid #cdddf5',
  },
  needs_info: {
    background: '#fdecec',
    border: '1px solid #f3c7c7',
  },
  estimate_ready: {
    background: '#ebf8ef',
    border: '1px solid #cce8d4',
  },
  pending_approval: {
    background: '#f7efe7',
    border: '1px solid #ead8c7',
  },
}

const columnHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 14,
  fontWeight: 800,
  color: '#213846',
}

const countBadgeStyle: React.CSSProperties = {
  minWidth: 28,
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.9)',
  fontSize: 12,
}

const columnBodyStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
}

const emptyColumnStyle: React.CSSProperties = {
  borderRadius: 16,
  padding: 16,
  background: 'rgba(255,255,255,0.8)',
  color: '#6b7280',
  fontSize: 14,
}

const adminCardStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 18,
  padding: 16,
  boxShadow: '0 10px 24px rgba(31, 42, 48, 0.07)',
  border: '1px solid rgba(31, 42, 48, 0.06)',
}

const adminAddressStyle: React.CSSProperties = {
  fontWeight: 800,
  color: '#213846',
  marginBottom: 4,
}

const adminMetaStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#5f6b75',
  lineHeight: 1.5,
  marginBottom: 6,
}

const adminMetaSmallStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#80909c',
  marginTop: 8,
}

const adminDescriptionStyle: React.CSSProperties = {
  margin: '8px 0',
  color: '#1f2a30',
  lineHeight: 1.55,
}

const adminFilesStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#4c5963',
  marginTop: 8,
  lineHeight: 1.45,
}

const thumbGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
  gap: 10,
  marginTop: 10,
}

const thumbLinkStyle: React.CSSProperties = {
  textDecoration: 'none',
  color: '#213846',
  display: 'block',
}

const thumbImageStyle: React.CSSProperties = {
  width: '100%',
  height: 90,
  objectFit: 'cover',
  borderRadius: 10,
  border: '1px solid rgba(31, 42, 48, 0.08)',
  display: 'block',
}

const fileNameStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  wordBreak: 'break-word',
}

const fileLinkStyle: React.CSSProperties = {
  color: '#1d4f91',
  textDecoration: 'underline',
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
  maxWidth: 420,
  background: 'white',
  borderRadius: 20,
  padding: 24,
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
}