import { compactSystemText, formatChatTime, getConversationTitle, getOtherParticipant, isUnread } from '../../lib/chat.js'
import Avatar from '../Avatar.jsx'

export default function ConversationList({ conversations, activeId, userId, statusByConversation, onSelect }) {
  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden rounded-3xl border border-line bg-paper p-3">
      <div className="min-w-0 px-3 py-3">
        <h2 className="break-words font-display text-2xl text-ink">Съобщения</h2>
      </div>
      <div className="mt-2 min-w-0 flex-1 space-y-1 overflow-auto pr-1 lg:max-h-[calc(100vh-16rem)]">
        {conversations.map((conversation) => {
          const unread = isUnread(conversation, userId)
          const active = conversation.id === activeId
          const otherParticipant = getOtherParticipant(conversation, userId)
          const avatarUrl = otherParticipant?.avatar_url || ''
          const displayName = getConversationTitle(conversation, userId)
          const compactPreview = compactSystemText(conversation.last_message_preview || 'Няма съобщения още.')
          const latestOrder = statusByConversation?.get?.(conversation.id)
          const hasActiveOrder = latestOrder && ['paid', 'in_progress', 'delivered', 'completed'].includes(latestOrder.status)

          return (
            <button
              key={conversation.id}
              type="button"
              onClick={() => !active && onSelect(conversation.id)}
              aria-current={active ? 'true' : undefined}
              className={`w-full min-w-0 rounded-2xl border px-3 py-3 text-left transition ${active ? 'border-ink bg-soft' : 'border-transparent hover:border-line hover:bg-soft/70'}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar src={avatarUrl} name={displayName} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-medium text-ink">{displayName}</span>
                    <span className="shrink-0 text-xs text-muted">{formatChatTime(conversation.last_message_at || conversation.created_at)}</span>
                  </div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-2 text-sm text-muted">
                    {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-accentDeep" />}
                    {hasActiveOrder && <span className="shrink-0 rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] leading-none">Активна</span>}
                    <span className="min-w-0 truncate">{compactPreview}</span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
        {conversations.length === 0 && <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Още няма разговори.</div>}
      </div>
    </div>
  )
}
