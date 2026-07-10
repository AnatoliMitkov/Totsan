import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { Link } from 'react-router-dom'
<<<<<<< HEAD
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
=======
import {
  ArrowLeft, ArrowRight,
  CalendarDays, CheckCircle2, ClipboardList, CreditCard,
  Eye, FilePlus2, Layers3, Lock, Plus, Settings2, Trash2, X,
} from 'lucide-react'
import { formatEurWithBgn } from '../../lib/money.js'
import OfferDocumentView from '../offers/OfferDocumentView.jsx'
import TotsanSelect from '../ui/TotsanSelect.jsx'

/* ─── constants ─────────────────────────────────────────────── */

const DRAFT_PREFIX = 'totsan:offer-draft:v2:'

const STEPS = [
  { id: 'basics',     label: 'Основи',      icon: ClipboardList,  desc: 'Тип, заглавие, резюме' },
  { id: 'scope',      label: 'Обхват',       icon: CheckCircle2, desc: 'Включено, изключения' },
  { id: 'price',      label: 'Цена',         icon: CreditCard,   desc: 'Разбивка и ДДС' },
  { id: 'timeline',   label: 'Срок',         icon: CalendarDays, desc: 'Дати и зависимости' },
  { id: 'staged',     label: 'Етапи',        icon: Layers3,      desc: 'Поетапно изпълнение' },
  { id: 'conditions', label: 'Условия',      icon: Lock,         desc: 'Плащане, отмяна' },
  { id: 'review',     label: 'Преглед',      icon: Eye,          desc: 'Проверка и изпращане' },
]

const OFFER_TYPES = [
  { value: 'final',   label: 'Финална оферта',       desc: 'Готова цена, срок и обхват.',            gradient: 'from-blue-50 to-indigo-50 border-blue-200/40' },
  { value: 'estimate', label: 'Предварителна оценка', desc: 'Ориентир преди оглед или уточнение.', gradient: 'from-amber-50 to-orange-50 border-amber-200/40' },
  { value: 'staged',  label: 'Поетапна оферта',      desc: 'Работа и плащане на отделни етапи.', gradient: 'from-emerald-50 to-teal-50 border-emerald-200/40' },
>>>>>>> worktree-offer-ui-redesign
]

const PRICE_TYPE_OPTIONS = [
  { value: 'fixed', label: 'Фиксирана цена' },
  { value: 'estimate', label: 'Ориентировъчна цена' },
  { value: 'hourly', label: 'Почасова / на ден' },
  { value: 'staged', label: 'По етапи' },
]

const MATERIAL_MODE_OPTIONS = [
  { value: 'included', label: 'Материалите са включени' },
<<<<<<< HEAD
  { value: 'client', label: 'Материалите са от клиента' },
=======
  { value: 'client',   label: 'Материалите са от клиента' },
>>>>>>> worktree-offer-ui-redesign
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

<<<<<<< HEAD
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
=======
function createStage(n) {
  return { title: '', description: '', durationDays: '', priceAmount: '', payment: '', startCondition: '', order: n }
}

function createOfferDraft(sr = null) {
  const snap = sr?.snapshot || {}
  const features = Array.isArray(snap.features) ? snap.features : []
  return {
    offerType: 'final', title: String(snap.package_title || snap.service_title || '').trim(),
    summary: [snap.service_subtitle, snap.package_description].map(v => String(v || '').trim()).filter(Boolean).join('\n\n'),
    validUntil: defaultValidUntil(), included: features.join('\n'), excluded: '', clientRequirements: '',
    priceType: 'fixed', laborPrice: '', materialsPrice: '', transportPrice: '',
    totalPrice: snap.starting_price ? String(snap.starting_price) : '',
    materialsMode: 'separate', vatStatus: 'invoice',
    timelineDays: snap.delivery_days ? String(snap.delivery_days) : '',
    earliestStartDate: '', timelineDependencies: '',
>>>>>>> worktree-offer-ui-redesign
    stages: [createStage(1), createStage(2)],
    paymentMethod: 'platform',
    paymentTerms: 'Плащането се извършва според избрания метод след приемане на офертата.',
    paymentNotes: '',
    scopeChangeTerms: 'Промени извън описания обхват се потвърждават писмено и могат да изискват нова оферта.',
<<<<<<< HEAD
    cancellationTerms: 'При отказ се заплащат извършената работа и предварително одобрените невъзстановими разходи.',
=======
    cancellationTerms: 'При отказ се заплащат извършената работа и предварително одобрени невъзстановими разходи.',
>>>>>>> worktree-offer-ui-redesign
    unforeseenTerms: 'Скрити дефекти и непредвидена допълнителна работа се оферират отделно след потвърждение от клиента.',
  }
}

<<<<<<< HEAD
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
=======
function splitLines(v = '') { return String(v || '').split('\n').map(i => i.trim()).filter(Boolean) }
function moneyValue(v) {
  const p = Number(String(v ?? '').trim().replace(/\s+/g, '').replace(',', '.'))
  return Number.isFinite(p) && p > 0 ? p : 0
}
function dateToExpiry(v = '') {
  if (!v) return null
  const d = new Date(`${v}T23:59:59+03:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/* ─── custom date popover ────────────────────────────────────── */

function MonthCalendar({ value, onChange, onClose }) {
  const now = value ? new Date(value + 'T00:00:00') : new Date()
  const year = now.getFullYear(), month = now.getMonth()
  const label = now.toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startPad = firstDay === 0 ? 6 : firstDay - 1 // Monday start
  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year
  const nextMonth = month === 11 ? 0 : month + 1
  const nextYear = month === 11 ? year + 1 : year
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  function pick(day) {
    const str = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    onChange(str)
    onClose?.()
  }

  return (
    <div className="w-72 rounded-2xl border border-line bg-paper p-4 shadow-[0_24px_64px_-32px_rgba(15,23,42,0.45)] backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => {}} className="btn btn-ghost !px-2 !py-1 text-xs" aria-label="Предишен месец">
          <ArrowLeft size={14} />
        </button>
        <span className="text-sm font-semibold capitalize text-ink">{label}</span>
        <button type="button" onClick={() => {}} className="btn btn-ghost !px-2 !py-1 text-xs" aria-label="Следващ месец">
          <ArrowRight size={14} />
        </button>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-0.5">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(d => (
          <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const val = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isToday = val === todayStr
          const isSelected = val === value
          return (
            <button key={val} type="button" onClick={() => pick(day)}
              className={`flex h-8 w-8 place-items-center rounded-full text-sm transition ${isSelected ? 'bg-ink text-paper shadow-sm' : isToday ? 'font-bold text-accentDeep' : 'text-ink hover:bg-soft'}`}>
              {day}
            </button>
          )
        })}
      </div>
>>>>>>> worktree-offer-ui-redesign
    </div>
  )
}

<<<<<<< HEAD
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
=======
function DatePicker({ value, onChange, label }) {
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  const [focusVal, setFocusVal] = useState(value)

  useEffect(() => { setFocusVal(value) }, [value])

  useEffect(() => {
    if (!open) return
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  useEffect(() => { setFocusVal(value) }, [value])

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-accent/10">
        <span className={value ? '' : 'text-muted'}>{value ? new Date(value + 'T00:00:00').toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Избери дата'}</span>
        <CalendarDays size={16} className="text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 origin-top animate-popover-in">
          <MonthCalendar value={focusVal} onChange={(v) => { setFocusVal(v); onChange(v) }} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}

/* ─── input primitives ───────────────────────────────────────── */

function Field({ label, hint, children }) {
  return <label className="block text-sm font-medium text-ink first:mt-0">{label}{hint ? <span className="ml-1.5 text-xs font-normal text-muted">{hint}</span> : null}{children}</label>
}

function TextInput({ label, ...props }) {
  return <Field label={label}><input {...props} className="mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-accent/10" /></Field>
}

function TextArea({ label, ...props }) {
  return <Field label={label}><textarea {...props} className="mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-accent/10 resize-y leading-6" /></Field>
}

function MoneyInput({ label, value, onChange, placeholder }) {
  return (
    <Field label={label}>
      <div className="relative mt-2">
        <input type="number" min="0" step="0.01" inputMode="decimal" value={value}
          onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full rounded-2xl border border-line bg-paper pl-4 pr-12 py-3 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-accent/10" />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-muted">€</span>
      </div>
    </Field>
  )
}

/* ─── main component ─────────────────────────────────────────── */

export default function OfferComposer({ open, onClose, onSubmit, status, serviceRequest = null, conversationId = '' }) {
  const overlayRef = useRef(null)
  const panelRef = useRef(null)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState([])
  const draftKey = `${DRAFT_PREFIX}${serviceRequest?.id || conversationId || 'new'}`
  const [draft, setDraft] = useState(() => createOfferDraft(serviceRequest))

  useEffect(() => {
    if (!open) return
    let next = createOfferDraft(serviceRequest)
    try { const saved = JSON.parse(localStorage.getItem(draftKey) || 'null')
      if (saved && typeof saved === 'object') next = { ...next, ...saved }
    } catch {}
    setDraft(next); setStep(0); setErrors([])
  }, [open, draftKey, serviceRequest?.id])

  useEffect(() => {
    if (!open) return
    try { localStorage.setItem(draftKey, JSON.stringify(draft)) } catch {}
  }, [draft, draftKey, open])

  // GSAP entrance
  useEffect(() => {
    if (!open) return
    const tl = gsap.timeline()
    if (overlayRef.current) tl.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' })
    if (panelRef.current) tl.fromTo(panelRef.current, { opacity: 0, y: 32, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power2.out' }, '-=0.15')
    return () => tl.kill()
  }, [open])

  const computed = useMemo(() => {
    const includedItems = splitLines(draft.included)
    const excludedItems = splitLines(draft.excluded)
    const clientReqItems = splitLines(draft.clientRequirements)
    const pb = { labor: moneyValue(draft.laborPrice), materials: moneyValue(draft.materialsPrice), transport: moneyValue(draft.transportPrice) }
    const partsTotal = pb.labor + pb.materials + pb.transport
    const totalPrice = draft.offerType === 'staged'
      ? computed.stages.reduce((s, st) => s + moneyValue(st.priceAmount), 0)
      : moneyValue(draft.totalPrice) || partsTotal
    const stages = draft.offerType === 'staged'
      ? draft.stages.map((s, i) => ({ title: s.title.trim(), description: s.description.trim(), durationDays: moneyValue(s.durationDays), priceAmount: moneyValue(s.priceAmount), payment: s.payment.trim(), startCondition: s.startCondition.trim(), order: i + 1 })).filter(s => s.title || s.description || s.priceAmount > 0)
      : []
    return { includedItems, excludedItems, clientReqItems, pb, partsTotal, totalPrice, stages }
  }, [draft])

  function set(k, v) { setErrors([]); setDraft(c => ({ ...c, [k]: v })) }
  function setOfferType(t) {
    setDraft(c => ({ ...c, offerType: t, priceType: t === 'staged' ? 'staged' : c.priceType === 'staged' ? 'fixed' : c.priceType, paymentMethod: t === 'staged' ? 'staged_platform' : c.paymentMethod === 'staged_platform' ? 'platform' : c.paymentMethod, stages: c.stages.length >= 2 ? c.stages : [createStage(1), createStage(2)] }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!draft.title.trim() || !draft.summary.trim()) { setErrors(['Попълни заглавие и резюме.']); return }
    if (draft.offerType !== 'estimate' && computed.includedItems.length === 0) { setErrors(['Добави поне една включена дейност.']); return }
    if (draft.offerType !== 'estimate' && computed.totalPrice <= 0) { setErrors(['Добави валидна цена.']); return }
    if (draft.offerType === 'staged') {
      if (computed.stages.length < 2) { setErrors(['Добави поне два етапа.']); return }
      if (computed.stages.some(s => !s.title || s.priceAmount <= 0)) { setErrors(['Всеки етап трябва да има заглавие и цена.']); return }
    }
    if (!draft.paymentTerms.trim() || !draft.cancellationTerms.trim()) { setErrors(['Попълни условия за плащане и отмяна.']); return }

    const payload = {
      title: draft.title.trim(), summary: draft.summary.trim(), description: draft.summary.trim(),
      offerType: draft.offerType, priceType: draft.priceType, currency: 'EUR',
      executionMode: draft.offerType === 'staged' ? 'staged' : 'single',
      stages: computed.stages, deliverables: computed.includedItems,
      priceAmount: computed.totalPrice, deliveryDays: moneyValue(draft.timelineDays),
      revisions: 0, expiresAt: dateToExpiry(draft.validUntil),
      offerDetails: {
        offerType: draft.offerType, validUntil: draft.validUntil,
        includedItems: computed.includedItems, excludedItems: computed.excludedItems,
        clientRequirements: computed.clientReqItems, priceType: draft.priceType,
        priceBreakdown: computed.pb, materialsMode: draft.materialsMode, vatStatus: draft.vatStatus,
        timeline: { days: moneyValue(draft.timelineDays), earliestStartDate: draft.earliestStartDate, dependencies: draft.timelineDependencies.trim() },
        stages: computed.stages,
        payment: { method: draft.paymentMethod, terms: draft.paymentTerms.trim(), notes: draft.paymentNotes.trim() },
        conditions: { scopeChanges: draft.scopeChangeTerms.trim(), cancellation: draft.cancellationTerms.trim(), unforeseenWork: draft.unforeseenTerms.trim() },
      },
    }
    const ok = await onSubmit(payload)
    if (ok !== false) localStorage.removeItem(draftKey)
  }

  const current = STEPS[step]
  const icon = current ? current.icon : ClipboardList

  if (!open) return null

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink/50 px-4 py-8 backdrop-blur-sm sm:px-6 sm:py-12" role="dialog" aria-modal="true" aria-label="Създаване на оферта">
      <form onSubmit={submit} ref={panelRef} className="flex max-h-[92dvh] w-full max-w-[1200px] flex-col overflow-hidden rounded-3xl border border-line bg-paper shadow-2xl">
        {/* Header */}
        <header className="shrink-0 border-b border-line px-6 py-5 md:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow">Оферта</div>
              <h2 className="mt-1 font-display text-2xl text-ink">{current?.label || 'Оферта'}</h2>
            </div>
            <button type="button" onClick={onClose} className="btn btn-ghost shrink-0 !px-3 !py-2" aria-label="Затвори"><X size={18} /></button>
          </div>
          {/* Step pills */}
          <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="Стъпки">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const done = i < step
              const active = i === step
              return (
                <button key={s.id} type="button" onClick={() => done && setStep(i)} disabled={!done}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${done ? 'border-line bg-soft text-ink hover:border-ink/40' : active ? 'border-ink bg-ink text-paper shadow-sm' : 'border-line/60 bg-paper/60 text-muted opacity-50'}`}>
                  <Icon size={14} />
                  <span className="hidden sm:inline">{s.label}</span>
                  {done && <CheckCircle2 size={13} className="text-accentDeep" />}
                </button>
              )
            })}
          </nav>
        </header>

        {/* Body */}
        <div className="totsan-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-0 lg:grid-cols-[1fr_22rem]">
            <main className="px-6 py-6 md:px-8 md:py-7">
              <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-ink">
                {current && <current.icon size={18} className="text-accentDeep" />}
                <span>{current?.desc}</span>
              </div>
              {errors.length > 0 && (
                <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <ul className="space-y-1">{errors.map(e => <li key={e}>{e}</li>)}</ul>
                </div>
              )}

              {step === 0 && <StepBasics draft={draft} set={set} setOfferType={setOfferType} />}
              {step === 1 && <StepScope draft={draft} set={set} />}
              {step === 2 && <StepPrice draft={draft} set={set} computed={computed} />}
              {step === 3 && <StepTimeline draft={draft} set={set} />}
              {step === 4 && <StepStages draft={draft} set={set} setStage={(i,k,v) => setDraft(c => ({ ...c, stages: c.stages.map((s,idx) => idx===i ? {...s,[k]:v} : s) }))} addStage={() => setDraft(c => ({ ...c, stages: [...c.stages, createStage(c.stages.length+1)] }))} removeStage={idx => setDraft(c => ({ ...c, stages: c.stages.filter((_,i)=>i!==idx).map((s,i)=>({...s,order:i+1})) }))} />}
              {step === 5 && <StepConditions draft={draft} set={set} />}
              {step === 6 && <OfferDocumentView offer={{ ...computeDoc(draft, computed), status: 'draft' }} showStatus={false} />}
            </main>

            {/* Sticky sidebar preview */}
            {step !== 6 && (
              <aside className="border-t border-line bg-soft/50 px-5 py-5 lg:sticky lg:top-0 lg:max-h-[calc(92dvh-10rem)] lg:overflow-y-auto lg:border-l lg:border-t-0">
                <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                  <Eye size={15} /> Преглед
                </div>
                <div className="rounded-2xl border border-line bg-paper p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted">
                    {OFFER_TYPES.find(t => t.value === draft.offerType)?.label || 'Оферта'}
                  </div>
                  <h3 className="mt-2 break-words font-display text-lg text-ink">{draft.title || 'Заглавие'}</h3>
                  {draft.summary && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted">{draft.summary}</p>}
                  <div className="mt-4 space-y-2 text-sm">
                    <PreviewRow label="Цена" value={computed.totalPrice ? formatEurWithBgn(computed.totalPrice) : '—'} />
                    <PreviewRow label="Срок" value={draft.timelineDays ? `${draft.timelineDays} дни` : '—'} />
                    <PreviewRow label="Валидна до" value={draft.validUntil || '—'} />
                  </div>
                  {computed.includedItems.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Включено</div>
                      <ul className="mt-1 space-y-1 text-xs text-ink">
                        {computed.includedItems.slice(0, 5).map((item, i) => (
                          <li key={i} className="flex gap-1.5"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-accentDeep" /><span>{item}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <p className="mt-4 text-xs leading-5 text-muted">
                  Изпращането потвърждава <Link to="/obshti-usloviya" className="font-semibold text-accent hover:underline">Общите условия</Link>.
                </p>
              </aside>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4 md:px-8">
          <div className="text-xs text-muted">Черновата се запазва автоматично.</div>
          <div className="flex gap-2">
            {step > 0 && <button type="button" onClick={() => { setErrors([]); setStep(s => s - 1) }} className="btn btn-ghost"><ArrowLeft size={17} /> Назад</button>}
            {step < STEPS.length - 1
              ? <button type="button" onClick={() => { setErrors([]); setStep(s => s + 1) }} className="btn btn-primary">Напред <ArrowRight size={17} /></button>
              : <button disabled={status === 'sending'} className="btn btn-primary disabled:opacity-50">{status === 'sending' ? 'Изпраща се...' : 'Изпрати офертата'}</button>}
          </div>
        </footer>
      </form>
    </div>
  )
}

/* ─── step components ────────────────────────────────────────── */

function StepBasics({ draft, set, setOfferType }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-ink">Тип оферта</h3>
        <p className="mt-1 text-sm text-muted">Избери какъв тип оферта искаш да създадеш.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {OFFER_TYPES.map(t => (
          <button key={t.value} type="button" onClick={() => setOfferType(t.value)}
            className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-200 ${draft.offerType === t.value ? 'border-ink bg-soft shadow-md ring-1 ring-ink/5' : 'border-line/70 bg-paper hover:border-ink/30'}`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${t.gradient} opacity-0 transition-opacity group-hover:opacity-50 ${draft.offerType === t.value ? 'opacity-50' : ''}`} />
            <div className="relative">
              <div className="text-sm font-semibold text-ink">{t.label}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{t.desc}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
        <TextInput label="Заглавие" value={draft.title} onChange={e => set('title', e.target.value)} autoFocus />
        <DatePicker label="Валидна до" value={draft.validUntil} onChange={v => set('validUntil', v)} />
      </div>
      <TextArea label="Кратко резюме" rows={4} value={draft.summary} onChange={e => set('summary', e.target.value)} />
    </div>
  )
}

function StepScope({ draft, set }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <TextArea label="Включено" placeholder="Един ред = една точка" rows={10} value={draft.included} onChange={e => set('included', e.target.value)} />
      <TextArea label="Не е включено" rows={10} value={draft.excluded} onChange={e => set('excluded', e.target.value)} />
      <TextArea label="Клиентът осигурява" rows={10} value={draft.clientRequirements} onChange={e => set('clientRequirements', e.target.value)} />
    </div>
  )
}

function StepPrice({ draft, set, computed }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <TotsanSelect label="Тип цена" value={draft.priceType} onChange={v => set('priceType', v)} options={PRICE_TYPE_OPTIONS} buttonClassName="mt-2 bg-paper" />
        <TotsanSelect label="Материали" value={draft.materialsMode} onChange={v => set('materialsMode', v)} options={MATERIAL_MODE_OPTIONS} buttonClassName="mt-2 bg-paper" />
      </div>
      {draft.offerType === 'staged'
        ? <div className="rounded-2xl border border-line bg-soft p-4 text-sm text-muted">Общата цена се изчислява от етапите: <strong className="text-ink">{computed.totalPrice ? formatEurWithBgn(computed.totalPrice) : '0 €'}</strong></div>
        : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MoneyInput label="Труд" value={draft.laborPrice} onChange={v => set('laborPrice', v)} />
            <MoneyInput label="Материали" value={draft.materialsPrice} onChange={v => set('materialsPrice', v)} />
            <MoneyInput label="Транспорт" value={draft.transportPrice} onChange={v => set('transportPrice', v)} />
            <MoneyInput label="Общо" value={draft.totalPrice} onChange={v => set('totalPrice', v)} placeholder={computed.partsTotal ? String(computed.partsTotal) : ''} />
          </div>
      }
      <TotsanSelect label="ДДС статус" value={draft.vatStatus} onChange={v => set('vatStatus', v)} options={VAT_STATUS_OPTIONS} buttonClassName="mt-2 bg-paper" />
      {draft.offerType !== 'staged' && (
        <div className="rounded-2xl border border-line bg-soft/80 px-4 py-3 text-sm text-muted">
          Показване към клиента: <span className="font-semibold text-ink">{computed.totalPrice ? formatEurWithBgn(computed.totalPrice) : 'По уточнение'}</span>
        </div>
      )}
    </div>
  )
}

function StepTimeline({ draft, set }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[10rem_minmax(0,1fr)]">
        <TextInput label="Работни дни" type="number" min="0" value={draft.timelineDays} onChange={e => set('timelineDays', e.target.value)} />
        <DatePicker label="Най-ранен старт" value={draft.earliestStartDate} onChange={v => set('earliestStartDate', v)} />
      </div>
      <TextInput label="Зависимости" value={draft.timelineDependencies} onChange={e => set('timelineDependencies', e.target.value)} hint="Какво трябва да е готово преди старта." />
    </div>
  )
}

function StepStages({ draft, set, setStage, addStage, removeStage }) {
  return (
    <div className="space-y-4">
      {draft.stages.map((stage, i) => (
        <div key={`stage-${i}`} className="rounded-2xl border border-line bg-soft/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper">{i + 1}</span>
              <span className="text-sm font-semibold text-ink">Етап {i + 1}</span>
            </div>
            <button type="button" onClick={() => removeStage(i)} disabled={draft.stages.length <= 2}
              className="btn btn-ghost !px-3 !py-2 text-sm disabled:opacity-30"><Trash2 size={16} /></button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextInput label="Заглавие" value={stage.title} onChange={e => setStage(i, 'title', e.target.value)} />
            <MoneyInput label="Цена" value={stage.priceAmount} onChange={v => setStage(i, 'priceAmount', v)} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextArea label="Описание" rows={2} value={stage.description} onChange={e => setStage(i, 'description', e.target.value)} />
            <TextInput label="Дни" type="number" min="0" value={stage.durationDays} onChange={e => setStage(i, 'durationDays', e.target.value)} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <TextInput label="Условие за старт" value={stage.startCondition} onChange={e => setStage(i, 'startCondition', e.target.value)} />
            <TextInput label="Бележка за плащане" value={stage.payment} onChange={e => setStage(i, 'payment', e.target.value)} />
          </div>
        </div>
      ))}
      <button type="button" onClick={addStage} className="btn btn-ghost w-full justify-center sm:w-auto"><Plus size={17} /> Добави етап</button>
    </div>
  )
}

function StepConditions({ draft, set }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <TotsanSelect label="Метод на плащане" value={draft.paymentMethod} onChange={v => set('paymentMethod', v)} options={PAYMENT_METHOD_OPTIONS} buttonClassName="mt-2 bg-paper" />
        <TextInput label="Бележка" value={draft.paymentNotes} onChange={e => set('paymentNotes', e.target.value)} />
      </div>
      <TextArea label="Условия за плащане" rows={4} value={draft.paymentTerms} onChange={e => set('paymentTerms', e.target.value)} />
      <TextArea label="Отказ / анулиране" rows={3} value={draft.cancellationTerms} onChange={e => set('cancellationTerms', e.target.value)} />
      <TextArea label="Промени в обхвата" rows={3} value={draft.scopeChangeTerms} onChange={e => set('scopeChangeTerms', e.target.value)} />
      <TextArea label="Непредвидена работа" rows={3} value={draft.unforeseenTerms} onChange={e => set('unforeseenTerms', e.target.value)} />
    </div>
  )
}

function PreviewRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line/60 bg-soft/80 px-3 py-2 text-xs">
      <span className="text-muted">{label}</span>
      <span className="break-words text-right font-semibold text-ink">{value}</span>
>>>>>>> worktree-offer-ui-redesign
    </div>
    {servicesStatus === 'loading' && <p className="mt-4 text-sm text-muted">Зареждаме твоите услуги…</p>}
    {servicesStatus !== 'loading' && !serviceRequest && (!services || services.length === 0) && <p className="mt-4 text-sm text-muted">Нямаш готови услуги за импорт. Можеш да започнеш с празна оферта.</p>}
  </div>
}

<<<<<<< HEAD
function ScopeStep({ draft, set }) {
  return <div className="grid gap-4 md:grid-cols-3"><Field label="Включено"><textarea rows={12} value={draft.included} onChange={(event) => set('included', event.target.value)} className={TEXTAREA} placeholder="Един ред = една точка" /></Field><Field label="Не е включено"><textarea rows={12} value={draft.excluded} onChange={(event) => set('excluded', event.target.value)} className={TEXTAREA} /></Field><Field label="Клиентът осигурява"><textarea rows={12} value={draft.clientRequirements} onChange={(event) => set('clientRequirements', event.target.value)} className={TEXTAREA} /></Field></div>
=======
function computeDoc(draft, c) {
  return {
    offerType: draft.offerType, title: draft.title, summary: draft.summary,
    priceAmount: c.totalPrice, currency: 'EUR',
    includedItems: c.includedItems, excludedItems: c.excludedItems,
    clientRequirements: c.clientReqItems, priceType: draft.priceType,
    materialsMode: draft.materialsMode, vatStatus: draft.vatStatus,
    timeline: { days: moneyValue(draft.timelineDays), earliestStartDate: draft.earliestStartDate, dependencies: draft.timelineDependencies.trim() },
    stages: c.stages,
    payment: { method: draft.paymentMethod, terms: draft.paymentTerms.trim(), notes: draft.paymentNotes.trim() },
    conditions: { scopeChanges: draft.scopeChangeTerms.trim(), cancellation: draft.cancellationTerms.trim(), unforeseenWork: draft.unforeseenTerms.trim() },
    validUntil: draft.validUntil,
  }
>>>>>>> worktree-offer-ui-redesign
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
