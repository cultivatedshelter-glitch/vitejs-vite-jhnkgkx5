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
      const match = url.pathname.match(/^\/api\/phase1\/processing-requests\/([^/]+)$/)
      if (request.method === 'GET' && match) return json(await service.status({ token: token(request), requestId: decodeURIComponent(match[1]) }))
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
