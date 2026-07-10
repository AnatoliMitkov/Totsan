export function cleanText(value: unknown, fallback = '') {
  return String(value ?? '').trim() || fallback
}

export function stripeObjectId(value: unknown) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object' && !Array.isArray(value)) {
    return cleanText((value as Record<string, unknown>).id)
  }
  return ''
}

export function toIsoFromUnix(value: unknown) {
  const seconds = Number(value || 0)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return new Date(seconds * 1000).toISOString()
}

function subscriptionItem(subscription: Record<string, unknown>) {
  const items = subscription.items as { data?: Array<Record<string, unknown>> } | undefined
  return items?.data?.[0] || null
}

export function stripePriceIdFromSubscription(subscription: Record<string, unknown>) {
  const item = subscriptionItem(subscription)
  const price = item?.price as Record<string, unknown> | undefined
  return cleanText(price?.id)
}

export function stripeSubscriptionPeriod(subscription: Record<string, unknown>) {
  const item = subscriptionItem(subscription)
  return {
    start: toIsoFromUnix(item?.current_period_start || subscription.current_period_start),
    end: toIsoFromUnix(item?.current_period_end || subscription.current_period_end),
  }
}

export function planKeyFromPriceId(priceId: string) {
  const pairs: Array<[string, string]> = [
    ['active_partner_monthly', Deno.env.get('STRIPE_PRICE_PARTNER_ACTIVE_MONTHLY') || ''],
    ['active_partner_yearly', Deno.env.get('STRIPE_PRICE_PARTNER_ACTIVE_YEARLY') || ''],
    ['company_team_monthly', Deno.env.get('STRIPE_PRICE_PARTNER_COMPANY_MONTHLY') || ''],
    ['company_team_yearly', Deno.env.get('STRIPE_PRICE_PARTNER_COMPANY_YEARLY') || ''],
  ]
  return pairs.find(([, configuredPriceId]) => configuredPriceId && configuredPriceId === priceId)?.[0] || ''
}

export function billingIntervalFromSubscription(subscription: Record<string, unknown>, planKey = '') {
  if (planKey.endsWith('_yearly')) return 'yearly'
  if (planKey.endsWith('_monthly')) return 'monthly'

  const item = subscriptionItem(subscription)
  const price = item?.price as Record<string, unknown> | undefined
  const recurring = price?.recurring as Record<string, unknown> | undefined
  const interval = cleanText(recurring?.interval)
  return interval === 'year' ? 'yearly' : interval === 'month' ? 'monthly' : ''
}

export function mapStripeSubscriptionStatus(value: unknown) {
  const status = cleanText(value).toLowerCase()
  if (status === 'active') return 'active'
  if (status === 'trialing') return 'trialing'
  if (status === 'canceled') return 'canceled'
  if (status === 'incomplete_expired') return 'expired'
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete' || status === 'paused') return 'past_due'
  return 'inactive'
}

export function hasActiveStripeAccess(subscription: Record<string, unknown> | null | undefined) {
  const status = cleanText(subscription?.status).toLowerCase()
  return status === 'active' || status === 'trialing'
}

export function hasActiveDatabaseAccess(subscription: Record<string, unknown> | null | undefined, now = Date.now()) {
  if (!subscription) return false
  const status = cleanText(subscription.status)

  function future(value: unknown) {
    if (!value) return false
    const time = new Date(String(value)).getTime()
    return Number.isFinite(time) && time > now
  }

  if (status === 'founding_free') return future(subscription.campaign_end)
  if (status === 'trialing') return future(subscription.trial_end || subscription.current_period_end)
  if (status === 'active') return !subscription.current_period_end || future(subscription.current_period_end)
  return false
}

export async function syncPartnerProfileSubscriptionAccess(
  admin: any,
  subscription: Record<string, unknown> | null | undefined,
  wasActive = false,
) {
  if (!subscription) return
  const isActive = hasActiveDatabaseAccess(subscription)
  if (isActive === wasActive) return

  const profileId = cleanText(subscription.partner_profile_id)
  const userId = cleanText(subscription.user_id)
  if (!profileId && !userId) return

  let query = admin.from('profiles').update({ is_published: isActive })
  query = profileId ? query.eq('id', profileId) : query.eq('user_id', userId)
  const { error } = await query
  if (error) throw error
}

export function stripeSecret() {
  const secret = cleanText(Deno.env.get('STRIPE_SECRET_KEY'))
  if (!secret) throw new Error('Липсва STRIPE_SECRET_KEY за абонаментни плащания.')
  return secret
}

export async function stripeRequest(path: string, options: { method?: 'GET' | 'POST'; body?: URLSearchParams } = {}) {
  const method = options.method || 'GET'
  const headers: Record<string, string> = {
    Authorization: `Bearer ${stripeSecret()}`,
  }
  const request: RequestInit = { method, headers }

  if (method === 'POST' && options.body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    request.body = options.body
  }

  const response = await fetch(`https://api.stripe.com/v1/${path}`, request)
  const data = await response.json()
  if (!response.ok) {
    const message = cleanText(
      (data as { error?: { message?: string } })?.error?.message,
      'Заявката към платежния доставчик не беше успешна.',
    )
    throw new Error(message)
  }
  return data as Record<string, unknown>
}

async function safeStripeGet(path: string) {
  try {
    return await stripeRequest(path)
  } catch (error) {
    console.error('Stripe reconciliation lookup failed', path, error)
    return null
  }
}

function candidateRank(subscription: Record<string, unknown>) {
  const status = cleanText(subscription.status).toLowerCase()
  const statusRank = status === 'active' || status === 'trialing'
    ? 5
    : status === 'past_due' || status === 'unpaid'
      ? 3
      : status === 'incomplete'
        ? 2
        : 1
  return statusRank * 10_000_000_000 + Number(subscription.created || 0)
}

export async function upsertPartnerSubscription(
  admin: any,
  subscription: Record<string, unknown>,
  fallback: Record<string, unknown> = {},
) {
  const subscriptionMetadata = (subscription.metadata as Record<string, unknown> | undefined) || {}
  const subscriptionId = cleanText(subscription.id || fallback.stripe_subscription_id)
  if (!subscriptionId) return null

  let existing = null
  const { data: bySubscription, error: bySubscriptionError } = await admin
    .from('partner_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()
  if (bySubscriptionError) throw bySubscriptionError
  existing = bySubscription

  const checkoutSessionId = cleanText(fallback.stripe_checkout_session_id)
  if (!existing && checkoutSessionId) {
    const { data: bySession, error: bySessionError } = await admin
      .from('partner_subscriptions')
      .select('*')
      .eq('stripe_checkout_session_id', checkoutSessionId)
      .maybeSingle()
    if (bySessionError) throw bySessionError
    existing = bySession
  }

  if (!existing && fallback.row_id) {
    const { data: byId, error: byIdError } = await admin
      .from('partner_subscriptions')
      .select('*')
      .eq('id', fallback.row_id)
      .maybeSingle()
    if (byIdError) throw byIdError
    existing = byId
  }

  const metadata = {
    ...((existing?.metadata as Record<string, unknown> | undefined) || {}),
    ...((fallback.metadata as Record<string, unknown> | undefined) || {}),
    ...subscriptionMetadata,
    last_synced_at: new Date().toISOString(),
    last_sync_source: cleanText(fallback.sync_source, 'stripe_reconciliation'),
    stripe_status: cleanText(subscription.status),
  }
  const userId = cleanText(subscriptionMetadata.user_id || fallback.user_id || existing?.user_id)
  if (!userId) return null

  const priceId = stripePriceIdFromSubscription(subscription)
    || cleanText(fallback.stripe_price_id || existing?.stripe_price_id)
  const planKey = cleanText(
    subscriptionMetadata.plan_key
      || fallback.plan_key
      || existing?.plan_key
      || planKeyFromPriceId(priceId),
    'active_partner_monthly',
  )
  const billingInterval = cleanText(
    subscriptionMetadata.billing_interval
      || fallback.billing_interval
      || existing?.billing_interval
      || billingIntervalFromSubscription(subscription, planKey),
    'monthly',
  )
  const period = stripeSubscriptionPeriod(subscription)
  const wasActive = hasActiveDatabaseAccess(existing)
  const patch = {
    user_id: userId,
    partner_profile_id: cleanText(
      subscriptionMetadata.partner_profile_id || fallback.partner_profile_id || existing?.partner_profile_id,
    ) || null,
    plan_key: planKey,
    billing_interval: billingInterval,
    status: mapStripeSubscriptionStatus(subscription.status),
    stripe_customer_id: stripeObjectId(subscription.customer || fallback.stripe_customer_id || existing?.stripe_customer_id) || null,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: priceId || null,
    stripe_checkout_session_id: checkoutSessionId || existing?.stripe_checkout_session_id || null,
    current_period_start: period.start,
    current_period_end: period.end,
    trial_start: toIsoFromUnix(subscription.trial_start),
    trial_end: toIsoFromUnix(subscription.trial_end),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    metadata,
  }

  if (existing?.id) {
    const { data, error } = await admin
      .from('partner_subscriptions')
      .update(patch)
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw error
    await syncPartnerProfileSubscriptionAccess(admin, data, wasActive)
    return data
  }

  const { data, error } = await admin
    .from('partner_subscriptions')
    .insert(patch)
    .select('*')
    .single()
  if (error) {
    // A webhook and a return-page reconciliation can race. Resolve that safely
    // against the unique Stripe subscription id instead of creating duplicates.
    const { data: raced, error: racedError } = await admin
      .from('partner_subscriptions')
      .update(patch)
      .eq('stripe_subscription_id', subscriptionId)
      .select('*')
      .maybeSingle()
    if (racedError || !raced) throw error
    await syncPartnerProfileSubscriptionAccess(admin, raced, false)
    return raced
  }
  await syncPartnerProfileSubscriptionAccess(admin, data, false)
  return data
}

export async function reconcilePartnerSubscription(
  admin: any,
  user: { id: string; email?: string | null },
  options: { sessionId?: string; syncSource?: string } = {},
) {
  const { data: rows, error: rowsError } = await admin
    .from('partner_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(20)
  if (rowsError) throw rowsError

  const localRows = Array.isArray(rows) ? rows : []
  const localNonStripeAccess = localRows.find((row) => !row.stripe_subscription_id && hasActiveDatabaseAccess(row))
  if (localNonStripeAccess) return { subscription: localNonStripeAccess, stripeSubscription: null, repaired: false }

  const candidates = new Map<string, Record<string, unknown>>()
  const customerIds = new Set<string>()
  let checkoutSession: Record<string, unknown> | null = null

  if (options.sessionId) {
    checkoutSession = await stripeRequest(`checkout/sessions/${encodeURIComponent(options.sessionId)}`)
    const sessionMetadata = (checkoutSession.metadata as Record<string, unknown> | undefined) || {}
    const ownerId = cleanText(checkoutSession.client_reference_id || sessionMetadata.user_id)
    if (ownerId !== user.id) throw new Error('Тази плащателна сесия не съвпада с вашия профил.')
    if (cleanText(checkoutSession.status) !== 'complete' && cleanText(checkoutSession.payment_status) !== 'paid') {
      return { subscription: localRows[0] || null, stripeSubscription: null, repaired: false }
    }
    const subscriptionId = stripeObjectId(checkoutSession.subscription)
    if (subscriptionId) {
      const subscription = await safeStripeGet(`subscriptions/${encodeURIComponent(subscriptionId)}`)
      if (subscription) candidates.set(subscriptionId, subscription)
    }
    const customerId = stripeObjectId(checkoutSession.customer)
    if (customerId) customerIds.add(customerId)
  }

  for (const row of localRows) {
    const subscriptionId = cleanText(row.stripe_subscription_id)
    const customerId = cleanText(row.stripe_customer_id)
    if (customerId) customerIds.add(customerId)
    if (!subscriptionId || candidates.has(subscriptionId)) continue
    const subscription = await safeStripeGet(`subscriptions/${encodeURIComponent(subscriptionId)}`)
    if (subscription) candidates.set(subscriptionId, subscription)
  }

  const email = cleanText(user.email).toLowerCase()
  if (email) {
    const customerList = await safeStripeGet(`customers?email=${encodeURIComponent(email)}&limit=20`)
    const customers = (customerList?.data as Array<Record<string, unknown>> | undefined) || []
    for (const customer of customers) {
      const customerId = cleanText(customer.id)
      if (customerId) customerIds.add(customerId)
    }
  }

  for (const customerId of customerIds) {
    const subscriptionList = await safeStripeGet(
      `subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=100`,
    )
    const subscriptions = (subscriptionList?.data as Array<Record<string, unknown>> | undefined) || []
    for (const subscription of subscriptions) {
      const subscriptionId = cleanText(subscription.id)
      const metadata = (subscription.metadata as Record<string, unknown> | undefined) || {}
      const metadataUserId = cleanText(metadata.user_id)
      if (!subscriptionId || (metadataUserId && metadataUserId !== user.id)) continue
      candidates.set(subscriptionId, subscription)
    }
  }

  const preferred = [...candidates.values()].sort((left, right) => candidateRank(right) - candidateRank(left))[0]
  if (!preferred) {
    return { subscription: localRows[0] || null, stripeSubscription: null, repaired: false }
  }

  const preferredCustomerId = stripeObjectId(preferred.customer)
  const reusableRow = localRows.find((row) => (
    !row.stripe_subscription_id
    && (
      cleanText(row.stripe_customer_id) === preferredCustomerId
      || cleanText(row.status) === 'inactive'
    )
  ))
  const sessionMetadata = (checkoutSession?.metadata as Record<string, unknown> | undefined) || {}
  const profileId = cleanText(
    sessionMetadata.partner_profile_id
      || reusableRow?.partner_profile_id
      || localRows.find((row) => row.partner_profile_id)?.partner_profile_id,
  )
  const subscription = await upsertPartnerSubscription(admin, preferred, {
    row_id: reusableRow?.id,
    user_id: user.id,
    partner_profile_id: profileId,
    stripe_checkout_session_id: cleanText(checkoutSession?.id),
    stripe_customer_id: preferredCustomerId,
    plan_key: cleanText(sessionMetadata.plan_key),
    billing_interval: cleanText(sessionMetadata.billing_interval),
    sync_source: options.syncSource || (options.sessionId ? 'checkout_return' : 'profile_reconciliation'),
  })

  return {
    subscription,
    stripeSubscription: preferred,
    repaired: Boolean(subscription && !localRows.some((row) => row.id === subscription.id && row.status === subscription.status)),
  }
}

function subscriptionPlanLabel(planKey: unknown) {
  const key = cleanText(planKey)
  if (key.startsWith('company_team')) return 'Компания / Екип'
  return 'Активен партньор'
}

function subscriptionIntervalLabel(value: unknown) {
  return cleanText(value) === 'yearly' ? 'Годишно' : 'Месечно'
}

function subscriptionAmountLabel(planKey: unknown) {
  const amounts: Record<string, string> = {
    active_partner_monthly: '39 €',
    active_partner_yearly: '389 €',
    company_team_monthly: '79 €',
    company_team_yearly: '789 €',
  }
  return amounts[cleanText(planKey)] || ''
}

function subscriptionDateLabel(value: unknown) {
  const date = new Date(cleanText(value))
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('bg-BG', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Sofia',
  }).format(date)
}

function profileUrl() {
  const origin = cleanText(Deno.env.get('SITE_URL') || Deno.env.get('APP_URL'), 'https://totsan.com')
    .replace(/\/$/, '')
  return `${origin}/moy-profil`
}

async function storeEmailResult(
  admin: any,
  subscription: Record<string, unknown>,
  key: string,
  result: Record<string, unknown>,
) {
  if (!subscription.id) return subscription
  const metadata = {
    ...((subscription.metadata as Record<string, unknown> | undefined) || {}),
    [`${key}_attempted_at`]: new Date().toISOString(),
    [`${key}_sent_at`]: result.sent ? new Date().toISOString() : null,
    [`${key}_provider_id`]: cleanText(result.id) || null,
    [`${key}_channel`]: cleanText(result.channel) || null,
    [`${key}_invoice_url`]: cleanText(result.invoiceUrl) || null,
    [`${key}_invoice_pdf`]: cleanText(result.invoicePdf) || null,
    [`${key}_error`]: result.sent ? null : cleanText(result.reason, 'email_not_sent'),
  }
  const { data, error } = await admin
    .from('partner_subscriptions')
    .update({ metadata })
    .eq('id', subscription.id)
    .select('*')
    .single()
  if (error) {
    console.error('Could not store subscription email status', error)
    return subscription
  }
  return data
}

export async function sendActivationEmailIfNeeded(
  admin: any,
  subscription: Record<string, unknown> | null | undefined,
  recipientEmail: string,
  options: { force?: boolean } = {},
) {
  if (!subscription || !recipientEmail || !hasActiveDatabaseAccess(subscription)) {
    return { sent: false, skipped: true, reason: 'not_active_or_missing_email', subscription }
  }
  const metadata = (subscription.metadata as Record<string, unknown> | undefined) || {}
  if (metadata.activation_email_sent_at && !options.force) {
    return { sent: true, skipped: true, reason: 'already_sent', subscription }
  }

  const lastAttemptAt = new Date(cleanText(metadata.activation_email_attempted_at)).getTime()
  if (
    !options.force
    && Number.isFinite(lastAttemptAt)
    && Date.now() - lastAttemptAt < 10 * 60 * 1000
  ) {
    return { sent: false, skipped: true, reason: 'recently_attempted', subscription }
  }

  let result: any = await sendTotsanEmail({
    to: recipientEmail,
    subject: 'Абонаментът ви в Totsan е активен',
    html: buildSubscriptionActivatedEmail({
      plan_label: subscriptionPlanLabel(subscription.plan_key),
      billing_interval: subscriptionIntervalLabel(subscription.billing_interval),
      amount: subscriptionAmountLabel(subscription.plan_key),
      current_period_end: subscriptionDateLabel(subscription.current_period_end),
      profile_url: profileUrl(),
    }),
  })
  if (!result.sent && cleanText(result.reason) === 'email_provider_not_configured') {
    result = await sendStripeReceiptForSubscription(
      cleanText(subscription.stripe_subscription_id),
      recipientEmail,
    )
  }
  const updatedSubscription = await storeEmailResult(admin, subscription, 'activation_email', result)
  return { ...result, subscription: updatedSubscription }
}

async function sendStripeReceiptForSubscription(subscriptionId: string, recipientEmail: string) {
  if (!subscriptionId || !recipientEmail) {
    return { sent: false, reason: 'stripe_receipt_unavailable' }
  }

  try {
    const stripeSubscription = await stripeRequest(
      `subscriptions/${encodeURIComponent(subscriptionId)}`,
    )
    const invoiceId = stripeObjectId(stripeSubscription.latest_invoice)
    if (!invoiceId) return { sent: false, reason: 'stripe_invoice_not_found' }

    const invoice = await stripeRequest(`invoices/${encodeURIComponent(invoiceId)}`)
    let chargeId = stripeObjectId(invoice.charge)
    let paymentIntentId = stripeObjectId(invoice.payment_intent)

    if (!paymentIntentId) {
      const payments = invoice.payments as { data?: Array<Record<string, unknown>> } | undefined
      for (const invoicePayment of payments?.data || []) {
        const payment = invoicePayment.payment as Record<string, unknown> | undefined
        chargeId = stripeObjectId(payment?.charge || invoicePayment.charge)
        paymentIntentId = stripeObjectId(payment?.payment_intent || invoicePayment.payment_intent)
        if (chargeId || paymentIntentId) break
      }
    }

    if (!chargeId && !paymentIntentId) {
      const paymentList = await stripeRequest(
        `invoice_payments?invoice=${encodeURIComponent(invoiceId)}&status=paid&limit=10`,
      )
      const invoicePayments = (paymentList.data as Array<Record<string, unknown>> | undefined) || []
      for (const invoicePayment of invoicePayments) {
        const payment = invoicePayment.payment as Record<string, unknown> | undefined
        chargeId = stripeObjectId(payment?.charge || invoicePayment.charge)
        paymentIntentId = stripeObjectId(payment?.payment_intent || invoicePayment.payment_intent)
        if (chargeId || paymentIntentId) break
      }
    }

    if (!chargeId && paymentIntentId) {
      const paymentIntent = await stripeRequest(
        `payment_intents/${encodeURIComponent(paymentIntentId)}`,
      )
      chargeId = stripeObjectId(paymentIntent.latest_charge)
    }
    if (!chargeId) return { sent: false, reason: 'stripe_charge_not_found' }

    const params = new URLSearchParams()
    params.set('receipt_email', recipientEmail)
    const charge = await stripeRequest(
      `charges/${encodeURIComponent(chargeId)}`,
      { method: 'POST', body: params },
    )

    if (charge.livemode !== true) {
      return {
        sent: false,
        reason: 'stripe_test_mode_receipts_disabled',
        id: chargeId,
        channel: 'stripe_receipt',
        invoiceUrl: cleanText(invoice.hosted_invoice_url),
        invoicePdf: cleanText(invoice.invoice_pdf),
      }
    }
    return {
      sent: true,
      id: chargeId,
      channel: 'stripe_receipt',
      invoiceUrl: cleanText(invoice.hosted_invoice_url),
      invoicePdf: cleanText(invoice.invoice_pdf),
    }
  } catch (error) {
    console.error('Stripe receipt fallback failed', error)
    return {
      sent: false,
      reason: error instanceof Error ? error.message : 'stripe_receipt_failed',
      channel: 'stripe_receipt',
    }
  }
}

export async function sendCancellationEmail(
  admin: any,
  subscription: Record<string, unknown> | null | undefined,
  recipientEmail: string,
) {
  if (!subscription || !recipientEmail) {
    return { sent: false, skipped: true, reason: 'missing_subscription_or_email', subscription }
  }
  const result = await sendTotsanEmail({
    to: recipientEmail,
    subject: 'Подновяването на Totsan Pro е спряно',
    html: buildSubscriptionCancellationEmail({
      plan_label: subscriptionPlanLabel(subscription.plan_key),
      current_period_end: subscriptionDateLabel(subscription.current_period_end),
      profile_url: profileUrl(),
    }),
  })
  const updatedSubscription = await storeEmailResult(admin, subscription, 'cancellation_email', result)
  return { ...result, subscription: updatedSubscription }
}
import {
  buildSubscriptionActivatedEmail,
  buildSubscriptionCancellationEmail,
  sendTotsanEmail,
} from './totsan-email.js'
