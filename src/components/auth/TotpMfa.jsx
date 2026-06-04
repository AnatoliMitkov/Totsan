import { useEffect, useState } from 'react'
import { KeyRound, Loader2, RefreshCw, ShieldCheck, ShieldOff, Smartphone, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import {
  clearPendingMfaEnrollment,
  getVerifiedTotpFactors,
  loadMfaStatus,
  loadPendingMfaEnrollment,
  normalizeMfaError,
  normalizeTotpCode,
  savePendingMfaEnrollment,
} from '../../lib/mfa.js'

async function signOutToHome() {
  await supabase.auth.signOut()
  if (typeof window !== 'undefined') {
    window.location.assign('/')
  }
}

async function listMfaFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw error
  return {
    verifiedTotp: getVerifiedTotpFactors(data),
    all: Array.isArray(data?.all) ? data.all : [],
  }
}

function formatFactorDate(value) {
  if (!value) return 'Скоро'

  try {
    return new Date(value).toLocaleString('bg-BG')
  } catch {
    return value
  }
}

function sanitizeQrCode(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.startsWith('data:image/svg+xml')) return raw
  return ''
}

export function TotpMfaChallengeGate({ factor, onVerified, className = '' }) {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  async function submit(event) {
    event.preventDefault()
    const token = normalizeTotpCode(code)

    if (!factor?.id) {
      setStatus('error')
      setMessage('Няма активна 2FA за този профил.')
      return
    }

    if (token.length !== 6) {
      setStatus('error')
      setMessage('Въведи 6-цифрен код.')
      return
    }

    setStatus('saving')
    setMessage('')

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: token,
    })

    if (error) {
      setStatus('error')
      setMessage(normalizeMfaError(error, 'Кодът не е правилен. Провери приложението и опитай отново.'))
      return
    }

    setStatus('saved')
    setMessage('Кодът е приет.')
    onVerified?.()
  }

  return (
    <section className={`mx-auto w-full max-w-[34rem] rounded-3xl border border-line bg-paper p-4 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.35)] sm:p-5 md:p-6 ${className}`.trim()}>
      <div className="flex items-start gap-3">
        <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-soft text-ink sm:inline-flex">
          <ShieldCheck size={21} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="eyebrow">2FA</div>
          <h2 className="mt-2 font-display text-[1.85rem] leading-none text-ink sm:text-4xl">Въведи кода</h2>
          <p className="mt-3 text-sm leading-6 text-muted">6 цифри.</p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-3">
        <input
          value={code}
          onChange={(event) => setCode(normalizeTotpCode(event.target.value))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-center text-xl tracking-[0.2em] outline-none transition focus:border-ink"
        />

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <button type="submit" disabled={status === 'saving'} className="btn btn-primary w-full justify-center transition-transform duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15 disabled:opacity-50">
            {status === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            {status === 'saving' ? 'Проверяваме…' : 'Потвърди'}
          </button>
          <button type="button" onClick={signOutToHome} className="btn btn-ghost w-full justify-center transition-transform duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15 sm:w-auto">
            Изход
          </button>
        </div>
      </form>

      <div className="mt-4 text-sm text-muted">Нямаш код? <Link to="/contact" className="font-medium text-accent hover:underline">Помощ</Link></div>

      {message && (
        <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${status === 'error' ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'border border-line bg-soft text-muted'}`}>
          {message}
        </div>
      )}
    </section>
  )
}

export default function TotpMfaManager({ session, className = '' }) {
  const userId = session?.user?.id || ''
  const [factors, setFactors] = useState([])
  const [enrollment, setEnrollment] = useState(() => loadPendingMfaEnrollment(userId))
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState('')
  const hasVerifiedFactor = factors.length > 0
  const qrCode = sanitizeQrCode(enrollment?.totp?.qr_code)
  const secret = enrollment?.totp?.secret || ''

  useEffect(() => {
    setEnrollment(loadPendingMfaEnrollment(userId))
    reload({ preserveMessage: true })
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      const pending = loadPendingMfaEnrollment(userId)
      if (pending?.id) {
        setEnrollment(pending)
        setStatus('enrolling')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
    }
  }, [userId])

  async function reload(options = {}) {
    const { preserveMessage = false } = options
    setStatus('loading')
    if (!preserveMessage) setMessage('')

    try {
      const data = await listMfaFactors()
      setFactors(data.verifiedTotp)
      if (data.verifiedTotp.length > 0) {
        clearPendingMfaEnrollment(userId)
        setEnrollment(null)
      } else {
        const pending = loadPendingMfaEnrollment(userId)
        setEnrollment(pending)
      }
      setStatus(loadPendingMfaEnrollment(userId)?.id ? 'enrolling' : 'ready')
    } catch (error) {
      setStatus('error')
      setMessage(normalizeMfaError(error, 'Не успяхме да заредим 2FA.'))
    }
  }

  async function startEnrollment() {
    setStatus('saving')
    setMessage('')
    setCode('')

    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Totsan Authenticator',
      })
      if (error) throw error
      setEnrollment(data)
      savePendingMfaEnrollment(userId, data)
      setStatus('enrolling')
    } catch (error) {
      setStatus('error')
      setMessage(normalizeMfaError(error, 'Не успяхме да включим 2FA. Опитай отново.'))
    }
  }

  async function verifyEnrollment(event) {
    event.preventDefault()
    const token = normalizeTotpCode(code)

    if (!enrollment?.id) {
      setStatus('error')
      setMessage('Стартирай отново.')
      return
    }

    if (token.length !== 6) {
      setStatus('error')
      setMessage('Въведи 6-цифрен код.')
      return
    }

    setStatus('saving')
    setMessage('')

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.id,
      code: token,
    })

    if (error) {
      setStatus('enrolling')
      setMessage(normalizeMfaError(error, 'Кодът не е правилен. Провери приложението и опитай отново.'))
      return
    }

    clearPendingMfaEnrollment(userId)
    setEnrollment(null)
    setCode('')
    setMessage('2FA е включена.')
    await reload({ preserveMessage: true })
  }

  function cancelEnrollment() {
    clearPendingMfaEnrollment(userId)
    setEnrollment(null)
    setCode('')
    setMessage('')
    setStatus('ready')
  }

  async function removeFactor(factorId) {
    setBusyId(factorId)
    setMessage('')

    try {
      const statusData = await loadMfaStatus()
      if (statusData.currentLevel !== 'aal2') {
        setStatus('error')
        setMessage('Първо потвърди кода при вход.')
        return
      }

      const { error } = await supabase.auth.mfa.unenroll({ factorId })
      if (error) throw error

      setFactors((current) => current.filter((factor) => factor.id !== factorId))
      setStatus('ready')
      setMessage('2FA е премахната.')
    } catch (error) {
      setStatus('error')
      setMessage(normalizeMfaError(error, 'Не успяхме да премахнем 2FA. Опитай отново.'))
    } finally {
      setBusyId('')
    }
  }

  return (
    <section className={`rounded-3xl border border-line bg-paper p-5 md:p-6 ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Сигурност</div>
          <h3 className="mt-2 font-display text-3xl text-ink">2FA</h3>
          <p className="mt-2 max-w-xl text-sm text-muted">6-цифрен код при вход.</p>
        </div>
        <button type="button" onClick={() => reload()} disabled={status === 'loading' || status === 'saving'} className="btn btn-ghost">
          <RefreshCw size={18} />
          {status === 'loading' ? 'Обновяване…' : 'Обнови'}
        </button>
      </div>

      {hasVerifiedFactor ? (
        <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-4">
          <div className="flex items-center gap-2 font-medium text-green-900">
            <ShieldCheck size={18} />
            2FA е активна
          </div>
        </div>
      ) : null}

      {!hasVerifiedFactor && !enrollment && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={startEnrollment} disabled={status === 'saving'} className="btn btn-primary transition-transform duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15 disabled:opacity-50">
            {status === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            Включи 2FA
          </button>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Smartphone size={16} />
            Google Authenticator и др.
          </div>
        </div>
      )}

      {enrollment && (
        <form onSubmit={verifyEnrollment} className="mt-5 rounded-2xl border border-line bg-soft p-4">
          <div className="grid gap-4 md:grid-cols-[auto_1fr]">
            {qrCode && (
              <img src={qrCode} alt="QR код за 2FA" className="h-40 w-40 rounded-2xl border border-line bg-paper p-3" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-medium text-ink">
                <KeyRound size={17} />
                Сканирай и въведи код
              </div>
              {secret && (
                <div className="mt-3 rounded-2xl border border-line bg-paper px-3 py-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted">Ръчно</div>
                  <code className="mt-1 block break-all text-sm text-ink">{secret}</code>
                </div>
              )}
              <input
                value={code}
                onChange={(event) => setCode(normalizeTotpCode(event.target.value))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                className="mt-4 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-center text-xl tracking-[0.2em] outline-none transition focus:border-ink"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="submit" disabled={status === 'saving'} className="btn btn-primary transition-transform duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15 disabled:opacity-50">
                  {status === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                  Потвърди
                </button>
                <button type="button" onClick={cancelEnrollment} className="btn btn-ghost">
                  Отказ
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {message && (
        <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${status === 'error' ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'border border-line bg-soft text-muted'}`}>
          {message}
        </div>
      )}

      {hasVerifiedFactor && (
        <div className="mt-5 space-y-3">
          {factors.map((factor) => (
            <div key={factor.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-soft px-4 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium text-ink">
                  <KeyRound size={17} />
                  {factor.friendly_name || 'Authenticator'}
                </div>
                <div className="mt-1 text-xs text-muted">Добавен: {formatFactorDate(factor.created_at)}</div>
              </div>
              <button type="button" onClick={() => removeFactor(factor.id)} disabled={busyId === factor.id} className="btn btn-ghost !py-2 text-sm">
                {busyId === factor.id ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
                {busyId === factor.id ? 'Премахване…' : 'Премахни'}
              </button>
            </div>
          ))}
        </div>
      )}

      {!hasVerifiedFactor && !enrollment && status !== 'loading' && !message && (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-dashed border-line bg-soft px-4 py-4 text-sm text-muted">
          <ShieldOff size={18} />
          2FA е изключена
        </div>
      )}
    </section>
  )
}
