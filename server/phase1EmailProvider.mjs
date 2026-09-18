function required(name, value) {
  if (!value) throw new Error(`${name} is required for Phase 1 review notifications.`)
  return value
}

export function createResendEmailProvider({
  apiKey = process.env.RESEND_API_KEY,
  from = process.env.SHELTER_PREP_EMAIL_FROM,
  fetchImpl = fetch,
} = {}) {
  const key = required('RESEND_API_KEY', apiKey)
  const sender = required('SHELTER_PREP_EMAIL_FROM', from)

  return {
    name: 'resend',
    async send({ to, subject, html, text, idempotencyKey }) {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({ from: sender, to: [to], subject, html, text }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.id) {
        const detail = typeof body.message === 'string' ? body.message : 'provider rejected the message'
        throw new Error(`Resend delivery failed (${response.status}): ${detail}`)
      }
      return { messageId: body.id }
    },
  }
}
