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
  sendTextMessage,
  subscribeToConversation,
  subscribeToConversationList,
  toggleMessageReaction,
  updateOfferStatus,
} from '../lib/chat.js'
import { startCheckout } from '../lib/payments.js'

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
  const [draft, setDraft] = useState('')
  const [replyTarget, setReplyTarget] = useState(null)
  const [offerOpen, setOfferOpen] = useState(false)
  const initialLoadRef = useRef(false)
  const threadTokenRef = useRef(0)
  const metaRefreshTimerRef = useRef(null)
  const threadCacheRef = useRef(new Map())
  const conversationsRef = useRef([])

  useEffect(() => {
    conversationsRef.current = conversations
  }, [conversations])

  const activeConversationId = selectedConversationId || conversations[0]?.id || ''
  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || null,
    [conversations, activeConversationId],
  )
  const role = conversationRole(activeConversation, userId)

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

  const loadConversationCollection = useCallback(async () => {
    let nextConversations = await loadConversations()
    if (selectedConversationId && !nextConversations.some((conversation) => conversation.id === selectedConversationId)) {
      const directConversation = await loadConversation(selectedConversationId)
      if (directConversation) nextConversations = [directConversation, ...nextConversations]
    }

    const nextStatuses = await loadConversationStatuses(nextConversations.map((conversation) => conversation.id))
    setConversations(nextConversations)
    setConversationStatuses(nextStatuses)
    return nextConversations
  }, [selectedConversationId])

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

  const loadAll = useCallback(async ({ keepStatus = false } = {}) => {
    if (!userId) return
    if (!keepStatus) setStatus('loading')
    setError('')

    try {
      const nextConversations = await loadConversationCollection()
      const nextSelectedId = selectedConversationId || nextConversations[0]?.id || ''
      setStatus('ready')
      if (nextSelectedId && nextSelectedId !== selectedConversationId) {
        setSelectedConversationId(nextSelectedId)
      }
      await loadThread(nextSelectedId)
    } catch (loadError) {
      setError(loadError.message || 'Съобщенията не се заредиха.')
      setStatus('error')
      setThreadStatus('error')
    }
  }, [loadConversationCollection, loadThread, selectedConversationId, userId])

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
    loadAll({ keepStatus: initialLoadRef.current })
    initialLoadRef.current = true
  }, [loading, userId, loadAll])

  useEffect(() => {
    if (!conversations.length) return
    if (selectedConversationId && conversations.some((conversation) => conversation.id === selectedConversationId)) return

    const fallbackId = conversations[0]?.id || ''
    if (!fallbackId) return
    setSelectedConversationId(fallbackId)
    window.history.replaceState(window.history.state, '', buildInboxPath(fallbackId))
  }, [conversations, selectedConversationId])

  useEffect(() => {
    if (!initialLoadRef.current) return
    loadThread(activeConversationId, { showLoading: !threadCacheRef.current.get(`${userId}:${activeConversationId}`)?.messages?.length })
  }, [activeConversationId, loadThread, userId])

  useEffect(() => {
    setReplyTarget(null)
  }, [activeConversationId])

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
    if (!activeConversationId) return undefined

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
  }, [activeConversationId, loadFreshMessage, mergeIncomingMessages, patchOfferMessage, refreshMessageReactions, scheduleConversationRefresh])

  useEffect(() => {
    return () => {
      if (metaRefreshTimerRef.current) {
        window.clearTimeout(metaRefreshTimerRef.current)
      }
    }
  }, [])

  async function submitMessage(event) {
    event.preventDefault()
    if (!activeConversationId || !draft.trim()) return
    setMessageStatus('sending')

    try {
      const result = await sendTextMessage({
        conversationId: activeConversationId,
        body: draft,
        replyToMessageId: replyTarget?.id || '',
      })
      if (result?.message?.id) {
        const nextMessage = await loadFreshMessage(result.message.id, result.message)
        if (nextMessage) mergeIncomingMessages(activeConversationId, [nextMessage])
      }
      setDraft('')
      setReplyTarget(null)
      setMessageStatus('idle')
      scheduleConversationRefresh()
    } catch (sendError) {
      setError(sendError.message || 'Съобщението не се изпрати.')
      setMessageStatus('idle')
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
      setOfferOpen(false)
      setMessageStatus('idle')
      scheduleConversationRefresh()
    } catch (offerError) {
      setError(offerError.message || 'Офертата не се изпрати.')
      setMessageStatus('idle')
    }
  }

  async function handleOfferAction(offer, nextStatus) {
    setMessageStatus('sending')

    try {
      if (nextStatus === 'accepted') {
        const result = await startCheckout({ type: 'offer', id: offer.id, provider: 'stripe' })
        const checkoutUrl = result.checkoutUrl || ''
        if (checkoutUrl) {
          const url = new URL(checkoutUrl, window.location.origin)
          if (url.origin === window.location.origin) {
            navigate(`${url.pathname}${url.search}`)
            return
          }
          window.location.href = checkoutUrl
          return
        }
        if (result.order?.id) {
          navigate(`/order/${result.order.id}`)
          return
        }
      }

      const result = await updateOfferStatus({ offerId: offer.id, status: nextStatus })
      if (result?.offer) patchOfferMessage(activeConversationId, result.offer)
      if (result?.message?.id) {
        const nextMessage = await loadFreshMessage(result.message.id, { ...result.message, offer: null })
        if (nextMessage) mergeIncomingMessages(activeConversationId, [nextMessage])
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
        const nextId = nextConversations[0]?.id || ''
        setSelectedConversationId(nextId)
        window.history.replaceState(window.history.state, '', buildInboxPath(nextId))
      }
    } catch (err) {
      setError(err.message || 'Грешка при архивиране на разговора.')
    }
  }, [userId, selectedConversationId])


  if (loading) return <InboxShell><Panel title="Зареждаме..." /></InboxShell>

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
        <div className="grid min-h-0 min-w-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[minmax(18rem,20rem)_minmax(0,1.35fr)] lg:gap-3 xl:grid-cols-[minmax(19rem,21rem)_minmax(0,1.5fr)]">
          <ConversationList
            conversations={conversations}
            activeId={activeConversationId}
            userId={userId}
            statusByConversation={conversationStatuses}
            onSelect={(id) => {
              if (!id || id === activeConversationId) return
              setSelectedConversationId(id)
              window.history.pushState(window.history.state, '', buildInboxPath(id))
            }}
            onArchive={handleArchiveConversation}
          />
          <div className="flex min-h-0 min-w-0 flex-col gap-2.5 overflow-hidden lg:gap-3">
            <ChatThread
              conversation={activeConversation}
              messages={messages}
              userId={userId}
              orderStatus={conversationStatuses.get(activeConversationId) || null}
              onOfferAction={handleOfferAction}
              onReplyToMessage={handleReplyToMessage}
              onToggleReaction={handleToggleReaction}
              onLoadOlder={loadOlderMessages}
              hasOlder={pagination.hasOlder}
              isLoadingOlder={pagination.isLoadingOlder}
              status={threadStatus}
            />
            {activeConversation && activeConversation.status === 'open' && threadStatus === 'ready' && (
              <ComposeBar
                value={draft}
                onChange={setDraft}
                onSubmit={submitMessage}
                canSendOffer={role === 'partner'}
                onOpenOffer={() => setOfferOpen(true)}
                replyTarget={replyTarget}
                onClearReply={() => setReplyTarget(null)}
                conversation={activeConversation}
                status={messageStatus}
              />
            )}
          </div>
        </div>
      )}
      <OfferComposer open={offerOpen} onClose={() => setOfferOpen(false)} onSubmit={submitOffer} status={messageStatus} />
      {account?.account_status === 'banned' && <div className="shrink-0 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Акаунтът е блокиран. Някои действия може да бъдат ограничени.</div>}
    </InboxShell>
  )
}

function InboxShell({ children }) {
  return (
    <section className="h-full min-h-0 overflow-hidden bg-soft px-[var(--pad-x)] py-2 sm:py-3">
      <div className="container-page flex h-full min-h-0 min-w-0 max-w-screen-2xl flex-col gap-3 overflow-hidden">
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
