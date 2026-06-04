import { useEffect, useState } from 'react'
import { KeyRound, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import {
  formatPasskeyDate,
  getPasskeyEnvironmentWarning,
} from '../../lib/passkeys.js'

function normalizeErrorMessage(error, fallback) {
  const message = String(error?.message || '').trim()

  if (!message) return fallback
  if (message.includes('passkey') && message.includes('disabled')) {
    return 'Passkey входът още не е включен в Supabase Auth настройките за този проект.'
  }
  if (message.includes('AuthSessionMissingError') || message.includes('session')) {
    return 'Нужна е активна сесия, за да управляваш passkeys.'
  }

  return message
}

export default function PasskeyManager({ mode = 'manage', className = '' }) {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState('')

  const environmentWarning = getPasskeyEnvironmentWarning()
  const canUsePasskeys = !environmentWarning

  useEffect(() => {
    if (mode !== 'manage' || !canUsePasskeys) return undefined

    let active = true

    async function load() {
      setStatus('loading')
      setMessage('')
      const { data, error } = await supabase.auth.passkey.list()
      if (!active) return

      if (error) {
        setStatus('error')
        setMessage(normalizeErrorMessage(error, 'Не успяхме да заредим passkeys.'))
        return
      }

      setItems(Array.isArray(data) ? data : [])
      setStatus('ready')
    }

    load()
    return () => {
      active = false
    }
  }, [mode, canUsePasskeys])

  async function handleRegister() {
    if (!canUsePasskeys) {
      setStatus('error')
      setMessage(environmentWarning)
      return
    }

    setStatus('saving')
    setMessage('')

    const { data, error } = await supabase.auth.registerPasskey()
    if (error) {
      setStatus('error')
      setMessage(normalizeErrorMessage(error, 'Не успяхме да регистрираме passkey.'))
      return
    }

    setStatus('saved')
    setMessage(`Passkey-ът е добавен успешно${data?.friendly_name ? `: ${data.friendly_name}` : '.'}`)

    if (mode === 'manage') {
      const { data: nextData } = await supabase.auth.passkey.list()
      setItems(Array.isArray(nextData) ? nextData : [])
      setStatus('ready')
    }
  }

  async function handleDelete(passkeyId) {
    setBusyId(passkeyId)
    setMessage('')

    const { error } = await supabase.auth.passkey.delete({ passkeyId })
    setBusyId('')

    if (error) {
      setStatus('error')
      setMessage(normalizeErrorMessage(error, 'Не успяхме да премахнем passkey-а.'))
      return
    }

    setItems((current) => current.filter((item) => item.id !== passkeyId))
    setStatus('ready')
    setMessage('Passkey-ът е премахнат.')
  }

  async function handleRefresh() {
    if (mode !== 'manage' || !canUsePasskeys) return

    setStatus('loading')
    setMessage('')
    const { data, error } = await supabase.auth.passkey.list()
    if (error) {
      setStatus('error')
      setMessage(normalizeErrorMessage(error, 'Не успяхме да обновим passkeys.'))
      return
    }

    setItems(Array.isArray(data) ? data : [])
    setStatus('ready')
  }

  return (
    <section className={`rounded-3xl border border-line bg-paper p-5 md:p-6 ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Passkeys</div>
          <h3 className="mt-2 font-display text-2xl text-ink">
            {mode === 'login' ? 'Вход без парола' : 'Биометричен вход'}
          </h3>
          <p className="mt-2 text-sm text-muted">
            {mode === 'login'
              ? 'Влез с Face ID, Touch ID, Windows Hello или хардуерен ключ.'
              : 'Добави passkey за по-бърз и по-сигурен вход в профила си.'}
          </p>
        </div>
        {mode === 'manage' && (
          <button type="button" onClick={handleRefresh} disabled={status === 'loading'} className="btn btn-ghost">
            <RefreshCw size={18} />
            {status === 'loading' ? 'Обновяване…' : 'Обнови'}
          </button>
        )}
      </div>

      {environmentWarning && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {environmentWarning}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {mode === 'login' ? (
          <button type="button" onClick={handleSignIn} disabled={!canUsePasskeys || status === 'saving'} className="btn btn-primary">
            <KeyRound size={18} />
            {status === 'saving' ? 'Изчакваме устройството…' : 'Вход с passkey'}
          </button>
        ) : (
          <button type="button" onClick={handleRegister} disabled={!canUsePasskeys || status === 'saving'} className="btn btn-primary">
            <KeyRound size={18} />
            {status === 'saving' ? 'Добавяме passkey…' : 'Добави passkey'}
          </button>
        )}
      </div>

      {message && (
        <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${status === 'error' ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-line bg-soft text-muted'}`}>
          {message}
        </div>
      )}

      {mode === 'manage' && canUsePasskeys && (
        <div className="mt-5 space-y-3">
          {status === 'loading' && (
            <div className="rounded-2xl border border-line bg-soft px-4 py-3 text-sm text-muted">Зареждаме passkeys…</div>
          )}

          {status !== 'loading' && items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-soft px-4 py-4 text-sm text-muted">
              Още няма добавен passkey за този акаунт.
            </div>
          )}

          {items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-soft px-4 py-4">
              <div className="min-w-0">
                <div className="font-medium text-ink">{item.friendly_name || 'Passkey'}</div>
                <div className="mt-1 text-xs text-muted">
                  Създаден: {formatPasskeyDate(item.created_at)}
                </div>
                <div className="mt-1 text-xs text-muted">
                  Последно ползване: {formatPasskeyDate(item.last_used_at)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                disabled={busyId === item.id}
                className="btn btn-ghost"
              >
                <Trash2 size={18} />
                {busyId === item.id ? 'Премахване…' : 'Премахни'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )

  async function handleSignIn() {
    if (!canUsePasskeys) {
      setStatus('error')
      setMessage(environmentWarning)
      return
    }

    setStatus('saving')
    setMessage('')

    const { error } = await supabase.auth.signInWithPasskey()
    if (error) {
      setStatus('error')
      setMessage(normalizeErrorMessage(error, 'Не успяхме да влезем с passkey.'))
      return
    }

    setStatus('saved')
    setMessage('Входът с passkey е успешен.')
  }
}
