import { useEffect, useState } from 'react'
import { Fingerprint, KeyRound, Loader2, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import {
  formatPasskeyDate,
  getPasskeyCapability,
  getPasskeyEnvironmentWarning,
  normalizePasskeyError,
  passkeyDismissKey,
} from '../../lib/passkeys.js'

function usePasskeyCapability() {
  const [capability, setCapability] = useState(null)

  useEffect(() => {
    let active = true

    getPasskeyCapability().then((result) => {
      if (active) setCapability(result)
    })

    return () => {
      active = false
    }
  }, [])

  return capability
}

async function listPasskeys() {
  const { data, error } = await supabase.auth.passkey.list()
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export function PasskeySignInButton({ className = '' }) {
  const capability = usePasskeyCapability()
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  if (!capability || !capability.canUse) return null

  async function handleSignIn() {
    setStatus('saving')
    setMessage('')

    const { error } = await supabase.auth.signInWithPasskey()
    if (error) {
      setStatus('error')
      setMessage(normalizePasskeyError(error, 'Не успяхме да влезем с биометрия.'))
      return
    }

    setStatus('saved')
    setMessage('Входът е успешен.')
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={status === 'saving'}
        className="btn btn-ghost w-full justify-center !py-3 disabled:opacity-50"
      >
        {status === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={18} />}
        {status === 'saving' ? 'Потвърди на устройството' : 'Вход с биометрия'}
      </button>
      {message && (
        <div className={`mt-3 rounded-2xl px-4 py-3 text-sm ${status === 'error' ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'border border-line bg-soft text-muted'}`}>
          {message}
        </div>
      )}
    </div>
  )
}

export function PasskeySetupPrompt({ userId }) {
  const capability = usePasskeyCapability()
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!userId || !capability?.canUse) return undefined
    if (window.localStorage.getItem(passkeyDismissKey(userId))) return undefined

    let active = true

    listPasskeys()
      .then((items) => {
        if (active) setVisible(items.length === 0)
      })
      .catch(() => {
        if (active) setVisible(false)
      })

    return () => {
      active = false
    }
  }, [capability?.canUse, userId])

  if (!visible) return null

  function dismiss() {
    window.localStorage.setItem(passkeyDismissKey(userId), new Date().toISOString())
    setVisible(false)
  }

  async function handleRegister() {
    setStatus('saving')
    setMessage('')

    const { error } = await supabase.auth.registerPasskey()
    if (error) {
      setStatus('error')
      setMessage(normalizePasskeyError(error, 'Не успяхме да включим бърз вход.'))
      return
    }

    window.localStorage.setItem(passkeyDismissKey(userId), new Date().toISOString())
    setStatus('saved')
    setMessage('Готово. Следващия път можеш да влезеш по-бързо.')
    window.setTimeout(() => setVisible(false), 1200)
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-3xl border border-line bg-paper p-4 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.35)] md:bottom-6">
      <button type="button" onClick={dismiss} className="absolute right-3 top-3 rounded-full p-2 text-muted transition hover:bg-soft hover:text-ink" aria-label="Затвори">
        <X size={17} />
      </button>
      <div className="flex gap-3 pr-10">
        <div className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-soft text-ink">
          <Fingerprint size={20} />
        </div>
        <div>
          <div className="font-display text-2xl leading-tight text-ink">Да включим бърз вход?</div>
          <p className="mt-1 text-sm text-muted">Следващия път можеш да влезеш с пръстов отпечатък, лице или Windows Hello.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={handleRegister} disabled={status === 'saving'} className="btn btn-primary !py-2 text-sm disabled:opacity-50">
              {status === 'saving' ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
              {status === 'saving' ? 'Потвърди' : 'Включи'}
            </button>
            <button type="button" onClick={dismiss} className="btn btn-ghost !py-2 text-sm">По-късно</button>
          </div>
          {message && (
            <div className={`mt-3 rounded-2xl px-3 py-2 text-sm ${status === 'error' ? 'bg-amber-50 text-amber-800' : 'bg-soft text-muted'}`}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PasskeyManager({ userId, className = '' }) {
  const capability = usePasskeyCapability()
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState('')

  const canUsePasskeys = Boolean(capability?.canUse)

  useEffect(() => {
    if (!canUsePasskeys) return undefined

    let active = true

    async function load() {
      setStatus('loading')
      setMessage('')

      try {
        const nextItems = await listPasskeys()
        if (!active) return
        setItems(nextItems)
        setStatus('ready')
      } catch (error) {
        if (!active) return
        setStatus('error')
        setMessage(normalizePasskeyError(error, 'Не успяхме да заредим бързия вход.'))
      }
    }

    load()
    return () => {
      active = false
    }
  }, [canUsePasskeys])

  async function reload() {
    if (!canUsePasskeys) return

    setStatus('loading')
    setMessage('')

    try {
      setItems(await listPasskeys())
      setStatus('ready')
    } catch (error) {
      setStatus('error')
      setMessage(normalizePasskeyError(error, 'Не успяхме да обновим бързия вход.'))
    }
  }

  async function handleRegister() {
    if (!canUsePasskeys) {
      setStatus('error')
      setMessage(getPasskeyEnvironmentWarning())
      return
    }

    setStatus('saving')
    setMessage('')

    const { error } = await supabase.auth.registerPasskey()
    if (error) {
      setStatus('error')
      setMessage(normalizePasskeyError(error, 'Не успяхме да включим бърз вход.'))
      return
    }

    if (userId) window.localStorage.setItem(passkeyDismissKey(userId), new Date().toISOString())
    setMessage('Бързият вход е включен.')
    await reload()
  }

  async function handleDelete(passkeyId) {
    setBusyId(passkeyId)
    setMessage('')

    const { error } = await supabase.auth.passkey.delete({ passkeyId })
    setBusyId('')

    if (error) {
      setStatus('error')
      setMessage(normalizePasskeyError(error, 'Не успяхме да премахнем този вход.'))
      return
    }

    setItems((current) => current.filter((item) => item.id !== passkeyId))
    setStatus('ready')
    setMessage('Входът е премахнат.')
  }

  return (
    <section className={`rounded-3xl border border-line bg-paper p-5 md:p-6 ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Сигурност</div>
          <h3 className="mt-2 font-display text-3xl text-ink">Бърз вход</h3>
          <p className="mt-2 max-w-xl text-sm text-muted">Влизай с биометрия или PIN на устройството си, без да въвеждаш парола всеки път.</p>
        </div>
        <button type="button" onClick={reload} disabled={!canUsePasskeys || status === 'loading'} className="btn btn-ghost">
          <RefreshCw size={18} />
          {status === 'loading' ? 'Обновяване…' : 'Обнови'}
        </button>
      </div>

      {capability && !canUsePasskeys && (
        <div className="mt-5 rounded-2xl border border-line bg-soft px-4 py-3 text-sm text-muted">
          {getPasskeyEnvironmentWarning() || 'Бързият вход не е наличен в този браузър.'}
        </div>
      )}

      {canUsePasskeys && (
        <>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={handleRegister} disabled={status === 'saving'} className="btn btn-primary disabled:opacity-50">
              {status === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={18} />}
              {status === 'saving' ? 'Потвърди на устройството' : 'Включи на това устройство'}
            </button>
          </div>

          {message && (
            <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${status === 'error' ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'border border-line bg-soft text-muted'}`}>
              {message}
            </div>
          )}

          <div className="mt-5 space-y-3">
            {status === 'loading' && (
              <div className="rounded-2xl border border-line bg-soft px-4 py-3 text-sm text-muted">Зареждаме…</div>
            )}

            {status !== 'loading' && items.length === 0 && (
              <div className="rounded-2xl border border-dashed border-line bg-soft px-4 py-4 text-sm text-muted">
                Още няма включен бърз вход за този акаунт.
              </div>
            )}

            {items.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-soft px-4 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium text-ink">
                    <KeyRound size={17} />
                    {item.friendly_name || 'Бърз вход'}
                  </div>
                  <div className="mt-1 text-xs text-muted">Добавен: {formatPasskeyDate(item.created_at)}</div>
                  <div className="mt-1 text-xs text-muted">Последно ползване: {formatPasskeyDate(item.last_used_at)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  disabled={busyId === item.id}
                  className="btn btn-ghost !py-2 text-sm"
                >
                  <Trash2 size={17} />
                  {busyId === item.id ? 'Премахване…' : 'Премахни'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
