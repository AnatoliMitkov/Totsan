import { CANONICAL_ORIGIN, getAnalyticsPath, shouldAutoTrackPath, toAbsoluteUrl, toCanonicalPath } from './site-routes.js'

const GA_MEASUREMENT_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID || '').trim()
const REQUIRE_CONSENT = String(import.meta.env.VITE_GA_REQUIRE_CONSENT || 'true').trim().toLowerCase() !== 'false'
const CONSENT_STORAGE_KEY = 'totsan.analyticsConsent'

let initialized = false
let lastTrackedPageViewKey = ''

export function hasAnalyticsMeasurementId() {
  return Boolean(GA_MEASUREMENT_ID)
}

export function hasAnalyticsConsent() {
  if (!REQUIRE_CONSENT) return true
  if (typeof window === 'undefined') return false

  const runtimeConsent = window.__totsanAnalyticsConsent
  if (runtimeConsent && typeof runtimeConsent === 'object') {
    return runtimeConsent.analytics === true
  }

  try {
    return window.localStorage.getItem(CONSENT_STORAGE_KEY) === 'granted'
  } catch {
    return false
  }
}

export function initializeAnalytics() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  if (!hasAnalyticsMeasurementId() || !hasAnalyticsConsent()) return false
  if (initialized && typeof window.gtag === 'function') return true

  window.dataLayer = window.dataLayer || []
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments)
  }

  if (!document.querySelector(`script[data-totsan-ga="${GA_MEASUREMENT_ID}"]`)) {
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`
    script.setAttribute('data-totsan-ga', GA_MEASUREMENT_ID)
    document.head.appendChild(script)
  }

  window.gtag('js', new Date())
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false,
  })

  initialized = true
  return true
}

export function resetTrackedPageViews() {
  lastTrackedPageViewKey = ''
}

export function canAutoTrackPath(pathname = '/') {
  return shouldAutoTrackPath(pathname)
}

export function trackPageView({ pagePath = '/', pageTitle = document?.title || '', pageLocation } = {}) {
  if (!initializeAnalytics()) return false

  const canonicalPath = toCanonicalPath(pagePath)
  const resolvedLocation = pageLocation || toAbsoluteUrl(canonicalPath)
  const trackingKey = `${canonicalPath}|${pageTitle}|${resolvedLocation}`
  if (trackingKey === lastTrackedPageViewKey) return false

  window.gtag('event', 'page_view', {
    page_title: pageTitle,
    page_path: getAnalyticsPath(canonicalPath),
    page_location: resolvedLocation,
  })

  lastTrackedPageViewKey = trackingKey
  return true
}

export function trackEvent(name, parameters = {}) {
  if (!initializeAnalytics()) return false

  const payload = Object.fromEntries(
    Object.entries(parameters).filter(([, value]) => value !== undefined && value !== null && value !== '')
  )

  window.gtag('event', name, payload)
  return true
}

export function getPageLocation(pathname = '/') {
  return `${CANONICAL_ORIGIN}${toCanonicalPath(pathname)}`
}