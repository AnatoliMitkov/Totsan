import { supabase } from './supabase.js'

export const REVIEW_STATUS_LABELS = {
  visible: 'Видим',
  hidden: 'Скрит',
}

export const REVIEW_REPORT_STATUS_LABELS = {
  open: 'Отворен',
  resolved: 'Решен',
}

export const REVIEW_COLUMNS = `
  id,
  order_id,
  client_id,
  partner_id,
  service_id,
  rating_overall,
  rating_communication,
  rating_quality,
  rating_value,
  body,
  partner_reply,
  partner_reply_at,
  moderation_status,
  created_at,
  updated_at
`

export const REVIEW_REPORT_COLUMNS = `
  id,
  review_id,
  reporter_id,
  reason,
  status,
  resolution_note,
  resolved_at,
  created_at
`

function cleanText(value) {
  const next = String(value ?? '').trim()
  return next || null
}

function rating(value) {
  const next = Number(value)
  if (!Number.isFinite(next)) return 5
  return Math.max(1, Math.min(5, Math.round(next)))
}

export function normalizeReview(row = {}) {
  return {
    id: row.id || '',
    orderId: row.orderId || row.order_id || '',
    clientId: row.clientId || row.client_id || '',
    partnerId: row.partnerId || row.partner_id || '',
    serviceId: row.serviceId || row.service_id || '',
    ratingOverall: rating(row.ratingOverall ?? row.rating_overall),
    ratingCommunication: rating(row.ratingCommunication ?? row.rating_communication),
    ratingQuality: rating(row.ratingQuality ?? row.rating_quality),
    ratingValue: rating(row.ratingValue ?? row.rating_value),
    body: row.body || '',
    partnerReply: row.partnerReply || row.partner_reply || '',
    partnerReplyAt: row.partnerReplyAt || row.partner_reply_at || '',
    moderationStatus: row.moderationStatus || row.moderation_status || 'visible',
    createdAt: row.createdAt || row.created_at || '',
    updatedAt: row.updatedAt || row.updated_at || '',
  }
}

export function normalizeReviewReport(row = {}) {
  return {
    id: row.id || '',
    reviewId: row.reviewId || row.review_id || '',
    reporterId: row.reporterId || row.reporter_id || '',
    reason: row.reason || '',
    status: row.status || 'open',
    resolutionNote: row.resolutionNote || row.resolution_note || '',
    resolvedAt: row.resolvedAt || row.resolved_at || '',
    createdAt: row.createdAt || row.created_at || '',
  }
}

export function formatReviewDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('bg-BG', { dateStyle: 'medium' }).format(new Date(value))
}

export function reviewAverage(review) {
  if (!review) return 0
  return (review.ratingOverall + review.ratingCommunication + review.ratingQuality + review.ratingValue) / 4
}

export async function loadReviewsForPartner(partnerId) {
  if (!partnerId) return []
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_COLUMNS)
    .eq('partner_id', partnerId)
    .eq('moderation_status', 'visible')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(normalizeReview)
}

export async function loadReviewsForService(serviceId) {
  if (!serviceId) return []
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_COLUMNS)
    .eq('service_id', serviceId)
    .eq('moderation_status', 'visible')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(normalizeReview)
}

export async function loadOrderReview(orderId) {
  if (!orderId) return null
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_COLUMNS)
    .eq('order_id', orderId)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') throw error
  return data ? normalizeReview(data) : null
}

export async function submitReview(order, draft) {
  if (!order?.id) throw new Error('Липсва поръчка за отзив.')
  const payload = {
    order_id: order.id,
    client_id: order.clientId,
    partner_id: order.partnerId,
    service_id: order.serviceId || null,
    rating_overall: rating(draft.ratingOverall),
    rating_communication: rating(draft.ratingCommunication),
    rating_quality: rating(draft.ratingQuality),
    rating_value: rating(draft.ratingValue),
    body: cleanText(draft.body),
  }
  const { data, error } = await supabase.from('reviews').insert(payload).select(REVIEW_COLUMNS).single()
  if (error) {
    if (error.code === '23505') throw new Error('Вече има отзив за тази поръчка.')
    throw error
  }
  return normalizeReview(data)
}

export async function replyToReview(reviewId, reply) {
  const text = cleanText(reply)
  if (!reviewId || !text) throw new Error('Напиши кратък отговор.')
  const { data, error } = await supabase
    .from('reviews')
    .update({ partner_reply: text, partner_reply_at: new Date().toISOString() })
    .eq('id', reviewId)
    .select(REVIEW_COLUMNS)
    .single()
  if (error) throw error
  return normalizeReview(data)
}

export async function reportReview(reviewId, reporterId, reason) {
  const text = cleanText(reason)
  if (!reviewId || !reporterId || !text) throw new Error('Добави причина за сигнала.')
  const { data, error } = await supabase
    .from('review_reports')
    .insert({ review_id: reviewId, reporter_id: reporterId, reason: text })
    .select(REVIEW_REPORT_COLUMNS)
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('Вече си изпратил сигнал за този отзив.')
    throw error
  }
  return normalizeReviewReport(data)
}

export async function loadAdminReviews() {
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(normalizeReview)
}

export async function loadAdminReviewReports() {
  const { data, error } = await supabase
    .from('review_reports')
    .select(REVIEW_REPORT_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(normalizeReviewReport)
}

export async function updateReviewModeration(reviewId, moderationStatus) {
  const { data, error } = await supabase
    .from('reviews')
    .update({ moderation_status: moderationStatus })
    .eq('id', reviewId)
    .select(REVIEW_COLUMNS)
    .single()
  if (error) throw error
  return normalizeReview(data)
}

export async function resolveReviewReport(reportId, resolutionNote = '') {
  const { data, error } = await supabase
    .from('review_reports')
    .update({ status: 'resolved', resolution_note: cleanText(resolutionNote), resolved_at: new Date().toISOString() })
    .eq('id', reportId)
    .select(REVIEW_REPORT_COLUMNS)
    .single()
  if (error) throw error
  return normalizeReviewReport(data)
}