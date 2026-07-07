import { useState } from 'react'
import { CheckCircle2, Clock, CreditCard, HelpCircle, Layers3, PenLine, ShieldCheck, XCircle } from 'lucide-react'
import { conversationRole } from '../../lib/chat.js'
import { formatEurWithBgn } from '../../lib/money.js'

const OFFER_TYPE_LABELS = {
  final: 'Финална оферта',
  estimate: 'Предварителна оценка',
  staged: 'Поетапна оферта',
}

const PRICE_TYPE_LABELS = {
  fixed: 'Фиксирана цена',
  estimate: 'Ориентировъчна цена',
  hourly: 'Почасова / на ден',
  staged: 'По етапи',
}

const MATERIAL_MODE_LABELS = {
  included: 'Материалите са включени',
  client: 'Материалите се осигуряват от клиента',
  separate: 'Материалите се уточняват отделно',
}

const VAT_LABELS = {
  included: 'С ДДС',
  excluded: 'Без ДДС',
  not_registered: 'Партньорът не е регистриран по ДДС',
  invoice: 'Уточнява се във фактурата',
}

export default function OfferCard({ offer, conversation, userId, onAction, compact = false, messageCreatedAt = '' }) {
  const role = conversationRole(conversation, userId)
  const providerName = conversation?.partner?.name || conversation?.partner?.display_name || 'Партньорът в разговора'
  const canClientAct = role === 'client' && offer.status === 'sent'
  const canPartnerAct = role === 'partner' && offer.status === 'sent'
  const [withdrawStatus, setWithdrawStatus] = useState('idle')
  const details = getOfferDetails(offer)
  const offerType = offer.offer_type || details.offerType || (offer.execution_mode === 'staged' ? 'staged' : 'final')
  const priceType = offer.price_type || details.priceType || (offerType === 'staged' ? 'staged' : 'fixed')
  const timeline = details.timeline || {}
  const payment = details.payment || {}
  const conditions = details.conditions || {}
  const includedItems = getStringArray(details.includedItems, offer.deliverables)
  const excludedItems = getStringArray(details.excludedItems)
  const clientRequirements = getStringArray(details.clientRequirements)
  const stages = normalizeStages(details.stages || offer.stages)
  const createdLabel = formatOfferTimestamp(offer.created_at || messageCreatedAt)
  const validUntil = details.validUntil || offer.expires_at || ''
  const summary = offer.summary || details.summary || offer.description || ''

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

      {summary && <p className="mt-3 break-words whitespace-pre-wrap text-sm leading-6 opacity-80">{summary}</p>}

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <InlineBadge compact={compact}>{OFFER_TYPE_LABELS[offerType] || 'Оферта'}</InlineBadge>
        <InlineBadge compact={compact}>{PRICE_TYPE_LABELS[priceType] || 'Цена по оферта'}</InlineBadge>
        <InlineBadge compact={compact}>Доставчик: {providerName}</InlineBadge>
        <InlineBadge compact={compact}>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Плащане през Totsan</span>
        </InlineBadge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Info icon={CreditCard} label="Обща цена" value={offer.price_amount ? formatEurWithBgn(offer.price_amount) : 'По уточнение'} />
        <Info icon={Clock} label="Срок" value={offer.delivery_days ? `${offer.delivery_days} работни дни` : timeline.days ? `${timeline.days} работни дни` : 'По уточнение'} />
      </div>

      {(validUntil || timeline.earliestStartDate || timeline.dependencies) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {validUntil && <MiniFact label="Валидна до" value={formatDate(validUntil)} />}
          {timeline.earliestStartDate && <MiniFact label="Най-ранен старт" value={formatDate(timeline.earliestStartDate)} />}
          {timeline.dependencies && <MiniFact label="Зависимости" value={timeline.dependencies} />}
        </div>
      )}

      {offerType === 'staged' && stages.length > 0 && (
        <OfferSection title="Етапи" icon={Layers3} compact={compact}>
          <ol className="space-y-3">
            {stages.map((stage) => (
              <li key={`${stage.order}-${stage.title}-${stage.description}`} className="flex min-w-0 gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-current/10 text-xs font-semibold">{stage.order}</span>
                <div className="min-w-0">
                  <div className="break-words text-sm font-semibold">{stage.title || `Етап ${stage.order}`}</div>
                  {stage.description && <p className="mt-1 break-words whitespace-pre-wrap text-sm opacity-75">{stage.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs opacity-75">
                    {stage.durationDays > 0 && <span>{stage.durationDays} дни</span>}
                    {stage.priceAmount > 0 && <span>{formatEurWithBgn(stage.priceAmount)}</span>}
                    {stage.payment && <span>{stage.payment}</span>}
                    {stage.startCondition && <span>{stage.startCondition}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </OfferSection>
      )}

      {includedItems.length > 0 && (
        <OfferSection title="Какво включва" compact={compact}>
          <CheckList items={includedItems} />
        </OfferSection>
      )}

      {(excludedItems.length > 0 || clientRequirements.length > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {excludedItems.length > 0 && (
            <OfferSection title="Не е включено" compact={compact} tight>
              <PlainList items={excludedItems} />
            </OfferSection>
          )}
          {clientRequirements.length > 0 && (
            <OfferSection title="Клиентът осигурява" compact={compact} tight>
              <PlainList items={clientRequirements} />
            </OfferSection>
          )}
        </div>
      )}

      {(payment.terms || payment.notes || details.materialsMode || details.vatStatus) && (
        <OfferSection title="Плащане" icon={CreditCard} compact={compact}>
          <div className="space-y-2 text-sm">
            {payment.terms && <p className="break-words whitespace-pre-wrap opacity-80">{payment.terms}</p>}
            {payment.notes && <p className="break-words whitespace-pre-wrap opacity-75">{payment.notes}</p>}
            <div className="flex flex-wrap gap-2 text-xs">
              {details.materialsMode && <InlineBadge compact={compact}>{MATERIAL_MODE_LABELS[details.materialsMode] || details.materialsMode}</InlineBadge>}
              {details.vatStatus && <InlineBadge compact={compact}>{VAT_LABELS[details.vatStatus] || details.vatStatus}</InlineBadge>}
            </div>
          </div>
        </OfferSection>
      )}

      {(conditions.scopeChanges || conditions.cancellation || conditions.unforeseenWork) && (
        <OfferSection title="Условия" compact={compact}>
          <PlainList items={[conditions.scopeChanges, conditions.cancellation, conditions.unforeseenWork].filter(Boolean)} />
        </OfferSection>
      )}

      {(canClientAct || canPartnerAct) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {canClientAct && <button type="button" onClick={() => onAction?.(offer, 'accepted')} className="btn btn-primary !py-2 text-sm">Приеми офертата</button>}
          {canClientAct && <button type="button" onClick={() => onAction?.(offer, 'question')} className="btn btn-ghost !py-2 text-sm"><HelpCircle size={17} /> Попитай</button>}
          {canClientAct && <button type="button" onClick={() => onAction?.(offer, 'change_requested')} className="btn btn-ghost !py-2 text-sm"><PenLine size={17} /> Поискай промяна</button>}
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

function getOfferDetails(offer) {
  const details = offer?.offer_details
  if (!details) return {}
  if (typeof details === 'string') {
    try {
      const parsed = JSON.parse(details)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return typeof details === 'object' && !Array.isArray(details) ? details : {}
}

function getStringArray(primary, fallback = []) {
  const source = Array.isArray(primary) && primary.length ? primary : fallback
  return Array.isArray(source) ? source.map((item) => String(item || '').trim()).filter(Boolean) : []
}

function normalizeStages(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter((stage) => stage && typeof stage === 'object' && !Array.isArray(stage))
    .map((stage, index) => ({
      title: String(stage.title || '').trim(),
      description: String(stage.description || '').trim(),
      durationDays: Number(stage.durationDays || stage.duration_days || 0),
      priceAmount: Number(stage.priceAmount || stage.price_amount || 0),
      payment: String(stage.payment || '').trim(),
      startCondition: String(stage.startCondition || stage.start_condition || '').trim(),
      order: Number.isFinite(Number(stage.order)) ? Number(stage.order) : index + 1,
    }))
    .filter((stage) => stage.title || stage.description || stage.priceAmount > 0)
    .sort((left, right) => left.order - right.order)
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

function OfferSection({ title, icon: Icon, children, compact, tight = false }) {
  return (
    <div className={`mt-4 overflow-hidden rounded-2xl border border-current/10 bg-current/5 ${tight ? 'p-3' : 'p-3 sm:p-4'}`}>
      <div className="flex min-w-0 items-center gap-2 text-[11px] uppercase tracking-[0.12em] opacity-60">
        {Icon && <Icon size={14} />}
        <span>{title}</span>
      </div>
      <div className={`mt-3 ${compact ? 'text-paper' : 'text-ink'}`}>{children}</div>
    </div>
  )
}

function CheckList({ items }) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current/10">
            <CheckCircle2 size={13} className="opacity-80" />
          </span>
          <span className="min-w-0 break-words whitespace-normal">{item}</span>
        </li>
      ))}
    </ul>
  )
}

function PlainList({ items }) {
  return (
    <ul className="space-y-2 text-sm opacity-80">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="break-words whitespace-pre-wrap">{item}</li>
      ))}
    </ul>
  )
}

function InlineBadge({ compact, children }) {
  return (
    <span className={`max-w-full rounded-full border px-3 py-1.5 ${compact ? 'border-paper/20 bg-paper/10 text-paper/85' : 'border-line bg-paper text-muted'}`}>
      <span className="break-words whitespace-normal">{children}</span>
    </span>
  )
}

function StatusPill({ status, compact }) {
  const labels = {
    draft: 'Чернова',
    sent: 'Изпратена',
    viewed: 'Видяна',
    question: 'Има въпрос',
    accepted: 'Приета',
    declined: 'Отказана',
    withdrawn: 'Изтеглена',
    expired: 'Изтекла',
    change_requested: 'Искана промяна',
  }
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

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}
