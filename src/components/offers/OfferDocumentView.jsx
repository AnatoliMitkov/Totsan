import { CalendarDays, CheckCircle2, CreditCard, Layers3 } from 'lucide-react'
import { formatEurWithBgn } from '../../lib/money.js'
import {
  MATERIAL_MODE_LABELS,
  OFFER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PRICE_TYPE_LABELS,
  STATUS_LABELS,
  VAT_LABELS,
  normalizeAcceptedOffer,
} from '../../lib/offers.js'

export default function OfferDocumentView({ offer, compact = false, showStatus = true, showConditions = true }) {
  const document = offer?.source ? offer : normalizeAcceptedOffer(offer)
  const tone = compact ? 'text-paper' : 'text-ink'
  const panel = compact ? 'border-paper/15 bg-paper/10' : 'border-line bg-soft/60'
  const badge = compact ? 'border-paper/20 bg-paper/10 text-paper/85' : 'border-line bg-paper text-muted'
  const priceLabel = document.priceAmount > 0 ? formatEurWithBgn(document.priceAmount) : 'По уточнение'
  const timelineLabel = document.timeline.days > 0 ? `${document.timeline.days} работни дни` : 'По уточнение'

  return (
    <article className={`min-w-0 ${tone}`}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[0.14em] opacity-60">{OFFER_TYPE_LABELS[document.offerType] || 'Оферта'}</div>
          <h3 className="mt-1 break-words font-display text-2xl leading-tight">{document.title || 'Нова оферта'}</h3>
        </div>
        {showStatus && document.status && (
          <span className={`w-fit rounded-full border px-3 py-1 text-xs ${badge}`}>{STATUS_LABELS[document.status] || document.status}</span>
        )}
      </header>

      {document.summary && <p className="mt-3 break-words whitespace-pre-wrap text-sm leading-6 opacity-80">{document.summary}</p>}

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Badge className={badge}>{PRICE_TYPE_LABELS[document.priceType] || 'Цена по оферта'}</Badge>
        {document.materialsMode && <Badge className={badge}>{MATERIAL_MODE_LABELS[document.materialsMode] || document.materialsMode}</Badge>}
        {document.vatStatus && <Badge className={badge}>{VAT_LABELS[document.vatStatus] || document.vatStatus}</Badge>}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Fact icon={CreditCard} label="Обща цена" value={priceLabel} className={panel} />
        <Fact icon={CalendarDays} label="Срок" value={timelineLabel} className={panel} />
      </div>

      {(document.validUntil || document.timeline.earliestStartDate || document.timeline.dependencies) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {document.validUntil && <MiniFact label="Валидна до" value={formatDate(document.validUntil)} className={panel} />}
          {document.timeline.earliestStartDate && <MiniFact label="Най-ранен старт" value={formatDate(document.timeline.earliestStartDate)} className={panel} />}
          {document.timeline.dependencies && <MiniFact label="Зависимости" value={document.timeline.dependencies} className={panel} />}
        </div>
      )}

      {document.stages.length > 0 && (
        <Section title="Етапи" icon={Layers3} className={panel}>
          <ol className="space-y-3">
            {document.stages.map((stage) => (
              <li key={`${stage.order}-${stage.title}`} className="flex min-w-0 gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-current/10 text-xs font-semibold">{stage.order}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2 text-sm font-semibold">
                    <span className="break-words">{stage.title || `Етап ${stage.order}`}</span>
                    {stage.priceAmount > 0 && <span>{formatEurWithBgn(stage.priceAmount)}</span>}
                  </div>
                  {stage.description && <p className="mt-1 break-words whitespace-pre-wrap text-sm opacity-75">{stage.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-70">
                    {stage.durationDays > 0 && <span>{stage.durationDays} работни дни</span>}
                    {stage.startCondition && <span>Старт: {stage.startCondition}</span>}
                    {stage.payment && <span>{stage.payment}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {document.includedItems.length > 0 && (
        <Section title="Включено" className={panel}>
          <ul className="space-y-2 text-sm">
            {document.includedItems.map((item, index) => (
              <li key={`${item}-${index}`} className="flex min-w-0 items-start gap-2.5">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accentDeep" />
                <span className="break-words">{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(document.excludedItems.length > 0 || document.clientRequirements.length > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {document.excludedItems.length > 0 && <TextList title="Не е включено" items={document.excludedItems} className={panel} />}
          {document.clientRequirements.length > 0 && <TextList title="Клиентът осигурява" items={document.clientRequirements} className={panel} />}
        </div>
      )}

      {(document.payment.method || document.payment.terms || document.payment.notes) && (
        <Section title="Плащане" icon={CreditCard} className={panel}>
          {document.payment.method && <div className="text-sm font-semibold">{PAYMENT_METHOD_LABELS[document.payment.method] || document.payment.method}</div>}
          {document.payment.terms && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 opacity-80">{document.payment.terms}</p>}
          {document.payment.notes && <p className="mt-2 whitespace-pre-wrap text-sm opacity-70">{document.payment.notes}</p>}
        </Section>
      )}

      {showConditions && (document.conditions.scopeChanges || document.conditions.cancellation || document.conditions.unforeseenWork) && (
        <Section title="Условия" className={panel}>
          <dl className="space-y-3 text-sm">
            <Condition label="Промени в обхвата" value={document.conditions.scopeChanges} />
            <Condition label="Отказ и анулиране" value={document.conditions.cancellation} />
            <Condition label="Непредвидена работа" value={document.conditions.unforeseenWork} />
          </dl>
        </Section>
      )}
    </article>
  )
}

function Badge({ className, children }) {
  return <span className={`max-w-full rounded-full border px-3 py-1.5 ${className}`}>{children}</span>
}

function Fact({ icon: Icon, label, value, className }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${className}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] opacity-60"><Icon size={15} />{label}</div>
      <div className="mt-1 break-words text-sm font-semibold">{value}</div>
    </div>
  )
}

function MiniFact({ label, value, className }) {
  return (
    <div className={`rounded-2xl border px-3 py-2 ${className}`}>
      <div className="text-[10px] uppercase tracking-[0.12em] opacity-55">{label}</div>
      <div className="mt-1 break-words text-xs font-semibold">{value}</div>
    </div>
  )
}

function Section({ title, icon: Icon, className, children }) {
  return (
    <section className={`mt-4 rounded-2xl border p-4 ${className}`}>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] opacity-60">{Icon && <Icon size={14} />}{title}</div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function TextList({ title, items, className }) {
  return (
    <Section title={title} className={className}>
      <ul className="space-y-2 text-sm opacity-80">{items.map((item, index) => <li key={`${item}-${index}`} className="break-words">{item}</li>)}</ul>
    </Section>
  )
}

function Condition({ label, value }) {
  if (!value) return null
  return <div><dt className="font-semibold">{label}</dt><dd className="mt-1 whitespace-pre-wrap leading-6 opacity-75">{value}</dd></div>
}

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value || '')
  return new Intl.DateTimeFormat('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}
