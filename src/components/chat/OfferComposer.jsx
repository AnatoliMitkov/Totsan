import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, X } from 'lucide-react'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'

function createStage(order) {
  return { title: '', description: '', order }
}

export default function OfferComposer({ open, onClose, onSubmit, status }) {
  const [draft, setDraft] = useState({
    title: '',
    description: '',
    deliverables: '',
    priceAmount: '',
    deliveryDays: '',
    excluded: '',
    paymentTerms: '',
    cancellationTerms: '',
    invoiceIssuer: '',
    vatStatus: '',
    acceptedLegal: false,
    executionMode: 'single',
    stages: [createStage(1)],
  })

  if (!open) return null

  function set(key, value) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function setExecutionMode(executionMode) {
    setDraft((current) => ({
      ...current,
      executionMode,
      stages: executionMode === 'staged' && current.stages.length === 0 ? [createStage(1)] : current.stages,
    }))
  }

  function addStage() {
    setDraft((current) => ({
      ...current,
      stages: [...current.stages, createStage(current.stages.length + 1)],
    }))
  }

  function removeStage(index) {
    setDraft((current) => {
      const nextStages = current.stages
        .filter((_, stageIndex) => stageIndex !== index)
        .map((stage, stageIndex) => ({ ...stage, order: stageIndex + 1 }))

      return {
        ...current,
        stages: nextStages.length > 0 ? nextStages : [createStage(1)],
      }
    })
  }

  function setStage(index, key, value) {
    setDraft((current) => ({
      ...current,
      stages: current.stages.map((stage, stageIndex) => (
        stageIndex === index ? { ...stage, [key]: value } : stage
      )),
    }))
  }

  async function submit(event) {
    event.preventDefault()
    const descriptionSections = [
      draft.description.trim(),
      draft.excluded.trim() ? `Не е включено:\n${draft.excluded.trim()}` : '',
      `Условия за плащане:\n${draft.paymentTerms.trim()}`,
      `Отказ и възстановяване:\n${draft.cancellationTerms.trim()}`,
      `Фактура:\n${draft.invoiceIssuer.trim()}`,
      `ЗДДС статус:\n${draft.vatStatus}`,
    ].filter(Boolean)

    await onSubmit({
      ...draft,
      description: descriptionSections.join('\n\n'),
      currency: 'EUR',
      executionMode: draft.executionMode,
      stages: draft.executionMode === 'staged'
        ? draft.stages
          .map((stage, index) => ({
            title: stage.title.trim(),
            description: stage.description.trim(),
            order: index + 1,
          }))
          .filter((stage) => stage.title || stage.description)
        : [],
      deliverables: draft.deliverables.split('\n').map((item) => item.trim()).filter(Boolean),
      priceAmount: Number(draft.priceAmount || 0),
      deliveryDays: Number(draft.deliveryDays || 0),
      revisions: 0,
    })
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Изпращане на оферта"
    >
      <form onSubmit={submit} className="totsan-scrollbar max-h-[calc(100dvh-4rem)] w-[90vw] max-w-[1000px] overflow-y-auto rounded-3xl border border-line bg-paper p-5 shadow-2xl md:p-7">
        <div className="sticky top-0 z-10 -mx-5 -mt-5 flex items-start justify-between gap-4 border-b border-line bg-paper/95 px-5 py-5 backdrop-blur-sm md:-mx-7 md:-mt-7 md:px-7 md:pt-7">
          <div>
            <div className="eyebrow">Оферта</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Изпрати оферта</h2>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost shrink-0 !px-3 !py-2">
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <Field label="Заглавие">
            <input value={draft.title} onChange={(event) => set('title', event.target.value)} className={INPUT} required />
          </Field>
          <Field label="Описание">
            <textarea rows={4} value={draft.description} onChange={(event) => set('description', event.target.value)} className={INPUT} />
          </Field>
          <Field label="Начин на изпълнение">
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <ExecutionModeOption
                active={draft.executionMode === 'single'}
                title="Еднократно изпълнение"
                description="Всичко се изпълнява като една оферта."
                onClick={() => setExecutionMode('single')}
              />
              <ExecutionModeOption
                active={draft.executionMode === 'staged'}
                title="Поетапно изпълнение"
                description="Описваш етапите и условията за директно плащане към партньора."
                onClick={() => setExecutionMode('staged')}
              />
            </div>
          </Field>

          {draft.executionMode === 'staged' && (
            <section className="overflow-hidden rounded-3xl border border-line bg-soft/60 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-ink">Етапи</div>
                  <p className="mt-1 text-sm text-muted">Добави основните етапи на работа и уточни директното плащане в условията на офертата.</p>
                </div>
                <button type="button" onClick={addStage} className="btn btn-ghost w-full justify-center !py-2 text-sm sm:w-auto">
                  <Plus size={16} /> Добави етап
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {draft.stages.map((stage, index) => (
                  <div key={`stage-${index}`} className="rounded-2xl border border-line bg-paper p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-medium text-ink">Етап {index + 1}</div>
                      <button type="button" onClick={() => removeStage(index)} className="btn btn-ghost !px-3 !py-2 text-sm">
                        <Trash2 size={16} /> Премахни
                      </button>
                    </div>
                    <Field label="Заглавие">
                      <input
                        value={stage.title}
                        onChange={(event) => setStage(index, 'title', event.target.value)}
                        className={INPUT}
                        placeholder="Например: Подготовка и оглед"
                      />
                    </Field>
                    <Field label="Описание">
                      <textarea
                        rows={3}
                        value={stage.description}
                        onChange={(event) => setStage(index, 'description', event.target.value)}
                        className={INPUT}
                        placeholder="Допълнителни уточнения за този етап"
                      />
                    </Field>
                  </div>
                ))}
              </div>
            </section>
          )}

          <Field label="Какво включва">
            <textarea
              rows={4}
              value={draft.deliverables}
              onChange={(event) => set('deliverables', event.target.value)}
              className={INPUT}
              placeholder="Един ред = една точка"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Обща цена">
              <div className="relative mt-2">
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={draft.priceAmount}
                  onChange={(event) => set('priceAmount', event.target.value)}
                  className={`${INPUT} pr-12`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-muted">
                  €
                </span>
              </div>
            </Field>
            <Field label="Дни">
              <input type="number" min="0" value={draft.deliveryDays} onChange={(event) => set('deliveryDays', event.target.value)} className={INPUT} />
            </Field>
          </div>

          <section className="rounded-3xl border border-line bg-soft/60 p-4 sm:p-5">
            <div className="text-sm font-semibold text-ink">Условия на офертата</div>
            <p className="mt-1 text-sm leading-6 text-muted">Тези данни се добавят към описанието и остават видими за клиента преди плащане.</p>
            <div className="mt-4 grid gap-4">
              <Field label="Какво не е включено">
                <textarea
                  rows={3}
                  value={draft.excluded}
                  onChange={(event) => set('excluded', event.target.value)}
                  className={INPUT}
                  placeholder="Например: материали, транспорт, къртене или извозване"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Условия за плащане">
                  <textarea
                    rows={3}
                    value={draft.paymentTerms}
                    onChange={(event) => set('paymentTerms', event.target.value)}
                    className={INPUT}
                    placeholder="Например: цялата сума при приемане или аванс и остатък"
                    required
                  />
                </Field>
                <Field label="Отказ и възстановяване">
                  <textarea
                    rows={3}
                    value={draft.cancellationTerms}
                    onChange={(event) => set('cancellationTerms', event.target.value)}
                    className={INPUT}
                    placeholder="Опиши какво се случва при отказ и започнало изпълнение"
                    required
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Партньорът, който издава фактурата">
                  <input
                    value={draft.invoiceIssuer}
                    onChange={(event) => set('invoiceIssuer', event.target.value)}
                    className={INPUT}
                    placeholder="Име/фирма и ЕИК при приложимост"
                    required
                  />
                </Field>
                <Field label="ЗДДС статус">
                  <select value={draft.vatStatus} onChange={(event) => set('vatStatus', event.target.value)} className={INPUT} required>
                    <option value="">Избери...</option>
                    <option value="Цената е без начислен ДДС">Цената е без начислен ДДС</option>
                    <option value="Цената включва ДДС">Цената включва ДДС</option>
                    <option value="ЗДДС статусът се уточнява във фактурата">Уточнява се във фактурата</option>
                  </select>
                </Field>
              </div>
            </div>
          </section>

          <div className="rounded-2xl border border-line bg-soft px-4 py-3 text-sm text-muted">
            Клиентът плаща директно на партньора по посочените в офертата условия. Totsan не приема и не прехвърля сумата.
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-sm leading-6 text-ink">
            <input
              type="checkbox"
              checked={draft.acceptedLegal}
              onChange={(event) => set('acceptedLegal', event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-black"
              required
            />
            <span>
              Съгласен съм с{' '}
              <Link to="/obshti-usloviya" className="font-semibold text-accent hover:underline">Общите условия</Link>
              {' '}и{' '}
              <Link to="/politika-za-poveritelnost" className="font-semibold text-accent hover:underline">Политиката за поверителност</Link>.
            </span>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <p className="text-sm text-muted">Контакти и външни линкове ще бъдат скрити автоматично.</p>
          <button disabled={status === 'sending' || !draft.acceptedLegal} className="btn btn-primary disabled:opacity-50">
            {status === 'sending' ? 'Изпраща се…' : 'Изпрати оферта'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="block text-sm font-medium text-ink">{label}{children}</label>
}

function ExecutionModeOption({ active, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 rounded-2xl border px-4 py-4 text-left transition ${active ? 'border-ink bg-paper shadow-sm' : 'border-line bg-paper/70 hover:border-ink/40'}`}
    >
      <div className="break-words text-sm font-semibold text-ink">{title}</div>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </button>
  )
}
