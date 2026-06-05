import { useEffect, useMemo, useRef } from 'react'
import { ShieldCheck } from 'lucide-react'
import MessageBubble from './MessageBubble.jsx'
import Avatar from '../Avatar.jsx'
import { conversationRole } from '../../lib/chat.js'

export default function ChatThread({ conversation, messages, userId, onOfferAction }) {
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
      <div className="flex min-h-[24rem] items-center justify-center rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted md:min-h-[32rem]">
        Избери разговор, за да видиш съобщенията.
      </div>
    )
  }

  const role = conversationRole(conversation, userId)
  const otherParticipant = role === 'client' ? conversation.partner : conversation.client
  const avatarUrl = otherParticipant?.avatar_url || ''
  const participantName = otherParticipant?.display_name || otherParticipant?.full_name || ''
  const fallbackName = role === 'client' ? 'Партньор' : 'Клиент'
  const displayName = participantName || fallbackName

  return (
    <div className="flex min-h-[24rem] flex-col rounded-3xl border border-line bg-paper md:min-h-[32rem]">
      <div className="border-b border-line p-4 md:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar src={avatarUrl} name={displayName} size={48} />
            <div>
              <h1 className="font-display text-xl text-ink leading-tight md:text-2xl">{displayName}</h1>
              <div className="text-sm text-muted">{conversation.subject || 'Разговор в Totsan'}</div>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-line bg-soft px-3 py-1 text-xs text-muted">
            {conversation.status === 'open' ? 'Отворен' : conversation.status}
          </span>
        </div>
        <div className="mt-4 flex gap-3 rounded-2xl border border-line bg-soft p-4 text-sm text-muted">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accentDeep" />
          <p>Сигурност на Totsan: разговори и плащания в платформата са защитени. Не споделяме контакти или външни линкове.</p>
        </div>
      </div>

      <div ref={threadBodyRef} className="flex-1 space-y-4 overflow-auto px-4 py-5 md:px-6">
        {visibleMessages.map((message) => <MessageBubble key={message.id} message={message} userId={userId} conversation={conversation} onOfferAction={onOfferAction} />)}
        {visibleMessages.length === 0 && <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Започни разговора с кратко съобщение.</div>}
      </div>
    </div>
  )
}
