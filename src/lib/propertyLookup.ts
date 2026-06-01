export type PropertyLookupResult = {
  address: string
  addressLine1: string
  city: string
  state: string
  zip: string
  squareFeet: string
  yearBuilt: string
  bedrooms: string
  bathrooms: string
  lotSize: string
  source: "api" | "fallback"
  confidence: "high" | "medium" | "low"
  notes?: string
}

export type NormalizedPropertyAddress = {
  addressLine1: string
  city: string
  state: string
  zip: string
  address1: string
  address2: string
  displayAddress: string
}

type PropertyLookupResponse = {
  property?: Partial<PropertyLookupResult>
  error?: string
  debug?: string
}

const propertyLookupEndpoint = import.meta.env.VITE_PROPERTY_LOOKUP_ENDPOINT
const propertyLookupToken = import.meta.env.VITE_PROPERTY_LOOKUP_TOKEN

export function normalizePropertyAddress(
  addressLine1: string,
  city: string,
  state: string,
  zip: string
): NormalizedPropertyAddress {
  const cleanAddressLine1 = addressLine1.trim().replace(/\s+/g, " ")
  const cleanCity = city.trim().replace(/\s+/g, " ")
  const cleanState = state.trim().toUpperCase()
  const cleanZip = zip.trim().match(/\d{5}(?:-\d{4})?/)?.[0] || zip.trim()
  const address2 = [cleanCity, [cleanState, cleanZip].filter(Boolean).join(" ")].filter(Boolean).join(", ")

  return {
    addressLine1: cleanAddressLine1,
    city: cleanCity,
    state: cleanState,
    zip: cleanZip,
    address1: cleanAddressLine1,
    address2,
    displayAddress: [cleanAddressLine1, address2].filter(Boolean).join(", "),
  }
}

export async function lookupProperty(
  addressLine1: string,
  city: string,
  state: string,
  zip: string
): Promise<PropertyLookupResult> {
  const normalized = normalizePropertyAddress(addressLine1, city, state, zip)
  const missingFields = [
    !normalized.addressLine1 ? "street address" : "",
    !normalized.city ? "city" : "",
    !normalized.state ? "state" : "",
    !normalized.zip ? "zip" : "",
  ].filter(Boolean)

  if (missingFields.length > 0) {
    throw new Error(`Missing address fields: ${missingFields.join(", ")}.`)
  }

  if (!propertyLookupEndpoint) {
    return createFallbackProperty(normalized, "Provider not configured. You can enter property facts manually.")
  }

  const response = await fetch(propertyLookupEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(propertyLookupToken ? { Authorization: `Bearer ${propertyLookupToken}` } : {}),
    },
    body: JSON.stringify({
      address: normalized.displayAddress,
      address_line_1: normalized.addressLine1,
      city: normalized.city,
      state: normalized.state,
      zip: normalized.zip,
      address1: normalized.address1,
      address2: normalized.address2,
    }),
  })

  const payload = (await response.json().catch(() => ({}))) as PropertyLookupResponse

  if (!response.ok) {
    const providerRejected = response.status === 400 || response.status === 422 || /reject|invalid|address/i.test(payload.error || "")
    throw new Error(
      providerRejected
        ? `Provider rejected address: ${payload.error || "ATTOM could not match the normalized address."}`
        : payload.error || "Property lookup failed. You can enter property facts manually."
    )
  }

  return {
    ...createFallbackProperty(normalized, "Lookup success. Review and edit the property facts before submitting."),
    ...payload.property,
    address: payload.property?.address || normalized.displayAddress,
    addressLine1: payload.property?.addressLine1 || normalized.addressLine1,
    city: payload.property?.city || normalized.city,
    state: payload.property?.state || normalized.state,
    zip: payload.property?.zip || normalized.zip,
    source: "api",
    confidence: payload.property?.confidence || "medium",
    notes: payload.property?.notes || payload.debug || "Lookup success.",
  }
}

function createFallbackProperty(normalized: NormalizedPropertyAddress, notes: string): PropertyLookupResult {
  return {
    address: normalized.displayAddress,
    addressLine1: normalized.addressLine1,
    city: normalized.city,
    state: normalized.state,
    zip: normalized.zip,
    squareFeet: "Confirm with listing data",
    yearBuilt: "Public record pending",
    bedrooms: "TBD",
    bathrooms: "TBD",
    lotSize: "TBD",
    source: "fallback",
    confidence: "low",
    notes,
  }
}
