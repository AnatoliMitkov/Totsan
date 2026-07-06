import { createClient } from 'npm:@supabase/supabase-js@2.49.8'

const ORDER_ACTIONS = new Set([
  'confirm_direct_payment',
  'start_work',
  'mark_delivered',
  'confirm_completed',
  'request_revision',
  'cancel_pending',
])

const DISABLED_LEGACY_ACTIONS = new Set([
  'start_checkout',
  'sync_stripe_session',
  'connect_onboarding',
  'connect_status',
])

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

async function getUser(authorization: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Missing Supabase auth environment variables.')

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  })
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

function transitionFor(action: string, order: Record<string, unknown>, userId: string, note = '') {
  const status = String(order.status)

  if (action === 'confirm_direct_payment') {
    if (order.partner_id !== userId) throw new Error('Само партньорът може да потвърди получено директно плащане.')
    if (status !== 'pending_payment') throw new Error('Поръчката не очаква потвърждение за плащане.')
    return { status: 'paid', message: 'Партньорът потвърди, че е получил директното плащане от клиента.' }
  }
  if (action === 'start_work') {
    if (order.partner_id !== userId) throw new Error('Само партньорът може да започне работа.')
    if (status !== 'paid') throw new Error('Партньорът трябва първо да потвърди директното плащане.')
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
    if (status !== 'pending_payment') throw new Error('Само поръчка без потвърдено директно плащане може да се отмени.')
    return { status: 'cancelled', message: 'Поръчката без потвърдено директно плащане е отменена.' }
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
  const { data: updatedOrder, error: updateError } = await admin
    .from('orders')
    .update(patch)
    .eq('id', order.id)
    .select('*')
    .single()
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

  return jsonResponse(200, { ok: true, order: updatedOrder })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Only POST is supported.' })

  try {
    const authorization = req.headers.get('Authorization') || ''
    const user = await getUser(authorization)
    const admin = adminClient()
    const { data: account } = await admin.from('accounts').select('account_status').eq('id', user.id).maybeSingle()
    if (account?.account_status === 'banned' || account?.account_status === 'suspended') {
      return jsonResponse(403, { error: 'Този акаунт няма достъп до управление на поръчки.' })
    }

    let body: { action?: string; payload?: Record<string, unknown> }
    try {
      body = await req.json()
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON body.' })
    }

    const action = String(body.action || '')
    if (action === 'order_action') return await orderAction(admin, user.id, body.payload || {})
    if (DISABLED_LEGACY_ACTIONS.has(action)) {
      return jsonResponse(410, {
        error: 'Плащанията по проекти се извършват директно между клиента и партньора. Totsan обработва чрез Stripe само партньорски абонаменти в отделния subscription flow.',
      })
    }
    return jsonResponse(400, { error: 'Unsupported order action.' })
  } catch (error) {
    console.error('payments-checkout error', error)
    return jsonResponse(400, { error: error instanceof Error ? error.message : 'Order action failed.' })
  }
})
