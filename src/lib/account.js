import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { loadMfaStatus } from './mfa.js'

const ACCOUNT_COLUMNS_BASE = 'id, email, full_name, display_name, role, specialist_status, account_status, phone, avatar_url, city, country, bio, locale, marketing_opt_in, interests, style_preferences, preferred_contact_method, age_group, gender, stripe_account_id, created_at'
const ACCOUNT_COLUMNS = `id, email, full_name, display_name, role, specialist_status, account_status, phone, avatar_url, cover_url, city, country, bio, locale, marketing_opt_in, interests, style_preferences, preferred_contact_method, age_group, gender, stripe_account_id, created_at`

function emptyMfaState() {
  return { loading: false, needsMfa: false, verified: false, factor: null }
}

function mfaStateFromStatus(status) {
  return {
    loading: false,
    needsMfa: status.needsMfa,
    verified: status.currentLevel === 'aal2' && status.nextLevel === 'aal2',
    factor: status.primaryFactor,
  }
}

async function fetchOwnAccount(userId) {
  const withCover = await supabase
    .from('accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

  if (!withCover.error) return withCover.data || null

  const withoutCover = await supabase
    .from('accounts')
    .select(ACCOUNT_COLUMNS_BASE)
    .eq('id', userId)
    .maybeSingle()

  if (withoutCover.error) return null
  return withoutCover.data ? { ...withoutCover.data, cover_url: '' } : null
}

async function ensureOwnAccount() {
  const { data, error } = await supabase.rpc('ensure_own_account')
  if (error) return null
  return data || null
}

export function getAccountDisplayName(account, session, fallback = 'профил') {
  const email = account?.email || session?.user?.email || ''
  if (account) {
    return account.full_name || account.display_name || email.split('@')[0] || fallback
  }
  return email.split('@')[0] || fallback
}

export function getAccountInitial(account, session) {
  return (getAccountDisplayName(account, session, '?')[0] || '?').toUpperCase()
}

export function getAccountAvatar(account) {
  return account?.avatar_url || ''
}

export async function signOutAndRedirect(userId = '') {
  if (userId) {
    const { clearPendingMfaEnrollment } = await import('./mfa.js')
    clearPendingMfaEnrollment(userId)
  }
  await supabase.auth.signOut()
  
  // Safely redirect: check for browser environment
  if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
    window.location.assign('/')
  }
}

export async function deleteOwnAccount(emailConfirmation = '') {
  const { data, error } = await supabase.functions.invoke('account-action', {
    body: {
      action: 'delete_own_account',
      payload: { emailConfirmation },
    },
  })

  if (error) {
    throw new Error(
      error.message === 'Failed to send a request to the Edge Function'
        ? 'Не успяхме да достигнем защитната функция за изтриване. Опитай отново след малко.'
        : error.message || 'Заявката за изтриване не можа да бъде изпратена.'
    )
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export function useAccount() {
  const [session, setSession] = useState(null)
  const [account, setAccount] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [accountLoading, setAccountLoading] = useState(true)
  const [mfa, setMfa] = useState({ loading: true, needsMfa: false, verified: false, factor: null })
  const sessionRef = useRef({ signInAt: '', userId: '' })
  const abortControllerRef = useRef(new AbortController())

  useEffect(() => {
    let active = true
    const ac = new AbortController()
    abortControllerRef.current = ac

    async function loadAccountAndMfa(currentSession) {
      if (!currentSession?.user) {
        if (active) {
          setAccount(null)
          setAccountLoading(false)
          setMfa(emptyMfaState())
        }
        return
      }

      let mfaStatus = null
      try {
        mfaStatus = await loadMfaStatus()
      } catch {
        mfaStatus = null
      }

      if (!active || ac.signal.aborted) return

      const nextMfaState = mfaStatus ? mfaStateFromStatus(mfaStatus) : emptyMfaState()
      setMfa(nextMfaState)

      if (nextMfaState.needsMfa) {
        setAccount(null)
        setAccountLoading(false)
        return
      }

      let nextAccount = await fetchOwnAccount(currentSession.user.id)
      if (!nextAccount) {
        nextAccount = await ensureOwnAccount()
      }
      if (!active || ac.signal.aborted) return
      setAccount(nextAccount)
      setAccountLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active || ac.signal.aborted) return
      sessionRef.current = {
        signInAt: data.session?.user?.last_sign_in_at || '',
        userId: data.session?.user?.id || '',
      }
      setSession(data.session)
      setAuthLoading(false)
      loadAccountAndMfa(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active || ac.signal.aborted) return
      const previous = sessionRef.current
      const next = {
        signInAt: nextSession?.user?.last_sign_in_at || '',
        userId: nextSession?.user?.id || '',
      }
      const sessionChanged = previous.signInAt !== next.signInAt || previous.userId !== next.userId

      sessionRef.current = next
      setSession(nextSession)
      setAuthLoading(false)

      if (!sessionChanged) {
        return
      }

      setAccount(null)
      setAccountLoading(Boolean(nextSession?.user))
      setMfa((current) => ({ ...current, loading: Boolean(nextSession?.user) }))
      loadAccountAndMfa(nextSession)
    })

    return () => {
      active = false
      ac.abort()
      sub.subscription.unsubscribe()
    }
  }, [])

  async function refresh() {
    const { data } = await supabase.auth.getSession()
    sessionRef.current = {
      signInAt: data.session?.user?.last_sign_in_at || '',
      userId: data.session?.user?.id || '',
    }
    setSession(data.session)

    if (!data.session?.user) {
      setAccount(null)
      setAccountLoading(false)
      setMfa(emptyMfaState())
      return
    }

    setAccountLoading(true)

    let mfaStatus = null
    try {
      mfaStatus = await loadMfaStatus()
    } catch {
      mfaStatus = null
    }

    const nextMfaState = mfaStatus ? mfaStateFromStatus(mfaStatus) : emptyMfaState()
    setMfa(nextMfaState)

    if (nextMfaState.needsMfa) {
      setAccount(null)
      setAccountLoading(false)
      return
    }

    let nextAccount = await fetchOwnAccount(data.session.user.id)
    if (!nextAccount) {
      nextAccount = await ensureOwnAccount()
    }
    setAccount(nextAccount)
    setAccountLoading(false)
  }

  async function refreshMfa() {
    const mfaStatus = await loadMfaStatus()
    setMfa(mfaStateFromStatus(mfaStatus))
  }

  return {
    session,
    account,
    loading: authLoading || accountLoading || mfa.loading,
    authLoading,
    accountLoading,
    mfaLoading: mfa.loading,
    mfaRequired: mfa.needsMfa,
    mfaVerified: mfa.verified,
    mfaFactor: mfa.factor,
    isAuthenticated: Boolean(session),
    isAdmin: account?.role === 'admin',
    isSpecialist: account?.role === 'specialist',
    specialistStatus: account?.specialist_status || null,
    refresh,
    refreshMfa,
  }
}
