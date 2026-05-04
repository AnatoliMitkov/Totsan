import { uploadPortfolioMedia } from './profile-media-upload-client.js'
import { supabase } from './supabase.js'

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
    city: row.city || '',
    budgetBand: row.budgetBand || row.budget_band || '',
    orderIndex: row.orderIndex ?? row.order_index ?? 0,
    isPublished: row.isPublished ?? row.is_published ?? true,
    createdAt: row.createdAt || row.created_at || '',
    updatedAt: row.updatedAt || row.updated_at || '',
  }
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
    city: cleanText(item.city),
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
  const payload = toDbPayload(item, profileId)
  const query = item.id
    ? supabase.from('profile_portfolio').update(payload).eq('id', item.id).eq('profile_id', profileId)
    : supabase.from('profile_portfolio').insert(payload)

  const { data, error } = await query.select(PORTFOLIO_SELECT_COLUMNS).single()
  if (error) throw error
  return normalizePortfolioItem(data)
}

export async function deletePortfolioItem(itemId) {
  const { error } = await supabase
    .from('profile_portfolio')
    .delete()
    .eq('id', itemId)

  if (error) throw error
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
