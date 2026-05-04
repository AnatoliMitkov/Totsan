import { supabase } from './supabase.js'

export const ORDER_STATUS_LABELS = {
  pending_payment: 'Очаква плащане',
  paid: 'Платена',
  in_progress: 'В работа',
  delivered: 'Предадена',
  completed: 'Завършена',
  disputed: 'Спор',
  refunded: 'Възстановена',
  cancelled: 'Отменена',
}

export const ORDER_ACTION_LABELS = {
  start_work: 'Започни работа',
  mark_delivered: 'Маркирай като предадена',
  confirm_completed: 'Потвърди завършване',
  request_revision: 'Поискай корекция',
  cancel_pending: 'Отмени',
}

export function formatOrderMoney(amount, currency = 'EUR') {
  return new Intl.NumberFormat('bg-BG', { style: 'currency', currency }).format(Number(amount || 0))
}

export function formatOrderDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('bg-BG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function orderStatusTone(status) {
  if (['paid', 'in_progress'].includes(status)) return 'bg-blue-50 text-blue-700'
  if (status === 'delivered') return 'bg-amber-50 text-amber-700'
  if (status === 'completed') return 'bg-green-50 text-green-700'
  if (['disputed', 'refunded', 'cancelled'].includes(status)) return 'bg-red-50 text-red-700'
  return 'bg-soft text-muted'
}

function jsonArray(value) {
  return Array.isArray(value) ? value : []
}

export function normalizeOrder(row = {}) {
  return {
    id: row.id || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    clientId: row.client_id || '',
    partnerId: row.partner_id || '',
    conversationId: row.conversation_id || '',
    serviceId: row.service_id || '',
    servicePackageId: row.service_package_id || '',
    offerId: row.offer_id || '',
    title: row.title || 'Поръчка',
    description: row.description || '',
    deliverables: jsonArray(row.deliverables),
    amountTotal: row.amount_total || 0,
    platformFee: row.platform_fee || 0,
    partnerPayout: row.partner_payout || 0,
    currency: row.currency || 'EUR',
    paymentProvider: row.payment_provider || 'stripe',
    status: row.status || 'pending_payment',
    deliveryDueAt: row.delivery_due_at || '',
    deliveredAt: row.delivered_at || '',
    completedAt: row.completed_at || '',
    stripeCheckoutSessionId: row.stripe_checkout_session_id || '',
    stripePaymentIntentId: row.stripe_payment_intent_id || '',
    stripeTransferId: row.stripe_transfer_id || '',
  }
}

export function normalizeOrderEvent(row = {}) {
  return {
    id: row.id || '',
    orderId: row.order_id || '',
    actorId: row.actor_id || '',
    type: row.type || '',
    fromStatus: row.from_status || '',
    toStatus: row.to_status || '',
    message: row.message || '',
    payload: row.payload || {},
    createdAt: row.created_at || '',
  }
}

export function normalizePayment(row = {}) {
  return {
    id: row.id || '',
    orderId: row.order_id || '',
    type: row.type || '',
    provider: row.provider || 'stripe',
    amount: row.amount || 0,
    currency: row.currency || 'EUR',
    status: row.status || 'pending',
    raw: row.raw || {},
    createdAt: row.created_at || '',
  }
}

export async function loadCheckoutPreview(type, id) {
  if (type === 'service') {
    const { data, error } = await supabase
      .from('partner_service_packages')
      .select('*, service:partner_services(id, slug, title, subtitle, description_md, partner_id, moderation_status, is_published, profile:profiles(id, name, slug, image_url, image_zoom, image_x, image_y))')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!data || !data.service) return null
    return {
      type,
      id: data.id,
      title: `${data.service.title} · ${data.title}`,
      subtitle: data.description || data.service.subtitle || '',
      description: data.service.description_md || '',
      deliverables: jsonArray(data.features),
      amountTotal: data.price_amount || 0,
      currency: data.currency || 'EUR',
      deliveryDays: data.delivery_days || '',
      revisions: data.revisions ?? '',
      service: data.service,
      partner: data.service.profile,
      isAvailable: data.service.is_published && data.service.moderation_status === 'approved' && data.is_active !== false,
    }
  }

  if (type === 'offer') {
    const { data, error } = await supabase.from('offers').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      type,
      id: data.id,
      title: data.title,
      subtitle: data.description || '',
      description: data.description || '',
      deliverables: jsonArray(data.deliverables),
      amountTotal: data.price_amount || 0,
      currency: data.currency || 'EUR',
      deliveryDays: data.delivery_days || '',
      revisions: data.revisions ?? '',
      offer: data,
      isAvailable: ['sent', 'accepted'].includes(data.status),
    }
  }

  return null
}

async function loadOrdersBy(column, value) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq(column, value)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(normalizeOrder)
}

export async function loadClientOrders(userId) {
  if (!userId) return []
  return loadOrdersBy('client_id', userId)
}

export async function loadPartnerOrders(userId) {
  if (!userId) return []
  return loadOrdersBy('partner_id', userId)
}

export async function loadOrderDetails(orderId) {
  const [{ data: order, error: orderError }, { data: events, error: eventsError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase.from('orders').select('*').eq('id', orderId).maybeSingle(),
    supabase.from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
    supabase.from('payment_transactions').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
  ])
  if (orderError) throw orderError
  if (eventsError) throw eventsError
  if (paymentsError) throw paymentsError
  return {
    order: order ? normalizeOrder(order) : null,
    events: (events || []).map(normalizeOrderEvent),
    payments: (payments || []).map(normalizePayment),
  }
}