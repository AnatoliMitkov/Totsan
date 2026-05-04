import { uploadServiceMedia } from './profile-media-upload-client.js'
import { slugify } from './profiles.js'
import { supabase } from './supabase.js'

export const SERVICE_STATUS_LABELS = {
  draft: 'Чернова',
  pending: 'Стара заявка',
  approved: 'Публикувана',
  rejected: 'Върната',
}

export const SERVICE_TIER_DEFINITIONS = [
  { tier: 'basic', label: 'Официална оферта', fallbackTitle: 'Официална оферта' },
]

export const PARTNER_SERVICE_COLUMNS = `
  id,
  created_at,
  updated_at,
  slug,
  profile_id,
  partner_id,
  layer_slug,
  title,
  subtitle,
  description_md,
  cover_url,
  media,
  tags,
  delivery_areas,
  is_published,
  moderation_status,
  moderation_note
`

const PROFILE_PUBLIC_COLUMNS = `
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

function cleanText(value) {
  const next = String(value ?? '').trim()
  return next || null
}

function textArray(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean)
  return String(value || '').split(',').map(item => item.trim()).filter(Boolean)
}

function jsonArray(value) {
  return Array.isArray(value) ? value : []
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const next = Number(value)
  return Number.isFinite(next) ? Math.max(0, Math.round(next)) : null
}

function normalizePackage(row = {}) {
  return {
    id: row.id || '',
    serviceId: row.serviceId || row.service_id || '',
    tier: row.tier || 'basic',
    title: row.title || '',
    description: row.description || '',
    features: jsonArray(row.features).map(item => String(item || '').trim()).filter(Boolean),
    priceAmount: row.priceAmount ?? row.price_amount ?? '',
    currency: row.currency || 'EUR',
    deliveryDays: row.deliveryDays ?? row.delivery_days ?? '',
    revisions: row.revisions ?? '',
    isActive: row.isActive ?? row.is_active ?? true,
  }
}

function normalizeFaq(row = {}) {
  return {
    id: row.id || '',
    serviceId: row.serviceId || row.service_id || '',
    question: row.question || '',
    answer: row.answer || '',
    orderIndex: row.orderIndex ?? row.order_index ?? 0,
  }
}

export function normalizePartnerService(row = {}, related = {}) {
  const packages = (related.packages || row.packages || []).map(normalizePackage)
  const faq = (related.faq || row.faq || []).map(normalizeFaq).sort((left, right) => left.orderIndex - right.orderIndex)
  const profile = row.profile || related.profile || null
  const activePackages = packages.filter(item => item.isActive)
  const lowestPackage = activePackages.reduce((best, item) => {
    if (!best) return item
    const bestPrice = Number(best.priceAmount || Number.POSITIVE_INFINITY)
    const currentPrice = Number(item.priceAmount || Number.POSITIVE_INFINITY)
    return currentPrice < bestPrice ? item : best
  }, null)

  return {
    id: row.id || '',
    createdAt: row.createdAt || row.created_at || '',
    updatedAt: row.updatedAt || row.updated_at || '',
    slug: row.slug || '',
    profileId: row.profileId || row.profile_id || '',
    partnerId: row.partnerId || row.partner_id || '',
    layerSlug: row.layerSlug || row.layer_slug || '',
    title: row.title || '',
    subtitle: row.subtitle || '',
    descriptionMd: row.descriptionMd || row.description_md || '',
    coverUrl: row.coverUrl || row.cover_url || '',
    media: jsonArray(row.media),
    tags: textArray(row.tags),
    deliveryAreas: textArray(row.deliveryAreas || row.delivery_areas),
    isPublished: row.isPublished ?? row.is_published ?? false,
    moderationStatus: row.moderationStatus || row.moderation_status || 'draft',
    moderationNote: row.moderationNote || row.moderation_note || '',
    packages,
    faq,
    profile,
    lowestPrice: lowestPackage?.priceAmount || '',
    lowestCurrency: lowestPackage?.currency || 'EUR',
    shortestDeliveryDays: activePackages.reduce((best, item) => {
      const value = Number(item.deliveryDays)
      if (!Number.isFinite(value) || value <= 0) return best
      return best ? Math.min(best, value) : value
    }, 0),
  }
}

export function makeEmptyPackage(tier) {
  const definition = SERVICE_TIER_DEFINITIONS.find(item => item.tier === tier) || SERVICE_TIER_DEFINITIONS[0]
  return {
    id: '',
    tier: definition.tier,
    title: definition.fallbackTitle,
    description: '',
    features: [''],
    priceAmount: '',
    currency: 'EUR',
    deliveryDays: '',
    revisions: '',
    isActive: true,
  }
}

export function makePartnerServiceDraft(profile, service = null) {
  const packagesByTier = new Map((service?.packages || []).map(item => [item.tier, item]))
  const primaryPackage = packagesByTier.get('basic') || service?.packages?.find(item => item.isActive) || null
  return {
    id: service?.id || '',
    slug: service?.slug || '',
    profileId: profile?.id || service?.profileId || '',
    partnerId: profile?.userId || service?.partnerId || '',
    layerSlug: service?.layerSlug || profile?.layerSlug || profile?.layer || '',
    title: service?.title || '',
    subtitle: service?.subtitle || '',
    descriptionMd: service?.descriptionMd || '',
    coverUrl: service?.coverUrl || '',
    media: service?.media || [],
    tagsText: (service?.tags || []).join(', '),
    deliveryAreasText: (service?.deliveryAreas?.length ? service.deliveryAreas : profile?.serviceAreas || []).join(', '),
    moderationStatus: service?.moderationStatus || 'draft',
    moderationNote: service?.moderationNote || '',
    isPublished: service?.isPublished || false,
    packages: [{ ...makeEmptyPackage('basic'), ...(primaryPackage || {}), tier: 'basic', currency: 'EUR', deliveryDays: '', revisions: '', isActive: true }],
    faq: service?.faq?.length ? service.faq : [
      { question: '', answer: '', orderIndex: 0 },
      { question: '', answer: '', orderIndex: 1 },
    ],
  }
}

export function serviceSlugFor(title, profile) {
  const base = slugify(`${title || 'usluga'}-${profile?.slug || profile?.name || ''}`)
  return base || `usluga-${Date.now().toString(36)}`
}

function servicePayload(profile, draft, status) {
  const nextStatus = status || draft.moderationStatus || 'draft'
  const isPublished = nextStatus === 'approved'
  return {
    slug: cleanText(draft.slug) || serviceSlugFor(draft.title, profile),
    profile_id: profile.id,
    partner_id: profile.userId,
    layer_slug: cleanText(draft.layerSlug) || profile.layerSlug,
    title: cleanText(draft.title) || 'Нова услуга',
    subtitle: cleanText(draft.subtitle),
    description_md: cleanText(draft.descriptionMd),
    cover_url: cleanText(draft.coverUrl),
    media: jsonArray(draft.media),
    tags: textArray(draft.tagsText),
    delivery_areas: textArray(draft.deliveryAreasText),
    is_published: isPublished,
    moderation_status: nextStatus,
    moderation_note: null,
  }
}

function packagePayload(serviceId, item) {
  return {
    service_id: serviceId,
    tier: item.tier,
    title: cleanText(item.title) || SERVICE_TIER_DEFINITIONS.find(definition => definition.tier === item.tier)?.fallbackTitle || 'Пакет',
    description: cleanText(item.description),
    features: textArray(item.features),
    price_amount: numberOrNull(item.priceAmount),
    currency: 'EUR',
    delivery_days: null,
    revisions: null,
    is_active: true,
  }
}

function faqPayload(serviceId, item, index) {
  return {
    service_id: serviceId,
    question: cleanText(item.question),
    answer: cleanText(item.answer),
    order_index: index,
  }
}

async function attachServiceRelations(rows) {
  const serviceIds = rows.map(row => row.id).filter(Boolean)
  if (!serviceIds.length) return []

  const [{ data: packages, error: packagesError }, { data: faq, error: faqError }] = await Promise.all([
    supabase.from('partner_service_packages').select('*').in('service_id', serviceIds).order('tier'),
    supabase.from('partner_service_faq').select('*').in('service_id', serviceIds).order('order_index'),
  ])

  if (packagesError) throw packagesError
  if (faqError) throw faqError

  const packagesByService = new Map()
  ;(packages || []).forEach((item) => {
    const list = packagesByService.get(item.service_id) || []
    list.push(item)
    packagesByService.set(item.service_id, list)
  })

  const faqByService = new Map()
  ;(faq || []).forEach((item) => {
    const list = faqByService.get(item.service_id) || []
    list.push(item)
    faqByService.set(item.service_id, list)
  })

  return rows.map(row => normalizePartnerService(row, {
    packages: packagesByService.get(row.id) || [],
    faq: faqByService.get(row.id) || [],
  }))
}

export async function loadPartnerServicesForProfile(profileId) {
  if (!profileId) return []
  const { data, error } = await supabase
    .from('partner_services')
    .select(PARTNER_SERVICE_COLUMNS)
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return attachServiceRelations(data || [])
}

export async function loadPublicPartnerServices({ layer = 'all', query = '' } = {}) {
  let request = supabase
    .from('partner_services')
    .select(`${PARTNER_SERVICE_COLUMNS}, profile:profiles(${PROFILE_PUBLIC_COLUMNS})`)
    .eq('is_published', true)
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: false })

  if (layer !== 'all') request = request.eq('layer_slug', layer)

  const { data, error } = await request
  if (error) throw error
  const normalized = await attachServiceRelations(data || [])
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return normalized
  return normalized.filter(service => `${service.title} ${service.subtitle} ${service.tags.join(' ')} ${service.profile?.name || ''}`.toLowerCase().includes(needle))
}

export async function loadPartnerServiceBySlug(slug) {
  const { data, error } = await supabase
    .from('partner_services')
    .select(`${PARTNER_SERVICE_COLUMNS}, profile:profiles(${PROFILE_PUBLIC_COLUMNS})`)
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  const [service] = await attachServiceRelations([data])
  return service || null
}

export async function loadAdminPartnerServices() {
  const { data, error } = await supabase
    .from('partner_services')
    .select(`${PARTNER_SERVICE_COLUMNS}, profile:profiles(${PROFILE_PUBLIC_COLUMNS})`)
    .order('created_at', { ascending: false })

  if (error) throw error
  return attachServiceRelations(data || [])
}

export async function savePartnerService(profile, draft, { submit = false } = {}) {
  if (!profile?.id || !profile?.userId) throw new Error('Липсва свързан партньорски профил.')
  const primaryPackage = draft.packages[0] || makeEmptyPackage('basic')
  if (submit && !draft.title.trim()) throw new Error('Услугата има нужда от заглавие.')
  if (submit && !Number(primaryPackage.priceAmount)) throw new Error('Въведи цена в евро, за да създадеш услугата.')

  const status = submit ? 'approved' : 'draft'
  const payload = servicePayload(profile, draft, status)
  const request = draft.id
    ? supabase.from('partner_services').update(payload).eq('id', draft.id).eq('profile_id', profile.id)
    : supabase.from('partner_services').insert(payload)

  const { data: serviceRow, error: serviceError } = await request.select(PARTNER_SERVICE_COLUMNS).single()
  if (serviceError) throw serviceError

  const packageRows = [packagePayload(serviceRow.id, primaryPackage)]
  const { error: packagesError } = await supabase
    .from('partner_service_packages')
    .upsert(packageRows, { onConflict: 'service_id,tier' })
  if (packagesError) throw packagesError

  const { error: disablePackagesError } = await supabase
    .from('partner_service_packages')
    .update({ is_active: false })
    .eq('service_id', serviceRow.id)
    .neq('tier', 'basic')
  if (disablePackagesError) throw disablePackagesError

  const { error: deleteFaqError } = await supabase
    .from('partner_service_faq')
    .delete()
    .eq('service_id', serviceRow.id)
  if (deleteFaqError) throw deleteFaqError

  const faqRows = draft.faq.map(faqPayload.bind(null, serviceRow.id)).filter(item => item.question && item.answer)
  if (faqRows.length) {
    const { error: faqError } = await supabase.from('partner_service_faq').insert(faqRows)
    if (faqError) throw faqError
  }

  const [service] = await attachServiceRelations([serviceRow])
  return service
}

export async function deletePartnerService(serviceId) {
  if (!serviceId) return
  const { error } = await supabase.from('partner_services').delete().eq('id', serviceId)
  if (error) throw error
}

export async function uploadPartnerServiceImage({ file, target, kind = 'cover' }) {
  const result = await uploadServiceMedia({ file, target, kind })
  return {
    url: result.publicUrl,
    path: result.path,
    bucket: result.bucket || 'service-media',
    fingerprint: result.fingerprint,
    reused: Boolean(result.reused),
  }
}

export function appendPartnerServiceMedia(draft, upload, caption = '') {
  const media = Array.isArray(draft.media) ? draft.media : []
  return {
    ...draft,
    coverUrl: draft.coverUrl || upload.url,
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

export function packagePriceLabel(service) {
  if (!service?.lowestPrice) return 'Цена по оферта'
  return `${new Intl.NumberFormat('bg-BG').format(Number(service.lowestPrice))} €`
}

export function formatServicePrice(amount) {
  const value = Number(amount || 0)
  if (!Number.isFinite(value) || value <= 0) return 'Цена по оферта'
  return `${new Intl.NumberFormat('bg-BG').format(value)} €`
}
