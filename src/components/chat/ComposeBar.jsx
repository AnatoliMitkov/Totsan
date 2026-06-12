import { CornerUpLeft, Send, Sparkles, X } from 'lucide-react'
import { compactSystemText, getParticipantDisplayName } from '../../lib/chat.js'

export default function ComposeBar({
  value,
  onChange,
  onSubmit,
  canSendOffer,
  onOpenOffer,
  replyTarget,
  onClearReply,
  conversation,
  status,
}) {
  const disabled = status === 'sending'
  const replyPreview = buildReplyPreview(replyTarget, conversation)

  return (
    <form
      onSubmit={onSubmit}
      className="w-full min-w-0 shrink-0 rounded-3xl border border-line bg-paper/95 px-3 py-3 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.4)] backdrop-blur-sm md:px-4 md:py-3.5"
    >
      <div className="mx-auto flex min-w-0 max-w-5xl flex-col gap-3">
        {replyPreview && (
          <div className="flex min-w-0 items-start justify-between gap-3 rounded-2xl border border-line bg-soft/92 px-3 py-2.5 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.35)]">
            <div className="flex min-w-0 items-start gap-2.5">
              <div className="mt-0.5 rounded-full border border-line bg-paper p-1.5 text-muted">
                <CornerUpLeft size={14} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium uppercase tracking-[0.12em] text-muted">
                  Отговор до {replyPreview.senderLabel}
                </div>
                <div className="mt-1 break-words text-sm leading-relaxed text-ink/85 [overflow-wrap:anywhere]">
                  {replyPreview.body}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClearReply}
              className="rounded-full border border-transparent p-1.5 text-muted transition hover:border-line hover:bg-paper hover:text-ink"
              aria-label="Премахни отговора"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end">
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={2}
            disabled={disabled}
            placeholder="Напиши съобщение..."
            className="min-h-[3.4rem] min-w-0 w-full flex-1 resize-none rounded-2xl border border-line bg-soft/95 px-4 py-3 text-sm outline-none transition placeholder:text-muted/80 focus:border-ink disabled:cursor-not-allowed disabled:opacity-70"
          />
          <div
            className={`grid min-w-0 gap-2 md:flex md:w-auto md:pb-1 ${canSendOffer ? 'grid-cols-2' : 'grid-cols-1'}`}
          >
            {canSendOffer && (
              <button
                type="button"
                onClick={onOpenOffer}
                disabled={disabled}
                className="btn btn-ghost w-full justify-center !py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles size={17} /> Оферта
              </button>
            )}
            <button
              disabled={disabled || !value.trim()}
              className="btn btn-primary w-full justify-center !py-3 text-sm disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Send size={17} /> {disabled ? 'Изпращане...' : 'Изпрати'}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

function buildReplyPreview(replyTarget, conversation) {
  if (!replyTarget?.id) return null

  const sender = replyTarget.sender_id === conversation?.client_id
    ? conversation?.client
    : replyTarget.sender_id === conversation?.partner_id
      ? conversation?.partner
      : null

  return {
    senderLabel: getParticipantDisplayName(sender, 'Потребител'),
    body: formatReplySnippet(replyTarget),
  }
}

function formatReplySnippet(message) {
  if (!message) return 'Съобщението не е налично'
  if (message.kind === 'offer') return 'Оферта'
  if (message.kind === 'system') return compactSystemText(message.body || '')

  const text = String(message.body || '').trim()
  if (!text) return 'Съобщението не е налично'
  return text.length > 160 ? `${text.slice(0, 157)}...` : text
}
