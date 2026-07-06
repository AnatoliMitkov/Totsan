import { supabase, supabasePublicKey, supabaseUrl } from './supabase.js'

export const PARTNER_BILLING_INTERVALS = {
  monthly: {
    value: 'monthly',
    label: 'Месечно',
    helper: '',
  },
  yearly: {
    value: 'yearly',
    label: 'Годишно -17%',
    helper: 'Спестявате 17% — приблизително 2 месеца безплатно.',
  },
}

export const PARTNER_SUBSCRIPTION_PLANS = [
  {
    id: 'active_partner',
    name: 'Активен партньор',
    audience: 'за майстори, малки екипи и специалисти',
    highlighted: true,
    prices: {
      monthly: {
        key: 'active_partner_monthly',
        amount: '39 €',
        period: '/ месец',
        displayAmount: '39 €',
        displayPeriod: '/ месец',
        billingHelper: 'Таксуване месечно.',
        legal: '39 € / месец',
      },
      yearly: {
        key: 'active_partner_yearly',
        amount: '389 €',
        period: '/ година',
        displayAmount: '32 €',
        displayPeriod: '/ месец',
        billingHelper: '389 € / година, таксуване годишно',
        savingsLabel: 'Спести 79 € / година',
        savingsTooltip: '389 € годишно вместо 468 € при месечно плащане.',
        equivalent: 'приблизително 32 € / месец',
        exactEquivalent: '32.42 € / месец',
        badge: 'Спестявате 17%',
        legal: '389 € / година',
      },
    },
    features: [
      'Активен публичен профил',
      'Видимост в каталога',
      'Структурирани клиентски запитвания',
      'Портфолио с проекти',
      'Услуги, специализации и оферти',
      'Ревюта и история на комуникацията',
      'Достъп до проектна информация и груба локация преди сделка',
      'Точна локация след потвърдена поръчка',
    ],
    cta: 'Избери план',
  },
  {
    id: 'company_team',
    name: 'Компания / Екип',
    audience: 'за фирми, студиа, доставчици и по-големи партньори',
    highlighted: false,
    prices: {
      monthly: {
        key: 'company_team_monthly',
        amount: '79 €',
        period: '/ месец',
        displayAmount: '79 €',
        displayPeriod: '/ месец',
        billingHelper: 'Таксуване месечно.',
        legal: '79 € / месец',
      },
      yearly: {
        key: 'company_team_yearly',
        amount: '789 €',
        period: '/ година',
        displayAmount: '66 €',
        displayPeriod: '/ месец',
        billingHelper: '789 € / година, таксуване годишно',
        savingsLabel: 'Спести 159 € / година',
        savingsTooltip: '789 € годишно вместо 948 € при месечно плащане.',
        equivalent: 'приблизително 66 € / месец',
        exactEquivalent: '65.75 € / месец',
        badge: 'Спестявате 17%',
        legal: '789 € / година',
      },
    },
    features: [
      'Всичко от Активен партньор',
      'Повече категории и услуги',
      'Повече региони',
      'Фирмен профил',
      'Разширено фирмено представяне',
      'Повече портфолио проекти',
      'Приоритетна обработка на профила',
    ],
    cta: 'Избери план',
  },
]

export const PARTNER_SUBSCRIPTION_PLAN_BY_KEY = PARTNER_SUBSCRIPTION_PLANS.reduce((map, plan) => {
  Object.values(plan.prices).forEach((price) => {
    map[price.key] = {
      ...price,
      planId: plan.id,
      planName: plan.name,
      audience: plan.audience,
    }
  })
  return map
}, {})

export const PARTNER_SUBSCRIPTION_STATUS_LABELS = {
  inactive: 'На пауза',
  founding_free: 'Промо достъп',
  trialing: 'Пробен период',
  active: 'Активен',
  past_due: 'Плащане с проблем',
  canceled: 'Отказан',
  expired: 'Изтекъл',
}

export function getPartnerPlanPrice(plan, interval = 'monthly') {
  return plan?.prices?.[interval] || plan?.prices?.monthly || null
}

export function normalizePartnerSubscription(row = null) {
  if (!row) {
    return {
      status: 'inactive',
      planKey: '',
      billingInterval: '',
      active: false,
      row: null,
    }
  }

  const status = row.status || 'inactive'
  const active = hasActivePartnerAccess(row)
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  return {
    id: row.id || '',
    userId: row.user_id || '',
    partnerProfileId: row.partner_profile_id || '',
    planKey: row.plan_key || '',
    plan: PARTNER_SUBSCRIPTION_PLAN_BY_KEY[row.plan_key] || null,
    billingInterval: row.billing_interval || '',
    status,
    statusLabel: PARTNER_SUBSCRIPTION_STATUS_LABELS[status] || status,
    stripeCustomerId: row.stripe_customer_id || '',
    stripeSubscriptionId: row.stripe_subscription_id || '',
    stripeCheckoutSessionId: row.stripe_checkout_session_id || '',
    currentPeriodStart: row.current_period_start || null,
    currentPeriodEnd: row.current_period_end || null,
    trialEnd: row.trial_end || null,
    campaignEnd: row.campaign_end || null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    invoiceUrl: metadata.activation_email_invoice_url || '',
    invoicePdf: metadata.activation_email_invoice_pdf || '',
    activationEmailSentAt: metadata.activation_email_sent_at || null,
    activationEmailError: metadata.activation_email_error || '',
    active,
    row,
  }
}

export function hasActivePartnerAccess(subscription = null, now = new Date()) {
  if (!subscription) return false
  const status = subscription.status || ''
  const time = now instanceof Date ? now.getTime() : new Date(now).getTime()

  function isFuture(value) {
    if (!value) return false
    const date = new Date(value)
    return Number.isFinite(date.getTime()) && date.getTime() > time
  }

  if (status === 'founding_free') return isFuture(subscription.campaign_end)
  if (status === 'trialing') return isFuture(subscription.trial_end || subscription.current_period_end)
  if (status === 'active') return !subscription.current_period_end || isFuture(subscription.current_period_end)
  return false
}

export function formatSubscriptionDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('bg-BG', { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

export function getPartnerSubscriptionEndLabel(subscription) {
  if (!subscription) return ''
  if (subscription.status === 'founding_free') return formatSubscriptionDate(subscription.campaignEnd || subscription.campaign_end)
  if (subscription.status === 'trialing') return formatSubscriptionDate(subscription.trialEnd || subscription.trial_end)
  return formatSubscriptionDate(subscription.currentPeriodEnd || subscription.current_period_end)
}

function isMissingSubscriptionsTable(error) {
  const text = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return text.includes('partner_subscriptions') && (
    text.includes('does not exist')
    || text.includes('schema cache')
    || text.includes('relation')
  )
}

async function invokeSubscriptionFunction(functionName, payload = {}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Влез в профила си, за да продължиш с абонамента.')
  if (!supabaseUrl || !supabasePublicKey) throw new Error('Липсва Supabase конфигурация за абонаментите.')

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabasePublicKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.error) {
    const error = new Error(data?.error || 'Абонаментното действие не беше успешно.')
    error.code = data?.code || ''
    error.subscription = data?.subscription ? normalizePartnerSubscription(data.subscription) : null
    throw error
  }
  return data
}

export async function loadOwnPartnerSubscription() {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id
  if (!userId) return normalizePartnerSubscription(null)

  const { data, error } = await supabase
    .from('partner_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(10)

  if (error) {
    if (isMissingSubscriptionsTable(error)) return normalizePartnerSubscription(null)
    throw error
  }

  const rows = Array.isArray(data) ? data : []
  const row = rows.find((item) => hasActivePartnerAccess(item)) || rows[0] || null
  return normalizePartnerSubscription(row)
}

export function startPartnerSubscriptionCheckout({ planKey, billingInterval, consents, origin = window.location.origin }) {
  return invokeSubscriptionFunction('subscriptions-checkout', {
    planKey,
    billingInterval,
    origin,
    consents,
  })
}

export function syncPartnerSubscriptionSession(sessionId) {
  return invokeSubscriptionFunction('subscriptions-checkout', {
    action: 'sync',
    sessionId,
  })
}

export async function reconcilePartnerSubscription() {
  const result = await invokeSubscriptionFunction('subscriptions-checkout', {
    action: 'reconcile',
  })
  return {
    ...result,
    subscription: normalizePartnerSubscription(result?.subscription || null),
  }
}

export async function ensurePartnerSubscriptionActivationEmail({ force = false } = {}) {
  const result = await invokeSubscriptionFunction('subscriptions-checkout', {
    action: 'notify',
    force,
  })
  return {
    ...result,
    subscription: normalizePartnerSubscription(result?.subscription || null),
  }
}

export function createPartnerSubscriptionPortal(origin = window.location.origin) {
  return invokeSubscriptionFunction('subscriptions-portal', { origin })
}

export async function cancelPartnerSubscriptionAtPeriodEnd() {
  const result = await invokeSubscriptionFunction('subscriptions-portal', {
    action: 'cancel_at_period_end',
  })
  return {
    ...result,
    subscription: normalizePartnerSubscription(result?.subscription || null),
  }
}

export async function resumePartnerSubscriptionRenewal() {
  const result = await invokeSubscriptionFunction('subscriptions-portal', {
    action: 'resume',
  })
  return {
    ...result,
    subscription: normalizePartnerSubscription(result?.subscription || null),
  }
}
