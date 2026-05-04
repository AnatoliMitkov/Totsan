import { MessageCircle } from 'lucide-react'
import { formatChatTime, isUnread } from '../../lib/chat.js'

export default function ConversationList({ conversations, activeId, userId, onSelect }) {
  return (
    <div className="rounded-3xl border border-line bg-paper p-3">
      <div className="px-3 py-3">
        <div className="eyebrow">Разговори</div>
        <h2 className="mt-2 font-display text-3xl text-ink">Съобщения</h2>
      </div>
      <div className="mt-2 max-h-[calc(100vh-16rem)] space-y-1 overflow-auto pr-1">
        {conversations.map((conversation) => {
          const unread = isUnread(conversation, userId)
          const active = conversation.id === activeId
          return (
            <button key={conversation.id} type="button" onClick={() => onSelect(conversation.id)} className={`w-full rounded-2xl border px-4 py-4 text-left transition ${active ? 'border-ink bg-soft' : 'border-transparent hover:border-line hover:bg-soft/70'}`}>
              <div className="flex items-start gap-3">
                <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-paper"><MessageCircle size={17} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="truncate font-medium text-ink">{conversation.subject || 'Разговор в Totsan'}</span>
                    <span className="shrink-0 text-xs text-muted">{formatChatTime(conversation.last_message_at || conversation.created_at)}</span>
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-sm text-muted">
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