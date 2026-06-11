import { useState } from 'react'
import { CheckCircle2, Clock, CreditCard, Layers3, XCircle } from 'lucide-react'
import { conversationRole } from '../../lib/chat.js'
import { formatMoney } from '../../lib/money.js'

export default function OfferCard({ offer, conversation, userId, onAction, compact = false, messageCreatedAt = '' }) {
  const role = conversationRole(conversation, userId)
  const canClientAct = role === 'client' && offer.status === 'sent'
  const canPartnerAct = role === 'partner' && offer.status === 'sent'
  const [withdrawStatus, setWithdrawStatus] = useState('idle')
  const executionMode = offer.execution_mode === 'staged' ? 'staged' : 'single'
  const stages = Array.isArray(offer.stages)
    ? offer.stages
      .filter((stage) => stage && typeof stage === 'object')
      .map((stage, index) => ({
        title: String(stage.title || '').trim(),
        description: String(stage.description || '').trim(),
        order: Number.isFinite(Number(stage.order)) ? Number(stage.order) : index + 1,
      }))
      .filter((stage) => stage.title || stage.description)
      .sort((left, right) => left.order - right.order)
    : []
  const createdLabel = formatOfferTimestamp(offer.created_at || messageCreatedAt)

  async function handleWithdraw() {
    if (!canPartnerAct || withdrawStatus === 'withdrawing') return
    setWithdrawStatus('withdrawing')
    try {
      await onAction?.(offer, 'withdrawn')
    } finally {
      setWithdrawStatus('idle')
    }
  }

  return (
    <div className={`min-w-0 max-w-full ${compact ? 'text-paper' : 'text-ink'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.14em] opacity-70">Оферта</div>
          <h3 className="mt-1 break-words font-display text-2xl leading-tight">{offer.title}</h3>
          {createdLabel && <div className="mt-1 text-[11px] opacity-60">{createdLabel}</div>}
        </div>
        <StatusPill status={offer.status} compact={compact} />
      </div>

      {offer.description && <p className="mt-3 break-words whitespace-pre-wrap text-sm opacity-80">{offer.description}</p>}

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <InlineBadge compact={compact}>
          {executionMode === 'staged' ? 'Поетапно изпълнение' : 'Еднократно изпълнение'}
        </InlineBadge>
        <InlineBadge compact={compact}>Плащането е за цялата оферта.</InlineBadge>
      </div>

      {executionMode === 'staged' && stages.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-current/10 bg-current/5 p-3 sm:p-4">
          <div className="flex min-w-0 items-center gap-2 text-[11px] uppercase tracking-[0.12em] opacity-60">
            <Layers3 size={14} />
            <span>Етапи</span>
          </div>
          <ol className="mt-3 space-y-3">
            {stages.map((stage) => (
              <li key={`${stage.order}-${stage.title}-${stage.description}`} className="flex min-w-0 gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-current/10 text-xs font-semibold">
                  {stage.order}
                </span>
                <div className="min-w-0">
                  <div className="break-words text-sm font-medium">{stage.title || `Етап ${stage.order}`}</div>
                  {stage.description && <p className="mt-1 break-words whitespace-pre-wrap text-sm opacity-75">{stage.description}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {Array.isArray(offer.deliverables) && offer.deliverables.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-current/10 bg-current/5 p-3 sm:p-4">
          <div className="text-[11px] uppercase tracking-[0.12em] opacity-60">Какво включва</div>
          <ul className="mt-3 space-y-2 text-sm">
            {offer.deliverables.map((item, index) => (
              <li key={`${item}-${index}`} className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current/10">
                  <CheckCircle2 size={13} className="opacity-80" />
                </span>
                <span className="min-w-0 break-words whitespace-normal">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Info icon={CreditCard} label="Обща цена" value={offer.price_amount ? formatMoney(offer.price_amount, 'EUR') : 'По уговорка'} />
        <Info icon={Clock} label="Срок" value={offer.delivery_days ? `${offer.delivery_days} дни` : 'По уговорка'} />
      </div>

      {(canClientAct || canPartnerAct) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {canClientAct && <button type="button" onClick={() => onAction?.(offer, 'accepted')} className="btn btn-primary !py-2 text-sm">Приеми и плати</button>}
          {canClientAct && <button type="button" onClick={() => onAction?.(offer, 'declined')} className="btn btn-ghost !py-2 text-sm"><XCircle size={17} /> Откажи</button>}
          {canPartnerAct && (
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={withdrawStatus === 'withdrawing'}
              className="btn btn-ghost w-full justify-center border border-line bg-paper !px-5 !py-3 text-sm font-semibold text-ink shadow-sm transition hover:border-ink hover:bg-ink hover:text-paper disabled:cursor-wait disabled:opacity-70 sm:w-auto"
            >
              {withdrawStatus === 'withdrawing' ? 'Изтегля се...' : 'Изтегли офертата'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Info({ icon: Icon, label, value }) {
  return <div className="min-w-0 rounded-2xl border border-current/15 px-3 py-2"><Icon size={15} className="opacity-70" /><div className="mt-1 text-[11px] uppercase tracking-[0.12em] opacity-60">{label}</div><div className="break-words text-sm font-medium">{value}</div></div>
}

function InlineBadge({ compact, children }) {
  return (
    <span className={`max-w-full rounded-full border px-3 py-1.5 ${compact ? 'border-paper/20 bg-paper/10 text-paper/85' : 'border-line bg-paper text-muted'}`}>
      <span className="break-words whitespace-normal">{children}</span>
    </span>
  )
}

function StatusPill({ status, compact }) {
  const labels = { sent: 'Изпратена', accepted: 'Приета', declined: 'Отказана', withdrawn: 'Изтеглена', expired: 'Изтекла', draft: 'Чернова' }
  return <span className={`max-w-full rounded-full border px-3 py-1 text-xs ${compact ? 'border-paper/30 text-paper/80' : 'border-line bg-paper text-muted'}`}>{labels[status] || status}</span>
}

function formatOfferTimestamp(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('bg-BG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
