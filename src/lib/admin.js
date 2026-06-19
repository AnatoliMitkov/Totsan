import { supabase } from './supabase.js'

export const ADMIN_PAGE_SIZE = 10

export const ADMIN_INPUT_CLASS = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'
export const ADMIN_SELECT_CLASS = 'rounded-full border border-line bg-paper px-3 py-2 text-sm outline-none transition focus:border-ink'

export const INQUIRY_STATUS_LABELS = {
  new: 'Ново',
  seen: 'Прегледано',
  replied: 'Отговорено',
  closed: 'Затворено',
}

export const APPLICATION_STATUS_LABELS = {
  pending: 'Чака',
  approved: 'Одобрена',
  rejected: 'Отхвърлена',
}

export const ACCOUNT_ROLE_LABELS = {
  user: 'Клиент',
  specialist: 'Специалист',
  admin: 'Админ',
}

export const SPECIALIST_STATUS_LABELS = {
  pending: 'Чака',
  approved: 'Одобрен',
  rejected: 'Отхвърлен',
}

export const ACCOUNT_STATUS_LABELS = {
  active: 'Активен',
  banned: 'Блокиран',
}

export const MATERIAL_MODERATION_STATUS_LABELS = {
  pending: 'Чака',
  approved: 'Одобрен',
  rejected: 'Отхвърлен',
  hidden: 'Скрит',
}

export function formatAdminDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('bg-BG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function contactHref(contact = '') {
  return contact.includes('@') ? `mailto:${contact}` : `tel:${contact.replace(/\s/g, '')}`
}

export function normalizeSearch(value = '') {
  return String(value).trim().toLowerCase()
}

export function matchesSearch(row, query, keys) {
  const needle = normalizeSearch(query)
  if (!needle) return true
  return keys.some((key) => normalizeSearch(row?.[key]).includes(needle))
}

export function paginateRows(rows, page, pageSize = ADMIN_PAGE_SIZE) {
  const safePage = Math.max(1, Number(page) || 1)
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(safePage, totalPages)
  const start = (currentPage - 1) * pageSize
  return {
    rows: rows.slice(start, start + pageSize),
    currentPage,
    totalPages,
  }
}

function requireData(result, fallback) {
  if (result.error) throw result.error
  return result.data ?? fallback
}

export async function loadAdminDashboard() {
  const result = await supabase.from('vw_admin_dashboard').select('*').maybeSingle()
  return requireData(result, {})
}

export async function loadInquiries() {
  const result = await supabase.from('inquiries').select('*').order('created_at', { ascending: false })
  return requireData(result, [])
}

export async function loadPartnerApplications() {
  const result = await supabase.from('partner_applications').select('*').order('created_at', { ascending: false })
  return requireData(result, [])
}

export async function loadAccounts() {
  const result = await supabase
    .from('accounts')
    .select('id, email, full_name, display_name, role, specialist_status, account_status, phone, city, country, bio, created_at, updated_at, last_admin_action_at, admin_note')
    .order('created_at', { ascending: false })
  return requireData(result, [])
}

export async function loadAuditLog() {
  const result = await supabase
    .from('audit_log')
    .select('id, actor_id, action, entity_type, entity_id, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  return requireData(result, [])
}

export async function loadAdminOrders() {
  const result = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
  return requireData(result, [])
}

export async function invokeAdminAction(action, payload = {}) {
  const { data, error, response } = await supabase.functions.invoke('admin-action', {
    body: { action, payload },
  })

  if (error) throw new Error(await getAdminActionErrorMessage(error, response))
  if (data?.error) throw new Error(data.error)
  return data
}

async function getAdminActionErrorMessage(error, response) {
  const fallback = error?.message || 'Admin action failed.'
  const errorResponse = response || error?.context

  if (!errorResponse || typeof errorResponse.clone !== 'function') return fallback

  try {
    const contentType = errorResponse.headers?.get?.('Content-Type') || ''
    const clonedResponse = errorResponse.clone()

    if (contentType.includes('application/json')) {
      const body = await clonedResponse.json()
      return body?.error || body?.message || fallback
    }

    const text = await clonedResponse.text()
    return text || fallback
  } catch {
    return fallback
  }
}

export function updateInquiryStatus(id, status) {
  return invokeAdminAction('update_inquiry_status', { id, status })
}

export function approveSpecialist(applicationId, decisionNote = '') {
  return invokeAdminAction('approve_specialist', { applicationId, decisionNote })
}

export function rejectSpecialist(applicationId, decisionNote = '') {
  return invokeAdminAction('reject_specialist', { applicationId, decisionNote })
}

export function updateAccount(id, updates) {
  return invokeAdminAction('update_account', { id, updates })
}

export function updateProfile(id, updates) {
  return invokeAdminAction('update_profile', { id, updates })
}

export function deleteProfile(id) {
  return invokeAdminAction('delete_profile', { id })
}

export function sendUserRecoveryEmail(id) {
  return invokeAdminAction('send_user_recovery_email', { id })
}

export function approvePartnerService(serviceId, moderationNote = '') {
  return invokeAdminAction('approve_partner_service', { serviceId, moderationNote })
}

export function rejectPartnerService(serviceId, moderationNote = '') {
  return invokeAdminAction('reject_partner_service', { serviceId, moderationNote })
}

export async function loadAdminMaterialCapabilities() {
  const result = await supabase
    .from('partner_material_capabilities')
    .select(`
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
      reviewed_at,
      profile:profiles(id, slug, name, tag, city, image_url, image_zoom, image_x, image_y, is_published, user_id)
    `)
    .order('created_at', { ascending: false })

  return requireData(result, [])
}

export function updateMaterialCapabilityModeration(capabilityId, moderationStatus, moderationNote = '') {
  return invokeAdminAction('update_material_capability_moderation', { capabilityId, moderationStatus, moderationNote })
}

export function adminUpdateOrderStatus(orderId, status, note = '') {
  return invokeAdminAction('update_order_status', { orderId, status, note })
}
