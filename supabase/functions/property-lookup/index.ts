type PropertyLookupRequest = {
  address?: string
  propertyAddress?: string
  address_line_1?: string
  city?: string
  state?: string
  zip?: string
}

type AttomLookupStatus =
  | 'data_found'
  | 'provider_not_configured'
  | 'no_records_found'
  | 'attom_unauthorized'
  | 'attom_forbidden'
  | 'attom_bad_request'
  | 'attom_not_found'
  | 'attom_request_failed'
  | 'error'

type NormalizedProperty = {
  beds?: string
  baths?: string
  bedrooms?: string
  bathrooms?: string
  squareFeet?: string
  yearBuilt?: string
  propertyType?: string
  lotSize?: string
  ownerName?: string
  parcelNumber?: string
  apn?: string
  jurisdiction?: string
  zoning?: string
  source: 'api'
  confidence: 'high' | 'medium' | 'low'
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ATTOM_BASE_URL = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0'
const ATTOM_BASIC_PROFILE_PATH = '/property/basicprofile'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ status: 'error', error: 'Use POST for property lookup.' }, 405)
  }

  try {
    const body = (await request.json()) as PropertyLookupRequest
    const address = buildLookupAddress(body)
    console.log('[property-lookup] request received', { hasAddress: Boolean(address) })

    if (!address) {
      return jsonResponse({ status: 'attom_bad_request', error: 'Address is required.' }, 400)
    }

    const attomKey = Deno.env.get('ATTOM_API_KEY') || Deno.env.get('PROPERTY_DATA_API_KEY')

    if (!attomKey) {
      return jsonResponse({
        status: 'provider_not_configured',
        message: 'No property data provider connected yet. Use county/ORMAP links or enter facts manually.',
        property: null,
      })
    }

    const attomResult = await fetchAttomProperty(address, attomKey)

    if (!attomResult.ok) {
      return jsonResponse(
        {
          status: attomResult.status,
          message: attomResult.message,
          property: null,
          provider: 'attom',
        },
        attomResult.httpStatus
      )
    }

    const property = normalizeAttomPayload(attomResult.payload)

    if (!hasPropertyData(property)) {
      return jsonResponse({
        status: 'no_records_found',
        message: 'ATTOM returned no property facts for this address. Use county/ORMAP links or enter facts manually.',
        property: null,
        provider: 'attom',
        raw: summarizeAttomPayload(attomResult.payload),
      })
    }

    return jsonResponse({
      status: 'data_found',
      message: 'Property data found from ATTOM. Verify before using in estimates or reports.',
      provider: 'attom',
      property,
      raw: summarizeAttomPayload(attomResult.payload),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Property lookup failed.'
    console.log('[property-lookup] request failed', { message })
    return jsonResponse({ status: 'error', error: 'Property lookup failed.' }, 500)
  }
})

async function fetchAttomProperty(
  address: string,
  attomKey: string
): Promise<
  | { ok: true; payload: unknown }
  | { ok: false; status: AttomLookupStatus; httpStatus: number; message: string }
> {
  const url = new URL(`${ATTOM_BASE_URL}${ATTOM_BASIC_PROFILE_PATH}`)
  url.searchParams.set('address', address)

  let response: Response

  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        attomdataapikey: attomKey,
      },
    })
  } catch {
    return {
      ok: false,
      status: 'attom_request_failed',
      httpStatus: 502,
      message: 'ATTOM request failed before a response was received.',
    }
  }

  if (!response.ok) {
    return mapAttomError(response.status)
  }

  const payload = await response.json()
  const summary = summarizeAttomPayload(payload)

  if (summary.statusCode && String(summary.statusCode).startsWith('4')) {
    return mapAttomError(Number(summary.statusCode))
  }

  return { ok: true, payload }
}

function mapAttomError(statusCode: number): {
  ok: false
  status: AttomLookupStatus
  httpStatus: number
  message: string
} {
  if (statusCode === 400) {
    return {
      ok: false,
      status: 'attom_bad_request',
      httpStatus: 400,
      message: 'ATTOM rejected the address request.',
    }
  }

  if (statusCode === 401) {
    return {
      ok: false,
      status: 'attom_unauthorized',
      httpStatus: 401,
      message: 'ATTOM rejected the API key.',
    }
  }

  if (statusCode === 403) {
    return {
      ok: false,
      status: 'attom_forbidden',
      httpStatus: 403,
      message: 'ATTOM key is valid, but this endpoint is not allowed for the account.',
    }
  }

  if (statusCode === 404) {
    return {
      ok: false,
      status: 'attom_not_found',
      httpStatus: 404,
      message: 'ATTOM endpoint or property record was not found.',
    }
  }

  return {
    ok: false,
    status: 'attom_request_failed',
    httpStatus: 502,
    message: `ATTOM request failed with status ${statusCode}.`,
  }
}

function buildLookupAddress(body: PropertyLookupRequest): string {
  const street = (body.address || body.propertyAddress || body.address_line_1 || '').trim()

  if (street.includes(',') || (!body.city && !body.state && !body.zip)) {
    return street
  }

  return [street, body.city, body.state, body.zip]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ')
}

function normalizeAttomPayload(payload: unknown): NormalizedProperty {
  const root = getRecord(payload)
  const property = getFirstRecord(root?.property) || getFirstRecord(root?.data)

  if (!property) {
    return {
      source: 'api',
      confidence: 'low',
    }
  }

  const identifier = getRecord(property.identifier)
  const lot = getRecord(property.lot)
  const address = getRecord(property.address)
  const summary = getRecord(property.summary)
  const building = getRecord(property.building)
  const size = getRecord(building?.size)
  const rooms = getRecord(building?.rooms)
  const owner = getRecord(property.owner)
  const owner1 = getRecord(owner?.owner1)

  const beds = firstString(rooms?.beds, rooms?.bedrooms)
  const baths = firstString(rooms?.bathsTotal, rooms?.bathstotal, rooms?.bathsFull, rooms?.bathrooms)
  const parcelNumber = firstString(identifier?.apn, identifier?.attomId, identifier?.Id)

  return {
    beds,
    baths,
    bedrooms: beds,
    bathrooms: baths,
    squareFeet: firstString(size?.livingSize, size?.grossSizeAdjusted, size?.bldgSize, size?.grossSize),
    yearBuilt: firstString(summary?.yearBuilt, building?.yearBuilt),
    propertyType: firstString(summary?.propType, summary?.propertyType, summary?.propSubType, summary?.propClass),
    lotSize: firstString(lot?.lotSize2, lot?.lotsize2) || formatAcres(lot?.lotSize1 || lot?.lotsize1),
    ownerName: firstString(owner1?.fullName, owner?.owner, owner?.mailingName, owner?.ownerName),
    parcelNumber,
    apn: firstString(identifier?.apn),
    jurisdiction: firstString(address?.countrySecSubd, address?.locality),
    zoning: firstString(lot?.zoningType, lot?.zoning),
    source: 'api',
    confidence: 'medium',
  }
}

function summarizeAttomPayload(payload: unknown): Record<string, unknown> {
  const root = getRecord(payload)
  const status = getRecord(root?.status)
  const property = getFirstRecord(root?.property) || getFirstRecord(root?.data)
  const identifier = getRecord(property?.identifier)
  const address = getRecord(property?.address)

  return {
    statusCode: status?.code,
    statusMessage: status?.msg || status?.message,
    propertyCount: Array.isArray(root?.property) ? root.property.length : property ? 1 : 0,
    attomId: identifier?.attomId,
    apn: identifier?.apn,
    matchedAddress: address?.oneLine,
  }
}

function hasPropertyData(property: NormalizedProperty): boolean {
  return Boolean(
    property.beds ||
      property.baths ||
      property.squareFeet ||
      property.yearBuilt ||
      property.propertyType ||
      property.lotSize ||
      property.ownerName ||
      property.parcelNumber ||
      property.apn
  )
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function getFirstRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return getRecord(value[0])
  return getRecord(value)
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const text = getString(value)
    if (text) return text
  }

  return undefined
}

function getString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

function formatAcres(value: unknown): string | undefined {
  const text = getString(value)
  return text ? `${text} acres` : undefined
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
