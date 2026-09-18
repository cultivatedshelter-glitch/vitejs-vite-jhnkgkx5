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

  return {
    async authenticate(token) {
      const { data, error } = await admin.auth.getUser(token)
      if (error || !data.user) return null
      tokens.set(data.user.id, token)
      return { id: data.user.id }
    },

    async canAccessProperty(actorId, propertyId) {
      const client = userClient(tokens.get(actorId))
      const { data, error } = await client.from('properties').select('id').eq('id', propertyId).maybeSingle()
      if (error) throw new Error(`Property authorization failed: ${error.message}`)
      return Boolean(data)
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

    async releaseEvidence(evidence) {
      const dirs = [...new Set(evidence.map((item) => item.workDir).filter(Boolean))]
      await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })))
    },

    async createProcessingRequest({ actor, propertyId, evidenceReferences, note }) {
      const primary = evidenceReferences[0]
      const inputHash = createHash('sha256').update(JSON.stringify({ propertyId, evidenceReferences, note })).digest('hex')
      const { data, error } = await admin.from('inspection_pipeline_runs').insert({
        property_id: propertyId,
        inspection_report_id: primary.id,
        source_file_id: primary.sourceFileId,
        input_hash: inputHash,
        requested_by: actor.id,
        stage_statuses: { evidence_references: evidenceReferences, note, upload_status: 'uploaded' },
        status: 'queued',
      }).select('*').single()
      if (error) throw new Error(`Processing request failed: ${error.message}`)
      return { id: data.id, propertyId, processingStatus: 'queued', createdAt: data.created_at }
    },

    async markProcessing(id) {
      const { error } = await admin.from('inspection_pipeline_runs').update({ status: 'running', current_stage: 'document_extraction', started_at: new Date().toISOString() }).eq('id', id)
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
      const { error } = await admin.from('inspection_pipeline_runs').update({ status: 'needs_review', current_stage: 'human_review', completed_at: new Date().toISOString() }).eq('id', id)
      if (error) throw new Error(error.message)
    },

    async failProcessing(id, message) {
      const { error } = await admin.from('inspection_pipeline_runs').update({ status: 'failed', error_message: message, completed_at: new Date().toISOString() }).eq('id', id)
      if (error) throw new Error(error.message)
    },

    async getNotificationContext(requestId) {
      const { data: request, error: requestError } = await admin.from('inspection_pipeline_runs')
        .select('id, property_id, work_request_id, requested_by, stage_statuses')
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
        evidenceSummary,
      }
    },

    async claimNotification({ eventType, requestId, propertyId, workRequestId, recipient, provider }) {
      const selectExisting = () => admin.from('phase1_notifications').select('*')
        .eq('event_type', eventType)
        .eq('processing_request_id', requestId)
        .eq('recipient', recipient)
        .eq('channel', 'email')
        .maybeSingle()
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

    async getProcessingRequest({ actor, requestId }) {
      const client = userClient(tokens.get(actor.id))
      const { data: request, error } = await client.from('inspection_pipeline_runs').select('*').eq('id', requestId).maybeSingle()
      if (error) throw new Error(error.message)
      if (!request) return null
      let artifact = null
      if (['needs_review', 'completed'].includes(request.status)) {
        const { data: modelRun, error: modelError } = await client.from('model_runs').select('id,output').eq('property_id', request.property_id).eq('input_hash', request.input_hash).eq('stage', 'inspection_interpretation').maybeSingle()
        if (modelError) throw new Error(modelError.message)
        artifact = modelRun?.output ? structuredClone(modelRun.output) : null
        if (artifact && modelRun?.id) {
          const { data: findings, error: findingsError } = await client.from('inspection_findings')
            .select('id,source_item_number,review_status,review_event_id')
            .eq('model_run_id', modelRun.id)
          if (findingsError) throw new Error(findingsError.message)
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
          artifact.reviewState = Object.fromEntries((findings || []).map((finding) => {
            const observation = (artifact.atomicObservations || []).find((item) => item.source?.source_item_number === finding.source_item_number)
            return [observation?.id || finding.source_item_number, {
              findingId: finding.id,
              status: finding.review_status,
              event: eventsById.get(finding.review_event_id) || null,
            }]
          }))
        }
      }
      const state = request.status === 'running' ? 'processing' : request.status === 'needs_review' || request.status === 'completed' ? 'completed' : request.status
      return { id: request.id, propertyId: request.property_id, processingStatus: state, artifactVersion: artifact?.schemaVersion || artifact?.schema_version || null, artifact, error: request.error_message || null }
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
        .select('id,review_status,review_event_id')
        .eq('id', finding.id)
        .single()
      if (reviewedError) throw new Error(reviewedError.message)
      return { findingId: reviewed.id, status: reviewed.review_status, eventId }
    },
  }
}
