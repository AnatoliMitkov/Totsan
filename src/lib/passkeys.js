export function browserSupportsPasskeys() {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined'
}

export function requiresSecurePasskeyContext() {
  if (typeof window === 'undefined') return false
  return !window.isSecureContext
}

export function getPasskeyEnvironmentWarning() {
  if (!browserSupportsPasskeys()) {
    return 'Този браузър или устройство не поддържа passkeys.'
  }

  if (requiresSecurePasskeyContext()) {
    return 'Passkeys изискват защитена среда: `https://` или `localhost`.'
  }

  return ''
}

export function formatPasskeyDate(value) {
  if (!value) return 'Още не е използван'

  try {
    return new Date(value).toLocaleString('bg-BG')
  } catch {
    return value
  }
}
