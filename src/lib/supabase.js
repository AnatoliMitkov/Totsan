import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const AUTH_PERSISTENCE_MODE_KEY = 'totsan.auth.persistence'
const AUTH_REMEMBER_UNTIL_KEY = 'totsan.auth.remember-until'
const AUTH_REMEMBER_DURATION_MS = 30 * 24 * 60 * 60 * 1000

function getBrowserStorage(type) {
  if (typeof window === 'undefined') return null

  try {
    return type === 'session' ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

function usesSessionOnlyStorage() {
  return getBrowserStorage('session')?.getItem(AUTH_PERSISTENCE_MODE_KEY) === 'session'
}

function getRememberUntil() {
  const storage = getBrowserStorage('local')
  if (!storage) return 0

  const storedDeadline = Number(storage.getItem(AUTH_REMEMBER_UNTIL_KEY))
  if (Number.isFinite(storedDeadline) && storedDeadline > 0) return storedDeadline

  const deadline = Date.now() + AUTH_REMEMBER_DURATION_MS
  storage.setItem(AUTH_REMEMBER_UNTIL_KEY, String(deadline))
  return deadline
}

const authSessionStorage = {
  getItem(key) {
    const localStorage = getBrowserStorage('local')
    const sessionStorage = getBrowserStorage('session')
    if (!localStorage || !sessionStorage) return null

    if (usesSessionOnlyStorage()) {
      return sessionStorage.getItem(key)
    }

    if (Date.now() >= getRememberUntil()) {
      localStorage.removeItem(key)
      return null
    }

    return localStorage.getItem(key)
  },
  setItem(key, value) {
    const localStorage = getBrowserStorage('local')
    const sessionStorage = getBrowserStorage('session')
    if (!localStorage || !sessionStorage) return

    if (usesSessionOnlyStorage()) {
      sessionStorage.setItem(key, value)
      localStorage.removeItem(key)
      return
    }

    localStorage.setItem(key, value)
    sessionStorage.removeItem(key)
  },
  removeItem(key) {
    getBrowserStorage('local')?.removeItem(key)
    getBrowserStorage('session')?.removeItem(key)
  },
}

export function setAuthPersistencePreference(rememberFor30Days) {
  const localStorage = getBrowserStorage('local')
  const sessionStorage = getBrowserStorage('session')
  if (!localStorage || !sessionStorage) return

  if (rememberFor30Days) {
    sessionStorage.removeItem(AUTH_PERSISTENCE_MODE_KEY)
    localStorage.setItem(AUTH_PERSISTENCE_MODE_KEY, 'remember')
    localStorage.setItem(AUTH_REMEMBER_UNTIL_KEY, String(Date.now() + AUTH_REMEMBER_DURATION_MS))
    return
  }

  sessionStorage.setItem(AUTH_PERSISTENCE_MODE_KEY, 'session')
  localStorage.removeItem(AUTH_PERSISTENCE_MODE_KEY)
  localStorage.removeItem(AUTH_REMEMBER_UNTIL_KEY)
}

// Validate config consistency
if (!url && anonKey) {
  console.warn('[supabase] Supabase URL is missing but key is present. This will cause failures.')
}
if (url && !anonKey) {
  console.warn('[supabase] Supabase URL is present but public key is missing. This will cause failures.')
}

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
      resetPasswordForEmail: async () => ({ data: null, error: missingConfigError }),
      signUp: async () => ({ data: null, error: missingConfigError }),
      verifyOtp: async () => ({ data: null, error: missingConfigError }),
      resend: async () => ({ data: null, error: missingConfigError }),
      updateUser: async () => ({ data: null, error: missingConfigError }),
      mfa: {
        enroll: async () => ({ data: null, error: missingConfigError }),
        challenge: async () => ({ data: null, error: missingConfigError }),
        verify: async () => ({ data: null, error: missingConfigError }),
        challengeAndVerify: async () => ({ data: null, error: missingConfigError }),
        listFactors: async () => ({ data: { all: [], totp: [], phone: [], webauthn: [] }, error: missingConfigError }),
        unenroll: async () => ({ data: null, error: missingConfigError }),
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: null, nextLevel: null, currentAuthenticationMethods: [] }, error: missingConfigError }),
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
        storage: authSessionStorage,
      },
    })
  : createMockSupabaseClient()

if (hasSupabaseConfig && typeof window !== 'undefined') {
  let deadlineSignOutPending = false

  const enforceRememberDeadline = async () => {
    if (deadlineSignOutPending || usesSessionOnlyStorage()) return

    const deadline = Number(getBrowserStorage('local')?.getItem(AUTH_REMEMBER_UNTIL_KEY))
    if (!Number.isFinite(deadline) || deadline <= 0 || Date.now() < deadline) return

    deadlineSignOutPending = true
    try {
      await supabase.auth.signOut()
    } finally {
      deadlineSignOutPending = false
    }
  }

  window.setInterval(enforceRememberDeadline, 60_000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void enforceRememberDeadline()
  })
}

export const brand = {
  name: import.meta.env.VITE_BRAND_NAME || 'Totsan',
  tagline: import.meta.env.VITE_BRAND_TAGLINE || 'Reality Beyond Renders',
  email: import.meta.env.VITE_CONTACT_EMAIL || 'sales@totsan.com',
  phone: import.meta.env.VITE_CONTACT_PHONE || '+359 89 270 3058',
}
