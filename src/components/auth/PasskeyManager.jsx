import { useEffect, useState } from 'react'
import { Fingerprint, KeyRound, Loader2, LogOut, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import {
  clearPasskeyVerifiedSession,
  formatPasskeyDate,
  getPasskeyCapability,
  getPasskeyEnvironmentWarning,
  getPasskeySecurityState,
  markPasskeyVerifiedSession,
  normalizePasskeyError,
  normalizePasskeyVerificationError,
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

    const { data, error } = await supabase.auth.signInWithPasskey()
    if (error) {
      setStatus('error')
      setMessage(normalizePasskeyError(error, 'Не успяхме да влезем с биометрия.'))
      return
    }

    const verifiedUserId = data?.user?.id || data?.session?.user?.id || ''
    if (verifiedUserId) markPasskeyVerifiedSession(verifiedUserId)

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
    setMessage('Готово. Следващия път можеш да влезеш по-сигурно и по-бързо.')
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
          <div className="font-display text-2xl leading-tight text-ink">Бърз вход</div>
          <p className="mt-1 text-sm text-muted">Лице, пръстов отпечатък или ключ.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={handleRegister} disabled={status === 'saving'} className="btn btn-primary !py-2 text-sm disabled:opacity-50">
              {status === 'saving' ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
              {status === 'saving' ? 'Потвърди' : 'Включи бърз вход'}
            </button>
            <button type="button" onClick={dismiss} className="btn btn-ghost !py-2 text-sm">По-късно</button>
          </div>
          <p className="mt-3 text-xs text-muted">Смени устройство? Добави нов passkey от Сигурност.</p>
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

export function PasskeyVerificationGate({ session, onVerified, className = '' }) {
  const capability = usePasskeyCapability()
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [showBrowserHelp, setShowBrowserHelp] = useState(false)
  const userId = session?.user?.id || ''
  const canUsePasskeys = Boolean(capability?.canUse)
  const warning = capability && !canUsePasskeys ? getPasskeyEnvironmentWarning() : ''

  async function handleVerify() {
    if (!userId) return

    setStatus('saving')
    setMessage('')

    const { data, error } = await supabase.auth.signInWithPasskey()
    if (error) {
      setStatus('error')
      setMessage(normalizePasskeyVerificationError(error))
      return
    }

    const returnedUserId = data?.user?.id || data?.session?.user?.id || ''
    if (returnedUserId && returnedUserId !== userId) {
      clearPasskeyVerifiedSession(userId)
      setStatus('error')
      setMessage('На това устройство няма passkey за този профил. Влез с Google/имейл и добави нов passkey от Сигурност.')
      return
    }

    markPasskeyVerifiedSession(userId)
    setStatus('saved')
    setMessage('Потвърждението е успешно.')
    onVerified?.()
  }

  return (
    <section className={`mx-auto w-full max-w-[34rem] rounded-3xl border border-line bg-paper p-4 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.35)] sm:p-5 md:p-6 ${className}`.trim()}>
      <div className="flex items-start gap-3">
        <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-soft text-ink sm:inline-flex">
          <ShieldCheck size={21} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="eyebrow">Passkey</div>
          <h2 className="mt-2 font-display text-[1.85rem] leading-none text-ink sm:text-4xl">Потвърди се</h2>
          <p className="mt-3 text-sm leading-6 text-muted">Потвърди с биометрия.</p>
        </div>
      </div>

      {warning && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 sm:px-4">
          {warning}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-line bg-soft px-3 py-3 text-sm leading-6 text-muted sm:px-4">
        Нямаш passkey? Влез с Google или имейл.
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
        <button
          type="button"
          onClick={handleVerify}
          disabled={!canUsePasskeys || status === 'saving'}
          className="btn btn-primary w-full justify-center disabled:opacity-50"
        >
          {status === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={18} />}
          {status === 'saving' ? 'Потвърди на устройството' : 'Потвърди с биометрия'}
        </button>
        <button type="button" onClick={() => supabase.auth.signOut()} className="btn btn-ghost w-full justify-center sm:w-auto">
          <LogOut size={18} />
          Изход
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => setShowBrowserHelp((value) => !value)}
          className="text-left text-sm font-medium text-accent hover:underline"
          aria-expanded={showBrowserHelp}
        >
          Не работи на този браузър?
        </button>
        <Link to="/contact" className="text-sm font-medium text-accent hover:underline">
          Свържи се с нас
        </Link>
      </div>

      {showBrowserHelp && (
        <div className="mt-3 rounded-2xl border border-line bg-soft px-3 py-3 text-sm leading-6 text-muted sm:px-4">
          Някои мобилни браузъри може да не поддържат passkey/биометрично потвърждение коректно. Пробвай с Chrome, Firefox или Edge. Ако нямаш достъп до passkey, използвай възстановяване на достъпа.
        </div>
      )}

      {message && (
        <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${status === 'error' ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'border border-line bg-soft text-muted'}`}>
          {message}
        </div>
      )}
    </section>
  )
}

export default function PasskeyManager({ userId, session, className = '' }) {
  const capability = usePasskeyCapability()
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState('')
  const [protectionEnabled, setProtectionEnabled] = useState(() => getPasskeySecurityState(session?.user).requirePasskeyVerification)

  const canUsePasskeys = Boolean(capability?.canUse)
  const hasPasskeys = items.length > 0

  useEffect(() => {
    setProtectionEnabled(getPasskeySecurityState(session?.user).requirePasskeyVerification)
  }, [session?.user?.id, session?.user?.user_metadata?.require_passkey_verification])

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

  async function updateProtectionPreference(nextValue, successMessage = '') {
    const currentUser = session?.user
    if (!currentUser?.id) {
      throw new Error('Влез в профила си, за да управляваш тази защита.')
    }

    const { error } = await supabase.auth.updateUser({
      data: {
        ...(currentUser.user_metadata || {}),
        require_passkey_verification: nextValue,
      },
    })

    if (error) throw error

    setProtectionEnabled(Boolean(nextValue))
    if (nextValue) {
      markPasskeyVerifiedSession(currentUser.id)
    } else {
      clearPasskeyVerifiedSession(currentUser.id)
    }
    if (successMessage) setMessage(successMessage)
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

  async function handleToggleProtection() {
    if (!hasPasskeys) {
      setStatus('error')
      setMessage('Първо добави passkey, за да включиш тази допълнителна защита.')
      return
    }

    setStatus('saving')
    setMessage('')

    try {
      const nextValue = !protectionEnabled
      await updateProtectionPreference(
        nextValue,
        nextValue
          ? 'Допълнителната защита е включена.'
          : 'Допълнителната защита е изключена.'
      )
      setStatus('ready')
    } catch (error) {
      setStatus('error')
      setMessage(normalizePasskeyError(error, 'Не успяхме да обновим настройката за допълнителна защита.'))
    }
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

    const nextItems = items.filter((item) => item.id !== passkeyId)
    setItems(nextItems)
    setStatus('ready')

    try {
      if (nextItems.length === 0 && protectionEnabled) {
        await updateProtectionPreference(false)
        setMessage('Последният passkey е премахнат, затова допълнителната защита беше изключена автоматично.')
        return
      }
    } catch (updateError) {
      setStatus('error')
      setMessage(normalizePasskeyError(updateError, 'Passkey-ът е премахнат, но не успяхме да обновим настройката за защита.'))
      return
    }

    setMessage('Входът е премахнат.')
  }

  return (
    <section className={`rounded-3xl border border-line bg-paper p-5 md:p-6 ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Сигурност</div>
          <h3 className="mt-2 font-display text-3xl text-ink">Passkey</h3>
          <p className="mt-2 max-w-xl text-sm text-muted">Бърз вход с биометрия.</p>
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
          {!hasPasskeys ? (
            <div className="mt-5 rounded-2xl border border-line bg-soft px-4 py-4">
              <div className="font-medium text-ink">Няма passkey</div>
              <p className="mt-2 max-w-2xl text-sm text-muted">Добави лице, пръстов отпечатък или ключ.</p>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-4">
              <div className="font-medium text-green-900">Passkey е активен</div>
              <p className="mt-2 max-w-2xl text-sm text-green-800">Готово за бърз вход.</p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={handleRegister} disabled={status === 'saving'} className="btn btn-primary disabled:opacity-50">
              {status === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={18} />}
              {status === 'saving' ? 'Потвърди на устройството' : 'Включи бърз вход'}
            </button>
          </div>

          <p className="mt-3 text-sm text-muted">Ново устройство? Добави нов passkey.</p>

          <div className={`mt-5 rounded-2xl border px-4 py-4 ${protectionEnabled ? 'border-green-200 bg-green-50' : 'border-line bg-soft'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="max-w-2xl">
                <div className={protectionEnabled ? 'font-medium text-green-900' : 'font-medium text-ink'}>
                  Допълнителна защита
                </div>
                <p className={`mt-1 text-sm ${protectionEnabled ? 'text-green-800' : 'text-muted'}`}>
                  {protectionEnabled
                    ? 'Искаме passkey преди защитените части.'
                    : 'Искай passkey преди защитените части.'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={protectionEnabled}
                onClick={handleToggleProtection}
                disabled={status === 'saving' || !hasPasskeys}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${protectionEnabled ? 'bg-accent' : 'bg-line'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-paper shadow transition ${protectionEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <p className={`mt-3 text-xs ${protectionEnabled ? 'text-green-800' : 'text-muted'}`}>
              {hasPasskeys
                ? 'Можеш да я изключиш по всяко време.'
                : 'Първо добави passkey.'}
            </p>
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

            {status !== 'loading' && !hasPasskeys && (
              <div className="rounded-2xl border border-dashed border-line bg-soft px-4 py-4 text-sm text-muted">
                Няма активен passkey.
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
