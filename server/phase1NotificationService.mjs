function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function cleanBaseUrl(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('SHELTER_PREP_PUBLIC_URL must use HTTPS outside local development.')
  }
  return url.toString().replace(/\/$/, '')
}

function findingCount(artifact) {
  if (Array.isArray(artifact?.atomicObservations)) return artifact.atomicObservations.length
  if (Array.isArray(artifact?.atomic_observations)) return artifact.atomic_observations.length
  return null
}

function emailContent({ eventType, context, artifact, reviewUrl }) {
  const failed = eventType === 'processing_failed'
  const address = context.propertyAddress || 'Property address unavailable'
  const submitter = context.submittingEmail || 'Authenticated pilot user'
  const evidence = context.evidenceSummary || 'Evidence attached to the request'
  const count = findingCount(artifact)
  const status = failed ? 'Processing Failed' : 'Needs Human Review'
  const heading = failed ? 'Request processing needs attention' : 'New request ready for review'
  const findings = count === null ? 'Not available' : `${count} repair ${count === 1 ? 'item' : 'items'}`
  const subject = `${failed ? 'Shelter Prep processing failed' : 'New Shelter Prep request'} - ${address}`
  const text = [
    'Shelter Prep', '', heading, '', address, '', 'Submitted by:', submitter, '',
    'Evidence:', evidence, '', 'Findings:', findings, '', 'Status:', status, '',
    failed ? 'Open the request to review the processing failure.' : 'Human review is required before this draft can be trusted.', '',
    `Review Property: ${reviewUrl}`,
  ].join('\n')
  const html = `<!doctype html><html><body style="margin:0;background:#f3f5f3;color:#15221b;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border:1px solid #d9ded9;padding:28px"><p style="margin:0 0 24px;color:#315e46;font-size:13px;font-weight:700;letter-spacing:.08em">SHELTER PREP</p><h1 style="margin:0 0 24px;font-family:Georgia,serif;font-size:26px;font-weight:500">${escapeHtml(heading)}</h1><p style="font-size:18px;line-height:1.5"><strong>${escapeHtml(address)}</strong></p><p style="line-height:1.6"><strong>Submitted by:</strong><br>${escapeHtml(submitter)}</p><p style="line-height:1.6"><strong>Evidence:</strong><br>${escapeHtml(evidence)}</p><p style="line-height:1.6"><strong>Findings:</strong><br>${escapeHtml(findings)}</p><p style="line-height:1.6"><strong>Status:</strong><br>${escapeHtml(status)}</p><p style="margin:24px 0">${failed ? 'Open the request to review the processing failure.' : 'Human review is required before this draft can be trusted.'}</p><a href="${escapeHtml(reviewUrl)}" style="display:inline-block;background:#174c35;color:#fff;text-decoration:none;padding:12px 18px;border-radius:5px;font-weight:700">Review Property</a></div></div></body></html>`
  return { subject, text, html }
}

export function createPhase1NotificationService({ repository, provider, recipient, publicBaseUrl, logger = console }) {
  if (!repository || !provider) throw new Error('Notification repository and provider are required.')
  if (!recipient) throw new Error('SHELTER_PREP_REVIEW_EMAIL is required for Phase 1 review notifications.')
  const baseUrl = cleanBaseUrl(publicBaseUrl)

  async function notify({ eventType, requestId, artifact = null }) {
    const context = await repository.getNotificationContext(requestId)
    const claim = await repository.claimNotification({
      eventType,
      requestId,
      propertyId: context.propertyId,
      workRequestId: context.workRequestId,
      recipient,
      provider: provider.name,
    })
    if (!claim.shouldSend) return { status: claim.notification.delivery_status, duplicate: true }

    const reviewUrl = `${baseUrl}/properties/${encodeURIComponent(context.propertyId)}/review?request=${encodeURIComponent(requestId)}`
    const content = emailContent({ eventType, context, artifact, reviewUrl })
    try {
      const result = await provider.send({
        to: recipient,
        ...content,
        idempotencyKey: `phase1-${claim.notification.id}`,
      })
      await repository.markNotificationSent(claim.notification.id, result.messageId)
      return { status: 'sent', notificationId: claim.notification.id, providerMessageId: result.messageId }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Email provider failed.'
      await repository.markNotificationFailed(claim.notification.id, reason)
      logger.error('Phase 1 admin email delivery failed.', {
        notificationId: claim.notification.id,
        eventType,
        requestId,
        error: reason,
      })
      return { status: 'failed', notificationId: claim.notification.id }
    }
  }

  return {
    notifyNeedsReview: ({ requestId, artifact }) => notify({ eventType: 'needs_review', requestId, artifact }),
    notifyProcessingFailed: ({ requestId }) => notify({ eventType: 'processing_failed', requestId }),
  }
}
