import { supabase } from './supabase.js'
import { uploadProjectMedia } from './project-media-upload-client.js'
import { formatMoneyRange } from './money.js'
import { normalizeLocationValue } from './locations.js'

export const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Апартамент' },
  { value: 'house', label: 'Къща' },
  { value: 'office', label: 'Офис' },
  { value: 'commercial', label: 'Магазин' },
  { value: 'outdoor', label: 'Двор / външна зона' },
  { value: 'roof', label: 'Покрив / тераса' },
  { value: 'other', label: 'Друго' },
]

export const LOCATION_ACCESS_KEY = 'locationAccess'

export const LOCATION_ACCESS_OPTIONS = {
  parkingAvailability: [
    { value: 'front', label: 'Има място за паркиране пред обекта' },
    { value: 'nearby', label: 'Има паркиране наблизо' },
    { value: 'difficult', label: 'Паркирането е трудно' },
    { value: 'unknown', label: 'Не знам' },
  ],
  materialStorage: [
    { value: 'available', label: 'Има място за материали' },
    { value: 'limited', label: 'Има ограничено място' },
    { value: 'none', label: 'Няма място' },
    { value: 'unknown', label: 'Не знам' },
  ],
  wasteSpace: [
    { value: 'available', label: 'Има място за временно събиране на отпадъци' },
    { value: 'limited', label: 'Ограничено място' },
    { value: 'none', label: 'Няма място' },
    { value: 'unknown', label: 'Не знам' },
  ],
  workTimeRestrictions: [
    { value: 'standard', label: 'Може да се работи стандартно' },
    { value: 'specific_hours', label: 'Само в определени часове' },
    { value: 'after_hours', label: 'Само извън работно време' },
    { value: 'weekend', label: 'Само уикенд' },
    { value: 'clarify', label: 'Трябва да се уточни' },
  ],
  specialAccess: [
    { value: 'manager', label: 'Нужна е уговорка с домоуправител' },
    { value: 'security', label: 'Има охрана / пропуск' },
    { value: 'elevator', label: 'Има асансьор' },
    { value: 'narrow', label: 'Има тесен вход или тесни стълби' },
    { value: 'steps', label: 'Има праг / стъпала / труден достъп' },
    { value: 'unknown', label: 'Не съм сигурен/а' },
  ],
  floorLevel: [
    { value: 'ground', label: 'Партер' },
    { value: '1_2', label: '1-2 етаж' },
    { value: '3_5', label: '3-5 етаж' },
    { value: '6_plus', label: '6+ етаж' },
    { value: 'unknown', label: 'Не знам' },
  ],
  elevator: [
    { value: 'yes', label: 'Да, има асансьор' },
    { value: 'small', label: 'Да, но е малък' },
    { value: 'no', label: 'Не' },
    { value: 'unknown', label: 'Не знам' },
  ],
  elevatorForMaterials: [
    { value: 'yes', label: 'Да' },
    { value: 'small_items', label: 'Само за дребни неща' },
    { value: 'no', label: 'Не' },
    { value: 'ask_manager', label: 'Трябва да се пита домоуправител' },
  ],
  entranceAccess: [
    { value: 'normal', label: 'Нормален достъп' },
    { value: 'narrow', label: 'Тесен вход / тесни стълби' },
    { value: 'difficult', label: 'Има праг / труден достъп' },
    { value: 'unknown', label: 'Не знам' },
  ],
  vehicleAccess: [
    { value: 'front', label: 'Може да се спре до обекта' },
    { value: 'nearby', label: 'Може да се спре наблизо' },
    { value: 'limited', label: 'Достъпът е ограничен' },
    { value: 'unknown', label: 'Не знам' },
  ],
  roofAccess: [
    { value: 'easy', label: 'Лесен достъп' },
    { value: 'common_parts', label: 'През общи части' },
    { value: 'special', label: 'Само със стълба / специален достъп' },
    { value: 'unclear', label: 'Няма ясен достъп' },
    { value: 'unknown', label: 'Не знам' },
  ],
  roofPermissionNeeded: [
    { value: 'yes', label: 'Да, от вход / домоуправител / съседи' },
    { value: 'no', label: 'Не' },
    { value: 'unknown', label: 'Не знам' },
  ],
  businessHoursWork: [
    { value: 'yes', label: 'Да' },
    { value: 'after_hours', label: 'Само извън работно време' },
    { value: 'weekend', label: 'Само през уикенд' },
    { value: 'clarify', label: 'Трябва да се уточни' },
  ],
  loadingAccess: [
    { value: 'loading_entrance', label: 'Има удобен товарен вход' },
    { value: 'normal_entrance', label: 'Има нормален вход' },
    { value: 'difficult', label: 'Достъпът е труден' },
    { value: 'unknown', label: 'Не знам' },
  ],
}

export const DEFAULT_LOCATION_ACCESS = {
  exactAddress: '',
  googleMapsUrl: '',
  entrance: '',
  floor: '',
  unitNumber: '',
  accessInstructions: '',
  visitPhone: '',
  parkingAvailability: '',
  materialStorage: '',
  wasteSpace: '',
  workTimeRestrictions: '',
  specialAccess: [],
  floorLevel: '',
  elevator: '',
  elevatorForMaterials: '',
  entranceAccess: '',
  vehicleAccess: '',
  roofAccess: '',
  roofPermissionNeeded: '',
  businessHoursWork: '',
  loadingAccess: '',
}

export const PROJECT_MEDIA_KINDS = [
  { value: 'photo', label: 'Снимка' },
  { value: 'plan', label: 'План' },
  { value: 'inspiration', label: 'Вдъхновение' },
  { value: 'document', label: 'Документ' },
]

export const DEFAULT_PROJECT = {
  id: '',
  title: '',
  propertyType: '',
  areaSqm: '',
  roomsCount: '',
  addressCity: '',
  addressRegion: '',
  currentLayerSlug: 'ideya',
  desiredStartDate: '',
  desiredEndDate: '',
  budgetMin: '',
  budgetMax: '',
  budgetCurrency: 'EUR',
  ideaDescription: '',
  quizAnswers: {},
  isActive: true,
}

export const PENDING_PROJECT_BRIEF_KEY = 'totsan.pendingProjectBrief'

const PROJECT_SCOPE_LABELS = {
  house: 'Нова къща',
  apartment: 'Цяло жилище',
  room: 'Отделно помещение',
  cosmetic: 'Декорация / двор',
}

const PROJECT_STAGE_LABELS = {
  idea: 'Идея',
  plans: 'Планиране',
  materials: 'Избор на материали',
  finish: 'Завършване',
}

const PROJECT_PRIORITY_LABELS = {
  quality: 'Качество',
  speed: 'Срок',
  price: 'Бюджет',
  support: 'Пълна подкрепа',
}

const PROPERTY_TYPE_LABELS = Object.fromEntries(PROPERTY_TYPES.map((item) => [item.value, item.label]))

function cleanText(value) {
  const next = String(value ?? '').trim()
  return next || null
}

function hasText(value) {
  return String(value || '').trim().length > 0
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function labelFromMap(value, labels) {
  if (!hasText(value)) return ''
  return labels[value] || ''
}

function labelFromOptions(key, value) {
  const options = LOCATION_ACCESS_OPTIONS[key] || []
  return options.find((item) => item.value === value)?.label || ''
}

function cleanArray(value) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter(Boolean)
}

function cleanLocationAccess(value, { trim = false } = {}) {
  const source = isRecord(value) ? value : {}
  const cleanString = (nextValue) => {
    const text = String(nextValue ?? '')
    return trim ? text.trim() : text
  }
  return {
    ...DEFAULT_LOCATION_ACCESS,
    ...Object.fromEntries(
      Object.keys(DEFAULT_LOCATION_ACCESS)
        .filter((key) => key !== 'specialAccess')
        .map((key) => [key, cleanString(source[key])]),
    ),
    specialAccess: cleanArray(source.specialAccess),
  }
}

function hasLocationAccessValue(locationAccess) {
  return Object.entries(locationAccess || {}).some(([key, value]) => {
    if (key === 'specialAccess') return Array.isArray(value) && value.length > 0
    return hasText(value)
  })
}

function validExternalUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  try {
    const url = new URL(text)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

export function getProjectLocationAccess(project) {
  const quizAnswers = isRecord(project?.quizAnswers) ? project.quizAnswers : {}
  return cleanLocationAccess(quizAnswers[LOCATION_ACCESS_KEY])
}

export function withProjectLocationAccess(project, updates) {
  const nextLocationAccess = cleanLocationAccess({ ...getProjectLocationAccess(project), ...(updates || {}) })
  const quizAnswers = isRecord(project?.quizAnswers) ? project.quizAnswers : {}
  return {
    ...(project || DEFAULT_PROJECT),
    quizAnswers: {
      ...quizAnswers,
      [LOCATION_ACCESS_KEY]: nextLocationAccess,
    },
  }
}

export function getLocationAccessLabel(key, value) {
  if (Array.isArray(value)) {
    return value.map((item) => labelFromOptions(key, item)).filter(Boolean).join(', ')
  }
  return labelFromOptions(key, value)
}

export function getLocationAccessSummary(projectOrAccess, { includeExact = false } = {}) {
  const locationAccess = projectOrAccess?.quizAnswers
    ? getProjectLocationAccess(projectOrAccess)
    : cleanLocationAccess(projectOrAccess)

  const items = [
    getLocationAccessLabel('floorLevel', locationAccess.floorLevel),
    getLocationAccessLabel('elevator', locationAccess.elevator),
    getLocationAccessLabel('parkingAvailability', locationAccess.parkingAvailability),
    getLocationAccessLabel('vehicleAccess', locationAccess.vehicleAccess),
    getLocationAccessLabel('roofAccess', locationAccess.roofAccess),
    getLocationAccessLabel('businessHoursWork', locationAccess.businessHoursWork),
    getLocationAccessLabel('loadingAccess', locationAccess.loadingAccess),
    getLocationAccessLabel('materialStorage', locationAccess.materialStorage),
    getLocationAccessLabel('wasteSpace', locationAccess.wasteSpace),
    getLocationAccessLabel('workTimeRestrictions', locationAccess.workTimeRestrictions),
    getLocationAccessLabel('specialAccess', locationAccess.specialAccess),
  ].filter(Boolean)

  if (includeExact && hasText(locationAccess.accessInstructions)) {
    items.push(locationAccess.accessInstructions)
  }

  return [...new Set(items)].slice(0, includeExact ? 12 : 5).join(', ')
}

export function getProjectAccessItems(projectOrAccess) {
  const locationAccess = projectOrAccess?.quizAnswers
    ? getProjectLocationAccess(projectOrAccess)
    : cleanLocationAccess(projectOrAccess)

  const items = [
    getLocationAccessLabel('floorLevel', locationAccess.floorLevel),
    getLocationAccessLabel('elevator', locationAccess.elevator),
    getLocationAccessLabel('parkingAvailability', locationAccess.parkingAvailability),
    getLocationAccessLabel('vehicleAccess', locationAccess.vehicleAccess),
    getLocationAccessLabel('roofAccess', locationAccess.roofAccess),
    getLocationAccessLabel('businessHoursWork', locationAccess.businessHoursWork),
    getLocationAccessLabel('loadingAccess', locationAccess.loadingAccess),
    getLocationAccessLabel('materialStorage', locationAccess.materialStorage),
    getLocationAccessLabel('wasteSpace', locationAccess.wasteSpace),
    getLocationAccessLabel('workTimeRestrictions', locationAccess.workTimeRestrictions),
    getLocationAccessLabel('specialAccess', locationAccess.specialAccess),
  ].filter(Boolean)

  return [...new Set(items)]
}

export function getSafeGoogleMapsUrl(projectOrAccess) {
  const locationAccess = projectOrAccess?.quizAnswers
    ? getProjectLocationAccess(projectOrAccess)
    : cleanLocationAccess(projectOrAccess)
  return validExternalUrl(locationAccess.googleMapsUrl)
}

export function hasProjectLocationAccess(project) {
  return hasLocationAccessValue(getProjectLocationAccess(project))
}

function findGuidedBriefAnswers(project) {
  const quizAnswers = isRecord(project?.quizAnswers) ? project.quizAnswers : isRecord(project) ? project : {}
  const candidates = []

  if (hasText(quizAnswers.scope) || hasText(quizAnswers.stage) || hasText(quizAnswers.priority)) {
    candidates.push(quizAnswers)
  }

  for (const key of ['start', 'home']) {
    if (isRecord(quizAnswers[key])) candidates.push(quizAnswers[key])
  }

  for (const entry of Object.values(quizAnswers)) {
    if (isRecord(entry)) candidates.push(entry)
  }

  for (const candidate of candidates) {
    const answers = isRecord(candidate.answers) ? candidate.answers : candidate
    if (hasText(answers.scope) || hasText(answers.stage) || hasText(answers.priority)) {
      return answers
    }
  }

  return {}
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

function mergeIdeaDescription(currentValue, pendingValue) {
  const currentText = String(currentValue || '').trim()
  const pendingText = String(pendingValue || '').trim()

  if (!pendingText) return currentText
  if (!currentText) return pendingText
  if (currentText.includes(pendingText)) return currentText

  return `${currentText}\n\n${pendingText}`
}

export function normalizeProject(row) {
  if (!row) return null

  return {
    id: row.id || '',
    userId: row.user_id || '',
    user_id: row.user_id || '',
    title: row.title || '',
    propertyType: row.property_type || '',
    areaSqm: row.area_sqm ?? '',
    roomsCount: row.rooms_count ?? '',
    addressCity: normalizeLocationValue(row.address_city),
    addressRegion: row.address_region || '',
    currentLayerSlug: row.current_layer_slug || 'ideya',
    desiredStartDate: row.desired_start_date || '',
    desiredEndDate: row.desired_end_date || '',
    budgetMin: row.budget_min ?? '',
    budgetMax: row.budget_max ?? '',
    budgetCurrency: row.budget_currency || 'EUR',
    ideaDescription: row.idea_description || '',
    quizAnswers: row.quiz_answers || {},
    isActive: row.is_active !== false,
    publicShareId: row.public_share_id || '',
    isShareable: row.is_shareable || false,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  }
}

export function normalizeProjectMedia(row) {
  if (!row) return null

  return {
    id: row.id || '',
    projectId: row.project_id || '',
    userId: row.user_id || '',
    bucket: row.bucket || 'project-media',
    path: row.path || '',
    publicUrl: row.public_url || '',
    signedUrl: row.signed_url || row.signedUrl || '',
    url: row.signed_url || row.signedUrl || row.public_url || '',
    kind: row.kind || 'photo',
    caption: row.caption || '',
    fileName: row.file_name || row.fileName || '',
    size: row.file_size ?? row.size ?? null,
    type: row.mime_type || row.content_type || row.type || '',
    orderIndex: row.order_index ?? 0,
    createdAt: row.created_at || '',
  }
}

function projectToDb(project, userId) {
  const quizAnswers = project.quizAnswers && typeof project.quizAnswers === 'object' ? project.quizAnswers : {}
  const locationAccess = cleanLocationAccess(quizAnswers[LOCATION_ACCESS_KEY], { trim: true })
  const nextQuizAnswers = {
    ...quizAnswers,
    [LOCATION_ACCESS_KEY]: locationAccess,
  }

  return {
    user_id: userId,
    title: cleanText(project.title),
    property_type: cleanText(project.propertyType),
    area_sqm: numberOrNull(project.areaSqm),
    rooms_count: numberOrNull(project.roomsCount),
    address_city: cleanText(normalizeLocationValue(project.addressCity)),
    address_region: cleanText(project.addressRegion),
    current_layer_slug: cleanText(project.currentLayerSlug),
    desired_start_date: cleanText(project.desiredStartDate),
    desired_end_date: cleanText(project.desiredEndDate),
    budget_min: numberOrNull(project.budgetMin),
    budget_max: numberOrNull(project.budgetMax),
    budget_currency: cleanText(project.budgetCurrency) || 'EUR',
    idea_description: cleanText(project.ideaDescription),
    quiz_answers: nextQuizAnswers,
    is_active: project.isActive !== false,
  }
}

async function withSignedMediaUrls(rows = []) {
  return Promise.all(rows.map(async (row) => {
    if (!row.path) return normalizeProjectMedia(row)

    const { data, error } = await supabase.storage
      .from(row.bucket || 'project-media')
      .createSignedUrl(row.path, 60 * 60)

    if (error) return normalizeProjectMedia(row)

    return normalizeProjectMedia({ ...row, signed_url: data?.signedUrl || '' })
  }))
}

async function loadActiveClientProjectRow(userId) {
  if (!userId) return null

  const { data, error } = await supabase
    .from('client_projects')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') throw error
  return data || null
}

export async function loadActiveClientProject(userId) {
  if (!userId) return { project: null, media: [] }

  const projectRow = await loadActiveClientProjectRow(userId)
  if (!projectRow) return { project: null, media: [] }

  const { data: mediaRows, error: mediaError } = await supabase
    .from('client_project_media')
    .select('*')
    .eq('project_id', projectRow.id)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true })

  if (mediaError) throw mediaError

  return {
    project: normalizeProject(projectRow),
    media: await withSignedMediaUrls(mediaRows || []),
  }
}

export async function saveCustomerAccountProfile(values) {
  const payload = {
    p_full_name: values.fullName || values.displayName || '',
    p_display_name: values.displayName || values.fullName || '',
    p_phone: values.phone || '',
    p_avatar_url: values.avatarUrl || '',
    p_cover_url: values.coverUrl || '',
    p_city: normalizeLocationValue(values.city),
    p_country: values.country || 'BG',
    p_bio: values.bio || '',
    p_locale: values.locale || 'bg',
    p_marketing_opt_in: Boolean(values.marketingOptIn),
    p_interests: Array.isArray(values.interests) ? values.interests : [],
    p_style_preferences: Array.isArray(values.stylePreferences) ? values.stylePreferences : [],
    p_preferred_contact_method: values.preferredContactMethod || '',
    p_age_group: values.ageGroup || '',
    p_gender: values.gender || '',
  }

  const { data, error } = await supabase.rpc('update_own_account_profile', payload)

  if (error && (error.code === 'PGRST202' || String(error.message || '').includes('p_cover_url'))) {
    const { p_cover_url: _coverUrl, ...legacyPayload } = payload
    const legacyResult = await supabase.rpc('update_own_account_profile', legacyPayload)
    if (legacyResult.error) throw legacyResult.error
    return {
      ...legacyResult.data,
      cover_url: values.coverUrl || legacyResult.data?.cover_url || '',
    }
  }

  if (error) throw error
  return data
}

export async function saveActiveClientProject(userId, projectDraft, existingProjectId = '') {
  const payload = projectToDb(projectDraft, userId)
  const query = existingProjectId
    ? supabase.from('client_projects').update(payload).eq('id', existingProjectId).eq('user_id', userId)
    : supabase.from('client_projects').insert(payload)

  const { data, error } = await query.select('*').single()
  if (error) throw error
  return normalizeProject(data)
}

export async function toggleClientProjectShare(userId, projectId, isShareable) {
  const { data, error } = await supabase
    .from('client_projects')
    .update({ is_shareable: isShareable })
    .eq('id', projectId)
    .eq('user_id', userId)
    .select('id, public_share_id, is_shareable')
    .single()

  if (error) throw error
  return data
}

export async function loadSharedClientProject(shareId) {
  if (!shareId) return null
  const { data, error } = await supabase.rpc('get_shared_client_project', { p_share_id: shareId })
  if (error) throw error
  if (!data || !data.project) return null

  return {
    project: normalizeProject(data.project),
    account: data.account,
    media: await withSignedMediaUrls(Array.isArray(data.media) ? data.media.filter(Boolean) : []),
  }
}

export function projectDraftFromPendingBrief(pendingBrief, baseProject = null) {
  const currentProject = { ...DEFAULT_PROJECT, ...(baseProject || {}) }

  return {
    ...currentProject,
    title: currentProject.title || String(pendingBrief?.title || '').trim(),
    currentLayerSlug: String(pendingBrief?.currentLayerSlug || '').trim() || currentProject.currentLayerSlug,
    ideaDescription: mergeIdeaDescription(currentProject.ideaDescription, pendingBrief?.ideaDescription),
    quizAnswers: {
      ...(currentProject.quizAnswers && typeof currentProject.quizAnswers === 'object' ? currentProject.quizAnswers : {}),
      ...(pendingBrief?.quizAnswers && typeof pendingBrief.quizAnswers === 'object' ? pendingBrief.quizAnswers : {}),
    },
  }
}

export async function persistPendingProjectBrief(userId, pendingBrief) {
  if (!userId) throw new Error('Missing user for project save.')
  if (!pendingBrief || typeof pendingBrief !== 'object') throw new Error('Missing pending project brief.')

  const existingProjectRow = await loadActiveClientProjectRow(userId)
  const existingProject = normalizeProject(existingProjectRow)
  const nextDraft = projectDraftFromPendingBrief(pendingBrief, existingProject)

  return saveActiveClientProject(userId, nextDraft, existingProject?.id || '')
}

export async function uploadClientProjectMedia({ file, userId, projectId, kind = 'photo', caption = '', orderIndex = 0 }) {
  const upload = await uploadProjectMedia({ file, projectId, kind })
  const { data, error } = await supabase
    .from('client_project_media')
    .insert({
      project_id: projectId,
      user_id: userId,
      bucket: upload.bucket || 'project-media',
      path: upload.path,
      public_url: null,
      kind,
      caption: cleanText(caption),
      order_index: orderIndex,
    })
    .select('*')
    .single()

  if (error) throw error
  const { data: signedData } = await supabase.storage
    .from(upload.bucket || 'project-media')
    .createSignedUrl(upload.path, 60 * 60)

  return normalizeProjectMedia({
    ...data,
    signed_url: upload.signedUrl || signedData?.signedUrl || '',
    file_name: upload.filename || file.name,
    file_size: upload.size ?? file.size,
    mime_type: upload.type || file.type,
  })
}

export async function updateClientProjectMedia(mediaId, updates) {
  const { data, error } = await supabase
    .from('client_project_media')
    .update({
      caption: cleanText(updates.caption),
      kind: updates.kind || 'photo',
      order_index: numberOrNull(updates.orderIndex) ?? 0,
    })
    .eq('id', mediaId)
    .select('*')
    .single()

  if (error) throw error
  return normalizeProjectMedia(data)
}

export async function deleteClientProjectMedia(mediaId) {
  const { error } = await supabase
    .from('client_project_media')
    .delete()
    .eq('id', mediaId)

  if (error) throw error
}

function hasQuizAnswers(project) {
  const answers = project?.quizAnswers || {}
  return Object.keys(answers).length > 0
}

function countTruthy(values = []) {
  return values.reduce((total, value) => total + (value ? 1 : 0), 0)
}

export function isClientProjectReadyForPartner(project, media = []) {
  if (!project) return false

  const title = cleanText(project.title)
  const idea = cleanText(project.ideaDescription)
  const quizReady = hasQuizAnswers(project)
  const mediaReady = Array.isArray(media) && media.length > 0

  const scopeReady = Boolean(
    (title && !title.startsWith('Проект: Слой'))
    || idea.length >= 24
    || quizReady
    || mediaReady,
  )

  const contextSignals = countTruthy([
    hasText(project.propertyType) || Number(project.areaSqm) > 0 || Number(project.roomsCount) > 0,
    hasText(project.currentLayerSlug),
    Number(project.budgetMin) > 0 || Number(project.budgetMax) > 0,
    hasText(project.addressCity) || hasText(project.addressRegion) || hasProjectLocationAccess(project),
    hasText(project.desiredStartDate) || hasText(project.desiredEndDate),
    quizReady,
    mediaReady,
  ])

  return scopeReady && contextSignals >= 1
}

export function getProjectPropertyTypeLabel(project) {
  return labelFromMap(project?.propertyType, PROPERTY_TYPE_LABELS)
}

export function getProjectLayerLabel(project, layers = []) {
  const layerSlug = cleanText(project?.currentLayerSlug)
  if (!layerSlug) return ''
  const layer = layers.find((item) => item.slug === layerSlug)
  return layer ? `Слой ${layer.number} · ${layer.title}` : layerSlug
}

export function formatProjectBudget(project) {
  if (!project?.budgetMin && !project?.budgetMax) return ''
  return formatMoneyRange(project.budgetMin, project.budgetMax, project?.budgetCurrency || 'EUR')
}

export function formatProjectLocation(project) {
  return [project?.addressCity, project?.addressRegion].filter(hasText).join(', ')
}

export function getProjectScopeLabel(project) {
  const guidedAnswers = findGuidedBriefAnswers(project)
  return labelFromMap(guidedAnswers.scope, PROJECT_SCOPE_LABELS)
}

export function getProjectStageLabel(project) {
  const guidedAnswers = findGuidedBriefAnswers(project)
  return labelFromMap(guidedAnswers.stage, PROJECT_STAGE_LABELS)
}

export function getProjectPriorityLabel(project) {
  const guidedAnswers = findGuidedBriefAnswers(project)
  return labelFromMap(guidedAnswers.priority, PROJECT_PRIORITY_LABELS)
}

export function getProjectSignals(project, layers = []) {
  return {
    scope: getProjectScopeLabel(project),
    stage: getProjectStageLabel(project),
    priority: getProjectPriorityLabel(project),
    propertyType: getProjectPropertyTypeLabel(project),
    layer: getProjectLayerLabel(project, layers),
    budget: formatProjectBudget(project),
    location: formatProjectLocation(project),
  }
}

export function getProjectProfileItems(project, layers = []) {
  const signals = getProjectSignals(project, layers)
  return [
    { key: 'stage', label: 'Етап', value: signals.stage },
    { key: 'scope', label: 'Обхват', value: signals.scope },
    { key: 'priority', label: 'Приоритет', value: signals.priority },
    { key: 'layer', label: 'Слой', value: signals.layer },
    { key: 'budget', label: 'Бюджет', value: signals.budget },
    { key: 'location', label: 'Локация', value: signals.location },
  ].filter((item) => hasText(item.value))
}

export function calculateClientProfileCompleteness({ account, session, project, media = [] }) {
  const name = account?.full_name || account?.display_name || session?.user?.user_metadata?.name || ''
  const projectReady = isClientProjectReadyForPartner(project, media)
  const checks = [
    { key: 'name', label: 'Име', weight: 10, complete: hasText(name) },
    { key: 'phone', label: 'Телефон', weight: 10, complete: hasText(account?.phone) },
    { key: 'city', label: 'Град', weight: 5, complete: hasText(account?.city), optional: true },
    { key: 'avatar', label: 'Аватар', weight: 5, complete: hasText(account?.avatar_url), optional: true },
    { key: 'bio', label: 'Кратко био', weight: 5, complete: hasText(account?.bio), optional: true },
    { key: 'project-ready', label: 'Проектно задание', weight: 30, complete: projectReady },
    { key: 'property-type', label: 'Тип обект', weight: 5, complete: hasText(project?.propertyType), optional: true },
    { key: 'area', label: 'Квадратура', weight: 5, complete: Number(project?.areaSqm) > 0, optional: true },
    { key: 'budget', label: 'Бюджет', weight: 5, complete: Number(project?.budgetMin) > 0 || Number(project?.budgetMax) > 0, optional: true },
    { key: 'location', label: 'Локация или достъп', weight: 5, complete: hasText(project?.addressCity) || hasText(project?.addressRegion) || hasProjectLocationAccess(project), optional: true },
    { key: 'media', label: 'Снимки/планове', weight: 10, complete: media.length > 0, optional: true },
    { key: 'quiz', label: 'Допълнителни отговори', weight: 5, complete: hasQuizAnswers(project), optional: true },
  ]

  const earned = checks.reduce((total, check) => total + (check.complete ? check.weight : 0), 0)
  const total = checks.reduce((sum, check) => sum + check.weight, 0)
  const percent = Math.min(100, Math.round((earned / total) * 100))

  return {
    percent,
    earned,
    total,
    isReady: projectReady && hasText(name) && hasText(account?.phone),
    checks,
    completedChecks: checks.filter(check => check.complete),
    nextChecks: checks.filter(check => !check.complete && !check.optional).slice(0, 4),

  }
}

export function mergeQuizAnswer(project, quizSlug, payload) {
  return {
    ...(project || DEFAULT_PROJECT),
    quizAnswers: {
      ...((project || DEFAULT_PROJECT).quizAnswers || {}),
      [quizSlug]: {
        ...payload,
        completedAt: new Date().toISOString(),
      },
    },
  }
}

export function isMeaningfulProject(project, media = []) {
  if (!project) return false

  if (project.title && !project.title.startsWith('Проект: Слой')) return true
  if (project.ideaDescription && !project.ideaDescription.includes('Начален резултат от Totsan quiz:')) return true
  if (project.propertyType || project.areaSqm || project.roomsCount || project.budgetMin || project.budgetMax || project.addressCity || project.addressRegion || project.desiredStartDate || project.desiredEndDate) return true
  if (hasProjectLocationAccess(project)) return true
  if (media && media.length > 0) return true
  
  const quizAnswers = project.quizAnswers || {}
  const quizKeys = Object.keys(quizAnswers)
  if (quizKeys.some(key => key !== 'start')) return true
  
  return false
}

export async function deactivateClientProject(projectId, userId) {
  if (!projectId || !userId) return
  const { error } = await supabase.from('client_projects').update({ is_active: false }).eq('id', projectId).eq('user_id', userId)
  if (error) throw error
}
