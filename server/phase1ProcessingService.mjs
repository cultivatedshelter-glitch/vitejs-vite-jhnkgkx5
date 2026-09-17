import { validatePhase1Artifact } from './phase1ArtifactValidator.mjs'

export class ProcessingError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

export function createPhase1ProcessingService({ repository, reasoningRunner }) {
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
      } catch (error) {
        await repository.failProcessing(request.id, error instanceof Error ? error.message : 'Processing failed.')
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

  return { resolveProperty, upload, submit, status }
}
