import { useState } from 'react'
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleMinus,
  CreditCard,
  Layers3,
  ReceiptText,
  ScanSearch,
  UserRound,
} from 'lucide-react'
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

export default function OfferDocumentView({
  offer,
  showStatus = true,
  showConditions = true,
  defaultConditionsOpen = false,
}) {
  const document = offer?.source ? offer : normalizeAcceptedOffer(offer)
  const OfferTypeIcon = offerTypeIcon(document.offerType)
  const priceLabel = document.priceAmount > 0 ? formatEurWithBgn(document.priceAmount) : 'По уточнение'
  const durationLabel = document.timeline.days > 0 ? `${document.timeline.days} работни дни` : ''
  const startParts = [
    document.timeline.earliestStartDate ? formatDate(document.timeline.earliestStartDate) : '',
    document.timeline.dependencies,
  ].filter(Boolean)
  const startLabel = startParts.join(' → ')
  const startHeading = document.timeline.earliestStartDate ? 'Най-ранен старт' : 'Зависи от'
  const hasAgreementDetails = Boolean(
    document.payment.method
    || document.payment.terms
    || document.payment.notes
    || (showConditions && (document.conditions.scopeChanges || document.conditions.cancellation || document.conditions.unforeseenWork)),
  )

  return (
    <article className="relative w-full min-w-0 max-w-[45.3125rem] overflow-hidden rounded-[1.5625rem] border border-accentDeep/50 bg-white text-ink shadow-[0_24px_60px_-46px_rgba(13,35,64,0.62)]">
      <header className="relative px-5 pb-5 pt-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2 pr-0 text-xs font-medium uppercase tracking-[0.08em] text-ink/65 sm:min-h-10 sm:pr-[20rem]">
          <span className="inline-flex min-w-0 items-center gap-2">
            <OfferTypeIcon size={20} strokeWidth={1.75} className="shrink-0 text-accentDeep" aria-hidden="true" />
            <span className="break-words">{OFFER_TYPE_LABELS[document.offerType] || 'Оферта'}</span>
          </span>
          {showStatus && document.status ? (
            <span className={`rounded-full border px-2.5 py-1 text-[0.625rem] font-semibold tracking-[0.08em] ${statusTone(document.status)}`}>
              {STATUS_LABELS[document.status] || document.status}
            </span>
          ) : null}
        </div>

        <h3 className="mt-6 break-words font-display text-[1.875rem] font-bold leading-[1.15] tracking-[-0.015em] text-black sm:mt-4 sm:pr-[20rem] sm:text-4xl">
          {document.title || 'Нова оферта'}
        </h3>

        <PriceAccent value={priceLabel} />

        {document.summary ? (
          <p className="mt-4 break-words whitespace-pre-wrap text-[0.9375rem] leading-6 text-black sm:text-base">
            {document.summary}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <Badge><strong className="font-medium text-ink">Тип цена:</strong> {PRICE_TYPE_LABELS[document.priceType] || 'Цена по оферта'}</Badge>
          {document.materialsMode ? (
            <Badge><strong className="font-medium text-ink">Материали:</strong> {MATERIAL_MODE_LABELS[document.materialsMode] || document.materialsMode}</Badge>
          ) : null}
          {document.vatStatus ? (
            <Badge><strong className="font-medium text-ink">ДДС:</strong> {VAT_LABELS[document.vatStatus] || document.vatStatus}</Badge>
          ) : null}
        </div>

        {(durationLabel || startLabel) ? (
          <div className="mt-5 flex min-w-0 flex-col gap-2 sm:flex-row">
            {durationLabel ? <TimelineAccent label="Срок" value={durationLabel} icon={CalendarDays} narrow /> : null}
            {startLabel ? <TimelineAccent label={startHeading} value={startLabel} /> : null}
          </div>
        ) : null}
      </header>

      <div className="space-y-5 px-5 pb-5">
        {document.stages.length > 0 ? (
          <Section title="Етапи" icon={Layers3} prominent>
            <ol className="space-y-5">
              {document.stages.map((stage) => (
                <StageCard key={`${stage.order}-${stage.title}`} stage={stage} />
              ))}
            </ol>
          </Section>
        ) : null}

        {document.includedItems.length > 0 ? (
          <Section title="Какво е включено">
            <ul className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              {document.includedItems.map((item, index) => (
                <li key={`${item}-${index}`} className="flex min-w-0 items-start gap-2">
                  <CheckCircle2 size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accentDeep" aria-hidden="true" />
                  <span className="break-words leading-5 text-black">{item}</span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {(document.excludedItems.length > 0 || document.clientRequirements.length > 0) ? (
          <Section title="Граници на обхвата" regularTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              {document.excludedItems.length > 0 ? (
                <TextList title="Не е включено" icon={CircleMinus} items={document.excludedItems} tone="danger" />
              ) : null}
              {document.clientRequirements.length > 0 ? (
                <TextList title="Клиентът осигурява" icon={UserRound} items={document.clientRequirements} tone="info" />
              ) : null}
            </div>
          </Section>
        ) : null}

        {hasAgreementDetails ? (
          <OfferConditionsDisclosure initialOpen={defaultConditionsOpen}>
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-black outline-none transition hover:bg-accentSoft/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accentDeep">
              <ReceiptText size={18} strokeWidth={1.75} className="shrink-0 text-black" aria-hidden="true" />
              Плащане и условия
              <ChevronDown size={18} strokeWidth={1.75} className="ml-auto shrink-0 text-black transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="border-t border-accentDeep/45 px-4 pb-5 pt-5 shadow-[inset_0_4px_5px_-5px_rgba(0,0,0,0.55)]">
              {document.payment.method ? (
                <div className="flex justify-center">
                  <div className="inline-flex min-h-12 max-w-full items-center justify-center rounded-2xl bg-accentDeep px-6 py-3 text-center text-sm font-medium leading-5 text-paper shadow-[0_5px_8px_-6px_rgba(0,0,0,0.75)] sm:min-w-[21.75rem] sm:text-base">
                    {PAYMENT_METHOD_LABELS[document.payment.method] || document.payment.method}
                  </div>
                </div>
              ) : null}

              {(document.payment.terms || document.payment.notes) ? (
                <dl className={`${document.payment.method ? 'mt-5' : ''} space-y-4`}>
                  <Condition label="Условия за плащане" value={document.payment.terms} />
                  <Condition label="Бележка" value={document.payment.notes} />
                </dl>
              ) : null}

              {showConditions && (document.conditions.scopeChanges || document.conditions.cancellation || document.conditions.unforeseenWork) ? (
                <dl className="mt-5 space-y-4">
                  <Condition label="Промени в обхвата" value={document.conditions.scopeChanges} />
                  <Condition label="Отказ и анулиране" value={document.conditions.cancellation} />
                  <Condition label="Непредвидена работа" value={document.conditions.unforeseenWork} />
                </dl>
              ) : null}
            </div>
          </OfferConditionsDisclosure>
        ) : null}
      </div>

      {document.validUntil ? <ValidityAccent value={formatDate(document.validUntil)} /> : null}
    </article>
  )
}

function OfferConditionsDisclosure({ initialOpen, children }) {
  const [open, setOpen] = useState(initialOpen)

  return (
    <details
      className="group overflow-hidden rounded-[1.5625rem] border border-accentDeep/50 bg-soft/95"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      {children}
    </details>
  )
}

function PriceAccent({ value }) {
  return (
    <div className="mt-4 min-w-0 bg-accentDeep px-5 py-3 text-paper shadow-[0_5px_7px_-4px_rgba(0,0,0,0.65)] max-sm:rounded-[1.5625rem] sm:absolute sm:right-0 sm:top-0 sm:mt-0 sm:min-h-[4.375rem] sm:w-[19.375rem] sm:rounded-bl-[1.5625rem] sm:rounded-tr-[1.5625rem]">
      <div className="flex items-center justify-between gap-2 text-[0.625rem] font-medium uppercase tracking-[0.08em] text-paper/65">
        <span>Обща цена</span>
        <CreditCard size={14} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div className="mt-1 break-words font-display text-2xl font-bold leading-[1.1] sm:text-[1.75rem]">{value}</div>
    </div>
  )
}

function TimelineAccent({ label, value, icon: Icon, narrow = false }) {
  return (
    <div className={`min-h-[3.5625rem] min-w-0 rounded-[1.5625rem] bg-accentDeep px-5 py-3 text-paper ${narrow ? 'sm:w-40 sm:shrink-0' : 'sm:w-[26.0625rem] sm:max-w-full sm:flex-none'}`}>
      <div className="flex items-center justify-between gap-2 text-[0.625rem] font-medium uppercase tracking-[0.08em] text-paper/65">
        <span>{label}</span>
        {Icon ? <Icon size={14} strokeWidth={1.75} aria-hidden="true" /> : null}
      </div>
      <div className="mt-1 break-words text-sm font-medium leading-5 sm:text-base">{value}</div>
    </div>
  )
}

function ValidityAccent({ value }) {
  return (
    <div className="flex min-h-[3.875rem] w-36 flex-col justify-center rounded-tr-[1.5625rem] bg-accentDeep px-5 py-2 text-paper">
      <div className="text-[0.625rem] font-medium uppercase tracking-[0.08em] text-paper/65">Валидна до</div>
      <div className="mt-1 whitespace-nowrap text-sm font-medium leading-5">{value}</div>
    </div>
  )
}

function Badge({ children }) {
  return <span className="max-w-full rounded-full border border-accentDeep/50 bg-white px-2.5 py-1.5 leading-4 text-ink/85">{children}</span>
}

function StageCard({ stage }) {
  return (
    <li className="min-w-0 rounded-[1.5625rem] border border-accentDeep/50 bg-white p-4 shadow-[0_5px_5px_-3px_rgba(0,0,0,0.55)] sm:min-h-[9.875rem]">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#202124] text-xl font-medium text-white">{stage.order}</span>
        {stage.priceAmount > 0 ? (
          <span className="min-w-0 break-words text-right text-sm leading-5 text-black sm:text-base">{formatEurWithBgn(stage.priceAmount)}</span>
        ) : null}
      </div>
      <h4 className="mt-3 break-words text-lg font-medium leading-6 text-black sm:text-xl">{stage.title || `Етап ${stage.order}`}</h4>
      {stage.description ? <p className="mt-1 break-words whitespace-pre-wrap text-sm leading-5 text-ink/85 sm:text-base sm:leading-6">{stage.description}</p> : null}
      {(stage.durationDays > 0 || stage.startCondition || stage.payment) ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-ink/55">
          {stage.durationDays > 0 ? <span>{stage.durationDays} работни дни</span> : null}
          {stage.startCondition ? <span>Старт: {stage.startCondition}</span> : null}
          {stage.payment ? <span>{stage.payment}</span> : null}
        </div>
      ) : null}
    </li>
  )
}

function Section({ title, icon: Icon, prominent = false, regularTitle = false, children }) {
  return (
    <section className="rounded-[1.5625rem] border border-accentDeep/50 bg-soft/95 p-4">
      <div className={`flex items-center gap-2 uppercase tracking-[0.06em] text-ink/65 ${prominent ? 'text-lg font-semibold' : regularTitle ? 'text-xs font-medium' : 'text-xs font-semibold'}`}>
        {Icon ? <Icon size={prominent ? 20 : 16} strokeWidth={1.75} className="shrink-0 text-accentDeep" aria-hidden="true" /> : null}
        {title}
      </div>
      <div className={prominent ? 'mt-5' : 'mt-4'}>{children}</div>
    </section>
  )
}

function TextList({ title, icon: Icon, items, tone }) {
  const toneClass = tone === 'danger'
    ? 'border-[#bb6f77] bg-[#f1bdc2]'
    : 'border-accentDeep/50 bg-[#c2d0e2]'

  return (
    <div className={`min-w-0 rounded-[1.5625rem] border p-4 text-black shadow-[0_5px_5px_-3px_rgba(0,0,0,0.5)] sm:min-h-[10.25rem] ${toneClass}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.06em] text-ink/70">
        <Icon size={20} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
        {title}
      </div>
      <ul className="mt-3 space-y-1 pl-6 text-sm leading-5 sm:text-base sm:leading-6">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="list-disc break-words pl-0.5">{item}</li>
        ))}
      </ul>
    </div>
  )
}

function Condition({ label, value }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.06em] leading-5 text-black">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm leading-5 text-ink/65">{value}</dd>
    </div>
  )
}

function formatDate(value) {
  const text = String(value || '')
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00`) : new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
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
  return 'border-line bg-soft text-muted'
}
