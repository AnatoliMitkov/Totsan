import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { clearPasskeyVerifiedSession, getPasskeySecurityState } from './passkeys.js'

function metadataName(user) {
  const metadata = user?.user_metadata || {}
  return metadata.full_name || metadata.name || metadata.display_name || metadata.user_name || ''
}

export function getAccountDisplayName(account, session, fallback = 'профил') {
  const email = account?.email || session?.user?.email || ''
  return account?.full_name || account?.display_name || metadataName(session?.user) || email.split('@')[0] || fallback
}

export function getAccountInitial(account, session) {
  return (getAccountDisplayName(account, session, '?')[0] || '?').toUpperCase()
}

export function getAccountAvatar(account, session) {
  return account?.avatar_url || session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture || ''
}

// Единен hook: следи Supabase сесията + чете акаунта (роля + статус) от accounts таблицата.
export function useAccount() {
  const [session, setSession] = useState(null)
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const sessionRef = useRef({ signInAt: '', userId: '' })

  useEffect(() => {
    let active = true

    async function loadAccount(currentSession) {
      if (!currentSession?.user) {
        if (active) { setAccount(null); setLoading(false) }
        return
      }
      const { data, error } = await supabase
        .from('accounts')
        .select('id, email, full_name, display_name, role, specialist_status, account_status, phone, avatar_url, city, country, bio, locale, marketing_opt_in, stripe_account_id, created_at')
        .eq('id', currentSession.user.id)
        .maybeSingle()
      if (!active) return
      if (error) {
        // RLS отказан или таблицата още не е създадена — просто оставяме null.
        setAccount(null)
      } else {
        setAccount(data || null)
      }
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      sessionRef.current = {
        signInAt: data.session?.user?.last_sign_in_at || '',
        userId: data.session?.user?.id || '',
      }
      setSession(data.session)
      loadAccount(data.session)
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
      setLoading(true)
      loadAccount(nextSession)
    })

    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  return {
    session,
    account,
    loading,
    isAuthenticated: Boolean(session),
    isAdmin: account?.role === 'admin',
    isSpecialist: account?.role === 'specialist',
    specialistStatus: account?.specialist_status || null,
    requirePasskeyVerification: getPasskeySecurityState(session?.user).requirePasskeyVerification,
    refresh: async () => {
      const { data } = await supabase.auth.getSession()
      sessionRef.current = {
        signInAt: data.session?.user?.last_sign_in_at || '',
        userId: data.session?.user?.id || '',
      }
      setSession(data.session)
      if (data.session?.user) {
        const { data: row } = await supabase
          .from('accounts')
          .select('id, email, full_name, display_name, role, specialist_status, account_status, phone, avatar_url, city, country, bio, locale, marketing_opt_in, stripe_account_id, created_at')
          .eq('id', data.session.user.id)
          .maybeSingle()
        setAccount(row || null)
      } else {
        setAccount(null)
      }
    },
  }
}
