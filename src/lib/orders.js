import { supabase } from './supabase.js'
import { formatEurWithBgn, formatMoney } from './money.js'

export const ORDER_STATUS_LABELS = {
  pending_payment: 'Очаква директно плащане',
  paid: 'Платено директно',
  in_progress: 'В работа',
  delivered: 'Предадена',
  completed: 'Завършена',
  disputed: 'Спор',
  refunded: 'Възстановена',
  cancelled: 'Отменена',
}

export const ORDER_ACTION_LABELS = {
  confirm_direct_payment: 'Потвърди получено плащане',
  start_work: 'Започни работа',
  mark_delivered: 'Маркирай като предадена',
  confirm_completed: 'Потвърди завършване',
  request_revision: 'Поискай корекция',
  cancel_pending: 'Отмени',
}

export function formatOrderMoney(amount, currency = 'EUR') {
  return String(currency).toUpperCase() === 'EUR'
    ? formatEurWithBgn(amount)
    : formatMoney(amount, currency)
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

function normalizeAccountParty(row = {}) {
  return {
    id: row.id || '',
    name: row.full_name || row.display_name || '',
    email: row.email || '',
  }
}

function normalizeOrderProjectLocation(row = {}) {
  if (!row || typeof row !== 'object') return null
  return {
    projectId: row.projectId || row.project_id || '',
    canViewExact: Boolean(row.canViewExact ?? row.can_view_exact),
    city: row.city || '',
    district: row.district || '',
    objectType: row.objectType || row.object_type || '',
    access: row.access && typeof row.access === 'object' ? row.access : {},
    exact: row.exact && typeof row.exact === 'object' ? row.exact : null,
  }
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
    currency: row.currency || 'EUR',
    status: row.status || 'pending_payment',
    deliveryDueAt: row.delivery_due_at || '',
    deliveredAt: row.delivered_at || '',
    completedAt: row.completed_at || '',
    clientAccount: normalizeAccountParty(row.client_account || {}),
    partnerAccount: normalizeAccountParty(row.partner_account || {}),
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
    amount: row.amount || 0,
    currency: row.currency || 'EUR',
    status: row.status || 'pending',
    raw: row.raw || {},
    createdAt: row.created_at || '',
  }
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

  let orderWithParties = order || null
  if (orderWithParties) {
    const partyIds = [...new Set([orderWithParties.client_id, orderWithParties.partner_id].filter(Boolean))]
    if (partyIds.length > 0) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, email, full_name, display_name')
        .in('id', partyIds)

      if (Array.isArray(accounts)) {
        const accountMap = new Map(accounts.map((row) => [row.id, row]))
        orderWithParties = {
          ...orderWithParties,
          client_account: accountMap.get(orderWithParties.client_id) || null,
          partner_account: accountMap.get(orderWithParties.partner_id) || null,
        }
      }
    }
  }

  let projectLocation = null
  if (orderWithParties?.id) {
    const { data: locationData, error: locationError } = await supabase.rpc('get_order_project_location', { p_order_id: orderWithParties.id })
    if (!locationError) {
      projectLocation = normalizeOrderProjectLocation(locationData)
    } else if (!String(locationError.message || '').includes('get_order_project_location')) {
      throw locationError
    }
  }

  return {
    order: orderWithParties ? normalizeOrder(orderWithParties) : null,
    events: (events || []).map(normalizeOrderEvent),
    payments: (payments || []).map(normalizePayment),
    projectLocation,
  }
}
