import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Download, ImageOff, LoaderCircle, MessageCircle, ShieldCheck, X } from 'lucide-react'
import MessageBubble from './MessageBubble.jsx'
import Avatar from '../Avatar.jsx'
import { compactSystemText, getConversationTitle, getOtherParticipant, getOtherParticipantRole, getParticipantPublicHref, getRoleLabel } from '../../lib/chat.js'
import { createChatAttachmentSignedUrl, isDeletedAttachment, isImageAttachment } from '../../lib/chat-attachments.js'

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

  if (targetDay === today.getTime()) return 'Днес'
  if (targetDay === yesterday.getTime()) return 'Вчера'
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
  onBack,
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
  const [activeMediaIndex, setActiveMediaIndex] = useState(null)

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

  const mediaItems = useMemo(() => {
    const items = []
    visibleMessages.forEach((message) => {
      const attachments = Array.isArray(message.attachments) ? message.attachments : []
      attachments.forEach((attachment, index) => {
        if (!isImageAttachment(attachment) || isDeletedAttachment(attachment)) return
        items.push({
          id: `${message.id}-${index}`,
          messageId: message.id,
          createdAt: message.created_at,
          senderId: message.sender_id,
          attachment,
        })
      })
    })
    return items
  }, [visibleMessages])

  useEffect(() => {
    if (activeMediaIndex === null) return
    if (activeMediaIndex >= 0 && activeMediaIndex < mediaItems.length) return
    setActiveMediaIndex(null)
  }, [activeMediaIndex, mediaItems.length])

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
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-line bg-soft text-accentDeep">
          <MessageCircle size={24} />
        </div>
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
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-paper shadow-[0_18px_50px_-42px_rgba(15,23,42,0.28)] sm:rounded-3xl sm:border sm:border-line">
      <div className="z-10 shrink-0 border-b border-line bg-paper/96 px-3 py-2.5 backdrop-blur-sm md:px-5 md:py-3">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,48%)] lg:items-start">
          <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
            <button
              type="button"
              onClick={onBack}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentDeep/25 lg:hidden"
              aria-label="Back to conversations"
            >
              <ArrowLeft size={20} />
            </button>
          <IdentityTag
            {...(participantHref ? { to: participantHref } : {})}
            className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl p-1 -m-1 transition md:gap-3 md:p-1.5 md:-m-1.5 ${participantHref ? 'hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentDeep/25' : ''}`}
          >
            <Avatar src={avatarUrl} srcCandidates={avatarCandidates} name={displayName} size={44} />
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-lg leading-tight text-ink md:text-2xl">{displayName}</h1>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted md:gap-2">
                <span className="shrink-0 rounded-full border border-line bg-soft px-2.5 py-1">{roleLabel}</span>
                <span className="shrink-0 rounded-full border border-line bg-soft px-2.5 py-1">{conversationStateLabel(conversation.status)}</span>
              </div>
              {statusLine && <div className="mt-1.5 hidden break-words text-sm text-muted sm:block">{statusLine}</div>}
            </div>
          </IdentityTag>
          </div>
          <div className="hidden min-w-0 flex-col gap-2 md:flex">
            <div className="flex min-w-0 items-start gap-2 rounded-2xl border border-line bg-soft/90 px-3 py-2 text-sm text-muted backdrop-blur-sm">
              <ShieldCheck size={17} className="mt-0.5 shrink-0 text-accentDeep" />
              <p className="min-w-0 break-words whitespace-normal">Сигурност: разговорите и плащанията в Totsan са защитени. Не споделяй външни контакти.</p>
            </div>
          </div>
        </div>
      </div>

      <div ref={threadBodyRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-soft/35 px-3 py-4 md:px-4 md:py-5">
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
                mediaItems={mediaItems}
                onOpenMedia={setActiveMediaIndex}
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
      <ChatMediaViewer
        items={mediaItems}
        activeIndex={activeMediaIndex}
        onClose={() => setActiveMediaIndex(null)}
        onNavigate={setActiveMediaIndex}
      />
    </div>
  )
}

function ChatMediaViewer({ items, activeIndex, onClose, onNavigate }) {
  const item = activeIndex === null ? null : items[activeIndex]
  const attachment = item?.attachment || null
  const [signedUrl, setSignedUrl] = useState('')
  const [urlStatus, setUrlStatus] = useState('idle')
  const touchStartRef = useRef(null)

  useEffect(() => {
    if (!attachment) return undefined
    let active = true
    setSignedUrl('')
    setUrlStatus('loading')
    createChatAttachmentSignedUrl(attachment).then((url) => {
      if (!active) return
      setSignedUrl(url)
      setUrlStatus(url ? 'ready' : 'missing')
    })
    return () => {
      active = false
    }
  }, [attachment])

  useEffect(() => {
    if (!attachment) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key === 'ArrowLeft' && activeIndex > 0) {
        onNavigate(activeIndex - 1)
        return
      }
      if (event.key === 'ArrowRight' && activeIndex < items.length - 1) {
        onNavigate(activeIndex + 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeIndex, attachment, items.length, onClose, onNavigate])

  if (!attachment) return null

  const name = String(attachment.name || 'Снимка')
  const canGoPrevious = activeIndex > 0
  const canGoNext = activeIndex < items.length - 1
  const createdAt = item?.createdAt
    ? new Date(item.createdAt).toLocaleString('bg-BG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''

  function navigatePrevious() {
    if (canGoPrevious) onNavigate(activeIndex - 1)
  }

  function navigateNext() {
    if (canGoNext) onNavigate(activeIndex + 1)
  }

  function handleTouchStart(event) {
    touchStartRef.current = event.changedTouches?.[0]?.clientX ?? null
  }

  function handleTouchEnd(event) {
    const startX = touchStartRef.current
    touchStartRef.current = null
    if (startX === null) return
    const endX = event.changedTouches?.[0]?.clientX ?? startX
    const delta = endX - startX
    if (Math.abs(delta) < 48) return
    if (delta > 0) navigatePrevious()
    if (delta < 0) navigateNext()
  }

  return (
    <div className="fixed inset-0 z-[90] flex min-h-0 flex-col bg-ink/96 text-paper" role="dialog" aria-modal="true" aria-label="Преглед на снимка">
      <div className="flex shrink-0 items-center gap-2 border-b border-paper/10 bg-ink/88 px-3 py-2.5 backdrop-blur md:px-5">
        <button
          type="button"
          onClick={onClose}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-paper/85 transition hover:bg-paper/10 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper/30"
          aria-label="Затвори снимката"
        >
          <X size={21} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold md:text-base">{name}</div>
          <div className="mt-0.5 text-xs text-paper/65">
            {activeIndex + 1} / {items.length}{createdAt ? ` · ${createdAt}` : ''}
          </div>
        </div>
        {signedUrl && (
          <a
            href={signedUrl}
            download={name}
            target="_blank"
            rel="noreferrer"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-paper/85 transition hover:bg-paper/10 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper/30"
            aria-label="Изтегли снимката"
          >
            <Download size={20} />
          </a>
        )}
      </div>

      <div
        className="relative min-h-0 flex-1 touch-pan-y select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          onClick={navigatePrevious}
          disabled={!canGoPrevious}
          className="absolute left-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-ink/55 text-paper transition hover:bg-ink/80 disabled:pointer-events-none disabled:opacity-0 md:left-5 md:h-12 md:w-12"
          aria-label="Предишна снимка"
        >
          <ChevronLeft size={26} />
        </button>

        <div className="grid h-full w-full place-items-center px-3 py-4 md:px-20 md:py-8">
          {urlStatus === 'ready' && signedUrl ? (
            <img src={signedUrl} alt={name} className="max-h-full max-w-full object-contain" />
          ) : urlStatus === 'missing' ? (
            <div className="mx-auto grid max-w-sm place-items-center gap-3 rounded-3xl border border-paper/10 bg-paper/8 px-6 py-8 text-center text-paper/78">
              <ImageOff size={30} />
              <div>
                <div className="font-semibold text-paper">Снимката вече не е налична</div>
                <div className="mt-1 text-sm text-paper/65">Файлът е премахнат от сървъра според политиката за пазене.</div>
              </div>
            </div>
          ) : (
            <div className="rounded-full border border-paper/10 bg-paper/8 px-4 py-2 text-sm text-paper/75">Зареждаме снимката...</div>
          )}
        </div>

        <button
          type="button"
          onClick={navigateNext}
          disabled={!canGoNext}
          className="absolute right-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-ink/55 text-paper transition hover:bg-ink/80 disabled:pointer-events-none disabled:opacity-0 md:right-5 md:h-12 md:w-12"
          aria-label="Следваща снимка"
        >
          <ChevronRight size={26} />
        </button>
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
