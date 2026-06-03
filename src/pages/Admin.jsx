import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowRight, BarChart3, ClipboardList, CreditCard, FileClock, FolderKanban, KeyRound, Mail, MessagesSquare, PackageCheck, ScrollText, Search, ShieldCheck, Sparkles, Star, UserCog, Users, CheckCircle2, Circle, Eye, EyeOff } from 'lucide-react'
import { brand, supabase } from '../lib/supabase.js'
import { HERO_COLLAGE, HOME_PROJECTS } from '../data/images.js'
import { getAccountDisplayName, useAccount } from '../lib/account.js'

const INPUT_CLASS = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'

const STATUS_LABELS = {
  new: 'Ново',
  seen: 'Прегледано',
  replied: 'Отговорено',
  closed: 'Затворено',
  pending: 'Чака',
}

const DashboardSection = lazy(() => import('../components/admin/Dashboard.jsx'))
const UsersManagerSection = lazy(() => import('../components/admin/UsersManager.jsx'))
const InquiriesManagerSection = lazy(() => import('../components/admin/InquiriesManager.jsx'))
const ApplicationsManagerSection = lazy(() => import('../components/admin/ApplicationsManager.jsx'))
const AuditLogSection = lazy(() => import('../components/admin/AuditLog.jsx'))
const ProfileManagerSection = lazy(() => import('../components/admin/ProfileManager.jsx'))
const PartnerServicesManagerSection = lazy(() => import('../components/admin/PartnerServicesManager.jsx'))
const OrdersManagerSection = lazy(() => import('../components/admin/OrdersManager.jsx'))
const ReviewsManagerSection = lazy(() => import('../components/admin/ReviewsManager.jsx'))

const ADMIN_SECTIONS = [
  { id: 'dashboard', label: 'Обзор', hint: 'KPI и последни събития', icon: BarChart3, Component: DashboardSection },
  { id: 'users', label: 'Потребители', hint: 'Роли, статуси, ban', icon: Users, Component: UsersManagerSection },
  { id: 'inquiries', label: 'Запитвания', hint: 'Форми, източници и статуси', icon: ClipboardList, Component: InquiriesManagerSection },
  { id: 'applications', label: 'Кандидатури', hint: 'Одобрение на специалисти', icon: UserCog, Component: ApplicationsManagerSection },
  { id: 'profiles', label: 'Профили', hint: 'Публичност и профилна модерация', icon: FolderKanban, Component: ProfileManagerSection },
  { id: 'partner-services', label: 'Услуги', hint: 'Модерация на партньорски услуги', icon: PackageCheck, Component: PartnerServicesManagerSection },
  { id: 'orders', label: 'Поръчки', hint: 'Плащания, статуси, спорове', icon: CreditCard, Component: OrdersManagerSection },
  { id: 'reviews', label: 'Отзиви', hint: 'Verified отзиви и сигнали', icon: Star, Component: ReviewsManagerSection },
  { id: 'audit', label: 'Audit log', hint: 'Админ действия', icon: ScrollText, Component: AuditLogSection },
]

export default function Admin() {
  const { session, account, loading } = useAccount()
  const location = useLocation()

  if (loading) return <div className="flex h-screen items-center justify-center bg-soft"><div className="text-muted">Зареждане…</div></div>
  if (!session) return <LoginPanel />

  if (location.pathname === '/login') {
    return <Navigate to={resolvePostLoginTarget(location, account)} replace />
  }

  if (account?.role !== 'admin') {
    return (
      <AdminShell session={session} account={account}>
        <NoAccessPanel session={session} account={account} />
      </AdminShell>
    )
  }

  return <AdminShell session={session} account={account}><AdminWorkspace session={session} account={account} /></AdminShell>
}

function resolvePostLoginTarget(location, account) {
  const params = new URLSearchParams(location.search || '')
  const next = normalizeNextPath(params.get('next') || '')

  if (account?.role === 'admin') {
    return next && next !== '/' ? next : '/admin'
  }

  if (next && next !== '/' && !next.startsWith('/admin')) {
    return next
  }

  return '/moy-profil'
}

function normalizeNextPath(value = '') {
  const raw = String(value || '').trim()
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return ''
  if (raw.startsWith('/login')) return ''
  return raw
}

function AdminShell({ children, session, account }) {
  const title = 'Админ контролен панел.'
  const subtitle = `Добре дошъл обратно, ${getAccountDisplayName(account, session, 'admin')}.`

  return (
    <section className="section !pt-12 md:!pt-16 bg-soft min-h-screen relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-7rem] h-[22rem] w-[22rem] rounded-full bg-accentSoft/80 blur-3xl"></div>
        <div className="absolute right-[-5rem] top-24 h-[18rem] w-[18rem] rounded-full bg-cloud blur-3xl"></div>
        <div className="absolute bottom-[-8rem] left-1/3 h-[18rem] w-[18rem] rounded-full bg-paper/80 blur-3xl"></div>
      </div>
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 md:px-8 xl:px-12 relative">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <div className="eyebrow">Totsan Admin</div>
            <h1 className="h-section mt-2 text-[clamp(2rem,1.8rem+1vw,3rem)]">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted">{subtitle}</p>
          </div>
          <button className="btn btn-ghost self-start md:self-auto" onClick={() => supabase.auth.signOut()}>Изход</button>
        </div>
        {children}
      </div>
    </section>
  )
}

function AdminWorkspace({ session, account }) {
  const initialSection = typeof window === 'undefined' ? 'dashboard' : window.location.hash.replace('#', '') || 'dashboard'
  const [activeSection, setActiveSection] = useState(ADMIN_SECTIONS.some((section) => section.id === initialSection) ? initialSection : 'dashboard')
  const [globalQuery, setGlobalQuery] = useState('')
  const active = ADMIN_SECTIONS.find((section) => section.id === activeSection) || ADMIN_SECTIONS[0]
  const ActiveComponent = active.Component

  function openSection(sectionId) {
    setActiveSection(sectionId)
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `#${sectionId}`)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex group lg:sticky lg:top-24 z-20 w-[4.5rem] hover:w-[16rem] transition-all duration-300 overflow-hidden rounded-[2rem] border border-line bg-paper p-2 shadow-[0_20px_60px_-50px_rgba(0,0,0,0.15)] h-[calc(100vh-8rem)] flex-col shrink-0">
        <div className="px-3.5 py-4 min-h-[4rem] flex items-center overflow-hidden whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75 shrink-0">
           <div className="eyebrow">Навигация</div>
        </div>
        <nav className="mt-1 grid gap-1 flex-1 overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar">
          {ADMIN_SECTIONS.map((section) => {
            const Icon = section.icon
            const isActive = section.id === activeSection
            return (
              <button key={section.id} type="button" onClick={() => openSection(section.id)} title={section.label} className={`flex w-full items-center gap-4 rounded-2xl p-3 text-left transition whitespace-nowrap overflow-hidden ${isActive ? 'bg-soft text-ink' : 'text-muted hover:bg-soft/70 hover:text-ink'}`}>
                <Icon size={20} className="shrink-0" />
                <span className="min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
                  <span className="block text-sm font-medium">{section.label}</span>
                </span>
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Mobile nav (visible only below lg) */}
      <div className="w-full lg:hidden rounded-[2rem] border border-line bg-paper p-3 mb-4">
         <div className="px-3 py-3 overflow-hidden whitespace-nowrap">
             <div className="eyebrow">Навигация</div>
         </div>
         <nav className="mt-1 flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {ADMIN_SECTIONS.map((section) => {
              const Icon = section.icon
              const isActive = section.id === activeSection
              return (
                <button key={section.id} type="button" onClick={() => openSection(section.id)} className={`flex items-center gap-2 rounded-2xl p-3 whitespace-nowrap transition ${isActive ? 'bg-soft text-ink' : 'text-muted hover:bg-soft/70 hover:text-ink'}`}>
                  <Icon size={18} className="shrink-0" />
                  <span className="text-sm font-medium">{section.label}</span>
                </button>
              )
            })}
         </nav>
      </div>

      <main className="min-w-0 flex-1 space-y-5 lg:min-h-[calc(100vh-8rem)]">
        <div className="rounded-3xl border border-line bg-paper p-4 md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="eyebrow">{active.label}</div>
              <h2 className="mt-2 font-display text-3xl text-ink">{active.hint}</h2>
            </div>
            <label className="relative block w-full xl:max-w-md">
              <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)} className="w-full rounded-2xl border border-line bg-soft px-11 py-3 text-sm outline-none transition focus:border-ink" placeholder="Глобално търсене в текущата секция" />
            </label>
          </div>
        </div>

        <Suspense fallback={<AdminSectionFallback />}>
          <ActiveComponent session={session} account={account} globalQuery={globalQuery} onOpenSection={openSection} />
        </Suspense>
      </main>
    </div>
  )
}

function AdminSectionFallback() {
  return <div className="rounded-3xl border border-line bg-paper p-6 text-sm text-muted">Зареждаме секцията…</div>
}

function LoginPanel() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const isSignup = params.get('signup') === 'true'
  const requestedSignupRole = params.get('role') === 'pro' ? 'pro' : 'customer'
  const nextPath = normalizeNextPath(params.get('next') || '')
  const [isLogin, setIsLogin] = useState(!isSignup)

  useEffect(() => {
    setIsLogin(!isSignup)
  }, [isSignup])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [signupRole, setSignupRole] = useState(requestedSignupRole) // 'customer' | 'pro'
  const [proPhone, setProPhone] = useState('')
  const [proAbout, setProAbout] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [pendingAction, setPendingAction] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [rememberFor30Days, setRememberFor30Days] = useState(true)

  const pwdRules = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }
  const pwdValid = Object.values(pwdRules).every(Boolean)

  useEffect(() => {
    if (isSignup) setSignupRole(requestedSignupRole)
  }, [isSignup, requestedSignupRole])

  async function signInWithProvider(provider) {
    if (!isLogin && signupRole === 'pro') {
      setStatus('error')
      setPendingAction('')
      setMessage('За Pro кандидатура използвай регистрация с имейл и парола, за да запазим ролята и данните за специалист.')
      return
    }

    setStatus('sending')
    setPendingAction(provider)
    setMessage('')

    const loginRedirect = new URL('/login', window.location.origin)
    if (nextPath) loginRedirect.searchParams.set('next', nextPath)
    const options = { redirectTo: loginRedirect.toString() }

    if (provider === 'google') {
      options.queryParams = { prompt: 'select_account' }
    }

    const { error } = await supabase.auth.signInWithOAuth({ provider, options })

    if (error) {
      setStatus('error')
      setPendingAction('')
      setMessage(error.message)
      return
    }

    setStatus('sent')
    setMessage('Пренасочваме към Google…')
  }

  async function submit(e) {
    e.preventDefault()

    if (isLogin) {
      if (!email.trim() || !password.trim()) {
        setStatus('error')
        setMessage('Въведи имейл и парола.')
        return
      }
    } else {
      if (!fullName.trim() || !displayName.trim()) {
        setStatus('error')
        setMessage('Моля, попълнете и двете имена.')
        return
      }
      if (!email.trim()) {
        setStatus('error')
        setMessage('Моля, въведете имейл адрес.')
        return
      }
      if (!pwdValid) {
        setStatus('error')
        setMessage('Моля, покрийте всички изисквания за паролата.')
        return
      }
      if (password !== confirmPassword) {
        setStatus('error')
        setMessage('Паролите не съвпадат. Опитайте отново.')
        return
      }
    }

    setStatus('sending')
    setPendingAction('email')
    setMessage('')

    let result
    if (isLogin) {
      result = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    } else {
      // Ролята отива в raw_user_meta_data → trigger handle_new_user я чете
      // и създава ред в public.accounts с правилните role/specialist_status.
      result = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            display_name: displayName.trim(),
            role: signupRole === 'pro' ? 'specialist' : 'user',
            phone: signupRole === 'pro' ? proPhone.trim() : undefined,
            about: signupRole === 'pro' ? proAbout.trim() : undefined,
          }
        }
      })
    }

    if (result.error) {
      setStatus('error')
      setPendingAction('')
      setMessage(result.error.message)
      return
    }

    setStatus('sent')
    setPendingAction('')
    setMessage(
      isLogin
        ? 'Входът е успешен.'
        : signupRole === 'pro'
          ? 'Регистрацията е приета. Ако е нужно потвърждение на имейл, провери пощата си. След вход отивай в „Моят профил“.'
          : 'Регистрацията е успешна!'
    )
  }

  return (
    <div className="grid h-full overflow-hidden lg:grid-cols-2">
      <div className={`flex flex-col px-6 sm:px-12 lg:px-20 xl:px-24 ${isLogin ? 'justify-center overflow-y-auto py-8 lg:py-10' : 'justify-start overflow-y-auto py-5 lg:py-6'}`}>
        <div className="mx-auto w-full max-w-[400px]">
          <h2 className="font-display text-[clamp(2.5rem,2rem+2vw,3.5rem)] leading-none text-ink">
            {isLogin ? 'Добре дошли' : 'Започни сега'}
          </h2>
          <p className="mt-3 text-sm text-muted">
            {isLogin ? 'Влез с имейл и парола или продължи с Google.' : 'Създай профил с имейл и парола или продължи с Google.'}
          </p>

          <form onSubmit={submit} className={`${isLogin ? 'mt-10 space-y-5' : 'mt-7 space-y-4'}`}>
            {!isLogin && (
              <div>
                <div className="text-sm font-medium text-ink mb-2">Аз съм</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSignupRole('customer')}
                    className={`rounded-2xl border px-4 py-3 text-sm transition ${signupRole === 'customer' ? 'border-ink bg-soft text-ink' : 'border-line text-muted hover:border-ink/40'}`}
                  >
                    <div className="font-medium">Клиент</div>
                    <div className="text-xs text-muted mt-0.5">Търся специалисти</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignupRole('pro')}
                    className={`rounded-2xl border px-4 py-3 text-sm transition ${signupRole === 'pro' ? 'border-ink bg-soft text-ink' : 'border-line text-muted hover:border-ink/40'}`}
                  >
                    <div className="font-medium">Специалист</div>
                    <div className="text-xs text-muted mt-0.5">Предлагам услуги</div>
                  </button>
                </div>
              </div>
            )}

            {!isLogin && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-ink">
                  Име и фамилия
                  <input
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    type="text"
                    placeholder="Иван Иванов"
                    className={INPUT_CLASS}
                  />
                </label>
                <label className="block text-sm font-medium text-ink">
                  Потребителско име
                  <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    type="text"
                    placeholder="Totsan Studio"
                    className={INPUT_CLASS}
                  />
                </label>
              </div>
            )}
            
            <label className="block text-sm font-medium text-ink">
              Имейл адрес
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="name@email.com"
                className={INPUT_CLASS}
              />
            </label>

            <label className="block text-sm font-medium text-ink">
              <div className="flex justify-between">
                <span>Парола</span>
                {isLogin && <button type="button" className="text-accent hover:underline">Забравена парола?</button>}
              </div>
              <div className="relative mt-2">
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  className={`${INPUT_CLASS} mt-0 pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? 'Скрий паролата' : 'Покажи паролата'}
                  aria-pressed={showPassword}
                  className="group absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-all duration-300 hover:scale-110 hover:bg-soft hover:text-accent active:scale-95 active:rotate-6"
                >
                  <span className="relative inline-flex h-5 w-5 items-center justify-center">
                    <Eye className={`absolute h-5 w-5 transition-all duration-300 ${showPassword ? 'scale-75 rotate-[-16deg] opacity-0' : 'scale-100 rotate-0 opacity-100'}`} />
                    <EyeOff className={`absolute h-5 w-5 transition-all duration-300 ${showPassword ? 'scale-100 rotate-0 opacity-100' : 'scale-75 rotate-[16deg] opacity-0'}`} />
                  </span>
                </button>
              </div>
            </label>

            {!isLogin && password && (
              <div className="text-xs space-y-1.5 mt-2">
                <div className="text-muted mb-2">Изисквания за паролата:</div>
                <RuleItem isValid={pwdRules.length} text="Минимум 8 знака" />
                <RuleItem isValid={pwdRules.uppercase} text="Поне една главна буква" />
                <RuleItem isValid={pwdRules.lowercase} text="Поне една малка буква" />
                <RuleItem isValid={pwdRules.number} text="Поне едно число" />
                <RuleItem isValid={pwdRules.special} text="Специален символ (напр. !@#$%^&*)" />
              </div>
            )}

            {!isLogin && (
              <label className="block text-sm font-medium text-ink mt-4">
                Потвърди паролата
                <div className="relative mt-2">
                  <input
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className={`${INPUT_CLASS} mt-0 pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(value => !value)}
                    aria-label={showConfirmPassword ? 'Скрий потвърждението за паролата' : 'Покажи потвърждението за паролата'}
                    aria-pressed={showConfirmPassword}
                    className="group absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-all duration-300 hover:scale-110 hover:bg-soft hover:text-accent active:scale-95 active:rotate-6"
                  >
                    <span className="relative inline-flex h-5 w-5 items-center justify-center">
                      <Eye className={`absolute h-5 w-5 transition-all duration-300 ${showConfirmPassword ? 'scale-75 rotate-[-16deg] opacity-0' : 'scale-100 rotate-0 opacity-100'}`} />
                      <EyeOff className={`absolute h-5 w-5 transition-all duration-300 ${showConfirmPassword ? 'scale-100 rotate-0 opacity-100' : 'scale-75 rotate-[16deg] opacity-0'}`} />
                    </span>
                  </button>
                </div>
              </label>
            )}

            {!isLogin && signupRole === 'pro' && (
              <div className="grid gap-3">
                <label className="block text-sm font-medium text-ink">
                  Телефон (опционално)
                  <input
                    value={proPhone}
                    onChange={e => setProPhone(e.target.value)}
                    type="tel"
                    placeholder="+359..."
                    className={INPUT_CLASS}
                  />
                </label>
                <label className="block text-sm font-medium text-ink">
                  Накратко за теб / фирмата
                  <textarea
                    value={proAbout}
                    onChange={e => setProAbout(e.target.value)}
                    rows={3}
                    placeholder="Какво правиш, в кой град, опит…"
                    className={INPUT_CLASS}
                  />
                </label>
              </div>
            )}

            {isLogin ? (
              <div className="rounded-2xl border border-line bg-soft px-3 py-2.5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={rememberFor30Days}
                  onClick={() => setRememberFor30Days((value) => !value)}
                  className="flex w-full items-center justify-between gap-4 text-left"
                >
                  <span className="text-sm text-ink">Запомни ме за 30 дни</span>
                  <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${rememberFor30Days ? 'bg-accent' : 'bg-line'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-paper shadow transition ${rememberFor30Days ? 'translate-x-5' : 'translate-x-1'}`} />
                  </span>
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" required className="rounded border-line text-accent focus:ring-accent" />
                Съгласявам се с общите условия и политиката за поверителност
              </label>
            )}

            <button disabled={status === 'sending'} className="btn btn-primary w-full justify-center !py-3.5 text-base mt-2 disabled:opacity-50">
              {status === 'sending' ? 'Обработка…' : isLogin ? 'Вход' : 'Регистрация'}
            </button>
          </form>

          {message && (
            <div className={`mt-4 rounded-2xl px-4 py-3 text-sm ${status === 'error' ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-line bg-soft text-muted'}`}>
              {message}
            </div>
          )}

          <div className={`${isLogin ? 'my-8' : 'my-6'} flex items-center gap-4 text-[11px] uppercase tracking-[0.2em] text-muted/60`}>
            <span className="h-px flex-1 bg-line"></span>
            <span>или</span>
            <span className="h-px flex-1 bg-line"></span>
          </div>

          <div className="grid gap-3">
            <OAuthButton
              label={isLogin ? 'Продължи с Google' : 'Регистрация с Google'}
              disabled={status === 'sending' && pendingAction !== ''}
              onClick={() => signInWithProvider('google')}
              icon={<GoogleIcon />}
            />
          </div>

          <div className={`${isLogin ? 'mt-10' : 'mt-7'} text-center text-sm text-muted`}>
            {isLogin ? 'Нямаш акаунт? ' : 'Вече имаш акаунт? '}
            <button
              onClick={() => {
                setIsLogin(!isLogin)
                setMessage('')
                setStatus('idle')
              }}
              className="font-medium text-accent hover:underline"
            >
              {isLogin ? 'Създай нов' : 'Влез тук'}
            </button>
          </div>
        </div>
      </div>

      <div className="relative my-4 mr-4 hidden self-center overflow-hidden rounded-[2rem] lg:block h-[calc(100%-2rem)]">
        <img src={HOME_PROJECTS[1]} alt="" className="absolute inset-0 h-full w-full object-cover" />
      </div>
    </div>
  )
}

function NoAccessPanel({ session, account }) {
  const isPendingSpecialist = account?.role === 'specialist' && account?.specialist_status === 'pending'
  return (
    <div className="max-w-3xl rounded-[2rem] border border-line bg-paper p-8 shadow-[0_30px_70px_-50px_rgba(0,0,0,0.18)]">
      <div className="eyebrow">Акаунтът ти е активен</div>
      <h2 className="mt-3 font-display text-[clamp(2.2rem,1.6rem+1vw,3.4rem)] leading-[0.98]">
        {isPendingSpecialist ? 'Заявката ти се преглежда.' : 'Нямаш достъп до админ панела.'}
      </h2>
      <p className="mt-4 max-w-2xl text-muted">
        Влязъл си с {session?.user?.email}. {isPendingSpecialist ? 'Когато администратор одобри заявката, ще получиш достъп до „Моят профил“.' : 'Ако смяташ, че трябва да си админ, свържи се с екипа.'}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/moy-profil" className="btn btn-primary">Към моя профил</Link>
        <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Изход</button>
      </div>
    </div>
  )
}

function Dashboard() {
  const [inquiries, setInquiries] = useState([])
  const [applications, setApplications] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  const stats = useMemo(() => ({
    all: inquiries.length,
    fresh: inquiries.filter(i => i.status === 'new').length,
    replied: inquiries.filter(i => i.status === 'replied').length,
    partners: applications.length,
  }), [inquiries, applications])

  useEffect(() => { load() }, [])

  async function load() {
    setStatus('loading')
    setError('')

    const [inq, apps] = await Promise.all([
      supabase.from('inquiries').select('*').order('created_at', { ascending: false }),
      supabase.from('partner_applications').select('*').order('created_at', { ascending: false }),
    ])

    if (inq.error || apps.error) {
      setError(inq.error?.message || apps.error?.message || 'Грешка при зареждане')
      setStatus('error')
      return
    }

    setInquiries(inq.data || [])
    setApplications(apps.data || [])
    setStatus('ready')
  }

  async function updateInquiry(id, nextStatus) {
    const { error: updateError } = await supabase.from('inquiries').update({ status: nextStatus }).eq('id', id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setInquiries(rows => rows.map(row => row.id === id ? { ...row, status: nextStatus } : row))
  }

  async function approveApplication(app) {
    if (!app.user_id) {
      setError('Заявката няма свързан акаунт. Не може да се одобри автоматично.')
      return
    }
    // 1) Създаваме скрит профил, свързан с user_id на заявителя.
    const baseSlug = (app.name || app.email || 'profil')
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9а-я]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
    const slug = `${baseSlug || 'profil'}-${app.id.slice(0, 6)}`

    const { error: profileError } = await supabase.from('profiles').insert({
      slug,
      layer_slug: app.layer_slug || 'postroyka',
      name: app.name || 'Нов специалист',
      tag: 'Специалист',
      city: '—',
      since: new Date().getFullYear(),
      bio: app.about || '',
      user_id: app.user_id,
      role: 'pro',
      is_published: false,
    })

    if (profileError) {
      setError('Профилът не се създаде: ' + profileError.message)
      return
    }

    const { error: appError } = await supabase.from('partner_applications')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', app.id)

    if (appError) {
      setError(appError.message)
      return
    }

    setApplications(rows => rows.map(row => row.id === app.id ? { ...row, status: 'approved' } : row))
  }

  async function rejectApplication(app) {
    const { error: appError } = await supabase.from('partner_applications')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', app.id)
    if (appError) {
      setError(appError.message)
      return
    }
    setApplications(rows => rows.map(row => row.id === app.id ? { ...row, status: 'rejected' } : row))
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Stat label="Всички запитвания" value={stats.all} />
        <Stat label="Нови" value={stats.fresh} />
        <Stat label="Отговорени" value={stats.replied} />
        <Stat label="Партньорски заявки" value={stats.partners} />
      </div>

      {status === 'loading' && <Panel title="Зареждаме запитванията…" />}
      {status === 'error' && (
        <Panel title="Данните не се заредиха">
          <p className="text-red-700 text-sm">{error}</p>
          <p className="text-muted text-sm mt-3">Най-често причината е, че новите admin SQL policies още не са пуснати в Supabase.</p>
          <button className="btn btn-ghost mt-5" onClick={load}>Опитай пак</button>
        </Panel>
      )}
      {status === 'ready' && (
        <>
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8 space-y-4">
              <div className="eyebrow">Запитвания</div>
              {inquiries.length === 0 ? (
                <Panel title="Още няма запитвания"><p className="text-muted">Формите са готови. Първият запис ще се появи тук.</p></Panel>
              ) : inquiries.map(row => (
                <article key={row.id} className="border border-line rounded-2xl bg-paper p-5">
                  <div className="flex flex-wrap gap-3 items-start justify-between">
                    <div>
                      <div className="font-display text-xl">{row.name}</div>
                      <a href={contactHref(row.contact)} className="text-sm text-muted hover:text-accent">{row.contact}</a>
                    </div>
                    <select value={row.status} onChange={e => updateInquiry(row.id, e.target.value)} className="px-3 py-2 rounded-full border border-line bg-paper text-sm">
                      {['new', 'seen', 'replied', 'closed'].map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>
                  <p className="mt-4 text-sm text-ink/80 whitespace-pre-wrap">{row.message}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
                    <span>{formatDate(row.created_at)}</span>
                    <span>·</span>
                    <span>{row.source || 'contact_form'}</span>
                    {row.layer_slug && <span>· слой: {row.layer_slug}</span>}
                    {row.target_slug && <span>· към: {row.target_slug}</span>}
                  </div>
                </article>
              ))}
            </div>

            <aside className="lg:col-span-4 space-y-4">
              <div className="eyebrow">Партньори</div>
              {applications.length === 0 ? (
                <Panel title="Няма партньорски заявки"><p className="text-muted text-sm">Когато добавим публичната форма за партньори, заявките ще се показват тук.</p></Panel>
              ) : applications.map(app => (
                <article key={app.id} className="border border-line rounded-2xl bg-paper p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display text-xl">{app.name}</div>
                      <div className="text-sm text-muted">{app.company || 'Без фирма'} · {app.email}</div>
                      {app.phone && <div className="text-sm text-muted">{app.phone}</div>}
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                      app.status === 'approved' ? 'bg-green-100 text-green-800'
                      : app.status === 'rejected' ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-900'
                    }`}>
                      {app.status === 'approved' ? 'Одобрен' : app.status === 'rejected' ? 'Отхвърлен' : 'Чака'}
                    </span>
                  </div>
                  {app.about && <p className="text-sm mt-3 whitespace-pre-wrap">{app.about}</p>}
                  <div className="mt-3 text-xs text-muted">
                    {formatDate(app.created_at)}
                    {!app.user_id && <span className="ml-2 text-amber-700">· без свързан акаунт</span>}
                  </div>
                  {app.status === 'pending' && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => approveApplication(app)} className="btn btn-primary text-sm !py-2">Одобри</button>
                      <button onClick={() => rejectApplication(app)} className="btn btn-ghost text-sm !py-2">Отхвърли</button>
                    </div>
                  )}
                </article>
              ))}
            </aside>
          </div>

          <ProfileManager />
        </>
      )}
    </>
  )
}

function Panel({ title, children }) {
  return (
    <div className="border border-line rounded-2xl bg-paper p-6 max-w-2xl">
      {title && <h2 className="font-display text-2xl">{title}</h2>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="border border-line rounded-2xl bg-paper p-5">
      <div className="font-display text-3xl">{value}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  )
}

function formatDate(value) {
  return new Intl.DateTimeFormat('bg-BG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function contactHref(contact) {
  return contact.includes('@') ? `mailto:${contact}` : `tel:${contact.replace(/\s/g, '')}`
}

function getSessionEmails(session) {
  const emails = new Set()
  const user = session?.user

  if (user?.email) emails.add(user.email.toLowerCase())
  if (user?.user_metadata?.email) emails.add(String(user.user_metadata.email).toLowerCase())
  if (Array.isArray(user?.identities)) {
    user.identities.forEach((identity) => {
      const email = identity?.identity_data?.email
      if (email) emails.add(String(email).toLowerCase())
    })
  }

  return Array.from(emails)
}

function hasAdminAccess(session) {
  return getSessionEmails(session).some((email) => ADMIN_EMAIL_SET.has(email))
}

function getSessionLabel(session) {
  const user = session?.user
  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name
  if (fullName) return fullName

  const email = getSessionEmails(session)[0]
  if (!email) return 'екип'
  return email.split('@')[0]
}

function OAuthButton({ label, icon, disabled, onClick }) {
  const isBusy = disabled
  return (
    <button
      type="button"
      disabled={isBusy}
      onClick={onClick}
      className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-sm font-medium text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="inline-flex h-5 w-5 items-center justify-center">{icon}</span>
      {label}
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.26-.96 2.33-2.04 3.05l3.3 2.56c1.92-1.77 3.02-4.37 3.02-7.45 0-.72-.06-1.41-.18-2.08H12Z" />
      <path fill="#4285F4" d="M12 22c2.73 0 5.02-.9 6.69-2.44l-3.3-2.56c-.92.62-2.09.99-3.39.99-2.6 0-4.8-1.76-5.59-4.12H3v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 13.87A5.99 5.99 0 0 1 6.1 12c0-.65.11-1.29.31-1.87V7.54H3A10 10 0 0 0 2 12c0 1.61.38 3.14 1 4.46l3.41-2.59Z" />
      <path fill="#34A853" d="M12 5.98c1.49 0 2.82.51 3.87 1.51l2.9-2.9C17 2.98 14.71 2 12 2A10 10 0 0 0 3 7.54l3.41 2.59C7.2 7.74 9.4 5.98 12 5.98Z" />
    </svg>
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
