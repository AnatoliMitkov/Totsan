import { createClient } from 'npm:@supabase/supabase-js@2.49.8'

const INQUIRY_STATUSES = new Set(['new', 'seen', 'replied', 'closed'])
const ACCOUNT_ROLES = new Set(['user', 'specialist', 'admin'])
const SPECIALIST_STATUSES = new Set(['pending', 'approved', 'rejected'])
const ACCOUNT_STATUSES = new Set(['active', 'banned'])
const ORDER_STATUSES = new Set(['pending_payment', 'paid', 'in_progress', 'delivered', 'completed', 'disputed', 'refunded', 'cancelled'])
const MATERIAL_MODERATION_STATUSES = new Set(['pending', 'approved', 'rejected', 'hidden'])
const SERVICE_EDITOR_FIELDS = new Set(['title', 'subtitle', 'description_md', 'tags'])
const SERVICE_FEEDBACK_BUCKET = 'service-moderation-feedback'
const ADMIN_ROLE_MANAGER_EMAILS = new Set(['a.mitkov@totsan.com'])
const AUTH_REDIRECT_ORIGINS = new Set(['https://totsan.com', 'https://www.totsan.com', 'http://localhost:3000', 'http://127.0.0.1:3000'])

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

function cleanLimitedText(value: unknown, maxLength: number) {
  return String(value ?? '').trim().slice(0, maxLength)
}

function normalizeServiceTags(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => cleanLimitedText(item, 50))
    .filter(Boolean)
    .slice(0, 20)
}

function normalizeModerationAttachments(value: unknown, serviceId: string) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 3).map((item) => {
    const attachment = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    const bucket = String(attachment.bucket || '')
    const path = String(attachment.path || '')
    if (bucket !== SERVICE_FEEDBACK_BUCKET || !path.startsWith(`${serviceId}/`)) {
      throw new Error('Moderation attachment is invalid.')
    }
    return {
      bucket,
      path,
      name: cleanLimitedText(attachment.name, 160),
      type: cleanLimitedText(attachment.type, 80),
      size: Math.max(0, Number(attachment.size || 0)),
    }
  })
}

async function removeModerationAttachments(
  adminClient: ReturnType<typeof createClient>,
  value: unknown,
) {
  if (!Array.isArray(value)) return
  const paths = value
    .filter((item) => item && typeof item === 'object' && (item as Record<string, unknown>).bucket === SERVICE_FEEDBACK_BUCKET)
    .map((item) => String((item as Record<string, unknown>).path || ''))
    .filter(Boolean)
  if (!paths.length) return
  const { error } = await adminClient.storage.from(SERVICE_FEEDBACK_BUCKET).remove(paths)
  if (error) console.error('moderation attachment cleanup error', error)
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

function canManageAdminRoles(email: string) {
  return ADMIN_ROLE_MANAGER_EMAILS.has(String(email || '').trim().toLowerCase())
}

function authRedirectTo(origin: string | null) {
  const safeOrigin = AUTH_REDIRECT_ORIGINS.has(String(origin || '')) ? String(origin) : 'https://totsan.com'
  return `${safeOrigin}/login`
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
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  })

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
  if (actorError || actorAccount?.role !== 'admin') {
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

    if (action === 'delete_inquiry') {
      const id = assertUuid(payload.id, 'Inquiry id')
      const { data, error } = await adminClient
        .from('inquiries')
        .delete()
        .eq('id', id)
        .select('id, source, layer_slug, target_slug')
        .single()

      if (error) throw error
      await writeAudit(adminClient, user.id, action, 'inquiry', id, {
        actor_email: actorEmail,
        target: data,
      })
      return jsonResponse(200, { ok: true })
    }

    if (action === 'assign_inquiry') {
      const id = assertUuid(payload.id, 'Inquiry id')
      const profileIdValue = String(payload.profileId || '').trim()

      if (!profileIdValue) {
        const { data, error } = await adminClient
          .from('inquiries')
          .update({
            assigned_profile_id: null,
            assigned_partner_id: null,
            assigned_at: null,
            assigned_by: null,
          })
          .eq('id', id)
          .select('*')
          .single()

        if (error) throw error
        await writeAudit(adminClient, user.id, 'unassign_inquiry', 'inquiry', id, {
          actor_email: actorEmail,
        })
        return jsonResponse(200, { ok: true, row: data, profile: null })
      }

      const profileId = assertUuid(profileIdValue, 'Profile id')
      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('id, user_id, slug, name, tag, city, layer_slug, is_published')
        .eq('id', profileId)
        .single()

      if (profileError) throw profileError
      if (!profile.user_id) throw new Error('Partner profile has no linked account.')
      if (!profile.is_published) throw new Error('Partner profile is not published.')

      const { data: partnerAccount, error: partnerError } = await adminClient
        .from('accounts')
        .select('id, role, specialist_status, account_status')
        .eq('id', profile.user_id)
        .single()

      if (partnerError) throw partnerError
      if (partnerAccount.role !== 'specialist' || partnerAccount.specialist_status !== 'approved' || partnerAccount.account_status !== 'active') {
        throw new Error('Partner account is not active and approved.')
      }

      const assignedAt = new Date().toISOString()
      const { data, error } = await adminClient
        .from('inquiries')
        .update({
          assigned_profile_id: profile.id,
          assigned_partner_id: profile.user_id,
          assigned_at: assignedAt,
          assigned_by: user.id,
        })
        .eq('id', id)
        .select('*')
        .single()

      if (error) throw error
      await writeAudit(adminClient, user.id, action, 'inquiry', id, {
        actor_email: actorEmail,
        profile_id: profile.id,
        partner_id: profile.user_id,
        profile_slug: profile.slug,
      })
      return jsonResponse(200, { ok: true, row: data, profile })
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
      const details = app.details && typeof app.details === 'object' ? app.details : {}
      const basic = details.basic && typeof details.basic === 'object' ? details.basic : {}
      const serviceAreas = details.serviceAreas && typeof details.serviceAreas === 'object' ? details.serviceAreas : {}
      const workStyle = details.workStyle && typeof details.workStyle === 'object' ? details.workStyle : {}
      const profileCity = String(serviceAreas.primaryCity || basic.city || app.city || '').trim()
      const profileTag = String(basic.partnerType || 'Специалист').trim()
      const profileImageUrl = String(basic.selfPhotoUrl || '').trim()
      if (!profileId) {
        const baseSlug = slugify(app.name || app.email || 'profil') || 'profil'
        const slug = `${baseSlug}-${applicationId.slice(0, 6)}`
        const { data: profile, error: profileError } = await adminClient.from('profiles').insert({
          slug,
          layer_slug: app.layer_slug || 'postroyka',
          name: app.name || 'Нов специалист',
          tag: profileTag,
          city: profileCity || '—',
          since: new Date().getFullYear(),
          bio: app.about || '',
          headline: String(workStyle.custom || profileTag || '').trim() || null,
          image_url: profileImageUrl || null,
          image_zoom: 1,
          image_x: 50,
          image_y: 50,
          user_id: app.user_id,
          role: 'pro',
          is_published: false,
        }).select('id').single()
        if (profileError) throw profileError
        profileId = profile.id
      } else {
        const profilePayload: Record<string, unknown> = {
          is_published: false,
          layer_slug: app.layer_slug || 'postroyka',
          name: app.name || 'Нов специалист',
          tag: profileTag,
          city: profileCity || '—',
          bio: app.about || '',
        }
        if (profileImageUrl) {
          profilePayload.image_url = profileImageUrl
          profilePayload.image_zoom = 1
          profilePayload.image_x = 50
          profilePayload.image_y = 50
        }
        const { error: publishProfileError } = await adminClient.from('profiles').update(profilePayload).eq('id', profileId)
        if (publishProfileError) throw publishProfileError
      }

      const reviewedAt = new Date().toISOString()
      const accountPayload: Record<string, unknown> = {
        role: 'specialist',
        specialist_status: 'approved',
        account_status: 'active',
        last_admin_action_at: reviewedAt,
      }
      if (profileImageUrl) accountPayload.avatar_url = profileImageUrl

      const [{ error: accountError }, { data: updatedApplication, error: updateAppError }] = await Promise.all([
        adminClient.from('accounts').update(accountPayload).eq('id', app.user_id),
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
      const { data: targetAccount, error: targetAccountError } = await adminClient
        .from('accounts')
        .select('id, email, full_name, display_name, role, specialist_status, account_status')
        .eq('id', id)
        .single()

      if (targetAccountError) throw targetAccountError
      if (targetAccount.role === 'admin' && !canManageAdminRoles(actorEmail)) {
        throw new Error('Only a.mitkov@totsan.com can manage admin accounts.')
      }

      if ('role' in updates) {
        const role = String(updates.role || '')
        if (!ACCOUNT_ROLES.has(role)) throw new Error('Account role is invalid.')
        const touchesAdminRole = role === 'admin' || targetAccount.role === 'admin'
        if (touchesAdminRole && !canManageAdminRoles(actorEmail)) {
          throw new Error('Only a.mitkov@totsan.com can grant or remove admin access.')
        }
        if (id === user.id && role !== targetAccount.role) {
          throw new Error('You cannot change your own admin role from the admin panel.')
        }
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
      await writeAudit(adminClient, user.id, action, 'account', id, {
        updates,
        actor_email: actorEmail,
        target: {
          id: targetAccount.id,
          email: targetAccount.email,
          full_name: targetAccount.full_name,
          display_name: targetAccount.display_name,
        },
        before: {
          role: targetAccount.role,
          specialist_status: targetAccount.specialist_status,
          account_status: targetAccount.account_status,
        },
        after: {
          role: data.role,
          specialist_status: data.specialist_status,
          account_status: data.account_status,
        },
      })
      return jsonResponse(200, { ok: true, row: data })
    }

    if (action === 'update_profile') {
      const id = assertUuid(payload.id, 'Profile id')
      const updates = (payload.updates && typeof payload.updates === 'object' ? payload.updates : {}) as Record<string, unknown>
      const patch: Record<string, unknown> = {}

      const { data: targetProfile, error: targetProfileError } = await adminClient
        .from('profiles')
        .select('id, user_id, slug, name, layer_slug, is_published')
        .eq('id', id)
        .single()

      if (targetProfileError) throw targetProfileError

      if ('is_published' in updates) {
        patch.is_published = Boolean(updates.is_published)
      }

      if ('layer_slug' in updates) {
        const layerSlug = String(updates.layer_slug || '').trim()
        if (!layerSlug) throw new Error('Profile layer is invalid.')
        patch.layer_slug = layerSlug
      }

      if (Object.keys(patch).length === 0) {
        return jsonResponse(200, { ok: true, row: targetProfile })
      }

      const { data, error } = await adminClient.from('profiles').update(patch).eq('id', id).select('*').single()
      if (error) throw error

      await writeAudit(adminClient, user.id, action, 'profile', id, {
        updates,
        actor_email: actorEmail,
        target: {
          id: targetProfile.id,
          user_id: targetProfile.user_id,
          slug: targetProfile.slug,
          name: targetProfile.name,
        },
        before: {
          layer_slug: targetProfile.layer_slug,
          is_published: targetProfile.is_published,
        },
        after: {
          layer_slug: data.layer_slug,
          is_published: data.is_published,
        },
      })
      return jsonResponse(200, { ok: true, row: data })
    }

    if (action === 'delete_profile') {
      const id = assertUuid(payload.id, 'Profile id')
      const { data: targetProfile, error: targetProfileError } = await adminClient
        .from('profiles')
        .select('id, user_id, slug, name, layer_slug, is_published')
        .eq('id', id)
        .single()

      if (targetProfileError) throw targetProfileError

      const { error } = await adminClient.from('profiles').delete().eq('id', id)
      if (error) throw error

      await writeAudit(adminClient, user.id, action, 'profile', id, {
        actor_email: actorEmail,
        target: targetProfile,
      })
      return jsonResponse(200, { ok: true })
    }

    if (action === 'send_user_recovery_email') {
      const id = assertUuid(payload.id, 'Account id')
      const { data: targetAccount, error: targetAccountError } = await adminClient
        .from('accounts')
        .select('id, email, full_name, display_name')
        .eq('id', id)
        .single()

      if (targetAccountError) throw targetAccountError
      if (!targetAccount.email) throw new Error('Account has no email address.')

      const redirectTo = authRedirectTo(req.headers.get('Origin'))
      const { error } = await adminClient.auth.resetPasswordForEmail(targetAccount.email, { redirectTo })
      if (error) throw error

      await writeAudit(adminClient, user.id, action, 'account', id, {
        redirect_to: redirectTo,
        actor_email: actorEmail,
        target: targetAccount,
      })
      return jsonResponse(200, { ok: true })
    }

    if (action === 'approve_partner_service') {
      const serviceId = assertUuid(payload.serviceId, 'Service id')
      const moderationNote = String(payload.moderationNote || '').trim() || null
      const { data: previous, error: previousError } = await adminClient
        .from('partner_services')
        .select('moderation_attachments')
        .eq('id', serviceId)
        .single()
      if (previousError) throw previousError
      const { data, error } = await adminClient
        .from('partner_services')
        .update({
          moderation_status: 'approved',
          is_published: true,
          moderation_note: moderationNote,
          moderation_attachments: [],
        })
        .eq('id', serviceId)
        .select('*')
        .single()
      if (error) throw error
      if (data.profile_id) {
        const { error: profileError } = await adminClient
          .from('profiles')
          .update({ is_published: true })
          .eq('id', data.profile_id)
        if (profileError) throw profileError
      }
      await removeModerationAttachments(adminClient, previous.moderation_attachments)
      await writeAudit(adminClient, user.id, action, 'partner_service', serviceId, { moderation_note: moderationNote, actor_email: actorEmail })
      return jsonResponse(200, { ok: true, row: data })
    }

    if (action === 'reject_partner_service') {
      const serviceId = assertUuid(payload.serviceId, 'Service id')
      const moderationNote = cleanLimitedText(payload.moderationNote, 2000)
      if (!moderationNote) throw new Error('Moderation note is required.')
      const moderationAttachments = normalizeModerationAttachments(payload.attachments, serviceId)
      const { data: previous, error: previousError } = await adminClient
        .from('partner_services')
        .select('moderation_attachments')
        .eq('id', serviceId)
        .single()
      if (previousError) throw previousError
      const { data, error } = await adminClient
        .from('partner_services')
        .update({
          moderation_status: 'rejected',
          is_published: false,
          moderation_note: moderationNote,
          moderation_attachments: moderationAttachments,
        })
        .eq('id', serviceId)
        .select('*')
        .single()
      if (error) throw error
      await removeModerationAttachments(adminClient, previous.moderation_attachments)
      await writeAudit(adminClient, user.id, action, 'partner_service', serviceId, {
        moderation_note: moderationNote,
        attachments: moderationAttachments,
        actor_email: actorEmail,
      })
      return jsonResponse(200, { ok: true, row: data })
    }

    if (action === 'edit_and_approve_partner_service') {
      const serviceId = assertUuid(payload.serviceId, 'Service id')
      const requestedUpdates = payload.updates && typeof payload.updates === 'object'
        ? payload.updates as Record<string, unknown>
        : {}
      const { data: current, error: currentError } = await adminClient
        .from('partner_services')
        .select('id, profile_id, title, subtitle, description_md, tags, moderation_status, is_published, moderation_attachments')
        .eq('id', serviceId)
        .single()
      if (currentError) throw currentError

      const updates: Record<string, unknown> = {}
      Object.entries(requestedUpdates).forEach(([field, value]) => {
        if (!SERVICE_EDITOR_FIELDS.has(field)) return
        if (field === 'title') updates.title = cleanLimitedText(value, 140)
        if (field === 'subtitle') updates.subtitle = cleanLimitedText(value, 280) || null
        if (field === 'description_md') updates.description_md = cleanLimitedText(value, 12000) || null
        if (field === 'tags') updates.tags = normalizeServiceTags(value)
      })
      if ('title' in updates && !updates.title) throw new Error('Service title is required.')

      const changedFields = Object.keys(updates).filter((field) => (
        JSON.stringify(current[field as keyof typeof current] ?? null) !== JSON.stringify(updates[field] ?? null)
      ))
      const moderationNote = cleanLimitedText(payload.moderationNote, 2000)
        || 'Редакторска корекция и одобрение от Totsan.'
      const { data, error } = await adminClient
        .from('partner_services')
        .update({
          ...updates,
          moderation_status: 'approved',
          is_published: true,
          moderation_note: moderationNote,
          moderation_attachments: [],
        })
        .eq('id', serviceId)
        .select('*')
        .single()
      if (error) throw error
      if (data.profile_id) {
        const { error: profileError } = await adminClient
          .from('profiles')
          .update({ is_published: true })
          .eq('id', data.profile_id)
        if (profileError) throw profileError
      }
      await removeModerationAttachments(adminClient, current.moderation_attachments)

      await writeAudit(adminClient, user.id, action, 'partner_service', serviceId, {
        actor_email: actorEmail,
        moderation_note: moderationNote,
        changed_fields: changedFields,
        before: Object.fromEntries(changedFields.map((field) => [field, current[field as keyof typeof current]])),
        after: Object.fromEntries(changedFields.map((field) => [field, updates[field]])),
      })
      return jsonResponse(200, { ok: true, row: data, changedFields })
    }

    if (action === 'update_material_capability_moderation') {
      const capabilityId = assertUuid(payload.capabilityId, 'Material capability id')
      const moderationStatus = String(payload.moderationStatus || '')
      if (!MATERIAL_MODERATION_STATUSES.has(moderationStatus)) throw new Error('Material moderation status is invalid.')
      const moderationNote = String(payload.moderationNote || '').trim() || null

      const { data: currentCapability, error: currentCapabilityError } = await adminClient
        .from('partner_material_capabilities')
        .select('id, profile_id, partner_id, layer_slug, category_slug, brand_slug, is_public, moderation_status, moderation_note')
        .eq('id', capabilityId)
        .single()

      if (currentCapabilityError) throw currentCapabilityError

      const patch: Record<string, unknown> = {
        moderation_status: moderationStatus,
        moderation_note: moderationNote,
        reviewed_at: new Date().toISOString(),
      }

      const { data, error } = await adminClient
        .from('partner_material_capabilities')
        .update(patch)
        .eq('id', capabilityId)
        .select('*')
        .single()

      if (error) throw error

      await writeAudit(adminClient, user.id, action, 'partner_material_capability', capabilityId, {
        actor_email: actorEmail,
        before: {
          moderation_status: currentCapability.moderation_status,
          moderation_note: currentCapability.moderation_note,
          is_public: currentCapability.is_public,
        },
        after: {
          moderation_status: data.moderation_status,
          moderation_note: data.moderation_note,
          is_public: data.is_public,
        },
        target: {
          id: currentCapability.id,
          profile_id: currentCapability.profile_id,
          partner_id: currentCapability.partner_id,
          layer_slug: currentCapability.layer_slug,
          category_slug: currentCapability.category_slug,
          brand_slug: currentCapability.brand_slug,
        },
      })
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
