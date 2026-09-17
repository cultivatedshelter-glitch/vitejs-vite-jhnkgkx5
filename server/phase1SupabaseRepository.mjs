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

      const { data, error } = await client.from('properties').insert({
        created_by: actor.id,
        address_line1: address,
        source_address: address,
        normalized_address: normalizedAddress,
        status: 'active',
        metadata: { created_via: 'phase1_guided_intake' },
      }).select('id, source_address, address_line1, city, state, zip, normalized_address').single()
      if (error) throw new Error(`Property creation failed: ${error.message}`)
      return { ...data, address: data.source_address || data.address_line1, created: true }
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
      const { error: modelError } = await admin.from('model_runs').insert({
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
      })
      if (modelError) throw new Error(modelError.message)
      const { error } = await admin.from('inspection_pipeline_runs').update({ status: 'needs_review', current_stage: 'human_review', completed_at: new Date().toISOString() }).eq('id', id)
      if (error) throw new Error(error.message)
    },

    async failProcessing(id, message) {
      await admin.from('inspection_pipeline_runs').update({ status: 'failed', error_message: message, completed_at: new Date().toISOString() }).eq('id', id)
    },

    async getProcessingRequest({ actor, requestId }) {
      const client = userClient(tokens.get(actor.id))
      const { data: request, error } = await client.from('inspection_pipeline_runs').select('*').eq('id', requestId).maybeSingle()
      if (error) throw new Error(error.message)
      if (!request) return null
      let artifact = null
      if (['needs_review', 'completed'].includes(request.status)) {
        const { data: modelRun, error: modelError } = await client.from('model_runs').select('output').eq('property_id', request.property_id).eq('input_hash', request.input_hash).eq('stage', 'inspection_interpretation').maybeSingle()
        if (modelError) throw new Error(modelError.message)
        artifact = modelRun?.output || null
      }
      const state = request.status === 'running' ? 'processing' : request.status === 'needs_review' || request.status === 'completed' ? 'completed' : request.status
      return { id: request.id, propertyId: request.property_id, processingStatus: state, artifactVersion: artifact?.schemaVersion || artifact?.schema_version || null, artifact, error: request.error_message || null }
    },
  }
}
