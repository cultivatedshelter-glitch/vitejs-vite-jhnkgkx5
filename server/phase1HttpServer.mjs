import { Readable } from 'node:stream'
import { ProcessingError } from './phase1ProcessingService.mjs'

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
}

function token(request) {
  const value = request.headers.get('authorization') || ''
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : ''
}

export function createPhase1HttpHandler(service) {
  return async function handle(request) {
    try {
      const url = new URL(request.url)
      if (request.method === 'GET' && url.pathname === '/api/phase1/me') {
        return json(await service.identity({ token: token(request) }))
      }
      if (request.method === 'POST' && url.pathname === '/api/phase1/properties/resolve') {
        const body = await request.json()
        return json(await service.resolveProperty({ token: token(request), address: body.address }), 200)
      }
      if (request.method === 'POST' && url.pathname === '/api/phase1/evidence') {
        const form = await request.formData()
        const files = form.getAll('evidence').filter((value) => typeof value !== 'string')
        return json(await service.upload({ token: token(request), propertyId: String(form.get('propertyId') || ''), files }), 201)
      }
      if (request.method === 'POST' && url.pathname === '/api/phase1/processing-requests') {
        const body = await request.json()
        return json(await service.submit({ token: token(request), propertyId: body.propertyId, evidenceReferences: body.evidenceReferences || [], note: body.note || '' }), 202)
      }
      if (request.method === 'POST' && url.pathname === '/api/phase1/submissions') {
        const body = await request.json()
        return json(await service.createSubmissionDraft({ token: token(request), propertyId: body.propertyId, evidenceReferences: body.evidenceReferences || [], note: body.note || '', deliveryRecipient: body.deliveryRecipient || null }), 201)
      }
      const submitMatch = url.pathname.match(/^\/api\/phase1\/submissions\/([^/]+)\/submit$/)
      if (request.method === 'POST' && submitMatch) {
        const body = await request.json()
        return json(await service.finalizeSubmission({ token: token(request), requestId: decodeURIComponent(submitMatch[1]), deliveryRecipient: body.deliveryRecipient || null }), 202)
      }
      const submissionMatch = url.pathname.match(/^\/api\/phase1\/submissions\/([^/]+)$/)
      if (request.method === 'PATCH' && submissionMatch) {
        const body = await request.json()
        return json(await service.updateSubmissionDraft({ token: token(request), requestId: decodeURIComponent(submissionMatch[1]), propertyId: body.propertyId, evidenceReferences: body.evidenceReferences || [], note: body.note || '', deliveryRecipient: body.deliveryRecipient || null }))
      }
      const match = url.pathname.match(/^\/api\/phase1\/processing-requests\/([^/]+)$/)
      if (request.method === 'GET' && match) return json(await service.status({ token: token(request), requestId: decodeURIComponent(match[1]) }))
      const sourceMatch = url.pathname.match(/^\/api\/phase1\/processing-requests\/([^/]+)\/source-document$/)
      if (request.method === 'GET' && sourceMatch) {
        const document = await service.sourceDocument({ token: token(request), requestId: decodeURIComponent(sourceMatch[1]) })
        return new Response(document.body, {
          status: 200,
          headers: {
            'content-type': document.contentType || 'application/pdf',
            'content-disposition': `inline; filename="${document.filename.replace(/["\\\r\n]/g, '-') || 'inspection-report.pdf'}"`,
            'cache-control': 'private, no-store',
          },
        })
      }
      if (request.method === 'GET' && url.pathname === '/api/phase1/review-queue') {
        return json(await service.reviewQueue({ token: token(request) }))
      }
      if (request.method === 'GET' && url.pathname === '/api/phase1/dashboard') {
        return json(await service.dashboard({ token: token(request) }))
      }
      if (request.method === 'GET' && url.pathname === '/api/phase1/my-properties') {
        return json(await service.myProperties({ token: token(request) }))
      }
      const positionMatch = url.pathname.match(/^\/api\/phase1\/processing-requests\/([^/]+)\/review-position$/)
      if (request.method === 'POST' && positionMatch) {
        const body = await request.json()
        return json(await service.saveReviewPosition({ token: token(request), requestId: decodeURIComponent(positionMatch[1]), observationId: body.observationId }))
      }
      const reviewMatch = url.pathname.match(/^\/api\/phase1\/processing-requests\/([^/]+)\/findings\/([^/]+)\/review$/)
      if (request.method === 'POST' && reviewMatch) {
        const body = await request.json()
        return json(await service.review({
          token: token(request),
          requestId: decodeURIComponent(reviewMatch[1]),
          observationId: decodeURIComponent(reviewMatch[2]),
          action: body.action,
          corrections: body.corrections || {},
          reason: body.reason || '',
          fieldsApproved: body.fieldsApproved || [],
          expectedReviewEventId: body.expectedReviewEventId || null,
        }))
      }
      return json({ error: { code: 'not_found', message: 'Endpoint not found.' } }, 404)
    } catch (error) {
      const status = error instanceof ProcessingError ? error.status : 500
      const code = error instanceof ProcessingError ? error.code : 'processing_failed'
      return json({ error: { code, message: error instanceof Error ? error.message : 'Processing failed.' } }, status)
    }
  }
}

export async function sendNodeResponse(response, nodeResponse) {
  nodeResponse.writeHead(response.status, Object.fromEntries(response.headers.entries()))
  nodeResponse.end(Buffer.from(await response.arrayBuffer()))
}

export function nodeRequestToWeb(nodeRequest, origin) {
  const url = new URL(nodeRequest.url || '/', origin)
  const init = { method: nodeRequest.method, headers: nodeRequest.headers }
  if (!['GET', 'HEAD'].includes(nodeRequest.method || 'GET')) {
    init.body = Readable.toWeb(nodeRequest)
    init.duplex = 'half'
  }
  return new Request(url, init)
}
