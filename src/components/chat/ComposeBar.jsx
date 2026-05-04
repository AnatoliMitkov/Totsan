import { Send, Sparkles } from 'lucide-react'

export default function ComposeBar({ value, onChange, onSubmit, canSendOffer, onOpenOffer, status }) {
  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-line bg-paper p-3 md:p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={2} placeholder="Напиши съобщение…" className="min-h-[3.25rem] flex-1 resize-none rounded-2xl border border-line bg-soft px-4 py-3 text-sm outline-none transition focus:border-ink" />
        <div className="flex gap-2 md:pb-1">
          {canSendOffer && <button type="button" onClick={onOpenOffer} className="btn btn-ghost !py-3 text-sm"><Sparkles size={17} /> Оферта</button>}
          <button disabled={status === 'sending' || !value.trim()} className="btn btn-primary !py-3 text-sm disabled:opacity-50"><Send size={17} /> Изпрати</button>
        </div>
      </div>
    </form>
  )
}