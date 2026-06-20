import { createClient } from 'npm:@supabase/supabase-js@2.49.8'

const TURNSTILE_ACTION = 'contact_form'
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

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

function requiredText(value: unknown, label: string, maxLength: number) {
  const text = String(value || '').trim()
  if (!text) throw new Error(`${label} is required.`)
  if (text.length > maxLength) throw new Error(`${label} is too long.`)
  return text
}

function optionalText(value: unknown, maxLength: number) {
  const text = String(value || '').trim()
  return text ? text.slice(0, maxLength) : null
}

function clientIp(req: Request) {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    ''
  )
}

async function validateTurnstile(token: string, remoteip: string) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY') || Deno.env.get('CLOUDFLARE_TURNSTILE_SECRET_KEY')
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY is not configured.')
    return { success: false, error: 'missing-secret' }
  }

  if (!token || token.length > 2048) {
    return { success: false, error: 'invalid-token' }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const formData = new FormData()
    formData.append('secret', secret)
    formData.append('response', token)
    formData.append('idempotency_key', crypto.randomUUID())
    if (remoteip) formData.append('remoteip', remoteip)

    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })

    const result = await response.json()
    if (!response.ok || !result.success) return result

    if (result.action !== TURNSTILE_ACTION) {
      console.warn('Turnstile action mismatch', { expected: TURNSTILE_ACTION, received: result.action })
      return { success: false, error: 'action-mismatch' }
    }

    return result
  } catch (error) {
    console.error('Turnstile validation failed:', error)
    return { success: false, error: 'validation-error' }
  } finally {
    clearTimeout(timeout)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Only POST is supported.' })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse(500, { error: 'Server configuration is incomplete.' })
    }

    const body = await req.json()
    const captchaToken = requiredText(body?.captchaToken, 'Captcha token', 2048)
    const inquiry = body?.inquiry || {}

    const validation = await validateTurnstile(captchaToken, clientIp(req))
    if (!validation.success) {
      console.warn('Turnstile rejected contact form submission', validation)
      return jsonResponse(400, { error: 'Неуспешна верификация. Опитай отново.' })
    }

    let clientId: string | null = null
    const authHeader = req.headers.get('Authorization') || ''
    if (supabaseAnonKey && authHeader) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data } = await userClient.auth.getUser()
      clientId = data.user?.id || null
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const payload = {
      name: requiredText(inquiry.name, 'Name', 180),
      contact: requiredText(inquiry.contact, 'Contact', 180),
      layer_slug: optionalText(inquiry.layer_slug, 80),
      message: requiredText(inquiry.message, 'Message', 5000),
      source: optionalText(inquiry.source, 80) || 'contact_form',
      client_id: clientId,
    }

    const { data: record, error } = await adminClient
      .from('inquiries')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      console.error('submit-inquiry insert error:', error)
      return jsonResponse(500, { error: 'Запитването не беше записано. Опитай отново след малко.' })
    }

    return jsonResponse(200, { success: true, record })
  } catch (error) {
    console.error('submit-inquiry error:', error)
    return jsonResponse(400, { error: 'Невалидно запитване.' })
  }
})
