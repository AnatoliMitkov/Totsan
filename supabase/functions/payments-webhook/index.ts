import { createClient } from 'npm:@supabase/supabase-js@2.49.8'

const encoder = new TextEncoder()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function adminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase service environment variables.')
  return createClient(supabaseUrl, serviceRoleKey)
}

function signatureParts(header: string) {
  const parts = new Map<string, string>()
  header.split(',').forEach((part) => {
    const [key, value] = part.split('=')
    if (key && value) parts.set(key.trim(), value.trim())
  })
  return parts
}

async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(signature)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let result = 0
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return result === 0
}

async function verifyStripeSignature(req: Request, rawBody: string) {
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!webhookSecret) throw new Error('Missing STRIPE_WEBHOOK_SECRET.')
  const header = req.headers.get('stripe-signature') || ''
  const parts = signatureParts(header)
  const timestamp = parts.get('t')
  const signature = parts.get('v1')
  if (!timestamp || !signature) throw new Error('Invalid Stripe signature header.')

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) throw new Error('Expired Stripe signature timestamp.')

  const expected = await hmacHex(webhookSecret, `${timestamp}.${rawBody}`)
  if (!safeEqual(expected, signature)) throw new Error('Stripe signature verification failed.')
}

async function markPaid(session: Record<string, unknown>) {
  const orderId = String((session.metadata as Record<string, unknown> | undefined)?.order_id || '')
  if (!orderId) return { skipped: true, reason: 'missing_order_id' }
  const admin = adminClient()
  const { data: order, error } = await admin.from('orders').select('*').eq('id', orderId).maybeSingle()
  if (error) throw error
  if (!order) return { skipped: true, reason: 'order_not_found' }
  if (order.status !== 'pending_payment') return { ok: true, order }

  const paymentIntent = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent as Record<string, unknown> | null)?.id || null

  const { data: updatedOrder, error: updateError } = await admin.from('orders').update({
    status: 'paid',
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntent,
  }).eq('id', order.id).select('*').single()
  if (updateError) throw updateError

  await admin.from('payment_transactions').insert({
    order_id: order.id,
    type: 'charge',
    provider: 'stripe',
    amount: order.amount_total,
    currency: order.currency,
    status: 'succeeded',
    raw: session,
  })
  await admin.from('order_events').insert({
    order_id: order.id,
    actor_id: order.client_id,
    type: 'payment_succeeded_webhook',
    from_status: 'pending_payment',
    to_status: 'paid',
    message: 'Stripe webhook потвърди плащането.',
    payload: session,
  })

  if (order.offer_id) {
    await admin.from('offers').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', order.offer_id)
  }

  return { ok: true, order: updatedOrder }
}

async function markPaidFromPaymentIntent(paymentIntent: Record<string, unknown>) {
  const metadata = paymentIntent.metadata as Record<string, unknown> | undefined
  const orderId = String(metadata?.order_id || '')
  if (!orderId) return { skipped: true, reason: 'missing_order_id' }
  const admin = adminClient()
  const { data: order, error } = await admin.from('orders').select('*').eq('id', orderId).maybeSingle()
  if (error) throw error
  if (!order) return { skipped: true, reason: 'order_not_found' }
  if (order.status !== 'pending_payment') return { ok: true, order }

  const { data: updatedOrder, error: updateError } = await admin.from('orders').update({
    status: 'paid',
    stripe_payment_intent_id: paymentIntent.id,
  }).eq('id', order.id).select('*').single()
  if (updateError) throw updateError

  await admin.from('payment_transactions').insert({
    order_id: order.id,
    type: 'charge',
    provider: 'stripe',
    amount: order.amount_total,
    currency: order.currency,
    status: 'succeeded',
    raw: paymentIntent,
  })
  await admin.from('order_events').insert({
    order_id: order.id,
    actor_id: order.client_id,
    type: 'payment_intent_succeeded_webhook',
    from_status: 'pending_payment',
    to_status: 'paid',
    message: 'Stripe webhook потвърди плащането.',
    payload: paymentIntent,
  })

  if (order.offer_id) {
    await admin.from('offers').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', order.offer_id)
  }

  return { ok: true, order: updatedOrder }
}

async function markRefunded(charge: Record<string, unknown>) {
  const paymentIntent = String(charge.payment_intent || '')
  if (!paymentIntent) return { skipped: true, reason: 'missing_payment_intent' }
  const admin = adminClient()
  const { data: order, error } = await admin.from('orders').select('*').eq('stripe_payment_intent_id', paymentIntent).maybeSingle()
  if (error) throw error
  if (!order) return { skipped: true, reason: 'order_not_found' }

  const { data: updatedOrder, error: updateError } = await admin.from('orders').update({ status: 'refunded' }).eq('id', order.id).select('*').single()
  if (updateError) throw updateError
  await admin.from('payment_transactions').insert({
    order_id: order.id,
    type: 'refund',
    provider: 'stripe',
    amount: Math.round(Number(charge.amount_refunded || 0) / 100),
    currency: String(charge.currency || order.currency).toUpperCase(),
    status: 'succeeded',
    raw: charge,
  })
  await admin.from('order_events').insert({
    order_id: order.id,
    actor_id: null,
    type: 'refund_webhook',
    from_status: order.status,
    to_status: 'refunded',
    message: 'Stripe webhook отчете refund.',
    payload: charge,
  })
  return { ok: true, order: updatedOrder }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Only POST is supported.' })

  try {
    const rawBody = await req.text()
    await verifyStripeSignature(req, rawBody)
    const event = JSON.parse(rawBody)
    const type = String(event.type || '')
    const object = event?.data?.object || {}

    if (type === 'checkout.session.completed' && object.payment_status === 'paid') {
      const result = await markPaid(object)
      return jsonResponse(200, { received: true, handled: type, result })
    }
    if (type === 'payment_intent.succeeded') {
      const result = await markPaidFromPaymentIntent(object)
      return jsonResponse(200, { received: true, handled: type, result })
    }
    if (type === 'charge.refunded') {
      const result = await markRefunded(object)
      return jsonResponse(200, { received: true, handled: type, result })
    }
    return jsonResponse(200, { received: true, ignored: type })
  } catch (error) {
    console.error('payments-webhook error', error)
    return jsonResponse(400, { error: error instanceof Error ? error.message : 'Webhook failed.' })
  }
})