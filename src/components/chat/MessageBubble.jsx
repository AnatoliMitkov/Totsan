import { useState } from 'react'
import { AlertTriangle, CornerUpLeft, SmilePlus, X } from 'lucide-react'
import OfferCard from './OfferCard.jsx'
import Avatar from '../Avatar.jsx'
import { compactSystemText, getParticipantDisplayName, getOtherParticipant } from '../../lib/chat.js'

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
}) {
  const own = message.sender_id === userId
  const system = message.kind === 'system'
  const offer = message.kind === 'offer' && message.offer
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false)
  const reactions = Array.isArray(message.reactions) ? message.reactions : []
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
    ? 'border-ink/90 bg-ink text-paper shadow-[0_14px_34px_-24px_rgba(15,23,42,0.65)]'
    : 'border-line/90 bg-soft/95 text-ink shadow-[0_12px_26px_-24px_rgba(15,23,42,0.28)] backdrop-blur-sm'
  const wrapperSpacingClass = groupedWithPrevious ? 'mt-1.5' : 'mt-4 first:mt-0'
  const alignmentClass = own ? 'items-end' : 'items-start'

  return (
    <div className={`group flex w-full min-w-0 gap-3 ${own ? 'justify-end' : 'justify-start'} ${wrapperSpacingClass}`}>
      {!own && (
        showAvatar
          ? <Avatar src={avatarUrl} srcCandidates={avatarCandidates} name={participantName} size={32} className="self-end" />
          : <div className="w-8 shrink-0" aria-hidden="true" />
      )}
      <div className={`flex min-w-0 flex-col ${alignmentClass}`}>
        <div className={`min-w-0 overflow-hidden border px-4 py-3 ${bubbleRadiusClass} ${bubbleSurfaceClass} ${offer ? 'w-[min(100%,42rem)] sm:w-[min(78%,44rem)] lg:w-[min(76%,48rem)]' : 'max-w-[88%] sm:max-w-[min(42rem,78%)] lg:max-w-[min(46rem,76%)]'}`}>
          {replyPreview && (
            <div className={`mb-3 rounded-2xl border px-3 py-2 text-xs ${own ? 'border-paper/15 bg-paper/10 text-paper/85' : 'border-line/70 bg-paper/80 text-muted'}`}>
              <div className={`truncate font-medium ${own ? 'text-paper' : 'text-ink'}`}>{replyPreview.senderLabel}</div>
              <div className="mt-1 break-words whitespace-normal opacity-80">{replyPreview.body}</div>
            </div>
          )}
          {offer ? (
            <OfferCard offer={message.offer} conversation={conversation} userId={userId} onAction={onOfferAction} compact={own} messageCreatedAt={message.created_at} />
          ) : (
            <p className="break-words whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{message.body}</p>
          )}
          {message.was_masked && (
            <div className={`mt-3 flex min-w-0 items-start gap-2 text-xs ${own ? 'text-paper/72' : 'text-amber-800'}`}>
              <AlertTriangle size={14} /> Част от текста е скрита за сигурност.
            </div>
          )}
          {showTimestamp && (
            <div className={`mt-2 text-[11px] ${own ? 'text-paper/60' : 'text-muted'} ${groupedWithNext ? 'hidden' : 'block'}`}>
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
  const text = String(message.body || '').trim()
  if (!text) return 'Съобщението не е налично'
  return text.length > 120 ? `${text.slice(0, 117)}...` : text
}
