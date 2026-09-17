#!/usr/bin/env node

import { createServer } from 'node:http'
import { createPhase1HttpHandler, nodeRequestToWeb, sendNodeResponse } from '../server/phase1HttpServer.mjs'
import { createPhase1ProcessingService } from '../server/phase1ProcessingService.mjs'
import { runExistingPhase1Reasoning } from '../server/phase1ReasoningRunner.mjs'
import { createPhase1SupabaseRepository } from '../server/phase1SupabaseRepository.mjs'

const port = Number(process.env.PHASE1_PROCESSING_PORT || 8787)
const service = createPhase1ProcessingService({ repository: createPhase1SupabaseRepository(), reasoningRunner: runExistingPhase1Reasoning })
const handle = createPhase1HttpHandler(service)
const server = createServer(async (request, response) => {
  try {
    await sendNodeResponse(await handle(nodeRequestToWeb(request, `http://${request.headers.host || `localhost:${port}`}`)), response)
  } catch (error) {
    response.writeHead(500, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: { code: 'processing_failed', message: error instanceof Error ? error.message : 'Processing failed.' } }))
  }
})

server.listen(port, '127.0.0.1', () => console.log(`Phase 1 processing server listening on http://127.0.0.1:${port}`))
