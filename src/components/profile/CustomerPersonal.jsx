import { useEffect, useRef, useState } from 'react'
import { Pencil, Save } from 'lucide-react'
import ImageCropperModal from './ImageCropperModal.jsx'
import Avatar from '../Avatar.jsx'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'
const MAX_AVATAR_BYTES = 10 * 1024 * 1024
const AVATAR_SAVE_ERROR = 'Не успяхме да запазим снимката. Опитай отново.'

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

function validateAvatarFile(file) {
  if (!file) return 'Липсва файл.'
  if (!file.type.startsWith('image/')) return 'Моля, избери изображение.'
  if (file.size > MAX_AVATAR_BYTES) return 'Снимката трябва да е до 10 MB.'
  return ''
}

function withCacheBust(url) {
  if (!url) return ''
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}v=${Date.now()}`
}

function stripAvatarCacheBust(url) {
  if (!url) return ''

  try {
    const parsed = new URL(url)
    parsed.searchParams.delete('v')
    return parsed.toString()
  } catch {
    return url.replace(/([?&])v=\d+(&?)/, (_, prefix, suffix) => {
      if (prefix === '?' && suffix) return '?'
      return suffix ? prefix : ''
    }).replace(/[?&]$/, '')
  }
}

export default function CustomerPersonal({ account, session, onSave, onUploadAvatar }) {
  const [draft, setDraft] = useState(() => makeDraft(account, session))
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [avatarEditor, setAvatarEditor] = useState({ open: false, file: null, imageUrl: '', fileName: 'avatar.jpg' })
  const fileInputRef = useRef(null)
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

  function openAvatarEditor() {
    if (draft.avatarUrl) {
      setAvatarEditor({
        open: true,
        file: null,
        imageUrl: draft.avatarUrl,
        fileName: draft.displayName ? `${draft.displayName}-avatar.jpg` : 'avatar.jpg',
      })
      return
    }

    fileInputRef.current?.click()
  }

  function closeAvatarEditor() {
    setAvatarEditor(current => ({ ...current, open: false }))
  }

  function handleAvatarFile(file) {
    const error = validateAvatarFile(file)
    if (error) {
      setStatus({ type: 'error', message: error })
      return
    }

    setAvatarEditor({
      open: true,
      file,
      imageUrl: '',
      fileName: file.name || 'avatar.jpg',
    })
  }

  async function submit(event) {
    event.preventDefault()
    setStatus({ type: 'saving', message: 'Запазваме личните данни…' })
    try {
      const payload = {
        ...draftRef.current,
        avatarUrl: stripAvatarCacheBust(draftRef.current.avatarUrl),
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

  async function saveAvatar(croppedFile) {
    setStatus({ type: 'uploading', message: 'Запазваме снимката…' })

    try {
      const avatarUrl = await onUploadAvatar(croppedFile)
      const displayAvatarUrl = withCacheBust(avatarUrl)
      const nextDraft = {
        ...draftRef.current,
        avatarUrl: displayAvatarUrl,
      }

      setDraft(nextDraft)
      draftRef.current = nextDraft

      const savedAccount = await onSave({
        ...nextDraft,
        avatarUrl,
      })

      const syncedDraft = {
        ...makeDraft(savedAccount, session),
        avatarUrl: displayAvatarUrl,
      }

      setDraft(syncedDraft)
      draftRef.current = syncedDraft
      setStatus({ type: 'saved', message: 'Снимката е запазена.' })
    } catch (error) {
      setStatus({ type: 'error', message: AVATAR_SAVE_ERROR })
      throw error
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
          <button className="btn btn-primary" disabled={status.type === 'saving' || status.type === 'uploading'}>
            <Save size={18} />
            {status.type === 'saving' ? 'Запазва се…' : 'Запази'}
          </button>
        </div>
      </div>

      <aside className="lg:col-span-4">
        <div className="rounded-3xl border border-line bg-paper p-5 md:p-6 lg:sticky lg:top-24">
          <div className="eyebrow">Аватар</div>
          <div className="group relative mt-5 flex justify-center">
            <button type="button" onClick={openAvatarEditor} className="relative rounded-full transition hover:ring-2 hover:ring-ink focus:outline-none focus:ring-2 focus:ring-ink" aria-label="Смени снимката">
              <Avatar src={draft.avatarUrl} name={draft.displayName || draft.fullName} size={200} />
              <div className="absolute inset-0 hidden items-center justify-center rounded-full bg-ink/40 text-paper opacity-0 transition md:flex md:group-hover:opacity-100">
                <Pencil size={32} />
              </div>
            </button>
          </div>

          <button type="button" onClick={openAvatarEditor} className="btn btn-ghost mt-4 w-full justify-center md:hidden">
            <Pencil size={18} />
            {draft.avatarUrl ? 'Редактирай снимка' : 'Качи снимка'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) handleAvatarFile(file)
            }}
          />
        </div>
      </aside>

      {avatarEditor.open && (
        <ImageCropperModal
          file={avatarEditor.file}
          imageUrl={avatarEditor.imageUrl}
          initialFileName={avatarEditor.fileName}
          onClose={closeAvatarEditor}
          onSelectFile={async (file) => {
            const error = validateAvatarFile(file)
            if (error) {
              setStatus({ type: 'error', message: error })
              return
            }

            setStatus(current => current.type === 'error' ? { type: 'idle', message: '' } : current)
            setAvatarEditor({
              open: true,
              file,
              imageUrl: '',
              fileName: file.name || 'avatar.jpg',
            })
          }}
          onCropSave={saveAvatar}
        />
      )}
    </form>
  )
}
