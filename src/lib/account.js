import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

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

// Единен hook: следи Supabase сесията + чете акаунта (роля + статус) от accounts таблицата.
export function useAccount() {
  const [session, setSession] = useState(null)
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)

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
      setSession(data.session)
      loadAccount(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
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
    refresh: async () => {
      const { data } = await supabase.auth.getSession()
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
