import { supabase, supabasePublicKey, supabaseUrl } from './supabase.js'

async function invokeOrderAction(action, payload = {}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Влез в профила си, за да продължиш.')
  if (!supabaseUrl || !supabasePublicKey) throw new Error('Липсва конфигурация за управление на поръчката.')

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
  if (!response.ok || data?.error) throw new Error(data?.error || 'Действието по поръчката не беше успешно.')
  return data
}

export function runOrderAction(orderId, orderAction, note = '') {
  return invokeOrderAction('order_action', { orderId, orderAction, note })
}
