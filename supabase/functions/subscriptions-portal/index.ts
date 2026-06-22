import { createClient } from 'npm:@supabase/supabase-js@2.49.8'

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

async function getUser(authorization: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Missing Supabase auth environment variables.')

  const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authorization } } })
  const { data } = await userClient.auth.getUser()
  if (data?.user) return data.user

  const claims = decodeJwtPayload(authorization.replace(/^Bearer\s+/i, ''))
  if (claims?.sub) return { id: claims.sub, email: claims.email || null }
  throw new Error('Влез в профила си, за да управляваш абонамента.')
}

function adminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase service environment variables.')
  return createClient(supabaseUrl, serviceRoleKey)
}

async function createPortalSession(customerId: string, returnUrl: string) {
  const secret = cleanText(Deno.env.get('STRIPE_SECRET_KEY'))
  if (!secret) throw new Error('Липсва STRIPE_SECRET_KEY за Stripe Billing Portal.')

  const params = new URLSearchParams()
  params.set('customer', customerId)
  params.set('return_url', returnUrl)

  const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  const data = await response.json()
  if (!response.ok) {
    const message = cleanText((data as { error?: { message?: string } })?.error?.message, 'Stripe Billing Portal не беше отворен.')
    throw new Error(message)
  }
  return data as Record<string, unknown>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Only POST is supported.' })

  try {
    const authorization = req.headers.get('Authorization') || ''
    const user = await getUser(authorization)
    const payload = await req.json().catch(() => ({})) as Record<string, unknown>
    const admin = adminClient()

    const { data: account, error: accountError } = await admin
      .from('accounts')
      .select('account_status')
      .eq('id', user.id)
      .maybeSingle()
    if (accountError) throw accountError
    if (account?.account_status === 'banned' || account?.account_status === 'suspended') {
      return jsonResponse(403, { error: 'Този акаунт няма достъп до абонаментите.' })
    }

    const { data: subscription, error: subscriptionError } = await admin
      .from('partner_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (subscriptionError) throw subscriptionError

    const customerId = cleanText(subscription?.stripe_customer_id)
    if (!customerId) throw new Error('Няма Stripe клиент за този партньорски абонамент.')

    const origin = siteOrigin(req, payload)
    const session = await createPortalSession(customerId, `${origin}/moy-profil?subscription=portal_return`)
    const portalUrl = cleanText(session.url)
    if (!portalUrl) throw new Error('Stripe не върна валиден Billing Portal адрес.')

    return jsonResponse(200, { ok: true, portalUrl })
  } catch (error) {
    console.error('subscriptions-portal error', error)
    return jsonResponse(400, { error: error instanceof Error ? error.message : 'Абонаментът не може да бъде управляван в момента.' })
  }
})
