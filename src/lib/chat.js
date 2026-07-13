import { avatarFor } from '../data/images.js'
import { supabase, supabasePublicKey, supabaseUrl } from './supabase.js'

export const CONVERSATION_SELECT = `
  id,
  client_id,
  partner_id,
  project_id,
  subject,
  status,
  last_message_at,
  last_message_preview,
  is_read_by_client,
  is_read_by_partner,
  hidden_by_client_at,
  hidden_by_partner_at,
  deleted_at,
  delete_after,
  deleted_by,
  created_at,
  updated_at
`

const LEGACY_MESSAGE_SELECT = `
  id,
  conversation_id,
  sender_id,
  kind,
  body,
  attachments,
  offer_id,
  service_request_id,
  was_masked,
  created_at,
  offer:offers(*),
  service_request:service_requests(*)
`

export const MESSAGE_SELECT = `
  id,
  conversation_id,
  sender_id,
  kind,
  body,
  attachments,
  offer_id,
  service_request_id,
  reply_to_message_id,
  was_masked,
  created_at,
  offer:offers(*),
  service_request:service_requests(*)
`

const PROFILE_SELECT = 'id, user_id, name, slug, city, image_url'
const ACCOUNT_AVATAR_SELECT = 'id, full_name, display_name, avatar_url, email'
const LEGACY_MESSAGE_PREVIEW_SELECT = 'id, conversation_id, sender_id, kind, body, offer_id, created_at'
const MESSAGE_PREVIEW_SELECT = 'id, conversation_id, sender_id, kind, body, offer_id, reply_to_message_id, created_at'
const REACTION_SELECT = 'id, message_id, user_id, emoji, created_at'
const MESSAGE_FLAG_SELECT = 'id, message_id, user_id, pinned, starred, color, created_at, updated_at'
export const MESSAGE_PAGE_SIZE = 30
const SHARED_PROJECT_CONTEXT_KEY = 'totsan.chatSharedProjectContext.v1'
const SHARED_PROJECT_CONTEXT_LIMIT = 50
const CHAT_REFERENCE_PREFIX = '__totsan_ref__:'
const chatFeatureSupport = {
  replies: null,
  reactions: null,
  messageFlags: null,
}

function normalizeChatReferencePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null

  const type = String(payload.type || '').trim()
  if (type !== 'service' && type !== 'portfolio') return null

  const title = String(payload.title || '').trim()
  const entityId = String(payload.entityId || payload.id || '').trim()
  if (!title || !entityId) return null

  const profileSlug = String(payload.profileSlug || '').trim()
  const slug = String(payload.slug || '').trim()
  const projectId = String(payload.projectId || entityId).trim()

  return {
    type,
    entityId,
    title,
    subtitle: String(payload.subtitle || '').trim(),
    description: String(payload.description || '').trim(),
    coverUrl: String(payload.coverUrl || '').trim(),
    layerLabel: String(payload.layerLabel || '').trim(),
    city: String(payload.city || '').trim(),
    year: String(payload.year || '').trim(),
    priceLabel: String(payload.priceLabel || '').trim(),
    deliveryLabel: String(payload.deliveryLabel || '').trim(),
    badge: String(payload.badge || '').trim(),
    slug,
    profileSlug,
    projectId,
  }
}

export function encodeChatReferenceBody(payload) {
  const normalized = normalizeChatReferencePayload(payload)
  if (!normalized) return ''
  return `${CHAT_REFERENCE_PREFIX}${JSON.stringify(normalized)}`
}

export function decodeChatReferenceBody(value = '') {
  const text = String(value || '')
  if (!text.startsWith(CHAT_REFERENCE_PREFIX)) return null
  try {
    return normalizeChatReferencePayload(JSON.parse(text.slice(CHAT_REFERENCE_PREFIX.length)))
  } catch {
    return null
  }
}

export function getChatReferenceLabel(reference) {
  if (!reference) return ''
  return reference.type === 'service' ? 'Споделена услуга' : 'Споделено портфолио'
}

export function getChatReferenceHref(reference) {
  if (!reference) return ''
  if (reference.type === 'service' && reference.slug) {
    return `/uslugi/${encodeURIComponent(reference.slug)}`
  }
  if (reference.type === 'portfolio' && reference.profileSlug && reference.projectId) {
    return `/portfolio/${encodeURIComponent(reference.profileSlug)}/${encodeURIComponent(reference.projectId)}`
  }
  return ''
}

export function getMessageSnippet(message, { maxLength = 160, missing = 'Съобщението не е налично' } = {}) {
  if (!message) return missing
  if (message.kind === 'offer') return 'Оферта'
  if (message.kind === 'service_request') return 'Заявка за услуга'
  if (message.kind === 'system') return compactSystemText(message.body || '')

  const reference = decodeChatReferenceBody(message.body)
  if (reference) {
    return `${getChatReferenceLabel(reference)}: ${reference.title}`
  }

  if (Array.isArray(message.attachments) && message.attachments.length) {
    return message.attachments.length === 1 ? 'Прикачен файл' : `${message.attachments.length} прикачени файла`
  }

  const text = String(message.body || '').trim()
  if (!text) return missing
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 3))}...` : text
}

function supabaseErrorText(error) {
  return [
    error?.message,
    error?.details,
    error?.hint,
    error?.error_description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function isMissingReplyColumnError(error) {
  const text = supabaseErrorText(error)
  return text.includes('reply_to_message_id') && (
    text.includes('column')
    || text.includes('schema cache')
    || text.includes('does not exist')
    || text.includes('not found')
  )
}

function isMissingReactionsTableError(error) {
  const text = supabaseErrorText(error)
  return text.includes('message_reactions') && (
    text.includes('schema cache')
    || text.includes('does not exist')
    || text.includes('not found')
    || text.includes('relation')
  )
}

function isMissingMessageFlagsTableError(error) {
  const text = supabaseErrorText(error)
  return text.includes('message_flags') && (
    text.includes('schema cache')
    || text.includes('does not exist')
    || text.includes('not found')
    || text.includes('relation')
  )
}

function isMissingChatParticipantProfilesFunction(error) {
  const text = supabaseErrorText(error)
  return text.includes('get_chat_participant_profiles') && (
    text.includes('schema cache')
    || text.includes('does not exist')
    || text.includes('not found')
    || text.includes('function')
  )
}

function isMissingChatProjectContextFunction(error) {
  const text = supabaseErrorText(error)
  return text.includes('get_chat_project_context') && (
    text.includes('schema cache')
    || text.includes('does not exist')
    || text.includes('not found')
    || text.includes('function')
  )
}

function normalizeMessageRecord(row) {
  if (!row) return row
  return {
    ...row,
    reply_to_message_id: row.reply_to_message_id || null,
  }
}

async function runMessageQuery(request) {
  let select = chatFeatureSupport.replies === false ? LEGACY_MESSAGE_SELECT : MESSAGE_SELECT
  let { data, error } = await request(select)

  if (error && chatFeatureSupport.replies !== false && isMissingReplyColumnError(error)) {
    chatFeatureSupport.replies = false
    ;({ data, error } = await request(LEGACY_MESSAGE_SELECT))
  } else if (!error && chatFeatureSupport.replies !== false) {
    chatFeatureSupport.replies = true
  }

  if (error) throw error
  return Array.isArray(data)
    ? data.map(normalizeMessageRecord)
    : normalizeMessageRecord(data || null)
}

async function runMessagePreviewQuery(request) {
  let select = chatFeatureSupport.replies === false ? LEGACY_MESSAGE_PREVIEW_SELECT : MESSAGE_PREVIEW_SELECT
  let { data, error } = await request(select)

  if (error && chatFeatureSupport.replies !== false && isMissingReplyColumnError(error)) {
    chatFeatureSupport.replies = false
    ;({ data, error } = await request(LEGACY_MESSAGE_PREVIEW_SELECT))
  } else if (!error && chatFeatureSupport.replies !== false) {
    chatFeatureSupport.replies = true
  }

  if (error) throw error
  return (data || []).map(normalizeMessageRecord)
}

export function isClient(conversation, userId) {
  return String(conversation?.client_id || '') === String(userId || '')
}

export function isPartner(conversation, userId) {
  return String(conversation?.partner_id || '') === String(userId || '')
}

export function isUnread(conversation, userId) {
  if (!conversation || !userId) return false
  if (isClient(conversation, userId)) return !conversation.is_read_by_client
  if (isPartner(conversation, userId)) return !conversation.is_read_by_partner
  return false
}

export function conversationRole(conversation, userId) {
  if (isClient(conversation, userId)) return 'client'
  if (isPartner(conversation, userId)) return 'partner'
  return 'guest'
}

export function getConversationParticipant(conversation, role) {
  if (!conversation) return null
  if (role === 'client') return conversation.client || null
  if (role === 'partner') return conversation.partner || null
  return null
}

export function getOtherParticipant(conversation, userId) {
  if (!conversation) return null
  const currentId = String(userId || '')
  const clientId = String(conversation.client_id || '')
  const partnerId = String(conversation.partner_id || '')

  if (currentId === partnerId && currentId !== clientId) return conversation.client || null
  if (currentId === clientId && currentId !== partnerId) return conversation.partner || null
  if (currentId === clientId && currentId === partnerId) return conversation.partner || conversation.client || null

  if (conversation.client && clientId !== currentId) return conversation.client
  if (conversation.partner && partnerId !== currentId) return conversation.partner

  return null
}

export function getOtherParticipantRole(conversation, userId) {
  if (isPartner(conversation, userId)) return 'client'
  if (isClient(conversation, userId)) return 'partner'
  return 'guest'
}

export function getParticipantDisplayName(participant, fallback = 'Потребител') {
  return participant?.display_name || participant?.full_name || participant?.name || fallback
}

export function getConversationTitle(conversation, userId, fallback = 'Потребител') {
  const participant = getOtherParticipant(conversation, userId)
  const participantName = getParticipantDisplayName(participant, '')
  if (participantName) return participantName

  const subjectName = conversationSubjectName(conversation?.subject)
  return subjectName || fallback
}

export function getRoleLabel(role) {
  if (role === 'client') return 'Клиент'
  if (role === 'partner') return 'Партньор'
  return 'Потребител'
}

export function getParticipantPublicHref(conversation, userId) {
  const role = getOtherParticipantRole(conversation, userId)
  const participant = getOtherParticipant(conversation, userId)

  if (role === 'client' && isPartner(conversation, userId) && conversation?.sharedProject?.shareId) {
    return `/proekt/${conversation.sharedProject.shareId}`
  }

  if (role === 'partner' && participant?.slug) {
    return `/profil/${participant.slug}`
  }

  return ''
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function readSharedProjectContexts() {
  if (!canUseStorage()) return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SHARED_PROJECT_CONTEXT_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') : []
  } catch {
    return []
  }
}

function writeSharedProjectContexts(contexts) {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(
      SHARED_PROJECT_CONTEXT_KEY,
      JSON.stringify(contexts.slice(0, SHARED_PROJECT_CONTEXT_LIMIT)),
    )
  } catch {
    // Chat identity is still usable without the optional local project context.
  }
}

function normalizeSharedProjectContext(context = {}) {
  const shareId = String(context.shareId || context.publicShareId || '').trim()
  const projectId = String(context.projectId || '').trim()
  const clientId = String(context.clientId || '').trim()
  if (!shareId || !projectId || !clientId) return null

  const displayName = String(context.clientDisplayName || context.displayName || '').trim()
  const fullName = String(context.clientFullName || context.fullName || displayName).trim()
  const avatarUrl = String(context.clientAvatarUrl || context.avatarUrl || '').trim()
  const city = String(context.clientCity || context.city || '').trim()
  const projectTitle = String(context.projectTitle || '').trim()

  return {
    conversationId: String(context.conversationId || '').trim(),
    projectId,
    shareId,
    clientId,
    projectTitle,
    client: {
      display_name: displayName || fullName || '',
      full_name: fullName || displayName || '',
      name: displayName || fullName || '',
      city,
      avatar_url: avatarUrl,
      avatar_candidates: avatarUrl ? [avatarUrl] : [],
    },
    updatedAt: Date.now(),
  }
}

export function cacheSharedProjectConversationContext(conversation, context = {}) {
  const conversationId = String(conversation?.id || context.conversationId || '').trim()
  if (!conversationId) return

  const normalized = normalizeSharedProjectContext({
    ...context,
    conversationId,
    projectId: context.projectId || conversation?.project_id || '',
  })
  if (!normalized) return

  const current = readSharedProjectContexts()
  const next = [
    normalized,
    ...current.filter((item) => item.conversationId !== conversationId && item.projectId !== normalized.projectId),
  ]
  writeSharedProjectContexts(next)
}

function findSharedProjectContext(conversation) {
  if (!conversation) return null
  const contexts = readSharedProjectContexts()
  return contexts.find((item) => (
    (item.conversationId && item.conversationId === conversation.id)
    || (item.projectId && item.projectId === conversation.project_id)
  )) || null
}

function mergeParticipantWithFallback(participant, fallback) {
  if (!fallback) return participant || null
  if (!participant) return fallback

  const displayName = participant.display_name || participant.full_name || participant.name || ''
  const fallbackName = fallback.display_name || fallback.full_name || fallback.name || ''
  const avatarUrl = participant.avatar_url || fallback.avatar_url || ''
  const avatarCandidates = [
    ...(Array.isArray(participant.avatar_candidates) ? participant.avatar_candidates : []),
    ...(Array.isArray(fallback.avatar_candidates) ? fallback.avatar_candidates : []),
    avatarUrl,
  ].filter(Boolean)

  return {
    ...fallback,
    ...participant,
    display_name: displayName || fallbackName,
    full_name: participant.full_name || fallback.full_name || displayName || fallbackName,
    name: participant.name || fallback.name || displayName || fallbackName,
    avatar_url: avatarUrl,
    avatar_candidates: [...new Set(avatarCandidates)],
  }
}

function conversationSubjectName(subject = '') {
  const text = String(subject || '').trim()
  if (!text) return ''
  if (text.startsWith('Разговор с ')) return text.slice('Разговор с '.length).trim()
  return ''
}

export function compactSystemText(value = '') {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text === 'Офертата е приета. Скоро ще можеш да платиш директно в сайта.') return 'Офертата е приета.'
  if (text === 'Офертата е изтеглена от партньора.') return 'Офертата е изтеглена.'
  if (text === 'Офертата е платена и поръчката е активна.') return 'Офертата е платена · Поръчката е активна'
  return text
}

export function formatChatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'сега'
  if (diff < hour) return `${Math.floor(diff / minute)} мин`
  if (diff < day) return `${Math.floor(diff / hour)} ч`
  return new Intl.DateTimeFormat('bg-BG', { day: '2-digit', month: '2-digit' }).format(date)
}

function sortConversations(rows = []) {
  return [...rows].sort((left, right) => new Date(right.last_message_at || right.created_at).getTime() - new Date(left.last_message_at || left.created_at).getTime())
}

function sortMessages(rows = []) {
  return [...rows].sort((left, right) => {
    const timeDiff = new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    if (timeDiff !== 0) return timeDiff
    return String(left.id || '').localeCompare(String(right.id || ''))
  })
}

function dedupeMessagesById(rows = []) {
  const unique = new Map()
  rows.forEach((row) => {
    if (!row?.id) return
    const current = unique.get(row.id)
    unique.set(row.id, mergeMessageRecords(current, row))
  })
  return Array.from(unique.values())
}

function mergeMessageRecords(existing, incoming) {
  if (!existing) return incoming
  if (!incoming) return existing
  return {
    ...existing,
    ...incoming,
    offer: incoming.offer ?? existing.offer ?? null,
    service_request: incoming.service_request ?? existing.service_request ?? null,
    reply_to_message: incoming.reply_to_message ?? existing.reply_to_message ?? null,
    reactions: incoming.reactions ?? existing.reactions ?? [],
  }
}

function normalizeCursorTimestamp(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export function getMessageCursor(message) {
  if (!message?.id || !message?.created_at) return null
  const createdAt = normalizeCursorTimestamp(message.created_at)
  if (!createdAt) return null
  return {
    id: message.id,
    created_at: createdAt,
  }
}

export function mergeMessagesById(existing = [], incoming = []) {
  return sortMessages(dedupeMessagesById([...existing, ...incoming]))
}

function toReplyPreview(row) {
  if (!row?.id) return null
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    kind: row.kind,
    body: row.body,
    offer_id: row.offer_id,
    reply_to_message_id: row.reply_to_message_id || null,
    created_at: row.created_at,
  }
}

async function loadMessagePreviewsByIds(messageIds = []) {
  const uniqueIds = [...new Set(messageIds.filter(Boolean))]
  if (uniqueIds.length === 0) return []

  return runMessagePreviewQuery((select) => (
    supabase
      .from('messages')
      .select(select)
      .in('id', uniqueIds)
  ))
}

export async function loadMessageReactions(messageIds = []) {
  const uniqueIds = [...new Set(messageIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('message_reactions')
    .select(REACTION_SELECT)
    .in('message_id', uniqueIds)
    .order('created_at', { ascending: true })

  if (error) {
    if (isMissingReactionsTableError(error)) {
      chatFeatureSupport.reactions = false
      return new Map()
    }
    throw error
  }
  chatFeatureSupport.reactions = true

  const reactionsByMessageId = new Map()
  ;(data || []).forEach((reaction) => {
    const current = reactionsByMessageId.get(reaction.message_id) || []
    current.push(reaction)
    reactionsByMessageId.set(reaction.message_id, current)
  })
  return reactionsByMessageId
}

export async function loadMessageFlags(messageIds = []) {
  const uniqueIds = [...new Set(messageIds.filter(Boolean))]
  if (uniqueIds.length === 0 || chatFeatureSupport.messageFlags === false) return new Map()

  const { data, error } = await supabase
    .from('message_flags')
    .select(MESSAGE_FLAG_SELECT)
    .in('message_id', uniqueIds)

  if (error) {
    if (isMissingMessageFlagsTableError(error)) {
      chatFeatureSupport.messageFlags = false
      return new Map()
    }
    throw error
  }
  chatFeatureSupport.messageFlags = true

  const flagsByMessageId = new Map()
  ;(data || []).forEach((flag) => {
    flagsByMessageId.set(flag.message_id, {
      pinned: Boolean(flag.pinned),
      starred: Boolean(flag.starred),
      color: String(flag.color || ''),
    })
  })
  return flagsByMessageId
}

export async function saveMessageFlagState(messageId, flags = {}) {
  if (!messageId) return null
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id
  if (!userId) throw new Error('Трябва да си влязъл, за да маркираш съобщения.')

  const pinned = Boolean(flags.pinned)
  const starred = Boolean(flags.starred)
  const color = starred && flags.color ? String(flags.color) : null

  if (!pinned && !starred) {
    const { error } = await supabase
      .from('message_flags')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
    if (error) {
      if (isMissingMessageFlagsTableError(error)) {
        chatFeatureSupport.messageFlags = false
        return null
      }
      throw error
    }
    return null
  }

  const { data, error } = await supabase
    .from('message_flags')
    .upsert({
      message_id: messageId,
      user_id: userId,
      pinned,
      starred,
      color,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'message_id,user_id' })
    .select(MESSAGE_FLAG_SELECT)
    .single()

  if (error) {
    if (isMissingMessageFlagsTableError(error)) {
      chatFeatureSupport.messageFlags = false
      return null
    }
    throw error
  }
  chatFeatureSupport.messageFlags = true
  return data
}

async function loadOrdersByOfferIds(offerIds = []) {
  const uniqueIds = [...new Set(offerIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('orders')
    // Keep this lightweight lookup compatible with orders created before the
    // payment-method migration. The card only needs the order id and status
    // to provide a reliable route from an accepted offer to its order.
    .select('id, offer_id, status')
    .in('offer_id', uniqueIds)

  if (error) return new Map()
  return new Map((data || []).filter((order) => order?.offer_id && order?.id).map((order) => [order.offer_id, order]))
}

async function enrichMessages(rows = []) {
  const messages = sortMessages(dedupeMessagesById(rows || []))
  if (messages.length === 0) return []

  const messageIds = messages.map((message) => message.id)
  const messageIdSet = new Set(messageIds)
  const replyIds = [...new Set(messages.map((message) => message.reply_to_message_id).filter((replyId) => replyId && !messageIdSet.has(replyId)))]

  const offerIds = [...new Set(messages.map((message) => message.offer_id).filter(Boolean))]
  const [replyRows, reactionsByMessageId, flagsByMessageId, ordersByOfferId] = await Promise.all([
    loadMessagePreviewsByIds(replyIds),
    loadMessageReactions(messageIds),
    loadMessageFlags(messageIds),
    loadOrdersByOfferIds(offerIds),
  ])

  const repliesById = new Map()
  messages.forEach((message) => {
    const preview = toReplyPreview(message)
    if (preview) repliesById.set(preview.id, preview)
  })
  replyRows.forEach((row) => {
    const preview = toReplyPreview(row)
    if (preview) repliesById.set(preview.id, preview)
  })

  return messages.map((message) => ({
    ...message,
    offer: message.offer ? (() => {
      const order = ordersByOfferId.get(message.offer_id)
      return order ? { ...message.offer, orderId: order.id, orderStatus: order.status } : message.offer
    })() : null,
    reply_to_message: message.reply_to_message_id ? repliesById.get(message.reply_to_message_id) || null : null,
    reactions: reactionsByMessageId.get(message.id) || [],
    message_flags: flagsByMessageId.get(message.id) || null,
  }))
}

async function loadProfilesByUserIds(ids = []) {
  const uniqueIds = [...new Set(ids.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const [profilesResult, accountsResult, chatParticipantsByUserId] = await Promise.all([
    supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .in('user_id', uniqueIds),
    supabase
      .from('accounts')
      .select(ACCOUNT_AVATAR_SELECT)
      .in('id', uniqueIds),
    loadChatParticipantProfilesByUserIds(uniqueIds),
  ])

  if (profilesResult.error) throw profilesResult.error
  if (accountsResult.error) throw accountsResult.error

  const accountsByUserId = new Map((accountsResult.data || []).map((row) => [row.id, row]))
  chatParticipantsByUserId.forEach((row, userId) => {
    if (!accountsByUserId.has(userId)) accountsByUserId.set(userId, row)
  })
  const profileEntries = (profilesResult.data || []).map((row) => {
    const account = accountsByUserId.get(row.user_id) || {}
    const accountAvatarUrl = account.avatar_url || ''
    const avatarCandidates = [row.image_url, accountAvatarUrl, avatarFor(row.name || '')].filter(Boolean)
    return [row.user_id, {
      profile_id: row.id || '',
      slug: row.slug || '',
      display_name: row.name || account.display_name || account.full_name || '',
      full_name: row.name || account.full_name || '',
      name: row.name || account.display_name || account.full_name || '',
      city: row.city || '',
      avatar_url: avatarCandidates[0] || '',
      avatar_candidates: avatarCandidates,
    }]
  })

  const profilesByUserId = new Map(profileEntries)
  uniqueIds.forEach((userId) => {
    if (profilesByUserId.has(userId)) return
    const account = accountsByUserId.get(userId)
    if (!account) return
    const name = account.display_name || account.full_name || (account.email ? account.email.split('@')[0] : '')
    const avatarCandidates = [account.avatar_url, avatarFor(name)].filter(Boolean)
    profilesByUserId.set(userId, {
      display_name: name,
      full_name: account.full_name || name,
      name,
      avatar_url: avatarCandidates[0] || '',
      avatar_candidates: avatarCandidates,
    })
  })

  return profilesByUserId
}

async function loadChatParticipantProfilesByUserIds(ids = []) {
  const uniqueIds = [...new Set(ids.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await supabase.rpc('get_chat_participant_profiles', { p_user_ids: uniqueIds })
  if (error) {
    if (isMissingChatParticipantProfilesFunction(error)) return new Map()
    throw error
  }

  const participantsByUserId = new Map()
  ;(data || []).forEach((row) => {
    const userId = row.user_id || row.id
    if (!userId) return
    participantsByUserId.set(userId, {
      id: userId,
      display_name: row.display_name || row.full_name || '',
      full_name: row.full_name || row.display_name || '',
      avatar_url: row.avatar_url || '',
      city: row.city || '',
    })
  })
  return participantsByUserId
}

async function loadSharedProjectContextsByConversationIds(ids = []) {
  const uniqueIds = [...new Set(ids.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await supabase.rpc('get_chat_project_context', { p_conversation_ids: uniqueIds })
  if (error) {
    if (isMissingChatProjectContextFunction(error)) return new Map()
    throw error
  }

  const contextsByConversationId = new Map()
  ;(data || []).forEach((row) => {
    const conversationId = row.conversation_id || row.id
    const shareId = row.share_id || row.public_share_id || ''
    const projectId = row.project_id || ''
    if (!conversationId || !shareId || !projectId) return
    contextsByConversationId.set(conversationId, {
      conversationId,
      projectId,
      shareId,
      projectTitle: row.title || row.project_title || '',
    })
  })
  return contextsByConversationId
}

function normalizeConversation(conversation, profilesByUserId, sharedProjectsByConversationId = new Map()) {
  if (!conversation) return null
  const localSharedProject = findSharedProjectContext(conversation)
  const sharedProject = sharedProjectsByConversationId.get(conversation.id) || localSharedProject
  const clientFallback = localSharedProject?.clientId === conversation.client_id ? localSharedProject.client : null
  return {
    ...conversation,
    sharedProject: sharedProject
      ? {
        shareId: sharedProject.shareId,
        projectId: sharedProject.projectId,
        title: sharedProject.projectTitle || '',
      }
      : null,
    client: mergeParticipantWithFallback(profilesByUserId.get(conversation.client_id) || null, clientFallback),
    partner: profilesByUserId.get(conversation.partner_id) || null,
  }
}

async function enrichConversations(rows = []) {
  const [profilesByUserId, sharedProjectsByConversationId] = await Promise.all([
    loadProfilesByUserIds(rows.flatMap((row) => [row.client_id, row.partner_id])),
    loadSharedProjectContextsByConversationIds(rows.map((row) => row.id)),
  ])
  return rows.map((row) => normalizeConversation(row, profilesByUserId, sharedProjectsByConversationId))
}

async function enrichConversation(row) {
  if (!row) return null
  const [conversation] = await enrichConversations([row])
  return conversation || null
}

export async function loadConversationStatuses(conversationIds = []) {
  const uniqueIds = [...new Set(conversationIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('orders')
    .select('id, conversation_id, status, created_at')
    .in('conversation_id', uniqueIds)
    .order('created_at', { ascending: false })

  if (error) throw error

  const latestByConversation = new Map()
  ;(data || []).forEach((row) => {
    if (!latestByConversation.has(row.conversation_id)) {
      latestByConversation.set(row.conversation_id, row)
    }
  })
  return latestByConversation
}

async function invokeChatAction(action, payload = {}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Трябва да си влязъл в акаунта си, за да използваш чата.')
  if (!supabaseUrl) throw new Error('Липсва Supabase URL за chat endpoint-а.')

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
  if (supabasePublicKey) headers.apikey = supabasePublicKey

  const response = await fetch(`${supabaseUrl}/functions/v1/chat-send-message`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, payload }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || 'Chat action failed.')
  if (data?.error) throw new Error(data.error)
  return data
}

export async function loadConversations() {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id

  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error

  let rows = data || []
  if (userId) {
    rows = rows.filter((conversation) => {
      if (conversation.client_id === userId && conversation.hidden_by_client_at) return false
      if (conversation.partner_id === userId && conversation.hidden_by_partner_at) return false
      if (conversation.deleted_at) return false
      return true
    })
  }

  return enrichConversations(sortConversations(rows))
}

export async function loadConversation(conversationId) {
  if (!conversationId) return null
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .eq('id', conversationId)
    .maybeSingle()
  if (error) throw error
  if (data?.deleted_at) return null
  return enrichConversation(data || null)
}

export async function loadMessages(conversationId) {
  if (!conversationId) return []
  const data = await runMessageQuery((select) => (
    supabase
      .from('messages')
      .select(select)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
  ))
  return enrichMessages(data || [])
}

export async function loadMessageById(messageId) {
  if (!messageId) return null
  const data = await runMessageQuery((select) => (
    supabase
      .from('messages')
      .select(select)
      .eq('id', messageId)
      .maybeSingle()
  ))
  if (!data) return null
  const [message] = await enrichMessages([data])
  return message || null
}

export async function loadMessagePage(conversationId, { limit = MESSAGE_PAGE_SIZE, before = null } = {}) {
  if (!conversationId) {
    return {
      messages: [],
      hasOlder: false,
      oldestCursor: null,
      newestCursor: null,
    }
  }

  const safeLimit = Math.max(1, Math.min(100, Number(limit) || MESSAGE_PAGE_SIZE))
  const data = await runMessageQuery((select) => {
    let query = supabase
      .from('messages')
      .select(select)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(safeLimit + 1)

    if (before?.created_at && before?.id) {
      const createdAt = normalizeCursorTimestamp(before.created_at)
      if (createdAt) {
        query = query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${before.id})`)
      }
    }

    return query
  })

  const descendingRows = dedupeMessagesById(data || [])
  const hasOlder = descendingRows.length > safeLimit
  const pageRows = hasOlder ? descendingRows.slice(0, safeLimit) : descendingRows
  const messages = await enrichMessages(pageRows)

  return {
    messages,
    hasOlder,
    oldestCursor: getMessageCursor(messages[0] || null),
    newestCursor: getMessageCursor(messages[messages.length - 1] || null),
  }
}

export async function markConversationRead(conversation, userId) {
  if (!conversation?.id || !userId) return
  const patch = isClient(conversation, userId)
    ? conversation.is_read_by_client
      ? null
      : { is_read_by_client: true }
    : isPartner(conversation, userId)
      ? conversation.is_read_by_partner
        ? null
        : { is_read_by_partner: true }
      : null
  if (!patch) return
  await supabase.from('conversations').update(patch).eq('id', conversation.id)
}

export async function loadUnreadConversationCount(userId) {
  if (!userId) return 0
  const conversations = await loadConversations()
  return conversations.filter((conversation) => isUnread(conversation, userId)).length
}

export async function createConversationFromProfile({ profileId, partnerId, projectId = '', subject = '' }) {
  const payload = { profileId, partnerId, projectId, subject }
  const result = await invokeChatAction('create_conversation', payload)
  return result.conversation
}

async function findOpenConversation({ clientId, partnerId, projectId = '' }) {
  if (!clientId || !partnerId) return null

  const wantedProjectId = String(projectId || '').trim()
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .eq('client_id', clientId)
    .eq('partner_id', partnerId)
    .eq('status', 'open')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (error) throw error
  const rows = data || []
  if (rows.length === 0) return null

  if (wantedProjectId) {
    return rows.find((row) => row.project_id === wantedProjectId)
      || rows.find((row) => !row.project_id)
      || rows[0]
  }

  return rows.find((row) => !row.project_id) || rows[0]
}

async function attachProjectToConversation(conversation, { projectId = '', subject = '' } = {}) {
  const wantedProjectId = String(projectId || '').trim()
  if (!conversation?.id || !wantedProjectId || conversation.project_id) return conversation

  const patch = { project_id: wantedProjectId }
  if (subject && (!conversation.subject || conversation.subject === 'Връзка по ваше запитване')) {
    patch.subject = subject
  }

  const { data, error } = await supabase
    .from('conversations')
    .update(patch)
    .eq('id', conversation.id)
    .select(CONVERSATION_SELECT)
    .single()

  if (error) {
    if (error.code === '23505' || String(error.message || '').includes('idx_conversations_active_unique')) {
      const existing = await findOpenConversation({
        clientId: conversation.client_id,
        partnerId: conversation.partner_id,
        projectId: wantedProjectId,
      })
      if (existing) return existing
    }
    throw error
  }

  return data || conversation
}

export async function createConversationWithClient({ clientId, partnerId, projectId = '', subject = '', sharedProjectContext = null }) {
  if (!clientId || !partnerId) {
    throw new Error('Липсва клиент или партньор за създаване на чат.')
  }

  const existing = await findOpenConversation({ clientId, partnerId, projectId })
  if (existing) {
    const conversation = await attachProjectToConversation(existing, { projectId, subject })
    cacheSharedProjectConversationContext(conversation, sharedProjectContext || {})
    return conversation
  }

  const insertPayload = {
    client_id: clientId,
    partner_id: partnerId,
    subject: subject || 'Връзка по ваше запитване',
  }
  if (projectId) insertPayload.project_id = projectId

  const { data, error } = await supabase
    .from('conversations')
    .insert(insertPayload)
    .select(CONVERSATION_SELECT)
    .single()

  if (error) {
    if (error.code === '23505' || String(error.message || '').includes('idx_conversations_active_unique')) {
      const conversation = await findOpenConversation({ clientId, partnerId, projectId })
      if (conversation) {
        const updatedConversation = await attachProjectToConversation(conversation, { projectId, subject })
        cacheSharedProjectConversationContext(updatedConversation, sharedProjectContext || {})
        return updatedConversation
      }
    }

    console.error('Failed to create conversation with client:', error)
    throw error
  }

  cacheSharedProjectConversationContext(data, sharedProjectContext || {})
  return data
}

export async function sendTextMessage({ conversationId, body, replyToMessageId = '' }) {
  const result = await invokeChatAction('send_message', { conversationId, body, kind: 'text', replyToMessageId })
  return result
}

export async function sendAttachmentMessage({ conversationId, body = '', attachments = [], replyToMessageId = '' }) {
  const result = await invokeChatAction('send_message', {
    conversationId,
    body,
    kind: 'attachment',
    attachments,
    replyToMessageId,
  })
  return result
}

export async function sendCatalogReference({ conversationId, referenceType, referenceId }) {
  const result = await invokeChatAction('send_reference', {
    conversationId,
    referenceType,
    referenceId,
  })
  return result
}

export async function toggleMessageReaction({ messageId, emoji, userId }) {
  if (!messageId || !emoji || !userId) throw new Error('Липсва реакция или съобщение.')

  // Read ownership from the source of truth so another participant's emoji
  // can never be mistaken for the current user's reaction in a stale UI.
  const { data: existingReaction, error: lookupError } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle()

  if (lookupError) throw lookupError

  if (existingReaction?.id) {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('id', existingReaction.id)
    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('message_reactions')
    .insert({
      message_id: messageId,
      user_id: userId,
      emoji,
    })
  if (error && error.code !== '23505') throw error
}

export async function sendOffer({ conversationId, offer }) {
  const result = await invokeChatAction('send_offer', { conversationId, ...offer })
  return result
}

export async function createServiceRequest({ serviceId, servicePackageId }) {
  const result = await invokeChatAction('create_service_request', { serviceId, servicePackageId })
  return result
}

export async function updateServiceRequestStatus({ requestId, status }) {
  return invokeChatAction('update_service_request_status', { requestId, status })
}

export async function updateOfferStatus({ offerId, status }) {
  const result = await invokeChatAction('update_offer_status', { offerId, status })
  return result
}

export function subscribeToConversationList(userId, onChange) {
  if (!userId) return () => {}
  const channelId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  const channel = supabase
    .channel(`conversation-list:${userId}:${channelId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `client_id=eq.${userId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `partner_id=eq.${userId}` }, onChange)
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

export function subscribeToConversation(conversationId, onChange) {
  if (!conversationId) return () => {}
  const channelId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  const channel = supabase
    .channel(`conversation:${conversationId}:${channelId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `id=eq.${conversationId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `conversation_id=eq.${conversationId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests', filter: `conversation_id=eq.${conversationId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_flags' }, onChange)
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

export async function archiveConversation(conversation, userId) {
  if (!conversation?.id || !userId) return null
  
  const patch = {}
  if (isClient(conversation, userId)) {
    patch.hidden_by_client_at = new Date().toISOString()
  } else if (isPartner(conversation, userId)) {
    patch.hidden_by_partner_at = new Date().toISOString()
  } else {
    throw new Error('Нямате достъп до този разговор.')
  }

  const { data, error } = await supabase
    .from('conversations')
    .update(patch)
    .eq('id', conversation.id)
    .select(CONVERSATION_SELECT)
    .single()

  if (error) throw error
  return data
}

export async function deleteConversationForEveryone(conversationId) {
  if (!conversationId) throw new Error('Липсва разговор.')

  const { data, error } = await supabase.rpc('delete_conversation_for_everyone', {
    p_conversation_id: conversationId,
  })

  if (error) throw error
  return enrichConversation(data || null)
}

export async function updateConversationStatus(conversationId, status) {
  if (!conversationId) throw new Error('Липсва разговор.')
  if (!['open', 'closed', 'blocked'].includes(status)) {
    throw new Error('Невалиден статус на разговор.')
  }

  const { data, error } = await supabase
    .from('conversations')
    .update({ status })
    .eq('id', conversationId)
    .select(CONVERSATION_SELECT)
    .single()

  if (error) throw error
  if (data?.deleted_at) return null
  return enrichConversation(data || null)
}
