import { useEffect, useMemo, useRef } from 'react'
import { ShieldCheck } from 'lucide-react'
import MessageBubble from './MessageBubble.jsx'
import Avatar from '../Avatar.jsx'
import { compactSystemText, getConversationTitle, getOtherParticipant, getOtherParticipantRole, getRoleLabel } from '../../lib/chat.js'

const ACTIVE_ORDER_STATUSES = new Set(['paid', 'in_progress'])

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

export default function ChatThread({ conversation, messages, userId, orderStatus, onOfferAction }) {
  const threadBodyRef = useRef(null)
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

  useEffect(() => {
    const container = threadBodyRef.current
    if (!container) return

    container.scrollTo({
      top: container.scrollHeight,
      behavior: visibleMessages.length > 0 ? 'smooth' : 'auto',
    })
  }, [visibleMessages.length, conversation?.id])

  if (!conversation) {
    return (
      <div className="flex min-h-[24rem] w-full min-w-0 items-center justify-center rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted md:min-h-[32rem]">
        Избери разговор, за да видиш съобщенията.
      </div>
    )
  }

  const otherParticipant = getOtherParticipant(conversation, userId)
  const avatarUrl = otherParticipant?.avatar_url || ''
  const displayName = getConversationTitle(conversation, userId)
  const roleLabel = getRoleLabel(getOtherParticipantRole(conversation, userId))
  const statusLine = compactOrderStatusLine(orderStatus)

  return (
    <div className="flex min-h-[24rem] w-full min-w-0 flex-col overflow-hidden rounded-3xl border border-line bg-paper md:min-h-[32rem]">
      <div className="border-b border-line p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar src={avatarUrl} name={displayName} size={48} />
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-xl leading-tight text-ink md:text-2xl">{displayName}</h1>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted">
                <span className="shrink-0 rounded-full border border-line bg-soft px-2.5 py-1">{roleLabel}</span>
                <span className="shrink-0 rounded-full border border-line bg-soft px-2.5 py-1">{conversationStateLabel(conversation.status)}</span>
              </div>
              {statusLine && <div className="mt-2 break-words text-sm text-muted">{statusLine}</div>}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-soft p-3 text-sm text-muted sm:flex-row sm:items-start">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accentDeep" />
          <p className="min-w-0 break-words whitespace-normal">Сигурност: разговорите и плащанията в Totsan са защитени. Не споделяй външни контакти.</p>
        </div>
      </div>

      <div ref={threadBodyRef} className="min-w-0 flex-1 space-y-4 overflow-auto px-4 py-5 md:px-6">
        {visibleMessages.map((message) => (
          <MessageBubble key={message.id} message={{ ...message, body: message.kind === 'system' ? compactSystemText(message.body) : message.body }} userId={userId} conversation={conversation} onOfferAction={onOfferAction} />
        ))}
        {visibleMessages.length === 0 && <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Започни разговора с кратко съобщение.</div>}
      </div>
    </div>
  )
}
