import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  CreditCard,
  Eye,
  FilePlus2,
  GripVertical,
  History,
  Layers3,
  LoaderCircle,
  Plus,
  Save,
  ScanSearch,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { formatEurWithBgn } from '../../lib/money.js'
import { OFFER_DOCUMENT_VERSION, offerDocumentFromDraft, validateOfferDocument } from '../../lib/offers.js'
import OfferDocumentView from '../offers/OfferDocumentView.jsx'
import TotsanDatePicker from '../ui/TotsanDatePicker.jsx'
import TotsanSelect from '../ui/TotsanSelect.jsx'

const CONTROL = 'mt-2 min-h-12 w-full rounded-xl border bg-paper px-4 py-3 text-sm text-ink shadow-[0_16px_38px_-34px_rgba(13,35,64,0.5)] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-muted/65 hover:border-ink/25 focus:border-accent focus:ring-4 focus:ring-accent/10'
const TEXTAREA = `${CONTROL} resize-y leading-6`
const DRAFT_PREFIX = 'totsan:offer-draft:v2:'
const LAST_USED_OFFER_PREFIX = 'totsan:last-used-offer:v1:'

const STEPS = [
  { title: 'Начало', shortTitle: 'Начало', description: 'Избери готова услуга или започни от празна оферта.', icon: FilePlus2 },
  { title: 'Основи', shortTitle: 'Основи', description: 'Определи вида и най-важното, което клиентът ще види.', icon: ClipboardList },
  { title: 'Обхват', shortTitle: 'Обхват', description: 'Опиши ясно резултата и границите на работата.', icon: CheckCircle2 },
  { title: 'Цена', shortTitle: 'Цена', description: 'Подреди цената, материалите и данъчния статус.', icon: CreditCard },
  { title: 'Изпълнение', shortTitle: 'План', description: 'Задай срок, старт и етапи на изпълнение.', icon: Layers3 },
  { title: 'Преглед', shortTitle: 'Преглед', description: 'Провери точно какво ще получи клиентът.', icon: Eye },
]

const OFFER_TYPES = [
  { value: 'final', title: 'Финална оферта', description: 'Готови цена, срок и обхват.', icon: BadgeCheck },
  { value: 'estimate', title: 'Предварителна оценка', description: 'Ориентир преди оглед или уточнение.', icon: ScanSearch },
  { value: 'staged', title: 'Поетапна оферта', description: 'Работа и плащане на отделни етапи.', icon: Layers3 },
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

function localDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultValidUntil() {
  const date = new Date()
  date.setDate(date.getDate() + 14)
  return localDateValue(date)
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

export default function OfferComposer({ open, onClose, onSubmit, status, userId = '', serviceRequest = null, conversationId = '', services = [], servicesStatus = 'idle' }) {
  const draftKey = `${DRAFT_PREFIX}${serviceRequest?.id || conversationId || 'new'}`
  const lastUsedOfferKey = `${LAST_USED_OFFER_PREFIX}${userId || 'local'}`
  const [draft, setDraft] = useState(() => createOfferDraft(serviceRequest))
  const [hasSavedDraft, setHasSavedDraft] = useState(false)
  const [lastUsedDraft, setLastUsedDraft] = useState(null)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState([])
  const [sent, setSent] = useState(false)
  const backdropRef = useRef(null)
  const panelRef = useRef(null)
  const scrollerRef = useRef(null)
  const stepContentRef = useRef(null)
  const errorPanelRef = useRef(null)
  const previousFocusRef = useRef(null)
  const previousStepRef = useRef(0)
  const closingRef = useRef(false)
  const closeTimerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    let next = createOfferDraft(serviceRequest)
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null')
      if (saved && typeof saved === 'object') {
        next = restoreOfferDraft(next, saved)
        setHasSavedDraft(hasMeaningfulDraft(saved))
      } else {
        setHasSavedDraft(false)
      }
      const lastUsed = JSON.parse(localStorage.getItem(lastUsedOfferKey) || 'null')
      setLastUsedDraft(lastUsed && typeof lastUsed === 'object' && hasMeaningfulDraft(lastUsed) ? lastUsed : null)
    } catch {
      // A broken local draft must never block creating an offer.
      setHasSavedDraft(false)
      setLastUsedDraft(null)
    }
    setDraft(next)
    setStep(0)
    setErrors([])
    setSent(false)
    previousStepRef.current = 0
    closingRef.current = false
  }, [open, draftKey, lastUsedOfferKey, serviceRequest?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || sent) return
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft))
    } catch {
      // The form remains usable when browser storage is unavailable.
    }
  }, [draft, draftKey, open, sent])

  useLayoutEffect(() => {
    if (!open || !backdropRef.current || !panelRef.current) return undefined
    if (prefersReducedMotion()) return undefined
    const context = gsap.context(() => {
      gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' })
      gsap.fromTo(panelRef.current, { opacity: 0, y: 16, scale: 0.985 }, { opacity: 1, y: 0, scale: 1, duration: 0.26, ease: 'power2.out' })
    })
    return () => context.revert()
  }, [open])

  useLayoutEffect(() => {
    if (!open || sent || !stepContentRef.current) return undefined
    scrollerRef.current?.scrollTo({ top: 0 })
    const direction = step >= previousStepRef.current ? 1 : -1
    previousStepRef.current = step
    if (prefersReducedMotion()) return undefined
    const animation = gsap.fromTo(
      stepContentRef.current,
      { opacity: 0.55, y: 8 * direction },
      { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out', clearProps: 'opacity,transform' },
    )
    return () => animation.kill()
  }, [open, sent, step])

  useEffect(() => {
    if (!open) return undefined
    previousFocusRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 0)
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        requestClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(panelRef.current?.querySelectorAll(focusableSelector) || [])
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      previousFocusRef.current?.focus?.()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const computed = useMemo(() => computeDraft(draft), [draft])
  const payload = useMemo(() => buildPayload(draft, computed), [draft, computed])
  const preview = useMemo(() => offerDocumentFromDraft(payload), [payload])
  const fieldErrors = useMemo(() => Object.fromEntries(errors.filter((error) => error.field).map((error) => [error.field, error.message])), [errors])

  if (!open) return null

  function requestClose() {
    if (closingRef.current || status === 'sending') return
    closingRef.current = true
    if (prefersReducedMotion() || !panelRef.current || !backdropRef.current) {
      onClose()
      return
    }
    gsap.to(panelRef.current, { opacity: 0, y: 10, scale: 0.99, duration: 0.15, ease: 'power1.in' })
    gsap.to(backdropRef.current, { opacity: 0, duration: 0.16, ease: 'power1.in', onComplete: onClose })
  }

  function set(key, value) {
    setErrors((current) => current.filter((error) => error.field && error.field !== key))
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

  function setPriceBreakdown(key, value) {
    setErrors((current) => current.filter((error) => !['totalPrice', 'priceBreakdown'].includes(error.field)))
    setDraft((current) => {
      const next = { ...current, [key]: value }
      const sum = moneyValue(next.laborPrice) + moneyValue(next.materialsPrice) + moneyValue(next.transportPrice)
      return sum > 0 ? { ...next, totalPrice: String(sum) } : next
    })
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

  function startBlankOffer() {
    // "Blank" must clear a template that was selected earlier in this session.
    setDraft(createOfferDraft())
    setErrors([])
    setStep(1)
  }

  function continueSavedDraft() {
    setErrors([])
    setStep(1)
  }

  function useLastOfferTemplate() {
    if (!lastUsedDraft) return
    const next = restoreOfferDraft(createOfferDraft(), lastUsedDraft)
    next.validUntil = isValidCurrentOrFutureDate(next.validUntil) ? next.validUntil : defaultValidUntil()
    setDraft(next)
    setErrors([])
    setStep(1)
  }

  function addStage() {
    setErrors([])
    setDraft((current) => ({ ...current, stages: [...current.stages, createStage(current.stages.length + 1)] }))
  }

  function removeStage(index) {
    setErrors([])
    setDraft((current) => ({
      ...current,
      stages: current.stages.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, order: itemIndex + 1 })),
    }))
  }

  function moveStage(index, direction) {
    setErrors([])
    setDraft((current) => {
      const target = index + direction
      if (target < 0 || target >= current.stages.length) return current
      const stages = [...current.stages]
      ;[stages[index], stages[target]] = [stages[target], stages[index]]
      return { ...current, stages: stages.map((stage, itemIndex) => ({ ...stage, order: itemIndex + 1 })) }
    })
  }

  function setStage(index, key, value) {
    setErrors((current) => current.filter((error) => !String(error.field || '').startsWith('stage')))
    setDraft((current) => ({
      ...current,
      stages: current.stages.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    }))
  }

  function goBack() {
    setErrors([])
    setStep((current) => Math.max(0, current - 1))
  }

  function goNext() {
    const nextErrors = validateStep(step, draft, computed)
    if (nextErrors.length > 0) {
      setErrors(nextErrors)
      window.requestAnimationFrame(() => errorPanelRef.current?.focus())
      return
    }
    setErrors([])
    setStep((current) => Math.min(STEPS.length - 1, current + 1))
  }

  async function submit() {
    if (status === 'sending') return
    const result = validateOfferDocument(preview)
    if (!result.valid) {
      const nextErrors = result.errors.map((message) => ({ message, field: fieldForDocumentError(message, draft.offerType) }))
      const targetStep = stepForDocumentErrors(nextErrors)
      if (targetStep !== step) setStep(targetStep)
      setErrors(nextErrors)
      window.requestAnimationFrame(() => errorPanelRef.current?.focus())
      return
    }
    const succeeded = await onSubmit(payload)
    if (succeeded === false) {
      setErrors([{ field: '', message: 'Офертата не се изпрати. Провери връзката и опитай отново.' }])
      window.requestAnimationFrame(() => errorPanelRef.current?.focus())
      return
    }
    try {
      localStorage.setItem(lastUsedOfferKey, JSON.stringify(draft))
      setLastUsedDraft(draft)
      localStorage.removeItem(draftKey)
      setHasSavedDraft(false)
    } catch {
      // Sending must still succeed if local template storage is unavailable.
    }
    setSent(true)
    closeTimerRef.current = window.setTimeout(onClose, 900)
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-ink/60 p-0 backdrop-blur-sm sm:p-4 lg:p-6"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose() }}
    >
      <div
        ref={panelRef}
        className="flex h-[100dvh] w-full flex-col overflow-hidden border-line bg-paper shadow-[0_32px_100px_-36px_rgba(6,20,38,0.6)] outline-none sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-[1320px] sm:rounded-[2rem] sm:border lg:max-h-[min(900px,calc(100dvh-2rem))]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-composer-title"
        aria-describedby="offer-composer-description"
        tabIndex={-1}
      >
        {sent ? (
          <SuccessState />
        ) : (
          <>
            <header className="shrink-0 border-b border-line bg-paper/95 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur sm:px-6 sm:py-5 lg:px-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                    <span>Нова оферта</span>
                    <span className="h-1 w-1 rounded-full bg-line" />
                    <span>Стъпка {step + 1} от {STEPS.length}</span>
                  </div>
                  <h2 id="offer-composer-title" className="mt-1 font-display text-[1.75rem] leading-tight text-ink sm:text-3xl">{STEPS[step].title}</h2>
                  <p id="offer-composer-description" className="mt-1 hidden max-w-2xl text-sm text-muted sm:block">{STEPS[step].description}</p>
                </div>
                <button type="button" onClick={requestClose} disabled={status === 'sending'} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-ink/30 hover:bg-soft hover:text-ink focus:outline-none focus:ring-4 focus:ring-accent/10 disabled:opacity-50" aria-label="Затвори"><X size={19} /></button>
              </div>
              <StepNavigation step={step} onSelect={(index) => { setErrors([]); setStep(index) }} />
            </header>

            <div ref={scrollerRef} className="totsan-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div ref={stepContentRef} className={step === 5 ? 'grid min-h-full lg:grid-cols-[minmax(0,1fr)_20.5rem]' : 'min-h-full'}>
                <main className={`min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 ${step === 5 ? 'order-2 lg:order-1' : 'mx-auto w-full max-w-[1180px]'}`}>
                  {errors.length > 0 && <ErrorPanel panelRef={errorPanelRef} errors={errors} />}

                  {step === 0 && <TemplateStep services={services} servicesStatus={servicesStatus} serviceRequest={serviceRequest} hasSavedDraft={hasSavedDraft} lastUsedDraft={lastUsedDraft} onContinueDraft={continueSavedDraft} onUseLastOffer={useLastOfferTemplate} onImport={importService} onBlank={startBlankOffer} />}
                  {step === 1 && <BasicsStep draft={draft} set={set} setOfferType={setOfferType} errors={fieldErrors} />}
                  {step === 2 && <ScopeStep draft={draft} set={set} errors={fieldErrors} />}
                  {step === 3 && <PriceStep draft={draft} set={set} setPriceBreakdown={setPriceBreakdown} computed={computed} errors={fieldErrors} />}
                  {step === 4 && <ExecutionStep draft={draft} set={set} setStage={setStage} addStage={addStage} removeStage={removeStage} moveStage={moveStage} computed={computed} errors={fieldErrors} />}
                  {step === 5 && <ClientPreview preview={preview} />}
                </main>

                {step === 5 && <PaymentSettings draft={draft} set={set} errors={fieldErrors} />}
              </div>
            </div>

            <footer className="shrink-0 border-t border-line bg-paper/95 px-4 pb-[max(0.8rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6 sm:py-4 lg:px-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="hidden items-center gap-2 text-xs text-muted sm:flex"><Save size={15} className="text-accentDeep" /> Черновата се запазва автоматично</div>
                <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                  {step > 0 && <button type="button" onClick={goBack} disabled={status === 'sending'} className="btn btn-ghost min-h-11 shrink-0 !px-4 sm:!px-5"><ArrowLeft size={17} /> <span className="hidden min-[380px]:inline">Назад</span></button>}
                  {step < STEPS.length - 1
                    ? <button type="button" onClick={goNext} className="btn btn-primary min-h-11 flex-1 justify-center sm:flex-none">Продължи <ArrowRight size={17} /></button>
                    : <button type="button" onClick={submit} disabled={status === 'sending'} className="btn btn-primary min-h-11 flex-1 justify-center disabled:opacity-60 sm:flex-none">{status === 'sending' ? <><LoaderCircle size={18} className="animate-spin" /> Изпращаме…</> : <>Изпрати офертата <ArrowRight size={17} /></>}</button>}
                </div>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

function StepNavigation({ step, onSelect }) {
  return (
    <nav className="totsan-scrollbar mt-4 flex gap-1 overflow-x-auto pb-1 sm:grid sm:grid-cols-6 sm:overflow-visible sm:pb-0" aria-label="Стъпки на офертата">
      {STEPS.map((item, index) => {
        const Icon = item.icon
        const current = index === step
        const complete = index < step
        return (
          <button
            key={item.title}
            type="button"
            onClick={() => complete && onSelect(index)}
            disabled={index > step}
            aria-current={current ? 'step' : undefined}
            className={`flex min-h-10 min-w-[4.15rem] items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold outline-none transition focus:ring-4 focus:ring-accent/10 sm:min-w-0 ${current ? 'bg-ink text-paper shadow-sm' : complete ? 'bg-soft text-ink hover:bg-cloud' : 'text-muted/55'}`}
          >
            {complete ? <Check size={15} /> : <Icon size={15} />}
            <span className="hidden truncate md:inline">{item.shortTitle}</span>
            <span className="md:hidden">{index + 1}</span>
          </button>
        )
      })}
    </nav>
  )
}

function BasicsStep({ draft, set, setOfferType, errors }) {
  return (
    <div className="space-y-6">
      <section>
        <SectionLabel>Вид оферта</SectionLabel>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {OFFER_TYPES.map((item) => {
            const Icon = item.icon
            const selected = draft.offerType === item.value
            return (
              <button key={item.value} type="button" onClick={() => setOfferType(item.value)} aria-pressed={selected} className={`relative min-h-[7.5rem] rounded-2xl border p-4 text-left outline-none transition-[border-color,background-color,box-shadow,transform] focus:ring-4 focus:ring-accent/10 ${selected ? 'border-accentDeep bg-accentSoft/65 shadow-[0_18px_38px_-32px_rgba(22,62,162,0.7)]' : 'border-line bg-paper hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-sm'}`}>
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${selected ? 'bg-accentDeep text-paper' : 'bg-soft text-accentDeep'}`}><Icon size={18} /></span>
                <div className="mt-3 pr-5 text-sm font-semibold text-ink">{item.title}</div>
                <p className="mt-1 text-xs leading-5 text-muted">{item.description}</p>
                {selected && <CheckCircle2 size={18} className="absolute right-3 top-3 text-accentDeep" />}
              </button>
            )
          })}
        </div>
      </section>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_15rem]">
        <Field id="offer-title" label="Заглавие" required error={errors.title}>
          <input id="offer-title" value={draft.title} onChange={(event) => set('title', event.target.value)} className={controlClass(errors.title)} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'offer-title-error' : undefined} autoFocus />
        </Field>
        <TotsanDatePicker label="Валидна до" value={draft.validUntil} onChange={(value) => set('validUntil', value)} min={localDateValue(new Date())} required error={errors.validUntil} />
      </div>
      <Field id="offer-summary" label="Кратко резюме" required helper="Едно ясно описание на резултата за клиента." error={errors.summary}>
        <textarea id="offer-summary" rows={5} value={draft.summary} onChange={(event) => set('summary', event.target.value)} className={textareaClass(errors.summary)} aria-invalid={Boolean(errors.summary)} aria-describedby={errors.summary ? 'offer-summary-error' : 'offer-summary-helper'} />
      </Field>
    </div>
  )
}

function TemplateStep({ services, servicesStatus, serviceRequest, hasSavedDraft, lastUsedDraft, onContinueDraft, onUseLastOffer, onImport, onBlank }) {
  return (
    <div>
      {hasSavedDraft && (
        <button type="button" onClick={onContinueDraft} className="mb-5 flex w-full items-start gap-4 rounded-2xl border border-accentDeep/25 bg-accentSoft/55 p-4 text-left transition hover:border-accentDeep/50 sm:p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accentDeep text-paper"><Save size={19} /></span>
          <span className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-accentDeep">Запазена чернова</span>
            <span className="mt-1 block text-sm font-semibold text-ink">Продължи от мястото, до което стигна</span>
            <span className="mt-1 block text-xs leading-5 text-muted">Непратените данни за този разговор са възстановени.</span>
          </span>
          <ArrowRight size={18} className="ml-auto mt-2 shrink-0 text-accentDeep" />
        </button>
      )}

      {serviceRequest && (
        <button type="button" onClick={onBlank} className="mb-5 flex w-full items-start gap-4 rounded-2xl border border-accentDeep/20 bg-accentSoft/55 p-4 text-left transition hover:border-accentDeep/45 sm:p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accentDeep text-paper"><Sparkles size={19} /></span>
          <span className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-accentDeep">Текуща заявка</span>
            <span className="mt-1 block text-sm font-semibold text-ink">Продължи с данните от разговора</span>
            <span className="mt-1 block text-xs leading-5 text-muted">Основната информация вече е попълнена и може да се редактира.</span>
          </span>
          <ArrowRight size={18} className="ml-auto mt-2 shrink-0 text-accentDeep" />
        </button>
      )}

      <SectionLabel>Избери отправна точка</SectionLabel>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(services || []).map((service) => {
          const servicePackage = service.packages?.find((item) => item.isActive !== false) || service.packages?.[0]
          return (
            <button key={service.id} type="button" onClick={() => onImport(service)} className="group flex min-h-[10rem] flex-col rounded-2xl border border-line bg-paper p-4 text-left outline-none transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-[0_20px_46px_-38px_rgba(13,35,64,0.65)] focus:ring-4 focus:ring-accent/10">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Моя услуга</span>
              <span className="mt-2 block text-sm font-semibold text-ink">{service.title}</span>
              {service.subtitle && <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted">{service.subtitle}</span>}
              <span className="mt-auto flex flex-wrap items-center gap-2 pt-4 text-xs font-medium text-ink">{servicePackage?.priceAmount ? formatEurWithBgn(servicePackage.priceAmount) : 'По уточнение'}{servicePackage?.deliveryDays ? <span className="text-muted">· {servicePackage.deliveryDays} дни</span> : null}<ArrowRight size={15} className="ml-auto text-accentDeep transition group-hover:translate-x-0.5" /></span>
            </button>
          )
        })}
        {lastUsedDraft && (
          <button type="button" onClick={onUseLastOffer} className="group flex min-h-[10rem] flex-col rounded-2xl border border-accentDeep/20 bg-accentSoft/35 p-4 text-left outline-none transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-accentDeep/50 hover:bg-accentSoft/60 focus:ring-4 focus:ring-accent/10">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accentDeep text-paper"><History size={19} /></span>
            <span className="mt-3 text-sm font-semibold text-ink">Последно използвана оферта</span>
            <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{lastUsedDraft.title || 'Зареди последно изпратените условия и обхват.'}</span>
            <span className="mt-auto flex items-center gap-1 pt-4 text-xs font-semibold text-accentDeep">Използвай като шаблон <ArrowRight size={14} className="transition group-hover:translate-x-0.5" /></span>
          </button>
        )}
        <button type="button" onClick={onBlank} className="group flex min-h-[10rem] flex-col rounded-2xl border border-dashed border-line bg-soft/45 p-4 text-left outline-none transition-[border-color,background-color] hover:border-ink/35 hover:bg-soft focus:ring-4 focus:ring-accent/10">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-paper text-accentDeep"><FilePlus2 size={19} /></span>
          <span className="mt-3 text-sm font-semibold text-ink">Празна оферта</span>
          <span className="mt-1 text-xs leading-5 text-muted">Започни без готов шаблон.</span>
          <span className="mt-auto flex items-center gap-1 pt-4 text-xs font-semibold text-accentDeep">Създай от нулата <ArrowRight size={14} className="transition group-hover:translate-x-0.5" /></span>
        </button>
        {servicesStatus === 'loading' && [0, 1].map((item) => <div key={item} className="min-h-[10rem] animate-pulse rounded-2xl border border-line bg-soft/70" aria-hidden="true" />)}
      </div>
      {servicesStatus !== 'loading' && !serviceRequest && (!services || services.length === 0) && <p className="mt-4 text-sm text-muted">Нямаш готови услуги за импорт. Започни с празна оферта.</p>}
    </div>
  )
}

function ScopeStep({ draft, set, errors }) {
  const hasOptionalScope = Boolean(draft.excluded.trim() || draft.clientRequirements.trim())
  return (
    <div className="w-full space-y-5">
      <Field id="offer-included" label="Какво е включено" required error={errors.included}>
        <textarea id="offer-included" rows={9} value={draft.included} onChange={(event) => set('included', event.target.value)} className={textareaClass(errors.included)} placeholder={'Един резултат или дейност на ред.\n\nНапример:\nФункционално разпределение\nКонцепция за материали'} aria-invalid={Boolean(errors.included)} aria-describedby={errors.included ? 'offer-included-error' : undefined} />
      </Field>
      <details className="group w-full rounded-2xl border border-line bg-soft/55 p-4 sm:p-5" defaultOpen={hasOptionalScope}>
        <summary className="flex cursor-pointer list-none items-start gap-3 outline-none focus-visible:ring-4 focus-visible:ring-accent/10">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-paper text-accentDeep"><Plus size={18} /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">Граници на обхвата</span><span className="mt-1 block text-xs leading-5 text-muted">Уточни само ако има изключения или ангажименти на клиента.</span></span>
          <ChevronDown size={18} className="mt-2 shrink-0 text-muted transition group-open:rotate-180" />
        </summary>
        <div className="mt-5 space-y-4 border-t border-line pt-4">
          <Field id="offer-excluded" label="Не е включено" optional>
            <textarea id="offer-excluded" rows={4} value={draft.excluded} onChange={(event) => set('excluded', event.target.value)} className={TEXTAREA} placeholder="Един ред = една точка" />
          </Field>
          <Field id="offer-client-requirements" label="Клиентът осигурява" optional>
            <textarea id="offer-client-requirements" rows={4} value={draft.clientRequirements} onChange={(event) => set('clientRequirements', event.target.value)} className={TEXTAREA} placeholder="Един ред = една точка" />
          </Field>
        </div>
      </details>
    </div>
  )
}

function PriceStep({ draft, set, setPriceBreakdown, computed, errors }) {
  const hasBreakdown = Boolean(draft.laborPrice || draft.materialsPrice || draft.transportPrice)
  const [breakdownEnabled, setBreakdownEnabled] = useState(hasBreakdown)

  function enableBreakdown() {
    if (breakdownEnabled) return
    setBreakdownEnabled(true)
    set('totalPrice', '')
  }

  return (
    <div className="space-y-5">
      {draft.offerType === 'staged' ? (
        <div className="rounded-2xl border border-accentDeep/20 bg-accentSoft/55 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="text-sm font-semibold text-ink">Цената се събира от етапите</div><p className="mt-1 text-xs leading-5 text-muted">Ще добавиш цената на всеки етап в следващата стъпка.</p></div>
            <div className="font-display text-3xl text-ink">{computed.totalPrice ? formatEurWithBgn(computed.totalPrice) : '0 €'}</div>
          </div>
        </div>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
          <TotsanSelect label="Тип цена" value={draft.priceType} onChange={(value) => set('priceType', value)} options={PRICE_TYPE_OPTIONS.filter((option) => option.value !== 'staged')} />
          <MoneyInput id="offer-total-price" label="Обща цена" required value={breakdownEnabled ? String(computed.partsTotal || '') : draft.totalPrice} onChange={(value) => set('totalPrice', value)} placeholder={computed.partsTotal ? String(computed.partsTotal) : ''} error={errors.totalPrice} disabled={breakdownEnabled} helper={breakdownEnabled ? 'Изчислява се от ценовата разбивка.' : ''} />
        </div>
      )}

      {draft.offerType !== 'staged' && (
        <details className="group rounded-2xl border border-line bg-paper p-4" defaultOpen={hasBreakdown} onToggle={(event) => { if (event.currentTarget.open) enableBreakdown() }}>
          <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-semibold text-ink outline-none focus-visible:ring-4 focus-visible:ring-accent/10">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-soft text-accentDeep"><Plus size={16} /></span>
            Добави ценова разбивка
            <span className="ml-auto text-xs font-normal text-muted">{breakdownEnabled ? 'Активна' : 'По избор'}</span>
            <ChevronDown size={17} className="text-muted transition group-open:rotate-180" />
          </summary>
          <p className="mt-3 text-xs leading-5 text-muted">Когато добавиш разбивка, общата цена се изчислява автоматично от нея. Клиентът вижда само общата цена.</p>
          <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
            <MoneyInput label="Труд" value={draft.laborPrice} onChange={(value) => setPriceBreakdown('laborPrice', value)} />
            <MoneyInput label="Материали" value={draft.materialsPrice} onChange={(value) => setPriceBreakdown('materialsPrice', value)} />
            <MoneyInput label="Транспорт" value={draft.transportPrice} onChange={(value) => setPriceBreakdown('transportPrice', value)} />
          </div>
          {computed.partsTotal > 0 && <div className="mt-3 text-right text-xs text-muted">Сбор на разбивката: <strong className="text-ink">{formatEurWithBgn(computed.partsTotal)}</strong></div>}
        </details>
      )}

      <div className="grid gap-4 rounded-2xl border border-line bg-soft/45 p-4 sm:grid-cols-2 sm:p-5">
        <TotsanSelect label="Материали" value={draft.materialsMode} onChange={(value) => set('materialsMode', value)} options={MATERIAL_MODE_OPTIONS} />
        <TotsanSelect label="ДДС статус" value={draft.vatStatus} onChange={(value) => set('vatStatus', value)} options={VAT_STATUS_OPTIONS} />
      </div>
    </div>
  )
}

function ExecutionStep({ draft, set, setStage, addStage, removeStage, moveStage, computed, errors }) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-soft/45 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><SectionLabel>Срок и старт</SectionLabel><span className="text-xs text-muted">Остави празно за „по уточнение“</span></div>
        <div className="mt-4 grid items-start gap-4 sm:grid-cols-[9rem_minmax(13rem,0.75fr)] lg:grid-cols-[9rem_15rem_minmax(0,1fr)]">
          <Field id="offer-days" label="Работни дни">
            <input id="offer-days" type="number" min="0" inputMode="numeric" value={draft.timelineDays} onChange={(event) => set('timelineDays', event.target.value)} className={CONTROL} />
          </Field>
          <TotsanDatePicker label="Най-ранен старт" value={draft.earliestStartDate} onChange={(value) => set('earliestStartDate', value)} min={localDateValue(new Date())} />
          <Field id="offer-dependencies" label="Зависи от" optional className="sm:col-span-2 lg:col-span-1">
            <input id="offer-dependencies" value={draft.timelineDependencies} onChange={(event) => set('timelineDependencies', event.target.value)} className={CONTROL} placeholder="Напр. достъп до обекта" />
          </Field>
        </div>
      </section>

      {draft.offerType === 'staged' && (
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><SectionLabel>Етапи на офертата</SectionLabel><p className="mt-1 text-xs text-muted">Подреди работата в реда, в който клиентът ще я получи.</p></div>
            <div className="rounded-xl border border-line bg-paper px-3 py-2 text-right"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Общо</div><div className="text-sm font-semibold text-ink">{computed.totalPrice ? formatEurWithBgn(computed.totalPrice) : '0 €'}</div></div>
          </div>
          <div className="mt-4 space-y-3">
            {draft.stages.map((stage, index) => (
              <StageCard key={`stage-${stage.order}-${index}`} stage={stage} index={index} count={draft.stages.length} setStage={setStage} removeStage={removeStage} moveStage={moveStage} errors={errors} />
            ))}
          </div>
          <button type="button" onClick={addStage} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-soft/35 text-sm font-semibold text-ink transition hover:border-accentDeep/45 hover:bg-accentSoft/40"><Plus size={17} className="text-accentDeep" /> Добави етап</button>
        </section>
      )}
    </div>
  )
}

function StageCard({ stage, index, count, setStage, removeStage, moveStage, errors }) {
  const titleError = errors[`stage-${index}-title`] || errors.stages
  const priceError = errors[`stage-${index}-price`] || errors.stages
  const hasDetails = Boolean(stage.startCondition || stage.payment)
  return (
    <article className="offer-stage-enter rounded-2xl border border-line bg-paper p-4 shadow-[0_18px_48px_-44px_rgba(13,35,64,0.65)] sm:p-5">
      <div className="flex items-center gap-3 border-b border-line pb-4">
        <GripVertical size={18} className="hidden shrink-0 text-muted/55 sm:block" aria-hidden="true" />
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-paper">{index + 1}</span>
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-ink">{stage.title || `Етап ${index + 1}`}</div>{stage.priceAmount && <div className="text-xs text-muted">{formatEurWithBgn(moneyValue(stage.priceAmount))}</div>}</div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => moveStage(index, -1)} disabled={index === 0} className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-soft hover:text-ink disabled:opacity-25" aria-label={`Премести етап ${index + 1} нагоре`}><ChevronUp size={17} /></button>
          <button type="button" onClick={() => moveStage(index, 1)} disabled={index === count - 1} className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-soft hover:text-ink disabled:opacity-25" aria-label={`Премести етап ${index + 1} надолу`}><ChevronDown size={17} /></button>
          <button type="button" onClick={() => removeStage(index)} disabled={count <= 2} className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-red-50 hover:text-red-700 disabled:opacity-25" aria-label={`Премахни етап ${index + 1}`}><Trash2 size={16} /></button>
        </div>
      </div>
      <div className="mt-4 grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_10rem_8rem]">
        <Field id={`stage-${index}-title`} label="Заглавие" required error={titleError}>
          <input id={`stage-${index}-title`} value={stage.title} onChange={(event) => setStage(index, 'title', event.target.value)} className={controlClass(titleError)} aria-invalid={Boolean(titleError)} />
        </Field>
        <MoneyInput id={`stage-${index}-price`} label="Цена" required value={stage.priceAmount} onChange={(value) => setStage(index, 'priceAmount', value)} error={priceError} />
        <Field id={`stage-${index}-days`} label="Дни">
          <input id={`stage-${index}-days`} type="number" min="0" inputMode="numeric" value={stage.durationDays} onChange={(event) => setStage(index, 'durationDays', event.target.value)} className={CONTROL} />
        </Field>
      </div>
      <Field id={`stage-${index}-description`} label="Резултат от етапа" optional className="mt-4">
        <textarea id={`stage-${index}-description`} rows={3} value={stage.description} onChange={(event) => setStage(index, 'description', event.target.value)} className={TEXTAREA} />
      </Field>
      <details className="group mt-4 rounded-xl border border-line bg-soft/45 p-3" defaultOpen={hasDetails}>
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-ink outline-none"><Plus size={15} className="text-accentDeep" /> Допълнителни настройки <ChevronDown size={15} className="ml-auto text-muted transition group-open:rotate-180" /></summary>
        <div className="mt-3 grid gap-4 border-t border-line pt-3 md:grid-cols-2">
          <Field id={`stage-${index}-condition`} label="Условие за старт" optional><input id={`stage-${index}-condition`} value={stage.startCondition} onChange={(event) => setStage(index, 'startCondition', event.target.value)} className={CONTROL} /></Field>
          <Field id={`stage-${index}-payment`} label="Бележка за плащане" optional><input id={`stage-${index}-payment`} value={stage.payment} onChange={(event) => setStage(index, 'payment', event.target.value)} className={CONTROL} /></Field>
        </div>
      </details>
    </article>
  )
}

function ClientPreview({ preview }) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-accentDeep/15 bg-accentSoft/45 px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accentDeep text-paper"><Eye size={18} /></span>
        <div><div className="text-sm font-semibold text-ink">Това ще види клиентът</div><p className="mt-0.5 text-xs text-muted">Прегледът използва същия изглед като офертата в чата.</p></div>
      </div>
      <div className="rounded-[1.75rem] border border-line bg-soft/65 p-3 sm:p-5">
        <div className="mx-auto max-w-[44rem] rounded-[1.6rem] border border-line bg-paper p-4 shadow-[0_24px_60px_-46px_rgba(13,35,64,0.7)] sm:p-5">
          <OfferDocumentView offer={preview} showStatus={false} />
        </div>
      </div>
    </div>
  )
}

function PaymentSettings({ draft, set, errors }) {
  return (
    <aside className="order-1 border-t border-line bg-soft/55 px-4 py-5 sm:px-6 lg:order-2 lg:border-l lg:border-t-0 lg:px-5 lg:py-6">
      <div className="lg:sticky lg:top-0">
        <SectionLabel>След приемане</SectionLabel>
        <p className="mt-1 text-xs leading-5 text-muted">Избери как ще бъде платена договорената работа.</p>
        <div className="mt-5 space-y-4">
          <TotsanSelect label="Метод на плащане" value={draft.paymentMethod} onChange={(value) => set('paymentMethod', value)} options={PAYMENT_METHOD_OPTIONS} error={errors.paymentMethod} />
          <Field id="offer-payment-terms" label="Условия за плащане" required error={errors.paymentTerms}>
            <textarea id="offer-payment-terms" rows={4} value={draft.paymentTerms} onChange={(event) => set('paymentTerms', event.target.value)} className={textareaClass(errors.paymentTerms)} aria-invalid={Boolean(errors.paymentTerms)} />
          </Field>
          <Field id="offer-payment-note" label="Бележка" optional><input id="offer-payment-note" value={draft.paymentNotes} onChange={(event) => set('paymentNotes', event.target.value)} className={CONTROL} /></Field>
        </div>
        <details className="group mt-4 rounded-2xl border border-line bg-paper p-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink outline-none"><Plus size={16} className="text-accentDeep" /> Допълнителни условия <ChevronDown size={16} className="ml-auto text-muted transition group-open:rotate-180" /></summary>
          <div className="mt-4 space-y-4 border-t border-line pt-4">
            <Field id="offer-scope-terms" label="Промени в обхвата"><textarea id="offer-scope-terms" rows={3} value={draft.scopeChangeTerms} onChange={(event) => set('scopeChangeTerms', event.target.value)} className={TEXTAREA} /></Field>
            <Field id="offer-cancellation-terms" label="Отказ / анулиране"><textarea id="offer-cancellation-terms" rows={3} value={draft.cancellationTerms} onChange={(event) => set('cancellationTerms', event.target.value)} className={TEXTAREA} /></Field>
            <Field id="offer-unforeseen-terms" label="Непредвидена работа"><textarea id="offer-unforeseen-terms" rows={3} value={draft.unforeseenTerms} onChange={(event) => set('unforeseenTerms', event.target.value)} className={TEXTAREA} /></Field>
          </div>
        </details>
        <p className="mt-4 text-xs leading-5 text-muted">С изпращането потвърждаваш <Link to="/obshti-usloviya" className="font-semibold text-accentDeep hover:underline">Общите условия</Link>.</p>
      </div>
    </aside>
  )
}

function SuccessState() {
  return (
    <div className="grid min-h-[24rem] flex-1 place-items-center px-6 py-12 text-center" role="status" aria-live="polite">
      <div className="max-w-md">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-100 text-green-700"><Check size={30} /></span>
        <h2 className="mt-6 font-display text-4xl text-ink">Офертата е изпратена</h2>
        <p className="mt-3 text-sm leading-6 text-muted">Клиентът ще я види в разговора и ще може да я прегледа, приеме или да поиска промяна.</p>
      </div>
    </div>
  )
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
  if (step === 1) return [
    !draft.title.trim() && { field: 'title', message: 'Добави заглавие на офертата.' },
    !draft.summary.trim() && { field: 'summary', message: 'Добави кратко резюме.' },
    !isValidCurrentOrFutureDate(draft.validUntil) && { field: 'validUntil', message: 'Избери валидна бъдеща дата.' },
  ].filter(Boolean)
  if (step === 2 && draft.offerType !== 'estimate' && computed.includedItems.length === 0) return [{ field: 'included', message: 'Добави поне една включена дейност или краен резултат.' }]
  if (step === 3 && draft.offerType !== 'estimate' && draft.offerType !== 'staged' && computed.totalPrice <= 0) return [{ field: 'totalPrice', message: 'Добави валидна обща цена.' }]
  if (step === 4 && draft.offerType === 'staged') {
    if (computed.stages.length < 2) return [{ field: 'stages', message: 'Добави поне два етапа.' }]
    const invalidIndex = computed.stages.findIndex((stage) => !stage.title || stage.priceAmount <= 0)
    if (invalidIndex >= 0) return [
      !computed.stages[invalidIndex].title && { field: `stage-${invalidIndex}-title`, message: `Добави заглавие на етап ${invalidIndex + 1}.` },
      computed.stages[invalidIndex].priceAmount <= 0 && { field: `stage-${invalidIndex}-price`, message: `Добави валидна цена на етап ${invalidIndex + 1}.` },
    ].filter(Boolean)
  }
  return []
}

function fieldForDocumentError(message, offerType) {
  if (message.includes('заглавие')) return 'title'
  if (message.includes('резюме')) return 'summary'
  if (message.includes('включена')) return 'included'
  if (message.includes('обща цена')) return offerType === 'staged' ? 'stages' : 'totalPrice'
  if (message.includes('условия за плащане')) return 'paymentTerms'
  if (message.includes('етап')) return 'stages'
  return ''
}

function stepForDocumentErrors(errors) {
  const fields = new Set(errors.map((error) => error.field))
  if (fields.has('title') || fields.has('summary')) return 1
  if (fields.has('included')) return 2
  if (fields.has('totalPrice')) return 3
  if (fields.has('stages') || [...fields].some((field) => field.startsWith('stage-'))) return 4
  return 5
}

function splitLines(value = '') { return String(value || '').split('\n').map((item) => item.trim()).filter(Boolean) }
function moneyValue(value) { const parsed = Number(String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.')); return Number.isFinite(parsed) && parsed > 0 ? parsed : 0 }
function dateToExpiry(value = '') { if (!value) return null; const date = new Date(`${value}T23:59:59`); return Number.isNaN(date.getTime()) ? null : date.toISOString() }
function prefersReducedMotion() { return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches }
function controlClass(error) { return `${CONTROL} ${error ? 'border-red-300 bg-red-50/55 focus:border-red-500 focus:ring-red-100' : 'border-line'}` }
function textareaClass(error) { return `${TEXTAREA} ${error ? 'border-red-300 bg-red-50/55 focus:border-red-500 focus:ring-red-100' : 'border-line'}` }

function restoreOfferDraft(base, saved) {
  const next = { ...base }
  Object.keys(base).forEach((key) => {
    if (key === 'stages' || saved[key] === undefined || saved[key] === null) return
    if (typeof base[key] === 'string') next[key] = String(saved[key])
  })
  if (Array.isArray(saved.stages)) {
    const stages = saved.stages.slice(0, 30).map((stage, index) => {
      const source = stage && typeof stage === 'object' && !Array.isArray(stage) ? stage : {}
      return {
        title: String(source.title || ''),
        description: String(source.description || ''),
        durationDays: String(source.durationDays || ''),
        priceAmount: String(source.priceAmount || ''),
        payment: String(source.payment || ''),
        startCondition: String(source.startCondition || ''),
        order: index + 1,
      }
    })
    next.stages = stages.length >= 2 ? stages : [createStage(1), createStage(2)]
  }
  if (!OFFER_TYPES.some((item) => item.value === next.offerType)) next.offerType = base.offerType
  return next
}

function hasMeaningfulDraft(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = ['title', 'summary', 'included', 'excluded', 'clientRequirements', 'totalPrice', 'laborPrice', 'materialsPrice', 'transportPrice', 'timelineDays']
  if (keys.some((key) => String(value[key] || '').trim())) return true
  return Array.isArray(value.stages) && value.stages.some((stage) => stage && typeof stage === 'object' && [stage.title, stage.description, stage.priceAmount].some((item) => String(item || '').trim()))
}

function isValidCurrentOrFutureDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime()) || localDateValue(date) !== value) return false
  return value >= localDateValue(new Date())
}

function SectionLabel({ children }) { return <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{children}</div> }

function Field({ id, label, children, required = false, optional = false, helper = '', error = '', className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">{label}{required && <span className="ml-1 text-accentDeep" aria-hidden="true">*</span>}{optional && <span className="ml-1.5 text-xs font-normal text-muted">по избор</span>}</label>
      {children}
      {(error || helper) && <p id={`${id}-${error ? 'error' : 'helper'}`} className={`mt-1.5 text-xs ${error ? 'text-red-700' : 'text-muted'}`}>{error || helper}</p>}
    </div>
  )
}

function MoneyInput({ id: suppliedId, label, value, onChange, placeholder = '', required = false, error = '', disabled = false, helper = '' }) {
  const generatedId = useId()
  const id = suppliedId || `money-${generatedId}`
  return (
    <Field id={id} label={label} required={required} error={error} helper={helper}>
      <div className="relative mt-2">
        <input id={id} type="text" inputMode="numeric" autoComplete="off" value={formatMoneyInput(value)} onChange={(event) => onChange(normalizeMoneyInput(event.target.value))} placeholder={formatMoneyInput(placeholder)} disabled={disabled} className={`${controlClass(error)} !mt-0 pr-12 disabled:cursor-not-allowed disabled:border-line disabled:bg-soft disabled:text-muted`} aria-invalid={Boolean(error)} />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-muted">€</span>
      </div>
    </Field>
  )
}

function normalizeMoneyInput(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.replace(/^0+(?=\d)/, '')
}

function formatMoneyInput(value) {
  const digits = normalizeMoneyInput(value)
  if (!digits) return ''
  return Number(digits).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function ErrorPanel({ errors, panelRef }) {
  return (
    <div ref={panelRef} role="alert" tabIndex={-1} className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 outline-none focus:ring-4 focus:ring-red-100">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-red-100 font-bold">!</span>
      <div><div className="font-semibold">Провери следното</div><ul className="mt-1 space-y-1">{errors.map((error, index) => <li key={`${error.field}-${error.message}-${index}`}>{error.message}</li>)}</ul></div>
    </div>
  )
}
