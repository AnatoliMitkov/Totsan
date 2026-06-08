import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import {
  DELIVERABLES,
  DEFAULT_PROCESS_STEPS,
  SPECIALIST_TYPES,
  SPECIFIC_SERVICES,
  TARGET_OBJECTS,
} from '../../data/layer01-meta.js'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'

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
    specialist_type: String(meta.specialist_type || ''),
    specific_services: arrayFrom(meta.specific_services),
    target_objects: arrayFrom(meta.target_objects),
    deliverables: arrayFrom(meta.deliverables),
    process_steps: processStepsFrom(meta.process_steps),
    consultation_fee: Number.isFinite(Number(meta.consultation_fee)) ? Number(meta.consultation_fee) : 0,
    consultation_note: String(meta.consultation_note || ''),
  }
}

export function cleanLayer01Draft(draft = {}) {
  return {
    specialist_type: String(draft.specialist_type || '').trim(),
    specific_services: arrayFrom(draft.specific_services),
    target_objects: arrayFrom(draft.target_objects),
    deliverables: arrayFrom(draft.deliverables),
    process_steps: processStepsFrom(draft.process_steps).filter((step) => step.title || step.description || step.duration),
    consultation_fee: Math.max(0, Number(draft.consultation_fee) || 0),
    consultation_note: String(draft.consultation_note || '').trim(),
  }
}

export default function Layer01SpecEditor({ draft, onChange }) {
  const safeDraft = makeLayer01Draft(draft)

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
        <div className="eyebrow">Консултация</div>
        <div className="mt-4 grid gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
          <Field label="Цена (лв.)">
            <input
              type="number"
              min="0"
              value={safeDraft.consultation_fee}
              onChange={(event) => onChange('consultation_fee', Number(event.target.value))}
              className={INPUT}
            />
          </Field>
          <Field label="Бележка към цената">
            <input
              value={safeDraft.consultation_note}
              onChange={(event) => onChange('consultation_note', event.target.value)}
              className={INPUT}
              placeholder="Напр. Приспада се при възлагане."
            />
          </Field>
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
