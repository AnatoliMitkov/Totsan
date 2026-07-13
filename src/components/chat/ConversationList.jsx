import { compactSystemText, formatChatTime, getConversationTitle, getOtherParticipant, isUnread } from '../../lib/chat.js'
import Avatar from '../Avatar.jsx'

export default function ConversationList({ conversations, activeId, userId, statusByConversation, onSelect }) {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-none border-0 bg-paper p-2.5 sm:rounded-3xl sm:border sm:border-line lg:p-3.5">
      <div className="min-w-0 border-b border-line/80 px-2.5 py-2.5">
        <h2 className="break-words font-display text-2xl text-ink">Съобщения</h2>
      </div>
      <div className="min-h-0 min-w-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 pr-1">
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
          const contextLine = getConversationContextLine(conversation)

          return (
            <div
              key={conversation.id}
              className={`group relative w-full min-w-0 rounded-2xl border transition ${
                active
                  ? 'border-accentDeep/25 bg-accentSoft/70 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.32)]'
                  : unread
                    ? 'border-accentDeep/15 bg-soft/80 hover:border-accentDeep/25'
                    : 'border-transparent hover:border-line hover:bg-soft/70'
              }`}
            >
              <button
                type="button"
                onClick={() => !active && onSelect(conversation.id)}
                aria-current={active ? 'true' : undefined}
                className="w-full text-left focus:outline-none px-3.5 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar src={avatarUrl} srcCandidates={avatarCandidates} name={displayName} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <span className={`min-w-0 truncate text-ink ${unread ? 'font-semibold' : 'font-medium'}`}>{displayName}</span>
                      <span className={`shrink-0 pr-1 text-xs ${unread ? 'font-medium text-accentDeep' : 'text-muted'}`}>
                        {formatChatTime(conversation.last_message_at || conversation.created_at)}
                      </span>
                    </div>
                    {contextLine && (
                      <div className="mt-0.5 min-w-0 truncate text-xs text-muted">{contextLine}</div>
                    )}
                    <div className="mt-0.5 flex min-w-0 items-center gap-2 text-sm text-muted">
                      {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-accentDeep" />}
                      {hasActiveOrder && (
                        <span className="shrink-0 rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] leading-none">
                          Активна
                        </span>
                      )}
                      <span className={`min-w-0 flex-1 truncate ${unread ? 'font-medium text-ink' : ''}`}>{compactPreview}</span>
                    </div>
                  </div>
                </div>
              </button>

            </div>
          )
        })}
        {conversations.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Още няма разговори.
          </div>
        )}
      </div>
    </div>
  )
}

function getConversationContextLine(conversation) {
  const projectTitle = String(conversation?.sharedProject?.title || '').trim()
  if (projectTitle) return projectTitle
  return String(conversation?.subject || '').trim()
}
