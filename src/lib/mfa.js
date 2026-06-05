import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

const pendingEnrollments = new Map()

export function mfaEnrollmentStorageKey(userId) {
  return `totsan.mfa.enrollment.${userId || 'anonymous'}`
}

export function savePendingMfaEnrollment(userId, enrollment) {
  if (!userId || !enrollment?.id) return

  const payload = {
    id: enrollment.id,
    friendly_name: enrollment.friendly_name || '',
    totp: {
      qr_code: enrollment?.totp?.qr_code || '',
      secret: enrollment?.totp?.secret || '',
      uri: enrollment?.totp?.uri || '',
    },
  }

  pendingEnrollments.set(mfaEnrollmentStorageKey(userId), payload)
}

export function loadPendingMfaEnrollment(userId) {
  if (!userId) return null
  return pendingEnrollments.get(mfaEnrollmentStorageKey(userId)) || null
}

export function clearPendingMfaEnrollment(userId) {
  if (!userId) return
  pendingEnrollments.delete(mfaEnrollmentStorageKey(userId))
}

export function normalizeMfaError(error, fallback = 'Не успяхме да завършим проверката. Опитай отново.') {
  const raw = String(error?.message || error?.name || '').trim()
  const lower = raw.toLowerCase()

  if (!raw) return fallback
  if (lower.includes('mfa_totp') && lower.includes('not_enabled')) {
    return '2FA с Authenticator приложение не е включена в настройките на Supabase проекта.'
  }
  if (lower.includes('invalid') || lower.includes('incorrect') || lower.includes('code') || lower.includes('otp')) {
    return 'Кодът не е правилен. Провери приложението и опитай отново.'
  }
  if (lower.includes('expired') || lower.includes('challenge')) {
    return 'Сесията за проверка изтече. Стартирай отново.'
  }
  if (lower.includes('aal2') || lower.includes('assurance')) {
    return 'За това действие трябва първо да потвърдиш 2FA кода си.'
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Връзката прекъсна. Опитай отново след малко.'
  }

  return fallback
}

export function normalizeTotpCode(value = '') {
  return String(value).replace(/\D/g, '').slice(0, 6)
}

export function getVerifiedTotpFactors(factorsData) {
  if (Array.isArray(factorsData?.totp)) return factorsData.totp
  if (Array.isArray(factorsData?.all)) {
    return factorsData.all.filter((factor) => factor.factor_type === 'totp' && factor.status === 'verified')
  }
  return []
}

export async function loadMfaStatus() {
  const [aalResult, factorsResult] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ])

  if (aalResult.error) throw aalResult.error
  if (factorsResult.error) throw factorsResult.error

  const verifiedTotp = getVerifiedTotpFactors(factorsResult.data)
  const currentLevel = aalResult.data?.currentLevel || null
  const nextLevel = aalResult.data?.nextLevel || null

  return {
    currentLevel,
    nextLevel,
    needsMfa: nextLevel === 'aal2' && currentLevel !== 'aal2' && verifiedTotp.length > 0,
    verifiedTotp,
    primaryFactor: verifiedTotp[0] || null,
  }
}

export function useMfaGate(session) {
  const [version, setVersion] = useState(0)
  const [state, setState] = useState({
    loading: Boolean(session),
    error: '',
    currentLevel: null,
    nextLevel: null,
    needsMfa: false,
    factor: null,
  })

  useEffect(() => {
    if (!session?.user) {
      setState({
        loading: false,
        error: '',
        currentLevel: null,
        nextLevel: null,
        needsMfa: false,
        factor: null,
      })
      return undefined
    }

    let active = true
    setState((current) => ({ ...current, loading: true, error: '' }))

    loadMfaStatus()
      .then((status) => {
        if (!active) return
        setState({
          loading: false,
          error: '',
          currentLevel: status.currentLevel,
          nextLevel: status.nextLevel,
          needsMfa: status.needsMfa,
          factor: status.primaryFactor,
        })
      })
      .catch((error) => {
        if (!active) return
        setState({
          loading: false,
          error: normalizeMfaError(error, 'Не успяхме да проверим 2FA статуса.'),
          currentLevel: null,
          nextLevel: null,
          needsMfa: false,
          factor: null,
        })
      })

    return () => {
      active = false
    }
  }, [session?.access_token, session?.user?.id, version])

  return {
    ...state,
    refresh: () => setVersion((current) => current + 1),
  }
}
