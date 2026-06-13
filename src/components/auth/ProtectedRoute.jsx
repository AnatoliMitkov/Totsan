import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowRight, Headphones, Home, Lightbulb, LogOut, ShieldAlert } from 'lucide-react'
import { signOutAndRedirect, useAccount } from '../../lib/account.js'

const BLOCKED_ACCOUNT_STATUSES = new Set(['banned', 'blocked'])

function BlockedAccountScreen({ userId }) {
  return (
    <section className="blocked-account-screen relative isolate min-h-[calc(100dvh-var(--header-h,0px))] overflow-hidden bg-[#edf4ff] lg:h-[calc(100dvh-var(--header-h,0px))] lg:min-h-0">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.9),transparent_28%),radial-gradient(circle_at_78%_48%,rgba(255,255,255,0.88),transparent_32%),linear-gradient(180deg,#eef6ff_0%,#f8fbff_100%)]" />

      <div className="relative mx-auto grid min-h-[calc(100dvh-var(--header-h,0px))] w-full items-center gap-6 px-4 py-6 sm:px-6 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1.08fr)_minmax(30rem,0.92fr)] lg:gap-0 lg:px-0 lg:py-0">
        <div className="relative order-2 min-h-[18rem] overflow-hidden rounded-[2rem] lg:absolute lg:inset-y-0 lg:left-0 lg:order-1 lg:h-full lg:w-[55vw] lg:min-h-0 lg:rounded-none">
          <picture>
            <img
              src="/Images/totsan_restricted_construction_scene_clean.png"
              alt="Restricted construction zone"
              className="absolute inset-0 h-full w-full object-cover object-left-bottom"
              decoding="async"
            />
          </picture>
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/4 bg-gradient-to-l from-[#edf4ff] to-transparent lg:block" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#edf4ff] to-transparent lg:hidden" />
        </div>

        <div className="order-1 mx-auto w-full max-w-[38rem] lg:order-2 lg:col-start-2 lg:mr-[clamp(2rem,5vw,5rem)] lg:ml-0">
          <div className="rounded-[2rem] border border-white/75 bg-white/72 p-6 shadow-[0_30px_95px_rgba(25,49,86,0.14)] backdrop-blur-xl sm:p-8 lg:p-10 xl:p-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-red-200 bg-red-50 text-red-600 shadow-sm" aria-hidden="true">
              <ShieldAlert size={30} strokeWidth={1.9} />
            </div>

            <h1 className="mt-8 font-display text-4xl leading-[1.05] tracking-normal text-ink sm:text-5xl">
              Достъпът до акаунта е
              <span className="block font-semibold">временно ограничен</span>
            </h1>

            <p className="mt-7 text-base leading-8 text-ink/82 sm:text-lg">
              Този акаунт е временно ограничен. Ако смятате, че това е грешка, свържете се с екипа на Totsan.
            </p>

            <div className="mt-8 flex gap-4 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-left shadow-sm">
              <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Lightbulb size={20} />
              </span>
              <p className="text-sm leading-7 text-ink/82">
                Ако имате активни разговори, оферти или текущ профил в платформата, екипът ни ще ви помогне да изясните статуса.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link to="/kontakt" className="btn btn-primary min-h-14 flex-1 justify-center rounded-full bg-ink px-6 text-base text-paper hover:bg-accentDeep">
                <Headphones size={20} />
                Свържи се с екипа
                <ArrowRight size={20} />
              </Link>
              <Link to="/" className="btn btn-ghost min-h-14 flex-1 justify-center rounded-full border-line bg-white/65 px-6 text-base">
                <Home size={18} />
                Към началото
              </Link>
            </div>

            <div className="mt-8 border-t border-line pt-5">
              <button type="button" className="inline-flex items-center gap-2 rounded-full px-2 py-2 text-sm font-medium text-muted transition hover:text-ink" onClick={() => signOutAndRedirect(userId)}>
                <LogOut size={17} />
                Изход
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { session, account, loading, mfaRequired } = useAccount()
  const location = useLocation()

  if (loading) {
    return (
      <section className="flex h-[calc(100vh-var(--header-h,0px))] items-center justify-center bg-soft">
        <div className="text-muted">Проверяваме достъпа…</div>
      </section>
    )
  }

  if (!session) {
    const searchParams = new URLSearchParams()
    searchParams.set('next', location.pathname + location.search)
    return <Navigate to={`/login?${searchParams.toString()}`} replace />
  }

  if (mfaRequired) return null

  if (BLOCKED_ACCOUNT_STATUSES.has(account?.account_status)) {
    return <BlockedAccountScreen userId={session?.user?.id} />
  }

  if (requireAdmin && account?.role !== 'admin') {
    return <Navigate to="/moy-profil" replace />
  }

  return children
}
