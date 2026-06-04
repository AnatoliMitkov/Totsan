import { formatChatTime, isUnread, conversationRole } from '../../lib/chat.js'
import Avatar from '../Avatar.jsx'

export default function ConversationList({ conversations, activeId, userId, onSelect }) {
  return (
    <div className="rounded-3xl border border-line bg-paper p-3 flex flex-col h-full">
      <div className="px-3 py-3">
        <h2 className="font-display text-2xl text-ink">Съобщения</h2>
      </div>
      <div className="mt-2 flex-1 space-y-1 overflow-auto pr-1 lg:max-h-[calc(100vh-16rem)]">
        {conversations.map((conversation) => {
          const unread = isUnread(conversation, userId)
          const active = conversation.id === activeId
          const role = conversationRole(conversation, userId)
          const otherParticipant = role === 'client' ? conversation.partner : conversation.client
          const avatarUrl = otherParticipant?.avatar_url || ''
          const participantName = otherParticipant?.display_name || otherParticipant?.full_name || ''
          const fallbackName = role === 'client' ? 'Партньор' : 'Клиент'
          const displayName = participantName || conversation.subject || fallbackName

          return (
            <button
              key={conversation.id}
              type="button"
              onClick={() => !active && onSelect(conversation.id)}
              aria-current={active ? 'true' : undefined}
              className={`w-full rounded-2xl border px-3 py-3 text-left transition ${active ? 'border-ink bg-soft' : 'border-transparent hover:border-line hover:bg-soft/70'}`}
            >
              <div className="flex items-center gap-3">
                <Avatar src={avatarUrl} name={displayName} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium text-ink">{displayName}</span>
                    <span className="shrink-0 text-xs text-muted">{formatChatTime(conversation.last_message_at || conversation.created_at)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-sm text-muted">
                    {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-accentDeep" />}
                    <span className="truncate">{conversation.last_message_preview || 'Няма съобщения още.'}</span>
                  </span>
                </span>
              </div>
            </button>
          )
        })}
        {conversations.length === 0 && <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Още няма разговори.</div>}
      </div>
    </div>
  )
}
