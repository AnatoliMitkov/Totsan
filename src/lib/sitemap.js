import { createClient } from '@supabase/supabase-js'
import { LAYERS } from '../data/layers.js'
import { getStaticProductCatalog } from './product-metadata.js'
import { STATIC_PUBLIC_PATHS, isSitemapEligiblePath, toAbsoluteUrl } from './site-routes.js'

const PROFILE_SITEMAP_COLUMNS = 'slug,updated_at,is_published'
const SERVICE_SITEMAP_COLUMNS = 'slug,updated_at,is_published,moderation_status'

export function getStaticSitemapEntries() {
  const staticPaths = [
    ...STATIC_PUBLIC_PATHS,
    ...LAYERS.map((layer) => `/sloy/${layer.slug}`),
    ...getStaticProductCatalog().map((product) => `/produkt/${product.slug}`),
  ]

  return dedupeEntries(staticPaths.map((path) => ({ path })))
}

export function createServerSitemapClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.VITE_SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY
    || ''

  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function getDynamicSitemapEntries(client = createServerSitemapClient()) {
  if (!client) {
    return {
      entries: [],
      warnings: ['Dynamic sitemap is using static URLs only because Supabase public environment variables are not available.'],
    }
  }

  const warnings = []
  const entries = []

  const [profilesResult, servicesResult] = await Promise.all([
    client
      .from('profiles')
      .select(PROFILE_SITEMAP_COLUMNS)
      .eq('is_published', true)
      .order('updated_at', { ascending: false }),
    client
      .from('partner_services')
      .select(SERVICE_SITEMAP_COLUMNS)
      .eq('is_published', true)
      .eq('moderation_status', 'approved')
      .order('updated_at', { ascending: false }),
  ])

  if (profilesResult.error) {
    warnings.push(`Profiles sitemap fetch failed: ${profilesResult.error.message}`)
  } else {
    ;(profilesResult.data || []).forEach((profile) => {
      if (!profile.slug) return
      entries.push({
        path: `/profil/${profile.slug}`,
        lastmod: normalizeLastmod(profile.updated_at),
      })
    })
  }

  if (servicesResult.error) {
    warnings.push(`Services sitemap fetch failed: ${servicesResult.error.message}`)
  } else {
    ;(servicesResult.data || []).forEach((service) => {
      if (!service.slug) return
      entries.push({
        path: `/uslugi/${service.slug}`,
        lastmod: normalizeLastmod(service.updated_at),
      })
    })
  }

  return {
    entries: dedupeEntries(entries),
    warnings,
  }
}

export async function buildSitemapPayload() {
  const staticEntries = getStaticSitemapEntries()
  const dynamic = await getDynamicSitemapEntries()
  const entries = dedupeEntries([...staticEntries, ...dynamic.entries])
  const validation = validateSitemapEntries(entries)

  return {
    entries,
    warnings: [...dynamic.warnings, ...validation.warnings],
    errors: validation.errors,
  }
}

export function validateSitemapEntries(entries = []) {
  const errors = []
  const warnings = []
  const seenPaths = new Set()

  if (!entries.length) {
    errors.push('Sitemap is empty.')
  }

  entries.forEach((entry) => {
    const path = String(entry.path || '').trim()
    if (!path) {
      errors.push('Sitemap contains an empty path.')
      return
    }

    if (seenPaths.has(path)) {
      errors.push(`Duplicate sitemap path: ${path}`)
    }
    seenPaths.add(path)

    if (!isSitemapEligiblePath(path)) {
      errors.push(`Private or non-canonical path leaked into sitemap: ${path}`)
    }

    if (path.includes('?') || path.includes('#')) {
      errors.push(`Query string or hash leaked into sitemap path: ${path}`)
    }

    try {
      const url = new URL(toAbsoluteUrl(path))
      if (url.origin !== 'https://totsan.com') {
        errors.push(`Non-canonical hostname in sitemap: ${url.href}`)
      }
    } catch {
      errors.push(`Malformed sitemap path: ${path}`)
    }
  })

  if (!entries.some((entry) => entry.path === '/')) {
    warnings.push('Homepage is missing from sitemap entries.')
  }

  return { errors, warnings }
}

export function buildSitemapXml(entries = []) {
  const body = entries.map((entry) => {
    const lines = [`  <url>`, `    <loc>${escapeXml(toAbsoluteUrl(entry.path))}</loc>`]
    if (entry.lastmod) {
      lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`)
    }
    lines.push('  </url>')
    return lines.join('\n')
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

function dedupeEntries(entries = []) {
  const map = new Map()

  entries.forEach((entry) => {
    const path = String(entry.path || '').trim()
    if (!path) return
    const existing = map.get(path)
    if (!existing || (entry.lastmod && entry.lastmod > existing.lastmod)) {
      map.set(path, { path, lastmod: entry.lastmod || existing?.lastmod || '' })
    }
  })

  return Array.from(map.values()).sort((left, right) => left.path.localeCompare(right.path, 'en'))
}

function normalizeLastmod(value) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString()
}

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}