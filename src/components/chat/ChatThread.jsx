import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowLeft, Ban, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleUserRound, Download, Flag, ImageOff, Link2, LoaderCircle, MessageCircle, MoreVertical, Search, ShieldCheck, Trash2, X } from 'lucide-react'
import MessageBubble from './MessageBubble.jsx'
import Avatar from '../Avatar.jsx'
import ShieldHandsIcon from './ShieldHandsIcon.jsx'
import { compactSystemText, getConversationTitle, getOtherParticipant, getParticipantPublicHref } from '../../lib/chat.js'
import { createChatAttachmentSignedUrl, isDeletedAttachment, isImageAttachment } from '../../lib/chat-attachments.js'

const BOTTOM_STICK_THRESHOLD = 96
const JUMP_TO_LATEST_THRESHOLD = 220
const TOP_LOAD_THRESHOLD = 72

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
  onOfferAction,
  onServiceRequestAction,
  onReplyToMessage,
  onScrollNotFound,
  onNavigateToMessage,
  onToggleReaction,
  onForwardMessage,
  onSaveMessageFlags,
  onOpenContact,
  onCloseConversation,
  onBlockConversation,
  onDeleteConversation,
  onSendCallInvite,
  onScheduleCall,
  onReportConversation,
  onBack,
  onLoadOlder,
  hasOlder = false,
  isLoadingOlder = false,
  status = 'ready',
  forceScrollToken = 0,
  layoutVersion = '',
}) {
  const threadBodyRef = useRef(null)
  const stickToBottomRef = useRef(true)
  const topLoadTriggeredRef = useRef(false)
  const previousConversationIdRef = useRef('')
  const previousMessageCountRef = useRef(0)
  const prependAnchorRef = useRef(null)
  const scrollAnimationRef = useRef(0)
  const [activeMediaIndex, setActiveMediaIndex] = useState(null)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const [highlightedMessageId, setHighlightedMessageId] = useState(null)
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false)
  const [securityTipOpen, setSecurityTipOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const conversationActionsRef = useRef(null)
  const securityPointerFocusRef = useRef(false)
  const securityClickOpenRef = useRef(false)

  function closeSecurityTip() {
    securityClickOpenRef.current = false
    securityPointerFocusRef.current = false
    setSecurityTipOpen(false)
  }

  function animateThreadScrollTo(targetTop, { duration = 320 } = {}) {
    const container = threadBodyRef.current
    if (!container) return

    window.cancelAnimationFrame(scrollAnimationRef.current)
    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight)
    const startTop = container.scrollTop
    const nextTop = Math.max(0, Math.min(maxTop, targetTop))
    const distance = nextTop - startTop

    if (Math.abs(distance) < 2) {
      container.scrollTop = nextTop
      return
    }

    const startedAt = performance.now()
    const easeInOutCubic = (value) => (
      value < 0.5
        ? 4 * value * value * value
        : 1 - Math.pow(-2 * value + 2, 3) / 2
    )

    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      container.scrollTop = startTop + distance * easeInOutCubic(progress)
      if (progress < 1) {
        scrollAnimationRef.current = window.requestAnimationFrame(step)
      }
    }

    scrollAnimationRef.current = window.requestAnimationFrame(step)
  }

  function scrollToBottom(behavior = 'smooth') {
    const container = threadBodyRef.current
    if (!container) return
    window.cancelAnimationFrame(scrollAnimationRef.current)
    const targetTop = container.scrollHeight
    if (behavior === 'auto') {
      container.scrollTop = targetTop
    } else {
      animateThreadScrollTo(targetTop)
    }
    stickToBottomRef.current = true
    setShowJumpToLatest(false)
  }

  function scheduleScrollToBottom(behavior = 'smooth') {
    let followupFrame = 0
    const frame = window.requestAnimationFrame(() => {
      scrollToBottom(behavior)
      followupFrame = window.requestAnimationFrame(() => scrollToBottom(behavior))
    })
    return () => {
      window.cancelAnimationFrame(frame)
      if (followupFrame) window.cancelAnimationFrame(followupFrame)
    }
  }

  function scrollElementIntoThreadView(element) {
    const container = threadBodyRef.current
    if (!container || !(element instanceof Element)) return false

    const containerRect = container.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    const overflowBottom = elementRect.bottom - containerRect.bottom + 20
    const overflowTop = containerRect.top - elementRect.top + 20

    if (overflowBottom > 0) {
      animateThreadScrollTo(container.scrollTop + overflowBottom, { duration: 280 })
      return true
    }

    if (overflowTop > 0) {
      animateThreadScrollTo(container.scrollTop - overflowTop, { duration: 280 })
      return true
    }

    return false
  }

  function revealInlineControls(targetElement) {
    const container = threadBodyRef.current
    if (!container) return
    if (scrollElementIntoThreadView(targetElement)) return
    if (stickToBottomRef.current) scheduleScrollToBottom('smooth')
  }

  function scrollToMessageById(messageId) {
    if (!messageId) return
    const item = threadItems.find((t) => t.type === 'message' && t.id === messageId)
    if (item) {
      setHighlightedMessageId(messageId)
      setTimeout(() => {
        const el = document.querySelector(`[data-message-id="${messageId}"]`)
        scrollElementIntoThreadView(el)
        setTimeout(() => setHighlightedMessageId(null), 2000)
      }, 0)
      return
    }
    if (hasOlder && !isLoadingOlder && status === 'ready') {
      onLoadOlder?.().then(() => scrollToMessageById(messageId))
    } else {
      onScrollNotFound?.(messageId, false)
    }
  }

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

  const filteredThreadItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('bg-BG')
    if (!query) return threadItems

    return threadItems.filter((item) => {
      if (item.type === 'date') return false
      const message = item.message || {}
      const attachmentText = Array.isArray(message.attachments)
        ? message.attachments.map((attachment) => `${attachment?.name || ''} ${attachment?.type || ''}`).join(' ')
        : ''
      return `${message.body || ''} ${attachmentText}`.toLocaleLowerCase('bg-BG').includes(query)
    })
  }, [searchQuery, threadItems])

  const searchResultCount = useMemo(() => (
    filteredThreadItems.filter((item) => item.type === 'message').length
  ), [filteredThreadItems])

  useEffect(() => {
    function closeConversationActions(event) {
      if (!conversationActionsRef.current?.contains(event.target)) {
        setConversationMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeConversationActions)
    return () => document.removeEventListener('pointerdown', closeConversationActions)
  }, [])

  useEffect(() => {
    setConversationMenuOpen(false)
    setSearchOpen(false)
    setSearchQuery('')
  }, [conversation?.id])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches)
    updateViewport()
    mediaQuery.addEventListener?.('change', updateViewport)
    return () => mediaQuery.removeEventListener?.('change', updateViewport)
  }, [])

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
      setShowJumpToLatest(distanceFromBottom > JUMP_TO_LATEST_THRESHOLD)

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

  useEffect(() => {
    if (status !== 'ready' || !forceScrollToken) return undefined
    return scheduleScrollToBottom('smooth')
  }, [forceScrollToken, status])

  useEffect(() => {
    if (status !== 'ready' || !stickToBottomRef.current) return undefined
    return scheduleScrollToBottom('smooth')
  }, [layoutVersion, status])

  useEffect(() => {
    if (status !== 'ready') return undefined

    const handleResize = () => {
      if (stickToBottomRef.current) scheduleScrollToBottom('auto')
    }

    window.addEventListener('resize', handleResize)
    window.visualViewport?.addEventListener('resize', handleResize)
    window.visualViewport?.addEventListener('scroll', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.visualViewport?.removeEventListener('resize', handleResize)
      window.visualViewport?.removeEventListener('scroll', handleResize)
    }
  }, [status])

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
    stickToBottomRef.current = true
    previousMessageCountRef.current = visibleMessages.length
    previousConversationIdRef.current = conversation?.id || ''
    return scheduleScrollToBottom(behavior)
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
  const participantHref = getParticipantPublicHref(conversation, userId)
  const IdentityTag = participantHref ? Link : 'div'

  return (
    <div className="chat-thread-shell relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-paper sm:rounded-3xl sm:border">
      <div className="chat-thread-header z-10 shrink-0 border-b px-3 py-2.5 backdrop-blur-sm md:px-5 md:py-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 md:gap-3">
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
            className={`flex min-w-0 max-w-[min(28rem,100%)] flex-none items-center gap-2.5 rounded-2xl p-1 -m-1 transition md:gap-3 md:p-1.5 md:-m-1.5 ${participantHref ? 'hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentDeep/25' : ''}`}
          >
            <Avatar src={avatarUrl} srcCandidates={avatarCandidates} name={displayName} size={44} />
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-lg leading-tight text-ink md:text-2xl">{displayName}</h1>
            </div>
          </IdentityTag>
          </div>
          <div ref={conversationActionsRef} className="relative flex shrink-0 items-center gap-1.5">
            <div className="relative">
              <button
                type="button"
                className="chat-thread-security-button"
                aria-label="Информация за сигурност"
                aria-expanded={securityTipOpen}
                onMouseEnter={() => {
                  if (!securityClickOpenRef.current) setSecurityTipOpen(true)
                }}
                onMouseLeave={() => {
                  if (!securityClickOpenRef.current) setSecurityTipOpen(false)
                }}
                onPointerDown={() => {
                  securityPointerFocusRef.current = true
                }}
                onFocus={() => {
                  if (!securityPointerFocusRef.current) setSecurityTipOpen(true)
                }}
                onBlur={() => {
                  if (!securityClickOpenRef.current) closeSecurityTip()
                }}
                onClick={() => {
                  if (securityClickOpenRef.current) {
                    closeSecurityTip()
                    return
                  }
                  securityClickOpenRef.current = true
                  securityPointerFocusRef.current = false
                  setSecurityTipOpen(true)
                }}
              >
                <ShieldHandsIcon />
              </button>
              {securityTipOpen && (
                isMobileViewport && typeof document !== 'undefined'
                  ? createPortal(
                    <SecurityTipOverlay onClose={closeSecurityTip} />,
                    document.body,
                  )
                  : <SecurityTipOverlay />
              )}
            </div>
            <button
              type="button"
              className="chat-thread-more-button"
              aria-label="Действия за разговора"
              aria-expanded={conversationMenuOpen}
              onClick={() => setConversationMenuOpen((value) => !value)}
            >
              <MoreVertical size={22} aria-hidden="true" />
            </button>
            {conversationMenuOpen && (
              <div className="chat-conversation-actions-menu" role="menu" aria-label="Действия за разговора">
                <ChatConversationAction icon={CircleUserRound} label="Информация за контакта" onClick={() => { setConversationMenuOpen(false); onOpenContact?.() }} />
                <ChatConversationAction icon={Search} label="Търси в разговора" onClick={() => { setConversationMenuOpen(false); setSearchOpen(true) }} />
                <div className="chat-conversation-actions-divider" />
                <ChatConversationAction icon={X} label="Затвори чата" onClick={() => { setConversationMenuOpen(false); onCloseConversation?.() }} />
                <ChatConversationAction icon={Link2} label="Изпрати покана за разговор" onClick={() => { setConversationMenuOpen(false); onSendCallInvite?.() }} />
                <ChatConversationAction icon={CalendarDays} label="Насрочи разговор" onClick={() => { setConversationMenuOpen(false); onScheduleCall?.() }} />
                <div className="chat-conversation-actions-divider" />
                <ChatConversationAction icon={Flag} label="Докладвай" onClick={() => { setConversationMenuOpen(false); onReportConversation?.() }} />
                <ChatConversationAction icon={Ban} label="Блокирай" destructive onClick={() => { setConversationMenuOpen(false); onBlockConversation?.() }} />
                <ChatConversationAction icon={Trash2} label="Изтрий чата" destructive onClick={() => { setConversationMenuOpen(false); onDeleteConversation?.() }} />
              </div>
            )}
          </div>
        </div>
        {searchOpen && (
          <div className="chat-thread-search mt-3">
            <Search size={17} className="shrink-0 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Търси в разговора..."
              autoFocus
              aria-label="Търси в разговора"
            />
            <span className="hidden text-xs text-muted sm:inline">{searchQuery ? `${searchResultCount} резултата` : 'Въведи дума или фраза'}</span>
            <button
              type="button"
              onClick={() => { setSearchOpen(false); setSearchQuery('') }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-paper hover:text-ink"
              aria-label="Затвори търсенето"
            >
              <X size={17} />
            </button>
          </div>
        )}
      </div>

      <div ref={threadBodyRef} className="chat-thread-body min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 md:px-4 md:py-5">
        <div className="chat-thread-content mx-auto flex w-full flex-col">
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
          {status === 'ready' && searchQuery && searchResultCount === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-soft/70 p-6 text-center text-sm text-muted">
              Няма съобщения, които съвпадат с търсенето.
            </div>
          )}
          {status === 'ready' && filteredThreadItems.map((item) => (
            item.type === 'date' ? (
              <DateSeparator key={item.id} label={item.label} />
            ) : (
              <div
                key={item.id}
                data-message-id={item.message.id}
                className={highlightedMessageId === item.message.id ? 'motion-safe:message-highlight' : ''}
              >
                <MessageBubble
                  message={{ ...item.message, body: item.message.kind === 'system' ? compactSystemText(item.message.body) : item.message.body }}
                  userId={userId}
                  conversation={conversation}
                  onOfferAction={onOfferAction}
                  onServiceRequestAction={onServiceRequestAction}
                  onReplyToMessage={onReplyToMessage}
                  onNavigateToMessage={scrollToMessageById}
                  onToggleReaction={onToggleReaction}
                  onForwardMessage={onForwardMessage}
                  onSaveMessageFlags={onSaveMessageFlags}
                  showAvatar={item.showAvatar}
                  showTimestamp={item.showTimestamp}
                  groupPosition={item.groupPosition}
                  groupedWithPrevious={item.groupedWithPrevious}
                  groupedWithNext={item.groupedWithNext}
                  mediaItems={mediaItems}
                  onOpenMedia={setActiveMediaIndex}
                  onRevealInlineControls={revealInlineControls}
                />
              </div>
            )
          ))}
          {status === 'ready' && !threadItems.length && (
            <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
              Започни разговора с кратко съобщение.
            </div>
          )}
        </div>
      </div>
      {showJumpToLatest && (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-4 left-1/2 z-20 grid h-10 w-10 -translate-x-1/2 place-items-center rounded-full border-2 border-paper bg-ink text-paper shadow-[0_16px_34px_-16px_rgba(15,23,42,0.58)] transition hover:scale-105 hover:bg-accentDeep focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25 md:bottom-5"
          aria-label="Към най-новите съобщения"
        >
          <ChevronDown size={21} strokeWidth={2.8} aria-hidden="true" />
        </button>
      )}
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

function ChatConversationAction({ icon: Icon, label, destructive = false, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`chat-conversation-action ${destructive ? 'chat-conversation-action-destructive' : ''}`}
    >
      <Icon size={17} strokeWidth={2} aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}

function SecurityTipOverlay({ onClose }) {
  return (
    <>
      {onClose && (
        <button
          type="button"
          className="chat-thread-security-backdrop"
          onPointerDown={onClose}
          onMouseDown={onClose}
          onTouchStart={onClose}
          onClick={onClose}
          aria-label="Затвори информацията за сигурност"
        />
      )}
      <div className="chat-thread-security-tooltip" role="tooltip">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accentDeep" />
        <p>Пази комуникацията в Totsan и провери условията на офертата преди плащане. Не споделяй чувствителни платежни данни в чата.</p>
      </div>
    </>
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
