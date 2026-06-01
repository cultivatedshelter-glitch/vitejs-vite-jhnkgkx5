type PropertyLookupRequest = {
  address?: string
  address_line_1?: string
  city?: string
  state?: string
  zip?: string
  address1?: string
  address2?: string
}

type ProviderProperty = {
  address?: string
  squareFeet?: string | number
  yearBuilt?: string | number
  bedrooms?: string | number
  bathrooms?: string | number
  lotSize?: string | number
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Use POST for property lookup." }, 405)
  }

  try {
    const body = (await request.json()) as PropertyLookupRequest
    const normalizedAddress = normalizeRequestAddress(body)

    if (normalizedAddress.missingFields.length > 0) {
      return jsonResponse(
        {
          error: `Missing address fields: ${normalizedAddress.missingFields.join(", ")}.`,
          debug: "missing address fields",
        },
        400
      )
    }

    const providerConfigured = Boolean(Deno.env.get("PROPERTY_DATA_API_URL"))
    const property = await fetchPropertyFromProvider(normalizedAddress)

    return jsonResponse({
      debug: providerConfigured ? "lookup success" : "provider not configured",
      property: {
        address: property.address || normalizedAddress.displayAddress,
        addressLine1: normalizedAddress.addressLine1,
        city: normalizedAddress.city,
        state: normalizedAddress.state,
        zip: normalizedAddress.zip,
        squareFeet: toDisplayValue(property.squareFeet, "Confirm with listing data"),
        yearBuilt: toDisplayValue(property.yearBuilt, "Public record pending"),
        bedrooms: toDisplayValue(property.bedrooms, "TBD"),
        bathrooms: toDisplayValue(property.bathrooms, "TBD"),
        lotSize: toDisplayValue(property.lotSize, "TBD"),
        confidence: "medium",
        notes: providerConfigured
          ? "Returned from configured property data provider."
          : "Provider not configured. Enter property facts manually.",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Property lookup failed."
    const rejected = /rejected|invalid|not found|bad request|400|422/i.test(message)
    return jsonResponse(
      {
        error: rejected ? `Provider rejected address. ${message}` : message,
        debug: rejected ? "provider rejected address" : "property lookup failed",
      },
      rejected ? 422 : 500
    )
  }
})

type NormalizedAddress = {
  addressLine1: string
  city: string
  state: string
  zip: string
  address1: string
  address2: string
  displayAddress: string
  missingFields: string[]
}

function normalizeRequestAddress(body: PropertyLookupRequest): NormalizedAddress {
  const addressLine1 = cleanText(body.address_line_1 || body.address1 || "")
  const city = cleanText(body.city || "")
  const state = cleanText(body.state || "").toUpperCase()
  const zip = cleanText(body.zip || "").match(/\d{5}(?:-\d{4})?/)?.[0] || cleanText(body.zip || "")
  const address2 = cleanText(body.address2 || [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", "))
  const displayAddress = cleanText(body.address || [addressLine1, address2].filter(Boolean).join(", "))
  const missingFields = [
    !addressLine1 ? "street address" : "",
    !city ? "city" : "",
    !state ? "state" : "",
    !zip ? "zip" : "",
  ].filter(Boolean)

  return {
    addressLine1,
    city,
    state,
    zip,
    address1: addressLine1,
    address2,
    displayAddress,
    missingFields,
  }
}

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

async function fetchPropertyFromProvider(address: NormalizedAddress): Promise<ProviderProperty> {
  const providerUrl = Deno.env.get("PROPERTY_DATA_API_URL")
  const providerKey = Deno.env.get("PROPERTY_DATA_API_KEY")

  if (!providerUrl) {
    return {
      address: address.displayAddress,
      squareFeet: "Confirm with listing data",
      yearBuilt: "Public record pending",
      bedrooms: "TBD",
      bathrooms: "TBD",
      lotSize: "TBD",
    }
  }

  const url = new URL(providerUrl)
  url.searchParams.set("address1", address.address1)
  url.searchParams.set("address2", address.address2)

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(providerKey ? { Authorization: `Bearer ${providerKey}` } : {}),
    },
  })

  if (!response.ok) {
    const providerMessage = await response.text().catch(() => "")
    throw new Error(`Property provider returned ${response.status}. ${providerMessage.slice(0, 180)}`)
  }

  const payload = await response.json()
  return normalizeProviderPayload(payload, address.displayAddress)
}

function normalizeProviderPayload(payload: unknown, address: string): ProviderProperty {
  if (!payload || typeof payload !== "object") {
    return { address }
  }

  const record = payload as Record<string, unknown>
  const property = getRecord(record.property) || getRecord(record.data) || record

  return {
    address: getString(property.address) || address,
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
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function getString(value: unknown): string | undefined {
  if (typeof value === "string") return value
  if (typeof value === "number") return value.toLocaleString()
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
      "Content-Type": "application/json",
    },
  })
}
