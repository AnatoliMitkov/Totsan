import { BadgeCheck, CalendarDays, CheckCircle2, ChevronDown, CircleMinus, CreditCard, Layers3, ReceiptText, ScanSearch, UserRound } from 'lucide-react'
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
  const panel = compact ? 'border-paper/18 bg-paper/10' : 'border-line bg-soft/60'
  const subtlePanel = compact ? 'border-paper/14 bg-paper/[0.07]' : 'border-line bg-paper'
  const badge = compact ? 'border-paper/22 bg-paper/10 text-paper/90' : 'border-line bg-paper text-muted'
  const OfferTypeIcon = offerTypeIcon(document.offerType)
  const priceLabel = document.priceAmount > 0 ? formatEurWithBgn(document.priceAmount) : 'По уточнение'
  const timelineLabel = document.timeline.days > 0 ? `${document.timeline.days} работни дни` : 'По уточнение'
  const hasAgreementDetails = Boolean(
    document.payment.method
    || document.payment.terms
    || document.payment.notes
    || (showConditions && (document.conditions.scopeChanges || document.conditions.cancellation || document.conditions.unforeseenWork)),
  )

  return (
    <article className={`min-w-0 ${tone}`}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] opacity-60">
            <OfferTypeIcon size={15} strokeWidth={2.1} aria-hidden="true" />
            <span>{OFFER_TYPE_LABELS[document.offerType] || 'Оферта'}</span>
          </div>
          <h3 className="mt-1 break-words font-display text-[1.7rem] leading-[1.05] sm:text-3xl">{document.title || 'Нова оферта'}</h3>
        </div>
        {showStatus && document.status && (
          <span className={`w-fit rounded-full border px-3 py-1.5 text-xs font-medium ${compact ? badge : statusTone(document.status)}`}>{STATUS_LABELS[document.status] || document.status}</span>
        )}
      </header>

      {document.summary && <p className="mt-3 break-words whitespace-pre-wrap text-sm leading-6 opacity-80">{document.summary}</p>}

      <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
        <Badge className={badge}><strong className="font-semibold">Тип цена:</strong> {PRICE_TYPE_LABELS[document.priceType] || 'Цена по оферта'}</Badge>
        {document.materialsMode && <Badge className={badge}><strong className="font-semibold">Материали:</strong> {MATERIAL_MODE_LABELS[document.materialsMode] || document.materialsMode}</Badge>}
        {document.vatStatus && <Badge className={badge}><strong className="font-semibold">ДДС:</strong> {VAT_LABELS[document.vatStatus] || document.vatStatus}</Badge>}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Fact icon={CreditCard} label="Обща цена" value={priceLabel} className={panel} prominent />
        <Fact icon={CalendarDays} label="Срок" value={timelineLabel} className={panel} />
      </div>

      {(document.validUntil || document.timeline.earliestStartDate || document.timeline.dependencies) && (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {document.validUntil && <MiniFact label="Валидна до" value={formatDate(document.validUntil)} className={subtlePanel} />}
          {document.timeline.earliestStartDate && <MiniFact label="Най-ранен старт" value={formatDate(document.timeline.earliestStartDate)} className={subtlePanel} />}
          {document.timeline.dependencies && <MiniFact label="Зависи от" value={document.timeline.dependencies} className={subtlePanel} />}
        </div>
      )}

      {document.stages.length > 0 && (
        <Section title="Етапи" icon={Layers3} className={panel}>
          <ol className="space-y-2.5">
            {document.stages.map((stage) => (
              <li key={`${stage.order}-${stage.title}`} className={`min-w-0 rounded-xl border p-3 ${subtlePanel}`}>
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${compact ? 'bg-paper/14 text-paper' : 'bg-ink text-paper'}`}>{stage.order}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2 text-sm font-semibold">
                      <span className="break-words">{stage.title || `Етап ${stage.order}`}</span>
                      {stage.priceAmount > 0 && <span className="shrink-0">{formatEurWithBgn(stage.priceAmount)}</span>}
                    </div>
                    {stage.description && <p className="mt-1 break-words whitespace-pre-wrap text-sm leading-5 opacity-75">{stage.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-70">
                      {stage.durationDays > 0 && <span>{stage.durationDays} работни дни</span>}
                      {stage.startCondition && <span>Старт: {stage.startCondition}</span>}
                      {stage.payment && <span>{stage.payment}</span>}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {document.includedItems.length > 0 && (
        <Section title="Какво е включено" className={panel}>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {document.includedItems.map((item, index) => (
              <li key={`${item}-${index}`} className="flex min-w-0 items-start gap-2.5">
                <CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${compact ? 'text-paper/80' : 'text-accentDeep'}`} />
                <span className="break-words">{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(document.excludedItems.length > 0 || document.clientRequirements.length > 0) && (
        <Section title="Граници на обхвата" className={panel}>
          <div className="grid gap-3 md:grid-cols-2">
            {document.excludedItems.length > 0 && <TextList title="Не е включено" icon={CircleMinus} items={document.excludedItems} className={subtlePanel} />}
            {document.clientRequirements.length > 0 && <TextList title="Клиентът осигурява" icon={UserRound} items={document.clientRequirements} className={subtlePanel} />}
          </div>
        </Section>
      )}

      {hasAgreementDetails && (
        <details className={`group mt-4 rounded-2xl border ${panel}`} defaultOpen={showConditions}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-accent/10">
            <ReceiptText size={16} className="shrink-0 opacity-70" />
            Плащане и условия
            <ChevronDown size={17} className="ml-auto shrink-0 opacity-60 transition group-open:rotate-180" />
          </summary>
          <div className={`space-y-4 border-t px-4 pb-4 pt-4 ${compact ? 'border-paper/14' : 'border-line'}`}>
            {(document.payment.method || document.payment.terms || document.payment.notes) && (
              <div className={`rounded-xl border p-3 ${subtlePanel}`}>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-60">Плащане</div>
                {document.payment.method && <div className="mt-2 text-sm font-semibold">{PAYMENT_METHOD_LABELS[document.payment.method] || document.payment.method}</div>}
                {document.payment.terms && <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 opacity-80">{document.payment.terms}</p>}
                {document.payment.notes && <p className="mt-1.5 whitespace-pre-wrap text-sm opacity-70">{document.payment.notes}</p>}
              </div>
            )}
            {showConditions && (document.conditions.scopeChanges || document.conditions.cancellation || document.conditions.unforeseenWork) && (
              <dl className="space-y-3 text-sm">
                <Condition label="Промени в обхвата" value={document.conditions.scopeChanges} />
                <Condition label="Отказ и анулиране" value={document.conditions.cancellation} />
                <Condition label="Непредвидена работа" value={document.conditions.unforeseenWork} />
              </dl>
            )}
          </div>
        </details>
      )}
    </article>
  )
}

function Badge({ className, children }) {
  return <span className={`max-w-full rounded-full border px-3 py-1.5 leading-4 ${className}`}>{children}</span>
}

function Fact({ icon: Icon, label, value, className, prominent = false }) {
  return (
    <div className={`rounded-2xl border px-4 py-3.5 ${className}`}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] opacity-60"><Icon size={15} />{label}</div>
      <div className={`mt-1.5 break-words font-semibold ${prominent ? 'font-display text-2xl leading-none' : 'text-sm'}`}>{value}</div>
    </div>
  )
}

function MiniFact({ label, value, className }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${className}`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-55">{label}</div>
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

function TextList({ title, icon: Icon, items, className }) {
  return (
    <div className={`rounded-xl border p-3 ${className}`}>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] opacity-60">{Icon && <Icon size={14} />}{title}</div>
      <ul className="mt-2 space-y-1.5 text-sm opacity-80">{items.map((item, index) => <li key={`${item}-${index}`} className="break-words">{item}</li>)}</ul>
    </div>
  )
}

function Condition({ label, value }) {
  if (!value) return null
  return <div><dt className="font-semibold">{label}</dt><dd className="mt-1 whitespace-pre-wrap leading-6 opacity-75">{value}</dd></div>
}

function formatDate(value) {
  const text = String(value || '')
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00`) : new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat('bg-BG', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function offerTypeIcon(offerType) {
  if (offerType === 'estimate') return ScanSearch
  if (offerType === 'staged') return Layers3
  return BadgeCheck
}

function statusTone(status) {
  if (status === 'accepted') return 'border-green-200 bg-green-50 text-green-800'
  if (['declined', 'withdrawn', 'expired'].includes(status)) return 'border-red-200 bg-red-50 text-red-700'
  if (['question', 'change_requested'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-line bg-paper text-muted'
}
