import { useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { compactSystemText, formatChatTime, getConversationTitle, getOtherParticipant, isUnread } from '../../lib/chat.js'
import Avatar from '../Avatar.jsx'

export default function ConversationList({ conversations, activeId, userId, statusByConversation, onSelect, onArchive }) {
  const [openMenuId, setOpenMenuId] = useState(null)

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
            <div
              key={conversation.id}
              className={`group relative w-full min-w-0 rounded-2xl border transition ${
                active
                  ? 'border-ink/20 bg-soft shadow-[0_10px_30px_-24px_rgba(15,23,42,0.32)]'
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
                  <div className="min-w-0 flex-1 pr-6">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <span className="min-w-0 truncate font-medium text-ink">{displayName}</span>
                      <span className="shrink-0 text-xs text-muted pr-1">
                        {formatChatTime(conversation.last_message_at || conversation.created_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-2 text-sm text-muted">
                      {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-accentDeep" />}
                      {hasActiveOrder && (
                        <span className="shrink-0 rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] leading-none">
                          Активна
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate">{compactPreview}</span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Three dots actions menu */}
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 flex items-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenuId(openMenuId === conversation.id ? null : conversation.id)
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:bg-line/60 hover:text-ink transition focus-visible:outline-none"
                  aria-label="Опции за разговор"
                >
                  <MoreVertical size={18} />
                </button>

                {openMenuId === conversation.id && (
                  <>
                    {/* Overlay to close menu on click outside */}
                    <div
                      className="fixed inset-0 z-20"
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenuId(null)
                      }}
                    />
                    {/* Dropdown Menu */}
                    <div className="absolute right-0 top-full mt-1.5 z-30 w-44 origin-top-right rounded-xl border border-line bg-paper py-1 shadow-lg ring-1 ring-black/5 focus:outline-none">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(null)
                          onArchive?.(conversation)
                        }}
                        className="flex w-full items-center px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-soft transition"
                      >
                        Архивирай
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(null)
                          onArchive?.(conversation)
                        }}
                        className="flex w-full items-center px-4 py-2.5 text-left text-sm text-muted hover:bg-soft transition"
                      >
                        Скрий от списъка
                      </button>
                    </div>
                  </>
                )}
              </div>
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
