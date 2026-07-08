import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ConversationList from '../components/chat/ConversationList.jsx'
import ChatThread from '../components/chat/ChatThread.jsx'
import ComposeBar from '../components/chat/ComposeBar.jsx'
import OfferComposer from '../components/chat/OfferComposer.jsx'
import { useAccount } from '../lib/account.js'
import {
  archiveConversation,
  conversationRole,
  getMessageCursor,
  isClient,
  isPartner,
  loadConversation,
  loadConversations,
  loadConversationStatuses,
  loadMessageById,
  loadMessagePage,
  loadMessageReactions,
  markConversationRead,
  mergeMessagesById,
  MESSAGE_PAGE_SIZE,
  sendOffer,
  sendAttachmentMessage,
  sendCatalogReference,
  sendTextMessage,
  subscribeToConversation,
  subscribeToConversationList,
  toggleMessageReaction,
  updateOfferStatus,
  updateServiceRequestStatus,
} from '../lib/chat.js'
import { normalizeAttachmentFiles, uploadChatAttachments } from '../lib/chat-attachments.js'
import { loadPublicPartnerServicesForProfile } from '../lib/partner-services.js'
import { loadProfilePortfolio } from '../lib/portfolio.js'

const EMPTY_PAGINATION = {
  hasOlder: false,
  isLoadingOlder: false,
}

function parseInboxConversationId(pathname = '') {
  const match = String(pathname || '').match(/^\/inbox\/([^/?#]+)/)
  return match?.[1] || ''
}

function buildInboxPath(conversationId = '') {
  return conversationId ? `/inbox/${conversationId}` : '/inbox'
}

export default function Inbox() {
  const { conversationId: initialConversationId = '' } = useParams()
  const navigate = useNavigate()
  const { session, account, loading } = useAccount()
  const userId = session?.user?.id || ''
  const [conversations, setConversations] = useState([])
  const [selectedConversationId, setSelectedConversationId] = useState(initialConversationId)
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('loading')
  const [threadStatus, setThreadStatus] = useState('idle')
  const [pagination, setPagination] = useState(EMPTY_PAGINATION)
  const [messageStatus, setMessageStatus] = useState('idle')
  const [conversationStatuses, setConversationStatuses] = useState(new Map())
  const [error, setError] = useState('')
  const [accessDenied, setAccessDenied] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftFiles, setDraftFiles] = useState([])
  const [scrollToLatestToken, setScrollToLatestToken] = useState(0)
  const [replyTarget, setReplyTarget] = useState(null)
  const [offerOpen, setOfferOpen] = useState(false)
  const [referenceLibrary, setReferenceLibrary] = useState({ status: 'idle', profileId: '', services: [], portfolio: [] })
  const initialLoadRef = useRef(false)
  const threadTokenRef = useRef(0)
  const metaRefreshTimerRef = useRef(null)
  const threadCacheRef = useRef(new Map())
  const conversationsRef = useRef([])
  const selectedConversationIdRef = useRef(initialConversationId)

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId
  }, [selectedConversationId])

  const activeConversationId = selectedConversationId
  const visibleConversations = useMemo(
    () => conversations.filter((c) => isClient(c, userId) || isPartner(c, userId)),
    [conversations, userId]
  )
  const activeConversation = useMemo(
    () => visibleConversations.find((conversation) => conversation.id === activeConversationId) || null,
    [visibleConversations, activeConversationId],
  )
  const activeServiceRequest = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const request = messages[index]?.service_request
      if (request && ['requested', 'negotiating'].includes(request.status)) return request
    }
    return null
  }, [messages])
  const role = conversationRole(activeConversation, userId)
  const isGuest = !activeConversationId ? false : (!activeConversation ? true : role === 'guest')
  const isVerifying = Boolean(activeConversationId && !activeConversation && !accessDenied)
  
  // Safe derived values for the hard render gate
  const safeActiveConversation = (!accessDenied && !isGuest) ? activeConversation : null
  const safeMessages = (!accessDenied && !isGuest) ? messages : []

  const partnerProfileId = safeActiveConversation?.partner?.profile_id || ''

  const writeThreadCache = useCallback((conversationId, payload) => {
    if (!conversationId || !userId) return
    const key = `${userId}:${conversationId}`
    const current = threadCacheRef.current.get(key) || {}
    threadCacheRef.current.set(key, {
      ...current,
      ...payload,
      updatedAt: Date.now(),
    })
  }, [userId])

  const applyThreadSnapshot = useCallback((conversationId, nextMessages, nextPagination, nextStatus = 'ready') => {
    setMessages(nextMessages)
    setPagination(nextPagination)
    setThreadStatus(nextStatus)
    writeThreadCache(conversationId, {
      messages: nextMessages,
      pagination: nextPagination,
      status: nextStatus,
    })
  }, [writeThreadCache])

  const mergeIncomingMessages = useCallback((conversationId, incoming) => {
    if (!conversationId || !Array.isArray(incoming) || incoming.length === 0) return

    if (conversationId === activeConversationId) {
      setMessages((current) => {
        const nextMessages = mergeMessagesById(current, incoming)
        const cached = threadCacheRef.current.get(`${userId}:${conversationId}`) || {}
        writeThreadCache(conversationId, {
          messages: nextMessages,
          pagination: cached.pagination || pagination,
          status: 'ready',
        })
        return nextMessages
      })
      return
    }

    const cached = threadCacheRef.current.get(`${userId}:${conversationId}`)
    if (!cached?.messages) return
    writeThreadCache(conversationId, {
      messages: mergeMessagesById(cached.messages, incoming),
    })
  }, [activeConversationId, pagination, writeThreadCache])

  const patchOfferMessage = useCallback((conversationId, offer) => {
    if (!conversationId || !offer?.id) return

    const patchMessages = (rows = []) => rows.map((message) => {
      if (message.kind !== 'offer' || message.offer_id !== offer.id) return message
      return {
        ...message,
        offer: {
          ...(message.offer || {}),
          ...offer,
        },
      }
    })

    if (conversationId === activeConversationId) {
      setMessages((current) => {
        const nextMessages = patchMessages(current)
        const cached = threadCacheRef.current.get(`${userId}:${conversationId}`) || {}
        writeThreadCache(conversationId, {
          messages: nextMessages,
          pagination: cached.pagination || pagination,
          status: 'ready',
        })
        return nextMessages
      })
      return
    }

    const cached = threadCacheRef.current.get(`${userId}:${conversationId}`)
    if (!cached?.messages) return
    writeThreadCache(conversationId, {
      messages: patchMessages(cached.messages),
    })
  }, [activeConversationId, pagination, writeThreadCache])

  const replaceMessageReactions = useCallback((conversationId, messageId, reactions) => {
    if (!conversationId || !messageId) return

    const patchMessages = (rows = []) => rows.map((message) => (
      message.id === messageId
        ? { ...message, reactions }
        : message
    ))

    if (conversationId === activeConversationId) {
      setMessages((current) => {
        const nextMessages = patchMessages(current)
        const cached = threadCacheRef.current.get(`${userId}:${conversationId}`) || {}
        writeThreadCache(conversationId, {
          messages: nextMessages,
          pagination: cached.pagination || pagination,
          status: 'ready',
        })
        return nextMessages
      })
      return
    }

    const cached = threadCacheRef.current.get(`${userId}:${conversationId}`)
    if (!cached?.messages) return
    writeThreadCache(conversationId, {
      messages: patchMessages(cached.messages),
    })
  }, [activeConversationId, pagination, writeThreadCache])

  const loadFreshMessage = useCallback(async (messageId, fallback = null) => {
    if (!messageId) return fallback
    try {
      return await loadMessageById(messageId)
    } catch {
      return fallback
    }
  }, [])

  const refreshMessageReactions = useCallback(async (conversationId, messageId) => {
    if (!conversationId || !messageId) return
    try {
      const reactionsByMessageId = await loadMessageReactions([messageId])
      replaceMessageReactions(conversationId, messageId, reactionsByMessageId.get(messageId) || [])
    } catch {
      // Keep the thread stable if a reaction refresh misses.
    }
  }, [replaceMessageReactions])

  const loadConversationCollection = useCallback(async (preferredConversationId = '') => {
    const targetConversationId = preferredConversationId || selectedConversationIdRef.current
    let nextConversations = await loadConversations()
    
    // Filter to participant-only
    nextConversations = nextConversations.filter(
      (c) => isClient(c, userId) || isPartner(c, userId)
    )

    if (targetConversationId && !nextConversations.some((conversation) => conversation.id === targetConversationId)) {
      const directConversation = await loadConversation(targetConversationId)
      // Only add the conversation if the current user is a participant
      if (directConversation && (isClient(directConversation, userId) || isPartner(directConversation, userId))) {
        nextConversations = [directConversation, ...nextConversations]
      }
    }

    const nextStatuses = await loadConversationStatuses(nextConversations.map((conversation) => conversation.id))
    setConversations(nextConversations)
    setConversationStatuses(nextStatuses)
    return nextConversations
  }, [userId])

  const refreshLatestThreadPage = useCallback(async (conversationId, token, nextConversations) => {
    const page = await loadMessagePage(conversationId, { limit: MESSAGE_PAGE_SIZE })
    if (threadTokenRef.current !== token) return

    const cached = threadCacheRef.current.get(`${userId}:${conversationId}`)
    const nextMessages = cached?.messages?.length ? mergeMessagesById(cached.messages, page.messages) : page.messages
    const nextPagination = cached?.messages?.length
      ? { ...(cached.pagination || EMPTY_PAGINATION), isLoadingOlder: false }
      : { hasOlder: page.hasOlder, isLoadingOlder: false }

    if (conversationId === activeConversationId) {
      applyThreadSnapshot(conversationId, nextMessages, nextPagination, 'ready')
    } else {
      writeThreadCache(conversationId, {
        messages: nextMessages,
        pagination: nextPagination,
        status: 'ready',
      })
    }

    const active = nextConversations.find((conversation) => conversation.id === conversationId)
    if (active) await markConversationRead(active, userId)
  }, [activeConversationId, applyThreadSnapshot, userId, writeThreadCache])

  const loadThread = useCallback(async (conversationId, { showLoading = true } = {}) => {
    const token = threadTokenRef.current + 1
    threadTokenRef.current = token

    if (!conversationId) {
      setMessages([])
      setThreadStatus('idle')
      setPagination(EMPTY_PAGINATION)
      return
    }

    const nextConversations = conversationsRef.current
    const cached = threadCacheRef.current.get(`${userId}:${conversationId}`)
    if (cached?.messages?.length) {
      setMessages(cached.messages)
      setPagination(cached.pagination || EMPTY_PAGINATION)
      setThreadStatus(cached.status || 'ready')
      void refreshLatestThreadPage(conversationId, token, nextConversations).catch(() => {})
      return
    }

    if (showLoading) setThreadStatus('loading')
    setMessages([])
    setPagination(EMPTY_PAGINATION)

    try {
      const page = await loadMessagePage(conversationId, { limit: MESSAGE_PAGE_SIZE })
      if (threadTokenRef.current !== token) return

      applyThreadSnapshot(
        conversationId,
        page.messages,
        { hasOlder: page.hasOlder, isLoadingOlder: false },
        'ready',
      )

      const active = nextConversations.find((conversation) => conversation.id === conversationId)
      if (active) await markConversationRead(active, userId)
    } catch (loadError) {
      if (threadTokenRef.current !== token) return
      setMessages([])
      setPagination(EMPTY_PAGINATION)
      setThreadStatus('error')
      setError(loadError.message || 'Разговорът не се зареди.')
    }
  }, [applyThreadSnapshot, refreshLatestThreadPage, userId])

  const loadAll = useCallback(async ({ keepStatus = false, conversationId = '' } = {}) => {
    if (!userId) return
    if (!keepStatus) setStatus('loading')
    setError('')
    setAccessDenied(false)

    try {
      const requestedConversationId = conversationId || selectedConversationIdRef.current
      const nextConversations = await loadConversationCollection(requestedConversationId)
      const found = requestedConversationId && nextConversations.some((conversation) => conversation.id === requestedConversationId)
      const nextSelectedId = found ? requestedConversationId : ''

      // If the URL requested a specific conversation but it's not in the filtered list,
      // the user is not a participant — deny access and clear all thread state.
      if (requestedConversationId && !found) {
        setAccessDenied(true)
        setSelectedConversationId('')
        setMessages([])
        setThreadStatus('idle')
        setPagination(EMPTY_PAGINATION)
        setDraft('')
        setDraftFiles([])
        setReplyTarget(null)
        setOfferOpen(false)
        setMessageStatus('idle')
        const cacheKey = `${userId}:${requestedConversationId}`
        threadCacheRef.current.delete(cacheKey)
        setStatus('ready')
        return
      }

      setStatus('ready')
      if (nextSelectedId !== selectedConversationIdRef.current) {
        setSelectedConversationId(nextSelectedId)
        if (!nextSelectedId) navigate('/inbox', { replace: true })
      }
      await loadThread(nextSelectedId)
    } catch (loadError) {
      setError(loadError.message || 'Съобщенията не се заредиха.')
      setStatus('error')
      setThreadStatus('error')
    }
  }, [loadConversationCollection, loadThread, navigate, userId])

  const refreshConversationCollection = useCallback(async () => {
    if (!userId) return
    try {
      await loadConversationCollection()
    } catch (loadError) {
      setError(loadError.message || 'Списъкът със съобщения не се обнови.')
    }
  }, [loadConversationCollection, userId])

  const scheduleConversationRefresh = useCallback(() => {
    if (metaRefreshTimerRef.current) return
    metaRefreshTimerRef.current = window.setTimeout(() => {
      metaRefreshTimerRef.current = null
      refreshConversationCollection()
    }, 120)
  }, [refreshConversationCollection])

  const loadOlderMessages = useCallback(async () => {
    if (!activeConversationId || threadStatus !== 'ready' || pagination.isLoadingOlder || !pagination.hasOlder) return false

    const oldestCursor = getMessageCursor(messages[0] || null)
    if (!oldestCursor) return false

    const activeToken = threadTokenRef.current
    const nextPagination = { ...pagination, isLoadingOlder: true }
    setPagination(nextPagination)
    writeThreadCache(activeConversationId, {
      messages,
      pagination: nextPagination,
      status: 'ready',
    })

    try {
      const page = await loadMessagePage(activeConversationId, {
        limit: MESSAGE_PAGE_SIZE,
        before: oldestCursor,
      })
      if (threadTokenRef.current !== activeToken) return false

      applyThreadSnapshot(
        activeConversationId,
        mergeMessagesById(page.messages, messages),
        { hasOlder: page.hasOlder, isLoadingOlder: false },
        'ready',
      )
      return page.messages.length > 0
    } catch (loadError) {
      if (threadTokenRef.current !== activeToken) return false
      const rollbackPagination = { ...pagination, isLoadingOlder: false }
      setPagination(rollbackPagination)
      writeThreadCache(activeConversationId, {
        messages,
        pagination: rollbackPagination,
        status: 'ready',
      })
      setError(loadError.message || 'По-старите съобщения не се заредиха.')
      return false
    }
  }, [activeConversationId, applyThreadSnapshot, messages, pagination, threadStatus, writeThreadCache])

  useEffect(() => {
    if (loading || !userId) return
    if (initialLoadRef.current) return
    loadAll({ keepStatus: false, conversationId: selectedConversationIdRef.current })
    initialLoadRef.current = true
  }, [loading, userId, loadAll])

  useEffect(() => {
    setSelectedConversationId(initialConversationId || '')
    // Clear access denied when the URL changes — it will be re-evaluated on load
    setAccessDenied(false)
  }, [initialConversationId])

  useEffect(() => {
    if (!initialLoadRef.current || !initialConversationId || !userId) return

    const hasConversation = conversations.some((c) => c.id === initialConversationId)
    if (hasConversation) return

    let active = true
    async function verifyAndAddConversation() {
      try {
        const directConversation = await loadConversation(initialConversationId)
        if (!active) return
        if (directConversation && (isClient(directConversation, userId) || isPartner(directConversation, userId))) {
          setConversations((current) => {
            if (current.some((c) => c.id === directConversation.id)) return current
            return [directConversation, ...current]
          })
          setAccessDenied(false)
        } else {
          setAccessDenied(true)
          setSelectedConversationId('')
          setMessages([])
          setThreadStatus('idle')
          setPagination(EMPTY_PAGINATION)
          setDraft('')
          setDraftFiles([])
          setReplyTarget(null)
          setOfferOpen(false)
          setMessageStatus('idle')
          const cacheKey = `${userId}:${initialConversationId}`
          threadCacheRef.current.delete(cacheKey)
        }
      } catch (err) {
        if (!active) return
        setAccessDenied(true)
        setSelectedConversationId('')
        setMessages([])
        setThreadStatus('idle')
        setPagination(EMPTY_PAGINATION)
        setDraft('')
        setDraftFiles([])
        setReplyTarget(null)
        setOfferOpen(false)
        setMessageStatus('idle')
        const cacheKey = `${userId}:${initialConversationId}`
        threadCacheRef.current.delete(cacheKey)
      }
    }

    void verifyAndAddConversation()
    return () => {
      active = false
    }
  }, [initialConversationId, conversations, userId])

  useEffect(() => {
    if (!initialLoadRef.current) return
    if (!activeConversationId || accessDenied || isGuest) {
      setMessages([])
      setThreadStatus('idle')
      setPagination(EMPTY_PAGINATION)
      return
    }
    loadThread(activeConversationId, { showLoading: !threadCacheRef.current.get(`${userId}:${activeConversationId}`)?.messages?.length })
  }, [activeConversationId, accessDenied, isGuest, loadThread, userId])

  useEffect(() => {
    setReplyTarget(null)
    setDraftFiles([])
  }, [activeConversationId])

  useEffect(() => {
    if (!activeConversation || !userId || accessDenied || isGuest) return
    const unread = activeConversation.client_id === userId
      ? !activeConversation.is_read_by_client
      : activeConversation.partner_id === userId
        ? !activeConversation.is_read_by_partner
        : false

    if (unread) {
      void markConversationRead(activeConversation, userId).catch(() => {})
      setConversations((current) => current.map((c) => {
        if (c.id !== activeConversation.id) return c
        return {
          ...c,
          is_read_by_client: activeConversation.client_id === userId ? true : c.is_read_by_client,
          is_read_by_partner: activeConversation.partner_id === userId ? true : c.is_read_by_partner,
        }
      }))
    }
  }, [activeConversation, accessDenied, isGuest, userId])

  useEffect(() => {
    let active = true

    async function loadReferenceLibrary() {
      if (!partnerProfileId || !activeConversation) {
        if (!active) return
        setReferenceLibrary({ status: 'idle', profileId: '', services: [], portfolio: [] })
        return
      }

      setReferenceLibrary((current) => ({
        status: 'loading',
        profileId: partnerProfileId,
        services: current.profileId === partnerProfileId ? current.services : [],
        portfolio: current.profileId === partnerProfileId ? current.portfolio : [],
      }))

      try {
        const [services, portfolio] = await Promise.all([
          loadPublicPartnerServicesForProfile(partnerProfileId),
          loadProfilePortfolio(partnerProfileId),
        ])
        if (!active) return
        setReferenceLibrary({
          status: 'ready',
          profileId: partnerProfileId,
          services,
          portfolio,
        })
      } catch {
        if (!active) return
        setReferenceLibrary({
          status: 'error',
          profileId: partnerProfileId,
          services: [],
          portfolio: [],
        })
      }
    }

    void loadReferenceLibrary()
    return () => {
      active = false
    }
  }, [activeConversation, partnerProfileId])

  useEffect(() => {
    const handlePopState = () => {
      setSelectedConversationId(parseInboxConversationId(window.location.pathname))
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!userId) return undefined
    return subscribeToConversationList(userId, scheduleConversationRefresh)
  }, [userId, scheduleConversationRefresh])

  useEffect(() => {
    if (!activeConversationId || accessDenied || isGuest) return undefined

    return subscribeToConversation(activeConversationId, async (payload) => {
      if (!payload?.table) {
        scheduleConversationRefresh()
        return
      }

      if (payload.table === 'messages') {
        scheduleConversationRefresh()

        if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return
        const messageId = payload.new?.id || payload.old?.id
        if (!messageId) return

        try {
          const nextMessage = await loadFreshMessage(messageId)
          if (!nextMessage || nextMessage.conversation_id !== activeConversationId) return
          mergeIncomingMessages(activeConversationId, [nextMessage])
        } catch {
          // Keep the current thread stable if the incremental refresh misses.
        }
        return
      }

      if (payload.table === 'offers') {
        scheduleConversationRefresh()
        if (payload.eventType === 'UPDATE' && payload.new?.id) {
          patchOfferMessage(activeConversationId, payload.new)
        }
        return
      }

      if (payload.table === 'message_reactions') {
        const messageId = payload.new?.message_id || payload.old?.message_id
        if (!messageId) return
        const hasMessageLoaded = (threadCacheRef.current.get(`${userId}:${activeConversationId}`)?.messages || []).some((message) => message.id === messageId)
        if (!hasMessageLoaded) return
        void refreshMessageReactions(activeConversationId, messageId)
        return
      }

      scheduleConversationRefresh()
    })
  }, [accessDenied, isGuest, activeConversationId, loadFreshMessage, mergeIncomingMessages, patchOfferMessage, refreshMessageReactions, scheduleConversationRefresh])

  useEffect(() => {
    return () => {
      if (metaRefreshTimerRef.current) {
        window.clearTimeout(metaRefreshTimerRef.current)
      }
    }
  }, [])

  async function submitMessage(event) {
    event.preventDefault()
    if (!activeConversationId || (!draft.trim() && draftFiles.length === 0)) return
    setMessageStatus('sending')

    try {
      const attachments = draftFiles.length
        ? await uploadChatAttachments({ conversationId: activeConversationId, userId, files: draftFiles })
        : []
      const result = attachments.length
        ? await sendAttachmentMessage({
          conversationId: activeConversationId,
          body: draft,
          attachments,
          replyToMessageId: replyTarget?.id || '',
        })
        : await sendTextMessage({
          conversationId: activeConversationId,
          body: draft,
          replyToMessageId: replyTarget?.id || '',
        })
      if (result?.message?.id) {
        const nextMessage = await loadFreshMessage(result.message.id, result.message)
        if (nextMessage) mergeIncomingMessages(activeConversationId, [nextMessage])
      }
      setScrollToLatestToken((value) => value + 1)
      setDraft('')
      setDraftFiles([])
      setReplyTarget(null)
      setMessageStatus('idle')
      scheduleConversationRefresh()
    } catch (sendError) {
      setError(sendError.message || 'Съобщението не се изпрати.')
      setMessageStatus('idle')
    }
  }

  async function handleSendReference({ referenceType, referenceId }) {
    if (!activeConversationId || !referenceType || !referenceId) return
    setMessageStatus('sending')
    setError('')

    try {
      const result = await sendCatalogReference({
        conversationId: activeConversationId,
        referenceType,
        referenceId,
      })
      if (result?.message?.id) {
        const nextMessage = await loadFreshMessage(result.message.id, result.message)
        if (nextMessage) mergeIncomingMessages(activeConversationId, [nextMessage])
      }
      setScrollToLatestToken((value) => value + 1)
      setMessageStatus('idle')
      scheduleConversationRefresh()
    } catch (referenceError) {
      setError(referenceError.message || 'Препратката не се изпрати.')
      setMessageStatus('idle')
      throw referenceError
    }
  }

  async function submitOffer(offer) {
    if (!activeConversationId) return
    setMessageStatus('sending')

    try {
      const result = await sendOffer({ conversationId: activeConversationId, offer })
      if (result?.message?.id) {
        const nextMessage = await loadFreshMessage(result.message.id, { ...result.message, offer: result.offer || null })
        if (nextMessage) mergeIncomingMessages(activeConversationId, [nextMessage])
      }
      setScrollToLatestToken((value) => value + 1)
      setOfferOpen(false)
      setMessageStatus('idle')
      scheduleConversationRefresh()
    } catch (offerError) {
      setError(offerError.message || 'Офертата не се изпрати.')
      setMessageStatus('idle')
    }
  }

  async function handleOfferAction(offer, nextStatus) {
    if (nextStatus === 'question') {
      setDraft(`Въпрос по офертата "${offer.title || 'оферта'}": `)
      return
    }

    setMessageStatus('sending')

    try {
      const result = await updateOfferStatus({ offerId: offer.id, status: nextStatus })
      if (result?.offer) patchOfferMessage(activeConversationId, result.offer)
      if (result?.message?.id) {
        const nextMessage = await loadFreshMessage(result.message.id, { ...result.message, offer: null })
        if (nextMessage) mergeIncomingMessages(activeConversationId, [nextMessage])
      }
      if (nextStatus === 'accepted' && result?.order?.id) {
        navigate(`/order/${result.order.id}`)
        return
      }
      setMessageStatus('idle')
      scheduleConversationRefresh()
    } catch (offerError) {
      setError(offerError.message || 'Статусът на офертата не се промени.')
      setMessageStatus('idle')
    }
  }

  function handleReplyToMessage(message) {
    if (!message?.id) return
    setReplyTarget(message)
  }

  async function handleServiceRequestAction(request, nextStatus) {
    setMessageStatus('sending')
    setError('')
    try {
      if (nextStatus === 'prepare_offer') {
        if (request.status === 'requested') {
          await updateServiceRequestStatus({ requestId: request.id, status: 'negotiating' })
          await loadThread(activeConversationId, { showLoading: false })
          scheduleConversationRefresh()
        }
        setOfferOpen(true)
        setMessageStatus('idle')
        return
      }

      await updateServiceRequestStatus({ requestId: request.id, status: nextStatus })
      await loadThread(activeConversationId, { showLoading: false })
      setMessageStatus('idle')
      scheduleConversationRefresh()
    } catch (requestError) {
      setError(requestError.message || 'Заявката не беше обновена.')
      setMessageStatus('idle')
    }
  }

  function handleDraftFilesChange(files) {
    try {
      const nextFiles = normalizeAttachmentFiles([...draftFiles, ...Array.from(files || [])])
      setDraftFiles(nextFiles)
      setError('')
    } catch (fileError) {
      setError(fileError.message || 'File cannot be attached.')
    }
  }

  function handleRemoveDraftFile(index) {
    setDraftFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  async function handleToggleReaction(messageId, emoji, active) {
    if (!activeConversationId || !messageId || !emoji) return
    try {
      await toggleMessageReaction({ messageId, emoji, userId, active })
      await refreshMessageReactions(activeConversationId, messageId)
    } catch (reactionError) {
      setError(reactionError.message || 'Реакцията не се обнови.')
    }
  }

  const handleArchiveConversation = useCallback(async (conversation) => {
    if (!conversation || !userId) return
    try {
      await archiveConversation(conversation, userId)
      
      const nextConversations = conversationsRef.current.filter((c) => c.id !== conversation.id)
      setConversations(nextConversations)
      
      if (conversation.id === selectedConversationId) {
        setSelectedConversationId('')
        navigate('/inbox', { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Грешка при архивиране на разговора.')
    }
  }, [navigate, userId, selectedConversationId])


  if (loading) return <InboxShell><Panel title="Зареждаме..." /></InboxShell>

  const hasSelectedConversation = Boolean(activeConversationId)

  function handleSelectConversation(id) {
    if (!id || id === activeConversationId) return
    setSelectedConversationId(id)
    navigate(buildInboxPath(id))
  }

  function handleBackToList() {
    setSelectedConversationId('')
    navigate('/inbox')
  }

  if (!session) {
    return (
      <InboxShell>
        <Panel title="Влез, за да видиш съобщенията си.">
          <p className="mt-2 text-sm text-muted">Разговорите са достъпни само за участниците.</p>
          <Link to="/login" className="btn btn-primary mt-5">Вход</Link>
        </Panel>
      </InboxShell>
    )
  }

  return (
    <InboxShell>
      {error && <div className="shrink-0 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {status === 'loading' ? (
        <Panel title="Зареждаме съобщенията..." />
      ) : status === 'error' ? (
        <Panel title="Съобщенията не се заредиха">
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => loadAll()} className="btn btn-ghost mt-5">Опитай пак</button>
        </Panel>
      ) : (
        <div className="grid min-h-0 min-w-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(18rem,21rem)_minmax(0,1fr)] lg:gap-3 xl:grid-cols-[minmax(20rem,23rem)_minmax(0,1fr)]">
          <div className={`${hasSelectedConversation ? 'hidden lg:flex' : 'flex'} min-h-0 min-w-0`}>
            <ConversationList
              conversations={visibleConversations}
              activeId={activeConversationId}
              userId={userId}
              statusByConversation={conversationStatuses}
              onSelect={handleSelectConversation}
              onArchive={handleArchiveConversation}
            />
          </div>
          <div className={`${hasSelectedConversation ? 'flex' : 'hidden lg:flex'} min-h-0 min-w-0 flex-col overflow-hidden lg:gap-3`}>
            {isVerifying ? (
              <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">
                Зареждаме...
              </div>
            ) : accessDenied || isGuest ? (
              <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center rounded-3xl border border-line bg-paper p-8 text-center text-sm text-muted">
                <h2 className="font-display text-2xl text-ink">Нямате достъп до този разговор.</h2>
                <p className="mt-2 text-sm text-muted">Разговорите са достъпни само за участниците.</p>
              </div>
            ) : (
              <>
                <ChatThread
                  conversation={safeActiveConversation}
                  messages={safeMessages}
                  userId={userId}
                  orderStatus={conversationStatuses.get(activeConversationId) || null}
                  onBack={handleBackToList}
                  onOfferAction={handleOfferAction}
                  onServiceRequestAction={handleServiceRequestAction}
                  onReplyToMessage={handleReplyToMessage}
                  onToggleReaction={handleToggleReaction}
                  onLoadOlder={loadOlderMessages}
                  hasOlder={pagination.hasOlder}
                  isLoadingOlder={pagination.isLoadingOlder}
                  status={threadStatus}
                  forceScrollToken={scrollToLatestToken}
                  layoutVersion={`${draft.length}:${draftFiles.length}:${replyTarget?.id || ''}:${messageStatus}`}
                />
                {safeActiveConversation && safeActiveConversation.status === 'open' && threadStatus === 'ready' && (
                  <ComposeBar
                    value={draft}
                    onChange={setDraft}
                    onSubmit={submitMessage}
                    canSendOffer={role === 'partner'}
                    onOpenOffer={() => setOfferOpen(true)}
                    replyTarget={replyTarget}
                    onClearReply={() => setReplyTarget(null)}
                    conversation={safeActiveConversation}
                    status={messageStatus}
                    files={draftFiles}
                    onFilesChange={handleDraftFilesChange}
                    onRemoveFile={handleRemoveDraftFile}
                    referenceLibrary={referenceLibrary}
                    onSendReference={handleSendReference}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
      {!accessDenied && !isGuest && <OfferComposer open={offerOpen} onClose={() => setOfferOpen(false)} onSubmit={submitOffer} status={messageStatus} serviceRequest={activeServiceRequest} />}
      {account?.account_status === 'banned' && <div className="shrink-0 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Акаунтът е блокиран. Някои действия може да бъдат ограничени.</div>}
    </InboxShell>
  )
}

function InboxShell({ children }) {
  return (
    <section className="h-full min-h-0 overflow-hidden bg-soft px-0 py-0 sm:px-[var(--pad-x)] sm:py-3">
      <div className="container-page flex h-full min-h-0 min-w-0 max-w-screen-2xl flex-col gap-0 overflow-hidden sm:gap-3">
        {children}
      </div>
    </section>
  )
}

function Panel({ title, children }) {
  return (
    <div className="w-full min-w-0 rounded-3xl border border-line bg-paper p-5 md:p-6">
      <h1 className="break-words font-display text-3xl text-ink">{title}</h1>
      {children}
    </div>
  )
}
