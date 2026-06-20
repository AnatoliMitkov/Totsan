export const CONSENT_VERSION = '1.0'
export const CONSENT_STORAGE_KEY = 'totsan.cookieConsent'

const DEFAULT_PREFERENCES = {
  version: CONSENT_VERSION,
  necessary: true,
  analytics: false,
  marketing: false,
  timestamp: '',
}

function isBrowser() {
  return typeof window !== 'undefined'
}

function ensureDataLayer() {
  if (!isBrowser()) return null

  window.dataLayer = window.dataLayer || []
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments)
  }

  return window.dataLayer
}

function normalizeConsent(value = {}) {
  return {
    version: typeof value.version === 'string' ? value.version : CONSENT_VERSION,
    necessary: true,
    analytics: value.analytics === true,
    marketing: value.marketing === true,
    timestamp: typeof value.timestamp === 'string' ? value.timestamp : '',
  }
}

export function initDefaultConsent() {
  ensureDataLayer()
  if (!isBrowser() || typeof window.gtag !== 'function') return

  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500,
  })
}

export function updateConsentFromPreferences(preferences = DEFAULT_PREFERENCES) {
  const consent = normalizeConsent(preferences)
  ensureDataLayer()
  if (!isBrowser() || typeof window.gtag !== 'function') return consent

  window.gtag('consent', 'update', {
    ad_storage: consent.marketing ? 'granted' : 'denied',
    analytics_storage: consent.analytics ? 'granted' : 'denied',
    ad_user_data: consent.marketing ? 'granted' : 'denied',
    ad_personalization: consent.marketing ? 'granted' : 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
  })

  window.dataLayer.push({
    event: 'cookie_consent_update',
    consent_analytics: consent.analytics,
    consent_marketing: consent.marketing,
  })

  window.__totsanAnalyticsConsent = { analytics: consent.analytics }
  return consent
}

export function getStoredConsent() {
  if (!isBrowser()) return null

  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    const consent = normalizeConsent(parsed)
    if (consent.version !== CONSENT_VERSION) return null

    return consent
  } catch {
    return null
  }
}

export function saveConsent(preferences = DEFAULT_PREFERENCES) {
  const consent = normalizeConsent({
    ...preferences,
    version: CONSENT_VERSION,
    timestamp: new Date().toISOString(),
  })

  if (isBrowser()) {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent))
  }

  updateConsentFromPreferences(consent)
  return consent
}

export function createConsentPreferences({ analytics = false, marketing = false } = {}) {
  return normalizeConsent({
    analytics,
    marketing,
    timestamp: new Date().toISOString(),
  })
}
