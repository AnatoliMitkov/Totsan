import { createClient } from 'npm:@supabase/supabase-js@2.49.8'

const CHAT_ATTACHMENTS_BUCKET = 'chat-attachments'
const RETENTION_DAYS = 14
const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500
const ACTIVE_ORDER_STATUSES = new Set(['pending_payment', 'paid', 'in_progress', 'delivered', 'disputed'])

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cleanup-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Attachment = Record<string, unknown>

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function cutoffForRetention(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function normalizeLimit(value: unknown) {
  const parsed = Number(value || DEFAULT_LIMIT)
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT
  return Math.max(1, Math.min(MAX_LIMIT, Math.round(parsed)))
}

function isDeletedAttachment(attachment: Attachment) {
  const retention = attachment.retention as Record<string, unknown> | undefined
  return Boolean(attachment.deleted_at || retention?.deleted)
}

function isImageAttachment(attachment: Attachment) {
  return String(attachment.type || '').startsWith('image/') || attachment.kind === 'image'
}

function shouldDeleteAttachment(attachment: Attachment) {
  if (!isImageAttachment(attachment)) return false
  if (isDeletedAttachment(attachment)) return false
  if (String(attachment.bucket || CHAT_ATTACHMENTS_BUCKET) !== CHAT_ATTACHMENTS_BUCKET) return false
  return Boolean(String(attachment.path || ''))
}

function markDeletedAttachment(attachment: Attachment, nowIso: string, order: Record<string, unknown>) {
  return {
    ...attachment,
    deleted_at: nowIso,
    retention: {
      ...((attachment.retention as Record<string, unknown>) || {}),
      deleted: true,
      deleted_at: nowIso,
      reason: 'order_completed_14d',
      order_id: order.id,
      order_completed_at: order.completed_at || order.updated_at || null,
      retention_days: RETENTION_DAYS,
    },
  }
}

function newestCompletedOrder(orders: Array<Record<string, unknown>>) {
  return orders
    .filter((order) => order.status === 'completed' && (order.completed_at || order.updated_at))
    .sort((left, right) => {
      const leftDate = new Date(String(left.completed_at || left.updated_at)).getTime()
      const rightDate = new Date(String(right.completed_at || right.updated_at)).getTime()
      return rightDate - leftDate
    })[0] || null
}

function isReadyConversationOrderGroup(orders: Array<Record<string, unknown>>, cutoff: Date) {
  if (orders.some((order) => ACTIVE_ORDER_STATUSES.has(String(order.status || '')))) return null
  const latestCompleted = newestCompletedOrder(orders)
  if (!latestCompleted) return null
  const completedAt = new Date(String(latestCompleted.completed_at || latestCompleted.updated_at))
  if (!Number.isFinite(completedAt.getTime()) || completedAt > cutoff) return null
  return latestCompleted
}

async function readPayload(req: Request) {
  const contentType = req.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return {}
  try {
    return await req.json()
  } catch {
    return {}
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Only POST is supported.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cleanupSecret = Deno.env.get('CHAT_ATTACHMENTS_CLEANUP_SECRET') || ''

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: 'Missing Supabase environment variables.' })
  }

  const suppliedSecret = req.headers.get('x-cleanup-secret') || ''
  const authorization = req.headers.get('Authorization') || ''
  if (cleanupSecret) {
    if (suppliedSecret !== cleanupSecret) return jsonResponse(401, { error: 'Cleanup secret is invalid.' })
  } else if (authorization !== `Bearer ${serviceRoleKey}`) {
    return jsonResponse(401, { error: 'Cleanup authorization is required.' })
  }

  const payload = await readPayload(req) as Record<string, unknown>
  const dryRun = Boolean(payload.dryRun)
  const limit = normalizeLimit(payload.limit)
  const cutoff = cutoffForRetention(RETENTION_DAYS)
  const cutoffIso = cutoff.toISOString()
  const nowIso = new Date().toISOString()

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  try {
    const { data: candidateOrders, error: candidateError } = await adminClient
      .from('orders')
      .select('id, conversation_id, status, completed_at, updated_at')
      .eq('status', 'completed')
      .not('conversation_id', 'is', null)
      .or(`completed_at.lte.${cutoffIso},and(completed_at.is.null,updated_at.lte.${cutoffIso})`)
      .order('completed_at', { ascending: true, nullsFirst: false })
      .limit(limit)

    if (candidateError) throw candidateError

    const candidateConversationIds = Array.from(new Set(
      (candidateOrders || [])
        .map((order) => String(order.conversation_id || ''))
        .filter(Boolean),
    ))

    if (!candidateConversationIds.length) {
      return jsonResponse(200, {
        ok: true,
        dryRun,
        cutoff: cutoffIso,
        conversationsScanned: 0,
        messagesUpdated: 0,
        attachmentsDeleted: 0,
      })
    }

    const { data: relatedOrders, error: relatedOrdersError } = await adminClient
      .from('orders')
      .select('id, conversation_id, status, completed_at, updated_at')
      .in('conversation_id', candidateConversationIds)

    if (relatedOrdersError) throw relatedOrdersError

    const ordersByConversation = new Map<string, Array<Record<string, unknown>>>()
    for (const order of relatedOrders || []) {
      const conversationId = String(order.conversation_id || '')
      if (!conversationId) continue
      const rows = ordersByConversation.get(conversationId) || []
      rows.push(order)
      ordersByConversation.set(conversationId, rows)
    }

    const cleanupOrderByConversation = new Map<string, Record<string, unknown>>()
    for (const [conversationId, orders] of ordersByConversation.entries()) {
      const readyOrder = isReadyConversationOrderGroup(orders, cutoff)
      if (readyOrder) cleanupOrderByConversation.set(conversationId, readyOrder)
    }

    const readyConversationIds = Array.from(cleanupOrderByConversation.keys())
    if (!readyConversationIds.length) {
      return jsonResponse(200, {
        ok: true,
        dryRun,
        cutoff: cutoffIso,
        conversationsScanned: candidateConversationIds.length,
        conversationsReady: 0,
        messagesUpdated: 0,
        attachmentsDeleted: 0,
      })
    }

    const { data: messages, error: messagesError } = await adminClient
      .from('messages')
      .select('id, conversation_id, created_at, attachments')
      .in('conversation_id', readyConversationIds)

    if (messagesError) throw messagesError

    let messagesUpdated = 0
    let attachmentsDeleted = 0
    let storageErrors = 0
    let updateErrors = 0

    for (const message of messages || []) {
      const attachments = Array.isArray(message.attachments) ? message.attachments as Attachment[] : []
      const order = cleanupOrderByConversation.get(String(message.conversation_id || ''))
      if (!order || !attachments.length) continue
      const messageCreatedAt = new Date(String(message.created_at || ''))
      if (!Number.isFinite(messageCreatedAt.getTime()) || messageCreatedAt > cutoff) continue

      const pathsToDelete: string[] = []
      const nextAttachments = attachments.map((attachment) => {
        if (!shouldDeleteAttachment(attachment)) return attachment
        pathsToDelete.push(String(attachment.path))
        return markDeletedAttachment(attachment, nowIso, order)
      })

      if (!pathsToDelete.length) continue

      if (!dryRun) {
        const { error: removeError } = await adminClient.storage
          .from(CHAT_ATTACHMENTS_BUCKET)
          .remove(pathsToDelete)

        if (removeError) {
          storageErrors += 1
          console.error('chat-attachments-cleanup storage remove error', removeError)
          continue
        }

        const { error: updateError } = await adminClient
          .from('messages')
          .update({ attachments: nextAttachments })
          .eq('id', message.id)

        if (updateError) {
          updateErrors += 1
          console.error('chat-attachments-cleanup message update error', updateError)
          continue
        }
      }

      messagesUpdated += 1
      attachmentsDeleted += pathsToDelete.length
    }

    return jsonResponse(200, {
      ok: true,
      dryRun,
      cutoff: cutoffIso,
      conversationsScanned: candidateConversationIds.length,
      conversationsReady: readyConversationIds.length,
      messagesUpdated,
      attachmentsDeleted,
      storageErrors,
      updateErrors,
    })
  } catch (error) {
    console.error('chat-attachments-cleanup error', error)
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Attachment cleanup failed.' })
  }
})
