import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Circle, Eye, EyeOff, Lightbulb, Mail, Search, Sparkles, UserRound, Wrench } from 'lucide-react'
import { signOutAndRedirect, useAccount } from '../lib/account.js'
import { supabase } from '../lib/supabase.js'

const INPUT_CLASS = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'
const TERMS_REQUIRED_MESSAGE = 'Първо потвърди, че се съгласяваш с общите условия и политиката за поверителност.'
const PRODUCTION_APP_ORIGIN = 'https://totsan.com'

const welcomeCards = [
  {
    title: 'Имам проект за ремонт',
    to: '/moy-profil?tab=project',
    icon: Wrench,
  },
  {
    title: 'Търся специалист',
    to: '/katalog',
    icon: Search,
  },
  {
    title: 'Събирам идеи',
    to: '/start',
    icon: Lightbulb,
  },
  {
    title: 'Не съм сигурен откъде да започна',
    to: '/kontakt',
    icon: Sparkles,
  },
]

export function CheckEmailPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') || location.state?.email || ''

  return (
    <OnboardingShell eyebrow="Totsan account" icon={Mail}>
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="h-section">Проверете имейла си</h1>
        {email && (
          <p className="mt-4 rounded-2xl border border-line bg-paper/70 px-4 py-3 text-sm text-muted backdrop-blur">
            Изпратихме линк до: <span className="font-medium text-ink">{email}</span>
          </p>
        )}
        <p className="mt-5 text-lg text-ink/80">
          Натиснете линка в имейла, за да активирате акаунта си.
        </p>
        <p className="mt-3 text-sm text-muted">
          Ако не виждате имейла, проверете Spam или Promotions.
        </p>
        <Link to="/login" className="btn btn-primary mt-8">
          Към вход
          <ArrowRight size={18} />
        </Link>
      </div>
    </OnboardingShell>
  )
}

export function WelcomePage() {
  return (
    <OnboardingShell eyebrow="Client hub" icon={UserRound}>
      <div className="mx-auto max-w-4xl">
        <div className="max-w-2xl">
          <h1 className="h-section">Добре дошли в Totsan</h1>
          <p className="mt-4 text-lg text-ink/80">
            Нека започнем с най-важното — какво искате да направите?
          </p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {welcomeCards.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.title}
                to={card.to}
                className="group flex min-h-28 items-center justify-between gap-4 rounded-2xl border border-line bg-paper/80 p-5 text-left shadow-[0_20px_50px_-42px_rgba(13,35,64,0.45)] backdrop-blur transition hover:-translate-y-0.5 hover:border-ink/25 hover:bg-paper"
              >
                <span className="flex min-w-0 items-center gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accentSoft text-accentDeep">
                    <Icon size={20} />
                  </span>
                  <span className="font-medium leading-snug text-ink">{card.title}</span>
                </span>
                <ArrowRight size={18} className="shrink-0 text-muted transition group-hover:translate-x-1 group-hover:text-accentDeep" />
              </Link>
            )
          })}
        </div>
      </div>
    </OnboardingShell>
  )
}

export function PartnerOnboardingPage() {
  return <ProOnboardingPage />
}

export function ProStartPage() {
  const navigate = useNavigate()
  const { session, account, loading } = useAccount()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [termsTouched, setTermsTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  const pwdRules = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }
  const pwdValid = Object.values(pwdRules).every(Boolean)

  function updateTermsAccepted(checked) {
    setTermsAccepted(checked)
    if (!checked) return
    setTermsTouched(false)
    if (message === TERMS_REQUIRED_MESSAGE) {
      setStatus('idle')
      setMessage('')
    }
  }

  async function submit(event) {
    event.preventDefault()

    if (!name.trim()) {
      setStatus('error')
      setMessage('Въведете име или фирма.')
      return
    }
    if (!email.trim()) {
      setStatus('error')
      setMessage('Въведете имейл.')
      return
    }
    if (!pwdValid) {
      setStatus('error')
      setMessage('Покрийте изискванията за парола.')
      return
    }
    if (password !== confirmPassword) {
      setStatus('error')
      setMessage('Паролите не съвпадат.')
      return
    }
    if (!termsAccepted) {
      setTermsTouched(true)
      setStatus('error')
      setMessage(TERMS_REQUIRED_MESSAGE)
      return
    }

    setStatus('sending')
    setMessage('')

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: new URL('/pro/onboarding', getAuthRedirectOrigin()).toString(),
        data: {
          full_name: name.trim(),
          display_name: name.trim(),
          role: 'specialist',
        },
      },
    })

    if (error) {
      setStatus('error')
      setMessage(error.message)
      return
    }

    setStatus('sent')
    setMessage('Партньорският акаунт е създаден. След потвърждение ще продължите към кандидатурата си.')
    const checkEmailParams = new URLSearchParams()
    checkEmailParams.set('type', 'partner')
    checkEmailParams.set('email', email.trim())
    navigate(`/check-email?${checkEmailParams.toString()}`, {
      replace: true,
      state: { email: email.trim(), type: 'partner' },
    })
  }

  if (loading) {
    return (
      <OnboardingShell eyebrow="Totsan Pro" icon={Wrench} compact>
        <LoggedInProCard
          title="Проверяваме акаунта…"
          text="Зареждаме текущия ви достъп."
        />
      </OnboardingShell>
    )
  }

  if (session && account?.role === 'specialist') {
    return (
      <OnboardingShell eyebrow="Totsan Pro" icon={Wrench} compact>
        <LoggedInProCard
          title="Вече имате партньорски акаунт"
          text="Продължете към кандидатурата си за партньор."
          primaryTo="/pro/onboarding"
          primaryLabel="Продължи към кандидатурата"
        />
      </OnboardingShell>
    )
  }

  if (session && account?.role === 'admin') {
    return (
      <OnboardingShell eyebrow="Totsan Pro" icon={Wrench} compact>
        <LoggedInProCard
          title="Влезли сте като администратор"
          primaryTo="/admin"
          primaryLabel="Към админ панела"
        />
      </OnboardingShell>
    )
  }

  if (session) {
    return (
      <OnboardingShell eyebrow="Totsan Pro" icon={Wrench} compact>
        <LoggedInProCard
          title="Вече сте влезли в Totsan"
          text="Партньорските акаунти се създават отделно през Totsan Pro. Ако искате да кандидатствате като партньор, излезте и създайте партньорски акаунт."
          primaryTo="/moy-profil"
          primaryLabel="Към моя профил"
          secondaryAction={() => signOutAndRedirect(session.user?.id)}
          secondaryLabel="Изход"
        />
      </OnboardingShell>
    )
  }

  return (
    <OnboardingShell eyebrow="Totsan Pro" icon={Wrench} compact>
      <div className="mx-auto max-w-xl">
        <h1 className="h-section">Създайте партньорски акаунт</h1>
        <p className="mt-4 text-lg text-ink/80">
          След потвърждение на имейла ще продължите към кандидатурата си за партньор.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block text-sm font-medium text-ink">
            Име / фирма
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              type="text"
              autoComplete="organization"
              placeholder="Totsan Studio"
              className={INPUT_CLASS}
            />
          </label>
          <label className="block text-sm font-medium text-ink">
            Имейл
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              placeholder="name@email.com"
              className={INPUT_CLASS}
            />
          </label>
          <PasswordField
            label="Парола"
            value={password}
            onChange={setPassword}
            show={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
            autoComplete="new-password"
          />
          {password && (
            <div className="space-y-1.5 text-xs">
              <div className="text-muted">Изисквания за паролата:</div>
              <RuleItem isValid={pwdRules.length} text="Минимум 8 знака" />
              <RuleItem isValid={pwdRules.uppercase} text="Поне една главна буква" />
              <RuleItem isValid={pwdRules.lowercase} text="Поне една малка буква" />
              <RuleItem isValid={pwdRules.number} text="Поне едно число" />
              <RuleItem isValid={pwdRules.special} text="Специален символ" />
            </div>
          )}
          <PasswordField
            label="Потвърди паролата"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((value) => !value)}
            autoComplete="new-password"
          />
          <label className={`flex items-start gap-3 rounded-2xl border px-3 py-3 text-sm transition ${termsTouched && !termsAccepted ? 'border-red-300 bg-red-50 text-red-700' : 'border-transparent text-muted'}`}>
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => updateTermsAccepted(event.target.checked)}
              aria-invalid={termsTouched && !termsAccepted}
              className={`mt-0.5 rounded focus:ring-2 ${termsTouched && !termsAccepted ? 'border-red-500 text-red-600 focus:ring-red-200' : 'border-line text-accent focus:ring-accent'}`}
            />
            <span>
              Съгласявам се с{' '}
              <Link to="/obshti-usloviya" onClick={(event) => event.stopPropagation()} className="font-medium text-accent hover:underline">
                общите условия
              </Link>
              {' '}и{' '}
              <Link to="/politika-za-poveritelnost" onClick={(event) => event.stopPropagation()} className="font-medium text-accent hover:underline">
                политиката за поверителност
              </Link>
            </span>
          </label>
          <button disabled={status === 'sending'} className="btn btn-primary w-full justify-center !py-3.5 text-base disabled:opacity-60">
            {status === 'sending' ? 'Обработка…' : 'Създай акаунт'}
          </button>
        </form>
        {message && (
          <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${status === 'error' ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-line bg-soft text-muted'}`}>
            {message}
          </div>
        )}
      </div>
    </OnboardingShell>
  )
}

function LoggedInProCard({ title, text = '', primaryTo = '', primaryLabel = '', secondaryAction, secondaryLabel = '' }) {
  return (
    <div className="mx-auto max-w-xl text-center">
      <h1 className="h-section">{title}</h1>
      {text && <p className="mt-4 text-lg text-ink/80">{text}</p>}
      {(primaryTo || secondaryAction) && (
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {primaryTo && (
            <Link to={primaryTo} className="btn btn-primary">
              {primaryLabel}
              <ArrowRight size={18} />
            </Link>
          )}
          {secondaryAction && (
            <button type="button" onClick={secondaryAction} className="btn btn-ghost">
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function ProOnboardingPage() {
  return (
    <OnboardingShell eyebrow="Totsan Pro" icon={Wrench}>
      <div className="mx-auto max-w-2xl">
        <h1 className="h-section">Завършете кандидатурата си</h1>
        <p className="mt-5 text-lg text-ink/80">
          Вече имате партньорски акаунт. Остава да добавите информация за услугите си, за да можем да прегледаме кандидатурата ви.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/moy-profil" className="btn btn-primary">
            Започни кандидатура
            <ArrowRight size={18} />
          </Link>
          <Link to="/pro" className="btn btn-ghost">
            За Totsan Pro
          </Link>
        </div>
      </div>
    </OnboardingShell>
  )
}

function normalizeOrigin(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return ''

  try {
    return new URL(raw).origin
  } catch {
    return ''
  }
}

function isLocalOrigin(origin = '') {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
}

function getAuthRedirectOrigin() {
  if (typeof window === 'undefined') return PRODUCTION_APP_ORIGIN

  const currentOrigin = window.location.origin
  if (isLocalOrigin(currentOrigin)) return currentOrigin

  const configuredOrigin = normalizeOrigin(import.meta.env.VITE_APP_URL || import.meta.env.VITE_SITE_URL || import.meta.env.VITE_PUBLIC_APP_URL)
  if (configuredOrigin) return configuredOrigin

  if (import.meta.env.DEV) return currentOrigin
  return currentOrigin
}

function PasswordField({ label, value, onChange, show, onToggle, autoComplete }) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <div className="relative mt-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder="Въведи парола"
          className={`${INPUT_CLASS} mt-0 pr-12`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? 'Скрий паролата' : 'Покажи паролата'}
          aria-pressed={show}
          className="group absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-all duration-300 hover:scale-110 hover:bg-soft hover:text-accent active:scale-95 active:rotate-6"
        >
          <span className="relative inline-flex h-5 w-5 items-center justify-center">
            <Eye className={`absolute h-5 w-5 transition-all duration-300 ${show ? 'scale-75 rotate-[-16deg] opacity-0' : 'scale-100 rotate-0 opacity-100'}`} />
            <EyeOff className={`absolute h-5 w-5 transition-all duration-300 ${show ? 'scale-100 rotate-0 opacity-100' : 'scale-75 rotate-[16deg] opacity-0'}`} />
          </span>
        </button>
      </div>
    </label>
  )
}

function RuleItem({ isValid, text }) {
  return (
    <div className={`flex items-center gap-2 ${isValid ? 'text-green-600' : 'text-muted'}`}>
      {isValid ? <CheckCircle2 size={14} className="shrink-0" /> : <Circle size={14} className="shrink-0" />}
      <span>{text}</span>
    </div>
  )
}

function OnboardingShell({ eyebrow, icon: Icon, children, compact = false }) {
  return (
    <section className={`section relative min-h-[calc(100vh-var(--header-h,0px))] overflow-hidden bg-soft ${compact ? '!py-8 md:!py-10' : ''}`}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-6rem] h-[24rem] w-[24rem] rounded-full bg-accentSoft/80 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-7rem] h-[24rem] w-[24rem] rounded-full bg-cloud/90 blur-3xl" />
      </div>
      <div className="container-page relative">
        <div className={`${compact ? 'mb-4 h-12 w-12' : 'mb-7 h-14 w-14'} mx-auto flex items-center justify-center rounded-full border border-white/70 bg-paper/70 text-accentDeep shadow-[0_20px_60px_-42px_rgba(13,35,64,0.5)] backdrop-blur`}>
          <Icon size={24} />
        </div>
        <div className="eyebrow mb-4 text-center">{eyebrow}</div>
        <div className="rounded-[2rem] border border-white/70 bg-paper/65 p-6 shadow-[0_30px_90px_-60px_rgba(13,35,64,0.55)] backdrop-blur md:p-10">
          {children}
        </div>
      </div>
    </section>
  )
}
