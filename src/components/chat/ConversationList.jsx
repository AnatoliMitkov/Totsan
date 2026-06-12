import { compactSystemText, formatChatTime, getConversationTitle, getOtherParticipant, isUnread } from '../../lib/chat.js'
import Avatar from '../Avatar.jsx'

export default function ConversationList({ conversations, activeId, userId, statusByConversation, onSelect }) {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-3xl border border-line bg-paper p-3 lg:p-3.5">
      <div className="min-w-0 border-b border-line/80 px-2.5 py-2.5">
        <h2 className="break-words font-display text-2xl text-ink">Съобщения</h2>
      </div>
      <div className="min-h-0 min-w-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden pt-2 pr-1 max-lg:max-h-[36svh]">
        {conversations.map((conversation) => {
          const unread = isUnread(conversation, userId)
          const active = conversation.id === activeId
          const otherParticipant = getOtherParticipant(conversation, userId)
          const avatarUrl = otherParticipant?.avatar_url || ''
          const avatarCandidates = otherParticipant?.avatar_candidates || []
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
              className={`w-full min-w-0 rounded-2xl border px-3.5 py-3 text-left transition ${active ? 'border-ink/20 bg-soft shadow-[0_10px_30px_-24px_rgba(15,23,42,0.32)]' : 'border-transparent hover:border-line hover:bg-soft/70'}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar src={avatarUrl} srcCandidates={avatarCandidates} name={displayName} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-medium text-ink">{displayName}</span>
                    <span className="shrink-0 text-xs text-muted">{formatChatTime(conversation.last_message_at || conversation.created_at)}</span>
                  </div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-2 text-sm text-muted">
                    {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-accentDeep" />}
                    {hasActiveOrder && <span className="shrink-0 rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] leading-none">Активна</span>}
                    <span className="min-w-0 flex-1 truncate">{compactPreview}</span>
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
