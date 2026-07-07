import { createClient } from 'npm:@supabase/supabase-js@2.49.8'
import {
  hasActiveDatabaseAccess,
  reconcilePartnerSubscription,
  sendActivationEmailIfNeeded,
} from '../_shared/partner-subscriptions.ts'

const CAMPAIGN_END_MS = Date.parse('2026-07-31T20:59:59.999Z')
const POST_CAMPAIGN_TRIAL_DAYS = 14
const REQUIRED_CONSENTS = ['terms', 'renewal', 'noGuarantee', 'pausedProfile']

const PLAN_CONFIG: Record<string, { interval: 'monthly' | 'yearly'; envName: string }> = {
  active_partner_monthly: {
    interval: 'monthly',
    envName: 'STRIPE_PRICE_PARTNER_ACTIVE_MONTHLY',
  },
  active_partner_yearly: {
    interval: 'yearly',
    envName: 'STRIPE_PRICE_PARTNER_ACTIVE_YEARLY',
  },
  company_team_monthly: {
    interval: 'monthly',
    envName: 'STRIPE_PRICE_PARTNER_COMPANY_MONTHLY',
  },
  company_team_yearly: {
    interval: 'yearly',
    envName: 'STRIPE_PRICE_PARTNER_COMPANY_YEARLY',
  },
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function cleanText(value: unknown, fallback = '') {
  return String(value ?? '').trim() || fallback
}

function siteOrigin(req: Request, payload: Record<string, unknown>) {
  const fromPayload = cleanText(payload.origin)
  const fromHeader = cleanText(req.headers.get('Origin'))
  const fromEnv = cleanText(Deno.env.get('SITE_URL') || Deno.env.get('APP_URL'))
  return (fromPayload || fromHeader || fromEnv || 'https://totsan.com').replace(/\/$/, '')
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

async function getUser(req: Request, authorization: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Missing Supabase auth environment variables.')

  const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authorization } } })
  const { data } = await userClient.auth.getUser()
  if (data?.user) return data.user

  const claims = decodeJwtPayload(authorization.replace(/^Bearer\s+/i, ''))
  if (claims?.sub) return { id: claims.sub, email: claims.email || null }
  throw new Error('Влез в профила си, за да продължиш с абонамента.')
}

function adminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase service environment variables.')
  return createClient(supabaseUrl, serviceRoleKey)
}

function stripeSecret() {
  const secret = cleanText(Deno.env.get('STRIPE_SECRET_KEY'))
  if (!secret) throw new Error('Липсва STRIPE_SECRET_KEY за абонаментни плащания.')
  return secret
}

async function stripeRequest(path: string, body?: URLSearchParams, method = 'POST') {
  const secret = stripeSecret()
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  }
  if (method === 'POST' && body) {
    options.headers = {
      ...options.headers,
      'Content-Type': 'application/x-www-form-urlencoded',
    }
    options.body = body
  }
  const response = await fetch(`https://api.stripe.com/v1/${path}`, options)
  const data = await response.json()
  if (!response.ok) {
    const message = cleanText((data as { error?: { message?: string } })?.error?.message, 'Заявката към платежния доставчик не беше успешна.')
    throw new Error(message)
  }
  return data as Record<string, unknown>
}

function toIsoFromUnix(value: unknown) {
  const seconds = Number(value || 0)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return new Date(seconds * 1000).toISOString()
}

function stripePriceIdFromSubscription(subscription: Record<string, unknown>) {
  const items = subscription.items as { data?: Array<Record<string, unknown>> } | undefined
  const price = items?.data?.[0]?.price as Record<string, unknown> | undefined
  return cleanText(price?.id)
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

function assertConsents(value: unknown) {
  const consents = (value && typeof value === 'object' && !Array.isArray(value)) ? value as Record<string, unknown> : {}
  const missing = REQUIRED_CONSENTS.filter((key) => consents[key] !== true)
  if (missing.length) throw new Error('Потвърди условията, преди да продължиш към абонамент.')
  return consents
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Only POST is supported.' })

  try {
    const authorization = req.headers.get('Authorization') || ''
    const user = await getUser(req, authorization)
    const payload = await req.json().catch(() => ({})) as Record<string, unknown>
    const admin = adminClient()

    if (payload.action === 'notify') {
      const { data: subscriptionRows, error: subscriptionError } = await admin
        .from('partner_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(20)
      if (subscriptionError) throw subscriptionError

      const subscription = (subscriptionRows || []).find((row: Record<string, unknown>) => (
        hasActiveDatabaseAccess(row)
      ))
      if (!subscription) {
        return jsonResponse(404, {
          error: 'Няма активен партньорски план, за който да изпратим потвърждение.',
          code: 'active_subscription_not_found',
        })
      }

      const emailResult = await sendActivationEmailIfNeeded(
        admin,
        subscription,
        cleanText(user.email),
        { force: payload.force === true },
      )
      return jsonResponse(200, {
        ok: Boolean(emailResult.sent),
        subscription: emailResult.subscription || subscription,
        email: {
          sent: Boolean(emailResult.sent),
          skipped: Boolean(emailResult.skipped),
          reason: cleanText(emailResult.reason),
          channel: cleanText(emailResult.channel),
        },
      })
    }

    if (payload.action === 'sync' || payload.action === 'reconcile') {
      const sessionId = cleanText(payload.sessionId)
      if (payload.action === 'sync' && !sessionId) {
        throw new Error('Липсва номер на сесия (session ID).')
      }

      const result = await reconcilePartnerSubscription(admin, user, {
        sessionId,
        syncSource: sessionId ? 'checkout_return' : 'profile_reconciliation',
      })
      const emailResult = result.subscription
        ? await sendActivationEmailIfNeeded(admin, result.subscription, cleanText(user.email))
        : { sent: false, skipped: true, reason: 'subscription_not_found' }
      const subscription = emailResult.subscription || result.subscription

      return jsonResponse(200, {
        ok: Boolean(subscription),
        synchronized: Boolean(subscription),
        repaired: result.repaired,
        subscription,
        email: {
          sent: Boolean(emailResult.sent),
          skipped: Boolean(emailResult.skipped),
          reason: cleanText(emailResult.reason),
        },
      })
    }

    const planKey = cleanText(payload.planKey)
    const plan = PLAN_CONFIG[planKey]
    if (!plan) throw new Error('Избраният партньорски план не е валиден.')

    const billingInterval = cleanText(payload.billingInterval, plan.interval)
    if (billingInterval !== plan.interval) throw new Error('Периодът на плащане не отговаря на избрания план.')

    const consents = assertConsents(payload.consents)
    const priceId = cleanText(Deno.env.get(plan.envName))
    if (!priceId) throw new Error(`Липсва ${plan.envName}. Добави ценови идентификатор за плана в Supabase Edge Function env.`)

    const { data: account, error: accountError } = await admin
      .from('accounts')
      .select('email, role, specialist_status, account_status')
      .eq('id', user.id)
      .maybeSingle()
    if (accountError) throw accountError
    if (account?.account_status === 'banned' || account?.account_status === 'suspended') {
      return jsonResponse(403, { error: 'Този акаунт няма достъп до партньорски абонамент.' })
    }
    if (account?.role !== 'specialist' || account?.specialist_status !== 'approved') {
      return jsonResponse(403, { error: 'Абонаментът може да се активира след одобрен партньорски профил.' })
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, name, slug, is_published')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (profileError) throw profileError
    if (!profile?.id) throw new Error('Първо трябва да имаш партньорски профил, за да активираш абонамент.')

    const reconciliation = await reconcilePartnerSubscription(admin, user, {
      syncSource: 'checkout_duplicate_guard',
    })
    if (hasActiveDatabaseAccess(reconciliation.subscription)) {
      const emailResult = await sendActivationEmailIfNeeded(
        admin,
        reconciliation.subscription,
        cleanText(user.email || account?.email),
      )
      return jsonResponse(409, {
        error: 'Вече имате активен партньорски план. Управлявайте текущия абонамент от профила си.',
        code: 'active_subscription',
        subscription: emailResult.subscription || reconciliation.subscription,
      })
    }

    const { data: pendingCheckout, error: pendingCheckoutError } = await admin
      .from('partner_subscriptions')
      .select('stripe_checkout_session_id, created_at')
      .eq('user_id', user.id)
      .eq('plan_key', planKey)
      .eq('billing_interval', billingInterval)
      .eq('status', 'inactive')
      .not('stripe_checkout_session_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (pendingCheckoutError) throw pendingCheckoutError

    const pendingSessionId = cleanText(pendingCheckout?.stripe_checkout_session_id)
    const pendingCreatedAt = new Date(cleanText(pendingCheckout?.created_at)).getTime()
    if (pendingSessionId && Number.isFinite(pendingCreatedAt) && Date.now() - pendingCreatedAt < 23 * 60 * 60 * 1000) {
      try {
        const pendingSession = await stripeRequest(
          `checkout/sessions/${encodeURIComponent(pendingSessionId)}`,
          undefined,
          'GET',
        )
        const pendingUrl = cleanText(pendingSession.url)
        if (cleanText(pendingSession.status) === 'open' && pendingUrl) {
          return jsonResponse(200, {
            ok: true,
            checkoutUrl: pendingUrl,
            sessionId: pendingSessionId,
            planKey,
            billingInterval,
            reused: true,
          })
        }
      } catch (error) {
        console.warn('Could not reuse pending Stripe Checkout session', error)
      }
    }

    const { data: existingSubscription, error: existingSubscriptionError } = await admin
      .from('partner_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existingSubscriptionError) throw existingSubscriptionError

    const origin = siteOrigin(req, payload)
    const trialDays = Date.now() > CAMPAIGN_END_MS ? POST_CAMPAIGN_TRIAL_DAYS : 0
    const params = new URLSearchParams()
    params.set('mode', 'subscription')
    params.set('line_items[0][price]', priceId)
    params.set('line_items[0][quantity]', '1')
    params.set('success_url', `${origin}/moy-profil?subscription=success&session_id={CHECKOUT_SESSION_ID}`)
    params.set('cancel_url', `${origin}/pro?subscription=cancelled`)
    params.set('client_reference_id', user.id)
    params.set('metadata[source]', 'partner_subscription')
    params.set('metadata[user_id]', user.id)
    params.set('metadata[partner_profile_id]', profile.id)
    params.set('metadata[plan_key]', planKey)
    params.set('metadata[billing_interval]', billingInterval)
    params.set('subscription_data[metadata][source]', 'partner_subscription')
    params.set('subscription_data[metadata][user_id]', user.id)
    params.set('subscription_data[metadata][partner_profile_id]', profile.id)
    params.set('subscription_data[metadata][plan_key]', planKey)
    params.set('subscription_data[metadata][billing_interval]', billingInterval)
    if (trialDays > 0) params.set('subscription_data[trial_period_days]', String(trialDays))

    const existingCustomerId = cleanText(existingSubscription?.stripe_customer_id)
    if (existingCustomerId) {
      params.set('customer', existingCustomerId)
    } else {
      const email = cleanText(user.email || account?.email)
      if (email) params.set('customer_email', email)
    }

    const session = await stripeRequest('checkout/sessions', params)
    const sessionId = cleanText(session.id)
    const checkoutUrl = cleanText(session.url)
    if (!sessionId || !checkoutUrl) throw new Error('Платежната сесия не беше създадена коректно.')

    const { error: checkoutRecordError } = await admin.from('partner_subscriptions').insert({
      user_id: user.id,
      partner_profile_id: profile.id,
      plan_key: planKey,
      billing_interval: billingInterval,
      status: 'inactive',
      stripe_customer_id: existingCustomerId || null,
      stripe_price_id: priceId,
      stripe_checkout_session_id: sessionId,
      metadata: {
        source: 'checkout_started',
        consents,
        trial_days: trialDays,
      },
    })
    if (checkoutRecordError) throw checkoutRecordError

    return jsonResponse(200, {
      ok: true,
      checkoutUrl,
      sessionId,
      planKey,
      billingInterval,
      trialDays,
    })
  } catch (error) {
    console.error('subscriptions-checkout error', error)
    return jsonResponse(400, { error: error instanceof Error ? error.message : 'Абонаментният checkout не беше успешен.' })
  }
})
