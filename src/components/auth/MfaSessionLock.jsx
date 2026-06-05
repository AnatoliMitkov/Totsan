import { useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { normalizeMfaError, normalizeTotpCode } from '../../lib/mfa.js'

const DEFAULT_ERROR = 'Не успяхме да потвърдим кода. Опитай отново.'

export default function MfaSessionLock({ factor, onLogout, onVerified }) {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const token = normalizeTotpCode(code)

    if (!factor?.id) {
      setStatus('error')
      setMessage('Няма активен Authenticator за този профил.')
      return
    }

    if (token.length !== 6) {
      setStatus('error')
      setMessage('Въведи 6-цифрения код.')
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
      setMessage(normalizeMfaError(error, DEFAULT_ERROR))
      return
    }

    setStatus('saved')
    await onVerified?.()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-soft px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-line bg-paper p-6 shadow-[0_24px_70px_-52px_rgba(0,0,0,0.42)] sm:p-7">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-soft text-ink">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="mt-1 font-display text-3xl leading-none text-ink">2FA</h1>
          </div>
        </div>

        <p className="mt-5 text-sm text-muted">Въведи 6-цифрения код</p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            value={code}
            onChange={(event) => setCode(normalizeTotpCode(event.target.value))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="123456"
            className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-center text-2xl tracking-[0.24em] outline-none transition focus:border-ink"
          />

          <button type="submit" disabled={status === 'saving'} className="btn btn-primary w-full justify-center disabled:opacity-50">
            {status === 'saving' ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            {status === 'saving' ? 'Проверяваме…' : 'Потвърди'}
          </button>

          <button type="button" onClick={onLogout} className="btn btn-ghost w-full justify-center">
            Изход
          </button>
        </form>

        <button type="button" onClick={() => setShowHelp((value) => !value)} className="mt-4 text-sm font-medium text-accent hover:underline">
          Нямаш достъп до кода?
        </button>

        {showHelp && (
          <div className="mt-4 space-y-3 rounded-2xl border border-line bg-soft p-4 text-sm text-muted">
            <p><span className="font-medium text-ink">Пробвай резервен Authenticator.</span></p>
            <p><span className="font-medium text-ink">Смяната на парола не изключва 2FA.</span></p>
            <p>Ако нямаш достъп до нито един код, ще е нужна допълнителна проверка.</p>
          </div>
        )}

        {message && (
          <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${status === 'error' ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'border border-line bg-soft text-muted'}`}>
            {message}
          </div>
        )}
      </section>
    </main>
  )
}
