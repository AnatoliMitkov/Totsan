import { useEffect, useState } from 'react'
import { KeyRound, Loader2, RefreshCw, ShieldCheck, ShieldOff, Smartphone, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { getVerifiedTotpFactors, loadMfaStatus, normalizeMfaError, normalizeTotpCode } from '../../lib/mfa.js'

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
      setMessage('Не намерихме активен 2FA фактор за този профил.')
      return
    }

    if (token.length !== 6) {
      setStatus('error')
      setMessage('Въведи 6-цифрения код от authenticator приложението.')
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
    setMessage('2FA проверката е успешна.')
    onVerified?.()
  }

  return (
    <section className={`mx-auto w-full max-w-[34rem] rounded-3xl border border-line bg-paper p-4 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.35)] sm:p-5 md:p-6 ${className}`.trim()}>
      <div className="flex items-start gap-3">
        <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-soft text-ink sm:inline-flex">
          <ShieldCheck size={21} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="eyebrow">2FA проверка</div>
          <h2 className="mt-2 font-display text-[1.85rem] leading-none text-ink sm:text-4xl">Въведи 6-цифрения код</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Този профил има включена 2FA с Authenticator приложение. Потвърди кода, за да продължиш към защитените части.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-3">
        <label className="block text-sm font-medium text-ink">
          Код от приложението
          <input
            value={code}
            onChange={(event) => setCode(normalizeTotpCode(event.target.value))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-center text-xl tracking-[0.2em] outline-none transition focus:border-ink"
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <button type="submit" disabled={status === 'saving'} className="btn btn-primary w-full justify-center disabled:opacity-50">
            {status === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            {status === 'saving' ? 'Проверяваме…' : 'Потвърди 2FA'}
          </button>
          <button type="button" onClick={() => supabase.auth.signOut()} className="btn btn-ghost w-full justify-center sm:w-auto">
            Изход
          </button>
        </div>
      </form>

      <div className="mt-4 rounded-2xl border border-line bg-soft px-3 py-3 text-sm leading-6 text-muted sm:px-4">
        Ако загубиш достъп до authenticator приложението, ще трябва да използваш възстановяване на акаунта или поддръжка. Recovery codes не са включени в този flow.
      </div>

      <Link to="/contact" className="mt-3 inline-flex text-sm font-medium text-accent hover:underline">
        Свържи се с нас
      </Link>

      {message && (
        <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${status === 'error' ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'border border-line bg-soft text-muted'}`}>
          {message}
        </div>
      )}
    </section>
  )
}

export default function TotpMfaManager({ className = '' }) {
  const [factors, setFactors] = useState([])
  const [enrollment, setEnrollment] = useState(null)
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState('')
  const hasVerifiedFactor = factors.length > 0
  const qrCode = sanitizeQrCode(enrollment?.totp?.qr_code)
  const secret = enrollment?.totp?.secret || ''

  useEffect(() => {
    reload()
  }, [])

  async function reload() {
    setStatus('loading')
    setMessage('')

    try {
      const data = await listMfaFactors()
      setFactors(data.verifiedTotp)
      setStatus('ready')
    } catch (error) {
      setStatus('error')
      setMessage(normalizeMfaError(error, 'Не успяхме да заредим 2FA настройките.'))
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
      setMessage('Сесията за проверка изтече. Стартирай отново.')
      return
    }

    if (token.length !== 6) {
      setStatus('error')
      setMessage('Въведи 6-цифрения код от authenticator приложението.')
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

    setEnrollment(null)
    setCode('')
    setMessage('2FA е активирана.')
    await reload()
  }

  async function removeFactor(factorId) {
    setBusyId(factorId)
    setMessage('')

    try {
      const statusData = await loadMfaStatus()
      if (statusData.currentLevel !== 'aal2') {
        setStatus('error')
        setMessage('За да премахнеш 2FA, първо потвърди 6-цифрения код при вход.')
        return
      }

      const { error } = await supabase.auth.mfa.unenroll({ factorId })
      if (error) throw error

      setFactors((current) => current.filter((factor) => factor.id !== factorId))
      setStatus('ready')
      setMessage('2FA факторът е премахнат.')
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
          <div className="eyebrow">Native MFA</div>
          <h3 className="mt-2 font-display text-3xl text-ink">2FA с Authenticator приложение</h3>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Добави втори фактор с Google Authenticator, Microsoft Authenticator, Authy или друго приложение. При вход ще въвеждаш 6-цифрен код след обичайния вход.
          </p>
        </div>
        <button type="button" onClick={reload} disabled={status === 'loading' || status === 'saving'} className="btn btn-ghost">
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
          <p className="mt-2 max-w-2xl text-sm text-green-800">Защитените части на акаунта ще изискват AAL2 с код от authenticator приложение.</p>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-line bg-soft px-4 py-4">
          <div className="flex items-center gap-2 font-medium text-ink">
            <Smartphone size={18} />
            Няма активна 2FA
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted">Passkeys остават отделен бърз вход. Тази настройка добавя истински TOTP MFA код.</p>
        </div>
      )}

      {!hasVerifiedFactor && !enrollment && (
        <button type="button" onClick={startEnrollment} disabled={status === 'saving'} className="btn btn-primary mt-5 disabled:opacity-50">
          {status === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
          Включи 2FA
        </button>
      )}

      {enrollment && (
        <form onSubmit={verifyEnrollment} className="mt-5 rounded-2xl border border-line bg-soft p-4">
          <div className="grid gap-5 md:grid-cols-[auto_1fr]">
            {qrCode && (
              <img src={qrCode} alt="QR код за 2FA" className="h-44 w-44 rounded-2xl border border-line bg-paper p-3" />
            )}
            <div className="min-w-0">
              <div className="font-medium text-ink">Сканирай QR кода</div>
              <p className="mt-2 text-sm leading-6 text-muted">
                Сканирай QR кода с Google Authenticator, Microsoft Authenticator, Authy, 1Password или друго приложение.
              </p>
              {secret && (
                <div className="mt-3 rounded-2xl border border-line bg-paper px-3 py-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted">Ръчен ключ</div>
                  <code className="mt-1 block break-all text-sm text-ink">{secret}</code>
                </div>
              )}
              <label className="mt-4 block text-sm font-medium text-ink">
                6-цифрен код
                <input
                  value={code}
                  onChange={(event) => setCode(normalizeTotpCode(event.target.value))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-center text-xl tracking-[0.2em] outline-none transition focus:border-ink"
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="submit" disabled={status === 'saving'} className="btn btn-primary disabled:opacity-50">
                  {status === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                  Потвърди и включи
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnrollment(null)
                    setCode('')
                    setMessage('')
                    setStatus('ready')
                  }}
                  className="btn btn-ghost"
                >
                  Отказ
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      <div className="mt-5 rounded-2xl border border-line bg-soft px-4 py-4 text-sm leading-6 text-muted">
        Ако загубиш достъп до authenticator приложението, ще трябва да използваш възстановяване на акаунта или поддръжка. Препоръчително е да добавиш 2FA на устройство, до което имаш постоянен достъп.
      </div>

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
                  {factor.friendly_name || 'Authenticator приложение'}
                </div>
                <div className="mt-1 text-xs text-muted">Добавен: {formatFactorDate(factor.created_at)}</div>
              </div>
              <button type="button" onClick={() => removeFactor(factor.id)} disabled={busyId === factor.id} className="btn btn-ghost !py-2 text-sm">
                {busyId === factor.id ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
                {busyId === factor.id ? 'Премахване…' : 'Премахни 2FA'}
              </button>
            </div>
          ))}
        </div>
      )}

      {!hasVerifiedFactor && status !== 'loading' && (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-dashed border-line bg-soft px-4 py-4 text-sm text-muted">
          <ShieldOff size={18} />
          2FA не е включена за този акаунт.
        </div>
      )}
    </section>
  )
}
