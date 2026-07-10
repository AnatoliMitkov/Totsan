import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { Link } from 'react-router-dom'
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
]

const PRICE_TYPE_OPTIONS = [
  { value: 'fixed', label: 'Фиксирана цена' },
  { value: 'estimate', label: 'Ориентировъчна цена' },
  { value: 'hourly', label: 'Почасова / на ден' },
  { value: 'staged', label: 'По етапи' },
]

const MATERIAL_MODE_OPTIONS = [
  { value: 'included', label: 'Материалите са включени' },
  { value: 'client',   label: 'Материалите са от клиента' },
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
    stages: [createStage(1), createStage(2)],
    paymentMethod: 'platform',
    paymentTerms: 'Плащането се извършва според избрания метод след приемане на офертата.',
    paymentNotes: '',
    scopeChangeTerms: 'Промени извън описания обхват се потвърждават писмено и могат да изискват нова оферта.',
    cancellationTerms: 'При отказ се заплащат извършената работа и предварително одобрени невъзстановими разходи.',
    unforeseenTerms: 'Скрити дефекти и непредвидена допълнителна работа се оферират отделно след потвърждение от клиента.',
  }
}

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
    </div>
  )
}

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
    </div>
  )
}

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
}
