import { supabase } from './supabase.js'
import { uploadProjectMedia } from './project-media-upload-client.js'
import { formatMoneyRange } from './money.js'

export const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Апартамент' },
  { value: 'house', label: 'Къща' },
  { value: 'office', label: 'Офис' },
  { value: 'commercial', label: 'Търговски обект' },
  { value: 'outdoor', label: 'Външна зона' },
  { value: 'other', label: 'Друго' },
]

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
    title: row.title || '',
    propertyType: row.property_type || '',
    areaSqm: row.area_sqm ?? '',
    roomsCount: row.rooms_count ?? '',
    addressCity: row.address_city || '',
    addressRegion: row.address_region || '',
    currentLayerSlug: row.current_layer_slug || 'ideya',
    desiredStartDate: row.desired_start_date || '',
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
    orderIndex: row.order_index ?? 0,
    createdAt: row.created_at || '',
  }
}

function projectToDb(project, userId) {
  return {
    user_id: userId,
    title: cleanText(project.title),
    property_type: cleanText(project.propertyType),
    area_sqm: numberOrNull(project.areaSqm),
    rooms_count: numberOrNull(project.roomsCount),
    address_city: cleanText(project.addressCity),
    address_region: cleanText(project.addressRegion),
    current_layer_slug: cleanText(project.currentLayerSlug),
    desired_start_date: cleanText(project.desiredStartDate),
    budget_min: numberOrNull(project.budgetMin),
    budget_max: numberOrNull(project.budgetMax),
    budget_currency: cleanText(project.budgetCurrency) || 'EUR',
    idea_description: cleanText(project.ideaDescription),
    quiz_answers: project.quizAnswers && typeof project.quizAnswers === 'object' ? project.quizAnswers : {},
    is_active: project.isActive !== false,
  }
}

async function withSignedMediaUrls(rows = []) {
  return Promise.all(rows.map(async (row) => {
    if (row.public_url || !row.path) return normalizeProjectMedia(row)

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
  const { data, error } = await supabase.rpc('update_own_account_profile', {
    p_full_name: values.fullName || values.displayName || '',
    p_display_name: values.displayName || values.fullName || '',
    p_phone: values.phone || '',
    p_avatar_url: values.avatarUrl || '',
    p_city: values.city || '',
    p_country: values.country || 'BG',
    p_bio: values.bio || '',
    p_locale: values.locale || 'bg',
    p_marketing_opt_in: Boolean(values.marketingOptIn),
    p_interests: Array.isArray(values.interests) ? values.interests : [],
    p_style_preferences: Array.isArray(values.stylePreferences) ? values.stylePreferences : [],
    p_preferred_contact_method: values.preferredContactMethod || '',
    p_age_group: values.ageGroup || '',
    p_gender: values.gender || '',
  })

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
      public_url: upload.publicUrl || null,
      kind,
      caption: cleanText(caption),
      order_index: orderIndex,
    })
    .select('*')
    .single()

  if (error) throw error
  return normalizeProjectMedia({ ...data, signed_url: upload.signedUrl || '' })
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
  const checks = [
    { key: 'avatar', label: 'Аватар', weight: 5, complete: hasText(account?.avatar_url) },
    { key: 'name', label: 'Име', weight: 5, complete: hasText(name) },
    { key: 'phone', label: 'Телефон', weight: 10, complete: hasText(account?.phone) },
    { key: 'city', label: 'Град', weight: 5, complete: hasText(account?.city) },
    { key: 'bio', label: 'Кратко био', weight: 5, complete: hasText(account?.bio) },
    { key: 'project-title', label: 'Заглавие на проекта', weight: 5, complete: hasText(project?.title) },
    { key: 'property-type', label: 'Тип помещение', weight: 5, complete: hasText(project?.propertyType) },
    { key: 'area', label: 'Квадратура', weight: 5, complete: Number(project?.areaSqm) > 0 },
    { key: 'budget', label: 'Бюджет', weight: 5, complete: Number(project?.budgetMin) > 0 || Number(project?.budgetMax) > 0 },
    { key: 'idea', label: 'Идея над 80 знака', weight: 10, complete: String(project?.ideaDescription || '').trim().length >= 80 },
    { key: 'layer', label: 'Текущ слой', weight: 5, complete: hasText(project?.currentLayerSlug) },
    { key: 'media', label: 'Поне 3 снимки/плана', weight: 15, complete: media.length >= 3 },
    { key: 'quiz', label: 'Попълнен quiz', weight: 15, complete: hasQuizAnswers(project) },
    { key: 'address', label: 'Локация на проекта', weight: 5, complete: hasText(project?.addressCity) || hasText(project?.addressRegion) },
  ]

  const earned = checks.reduce((total, check) => total + (check.complete ? check.weight : 0), 0)
  const total = checks.reduce((sum, check) => sum + check.weight, 0)
  const percent = Math.min(100, Math.round((earned / total) * 100))

  return {
    percent,
    earned,
    total,
    checks,
    completedChecks: checks.filter(check => check.complete),
    nextChecks: checks.filter(check => !check.complete).slice(0, 4),

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
  if (project.propertyType || project.areaSqm || project.roomsCount || project.budgetMin || project.budgetMax || project.addressCity || project.addressRegion || project.desiredStartDate) return true
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
