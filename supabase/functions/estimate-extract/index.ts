type EstimateExtractRequest = {
  extractedText?: string
  fileRecord?: {
    id?: string
    project_id?: string
    file_name?: string
    storage_bucket?: string
    storage_path?: string
  }
  project?: {
    project_type?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    property_type?: string | null
    estimated_amount?: number | null
    final_invoice_amount?: number | null
    notes?: string | null
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ status: 'error', error: 'Use POST for estimate extraction.' }, 405)
  }

  try {
    const body = (await request.json()) as EstimateExtractRequest
    const extractedText = String(body.extractedText || '').trim()

    console.log('[estimate-extract] request received', {
      hasText: Boolean(extractedText),
      hasFileRecord: Boolean(body.fileRecord?.id),
    })

    if (!extractedText) {
      return jsonResponse({
        status: 'needs_manual_text_review',
        message: 'Text extraction is not available for this file yet. Paste proposal text for Phase 1 normalization.',
        estimate: buildEmptyEstimate(body),
      })
    }

    return jsonResponse({
      status: 'needs_review',
      message: 'Estimate data normalized. Human approval is required before pricing memory is trusted.',
      estimate: normalizeEstimate(extractedText, body),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Estimate extraction failed.'
    console.log('[estimate-extract] request failed', { message })
    return jsonResponse({ status: 'failed', error: 'Estimate extraction failed.' }, 500)
  }
})

function buildEmptyEstimate(body: EstimateExtractRequest) {
  return {
    projectType: body.project?.project_type || '',
    squareFeet: null,
    city: body.project?.city || '',
    state: body.project?.state || 'OR',
    zip: body.project?.zip || '',
    projectClass: body.project?.property_type || '',
    laborCost: null,
    materialCost: null,
    demoCost: null,
    totalCost: body.project?.final_invoice_amount || body.project?.estimated_amount || null,
    normalizedScope: {
      summary: body.project?.notes || '',
      lineItems: [],
    },
    exclusions: [],
    riskFactors: ['Needs manual text review before pricing memory approval.'],
    confidenceScore: 0.1,
  }
}

function normalizeEstimate(extractedText: string, body: EstimateExtractRequest) {
  const amounts = findMoneyValues(extractedText)
  const totalCost = findLabeledMoney(extractedText, ['total', 'proposal total', 'estimate total', 'invoice total'])
    || body.project?.final_invoice_amount
    || body.project?.estimated_amount
    || amounts[amounts.length - 1]
    || null

  const laborCost = findLabeledMoney(extractedText, ['labor', 'labor cost'])
  const materialCost = findLabeledMoney(extractedText, ['material', 'materials', 'material cost'])
  const demoCost = findLabeledMoney(extractedText, ['demo', 'demolition'])
  const squareFeet = findLabeledNumber(extractedText, ['sq ft', 'sqft', 'square feet', 'sf'])
  const lineItems = extractLineItems(extractedText)

  const confidenceScore = Math.min(
    0.92,
    0.35 +
      (totalCost ? 0.2 : 0) +
      (lineItems.length > 0 ? 0.15 : 0) +
      (laborCost || materialCost ? 0.15 : 0) +
      (squareFeet ? 0.07 : 0)
  )

  return {
    projectType: body.project?.project_type || inferProjectType(extractedText),
    squareFeet,
    city: body.project?.city || '',
    state: body.project?.state || 'OR',
    zip: body.project?.zip || '',
    projectClass: body.project?.property_type || inferProjectClass(extractedText),
    laborCost,
    materialCost,
    demoCost,
    totalCost,
    normalizedScope: {
      summary: summarizeScope(extractedText),
      lineItems,
    },
    exclusions: extractListAfterLabels(extractedText, ['exclusions', 'excluded', 'does not include']),
    riskFactors: buildRiskFactors(extractedText, { totalCost, laborCost, materialCost, lineItems }),
    confidenceScore: Number(confidenceScore.toFixed(2)),
  }
}

function findMoneyValues(text: string): number[] {
  return Array.from(text.matchAll(/\$?\s*([0-9][0-9,]*(?:\.\d{2})?)/g))
    .map((match) => Number(match[1].replace(/,/g, '')))
    .filter((value) => Number.isFinite(value) && value > 0)
}

function findLabeledMoney(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}[^\\n\\r$0-9]{0,40}\\$?\\s*([0-9][0-9,]*(?:\\.\\d{2})?)`, 'i')
    const match = text.match(pattern)
    if (match?.[1]) return Number(match[1].replace(/,/g, ''))
  }

  return null
}

function findLabeledNumber(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const pattern = new RegExp(`([0-9][0-9,]*(?:\\.\\d+)?)\\s*(?:${escapeRegExp(label)})`, 'i')
    const match = text.match(pattern)
    if (match?.[1]) return Number(match[1].replace(/,/g, ''))
  }

  return null
}

function extractLineItems(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 8 && /\$?\s*[0-9][0-9,]*(?:\.\d{2})?/.test(line))
    .slice(0, 25)
    .map((line) => ({
      description: line.replace(/\s+/g, ' '),
      amount: findMoneyValues(line).at(-1) || null,
    }))
}

function extractListAfterLabels(text: string, labels: string[]) {
  const lowered = text.toLowerCase()
  const label = labels.find((candidate) => lowered.includes(candidate))

  if (!label) return []

  const start = lowered.indexOf(label)
  return text
    .slice(start)
    .split(/\n+/)
    .slice(1, 8)
    .map((line) => line.replace(/^[-*•\s]+/, '').trim())
    .filter(Boolean)
}

function buildRiskFactors(
  text: string,
  facts: { totalCost: number | null; laborCost: number | null; materialCost: number | null; lineItems: unknown[] }
) {
  const risks: string[] = []
  const lowered = text.toLowerCase()

  if (!facts.totalCost) risks.push('No clear total cost found.')
  if (!facts.laborCost) risks.push('Labor cost not clearly separated.')
  if (!facts.materialCost) risks.push('Material cost not clearly separated.')
  if (facts.lineItems.length === 0) risks.push('No clear line items found.')
  if (lowered.includes('change order')) risks.push('Document references change orders.')
  if (lowered.includes('allowance')) risks.push('Document includes allowances that need human review.')
  if (lowered.includes('exclude') || lowered.includes('not include')) risks.push('Document appears to include exclusions.')

  return risks
}

function summarizeScope(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join(' ')
    .slice(0, 700)
}

function inferProjectType(text: string) {
  const lowered = text.toLowerCase()
  if (lowered.includes('roof')) return 'Roofing'
  if (lowered.includes('paint')) return 'Painting'
  if (lowered.includes('tile')) return 'Tile'
  if (lowered.includes('deck')) return 'Deck'
  if (lowered.includes('concrete')) return 'Concrete'
  if (lowered.includes('floor')) return 'Flooring'
  return 'General Repair'
}

function inferProjectClass(text: string) {
  const lowered = text.toLowerCase()
  if (lowered.includes('commercial')) return 'Commercial'
  if (lowered.includes('multi-family') || lowered.includes('multifamily')) return 'Multifamily'
  return 'Residential'
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}
