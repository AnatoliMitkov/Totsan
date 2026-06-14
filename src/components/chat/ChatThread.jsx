import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { LoaderCircle, ShieldCheck } from 'lucide-react'
import MessageBubble from './MessageBubble.jsx'
import Avatar from '../Avatar.jsx'
import { compactSystemText, getConversationTitle, getOtherParticipant, getOtherParticipantRole, getParticipantPublicHref, getRoleLabel } from '../../lib/chat.js'

const ACTIVE_ORDER_STATUSES = new Set(['paid', 'in_progress'])
const BOTTOM_STICK_THRESHOLD = 96
const TOP_LOAD_THRESHOLD = 72

function conversationStateLabel(status = '') {
  if (status === 'open') return 'Отворен'
  if (status === 'closed') return 'Затворен'
  if (status === 'blocked') return 'Ограничен'
  return status || 'Разговор'
}

function compactOrderStatusLine(orderStatus) {
  if (!orderStatus?.status) return ''
  if (ACTIVE_ORDER_STATUSES.has(orderStatus.status)) return 'Офертата е платена · Поръчката е активна'
  if (orderStatus.status === 'delivered') return 'Офертата е платена · Поръчката е предадена'
  if (orderStatus.status === 'completed') return 'Офертата е платена · Поръчката е завършена'
  if (orderStatus.status === 'pending_payment') return 'Офертата чака плащане'
  if (orderStatus.status === 'cancelled') return 'Поръчката е отменена'
  if (orderStatus.status === 'refunded') return 'Поръчката е възстановена'
  if (orderStatus.status === 'disputed') return 'Поръчката е в спор'
  return ''
}

function startOfDay(value) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function isSameDay(left, right) {
  return startOfDay(left) === startOfDay(right)
}

function canGroupMessages(left, right) {
  if (!left || !right) return false
  if (left.kind === 'system' || right.kind === 'system') return false
  return left.sender_id === right.sender_id && isSameDay(left.created_at, right.created_at)
}

function formatDateSeparator(value) {
  const target = new Date(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const targetDay = startOfDay(target)

  if (targetDay === today.getTime()) return 'Today'
  if (targetDay === yesterday.getTime()) return 'Yesterday'
  return new Intl.DateTimeFormat('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' }).format(target)
}

export default function ChatThread({
  conversation,
  messages,
  userId,
  orderStatus,
  onOfferAction,
  onReplyToMessage,
  onToggleReaction,
  onLoadOlder,
  hasOlder = false,
  isLoadingOlder = false,
  status = 'ready',
}) {
  const threadBodyRef = useRef(null)
  const stickToBottomRef = useRef(true)
  const topLoadTriggeredRef = useRef(false)
  const previousConversationIdRef = useRef('')
  const previousMessageCountRef = useRef(0)
  const prependAnchorRef = useRef(null)

  const visibleMessages = useMemo(() => {
    const seenSystemKeys = new Set()
    return messages.filter((message) => {
      if (message.kind !== 'system') return true
      const systemKey = `${message.offer_id || ''}|${message.sender_id || ''}|${message.body || ''}`
      if (seenSystemKeys.has(systemKey)) return false
      seenSystemKeys.add(systemKey)
      return true
    })
  }, [messages])

  const threadItems = useMemo(() => {
    const items = []

    visibleMessages.forEach((message, index) => {
      const previousMessage = visibleMessages[index - 1]
      const nextMessage = visibleMessages[index + 1]

      if (!previousMessage || !isSameDay(previousMessage.created_at, message.created_at)) {
        items.push({
          type: 'date',
          id: `date-${startOfDay(message.created_at)}`,
          label: formatDateSeparator(message.created_at),
        })
      }

      const groupedWithPrevious = canGroupMessages(previousMessage, message)
      const groupedWithNext = canGroupMessages(message, nextMessage)
      const own = message.sender_id === userId
      let groupPosition = 'single'
      if (!message.kind || message.kind !== 'system') {
        if (!groupedWithPrevious && groupedWithNext) groupPosition = 'start'
        if (groupedWithPrevious && groupedWithNext) groupPosition = 'middle'
        if (groupedWithPrevious && !groupedWithNext) groupPosition = 'end'
      }

      items.push({
        type: 'message',
        id: message.id,
        message,
        own,
        groupPosition,
        groupedWithPrevious,
        groupedWithNext,
        showAvatar: !own && !groupedWithNext && message.kind !== 'system',
        showTimestamp: !groupedWithNext,
      })
    })

    return items
  }, [userId, visibleMessages])

  useEffect(() => {
    const container = threadBodyRef.current
    if (!container) return

    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
      stickToBottomRef.current = distanceFromBottom <= BOTTOM_STICK_THRESHOLD

      const nearTop = container.scrollTop <= TOP_LOAD_THRESHOLD
      if (!nearTop) {
        topLoadTriggeredRef.current = false
        return
      }

      if (!hasOlder || isLoadingOlder || status !== 'ready' || topLoadTriggeredRef.current) return
      topLoadTriggeredRef.current = true
      prependAnchorRef.current = {
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
        firstMessageId: visibleMessages[0]?.id || '',
      }
      Promise.resolve(onLoadOlder?.()).catch(() => {
        prependAnchorRef.current = null
      })
    }

    handleScroll()
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [conversation?.id, hasOlder, isLoadingOlder, onLoadOlder, status, visibleMessages])

  useLayoutEffect(() => {
    const container = threadBodyRef.current
    const anchor = prependAnchorRef.current
    if (!container || !anchor || isLoadingOlder) return

    const currentFirstId = visibleMessages[0]?.id || ''
    if (currentFirstId && currentFirstId !== anchor.firstMessageId) {
      container.scrollTop = container.scrollHeight - anchor.scrollHeight + anchor.scrollTop
    }

    prependAnchorRef.current = null
  }, [isLoadingOlder, visibleMessages])

  useLayoutEffect(() => {
    const container = threadBodyRef.current
    if (!container || status !== 'ready') return

    const conversationChanged = previousConversationIdRef.current !== (conversation?.id || '')
    const messageCountIncreased = visibleMessages.length > previousMessageCountRef.current
    if (!conversationChanged && (!messageCountIncreased || !stickToBottomRef.current)) {
      previousMessageCountRef.current = visibleMessages.length
      previousConversationIdRef.current = conversation?.id || ''
      return
    }

    const behavior = conversationChanged ? 'auto' : 'smooth'
    const scrollToBottom = () => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      })
    }

    let followupFrame = 0
    const frame = window.requestAnimationFrame(() => {
      scrollToBottom()
      followupFrame = window.requestAnimationFrame(scrollToBottom)
    })

    stickToBottomRef.current = true
    previousMessageCountRef.current = visibleMessages.length
    previousConversationIdRef.current = conversation?.id || ''
    return () => {
      window.cancelAnimationFrame(frame)
      if (followupFrame) window.cancelAnimationFrame(followupFrame)
    }
  }, [conversation?.id, status, visibleMessages])

  if (!conversation) {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 items-center justify-center rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">
        Избери разговор, за да видиш съобщенията.
      </div>
    )
  }

  const otherParticipant = getOtherParticipant(conversation, userId)
  const avatarUrl = otherParticipant?.avatar_url || ''
  const avatarCandidates = otherParticipant?.avatar_candidates || []
  const displayName = getConversationTitle(conversation, userId)
  const roleLabel = getRoleLabel(getOtherParticipantRole(conversation, userId))
  const statusLine = compactOrderStatusLine(orderStatus)
  const participantHref = getParticipantPublicHref(conversation, userId)
  const IdentityTag = participantHref ? Link : 'div'

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-line bg-paper shadow-[0_18px_50px_-42px_rgba(15,23,42,0.28)]">
      <div className="shrink-0 border-b border-line px-4 py-3 md:px-5">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,48%)] lg:items-start">
          <IdentityTag
            {...(participantHref ? { to: participantHref } : {})}
            className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1.5 -m-1.5 transition ${participantHref ? 'hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentDeep/25' : ''}`}
          >
            <Avatar src={avatarUrl} srcCandidates={avatarCandidates} name={displayName} size={48} />
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-xl leading-tight text-ink md:text-2xl">{displayName}</h1>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted">
                <span className="shrink-0 rounded-full border border-line bg-soft px-2.5 py-1">{roleLabel}</span>
                <span className="shrink-0 rounded-full border border-line bg-soft px-2.5 py-1">{conversationStateLabel(conversation.status)}</span>
              </div>
              {statusLine && <div className="mt-2 break-words text-sm text-muted">{statusLine}</div>}
            </div>
          </IdentityTag>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-w-0 items-start gap-2 rounded-2xl border border-line bg-soft/90 px-3 py-2 text-sm text-muted backdrop-blur-sm">
              <ShieldCheck size={17} className="mt-0.5 shrink-0 text-accentDeep" />
              <p className="min-w-0 break-words whitespace-normal">Сигурност: разговорите и плащанията в Totsan са защитени. Не споделяй външни контакти.</p>
            </div>
          </div>
        </div>
      </div>

      <div ref={threadBodyRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 md:px-4 md:py-5">
        <div className="mx-auto flex w-full max-w-5xl flex-col">
          {status === 'loading' && (
            <div className="space-y-4" aria-live="polite" aria-busy="true">
              <ThreadLoadingBubble align="start" widthClass="max-w-[14rem]" />
              <ThreadLoadingBubble align="end" widthClass="max-w-[18rem]" />
              <ThreadLoadingBubble align="start" widthClass="max-w-[16rem]" />
            </div>
          )}
          {status === 'error' && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Разговорът не се зареди. Опитай да избереш разговора отново.
            </div>
          )}
          {status === 'ready' && isLoadingOlder && (
            <div className="mx-auto mb-4 flex items-center gap-2 rounded-full border border-line bg-soft/90 px-3 py-1.5 text-xs text-muted backdrop-blur-sm">
              <LoaderCircle size={14} className="animate-spin" />
              <span>Зареждаме по-стари съобщения...</span>
            </div>
          )}
          {status === 'ready' && threadItems.map((item) => (
            item.type === 'date' ? (
              <DateSeparator key={item.id} label={item.label} />
            ) : (
              <MessageBubble
                key={item.id}
                message={{ ...item.message, body: item.message.kind === 'system' ? compactSystemText(item.message.body) : item.message.body }}
                userId={userId}
                conversation={conversation}
                onOfferAction={onOfferAction}
                onReplyToMessage={onReplyToMessage}
                onToggleReaction={onToggleReaction}
                showAvatar={item.showAvatar}
                showTimestamp={item.showTimestamp}
                groupPosition={item.groupPosition}
                groupedWithPrevious={item.groupedWithPrevious}
                groupedWithNext={item.groupedWithNext}
              />
            )
          ))}
          {status === 'ready' && !threadItems.length && (
            <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
              Започни разговора с кратко съобщение.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ThreadLoadingBubble({ align = 'start', widthClass = 'max-w-[16rem]' }) {
  return (
    <div className={`flex w-full ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
      <div className={`w-full ${widthClass} overflow-hidden rounded-3xl border border-line bg-soft px-4 py-3`}>
        <div className="h-4 w-24 animate-pulse rounded-full bg-line/70" />
        <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-line/55" />
        <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-line/55" />
      </div>
    </div>
  )
}

function DateSeparator({ label }) {
  return (
    <div className="my-4 flex items-center gap-3 text-xs text-muted">
      <div className="h-px flex-1 bg-line/80" />
      <span className="rounded-full border border-line bg-paper/95 px-3 py-1 uppercase tracking-[0.12em] shadow-sm">{label}</span>
      <div className="h-px flex-1 bg-line/80" />
    </div>
  )
}
