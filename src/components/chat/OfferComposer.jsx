import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, ClipboardList, CreditCard, Eye, Layers3, Plus, Trash2, X } from 'lucide-react'
import { formatEurWithBgn } from '../../lib/money.js'
import TotsanSelect from '../ui/TotsanSelect.jsx'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'
const TEXTAREA = `${INPUT} resize-y leading-6`

const OFFER_TYPES = [
  { value: 'final', title: 'Финална оферта', description: 'Цена, срок и обхват са готови за приемане.' },
  { value: 'estimate', title: 'Предварителна оценка', description: 'Ориентир преди оглед, мерки или уточнения.' },
  { value: 'staged', title: 'Поетапна оферта', description: 'Работата е разделена на етапи с отделни условия.' },
]

const PRICE_TYPE_OPTIONS = [
  { value: 'fixed', label: 'Фиксирана цена' },
  { value: 'estimate', label: 'Ориентировъчна цена' },
  { value: 'hourly', label: 'Почасова / на ден' },
  { value: 'staged', label: 'По етапи' },
]

const MATERIAL_MODE_OPTIONS = [
  { value: 'included', label: 'Материалите са включени' },
  { value: 'client', label: 'Материалите се осигуряват от клиента' },
  { value: 'separate', label: 'Материалите се уточняват отделно' },
]

const VAT_STATUS_OPTIONS = [
  { value: 'included', label: 'Цената включва ДДС' },
  { value: 'excluded', label: 'Цената е без ДДС' },
  { value: 'not_registered', label: 'Партньорът не е регистриран по ДДС' },
  { value: 'invoice', label: 'Уточнява се във фактурата' },
]

const PAYMENT_METHOD_OPTIONS = [
  { value: 'platform', label: 'Плащане през Totsan' },
  { value: 'staged_platform', label: 'Плащане през Totsan по етапи' },
  { value: 'custom', label: 'Друго условие' },
]

function defaultValidUntil() {
  const date = new Date()
  date.setDate(date.getDate() + 14)
  return date.toISOString().slice(0, 10)
}

function createStage(order) {
  return {
    title: '',
    description: '',
    durationDays: '',
    priceAmount: '',
    payment: '',
    startCondition: '',
    order,
  }
}

function createOfferDraft(serviceRequest = null) {
  const snapshot = serviceRequest?.snapshot || {}
  const features = Array.isArray(snapshot.features) ? snapshot.features : []
  const packageTitle = String(snapshot.package_title || '').trim()
  const serviceTitle = String(snapshot.service_title || '').trim()
  const packageDescription = String(snapshot.package_description || '').trim()
  const serviceSubtitle = String(snapshot.service_subtitle || '').trim()

  return {
    offerType: 'final',
    title: packageTitle || serviceTitle || '',
    summary: [serviceSubtitle, packageDescription].filter(Boolean).join('\n\n'),
    validUntil: defaultValidUntil(),
    included: features.join('\n'),
    excluded: '',
    clientRequirements: '',
    priceType: 'fixed',
    laborPrice: '',
    materialsPrice: '',
    transportPrice: '',
    totalPrice: snapshot.starting_price ? String(snapshot.starting_price) : '',
    materialsMode: 'separate',
    vatStatus: 'invoice',
    timelineDays: snapshot.delivery_days ? String(snapshot.delivery_days) : '',
    earliestStartDate: '',
    timelineDependencies: '',
    stages: [createStage(1)],
    paymentMethod: 'platform',
    paymentTerms: 'Клиентът приема офертата и плаща през Totsan. Сумата се освобождава към партньора след изпълнение според условията.',
    paymentNotes: '',
    scopeChangeTerms: 'Промени извън описания обхват се уточняват писмено в чата и могат да изискват нова оферта.',
    cancellationTerms: 'При отказ преди започване на работа се прилагат условията на Totsan и Stripe. При започната работа се заплаща реално извършеното и договорените невъзстановими разходи.',
    unforeseenTerms: 'Скрити дефекти, допълнителни ремонти или липсващ достъп се оферират отделно след потвърждение от клиента.',
  }
}

function splitLines(value = '') {
  return String(value || '').split('\n').map((item) => item.trim()).filter(Boolean)
}

function moneyValue(value) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.')
  if (!normalized) return 0
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function dateToExpiry(value = '') {
  if (!value) return null
  const date = new Date(`${value}T23:59:59+03:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export default function OfferComposer({ open, onClose, onSubmit, status, serviceRequest = null }) {
  const [draft, setDraft] = useState(() => createOfferDraft(serviceRequest))

  useEffect(() => {
    if (!open) return
    setDraft(createOfferDraft(serviceRequest))
  }, [open, serviceRequest?.id])

  const computed = useMemo(() => {
    const includedItems = splitLines(draft.included)
    const excludedItems = splitLines(draft.excluded)
    const clientRequirementItems = splitLines(draft.clientRequirements)
    const priceBreakdown = {
      labor: moneyValue(draft.laborPrice),
      materials: moneyValue(draft.materialsPrice),
      transport: moneyValue(draft.transportPrice),
    }
    const partsTotal = priceBreakdown.labor + priceBreakdown.materials + priceBreakdown.transport
    const totalPrice = moneyValue(draft.totalPrice) || partsTotal
    const stages = draft.offerType === 'staged'
      ? draft.stages
        .map((stage, index) => ({
          title: stage.title.trim(),
          description: stage.description.trim(),
          durationDays: moneyValue(stage.durationDays),
          priceAmount: moneyValue(stage.priceAmount),
          payment: stage.payment.trim(),
          startCondition: stage.startCondition.trim(),
          order: index + 1,
        }))
        .filter((stage) => stage.title || stage.description || stage.priceAmount > 0)
      : []

    return { includedItems, excludedItems, clientRequirementItems, priceBreakdown, partsTotal, totalPrice, stages }
  }, [draft])

  if (!open) return null

  function set(key, value) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function setOfferType(offerType) {
    setDraft((current) => ({
      ...current,
      offerType,
      priceType: offerType === 'staged' ? 'staged' : current.priceType === 'staged' ? 'fixed' : current.priceType,
      paymentMethod: offerType === 'staged' ? 'staged_platform' : current.paymentMethod,
      stages: current.stages.length ? current.stages : [createStage(1)],
    }))
  }

  function addStage() {
    setDraft((current) => ({ ...current, stages: [...current.stages, createStage(current.stages.length + 1)] }))
  }

  function removeStage(index) {
    setDraft((current) => {
      const stages = current.stages
        .filter((_, stageIndex) => stageIndex !== index)
        .map((stage, stageIndex) => ({ ...stage, order: stageIndex + 1 }))
      return { ...current, stages: stages.length ? stages : [createStage(1)] }
    })
  }

  function setStage(index, key, value) {
    setDraft((current) => ({
      ...current,
      stages: current.stages.map((stage, stageIndex) => (stageIndex === index ? { ...stage, [key]: value } : stage)),
    }))
  }

  async function submit(event) {
    event.preventDefault()

    const offerDetails = {
      offerType: draft.offerType,
      validUntil: draft.validUntil,
      includedItems: computed.includedItems,
      excludedItems: computed.excludedItems,
      clientRequirements: computed.clientRequirementItems,
      priceType: draft.priceType,
      priceBreakdown: computed.priceBreakdown,
      materialsMode: draft.materialsMode,
      vatStatus: draft.vatStatus,
      timeline: {
        days: moneyValue(draft.timelineDays),
        earliestStartDate: draft.earliestStartDate,
        dependencies: draft.timelineDependencies.trim(),
      },
      stages: computed.stages,
      payment: {
        method: draft.paymentMethod,
        terms: draft.paymentTerms.trim(),
        notes: draft.paymentNotes.trim(),
      },
      conditions: {
        scopeChanges: draft.scopeChangeTerms.trim(),
        cancellation: draft.cancellationTerms.trim(),
        unforeseenWork: draft.unforeseenTerms.trim(),
      },
    }

    await onSubmit({
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      description: draft.summary.trim(),
      offerType: draft.offerType,
      priceType: draft.priceType,
      offerDetails,
      currency: 'EUR',
      executionMode: draft.offerType === 'staged' ? 'staged' : 'single',
      stages: computed.stages,
      deliverables: computed.includedItems,
      priceAmount: computed.totalPrice,
      deliveryDays: moneyValue(draft.timelineDays),
      revisions: 0,
      expiresAt: dateToExpiry(draft.validUntil),
      // Adding root fields to satisfy UI tests/legacy consumers
      excludedItems: computed.excludedItems,
      notIncluded: computed.excludedItems,
      clientRequirements: computed.clientRequirementItems,
      clientProvides: computed.clientRequirementItems,
      materialsMode: draft.materialsMode,
      materialsNote: draft.materialsMode,
      vatStatus: draft.vatStatus,
      earliestStartDate: draft.earliestStartDate,
      dependencies: draft.timelineDependencies.trim(),
      paymentTerms: draft.paymentTerms.trim(),
      paymentNotes: draft.paymentNotes.trim(),
    })
  }

  const canSubmit = draft.title.trim()
    && draft.summary.trim()
    && (computed.includedItems.length > 0 || draft.offerType === 'estimate')
    && draft.paymentTerms.trim()
    && draft.cancellationTerms.trim()

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/60 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Изпращане на оферта"
    >
      <form onSubmit={submit} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[1180px] flex-col overflow-hidden rounded-3xl border border-line bg-paper shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-5 md:px-7">
          <div>
            <div className="eyebrow">Оферта</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Създай оферта</h2>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost shrink-0 !px-3 !py-2" aria-label="Затвори">
            <X size={18} />
          </button>
        </div>

        <div className="totsan-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="space-y-5 px-5 py-5 md:px-7 md:py-6">
              <Section icon={ClipboardList} title="Основна информация">
                <div className="grid gap-3 sm:grid-cols-3">
                  {OFFER_TYPES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setOfferType(item.value)}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${draft.offerType === item.value ? 'border-ink bg-soft shadow-sm' : 'border-line bg-paper hover:border-ink/40'}`}
                    >
                      <div className="text-sm font-semibold text-ink">{item.title}</div>
                      <p className="mt-1 text-xs leading-5 text-muted">{item.description}</p>
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_11rem]">
                  <Field label="Заглавие">
                    <input value={draft.title} onChange={(event) => set('title', event.target.value)} className={INPUT} required />
                  </Field>
                  <Field label="Валидна до">
                    <input type="date" value={draft.validUntil} onChange={(event) => set('validUntil', event.target.value)} className={INPUT} />
                  </Field>
                </div>
                <Field label="Кратко резюме">
                  <textarea rows={4} value={draft.summary} onChange={(event) => set('summary', event.target.value)} className={TEXTAREA} required />
                </Field>
              </Section>

              <Section icon={CheckCircle2} title="Обхват">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Включено">
                    <textarea rows={7} value={draft.included} onChange={(event) => set('included', event.target.value)} className={TEXTAREA} placeholder="Един ред = една точка" />
                  </Field>
                  <Field label="Не е включено">
                    <textarea rows={7} value={draft.excluded} onChange={(event) => set('excluded', event.target.value)} className={TEXTAREA} />
                  </Field>
                  <Field label="Клиентът осигурява">
                    <textarea rows={7} value={draft.clientRequirements} onChange={(event) => set('clientRequirements', event.target.value)} className={TEXTAREA} />
                  </Field>
                </div>
              </Section>

              <Section icon={CreditCard} title="Цена">
                <div className="grid gap-4 md:grid-cols-2">
                  <TotsanSelect label="Тип цена" value={draft.priceType} onChange={(value) => set('priceType', value)} options={PRICE_TYPE_OPTIONS} buttonClassName="mt-2 bg-paper" />
                  <TotsanSelect label="Материали" value={draft.materialsMode} onChange={(value) => set('materialsMode', value)} options={MATERIAL_MODE_OPTIONS} buttonClassName="mt-2 bg-paper" />
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <MoneyInput label="Труд" value={draft.laborPrice} onChange={(value) => set('laborPrice', value)} />
                  <MoneyInput label="Материали" value={draft.materialsPrice} onChange={(value) => set('materialsPrice', value)} />
                  <MoneyInput label="Транспорт" value={draft.transportPrice} onChange={(value) => set('transportPrice', value)} />
                  <MoneyInput label="Общо" value={draft.totalPrice} onChange={(value) => set('totalPrice', value)} placeholder={computed.partsTotal ? String(computed.partsTotal) : ''} />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <TotsanSelect label="ДДС статус" value={draft.vatStatus} onChange={(value) => set('vatStatus', value)} options={VAT_STATUS_OPTIONS} buttonClassName="mt-2 bg-paper" />
                  <div className="rounded-2xl border border-line bg-soft px-4 py-3 text-sm text-muted">
                    Показване към клиента: <span className="font-semibold text-ink">{computed.totalPrice ? formatEurWithBgn(computed.totalPrice) : 'По уточнение'}</span>
                  </div>
                </div>
              </Section>

              <Section icon={CalendarDays} title="Срок">
                <div className="grid gap-4 md:grid-cols-[10rem_12rem_minmax(0,1fr)]">
                  <Field label="Работни дни">
                    <input type="number" min="0" value={draft.timelineDays} onChange={(event) => set('timelineDays', event.target.value)} className={INPUT} />
                  </Field>
                  <Field label="Най-ранен старт">
                    <input type="date" value={draft.earliestStartDate} onChange={(event) => set('earliestStartDate', event.target.value)} className={INPUT} />
                  </Field>
                  <Field label="Зависимости">
                    <input value={draft.timelineDependencies} onChange={(event) => set('timelineDependencies', event.target.value)} className={INPUT} />
                  </Field>
                </div>
              </Section>

              {draft.offerType === 'staged' && (
                <Section icon={Layers3} title="Етапи">
                  <div className="space-y-3">
                    {draft.stages.map((stage, index) => (
                      <div key={`stage-${index}`} className="rounded-2xl border border-line bg-soft/60 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-ink">Етап {index + 1}</div>
                          <button type="button" onClick={() => removeStage(index)} className="btn btn-ghost !px-3 !py-2 text-sm">
                            <Trash2 size={16} /> Премахни
                          </button>
                        </div>
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                          <Field label="Заглавие">
                            <input value={stage.title} onChange={(event) => setStage(index, 'title', event.target.value)} className={INPUT} />
                          </Field>
                          <MoneyInput label="Цена" value={stage.priceAmount} onChange={(value) => setStage(index, 'priceAmount', value)} />
                        </div>
                        <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_9rem]">
                          <Field label="Описание">
                            <textarea rows={3} value={stage.description} onChange={(event) => setStage(index, 'description', event.target.value)} className={TEXTAREA} />
                          </Field>
                          <Field label="Дни">
                            <input type="number" min="0" value={stage.durationDays} onChange={(event) => setStage(index, 'durationDays', event.target.value)} className={INPUT} />
                          </Field>
                        </div>
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                          <Field label="Плащане">
                            <input value={stage.payment} onChange={(event) => setStage(index, 'payment', event.target.value)} className={INPUT} />
                          </Field>
                          <Field label="Условие за старт">
                            <input value={stage.startCondition} onChange={(event) => setStage(index, 'startCondition', event.target.value)} className={INPUT} />
                          </Field>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addStage} className="btn btn-ghost mt-4 w-full justify-center sm:w-auto">
                    <Plus size={17} /> Добави етап
                  </button>
                </Section>
              )}

              <Section icon={CreditCard} title="Плащане и условия">
                <div className="grid gap-4 md:grid-cols-2">
                  <TotsanSelect label="Метод" value={draft.paymentMethod} onChange={(value) => set('paymentMethod', value)} options={PAYMENT_METHOD_OPTIONS} buttonClassName="mt-2 bg-paper" />
                  <Field label="Бележка към плащането">
                    <input value={draft.paymentNotes} onChange={(event) => set('paymentNotes', event.target.value)} className={INPUT} />
                  </Field>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Условия за плащане">
                    <textarea rows={4} value={draft.paymentTerms} onChange={(event) => set('paymentTerms', event.target.value)} className={TEXTAREA} required />
                  </Field>
                  <Field label="Отказ / анулиране">
                    <textarea rows={4} value={draft.cancellationTerms} onChange={(event) => set('cancellationTerms', event.target.value)} className={TEXTAREA} required />
                  </Field>
                  <Field label="Промени в обхвата">
                    <textarea rows={4} value={draft.scopeChangeTerms} onChange={(event) => set('scopeChangeTerms', event.target.value)} className={TEXTAREA} />
                  </Field>
                  <Field label="Непредвидена работа">
                    <textarea rows={4} value={draft.unforeseenTerms} onChange={(event) => set('unforeseenTerms', event.target.value)} className={TEXTAREA} />
                  </Field>
                </div>
              </Section>
            </div>

            <aside className="border-t border-line bg-soft/70 px-5 py-5 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto lg:border-l lg:border-t-0">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                <Eye size={15} />
                Преглед
              </div>
              <div className="mt-4 rounded-2xl border border-line bg-paper p-4">
                <div className="text-xs uppercase tracking-[0.14em] text-muted">{OFFER_TYPES.find((item) => item.value === draft.offerType)?.title}</div>
                <h3 className="mt-2 break-words font-display text-2xl text-ink">{draft.title || 'Заглавие на офертата'}</h3>
                {draft.summary && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{draft.summary}</p>}
                <div className="mt-4 grid gap-2 text-sm">
                  <PreviewRow label="Цена" value={computed.totalPrice ? formatEurWithBgn(computed.totalPrice) : 'По уточнение'} />
                  <PreviewRow label="Срок" value={draft.timelineDays ? `${draft.timelineDays} работни дни` : 'По уточнение'} />
                  <PreviewRow label="Валидност" value={draft.validUntil || 'Не е зададена'} />
                </div>
                {computed.includedItems.length > 0 && <PreviewList title="Включено" items={computed.includedItems.slice(0, 5)} />}
                {computed.clientRequirementItems.length > 0 && <PreviewList title="Клиентът осигурява" items={computed.clientRequirementItems.slice(0, 4)} />}
                {draft.offerType === 'staged' && computed.stages.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-line bg-soft p-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Етапи</div>
                    <div className="mt-2 space-y-2">
                      {computed.stages.map((stage) => (
                        <div key={`${stage.order}-${stage.title}`} className="text-sm text-ink">
                          {stage.order}. {stage.title || 'Етап'} {stage.priceAmount ? `· ${formatEurWithBgn(stage.priceAmount)}` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-4 text-xs leading-5 text-muted">
                С изпращането потвърждаваш, че офертата отговаря на <Link to="/obshti-usloviya" className="font-semibold text-accent hover:underline">Общите условия</Link> и <Link to="/politika-za-poveritelnost" className="font-semibold text-accent hover:underline">Политиката за поверителност</Link>.
              </p>
            </aside>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 md:px-7">
          <p className="text-sm text-muted">Контакти и външни линкове се скриват автоматично.</p>
          <button disabled={status === 'sending' || !canSubmit} className="btn btn-primary disabled:opacity-50">
            {status === 'sending' ? 'Изпраща се...' : 'Изпрати оферта'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-3xl border border-line bg-paper p-4 shadow-[0_8px_30px_rgb(0,0,0,0.02)] sm:p-5">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-accentDeep" />
        <h3 className="font-display text-xl text-ink">{title}</h3>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Field({ label, children }) {
  return <label className="block text-sm font-medium text-ink">{label}{children}</label>
}

function MoneyInput({ label, value, onChange, placeholder = '' }) {
  return (
    <Field label={label}>
      <div className="relative mt-2">
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`${INPUT} !mt-0 pr-12`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-muted">€</span>
      </div>
    </Field>
  )
}

function PreviewRow({ label, value }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-line bg-soft px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="break-words text-right font-semibold text-ink">{value}</span>
    </div>
  )
}

function PreviewList({ title, items }) {
  return (
    <div className="mt-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{title}</div>
      <ul className="mt-2 space-y-2 text-sm text-ink">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-2">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-accentDeep" />
            <span className="break-words">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
