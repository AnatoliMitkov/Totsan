import { Plus, RotateCcw, Trash2, CreditCard } from 'lucide-react'
import {
  DELIVERABLES,
  DEFAULT_PROCESS_STEPS,
  SPECIALIST_TYPES,
  SPECIFIC_SERVICES,
  TARGET_OBJECTS,
} from '../../data/layer01-meta.js'
import { getBgnEquivalentText, formatEurWithBgn } from '../../lib/money.js'
import TotsanSelect from '../ui/TotsanSelect.jsx'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'
const PROFILE_PRICING_LIMIT = 300
const PRICE_UNIT_OPTIONS = [
  { value: 'sqm', label: 'на квадратен метър', suffix: 'м²' },
  { value: 'hour', label: 'на час', suffix: 'час' },
  { value: 'linear_meter', label: 'на линеен метър', suffix: 'л.м.' },
  { value: 'day', label: 'на ден', suffix: 'ден' },
  { value: 'project', label: 'на проект', suffix: 'проект' },
]

function normalizePriceInput(value) {
  return String(value || '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '')
    .replace(/(\..*)\./g, '$1')
}

function getPriceUnit(value) {
  return PRICE_UNIT_OPTIONS.find((option) => option.value === value) || PRICE_UNIT_OPTIONS[0]
}

function detectPriceUnit(value) {
  const text = String(value || '').toLowerCase()
  if (text.includes('л.м') || text.includes('лине')) return 'linear_meter'
  if (text.includes('час')) return 'hour'
  if (text.includes('ден')) return 'day'
  if (text.includes('проект')) return 'project'
  return 'sqm'
}

function parsePriceGuide(value) {
  const text = String(value || '')
  const amount = normalizePriceInput(text.match(/\d+(?:[.,]\d+)?/)?.[0] || '')
  return { amount, unit: detectPriceUnit(text) }
}

function formatPriceGuide(amount, unit) {
  const normalizedAmount = normalizePriceInput(amount)
  if (!normalizedAmount) return ''
  return `${normalizedAmount}€/${getPriceUnit(unit).suffix}`
}

function arrayFrom(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function processStepsFrom(value) {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_PROCESS_STEPS
  return source.map((step) => ({
    title: String(step?.title || '').trim(),
    description: String(step?.description || '').trim(),
    duration: String(step?.duration || '').trim(),
  }))
}

export function makeLayer01Draft(meta = {}) {
  return {
    ...meta,
    specialist_type: String(meta.specialist_type || ''),
    specific_services: arrayFrom(meta.specific_services),
    target_objects: arrayFrom(meta.target_objects),
    deliverables: arrayFrom(meta.deliverables),
    process_steps: processStepsFrom(meta.process_steps),
    consultation_fee_eur: Number.isFinite(Number(meta.consultation_fee_eur))
      ? Number(meta.consultation_fee_eur)
      : (Number.isFinite(Number(meta.consultation_fee)) ? Math.round(Number(meta.consultation_fee) / 1.95583) : 0),
    consultation_note: String(meta.consultation_note || ''),
  }
}

export function cleanLayer01Draft(draft = {}) {
  const cleaned = {
    ...draft,
    specialist_type: String(draft.specialist_type || '').trim(),
    specific_services: arrayFrom(draft.specific_services),
    target_objects: arrayFrom(draft.target_objects),
    deliverables: arrayFrom(draft.deliverables),
    process_steps: processStepsFrom(draft.process_steps).filter((step) => step.title || step.description || step.duration),
    consultation_fee_eur: Math.max(0, Number(draft.consultation_fee_eur) || 0),
    consultation_note: String(draft.consultation_note || '').trim(),
  }
  // TODO: consultation_fee is a legacy BGN field. We preserve it to avoid data loss until a full DB migration is run.
  if ('consultation_fee' in draft) {
    cleaned.consultation_fee = draft.consultation_fee
  }
  return cleaned
}

export default function Layer01SpecEditor({ draft, onChange, profileDraft, onProfileChange }) {
  const safeDraft = makeLayer01Draft(draft)
  const priceGuide = parsePriceGuide(profileDraft?.pricingNote)

  function updatePriceGuide(nextAmount = priceGuide.amount, nextUnit = priceGuide.unit) {
    onProfileChange?.('pricingNote', formatPriceGuide(nextAmount, nextUnit).slice(0, PROFILE_PRICING_LIMIT))
  }

  function updateRemotePrice(value) {
    const normalized = normalizePriceInput(value)
    onProfileChange?.('remotePricePerHour', normalized)
    if (normalized) onProfileChange?.('remoteIsFree', false)
  }

  function toggleArrayItem(field, value) {
    const current = safeDraft[field] || []
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]
    onChange(field, next)
  }

  function updateStep(index, field, value) {
    const next = safeDraft.process_steps.map((step, currentIndex) => (
      currentIndex === index ? { ...step, [field]: value } : step
    ))
    onChange('process_steps', next)
  }

  function addStep() {
    onChange('process_steps', [...safeDraft.process_steps, { title: '', description: '', duration: '' }])
  }

  function removeStep(index) {
    const next = safeDraft.process_steps.filter((_, currentIndex) => currentIndex !== index)
    onChange('process_steps', next.length ? next : processStepsFrom(DEFAULT_PROCESS_STEPS))
  }

  function resetSteps() {
    onChange('process_steps', processStepsFrom(DEFAULT_PROCESS_STEPS))
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="eyebrow">Идея и посока</div>
        <h2 className="mt-2 font-display text-3xl text-ink">Профил за Слой 01</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Тези данни се показват в публичния профил само за специалисти от слой “Идея и визия”.
        </p>
      </section>

      <section className="rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="eyebrow">Тип специалист</div>
        <div className="mt-4 flex flex-wrap gap-3">
          {SPECIALIST_TYPES.map((type) => {
            const isActive = safeDraft.specialist_type === type.value
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => onChange('specialist_type', type.value)}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition ${isActive ? 'border-ink bg-ink text-paper' : 'border-line bg-soft text-muted hover:border-ink/40 hover:text-ink'}`}
              >
                <span>{type.icon}</span>
                {type.label}
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="eyebrow">Услуги</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SPECIFIC_SERVICES.map((service) => (
            <CheckboxTile
              key={service.value}
              checked={safeDraft.specific_services.includes(service.value)}
              label={service.label}
              onChange={() => toggleArrayItem('specific_services', service.value)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="eyebrow">Обекти</div>
        <div className="mt-4 flex flex-wrap gap-3">
          {TARGET_OBJECTS.map((item) => {
            const isActive = safeDraft.target_objects.includes(item.value)
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => toggleArrayItem('target_objects', item.value)}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition ${isActive ? 'border-ink bg-ink text-paper' : 'border-line bg-soft text-muted hover:border-ink/40 hover:text-ink'}`}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="eyebrow">Резултат за клиента</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {DELIVERABLES.map((item) => (
            <CheckboxTile
              key={item.value}
              checked={safeDraft.deliverables.includes(item.value)}
              label={item.label}
              onChange={() => toggleArrayItem('deliverables', item.value)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="eyebrow">Работен процес</div>
            <h3 className="mt-2 font-display text-3xl text-ink">Стъпки на работа</h3>
          </div>
          <button type="button" onClick={resetSteps} className="btn btn-ghost">
            <RotateCcw size={18} />
            По подразбиране
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {safeDraft.process_steps.map((step, index) => (
            <div key={`${index}-${step.title}`} className="rounded-2xl border border-line bg-soft p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="font-display text-xl text-accentDeep">{String(index + 1).padStart(2, '0')}</div>
                <button type="button" onClick={() => removeStep(index)} className="text-muted transition hover:text-red-700" aria-label="Изтрий стъпка">
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_11rem]">
                <Field label="Име на стъпката">
                  <input value={step.title} onChange={(event) => updateStep(index, 'title', event.target.value)} className={INPUT} />
                </Field>
                <Field label="Време">
                  <input value={step.duration} onChange={(event) => updateStep(index, 'duration', event.target.value)} className={INPUT} placeholder="2 седмици" />
                </Field>
              </div>
              <Field label="Кратко описание">
                <textarea rows={3} value={step.description} onChange={(event) => updateStep(index, 'description', event.target.value)} className={INPUT} />
              </Field>
            </div>
          ))}
          <button type="button" onClick={addStep} className="btn btn-ghost w-full justify-center border-dashed">
            <Plus size={18} />
            Добави стъпка
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accentSoft text-accentDeep">
            <CreditCard size={20} strokeWidth={2} />
          </div>
          <h3 className="font-display text-xl font-semibold text-ink">Ценови ориентир и допълнителни настройки</h3>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
          <div className="rounded-2xl border border-line bg-paper p-5 shadow-[0_14px_38px_rgba(13,35,64,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-base font-semibold leading-6 text-ink">Ценови ориентир</div>
                <p className="mt-1 text-sm leading-6 text-muted">Въведете стартова стойност и база, по която обикновено калкулирате.</p>
              </div>
            </div>
            <div className="mt-4 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,0.85fr)]">
              <label className="flex min-w-0 flex-col">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Стартова цена</span>
                <span className="relative mt-2 block h-[3.05rem]">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-ink">€</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={priceGuide.amount}
                    onChange={event => updatePriceGuide(event.target.value, priceGuide.unit)}
                    className={`${INPUT} !mt-0 h-full w-full pl-10`}
                    placeholder="80"
                  />
                </span>
                {priceGuide.amount && (
                  <div className="mt-2 text-xs leading-5 text-muted">
                    Ще се показва като {formatEurWithBgn(priceGuide.amount)} до края на периода за двойно обозначаване.
                  </div>
                )}
              </label>
              <div className="flex min-w-0 flex-col">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">База</span>
                <div className="mt-2 h-[3.05rem]">
                  <TotsanSelect
                    value={priceGuide.unit}
                    onChange={(value) => updatePriceGuide(priceGuide.amount, value)}
                    options={PRICE_UNIT_OPTIONS.map(({ value, label }) => ({ value, label }))}
                    className="h-full"
                    buttonClassName="h-full min-h-0"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-5 shadow-[0_14px_38px_rgba(13,35,64,0.06)]">
            <label className="flex cursor-pointer items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-soft">
                <img src="/svg/Asset%201.svg" alt="" className="h-7 w-7 object-contain" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-3">
                  <span className="text-base font-semibold leading-6 text-ink">Дистанционни консултации</span>
                  <input
                    type="checkbox"
                    checked={profileDraft?.acceptsRemote || false}
                    onChange={event => {
                      onProfileChange?.('acceptsRemote', event.target.checked)
                      if (!event.target.checked) {
                        onProfileChange?.('remoteIsFree', false)
                        onProfileChange?.('remotePricePerHour', '')
                      }
                    }}
                    className="mt-1 h-4 w-4 rounded accent-black"
                  />
                </span>
                <span className="mt-1 block text-sm leading-6 text-muted">Покажете дали предлагате разговор от разстояние и какъв е ориентирът на час.</span>
              </span>
            </label>

            <div className={`mt-4 grid gap-3 border-t border-line/60 pt-4 transition ${profileDraft?.acceptsRemote ? 'opacity-100' : 'pointer-events-none opacity-45'}`}>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-line bg-soft/65 px-4 py-3 text-sm text-ink">
                <span className="font-medium">Безплатна консултация</span>
                <input
                  type="checkbox"
                  checked={profileDraft?.remoteIsFree || false}
                  disabled={!profileDraft?.acceptsRemote}
                  onChange={event => {
                    onProfileChange?.('remoteIsFree', event.target.checked)
                    if (event.target.checked) onProfileChange?.('remotePricePerHour', '')
                  }}
                  className="h-4 w-4 rounded accent-black disabled:opacity-50"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-line bg-soft/65 px-4 py-3 text-sm text-ink">
                <span className="font-medium">Цена на час</span>
                <span className="relative h-9 w-24">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink">€</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="50"
                    className="h-full w-full rounded-xl border border-line bg-paper pl-8 pr-3 text-sm outline-none transition focus:border-ink disabled:opacity-50"
                    value={profileDraft?.remotePricePerHour ?? ''}
                    disabled={!profileDraft?.acceptsRemote || profileDraft?.remoteIsFree}
                    onChange={event => updateRemotePrice(event.target.value)}
                  />
                </span>
              </label>
              {profileDraft?.remotePricePerHour && (
                <div className="mt-1 text-xs leading-5 text-muted px-2">
                  Ще се показва като {formatEurWithBgn(profileDraft.remotePricePerHour)} до края на периода за двойно обозначаване.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function CheckboxTile({ checked, label, onChange }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm transition ${checked ? 'border-ink bg-soft text-ink' : 'border-line text-muted hover:border-ink/40 hover:text-ink'}`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-1 accent-black" />
      <span className="font-medium">{label}</span>
    </label>
  )
}

function Field({ label, children }) {
  return <label className="block text-sm font-medium text-ink">{label}{children}</label>
}
