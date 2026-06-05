export const CANONICAL_ORIGIN = 'https://totsan.com'

export const CANONICAL_REDIRECTS = {
  '/landing': '/',
  '/contact': '/kontakt',
  '/totsan-pro': '/pro',
}

export const STATIC_PUBLIC_PATHS = [
  '/',
  '/start',
  '/uslugi',
  '/katalog',
  '/pro',
  '/kak-raboti',
  '/za-nas',
  '/kontakt',
  '/vizualizacia',
  '/gradina-i-dvor',
  '/tapeti-i-cvetove',
  '/dekorativni-akcenti',
  '/terasi-i-vunshni-zoni',
  '/kuhni',
  '/spalnya-i-dnevna',
  '/banya',
  '/osvetlenie-i-tekstil',
]

export const PRIVATE_ROUTE_PREFIXES = [
  '/admin',
  '/moy-profil',
  '/porachki',
  '/inbox',
  '/checkout',
  '/order',
  '/proekt',
]

export const PRIVATE_EXACT_PATHS = new Set(['/login'])

export function normalizePathname(pathname = '/') {
  const raw = String(pathname || '/').trim() || '/'
  const withoutQuery = raw.split('?')[0].split('#')[0] || '/'
  const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')) {
    return withLeadingSlash.slice(0, -1)
  }
  return withLeadingSlash
}

export function toCanonicalPath(pathname = '/') {
  const normalized = normalizePathname(pathname)
  const legacyServiceMatch = normalized.match(/^\/usluga\/([^/]+)$/u)
  if (legacyServiceMatch) {
    return `/uslugi/${legacyServiceMatch[1]}`
  }
  return CANONICAL_REDIRECTS[normalized] || normalized
}

export function toAbsoluteUrl(pathname = '/') {
  const canonicalPath = toCanonicalPath(pathname)
  return `${CANONICAL_ORIGIN}${canonicalPath}`
}

export function isPrivatePath(pathname = '/') {
  const normalized = normalizePathname(pathname)
  if (PRIVATE_EXACT_PATHS.has(normalized)) return true
  return PRIVATE_ROUTE_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))
}

export function isDynamicPublicPath(pathname = '/') {
  const normalized = toCanonicalPath(pathname)
  return /^\/sloy\/[^/]+$/u.test(normalized)
    || /^\/profil\/[^/]+$/u.test(normalized)
    || /^\/uslugi\/[^/]+$/u.test(normalized)
    || /^\/produkt\/[^/]+$/u.test(normalized)
}

export function isNoindexPath(pathname = '/') {
  return isPrivatePath(pathname)
}

export function shouldAutoTrackPath(pathname = '/') {
  const canonicalPath = toCanonicalPath(pathname)
  if (isPrivatePath(canonicalPath)) return false
  if (/^\/(profil|uslugi|produkt)\/[^/]+$/u.test(canonicalPath)) return false
  return true
}

export function getAnalyticsPath(pathname = '/') {
  const canonicalPath = toCanonicalPath(pathname)

  if (/^\/inbox\/[^/]+$/u.test(canonicalPath)) return '/inbox/[conversation]'
  if (/^\/order\/[^/]+$/u.test(canonicalPath)) return '/order/[order]'
  if (/^\/checkout\/[^/]+\/[^/]+$/u.test(canonicalPath)) return '/checkout/[type]/[id]'
  if (/^\/proekt\/[^/]+$/u.test(canonicalPath)) return '/proekt/[share]'

  return canonicalPath
}

export function isSitemapEligiblePath(pathname = '/') {
  const canonicalPath = toCanonicalPath(pathname)
  if (isPrivatePath(canonicalPath)) return false
  if (canonicalPath === '/contact' || canonicalPath === '/landing' || canonicalPath === '/totsan-pro') return false
  return true
}