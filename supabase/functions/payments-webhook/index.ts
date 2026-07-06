import { createClient } from 'npm:@supabase/supabase-js@2.49.8'
import {
  sendActivationEmailIfNeeded,
  upsertPartnerSubscription as sharedUpsertPartnerSubscription,
} from '../_shared/partner-subscriptions.ts'

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

function cleanText(value: unknown, fallback = '') {
  return String(value ?? '').trim() || fallback
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

function toIsoFromUnix(value: unknown) {
  const seconds = Number(value || 0)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return new Date(seconds * 1000).toISOString()
}

function stripeObjectId(value: unknown) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object' && !Array.isArray(value)) return cleanText((value as Record<string, unknown>).id)
  return ''
}

function stripePriceIdFromSubscription(subscription: Record<string, unknown>) {
  const items = subscription.items as { data?: Array<Record<string, unknown>> } | undefined
  const price = items?.data?.[0]?.price as Record<string, unknown> | undefined
  return cleanText(price?.id)
}

function stripePriceIdFromInvoice(invoice: Record<string, unknown>) {
  const lines = invoice.lines as { data?: Array<Record<string, unknown>> } | undefined
  const line = lines?.data?.[0]
  const price = line?.price as Record<string, unknown> | undefined
  return cleanText(price?.id)
}

function stripeInvoicePeriod(invoice: Record<string, unknown>) {
  const lines = invoice.lines as { data?: Array<Record<string, unknown>> } | undefined
  const period = lines?.data?.[0]?.period as Record<string, unknown> | undefined
  return {
    start: toIsoFromUnix(period?.start),
    end: toIsoFromUnix(period?.end),
  }
}

function planKeyFromPriceId(priceId: string) {
  const pairs: Array<[string, string]> = [
    ['active_partner_monthly', Deno.env.get('STRIPE_PRICE_PARTNER_ACTIVE_MONTHLY') || ''],
    ['active_partner_yearly', Deno.env.get('STRIPE_PRICE_PARTNER_ACTIVE_YEARLY') || ''],
    ['company_team_monthly', Deno.env.get('STRIPE_PRICE_PARTNER_COMPANY_MONTHLY') || ''],
    ['company_team_yearly', Deno.env.get('STRIPE_PRICE_PARTNER_COMPANY_YEARLY') || ''],
  ]
  return pairs.find(([, configuredPriceId]) => configuredPriceId && configuredPriceId === priceId)?.[0] || ''
}

function billingIntervalFromPlanKey(planKey: string) {
  if (planKey.endsWith('_yearly')) return 'yearly'
  if (planKey.endsWith('_monthly')) return 'monthly'
  return ''
}

function mapStripeSubscriptionStatus(value: unknown) {
  const status = cleanText(value).toLowerCase()
  if (status === 'active') return 'active'
  if (status === 'trialing') return 'trialing'
  if (status === 'canceled') return 'canceled'
  if (status === 'incomplete_expired') return 'expired'
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'past_due'
  return 'inactive'
}

function stripeSecret() {
  return cleanText(Deno.env.get('STRIPE_SECRET_KEY'))
}

async function stripeGet(path: string) {
  const secret = stripeSecret()
  if (!secret) return null
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  })
  const data = await response.json()
  if (!response.ok) {
    console.error('payments-webhook stripe lookup error', data)
    return null
  }
  return data as Record<string, unknown>
}

async function updateSubscriptionRows(admin: ReturnType<typeof createClient>, match: { subscriptionId?: string; checkoutSessionId?: string }, patch: Record<string, unknown>) {
  if (match.subscriptionId) {
    const { data, error } = await admin
      .from('partner_subscriptions')
      .update(patch)
      .eq('stripe_subscription_id', match.subscriptionId)
      .select('*')
    if (error) throw error
    if (data?.length) return data[0]
  }

  if (match.checkoutSessionId) {
    const { data, error } = await admin
      .from('partner_subscriptions')
      .update(patch)
      .eq('stripe_checkout_session_id', match.checkoutSessionId)
      .select('*')
    if (error) throw error
    if (data?.length) return data[0]
  }

  return null
}

async function upsertPartnerSubscriptionFromStripeSubscription(subscription: Record<string, unknown>, fallback: Record<string, unknown> = {}) {
  const admin = adminClient()
  const metadata = {
    ...((fallback.metadata as Record<string, unknown> | undefined) || {}),
    ...((subscription.metadata as Record<string, unknown> | undefined) || {}),
  }
  const subscriptionId = cleanText(subscription.id || fallback.stripe_subscription_id)
  if (!subscriptionId) return { skipped: true, reason: 'missing_subscription_id' }
  const userId = cleanText(metadata.user_id || fallback.user_id)
  if (!userId) return { skipped: true, reason: 'missing_user_id' }

  const row = await sharedUpsertPartnerSubscription(admin, subscription, {
    ...fallback,
    user_id: userId,
    partner_profile_id: cleanText(metadata.partner_profile_id || fallback.partner_profile_id),
    plan_key: cleanText(metadata.plan_key || fallback.plan_key),
    billing_interval: cleanText(metadata.billing_interval || fallback.billing_interval),
    sync_source: 'stripe_subscription_webhook',
  })
  if (!row) return { skipped: true, reason: 'subscription_not_saved' }
  return { ok: true, subscription: row }
}

async function attachActivationEmail(
  result: Record<string, unknown>,
  fallbackEmail = '',
) {
  const subscription = result.subscription as Record<string, unknown> | undefined
  const userId = cleanText(subscription?.user_id)
  if (!subscription || !userId) return result

  let recipientEmail = cleanText(fallbackEmail)
  if (!recipientEmail) {
    const admin = adminClient()
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (error) console.error('Could not load subscription email recipient', error)
    recipientEmail = cleanText(data?.user?.email)
  }

  const admin = adminClient()
  const emailResult = await sendActivationEmailIfNeeded(admin, subscription, recipientEmail)
  return {
    ...result,
    subscription: emailResult.subscription || subscription,
    email: {
      sent: Boolean(emailResult.sent),
      skipped: Boolean(emailResult.skipped),
      reason: cleanText(emailResult.reason),
    },
  }
}

async function upsertPartnerSubscriptionFromSession(session: Record<string, unknown>) {
  const metadata = (session.metadata as Record<string, unknown> | undefined) || {}
  if (metadata.source !== 'partner_subscription') return { skipped: true, reason: 'not_partner_subscription' }

  const subscriptionId = stripeObjectId(session.subscription)
  if (subscriptionId) {
    const subscription = await stripeGet(`subscriptions/${encodeURIComponent(subscriptionId)}`)
    if (subscription) {
      return upsertPartnerSubscriptionFromStripeSubscription(subscription, {
        metadata,
        stripe_checkout_session_id: session.id,
        stripe_customer_id: stripeObjectId(session.customer),
      })
    }
  }

  const userId = cleanText(metadata.user_id)
  if (!userId) return { skipped: true, reason: 'missing_user_id' }

  const admin = adminClient()
  const patch = {
    user_id: userId,
    partner_profile_id: cleanText(metadata.partner_profile_id) || null,
    plan_key: cleanText(metadata.plan_key, 'active_partner_monthly'),
    billing_interval: cleanText(metadata.billing_interval, 'monthly'),
    status: cleanText(session.payment_status) === 'paid' ? 'active' : 'inactive',
    stripe_customer_id: stripeObjectId(session.customer) || null,
    stripe_subscription_id: subscriptionId || null,
    stripe_checkout_session_id: cleanText(session.id),
    metadata: {
      source: 'checkout_session_completed',
      payment_status: cleanText(session.payment_status),
    },
  }

  const updated = await updateSubscriptionRows(admin, {
    subscriptionId,
    checkoutSessionId: cleanText(session.id),
  }, patch)
  if (updated) return { ok: true, subscription: updated }

  const { data: inserted, error } = await admin
    .from('partner_subscriptions')
    .insert(patch)
    .select('*')
    .single()
  if (error) throw error
  return { ok: true, subscription: inserted }
}

async function updatePartnerSubscriptionFromInvoice(invoice: Record<string, unknown>, nextStatus: 'active' | 'past_due') {
  const subscriptionId = stripeObjectId(invoice.subscription)
  if (!subscriptionId) return { skipped: true, reason: 'missing_subscription_id' }

  const admin = adminClient()
  const { data: existing, error: existingError } = await admin
    .from('partner_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()
  if (existingError) throw existingError
  if (!existing) return { skipped: true, reason: 'subscription_not_found' }

  const period = stripeInvoicePeriod(invoice)
  const priceId = stripePriceIdFromInvoice(invoice)
  const patch: Record<string, unknown> = {
    status: nextStatus,
    stripe_customer_id: stripeObjectId(invoice.customer) || null,
    metadata: {
      ...((existing.metadata as Record<string, unknown> | undefined) || {}),
      source: 'stripe_invoice_webhook',
      invoice_id: cleanText(invoice.id),
      stripe_status: cleanText(invoice.status),
    },
  }
  if (period.start) patch.current_period_start = period.start
  if (period.end) patch.current_period_end = period.end
  if (priceId) patch.stripe_price_id = priceId

  const { data, error } = await admin
    .from('partner_subscriptions')
    .update(patch)
    .eq('id', existing.id)
    .select('*')
  if (error) throw error
  if (!data?.length) return { skipped: true, reason: 'subscription_not_found' }
  return { ok: true, subscription: data[0] }
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

    if (type === 'checkout.session.completed' && object.mode === 'subscription' && object.metadata?.source === 'partner_subscription') {
      const customerDetails = object.customer_details as Record<string, unknown> | undefined
      const result = await attachActivationEmail(
        await upsertPartnerSubscriptionFromSession(object),
        cleanText(customerDetails?.email),
      )
      return jsonResponse(200, { received: true, handled: type, result })
    }
    if (type === 'customer.subscription.created' || type === 'customer.subscription.updated' || type === 'customer.subscription.deleted') {
      const result = await attachActivationEmail(
        await upsertPartnerSubscriptionFromStripeSubscription(object),
      )
      return jsonResponse(200, { received: true, handled: type, result })
    }
    if (type === 'invoice.payment_succeeded' && object.subscription) {
      const customerEmail = cleanText(object.customer_email)
      const result = await attachActivationEmail(
        await updatePartnerSubscriptionFromInvoice(object, 'active'),
        customerEmail,
      )
      return jsonResponse(200, { received: true, handled: type, result })
    }
    if (type === 'invoice.payment_failed' && object.subscription) {
      const result = await updatePartnerSubscriptionFromInvoice(object, 'past_due')
      return jsonResponse(200, { received: true, handled: type, result })
    }
    return jsonResponse(200, { received: true, ignored: type })
  } catch (error) {
    console.error('payments-webhook error', error)
    return jsonResponse(400, { error: error instanceof Error ? error.message : 'Webhook failed.' })
  }
})
