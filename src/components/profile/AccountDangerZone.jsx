import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Mail, Trash2 } from 'lucide-react'
import { deleteOwnAccount, signOutAndRedirect } from '../../lib/account.js'

export default function AccountDangerZone({ account, session }) {
  const email = session?.user?.email || account?.email || ''
  const [confirmation, setConfirmation] = useState('')
  const [state, setState] = useState({ status: 'idle', message: '' })
  const [isHolding, setIsHolding] = useState(false)
  const holdTimerRef = useRef(null)

  const canDelete = useMemo(() => {
    return email && confirmation.trim().toLowerCase() === email.toLowerCase()
  }, [confirmation, email])

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!canDelete) cancelHold()
  }, [canDelete]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete() {
    if (!canDelete || state.status === 'deleting') return

    cancelHold()
    setState({ status: 'deleting', message: 'Изтриваме профила...' })
    try {
      await deleteOwnAccount(confirmation)
      setState({ status: 'deleted', message: 'Профилът е изтрит. Пренасочваме те към началната страница.' })
      window.setTimeout(() => {
        void signOutAndRedirect(session?.user?.id)
      }, 700)
    } catch (error) {
      setState({ status: 'error', message: error.message || 'Профилът не можа да бъде изтрит.' })
    }
  }

  function startHold(event) {
    event?.preventDefault()
    if (!canDelete || state.status === 'deleting' || state.status === 'deleted' || isHolding) return

    setState({ status: 'idle', message: '' })
    setIsHolding(true)
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null
      void handleDelete()
    }, 2000)
  }

  function cancelHold() {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    setIsHolding(false)
  }

  function handleKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (event.repeat) return
    startHold(event)
  }

  function handleKeyUp(event) {
    if (event.key === 'Enter' || event.key === ' ') cancelHold()
  }

  const deleteButtonLabel = state.status === 'deleting'
    ? 'Изтриване...'
    : isHolding
      ? 'Задръж още малко...'
      : 'Изтриване'

  return (
    <section className="rounded-3xl border border-red-200 bg-red-50/80 p-5 shadow-[0_12px_40px_rgba(127,29,29,0.05)] md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-red-700 shadow-sm">
          <AlertTriangle size={22} />
        </span>
        <div>
          <div className="eyebrow text-red-800">Опасна зона</div>
          <h2 className="mt-1 font-display text-2xl text-red-950">Изтриване на профила</h2>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-red-200 bg-white/70 p-4 text-sm leading-6 text-red-950/80">
        <strong className="font-semibold text-red-950">Внимание! Това действие е необратимо.</strong>
        <p className="mt-1">
          При изтриване на профила, акаунтът и свързаните с него данни ще бъдат премахнати според правилата за съхранение на платформата.
        </p>
      </div>

      <label className="mt-5 block text-sm font-medium text-red-950">
        Въведи имейла си <span className="text-red-700">{email}</span> за потвърждение:
        <span className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-red-200 bg-white px-4 text-ink transition focus-within:border-red-400">
          <Mail size={18} className="shrink-0 text-red-400" />
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            type="email"
            autoComplete="email"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            placeholder={email || 'email@example.com'}
            disabled={state.status === 'deleting' || state.status === 'deleted'}
          />
        </span>
      </label>

      {state.message && (
        <p className={`mt-3 text-sm ${state.status === 'error' ? 'text-red-700' : 'text-red-950/75'}`}>
          {state.message}
        </p>
      )}

      <button
        type="button"
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onPointerLeave={cancelHold}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onClick={(event) => event.preventDefault()}
        disabled={!canDelete || state.status === 'deleting' || state.status === 'deleted'}
        className="btn btn-primary group relative mt-5 w-full justify-center overflow-hidden border-red-200 !bg-red-600 !text-white hover:!bg-red-700 hover:!shadow-[0_10px_25px_-5px_rgba(220,38,38,0.42)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          className={`absolute inset-y-0 left-0 z-0 bg-red-900/35 ${isHolding ? 'w-full transition-[width] duration-[2000ms] ease-linear' : 'w-0 transition-none'}`}
          aria-hidden="true"
        />
        <span className="relative z-10 inline-flex items-center gap-2">
          <Trash2 size={18} />
          {deleteButtonLabel}
        </span>
      </button>
    </section>
  )
}
