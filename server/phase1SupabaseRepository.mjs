import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const BUCKET = process.env.PHASE1_EVIDENCE_BUCKET || 'phase1-evidence'

function required(name, fallback) {
  const value = process.env[name] || fallback
  if (!value) throw new Error(`${name} is required for the Phase 1 processing server.`)
  return value
}

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'evidence'
}

function findingRows(artifact, request, modelRunId) {
  const observations = Array.isArray(artifact?.atomicObservations) ? artifact.atomicObservations : []
  return observations.map((observation) => {
    const source = observation.source || {}
    const organization = observation.organization || {}
    const epistemic = observation.epistemic_states || {}
    const location = observation.affected_location || observation.finding_card?.affected_location || {}
    const conditions = Array.isArray(organization.condition_categories) ? organization.condition_categories : []
    const domain = String(organization.domain_key || '')
    return {
      property_id: request.property_id,
      inspection_report_id: request.inspection_report_id,
      source_file_id: source.source_file_id || request.source_file_id,
      source_page: source.source_page || null,
      source_section: source.source_section || null,
      source_item_number: source.source_item_number || null,
      original_text: source.inspector_statement || epistemic.source_observation || 'Source finding requires review.',
      inspector_recommendation: source.inspector_recommendation || null,
      inspector_location: location.location_text || null,
      normalized_location: location.location_text || null,
      building_system: organization.building_system || null,
      trade_category: observation.finding_card?.next_step_owner || null,
      urgency: conditions.includes('safety_or_habitability') ? 'safety' : conditions.includes('active_damage_or_water') ? 'soon' : 'routine',
      safety_flag: conditions.includes('safety_or_habitability') || domain === 'life_safety' || domain === 'electrical',
      moisture_flag: conditions.includes('active_damage_or_water') || domain === 'moisture_envelope',
      further_evaluation_flag: true,
      maintenance_flag: domain === 'deferred_maintenance_fyi',
      fyi_flag: false,
      known_facts: Array.isArray(observation.known_facts) ? observation.known_facts : [],
      observations: [source.inspector_statement || epistemic.source_observation].filter(Boolean),
      interpretations: [epistemic.shelter_prep_interpretation].filter(Boolean),
      assumptions: [],
      unknowns: Array.isArray(epistemic.unknowns) ? epistemic.unknowns : [],
      needs_field_verification: [observation.smallest_useful_next_evidence?.next_evidence_needed].filter(Boolean),
      review_status: 'needs_review',
      model_run_id: modelRunId,
    }
  })
}

function agentArtifact(artifact, findings, eventsById) {
  const allowed = new Map()
  for (const finding of findings) {
    const event = eventsById.get(finding.review_event_id)
    if (!['approve', 'needs_more_info', 'reject'].includes(event?.review_action)) continue
    allowed.set(finding.source_item_number, { finding, event })
  }
  const observations = (artifact.atomicObservations || []).filter((entry) => allowed.has(entry.source?.source_item_number)).map((entry) => {
    const copy = structuredClone(entry)
    const { finding, event } = allowed.get(entry.source?.source_item_number)
    const corrections = event.new_value?.corrections || {}
    const card = copy.finding_card || (copy.finding_card = {})
    const epistemic = copy.epistemic_states || (copy.epistemic_states = {})
    if (corrections.title) card.finding_title = corrections.title
    if (corrections.interpretation) epistemic.shelter_prep_interpretation = corrections.interpretation
    else if (epistemic.shelter_prep_interpretation) {
      epistemic.shelter_prep_interpretation = epistemic.shelter_prep_interpretation.replace(/\s*This is an AI draft interpretation and does not establish final cause, final scope, code status, or pricing\.?/i, '').trim()
    }
    if (Array.isArray(corrections.known)) card.what_we_know = corrections.known
    if (Array.isArray(corrections.unknown)) card.what_we_dont_know = corrections.unknown
    if (corrections.affected_location) card.affected_location = { ...(card.affected_location || {}), ...corrections.affected_location }
    if (Array.isArray(corrections.repair_paths)) {
      const labelsById = new Map(corrections.repair_paths.map((path) => [path.id, path.label]))
      card.repair_paths = (card.repair_paths || []).map((path) => labelsById.has(path.id) ? { ...path, label: labelsById.get(path.id) } : path)
    }
    if (corrections.next_step) card.recommended_next_step = corrections.next_step
    if (corrections.rationale) card.why_next_step = corrections.rationale
    if (corrections.likely_trade) card.next_step_owner = corrections.likely_trade
    if (corrections.price) card.released_price_correction = corrections.price
    if (Array.isArray(corrections.price_adjustments)) card.released_price_corrections = corrections.price_adjustments
    if (corrections.evidence_relationship) card.reviewed_evidence_relationship = corrections.evidence_relationship
    if (corrections.confirmed_evidence) card.confirmed_evidence = corrections.confirmed_evidence
    card.review_status = finding.review_status
    card.release_disposition = event.review_action === 'approve' ? 'approved' : event.review_action === 'needs_more_info' ? 'needs_more_information' : 'rejected'
    card.released_to_agent = event.review_action === 'approve'
    delete copy.review_workflow
    delete card.review_workflow
    delete copy.extraction_status
    delete copy.source?.provenance
    delete copy.source?.source_file_id
    delete copy.evidence_links
    delete copy.epistemic_states?.ai_inference_or_hypothesis
    return copy
  })
  return {
    schemaVersion: artifact.schemaVersion || artifact.schema_version,
    propertyReportReconstruction: artifact.propertyReportReconstruction,
    transactionContext: artifact.transactionContext,
    external_sources: artifact.external_sources || [],
    atomicObservations: observations,
  }
}

export function normalizePropertyAddress(address) {
  return address
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9#]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function createPhase1SupabaseRepository() {
  const url = required('SUPABASE_URL', process.env.VITE_SUPABASE_URL)
  const publishableKey = required('SUPABASE_PUBLISHABLE_KEY', process.env.VITE_SUPABASE_ANON_KEY)
  const secretKey = required('SUPABASE_SECRET_KEY')
  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

  function userClient(token) {
    return createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
  }

  const tokens = new Map()

  async function isReviewerId(actorId) {
    const { data, error } = await admin.from('profiles').select('role,active').eq('id', actorId).maybeSingle()
    if (error) throw new Error(`Reviewer authorization failed: ${error.message}`)
    return data?.active === true && ['owner', 'admin'].includes(data.role)
  }

  return {
    async authenticate(token) {
      const { data, error } = await admin.auth.getUser(token)
      if (error || !data.user) return null
      tokens.set(data.user.id, token)
      return { id: data.user.id, email: data.user.email || null }
    },

    async getActorProfile({ actor }) {
      const { data, error } = await admin.from('profiles')
        .select('id,email,full_name,role,active')
        .eq('id', actor.id)
        .maybeSingle()
      if (error) throw new Error(`Profile lookup failed: ${error.message}`)
      return {
        id: actor.id,
        email: data?.email || actor.email || null,
        fullName: data?.full_name || null,
        role: data?.active === true ? data.role : 'viewer',
        active: data?.active === true,
        isReviewer: data?.active === true && ['owner', 'admin'].includes(data.role),
      }
    },

    async canAccessProperty(actorId, propertyId) {
      const client = userClient(tokens.get(actorId))
      const { data, error } = await client.from('properties').select('id').eq('id', propertyId).maybeSingle()
      if (error) throw new Error(`Property authorization failed: ${error.message}`)
      return Boolean(data)
    },

    async isReviewer(actorId) {
      return isReviewerId(actorId)
    },

    async resolveOrCreateProperty({ actor, address }) {
      const client = userClient(tokens.get(actor.id))
      const normalizedAddress = normalizePropertyAddress(address)
      if (!normalizedAddress) throw new Error('Property address normalization produced an empty value.')
      const { data: matches, error: lookupError } = await client.from('properties')
        .select('id, source_address, address_line1, city, state, zip, normalized_address')
        .eq('normalized_address', normalizedAddress)
        .limit(2)
      if (lookupError) throw new Error(`Property lookup failed: ${lookupError.message}`)
      if (matches?.length === 1) return { ...matches[0], address: matches[0].source_address || matches[0].address_line1, created: false }
      if (matches?.length > 1) throw new Error('Multiple accessible properties match this address. Resolve the duplicate property records before continuing.')

      const { error } = await client.from('properties').insert({
        created_by: actor.id,
        address_line1: address,
        source_address: address,
        normalized_address: normalizedAddress,
        status: 'active',
        metadata: { created_via: 'phase1_guided_intake' },
      })
      if (error) throw new Error(`Property creation failed: ${error.message}`)
      const { data: created, error: readError } = await client.from('properties')
        .select('id, source_address, address_line1, city, state, zip, normalized_address')
        .eq('created_by', actor.id)
        .eq('normalized_address', normalizedAddress)
        .limit(2)
      if (readError) throw new Error(`Created Property lookup failed: ${readError.message}`)
      if (created?.length !== 1) throw new Error('Created Property could not be resolved uniquely after insertion.')
      return { ...created[0], address: created[0].source_address || created[0].address_line1, created: true }
    },

    async storeEvidence({ actor, propertyId, file }) {
      const client = userClient(tokens.get(actor.id))
      const bytes = new Uint8Array(await file.arrayBuffer())
      const id = randomUUID()
      const path = `${actor.id}/${propertyId}/${id}-${safeName(file.name)}`
      const checksum = createHash('sha256').update(bytes).digest('hex')
      const { error: uploadError } = await client.storage.from(BUCKET).upload(path, bytes, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })
      if (uploadError) throw new Error(`Evidence upload failed: ${uploadError.message}`)
      const { data, error } = await admin.from('inspection_reports').insert({
        property_id: propertyId,
        source_file_id: id,
        source_storage_bucket: BUCKET,
        source_storage_path: path,
        original_filename: file.name,
        source_checksum: checksum,
        extraction_summary: { uploaded_at: new Date().toISOString(), media_type: file.type || 'application/octet-stream' },
      }).select('id, source_file_id').single()
      if (error) {
        await client.storage.from(BUCKET).remove([path])
        throw new Error(`Evidence record failed: ${error.message}`)
      }
      return { id: data.id, sourceFileId: data.source_file_id }
    },

    async resolveEvidence({ actor, propertyId, evidenceReferences }) {
      const client = userClient(tokens.get(actor.id))
      const ids = evidenceReferences.map((item) => item.id)
      const { data, error } = await client.from('inspection_reports')
        .select('id, property_id, source_file_id, source_storage_bucket, source_storage_path, original_filename, extraction_summary, inspection_date')
        .eq('property_id', propertyId).in('id', ids)
      if (error) throw new Error(`Evidence lookup failed: ${error.message}`)
      const workDir = await mkdtemp(join(tmpdir(), 'shelter-prep-evidence-'))
      const resolved = []
      try {
        for (const item of data || []) {
          const { data: blob, error: downloadError } = await client.storage.from(item.source_storage_bucket).download(item.source_storage_path)
          if (downloadError) throw new Error(`Evidence download failed: ${downloadError.message}`)
          const localPath = join(workDir, `${item.id}${extname(item.original_filename || '')}`)
          await writeFile(localPath, new Uint8Array(await blob.arrayBuffer()))
          resolved.push({
            id: item.id,
            propertyId: item.property_id,
            sourceFileId: item.source_file_id,
            localPath,
            mediaType: item.extraction_summary?.media_type || blob.type,
            uploadedAt: item.extraction_summary?.uploaded_at || null,
            observationDate: item.inspection_date || null,
            workDir,
          })
        }
        return resolved
      } catch (error) {
        await rm(workDir, { recursive: true, force: true })
        throw error
      }
    },

    async validateEvidenceReferences({ actor, propertyId, evidenceReferences }) {
      const client = userClient(tokens.get(actor.id))
      const ids = evidenceReferences.map((item) => item.id).filter(Boolean)
      if (!ids.length) return false
      const { data, error } = await client.from('inspection_reports')
        .select('id,source_file_id')
        .eq('property_id', propertyId)
        .in('id', ids)
      if (error) throw new Error(`Evidence validation failed: ${error.message}`)
      const byId = new Map((data || []).map((item) => [item.id, item]))
      return evidenceReferences.every((reference) => byId.get(reference.id)?.source_file_id === reference.sourceFileId)
    },

    async releaseEvidence(evidence) {
      const dirs = [...new Set(evidence.map((item) => item.workDir).filter(Boolean))]
      await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })))
    },

    async createProcessingRequest({ actor, propertyId, evidenceReferences, note, deliveryRecipient = null, draft = false }) {
      const primary = evidenceReferences[0]
      const inputHash = createHash('sha256').update(JSON.stringify({ propertyId, evidenceReferences, note })).digest('hex')
      const profile = await this.getActorProfile({ actor })
      const recipientEmail = String(deliveryRecipient?.email || profile.email || '').trim().toLowerCase()
      const recipientName = String(deliveryRecipient?.name || '').trim() || null
      const recipientSource = deliveryRecipient?.source === 'manually_changed' ? 'manually_changed' : 'submitter_default'
      const { data, error } = await admin.from('inspection_pipeline_runs').insert({
        property_id: propertyId,
        inspection_report_id: primary.id,
        source_file_id: primary.sourceFileId,
        input_hash: inputHash,
        requested_by: actor.id,
        submitter_name: profile.fullName,
        submitter_email: profile.email,
        delivery_recipient_name: recipientName,
        delivery_recipient_email: recipientEmail,
        delivery_recipient_source: recipientSource,
        stage_statuses: { evidence_references: evidenceReferences, note, upload_status: 'uploaded' },
        current_stage: draft ? 'submission_review' : 'document_extraction',
        workflow_state: draft ? 'draft' : 'submitted',
        next_responsible_role: draft ? 'submitter' : 'system',
        next_action: draft ? 'Review and submit evidence' : 'Process submitted evidence',
        last_activity_at: new Date().toISOString(),
        submitted_at: draft ? null : new Date().toISOString(),
        status: draft ? 'draft' : 'queued',
      }).select('*').single()
      if (error) throw new Error(`Processing request failed: ${error.message}`)
      return { id: data.id, propertyId, processingStatus: data.status, createdAt: data.created_at }
    },

    async finalizeSubmission({ actor, requestId, deliveryRecipient }) {
      const { data: existing, error: lookupError } = await admin.from('inspection_pipeline_runs')
        .select('id,property_id,requested_by,status,submitter_email,delivery_recipient_email,delivery_recipient_name,delivery_recipient_source,stage_statuses')
        .eq('id', requestId)
        .eq('requested_by', actor.id)
        .maybeSingle()
      if (lookupError) throw new Error(`Submission lookup failed: ${lookupError.message}`)
      if (!existing || existing.status !== 'draft') return null
      const email = String(deliveryRecipient?.email || existing.delivery_recipient_email || existing.submitter_email || '').trim().toLowerCase()
      const name = String(deliveryRecipient?.name || existing.delivery_recipient_name || '').trim() || null
      const source = email === String(existing.submitter_email || '').trim().toLowerCase() ? 'submitter_default' : 'manually_changed'
      const now = new Date().toISOString()
      const { data, error } = await admin.from('inspection_pipeline_runs').update({
        delivery_recipient_name: name,
        delivery_recipient_email: email,
        delivery_recipient_source: source,
        submitted_at: now,
        status: 'queued',
        current_stage: 'document_extraction',
        workflow_state: 'submitted',
        next_responsible_role: 'system',
        next_action: 'Process submitted evidence',
        last_activity_at: now,
      }).eq('id', requestId).eq('status', 'draft').select('*').maybeSingle()
      if (error) throw new Error(`Submission finalization failed: ${error.message}`)
      if (!data) return null
      const { error: eventError } = await admin.from('workflow_events').insert({
        property_id: existing.property_id,
        actor_id: actor.id,
        actor_type: 'agent',
        event_type: 'phase1_submission_created',
        event_title: 'Phase 1 evidence submitted for review',
        object_type: 'inspection_pipeline_run',
        object_id: requestId,
        metadata: {
          delivery_recipient_email: email,
          delivery_recipient_name: name,
          delivery_recipient_source: source,
          evidence_count: (existing.stage_statuses?.evidence_references || []).length,
        },
      })
      if (eventError) {
        await admin.from('inspection_pipeline_runs').update({
          status: 'draft',
          current_stage: 'submission_review',
          workflow_state: 'draft',
          next_responsible_role: 'submitter',
          next_action: 'Review and submit evidence',
          submitted_at: null,
          last_activity_at: now,
        }).eq('id', requestId).eq('status', 'queued')
        throw new Error(`Submission audit event failed: ${eventError.message}`)
      }
      return { ...data, evidenceReferences: data.stage_statuses?.evidence_references || [], note: data.stage_statuses?.note || '' }
    },

    async updateSubmissionDraft({ actor, requestId, propertyId, evidenceReferences, note, deliveryRecipient }) {
      const { data: existing, error: lookupError } = await admin.from('inspection_pipeline_runs')
        .select('id,property_id,requested_by,status,submitter_email,stage_statuses')
        .eq('id', requestId)
        .eq('property_id', propertyId)
        .eq('requested_by', actor.id)
        .maybeSingle()
      if (lookupError) throw new Error(`Submission draft lookup failed: ${lookupError.message}`)
      if (!existing || existing.status !== 'draft') return null
      const email = String(deliveryRecipient?.email || existing.submitter_email || '').trim().toLowerCase()
      const name = String(deliveryRecipient?.name || '').trim() || null
      const primary = evidenceReferences[0]
      const inputHash = createHash('sha256').update(JSON.stringify({ propertyId, evidenceReferences, note })).digest('hex')
      const now = new Date().toISOString()
      const { data, error } = await admin.from('inspection_pipeline_runs').update({
        inspection_report_id: primary.id,
        source_file_id: primary.sourceFileId,
        input_hash: inputHash,
        stage_statuses: { ...(existing.stage_statuses || {}), evidence_references: evidenceReferences, note, upload_status: 'uploaded' },
        delivery_recipient_name: name,
        delivery_recipient_email: email,
        delivery_recipient_source: email === String(existing.submitter_email || '').trim().toLowerCase() ? 'submitter_default' : 'manually_changed',
        last_activity_at: now,
      }).eq('id', requestId).eq('status', 'draft').select('id,property_id,status,created_at').maybeSingle()
      if (error) throw new Error(`Submission draft update failed: ${error.message}`)
      return data ? { id: data.id, propertyId: data.property_id, processingStatus: data.status, createdAt: data.created_at } : null
    },

    async markProcessing(id) {
      const now = new Date().toISOString()
      const { error } = await admin.from('inspection_pipeline_runs').update({ status: 'running', current_stage: 'document_extraction', workflow_state: 'processing', next_responsible_role: 'system', next_action: 'Process submitted evidence', last_activity_at: now, started_at: now }).eq('id', id)
      if (error) throw new Error(error.message)
    },

    async completeProcessing(id, artifact) {
      const { data: request, error: requestError } = await admin.from('inspection_pipeline_runs').select('*').eq('id', id).single()
      if (requestError) throw new Error(requestError.message)
      const { data: report, error: reportLookupError } = await admin.from('inspection_reports')
        .select('extraction_summary')
        .eq('id', request.inspection_report_id)
        .single()
      if (reportLookupError) throw new Error(`Inspection report lookup failed: ${reportLookupError.message}`)
      const { data: modelRun, error: modelError } = await admin.from('model_runs').insert({
        property_id: request.property_id,
        inspection_report_id: request.inspection_report_id,
        stage: 'inspection_interpretation',
        provider: 'local_existing_phase1',
        model: 'deterministic_round1_reasoning',
        prompt_version: artifact.schemaVersion || artifact.schema_version,
        input_hash: request.input_hash,
        input_references: request.stage_statuses?.evidence_references || [],
        output: artifact,
        status: 'draft_created',
        started_at: request.started_at,
        completed_at: new Date().toISOString(),
        review_required: true,
        memory_eligible: false,
      }).select('id').single()
      if (modelError) throw new Error(modelError.message)
      const rows = findingRows(artifact, request, modelRun.id)
      if (rows.length) {
        const { error: findingsError } = await admin.from('inspection_findings').insert(rows)
        if (findingsError) throw new Error(`Finding persistence failed: ${findingsError.message}`)
      }
      const pageCount = Number(artifact?.sourceDocument?.pageCount) || null
      const { error: reportError } = await admin.from('inspection_reports').update({
        page_count: pageCount,
        text_extraction_status: 'extracted',
        evidence_linking_status: 'linked',
        interpretation_status: 'draft_created',
        bundling_status: 'draft_created',
        review_status: 'needs_review',
        model_run_id: modelRun.id,
        extraction_summary: {
          ...(report.extraction_summary || {}),
          normalized_findings: rows.length,
          atomic_observations: rows.length,
          artifact_schema_version: artifact.schemaVersion || artifact.schema_version,
        },
      }).eq('id', request.inspection_report_id)
      if (reportError) throw new Error(`Inspection report update failed: ${reportError.message}`)
      const now = new Date().toISOString()
      const { error } = await admin.from('inspection_pipeline_runs').update({ status: 'needs_review', current_stage: 'human_review', workflow_state: 'under_review', next_responsible_role: 'reviewer', next_action: `Review ${rows.length} remaining findings`, last_activity_at: now, completed_at: now }).eq('id', id)
      if (error) throw new Error(error.message)
    },

    async failProcessing(id, message) {
      const now = new Date().toISOString()
      const { error } = await admin.from('inspection_pipeline_runs').update({ status: 'failed', workflow_state: 'failed', next_responsible_role: 'reviewer', next_action: 'Review processing failure', last_activity_at: now, error_message: message, completed_at: now }).eq('id', id)
      if (error) throw new Error(error.message)
    },

    async getNotificationContext(requestId) {
      const { data: request, error: requestError } = await admin.from('inspection_pipeline_runs')
        .select('id, property_id, work_request_id, requested_by, stage_statuses, submitter_email, delivery_recipient_email')
        .eq('id', requestId)
        .single()
      if (requestError) throw new Error(`Notification request lookup failed: ${requestError.message}`)
      const { data: property, error: propertyError } = await admin.from('properties')
        .select('source_address, address_line1, city, state, zip')
        .eq('id', request.property_id)
        .single()
      if (propertyError) throw new Error(`Notification Property lookup failed: ${propertyError.message}`)

      const evidenceIds = (request.stage_statuses?.evidence_references || []).map((item) => item.id).filter(Boolean)
      let evidence = []
      if (evidenceIds.length) {
        const { data, error } = await admin.from('inspection_reports').select('original_filename').in('id', evidenceIds)
        if (error) throw new Error(`Notification evidence lookup failed: ${error.message}`)
        evidence = data || []
      }
      let submittingEmail = null
      if (request.requested_by) {
        const { data } = await admin.auth.admin.getUserById(request.requested_by)
        submittingEmail = data?.user?.email || null
      }
      const propertyAddress = property.source_address || [property.address_line1, property.city, property.state, property.zip].filter(Boolean).join(', ')
      const names = evidence.map((item) => item.original_filename).filter(Boolean)
      const evidenceSummary = names.length
        ? `${names.length} evidence ${names.length === 1 ? 'file' : 'files'}: ${names.join(', ')}`
        : `${evidenceIds.length} evidence ${evidenceIds.length === 1 ? 'item' : 'items'}`
      return {
        propertyId: request.property_id,
        workRequestId: request.work_request_id,
        propertyAddress,
        submittingEmail,
        deliveryRecipient: request.delivery_recipient_email || request.submitter_email || submittingEmail,
        evidenceSummary,
      }
    },

    async claimNotification({ eventType, requestId, reportId = null, reportVersion = null, propertyId, workRequestId, recipient, provider }) {
      const selectExisting = () => {
        let query = admin.from('phase1_notifications').select('*')
          .eq('event_type', eventType)
          .eq('recipient', recipient)
          .eq('channel', 'email')
        query = eventType === 'reviewed_result_ready' && reportId
          ? query.eq('report_id', reportId)
          : query.eq('processing_request_id', requestId)
        if (eventType === 'reviewed_result_ready' && !reportId) query = query.is('report_id', null)
        return query.maybeSingle()
      }
      const { data: existing, error: existingError } = await selectExisting()
      if (existingError) throw new Error(`Notification lookup failed: ${existingError.message}`)
      if (existing?.delivery_status === 'sent' || existing?.delivery_status === 'sending') {
        return { notification: existing, shouldSend: false }
      }
      if (existing) {
        const { data, error } = await admin.from('phase1_notifications').update({
          delivery_status: 'sending',
          provider,
          failure_reason: null,
          attempt_count: existing.attempt_count + 1,
          last_attempt_at: new Date().toISOString(),
        }).eq('id', existing.id).in('delivery_status', ['pending', 'failed']).select('*').maybeSingle()
        if (error) throw new Error(`Notification retry claim failed: ${error.message}`)
        return data ? { notification: data, shouldSend: true } : { notification: existing, shouldSend: false }
      }

      const { data, error } = await admin.from('phase1_notifications').insert({
        event_type: eventType,
        processing_request_id: requestId,
        report_id: reportId,
        report_version: reportVersion,
        work_request_id: workRequestId,
        property_id: propertyId,
        recipient,
        channel: 'email',
        delivery_status: 'sending',
        provider,
        attempt_count: 1,
        last_attempt_at: new Date().toISOString(),
      }).select('*').single()
      if (!error) return { notification: data, shouldSend: true }
      if (error.code !== '23505') throw new Error(`Notification claim failed: ${error.message}`)
      const { data: raced, error: racedError } = await selectExisting()
      if (racedError || !raced) throw new Error(`Notification race lookup failed: ${racedError?.message || 'record missing'}`)
      return { notification: raced, shouldSend: false }
    },

    async markNotificationSent(id, providerMessageId) {
      const { error } = await admin.from('phase1_notifications').update({
        delivery_status: 'sent',
        provider_message_id: providerMessageId,
        sent_at: new Date().toISOString(),
        failure_reason: null,
      }).eq('id', id)
      if (error) throw new Error(`Notification delivery persistence failed: ${error.message}`)
    },

    async markNotificationFailed(id, reason) {
      const { error } = await admin.from('phase1_notifications').update({
        delivery_status: 'failed',
        failure_reason: String(reason).slice(0, 2000),
      }).eq('id', id)
      if (error) throw new Error(`Notification failure persistence failed: ${error.message}`)
    },

    async updateReviewedReportDelivery(reportId, values) {
      const { error } = await admin.from('phase1_reviewed_reports').update({ ...values, updated_at: new Date().toISOString() }).eq('id', reportId)
      if (error) throw new Error(`Reviewed report delivery update failed: ${error.message}`)
    },

    async getProcessingRequest({ actor, requestId }) {
      const client = userClient(tokens.get(actor.id))
      const { data: request, error } = await client.from('inspection_pipeline_runs').select('*').eq('id', requestId).maybeSingle()
      if (error) throw new Error(error.message)
      if (!request) return null
      let artifact = null
      let totalFindingCount = 0
      const reviewer = await isReviewerId(actor.id)
      if (['needs_review', 'completed'].includes(request.status)) {
        const { data: modelRun, error: modelError } = await client.from('model_runs').select('id,output').eq('property_id', request.property_id).eq('input_hash', request.input_hash).eq('stage', 'inspection_interpretation').maybeSingle()
        if (modelError) throw new Error(modelError.message)
        artifact = modelRun?.output ? structuredClone(modelRun.output) : null
        if (artifact && modelRun?.id) {
          const { data: findings, error: findingsError } = await client.from('inspection_findings')
            .select('id,source_item_number,review_status,review_event_id,reviewed_value,reviewed_by,reviewed_at')
            .eq('model_run_id', modelRun.id)
          if (findingsError) throw new Error(findingsError.message)
          totalFindingCount = (findings || []).length
          const eventIds = (findings || []).map((item) => item.review_event_id).filter(Boolean)
          let events = []
          if (eventIds.length) {
            const result = await client.from('review_events')
              .select('id,reviewer_id,review_action,new_value,reason,created_at')
              .in('id', eventIds)
            if (result.error) throw new Error(result.error.message)
            events = result.data || []
          }
          const eventsById = new Map(events.map((event) => [event.id, event]))
          for (const finding of findings || []) {
            const storedEvent = eventsById.get(finding.review_event_id)
            if (storedEvent && finding.reviewed_value && Object.keys(finding.reviewed_value).length) {
              eventsById.set(storedEvent.id, {
                ...storedEvent,
                new_value: { ...(storedEvent.new_value || {}), corrections: finding.reviewed_value },
              })
            }
          }
          artifact.reviewState = Object.fromEntries((findings || []).map((finding) => {
            const observation = (artifact.atomicObservations || []).find((item) => item.source?.source_item_number === finding.source_item_number)
            const storedEvent = eventsById.get(finding.review_event_id) || null
            return [observation?.id || finding.source_item_number, {
              findingId: finding.id,
              status: finding.review_status,
              event: storedEvent,
            }]
          }))
          if (!reviewer) artifact = request.status === 'completed' ? agentArtifact(artifact, findings || [], eventsById) : null
        }
      }
      const state = request.status === 'running' ? 'processing'
        : request.status === 'needs_review' ? (reviewer ? 'completed' : 'under_review')
          : request.status === 'completed' ? (reviewer ? 'completed' : 'ready') : request.status
      const evidenceIds = (request.stage_statuses?.evidence_references || []).map((item) => item.id).filter(Boolean)
      const { data: reports, error: reportsError } = evidenceIds.length
        ? await client.from('inspection_reports').select('id,source_file_id,original_filename,extraction_summary').in('id', evidenceIds)
        : { data: [], error: null }
      if (reportsError) throw new Error(reportsError.message)
      const { data: property, error: propertyError } = await client.from('properties')
        .select('source_address,address_line1,city,state,zip')
        .eq('id', request.property_id)
        .maybeSingle()
      if (propertyError) throw new Error(propertyError.message)
      const propertyAddress = property?.source_address || [property?.address_line1, property?.city, property?.state, property?.zip].filter(Boolean).join(', ') || 'Property address unavailable'
      const { data: delivery, error: deliveryError } = await admin.from('phase1_notifications')
        .select('recipient,delivery_status,sent_at,provider_message_id,failure_reason,attempt_count')
        .eq('event_type', 'reviewed_result_ready')
        .eq('processing_request_id', request.id)
        .maybeSingle()
      if (deliveryError) throw new Error(`Reviewed-result delivery lookup failed: ${deliveryError.message}`)
      return {
        id: request.id,
        propertyId: request.property_id,
        processingStatus: state,
        audience: reviewer ? 'reviewer' : 'agent',
        totalFindingCount,
        artifactVersion: artifact?.schemaVersion || artifact?.schema_version || request.released_artifact_version || null,
        artifact,
        error: request.error_message || null,
        submission: {
          propertyAddress,
          submitterName: request.submitter_name || null,
          submitterEmail: request.submitter_email || actor.email || null,
          submittedAt: request.submitted_at || request.created_at,
          note: request.stage_statuses?.note || '',
          evidence: (reports || []).map((report) => ({ id: report.id, sourceFileId: report.source_file_id, name: report.original_filename || 'Evidence file', mediaType: report.extraction_summary?.media_type || null })),
          deliveryRecipientName: request.delivery_recipient_name || null,
          deliveryRecipientEmail: request.delivery_recipient_email || request.submitter_email || actor.email || null,
          deliveryRecipientSource: request.delivery_recipient_source || 'submitter_default',
          workflowState: request.workflow_state || null,
          nextResponsibleRole: request.next_responsible_role || null,
          nextAction: request.next_action || null,
          lastActivityAt: request.last_activity_at || request.updated_at || request.created_at,
          lastViewedObservationId: request.last_viewed_observation_id || null,
          releasedArtifactVersion: request.released_artifact_version || null,
          releasedAt: request.released_at || null,
          delivery: delivery || null,
        },
      }
    },

    async getSourceDocument({ actor, requestId }) {
      const client = userClient(tokens.get(actor.id))
      const { data: request, error: requestError } = await client.from('inspection_pipeline_runs')
        .select('inspection_report_id')
        .eq('id', requestId)
        .maybeSingle()
      if (requestError) throw new Error(`Source request lookup failed: ${requestError.message}`)
      if (!request) return null
      const { data: report, error: reportError } = await client.from('inspection_reports')
        .select('source_storage_bucket,source_storage_path,original_filename,extraction_summary')
        .eq('id', request.inspection_report_id)
        .maybeSingle()
      if (reportError) throw new Error(`Source report lookup failed: ${reportError.message}`)
      if (!report?.source_storage_bucket || !report?.source_storage_path) return null
      const { data: blob, error: downloadError } = await client.storage.from(report.source_storage_bucket).download(report.source_storage_path)
      if (downloadError) throw new Error(`Source report download failed: ${downloadError.message}`)
      return {
        body: new Uint8Array(await blob.arrayBuffer()),
        contentType: report.extraction_summary?.media_type || blob.type || 'application/pdf',
        filename: report.original_filename || 'inspection-report.pdf',
      }
    },

    async listReviewQueue({ actor }) {
      if (!await isReviewerId(actor.id)) throw new Error('Reviewer access is required.')
      const { data: requests, error: requestError } = await admin.from('inspection_pipeline_runs')
        .select('id,property_id,inspection_report_id,input_hash,requested_by,status,created_at,updated_at,last_activity_at,last_viewed_observation_id,workflow_state,next_responsible_role,next_action,submitter_name,submitter_email,delivery_recipient_email,released_artifact_version,released_at,error_message')
        .in('status', ['queued', 'running', 'needs_review', 'completed', 'failed'])
        .order('last_activity_at', { ascending: false })
        .limit(100)
      if (requestError) throw new Error(`Review queue lookup failed: ${requestError.message}`)
      const propertyIds = [...new Set((requests || []).map((item) => item.property_id).filter(Boolean))]
      const { data: properties, error: propertyError } = propertyIds.length
        ? await admin.from('properties').select('id,source_address,address_line1,city,state,zip').in('id', propertyIds)
        : { data: [], error: null }
      if (propertyError) throw new Error(`Review queue Property lookup failed: ${propertyError.message}`)
      const propertyById = new Map((properties || []).map((item) => [item.id, item]))
      const { data: queueReports, error: queueReportsError } = propertyIds.length
        ? await admin.from('phase1_reviewed_reports').select('id,property_id,report_version,report_status').in('property_id', propertyIds).in('report_status', ['released', 'superseded']).order('report_version', { ascending: false })
        : { data: [], error: null }
      if (queueReportsError) throw new Error(`Review queue report history failed: ${queueReportsError.message}`)
      const latestQueueReport = new Map()
      for (const report of queueReports || []) if (!latestQueueReport.has(report.property_id)) latestQueueReport.set(report.property_id, report)
      const requesterIds = [...new Set((requests || []).map((item) => item.requested_by).filter(Boolean))]
      const emailById = new Map()
      await Promise.all(requesterIds.map(async (id) => {
        const { data } = await admin.auth.admin.getUserById(id)
        if (data?.user?.email) emailById.set(id, data.user.email)
      }))
      const requestIds = (requests || []).map((item) => item.id)
      const { data: deliveries, error: deliveryError } = requestIds.length
        ? await admin.from('phase1_notifications').select('processing_request_id,recipient,delivery_status,sent_at,provider_message_id,failure_reason,attempt_count').eq('event_type', 'reviewed_result_ready').in('processing_request_id', requestIds)
        : { data: [], error: null }
      if (deliveryError) throw new Error(`Review queue delivery lookup failed: ${deliveryError.message}`)
      const deliveryByRequest = new Map((deliveries || []).map((item) => [item.processing_request_id, item]))

      const items = []
      for (const request of requests || []) {
        const { data: modelRun } = await admin.from('model_runs')
          .select('id,output')
          .eq('property_id', request.property_id)
          .eq('input_hash', request.input_hash)
          .eq('stage', 'inspection_interpretation')
          .maybeSingle()
        const { data: findings } = modelRun?.id
          ? await admin.from('inspection_findings').select('review_status,review_event_id').eq('model_run_id', modelRun.id)
          : { data: [] }
        const eventIds = (findings || []).map((item) => item.review_event_id).filter(Boolean)
        const { data: events } = eventIds.length
          ? await admin.from('review_events').select('id,review_action').in('id', eventIds)
          : { data: [] }
        const actionByEvent = new Map((events || []).map((event) => [event.id, event.review_action]))
        const terminalActions = new Set(['approve', 'needs_more_info', 'reject'])
        const waiting = (findings || []).some((finding) => actionByEvent.get(finding.review_event_id) === 'needs_more_info')
        const reviewedCount = (findings || []).filter((finding) => terminalActions.has(actionByEvent.get(finding.review_event_id))).length
        const remainingCount = Math.max((findings || []).length - reviewedCount, 0)
        const priorities = (modelRun?.output?.atomicObservations || []).map((entry) => entry.review_workflow?.priority).filter(Boolean)
        const priority = priorities.includes('waiting_for_evidence') ? 'waiting_for_evidence'
          : priorities.includes('careful_review') ? 'careful_review' : 'quick_review'
        const property = propertyById.get(request.property_id) || {}
        const propertyAddress = property.source_address || [property.address_line1, property.city, property.state, property.zip].filter(Boolean).join(', ')
        const queueStatus = request.status === 'failed' ? 'failed'
          : request.status === 'completed' ? 'released'
            : waiting && remainingCount > 0 ? 'waiting_for_evidence'
              : request.status === 'queued' || request.status === 'running' ? 'processing'
                : reviewedCount > 0 ? 'in_review' : 'needs_review'
        items.push({
          requestId: request.id,
          propertyId: request.property_id,
          propertyAddress: propertyAddress || 'Property address unavailable',
          submittingAgent: request.submitter_name || request.submitter_email || emailById.get(request.requested_by) || 'Authenticated submitter',
          findingCount: (findings || []).length,
          reviewedCount,
          remainingCount,
          reviewPriority: priority,
          queueStatus,
          createdAt: request.created_at,
          lastActivityAt: request.last_activity_at || request.updated_at || request.created_at,
          lastViewedObservationId: request.last_viewed_observation_id || null,
          nextResponsibleRole: request.next_responsible_role || (queueStatus === 'released' ? 'submitter' : 'reviewer'),
          nextAction: request.status === 'completed' ? 'View reviewed result' : remainingCount ? `Review ${remainingCount} remaining findings` : 'Generate reviewed report',
          deliveryRecipientEmail: request.delivery_recipient_email || request.submitter_email || null,
          releasedArtifactVersion: request.released_artifact_version || null,
          releasedAt: request.released_at || null,
          delivery: deliveryByRequest.get(request.id) || null,
          error: request.error_message || null,
          latestReportId: latestQueueReport.get(request.property_id)?.id || null,
          latestReportVersion: latestQueueReport.get(request.property_id)?.report_version || null,
        })
      }
      return items
    },

    async listMyProperties({ actor }) {
      const { data: requests, error } = await admin.from('inspection_pipeline_runs')
        .select('id,property_id,status,created_at,submitted_at,last_activity_at,workflow_state,next_responsible_role,next_action,delivery_recipient_email,delivery_recipient_name,released_artifact_version,released_at')
        .eq('requested_by', actor.id)
        .neq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw new Error(`Property history lookup failed: ${error.message}`)
      const propertyIds = [...new Set((requests || []).map((item) => item.property_id).filter(Boolean))]
      const { data: properties, error: propertyError } = propertyIds.length
        ? await admin.from('properties').select('id,source_address,address_line1,city,state,zip').in('id', propertyIds)
        : { data: [], error: null }
      if (propertyError) throw new Error(`Property history address lookup failed: ${propertyError.message}`)
      const propertyById = new Map((properties || []).map((item) => [item.id, item]))
      const { data: reviewedReports, error: reviewedReportsError } = propertyIds.length
        ? await admin.from('phase1_reviewed_reports').select('id,property_id,report_version,report_status').in('property_id', propertyIds).in('report_status', ['released', 'superseded']).order('report_version', { ascending: false })
        : { data: [], error: null }
      if (reviewedReportsError) throw new Error(`Reviewed report history lookup failed: ${reviewedReportsError.message}`)
      const latestReportByProperty = new Map()
      for (const report of reviewedReports || []) if (!latestReportByProperty.has(report.property_id)) latestReportByProperty.set(report.property_id, report)
      const requestIds = (requests || []).map((item) => item.id)
      const { data: deliveries, error: deliveryError } = requestIds.length
        ? await admin.from('phase1_notifications').select('processing_request_id,recipient,delivery_status,sent_at,provider_message_id,failure_reason,attempt_count').eq('event_type', 'reviewed_result_ready').in('processing_request_id', requestIds)
        : { data: [], error: null }
      if (deliveryError) throw new Error(`Property history delivery lookup failed: ${deliveryError.message}`)
      const deliveryByRequest = new Map((deliveries || []).map((item) => [item.processing_request_id, item]))
      return (requests || []).map((request) => {
        const property = propertyById.get(request.property_id) || {}
        const address = property.source_address || [property.address_line1, property.city, property.state, property.zip].filter(Boolean).join(', ') || 'Property address unavailable'
        const status = request.status === 'completed' ? 'Ready'
          : request.workflow_state === 'needs_information' ? 'Needs Information'
            : request.status === 'needs_review' ? 'Under Review'
              : ['running', 'failed'].includes(request.status) ? 'Processing' : 'Submitted'
        const submitterNextAction = status === 'Ready' ? 'View reviewed result'
          : status === 'Needs Information' ? 'Add requested evidence'
            : status === 'Under Review' ? 'Await reviewed result'
              : status === 'Processing' ? 'View submission status' : 'View submission'
        return {
          requestId: request.id,
          propertyId: request.property_id,
          propertyAddress: address,
          submittedAt: request.submitted_at || request.created_at,
          lastActivityAt: request.last_activity_at || request.created_at,
          status,
          resultRecipientName: request.delivery_recipient_name || null,
          resultRecipientEmail: request.delivery_recipient_email || actor.email || null,
          nextResponsibleRole: request.next_responsible_role || 'system',
          nextAction: submitterNextAction,
          releasedArtifactVersion: request.released_artifact_version || null,
          releasedAt: request.released_at || null,
          delivery: deliveryByRequest.get(request.id) || null,
          latestReportId: latestReportByProperty.get(request.property_id)?.id || null,
          latestReportVersion: latestReportByProperty.get(request.property_id)?.report_version || null,
        }
      })
    },

    async saveReviewPosition({ actor, requestId, observationId }) {
      if (!await isReviewerId(actor.id)) return null
      const { data: request, error: requestError } = await admin.from('inspection_pipeline_runs')
        .select('id,property_id,input_hash,status')
        .eq('id', requestId)
        .maybeSingle()
      if (requestError) throw new Error(`Review position lookup failed: ${requestError.message}`)
      if (!request || !['needs_review', 'completed'].includes(request.status)) return null
      const { data: modelRun, error: modelError } = await admin.from('model_runs')
        .select('output')
        .eq('property_id', request.property_id)
        .eq('input_hash', request.input_hash)
        .eq('stage', 'inspection_interpretation')
        .maybeSingle()
      if (modelError) throw new Error(`Review position artifact lookup failed: ${modelError.message}`)
      if (!(modelRun?.output?.atomicObservations || []).some((item) => item.id === observationId)) return null
      const now = new Date().toISOString()
      const { data, error } = await admin.from('inspection_pipeline_runs').update({
        last_viewed_observation_id: observationId,
        last_activity_at: now,
        next_responsible_role: request.status === 'completed' ? 'submitter' : 'reviewer',
      }).eq('id', requestId).select('id,last_viewed_observation_id,last_activity_at').single()
      if (error) throw new Error(`Review position persistence failed: ${error.message}`)
      return data
    },

    async reviewFinding({ actor, requestId, observationId, action, newValue, reason }) {
      const client = userClient(tokens.get(actor.id))
      const { data: request, error: requestError } = await client.from('inspection_pipeline_runs')
        .select('id,property_id,input_hash')
        .eq('id', requestId)
        .maybeSingle()
      if (requestError) throw new Error(requestError.message)
      if (!request) return null
      const { data: modelRun, error: modelError } = await client.from('model_runs')
        .select('id,output')
        .eq('property_id', request.property_id)
        .eq('input_hash', request.input_hash)
        .eq('stage', 'inspection_interpretation')
        .maybeSingle()
      if (modelError) throw new Error(modelError.message)
      const observation = (modelRun?.output?.atomicObservations || []).find((item) => item.id === observationId)
      if (!observation) return null
      const itemNumber = observation.source?.source_item_number
      const { data: finding, error: findingError } = await client.from('inspection_findings')
        .select('id')
        .eq('model_run_id', modelRun.id)
        .eq('source_item_number', itemNumber)
        .maybeSingle()
      if (findingError) throw new Error(findingError.message)
      if (!finding) return null
      const { data: eventId, error: reviewError } = await client.rpc('phase1_review_inspection_finding', {
        p_finding_id: finding.id,
        p_review_action: action,
        p_new_value: newValue,
        p_reason: reason || null,
      })
      if (reviewError) throw new Error(`Review action failed: ${reviewError.message}`)
      const { data: reviewed, error: reviewedError } = await client.from('inspection_findings')
        .select('id,review_status,review_event_id,reviewed_value,reviewed_by,reviewed_at')
        .eq('id', finding.id)
        .single()
      if (reviewedError) throw new Error(reviewedError.message)
      const { data: persistedEvent, error: eventError } = await client.from('review_events')
        .select('id,new_value,previous_value,reason,created_at')
        .eq('id', eventId)
        .single()
      if (eventError) throw new Error(`Review audit verification failed: ${eventError.message}`)
      if (reviewed.review_event_id !== eventId || persistedEvent.id !== eventId) {
        throw new Error('Review correction and audit event are inconsistent.')
      }
      return {
        findingId: reviewed.id,
        status: reviewed.review_status,
        eventId,
        canonicalValue: reviewed.reviewed_value,
        reviewedBy: reviewed.reviewed_by,
        reviewedAt: reviewed.reviewed_at,
        changedFields: persistedEvent.new_value?.changed_fields || {},
      }
    },

    async reserveReviewedReport({ actor, requestId, recipient, artifactSchemaVersion }) {
      if (!await isReviewerId(actor.id)) throw new Error('Reviewer access is required.')
      const { data, error } = await admin.rpc('phase1_reserve_reviewed_report', {
        target_request_id: requestId, target_reviewer_id: actor.id,
        target_recipient: recipient, target_artifact_schema_version: artifactSchemaVersion,
      })
      if (error) throw new Error(`Reviewed report reservation failed: ${error.message}`)
      return data
    },

    async completeReviewedReport({ report, document, findingVersions, pricingVersions, pdf }) {
      const path = `${report.property_id}/${report.id}/shelter-prep-reviewed-report-v${report.report_version}.pdf`
      const checksum = createHash('sha256').update(pdf).digest('hex')
      const { error: uploadError } = await admin.storage.from('phase1-reviewed-reports').upload(path, pdf, { contentType: 'application/pdf', upsert: false })
      if (uploadError) {
        await admin.from('phase1_reviewed_reports').update({ report_status: 'storage_failed', generation_failure: uploadError.message }).eq('id', report.id)
        throw new Error(`Reviewed report storage failed: ${uploadError.message}`)
      }
      const { data, error } = await admin.from('phase1_reviewed_reports').update({
        reviewed_artifact: document,
        reviewed_finding_versions: findingVersions,
        reviewed_pricing_versions: pricingVersions,
        local_professional_research: document.localProfessionals,
        pdf_bucket: 'phase1-reviewed-reports', pdf_object_path: path,
        pdf_sha256: checksum, pdf_size_bytes: pdf.byteLength,
        report_status: 'draft', generated_at: document.generatedAt, updated_at: document.generatedAt,
      }).eq('id', report.id).eq('report_status', 'generating').select('*').single()
      if (error) {
        await admin.storage.from('phase1-reviewed-reports').remove([path])
        throw new Error(`Reviewed report persistence failed: ${error.message}`)
      }
      return data
    },

    async failReviewedReport(reportId, reason) {
      await admin.from('phase1_reviewed_reports').update({ report_status: 'generation_failed', generation_failure: String(reason).slice(0, 2000), updated_at: new Date().toISOString() }).eq('id', reportId).eq('report_status', 'generating')
    },

    async getReviewedReport({ actor, reportId }) {
      const { data, error } = await admin.from('phase1_reviewed_reports').select('*').eq('id', reportId).maybeSingle()
      if (error) throw new Error(`Reviewed report lookup failed: ${error.message}`)
      if (!data) return null
      const reviewer = await isReviewerId(actor.id)
      const { data: request } = data.processing_request_id
        ? await admin.from('inspection_pipeline_runs').select('requested_by').eq('id', data.processing_request_id).maybeSingle()
        : { data: null }
      const submitter = request?.requested_by === actor.id
      if (!reviewer && (!submitter || !['released', 'superseded'].includes(data.report_status))) return null
      const { data: reviewerProfile } = data.reviewer_id ? await admin.from('profiles').select('full_name').eq('id', data.reviewer_id).maybeSingle() : { data: null }
      return { ...data, reviewer_name: reviewerProfile?.full_name || 'Shelter Prep reviewer' }
    },

    async listPropertyReports({ actor, propertyId }) {
      if (!await this.canAccessProperty(actor.id, propertyId) && !await isReviewerId(actor.id)) return []
      let query = admin.from('phase1_reviewed_reports').select('id,property_id,processing_request_id,report_version,artifact_schema_version,report_status,recipient,reviewer_id,generated_at,released_at,delivery_status,sent_at,created_at').eq('property_id', propertyId).order('report_version', { ascending: false })
      if (!await isReviewerId(actor.id)) query = query.in('report_status', ['released', 'superseded'])
      const { data, error } = await query
      if (error) throw new Error(`Property report history failed: ${error.message}`)
      const reviewerIds = [...new Set((data || []).map((item) => item.reviewer_id).filter(Boolean))]
      const { data: reviewers } = reviewerIds.length ? await admin.from('profiles').select('id,full_name').in('id', reviewerIds) : { data: [] }
      const names = new Map((reviewers || []).map((item) => [item.id, item.full_name]))
      return (data || []).map((item) => ({ ...item, reviewer_name: names.get(item.reviewer_id) || 'Shelter Prep reviewer' }))
    },

    async createReviewedReportAccess({ actor, reportId }) {
      const report = await this.getReviewedReport({ actor, reportId })
      if (!report?.pdf_object_path) return null
      const { data, error } = await admin.storage.from(report.pdf_bucket).createSignedUrl(report.pdf_object_path, 300, { download: `shelter-prep-reviewed-report-v${report.report_version}.pdf` })
      if (error) throw new Error(`Reviewed report access failed: ${error.message}`)
      return { url: data.signedUrl, expiresIn: 300 }
    },

    async releaseReviewedReportVersion({ actor, reportId }) {
      if (!await isReviewerId(actor.id)) throw new Error('Reviewer access is required.')
      const { data, error } = await admin.rpc('phase1_release_reviewed_report', { target_report_id: reportId, target_reviewer_id: actor.id })
      if (error) throw new Error(`Reviewed report release failed: ${error.message}`)
      return data
    },
  }
}
