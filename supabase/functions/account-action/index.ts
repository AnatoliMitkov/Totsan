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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Only POST is supported.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = req.headers.get('Authorization') || ''

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: 'Missing Supabase environment variables.' })
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

  const { data: authData, error: authError } = await userClient.auth.getUser()
  const user = authData?.user
  if (authError || !user) return jsonResponse(401, { error: 'Authentication required.' })

  let body: { action?: string; payload?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body.' })
  }

  const action = String(body.action || '')
  const payload = body.payload || {}

  try {
    if (action !== 'delete_own_account') {
      return jsonResponse(400, { error: 'Unknown account action.' })
    }

    const emailConfirmation = String(payload.emailConfirmation || '').trim().toLowerCase()
    const email = String(user.email || '').trim().toLowerCase()
    if (!email || emailConfirmation !== email) {
      return jsonResponse(400, { error: 'Email confirmation does not match.' })
    }

    await adminClient.from('audit_log').insert({
      actor_id: user.id,
      action,
      entity_type: 'account',
      entity_id: user.id,
      payload: { email },
    })

    const { error } = await adminClient.auth.admin.deleteUser(user.id)
    if (error) throw error

    return jsonResponse(200, { ok: true })
  } catch (error) {
    console.error('account-action error', error)
    return jsonResponse(400, { error: error instanceof Error ? error.message : 'Account action failed.' })
  }
})
