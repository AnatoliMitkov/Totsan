import { useEffect, useState } from 'react'
import { ImagePlus, Save } from 'lucide-react'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'

function makeDraft(account, session) {
  const metadata = session?.user?.user_metadata || {}
  const fallbackName = metadata.full_name || metadata.name || session?.user?.email?.split('@')[0] || ''
  return {
    fullName: account?.full_name || fallbackName,
    displayName: account?.display_name || account?.full_name || fallbackName,
    phone: account?.phone || '',
    avatarUrl: account?.avatar_url || '',
    city: account?.city || '',
    country: account?.country || 'BG',
    bio: account?.bio || '',
    locale: account?.locale || 'bg',
    marketingOptIn: Boolean(account?.marketing_opt_in),
  }
}

export default function CustomerPersonal({ account, session, onSave, onUploadAvatar }) {
  const [draft, setDraft] = useState(() => makeDraft(account, session))
  const [status, setStatus] = useState({ type: 'idle', message: '' })

  useEffect(() => {
    setDraft(makeDraft(account, session))
  }, [account, session])

  function update(key, value) {
    setDraft(current => ({ ...current, [key]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setStatus({ type: 'saving', message: 'Запазваме личните данни…' })
    try {
      await onSave(draft)
      setStatus({ type: 'saved', message: 'Личните данни са запазени.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Записът не успя.' })
    }
  }

  async function uploadAvatar(file) {
    if (!file) return
    setStatus({ type: 'uploading', message: 'Качваме аватара…' })
    try {
      const url = await onUploadAvatar(file)
      update('avatarUrl', url)
      setStatus({ type: 'uploaded', message: 'Аватарът е готов. Натисни „Запази“.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Качването не успя.' })
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-8 rounded-3xl border border-line bg-paper p-5 md:p-7 space-y-5">
        <div>
          <div className="eyebrow">Лични данни</div>
          <h2 className="mt-2 font-display text-3xl text-ink">Твоят клиентски профил</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-ink">Име<input value={draft.fullName} onChange={event => update('fullName', event.target.value)} className={INPUT} /></label>
          <label className="block text-sm font-medium text-ink">Показвано име<input value={draft.displayName} onChange={event => update('displayName', event.target.value)} className={INPUT} /></label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm font-medium text-ink">Телефон<input value={draft.phone} onChange={event => update('phone', event.target.value)} type="tel" className={INPUT} /></label>
          <label className="block text-sm font-medium text-ink">Град<input value={draft.city} onChange={event => update('city', event.target.value)} className={INPUT} /></label>
          <label className="block text-sm font-medium text-ink">Държава<input value={draft.country} onChange={event => update('country', event.target.value)} className={INPUT} /></label>
        </div>

        <label className="block text-sm font-medium text-ink">Имейл<input value={session?.user?.email || account?.email || ''} readOnly className={`${INPUT} bg-soft text-muted`} /></label>
        <label className="block text-sm font-medium text-ink">Кратко за мен<textarea value={draft.bio} onChange={event => update('bio', event.target.value)} rows={5} className={INPUT} /></label>

        <label className="flex items-start gap-3 rounded-2xl border border-line bg-soft p-4 text-sm text-muted">
          <input type="checkbox" checked={draft.marketingOptIn} onChange={event => update('marketingOptIn', event.target.checked)} className="mt-1 accent-black" />
          <span>Искам да получавам полезни идеи и новини от Totsan.</span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <div className={`text-sm ${status.type === 'error' ? 'text-red-700' : 'text-muted'}`}>{status.message || 'Промените се пазят само след запазване.'}</div>
          <button className="btn btn-primary" disabled={status.type === 'saving'}>
            <Save size={18} />
            {status.type === 'saving' ? 'Запазва се…' : 'Запази'}
          </button>
        </div>
      </div>

      <aside className="lg:col-span-4">
        <div className="rounded-3xl border border-line bg-paper p-5 md:p-6 lg:sticky lg:top-24">
          <div className="eyebrow">Аватар</div>
          <div className="mt-5 aspect-square overflow-hidden rounded-3xl border border-line bg-soft">
            {draft.avatarUrl ? <img src={draft.avatarUrl} alt={draft.displayName || draft.fullName} className="img-cover" /> : <div className="flex h-full w-full items-center justify-center text-muted">Няма снимка</div>}
          </div>
          <label className="btn btn-ghost mt-4 w-full cursor-pointer justify-center">
            <ImagePlus size={18} />
            Качи аватар
            <input type="file" accept="image/*" className="sr-only" onChange={async (event) => { await uploadAvatar(event.target.files?.[0]); event.target.value = '' }} />
          </label>
        </div>
      </aside>
    </form>
  )
}