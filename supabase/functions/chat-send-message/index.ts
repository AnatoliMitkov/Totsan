import { createClient } from 'npm:@supabase/supabase-js@2.49.8'

const MASK = '[скрито от Totsan - общувайте в платформата]'
const MESSAGE_KINDS = new Set(['text', 'attachment'])
const OFFER_STATUSES = new Set(['accepted', 'declined', 'withdrawn'])
const SERVICE_REQUEST_STATUSES = new Set(['negotiating', 'declined', 'cancelled'])
const REFERENCE_TYPES = new Set(['service', 'portfolio'])
const MAX_MESSAGES_PER_MINUTE = 30
const CHAT_ATTACHMENTS_BUCKET = 'chat-attachments'
const MAX_ATTACHMENTS_PER_MESSAGE = 10
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const CHAT_REFERENCE_PREFIX = '__totsan_ref__:'
const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
])

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

function optionalUuid(value: unknown) {
  if (!value) return null
  return assertUuid(value, 'Optional uuid')
}

function maskText(value: unknown) {
  const original = String(value || '')
  const masked = original
    .replace(/https?:\/\/\S+/gi, MASK)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, MASK)
    .replace(/\+?\d[\d\s().-]{6,}/g, MASK)
  return {
    original,
    masked,
    wasMasked: masked !== original,
  }
}

function maskList(value: unknown) {
  const input = Array.isArray(value) ? value : String(value || '').split('\n')
  let wasMasked = false
  const items = input.map((item) => {
    const result = maskText(item)
    wasMasked = wasMasked || result.wasMasked
    return result.masked.trim()
  }).filter(Boolean)
  return { items, wasMasked }
}

function normalizeExecutionMode(value: unknown) {
  return value === 'staged' ? 'staged' : 'single'
}

function normalizeOfferStages(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((stage, index) => {
      if (!stage || typeof stage !== 'object' || Array.isArray(stage)) return null

      const record = stage as Record<string, unknown>
      const title = maskText(record.title).masked.trim()
      const description = maskText(record.description).masked.trim()
      const parsedOrder = Number(record.order)
      const order = Number.isFinite(parsedOrder) ? Math.max(0, Math.round(parsedOrder)) : index + 1

      if (!title && !description) return null

      return { title, description, order }
    })
    .filter(Boolean)
}

function previewFor(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 140)
}

function encodeReferenceBody(payload: Record<string, unknown>) {
  return `${CHAT_REFERENCE_PREFIX}${JSON.stringify(payload)}`
}

function pickCoverUrl(row: Record<string, unknown>) {
  const coverUrl = String(row.cover_url || '')
  if (coverUrl) return coverUrl
  const media = Array.isArray(row.media) ? row.media : []
  const firstMedia = media.find((item) => item && typeof item === 'object' && !Array.isArray(item) && String((item as Record<string, unknown>).url || '').trim())
  return String((firstMedia as Record<string, unknown> | undefined)?.url || '')
}

function activePackageMeta(packages: Array<Record<string, unknown>>) {
  const active = packages.filter((item) => item && item.is_active !== false)
  if (!active.length) return { priceLabel: '', deliveryLabel: '' }

  const cheapest = active.reduce<Record<string, unknown> | null>((best, item) => {
    const nextPrice = Number(item.price_amount || 0)
    if (!best) return item
    const bestPrice = Number(best.price_amount || 0)
    if (nextPrice <= 0) return best
    if (bestPrice <= 0) return item
    return nextPrice < bestPrice ? item : best
  }, null)

  const deliveryDays = active.reduce<number | null>((best, item) => {
    const value = Number(item.delivery_days || 0)
    if (!Number.isFinite(value) || value <= 0) return best
    return best === null ? value : Math.min(best, value)
  }, null)

  const priceAmount = Number(cheapest?.price_amount || 0)
  const currency = String(cheapest?.currency || 'EUR').trim().toUpperCase() || 'EUR'
  const priceLabel = priceAmount > 0 ? `От ${priceAmount} ${currency}` : ''
  const deliveryLabel = deliveryDays ? `${deliveryDays} ${deliveryDays === 1 ? 'ден' : 'дни'}` : ''

  return { priceLabel, deliveryLabel }
}

function sanitizeAttachmentName(value: unknown) {
  const text = String(value || 'file').trim().replace(/\s+/g, ' ')
  return text.slice(0, 160) || 'file'
}

function normalizeAttachments(value: unknown, conversationId: string, senderId: string) {
  const input = Array.isArray(value) ? value : []
  if (input.length > MAX_ATTACHMENTS_PER_MESSAGE) throw new Error('Too many attachments.')

  return input.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Attachment is invalid.')
    const record = item as Record<string, unknown>
    const bucket = String(record.bucket || '')
    const path = String(record.path || '')
    const type = String(record.type || '')
    const size = Number(record.size || 0)
    const originalSize = Number(record.original_size || 0)
    const width = Number(record.width || 0)
    const height = Number(record.height || 0)

    if (bucket !== CHAT_ATTACHMENTS_BUCKET) throw new Error('Attachment bucket is invalid.')
    if (!path.startsWith(`conversations/${conversationId}/${senderId}/`)) throw new Error('Attachment path is invalid.')
    if (!ALLOWED_ATTACHMENT_TYPES.has(type)) throw new Error('Attachment type is not supported.')
    if (!Number.isFinite(size) || size <= 0 || size > MAX_ATTACHMENT_BYTES) throw new Error('Attachment size is invalid.')

    return {
      bucket,
      path,
      name: sanitizeAttachmentName(record.name),
      size: Math.round(size),
      type,
      kind: type.startsWith('image/') ? 'image' : 'file',
      original_name: sanitizeAttachmentName(record.original_name || record.name),
      original_size: Number.isFinite(originalSize) && originalSize > 0 ? Math.round(originalSize) : Math.round(size),
      original_type: ALLOWED_ATTACHMENT_TYPES.has(String(record.original_type || '')) ? String(record.original_type) : type,
      optimized: Boolean(record.optimized),
      width: Number.isFinite(width) && width > 0 ? Math.round(width) : null,
      height: Number.isFinite(height) && height > 0 ? Math.round(height) : null,
    }
  })
}

function attachmentPreview(attachments: Array<Record<string, unknown>>) {
  if (!attachments.length) return ''
  if (attachments.length === 1) {
    const name = sanitizeAttachmentName(attachments[0].name)
    return String(attachments[0].kind || '') === 'image' ? `Image: ${name}` : `File: ${name}`
  }
  return `${attachments.length} attachments`
}

function isParticipant(conversation: { client_id: string; partner_id: string }, userId: string) {
  return conversation.client_id === userId || conversation.partner_id === userId
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

function nextReadFlags(conversation: { client_id: string; partner_id: string }, senderId: string) {
  return {
    is_read_by_client: senderId === conversation.client_id,
    is_read_by_partner: senderId === conversation.partner_id,
  }
}

async function auditMasked(adminClient: ReturnType<typeof createClient>, actorId: string, messageId: string | null, payload: Record<string, unknown>) {
  const { error } = await adminClient.from('audit_log').insert({
    actor_id: actorId,
    action: 'chat_content_masked',
    entity_type: 'message',
    entity_id: messageId,
    payload,
  })
  if (error) console.error('chat-send-message audit error', error)
}

async function hasActivePartnerAccess(adminClient: ReturnType<typeof createClient>, partnerId: string, profileId: string | null) {
  const { data, error } = await adminClient.rpc('has_active_partner_access', {
    check_user_id: partnerId,
    check_profile_id: profileId,
  })
  if (error) throw error
  return Boolean(data)
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

  const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authorization } } })
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

  const { data: authData } = await userClient.auth.getUser()
  const token = authorization.replace(/^Bearer\s+/i, '')
  const claims = authData?.user ? null : decodeJwtPayload(token)
  const user = authData?.user || (claims?.sub ? { id: claims.sub, email: claims.email || null } : null)
  if (!user) return jsonResponse(401, { error: 'Authentication required.' })

  const { data: account } = await adminClient.from('accounts').select('account_status').eq('id', user.id).maybeSingle()
  if (account?.account_status === 'banned' || account?.account_status === 'suspended') {
    return jsonResponse(403, { error: 'Този акаунт няма достъп до чата.' })
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
    if (action === 'create_conversation') {
      const profileId = optionalUuid(payload.profileId)
      let partnerId = optionalUuid(payload.partnerId)
      let partnerProfileId = profileId
      const projectId = optionalUuid(payload.projectId)
      const subject = String(payload.subject || '').trim() || 'Разговор в Totsan'

      if (profileId) {
        const { data: profile, error } = await adminClient.from('profiles').select('id, user_id, name').eq('id', profileId).maybeSingle()
        if (error) throw error
        if (!profile?.id) throw new Error('Партньорският профил не беше намерен.')
        partnerId = profile?.user_id || null
        partnerProfileId = profile?.id || profileId
      }

      if (!partnerId) throw new Error('Профилът още няма свързан партньорски акаунт.')
      if (partnerId === user.id) throw new Error('Не можеш да започнеш разговор със собствения си профил.')

      let query = adminClient
        .from('conversations')
        .select('*')
        .eq('client_id', user.id)
        .eq('partner_id', partnerId)
        .eq('status', 'open')

      query = projectId ? query.eq('project_id', projectId) : query.is('project_id', null)
      const { data: existing, error: existingError } = await query.maybeSingle()
      if (existingError) throw existingError
      if (existing) return jsonResponse(200, { ok: true, conversation: existing, reused: true })

      const partnerCanReceiveNewChats = await hasActivePartnerAccess(adminClient, partnerId, partnerProfileId)
      if (!partnerCanReceiveNewChats) {
        throw new Error('Профилът на партньора е на пауза и в момента не приема нови клиентски запитвания.')
      }

      const { data: conversation, error } = await adminClient.from('conversations').insert({
        client_id: user.id,
        partner_id: partnerId,
        project_id: projectId,
        subject,
      }).select('*').single()
      if (error) throw error

      return jsonResponse(200, { ok: true, conversation, reused: false })
    }

    if (action === 'create_service_request') {
      const serviceId = assertUuid(payload.serviceId, 'Service id')
      const requestedPackageId = optionalUuid(payload.servicePackageId)
      const { data: service, error: serviceError } = await adminClient
        .from('partner_services')
        .select('id, profile_id, partner_id, slug, title, subtitle, is_published, moderation_status')
        .eq('id', serviceId)
        .single()
      if (serviceError) throw serviceError
      if (!service.is_published || service.moderation_status !== 'approved') {
        throw new Error('Услугата вече не е достъпна за заявяване.')
      }
      if (service.partner_id === user.id) throw new Error('Не можеш да заявиш собствената си услуга.')

      let packageQuery = adminClient
        .from('partner_service_packages')
        .select('id, title, description, features, price_amount, currency, is_active')
        .eq('service_id', serviceId)
        .eq('is_active', true)
      packageQuery = requestedPackageId ? packageQuery.eq('id', requestedPackageId) : packageQuery.order('created_at').limit(1)
      const { data: servicePackage, error: packageError } = await packageQuery.maybeSingle()
      if (packageError) throw packageError
      if (!servicePackage) throw new Error('Пакетът вече не е активен.')

      const partnerCanReceiveNewChats = await hasActivePartnerAccess(adminClient, service.partner_id, service.profile_id)
      if (!partnerCanReceiveNewChats) {
        throw new Error('Партньорът в момента не приема нови заявки.')
      }

      let { data: conversation, error: conversationError } = await adminClient
        .from('conversations')
        .select('*')
        .eq('client_id', user.id)
        .eq('partner_id', service.partner_id)
        .eq('status', 'open')
        .is('project_id', null)
        .maybeSingle()
      if (conversationError) throw conversationError

      if (!conversation) {
        const created = await adminClient.from('conversations').insert({
          client_id: user.id,
          partner_id: service.partner_id,
          subject: `Заявка за услуга: ${service.title}`,
        }).select('*').single()
        if (created.error) throw created.error
        conversation = created.data
      }

      const { data: activeRequest, error: activeRequestError } = await adminClient
        .from('service_requests')
        .select('*')
        .eq('conversation_id', conversation.id)
        .in('status', ['requested', 'negotiating'])
        .maybeSingle()
      if (activeRequestError) throw activeRequestError
      if (activeRequest) {
        if (activeRequest.service_id !== serviceId) {
          throw new Error('В този разговор вече има активна заявка. Приключете я преди нова услуга.')
        }
        return jsonResponse(200, { ok: true, conversation, serviceRequest: activeRequest, reused: true })
      }

      const snapshot = {
        service_title: service.title,
        service_subtitle: service.subtitle,
        service_slug: service.slug,
        package_title: servicePackage.title,
        package_description: servicePackage.description,
        features: Array.isArray(servicePackage.features) ? servicePackage.features : [],
        starting_price: servicePackage.price_amount,
        currency: servicePackage.currency || 'EUR',
      }
      const { data: serviceRequest, error: requestError } = await adminClient.from('service_requests').insert({
        conversation_id: conversation.id,
        service_id: serviceId,
        service_package_id: servicePackage.id,
        client_id: user.id,
        partner_id: service.partner_id,
        snapshot,
      }).select('*').single()
      if (requestError) throw requestError

      const messageBody = `Заявка за услуга: ${service.title}`
      const { data: message, error: messageError } = await adminClient.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        kind: 'service_request',
        body: messageBody,
        service_request_id: serviceRequest.id,
      }).select('*').single()
      if (messageError) throw messageError

      await adminClient.from('conversations').update({
        subject: `Заявка за услуга: ${service.title}`,
        last_message_at: message.created_at,
        last_message_preview: previewFor(messageBody),
        ...nextReadFlags(conversation, user.id),
      }).eq('id', conversation.id)

      return jsonResponse(200, { ok: true, conversation, serviceRequest, message, reused: false })
    }

    if (action === 'update_service_request_status') {
      const requestId = assertUuid(payload.requestId, 'Service request id')
      const status = String(payload.status || '')
      if (!SERVICE_REQUEST_STATUSES.has(status)) throw new Error('Service request status is invalid.')
      const { data: serviceRequest, error: requestError } = await adminClient
        .from('service_requests')
        .select('*')
        .eq('id', requestId)
        .single()
      if (requestError) throw requestError
      if (status === 'cancelled' && serviceRequest.client_id !== user.id) throw new Error('Само клиентът може да отмени заявката.')
      if (status !== 'cancelled' && serviceRequest.partner_id !== user.id) throw new Error('Само партньорът може да обработи заявката.')

      const { data: updatedRequest, error: updateError } = await adminClient
        .from('service_requests')
        .update({ status })
        .eq('id', requestId)
        .select('*')
        .single()
      if (updateError) throw updateError

      const labels: Record<string, string> = {
        negotiating: 'Партньорът прие заявката за уточняване и подготвя финална оферта.',
        declined: 'Партньорът отказа заявката.',
        cancelled: 'Клиентът отмени заявката.',
      }
      const { data: message, error: messageError } = await adminClient.from('messages').insert({
        conversation_id: serviceRequest.conversation_id,
        sender_id: user.id,
        kind: 'system',
        body: labels[status],
        service_request_id: requestId,
      }).select('*').single()
      if (messageError) throw messageError

      await adminClient.from('conversations').update({
        last_message_at: message.created_at,
        last_message_preview: labels[status],
      }).eq('id', serviceRequest.conversation_id)

      return jsonResponse(200, { ok: true, serviceRequest: updatedRequest, message })
    }

    if (action === 'send_reference') {
      const conversationId = assertUuid(payload.conversationId, 'Conversation id')
      const referenceType = String(payload.referenceType || '').trim()
      const referenceId = assertUuid(payload.referenceId, 'Reference id')
      if (!REFERENCE_TYPES.has(referenceType)) throw new Error('Reference type is invalid.')

      const { data: conversation, error: conversationError } = await adminClient
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single()
      if (conversationError) throw conversationError
      if (!isParticipant(conversation, user.id)) throw new Error('Conversation access denied.')
      if (conversation.status !== 'open') throw new Error('Conversation is not open.')

      const since = new Date(Date.now() - 60_000).toISOString()
      const { count, error: countError } = await adminClient
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', user.id)
        .gte('created_at', since)
      if (countError) throw countError
      if ((count || 0) >= MAX_MESSAGES_PER_MINUTE) throw new Error('Изпращаш твърде много съобщения. Изчакай малко.')

      let body = ''
      let preview = ''

      if (referenceType === 'service') {
        const { data: service, error: serviceError } = await adminClient
          .from('partner_services')
          .select('id, slug, title, subtitle, cover_url, media, layer_slug, delivery_areas, is_published, moderation_status, partner_id, profile:profiles!partner_services_profile_id_fkey(id, slug)')
          .eq('id', referenceId)
          .maybeSingle()
        if (serviceError) throw serviceError
        if (!service?.id || service.partner_id !== conversation.partner_id) {
          throw new Error('Услугата не принадлежи на този разговор.')
        }
        if (!service.is_published || service.moderation_status !== 'approved') {
          throw new Error('Услугата не е публична в момента.')
        }

        const { data: packages, error: packagesError } = await adminClient
          .from('partner_service_packages')
          .select('price_amount, currency, delivery_days, is_active')
          .eq('service_id', referenceId)
        if (packagesError) throw packagesError

        const meta = activePackageMeta((packages || []) as Array<Record<string, unknown>>)
        body = encodeReferenceBody({
          type: 'service',
          entityId: service.id,
          title: service.title,
          subtitle: service.subtitle || '',
          coverUrl: pickCoverUrl(service as Record<string, unknown>),
          layerLabel: service.layer_slug || '',
          city: Array.isArray(service.delivery_areas) ? String(service.delivery_areas[0] || '') : '',
          priceLabel: meta.priceLabel,
          deliveryLabel: meta.deliveryLabel,
          slug: service.slug,
          profileSlug: String((service.profile as Record<string, unknown> | null)?.slug || ''),
        })
        preview = `Споделена услуга: ${service.title}`
      }

      if (referenceType === 'portfolio') {
        const { data: item, error: itemError } = await adminClient
          .from('profile_portfolio')
          .select('id, title, description, cover_url, media, layer_slug, year, city, budget_band, is_published, profile:profiles!profile_portfolio_profile_id_fkey(id, slug, user_id)')
          .eq('id', referenceId)
          .maybeSingle()
        if (itemError) throw itemError

        const profile = item?.profile as Record<string, unknown> | null
        if (!item?.id || !profile || String(profile.user_id || '') !== conversation.partner_id) {
          throw new Error('Портфолио проектът не принадлежи на този разговор.')
        }
        if (!item.is_published) {
          throw new Error('Портфолио проектът не е публичен в момента.')
        }

        body = encodeReferenceBody({
          type: 'portfolio',
          entityId: item.id,
          projectId: item.id,
          title: item.title,
          description: item.description || '',
          coverUrl: pickCoverUrl(item as Record<string, unknown>),
          layerLabel: item.layer_slug || '',
          city: item.city || '',
          year: item.year ? String(item.year) : '',
          badge: item.budget_band || '',
          profileSlug: String(profile.slug || ''),
        })
        preview = `Споделено портфолио: ${item.title}`
      }

      if (!body || !preview) {
        throw new Error('Reference payload could not be created.')
      }

      const { data: recentDuplicate, error: duplicateError } = await adminClient
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('sender_id', user.id)
        .eq('kind', 'text')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (duplicateError) throw duplicateError

      if (recentDuplicate) {
        const createdAt = new Date(recentDuplicate.created_at || '').getTime()
        if (recentDuplicate.body === body && Number.isFinite(createdAt) && Date.now() - createdAt < 10 * 60_000) {
          return jsonResponse(200, { ok: true, message: recentDuplicate, reused: true })
        }
      }

      const { data: message, error: messageError } = await adminClient
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          kind: 'text',
          body,
          attachments: [],
          was_masked: false,
        })
        .select('*')
        .single()
      if (messageError) throw messageError

      await adminClient
        .from('conversations')
        .update({
          last_message_at: message.created_at,
          last_message_preview: previewFor(preview),
          ...nextReadFlags(conversation, user.id),
        })
        .eq('id', conversationId)

      return jsonResponse(200, { ok: true, message, reused: false })
    }

    if (action === 'send_message') {
      const conversationId = assertUuid(payload.conversationId, 'Conversation id')
      const kind = String(payload.kind || 'text')
      const replyToMessageId = optionalUuid(payload.replyToMessageId)
      if (!MESSAGE_KINDS.has(kind)) throw new Error('Message kind is invalid.')

      const { data: conversation, error: conversationError } = await adminClient.from('conversations').select('*').eq('id', conversationId).single()
      if (conversationError) throw conversationError
      if (!isParticipant(conversation, user.id)) throw new Error('Conversation access denied.')
      if (conversation.status !== 'open') throw new Error('Conversation is not open.')

      if (replyToMessageId) {
        const { data: replyTarget, error: replyError } = await adminClient
          .from('messages')
          .select('id, conversation_id')
          .eq('id', replyToMessageId)
          .maybeSingle()
        if (replyError) throw replyError
        if (!replyTarget || replyTarget.conversation_id !== conversationId) {
          throw new Error('Reply target is invalid.')
        }
      }

      const since = new Date(Date.now() - 60_000).toISOString()
      const { count, error: countError } = await adminClient.from('messages').select('id', { count: 'exact', head: true }).eq('sender_id', user.id).gte('created_at', since)
      if (countError) throw countError
      if ((count || 0) >= MAX_MESSAGES_PER_MINUTE) throw new Error('Изпращаш твърде много съобщения. Изчакай малко.')

      const bodyResult = maskText(payload.body)
      if (!bodyResult.masked.trim() && kind === 'text') throw new Error('Съобщението е празно.')
      const attachments = normalizeAttachments(payload.attachments, conversationId, user.id)
      if (kind === 'attachment' && attachments.length === 0) throw new Error('Attachment message requires at least one file.')

      const { data: message, error: messageError } = await adminClient.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        kind,
        body: bodyResult.masked.trim(),
        attachments,
        reply_to_message_id: replyToMessageId,
        was_masked: bodyResult.wasMasked,
      }).select('*').single()
      if (messageError) throw messageError

      await adminClient.from('conversations').update({
        last_message_at: message.created_at,
        last_message_preview: previewFor(bodyResult.masked || attachmentPreview(attachments)),
        ...nextReadFlags(conversation, user.id),
      }).eq('id', conversationId)

      if (bodyResult.wasMasked) {
        await auditMasked(adminClient, user.id, message.id, { original_body: bodyResult.original, masked_body: bodyResult.masked, conversation_id: conversationId })
      }

      return jsonResponse(200, { ok: true, message, wasMasked: bodyResult.wasMasked, originalBody: bodyResult.original })
    }

    if (action === 'send_offer') {
      const conversationId = assertUuid(payload.conversationId, 'Conversation id')
      const { data: conversation, error: conversationError } = await adminClient.from('conversations').select('*').eq('id', conversationId).single()
      if (conversationError) throw conversationError
      if (conversation.partner_id !== user.id) throw new Error('Само партньорът може да изпрати оферта.')
      if (conversation.status !== 'open') throw new Error('Conversation is not open.')

      const title = maskText(payload.title)
      const description = maskText(payload.description)
      const deliverables = maskList(payload.deliverables)
      const executionMode = normalizeExecutionMode(payload.executionMode)
      const stages = normalizeOfferStages(payload.stages)
      if (!title.masked.trim()) throw new Error('Офертата има нужда от заглавие.')

      const priceAmount = Number(payload.priceAmount || 0)
      const deliveryDays = Number(payload.deliveryDays || 0)
      const revisions = Number(payload.revisions || 0)
      const { data: activeServiceRequest, error: activeRequestError } = await adminClient
        .from('service_requests')
        .select('*')
        .eq('conversation_id', conversationId)
        .in('status', ['requested', 'negotiating'])
        .maybeSingle()
      if (activeRequestError) throw activeRequestError

      const { data: offer, error: offerError } = await adminClient.from('offers').insert({
        conversation_id: conversationId,
        partner_id: conversation.partner_id,
        client_id: conversation.client_id,
        project_id: conversation.project_id,
        title: title.masked.trim(),
        description: description.masked.trim(),
        deliverables: deliverables.items,
        price_amount: Number.isFinite(priceAmount) ? Math.max(0, Math.round(priceAmount)) : null,
        currency: String(payload.currency || 'EUR').trim().toUpperCase().slice(0, 3) || 'EUR',
        delivery_days: Number.isFinite(deliveryDays) ? Math.max(0, Math.round(deliveryDays)) : null,
        revisions: Number.isFinite(revisions) ? Math.max(0, Math.round(revisions)) : null,
        execution_mode: executionMode,
        stages,
        expires_at: payload.expiresAt || null,
        service_request_id: activeServiceRequest?.id || null,
        service_id: activeServiceRequest?.service_id || null,
        service_package_id: activeServiceRequest?.service_package_id || null,
      }).select('*').single()
      if (offerError) throw offerError

      if (activeServiceRequest?.status === 'requested') {
        const { error: requestUpdateError } = await adminClient
          .from('service_requests')
          .update({ status: 'negotiating' })
          .eq('id', activeServiceRequest.id)
        if (requestUpdateError) throw requestUpdateError
      }

      const messageBody = `Оферта: ${offer.title}`
      const { data: message, error: messageError } = await adminClient.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        kind: 'offer',
        body: messageBody,
        offer_id: offer.id,
        was_masked: title.wasMasked || description.wasMasked || deliverables.wasMasked,
      }).select('*').single()
      if (messageError) throw messageError

      await adminClient.from('conversations').update({
        last_message_at: message.created_at,
        last_message_preview: previewFor(messageBody),
        ...nextReadFlags(conversation, user.id),
      }).eq('id', conversationId)

      if (message.was_masked) {
        await auditMasked(adminClient, user.id, message.id, {
          original_title: title.original,
          original_description: description.original,
          conversation_id: conversationId,
          offer_id: offer.id,
        })
      }

      return jsonResponse(200, { ok: true, offer, message })
    }

    if (action === 'update_offer_status') {
      const offerId = assertUuid(payload.offerId, 'Offer id')
      const status = String(payload.status || '')
      if (!OFFER_STATUSES.has(status)) throw new Error('Offer status is invalid.')

      const { data: offer, error: offerLoadError } = await adminClient.from('offers').select('*').eq('id', offerId).single()
      if (offerLoadError) throw offerLoadError
      if (offer.status !== 'sent') throw new Error('Офертата вече е обработена.')
      if (status === 'withdrawn' && offer.partner_id !== user.id) throw new Error('Само партньорът може да изтегли оферта.')
      if (status !== 'withdrawn' && offer.client_id !== user.id) throw new Error('Само клиентът може да приеме или откаже оферта.')

      const { data: conversation, error: conversationError } = await adminClient.from('conversations').select('*').eq('id', offer.conversation_id).single()
      if (conversationError) throw conversationError
      if (!isParticipant(conversation, user.id)) throw new Error('Conversation access denied.')

      let updatedOffer = null
      let order = null
      if (status === 'accepted' && offer.service_request_id) {
        const { data: accepted, error: acceptError } = await adminClient.rpc('accept_service_offer', {
          p_offer_id: offerId,
          p_client_id: user.id,
        })
        if (acceptError) throw acceptError
        updatedOffer = accepted?.offer || null
        order = accepted?.order || null
      } else {
        const patch: Record<string, unknown> = { status }
        if (status === 'accepted') patch.accepted_at = new Date().toISOString()
        const { data, error: updateError } = await adminClient
          .from('offers')
          .update(patch)
          .eq('id', offerId)
          .select('*')
          .single()
        if (updateError) throw updateError
        updatedOffer = data
      }

      const labels: Record<string, string> = {
        accepted: order
          ? 'Финалната оферта е приета. Създадена е поръчка, която очаква директно плащане към партньора.'
          : 'Офертата е приета. Плащането се уговаря и извършва директно между клиента и партньора.',
        declined: 'Офертата е отказана.',
        withdrawn: 'Офертата е изтеглена от партньора.',
      }
      const { data: message, error: messageError } = await adminClient.from('messages').insert({
        conversation_id: offer.conversation_id,
        sender_id: user.id,
        kind: 'system',
        body: labels[status],
        offer_id: offerId,
      }).select('*').single()
      if (messageError) throw messageError

      await adminClient.from('conversations').update({
        last_message_at: message.created_at,
        last_message_preview: labels[status],
        ...nextReadFlags(conversation, user.id),
      }).eq('id', offer.conversation_id)

      return jsonResponse(200, { ok: true, offer: updatedOffer, message, order })
    }

    return jsonResponse(400, { error: 'Unsupported chat action.' })
  } catch (error) {
    console.error('chat-send-message error', error)
    return jsonResponse(400, { error: error instanceof Error ? error.message : 'Chat action failed.' })
  }
})
