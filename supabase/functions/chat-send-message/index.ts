import { createClient } from 'npm:@supabase/supabase-js@2.49.8'

const MASK = '[скрито от Totsan - общувайте в платформата]'
const MESSAGE_KINDS = new Set(['text', 'attachment'])
const OFFER_STATUSES = new Set(['accepted', 'declined', 'withdrawn'])
const MAX_MESSAGES_PER_MINUTE = 30

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

function previewFor(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 140)
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
      const projectId = optionalUuid(payload.projectId)
      const subject = String(payload.subject || '').trim() || 'Разговор в Totsan'

      if (profileId) {
        const { data: profile, error } = await adminClient.from('profiles').select('user_id, name').eq('id', profileId).maybeSingle()
        if (error) throw error
        partnerId = profile?.user_id || null
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

      const { data: conversation, error } = await adminClient.from('conversations').insert({
        client_id: user.id,
        partner_id: partnerId,
        project_id: projectId,
        subject,
      }).select('*').single()
      if (error) throw error

      return jsonResponse(200, { ok: true, conversation, reused: false })
    }

    if (action === 'send_message') {
      const conversationId = assertUuid(payload.conversationId, 'Conversation id')
      const kind = String(payload.kind || 'text')
      if (!MESSAGE_KINDS.has(kind)) throw new Error('Message kind is invalid.')

      const { data: conversation, error: conversationError } = await adminClient.from('conversations').select('*').eq('id', conversationId).single()
      if (conversationError) throw conversationError
      if (!isParticipant(conversation, user.id)) throw new Error('Conversation access denied.')
      if (conversation.status !== 'open') throw new Error('Conversation is not open.')

      const since = new Date(Date.now() - 60_000).toISOString()
      const { count, error: countError } = await adminClient.from('messages').select('id', { count: 'exact', head: true }).eq('sender_id', user.id).gte('created_at', since)
      if (countError) throw countError
      if ((count || 0) >= MAX_MESSAGES_PER_MINUTE) throw new Error('Изпращаш твърде много съобщения. Изчакай малко.')

      const bodyResult = maskText(payload.body)
      if (!bodyResult.masked.trim() && kind === 'text') throw new Error('Съобщението е празно.')
      const attachments = Array.isArray(payload.attachments) ? payload.attachments : []

      const { data: message, error: messageError } = await adminClient.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        kind,
        body: bodyResult.masked.trim(),
        attachments,
        was_masked: bodyResult.wasMasked,
      }).select('*').single()
      if (messageError) throw messageError

      await adminClient.from('conversations').update({
        last_message_at: message.created_at,
        last_message_preview: previewFor(bodyResult.masked),
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
      if (!title.masked.trim()) throw new Error('Офертата има нужда от заглавие.')

      const priceAmount = Number(payload.priceAmount || 0)
      const deliveryDays = Number(payload.deliveryDays || 0)
      const revisions = Number(payload.revisions || 0)

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
        expires_at: payload.expiresAt || null,
      }).select('*').single()
      if (offerError) throw offerError

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
      if (status === 'withdrawn' && offer.partner_id !== user.id) throw new Error('Само партньорът може да изтегли оферта.')
      if (status !== 'withdrawn' && offer.client_id !== user.id) throw new Error('Само клиентът може да приеме или откаже оферта.')

      const { data: conversation, error: conversationError } = await adminClient.from('conversations').select('*').eq('id', offer.conversation_id).single()
      if (conversationError) throw conversationError
      if (!isParticipant(conversation, user.id)) throw new Error('Conversation access denied.')

      const patch: Record<string, unknown> = { status }
      if (status === 'accepted') patch.accepted_at = new Date().toISOString()
      const { data: updatedOffer, error: updateError } = await adminClient.from('offers').update(patch).eq('id', offerId).select('*').single()
      if (updateError) throw updateError

      const labels: Record<string, string> = {
        accepted: 'Офертата е приета. Скоро ще можеш да платиш директно в сайта.',
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

      return jsonResponse(200, { ok: true, offer: updatedOffer, message })
    }

    return jsonResponse(400, { error: 'Unsupported chat action.' })
  } catch (error) {
    console.error('chat-send-message error', error)
    return jsonResponse(400, { error: error instanceof Error ? error.message : 'Chat action failed.' })
  }
})