import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ClipboardList, CreditCard, Eye, FilePlus2, Layers3, Plus, Trash2, X } from 'lucide-react'
import { formatEurWithBgn } from '../../lib/money.js'
import { OFFER_DOCUMENT_VERSION, offerDocumentFromDraft, validateOfferDocument } from '../../lib/offers.js'
import OfferDocumentView from '../offers/OfferDocumentView.jsx'
import TotsanSelect from '../ui/TotsanSelect.jsx'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'
const TEXTAREA = `${INPUT} resize-y leading-6`
const DRAFT_PREFIX = 'totsan:offer-draft:v2:'

const STEPS = [
  { title: 'Начало', icon: FilePlus2 },
  { title: 'Основи', icon: ClipboardList },
  { title: 'Обхват', icon: CheckCircle2 },
  { title: 'Цена', icon: CreditCard },
  { title: 'Изпълнение', icon: Layers3 },
  { title: 'Преглед', icon: Eye },
]

const OFFER_TYPES = [
  { value: 'final', title: 'Финална оферта', description: 'Готова цена, срок и обхват.' },
  { value: 'estimate', title: 'Предварителна оценка', description: 'Ориентир преди оглед или уточнение.' },
  { value: 'staged', title: 'Поетапна оферта', description: 'Работа и плащане на отделни етапи.' },
]

const PRICE_TYPE_OPTIONS = [
  { value: 'fixed', label: 'Фиксирана цена' },
  { value: 'estimate', label: 'Ориентировъчна цена' },
  { value: 'hourly', label: 'Почасова / на ден' },
  { value: 'staged', label: 'По етапи' },
]

const MATERIAL_MODE_OPTIONS = [
  { value: 'included', label: 'Материалите са включени' },
  { value: 'client', label: 'Материалите са от клиента' },
  { value: 'separate', label: 'Материалите се уточняват отделно' },
]

const VAT_STATUS_OPTIONS = [
  { value: 'included', label: 'Цената включва ДДС' },
  { value: 'excluded', label: 'Цената е без ДДС' },
  { value: 'not_registered', label: 'Не съм регистриран по ДДС' },
  { value: 'invoice', label: 'Уточнява се във фактурата' },
]

const PAYMENT_METHOD_OPTIONS = [
  { value: 'platform', label: 'Еднократно през Totsan' },
  { value: 'staged_platform', label: 'През Totsan по етапи' },
  { value: 'custom', label: 'По договорени условия' },
]

/* ─── helpers ────────────────────────────────────────────────── */

function defaultValidUntil() {
  const d = new Date(); d.setDate(d.getDate() + 14)
  return d.toISOString().slice(0, 10)
}

function createStage(order) {
  return { title: '', description: '', durationDays: '', priceAmount: '', payment: '', startCondition: '', order }
}

function createOfferDraft(serviceRequest = null) {
  const snapshot = serviceRequest?.snapshot || {}
  const features = Array.isArray(snapshot.features) ? snapshot.features : []
  return {
    offerType: 'final',
    title: String(snapshot.package_title || snapshot.service_title || '').trim(),
    summary: [snapshot.service_subtitle, snapshot.package_description].map((value) => String(value || '').trim()).filter(Boolean).join('\n\n'),
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
    stages: [createStage(1), createStage(2)],
    paymentMethod: 'platform',
    paymentTerms: 'Плащането се извършва според избрания метод след приемане на офертата.',
    paymentNotes: '',
    scopeChangeTerms: 'Промени извън описания обхват се потвърждават писмено и могат да изискват нова оферта.',
    cancellationTerms: 'При отказ се заплащат извършената работа и предварително одобрените невъзстановими разходи.',
    unforeseenTerms: 'Скрити дефекти и непредвидена допълнителна работа се оферират отделно след потвърждение от клиента.',
  }
}

export default function OfferComposer({ open, onClose, onSubmit, status, serviceRequest = null, conversationId = '', services = [], servicesStatus = 'idle' }) {
  const draftKey = `${DRAFT_PREFIX}${serviceRequest?.id || conversationId || 'new'}`
  const [draft, setDraft] = useState(() => createOfferDraft(serviceRequest))
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState([])

  useEffect(() => {
    if (!open) return
    let next = createOfferDraft(serviceRequest)
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null')
      if (saved && typeof saved === 'object') next = { ...next, ...saved }
    } catch {
      // A broken local draft must never block creating an offer.
    }
    setDraft(next)
    setStep(0)
    setErrors([])
  }, [open, draftKey, serviceRequest?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft))
    } catch {
      // The form remains usable when browser storage is unavailable.
    }
  }, [draft, draftKey, open])

  const computed = useMemo(() => computeDraft(draft), [draft])
  const payload = useMemo(() => buildPayload(draft, computed), [draft, computed])
  const preview = useMemo(() => offerDocumentFromDraft(payload), [payload])

  if (!open) return null

  function set(key, value) {
    setErrors([])
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function setOfferType(offerType) {
    setErrors([])
    setDraft((current) => ({
      ...current,
      offerType,
      priceType: offerType === 'staged' ? 'staged' : current.priceType === 'staged' ? 'fixed' : current.priceType,
      paymentMethod: offerType === 'staged' ? 'staged_platform' : current.paymentMethod === 'staged_platform' ? 'platform' : current.paymentMethod,
      stages: current.stages.length >= 2 ? current.stages : [createStage(1), createStage(2)],
    }))
  }

  function importService(service) {
    const servicePackage = (service?.packages || []).find((item) => item.isActive !== false) || service?.packages?.[0] || null
    setDraft((current) => ({
      ...current,
      title: String(service?.title || current.title).trim(),
      summary: [service?.subtitle, servicePackage?.description, service?.descriptionMd].map((value) => String(value || '').trim()).filter(Boolean).join('\n\n'),
      included: Array.isArray(servicePackage?.features) ? servicePackage.features.filter(Boolean).join('\n') : current.included,
      totalPrice: servicePackage?.priceAmount ? String(servicePackage.priceAmount) : current.totalPrice,
      timelineDays: servicePackage?.deliveryDays ? String(servicePackage.deliveryDays) : current.timelineDays,
    }))
    setErrors([])
    setStep(1)
  }

  function addStage() {
    setDraft((current) => ({ ...current, stages: [...current.stages, createStage(current.stages.length + 1)] }))
  }

  function removeStage(index) {
    setDraft((current) => ({
      ...current,
      stages: current.stages.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, order: itemIndex + 1 })),
    }))
  }

  function setStage(index, key, value) {
    setErrors([])
    setDraft((current) => ({
      ...current,
      stages: current.stages.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    }))
  }

  function goNext() {
    const nextErrors = validateStep(step, draft, computed)
    if (nextErrors.length > 0) {
      setErrors(nextErrors)
      return
    }
    setErrors([])
    setStep((current) => Math.min(STEPS.length - 1, current + 1))
  }

  async function submit(event) {
    event.preventDefault()
    const result = validateOfferDocument(preview)
    if (!result.valid) {
      setErrors(result.errors)
      return
    }
    const succeeded = await onSubmit(payload)
    if (succeeded === false) return
    localStorage.removeItem(draftKey)
  }

  const CurrentIcon = STEPS[step].icon

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/60 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6" role="dialog" aria-modal="true" aria-label="Създаване на оферта">
      <form onSubmit={submit} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[1180px] flex-col overflow-hidden rounded-3xl border border-line bg-paper shadow-2xl">
        <header className="shrink-0 border-b border-line px-5 py-4 md:px-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow">Оферта · стъпка {step + 1} от {STEPS.length}</div>
              <h2 className="mt-1 font-display text-2xl text-ink">{STEPS[step].title}</h2>
            </div>
            <button type="button" onClick={onClose} className="btn btn-ghost shrink-0 !px-3 !py-2" aria-label="Затвори"><X size={18} /></button>
          </div>
          <nav className="mt-4 grid grid-cols-6 gap-1" aria-label="Стъпки на офертата">
            {STEPS.map((item, index) => {
              const Icon = item.icon
              return (
                <button key={item.title} type="button" onClick={() => index < step && setStep(index)} disabled={index > step} className={`flex min-w-0 items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold transition ${index === step ? 'bg-ink text-paper' : index < step ? 'bg-soft text-ink' : 'text-muted opacity-50'}`}>
                  <Icon size={15} /><span className="hidden truncate sm:inline">{item.title}</span>
                </button>
              )
            })}
          </nav>
        </header>

        <div className="totsan-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div className={`grid gap-0 ${step === 5 ? 'lg:grid-cols-[minmax(0,1fr)_20rem]' : ''}`}>
            <main className="px-5 py-5 md:px-7 md:py-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink"><CurrentIcon size={18} className="text-accentDeep" />{STEPS[step].title}</div>
              {errors.length > 0 && <ErrorPanel errors={errors} />}

              {step === 0 && <TemplateStep services={services} servicesStatus={servicesStatus} serviceRequest={serviceRequest} onImport={importService} onBlank={() => setStep(1)} />}
              {step === 1 && <BasicsStep draft={draft} set={set} setOfferType={setOfferType} />}
              {step === 2 && <ScopeStep draft={draft} set={set} />}
              {step === 3 && <PriceStep draft={draft} set={set} computed={computed} />}
              {step === 4 && <ExecutionStep draft={draft} set={set} setStage={setStage} addStage={addStage} removeStage={removeStage} />}
              {step === 5 && <OfferDocumentView offer={preview} showStatus={false} />}
            </main>

            {step === 5 && (
              <aside className="border-t border-line bg-soft/70 px-5 py-5 lg:border-l lg:border-t-0">
                <TotsanSelect label="Метод на плащане" value={draft.paymentMethod} onChange={(value) => set('paymentMethod', value)} options={PAYMENT_METHOD_OPTIONS} buttonClassName="mt-2 bg-paper" />
                <Field label="Условия за плащане"><textarea rows={4} value={draft.paymentTerms} onChange={(event) => set('paymentTerms', event.target.value)} className={TEXTAREA} /></Field>
                <Field label="Бележка"><input value={draft.paymentNotes} onChange={(event) => set('paymentNotes', event.target.value)} className={INPUT} /></Field>
                <details className="mt-4 rounded-2xl border border-line bg-paper p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-ink">Допълнителни условия</summary>
                  <Field label="Промени в обхвата"><textarea rows={3} value={draft.scopeChangeTerms} onChange={(event) => set('scopeChangeTerms', event.target.value)} className={TEXTAREA} /></Field>
                  <Field label="Отказ / анулиране"><textarea rows={3} value={draft.cancellationTerms} onChange={(event) => set('cancellationTerms', event.target.value)} className={TEXTAREA} /></Field>
                  <Field label="Непредвидена работа"><textarea rows={3} value={draft.unforeseenTerms} onChange={(event) => set('unforeseenTerms', event.target.value)} className={TEXTAREA} /></Field>
                </details>
                <p className="mt-4 text-xs leading-5 text-muted">Изпращането потвърждава <Link to="/obshti-usloviya" className="font-semibold text-accent hover:underline">Общите условия</Link>.</p>
              </aside>
            )}
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-5 py-4 md:px-7">
          <div className="text-xs text-muted">Черновата се запазва автоматично.</div>
          <div className="flex gap-2">
            {step > 0 && <button type="button" onClick={() => { setErrors([]); setStep((value) => value - 1) }} className="btn btn-ghost"><ArrowLeft size={17} /> Назад</button>}
            {step < STEPS.length - 1
              ? <button type="button" onClick={goNext} className="btn btn-primary">Напред <ArrowRight size={17} /></button>
              : <button disabled={status === 'sending'} className="btn btn-primary disabled:opacity-50">{status === 'sending' ? 'Изпраща се...' : 'Изпрати офертата'}</button>}
          </div>
        </footer>
      </form>
    </div>
  )
}

function BasicsStep({ draft, set, setOfferType }) {
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">{OFFER_TYPES.map((item) => <button key={item.value} type="button" onClick={() => setOfferType(item.value)} className={`rounded-2xl border p-4 text-left transition ${draft.offerType === item.value ? 'border-ink bg-soft shadow-sm' : 'border-line hover:border-ink/40'}`}><div className="text-sm font-semibold text-ink">{item.title}</div><p className="mt-1 text-xs leading-5 text-muted">{item.description}</p></button>)}</div>
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_11rem]"><Field label="Заглавие"><input value={draft.title} onChange={(event) => set('title', event.target.value)} className={INPUT} autoFocus /></Field><Field label="Валидна до"><input type="date" value={draft.validUntil} onChange={(event) => set('validUntil', event.target.value)} className={INPUT} /></Field></div>
    <Field label="Кратко резюме"><textarea rows={5} value={draft.summary} onChange={(event) => set('summary', event.target.value)} className={TEXTAREA} /></Field>
  </div>
}

function TemplateStep({ services, servicesStatus, serviceRequest, onImport, onBlank }) {
  return <div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {serviceRequest && <button type="button" onClick={onBlank} className="rounded-2xl border border-accentDeep/30 bg-accentSoft/60 p-4 text-left transition hover:border-accentDeep"><div className="text-xs font-bold uppercase tracking-[0.12em] text-accentDeep">Текуща заявка</div><div className="mt-2 text-sm font-semibold text-ink">Продължи с данните от заявката</div></button>}
      {(services || []).map((service) => {
        const servicePackage = service.packages?.find((item) => item.isActive !== false) || service.packages?.[0]
        return <button key={service.id} type="button" onClick={() => onImport(service)} className="rounded-2xl border border-line bg-paper p-4 text-left transition hover:border-ink/40 hover:shadow-sm"><div className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Моя услуга</div><div className="mt-2 text-sm font-semibold text-ink">{service.title}</div>{service.subtitle && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{service.subtitle}</p>}<div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">{servicePackage?.priceAmount && <span>{formatEurWithBgn(servicePackage.priceAmount)}</span>}{servicePackage?.deliveryDays && <span>· {servicePackage.deliveryDays} дни</span>}</div></button>
      })}
      <button type="button" onClick={onBlank} className="rounded-2xl border border-dashed border-line bg-soft/40 p-4 text-left transition hover:border-ink/40"><FilePlus2 size={20} className="text-accentDeep" /><div className="mt-3 text-sm font-semibold text-ink">Празна оферта</div><p className="mt-1 text-xs text-muted">Започни без готов шаблон.</p></button>
    </div>
    {servicesStatus === 'loading' && <p className="mt-4 text-sm text-muted">Зареждаме твоите услуги…</p>}
    {servicesStatus !== 'loading' && !serviceRequest && (!services || services.length === 0) && <p className="mt-4 text-sm text-muted">Нямаш готови услуги за импорт. Можеш да започнеш с празна оферта.</p>}
  </div>
}

function ScopeStep({ draft, set }) {
  return <div className="grid gap-4 md:grid-cols-3"><Field label="Включено"><textarea rows={12} value={draft.included} onChange={(event) => set('included', event.target.value)} className={TEXTAREA} placeholder="Един ред = една точка" /></Field><Field label="Не е включено"><textarea rows={12} value={draft.excluded} onChange={(event) => set('excluded', event.target.value)} className={TEXTAREA} /></Field><Field label="Клиентът осигурява"><textarea rows={12} value={draft.clientRequirements} onChange={(event) => set('clientRequirements', event.target.value)} className={TEXTAREA} /></Field></div>
}

function PriceStep({ draft, set, computed }) {
  return <div className="space-y-5">
    <div className="grid gap-4 md:grid-cols-2"><TotsanSelect label="Тип цена" value={draft.priceType} onChange={(value) => set('priceType', value)} options={PRICE_TYPE_OPTIONS} buttonClassName="mt-2 bg-paper" /><TotsanSelect label="Материали" value={draft.materialsMode} onChange={(value) => set('materialsMode', value)} options={MATERIAL_MODE_OPTIONS} buttonClassName="mt-2 bg-paper" /></div>
    {draft.offerType === 'staged' ? <div className="rounded-2xl border border-line bg-soft p-4 text-sm text-muted">Общата цена се изчислява от етапите: <strong className="text-ink">{computed.totalPrice ? formatEurWithBgn(computed.totalPrice) : '0 €'}</strong></div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><MoneyInput label="Труд" value={draft.laborPrice} onChange={(value) => set('laborPrice', value)} /><MoneyInput label="Материали" value={draft.materialsPrice} onChange={(value) => set('materialsPrice', value)} /><MoneyInput label="Транспорт" value={draft.transportPrice} onChange={(value) => set('transportPrice', value)} /><MoneyInput label="Общо" value={draft.totalPrice} onChange={(value) => set('totalPrice', value)} placeholder={computed.partsTotal ? String(computed.partsTotal) : ''} /></div>}
    <TotsanSelect label="ДДС статус" value={draft.vatStatus} onChange={(value) => set('vatStatus', value)} options={VAT_STATUS_OPTIONS} buttonClassName="mt-2 bg-paper" />
  </div>
}

function ExecutionStep({ draft, set, setStage, addStage, removeStage }) {
  return <div className="space-y-5">
    <div className="grid gap-4 md:grid-cols-[10rem_12rem_minmax(0,1fr)]"><Field label="Работни дни"><input type="number" min="0" value={draft.timelineDays} onChange={(event) => set('timelineDays', event.target.value)} className={INPUT} /></Field><Field label="Най-ранен старт"><input type="date" value={draft.earliestStartDate} onChange={(event) => set('earliestStartDate', event.target.value)} className={INPUT} /></Field><Field label="Зависимости"><input value={draft.timelineDependencies} onChange={(event) => set('timelineDependencies', event.target.value)} className={INPUT} /></Field></div>
    {draft.offerType === 'staged' && <div className="space-y-3">{draft.stages.map((stage, index) => <div key={`stage-${index}`} className="rounded-2xl border border-line bg-soft/60 p-4"><div className="flex items-center justify-between"><strong className="text-sm text-ink">Етап {index + 1}</strong><button type="button" onClick={() => removeStage(index)} disabled={draft.stages.length <= 2} className="btn btn-ghost !px-3 !py-2 disabled:opacity-30" aria-label="Премахни етап"><Trash2 size={16} /></button></div><div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_10rem_8rem]"><Field label="Заглавие"><input value={stage.title} onChange={(event) => setStage(index, 'title', event.target.value)} className={INPUT} /></Field><MoneyInput label="Цена" value={stage.priceAmount} onChange={(value) => setStage(index, 'priceAmount', value)} /><Field label="Дни"><input type="number" min="0" value={stage.durationDays} onChange={(event) => setStage(index, 'durationDays', event.target.value)} className={INPUT} /></Field></div><Field label="Резултат от етапа"><textarea rows={2} value={stage.description} onChange={(event) => setStage(index, 'description', event.target.value)} className={TEXTAREA} /></Field><div className="grid gap-4 md:grid-cols-2"><Field label="Условие за старт"><input value={stage.startCondition} onChange={(event) => setStage(index, 'startCondition', event.target.value)} className={INPUT} /></Field><Field label="Бележка за плащане"><input value={stage.payment} onChange={(event) => setStage(index, 'payment', event.target.value)} className={INPUT} /></Field></div></div>)}<button type="button" onClick={addStage} className="btn btn-ghost"><Plus size={17} /> Добави етап</button></div>}
  </div>
}

function computeDraft(draft) {
  const includedItems = splitLines(draft.included)
  const excludedItems = splitLines(draft.excluded)
  const clientRequirementItems = splitLines(draft.clientRequirements)
  const priceBreakdown = { labor: moneyValue(draft.laborPrice), materials: moneyValue(draft.materialsPrice), transport: moneyValue(draft.transportPrice) }
  const partsTotal = priceBreakdown.labor + priceBreakdown.materials + priceBreakdown.transport
  const stages = draft.offerType === 'staged' ? draft.stages.map((stage, index) => ({ title: stage.title.trim(), description: stage.description.trim(), durationDays: moneyValue(stage.durationDays), priceAmount: moneyValue(stage.priceAmount), payment: stage.payment.trim(), startCondition: stage.startCondition.trim(), order: index + 1 })) : []
  const stageTotal = stages.reduce((sum, stage) => sum + stage.priceAmount, 0)
  const totalPrice = draft.offerType === 'staged' ? stageTotal : moneyValue(draft.totalPrice) || partsTotal
  return { includedItems, excludedItems, clientRequirementItems, priceBreakdown, partsTotal, totalPrice, stages }
}

function buildPayload(draft, computed) {
  return {
    title: draft.title.trim(), summary: draft.summary.trim(), description: draft.summary.trim(), offerType: draft.offerType,
    priceType: draft.priceType, currency: 'EUR', executionMode: draft.offerType === 'staged' ? 'staged' : 'single',
    stages: computed.stages, deliverables: computed.includedItems, priceAmount: computed.totalPrice,
    deliveryDays: moneyValue(draft.timelineDays), revisions: 0, expiresAt: dateToExpiry(draft.validUntil),
    offerDetails: {
      schemaVersion: OFFER_DOCUMENT_VERSION, offerType: draft.offerType, validUntil: draft.validUntil,
      includedItems: computed.includedItems, excludedItems: computed.excludedItems, clientRequirements: computed.clientRequirementItems,
      priceType: draft.priceType, priceBreakdown: computed.priceBreakdown, materialsMode: draft.materialsMode, vatStatus: draft.vatStatus,
      timeline: { days: moneyValue(draft.timelineDays), earliestStartDate: draft.earliestStartDate, dependencies: draft.timelineDependencies.trim() },
      stages: computed.stages, payment: { method: draft.paymentMethod, terms: draft.paymentTerms.trim(), notes: draft.paymentNotes.trim() },
      conditions: { scopeChanges: draft.scopeChangeTerms.trim(), cancellation: draft.cancellationTerms.trim(), unforeseenWork: draft.unforeseenTerms.trim() },
    },
  }
}

function validateStep(step, draft, computed) {
  if (step === 1) return [!draft.title.trim() && 'Добави заглавие.', !draft.summary.trim() && 'Добави кратко резюме.'].filter(Boolean)
  if (step === 2 && draft.offerType !== 'estimate' && computed.includedItems.length === 0) return ['Добави поне една включена дейност.']
  if (step === 3 && draft.offerType !== 'estimate' && computed.totalPrice <= 0) return ['Добави валидна цена.']
  if (step === 4 && draft.offerType === 'staged') {
    if (computed.stages.length < 2) return ['Добави поне два етапа.']
    if (computed.stages.some((stage) => !stage.title || stage.priceAmount <= 0)) return ['Всеки етап трябва да има заглавие и цена.']
  }
  return []
}

function splitLines(value = '') { return String(value || '').split('\n').map((item) => item.trim()).filter(Boolean) }
function moneyValue(value) { const parsed = Number(String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.')); return Number.isFinite(parsed) && parsed > 0 ? parsed : 0 }
function dateToExpiry(value = '') { if (!value) return null; const date = new Date(`${value}T23:59:59+03:00`); return Number.isNaN(date.getTime()) ? null : date.toISOString() }

function Field({ label, children }) { return <label className="mt-4 block text-sm font-medium text-ink first:mt-0">{label}{children}</label> }
function MoneyInput({ label, value, onChange, placeholder = '' }) { return <Field label={label}><div className="relative mt-2"><input type="number" min="0" step="0.01" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`${INPUT} !mt-0 pr-12`} /><span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-muted">€</span></div></Field> }
function ErrorPanel({ errors }) { return <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><ul className="space-y-1">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> }
