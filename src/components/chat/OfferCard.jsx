import { useState } from 'react'
import { CheckCircle2, Clock, CreditCard, HelpCircle, Layers3, PenLine, ShieldCheck, XCircle } from 'lucide-react'
import { conversationRole } from '../../lib/chat.js'
import { formatEurWithBgn } from '../../lib/money.js'
import OfferDocumentView from '../offers/OfferDocumentView.jsx'

export default function OfferCard({ offer, conversation, userId, onAction, compact = false, messageCreatedAt = '' }) {
  const role = conversationRole(conversation, userId)
  const providerName = conversation?.partner?.name || conversation?.partner?.display_name || 'Партньорът в разговора'
  const canClientAct = role === 'client' && offer.status === 'sent'
  const canPartnerAct = role === 'partner' && offer.status === 'sent'
  const [withdrawStatus, setWithdrawStatus] = useState('idle')
  const createdLabel = formatOfferTimestamp(offer.created_at || messageCreatedAt)
  const validUntil = offer.valid_until || offer.expires_at || ''
  const timelineDays = offer.delivery_days || 0
  const summary = offer.summary || ''
  const priceAmount = offer.price_amount || 0
  const title = offer.title || 'Оферта'

  async function handleWithdraw() {
    if (!canPartnerAct || withdrawStatus === 'withdrawing') return
    setWithdrawStatus('withdrawing')
    try { await onAction?.(offer, 'withdrawn') } finally { setWithdrawStatus('idle') }
  }

  return (
    <div className={`min-w-0 max-w-full ${compact ? 'text-paper' : 'text-ink'}`}>
      {/* Compact inline card in chat bubble */}
      <div className={`rounded-3xl border p-5 ${compact ? 'border-paper/10 bg-paper/5' : 'border-line bg-paper'}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.14em] opacity-60">Оферта</div>
            <h3 className="mt-1 break-words font-display text-xl leading-tight">{title}</h3>
            {createdLabel && <div className="mt-1 text-[11px] opacity-50">{createdLabel}</div>}
          </div>
          <StatusPill status={offer.status} compact={compact} />
        </div>

        {summary && <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-relaxed opacity-80">{summary}</p>}

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Badge compact={compact}>{offer.offer_type === 'staged' ? 'Поетапна оферта' : 'Финална оферта'}</Badge>
          <Badge compact={compact}>{offer.price_type === 'staged' ? 'По етапи' : 'Фиксирана цена'}</Badge>
          <Badge compact={compact}>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Плащане през Totsan</span>
          </Badge>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Info icon={CreditCard} label="Цена" value={priceAmount ? formatEurWithBgn(priceAmount) : 'По уточнение'} />
          <Info icon={Clock} label="Срок" value={timelineDays ? `${timelineDays} работни дни` : 'По уточнение'} />
        </div>

        {(validUntil || timelineDays) && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {validUntil && <MiniFact label="Валидна до" value={formatDate(validUntil)} />}
            {offer.timeline?.earliestStartDate && <MiniFact label="Най-ранен старт" value={formatDate(offer.timeline.earliestStartDate)} />}
          </div>
        )}

        {canClientAct && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => onAction?.(offer, 'accepted')} className="btn btn-primary !py-2 text-sm">Приеми офертата</button>
            <button type="button" onClick={() => onAction?.(offer, 'question')} className="btn btn-ghost !py-2 text-sm"><HelpCircle size={17} /> Попитай</button>
            <button type="button" onClick={() => onAction?.(offer, 'change_requested')} className="btn btn-ghost !py-2 text-sm"><PenLine size={17} /> Поискай промяна</button>
            <button type="button" onClick={() => onAction?.(offer, 'declined')} className="btn btn-ghost !py-2 text-sm"><XCircle size={17} /> Откажи</button>
          </div>
        )}
        {canPartnerAct && (
          <button type="button" onClick={handleWithdraw} disabled={withdrawStatus === 'withdrawing'}
            className="btn btn-ghost w-full justify-center border border-line bg-paper !px-5 !py-3 text-sm font-semibold text-ink shadow-sm transition hover:border-ink hover:bg-ink hover:text-paper disabled:opacity-70 sm:w-auto">
            {withdrawStatus === 'withdrawing' ? 'Изтегля се...' : 'Изтегли офертата'}
          </button>
        )}
      </div>
    </div>
  )
}

function Badge({ compact, children }) {
  return (
    <span className={`rounded-full border px-3 py-1.5 ${compact ? 'border-paper/20 bg-paper/10 text-paper/85' : 'border-line bg-paper text-muted'}`}>
      <span className="break-words whitespace-normal">{children}</span>
    </span>
  )
}

function StatusPill({ status, compact }) {
  const labels = {
    draft: 'Чернова', sent: 'Изпратена', viewed: 'Видяна', question: 'Има въпрос',
    accepted: 'Приета', declined: 'Отказана', withdrawn: 'Изтеглена', expired: 'Изтекла', change_requested: 'Искана промяна',
  }
  return <span className={`rounded-full border px-3 py-1 text-xs ${compact ? 'border-paper/30 text-paper/80' : 'border-line bg-paper text-muted'}`}>{labels[status] || status}</span>
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0 rounded-2xl border border-current/15 px-3 py-2">
      <Icon size={15} className="opacity-70" />
      <div className="mt-1 text-[11px] uppercase tracking-[0.12em] opacity-60">{label}</div>
      <div className="break-words text-sm font-semibold">{value}</div>
    </div>
  )
}

function MiniFact({ label, value }) {
  return (
    <div className="min-w-0 rounded-2xl border border-current/10 bg-current/5 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.12em] opacity-55">{label}</div>
      <div className="mt-1 break-words text-xs font-semibold">{value}</div>
    </div>
  )
}

function formatOfferTimestamp(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}
