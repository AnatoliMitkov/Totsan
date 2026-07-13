import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, Copy, CornerUpLeft, Download, FileText, Forward, ImageOff, Info, MoreVertical, Pause, Pin, Play, Share2, SmilePlus, Star, Volume2, X } from 'lucide-react'
import OfferCard from './OfferCard.jsx'
import ServiceRequestCard from './ServiceRequestCard.jsx'
import CatalogReferenceCard from './CatalogReferenceCard.jsx'
import Avatar from '../Avatar.jsx'
import { compactSystemText, decodeChatReferenceBody, getMessageSnippet, getParticipantDisplayName, getOtherParticipant } from '../../lib/chat.js'
import { createChatAttachmentSignedUrl, formatAttachmentSize, isAudioAttachment, isDeletedAttachment, isImageAttachment } from '../../lib/chat-attachments.js'

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '🙏']

const IMPORTANT_COLORS = [
  '#1d4ed8', '#2563eb', '#0f766e', '#047857', '#15803d', '#65a30d', '#ca8a04', '#d97706',
  '#dc2626', '#e11d48', '#be123c', '#c026d3', '#9333ea', '#7c3aed', '#4f46e5', '#0891b2',
  '#bfdbfe', '#bae6fd', '#a7f3d0', '#bbf7d0', '#fef08a', '#fed7aa', '#fecdd3', '#f5d0fe',
  '#0f172a', '#334155', '#475569', '#78350f', '#7f1d1d', '#581c87', '#064e3b', '#ffffff',
]

export default function MessageBubble({
  message,
  userId,
  conversation,
  onOfferAction,
  onServiceRequestAction,
  onReplyToMessage,
  onNavigateToMessage,
  onToggleReaction,
  onForwardMessage,
  onSaveMessageFlags,
  showAvatar = true,
  showTimestamp = true,
  groupPosition = 'single',
  groupedWithPrevious = false,
  groupedWithNext = false,
  mediaItems = [],
  onOpenMedia,
  onRevealInlineControls,
}) {
  const bubbleRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const actionsMenuRef = useRef(null)
  const messageInfoRef = useRef(null)
  const own = message.sender_id === userId
  const system = message.kind === 'system'
  const offer = message.kind === 'offer' && message.offer
  const serviceRequest = message.kind === 'service_request' && message.service_request
  const reference = message.kind === 'text' ? decodeChatReferenceBody(message.body) : null
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false)
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false)
  const [actionsMenuPosition, setActionsMenuPosition] = useState('up')
  const [messageInfoOpen, setMessageInfoOpen] = useState(false)
  const [importantPaletteOpen, setImportantPaletteOpen] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [actionFeedback, setActionFeedback] = useState('')
  const [messageFlags, setMessageFlags] = useState(() => loadLocalMessageFlags(userId, message.id, message.message_flags))
  const reactions = Array.isArray(message.reactions) ? message.reactions : []
  const attachments = Array.isArray(message.attachments) ? message.attachments : []
  const audioOnlyMessage = attachments.length === 1 && isAudioAttachment(attachments[0]) && !message.body && !offer && !serviceRequest && !reference
  const reactionSummary = summarizeReactions(reactions, userId)
  const replyPreview = buildReplyPreview(message, conversation)

  if (system) {
    return <div className="my-4 mx-auto w-full max-w-full rounded-full border border-line bg-soft px-4 py-2 text-center text-sm text-muted break-words whitespace-normal">{compactSystemText(message.body)}</div>
  }

  const participant = getOtherParticipant(conversation, userId)
  const sender = message.sender_id === conversation.client_id ? conversation.client : conversation.partner
  const senderName = getParticipantDisplayName(sender)
  const senderAvatarUrl = sender?.avatar_url || ''
  const senderAvatarCandidates = sender?.avatar_candidates || []
  const avatarUrl = participant?.avatar_url || ''
  const avatarCandidates = participant?.avatar_candidates || []
  const participantName = getParticipantDisplayName(participant)
  const bubbleRadiusClass = bubbleRadius(own, groupPosition)
  const isOfferDocument = Boolean(offer)
  const forceLightBubble = Boolean(serviceRequest || isOfferDocument)
  const bubbleSurfaceClass = isOfferDocument
    ? 'border-transparent bg-transparent text-ink shadow-none'
    : own && !forceLightBubble
      ? 'border-accentDeep bg-accentDeep text-paper shadow-[0_14px_34px_-24px_rgba(22,62,162,0.62)]'
      : 'border-line/90 bg-soft/95 text-ink shadow-[0_12px_26px_-24px_rgba(15,23,42,0.28)] backdrop-blur-sm'
  const bubbleSizeClass = offer || serviceRequest || reference
    ? 'w-full max-w-[min(92vw,42rem)] sm:max-w-[min(78%,44rem)] lg:max-w-[min(72%,46rem)]'
    : audioOnlyMessage
      ? 'w-full max-w-[min(84vw,20.5rem)] sm:max-w-[20.5rem]'
    : 'w-fit max-w-[min(82vw,34rem)] sm:max-w-[min(74%,38rem)] lg:max-w-[min(62%,42rem)]'
  const bubblePaddingClass = isOfferDocument ? 'p-0' : audioOnlyMessage ? 'px-3 py-2.5' : 'px-4 py-3'
  const wrapperSpacingClass = groupedWithPrevious ? 'mt-1.5' : 'mt-4 first:mt-0'
  const alignmentClass = own ? 'items-end' : 'items-start'
  const downloadableAttachments = attachments.filter((attachment) => !isDeletedAttachment(attachment))
  const messageActionText = getMessageActionText(message, { reference, offer, serviceRequest })
  const messageKindLabel = getMessageKindLabel(message, attachments)
  const isPinned = Boolean(messageFlags.pinned)
  const isStarred = Boolean(messageFlags.starred)
  const importantColor = normalizeImportantColor(messageFlags.color)
  const importantStyle = importantColor ? importantBubbleStyle(importantColor) : undefined

  useEffect(() => {
    if (!reactionPickerOpen) return undefined
    const timeout = window.setTimeout(() => {
      onRevealInlineControls?.(bubbleRef.current)
    }, 30)
    return () => window.clearTimeout(timeout)
  }, [onRevealInlineControls, reactionPickerOpen])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches)
    updateViewport()
    mediaQuery.addEventListener?.('change', updateViewport)
    return () => mediaQuery.removeEventListener?.('change', updateViewport)
  }, [])

  useLayoutEffect(() => {
    if (!actionsMenuOpen || !actionsMenuRef.current) return undefined

    const menu = actionsMenuRef.current
    const threadBody = menu.closest('.chat-thread-body')
    if (!threadBody) return undefined

    const menuRect = menu.getBoundingClientRect()
    const bodyRect = threadBody.getBoundingClientRect()
    const nextPosition = menuRect.top < bodyRect.top + 12 ? 'down' : 'up'

    if (nextPosition !== actionsMenuPosition) {
      setActionsMenuPosition(nextPosition)
      return undefined
    }

    onRevealInlineControls?.(menu)
    return undefined
  }, [actionsMenuOpen, actionsMenuPosition, importantPaletteOpen, onRevealInlineControls])

  useEffect(() => {
    if (!actionsMenuOpen && !messageInfoOpen) return undefined

    function handlePointerDown(event) {
      if (!bubbleRef.current?.contains(event.target) && !actionsMenuRef.current?.contains(event.target) && !messageInfoRef.current?.contains(event.target)) {
        setActionsMenuOpen(false)
        setMessageInfoOpen(false)
        setImportantPaletteOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [actionsMenuOpen, messageInfoOpen])

  useEffect(() => {
    if (!actionFeedback) return undefined
    const timeout = window.setTimeout(() => setActionFeedback(''), 1400)
    return () => window.clearTimeout(timeout)
  }, [actionFeedback])

  useEffect(() => {
    setMessageFlags(loadLocalMessageFlags(userId, message.id, message.message_flags))
  }, [message.id, message.message_flags, userId])

  useEffect(() => {
    if (message.message_flags || !message.id) return
    const localFlags = loadLocalMessageFlags(userId, message.id, null)
    if (!localFlags.pinned && !localFlags.starred) return
    onSaveMessageFlags?.(message.id, localFlags)
  }, [message.id, message.message_flags, onSaveMessageFlags, userId])

  useEffect(() => () => {
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current)
  }, [])

  function closeActionsMenu() {
    setActionsMenuOpen(false)
    setImportantPaletteOpen(false)
  }

  function startLongPress(event) {
    if (event.pointerType === 'mouse') return
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = window.setTimeout(() => {
      setActionsMenuOpen(true)
      setActionsMenuPosition('up')
      setMessageInfoOpen(false)
      setReactionPickerOpen(false)
      longPressTimerRef.current = null
    }, 420)
  }

  function cancelLongPress() {
    if (!longPressTimerRef.current) return
    window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
  }

  async function copyMessage() {
    closeActionsMenu()
    if (!messageActionText) return
    await copyTextToClipboard(messageActionText)
    setActionFeedback('Копирано')
  }

  async function downloadMessageAttachments() {
    closeActionsMenu()
    await downloadAttachments(downloadableAttachments)
    setActionFeedback(downloadableAttachments.length > 1 ? 'Файловете се изтеглят' : 'Файлът се изтегля')
  }

  async function shareMessage() {
    closeActionsMenu()
    onForwardMessage?.(message, messageActionText)
    setActionFeedback('Готово за препращане')
  }

  function toggleFlag(flag) {
    closeActionsMenu()
    setMessageFlags((current) => {
      const next = { ...current, [flag]: !current[flag] }
      if (flag === 'starred' && !next.starred) next.color = ''
      if (flag === 'starred' && next.starred && !next.color) next.color = '#fef08a'
      saveLocalMessageFlags(userId, message.id, next)
      onSaveMessageFlags?.(message.id, next)
      return next
    })
  }

  function chooseImportantColor(color) {
    const nextColor = normalizeImportantColor(color)
    setMessageFlags((current) => {
      const next = { ...current, starred: Boolean(nextColor), color: nextColor }
      saveLocalMessageFlags(userId, message.id, next)
      onSaveMessageFlags?.(message.id, next)
      return next
    })
    setActionFeedback(nextColor ? 'Цветът е избран' : 'Цветът е махнат')
    closeActionsMenu()
  }

  const actionsMenu = actionsMenuOpen ? (
    <div ref={actionsMenuRef} className={`chat-message-actions-menu chat-message-actions-menu-position-${actionsMenuPosition} ${own ? 'chat-message-actions-menu-own' : 'chat-message-actions-menu-other'}`}>
      {importantPaletteOpen && <ImportantColorPalette value={importantColor} onSelect={chooseImportantColor} onBack={() => setImportantPaletteOpen(false)} />}
      <button type="button" onClick={() => setImportantPaletteOpen((value) => !value)} className={`chat-message-action-item ${isStarred ? 'is-active' : ''}`}>
        <Star size={16} />
        <span>{isStarred ? 'Промени цвят' : 'Важно'}</span>
      </button>
      <MessageActionButton icon={Pin} label={isPinned ? 'Откачи' : 'Закачи'} onClick={() => toggleFlag('pinned')} active={isPinned} />
      <MessageActionButton icon={CornerUpLeft} label="Отговор" onClick={() => { closeActionsMenu(); onReplyToMessage?.(message) }} />
      <MessageActionButton icon={SmilePlus} label="Реакция" onClick={() => { closeActionsMenu(); setReactionPickerOpen(true) }} />
      <MessageActionButton icon={Info} label="Инфо" onClick={() => { closeActionsMenu(); setMessageInfoOpen(true) }} />
      {messageActionText && <MessageActionButton icon={Copy} label="Копирай" onClick={copyMessage} />}
      {downloadableAttachments.length > 0 && <MessageActionButton icon={Download} label={downloadableAttachments.length > 1 ? 'Изтегли файлове' : 'Изтегли'} onClick={downloadMessageAttachments} />}
      {(messageActionText || downloadableAttachments.length > 0) && <MessageActionButton icon={Share2} label="Сподели" onClick={shareMessage} />}
    </div>
  ) : null

  const messageInfoPanel = messageInfoOpen ? (
    <MessageInfoPanel
      panelRef={messageInfoRef}
      own={own}
      senderName={senderName}
      kindLabel={messageKindLabel}
      createdAt={message.created_at}
      attachments={attachments}
      onClose={() => setMessageInfoOpen(false)}
    />
  ) : null

  const actionFeedbackPanel = actionFeedback ? (
    <div className={`chat-message-feedback ${own ? 'chat-message-feedback-own' : 'chat-message-feedback-other'}`}>
      <Check size={13} />
      <span>{actionFeedback}</span>
    </div>
  ) : null

  return (
    <div ref={bubbleRef} className={`group flex w-full min-w-0 gap-3 ${own ? 'justify-end' : 'justify-start'} ${wrapperSpacingClass}`}>
      {!own && (
        showAvatar
          ? <Avatar src={avatarUrl} srcCandidates={avatarCandidates} name={participantName} size={32} className="self-end" />
          : <div className="w-8 shrink-0" aria-hidden="true" />
      )}
      <div className={`flex min-w-0 max-w-full flex-1 flex-col ${alignmentClass}`}>
        <div
          className={`relative min-w-0 overflow-visible border ${bubblePaddingClass} ${bubbleRadiusClass} ${bubbleSurfaceClass} ${bubbleSizeClass} ${isPinned ? 'chat-message-pinned' : ''} ${isStarred ? 'chat-message-starred' : ''}`}
          style={importantStyle}
          onPointerDown={startLongPress}
          onPointerUp={cancelLongPress}
          onPointerCancel={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            onClick={() => {
              setActionsMenuOpen((value) => !value)
              setActionsMenuPosition('up')
              setMessageInfoOpen(false)
            }}
            className={`chat-message-more ${own ? 'chat-message-more-own' : 'chat-message-more-other'}`}
            aria-label="Действия за съобщението"
            aria-expanded={actionsMenuOpen}
          >
            <MoreVertical size={17} />
          </button>
          {actionFeedback && (
            isMobileViewport && typeof document !== 'undefined'
              ? createPortal(actionFeedbackPanel, document.body)
              : actionFeedbackPanel
          )}
          {actionsMenuOpen && (
            isMobileViewport && typeof document !== 'undefined'
              ? createPortal(actionsMenu, document.body)
              : actionsMenu
          )}
          {messageInfoOpen && (
            isMobileViewport && typeof document !== 'undefined'
              ? createPortal(messageInfoPanel, document.body)
              : messageInfoPanel
          )}
          {replyPreview && (
            <button
              type="button"
              onClick={() => onNavigateToMessage?.(message.reply_to_message_id)}
              className={`mb-3 cursor-pointer rounded-2xl border px-3 py-2 text-xs outline-none transition hover:bg-soft/80 focus-visible:ring-2 focus-visible:ring-accentDeep/25 ${own && !forceLightBubble ? 'border-paper/15 bg-paper/10 text-paper/85' : 'border-line/70 bg-paper/80 text-muted'}`}
            >
              <div className={`truncate font-medium ${own && !forceLightBubble ? 'text-paper' : 'text-ink'}`}>{replyPreview.senderLabel}</div>
              <div className="mt-1 break-words whitespace-normal opacity-80">{replyPreview.body}</div>
            </button>
          )}
          {(isPinned || isStarred) && (
            <div className={`mb-2 flex flex-wrap gap-1.5 text-[11px] ${own && !forceLightBubble ? 'text-paper/80' : 'text-accentDeep'}`}>
              {isPinned && <span className="chat-message-flag-pill"><Pin size={11} /> Закачено</span>}
              {isStarred && <span className="chat-message-flag-pill"><Star size={11} /> Важно</span>}
            </div>
          )}
          {serviceRequest ? (
            <ServiceRequestCard request={serviceRequest} conversation={conversation} userId={userId} onAction={onServiceRequestAction} compact={false} />
          ) : offer ? (
            <OfferCard offer={message.offer} conversation={conversation} userId={userId} onAction={onOfferAction} messageCreatedAt={message.created_at} />
          ) : reference ? (
            <CatalogReferenceCard reference={reference} compact={own} />
          ) : message.body ? (
            <p className="break-words whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{message.body}</p>
          ) : null}
          {attachments.length > 0 && (
            <div className={`${message.body ? 'mt-3' : ''} grid gap-2`}>
              {attachments.map((attachment, index) => (
                <AttachmentPreview
                  key={`${attachment.path || attachment.name}-${index}`}
                  attachment={attachment}
                  own={own}
                  senderName={senderName}
                  senderAvatarUrl={senderAvatarUrl}
                  senderAvatarCandidates={senderAvatarCandidates}
                  messageCreatedAt={message.created_at}
                  compactVoice={audioOnlyMessage}
                  mediaItems={mediaItems}
                  onOpenMedia={onOpenMedia}
                />
              ))}
            </div>
          )}
          {message.was_masked && (
            <div className={`mt-3 flex min-w-0 items-start gap-2 text-xs ${own && !forceLightBubble ? 'text-paper/72' : 'text-amber-800'}`}>
              <AlertTriangle size={14} /> Част от текста е скрита за сигурност.
            </div>
          )}
          {showTimestamp && !audioOnlyMessage && (
            <div className={`mt-2 text-right text-[11px] ${own && !forceLightBubble ? 'text-paper/68' : 'text-muted'} ${groupedWithNext ? 'hidden' : 'block'}`}>
              {new Date(message.created_at).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>

        {reactionSummary.length > 0 && (
          <div className={`mt-2 flex flex-wrap gap-1.5 ${own ? 'justify-end' : 'justify-start'}`}>
            {reactionSummary.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                onClick={() => onToggleReaction?.(message.id, reaction.emoji, reaction.active)}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition ${reaction.active ? 'border-ink bg-paper text-ink shadow-sm' : 'border-line bg-paper/90 text-muted hover:text-ink'}`}
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </button>
            ))}
          </div>
        )}

        {reactionPickerOpen && (
          <div className={`mt-2 flex flex-wrap gap-2 rounded-2xl border border-line bg-paper/95 px-3 py-2 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.35)] backdrop-blur-sm ${own ? 'self-end' : 'self-start'}`}>
            {EMOJI_OPTIONS.map((emoji) => {
              const existingReaction = reactionSummary.find((reaction) => reaction.emoji === emoji)
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setReactionPickerOpen(false)
                    onToggleReaction?.(message.id, emoji, Boolean(existingReaction?.active))
                  }}
                  className={`rounded-full border px-2.5 py-1.5 text-sm transition ${existingReaction?.active ? 'border-ink bg-soft text-ink' : 'border-line hover:border-ink/40 hover:bg-soft'}`}
                >
                  {emoji}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function AttachmentPreview({ attachment, own, senderName, senderAvatarUrl, senderAvatarCandidates, messageCreatedAt, compactVoice, mediaItems, onOpenMedia }) {
  const [signedUrl, setSignedUrl] = useState('')
  const [urlStatus, setUrlStatus] = useState('idle')
  const isImage = isImageAttachment(attachment)
  const isAudio = isAudioAttachment(attachment)
  const deleted = isDeletedAttachment(attachment)

  useEffect(() => {
    if (deleted) {
      setSignedUrl('')
      setUrlStatus('missing')
      return undefined
    }

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
  }, [attachment, deleted])

  const name = String(attachment?.name || 'Attachment')
  const size = formatAttachmentSize(attachment?.size || 0)
  const mediaIndex = isImage && !deleted
    ? mediaItems.findIndex((item) => item.attachment?.path && item.attachment.path === attachment?.path)
    : -1
  const linkClass = own
    ? 'border-paper/15 bg-paper/10 text-paper hover:bg-paper/15'
    : 'border-line bg-paper/90 text-ink hover:bg-paper'
  const mutedClass = own
    ? 'border-paper/15 bg-paper/10 text-paper/72'
    : 'border-line bg-paper/80 text-muted'

  if (deleted) {
    const deletedTitle = isImage ? 'Снимката вече не е налична' : 'Файлът вече не е наличен'
    return (
      <div className={`flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-3 text-sm ${mutedClass}`}>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${own ? 'bg-paper/10' : 'bg-soft'}`}>
          <ImageOff size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{deletedTitle}</span>
          <span className="block text-xs opacity-75">Премахната е според политиката за пазене.</span>
        </span>
      </div>
    )
  }

  if (isImage) {
    return (
      <button
        type="button"
        onClick={() => {
          if (mediaIndex >= 0) {
            onOpenMedia?.(mediaIndex)
            return
          }
          if (signedUrl) window.open(signedUrl, '_blank', 'noopener,noreferrer')
        }}
        className={`block w-full overflow-hidden rounded-2xl border text-left transition ${linkClass}`}
        aria-label={`Open ${name}`}
      >
        {urlStatus === 'ready' && signedUrl ? (
          <img src={signedUrl} alt={name} className="max-h-72 w-full object-cover" loading="lazy" />
        ) : urlStatus === 'missing' ? (
          <div className="grid h-40 place-items-center gap-2 text-center text-sm opacity-75">
            <ImageOff size={22} />
            <span>Снимката не може да се зареди</span>
          </div>
        ) : (
          <div className="grid h-40 place-items-center text-sm opacity-75">Loading image...</div>
        )}
        <div className="flex min-w-0 items-center justify-between gap-3 px-3 py-2 text-xs">
          <span className="min-w-0 truncate">{name}</span>
          <span className="shrink-0 opacity-75">{size}</span>
        </div>
      </button>
    )
  }

  if (isAudio) {
    if (urlStatus === 'ready' && signedUrl) {
      return (
        <div className={compactVoice ? 'min-w-0' : `min-w-0 rounded-2xl border px-3 py-3 text-sm ${linkClass}`}>
          <VoiceMessagePlayer
            src={signedUrl}
            own={own}
            name={senderName}
            avatarUrl={senderAvatarUrl}
            avatarCandidates={senderAvatarCandidates}
            createdAt={messageCreatedAt}
            duration={attachment.duration}
            waveform={attachment.waveform}
          />
        </div>
      )
    }

    return (
      <div className={`min-w-0 rounded-2xl border px-3 py-3 text-sm ${linkClass}`}>
        <div className="mb-2 flex min-w-0 items-center justify-between gap-3 text-xs">
          <span className="min-w-0 truncate font-medium">Гласово съобщение</span>
          <span className="shrink-0 opacity-75">{size}</span>
        </div>
        {urlStatus === 'ready' && signedUrl ? (
          <audio controls src={signedUrl} className="block w-full min-w-0" preload="metadata" />
        ) : urlStatus === 'missing' ? (
          <div className="rounded-xl bg-soft/80 px-3 py-2 text-xs opacity-75">Гласовото съобщение не може да се зареди.</div>
        ) : (
          <div className="rounded-xl bg-soft/80 px-3 py-2 text-xs opacity-75">Зареждаме гласовото съобщение...</div>
        )}
      </div>
    )
  }

  return (
    <a
      href={signedUrl || undefined}
      target="_blank"
      rel="noreferrer"
      download={name}
      className={`flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition ${linkClass}`}
      aria-label={`Download ${name}`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${own ? 'bg-paper/10' : 'bg-soft'}`}>
        <FileText size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{name}</span>
        <span className="block text-xs opacity-75">{size}</span>
      </span>
      <Download size={17} className="shrink-0 opacity-75" />
    </a>
  )
}

function MessageActionButton({ icon: Icon, label, onClick, active = false }) {
  if (Icon === Star) return null
  const RenderIcon = Icon === Share2 ? Forward : Icon
  const renderLabel = Icon === Share2 ? 'Препрати' : label

  return (
    <button type="button" onClick={onClick} className={`chat-message-action-item ${active ? 'is-active' : ''}`}>
      <RenderIcon size={16} />
      <span>{renderLabel}</span>
    </button>
  )
}

function ImportantColorPalette({ value, onSelect, onBack }) {
  return (
    <div className="chat-important-palette">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Цвят за важно</span>
        <button type="button" onClick={onBack} className="rounded-full px-2 py-1 text-xs text-muted transition hover:bg-soft hover:text-ink">Назад</button>
      </div>
      <div className="chat-important-color-grid">
        {IMPORTANT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onSelect(color)}
            className={`chat-important-color ${value === color ? 'is-selected' : ''}`}
            style={{ background: color }}
            aria-label={`Избери цвят ${color}`}
          />
        ))}
      </div>
      <button type="button" onClick={() => onSelect('')} className="mt-2 w-full rounded-xl border border-line bg-soft px-3 py-2 text-xs font-semibold text-muted transition hover:text-ink">
        Махни важния цвят
      </button>
    </div>
  )
}

function MessageInfoPanel({ panelRef, own, senderName, kindLabel, createdAt, attachments, onClose }) {
  const created = createdAt ? new Date(createdAt) : null
  const sentLabel = created
    ? created.toLocaleString('bg-BG', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    : 'Няма данни'
  const attachmentsLabel = attachments.length
    ? attachments.length === 1
      ? formatAttachmentSize(attachments[0]?.size || 0)
      : `${attachments.length} файла`
    : 'Няма'

  return (
    <div ref={panelRef} className={`chat-message-info-panel ${own ? 'chat-message-info-panel-own' : 'chat-message-info-panel-other'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Инфо</div>
          <div className="mt-1 font-medium text-ink">{kindLabel}</div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-muted transition hover:bg-soft hover:text-ink" aria-label="Затвори">
          <X size={14} />
        </button>
      </div>
      <dl className="mt-3 grid gap-2 text-xs text-muted">
        <div className="flex justify-between gap-3">
          <dt>Подател</dt>
          <dd className="text-right text-ink">{senderName || 'Потребител'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Изпратено</dt>
          <dd className="text-right text-ink">{sentLabel}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Файлове</dt>
          <dd className="text-right text-ink">{attachmentsLabel}</dd>
        </div>
      </dl>
    </div>
  )
}

function VoiceMessagePlayer({ src, own, name, avatarUrl, avatarCandidates, createdAt, duration: initialDuration, waveform: providedWaveform }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(() => {
    const value = Number(initialDuration || 0)
    return Number.isFinite(value) && value > 0 ? value : 0
  })
  const [currentTime, setCurrentTime] = useState(0)
  const waveform = useVoiceWaveform(src, providedWaveform)
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0

  useEffect(() => {
    const value = Number(initialDuration || 0)
    if (Number.isFinite(value) && value > 0) setDuration(value)
  }, [initialDuration])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined

    const handleLoaded = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const handleTime = () => setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0)
    const handleEnded = () => {
      setPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener('loadedmetadata', handleLoaded)
    audio.addEventListener('durationchange', handleLoaded)
    audio.addEventListener('timeupdate', handleTime)
    audio.addEventListener('ended', handleEnded)
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoaded)
      audio.removeEventListener('durationchange', handleLoaded)
      audio.removeEventListener('timeupdate', handleTime)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [src])

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }
    try {
      await audio.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  function seek(event) {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = event.currentTarget.getBoundingClientRect()
    const nextProgress = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    audio.currentTime = nextProgress * duration
    setCurrentTime(audio.currentTime)
  }

  const timeLabel = duration > 0 ? formatVoiceTime(playing ? currentTime : duration) : '0:00'
  const createdLabel = createdAt
    ? new Date(createdAt).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div className={`chat-audio-message ${own ? 'chat-audio-message-own' : 'chat-audio-message-other'}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <Avatar src={avatarUrl} srcCandidates={avatarCandidates} name={name} size={48} className="chat-audio-avatar" />
      <button type="button" onClick={togglePlayback} className="chat-audio-play" aria-label={playing ? 'Pause voice message' : 'Play voice message'}>
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
      </button>
      <div className="chat-audio-body">
        <button type="button" className="chat-audio-waveform" onClick={seek} aria-label="Seek voice message">
          {waveform.map((level, index) => {
            const active = index / Math.max(1, waveform.length - 1) <= progress
            return <span key={index} className={active ? 'is-active' : ''} style={{ height: `${Math.round(5 + level * 24)}px` }} />
          })}
        </button>
        <div className="chat-audio-meta">
          <span>{timeLabel}</span>
          <span className="chat-audio-sent">
            <Volume2 size={12} />
            {createdLabel}
          </span>
        </div>
      </div>
    </div>
  )
}

function useVoiceWaveform(seed = '', provided = null) {
  const fallback = useStableWaveform(seed)
  const normalized = normalizeWaveformLevels(provided)
  return normalized || fallback
}

function normalizeWaveformLevels(value) {
  if (!Array.isArray(value)) return null
  const levels = value
    .map(Number)
    .filter(Number.isFinite)
    .map((level) => Math.max(0.04, Math.min(1, level)))
  return levels.length >= 8 ? levels : null
}

function useStableWaveform(seed = '') {
  const [levels] = useState(() => {
    let hash = 2166136261
    String(seed || 'voice').split('').forEach((char) => {
      hash ^= char.charCodeAt(0)
      hash = Math.imul(hash, 16777619)
    })

    return Array.from({ length: 34 }, (_, index) => {
      hash ^= index + 0x9e3779b9
      hash = Math.imul(hash, 2246822519)
      const noise = ((hash >>> 0) % 100) / 100
      const wave = Math.sin(index * 0.62) * 0.26 + Math.sin(index * 1.37) * 0.14
      return Math.max(0.08, Math.min(1, 0.34 + wave + noise * 0.5))
    })
  })

  return levels
}

function formatVoiceTime(totalSeconds = 0) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function messageFlagsStorageKey(userId = '') {
  return `totsan-chat-message-flags:${userId || 'guest'}`
}

function readAllMessageFlags(userId = '') {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(messageFlagsStorageKey(userId)) || '{}') || {}
  } catch {
    return {}
  }
}

function loadLocalMessageFlags(userId = '', messageId = '', serverFlags = null) {
  if (!messageId) return { pinned: false, starred: false, color: '' }
  const flags = serverFlags || readAllMessageFlags(userId)[messageId] || {}
  return {
    pinned: Boolean(flags.pinned),
    starred: Boolean(flags.starred),
    color: normalizeImportantColor(flags.color),
  }
}

function saveLocalMessageFlags(userId = '', messageId = '', flags = {}) {
  if (typeof window === 'undefined' || !messageId) return
  const allFlags = readAllMessageFlags(userId)
  const nextFlags = {
    pinned: Boolean(flags.pinned),
    starred: Boolean(flags.starred),
    color: normalizeImportantColor(flags.color),
  }
  if (!nextFlags.pinned && !nextFlags.starred) {
    delete allFlags[messageId]
  } else {
    allFlags[messageId] = nextFlags
  }
  window.localStorage.setItem(messageFlagsStorageKey(userId), JSON.stringify(allFlags))
}

function normalizeImportantColor(value = '') {
  const color = String(value || '').trim().toLowerCase()
  return IMPORTANT_COLORS.includes(color) ? color : ''
}

function importantBubbleStyle(color = '') {
  const normalized = normalizeImportantColor(color)
  if (!normalized) return undefined
  const textColor = readableTextColor(normalized)
  return {
    background: normalized,
    borderColor: textColor === '#ffffff' ? 'rgba(255,255,255,0.28)' : 'rgba(13,35,64,0.16)',
    color: textColor,
  }
}

function readableTextColor(hex = '#ffffff') {
  const color = hex.replace('#', '')
  if (color.length !== 6) return '#0d2340'
  const r = parseInt(color.slice(0, 2), 16)
  const g = parseInt(color.slice(2, 4), 16)
  const b = parseInt(color.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#0d2340' : '#ffffff'
}

function getMessageActionText(message, { reference, offer, serviceRequest }) {
  const body = String(message?.body || '').trim()
  if (body) return body
  if (reference?.title || reference?.subtitle) return [reference.title, reference.subtitle].filter(Boolean).join('\n')
  if (offer?.title) return `Оферта: ${offer.title}`
  if (serviceRequest?.title || serviceRequest?.snapshot?.title) return `Заявка: ${serviceRequest.title || serviceRequest.snapshot.title}`
  return ''
}

function getMessageKindLabel(message, attachments = []) {
  if (message.kind === 'offer') return 'Оферта'
  if (message.kind === 'service_request') return 'Заявка'
  if (attachments.some((attachment) => isAudioAttachment(attachment))) return 'Гласово съобщение'
  if (attachments.some((attachment) => isImageAttachment(attachment))) return 'Снимка'
  if (attachments.length) return 'Файл'
  return 'Текстово съобщение'
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}

async function downloadAttachments(attachments = []) {
  for (const attachment of attachments) {
    const url = await createChatAttachmentSignedUrl(attachment)
    if (!url) continue
    const link = document.createElement('a')
    link.href = url
    link.download = attachment.name || 'attachment'
    link.rel = 'noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }
}

async function shareMessageContent({ message, text, attachments = [] }) {
  const title = getMessageKindLabel(message, attachments)
  let url = ''
  if (attachments.length === 1) {
    url = await createChatAttachmentSignedUrl(attachments[0])
  }

  const shareText = [text, url].filter(Boolean).join('\n')
  if (navigator.share && shareText) {
    await navigator.share({ title, text: shareText }).catch(() => {})
    return
  }

  if (shareText) await copyTextToClipboard(shareText)
}

function bubbleRadius(own, groupPosition) {
  if (groupPosition === 'single') return 'rounded-[1.55rem]'

  if (own) {
    if (groupPosition === 'start') return 'rounded-[1.55rem] rounded-br-md'
    if (groupPosition === 'middle') return 'rounded-[1.55rem] rounded-tr-md rounded-br-md'
    if (groupPosition === 'end') return 'rounded-[1.55rem] rounded-tr-md'
    return 'rounded-[1.55rem]'
  }

  if (groupPosition === 'start') return 'rounded-[1.55rem] rounded-bl-md'
  if (groupPosition === 'middle') return 'rounded-[1.55rem] rounded-tl-md rounded-bl-md'
  if (groupPosition === 'end') return 'rounded-[1.55rem] rounded-tl-md'
  return 'rounded-[1.55rem]'
}

function summarizeReactions(reactions, userId) {
  const byEmoji = new Map()

  reactions.forEach((reaction) => {
    if (!reaction?.emoji) return
    const current = byEmoji.get(reaction.emoji) || { emoji: reaction.emoji, count: 0, active: false }
    current.count += 1
    current.active = current.active || reaction.user_id === userId
    byEmoji.set(reaction.emoji, current)
  })

  return Array.from(byEmoji.values())
}

function buildReplyPreview(message, conversation) {
  if (!message?.reply_to_message_id) return null
  if (!message.reply_to_message) {
    return {
      senderLabel: 'Съобщението не е налично',
      body: 'Съобщението не е налично',
    }
  }

  const replySource = message.reply_to_message
  const sender = replySource.sender_id === conversation.client_id ? conversation.client : conversation.partner
  const senderLabel = getParticipantDisplayName(sender, 'Потребител')

  return {
    senderLabel,
    body: getMessageSnippet(replySource, { maxLength: 120 }),
  }
}

function formatReplySnippet(message) {
  if (!message) return 'Съобщението не е налично'
  if (message.kind === 'offer') return 'Оферта'
  if (message.kind === 'system') return compactSystemText(message.body || '')
  if (Array.isArray(message.attachments) && message.attachments.length) {
    return message.attachments.length === 1 ? 'Прикачен файл' : `${message.attachments.length} прикачени файла`
  }
  const text = String(message.body || '').trim()
  if (!text) return 'Съобщението не е налично'
  return text.length > 120 ? `${text.slice(0, 117)}...` : text
}
