import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createResendEmailProvider } from '../server/phase1EmailProvider.mjs'
import { createPhase1NotificationService } from '../server/phase1NotificationService.mjs'

function notificationRepository() {
  const notifications = new Map()
  let sequence = 0
  return {
    notifications,
    async getNotificationContext(requestId) {
      return {
        propertyId: '11111111-1111-4111-8111-111111111111',
        workRequestId: null,
        propertyAddress: '1150 Greentree Rd, Lake Oswego, OR 97034',
        submittingEmail: 'agent@example.com',
        evidenceSummary: '2 evidence files: inspection.pdf, exterior.jpg',
        requestId,
      }
    },
    async claimNotification(input) {
      const key = `${input.eventType}:${input.requestId}:${input.recipient}`
      const existing = notifications.get(key)
      if (existing?.delivery_status === 'sent' || existing?.delivery_status === 'sending') {
        return { notification: existing, shouldSend: false }
      }
      const notification = existing || { id: `notification-${++sequence}`, attempt_count: 0 }
      Object.assign(notification, input, { delivery_status: 'sending', attempt_count: notification.attempt_count + 1 })
      notifications.set(key, notification)
      return { notification, shouldSend: true }
    },
    async markNotificationSent(id, providerMessageId) {
      const notification = [...notifications.values()].find((item) => item.id === id)
      Object.assign(notification, { delivery_status: 'sent', provider_message_id: providerMessageId })
    },
    async markNotificationFailed(id, failureReason) {
      const notification = [...notifications.values()].find((item) => item.id === id)
      Object.assign(notification, { delivery_status: 'failed', failure_reason: failureReason })
    },
  }
}

test('needs-review email is operational, property-linked, and idempotent', async () => {
  const repository = notificationRepository()
  const deliveries = []
  const provider = { name: 'test-provider', async send(message) { deliveries.push(message); return { messageId: 'provider-message-1' } } }
  const service = createPhase1NotificationService({
    repository,
    provider,
    recipient: 'reviewer@example.com',
    publicBaseUrl: 'https://shelterprep.com',
  })
  const artifact = { atomicObservations: [{}, {}] }
  const first = await service.notifyNeedsReview({ requestId: 'request-1', artifact })
  const duplicate = await service.notifyNeedsReview({ requestId: 'request-1', artifact })

  assert.equal(first.status, 'sent')
  assert.equal(duplicate.duplicate, true)
  assert.equal(deliveries.length, 1)
  assert.equal(deliveries[0].to, 'reviewer@example.com')
  assert.match(deliveries[0].subject, /1150 Greentree Rd/)
  assert.match(deliveries[0].text, /agent@example\.com/)
  assert.match(deliveries[0].text, /2 repair items/)
  assert.match(deliveries[0].text, /https:\/\/shelterprep\.com\/properties\/11111111-1111-4111-8111-111111111111\/review\?request=request-1/)
  assert.doesNotMatch(deliveries[0].text, /phase1-evidence|storage\/v1/)
  assert.equal(deliveries[0].idempotencyKey, 'phase1-notification-1')
})

test('delivery failure is persisted and a later call can retry', async () => {
  const repository = notificationRepository()
  let attempts = 0
  const provider = {
    name: 'test-provider',
    async send() {
      attempts += 1
      if (attempts === 1) throw new Error('provider unavailable')
      return { messageId: 'provider-message-2' }
    },
  }
  const errors = []
  const service = createPhase1NotificationService({
    repository,
    provider,
    recipient: 'reviewer@example.com',
    publicBaseUrl: 'https://shelterprep.com',
    logger: { error: (...values) => errors.push(values) },
  })
  const failed = await service.notifyProcessingFailed({ requestId: 'request-2' })
  const retried = await service.notifyProcessingFailed({ requestId: 'request-2' })

  assert.equal(failed.status, 'failed')
  assert.equal(retried.status, 'sent')
  assert.equal(attempts, 2)
  assert.equal(errors.length, 1)
  assert.equal([...repository.notifications.values()][0].attempt_count, 2)
  assert.equal([...repository.notifications.values()][0].delivery_status, 'sent')
})

test('reviewed result is delivered once to the submitting agent without exposing review machinery', async () => {
  const repository = notificationRepository()
  const deliveries = []
  const provider = { name: 'test-provider', async send(message) { deliveries.push(message); return { messageId: 'provider-result-1' } } }
  const service = createPhase1NotificationService({ repository, provider, recipient: 'reviewer@example.com', publicBaseUrl: 'https://shelterprep.com' })
  const artifact = { atomicObservations: [{}, {}] }
  const first = await service.notifyReviewedResult({ requestId: 'request-ready', artifact })
  const duplicate = await service.notifyReviewedResult({ requestId: 'request-ready', artifact })
  assert.equal(first.status, 'sent')
  assert.equal(duplicate.duplicate, true)
  assert.equal(deliveries.length, 1)
  assert.equal(deliveries[0].to, 'agent@example.com')
  assert.match(deliveries[0].text, /View Result:/)
  assert.match(deliveries[0].text, /audience=agent/)
  assert.doesNotMatch(deliveries[0].text, /reviewer_id|review reason|parser|sha256/i)
})

test('Resend requests keep authentication server-side and use provider idempotency', async () => {
  let request
  const provider = createResendEmailProvider({
    apiKey: 'server-only-test-key',
    from: 'Shelter Prep <review@shelterprep.com>',
    fetchImpl: async (url, init) => { request = { url, init }; return new Response(JSON.stringify({ id: 'message-id' }), { status: 200 }) },
  })
  const result = await provider.send({
    to: 'reviewer@example.com', subject: 'Review', html: '<p>Review</p>', text: 'Review', idempotencyKey: 'phase1-notification-id',
  })
  assert.equal(result.messageId, 'message-id')
  assert.equal(request.url, 'https://api.resend.com/emails')
  assert.equal(request.init.headers.authorization, 'Bearer server-only-test-key')
  assert.equal(request.init.headers['idempotency-key'], 'phase1-notification-id')
})

test('notification migrations are server-only, RLS-enabled, indexed, and transition-deduplicated', async () => {
  const migration = await readFile('supabase/migrations/20260918055519_phase1_review_notifications.sql', 'utf8')
  const hardening = await readFile('supabase/migrations/20260918060120_phase1_review_notifications_hardening.sql', 'utf8')
  const release = await readFile('supabase/migrations/20260918195000_phase1_review_release_delivery.sql', 'utf8')
  assert.match(migration, /alter table public\.phase1_notifications enable row level security/i)
  assert.match(migration, /revoke all on public\.phase1_notifications from anon, authenticated/i)
  assert.match(migration, /grant select, insert, update on public\.phase1_notifications to service_role/i)
  assert.match(migration, /unique index[\s\S]*event_type, processing_request_id, recipient, channel/i)
  assert.match(hardening, /to anon, authenticated[\s\S]*using \(false\)[\s\S]*with check \(false\)/i)
  assert.match(hardening, /phase1_notifications_processing_request_idx/i)
  assert.match(hardening, /phase1_notifications_work_request_idx/i)
  assert.match(release, /reviewed_result_ready/i)
  assert.doesNotMatch(release, /grant .*authenticated|to authenticated/i)
})
