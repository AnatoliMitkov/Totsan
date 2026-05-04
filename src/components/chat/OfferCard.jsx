import { CheckCircle2, Clock, CreditCard, RotateCcw, XCircle } from 'lucide-react'
import { conversationRole } from '../../lib/chat.js'

export default function OfferCard({ offer, conversation, userId, onAction, compact = false }) {
  const role = conversationRole(conversation, userId)
  const canClientAct = role === 'client' && offer.status === 'sent'
  const canPartnerAct = role === 'partner' && offer.status === 'sent'

  return (
    <div className={`${compact ? 'text-paper' : 'text-ink'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.14em] opacity-70">Оферта</div>
          <h3 className="mt-1 font-display text-2xl">{offer.title}</h3>
        </div>
        <StatusPill status={offer.status} compact={compact} />
      </div>

      {offer.description && <p className="mt-3 whitespace-pre-wrap text-sm opacity-80">{offer.description}</p>}
      {Array.isArray(offer.deliverables) && offer.deliverables.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          {offer.deliverables.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /> <span>{item}</span></li>)}
        </ul>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Info icon={CreditCard} label="Цена" value={offer.price_amount ? `${offer.price_amount} ${offer.currency || 'EUR'}` : 'По уговорка'} />
        <Info icon={Clock} label="Срок" value={offer.delivery_days ? `${offer.delivery_days} дни` : 'По уговорка'} />
        <Info icon={RotateCcw} label="Ревизии" value={offer.revisions ?? '—'} />
      </div>

      {(canClientAct || canPartnerAct) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {canClientAct && <button type="button" onClick={() => onAction?.(offer, 'accepted')} className="btn btn-primary !py-2 text-sm">Приеми и плати</button>}
          {canClientAct && <button type="button" onClick={() => onAction?.(offer, 'declined')} className="btn btn-ghost !py-2 text-sm"><XCircle size={17} /> Откажи</button>}
          {canPartnerAct && <button type="button" onClick={() => onAction?.(offer, 'withdrawn')} className="btn btn-ghost !py-2 text-sm">Изтегли</button>}
        </div>
      )}
    </div>
  )
}

function Info({ icon: Icon, label, value }) {
  return <div className="rounded-2xl border border-current/15 px-3 py-2"><Icon size={15} className="opacity-70" /><div className="mt-1 text-[11px] uppercase tracking-[0.12em] opacity-60">{label}</div><div className="text-sm font-medium">{value}</div></div>
}

function StatusPill({ status, compact }) {
  const labels = { sent: 'Изпратена', accepted: 'Приета', declined: 'Отказана', withdrawn: 'Изтеглена', expired: 'Изтекла', draft: 'Чернова' }
  return <span className={`rounded-full border px-3 py-1 text-xs ${compact ? 'border-paper/30 text-paper/80' : 'border-line bg-paper text-muted'}`}>{labels[status] || status}</span>
}