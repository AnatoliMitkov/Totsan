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
  created_at,
  updated_at
`

export const MESSAGE_SELECT = `
  id,
  conversation_id,
  sender_id,
  kind,
  body,
  attachments,
  offer_id,
  was_masked,
  created_at,
  offer:offers(*)
`

export function isClient(conversation, userId) {
  return conversation?.client_id === userId
}

export function isPartner(conversation, userId) {
  return conversation?.partner_id === userId
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
  return [...rows].sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
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
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return sortConversations(data || [])
}

export async function loadConversation(conversationId) {
  if (!conversationId) return null
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .eq('id', conversationId)
    .maybeSingle()
  if (error) throw error
  return data || null
}

export async function loadMessages(conversationId) {
  if (!conversationId) return []
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return sortMessages(data || [])
}

export async function markConversationRead(conversation, userId) {
  if (!conversation?.id || !userId) return
  const patch = isClient(conversation, userId)
    ? { is_read_by_client: true }
    : isPartner(conversation, userId)
      ? { is_read_by_partner: true }
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

export async function sendTextMessage({ conversationId, body }) {
  const result = await invokeChatAction('send_message', { conversationId, body, kind: 'text' })
  return result
}

export async function sendOffer({ conversationId, offer }) {
  const result = await invokeChatAction('send_offer', { conversationId, ...offer })
  return result
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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, onChange)
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
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}