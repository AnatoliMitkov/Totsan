import { useState } from 'react'
import { X } from 'lucide-react'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'

export default function OfferComposer({ open, onClose, onSubmit, status }) {
  const [draft, setDraft] = useState({ title: '', description: '', deliverables: '', priceAmount: '', currency: 'EUR', deliveryDays: '', revisions: '1' })
  if (!open) return null

  function set(key, value) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    await onSubmit({
      ...draft,
      deliverables: draft.deliverables.split('\n').map((item) => item.trim()).filter(Boolean),
      priceAmount: Number(draft.priceAmount || 0),
      deliveryDays: Number(draft.deliveryDays || 0),
      revisions: Number(draft.revisions || 0),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6 backdrop-blur-sm">
      <form onSubmit={submit} className="max-h-full w-full max-w-2xl overflow-auto rounded-3xl border border-line bg-paper p-5 shadow-2xl md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><div className="eyebrow">Оферта</div><h2 className="mt-2 font-display text-3xl text-ink">Изпрати оферта</h2></div>
          <button type="button" onClick={onClose} className="btn btn-ghost !px-3 !py-2"><X size={18} /></button>
        </div>

        <div className="mt-6 space-y-4">
          <Field label="Заглавие"><input value={draft.title} onChange={(event) => set('title', event.target.value)} className={INPUT} required /></Field>
          <Field label="Описание"><textarea rows={4} value={draft.description} onChange={(event) => set('description', event.target.value)} className={INPUT} /></Field>
          <Field label="Какво включва"><textarea rows={4} value={draft.deliverables} onChange={(event) => set('deliverables', event.target.value)} className={INPUT} placeholder="Един ред = една точка" /></Field>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Цена"><input type="number" min="0" value={draft.priceAmount} onChange={(event) => set('priceAmount', event.target.value)} className={INPUT} /></Field>
            <Field label="Валута"><input value={draft.currency} onChange={(event) => set('currency', event.target.value)} className={INPUT} /></Field>
            <Field label="Дни"><input type="number" min="0" value={draft.deliveryDays} onChange={(event) => set('deliveryDays', event.target.value)} className={INPUT} /></Field>
            <Field label="Ревизии"><input type="number" min="0" value={draft.revisions} onChange={(event) => set('revisions', event.target.value)} className={INPUT} /></Field>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <p className="text-sm text-muted">Контакти и външни линкове ще бъдат скрити автоматично.</p>
          <button disabled={status === 'sending'} className="btn btn-primary disabled:opacity-50">{status === 'sending' ? 'Изпраща се…' : 'Изпрати оферта'}</button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="block text-sm font-medium text-ink">{label}{children}</label>
}