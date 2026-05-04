import { supabase } from './supabase.js'
import { uploadProjectMedia } from './project-media-upload-client.js'

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

function cleanText(value) {
  const next = String(value ?? '').trim()
  return next || null
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const next = Number(value)
  return Number.isFinite(next) ? next : null
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

export async function loadActiveClientProject(userId) {
  if (!userId) return { project: null, media: [] }

  const { data: projectRow, error: projectError } = await supabase
    .from('client_projects')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (projectError && projectError.code !== 'PGRST116') throw projectError
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

function hasText(value) {
  return String(value || '').trim().length > 0
}

function hasQuizAnswers(project) {
  const answers = project?.quizAnswers || {}
  return Object.keys(answers).length > 0
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