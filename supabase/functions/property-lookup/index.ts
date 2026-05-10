type PropertyLookupRequest = {
  address?: string
}

type ProviderProperty = {
  squareFeet?: string | number
  yearBuilt?: string | number
  bedrooms?: string | number
  bathrooms?: string | number
  lotSize?: string | number
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
    return jsonResponse({ error: 'Use POST for property lookup.' }, 405)
  }

  try {
    const body = (await request.json()) as PropertyLookupRequest
    const address = body.address?.trim()

    if (!address) {
      return jsonResponse({ error: 'Address is required.' }, 400)
    }

    const property = await fetchPropertyFromProvider(address)

    return jsonResponse({
      property: {
        squareFeet: toDisplayValue(property.squareFeet, 'Confirm with listing data'),
        yearBuilt: toDisplayValue(property.yearBuilt, 'Public record pending'),
        bedrooms: toDisplayValue(property.bedrooms, 'TBD'),
        bathrooms: toDisplayValue(property.bathrooms, 'TBD'),
        lotSize: toDisplayValue(property.lotSize, 'TBD'),
        source: Deno.env.get('PROPERTY_DATA_API_URL') ? 'api' : 'fallback',
        confidence: Deno.env.get('PROPERTY_DATA_API_URL') ? 'medium' : 'low',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Property lookup failed.'
    return jsonResponse({ error: message }, 500)
  }
})

async function fetchPropertyFromProvider(address: string): Promise<ProviderProperty> {
  const providerUrl = Deno.env.get('PROPERTY_DATA_API_URL')
  const providerKey = Deno.env.get('PROPERTY_DATA_API_KEY')

  if (!providerUrl) {
    return {}
  }

  const url = new URL(providerUrl)
  url.searchParams.set('address', address)

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(providerKey ? { Authorization: `Bearer ${providerKey}` } : {}),
    },
  })

  if (!response.ok) {
    throw new Error(`Property provider returned ${response.status}.`)
  }

  return normalizeProviderPayload(await response.json())
}

function normalizeProviderPayload(payload: unknown): ProviderProperty {
  if (!payload || typeof payload !== 'object') return {}

  const record = payload as Record<string, unknown>
  const property = getRecord(record.property) || getRecord(record.data) || record

  return {
    squareFeet:
      getString(property.squareFeet) ||
      getString(property.livingArea) ||
      getString(property.buildingArea) ||
      getString(property.sqft),
    yearBuilt: getString(property.yearBuilt),
    bedrooms: getString(property.bedrooms) || getString(property.beds),
    bathrooms: getString(property.bathrooms) || getString(property.baths),
    lotSize: getString(property.lotSize) || getString(property.lotSqft),
  }
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function getString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value.toLocaleString()
  return undefined
}

function toDisplayValue(value: unknown, fallback: string): string {
  return getString(value) || fallback
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
