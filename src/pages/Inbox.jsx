import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ConversationList from '../components/chat/ConversationList.jsx'
import ChatThread from '../components/chat/ChatThread.jsx'
import ComposeBar from '../components/chat/ComposeBar.jsx'
import OfferComposer from '../components/chat/OfferComposer.jsx'
import { useAccount } from '../lib/account.js'
import {
  conversationRole,
  loadConversation,
  loadConversations,
  loadMessages,
  markConversationRead,
  sendOffer,
  sendTextMessage,
  subscribeToConversation,
  subscribeToConversationList,
  updateOfferStatus,
} from '../lib/chat.js'
import { startCheckout } from '../lib/payments.js'

export default function Inbox() {
  const { conversationId = '' } = useParams()
  const navigate = useNavigate()
  const { session, account, loading } = useAccount()
  const userId = session?.user?.id || ''
  const [conversations, setConversations] = useState([])
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('loading')
  const [messageStatus, setMessageStatus] = useState('idle')
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [offerOpen, setOfferOpen] = useState(false)

  const activeConversation = useMemo(() => conversations.find((conversation) => conversation.id === conversationId) || null, [conversations, conversationId])
  const role = conversationRole(activeConversation, userId)

  const loadAll = useCallback(async ({ keepStatus = false } = {}) => {
    if (!userId) return
    if (!keepStatus) setStatus('loading')
    setError('')
    try {
      let nextConversations = await loadConversations()
      if (conversationId && !nextConversations.some((conversation) => conversation.id === conversationId)) {
        const directConversation = await loadConversation(conversationId)
        if (directConversation) nextConversations = [directConversation, ...nextConversations]
      }
      setConversations(nextConversations)

      const activeId = conversationId || nextConversations[0]?.id || ''
      if (!conversationId && activeId) navigate(`/inbox/${activeId}`, { replace: true })
      if (activeId) {
        const nextMessages = await loadMessages(activeId)
        setMessages(nextMessages)
        const active = nextConversations.find((conversation) => conversation.id === activeId)
        if (active) await markConversationRead(active, userId)
      } else {
        setMessages([])
      }
      setStatus('ready')
    } catch (loadError) {
      setError(loadError.message || 'Съобщенията не се заредиха.')
      setStatus('error')
    }
  }, [conversationId, navigate, userId])

  useEffect(() => {
    if (loading || !userId) return
    loadAll()
  }, [loading, userId, loadAll])

  useEffect(() => {
    if (!userId) return undefined
    return subscribeToConversationList(userId, () => loadAll({ keepStatus: true }))
  }, [userId, loadAll])

  useEffect(() => {
    if (!conversationId) return undefined
    return subscribeToConversation(conversationId, () => loadAll({ keepStatus: true }))
  }, [conversationId, loadAll])

  async function submitMessage(event) {
    event.preventDefault()
    if (!conversationId || !draft.trim()) return
    setMessageStatus('sending')
    try {
      await sendTextMessage({ conversationId, body: draft })
      setDraft('')
      await loadAll({ keepStatus: true })
      setMessageStatus('idle')
    } catch (sendError) {
      setError(sendError.message || 'Съобщението не се изпрати.')
      setMessageStatus('idle')
    }
  }

  async function submitOffer(offer) {
    if (!conversationId) return
    setMessageStatus('sending')
    try {
      await sendOffer({ conversationId, offer })
      setOfferOpen(false)
      await loadAll({ keepStatus: true })
      setMessageStatus('idle')
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
      await updateOfferStatus({ offerId: offer.id, status: nextStatus })
      await loadAll({ keepStatus: true })
      setMessageStatus('idle')
    } catch (offerError) {
      setError(offerError.message || 'Статусът на офертата не се промени.')
      setMessageStatus('idle')
    }
  }

  if (loading) return <InboxShell><Panel title="Зареждаме…" /></InboxShell>
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
      {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {status === 'loading' ? (
        <Panel title="Зареждаме съобщенията…" />
      ) : status === 'error' ? (
        <Panel title="Съобщенията не се заредиха"><p className="mt-2 text-sm text-red-700">{error}</p><button type="button" onClick={() => loadAll()} className="btn btn-ghost mt-5">Опитай пак</button></Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <ConversationList conversations={conversations} activeId={conversationId} userId={userId} onSelect={(id) => navigate(`/inbox/${id}`)} />
          <div className="min-w-0 space-y-4">
            <ChatThread conversation={activeConversation} messages={messages} userId={userId} onOfferAction={handleOfferAction} />
            {activeConversation && activeConversation.status === 'open' && (
              <ComposeBar value={draft} onChange={setDraft} onSubmit={submitMessage} canSendOffer={role === 'partner'} onOpenOffer={() => setOfferOpen(true)} status={messageStatus} />
            )}
          </div>
        </div>
      )}
      <OfferComposer open={offerOpen} onClose={() => setOfferOpen(false)} onSubmit={submitOffer} status={messageStatus} />
      {account?.account_status === 'banned' && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Акаунтът е блокиран. Някои действия може да бъдат ограничени.</div>}
    </InboxShell>
  )
}

function InboxShell({ children }) {
  return (
    <section className="section bg-soft min-h-[calc(100vh-var(--header-h,0px))]">
      <div className="container-page">
        {children}
      </div>
    </section>
  )
}

function Panel({ title, children }) {
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 md:p-8">
      <h1 className="font-display text-3xl text-ink">{title}</h1>
      {children}
    </div>
  )
}