import { validatePhase1Artifact } from './phase1ArtifactValidator.mjs'

export class ProcessingError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

export function createPhase1ProcessingService({ repository, reasoningRunner, notifications = null, logger = console }) {
  const REVIEW_ACTIONS = new Set(['approve', 'edit', 'needs_more_info', 'reject'])
  const EDITABLE_FIELDS = new Set(['title', 'interpretation', 'known', 'unknown', 'affected_location', 'next_step', 'rationale', 'likely_trade', 'price', 'evidence_relationship', 'confirmed_evidence'])
  async function requireActor(token) {
    if (!token) throw new ProcessingError('authorization_failed', 'Sign in is required to process property evidence.', 401)
    const actor = await repository.authenticate(token)
    if (!actor) throw new ProcessingError('authorization_failed', 'The session is not authorized.', 401)
    return actor
  }

  function normalizeRecipient(value, fallbackEmail = '') {
    const email = String(value?.email || fallbackEmail || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ProcessingError('delivery_recipient_invalid', 'Enter a valid email address for the reviewed result.')
    }
    return { name: String(value?.name || '').trim() || null, email, source: email === String(fallbackEmail || '').trim().toLowerCase() ? 'submitter_default' : 'manually_changed' }
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

  async function review({ token, requestId, observationId, action, corrections = {}, reason = '', fieldsApproved = [] }) {
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
      if (!price || typeof price !== 'object'
        || !Number.isFinite(price.low) || !Number.isFinite(price.high)
        || price.low < 0 || price.high < price.low
        || !String(price.source_reference || '').trim()
        || !String(price.geography || '').trim()) {
        throw new ProcessingError('invalid_price_correction', 'A price correction requires a valid low/high range, source reference, and source geography.')
      }
      const observation = request?.artifact?.atomicObservations?.find((item) => item.id === observationId)
      const availablePathIds = (observation?.finding_card?.repair_paths || []).map((path) => path.id)
      if (availablePathIds.length && !availablePathIds.includes(String(price.path_id || ''))) {
        throw new ProcessingError('invalid_price_correction', 'Choose the repair path that this price correction applies to.')
      }
    }
    if (['edit', 'needs_more_info', 'reject'].includes(action) && !String(reason).trim()) {
      throw new ProcessingError('review_reason_required', 'Record the reason or exact missing information before continuing.')
    }
    const newValue = {
      artifact_version: request.artifactVersion,
      observation_id: observationId,
      corrections,
      fields_approved: action === 'approve' ? fieldsApproved : [],
      delivery_eligible: action === 'approve' || action === 'edit',
      source_layer_preserved: true,
      ai_draft_preserved: true,
    }
    const result = await repository.reviewFinding({ actor, requestId, observationId, action, newValue, reason: String(reason).trim() })
    if (!result) throw new ProcessingError('finding_not_found', 'This finding is not available for review.', 404)
    const release = repository.releaseIfReviewComplete
      ? await repository.releaseIfReviewComplete({ actor, requestId })
      : { ready: false, released: false }
    if (release.released && notifications) {
      try {
        await notifications.notifyReviewedResult({ requestId, artifact: request.artifact })
      } catch (notificationError) {
        logger.error('Phase 1 reviewed-result delivery could not be recorded.', {
          requestId,
          error: notificationError instanceof Error ? notificationError.message : 'Notification failed.',
        })
      }
    }
    return { ...result, release }
  }

  return { identity, resolveProperty, upload, createSubmissionDraft, updateSubmissionDraft, finalizeSubmission, submit, status, sourceDocument, reviewQueue, dashboard, myProperties, saveReviewPosition, review }
}
