import { supabase, supabasePublicKey, supabaseUrl } from './supabase.js'

async function invokePaymentAction(action, payload = {}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Влез в профила си, за да продължиш с плащането.')
  if (!supabaseUrl || !supabasePublicKey) throw new Error('Липсва Supabase конфигурация за плащанията.')

  const response = await fetch(`${supabaseUrl}/functions/v1/payments-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabasePublicKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action, payload }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.error) throw new Error(data?.error || 'Плащането не можа да се стартира.')
  return data
}

export function startCheckout({ type, id, provider = 'stripe' }) {
  return invokePaymentAction('start_checkout', {
    type,
    id,
    provider,
    origin: window.location.origin,
  })
}

export function syncStripeSession(sessionId) {
  return invokePaymentAction('sync_stripe_session', { sessionId })
}

export function runOrderAction(orderId, orderAction, note = '') {
  return invokePaymentAction('order_action', { orderId, orderAction, note })
}

export function createConnectOnboarding(origin = window.location.origin) {
  return invokePaymentAction('connect_onboarding', { origin })
}