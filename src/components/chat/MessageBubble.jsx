import { AlertTriangle } from 'lucide-react'
import OfferCard from './OfferCard.jsx'
import Avatar from '../Avatar.jsx'
import { compactSystemText, getParticipantDisplayName } from '../../lib/chat.js'

export default function MessageBubble({ message, userId, conversation, onOfferAction }) {
  const own = message.sender_id === userId
  const system = message.kind === 'system'

  if (system) {
    return <div className="mx-auto w-full max-w-full rounded-full border border-line bg-soft px-4 py-2 text-center text-sm text-muted break-words whitespace-normal">{compactSystemText(message.body)}</div>
  }

  const isClient = message.sender_id === conversation.client_id
  const participant = isClient ? conversation.client : conversation.partner
  const avatarUrl = participant?.avatar_url || ''
  const participantName = getParticipantDisplayName(participant)

  return (
    <div className={`flex min-w-0 gap-3 ${own ? 'justify-end' : 'justify-start'}`}>
      {!own && (
        <Avatar src={avatarUrl} name={participantName} size={32} className="mt-1" />
      )}
      <div className={`min-w-0 max-w-[min(36rem,88%)] overflow-hidden rounded-3xl border px-4 py-3 ${own ? 'border-ink bg-ink text-paper' : 'border-line bg-soft text-ink'}`}>
        {message.kind === 'offer' && message.offer ? (
          <OfferCard offer={message.offer} conversation={conversation} userId={userId} onAction={onOfferAction} compact={own} />
        ) : (
          <p className="break-words whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
        )}
        {message.was_masked && (
          <div className={`mt-3 flex min-w-0 items-start gap-2 text-xs ${own ? 'text-paper/70' : 'text-amber-800'}`}>
            <AlertTriangle size={14} /> Част от текста е скрита за сигурност.
          </div>
        )}
        <div className={`mt-2 text-[11px] ${own ? 'text-paper/55' : 'text-muted'}`}>{new Date(message.created_at).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>
  )
}
