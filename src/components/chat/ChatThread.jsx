import { useEffect, useRef } from 'react'
import { ShieldCheck } from 'lucide-react'
import MessageBubble from './MessageBubble.jsx'

export default function ChatThread({ conversation, messages, userId, onOfferAction }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, conversation?.id])

  if (!conversation) {
    return (
      <div className="flex min-h-[32rem] items-center justify-center rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">
        Избери разговор, за да видиш съобщенията.
      </div>
    )
  }

  return (
    <div className="flex min-h-[32rem] flex-col rounded-3xl border border-line bg-paper">
      <div className="border-b border-line p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="eyebrow">Активен чат</div>
            <h1 className="mt-2 font-display text-3xl text-ink">{conversation.subject || 'Разговор в Totsan'}</h1>
          </div>
          <span className="rounded-full border border-line bg-soft px-3 py-1 text-xs text-muted">{conversation.status === 'open' ? 'Отворен' : conversation.status}</span>
        </div>
        <div className="mt-4 flex gap-3 rounded-2xl border border-line bg-soft p-4 text-sm text-muted">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accentDeep" />
          <p>Сигурност на Totsan: разговори и плащания в платформата са защитени. Не споделяме контакти или външни линкове.</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-auto px-4 py-5 md:px-6">
        {messages.map((message) => <MessageBubble key={message.id} message={message} userId={userId} conversation={conversation} onOfferAction={onOfferAction} />)}
        {messages.length === 0 && <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Започни разговора с кратко съобщение.</div>}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}