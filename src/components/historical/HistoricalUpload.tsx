import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { supabase, supabaseAnonKey, supabaseUrl } from '../../supabase'
import type { EstimateMemory, HistoricalProject, HistoricalProjectFile } from '../../types/historical'

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

function parseOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function prettyJson(value: unknown) {
  return JSON.stringify(value || {}, null, 2)
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
  projectCardOpen: {
    background: '#ffffff',
    border: '1px solid #0f542d',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0 8px 24px rgba(15,84,45,0.08)',
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
  const [estimateMemoryByFileId, setEstimateMemoryByFileId] = useState<Record<string, EstimateMemory>>({})
  const [extractionTextByFileId, setExtractionTextByFileId] = useState<Record<string, string>>({})
  const [estimateJsonByFileId, setEstimateJsonByFileId] = useState<Record<string, string>>({})
  const [extractingFileId, setExtractingFileId] = useState<string | null>(null)
  const [savingEstimateId, setSavingEstimateId] = useState<string | null>(null)
  const [approvingEstimateId, setApprovingEstimateId] = useState<string | null>(null)
  const [openProjectId, setOpenProjectId] = useState<string | null>(null)
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
      let fileIds: string[] = []

      if (projectIds.length > 0) {
        const { data: fileRows, error: fileError } = await supabase
          .from('historical_project_files')
          .select('*')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false })

        if (fileError) throw fileError

        fileIds = (fileRows || []).map((fileItem: HistoricalProjectFile) => fileItem.id)
        groupedFiles = (fileRows || []).reduce(
          (acc: Record<string, HistoricalProjectFile[]>, item: HistoricalProjectFile) => {
            acc[item.project_id] = [...(acc[item.project_id] || []), item]
            return acc
          },
          {}
        )
      }

      let memoryByFile: Record<string, EstimateMemory> = {}
      let jsonByFile: Record<string, string> = {}

      if (fileIds.length > 0) {
        const { data: memoryRows, error: memoryError } = await supabase
          .from('estimate_memory')
          .select('*')
          .in('source_file_id', fileIds)
          .order('created_at', { ascending: false })

        if (memoryError && memoryError.code !== '42P01') throw memoryError

        memoryByFile = (memoryRows || []).reduce(
          (acc: Record<string, EstimateMemory>, item: EstimateMemory) => {
            if (item.source_file_id && !acc[item.source_file_id]) {
              acc[item.source_file_id] = item
              jsonByFile[item.source_file_id] = prettyJson({
                projectType: item.project_type,
                squareFeet: item.square_feet,
                city: item.city,
                state: item.state,
                zip: item.zip,
                projectClass: item.project_class,
                laborCost: item.labor_cost,
                materialCost: item.material_cost,
                demoCost: item.demo_cost,
                totalCost: item.total_cost,
                normalizedScope: item.normalized_scope,
                exclusions: item.exclusions,
                riskFactors: item.risk_factors,
                confidenceScore: item.confidence_score,
              })
            }
            return acc
          },
          {}
        )
      }

      setProjects((projectRows || []) as HistoricalProject[])
      setFilesByProject(groupedFiles)
      setEstimateMemoryByFileId(memoryByFile)
      setEstimateJsonByFileId((prev) => ({ ...jsonByFile, ...prev }))
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

  async function createHistoricalFileUrl(item: HistoricalProjectFile, download = false) {
    const { data, error } = await supabase.storage
      .from(item.storage_bucket || BUCKET)
      .createSignedUrl(item.storage_path, 60 * 10, download ? { download: item.file_name } : undefined)

    if (error || !data?.signedUrl) {
      throw error || new Error('Signed URL was not returned.')
    }

    return data.signedUrl
  }

  async function openHistoricalFile(item: HistoricalProjectFile, download = false) {
    try {
      const signedUrl = await createHistoricalFileUrl(item, download)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      console.error(error)
      alert('Could not open file. Check Supabase storage bucket and policies.')
    }
  }

  function findProject(projectId: string) {
    return projects.find((project) => project.id === projectId)
  }

  async function extractEstimateData(item: HistoricalProjectFile) {
    const project = findProject(item.project_id)
    const extractedText = extractionTextByFileId[item.id]?.trim() || ''

    setMessage('')
    setExtractingFileId(item.id)

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase env vars are missing. Estimate extraction needs Supabase Functions.')
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/estimate-extract`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          extractedText,
          fileRecord: item,
          project,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result?.error || result?.message || 'Estimate extraction failed.')
      }

      const estimate = result.estimate || {}
      const { data: run, error: runError } = await supabase
        .from('estimate_extraction_runs')
        .insert({
          source_project_id: item.project_id,
          source_file_id: item.id,
          source_storage_bucket: item.storage_bucket || BUCKET,
          source_storage_path: item.storage_path,
          status: result.status || 'needs_review',
          input_mode: extractedText ? 'manual_text' : 'file_record',
          extracted_text: extractedText || null,
          normalized_json: estimate,
          confidence_score: parseOptionalNumber(estimate.confidenceScore),
          completed_at: result.status === 'needs_review' ? new Date().toISOString() : null,
        })
        .select()
        .single()

      if (runError) throw runError

      const memoryPayload = {
        source_project_id: item.project_id,
        source_file_id: item.id,
        extraction_run_id: run.id,
        source_storage_bucket: item.storage_bucket || BUCKET,
        source_file_path: item.storage_path,
        source_file_url: null,
        extracted_text: extractedText || null,
        normalized_scope: estimate.normalizedScope || {},
        exclusions: estimate.exclusions || [],
        risk_factors: estimate.riskFactors || [],
        project_type: estimate.projectType || project?.project_type || null,
        square_feet: parseOptionalNumber(estimate.squareFeet),
        city: estimate.city || project?.city || null,
        state: estimate.state || project?.state || 'OR',
        zip: estimate.zip || project?.zip || null,
        project_class: estimate.projectClass || project?.property_type || null,
        labor_cost: parseOptionalNumber(estimate.laborCost),
        material_cost: parseOptionalNumber(estimate.materialCost),
        demo_cost: parseOptionalNumber(estimate.demoCost),
        total_cost: parseOptionalNumber(estimate.totalCost),
        confidence_score: parseOptionalNumber(estimate.confidenceScore),
        review_status: 'needs_review',
        notes:
          result.status === 'needs_manual_text_review'
            ? 'Manual text review needed before normalized estimate memory can be trusted.'
            : 'AI-normalized estimate object. Human approval required.',
      }

      const existing = estimateMemoryByFileId[item.id]
      const query = existing
        ? supabase.from('estimate_memory').update(memoryPayload).eq('id', existing.id).select().single()
        : supabase.from('estimate_memory').insert(memoryPayload).select().single()

      const { data: memory, error: memoryError } = await query
      if (memoryError) throw memoryError

      setEstimateMemoryByFileId((prev) => ({ ...prev, [item.id]: memory as EstimateMemory }))
      setEstimateJsonByFileId((prev) => ({ ...prev, [item.id]: prettyJson(estimate) }))
      setMessage(
        result.status === 'needs_manual_text_review'
          ? 'Original file is saved. Paste proposal text to create the normalized estimate object.'
          : 'Estimate data extracted. Review and approve before it becomes pricing memory.'
      )
      await loadHistoricalProjects()
    } catch (error: any) {
      console.error(error)
      setMessage(error?.message || 'Could not extract estimate data.')
    } finally {
      setExtractingFileId(null)
    }
  }

  async function saveEstimateJson(item: HistoricalProjectFile) {
    const memory = estimateMemoryByFileId[item.id]
    if (!memory) return

    setMessage('')
    setSavingEstimateId(memory.id)

    try {
      const parsed = JSON.parse(estimateJsonByFileId[item.id] || '{}')
      const { data, error } = await supabase
        .from('estimate_memory')
        .update({
          project_type: parsed.projectType || null,
          square_feet: parseOptionalNumber(parsed.squareFeet),
          city: parsed.city || null,
          state: parsed.state || 'OR',
          zip: parsed.zip || null,
          project_class: parsed.projectClass || null,
          labor_cost: parseOptionalNumber(parsed.laborCost),
          material_cost: parseOptionalNumber(parsed.materialCost),
          demo_cost: parseOptionalNumber(parsed.demoCost),
          total_cost: parseOptionalNumber(parsed.totalCost),
          normalized_scope: parsed.normalizedScope || {},
          exclusions: parsed.exclusions || [],
          risk_factors: parsed.riskFactors || [],
          confidence_score: parseOptionalNumber(parsed.confidenceScore),
          review_status: 'needs_review',
          updated_at: new Date().toISOString(),
        })
        .eq('id', memory.id)
        .select()
        .single()

      if (error) throw error

      setEstimateMemoryByFileId((prev) => ({ ...prev, [item.id]: data as EstimateMemory }))
      setMessage('Normalized estimate saved. It still needs human approval.')
    } catch (error: any) {
      console.error(error)
      setMessage(error?.message || 'Could not save estimate JSON. Check that the JSON is valid.')
    } finally {
      setSavingEstimateId(null)
    }
  }

  async function approveEstimateMemory(item: HistoricalProjectFile) {
    const memory = estimateMemoryByFileId[item.id]
    if (!memory) return

    if (!window.confirm('Approve this normalized estimate into pricing memory? Human approval is final for this draft.')) {
      return
    }

    setMessage('')
    setApprovingEstimateId(memory.id)

    try {
      const { data: updated, error: updateError } = await supabase
        .from('estimate_memory')
        .update({
          review_status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: 'Shelter Prep admin',
          updated_at: new Date().toISOString(),
        })
        .eq('id', memory.id)
        .select()
        .single()

      if (updateError) throw updateError

      const scope = memory.normalized_scope || {}
      const summary = typeof scope.summary === 'string' ? scope.summary : ''
      const { error: pricingError } = await supabase.from('pricing_memory_entries').insert({
        source_project_id: memory.source_project_id,
        trade: memory.project_type,
        repair_type: memory.project_type,
        item_name: memory.project_type || 'Historical estimate',
        description: summary || 'Approved historical estimate memory.',
        city: memory.city,
        state: memory.state,
        zip: memory.zip,
        property_type: memory.project_class,
        labor_cost: memory.labor_cost,
        material_cost: memory.material_cost,
        total_cost: memory.total_cost,
        verified_price: memory.total_cost,
        source: 'estimate_memory',
        confidence_level:
          (memory.confidence_score || 0) >= 0.75 ? 'high' : (memory.confidence_score || 0) >= 0.45 ? 'medium' : 'low',
        human_verified: true,
        notes: `Approved from estimate_memory ${memory.id}. Original file remains available at ${memory.source_file_path}.`,
        last_checked: new Date().toISOString(),
      })

      if (pricingError) throw pricingError

      setEstimateMemoryByFileId((prev) => ({ ...prev, [item.id]: updated as EstimateMemory }))
      setMessage('Approved. The original file remains available and the normalized estimate now feeds pricing memory.')
    } catch (error: any) {
      console.error(error)
      setMessage(error?.message || 'Could not approve estimate into pricing memory.')
    } finally {
      setApprovingEstimateId(null)
    }
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
          <div
            key={project.id}
            style={{
              ...(openProjectId === project.id ? styles.projectCardOpen : styles.projectCard),
              cursor: 'pointer',
            }}
            role="button"
            tabIndex={0}
            onClick={() => setOpenProjectId((current) => (current === project.id ? null : project.id))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setOpenProjectId((current) => (current === project.id ? null : project.id))
              }
            }}
          >
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
              <button type="button" style={styles.outlineButton}>
                {openProjectId === project.id ? 'Close Project' : 'Open Project'}
              </button>
            </div>

            {openProjectId === project.id && (
              <>
                <div style={styles.grid3}>
                  <p style={styles.small}>Estimate: {money(project.estimated_amount)}</p>
                  <p style={styles.small}>Final: {money(project.final_invoice_amount)}</p>
                  <p style={styles.small}>
                    Privacy: {project.anonymized ? 'Anonymized' : 'Customer info kept'}
                  </p>
                </div>

                {project.notes && <p style={styles.small}>Notes: {project.notes}</p>}

                {(filesByProject[project.id] || []).map((item) => (
                  <div key={item.id} style={styles.fileRow} onClick={(event) => event.stopPropagation()}>
                    <div style={styles.buttonRow}>
                      <div style={{ flex: 1 }}>
                        <strong>{item.file_name}</strong>
                        <p style={styles.small}>
                          {item.file_type} • Extraction: {item.extraction_status || 'not_started'} • Original file preserved
                        </p>
                      </div>
                      <button type="button" style={styles.outlineButton} onClick={() => openHistoricalFile(item)}>
                        Open File
                      </button>
                      <button type="button" style={styles.outlineButton} onClick={() => openHistoricalFile(item, true)}>
                        Download
                      </button>
                    </div>

                    <div style={styles.noticeBox}>
                      <strong>Dual output</strong>
                      <p style={styles.small}>
                        Keep the original file for human review, then create a structured estimate object for pricing memory.
                      </p>
                      <textarea
                        style={{ ...styles.input, minHeight: 92, background: 'white' }}
                        placeholder="Phase 1: paste extracted proposal/invoice text here. If blank, Shelter Prep marks this file needs_manual_text_review."
                        value={extractionTextByFileId[item.id] || ''}
                        onChange={(event) =>
                          setExtractionTextByFileId((prev) => ({ ...prev, [item.id]: event.target.value }))
                        }
                      />
                      <div style={styles.buttonRow}>
                        <button
                          type="button"
                          style={styles.primaryButton}
                          disabled={extractingFileId === item.id}
                          onClick={() => extractEstimateData(item)}
                        >
                          {extractingFileId === item.id ? 'Extracting...' : 'Extract Estimate Data'}
                        </button>
                        {estimateMemoryByFileId[item.id] && (
                          <span
                            style={
                              estimateMemoryByFileId[item.id].review_status === 'approved'
                                ? styles.verifiedPill
                                : styles.statusPill
                            }
                          >
                            {estimateMemoryByFileId[item.id].review_status === 'approved'
                              ? 'Approved'
                              : estimateMemoryByFileId[item.id].review_status === 'rejected'
                                ? 'Rejected'
                                : 'Needs Review'}
                          </span>
                        )}
                      </div>
                    </div>

                    {estimateMemoryByFileId[item.id] && (
                      <div style={styles.fileRow}>
                        <div style={styles.grid3}>
                          <p style={styles.small}>Labor: {money(estimateMemoryByFileId[item.id].labor_cost)}</p>
                          <p style={styles.small}>Materials: {money(estimateMemoryByFileId[item.id].material_cost)}</p>
                          <p style={styles.small}>Total: {money(estimateMemoryByFileId[item.id].total_cost)}</p>
                        </div>
                        <textarea
                          style={{ ...styles.input, minHeight: 260, fontFamily: 'monospace', fontSize: 13 }}
                          value={estimateJsonByFileId[item.id] || ''}
                          onChange={(event) =>
                            setEstimateJsonByFileId((prev) => ({ ...prev, [item.id]: event.target.value }))
                          }
                        />
                        <div style={styles.buttonRow}>
                          <button
                            type="button"
                            style={styles.outlineButton}
                            disabled={savingEstimateId === estimateMemoryByFileId[item.id].id}
                            onClick={() => saveEstimateJson(item)}
                          >
                            {savingEstimateId === estimateMemoryByFileId[item.id].id ? 'Saving...' : 'Save JSON Edits'}
                          </button>
                          <button
                            type="button"
                            style={styles.primaryButton}
                            disabled={
                              approvingEstimateId === estimateMemoryByFileId[item.id].id ||
                              estimateMemoryByFileId[item.id].review_status === 'approved'
                            }
                            onClick={() => approveEstimateMemory(item)}
                          >
                            {approvingEstimateId === estimateMemoryByFileId[item.id].id
                              ? 'Approving...'
                              : 'Approve into Pricing Memory'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        ))
      )}
    </section>
  )
}
