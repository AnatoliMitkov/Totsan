import { normalizeProfile } from './profiles.js'
import { getMaterialCategory, getProductBrand } from './product-metadata.js'
import { supabase } from './supabase.js'

export const MATERIAL_RELATION_TYPES = [
  { value: 'uses', editLabel: 'Работя с', resultLabel: 'Работи с', pillLabel: 'Работи с' },
  { value: 'installs', editLabel: 'Монтирам', resultLabel: 'Монтира', pillLabel: 'Монтира' },
  { value: 'sells', editLabel: 'Продавам', resultLabel: 'Продава', pillLabel: 'Продава' },
  { value: 'consults', editLabel: 'Консултирам', resultLabel: 'Консултира', pillLabel: 'Консултира' },
  { value: 'recommends', editLabel: 'Препоръчвам', resultLabel: 'Препоръчва', pillLabel: 'Препоръчва' },
]

export const PARTNER_MATERIAL_CAPABILITY_COLUMNS = `
  id,
  created_at,
  updated_at,
  profile_id,
  partner_id,
  layer_slug,
  category_slug,
  brand_slug,
  relation_types,
  note,
  is_public,
  moderation_status,
  moderation_note,
  reviewed_at
`

const PROFILE_PUBLIC_COLUMNS = `
  id,
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

export function relationTypePills(types = []) {
  const labels = new Map(MATERIAL_RELATION_TYPES.map(item => [item.value, item.pillLabel]))
  return textArray(types).map(type => labels.get(type)).filter(Boolean)
}

export function normalizeMaterialCapability(row = {}) {
  const category = getMaterialCategory(row.categorySlug || row.category_slug)
  const brand = getProductBrand(row.brandSlug || row.brand_slug)
  return {
    id: row.id || '',
    createdAt: row.createdAt || row.created_at || '',
    updatedAt: row.updatedAt || row.updated_at || '',
    profileId: row.profileId || row.profile_id || '',
    partnerId: row.partnerId || row.partner_id || '',
    layerSlug: row.layerSlug || row.layer_slug || '',
    categorySlug: row.categorySlug || row.category_slug || '',
    categoryLabel: category?.label || row.categoryLabel || row.category_label || '',
    brandSlug: row.brandSlug || row.brand_slug || null,
    brandLabel: brand?.label || row.brandLabel || row.brand_label || '',
    relationTypes: textArray(row.relationTypes || row.relation_types),
    note: row.note || '',
    isPublic: row.isPublic ?? row.is_public ?? true,
    moderationStatus: row.moderationStatus || row.moderation_status || 'approved',
    moderationNote: row.moderationNote || row.moderation_note || '',
    reviewedAt: row.reviewedAt || row.reviewed_at || null,
    profile: row.profile ? normalizeProfile(row.profile) : null,
  }
}

function capabilityPayload(profile, draft) {
  if (!profile?.id || !profile?.userId) throw new Error('Липсва свързан партньорски профил.')
  const relationTypes = textArray(draft.relationTypes)
  if (!draft.categorySlug) throw new Error('Избери категория материал.')
  if (!relationTypes.length) throw new Error('Избери поне един тип работа.')

  return {
    profile_id: profile.id,
    partner_id: profile.userId,
    layer_slug: draft.layerSlug || profile.layerSlug || profile.layer,
    category_slug: draft.categorySlug,
    brand_slug: cleanText(draft.brandSlug),
    relation_types: relationTypes,
    note: cleanText(draft.note),
    is_public: Boolean(draft.isPublic),
    moderation_status: draft.id ? (draft.moderationStatus || 'pending') : 'pending',
  }
}

export function makeMaterialCapabilityDraft(profile, capability = null) {
  return {
    id: capability?.id || '',
    profileId: profile?.id || capability?.profileId || '',
    partnerId: profile?.userId || capability?.partnerId || '',
    layerSlug: capability?.layerSlug || profile?.layerSlug || profile?.layer || '',
    categorySlug: capability?.categorySlug || '',
    brandSlug: capability?.brandSlug || '',
    relationTypes: capability?.relationTypes?.length ? capability.relationTypes : ['uses'],
    note: capability?.note || '',
    isPublic: capability?.isPublic ?? true,
    moderationStatus: capability?.moderationStatus || 'pending',
    moderationNote: capability?.moderationNote || '',
  }
}

export async function loadPartnerMaterialCapabilitiesForProfile(profileId) {
  if (!profileId) return []
  const { data, error } = await supabase
    .from('partner_material_capabilities')
    .select(PARTNER_MATERIAL_CAPABILITY_COLUMNS)
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(normalizeMaterialCapability)
}

export async function savePartnerMaterialCapability(profile, draft) {
  const payload = capabilityPayload(profile, draft)
  const request = draft.id
    ? supabase.from('partner_material_capabilities').update(payload).eq('id', draft.id).eq('profile_id', profile.id)
    : supabase.from('partner_material_capabilities').insert(payload)

  const { data, error } = await request.select(PARTNER_MATERIAL_CAPABILITY_COLUMNS).single()
  if (error) throw error
  return normalizeMaterialCapability(data)
}

export async function deletePartnerMaterialCapability(capabilityId) {
  if (!capabilityId) return
  const { error } = await supabase.from('partner_material_capabilities').delete().eq('id', capabilityId)
  if (error) throw error
}

export async function loadPublicMaterialCapabilitiesForProduct(product) {
  if (!product?.layerSlug || !product?.categorySlug) return []
  let request = supabase
    .from('partner_material_capabilities')
    .select(`${PARTNER_MATERIAL_CAPABILITY_COLUMNS}, profile:profiles(${PROFILE_PUBLIC_COLUMNS})`)
    .eq('is_public', true)
    .eq('moderation_status', 'approved')
    .eq('layer_slug', product.layerSlug)
    .eq('category_slug', product.categorySlug)

  if (product.brandSlug) {
    request = request.or(`brand_slug.eq.${product.brandSlug},brand_slug.is.null`)
  } else {
    request = request.is('brand_slug', null)
  }

  const { data, error } = await request.order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(normalizeMaterialCapability).filter(item => item.profile?.id)
}

export const loadPublicMaterialCapabilitiesForSolution = loadPublicMaterialCapabilitiesForProduct

export async function loadPublicMaterialCapabilities() {
  const { data, error } = await supabase
    .from('partner_material_capabilities')
    .select(`${PARTNER_MATERIAL_CAPABILITY_COLUMNS}, profile:profiles(${PROFILE_PUBLIC_COLUMNS})`)
    .eq('is_public', true)
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(normalizeMaterialCapability).filter(item => item.profile?.id)
}

export function buildProductPartnerRecommendations({ product, capabilities = [], fallbackProfessionals = [], limit = 3 }) {
  const seenProfiles = new Set()
  const ranked = capabilities
    .map((capability) => ({
      capability,
      rank: product.brandSlug && capability.brandSlug === product.brandSlug ? 1 : 2,
    }))
    .sort((left, right) => left.rank - right.rank)

  const recommendations = []
  ranked.forEach(({ capability, rank }) => {
    const profile = capability.profile
    const key = profile?.id || profile?.slug
    if (!key || seenProfiles.has(key) || recommendations.length >= limit) return
    seenProfiles.add(key)
    recommendations.push({
      person: profile,
      source: rank === 1 ? 'brand' : 'category',
      relationshipLabel: rank === 1 && product.brandLabel
        ? `Работи с марката ${product.brandLabel}`
        : `Работи с ${product.categoryLabel}`,
      relationLabels: relationTypePills(capability.relationTypes),
      note: capability.note,
      capability,
    })
  })

  if (recommendations.length < limit) {
    fallbackProfessionals.forEach((person) => {
      const key = person?.id || person?.slug || person?.name
      if (!key || seenProfiles.has(key) || recommendations.length >= limit) return
      seenProfiles.add(key)
      recommendations.push({
        person,
        source: 'fallback',
        relationshipLabel: `Подходящ специалист от Слой ${product.layerNumber}`,
        relationLabels: [],
        note: '',
        capability: null,
      })
    })
  }

  return recommendations
}

export function buildMaterialSolutionItems({ templates = [], capabilities = [], layers = [] } = {}) {
  const byKey = new Map()
  const layerMap = new Map(layers.map((layer) => [layer.slug, layer]))

  function upsertSolution(base) {
    const key = `${base.layerSlug || base.layer}-${base.categorySlug || 'category'}-${base.brandSlug || 'all'}`
    const existing = byKey.get(key) || {
      kind: 'material',
      slug: base.slug,
      layer: base.layerSlug || base.layer,
      layerSlug: base.layerSlug || base.layer,
      layerNumber: base.layerNumber || layerMap.get(base.layerSlug || base.layer)?.number || '',
      layerTitle: base.layerTitle || layerMap.get(base.layerSlug || base.layer)?.title || '',
      name: base.name,
      sub: base.sub || base.categoryLabel,
      tag: base.tag || '',
      price: base.price || '',
      categorySlug: base.categorySlug,
      categoryLabel: base.categoryLabel,
      brandSlug: base.brandSlug || null,
      brandLabel: base.brandLabel || '',
      partnerCount: 0,
      capabilities: [],
      source: base.source || 'template',
    }

    if (base.capability) {
      existing.capabilities = [...existing.capabilities, base.capability]
      existing.partnerCount = new Set(existing.capabilities.map((item) => item.profileId || item.profile?.id).filter(Boolean)).size
      existing.source = existing.source === 'template' ? 'partner_capability' : existing.source
    }

    byKey.set(key, existing)
  }

  templates.forEach((template) => upsertSolution({ ...template, source: 'template' }))
  capabilities.forEach((capability) => {
    upsertSolution({
      slug: `${capability.categorySlug}${capability.brandSlug ? `-${capability.brandSlug}` : ''}`,
      layerSlug: capability.layerSlug,
      name: capability.brandLabel || capability.categoryLabel,
      sub: capability.categoryLabel,
      categorySlug: capability.categorySlug,
      categoryLabel: capability.categoryLabel,
      brandSlug: capability.brandSlug,
      brandLabel: capability.brandLabel,
      capability,
      source: 'partner_capability',
    })
  })

  return Array.from(byKey.values()).sort((left, right) => {
    const layerCompare = String(left.layerNumber || '').localeCompare(String(right.layerNumber || ''), 'bg')
    if (layerCompare) return layerCompare
    return String(left.name || '').localeCompare(String(right.name || ''), 'bg')
  })
}
