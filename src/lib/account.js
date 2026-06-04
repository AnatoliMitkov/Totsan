import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { clearPasskeyVerifiedSession, getPasskeySecurityState } from './passkeys.js'
import { loadMfaStatus } from './mfa.js'

const ACCOUNT_COLUMNS = 'id, email, full_name, display_name, role, specialist_status, account_status, phone, avatar_url, city, country, bio, locale, marketing_opt_in, stripe_account_id, created_at'

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
  const { data, error } = await supabase
    .from('accounts')
    .select(ACCOUNT_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

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
    clearPasskeyVerifiedSession(userId)
    const { clearPendingMfaEnrollment } = await import('./mfa.js')
    clearPendingMfaEnrollment(userId)
  }
  await supabase.auth.signOut()
  if (typeof window !== 'undefined') {
    window.location.assign('/')
  }
}

export function useAccount() {
  const [session, setSession] = useState(null)
  const [account, setAccount] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [accountLoading, setAccountLoading] = useState(true)
  const [mfa, setMfa] = useState({ loading: true, needsMfa: false, verified: false, factor: null })
  const sessionRef = useRef({ signInAt: '', userId: '' })

  useEffect(() => {
    let active = true

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

      if (!active) return

      const nextMfaState = mfaStatus ? mfaStateFromStatus(mfaStatus) : emptyMfaState()
      setMfa(nextMfaState)

      if (nextMfaState.needsMfa) {
        setAccount(null)
        setAccountLoading(false)
        return
      }

      const nextAccount = await fetchOwnAccount(currentSession.user.id)
      if (!active) return
      setAccount(nextAccount)
      setAccountLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      sessionRef.current = {
        signInAt: data.session?.user?.last_sign_in_at || '',
        userId: data.session?.user?.id || '',
      }
      setSession(data.session)
      setAuthLoading(false)
      loadAccountAndMfa(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      const previous = sessionRef.current
      const next = {
        signInAt: nextSession?.user?.last_sign_in_at || '',
        userId: nextSession?.user?.id || '',
      }
      const sessionChanged = previous.signInAt !== next.signInAt || previous.userId !== next.userId

      if (sessionChanged) {
        if (previous.userId) clearPasskeyVerifiedSession(previous.userId)
        if (next.userId) clearPasskeyVerifiedSession(next.userId)
      }

      sessionRef.current = next
      setSession(nextSession)
      setAuthLoading(false)
      setAccount(null)
      setAccountLoading(Boolean(nextSession?.user))
      setMfa((current) => ({ ...current, loading: Boolean(nextSession?.user) }))
      loadAccountAndMfa(nextSession)
    })

    return () => {
      active = false
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

    const nextAccount = await fetchOwnAccount(data.session.user.id)
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
    requirePasskeyVerification: getPasskeySecurityState(session?.user).requirePasskeyVerification,
    refresh,
    refreshMfa,
  }
}
