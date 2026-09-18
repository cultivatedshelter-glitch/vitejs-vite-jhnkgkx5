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

  async function submit({ token, propertyId, evidenceReferences, note = '' }) {
    const actor = await requireActor(token)
    if (!propertyId || !await repository.canAccessProperty(actor.id, propertyId)) {
      throw new ProcessingError('authorization_failed', 'You do not have access to this property.', 403)
    }
    const evidence = await repository.resolveEvidence({ actor, propertyId, evidenceReferences })
    if (evidence.length !== evidenceReferences.length) {
      throw new ProcessingError('authorization_failed', 'One or more evidence references do not belong to this property.', 403)
    }
    const request = await repository.createProcessingRequest({ actor, propertyId, evidenceReferences, note })
    queueMicrotask(async () => {
      try {
        await repository.markProcessing(request.id)
        const artifact = await reasoningRunner({ propertyId, evidence, note })
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
    if (corrections.price !== undefined) {
      const price = corrections.price
      if (!price || typeof price !== 'object'
        || !Number.isFinite(price.low) || !Number.isFinite(price.high)
        || price.low < 0 || price.high < price.low
        || !String(price.source_reference || '').trim()) {
        throw new ProcessingError('invalid_price_correction', 'A price correction requires a valid low/high range and source reference.')
      }
    }
    if (['edit', 'needs_more_info', 'reject'].includes(action) && !String(reason).trim()) {
      throw new ProcessingError('review_reason_required', 'Record the reason or exact missing information before continuing.')
    }
    const request = await repository.getProcessingRequest({ actor, requestId })
    if (!request) throw new ProcessingError('authorization_failed', 'This processing request is not available.', 404)
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

  return { resolveProperty, upload, submit, status, sourceDocument, reviewQueue, review }
}
