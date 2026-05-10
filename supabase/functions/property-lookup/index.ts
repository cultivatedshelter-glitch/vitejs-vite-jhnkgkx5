type PropertyLookupRequest = {
  address?: string
  propertyAddress?: string
  address_line_1?: string
  city?: string
  state?: string
  zip?: string
}

type ProviderName = 'attom' | 'estated' | 'custom'

type ProviderProperty = {
  squareFeet?: string | number
  yearBuilt?: string | number
  bedrooms?: string | number
  bathrooms?: string | number
  lotSize?: string | number
  propertyType?: string | number
  jurisdiction?: string | number
  zoning?: string | number
  parcelNumber?: string | number
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ATTOM_DEFAULT_URL = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile'
const ESTATED_DEFAULT_URL = 'https://apis.estated.com/v4/property'

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
    console.log('[property-lookup] request payload', { body, address })

    if (!address) {
      return jsonResponse({ status: 'error', error: 'Address is required.' }, 400)
    }

    const provider = getProviderConfig()

    if (!provider) {
      const responseBody = {
        status: 'provider_not_configured',
        message: 'No property data provider connected yet. Use county/ORMAP links or enter facts manually.',
        property: null,
      }
      console.log('[property-lookup] response', responseBody)
      return jsonResponse(responseBody)
    }

    const property = await fetchPropertyFromProvider(address, provider)

    if (!hasPropertyData(property)) {
      const responseBody = {
        status: 'no_records_found',
        message: 'Provider returned no data for this address. Use county/ORMAP links or enter facts manually.',
        property: null,
        provider: provider.name,
      }
      console.log('[property-lookup] response', responseBody)
      return jsonResponse(responseBody)
    }

    const responseBody = {
      status: 'data_found',
      message: `Property data found from ${provider.name}. Verify before using in estimates or reports.`,
      provider: provider.name,
      property: {
        squareFeet: toDisplayValue(property.squareFeet),
        yearBuilt: toDisplayValue(property.yearBuilt),
        bedrooms: toDisplayValue(property.bedrooms),
        bathrooms: toDisplayValue(property.bathrooms),
        lotSize: toDisplayValue(property.lotSize),
        propertyType: toDisplayValue(property.propertyType),
        jurisdiction: toDisplayValue(property.jurisdiction),
        zoning: toDisplayValue(property.zoning),
        parcelNumber: toDisplayValue(property.parcelNumber),
        source: 'api',
        confidence: 'medium',
      },
    }

    console.log('[property-lookup] response', responseBody)
    return jsonResponse(responseBody)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Property lookup failed.'
    const responseBody = { status: 'error', error: message }
    console.log('[property-lookup] response', responseBody)
    return jsonResponse(responseBody, 500)
  }
})

function buildLookupAddress(body: PropertyLookupRequest): string {
  const street = (body.address || body.propertyAddress || body.address_line_1 || '').trim()
  return [street, body.city, body.state, body.zip]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ')
}

function getProviderConfig(): { name: ProviderName; url: string; key: string } | null {
  const requestedProvider = Deno.env.get('PROPERTY_DATA_PROVIDER')?.toLowerCase()
  const sharedKey = Deno.env.get('PROPERTY_DATA_API_KEY')
  const attomKey = Deno.env.get('ATTOM_API_KEY') || (requestedProvider !== 'estated' ? sharedKey : undefined)
  const estatedKey = Deno.env.get('ESTATED_API_KEY') || (requestedProvider === 'estated' ? sharedKey : undefined)
  const customUrl = Deno.env.get('PROPERTY_DATA_API_URL')
  const customKey = sharedKey

  if ((requestedProvider === 'attom' || (!requestedProvider && attomKey)) && attomKey) {
    return {
      name: 'attom',
      url: Deno.env.get('ATTOM_API_URL') || ATTOM_DEFAULT_URL,
      key: attomKey,
    }
  }

  if ((requestedProvider === 'estated' || (!requestedProvider && estatedKey)) && estatedKey) {
    return {
      name: 'estated',
      url: Deno.env.get('ESTATED_API_URL') || ESTATED_DEFAULT_URL,
      key: estatedKey,
    }
  }

  if (customUrl && customKey) {
    return {
      name: 'custom',
      url: customUrl,
      key: customKey,
    }
  }

  return null
}

async function fetchPropertyFromProvider(
  address: string,
  provider: { name: ProviderName; url: string; key: string }
): Promise<ProviderProperty> {
  if (provider.name === 'attom') return fetchAttomProperty(address, provider.url, provider.key)
  if (provider.name === 'estated') return fetchEstatedProperty(address, provider.url, provider.key)
  return fetchCustomProperty(address, provider.url, provider.key)
}

async function fetchAttomProperty(address: string, providerUrl: string, providerKey: string): Promise<ProviderProperty> {
  const url = new URL(providerUrl)
  url.searchParams.set('address', address)

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      apikey: providerKey,
    },
  })

  if (!response.ok) {
    throw new Error(`ATTOM property provider returned ${response.status}.`)
  }

  return normalizeAttomPayload(await response.json())
}

async function fetchEstatedProperty(address: string, providerUrl: string, providerKey: string): Promise<ProviderProperty> {
  const url = new URL(providerUrl)
  url.searchParams.set('token', providerKey)
  url.searchParams.set('combined_address', address)

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Estated property provider returned ${response.status}.`)
  }

  return normalizeEstatedPayload(await response.json())
}

async function fetchCustomProperty(address: string, providerUrl: string, providerKey: string): Promise<ProviderProperty> {
  const url = new URL(providerUrl)
  url.searchParams.set('address', address)

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${providerKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Property provider returned ${response.status}.`)
  }

  return normalizeGenericPayload(await response.json())
}

function normalizeAttomPayload(payload: unknown): ProviderProperty {
  const root = getRecord(payload)
  const property = getFirstRecord(root?.property) || getFirstRecord(root?.data) || root
  if (!property) return {}

  const identifier = getRecord(property.identifier)
  const lot = getRecord(property.lot)
  const area = getRecord(property.area)
  const address = getRecord(property.address)
  const summary = getRecord(property.summary)
  const building = getRecord(property.building)
  const size = getRecord(building?.size)
  const rooms = getRecord(building?.rooms)

  return {
    squareFeet:
      getString(size?.livingSize) ||
      getString(size?.grossSizeAdjusted) ||
      getString(size?.bldgSize) ||
      getString(size?.grossSize),
    yearBuilt: getString(summary?.yearBuilt),
    bedrooms: getString(rooms?.beds),
    bathrooms:
      getString(rooms?.bathsTotal) ||
      getString(rooms?.bathstotal) ||
      getString(rooms?.bathsFull) ||
      getString(rooms?.bathrooms),
    lotSize: getString(lot?.lotSize2) || formatAcres(lot?.lotSize1),
    propertyType:
      getString(summary?.propType) ||
      getString(summary?.propertyType) ||
      getString(summary?.propSubType) ||
      getString(summary?.propClass),
    jurisdiction: getString(area?.countrySecSubd) || getString(address?.locality),
    zoning: getString(lot?.zoningType),
    parcelNumber: getString(identifier?.apn) || getString(identifier?.attomId) || getString(identifier?.Id),
  }
}

function normalizeEstatedPayload(payload: unknown): ProviderProperty {
  const root = getRecord(payload)
  const data = getRecord(root?.data) || root
  if (!data) return {}

  const metadata = getRecord(data.metadata)
  const parcel = getRecord(data.parcel)
  const structure = getRecord(data.structure)
  const address = getRecord(data.address)

  return {
    squareFeet:
      getStringByPath(structure, 'total_area_sq_ft') ||
      getStringByPath(structure, 'living_area_sq_ft') ||
      getStringByPath(structure, 'building_area_sq_ft') ||
      getStringByPath(structure, 'finished_area_sq_ft'),
    yearBuilt: getStringByPath(structure, 'year_built'),
    bedrooms: getStringByPath(structure, 'beds_count') || getStringByPath(structure, 'bedrooms_count'),
    bathrooms:
      getStringByPath(structure, 'baths') ||
      getStringByPath(structure, 'baths_count') ||
      getStringByPath(structure, 'bathrooms_count'),
    lotSize: getStringByPath(parcel, 'area_sq_ft') || formatAcres(getStringByPath(parcel, 'area_acres')),
    propertyType:
      getStringByPath(parcel, 'standardized_land_use_type') ||
      getStringByPath(parcel, 'land_use_type') ||
      getStringByPath(parcel, 'property_type'),
    jurisdiction: getStringByPath(address, 'county') || getStringByPath(address, 'city'),
    zoning: getStringByPath(parcel, 'zoning'),
    parcelNumber: getStringByPath(parcel, 'apn') || getStringByPath(parcel, 'apn_original') || getString(metadata?.attom_id),
  }
}

function normalizeGenericPayload(payload: unknown): ProviderProperty {
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
    propertyType: getString(property.propertyType) || getString(property.property_type) || getString(property.landUse),
    jurisdiction: getString(property.jurisdiction) || getString(property.county) || getString(property.city),
    zoning: getString(property.zoning) || getString(property.zone),
    parcelNumber: getString(property.parcelNumber) || getString(property.parcel) || getString(property.apn),
  }
}

function hasPropertyData(property: ProviderProperty): boolean {
  return Boolean(
    property.squareFeet ||
      property.yearBuilt ||
      property.bedrooms ||
      property.bathrooms ||
      property.lotSize ||
      property.propertyType ||
      property.jurisdiction ||
      property.zoning ||
      property.parcelNumber
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

function getString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString()
  return undefined
}

function getStringByPath(record: Record<string, unknown> | null, path: string): string | undefined {
  if (!record) return undefined

  const directValue = getString(record[path])
  if (directValue) return directValue

  const camelPath = path.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
  return getString(record[camelPath])
}

function formatAcres(value: unknown): string | undefined {
  const text = getString(value)
  return text ? `${text} acres` : undefined
}

function toDisplayValue(value: unknown): string | undefined {
  return getString(value)
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
