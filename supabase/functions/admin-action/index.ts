import { createClient } from 'npm:@supabase/supabase-js@2.49.8'

const ADMIN_EMAILS = new Set(['a.mitkov@totsan.com', 'manager@totsan.com'])
const INQUIRY_STATUSES = new Set(['new', 'seen', 'replied', 'closed'])
const ACCOUNT_ROLES = new Set(['user', 'specialist', 'admin'])
const SPECIALIST_STATUSES = new Set(['pending', 'approved', 'rejected'])
const ACCOUNT_STATUSES = new Set(['active', 'banned'])
const ORDER_STATUSES = new Set(['pending_payment', 'paid', 'in_progress', 'delivered', 'completed', 'disputed', 'refunded', 'cancelled'])

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

function assertUuid(value: unknown, label: string) {
  const text = String(value || '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error(`${label} is invalid.`)
  }
  return text
}

function slugify(value = '') {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
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

async function writeAudit(adminClient: ReturnType<typeof createClient>, actorId: string, action: string, entityType: string, entityId: string | null, payload: Record<string, unknown>) {
  const { error } = await adminClient.from('audit_log').insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    payload,
  })

  if (error) console.error('admin-action audit error', error)
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

  const { data: authData } = await userClient.auth.getUser()
  const token = authorization.replace(/^Bearer\s+/i, '')
  const claims = authData?.user ? null : decodeJwtPayload(token)
  const user = authData?.user || (claims?.sub ? { id: claims.sub, email: claims.email || null } : null)
  if (!user) return jsonResponse(401, { error: 'Authentication required.' })

  const { data: actorAccount, error: actorError } = await adminClient
    .from('accounts')
    .select('id, email, role')
    .eq('id', user.id)
    .maybeSingle()

  const actorEmail = String(actorAccount?.email || user.email || '').toLowerCase()
  if (actorError || (actorAccount?.role !== 'admin' && !ADMIN_EMAILS.has(actorEmail))) {
    return jsonResponse(403, { error: 'Admin access required.' })
  }

  let body: { action?: string; payload?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body.' })
  }

  const action = String(body.action || '')
  const payload = body.payload || {}

  try {
    if (action === 'update_inquiry_status') {
      const id = assertUuid(payload.id, 'Inquiry id')
      const status = String(payload.status || '')
      if (!INQUIRY_STATUSES.has(status)) throw new Error('Inquiry status is invalid.')

      const { data, error } = await adminClient.from('inquiries').update({ status }).eq('id', id).select('*').single()
      if (error) throw error
      await writeAudit(adminClient, user.id, action, 'inquiry', id, { status, actor_email: actorEmail })
      return jsonResponse(200, { ok: true, row: data })
    }

    if (action === 'approve_specialist') {
      const applicationId = assertUuid(payload.applicationId, 'Application id')
      const decisionNote = String(payload.decisionNote || '').trim() || null
      const { data: app, error: appLoadError } = await adminClient.from('partner_applications').select('*').eq('id', applicationId).single()
      if (appLoadError) throw appLoadError
      if (!app.user_id) throw new Error('Application has no linked account.')

      const { data: existingProfile, error: existingError } = await adminClient.from('profiles').select('id, slug').eq('user_id', app.user_id).maybeSingle()
      if (existingError) throw existingError

      let profileId = existingProfile?.id || null
      if (!profileId) {
        const baseSlug = slugify(app.name || app.email || 'profil') || 'profil'
        const slug = `${baseSlug}-${applicationId.slice(0, 6)}`
        const { data: profile, error: profileError } = await adminClient.from('profiles').insert({
          slug,
          layer_slug: app.layer_slug || 'postroyka',
          name: app.name || 'Нов специалист',
          tag: 'Специалист',
          city: '—',
          since: new Date().getFullYear(),
          bio: app.about || '',
          user_id: app.user_id,
          role: 'pro',
          is_published: false,
        }).select('id').single()
        if (profileError) throw profileError
        profileId = profile.id
      }

      const reviewedAt = new Date().toISOString()
      const [{ error: accountError }, { data: updatedApplication, error: updateAppError }] = await Promise.all([
        adminClient.from('accounts').update({ role: 'specialist', specialist_status: 'approved', account_status: 'active', last_admin_action_at: reviewedAt }).eq('id', app.user_id),
        adminClient.from('partner_applications').update({ status: 'approved', reviewed_at: reviewedAt, decision_note: decisionNote }).eq('id', applicationId).select('*').single(),
      ])
      if (accountError) throw accountError
      if (updateAppError) throw updateAppError

      await writeAudit(adminClient, user.id, action, 'partner_application', applicationId, { profile_id: profileId, user_id: app.user_id, actor_email: actorEmail })
      return jsonResponse(200, { ok: true, row: updatedApplication, profileId })
    }

    if (action === 'reject_specialist') {
      const applicationId = assertUuid(payload.applicationId, 'Application id')
      const decisionNote = String(payload.decisionNote || '').trim() || null
      const { data: app, error: appLoadError } = await adminClient.from('partner_applications').select('*').eq('id', applicationId).single()
      if (appLoadError) throw appLoadError

      const reviewedAt = new Date().toISOString()
      const updates = [
        adminClient.from('partner_applications').update({ status: 'rejected', reviewed_at: reviewedAt, decision_note: decisionNote }).eq('id', applicationId).select('*').single(),
      ]
      if (app.user_id) {
        updates.push(adminClient.from('accounts').update({ role: 'specialist', specialist_status: 'rejected', last_admin_action_at: reviewedAt }).eq('id', app.user_id))
      }

      const results = await Promise.all(updates)
      const failed = results.find((result) => result.error)
      if (failed?.error) throw failed.error

      await writeAudit(adminClient, user.id, action, 'partner_application', applicationId, { user_id: app.user_id || null, actor_email: actorEmail })
      return jsonResponse(200, { ok: true, row: results[0].data })
    }

    if (action === 'update_account') {
      const id = assertUuid(payload.id, 'Account id')
      const updates = (payload.updates && typeof payload.updates === 'object' ? payload.updates : {}) as Record<string, unknown>
      const patch: Record<string, unknown> = { last_admin_action_at: new Date().toISOString() }

      if ('role' in updates) {
        const role = String(updates.role || '')
        if (!ACCOUNT_ROLES.has(role)) throw new Error('Account role is invalid.')
        patch.role = role
        if (role !== 'specialist') patch.specialist_status = null
      }

      if ('specialistStatus' in updates) {
        const status = updates.specialistStatus == null ? null : String(updates.specialistStatus)
        if (status !== null && !SPECIALIST_STATUSES.has(status)) throw new Error('Specialist status is invalid.')
        patch.specialist_status = status
      }

      if ('accountStatus' in updates) {
        const accountStatus = String(updates.accountStatus || '')
        if (!ACCOUNT_STATUSES.has(accountStatus)) throw new Error('Account status is invalid.')
        patch.account_status = accountStatus
      }

      if ('adminNote' in updates) patch.admin_note = String(updates.adminNote || '').trim() || null

      const { data, error } = await adminClient.from('accounts').update(patch).eq('id', id).select('*').single()
      if (error) throw error
      await writeAudit(adminClient, user.id, action, 'account', id, { updates, actor_email: actorEmail })
      return jsonResponse(200, { ok: true, row: data })
    }

    if (action === 'approve_partner_service') {
      const serviceId = assertUuid(payload.serviceId, 'Service id')
      const moderationNote = String(payload.moderationNote || '').trim() || null
      const { data, error } = await adminClient
        .from('partner_services')
        .update({ moderation_status: 'approved', is_published: true, moderation_note: moderationNote })
        .eq('id', serviceId)
        .select('*')
        .single()
      if (error) throw error
      await writeAudit(adminClient, user.id, action, 'partner_service', serviceId, { moderation_note: moderationNote, actor_email: actorEmail })
      return jsonResponse(200, { ok: true, row: data })
    }

    if (action === 'reject_partner_service') {
      const serviceId = assertUuid(payload.serviceId, 'Service id')
      const moderationNote = String(payload.moderationNote || '').trim() || 'Върната за корекция.'
      const { data, error } = await adminClient
        .from('partner_services')
        .update({ moderation_status: 'rejected', is_published: false, moderation_note: moderationNote })
        .eq('id', serviceId)
        .select('*')
        .single()
      if (error) throw error
      await writeAudit(adminClient, user.id, action, 'partner_service', serviceId, { moderation_note: moderationNote, actor_email: actorEmail })
      return jsonResponse(200, { ok: true, row: data })
    }

    if (action === 'update_order_status') {
      const orderId = assertUuid(payload.orderId, 'Order id')
      const status = String(payload.status || '')
      if (!ORDER_STATUSES.has(status)) throw new Error('Order status is invalid.')
      const note = String(payload.note || '').trim()

      const { data: order, error: orderLoadError } = await adminClient.from('orders').select('*').eq('id', orderId).single()
      if (orderLoadError) throw orderLoadError

      const patch: Record<string, unknown> = { status }
      if (status === 'delivered' && !order.delivered_at) patch.delivered_at = new Date().toISOString()
      if (status === 'completed' && !order.completed_at) patch.completed_at = new Date().toISOString()
      if (['pending_payment', 'paid', 'in_progress'].includes(status)) patch.completed_at = null
      if (['pending_payment', 'paid', 'in_progress'].includes(status)) patch.delivered_at = null

      const { data, error } = await adminClient.from('orders').update(patch).eq('id', orderId).select('*').single()
      if (error) throw error

      await adminClient.from('order_events').insert({
        order_id: orderId,
        actor_id: user.id,
        type: 'admin_status_update',
        from_status: order.status,
        to_status: status,
        message: note || 'Админ обнови статуса на поръчката.',
        payload: { note, actor_email: actorEmail },
      })

      if (status === 'refunded' && order.status !== 'refunded') {
        await adminClient.from('payment_transactions').insert({
          order_id: orderId,
          type: 'refund',
          provider: order.payment_provider || 'mock',
          amount: order.amount_total || 0,
          currency: order.currency || 'EUR',
          status: 'manual',
          raw: { note, actor_email: actorEmail },
        })
      }

      await writeAudit(adminClient, user.id, action, 'order', orderId, { status, note, from_status: order.status, actor_email: actorEmail })
      return jsonResponse(200, { ok: true, row: data })
    }

    return jsonResponse(400, { error: 'Unsupported admin action.' })
  } catch (error) {
    console.error('admin-action error', error)
    return jsonResponse(400, { error: error instanceof Error ? error.message : 'Admin action failed.' })
  }
})