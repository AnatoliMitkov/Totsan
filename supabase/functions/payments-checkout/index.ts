import { createClient } from 'npm:@supabase/supabase-js@2.49.8'

const CHECKOUT_TYPES = new Set(['service', 'offer'])
const ORDER_ACTIONS = new Set(['start_work', 'mark_delivered', 'confirm_completed', 'request_revision', 'cancel_pending'])
const ZERO_DECIMAL_CURRENCIES = new Set(['BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF'])
const PLATFORM_FEE_RATE = 0.10

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type SupabaseAdmin = ReturnType<typeof createClient>

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

function cleanText(value: unknown, fallback = '') {
  return String(value ?? '').trim() || fallback
}

function asArray(value: unknown) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean)
  if (typeof value === 'string') return value.split('\n').map(item => item.trim()).filter(Boolean)
  return []
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
  }
}

async function loadOfferSource(admin: SupabaseAdmin, offerId: string, userId: string) {
  const { data: offer, error } = await admin.from('offers').select('*').eq('id', offerId).maybeSingle()
  if (error) throw error
  if (!offer) throw new Error('Офертата не беше намерена.')
  if (offer.client_id !== userId) throw new Error('Само клиентът може да плати тази оферта.')
  if (!['sent', 'accepted'].includes(offer.status)) throw new Error('Тази оферта вече не е активна за плащане.')

  const amount = moneyAmount(offer.price_amount)
  const currency = currencyCode(offer.currency)
  const fees = computeFees(amount)
  return {
    sourceType: 'offer',
    sourceId: offer.id,
    clientId: userId,
    partnerId: offer.partner_id,
    conversationId: offer.conversation_id,
    serviceId: null,
    servicePackageId: null,
    offerId: offer.id,
    title: offer.title,
    description: cleanText(offer.description),
    deliverables: asArray(offer.deliverables),
    amount,
    currency,
    deliveryDueAt: dueDate(offer.delivery_days),
    ...fees,
  }
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
  const payload = {
    client_id: source.clientId,
    partner_id: source.partnerId,
    conversation_id: source.conversationId,
    service_id: source.serviceId,
    service_package_id: source.servicePackageId,
    offer_id: source.offerId,
    title: source.title,
    description: source.description,
    deliverables: source.deliverables,
    amount_total: source.amount,
    platform_fee: source.platformFee,
    partner_payout: source.partnerPayout,
    currency: source.currency,
    payment_provider: provider,
    status: 'pending_payment',
    delivery_due_at: source.deliveryDueAt,
  }
  const existing = await findPendingOrder(admin, source)
  const request = existing
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

  throw new Error('Липсва STRIPE_SECRET_KEY за Stripe Sandbox.')
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
  if (!response.ok) throw new Error(data?.error?.message || 'Stripe заявката не беше успешна.')
  return data
}

async function createStripeCheckout(admin: SupabaseAdmin, order: Record<string, unknown>, origin: string, sourceType: string, sourceId: string) {
  const currency = String(order.currency || 'EUR').toLowerCase()
  const amount = toStripeAmount(Number(order.amount_total || 0), currency)
  const params = new URLSearchParams()
  params.set('mode', 'payment')
  params.set('client_reference_id', String(order.id))
  params.set('success_url', `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`)
  params.set('cancel_url', `${origin}/checkout/${sourceType}/${sourceId}?cancelled=1`)
  params.set('line_items[0][quantity]', '1')
  params.set('line_items[0][price_data][currency]', currency)
  params.set('line_items[0][price_data][unit_amount]', String(amount))
  params.set('line_items[0][price_data][product_data][name]', String(order.title).slice(0, 240))
  params.set('metadata[order_id]', String(order.id))
  params.set('metadata[source_type]', sourceType)
  params.set('metadata[source_id]', sourceId)
  params.set('metadata[partner_id]', String(order.partner_id))
  params.set('payment_intent_data[metadata][order_id]', String(order.id))
  params.set('payment_intent_data[metadata][source_type]', sourceType)
  params.set('payment_intent_data[metadata][partner_id]', String(order.partner_id))
  params.set('payment_intent_data[description]', `Totsan order ${order.id}`)

  const session = await stripeRequest(admin, 'checkout/sessions', { method: 'POST', body: params })
  const { data: updatedOrder, error: updateError } = await admin.from('orders').update({
    stripe_checkout_session_id: session.id,
  }).eq('id', order.id).select('*').single()
  if (updateError) throw updateError

  await admin.from('payment_transactions').insert({
    order_id: order.id,
    type: 'charge',
    provider: 'stripe',
    amount: order.amount_total,
    currency: order.currency,
    status: 'pending',
    raw: { checkout_session_id: session.id, url: session.url },
  })

  return { order: updatedOrder, session }
}

async function insertSystemMessage(admin: SupabaseAdmin, offerId: string, actorId: string, body: string) {
  const { data: offer, error: offerError } = await admin.from('offers').select('conversation_id').eq('id', offerId).maybeSingle()
  if (offerError || !offer?.conversation_id) return
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
  if (order.status !== 'pending_payment') return order
  const paymentIntent = typeof raw.payment_intent === 'string' ? raw.payment_intent : raw.payment_intent?.id || null
  const provider = raw.provider === 'mock' ? 'mock' : 'stripe'
  const { data: updatedOrder, error } = await admin.from('orders').update({
    status: 'paid',
    stripe_payment_intent_id: paymentIntent,
  }).eq('id', order.id).select('*').single()
  if (error) throw error

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
    message: provider === 'mock' ? 'Плащането е потвърдено в демо режим.' : 'Плащането е потвърдено през Stripe Sandbox.',
    payload: raw,
  })

  if (order.offer_id) {
    await admin.from('offers').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', order.offer_id)
    await insertSystemMessage(admin, String(order.offer_id), actorId, 'Офертата е платена и поръчката е активна.')
  }

  return updatedOrder
}

async function startCheckout(req: Request, admin: SupabaseAdmin, userId: string, payload: Record<string, unknown>) {
  const type = String(payload.type || '')
  if (!CHECKOUT_TYPES.has(type)) throw new Error('Checkout type is invalid.')
  const id = assertUuid(payload.id, 'Checkout id')
  const source = type === 'offer'
    ? await loadOfferSource(admin, id, userId)
    : await loadServiceSource(admin, id, userId)
  const origin = siteOrigin(req, payload)
  const provider = requestedPaymentProvider(payload.provider)
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
  if (!sessionId.startsWith('cs_')) throw new Error('Stripe session id is invalid.')
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

  if (action === 'confirm_completed') {
    await releasePayout(admin, order)
  }

  return jsonResponse(200, { ok: true, order: updatedOrder })
}

async function releasePayout(admin: SupabaseAdmin, order: Record<string, unknown>) {
  const provider = String(order.payment_provider || 'mock')
  let status = provider === 'mock' ? 'succeeded' : 'pending'
  let raw: Record<string, unknown> = { escrow_released: true, provider }

  if (provider === 'stripe') {
    try {
      const { data: partnerAccount, error } = await admin
        .from('accounts')
        .select('stripe_account_id')
        .eq('id', order.partner_id)
        .maybeSingle()
      if (error) throw error
      if (!partnerAccount?.stripe_account_id) {
        raw = { escrow_released: true, requires_connect_payout: true }
      } else {
        const currency = String(order.currency || 'EUR').toLowerCase()
        const params = new URLSearchParams()
        params.set('amount', String(toStripeAmount(Number(order.partner_payout || 0), currency)))
        params.set('currency', currency)
        params.set('destination', partnerAccount.stripe_account_id)
        params.set('metadata[order_id]', String(order.id))
        const transfer = await stripeRequest(admin, 'transfers', { method: 'POST', body: params })
        status = 'succeeded'
        raw = transfer
        await admin.from('orders').update({ stripe_transfer_id: transfer.id }).eq('id', order.id)
      }
    } catch (error) {
      status = 'pending'
      raw = { escrow_released: true, payout_error: error instanceof Error ? error.message : 'Stripe transfer failed.' }
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

  const linkParams = new URLSearchParams()
  linkParams.set('account', stripeAccountId)
  linkParams.set('type', 'account_onboarding')
  linkParams.set('refresh_url', `${origin}/moy-profil?payments=refresh`)
  linkParams.set('return_url', `${origin}/moy-profil?payments=connected`)
  const link = await stripeRequest(admin, 'account_links', { method: 'POST', body: linkParams })
  return jsonResponse(200, { ok: true, stripeAccountId, onboardingUrl: link.url })
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
    if (action === 'connect_onboarding') return await connectOnboarding(req, admin, user.id, payload)
    return jsonResponse(400, { error: 'Unsupported payment action.' })
  } catch (error) {
    console.error('payments-checkout error', error)
    return jsonResponse(400, { error: error instanceof Error ? error.message : 'Payment action failed.' })
  }
})