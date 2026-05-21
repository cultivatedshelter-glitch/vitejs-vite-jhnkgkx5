import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
export const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  ''

const missingSupabaseEnv = !supabaseUrl || !supabaseAnonKey

console.info('[supabase-env]', {
  hasSupabaseUrl: Boolean(supabaseUrl),
  hasSupabaseAnonKey: Boolean(supabaseAnonKey),
})

const setupError = {
  message:
    'Supabase is not configured in this preview. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY to enable saved leads, files, reports, and app data.',
}
function createMissingSupabaseClient() {
  function createQueryBuilder() {
    let mode: 'read' | 'write' = 'read'
    const builder: Record<string, unknown> = {}
    const resolveRead = () => Promise.resolve({ data: [], error: null })
    const resolveWrite = () => Promise.resolve({ data: null, error: setupError })

    const chain = () => builder
    const write = () => {
      mode = 'write'
      return builder
    }

    Object.assign(builder, {
      select: chain,
      or: chain,
      order: chain,
      eq: chain,
      neq: chain,
      in: chain,
      is: chain,
      limit: chain,
      range: chain,
      insert: write,
      update: write,
      upsert: write,
      delete: write,
      single: () => (mode === 'write' ? resolveWrite() : Promise.resolve({ data: null, error: null })),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
        (mode === 'write' ? resolveWrite() : resolveRead()).then(resolve, reject),
    })

    return builder
  }

  return {
    from: () => createQueryBuilder(),
    functions: {
      invoke: () => Promise.resolve({ data: null, error: setupError }),
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: setupError }),
        download: () => Promise.resolve({ data: null, error: setupError }),
        createSignedUrl: () => Promise.resolve({ data: null, error: setupError }),
        list: () => Promise.resolve({ data: [], error: null }),
        remove: () => Promise.resolve({ data: null, error: setupError }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: null, error: setupError }),
      signUp: () => Promise.resolve({ data: null, error: setupError }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: () => undefined,
          },
        },
      }),
    },
  }
}

export const isSupabaseConfigured = !missingSupabaseEnv

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (createMissingSupabaseClient() as unknown as ReturnType<typeof createClient>)
