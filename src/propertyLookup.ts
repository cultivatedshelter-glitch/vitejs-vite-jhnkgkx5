import { supabase } from './supabase'

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
}

type PropertyLookupResponse = {
  property?: Partial<PropertyFacts>
  error?: string
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
  }
}

export async function lookupPropertyFacts(address: string): Promise<PropertyFacts> {
  const cleanAddress = address.trim()

  if (!cleanAddress) {
    throw new Error('Enter a property address before pulling property info.')
  }

  const { data, error } = await supabase.functions.invoke<PropertyLookupResponse>('property-lookup', {
    body: { address: cleanAddress },
  })

  if (error) {
    return fallbackPropertyFacts('Property lookup API is not deployed yet. Using report placeholders.')
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return {
    ...fallbackPropertyFacts(),
    ...data?.property,
    source: data?.property?.source || 'api',
    confidence: data?.property?.confidence || 'medium',
  }
}

function fallbackPropertyFacts(notes = 'Connect a property data provider to enable live public records.'): PropertyFacts {
  return {
    squareFeet: 'Confirm with listing data',
    yearBuilt: 'Public record pending',
    bedrooms: 'TBD',
    bathrooms: 'TBD',
    lotSize: 'TBD',
    source: 'fallback',
    confidence: 'low',
    notes,
  }
}
