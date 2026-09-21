import { validatePhase1Artifact } from './phase1ArtifactValidator.mjs'
import { buildReviewedReportDocument, reviewedFindingVersions, reviewedPricingVersions } from './phase1ReviewedReport.mjs'
import { generateReviewedReportPdf } from './phase1ReviewedReportPdf.mjs'
import { createLocalProfessionalResearch } from './phase1LocalProfessionals.mjs'

export class ProcessingError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

export function createPhase1ProcessingService({ repository, reasoningRunner, notifications = null, pdfGenerator = generateReviewedReportPdf, localProfessionalResearch = createLocalProfessionalResearch(), logger = console }) {
  const REVIEW_ACTIONS = new Set(['approve', 'edit', 'needs_more_info', 'reject'])
  const TERMINAL_REVIEW_ACTIONS = new Set(['approve', 'needs_more_info', 'reject'])
  const EDITABLE_FIELDS = new Set(['title', 'interpretation', 'known', 'unknown', 'affected_location', 'repair_paths', 'next_step', 'rationale', 'likely_trade', 'price', 'evidence_relationship', 'confirmed_evidence', 'field_knowledge'])
  async function requireActor(token) {
    if (!token) throw new ProcessingError('authorization_failed', 'Sign in is required to process property evidence.', 401)
    const actor = await repository.authenticate(token)
    if (!actor) throw new ProcessingError('authorization_failed', 'The session is not authorized.', 401)
    return actor
  }

  async function requireReviewer(token) {
    const actor = await requireActor(token)
    if (repository.isReviewer && !await repository.isReviewer(actor.id)) {
      throw new ProcessingError('authorization_failed', 'Reviewer access is required.', 403)
    }
    return actor
  }

  function normalizeRecipient(value, fallbackEmail = '') {
    const email = String(value?.email || fallbackEmail || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ProcessingError('delivery_recipient_invalid', 'Enter a valid email address for the reviewed result.')
    }
    return { name: String(value?.name || '').trim() || null, email, source: email === String(fallbackEmail || '').trim().toLowerCase() ? 'submitter_default' : 'manually_changed' }
  }

  function reviewSummary(artifact) {
    const observations = Array.isArray(artifact?.atomicObservations) ? artifact.atomicObservations : []
    const states = artifact?.reviewState && typeof artifact.reviewState === 'object' ? artifact.reviewState : {}
    const actions = observations.map((observation) => states[observation.id]?.event?.review_action || null)
    const approved = actions.filter((action) => action === 'approve').length
    const needsInfo = actions.filter((action) => action === 'needs_more_info').length
    const rejected = actions.filter((action) => action === 'reject').length
    const reviewed = actions.filter((action) => TERMINAL_REVIEW_ACTIONS.has(action)).length
    return { total: observations.length, reviewed, approved, needsInfo, rejected, remaining: Math.max(observations.length - reviewed, 0) }
  }

  async function queueProcessing({ request, actor, propertyId, evidenceReferences, note }) {
    const evidence = await repository.resolveEvidence({ actor, propertyId, evidenceReferences })
    if (evidence.length !== evidenceReferences.length) {
      await repository.releaseEvidence?.(evidence)
      throw new ProcessingError('authorization_failed', 'One or more evidence references do not belong to this property.', 403)
    }
    queueMicrotask(async () => {
      try {
        await repository.markProcessing(request.id)
        const artifact = await reasoningRunner({ propertyId, evidence, note, actor })
        validatePhase1Artifact(artifact, { propertyId })
        const propertyAddress = repository.getPropertyAddress
          ? await repository.getPropertyAddress({ actor, propertyId })
          : null
        artifact.localProfessionals = propertyAddress
          ? await localProfessionalResearch({ artifact, propertyAddress, reviewedOnly: false })
          : { groups: [], lookups: [{ trade: 'Property', status: 'skipped_missing_property_address', provider: 'Google Places' }] }
        await repository.completeProcessing(request.id, artifact)
        if (notifications) {
          try {
            await notifications.notifyNeedsReview({ requestId: request.id, artifact })
          } catch (notificationError) {
            logger.error('Phase 1 needs-review notification could not be recorded.', {
              requestId: request.id,
              error: notificationError instanceof Error ? notificationError.message : 'Notification failed.',
            })
          }
        }
      } catch (error) {
        await repository.failProcessing(request.id, error instanceof Error ? error.message : 'Processing failed.')
        if (notifications) {
          try {
            await notifications.notifyProcessingFailed({ requestId: request.id })
          } catch (notificationError) {
            logger.error('Phase 1 processing-failure notification could not be recorded.', {
              requestId: request.id,
              error: notificationError instanceof Error ? notificationError.message : 'Notification failed.',
            })
          }
        }
      } finally {
        await repository.releaseEvidence?.(evidence)
      }
    })
    return request
  }

  async function identity({ token }) {
    const actor = await requireActor(token)
    return repository.getActorProfile({ actor })
  }

  async function upload({ token, propertyId, files }) {
    const actor = await requireActor(token)
    if (!propertyId || !await repository.canAccessProperty(actor.id, propertyId)) {
      throw new ProcessingError('authorization_failed', 'You do not have access to this property.', 403)
    }
    if (!files.length) throw new ProcessingError('source_unavailable', 'Choose at least one evidence file.')
    const references = []
    for (const file of files) references.push(await repository.storeEvidence({ actor, propertyId, file }))
    return { propertyId, processingStatus: 'uploaded', evidenceReferences: references }
  }

  async function resolveProperty({ token, address }) {
    const actor = await requireActor(token)
    if (typeof address !== 'string' || !address.trim()) {
      throw new ProcessingError('property_address_required', 'Enter a property address before continuing.')
    }
    const property = await repository.resolveOrCreateProperty({ actor, address: address.trim() })
    if (!property?.id) throw new ProcessingError('property_persistence_failed', 'The property workspace could not be created.', 503)
    return property
  }

  async function createSubmissionDraft({ token, propertyId, evidenceReferences, note = '', deliveryRecipient = null }) {
    const actor = await requireActor(token)
    if (!propertyId || !await repository.canAccessProperty(actor.id, propertyId)) {
      throw new ProcessingError('authorization_failed', 'You do not have access to this property.', 403)
    }
    if (!evidenceReferences.length || !await repository.validateEvidenceReferences({ actor, propertyId, evidenceReferences })) {
      throw new ProcessingError('authorization_failed', 'One or more evidence references do not belong to this property.', 403)
    }
    const profile = await repository.getActorProfile({ actor })
    const recipient = normalizeRecipient(deliveryRecipient, profile.email || actor.email)
    return repository.createProcessingRequest({ actor, propertyId, evidenceReferences, note, deliveryRecipient: recipient, draft: true })
  }

  async function finalizeSubmission({ token, requestId, deliveryRecipient = null }) {
    const actor = await requireActor(token)
    const profile = await repository.getActorProfile({ actor })
    const recipient = normalizeRecipient(deliveryRecipient, profile.email || actor.email)
    const request = await repository.finalizeSubmission({ actor, requestId, deliveryRecipient: recipient })
    if (!request) throw new ProcessingError('submission_not_available', 'This submission draft is not available.', 404)
    return queueProcessing({ request: { id: request.id, propertyId: request.property_id, processingStatus: 'queued', createdAt: request.created_at }, actor, propertyId: request.property_id, evidenceReferences: request.evidenceReferences, note: request.note })
  }

  async function updateSubmissionDraft({ token, requestId, propertyId, evidenceReferences, note = '', deliveryRecipient = null }) {
    const actor = await requireActor(token)
    if (!propertyId || !await repository.canAccessProperty(actor.id, propertyId)) {
      throw new ProcessingError('authorization_failed', 'You do not have access to this property.', 403)
    }
    if (!evidenceReferences.length || !await repository.validateEvidenceReferences({ actor, propertyId, evidenceReferences })) {
      throw new ProcessingError('authorization_failed', 'One or more evidence references do not belong to this property.', 403)
    }
    const profile = await repository.getActorProfile({ actor })
    const recipient = normalizeRecipient(deliveryRecipient, profile.email || actor.email)
    const result = await repository.updateSubmissionDraft({ actor, requestId, propertyId, evidenceReferences, note, deliveryRecipient: recipient })
    if (!result) throw new ProcessingError('submission_not_available', 'This submission draft is not available.', 404)
    return result
  }

  async function submit({ token, propertyId, evidenceReferences, note = '', deliveryRecipient = null }) {
    const draft = await createSubmissionDraft({ token, propertyId, evidenceReferences, note, deliveryRecipient })
    return finalizeSubmission({ token, requestId: draft.id, deliveryRecipient })
  }

  async function status({ token, requestId }) {
    const actor = await requireActor(token)
    const request = await repository.getProcessingRequest({ actor, requestId })
    if (!request) throw new ProcessingError('authorization_failed', 'This processing request is not available.', 404)
    return request
  }

  async function sourceDocument({ token, requestId }) {
    const actor = await requireActor(token)
    const document = await repository.getSourceDocument({ actor, requestId })
    if (!document) throw new ProcessingError('source_unavailable', 'The source report is not available.', 404)
    return document
  }

  async function reviewQueue({ token }) {
    const actor = await requireActor(token)
    if (!await repository.isReviewer(actor.id)) throw new ProcessingError('authorization_failed', 'Reviewer access is required.', 403)
    return { items: await repository.listReviewQueue({ actor }) }
  }

  async function dashboard({ token }) {
    const actor = await requireActor(token)
    if (!await repository.isReviewer(actor.id)) throw new ProcessingError('authorization_failed', 'Reviewer access is required.', 403)
    return { items: await repository.listReviewQueue({ actor }) }
  }

  async function myProperties({ token }) {
    const actor = await requireActor(token)
    return { items: await repository.listMyProperties({ actor }) }
  }

  async function saveReviewPosition({ token, requestId, observationId }) {
    const actor = await requireActor(token)
    if (!await repository.isReviewer(actor.id)) throw new ProcessingError('authorization_failed', 'Reviewer access is required.', 403)
    const result = await repository.saveReviewPosition({ actor, requestId, observationId })
    if (!result) throw new ProcessingError('finding_not_found', 'This review position is not available.', 404)
    return result
  }

  async function review({ token, requestId, observationId, action, corrections = {}, reason = '', fieldsApproved = [], expectedReviewEventId = null }) {
    const actor = await requireActor(token)
    if (repository.isReviewer && !await repository.isReviewer(actor.id)) {
      throw new ProcessingError('authorization_failed', 'Reviewer access is required.', 403)
    }
    if (!REVIEW_ACTIONS.has(action)) throw new ProcessingError('invalid_review_action', 'Choose Approve, Edit / Correct, Needs More Information, or Reject.')
    if (!observationId) throw new ProcessingError('finding_required', 'Choose a finding to review.')
    const invalidFields = Object.keys(corrections).filter((field) => !EDITABLE_FIELDS.has(field))
    if (invalidFields.length) throw new ProcessingError('invalid_correction_fields', `Unsupported correction fields: ${invalidFields.join(', ')}.`)
    if (action === 'edit' && !Object.keys(corrections).length) throw new ProcessingError('correction_required', 'Enter at least one correction before saving.')
    const request = await repository.getProcessingRequest({ actor, requestId })
    if (!request) throw new ProcessingError('authorization_failed', 'This processing request is not available.', 404)
    if (corrections.price !== undefined) {
      const price = corrections.price
      const sourceType = String(price?.source_type || '')
      const supportingSourceIds = Array.isArray(price?.supporting_source_ids) ? price.supporting_source_ids.filter(Boolean) : []
      if (!price || typeof price !== 'object'
        || !Number.isFinite(price.low) || !Number.isFinite(price.high)
        || price.low < 0 || price.high < price.low
        || !['broad_preliminary', 'moderate_confidence', 'field_supported'].includes(String(price.confidence_status || ''))
        || !['external_sources', 'reviewer_professional_judgment'].includes(sourceType)
        || (sourceType === 'external_sources' && !supportingSourceIds.length)
        || supportingSourceIds.length > 3
        || !Array.isArray(price.assumptions) || !Array.isArray(price.exclusions)
        || !String(price.geography || '').trim()) {
        throw new ProcessingError('invalid_price_correction', 'A price correction requires a valid range, confidence, geography, assumptions, exclusions, and either selected sources or explicit reviewer judgment.')
      }
      const observation = request?.artifact?.atomicObservations?.find((item) => item.id === observationId)
      const availablePathIds = (observation?.finding_card?.repair_paths || []).map((path) => path.id)
      if (availablePathIds.length && !availablePathIds.includes(String(price.path_id || ''))) {
        throw new ProcessingError('invalid_price_correction', 'Choose the repair path that this price correction applies to.')
      }
      const selectedPath = (observation?.finding_card?.repair_paths || []).find((path) => path.id === price.path_id)
      const availableSourceIds = selectedPath?.price_source_refs || []
      if (sourceType === 'external_sources' && supportingSourceIds.some((sourceId) => !availableSourceIds.includes(sourceId))) {
        throw new ProcessingError('invalid_price_correction', 'Choose supporting sources attached to this repair path.')
      }
    }
    if (corrections.repair_paths !== undefined) {
      const paths = corrections.repair_paths
      if (!Array.isArray(paths) || paths.some((path) => !path || typeof path !== 'object' || !String(path.id || '').trim() || !String(path.label || '').trim())) {
        throw new ProcessingError('invalid_repair_path_correction', 'Repair-path corrections require a path identifier and label.')
      }
      const observation = request?.artifact?.atomicObservations?.find((item) => item.id === observationId)
      const availablePathIds = new Set((observation?.finding_card?.repair_paths || []).map((path) => path.id))
      const submittedPathIds = paths.map((path) => path.id)
      if (new Set(submittedPathIds).size !== submittedPathIds.length || submittedPathIds.some((pathId) => !availablePathIds.has(pathId))) {
        throw new ProcessingError('invalid_repair_path_correction', 'Repair-path corrections must identify an available path exactly once.')
      }
    }
    if (['edit', 'needs_more_info', 'reject'].includes(action) && !String(reason).trim()) {
      throw new ProcessingError('review_reason_required', 'Record the reason or exact missing information before continuing.')
    }
    const newValue = {
      artifact_version: request.artifactVersion,
      observation_id: observationId,
      processing_request_id: requestId,
      expected_review_event_id: expectedReviewEventId,
      corrections,
      fields_approved: action === 'approve' ? fieldsApproved : [],
      delivery_eligible: action === 'approve' || action === 'edit',
      source_layer_preserved: true,
      ai_draft_preserved: true,
    }
    const result = await repository.reviewFinding({ actor, requestId, observationId, action, newValue, reason: String(reason).trim() })
    if (!result) throw new ProcessingError('finding_not_found', 'This finding is not available for review.', 404)
    const refreshed = await repository.getProcessingRequest({ actor, requestId })
    return { ...result, completion: reviewSummary(refreshed?.artifact) }
  }

  async function previewReviewedReport({ token, requestId }) {
    const actor = await requireReviewer(token)
    const request = await repository.getProcessingRequest({ actor, requestId })
    if (!request?.artifact) throw new ProcessingError('review_not_available', 'This reviewed request is not available.', 404)
    const summary = reviewSummary(request.artifact)
    if (summary.remaining > 0) throw new ProcessingError('review_incomplete', `${summary.remaining} findings still require a terminal review decision.`, 409)
    if (!repository.reserveReviewedReport) return { requestId, propertyId: request.propertyId, artifact: request.artifact, submission: request.submission, summary }
    const profile = await repository.getActorProfile({ actor })
    const report = await repository.reserveReviewedReport({ actor, requestId, recipient: request.submission.deliveryRecipientEmail, artifactSchemaVersion: request.artifactVersion || 'unknown' })
    try {
      const localProfessionals = request.artifact.localProfessionals?.lookups?.some((lookup) => ['sourced', 'no_defensible_results'].includes(lookup.status))
        ? request.artifact.localProfessionals
        : await localProfessionalResearch({ artifact: request.artifact, propertyAddress: request.submission.propertyAddress, reviewedOnly: true })
      const document = buildReviewedReportDocument({ report, request, reviewer: profile, localProfessionals })
      const pdf = await pdfGenerator(document)
      const stored = await repository.completeReviewedReport({ report, document, findingVersions: reviewedFindingVersions(document), pricingVersions: reviewedPricingVersions(document), pdf })
      return { reportId: stored.id, reportVersion: stored.report_version, reportStatus: stored.report_status, requestId, propertyId: request.propertyId, artifact: document.artifact, report: document, submission: request.submission, summary }
    } catch (error) {
      await repository.failReviewedReport?.(report.id, error instanceof Error ? error.message : 'Report generation failed.')
      throw new ProcessingError('report_generation_failed', error instanceof Error ? error.message : 'The reviewed report could not be generated.', 500)
    }
  }

  async function releaseReviewedReport({ token, requestId, reportId = null }) {
    const actor = await requireReviewer(token)
    if (typeof repository.releaseReviewedReport !== 'function') {
      throw new ProcessingError('release_unavailable', 'Reviewed report release is not configured.', 503)
    }
    const released = await repository.releaseReviewedReport({ actor, requestId, reportId })
    if (!released) throw new ProcessingError('report_not_found', 'Generate the durable reviewed report before release.', 404)
    return { ready: true, released: true, reportId: released.id, reportVersion: released.report_version, releasedAt: released.released_at }
  }

  async function sendReviewedResult({ token, requestId, reportId = null }) {
    const actor = await requireReviewer(token)
    if (reportId && repository.getReviewedReport) {
      const report = await repository.getReviewedReport({ actor, reportId })
      if (!report || report.report_status !== 'released') throw new ProcessingError('report_not_released', 'Release this reviewed report version before sending it.', 409)
      if (!notifications) throw new ProcessingError('delivery_unavailable', 'Reviewed-result delivery is not configured.', 503)
      await repository.updateReviewedReportDelivery(reportId, { delivery_status: 'sending' })
      const delivery = await notifications.notifyReviewedResult({ requestId: report.processing_request_id, reportId, reportVersion: report.report_version, artifact: report.reviewed_artifact?.artifact })
      await repository.updateReviewedReportDelivery(reportId, delivery.status === 'sent'
        ? { delivery_status: 'sent', sent_at: new Date().toISOString(), provider_message_id: delivery.providerMessageId || null }
        : { delivery_status: 'failed' })
      return { delivery, reportId }
    }
    const request = await repository.getProcessingRequest({ actor, requestId })
    if (!request?.submission?.releasedAt) {
      throw new ProcessingError('report_not_released', 'Release the reviewed report before sending it.', 409)
    }
    if (!notifications) throw new ProcessingError('delivery_unavailable', 'Reviewed-result delivery is not configured.', 503)
    const delivery = await notifications.notifyReviewedResult({ requestId, artifact: request.artifact })
    const refreshed = await repository.getProcessingRequest({ actor, requestId })
    return { delivery, submission: refreshed?.submission || request.submission }
  }

  async function propertyReports({ token, propertyId }) {
    const actor = await requireActor(token)
    return { items: await repository.listPropertyReports({ actor, propertyId }) }
  }

  async function reviewedReport({ token, reportId }) {
    const actor = await requireActor(token)
    const report = await repository.getReviewedReport({ actor, reportId })
    if (!report) throw new ProcessingError('report_not_available', 'This reviewed report is not available.', 404)
    return report
  }

  async function reviewedReportAccess({ token, reportId }) {
    const actor = await requireActor(token)
    const access = await repository.createReviewedReportAccess({ actor, reportId })
    if (!access) throw new ProcessingError('report_not_available', 'This reviewed report PDF is not available.', 404)
    return access
  }

  return { identity, resolveProperty, upload, createSubmissionDraft, updateSubmissionDraft, finalizeSubmission, submit, status, sourceDocument, reviewQueue, dashboard, myProperties, saveReviewPosition, review, previewReviewedReport, releaseReviewedReport, sendReviewedResult, propertyReports, reviewedReport, reviewedReportAccess }
}
