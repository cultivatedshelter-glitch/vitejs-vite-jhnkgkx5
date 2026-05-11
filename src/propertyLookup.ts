import { supabaseAnonKey, supabaseUrl } from './supabase'

export type PropertyFacts = {
  squareFeet: string
  yearBuilt: string
  bedrooms: string
  bathrooms: string
  lotSize: string
  propertyType?: string
  jurisdiction?: string
  zoning?: string
  parcelNumber?: string
  verified?: boolean
  verificationNotes?: string
  source: 'api' | 'fallback'
  confidence: 'high' | 'medium' | 'low'
  notes?: string
  lookupStatus?: PropertyLookupStatus
}

export type PropertyLookupStatus =
  | 'idle'
  | 'function_missing'
  | 'function_unavailable'
  | 'provider_not_configured'
  | 'no_records_found'
  | 'data_found'
  | 'error'

type PropertyLookupResponse = {
  property?: Partial<PropertyFacts> | null
  error?: string
  status?: PropertyLookupStatus
  message?: string
}

export function emptyPropertyFacts(): PropertyFacts {
  return {
    squareFeet: '',
    yearBuilt: '',
    bedrooms: '',
    bathrooms: '',
    lotSize: '',
    source: 'fallback',
    confidence: 'low',
    lookupStatus: 'idle',
  }
}

export async function lookupPropertyFacts(address: string): Promise<PropertyFacts> {
  const cleanAddress = address.trim()

  if (!cleanAddress) {
    throw new Error('Enter a property address before pulling property info.')
  }

  const payload = { address: cleanAddress }
  const functionUrl = `${supabaseUrl}/functions/v1/property-lookup`
  console.info('[property-lookup] request payload', payload)
  console.info('[property-lookup] env', {
    hasSupabaseUrl: Boolean(supabaseUrl),
    hasSupabaseAnonKey: Boolean(supabaseAnonKey),
  })

  if (!functionUrl.startsWith('http') || !supabaseAnonKey) {
    return fallbackPropertyFacts(
      'function unavailable',
      'Property lookup is not connected to Supabase in this deployment. Use county/ORMAP links or enter facts manually.',
      'function_unavailable'
    )
  }

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()
    let data: PropertyLookupResponse | null = null

    try {
      data = responseText ? JSON.parse(responseText) : null
    } catch {
      data = null
    }

    console.info('[property-lookup] response', {
      status: response.status,
      ok: response.ok,
      data,
      raw: responseText,
    })

    if (response.status === 404) {
      return fallbackPropertyFacts(
        'function missing',
        'Property lookup function is missing. Use county/ORMAP links or enter facts manually.',
        'function_missing'
      )
    }

    if (!response.ok) {
      return fallbackPropertyFacts(
        'function unavailable',
        data?.message || data?.error || 'Property lookup function is unavailable. Use county/ORMAP links or enter facts manually.',
        'function_unavailable'
      )
    }

    if (data?.error) {
      return fallbackPropertyFacts(
        data.status === 'provider_not_configured' ? 'provider missing' : 'lookup error',
        data.message || data.error,
        data.status || 'error'
      )
    }

    if (data?.status === 'provider_not_configured') {
      return fallbackPropertyFacts(
        'provider missing',
        data.message || 'No property data provider connected yet. Use county/ORMAP links or enter facts manually.',
        'provider_not_configured'
      )
    }

    if (data?.status === 'no_records_found') {
      return fallbackPropertyFacts(
        'provider returned no data',
        data.message || 'Provider returned no data. Use county/ORMAP links or enter facts manually.',
        'no_records_found'
      )
    }

    return {
      ...emptyPropertyFacts(),
      ...data?.property,
      source: data?.property?.source || 'api',
      confidence: data?.property?.confidence || 'high',
      lookupStatus: data?.status || 'data_found',
      notes: data?.message || 'data found',
    }
  } catch (error) {
    console.info('[property-lookup] response', { error })
    return fallbackPropertyFacts(
      'function unavailable',
      'Property lookup function is unavailable. Use county/ORMAP links or enter facts manually.',
      'function_unavailable'
    )
  }
}

function fallbackPropertyFacts(
  notes = 'Property lookup unavailable — manual entry still works.',
  message = notes,
  lookupStatus: PropertyLookupStatus = 'function_unavailable'
): PropertyFacts {
  return {
    squareFeet: '',
    yearBuilt: '',
    bedrooms: '',
    bathrooms: '',
    lotSize: '',
    source: 'fallback',
    confidence: 'low',
    lookupStatus,
    notes: message || notes,
  }
}
