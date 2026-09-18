#!/usr/bin/env node

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { createPhase1HttpHandler, nodeRequestToWeb, sendNodeResponse } from '../server/phase1HttpServer.mjs'
import { createResendEmailProvider } from '../server/phase1EmailProvider.mjs'
import { createPhase1NotificationService } from '../server/phase1NotificationService.mjs'
import { createPhase1ProcessingService } from '../server/phase1ProcessingService.mjs'
import { runExistingPhase1Reasoning } from '../server/phase1ReasoningRunner.mjs'
import { createPhase1SupabaseRepository } from '../server/phase1SupabaseRepository.mjs'

const port = Number(process.env.PORT || process.env.PHASE1_PROCESSING_PORT || 8787)
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')
const dist = resolve('dist')
const repository = createPhase1SupabaseRepository()
const notificationVariables = ['RESEND_API_KEY', 'SHELTER_PREP_EMAIL_FROM', 'SHELTER_PREP_REVIEW_EMAIL', 'SHELTER_PREP_PUBLIC_URL']
const missingNotificationVariables = notificationVariables.filter((name) => !process.env[name])
if (process.env.NODE_ENV === 'production' && missingNotificationVariables.length) {
  throw new Error(`Production review notifications require: ${missingNotificationVariables.join(', ')}.`)
}
const notifications = missingNotificationVariables.length ? null : createPhase1NotificationService({
  repository,
  provider: createResendEmailProvider(),
  recipient: process.env.SHELTER_PREP_REVIEW_EMAIL,
  publicBaseUrl: process.env.SHELTER_PREP_PUBLIC_URL,
})
const service = createPhase1ProcessingService({ repository, reasoningRunner: runExistingPhase1Reasoning, notifications })
const handle = createPhase1HttpHandler(service)

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

async function sendStatic(pathname, response) {
  const requested = resolve(dist, `.${decodeURIComponent(pathname)}`)
  const candidate = requested.startsWith(`${dist}/`) ? requested : resolve(dist, 'index.html')
  let file = candidate
  try {
    if (!(await stat(file)).isFile()) file = resolve(dist, 'index.html')
  } catch {
    file = resolve(dist, 'index.html')
  }
  const body = await readFile(file)
  response.writeHead(200, {
    'content-type': contentTypes[extname(file)] || 'application/octet-stream',
    'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
  })
  response.end(body)
}

const server = createServer(async (request, response) => {
  try {
    const origin = `${request.headers['x-forwarded-proto'] || 'http'}://${request.headers.host || `localhost:${port}`}`
    const url = new URL(request.url || '/', origin)
    if (request.method === 'GET' && url.pathname === '/healthz') {
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      response.end(JSON.stringify({ status: 'ok', service: 'shelter-prep-phase1', notifications: notifications ? 'configured' : 'disabled' }))
      return
    }
    if (url.pathname.startsWith('/api/phase1/')) {
      await sendNodeResponse(await handle(nodeRequestToWeb(request, origin)), response)
      return
    }
    if (request.method === 'GET' || request.method === 'HEAD') {
      await sendStatic(url.pathname === '/' ? '/index.html' : url.pathname, response)
      return
    }
    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: { code: 'not_found', message: 'Endpoint not found.' } }))
  } catch (error) {
    response.writeHead(500, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: { code: 'processing_failed', message: error instanceof Error ? error.message : 'Processing failed.' } }))
  }
})

server.listen(port, host, () => console.log(`Phase 1 server listening on ${host}:${port}`))
