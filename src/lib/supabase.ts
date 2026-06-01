const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ""
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ""

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

type QueryValue = string | number | boolean

function ensureSupabaseConfig() {
  if (!hasSupabaseConfig) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.")
  }
}

function buildRestUrl(table: string, query: Record<string, QueryValue> = {}) {
  ensureSupabaseConfig()
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`)

  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, String(value))
  })

  return url
}

async function request<T>(url: URL | string, init: RequestInit = {}) {
  ensureSupabaseConfig()
  const headers = new Headers(init.headers)
  headers.set("apikey", supabaseAnonKey)
  headers.set("Authorization", `Bearer ${supabaseAnonKey}`)

  const response = await fetch(url, { ...init, headers })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error_description || payload?.error || "Supabase request failed.")
  }

  return payload as T
}

export async function selectRows<T>(table: string, query: Record<string, QueryValue> = {}) {
  return request<T[]>(buildRestUrl(table, { select: "*", ...query }))
}

export async function insertRows<T>(table: string, rows: unknown[]) {
  return request<T[]>(buildRestUrl(table, { select: "*" }), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(rows),
  })
}

export async function updateRows<T>(table: string, query: Record<string, QueryValue>, values: Record<string, unknown>) {
  return request<T[]>(buildRestUrl(table, { select: "*", ...query }), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(values),
  })
}

export async function uploadPropertyFile(path: string, file: File) {
  ensureSupabaseConfig()
  const cleanPath = path.replace(/^\/+/, "")

  await request(`${supabaseUrl}/storage/v1/object/property-files/${cleanPath}`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: file,
  })

  return {
    bucket: "property-files",
    path: cleanPath,
  }
}

export async function createSignedFileUrl(path: string) {
  const payload = await request<{ signedURL: string }>(
    `${supabaseUrl}/storage/v1/object/sign/property-files/${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 60 * 10 }),
    }
  )

  return `${supabaseUrl}/storage/v1${payload.signedURL}`
}
