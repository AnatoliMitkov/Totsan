import { useEffect, useRef, useState } from 'react'
import { LocationCombobox } from '../ui/LocationCombobox.jsx'
import { normalizeLocationValue } from '../../lib/locations.js'
import FloatingSaveBar from './FloatingSaveBar.jsx'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'

function makeDraft(account, session) {
  const metadata = session?.user?.user_metadata || {}
  const fallbackName = metadata.full_name || metadata.name || session?.user?.email?.split('@')[0] || ''
  return {
    fullName: account?.full_name || fallbackName,
    displayName: account?.full_name || account?.display_name || fallbackName,
    phone: account?.phone || '',
    avatarUrl: account?.avatar_url || '',
    city: account?.city || '',
    country: account?.country || 'BG',
    bio: account?.bio || '',
    locale: account?.locale || 'bg',
    marketingOptIn: Boolean(account?.marketing_opt_in),
  }
}

export default function CustomerPersonal({ account, session, onSave }) {
  const [draft, setDraft] = useState(() => makeDraft(account, session))
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const draftRef = useRef(draft)

  useEffect(() => {
    const nextDraft = makeDraft(account, session)
    setDraft(nextDraft)
    draftRef.current = nextDraft
  }, [account, session])

  function update(key, value) {
    setDraft(current => {
      const nextDraft = { ...current, [key]: value }
      draftRef.current = nextDraft
      return nextDraft
    })
  }

  async function submit(event) {
    event.preventDefault()
    setStatus({ type: 'saving', message: 'Запазваме личните данни…' })
    try {
      const payload = {
        ...draftRef.current,
        displayName: draftRef.current.fullName,
        avatarUrl: draftRef.current.avatarUrl,
        city: normalizeLocationValue(draftRef.current.city),
      }
      const savedAccount = await onSave(payload)
      const nextDraft = makeDraft(savedAccount, session)
      setDraft(nextDraft)
      draftRef.current = nextDraft
      setStatus({ type: 'saved', message: 'Личните данни са запазени.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Записът не успя.' })
    }
  }

  function cancelChanges() {
    const nextDraft = makeDraft(account, session)
    setDraft(nextDraft)
    draftRef.current = nextDraft
    setStatus({ type: 'idle', message: '' })
  }

  return (
    <form onSubmit={submit} className="max-w-4xl pb-0">
      <div className="rounded-3xl border border-line bg-paper p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] md:p-7 space-y-5">
        <div>
          <div className="eyebrow">Лични данни</div>
          <h2 className="mt-2 font-display text-3xl text-ink">Твоят клиентски профил</h2>
        </div>

        <label className="block text-sm font-medium text-ink">Имена<input value={draft.fullName} onChange={event => update('fullName', event.target.value)} className={INPUT} /></label>

        <div className="grid gap-4 md:grid-cols-[minmax(12rem,0.85fr)_minmax(0,2.15fr)]">
          <label className="block text-sm font-medium text-ink">Телефон<input value={draft.phone} onChange={event => update('phone', event.target.value)} type="tel" className={INPUT} /></label>
          <LocationCombobox label="Град" value={draft.city} onChange={(value) => update('city', value)} />
        </div>

        <label className="block text-sm font-medium text-ink">Имейл<input value={session?.user?.email || account?.email || ''} readOnly className={`${INPUT} bg-soft text-muted`} /></label>
        <label className="block text-sm font-medium text-ink">Кратко за мен<textarea value={draft.bio} onChange={event => update('bio', event.target.value)} rows={5} className={INPUT} /></label>

        <label className="flex items-start gap-3 rounded-2xl border border-line bg-soft p-4 text-sm text-muted">
          <input type="checkbox" checked={draft.marketingOptIn} onChange={event => update('marketingOptIn', event.target.checked)} className="mt-1 accent-black" />
          <span>Искам да получавам полезни идеи и новини от Totsan.</span>
        </label>

      </div>
      <FloatingSaveBar
        status={status.type}
        message={status.message}
        idleMessage="Промените се пазят само след запазване."
        onCancel={cancelChanges}
        disabled={status.type === 'saving' || status.type === 'uploading'}
      />
    </form>
  )
}
