const NOT_ALLOWED_PATTERNS = [
  'notallowederror',
  'timed out',
  'not allowed',
  'operation either timed out',
  'the user attempted to use an authenticator',
]

export function browserSupportsPasskeys() {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined'
}

export function requiresSecurePasskeyContext() {
  if (typeof window === 'undefined') return false
  return !window.isSecureContext
}

export async function getPasskeyCapability() {
  const base = {
    checked: true,
    canUse: false,
    hasPlatformAuthenticator: false,
    supportsConditionalUi: false,
    reason: '',
  }

  if (typeof window === 'undefined') {
    return { ...base, reason: 'server' }
  }

  if (!browserSupportsPasskeys()) {
    return { ...base, reason: 'unsupported' }
  }

  if (requiresSecurePasskeyContext()) {
    return { ...base, reason: 'insecure' }
  }

  const PublicKey = window.PublicKeyCredential
  const [hasPlatformAuthenticator, supportsConditionalUi] = await Promise.all([
    typeof PublicKey.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
      ? PublicKey.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false)
      : Promise.resolve(false),
    typeof PublicKey.isConditionalMediationAvailable === 'function'
      ? PublicKey.isConditionalMediationAvailable().catch(() => false)
      : Promise.resolve(false),
  ])

  return {
    ...base,
    canUse: true,
    hasPlatformAuthenticator: Boolean(hasPlatformAuthenticator),
    supportsConditionalUi: Boolean(supportsConditionalUi),
    reason: '',
  }
}

export function getPasskeyEnvironmentWarning() {
  if (!browserSupportsPasskeys()) {
    return 'Този браузър не предлага биометричен вход за сайта.'
  }

  if (requiresSecurePasskeyContext()) {
    return 'Бързият вход работи само през https:// или localhost.'
  }

  return ''
}

export function normalizePasskeyError(error, fallback = 'Не успяхме да завършим биометричния вход.') {
  const raw = String(error?.message || error?.name || '').trim()
  const lower = raw.toLowerCase()

  if (!raw) return fallback
  if (lower.includes('passkey') && lower.includes('disabled')) {
    return 'Бързият вход още не е включен в настройките на проекта.'
  }
  if (lower.includes('authsessionmissingerror') || lower.includes('session')) {
    return 'Влез в профила си, за да управляваш бързия вход.'
  }
  if (NOT_ALLOWED_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return 'Не се получи или беше отказано. Можеш да влезеш с имейл и да го настроиш от профила си.'
  }
  if (lower.includes('network')) {
    return 'Връзката прекъсна. Опитай пак след малко.'
  }

  return fallback
}

export function normalizePasskeyVerificationError(error) {
  const raw = String(error?.message || error?.name || '').trim()
  const lower = raw.toLowerCase()

  if (
    lower.includes('no credential') ||
    lower.includes('no passkey') ||
    lower.includes('credential not found') ||
    lower.includes('unknown credential') ||
    lower.includes('not registered')
  ) {
    return 'На това устройство няма passkey за този профил. Влез с Google/имейл и добави нов passkey от Сигурност.'
  }

  return 'Не успяхме да потвърдим биометрията. Опитай отново.'
}

export function formatPasskeyDate(value) {
  if (!value) return 'Още не е използван'

  try {
    return new Date(value).toLocaleString('bg-BG')
  } catch {
    return value
  }
}

export function passkeyDismissKey(userId) {
  return `totsan.passkeyPrompt.dismissed.${userId || 'anonymous'}`
}

export function getPasskeySecurityState(user) {
  const metadata = user?.user_metadata || {}

  return {
    requirePasskeyVerification: Boolean(metadata.require_passkey_verification),
  }
}

export function passkeyVerifiedSessionKey(userId) {
  return `totsan.passkeyVerifiedSession.${userId || 'anonymous'}`
}

export function isPasskeyVerifiedSession(userId) {
  if (typeof window === 'undefined' || !userId) return false
  return window.sessionStorage.getItem(passkeyVerifiedSessionKey(userId)) === 'true'
}

export function markPasskeyVerifiedSession(userId) {
  if (typeof window === 'undefined' || !userId) return
  window.sessionStorage.setItem(passkeyVerifiedSessionKey(userId), 'true')
}

export function clearPasskeyVerifiedSession(userId) {
  if (typeof window === 'undefined' || !userId) return
  window.sessionStorage.removeItem(passkeyVerifiedSessionKey(userId))
}
