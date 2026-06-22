import { useEffect, useState } from 'react'
import { AlertTriangle, CornerUpLeft, Download, FileText, ImageOff, SmilePlus, X } from 'lucide-react'
import OfferCard from './OfferCard.jsx'
import Avatar from '../Avatar.jsx'
import { compactSystemText, getParticipantDisplayName, getOtherParticipant } from '../../lib/chat.js'
import { createChatAttachmentSignedUrl, formatAttachmentSize, isDeletedAttachment, isImageAttachment } from '../../lib/chat-attachments.js'

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '🙏']

export default function MessageBubble({
  message,
  userId,
  conversation,
  onOfferAction,
  onReplyToMessage,
  onToggleReaction,
  showAvatar = true,
  showTimestamp = true,
  groupPosition = 'single',
  groupedWithPrevious = false,
  groupedWithNext = false,
  mediaItems = [],
  onOpenMedia,
}) {
  const own = message.sender_id === userId
  const system = message.kind === 'system'
  const offer = message.kind === 'offer' && message.offer
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false)
  const reactions = Array.isArray(message.reactions) ? message.reactions : []
  const attachments = Array.isArray(message.attachments) ? message.attachments : []
  const reactionSummary = summarizeReactions(reactions, userId)
  const replyPreview = buildReplyPreview(message, conversation)

  if (system) {
    return <div className="my-4 mx-auto w-full max-w-full rounded-full border border-line bg-soft px-4 py-2 text-center text-sm text-muted break-words whitespace-normal">{compactSystemText(message.body)}</div>
  }

  const participant = getOtherParticipant(conversation, userId)
  const avatarUrl = participant?.avatar_url || ''
  const avatarCandidates = participant?.avatar_candidates || []
  const participantName = getParticipantDisplayName(participant)
  const bubbleRadiusClass = bubbleRadius(own, groupPosition)
  const bubbleSurfaceClass = own
    ? 'border-accentDeep bg-accentDeep text-paper shadow-[0_14px_34px_-24px_rgba(22,62,162,0.62)]'
    : 'border-line/90 bg-soft/95 text-ink shadow-[0_12px_26px_-24px_rgba(15,23,42,0.28)] backdrop-blur-sm'
  const bubbleSizeClass = offer
    ? 'w-full max-w-[min(92vw,42rem)] sm:max-w-[min(78%,44rem)] lg:max-w-[min(72%,46rem)]'
    : 'w-fit max-w-[min(82vw,34rem)] sm:max-w-[min(74%,38rem)] lg:max-w-[min(62%,42rem)]'
  const wrapperSpacingClass = groupedWithPrevious ? 'mt-1.5' : 'mt-4 first:mt-0'
  const alignmentClass = own ? 'items-end' : 'items-start'

  return (
    <div className={`group flex w-full min-w-0 gap-3 ${own ? 'justify-end' : 'justify-start'} ${wrapperSpacingClass}`}>
      {!own && (
        showAvatar
          ? <Avatar src={avatarUrl} srcCandidates={avatarCandidates} name={participantName} size={32} className="self-end" />
          : <div className="w-8 shrink-0" aria-hidden="true" />
      )}
      <div className={`flex min-w-0 max-w-full flex-1 flex-col ${alignmentClass}`}>
        <div className={`min-w-0 overflow-hidden border px-4 py-3 ${bubbleRadiusClass} ${bubbleSurfaceClass} ${bubbleSizeClass}`}>
          {replyPreview && (
            <div className={`mb-3 rounded-2xl border px-3 py-2 text-xs ${own ? 'border-paper/15 bg-paper/10 text-paper/85' : 'border-line/70 bg-paper/80 text-muted'}`}>
              <div className={`truncate font-medium ${own ? 'text-paper' : 'text-ink'}`}>{replyPreview.senderLabel}</div>
              <div className="mt-1 break-words whitespace-normal opacity-80">{replyPreview.body}</div>
            </div>
          )}
          {offer ? (
            <OfferCard offer={message.offer} conversation={conversation} userId={userId} onAction={onOfferAction} compact={own} messageCreatedAt={message.created_at} />
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
                  mediaItems={mediaItems}
                  onOpenMedia={onOpenMedia}
                />
              ))}
            </div>
          )}
          {message.was_masked && (
            <div className={`mt-3 flex min-w-0 items-start gap-2 text-xs ${own ? 'text-paper/72' : 'text-amber-800'}`}>
              <AlertTriangle size={14} /> Част от текста е скрита за сигурност.
            </div>
          )}
          {showTimestamp && (
            <div className={`mt-2 text-right text-[11px] ${own ? 'text-paper/68' : 'text-muted'} ${groupedWithNext ? 'hidden' : 'block'}`}>
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

        <div className={`mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted md:opacity-0 md:transition md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${own ? 'justify-end' : 'justify-start'}`}>
          <button
            type="button"
            onClick={() => onReplyToMessage?.(message)}
            className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 transition hover:border-line hover:bg-paper hover:text-ink"
          >
            <CornerUpLeft size={13} />
            <span>Отговор</span>
          </button>
          <button
            type="button"
            onClick={() => setReactionPickerOpen((value) => !value)}
            className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 transition hover:border-line hover:bg-paper hover:text-ink"
            aria-expanded={reactionPickerOpen}
          >
            {reactionPickerOpen ? <X size={13} /> : <SmilePlus size={13} />}
            <span>Реакция</span>
          </button>
        </div>

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

function AttachmentPreview({ attachment, own, mediaItems, onOpenMedia }) {
  const [signedUrl, setSignedUrl] = useState('')
  const [urlStatus, setUrlStatus] = useState('idle')
  const isImage = isImageAttachment(attachment)
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
    body: formatReplySnippet(replySource),
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
