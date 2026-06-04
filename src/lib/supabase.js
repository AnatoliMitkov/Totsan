import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabaseUrl = url || ''
export const supabasePublicKey = anonKey || ''
export const hasSupabaseConfig = Boolean(url && anonKey)

function createMissingConfigError() {
  return new Error('Supabase is not configured. Add VITE_SUPABASE_URL and a public Supabase key (VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY) to .env.local.')
}

function createMockQuery() {
  const target = function mockQuery() {}

  return new Proxy(target, {
    apply() {
      return createMockQuery()
    },
    get(_obj, prop) {
      if (prop === 'then') {
        return (resolve) => resolve({ data: null, error: createMissingConfigError() })
      }
      return createMockQuery()
    },
  })
}

function createMockSupabaseClient() {
  const query = () => createMockQuery()
  const missingConfigError = createMissingConfigError()

  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: (callback) => {
        if (typeof callback === 'function') callback('INITIAL_SESSION', null)
        return { data: { subscription: { unsubscribe() {} } } }
      },
      signOut: async () => ({ error: missingConfigError }),
      signInWithOAuth: async () => ({ data: null, error: missingConfigError }),
      signInWithPassword: async () => ({ data: null, error: missingConfigError }),
      signInWithPasskey: async () => ({ data: null, error: missingConfigError }),
      registerPasskey: async () => ({ data: null, error: missingConfigError }),
      signUp: async () => ({ data: null, error: missingConfigError }),
      passkey: {
        list: async () => ({ data: null, error: missingConfigError }),
        delete: async () => ({ data: null, error: missingConfigError }),
      },
    },
    from: query,
    rpc: query,
    channel: () => ({
      on() { return this },
      subscribe() { return this },
      unsubscribe() {},
    }),
    removeChannel() {},
    functions: {
      invoke: async () => ({ data: null, error: createMissingConfigError() }),
    },
    storage: {
      from: query,
    },
  }
}

if (!hasSupabaseConfig) {
  console.warn('[supabase] Missing VITE_SUPABASE_URL and public Supabase key (VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY) in .env.local')
}

export const supabase = hasSupabaseConfig
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        experimental: {
          passkey: true,
        },
      },
    })
  : createMockSupabaseClient()

export const brand = {
  name: import.meta.env.VITE_BRAND_NAME || 'Totsan',
  tagline: import.meta.env.VITE_BRAND_TAGLINE || 'Reality Beyond Renders',
  email: import.meta.env.VITE_CONTACT_EMAIL || 'sales@totsan.com',
  phone: import.meta.env.VITE_CONTACT_PHONE || '+359 89 270 3058',
}
