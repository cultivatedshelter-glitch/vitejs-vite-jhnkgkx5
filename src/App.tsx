import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import AiEstimator from './components/AiEstimator'
import type { AiEstimateRequest } from './types/shelterprep-ai'

type RequestStatus =
  | 'new'
  | 'needs_info'
  | 'estimate_ready'
  | 'pending_approval'
  | 'completed'

type Tab = 'request' | 'dashboard' | 'estimates' | 'ai' | 'projects'

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

type ProjectSample = {
  id: string
  title: string
  location: string
  workType: string
  summary: string
  turnaround: string
  tags: string[]
  beforeUrl?: string
  afterUrl?: string
}

type NotificationPayload = {
  event: 'new_request' | 'status_changed'
  request: WorkRequest
  oldStatus?: RequestStatus
  newStatus?: RequestStatus
  adminPreferences: {
    emailAlerts: boolean
    adminAlerts: boolean
  }
  clientPreferences: {
    emailUpdates: boolean
  }
}

const SETTINGS_KEY = 'shelter-prep-settings-v5'
const PROJECTS_KEY = 'shelter-prep-projects-v1'
const ADMIN_PIN = '2750'
const STORAGE_BUCKET = 'request-files'
const NOTIFICATION_FUNCTION = 'send-notification'

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

const STATUS_ORDER: RequestStatus[] = [
  'new',
  'estimate_ready',
  'pending_approval',
  'completed',
  'needs_info',
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
  completed: {
    label: 'Completed',
    pillBg: '#e6f4ef',
    cardBg: '#f2fbf7',
    border: '#b7dfcf',
  },
}

const initialEstimateItems: EstimateItem[] = [
  { id: crypto.randomUUID(), label: 'Labor', qty: 1, unitCost: 250 },
  { id: crypto.randomUUID(), label: 'Materials', qty: 1, unitCost: 150 },
]

const DEFAULT_PROJECTS: ProjectSample[] = [
  {
    id: '1',
    title: 'Pre-Listing Refresh',
    location: 'Lake Oswego',
    workType: 'Paint, punch list, cleanup',
    summary:
      'Quick cosmetic refresh to help a listing show clean, bright, and move-in ready before photos and open house.',
    turnaround: '5 days',
    tags: ['Before & After', 'Listing Prep', 'Fast Turnaround'],
    beforeUrl: '',
    afterUrl: '',
  },
  {
    id: '2',
    title: 'Turnover Repair Package',
    location: 'Portland',
    workType: 'Drywall, flooring, deep clean',
    summary:
      'Vacant unit turnover completed with patching, flooring touch-ups, cleaning, and final walk-through photos.',
    turnaround: '4 days',
    tags: ['Turnover Work', 'Property Management', 'Vacant Unit'],
    beforeUrl: '',
    afterUrl: '',
  },
  {
    id: '3',
    title: 'Inspection Repair Closeout',
    location: 'Beaverton',
    workType: 'Electrical, plumbing, safety fixes',
    summary:
      'Handled inspection items quickly with clear scope notes, photo proof, and final status updates for the agent.',
    turnaround: '3 days',
    tags: ['Inspection Repairs', 'Agent Friendly', 'Clear Updates'],
    beforeUrl: '',
    afterUrl: '',
  },
  {
    id: '4',
    title: 'Curb Appeal Upgrade',
    location: 'West Linn',
    workType: 'Exterior paint, landscape cleanup',
    summary:
      'Exterior refresh focused on first impression with front entry touch-ups, cleanup, and listing-ready presentation.',
    turnaround: '1 week',
    tags: ['Exterior', 'Curb Appeal', 'Seller Ready'],
    beforeUrl: '',
    afterUrl: '',
  },
]

function loadSavedProjects() {
  try {
    const saved = localStorage.getItem(PROJECTS_KEY)
    return saved ? (JSON.parse(saved) as ProjectSample[]) : DEFAULT_PROJECTS
  } catch {
    return DEFAULT_PROJECTS
  }
}

function normalizeStoredFiles(value: unknown, type: 'photo' | 'document'): StoredFile[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return {
          name: item,
          path: item,
          url: item.startsWith('http') ? item : '',
          type,
        } as StoredFile
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
              : type,
        } as StoredFile
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
    phone: row.phone || '',
    workType: row.work_type ?? '',
    propertyAddress: row.property_address ?? '',
    city: row.city ?? '',
    state: row.state ?? '',
    zip: row.zip ?? '',
    urgency: row.urgency ?? 'Standard',
    occupancy: row.occupancy ?? 'Occupied',
    timeline: row.timeline || '',
    description: row.description ?? '',
    photos: normalizeStoredFiles(row.photos, 'photo'),
    documents: normalizeStoredFiles(row.documents, 'document'),
    status: row.status ?? 'new',
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

function ProjectCard({ project }: { project: ProjectSample }) {
  return (
    <div style={styles.projectCard}>
      <div style={styles.projectImageGrid}>
        <div
          style={{
            ...styles.projectImageBox,
            ...(project.beforeUrl
              ? {
                  backgroundImage: `url(${project.beforeUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : {}),
          }}
        >
          {!project.beforeUrl ? <span style={styles.projectImageLabel}>BEFORE</span> : null}
        </div>

        <div
          style={{
            ...styles.projectImageBox,
            ...(project.afterUrl
              ? {
                  backgroundImage: `url(${project.afterUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : {}),
          }}
        >
          {!project.afterUrl ? <span style={styles.projectImageLabel}>AFTER</span> : null}
        </div>
      </div>

      <div style={styles.projectCardBody}>
        <div style={styles.projectTitle}>{project.title || 'Untitled Project'}</div>

        <div style={styles.projectMeta}>
          {project.location || 'Location'} • {project.workType || 'Work type'} •{' '}
          {project.turnaround || 'Timeline'}
        </div>

        <p style={styles.projectSummary}>
          {project.summary || 'Add a short description for this project.'}
        </p>

        <div style={styles.tagWrap}>
          {project.tags.map((tag) => (
            <span key={tag} style={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('request')
  const [aiInitialForm, setAiInitialForm] = useState<Partial<AiEstimateRequest> | undefined>(undefined)
  const [showLogin, setShowLogin] = useState(false)
  const [adminPinInput, setAdminPinInput] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  const [emailAlerts, setEmailAlerts] = useState(true)
  const [adminAlerts, setAdminAlerts] = useState(true)
  const [clientEmailUpdates, setClientEmailUpdates] = useState(true)

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

  const [galleryProjects, setGalleryProjects] = useState<ProjectSample[]>(loadSavedProjects)
  const [editingProject, setEditingProject] = useState<ProjectSample | null>(null)

  useEffect(() => {
    const rawSettings = localStorage.getItem(SETTINGS_KEY)
    if (!rawSettings) return

    try {
      const parsed = JSON.parse(rawSettings)
      setEmailAlerts(Boolean(parsed.emailAlerts))
      setAdminAlerts(Boolean(parsed.adminAlerts))
    } catch {
      // Ignore bad saved settings.
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ emailAlerts, adminAlerts }))
  }, [emailAlerts, adminAlerts])

  useEffect(() => {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(galleryProjects))
  }, [galleryProjects])

  useEffect(() => {
    if (!isAdmin) {
      setEditingProject(null)
    }
  }, [isAdmin])

  useEffect(() => {
    loadRequests()
  }, [])

  async function sendNotification(payload: NotificationPayload) {
    try {
      const { error } = await supabase.functions.invoke(NOTIFICATION_FUNCTION, {
        body: payload,
      })

      if (error) {
        console.warn('EMAIL NOTIFICATION ERROR:', error.message)
      }
    } catch (error) {
      console.warn('EMAIL NOTIFICATION FUNCTION NOT READY:', error)
    }
  }

  async function loadRequests() {
    setLoadingRequests(true)

    try {
      const { data, error } = await supabase
        .from('work_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`load failed: ${error.message}`)
      }

      setRequests((data ?? []).map((row) => mapDbRowToRequest(row as DbLeadRow)))
    } catch (error: any) {
      console.error('LOAD REQUESTS ERROR:', error)
      alert(error?.message || JSON.stringify(error))
    } finally {
      setLoadingRequests(false)
    }
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
    setClientEmailUpdates(true)
  }

  async function uploadFiles(files: File[], category: 'photo' | 'document') {
    const uploaded: StoredFile[] = []

    for (const file of files) {
      const safeName = `${Date.now()}-${crypto.randomUUID()}-${file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        '-'
      )}`

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

      const savedRequest = mapDbRowToRequest(data as DbLeadRow)

      setRequests((prev) => [savedRequest, ...prev])
      setSuccessMessage(
        'Work request submitted successfully. You will receive email updates as the status changes.'
      )

      await sendNotification({
        event: 'new_request',
        request: savedRequest,
        newStatus: 'new',
        adminPreferences: {
          emailAlerts,
          adminAlerts,
        },
        clientPreferences: {
          emailUpdates: clientEmailUpdates,
        },
      })

      resetForm()
    } catch (error: any) {
      console.error('SUBMIT ERROR:', error)
      alert(error?.message || JSON.stringify(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function updateStatus(id: string, status: RequestStatus) {
    if (!isAdmin) {
      alert('Admin login required to update request status.')
      return
    }

    const previousRequests = requests
    const oldRequest = requests.find((r) => r.id === id)
    const oldStatus = oldRequest?.status

    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))

    const { error } = await supabase.from('work_requests').update({ status }).eq('id', id)

    if (error) {
      console.error(error)
      setRequests(previousRequests)
      alert(`Could not update status: ${error.message}`)
      return
    }

    if (oldRequest) {
      const updatedRequest: WorkRequest = {
        ...oldRequest,
        status,
      }

      await sendNotification({
        event: 'status_changed',
        request: updatedRequest,
        oldStatus,
        newStatus: status,
        adminPreferences: {
          emailAlerts,
          adminAlerts,
        },
        clientPreferences: {
          emailUpdates: true,
        },
      })
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
      needs_info: filteredRequests.filter((r) => r.status === 'needs_info'),
      estimate_ready: filteredRequests.filter((r) => r.status === 'estimate_ready'),
      pending_approval: filteredRequests.filter((r) => r.status === 'pending_approval'),
      completed: filteredRequests.filter((r) => r.status === 'completed'),
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
    setEstimateItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
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
            <td style="padding:8px;border:1px solid #d7ddd8;text-align:right;">$${item.unitCost.toFixed(
              2
            )}</td>
            <td style="padding:8px;border:1px solid #d7ddd8;text-align:right;">$${(
              item.qty * item.unitCost
            ).toFixed(2)}</td>
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
          <p style="margin-top:0;color:#52606b;">
            ${estimateClient || 'Client'}${estimateProperty ? ` • ${estimateProperty}` : ''}
          </p>

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
            <p>Discount (${estimateDiscount}%): <strong>-$${discountAmount.toFixed(
              2
            )}</strong></p>
            <p style="font-size:20px;">Total: <strong>$${total.toFixed(2)}</strong></p>
          </div>

          <script>window.print()</script>
        </body>
      </html>
    `)

    printWindow.document.close()
  }


  function buildAiFormFromRequest(request: WorkRequest): Partial<AiEstimateRequest> {
    return {
      sourceRequestId: request.id,
      requesterName: request.requesterName,
      requesterEmail: request.email,
      requesterPhone: request.phone,
      propertyAddress: `${request.propertyAddress}, ${request.city}, ${request.state} ${request.zip}`,
      zipCode: request.zip,
      requesterType: 'unknown',
      requestType: request.workType,
      description: request.description,
      timeline: request.timeline,
      notes: `Urgency: ${request.urgency}. Occupancy: ${request.occupancy}. Status: ${STATUS_META[request.status].label}.`,
      photosDescription: request.photos.length
        ? `Attached photos/videos: ${request.photos.map((file) => file.name).join(', ')}`
        : '',
      photos: request.photos.map((file) => ({
        name: file.name,
        url: file.url,
        path: file.path,
        type: file.type,
      })),
      documents: request.documents.map((file) => ({
        name: file.name,
        url: file.url,
        path: file.path,
        type: file.type,
      })),
    }
  }

  function openAiEstimatorFromRequest(request: WorkRequest) {
    setAiInitialForm(buildAiFormFromRequest(request))
    setActiveTab('ai')
  }

  function renderFiles(files: StoredFile[], label: string) {
    if (!files.length) return null

    return (
      <div style={styles.fileSection}>
        <strong>{label}:</strong>

        <div style={styles.linkList}>
          {files.map((file) =>
            file.url ? (
              <a
                key={file.path}
                href={file.url}
                target="_blank"
                rel="noreferrer"
                style={styles.fileLink}
              >
                {file.name}
              </a>
            ) : (
              <div key={file.path} style={styles.smallText}>
                {file.name} (old entry with no saved URL)
              </div>
            )
          )}
        </div>
      </div>
    )
  }

  function renderRequestTab() {
    return (
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

                {photoFiles.length ? (
                  <div style={styles.fileList}>{photoFiles.map((f) => f.name).join(', ')}</div>
                ) : null}
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

                {documentFiles.length ? (
                  <div style={styles.fileList}>{documentFiles.map((f) => f.name).join(', ')}</div>
                ) : null}
              </label>
            </div>

            <section style={styles.noticeBox}>
              <h3 style={styles.noticeTitle}>Client Email Notifications</h3>
              <p style={styles.noticeText}>
                Choose whether you want to receive email updates when your request status changes
                or when the work is marked complete.
              </p>

              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={clientEmailUpdates}
                  onChange={(e) => setClientEmailUpdates(e.target.checked)}
                />
                <span>Email me status and completion updates</span>
              </label>
            </section>

            <div style={styles.formFooter}>
              <button type="submit" style={styles.primarySubmit} disabled={submitting}>
                {submitting ? 'Uploading...' : 'Submit Work Request'}
              </button>

              <button type="button" style={styles.secondaryBtn} onClick={resetForm}>
                Clear Form
              </button>
            </div>
          </form>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.sectionTitle}>Featured Projects</h2>
              <p style={styles.sectionText}>
                Add your best before/after examples here to build trust with clients.
              </p>
            </div>

            <button
              type="button"
              style={styles.secondaryBtn}
              onClick={() => setActiveTab('projects')}
            >
              View Full Gallery
            </button>
          </div>

          <div style={styles.galleryGrid}>
            {galleryProjects.slice(0, 2).map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      </>
    )
  }

  function renderDashboardTab() {
    return (
      <section style={styles.card}>
        <div style={styles.sectionHead}>
          <div>
            <h2 style={styles.sectionTitle}>Admin Dashboard</h2>
            <p style={styles.sectionText}>
              Track every job across new leads, estimate-ready work, approvals, completion, and
              follow-up.
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
            {STATUS_ORDER.map((status) => (
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

                  <span
                    style={{
                      ...styles.countPill,
                      background: STATUS_META[status].pillBg,
                    }}
                  >
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

                        <button
                          type="button"
                          style={{ ...styles.secondaryBtn, width: '100%', marginTop: 10 }}
                          onClick={() => openAiEstimatorFromRequest(request)}
                        >
                          AI Estimate This Lead
                        </button>

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
                          <option value="completed">Completed</option>
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
    )
  }

  function renderEstimatesTab() {
    return (
      <section style={styles.card}>
        <div style={styles.sectionHead}>
          <div>
            <h2 style={styles.sectionTitle}>Estimate Builder</h2>
            <p style={styles.sectionText}>
              Add line items, taxes, and discounts, then print a clean estimate.
            </p>
          </div>
        </div>

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
          <div>
            Subtotal: <strong>${subtotal.toFixed(2)}</strong>
          </div>

          <div>
            Tax: <strong>${taxAmount.toFixed(2)}</strong>
          </div>

          <div>
            Discount: <strong>-${discountAmount.toFixed(2)}</strong>
          </div>

          <div style={styles.totalLine}>
            Total: <strong>${total.toFixed(2)}</strong>
          </div>
        </div>

        <div style={styles.formFooter}>
          <button type="button" style={styles.secondaryBtn} onClick={addEstimateItem}>
            Add Line Item
          </button>

          <button type="button" style={styles.primarySubmit} onClick={openPrintableEstimate}>
            Print Estimate
          </button>
        </div>
      </section>
    )
  }


  function renderAiTab() {
    return (
      <section style={styles.card}>
        <div style={styles.sectionHead}>
          <div>
            <h2 style={styles.sectionTitle}>AI Estimator</h2>
            <p style={styles.sectionText}>
              Generate preliminary pricing tiers, missing information, assumptions, exclusions,
              risks, schedule notes, and a client-ready message.
            </p>
          </div>
        </div>

        <AiEstimator initialForm={aiInitialForm} />
      </section>
    )
  }

  function renderProjectsTab() {
    const blankProject: ProjectSample = {
      id: crypto.randomUUID(),
      title: '',
      location: '',
      workType: '',
      summary: '',
      turnaround: '',
      tags: [],
      beforeUrl: '',
      afterUrl: '',
    }

    function saveGalleryProject(project: ProjectSample) {
      if (!isAdmin) {
        alert('Admin login required to edit the gallery.')
        return
      }

      setGalleryProjects((current) => {
        const exists = current.some((item) => item.id === project.id)

        if (exists) {
          return current.map((item) => (item.id === project.id ? project : item))
        }

        return [project, ...current]
      })

      setEditingProject(null)
    }

    function deleteGalleryProject(id: string) {
      if (!isAdmin) {
        alert('Admin login required to delete gallery projects.')
        return
      }

      const confirmDelete = window.confirm('Delete this project from the gallery?')
      if (!confirmDelete) return

      setGalleryProjects((current) => current.filter((item) => item.id !== id))
    }

    function resetGalleryProjects() {
      if (!isAdmin) {
        alert('Admin login required to reset the gallery.')
        return
      }

      const confirmReset = window.confirm('Reset gallery back to the original sample projects?')
      if (!confirmReset) return

      setGalleryProjects(DEFAULT_PROJECTS)
      setEditingProject(null)
    }

    return (
      <section style={styles.card}>
        <div style={styles.sectionHead}>
          <div>
            <h2 style={styles.sectionTitle}>Projects Gallery</h2>
            <p style={styles.sectionText}>
              Showcase finished work, before/after examples, and the kinds of projects you handle best.
            </p>
          </div>

          {isAdmin ? (
            <div style={styles.formFooterNoMargin}>
              <button
                type="button"
                style={styles.primaryBtn}
                onClick={() => setEditingProject(blankProject)}
              >
                Add Project
              </button>

              <button type="button" style={styles.secondaryBtn} onClick={resetGalleryProjects}>
                Reset Samples
              </button>
            </div>
          ) : (
            <div style={styles.locked}>Admin login required to edit gallery</div>
          )}
        </div>

        {isAdmin && editingProject ? (
          <div style={styles.galleryEditor}>
            <h3 style={{ marginTop: 0 }}>
              {galleryProjects.some((p) => p.id === editingProject.id)
                ? 'Edit Project'
                : 'Add New Project'}
            </h3>

            <div style={styles.grid2}>
              <input
                style={styles.input}
                placeholder="Project title"
                value={editingProject.title}
                onChange={(e) =>
                  setEditingProject({ ...editingProject, title: e.target.value })
                }
              />

              <input
                style={styles.input}
                placeholder="Location"
                value={editingProject.location}
                onChange={(e) =>
                  setEditingProject({ ...editingProject, location: e.target.value })
                }
              />
            </div>

            <div style={styles.grid2}>
              <input
                style={styles.input}
                placeholder="Work type"
                value={editingProject.workType}
                onChange={(e) =>
                  setEditingProject({ ...editingProject, workType: e.target.value })
                }
              />

              <input
                style={styles.input}
                placeholder="Turnaround, example: 5 days"
                value={editingProject.turnaround}
                onChange={(e) =>
                  setEditingProject({ ...editingProject, turnaround: e.target.value })
                }
              />
            </div>

            <textarea
              style={{ ...styles.input, minHeight: 100, resize: 'vertical' }}
              placeholder="Project summary"
              value={editingProject.summary}
              onChange={(e) =>
                setEditingProject({ ...editingProject, summary: e.target.value })
              }
            />

            <div style={styles.grid2}>
              <input
                style={styles.input}
                placeholder="Before image URL"
                value={editingProject.beforeUrl || ''}
                onChange={(e) =>
                  setEditingProject({ ...editingProject, beforeUrl: e.target.value })
                }
              />

              <input
                style={styles.input}
                placeholder="After image URL"
                value={editingProject.afterUrl || ''}
                onChange={(e) =>
                  setEditingProject({ ...editingProject, afterUrl: e.target.value })
                }
              />
            </div>

            <input
              style={styles.input}
              placeholder="Tags separated by commas, example: Before & After, Listing Prep"
              value={editingProject.tags.join(', ')}
              onChange={(e) =>
                setEditingProject({
                  ...editingProject,
                  tags: e.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
            />

            <div style={styles.formFooter}>
              <button
                type="button"
                style={styles.primaryBtn}
                onClick={() => saveGalleryProject(editingProject)}
              >
                Save Project
              </button>

              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => setEditingProject(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div style={styles.galleryGrid}>
          {galleryProjects.map((project) => (
            <div key={project.id}>
              <ProjectCard project={project} />

              {isAdmin ? (
                <div style={styles.projectActions}>
                  <button
                    type="button"
                    style={styles.secondaryBtn}
                    onClick={() => setEditingProject(project)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    style={styles.dangerBtn}
                    onClick={() => deleteGalleryProject(project.id)}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {!galleryProjects.length ? (
          <div style={styles.emptyState}>
            No projects yet. Admin login is required to add a project.
          </div>
        ) : null}
      </section>
    )
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
          {navButton('ai', 'AI Estimator')}
          {navButton('projects', 'Projects')}
        </div>

        <div style={styles.topActions}>
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
          {activeTab === 'request' && renderRequestTab()}
          {activeTab === 'dashboard' && renderDashboardTab()}
          {activeTab === 'estimates' && renderEstimatesTab()}
          {activeTab === 'ai' && renderAiTab()}
          {activeTab === 'projects' && renderProjectsTab()}
        </div>

        <aside style={styles.sidebar}>
          <section style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Email Notifications</h3>

            <ToggleRow
              label="Admin Email Alerts"
              text="Get email notifications when new requests come in."
              checked={emailAlerts}
              onChange={setEmailAlerts}
            />

            <ToggleRow
              label="Admin Status Alerts"
              text="Stay updated on important request status changes."
              checked={adminAlerts}
              onChange={setAdminAlerts}
            />
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

            <button style={styles.secondaryWideBtn} onClick={() => setActiveTab('estimates')}>
              Go to Estimate Builder
            </button>
          </section>

          <section style={styles.sideCardSoft}>
            <h3 style={styles.sideTitle}>AI Estimator</h3>

            <p style={styles.sideText}>
              Turn a lead description into pricing tiers, missing info, scope notes, and a
              client-ready message.
            </p>

            <ul style={styles.featureList}>
              <li>Generate budget, standard, and premium pricing tiers</li>
              <li>Identify assumptions, exclusions, and risk items</li>
              <li>Create a polished reply you can send to the client</li>
            </ul>

            <button style={styles.secondaryWideBtn} onClick={() => setActiveTab('ai')}>
              Open AI Estimator
            </button>
          </section>

          <section style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Projects Gallery</h3>

            <p style={styles.sideText}>
              Use the gallery to show pre-listing refreshes, turnovers, and before/after examples.
            </p>

            <button style={styles.secondaryWideBtn} onClick={() => setActiveTab('projects')}>
              Open Projects Gallery
            </button>
          </section>

          <section style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Need Help?</h3>

            <p style={styles.sideText}>Contact our support team for assistance.</p>

            <a
              href="mailto:support@shelterprep.com?subject=Shelter%20Prep%20Support"
              style={styles.supportBtn}
            >
              Contact Support
            </a>
          </section>
        </aside>
      </main>

      <section style={styles.bottomBand}>
        <div style={styles.bottomFeature}>
          <div style={styles.bottomFeatureTitle}>Admin Email Alerts</div>
          <div style={styles.bottomFeatureText}>
            Get notified when new work requests are submitted.
          </div>
        </div>

        <div style={styles.bottomFeature}>
          <div style={styles.bottomFeatureTitle}>Client Email Updates</div>
          <div style={styles.bottomFeatureText}>
            Clients can receive email updates when their request status changes.
          </div>
        </div>

        <div style={styles.bottomFeature}>
          <div style={styles.bottomFeatureTitle}>Estimate Builder</div>
          <div style={styles.bottomFeatureText}>
            Build, send, and track estimates all in one place.
          </div>
        </div>

        <div style={styles.bottomFeature}>
          <div style={styles.bottomFeatureTitle}>AI Estimator</div>
          <div style={styles.bottomFeatureText}>
            Generate preliminary scopes, pricing tiers, and client-ready messages.
          </div>
        </div>

        <div style={styles.bottomFeature}>
          <div style={styles.bottomFeatureTitle}>AI Estimator</div>
          <div style={styles.bottomFeatureText}>
            Use uploaded photos and documents to build preliminary scope and pricing notes.
          </div>
        </div>

        <div style={styles.bottomFeature}>
          <div style={styles.bottomFeatureTitle}>Projects Gallery</div>
          <div style={styles.bottomFeatureText}>
            Show off before/after work and build trust with future clients.
          </div>
        </div>
      </section>

      {showLogin ? (
        <div style={styles.overlay} onClick={() => setShowLogin(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Admin Login</h3>
            <p style={{ color: '#60706f' }}>Enter your admin PIN</p>

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
    padding: 16,
  },
  header: {
    maxWidth: 1440,
    margin: '0 auto 20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
    fontSize: 28,
    fontWeight: 800,
    color: '#113c22',
    letterSpacing: 1,
  },
  brandSub: {
    fontSize: 12,
    letterSpacing: 3,
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
    padding: '14px 18px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 800,
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
  secondaryBtn: {
    border: '1px solid #c7d0c9',
    background: '#fff',
    color: '#24352b',
    padding: '14px 18px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 700,
  },
  dangerBtn: {
    border: '1px solid #e3b5b5',
    background: '#fff',
    color: '#9f2424',
    padding: '14px 18px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 700,
  },
  mainGrid: {
    maxWidth: 1440,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 18,
    alignItems: 'start',
  },
  hero: {
    background: 'linear-gradient(135deg, #103c21 0%, #0a2e1a 55%, #204c30 100%)',
    color: '#fff',
    borderRadius: 24,
    padding: 28,
    marginBottom: 18,
    boxShadow: '0 20px 50px rgba(16,60,33,0.18)',
  },
  heroBadge: {
    display: 'inline-block',
    padding: '8px 14px',
    background: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    marginBottom: 16,
    fontSize: 12,
    fontWeight: 700,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 1.12,
    margin: '0 0 10px 0',
  },
  heroText: {
    margin: 0,
    lineHeight: 1.6,
    fontSize: 16,
    color: 'rgba(255,255,255,0.92)',
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: 18,
    border: '1px solid #e2e7e3',
    boxShadow: '0 10px 28px rgba(0,0,0,0.05)',
    marginBottom: 18,
  },
  sideCard: {
    background: '#fff',
    borderRadius: 22,
    padding: 20,
    border: '1px solid #e2e7e3',
    boxShadow: '0 10px 28px rgba(0,0,0,0.05)',
    marginBottom: 14,
  },
  sideCardSoft: {
    background: '#edf0e8',
    borderRadius: 22,
    padding: 20,
    border: '1px solid #d8ded6',
    boxShadow: '0 10px 28px rgba(0,0,0,0.05)',
    marginBottom: 14,
  },
  sidebar: {
    position: 'static',
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
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 28,
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
  noticeBox: {
    background: '#f6f4ef',
    border: '1px solid #ded8ce',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  noticeTitle: {
    margin: '0 0 6px',
    color: '#213428',
    fontSize: 18,
  },
  noticeText: {
    margin: '0 0 12px',
    color: '#66756c',
    lineHeight: 1.5,
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontWeight: 700,
    color: '#24352b',
    padding: '8px 0',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12,
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
    marginBottom: 12,
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
  formFooterNoMargin: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 0,
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
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
  smallText: {
    fontSize: 12,
    color: '#5e6a62',
    lineHeight: 1.45,
    marginTop: 6,
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
  galleryEditor: {
    background: '#f5f3ed',
    border: '1px solid #e0d9ce',
    color: '#24352b',
    borderRadius: 14,
    padding: '16px',
    marginBottom: 18,
    lineHeight: 1.5,
  },
  galleryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
  },
  projectCard: {
    background: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    border: '1px solid #dde3dd',
    boxShadow: '0 10px 24px rgba(25,40,31,0.05)',
  },
  projectImageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 8,
    padding: 8,
    background: '#f2efe8',
  },
  projectImageBox: {
    minHeight: 170,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #d8e0d5 0%, #eef1ec 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectImageLabel: {
    display: 'inline-block',
    padding: '8px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.86)',
    color: '#24352b',
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: 1,
  },
  projectCardBody: {
    padding: 16,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: '#173522',
    marginBottom: 6,
  },
  projectMeta: {
    fontSize: 13,
    color: '#5f6d63',
    lineHeight: 1.45,
    marginBottom: 8,
  },
  projectSummary: {
    marginTop: 0,
    color: '#25342b',
    lineHeight: 1.55,
  },
  projectActions: {
    display: 'flex',
    gap: 10,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  tagWrap: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  tag: {
    display: 'inline-block',
    padding: '7px 10px',
    borderRadius: 999,
    background: '#f1ede6',
    color: '#5e5148',
    fontSize: 12,
    fontWeight: 700,
  },
  bottomBand: {
    maxWidth: 1440,
    margin: '16px auto 0',
    background: '#eee8df',
    border: '1px solid #ddd5ca',
    borderRadius: 20,
    padding: 18,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
  },
  bottomFeature: {
    padding: '8px 12px',
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
    zIndex: 1000,
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