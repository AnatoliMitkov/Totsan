import { createClient } from 'npm:@supabase/supabase-js@2.49.8'

const CHECKOUT_TYPES = new Set(['service', 'offer', 'milestone'])
const ORDER_ACTIONS = new Set(['confirm_direct_payment', 'start_work', 'mark_delivered', 'confirm_completed', 'request_revision', 'cancel_pending'])
const MILESTONE_ACTIONS = new Set(['start', 'submit', 'accept', 'request_revision', 'dispute'])
const ZERO_DECIMAL_CURRENCIES = new Set(['BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF'])
const PLATFORM_FEE_RATE = 0.02

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Edge functions use tables added by migrations that are not represented by a
// generated Database type in this repository.
type SupabaseAdmin = any

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function assertUuid(value: unknown, label: string) {
  const text = String(value || '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`${label} is invalid.`)
  }
  return text
}

function decodeJwtPayload(token: string) {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=')
    return JSON.parse(atob(padded)) as { sub?: string; email?: string }
  } catch {
    return null
  }
}

function cleanText(value: unknown, fallback: unknown = '') {
  return String(value ?? '').trim() || String(fallback ?? '').trim()
}

function asArray(value: unknown) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean)
  if (typeof value === 'string') return value.split('\n').map(item => item.trim()).filter(Boolean)
  return []
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

function moneyAmount(value: unknown) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Сумата трябва да е по-голяма от 0.')
  return Math.round(amount)
}

function currencyCode(value: unknown) {
  return cleanText(value, 'EUR').toUpperCase().slice(0, 3) || 'EUR'
}

function toStripeAmount(amount: number, currency: string) {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? amount : amount * 100
}

function computeFees(amount: number) {
  const platformFee = Math.max(0, Math.round(amount * PLATFORM_FEE_RATE))
  return { platformFee, partnerPayout: Math.max(0, amount - platformFee) }
}

function dueDate(days: unknown) {
  const count = Number(days || 0)
  if (!Number.isFinite(count) || count <= 0) return null
  return new Date(Date.now() + Math.round(count) * 24 * 60 * 60 * 1000).toISOString()
}

function siteOrigin(req: Request, payload: Record<string, unknown>) {
  const fromPayload = cleanText(payload.origin)
  const fromHeader = cleanText(req.headers.get('Origin'))
  const fromEnv = cleanText(Deno.env.get('SITE_URL'))
  return (fromPayload || fromHeader || fromEnv || 'https://totsan.com').replace(/\/$/, '')
}

function requestedPaymentProvider(value: unknown): 'mock' | 'stripe' {
  const requested = cleanText(value).toLowerCase()
  if (requested === 'mock' || requested === 'stripe') return requested
  const configured = cleanText(Deno.env.get('PAYMENTS_PROVIDER') || Deno.env.get('PAYMENTS_MODE'), 'mock').toLowerCase()
  return configured === 'stripe' ? 'stripe' : 'mock'
}

async function getUser(req: Request, authorization: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Missing Supabase auth environment variables.')
  const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authorization } } })
  const { data } = await userClient.auth.getUser()
  const token = authorization.replace(/^Bearer\s+/i, '')
  const claims = data?.user ? null : decodeJwtPayload(token)
  const user = data?.user || (claims?.sub ? { id: claims.sub, email: claims.email || null } : null)
  if (!user?.id) throw new Error('Authentication required.')
  return user
}

function adminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase service environment variables.')
  return createClient(supabaseUrl, serviceRoleKey)
}

async function loadServiceSource(admin: SupabaseAdmin, packageId: string, userId: string) {
  const { data: item, error } = await admin
    .from('partner_service_packages')
    .select('*, service:partner_services(*, profile:profiles(id, name, slug, user_id))')
    .eq('id', packageId)
    .maybeSingle()
  if (error) throw error
  if (!item) throw new Error('Офертата не беше намерена.')

  const service = item.service
  if (!service || service.moderation_status !== 'approved' || service.is_published !== true) {
    throw new Error('Услугата още не е активна за поръчки.')
  }
  if (service.partner_id === userId) throw new Error('Не можеш да поръчаш собствената си услуга.')
  if (item.is_active === false) throw new Error('Тази оферта не е активна.')

  const amount = moneyAmount(item.price_amount)
  const currency = currencyCode(item.currency)
  const fees = computeFees(amount)
  return {
    sourceType: 'service',
    sourceId: item.id,
    clientId: userId,
    partnerId: service.partner_id,
    conversationId: null,
    serviceId: service.id,
    servicePackageId: item.id,
    offerId: null,
    title: `${service.title} · ${item.title}`,
    description: cleanText(item.description, service.subtitle || service.description_md || ''),
    deliverables: asArray(item.features),
    amount,
    currency,
    deliveryDueAt: dueDate(item.delivery_days),
    ...fees,
    paymentMethod: 'platform',
  }
}

async function loadOfferSource(admin: SupabaseAdmin, offerId: string, userId: string) {
  const { data: offer, error } = await admin.from('offers').select('*').eq('id', offerId).maybeSingle()
  if (error) throw error
  if (!offer) throw new Error('Офертата не беше намерена.')
  if (offer.client_id !== userId) throw new Error('Само клиентът може да плати тази оферта.')
  if (offer.status !== 'accepted' || !offer.accepted_at) throw new Error('Офертата трябва първо да бъде приета.')

  const isAccepted = offer.status === 'accepted' && offer.accepted_at != null
  const acceptedSnapshot = asRecord(offer.accepted_offer_snapshot)
  const mutableDetails = asRecord(offer.offer_details)
  const nestedSnapshotDetails = asRecord(acceptedSnapshot.offerDetails)
  const snapshot = isAccepted && Object.keys(acceptedSnapshot).length > 0
    ? { ...nestedSnapshotDetails, ...acceptedSnapshot }
    : mutableDetails
  const timeline = asRecord(snapshot.timeline)
  const payment = asRecord(snapshot.payment)
  const amount = moneyAmount(snapshot.priceAmount ?? offer.price_amount)
  const currency = currencyCode(snapshot.currency ?? offer.currency)
  const fees = computeFees(amount)
  const deliverables = asArray(snapshot.includedItems ?? snapshot.deliverables ?? offer.deliverables)
  const paymentMethod = cleanText(payment.method, offer.offer_type === 'staged' ? 'staged_platform' : 'platform')

  return {
    sourceType: 'offer',
    sourceId: offer.id,
    clientId: userId,
    partnerId: offer.partner_id,
    conversationId: offer.conversation_id,
    serviceId: null,
    servicePackageId: null,
    offerId: offer.id,
    title: cleanText(snapshot.title, offer.title),
    description: cleanText(snapshot.description, cleanText(snapshot.summary, offer.description)),
    deliverables,
    amount,
    currency,
    deliveryDueAt: dueDate(timeline.days ?? snapshot.deliveryDays ?? offer.delivery_days),
    ...fees,
    isAccepted,
    snapshot,
    paymentMethod,
  }
}

async function loadMilestoneSource(admin: SupabaseAdmin, milestoneId: string, userId: string) {
  const { data: milestone, error } = await admin.from('order_milestones').select('*').eq('id', milestoneId).maybeSingle()
  if (error) throw error
  if (!milestone) throw new Error('Етапът не беше намерен.')

  const { data: order, error: orderError } = await admin.from('orders').select('*').eq('id', milestone.order_id).maybeSingle()
  if (orderError) throw orderError
  if (!order || order.client_id !== userId) throw new Error('Само клиентът може да плати този етап.')
  if (order.payment_method !== 'staged_platform') throw new Error('Поръчката не използва плащане по етапи.')
  if (!['ready', 'payment_pending'].includes(milestone.status)) throw new Error('Този етап не е готов за плащане.')

  return { order, milestone }
}

async function findPendingOrder(admin: SupabaseAdmin, source: Record<string, unknown>) {
  let query = admin.from('orders').select('*').eq('client_id', source.clientId).eq('status', 'pending_payment').limit(1)
  query = source.sourceType === 'offer'
    ? query.eq('offer_id', source.offerId)
    : query.eq('service_package_id', source.servicePackageId)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data || null
}

async function createOrUpdateOrder(admin: SupabaseAdmin, source: Record<string, unknown>, provider: 'stripe' | 'mock') {
  const isAccepted = Boolean(source.isAccepted)
  const snapshot = asRecord(source.snapshot)

  const payload: Record<string, unknown> = {
    client_id: source.clientId,
    partner_id: source.partnerId,
    conversation_id: source.conversationId,
    service_id: source.serviceId,
    service_package_id: source.servicePackageId,
    offer_id: source.offerId,
    title: source.title,
    description: source.description,
    deliverables: isAccepted && Object.keys(snapshot).length > 0
      ? asArray(snapshot.deliverables)
      : source.deliverables,
    amount_total: source.amount,
    platform_fee: source.platformFee,
    partner_payout: source.partnerPayout,
    currency: source.currency,
    payment_provider: provider,
    payment_method: cleanText(source.paymentMethod, 'platform'),
    status: 'pending_payment',
    delivery_due_at: source.deliveryDueAt,
  }

  // For accepted offers, also persist the canonical snapshot into the order.
  if (isAccepted && Object.keys(snapshot).length > 0) {
    payload['accepted_offer_snapshot'] = snapshot
  }

  const existing = await findPendingOrder(admin, source)
  const request = existing && isAccepted
    ? admin.from('orders').update({
        payment_provider: provider,
        payment_method: cleanText(source.paymentMethod, existing.payment_method || 'platform'),
        ...(Object.keys(asRecord(existing.accepted_offer_snapshot)).length === 0 && snapshot
          ? { accepted_offer_snapshot: snapshot }
          : {}),
      }).eq('id', existing.id)
    : existing
      ? admin.from('orders').update(payload).eq('id', existing.id)
      : admin.from('orders').insert(payload)
  const { data: order, error } = await request.select('*').single()
  if (error) throw error

  await admin.from('order_events').insert({
    order_id: order.id,
    actor_id: source.clientId,
    type: existing ? 'checkout_refreshed' : 'order_created',
    to_status: 'pending_payment',
    message: existing ? 'Checkout сесията е обновена.' : 'Поръчката е създадена и очаква плащане.',
  })

  return order
}

async function stripeSecret(admin: SupabaseAdmin) {
  const fromEnv = cleanText(Deno.env.get('STRIPE_SECRET_KEY'))
  if (fromEnv) return fromEnv

  const { data, error } = await admin
    .from('app_private_secrets')
    .select('secret_value')
    .eq('name', 'STRIPE_SECRET_KEY')
    .maybeSingle()
  if (error) console.error('stripe secret fallback lookup failed', error)
  const fromDatabase = cleanText(data?.secret_value)
  if (fromDatabase) return fromDatabase

  throw new Error('Липсва конфигурация за плащанията.')
}

function stripeErrorMessage(data: Record<string, unknown>) {
  const rawMessage = cleanText((data as { error?: { message?: string } })?.error?.message)
  if (!rawMessage) return 'Заявката за плащания не беше успешна.'

  if (/you can only create new accounts if you've signed up for connect/i.test(rawMessage) || /signed up for connect/i.test(rawMessage)) {
    return 'Плащанията към партньори още не са активирани за този акаунт. Довърши настройката на платежния профил и после натисни „Активирай плащания“ отново.'
  }

  return 'Заявката към платежния доставчик не беше успешна. Провери настройките и опитай отново.'
}

async function stripeRequest(admin: SupabaseAdmin, path: string, options: { method?: string; body?: URLSearchParams } = {}) {
  const secretKey = await stripeSecret(admin)
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: options.body,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(stripeErrorMessage(data))
  return data
}

function stripeConnectState(stripeAccount: Record<string, unknown>) {
  const requirements = (stripeAccount.requirements as Record<string, unknown> | undefined) || {}
  const currentlyDue = asArray(requirements.currently_due)
  const pendingVerification = asArray(requirements.pending_verification)
  const pastDue = asArray(requirements.past_due)
  const eventuallyDue = asArray(requirements.eventually_due)
  const detailsSubmitted = Boolean(stripeAccount.details_submitted)
  const payoutsEnabled = Boolean(stripeAccount.payouts_enabled)
  const chargesEnabled = Boolean(stripeAccount.charges_enabled)
  const disabledReason = cleanText(requirements.disabled_reason)

  let status: 'active' | 'pending_review' | 'needs_information' = 'needs_information'
  if (payoutsEnabled || chargesEnabled) {
    status = 'active'
  } else if (detailsSubmitted && currentlyDue.length === 0 && pastDue.length === 0) {
    status = 'pending_review'
  }

  return {
    status,
    detailsSubmitted,
    payoutsEnabled,
    chargesEnabled,
    disabledReason,
    currentlyDue,
    pendingVerification,
    pastDue,
    eventuallyDue,
  }
}

async function loadStripeConnectAccount(admin: SupabaseAdmin, stripeAccountId: string) {
  return stripeRequest(admin, `accounts/${encodeURIComponent(stripeAccountId)}`)
}

async function createStripeExpressLoginLink(admin: SupabaseAdmin, stripeAccountId: string) {
  const link = await stripeRequest(admin, `accounts/${encodeURIComponent(stripeAccountId)}/login_links`, {
    method: 'POST',
    body: new URLSearchParams(),
  })
  return cleanText((link as { url?: string }).url)
}

function orderTransferGroup(order: Record<string, unknown>) {
  return `totsan_order_${String(order.id || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

async function latestChargeForPaymentIntent(admin: SupabaseAdmin, paymentIntentId: unknown) {
  const id = cleanText(paymentIntentId)
  if (!id.startsWith('pi_')) return ''
  const paymentIntent = await stripeRequest(admin, `payment_intents/${encodeURIComponent(id)}?expand[]=latest_charge`)
  const latestCharge = (paymentIntent as { latest_charge?: string | { id?: string } }).latest_charge
  if (typeof latestCharge === 'string') return latestCharge
  return cleanText(latestCharge?.id)
}

async function createStripeCheckout(admin: SupabaseAdmin, order: Record<string, unknown>, origin: string, sourceType: string, sourceId: string, milestone: Record<string, unknown> | null = null) {
  const currency = String(order.currency || 'EUR').toLowerCase()
  const sourceAmount = Number(milestone?.amount || order.amount_total || 0)
  const amount = toStripeAmount(sourceAmount, currency)
  const transferGroup = orderTransferGroup(order)
  const params = new URLSearchParams()
  params.set('mode', 'payment')
  params.set('client_reference_id', String(order.id))
  params.set('success_url', `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`)
  params.set('cancel_url', milestone ? `${origin}/order/${order.id}?payment=cancelled` : `${origin}/checkout/${sourceType}/${sourceId}?cancelled=1`)
  params.set('line_items[0][quantity]', '1')
  params.set('line_items[0][price_data][currency]', currency)
  params.set('line_items[0][price_data][unit_amount]', String(amount))
  params.set('line_items[0][price_data][product_data][name]', String(milestone ? `${order.title} · ${milestone.title}` : order.title).slice(0, 240))
  params.set('metadata[order_id]', String(order.id))
  params.set('metadata[source_type]', sourceType)
  params.set('metadata[source_id]', sourceId)
  params.set('metadata[partner_id]', String(order.partner_id))
  if (milestone?.id) params.set('metadata[milestone_id]', String(milestone.id))
  params.set('payment_intent_data[metadata][order_id]', String(order.id))
  params.set('payment_intent_data[metadata][source_type]', sourceType)
  params.set('payment_intent_data[metadata][partner_id]', String(order.partner_id))
  if (milestone?.id) params.set('payment_intent_data[metadata][milestone_id]', String(milestone.id))
  params.set('payment_intent_data[description]', `Totsan order ${order.id}`)
  params.set('payment_intent_data[transfer_group]', transferGroup)

  const session = await stripeRequest(admin, 'checkout/sessions', { method: 'POST', body: params })
  const { data: updatedOrder, error: updateError } = await admin.from('orders').update({
    stripe_checkout_session_id: session.id,
  }).eq('id', order.id).select('*').single()
  if (updateError) throw updateError

  if (milestone?.id) {
    const { error: milestoneError } = await admin.from('order_milestones').update({
      status: 'payment_pending',
      stripe_checkout_session_id: session.id,
    }).eq('id', milestone.id).in('status', ['ready', 'payment_pending'])
    if (milestoneError) throw milestoneError
  }

  await admin.from('payment_transactions').insert({
    order_id: order.id,
    milestone_id: milestone?.id || null,
    type: 'charge',
    provider: 'stripe',
    amount: sourceAmount,
    currency: order.currency,
    status: 'pending',
    raw: { checkout_session_id: session.id, url: session.url },
  })

  return { order: updatedOrder, session }
}

async function insertSystemMessage(admin: SupabaseAdmin, offerId: string, actorId: string, body: string) {
  const { data: offer, error: offerError } = await admin.from('offers').select('conversation_id').eq('id', offerId).maybeSingle()
  if (offerError || !offer?.conversation_id) return

  const { data: existingMessages, error: existingError } = await admin
    .from('messages')
    .select('id')
    .eq('conversation_id', offer.conversation_id)
    .eq('kind', 'system')
    .eq('offer_id', offerId)
    .eq('body', body)
    .limit(1)

  if (existingError) return
  if (existingMessages && existingMessages.length > 0) return

  const { data: conversation } = await admin.from('conversations').select('*').eq('id', offer.conversation_id).maybeSingle()
  const { data: message } = await admin.from('messages').insert({
    conversation_id: offer.conversation_id,
    sender_id: actorId,
    kind: 'system',
    body,
    offer_id: offerId,
  }).select('*').maybeSingle()
  if (message && conversation) {
    await admin.from('conversations').update({
      last_message_at: message.created_at,
      last_message_preview: body,
      is_read_by_client: actorId === conversation.client_id,
      is_read_by_partner: actorId === conversation.partner_id,
    }).eq('id', offer.conversation_id)
  }
}

async function markPaid(admin: SupabaseAdmin, order: Record<string, unknown>, actorId: string, raw: Record<string, unknown>) {
  const metadata = asRecord(raw.metadata)
  const paymentIntentRecord = asRecord(raw.payment_intent)
  const milestoneId = cleanText(metadata.milestone_id, cleanText(asRecord(paymentIntentRecord.metadata).milestone_id))
  if (milestoneId) return markMilestonePaid(admin, order, actorId, raw, milestoneId)
  if (order.status !== 'pending_payment') return order
  const paymentIntent = typeof raw.payment_intent === 'string' ? raw.payment_intent : cleanText(asRecord(raw.payment_intent).id) || null
  const provider = raw.provider === 'mock' ? 'mock' : 'stripe'
  const { data: updatedRows, error } = await admin.from('orders').update({
    status: 'paid',
    stripe_payment_intent_id: paymentIntent,
  }).eq('id', order.id).eq('status', 'pending_payment').select('*')
  if (error) throw error
  const updatedOrder = updatedRows?.[0]
  if (!updatedOrder) return order

  await admin.from('payment_transactions').insert({
    order_id: order.id,
    type: 'charge',
    provider,
    amount: order.amount_total,
    currency: order.currency,
    status: 'succeeded',
    raw,
  })
  await admin.from('order_events').insert({
    order_id: order.id,
    actor_id: actorId,
    type: 'payment_succeeded',
    from_status: 'pending_payment',
    to_status: 'paid',
    message: provider === 'mock' ? 'Плащането е потвърдено в демо режим.' : 'Плащането е потвърдено.',
    payload: raw,
  })

  if (order.offer_id) {
    await admin.from('offers').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', order.offer_id)
    await insertSystemMessage(admin, String(order.offer_id), actorId, 'Офертата е платена и поръчката е активна.')
  }

  return updatedOrder
}

async function markMilestonePaid(admin: SupabaseAdmin, order: Record<string, unknown>, actorId: string, raw: Record<string, unknown>, milestoneId: string) {
  const { data: milestone, error } = await admin.from('order_milestones').select('*').eq('id', milestoneId).eq('order_id', order.id).maybeSingle()
  if (error) throw error
  if (!milestone) throw new Error('Етапът за плащане не беше намерен.')
  if (milestone.status === 'paid') return order
  if (!['ready', 'payment_pending'].includes(milestone.status)) throw new Error('Етапът не очаква плащане.')

  const paymentIntent = typeof raw.payment_intent === 'string' ? raw.payment_intent : paymentIntentRecordId(raw.payment_intent)
  const now = new Date().toISOString()
  const { error: milestoneError } = await admin.from('order_milestones').update({
    status: 'paid', paid_at: now, stripe_payment_intent_id: paymentIntent || null,
  }).eq('id', milestone.id).in('status', ['ready', 'payment_pending'])
  if (milestoneError) throw milestoneError

  const { data: updatedOrder, error: orderError } = await admin.from('orders').update({ status: 'paid' }).eq('id', order.id).eq('status', 'pending_payment').select('*').maybeSingle()
  if (orderError) throw orderError
  const resultOrder = updatedOrder || order
  const provider = raw.provider === 'mock' ? 'mock' : 'stripe'
  await admin.from('payment_transactions').insert({ order_id: order.id, milestone_id: milestone.id, type: 'charge', provider, amount: milestone.amount, currency: milestone.currency, status: 'succeeded', raw })
  await admin.from('order_events').insert({ order_id: order.id, milestone_id: milestone.id, actor_id: actorId, type: 'milestone_payment_succeeded', from_status: milestone.status, to_status: 'paid', message: `Плащането за етап ${milestone.position} е потвърдено.`, payload: raw })
  return resultOrder
}

function paymentIntentRecordId(value: unknown) {
  return cleanText(asRecord(value).id)
}

async function startCheckout(req: Request, admin: SupabaseAdmin, userId: string, payload: Record<string, unknown>) {
  const type = String(payload.type || '')
  if (!CHECKOUT_TYPES.has(type)) throw new Error('Checkout type is invalid.')
  const id = assertUuid(payload.id, 'Checkout id')
  const origin = siteOrigin(req, payload)
  const provider = requestedPaymentProvider(payload.provider)
  if (type === 'milestone') {
    const source = await loadMilestoneSource(admin, id, userId)
    if (provider === 'mock') {
      const { data: mockOrder, error: mockOrderError } = await admin.from('orders').update({ payment_provider: 'mock' }).eq('id', source.order.id).select('*').single()
      if (mockOrderError) throw mockOrderError
      const order = await markPaid(admin, mockOrder, userId, { provider: 'mock', paid: true, metadata: { order_id: source.order.id, milestone_id: source.milestone.id } })
      return jsonResponse(200, { ok: true, provider, order, checkoutUrl: `${origin}/order/${order.id}?mock=paid` })
    }
    const { order, session } = await createStripeCheckout(admin, source.order, origin, type, id, source.milestone)
    return jsonResponse(200, { ok: true, provider, order, checkoutUrl: session.url, sessionId: session.id })
  }

  const source = type === 'offer' ? await loadOfferSource(admin, id, userId) : await loadServiceSource(admin, id, userId)
  if (source.paymentMethod === 'custom') throw new Error('Тази оферта използва договорени условия за плащане, а не Stripe checkout.')
  const order = await createOrUpdateOrder(admin, source, provider)

  if (provider === 'mock') {
    const updatedOrder = await markPaid(admin, order, userId, { provider: 'mock', paid: true })
    return jsonResponse(200, { ok: true, provider, order: updatedOrder, checkoutUrl: `${origin}/order/${updatedOrder.id}?mock=paid` })
  }

  const { order: updatedOrder, session } = await createStripeCheckout(admin, order, origin, type, id)
  return jsonResponse(200, { ok: true, provider, order: updatedOrder, checkoutUrl: session.url, sessionId: session.id })
}

async function syncStripeSession(admin: SupabaseAdmin, userId: string, payload: Record<string, unknown>) {
  const sessionId = cleanText(payload.sessionId)
  if (!sessionId.startsWith('cs_')) throw new Error('Платежната сесия е невалидна.')
  const session = await stripeRequest(admin, `checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`)
  const orderId = assertUuid(session?.metadata?.order_id, 'Order id')
  const { data: order, error } = await admin.from('orders').select('*').eq('id', orderId).single()
  if (error) throw error
  if (![order.client_id, order.partner_id].includes(userId)) throw new Error('Order access denied.')

  if (session.payment_status === 'paid') {
    const updatedOrder = await markPaid(admin, order, userId, session)
    return jsonResponse(200, { ok: true, paid: true, order: updatedOrder, sessionId })
  }

  return jsonResponse(200, { ok: true, paid: false, order, sessionId, paymentStatus: session.payment_status })
}

function transitionFor(action: string, order: Record<string, unknown>, userId: string, note = '') {
  const status = String(order.status)
  if (action === 'confirm_direct_payment') {
    if (order.partner_id !== userId) throw new Error('Само партньорът може да потвърди получено плащане.')
    if (status !== 'pending_payment') throw new Error('Поръчката не очаква потвърждение за плащане.')
    return { status: 'paid', payment_provider: 'manual', message: 'Партньорът потвърди, че договореното плащане е получено.' }
  }
  if (action === 'start_work') {
    if (order.partner_id !== userId) throw new Error('Само партньорът може да започне работа.')
    if (status !== 'paid') throw new Error('Поръчката трябва да е платена.')
    return { status: 'in_progress', message: 'Партньорът започна работа по поръчката.' }
  }
  if (action === 'mark_delivered') {
    if (order.partner_id !== userId) throw new Error('Само партньорът може да маркира доставка.')
    if (!['paid', 'in_progress'].includes(status)) throw new Error('Поръчката не е в подходящ статус за доставка.')
    return { status: 'delivered', delivered_at: new Date().toISOString(), message: 'Работата е маркирана като предадена.' }
  }
  if (action === 'confirm_completed') {
    if (order.client_id !== userId) throw new Error('Само клиентът може да потвърди завършване.')
    if (status !== 'delivered') throw new Error('Поръчката трябва първо да бъде предадена.')
    return { status: 'completed', completed_at: new Date().toISOString(), message: 'Клиентът потвърди завършването.' }
  }
  if (action === 'request_revision') {
    if (order.client_id !== userId) throw new Error('Само клиентът може да поиска корекция.')
    if (status !== 'delivered') throw new Error('Корекция може да се поиска след предаване.')
    return { status: 'in_progress', delivered_at: null, message: cleanText(note, 'Клиентът поиска корекция.') }
  }
  if (action === 'cancel_pending') {
    if (order.client_id !== userId) throw new Error('Само клиентът може да отмени неплатена поръчка.')
    if (status !== 'pending_payment') throw new Error('Само неплатена поръчка може да се отмени.')
    return { status: 'cancelled', message: 'Неплатената поръчка е отменена.' }
  }
  throw new Error('Unsupported order action.')
}

async function orderAction(admin: SupabaseAdmin, userId: string, payload: Record<string, unknown>) {
  const action = String(payload.orderAction || payload.nextAction || '')
  if (!ORDER_ACTIONS.has(action)) throw new Error('Order action is invalid.')
  const orderId = assertUuid(payload.orderId, 'Order id')
  const { data: order, error } = await admin.from('orders').select('*').eq('id', orderId).single()
  if (error) throw error
  if (![order.client_id, order.partner_id].includes(userId)) throw new Error('Order access denied.')
  const note = cleanText(payload.note)
  const transition = transitionFor(action, order, userId, note)
  const previousStatus = order.status
  const { message, ...patch } = transition
  const { data: updatedOrder, error: updateError } = await admin.from('orders').update(patch).eq('id', order.id).select('*').single()
  if (updateError) throw updateError

  await admin.from('order_events').insert({
    order_id: order.id,
    actor_id: userId,
    type: action,
    from_status: previousStatus,
    to_status: updatedOrder.status,
    message,
    payload: { note },
  })

  if (action === 'confirm_direct_payment') {
    await admin.from('payment_transactions').insert({
      order_id: order.id,
      type: 'charge',
      provider: 'manual',
      amount: order.amount_total,
      currency: order.currency,
      status: 'succeeded',
      raw: { confirmed_by: userId, note },
    })
  }

  if (action === 'confirm_completed' && order.payment_method !== 'custom') {
    await releasePayout(admin, order)
  }

  return jsonResponse(200, { ok: true, order: updatedOrder })
}

async function milestoneAction(admin: SupabaseAdmin, userId: string, payload: Record<string, unknown>) {
  const action = cleanText(payload.milestoneAction || payload.nextAction)
  if (!MILESTONE_ACTIONS.has(action)) throw new Error('Действието за етапа е невалидно.')
  const milestoneId = assertUuid(payload.milestoneId, 'Milestone id')
  const { data: milestone, error } = await admin.from('order_milestones').select('*').eq('id', milestoneId).maybeSingle()
  if (error) throw error
  if (!milestone) throw new Error('Етапът не беше намерен.')
  const { data: order, error: orderError } = await admin.from('orders').select('*').eq('id', milestone.order_id).maybeSingle()
  if (orderError) throw orderError
  if (!order || ![order.client_id, order.partner_id].includes(userId)) throw new Error('Нямаш достъп до този етап.')

  const note = cleanText(payload.note)
  const now = new Date().toISOString()
  const previousStatus = String(milestone.status)
  let nextStatus = previousStatus
  let message = ''
  const patch: Record<string, unknown> = {}

  if (action === 'start') {
    if (order.partner_id !== userId || previousStatus !== 'paid') throw new Error('Етапът трябва да е платен, преди да започне.')
    nextStatus = 'in_progress'; patch.started_at = now; message = `Партньорът започна етап ${milestone.position}.`
  } else if (action === 'submit') {
    if (order.partner_id !== userId || !['in_progress', 'revision_requested'].includes(previousStatus)) throw new Error('Етапът не е готов за предаване.')
    nextStatus = 'submitted'; patch.submitted_at = now; message = note || `Етап ${milestone.position} е предаден за приемане.`
  } else if (action === 'request_revision') {
    if (order.client_id !== userId || previousStatus !== 'submitted') throw new Error('Корекция може да се поиска след предаване.')
    if (!note) throw new Error('Опиши какво трябва да бъде коригирано.')
    nextStatus = 'revision_requested'; message = note
  } else if (action === 'dispute') {
    if (!['paid', 'in_progress', 'submitted', 'revision_requested'].includes(previousStatus)) throw new Error('Този етап не може да бъде оспорен в текущото състояние.')
    if (!note) throw new Error('Опиши причината за спора.')
    nextStatus = 'disputed'; message = note
  } else if (action === 'accept') {
    if (order.client_id !== userId || previousStatus !== 'submitted') throw new Error('Само клиентът може да приеме предаден етап.')
    nextStatus = 'accepted'; patch.accepted_at = now; message = `Клиентът прие етап ${milestone.position}.`
  }

  const evidence = Array.isArray(milestone.evidence) ? [...milestone.evidence] : []
  if (note) evidence.push({ type: 'note', action, body: note, actorId: userId, createdAt: now })
  const { data: updatedRows, error: updateError } = await admin.from('order_milestones').update({ ...patch, status: nextStatus, evidence }).eq('id', milestone.id).eq('status', previousStatus).select('*')
  if (updateError) throw updateError
  const updatedMilestone = updatedRows?.[0]
  if (!updatedMilestone) throw new Error('Състоянието на етапа вече е променено. Обнови страницата.')

  if (action === 'start') await admin.from('orders').update({ status: 'in_progress' }).eq('id', order.id)
  if (action === 'dispute') await admin.from('orders').update({ status: 'disputed' }).eq('id', order.id)
  if (action === 'accept') {
    await releaseMilestonePayout(admin, order, updatedMilestone)
    const { data: nextMilestone } = await admin.from('order_milestones').select('*').eq('order_id', order.id).gt('position', milestone.position).order('position').limit(1).maybeSingle()
    if (nextMilestone) {
      await admin.from('order_milestones').update({ status: 'ready' }).eq('id', nextMilestone.id).eq('status', 'pending')
      await admin.from('orders').update({ status: 'pending_payment' }).eq('id', order.id)
    } else {
      await admin.from('orders').update({ status: 'completed', completed_at: now }).eq('id', order.id)
    }
  }

  await admin.from('order_events').insert({ order_id: order.id, milestone_id: milestone.id, actor_id: userId, type: `milestone_${action}`, from_status: previousStatus, to_status: nextStatus, message, payload: { note } })
  const { data: refreshedOrder } = await admin.from('orders').select('*').eq('id', order.id).single()
  return jsonResponse(200, { ok: true, order: refreshedOrder, milestone: updatedMilestone })
}

async function releaseMilestonePayout(admin: SupabaseAdmin, order: Record<string, unknown>, milestone: Record<string, unknown>) {
  const provider = String(order.payment_provider || 'mock')
  const platformFee = Math.max(0, Math.round(Number(milestone.amount || 0) * PLATFORM_FEE_RATE))
  const payoutAmount = Math.max(0, Number(milestone.amount || 0) - platformFee)
  let status = provider === 'mock' ? 'succeeded' : 'pending'
  let raw: Record<string, unknown> = { provider, milestone_id: milestone.id }

  if (provider === 'stripe') {
    try {
      const { data: partnerAccount, error } = await admin.from('accounts').select('stripe_account_id').eq('id', order.partner_id).maybeSingle()
      if (error) throw error
      if (!partnerAccount?.stripe_account_id) {
        raw = { ...raw, requires_connect_payout: true }
      } else {
        const currency = String(milestone.currency || order.currency || 'EUR').toLowerCase()
        const params = new URLSearchParams()
        const sourceCharge = await latestChargeForPaymentIntent(admin, milestone.stripe_payment_intent_id)
        params.set('amount', String(toStripeAmount(payoutAmount, currency)))
        params.set('currency', currency)
        params.set('destination', partnerAccount.stripe_account_id)
        params.set('transfer_group', orderTransferGroup(order))
        params.set('metadata[order_id]', String(order.id))
        params.set('metadata[milestone_id]', String(milestone.id))
        if (sourceCharge) params.set('source_transaction', sourceCharge)
        const transfer = await stripeRequest(admin, 'transfers', { method: 'POST', body: params })
        status = 'succeeded'; raw = transfer
        await admin.from('order_milestones').update({ stripe_transfer_id: transfer.id }).eq('id', milestone.id)
      }
    } catch (error) {
      raw = { ...raw, payout_error: error instanceof Error ? error.message : 'Преводът към партньора не беше успешен.' }
    }
  }

  await admin.from('payment_transactions').insert({ order_id: order.id, milestone_id: milestone.id, type: 'payout', provider, amount: payoutAmount, currency: milestone.currency || order.currency, status, raw })
}

async function releasePayout(admin: SupabaseAdmin, order: Record<string, unknown>) {
  const provider = String(order.payment_provider || 'mock')
  let status = provider === 'mock' ? 'succeeded' : 'pending'
  let raw: Record<string, unknown> = { release_requested: true, provider }

  if (provider === 'stripe') {
    try {
      const { data: partnerAccount, error } = await admin
        .from('accounts')
        .select('stripe_account_id')
        .eq('id', order.partner_id)
        .maybeSingle()
      if (error) throw error
      if (!partnerAccount?.stripe_account_id) {
        raw = { release_requested: true, requires_connect_payout: true }
      } else {
        const currency = String(order.currency || 'EUR').toLowerCase()
        const params = new URLSearchParams()
        const sourceCharge = await latestChargeForPaymentIntent(admin, order.stripe_payment_intent_id)
        params.set('amount', String(toStripeAmount(Number(order.partner_payout || 0), currency)))
        params.set('currency', currency)
        params.set('destination', partnerAccount.stripe_account_id)
        params.set('transfer_group', orderTransferGroup(order))
        params.set('metadata[order_id]', String(order.id))
        if (sourceCharge) params.set('source_transaction', sourceCharge)
        const transfer = await stripeRequest(admin, 'transfers', { method: 'POST', body: params })
        status = 'succeeded'
        raw = transfer
        await admin.from('orders').update({ stripe_transfer_id: transfer.id }).eq('id', order.id)
      }
    } catch (error) {
      status = 'pending'
      raw = { release_requested: true, payout_error: error instanceof Error ? error.message : 'Преводът към партньора не беше успешен.' }
    }
  }

  await admin.from('payment_transactions').insert({
    order_id: order.id,
    type: 'payout',
    provider,
    amount: order.partner_payout,
    currency: order.currency,
    status,
    raw,
  })
}

async function connectOnboarding(req: Request, admin: SupabaseAdmin, userId: string, payload: Record<string, unknown>) {
  const origin = siteOrigin(req, payload)
  const { data: account, error } = await admin
    .from('accounts')
    .select('email, role, stripe_account_id')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!account || account.role !== 'specialist') throw new Error('Само партньорски профил може да активира плащания.')

  let stripeAccountId = account.stripe_account_id
  if (!stripeAccountId) {
    const params = new URLSearchParams()
    params.set('type', 'express')
    params.set('country', 'BG')
    if (account.email) params.set('email', account.email)
    params.set('capabilities[transfers][requested]', 'true')
    const stripeAccount = await stripeRequest(admin, 'accounts', { method: 'POST', body: params })
    stripeAccountId = stripeAccount.id
    await admin.from('accounts').update({ stripe_account_id: stripeAccountId }).eq('id', userId)
  }

  const stripeAccount = await loadStripeConnectAccount(admin, stripeAccountId)
  const accountState = stripeConnectState(stripeAccount)
  if (accountState.status === 'active') {
    const dashboardUrl = await createStripeExpressLoginLink(admin, stripeAccountId)
    return jsonResponse(200, { ok: true, stripeAccountId, status: accountState.status, dashboardUrl, accountState })
  }
  if (accountState.status === 'pending_review') {
    return jsonResponse(200, { ok: true, stripeAccountId, status: accountState.status, accountState })
  }

  const linkParams = new URLSearchParams()
  linkParams.set('account', stripeAccountId)
  linkParams.set('type', 'account_onboarding')
  linkParams.set('refresh_url', `${origin}/moy-profil?payments=refresh`)
  linkParams.set('return_url', `${origin}/moy-profil?payments=connected`)
  const link = await stripeRequest(admin, 'account_links', { method: 'POST', body: linkParams })
  return jsonResponse(200, { ok: true, stripeAccountId, status: accountState.status, onboardingUrl: link.url, accountState })
}

async function connectStatus(admin: SupabaseAdmin, userId: string) {
  const { data: account, error } = await admin
    .from('accounts')
    .select('role, stripe_account_id')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!account || account.role !== 'specialist') throw new Error('Само партньорски профил може да активира плащания.')
  if (!account.stripe_account_id) return jsonResponse(200, { ok: true, status: 'not_started' })

  const stripeAccount = await loadStripeConnectAccount(admin, account.stripe_account_id)
  const accountState = stripeConnectState(stripeAccount)
  return jsonResponse(200, { ok: true, stripeAccountId: account.stripe_account_id, status: accountState.status, accountState })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Only POST is supported.' })

  const authorization = req.headers.get('Authorization') || ''
  try {
    const user = await getUser(req, authorization)
    const admin = adminClient()
    const { data: account } = await admin.from('accounts').select('account_status').eq('id', user.id).maybeSingle()
    if (account?.account_status === 'banned' || account?.account_status === 'suspended') {
      return jsonResponse(403, { error: 'Този акаунт няма достъп до плащания.' })
    }

    let body: { action?: string; payload?: Record<string, unknown> }
    try {
      body = await req.json()
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON body.' })
    }

    const action = String(body.action || '')
    const payload = body.payload || {}
    if (action === 'start_checkout') return await startCheckout(req, admin, user.id, payload)
    if (action === 'sync_stripe_session') return await syncStripeSession(admin, user.id, payload)
    if (action === 'order_action') return await orderAction(admin, user.id, payload)
    if (action === 'milestone_action') return await milestoneAction(admin, user.id, payload)
    if (action === 'connect_onboarding') return await connectOnboarding(req, admin, user.id, payload)
    if (action === 'connect_status') return await connectStatus(admin, user.id)
    return jsonResponse(400, { error: 'Unsupported payment action.' })
  } catch (error) {
    console.error('payments-checkout error', error)
    return jsonResponse(400, { error: error instanceof Error ? error.message : 'Payment action failed.' })
  }
})
