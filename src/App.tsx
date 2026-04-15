import React, { useState } from 'react'

type RequestStatus = 'new' | 'review' | 'scheduled' | 'done'

type WorkRequest = {
  id: string
  name: string
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
  photos: string[]
  videos: string[]
  status: RequestStatus
  createdAt: string
}

function readRequests(): WorkRequest[] {
  try {
    const raw = localStorage.getItem('shelter-prep-requests')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRequests(requests: WorkRequest[]) {
  localStorage.setItem('shelter-prep-requests', JSON.stringify(requests))
}

export default function App() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [workType, setWorkType] = useState('General Repair')
  const [urgency, setUrgency] = useState('Standard')
  const [occupancy, setOccupancy] = useState('Occupied')
  const [timeline, setTimeline] = useState('')
  const [description, setDescription] = useState('')
  const [photoNames, setPhotoNames] = useState<string[]>([])
  const [videoNames, setVideoNames] = useState<string[]>([])
  const [successMessage, setSuccessMessage] = useState('')

  const [showLogin, setShowLogin] = useState(false)
  const [adminPin, setAdminPin] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [requests, setRequests] = useState<WorkRequest[]>(() => readRequests())

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setPhotoNames(files.map((file) => file.name))
  }

  function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setVideoNames(files.map((file) => file.name))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name || !email || !propertyAddress || !zip || !description) {
      alert('Please fill out the required fields.')
      return
    }

    const newRequest: WorkRequest = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      email,
      phone,
      propertyAddress,
      city,
      state,
      zip,
      workType,
      urgency,
      occupancy,
      timeline,
      description,
      photos: photoNames,
      videos: videoNames,
      status: 'new',
      createdAt: new Date().toLocaleString(),
    }

    const updated = [newRequest, ...requests]
    setRequests(updated)
    saveRequests(updated)

    setSuccessMessage('Work request submitted.')

    setName('')
    setEmail('')
    setPhone('')
    setPropertyAddress('')
    setCity('')
    setState('')
    setZip('')
    setWorkType('General Repair')
    setUrgency('Standard')
    setOccupancy('Occupied')
    setTimeline('')
    setDescription('')
    setPhotoNames([])
    setVideoNames([])
  }

  function handleAdminLogin() {
    if (adminPin.trim() === '2750') {
      setIsAdmin(true)
      setShowLogin(false)
      setAdminPin('')
      alert('Admin logged in')
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      }, 100)
    } else {
      alert('Wrong PIN')
    }
  }

  function updateStatus(id: string, status: RequestStatus) {
    const updated = requests.map((request) =>
      request.id === id ? { ...request, status } : request
    )
    setRequests(updated)
    saveRequests(updated)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f4efe6 0%, #eef3f6 55%, #f7f4ee 100%)',
        color: '#1f2a30',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <header
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(31, 42, 48, 0.08)',
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(8px)',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: 980,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: 12, letterSpacing: 2, color: '#6b7280' }}>
              SHELTER PREP
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#4c3b2f' }}>
              Work Request Intake
            </div>
          </div>

          <button style={primaryButtonStyle} onClick={() => setShowLogin(true)}>
            Admin Login
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 980, margin: '0 auto', padding: '40px 24px 56px' }}>
        <section
          style={{
            background: 'linear-gradient(135deg, #345a73 0%, #213846 100%)',
            color: 'white',
            borderRadius: 24,
            padding: 32,
            boxShadow: '0 20px 60px rgba(33, 56, 70, 0.25)',
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: 'inline-block',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.12)',
              borderRadius: 999,
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            Simple property work intake
          </div>

          <h1 style={{ fontSize: 42, lineHeight: 1.05, margin: '0 0 14px 0' }}>
            Submit a work request.
          </h1>

          <p
            style={{
              fontSize: 18,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.88)',
              maxWidth: 720,
              margin: 0,
            }}
          >
            Enter property details, describe the work needed, and attach photos or video.
          </p>
        </section>

        <section
          style={{
            background: 'white',
            borderRadius: 24,
            padding: 24,
            border: '1px solid rgba(31, 42, 48, 0.08)',
            boxShadow: '0 16px 40px rgba(31, 42, 48, 0.08)',
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ margin: 0, fontSize: 30, color: '#4c3b2f' }}>
              New Work Request
            </h2>
            <p style={{ margin: '8px 0 0 0', color: '#6b7280' }}>
              Fill out the form below to send a request.
            </p>
          </div>

          {successMessage && (
            <div
              style={{
                marginBottom: 18,
                padding: '14px 16px',
                borderRadius: 14,
                background: '#e8f7ec',
                color: '#1f6b3a',
                fontWeight: 700,
              }}
            >
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={grid2Style}>
              <input
                placeholder="Your name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
              <input
                placeholder="Your email *"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={grid2Style}>
              <input
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
              />
              <select
                value={workType}
                onChange={(e) => setWorkType(e.target.value)}
                style={inputStyle}
              >
                <option>General Repair</option>
                <option>Painting</option>
                <option>Roofing</option>
                <option>Electrical</option>
                <option>Plumbing</option>
                <option>Cleaning</option>
                <option>Landscaping</option>
                <option>Inspection Repairs</option>
                <option>Turnover Work</option>
              </select>
            </div>

            <input
              placeholder="Property address *"
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              style={inputStyle}
            />

            <div style={grid3Style}>
              <input
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={inputStyle}
              />
              <input
                placeholder="State"
                value={state}
                onChange={(e) => setState(e.target.value)}
                style={inputStyle}
              />
              <input
                placeholder="ZIP code *"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={grid3Style}>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                style={inputStyle}
              >
                <option>Standard</option>
                <option>Urgent</option>
                <option>ASAP</option>
              </select>

              <select
                value={occupancy}
                onChange={(e) => setOccupancy(e.target.value)}
                style={inputStyle}
              >
                <option>Occupied</option>
                <option>Vacant</option>
                <option>Unknown</option>
              </select>

              <input
                placeholder="Preferred timeline"
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                style={inputStyle}
              />
            </div>

            <textarea
              placeholder="Describe the work needed *"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ ...inputStyle, minHeight: 140, resize: 'vertical' }}
            />

            <div style={uploadRowStyle}>
              <div style={uploadBoxStyle}>
                <label style={uploadLabelStyle}>Photos</label>
                <input type="file" accept="image/*" multiple onChange={handlePhotoChange} />
                {photoNames.length > 0 && (
                  <div style={fileListStyle}>{photoNames.join(', ')}</div>
                )}
              </div>

              <div style={uploadBoxStyle}>
                <label style={uploadLabelStyle}>Video</label>
                <input type="file" accept="video/*" multiple onChange={handleVideoChange} />
                {videoNames.length > 0 && (
                  <div style={fileListStyle}>{videoNames.join(', ')}</div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
              <button type="submit" style={primaryButtonStyle}>
                Submit Request
              </button>

              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() => {
                  setName('')
                  setEmail('')
                  setPhone('')
                  setPropertyAddress('')
                  setCity('')
                  setState('')
                  setZip('')
                  setWorkType('General Repair')
                  setUrgency('Standard')
                  setOccupancy('Occupied')
                  setTimeline('')
                  setDescription('')
                  setPhotoNames([])
                  setVideoNames([])
                  setSuccessMessage('')
                }}
              >
                Clear Form
              </button>
            </div>
          </form>
        </section>

        {isAdmin && (
          <section
            style={{
              marginTop: 24,
              background: '#111318',
              color: 'white',
              borderRadius: 24,
              padding: 24,
              boxShadow: '0 18px 40px rgba(17, 19, 24, 0.18)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 18,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 28 }}>Admin Requests</h2>
                <p style={{ margin: '8px 0 0 0', color: 'rgba(255,255,255,0.7)' }}>
                  Stored in browser local storage for this MVP.
                </p>
              </div>

              <button style={secondaryLightButtonStyle} onClick={() => setIsAdmin(false)}>
                Log Out
              </button>
            </div>

            {requests.length === 0 ? (
              <div style={emptyAdminCardStyle}>No requests yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {requests.map((request) => (
                  <div key={request.id} style={adminCardStyle}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                        alignItems: 'start',
                      }}
                    >
                      <div>
                        <p style={adminTitleStyle}>{request.propertyAddress}</p>
                        <p style={adminMetaStyle}>
                          {request.name} • {request.email} {request.phone ? `• ${request.phone}` : ''}
                        </p>
                        <p style={adminMetaStyle}>
                          {request.workType} • {request.urgency} • {request.occupancy}
                        </p>
                        <p style={adminMetaStyle}>{request.city} {request.state} {request.zip}</p>
                        <p style={adminDescriptionStyle}>{request.description}</p>
                        <p style={adminTimeStyle}>{request.createdAt}</p>
                        {request.photos.length > 0 && (
                          <p style={adminMetaStyle}>Photos: {request.photos.join(', ')}</p>
                        )}
                        {request.videos.length > 0 && (
                          <p style={adminMetaStyle}>Videos: {request.videos.join(', ')}</p>
                        )}
                      </div>

                      <select
                        value={request.status}
                        onChange={(e) =>
                          updateStatus(request.id, e.target.value as RequestStatus)
                        }
                        style={adminSelectStyle}
                      >
                        <option value="new">New</option>
                        <option value="review">In Review</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {showLogin && (
        <div
          onClick={() => setShowLogin(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'white',
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ marginTop: 0, color: '#213846' }}>Admin Login</h3>
            <p style={{ color: '#6b7280' }}>Demo PIN: 4242</p>

            <input
              placeholder="Enter admin PIN"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              style={inputStyle}
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
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

const grid2Style: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  marginBottom: 12,
}

const grid3Style: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 12,
  marginBottom: 12,
}

const uploadRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  marginTop: 12,
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

const fileListStyle: React.CSSProperties = {
  marginTop: 10,
  fontSize: 12,
  color: '#6b7280',
  lineHeight: 1.5,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid rgba(31, 42, 48, 0.12)',
  background: '#fafafa',
  fontSize: 14,
  outline: 'none',
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

const secondaryLightButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'transparent',
  color: 'white',
  padding: '12px 16px',
  borderRadius: 999,
  cursor: 'pointer',
  fontWeight: 700,
}

const emptyAdminCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: 16,
}

const adminCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: 16,
}

const adminTitleStyle: React.CSSProperties = {
  margin: '0 0 8px 0',
  fontWeight: 800,
  color: 'white',
}

const adminMetaStyle: React.CSSProperties = {
  margin: '0 0 6px 0',
  fontSize: 13,
  color: 'rgba(255,255,255,0.78)',
}

const adminDescriptionStyle: React.CSSProperties = {
  margin: '8px 0',
  lineHeight: 1.5,
  color: 'white',
}

const adminTimeStyle: React.CSSProperties = {
  margin: '8px 0 0 0',
  fontSize: 12,
  color: 'rgba(255,255,255,0.65)',
}

const adminSelectStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.12)',
  background: '#1d2430',
  color: 'white',
  fontWeight: 700,
}