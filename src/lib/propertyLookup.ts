export type PropertyLookupResult = {
  address: string
  squareFeet: string
  yearBuilt: string
  bedrooms: string
  bathrooms: string
  lotSize: string
  source: "api" | "fallback"
  confidence: "high" | "medium" | "low"
  notes?: string
}

type PropertyLookupResponse = {
  property?: Partial<PropertyLookupResult>
  error?: string
}

const propertyLookupEndpoint = import.meta.env.VITE_PROPERTY_LOOKUP_ENDPOINT
const propertyLookupToken = import.meta.env.VITE_PROPERTY_LOOKUP_TOKEN

export async function lookupProperty(address: string): Promise<PropertyLookupResult> {
  const cleanAddress = address.trim()

  if (!cleanAddress) {
    throw new Error("Enter a property address before pulling property info.")
  }

  if (!propertyLookupEndpoint) {
    return createFallbackProperty(cleanAddress)
  }

  const response = await fetch(propertyLookupEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(propertyLookupToken ? { Authorization: `Bearer ${propertyLookupToken}` } : {}),
    },
    body: JSON.stringify({ address: cleanAddress }),
  })

  const payload = (await response.json().catch(() => ({}))) as PropertyLookupResponse

  if (!response.ok) {
    throw new Error(payload.error || "Property lookup failed.")
  }

  return {
    ...createFallbackProperty(cleanAddress),
    ...payload.property,
    address: payload.property?.address || cleanAddress,
    source: "api",
    confidence: payload.property?.confidence || "medium",
  }
}

function createFallbackProperty(address: string): PropertyLookupResult {
  return {
    address,
    squareFeet: "Confirm with listing data",
    yearBuilt: "Public record pending",
    bedrooms: "TBD",
    bathrooms: "TBD",
    lotSize: "TBD",
    source: "fallback",
    confidence: "low",
    notes: "Connect VITE_PROPERTY_LOOKUP_ENDPOINT to enable live property records.",
  }
}
