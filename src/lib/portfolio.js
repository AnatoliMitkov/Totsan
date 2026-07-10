import { uploadPortfolioMedia } from './profile-media-upload-client.js'
import { supabase } from './supabase.js'
import { normalizeLocationValue } from './locations.js'
import { deleteStorageRefs, diffStorageRefs, mediaAndCoverStorageRefs } from './storage-media-cleanup.js'
import { normalizeProfile } from './profiles.js'

export const PORTFOLIO_SELECT_COLUMNS = `
  id,
  profile_id,
  title,
  description,
  cover_url,
  media,
  layer_slug,
  year,
  city,
  budget_band,
  order_index,
  is_published,
  created_at,
  updated_at
`

export const PORTFOLIO_PROFILE_PUBLIC_COLUMNS = `
  id,
  slug,
  layer_slug,
  name,
  tag,
  city,
  rating,
  projects,
  bio,
  image_url,
  image_zoom,
  image_x,
  image_y,
  is_published,
  user_id,
  headline,
  description_long,
  service_areas,
  response_time_hours,
  pricing_note
`

export const DEFAULT_PORTFOLIO_ITEM = {
  id: '',
  profileId: '',
  title: '',
  description: '',
  coverUrl: '',
  media: [],
  layerSlug: '',
  year: '',
  city: '',
  budgetBand: '',
  orderIndex: 0,
  isPublished: true,
}

function cleanText(value) {
  const next = String(value ?? '').trim()
  return next || null
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

export function normalizePortfolioItem(row) {
  if (!row) return null
  return {
    id: row.id || '',
    profileId: row.profileId || row.profile_id || '',
    title: row.title || '',
    description: row.description || '',
    coverUrl: row.coverUrl || row.cover_url || '',
    media: Array.isArray(row.media) ? row.media : [],
    layerSlug: row.layerSlug || row.layer_slug || '',
    year: row.year ?? '',
    city: normalizeLocationValue(row.city),
    budgetBand: row.budgetBand || row.budget_band || '',
    orderIndex: row.orderIndex ?? row.order_index ?? 0,
    isPublished: row.isPublished ?? row.is_published ?? true,
    createdAt: row.createdAt || row.created_at || '',
    updatedAt: row.updatedAt || row.updated_at || '',
    profile: row.profile || null,
  }
}

export function portfolioProjectPath(profileSlug = '', projectId = '') {
  const slug = String(profileSlug || '').trim()
  const id = String(projectId || '').trim()
  if (!slug || !id) return '/portfolio'
  return `/portfolio/${encodeURIComponent(slug)}/${encodeURIComponent(id)}`
}

function toDbPayload(item, profileId) {
  return {
    profile_id: profileId,
    title: cleanText(item.title) || 'Проект без заглавие',
    description: cleanText(item.description),
    cover_url: cleanText(item.coverUrl),
    media: Array.isArray(item.media) ? item.media : [],
    layer_slug: cleanText(item.layerSlug),
    year: numberOrNull(item.year),
    city: cleanText(normalizeLocationValue(item.city)),
    budget_band: cleanText(item.budgetBand),
    order_index: numberOrNull(item.orderIndex) ?? 0,
    is_published: item.isPublished !== false,
  }
}

export async function loadProfilePortfolio(profileId, { includeUnpublished = false } = {}) {
  if (!profileId) return []

  let query = supabase
    .from('profile_portfolio')
    .select(PORTFOLIO_SELECT_COLUMNS)
    .eq('profile_id', profileId)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: false })

  if (!includeUnpublished) {
    query = query.eq('is_published', true)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []).map(normalizePortfolioItem)
}

export async function savePortfolioItem(profileId, item) {
  let previous = null
  if (item.id) {
    const { data: previousRow, error: previousError } = await supabase
      .from('profile_portfolio')
      .select('cover_url, media')
      .eq('id', item.id)
      .eq('profile_id', profileId)
      .maybeSingle()
    if (previousError) throw previousError
    previous = previousRow ? normalizePortfolioItem(previousRow) : null
  }

  const payload = toDbPayload(item, profileId)
  const query = item.id
    ? supabase.from('profile_portfolio').update(payload).eq('id', item.id).eq('profile_id', profileId)
    : supabase.from('profile_portfolio').insert(payload)

  const { data, error } = await query.select(PORTFOLIO_SELECT_COLUMNS).single()
  if (error) throw error
  const saved = normalizePortfolioItem(data)

  if (previous) {
    await deleteStorageRefs(diffStorageRefs(
      mediaAndCoverStorageRefs(previous),
      mediaAndCoverStorageRefs(saved),
    ))
  }

  return saved
}

export async function deletePortfolioItem(itemId) {
  const { data: previousRow, error: loadError } = await supabase
    .from('profile_portfolio')
    .select('cover_url, media')
    .eq('id', itemId)
    .maybeSingle()
  if (loadError) throw loadError

  const { error } = await supabase
    .from('profile_portfolio')
    .delete()
    .eq('id', itemId)

  if (error) throw error
  await deleteStorageRefs(mediaAndCoverStorageRefs(previousRow ? normalizePortfolioItem(previousRow) : null))
}

export async function loadProfileStats(profileId) {
  if (!profileId) return null
  const { data, error } = await supabase
    .from('vw_profile_stats')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') throw error
  return data || null
}

export async function loadPublicPortfolioCounts() {
  const { data, error } = await supabase
    .from('profile_portfolio')
    .select('profile_id')
    .eq('is_published', true)

  if (error) throw error

  return (data || []).reduce((acc, row) => {
    const profileId = row.profile_id
    if (!profileId) return acc
    acc[profileId] = (acc[profileId] || 0) + 1
    return acc
  }, {})
}

export async function loadPublicPortfolioItem(projectId) {
  if (!projectId) return null
  const { data, error } = await supabase
    .from('profile_portfolio')
    .select(`${PORTFOLIO_SELECT_COLUMNS}, profile:profiles(${PORTFOLIO_PROFILE_PUBLIC_COLUMNS})`)
    .eq('id', projectId)
    .eq('is_published', true)
    .maybeSingle()

  if (error) throw error
  return data ? normalizePortfolioItem(data) : null
}

export async function uploadPortfolioImage({ file, target, kind = 'photo' }) {
  const result = await uploadPortfolioMedia({ file, target, kind })
  return {
    url: result.publicUrl,
    path: result.path,
    bucket: result.bucket || 'portfolio-media',
    fingerprint: result.fingerprint,
    reused: Boolean(result.reused),
  }
}

export function appendPortfolioMedia(item, upload, caption = '') {
  const media = Array.isArray(item.media) ? item.media : []
  return {
    ...item,
    coverUrl: item.coverUrl || upload.url,
    media: [
      ...media,
      {
        url: upload.url,
        path: upload.path,
        caption,
      },
    ],
  }
}

export async function loadPublicPortfolioByLayer(layerSlug) {
  if (!layerSlug) return []
  const { data, error } = await supabase
    .from('profile_portfolio')
    .select(`${PORTFOLIO_SELECT_COLUMNS}, profile:profiles(${PORTFOLIO_PROFILE_PUBLIC_COLUMNS})`)
    .eq('is_published', true)
    .eq('layer_slug', layerSlug)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || [])
    .map(row => {
      const item = normalizePortfolioItem(row)
      if (item && row.profile) {
        item.profile = normalizeProfile(row.profile)
      }
      return item
    })
    .filter(item => item && item.profile && item.profile.isPublished)
}

export function getPortfolioMeta(item = {}) {
  return [item.city, item.year].filter(Boolean).join(' · ')
}

export function isVideoMedia(item = {}) {
  return item.type === 'video' || item.provider === 'youtube' || item.kind === 'video'
}

export function getYoutubeVideoId(url = '') {
  const value = String(url || '').trim()
  if (!value) return ''

  try {
    const parsed = new URL(value)
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.replace('/', '').split(/[?&]/)[0]
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2] || ''
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] || ''
      return parsed.searchParams.get('v') || ''
    }
  } catch {
    const match = value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&/\s]+)/)
    return match?.[1] || ''
  }

  return ''
}

export function getYoutubeThumbnail(url = '') {
  const id = getYoutubeVideoId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : ''
}

export function getMediaPreviewUrl(item = {}) {
  if (!item) return ''
  if (isVideoMedia(item)) return item.thumbnail || getYoutubeThumbnail(item.url) || ''
  return item.url || ''
}

export function getPortfolioMedia(item = {}) {
  const media = Array.isArray(item.media) ? item.media.filter(Boolean) : []
  if (media.length) return media
  return item.coverUrl ? [{ type: 'image', url: item.coverUrl }] : []
}

export function getProjectCover(item = {}) {
  const firstPreview = getPortfolioMedia(item).map(getMediaPreviewUrl).find(Boolean)
  return firstPreview || item.coverUrl || ''
}
