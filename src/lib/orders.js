import { supabase } from './supabase.js'
import { formatEurWithBgn, formatMoney } from './money.js'
import { normalizeAcceptedOffer } from './offers.js'

export const ORDER_STATUS_LABELS = {
  pending_payment: 'Очаква плащане',
  paid: 'Платено',
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
    profilePath: row.profile_path || '',
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
    hasAmount: row.amount_total !== null && row.amount_total !== undefined,
    platformFee: row.platform_fee || 0,
    partnerPayout: row.partner_payout || 0,
    currency: row.currency || 'EUR',
    paymentProvider: row.payment_provider || 'stripe',
    paymentMethod: row.payment_method || 'platform',
    acceptedOfferSnapshot: row.accepted_offer_snapshot || null,
    status: row.status || 'pending_payment',
    deliveryDueAt: row.delivery_due_at || '',
    deliveredAt: row.delivered_at || '',
    completedAt: row.completed_at || '',
    stripeCheckoutSessionId: row.stripe_checkout_session_id || '',
    stripePaymentIntentId: row.stripe_payment_intent_id || '',
    stripeTransferId: row.stripe_transfer_id || '',
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
    provider: row.provider || 'stripe',
    amount: row.amount || 0,
    currency: row.currency || 'EUR',
    status: row.status || 'pending',
    raw: row.raw || {},
    createdAt: row.created_at || '',
  }
}

export function normalizeOrderMilestone(row = {}) {
  return {
    id: row.id || '',
    orderId: row.order_id || '',
    milestoneId: row.milestone_id || '',
    offerId: row.offer_id || '',
    position: Number(row.position || 0),
    title: row.title || '',
    description: row.description || '',
    amount: Number(row.amount || 0),
    currency: row.currency || 'EUR',
    durationDays: Number(row.duration_days || 0),
    startCondition: row.start_condition || '',
    paymentNote: row.payment_note || '',
    status: row.status || 'pending',
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    startedAt: row.started_at || '',
    submittedAt: row.submitted_at || '',
    acceptedAt: row.accepted_at || '',
    paidAt: row.paid_at || '',
    dueAt: row.due_at || '',
    stripeCheckoutSessionId: row.stripe_checkout_session_id || '',
    stripePaymentIntentId: row.stripe_payment_intent_id || '',
    stripeTransferId: row.stripe_transfer_id || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  }
}

export async function loadCheckoutPreview(type, id) {
  if (type === 'milestone') {
    const { data: milestone, error } = await supabase.from('order_milestones').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (!milestone) return null
    const { data: order, error: orderError } = await supabase.from('orders').select('*').eq('id', milestone.order_id).maybeSingle()
    if (orderError) throw orderError
    if (!order) return null
    return {
      type,
      id: milestone.id,
      title: `${order.title} · ${milestone.title}`,
      subtitle: milestone.description || '',
      description: milestone.payment_note || '',
      deliverables: milestone.description ? [milestone.description] : [],
      amountTotal: milestone.amount || 0,
      currency: milestone.currency || order.currency || 'EUR',
      deliveryDays: milestone.duration_days || '',
      revisions: '',
      milestone: normalizeOrderMilestone(milestone),
      order: normalizeOrder(order),
      isAvailable: ['ready', 'payment_pending'].includes(milestone.status),
    }
  }

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
    const normalizedOffer = normalizeAcceptedOffer(data)
    return {
      type,
      id: data.id,
      title: normalizedOffer.title,
      subtitle: normalizedOffer.summary,
      description: normalizedOffer.description,
      deliverables: normalizedOffer.includedItems,
      amountTotal: normalizedOffer.priceAmount,
      currency: normalizedOffer.currency,
      deliveryDays: normalizedOffer.timeline.days,
      revisions: data.revisions ?? '',
      offer: data,
      normalizedOffer,
      isAvailable: data.status === 'accepted' && Boolean(data.accepted_at),
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

export async function loadMyOrdersWorkspace(userId, role = 'client') {
  const orders = role === 'partner'
    ? await loadPartnerOrders(userId)
    : await loadClientOrders(userId)
  const orderIds = orders.map((order) => order.id).filter(Boolean)
  if (orderIds.length === 0) return { orders, milestonesByOrder: new Map() }

  const { data, error } = await supabase
    .from('order_milestones')
    .select('*')
    .in('order_id', orderIds)
    .order('position', { ascending: true })

  if (error && !isMissingMilestonesTableError(error)) throw error
  const milestonesByOrder = new Map()
  const normalizedMilestones = (data || []).map(normalizeOrderMilestone)
  normalizedMilestones.forEach((milestone) => {
    const current = milestonesByOrder.get(milestone.orderId) || []
    current.push(milestone)
    milestonesByOrder.set(milestone.orderId, current)
  })

  return { orders, milestonesByOrder }
}

export async function loadOrderDetails(orderId) {
  const [{ data: order, error: orderError }, { data: events, error: eventsError }, { data: payments, error: paymentsError }, { data: milestones, error: milestonesError }] = await Promise.all([
    supabase.from('orders').select('*').eq('id', orderId).maybeSingle(),
    supabase.from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
    supabase.from('payment_transactions').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
    supabase.from('order_milestones').select('*').eq('order_id', orderId).order('position', { ascending: true }),
  ])
  if (orderError) throw orderError
  if (eventsError) throw eventsError
  if (paymentsError) throw paymentsError
  if (milestonesError && !isMissingMilestonesTableError(milestonesError)) throw milestonesError

  let orderWithParties = order || null
  if (orderWithParties) {
    const partyIds = [...new Set([orderWithParties.client_id, orderWithParties.partner_id].filter(Boolean))]
    if (partyIds.length > 0) {
      const [{ data: accounts }, { data: participants, error: participantsError }] = await Promise.all([
        supabase
          .from('accounts')
          .select('id, email, full_name, display_name')
          .in('id', partyIds),
        supabase.rpc('get_chat_participant_profiles', { p_user_ids: partyIds }),
      ])

      if (participantsError && !isMissingChatParticipantProfilesFunction(participantsError)) throw participantsError

      const accountMap = new Map((accounts || []).map((row) => [row.id, row]))
      const participantMap = new Map((participants || []).map((row) => [row.user_id || row.id, row]))

      // Partner profile details live in profiles, while the protected RPC provides
      // participant names when account RLS intentionally hides the other party.
      let partnerProfile = null
      if (orderWithParties.partner_id) {
        const { data } = await supabase
          .from('profiles')
          .select('name, slug, is_published')
          .eq('user_id', orderWithParties.partner_id)
          .maybeSingle()
        partnerProfile = data || null
      }

      const rawClientAccount = accountMap.get(orderWithParties.client_id) || null
      const rawPartnerAccount = accountMap.get(orderWithParties.partner_id) || null
      const clientParticipant = participantMap.get(orderWithParties.client_id) || null
      const partnerParticipant = participantMap.get(orderWithParties.partner_id) || null
      const participantName = (participant) => participant?.full_name || participant?.display_name || ''
      const clientName = participantName(clientParticipant) || rawClientAccount?.full_name || rawClientAccount?.display_name || ''
      const partnerName = partnerProfile?.name || participantName(partnerParticipant) || rawPartnerAccount?.full_name || rawPartnerAccount?.display_name || ''
      const enrichedClientAccount = (rawClientAccount || clientName)
        ? { ...(rawClientAccount || {}), id: orderWithParties.client_id, full_name: clientName, display_name: rawClientAccount?.display_name || '' }
        : null
      const partnerProfilePath = partnerProfile?.is_published && partnerProfile?.slug ? `/profil/${partnerProfile.slug}` : ''
      const enrichedPartnerAccount = rawPartnerAccount
        ? { ...rawPartnerAccount, full_name: partnerName, profile_path: partnerProfilePath }
        : partnerName
          ? { id: orderWithParties.partner_id, full_name: partnerName, display_name: '', email: '', profile_path: partnerProfilePath }
          : null

      orderWithParties = {
        ...orderWithParties,
        client_account: enrichedClientAccount,
        partner_account: enrichedPartnerAccount,
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
    milestones: (milestones || []).map(normalizeOrderMilestone),
    projectLocation,
  }
}

function isMissingMilestonesTableError(error) {
  const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  return text.includes('order_milestones') && (
    text.includes('does not exist')
    || text.includes('schema cache')
    || text.includes('42p01')
    || text.includes('pgrst')
  )
}

function isMissingChatParticipantProfilesFunction(error) {
  const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  return text.includes('get_chat_participant_profiles') && (
    text.includes('does not exist')
    || text.includes('could not find')
    || text.includes('schema cache')
  )
}
