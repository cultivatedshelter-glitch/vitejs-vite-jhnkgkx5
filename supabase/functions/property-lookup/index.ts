type PropertyLookupRequest = {
  address?: string
  propertyAddress?: string
  address_line_1?: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  zip?: string
  debug?: boolean
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

    if (body.debug === true) {
      return jsonResponse({
        hasAttomKey: Boolean(Deno.env.get('ATTOM_API_KEY')),
        hasPropertyDataKey: Boolean(Deno.env.get('PROPERTY_DATA_API_KEY')),
        hasPropertyDataUrl: Boolean(Deno.env.get('PROPERTY_DATA_API_URL')),
      })
    }

    const address = normalizeLookupAddress(body)
    console.log('[property-lookup] request received', {
      hasAddress1: Boolean(address.address1),
      hasAddress2: Boolean(address.address2),
      missingFields: address.missingFields,
    })

    if (address.missingFields.length > 0) {
      return jsonResponse({
        status: 'attom_bad_request',
        error: `Missing address fields: ${address.missingFields.join(', ')}.`,
        message: `Missing address fields: ${address.missingFields.join(', ')}.`,
      }, 400)
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

type NormalizedLookupAddress = {
  address1: string
  address2: string
  displayAddress: string
  missingFields: string[]
}

async function fetchAttomProperty(
  address: NormalizedLookupAddress,
  attomKey: string
): Promise<
  | { ok: true; payload: unknown }
  | { ok: false; status: AttomLookupStatus; httpStatus: number; message: string }
> {
  const endpointPath = ATTOM_BASIC_PROFILE_PATH
  const url = new URL(`${ATTOM_BASE_URL}${endpointPath}`)
  url.searchParams.set('address1', address.address1)
  url.searchParams.set('address2', address.address2)

  let response: Response
  let responseText = ''

  try {
    console.log('[property-lookup] ATTOM request', { endpointPath, address1: address.address1, address2: address.address2 })

    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        accept: 'application/json',
        apikey: attomKey,
        attomdataapikey: attomKey,
      },
    })

    responseText = await response.text()
    console.log('[property-lookup] ATTOM response', {
      endpointPath,
      responseStatus: response.status,
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
    console.log('[property-lookup] ATTOM failure body', {
      endpointPath,
      responseStatus: response.status,
      responseBodyPreview: responseText.slice(0, 500),
    })
    return mapAttomError(response.status)
  }

  let payload: unknown

  try {
    payload = responseText ? JSON.parse(responseText) : null
  } catch {
    console.log('[property-lookup] ATTOM JSON parse failure', {
      endpointPath,
      responseStatus: response.status,
      responseBodyPreview: responseText.slice(0, 500),
    })
    return {
      ok: false,
      status: 'attom_request_failed',
      httpStatus: 502,
      message: 'ATTOM returned a non-JSON response.',
    }
  }

  const summary = summarizeAttomPayload(payload)

  if (summary.statusCode && String(summary.statusCode).startsWith('4')) {
    console.log('[property-lookup] ATTOM status failure body', {
      endpointPath,
      responseStatus: response.status,
      responseBodyPreview: responseText.slice(0, 500),
    })
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

function normalizeLookupAddress(body: PropertyLookupRequest): NormalizedLookupAddress {
  const rawStreet = (body.address_line_1 || body.address1 || body.propertyAddress || body.address || '').trim()
  const street = rawStreet.split(',')[0]?.trim().replace(/\s+/g, ' ') || ''
  const city = (body.city || '').trim().replace(/\s+/g, ' ')
  const state = (body.state || '').trim().toUpperCase()
  const zip = (body.zip || '').trim().match(/\d{5}(?:-\d{4})?/)?.[0] || (body.zip || '').trim()
  const address2 = (body.address2 || [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')).trim()
  const missingFields = [
    !street ? 'street address' : '',
    !city ? 'city' : '',
    !state ? 'state' : '',
    !zip ? 'zip' : '',
  ].filter(Boolean)

  return {
    address1: street,
    address2,
    displayAddress: [street, address2].filter(Boolean).join(', '),
    missingFields,
  }
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
