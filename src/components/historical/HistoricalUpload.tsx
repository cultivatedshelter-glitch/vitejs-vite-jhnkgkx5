import { CSSProperties, FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase'
import type { HistoricalProject, HistoricalProjectFile } from '../../types/historical'

const BUCKET = 'historical-project-files'

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function parseMoney(value: string) {
  const cleaned = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  return cleaned ? Number(cleaned[0]) : null
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Not entered'
  return `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function statusLabel(value: string | null | undefined) {
  if (value === 'human_verified') return 'Human Verified'
  if (value === 'reviewed') return 'Reviewed'
  if (value === 'archived') return 'Archived'
  return 'Needs Review'
}

const styles: Record<string, CSSProperties> = {
  card: {
    background: 'white',
    border: '1px solid #d7dfd3',
    borderRadius: 22,
    padding: 24,
    boxShadow: '0 10px 28px rgba(15,84,45,0.06)',
    marginBottom: 18,
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
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid #d7dfd3',
    marginBottom: 12,
    boxSizing: 'border-box',
    fontSize: 15,
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
  muted: {
    color: '#5f6f63',
    lineHeight: 1.5,
  },
  small: {
    color: '#5f6f63',
    fontSize: 14,
    lineHeight: 1.4,
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
  projectCard: {
    background: '#ffffff',
    border: '1px solid #d7dfd3',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  statusPill: {
    display: 'inline-flex',
    borderRadius: 999,
    padding: '7px 10px',
    background: '#fff8e8',
    color: '#6f4f14',
    fontSize: 12,
    fontWeight: 900,
  },
  verifiedPill: {
    display: 'inline-flex',
    borderRadius: 999,
    padding: '7px 10px',
    background: '#e7f3e5',
    color: '#0f542d',
    fontSize: 12,
    fontWeight: 900,
  },
  buttonRow: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  fileRow: {
    border: '1px solid #e3e8df',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    background: '#fbfcfa',
  },
}

export default function HistoricalUpload() {
  const [projectType, setProjectType] = useState('')
  const [city, setCity] = useState('')
  const [zip, setZip] = useState('')
  const [propertyType, setPropertyType] = useState('')
  const [estimatedAmount, setEstimatedAmount] = useState('')
  const [finalInvoiceAmount, setFinalInvoiceAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [anonymized, setAnonymized] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<HistoricalProject[]>([])
  const [filesByProject, setFilesByProject] = useState<Record<string, HistoricalProjectFile[]>>({})
  const [message, setMessage] = useState('')

  const canSubmit = useMemo(() => {
    return Boolean(file && projectType.trim())
  }, [file, projectType])

  useEffect(() => {
    loadHistoricalProjects()
  }, [])

  async function loadHistoricalProjects() {
    setLoading(true)

    try {
      const { data: projectRows, error: projectError } = await supabase
        .from('historical_projects')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25)

      if (projectError) throw projectError

      const projectIds = (projectRows || []).map((project: HistoricalProject) => project.id)
      let groupedFiles: Record<string, HistoricalProjectFile[]> = {}

      if (projectIds.length > 0) {
        const { data: fileRows, error: fileError } = await supabase
          .from('historical_project_files')
          .select('*')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false })

        if (fileError) throw fileError

        groupedFiles = (fileRows || []).reduce(
          (acc: Record<string, HistoricalProjectFile[]>, item: HistoricalProjectFile) => {
            acc[item.project_id] = [...(acc[item.project_id] || []), item]
            return acc
          },
          {}
        )
      }

      setProjects((projectRows || []) as HistoricalProject[])
      setFilesByProject(groupedFiles)
    } catch (error: any) {
      console.error(error)
      setMessage(error?.message || 'Could not load historical projects. Apply the migration first.')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setProjectType('')
    setCity('')
    setZip('')
    setPropertyType('')
    setEstimatedAmount('')
    setFinalInvoiceAmount('')
    setNotes('')
    setCustomerName('')
    setAnonymized(true)
    setFile(null)
  }

  async function handleUpload(event: FormEvent) {
    event.preventDefault()
    setMessage('')

    if (!file) {
      setMessage('Choose an invoice, estimate, or project file first.')
      return
    }

    if (!projectType.trim()) {
      setMessage('Project type is required.')
      return
    }

    setUploading(true)

    try {
      const { data: project, error: projectError } = await supabase
        .from('historical_projects')
        .insert({
          project_type: projectType.trim(),
          city: city.trim() || null,
          state: 'OR',
          zip: zip.trim() || null,
          property_type: propertyType.trim() || null,
          estimated_amount: parseMoney(estimatedAmount),
          final_invoice_amount: parseMoney(finalInvoiceAmount),
          notes: notes.trim() || null,
          customer_name: anonymized ? null : customerName.trim() || null,
          customer_visible: !anonymized,
          anonymized,
          review_status: 'needs_human_review',
          human_verified: false,
          extraction_status: 'not_started',
          extraction_notes: 'AI extraction placeholder. File uploaded for future review.',
        })
        .select()
        .single()

      if (projectError) throw projectError

      const storagePath = `${project.id}/${Date.now()}-${safeFileName(file.name)}`
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file)

      if (uploadError) throw uploadError

      const { error: fileError } = await supabase.from('historical_project_files').insert({
        project_id: project.id,
        file_type: 'invoice_or_estimate',
        file_name: file.name,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        notes: 'Uploaded through Historical Upload. Needs human review before pricing memory.',
        extraction_status: 'not_started',
        human_verified: false,
      })

      if (fileError) throw fileError

      setMessage('Historical project uploaded. It is marked Needs Review.')
      resetForm()
      await loadHistoricalProjects()
    } catch (error: any) {
      console.error(error)
      setMessage(error?.message || 'Historical upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function openHistoricalFile(item: HistoricalProjectFile) {
    const { data, error } = await supabase.storage
      .from(item.storage_bucket || BUCKET)
      .createSignedUrl(item.storage_path, 60 * 10)

    if (error || !data?.signedUrl) {
      alert('Could not open file. Check Supabase storage bucket and policies.')
      return
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <section style={styles.card}>
      <div style={styles.buttonRow}>
        <div style={{ flex: 1 }}>
          <h2>Historical Upload</h2>
          <p style={styles.muted}>
            Upload old invoices, estimates, receipts, and project files so Shelter Prep can build reviewed pricing memory over time.
          </p>
        </div>
        <button type="button" style={styles.outlineButton} disabled={loading} onClick={loadHistoricalProjects}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div style={styles.noticeBox}>
        Powered by AI. Approved by humans. Uploaded records start as <strong>Needs Review</strong>.
        AI extraction is not running yet, and pricing memory is not created until a human approves it.
      </div>

      {message && <div style={styles.noticeBox}>{message}</div>}

      <form onSubmit={handleUpload}>
        <div style={styles.uploadBox}>
          <strong>Invoice / Estimate File</strong>
          <p style={styles.small}>PDFs are ideal, but receipts and other project documents can be saved too.</p>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          {file && <p style={styles.small}>{file.name}</p>}
        </div>

        <div style={styles.grid3}>
          <input
            style={styles.input}
            placeholder="Project type *"
            value={projectType}
            onChange={(event) => setProjectType(event.target.value)}
          />
          <input
            style={styles.input}
            placeholder="City"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
          <input
            style={styles.input}
            placeholder="ZIP"
            value={zip}
            onChange={(event) => setZip(event.target.value)}
          />
        </div>

        <div style={styles.grid3}>
          <input
            style={styles.input}
            placeholder="Property type"
            value={propertyType}
            onChange={(event) => setPropertyType(event.target.value)}
          />
          <input
            style={styles.input}
            placeholder="Estimated amount"
            value={estimatedAmount}
            onChange={(event) => setEstimatedAmount(event.target.value)}
          />
          <input
            style={styles.input}
            placeholder="Final invoice amount"
            value={finalInvoiceAmount}
            onChange={(event) => setFinalInvoiceAmount(event.target.value)}
          />
        </div>

        <div style={styles.grid2}>
          <select
            style={styles.input}
            value={anonymized ? 'anonymize' : 'keep'}
            onChange={(event) => setAnonymized(event.target.value === 'anonymize')}
          >
            <option value="anonymize">Anonymize customer info</option>
            <option value="keep">Keep customer info</option>
          </select>
          <input
            style={styles.input}
            placeholder="Customer name (optional)"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            disabled={anonymized}
          />
        </div>

        <textarea
          style={{ ...styles.input, minHeight: 110 }}
          placeholder="Notes, lessons learned, change order hints, estimating context"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />

        <button type="submit" style={styles.primaryButton} disabled={uploading || !canSubmit}>
          {uploading ? 'Uploading...' : 'Upload Historical Project'}
        </button>
      </form>

      <hr style={{ border: 'none', borderTop: '1px solid #d7dfd3', margin: '24px 0' }} />

      <h3>Recent Historical Uploads</h3>
      {projects.length === 0 ? (
        <p style={styles.muted}>
          No historical uploads yet. Add old invoices or estimates here first, then review them before they become pricing memory.
        </p>
      ) : (
        projects.map((project) => (
          <div key={project.id} style={styles.projectCard}>
            <div style={styles.buttonRow}>
              <div style={{ flex: 1 }}>
                <strong>{project.project_type}</strong>
                <p style={styles.small}>
                  {[project.city, project.state, project.zip].filter(Boolean).join(', ') || 'Location not entered'} •{' '}
                  {project.property_type || 'Property type not entered'}
                </p>
              </div>
              <span style={project.human_verified ? styles.verifiedPill : styles.statusPill}>
                {statusLabel(project.review_status)}
              </span>
            </div>

            <div style={styles.grid3}>
              <p style={styles.small}>Estimate: {money(project.estimated_amount)}</p>
              <p style={styles.small}>Final: {money(project.final_invoice_amount)}</p>
              <p style={styles.small}>
                Privacy: {project.anonymized ? 'Anonymized' : 'Customer info kept'}
              </p>
            </div>

            {project.notes && <p style={styles.small}>Notes: {project.notes}</p>}

            {(filesByProject[project.id] || []).map((item) => (
              <div key={item.id} style={styles.fileRow}>
                <div style={styles.buttonRow}>
                  <div style={{ flex: 1 }}>
                    <strong>{item.file_name}</strong>
                    <p style={styles.small}>
                      {item.file_type} • Extraction: {item.extraction_status || 'not_started'} • Needs human review
                    </p>
                  </div>
                  <button type="button" style={styles.outlineButton} onClick={() => openHistoricalFile(item)}>
                    View / Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </section>
  )
}
