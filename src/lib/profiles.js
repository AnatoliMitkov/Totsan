import { useEffect, useMemo, useState } from 'react'
import { avatarFor } from '../data/images.js'
import { LAYERS as BASE_LAYERS } from '../data/layers.js'
import { supabase } from './supabase.js'

export const LEGACY_PROFILE_IMAGE_BUCKET = 'profile-images'
export const PROFILE_IMAGE_BUCKET = 'profile-images-optimized'
export const PROFILE_SELECT_COLUMNS = `
  id,
  created_at,
  updated_at,
  slug,
  layer_slug,
  name,
  tag,
  city,
  since,
  rating,
  projects,
  bio,
  image_url,
  image_zoom,
  image_x,
  image_y,
  is_published,
  user_id,
  role,
  headline,
  description_long,
  phone,
  email_public,
  website,
  instagram,
  facebook,
  languages,
  service_areas,
  years_experience,
  response_time_hours,
  accepts_remote,
  pricing_note
`

const LAYER_MAP = new Map(BASE_LAYERS.map((layer) => [layer.slug, layer]))
const DEFAULT_LAYER_SLUG = BASE_LAYERS[0]?.slug || ''

export function slugify(value = '') {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
}

function clamp(value, min, max, fallback) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, numeric))
}

function compareProfiles(left, right) {
  const leftLayer = Number(left.layerNumber || 99)
  const rightLayer = Number(right.layerNumber || 99)
  if (leftLayer !== rightLayer) return leftLayer - rightLayer
  return left.name.localeCompare(right.name, 'bg')
}

function buildFallbackBio(profile, layer) {
  if (!profile.name) return ''
  const role = (profile.tag || 'специалист').toLowerCase()
  const location = profile.city || 'България'
  const year = profile.since || new Date().getFullYear()
  const projects = profile.projects || 0
  if (!layer) {
    return `${profile.name} работи в ${location} от ${year} г. като ${role}. Има ${projects} реализирани проекта и поема нови запитвания през Totsan.`
  }

  return `${profile.name} работи в ${location} от ${year} г. като ${role}. Има ${projects} реализирани проекта в Слой ${layer.number} - ${layer.title.toLowerCase()} и отговаря директно през Totsan.`
}

function toTextArray(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.map(item => String(item || '').trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value.split(',').map(item => item.trim()).filter(Boolean)
  }
  return fallback
}

export function normalizeProfile(input = {}, fallback = null) {
  const base = fallback || {}
  const layerSlug = input.layerSlug || input.layer_slug || base.layerSlug || base.layer_slug || DEFAULT_LAYER_SLUG
  const layer = LAYER_MAP.get(layerSlug)
  const name = String(input.name ?? base.name ?? '').trim()
  const tag = String(input.tag ?? base.tag ?? '').trim()
  const city = String(input.city ?? base.city ?? '').trim()
  const slug = String(input.slug ?? base.slug ?? slugify(name)).trim() || slugify(name)
  const since = clamp(input.since ?? base.since, 1900, 2100, new Date().getFullYear())
  const rating = clamp(input.rating ?? base.rating, 0, 5, 5)
  const projects = clamp(input.projects ?? base.projects, 0, 100000, 0)
  const imageUrl = String(input.imageUrl ?? input.image_url ?? base.imageUrl ?? base.image_url ?? '').trim()
  const imageZoom = clamp(input.imageZoom ?? input.image_zoom ?? base.imageZoom ?? base.image_zoom, 1, 2.5, 1)
  const imageX = clamp(input.imageX ?? input.image_x ?? base.imageX ?? base.image_x, 0, 100, 50)
  const imageY = clamp(input.imageY ?? input.image_y ?? base.imageY ?? base.image_y, 0, 100, 50)
  const isPublished = input.isPublished ?? input.is_published ?? base.isPublished ?? base.is_published ?? true
  const bio = String(input.bio ?? base.bio ?? buildFallbackBio({ name, tag, city, since, projects }, layer)).trim()
  const headline = String(input.headline ?? base.headline ?? tag).trim()
  const descriptionLong = String(input.descriptionLong ?? input.description_long ?? base.descriptionLong ?? base.description_long ?? bio).trim()
  const phone = String(input.phone ?? base.phone ?? '').trim()
  const emailPublic = String(input.emailPublic ?? input.email_public ?? base.emailPublic ?? base.email_public ?? '').trim()
  const website = String(input.website ?? base.website ?? '').trim()
  const instagram = String(input.instagram ?? base.instagram ?? '').trim()
  const facebook = String(input.facebook ?? base.facebook ?? '').trim()
  const languages = toTextArray(input.languages ?? base.languages, ['bg'])
  const serviceAreas = toTextArray(input.serviceAreas ?? input.service_areas ?? base.serviceAreas ?? base.service_areas, city ? [city] : [])
  const yearsExperience = clamp(input.yearsExperience ?? input.years_experience ?? base.yearsExperience ?? base.years_experience, 0, 100, Math.max(0, new Date().getFullYear() - since))
  const responseTimeHours = input.responseTimeHours ?? input.response_time_hours ?? base.responseTimeHours ?? base.response_time_hours ?? null
  const acceptsRemote = input.acceptsRemote ?? input.accepts_remote ?? base.acceptsRemote ?? base.accepts_remote ?? false
  const pricingNote = String(input.pricingNote ?? input.pricing_note ?? base.pricingNote ?? base.pricing_note ?? '').trim()
  const userId = input.userId ?? input.user_id ?? base.userId ?? base.user_id ?? null
  const role = input.role ?? base.role ?? 'pro'

  return {
    id: input.id ?? base.id ?? (slug ? `static-${slug}` : ''),
    slug,
    kind: 'pro',
    layer: layerSlug,
    layerSlug,
    layerNumber: layer?.number ?? base.layerNumber ?? '',
    layerTitle: layer?.title ?? base.layerTitle ?? '',
    name,
    tag,
    sub: tag,
    city,
    since: Math.round(since),
    rating: Number(rating.toFixed(1)),
    projects: Math.round(projects),
    bio,
    headline,
    descriptionLong,
    phone,
    emailPublic,
    website,
    instagram,
    facebook,
    languages,
    serviceAreas,
    yearsExperience: Math.round(yearsExperience),
    responseTimeHours: responseTimeHours === null || responseTimeHours === undefined || responseTimeHours === '' ? null : Math.round(Number(responseTimeHours)),
    acceptsRemote: Boolean(acceptsRemote),
    pricingNote,
    imageUrl,
    imageZoom,
    imageX,
    imageY,
    isPublished: Boolean(isPublished),
    isStatic: !(input.id ?? base.id),
    userId,
    role,
    createdAt: input.createdAt ?? input.created_at ?? base.createdAt ?? base.created_at ?? null,
    updatedAt: input.updatedAt ?? input.updated_at ?? base.updatedAt ?? base.updated_at ?? null,
  }
}

// Статичните демо професионалисти са премахнати — всички профили идват от Supabase.
// Запазваме празен масив, за да не чупим импортите, които го ползват.
export const STATIC_PROFILES = []

export function buildProfileDirectory(rows = [], options = {}) {
  const { includeUnpublished = false } = options
  const merged = new Map(STATIC_PROFILES.map((profile) => [profile.slug, profile]))

  rows.forEach((row) => {
    const rowSlug = row.slug || slugify(row.name || '')
    if (!rowSlug) return
    merged.set(rowSlug, normalizeProfile({ ...row, slug: rowSlug }, merged.get(rowSlug)))
  })

  const list = Array.from(merged.values()).sort(compareProfiles)
  return includeUnpublished ? list : list.filter((profile) => profile.isPublished)
}

function toProfessionalCardPerson(profile) {
  return {
    slug: profile.slug,
    name: profile.name,
    tag: profile.tag,
    city: profile.city,
    rating: profile.rating,
    projects: profile.projects,
    since: profile.since,
    bio: profile.bio,
    imageUrl: profile.imageUrl,
    imageZoom: profile.imageZoom,
    imageX: profile.imageX,
    imageY: profile.imageY,
  }
}

export function buildLayersWithProfiles(profiles) {
  const byLayer = new Map()

  profiles.forEach((profile) => {
    const current = byLayer.get(profile.layerSlug) || []
    current.push(toProfessionalCardPerson(profile))
    byLayer.set(profile.layerSlug, current)
  })

  return BASE_LAYERS.map((layer) => ({
    ...layer,
    professionals: (byLayer.get(layer.slug) || []).sort((left, right) => left.name.localeCompare(right.name, 'bg')),
  }))
}

export function buildCatalogWithProfiles(profiles) {
  const items = []
  const byLayer = new Map()

  profiles.forEach((profile) => {
    const current = byLayer.get(profile.layerSlug) || []
    current.push(profile)
    byLayer.set(profile.layerSlug, current)
  })

  BASE_LAYERS.forEach((layer) => {
    ;(byLayer.get(layer.slug) || []).sort(compareProfiles).forEach((profile) => {
      items.push({
        kind: 'pro',
        slug: profile.slug,
        layer: layer.slug,
        layerNumber: layer.number,
        layerTitle: layer.title,
        name: profile.name,
        sub: profile.tag,
        tag: profile.tag,
        city: profile.city,
        rating: profile.rating,
        projects: profile.projects,
        since: profile.since,
        bio: profile.bio,
        headline: profile.headline,
        descriptionLong: profile.descriptionLong,
        phone: profile.phone,
        emailPublic: profile.emailPublic,
        website: profile.website,
        instagram: profile.instagram,
        facebook: profile.facebook,
        languages: profile.languages,
        serviceAreas: profile.serviceAreas,
        yearsExperience: profile.yearsExperience,
        responseTimeHours: profile.responseTimeHours,
        acceptsRemote: profile.acceptsRemote,
        pricingNote: profile.pricingNote,
        imageUrl: profile.imageUrl,
        imageZoom: profile.imageZoom,
        imageX: profile.imageX,
        imageY: profile.imageY,
      })
    })

    ;(layer.products || []).forEach((product) => {
      items.push({
        kind: 'product',
        layer: layer.slug,
        layerNumber: layer.number,
        layerTitle: layer.title,
        name: product.name,
        sub: product.cat,
        price: product.price,
        tag: product.tag,
      })
    })
  })

  return items
}

export function getProfileImage(profile) {
  return profile?.imageUrl || profile?.image_url || avatarFor(profile?.name || '')
}

export function getProfileImageStyle(profile) {
  const imageX = clamp(profile?.imageX ?? profile?.image_x, 0, 100, 50)
  const imageY = clamp(profile?.imageY ?? profile?.image_y, 0, 100, 50)
  const imageZoom = clamp(profile?.imageZoom ?? profile?.image_zoom, 1, 2.5, 1)

  return {
    objectPosition: `${imageX}% ${imageY}%`,
    transformOrigin: `${imageX}% ${imageY}%`,
    transform: `scale(${imageZoom})`,
  }
}

export async function fetchProfileRows() {
  try {
    const { data, error } = await supabase.from('profiles').select(PROFILE_SELECT_COLUMNS).order('name')
    return { data: data || [], error }
  } catch (error) {
    return { data: [], error }
  }
}

export function useProfileDirectory() {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadProfiles() {
      const result = await fetchProfileRows()
      if (!active) return

      if (result.error) {
        setRows([])
        setError(result.error.message || 'Профилите не можаха да се заредят.')
        setStatus('fallback')
        return
      }

      setRows(result.data)
      setError('')
      setStatus('ready')
    }

    loadProfiles()

    return () => {
      active = false
    }
  }, [])

  const profiles = useMemo(() => buildProfileDirectory(rows), [rows])
  const layers = useMemo(() => buildLayersWithProfiles(profiles), [profiles])
  const catalog = useMemo(() => buildCatalogWithProfiles(profiles), [profiles])

  return { rows, profiles, layers, catalog, status, error }
}