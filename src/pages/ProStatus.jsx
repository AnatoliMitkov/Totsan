import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, Check, Clock3, FileText, MailCheck, ShieldCheck, Sparkles, UserRound, XCircle } from 'lucide-react'
import { useAccount } from '../lib/account.js'
import { supabase } from '../lib/supabase.js'
import { normalizeProfile, runProfileSelectWithLayer01Fallback } from '../lib/profiles.js'

const TIMELINE = [
  'Акаунт създаден',
  'Имейл потвърден',
  'Кандидатура изпратена',
  'Преглед от Totsan',
  'Партньорски профил',
  'Публикуване в каталога',
]

export default function ProStatus() {
  const { session, account, loading } = useAccount()
  const [state, setState] = useState({ status: 'idle', application: null, profile: null, message: '' })

  useEffect(() => {
    if (loading || !session?.user?.id) return
    let active = true

    async function loadStatus() {
      setState(current => ({ ...current, status: 'loading', message: '' }))

      const [appRes, profileRes] = await Promise.all([
        supabase
          .from('partner_applications')
          .select('id, status, created_at, reviewed_at, decision_note')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        runProfileSelectWithLayer01Fallback((columns) => (
          supabase.from('profiles').select(columns).eq('user_id', session.user.id).maybeSingle()
        )),
      ])

      if (!active) return

      if (appRes.error && appRes.error.code !== 'PGRST116') {
        setState({ status: 'error', application: null, profile: null, message: appRes.error.message })
        return
      }

      if (profileRes.error && profileRes.error.code !== 'PGRST116') {
        setState({ status: 'error', application: null, profile: null, message: profileRes.error.message })
        return
      }

      setState({
        status: 'ready',
        application: appRes.data || null,
        profile: profileRes.data ? normalizeProfile(profileRes.data) : null,
        message: '',
      })
    }

    loadStatus()
    return () => { active = false }
  }, [loading, session?.user?.id])

  if (loading) {
    return <StatusShell><StatusCard icon={Clock3} title="Зареждаме статуса..." text="Проверяваме последната кандидатура и профила ви." /></StatusShell>
  }

  if (!session) {
    return <StatusShell><StatusCard icon={UserRound} title="Влезте в партньорския акаунт" text="Статусът е достъпен след вход в Totsan Pro акаунта." primaryTo="/pro/start" primaryLabel="Към Totsan Pro" /></StatusShell>
  }

  if (state.status === 'idle' || state.status === 'loading') {
    return <StatusShell><StatusCard icon={Clock3} title="Зареждаме статуса..." text="Проверяваме последната кандидатура и профила ви." /></StatusShell>
  }

  if (account?.role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  if (account?.role !== 'specialist') {
    return <StatusShell><StatusCard icon={UserRound} title="Това не е партньорски акаунт" text="Партньорският статус е достъпен за акаунти, създадени през Totsan Pro." primaryTo="/pro/start" primaryLabel="Към Totsan Pro" /></StatusShell>
  }

  if (state.status === 'error') {
    return <StatusShell><StatusCard icon={XCircle} title="Не успяхме да заредим статуса" text={state.message || 'Опитайте отново след малко.'} primaryTo="/moy-profil" primaryLabel="Към моя профил" tone="danger" /></StatusShell>
  }

  return (
    <StatusShell>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ApplicationState application={state.application} profile={state.profile} />
        <TimelineCard application={state.application} profile={state.profile} />
      </div>
    </StatusShell>
  )
}

function ApplicationState({ application, profile }) {
  const status = String(application?.status || '').toLowerCase()
  const isApproved = status === 'approved' || Boolean(profile?.id)
  const isPublished = Boolean(profile?.id && profile.isPublished)

  const content = useMemo(() => {
    if (!application) {
      return {
        icon: FileText,
        badge: 'Няма кандидатура',
        title: 'Завършете кандидатурата си',
        text: 'Попълнете кратката партньорска кандидатура, за да можем да я прегледаме.',
        tone: 'neutral',
        primaryTo: '/pro/onboarding',
        primaryLabel: 'Към кандидатурата',
      }
    }

    if (status === 'rejected') {
      return {
        icon: XCircle,
        badge: 'Отхвърлена',
        title: 'Кандидатурата не е одобрена',
        text: application.decision_note
          ? `Бележка от Totsan: ${application.decision_note}`
          : 'В момента не можем да одобрим кандидатурата. Свържете се с нас, ако искате да уточним следващи стъпки.',
        tone: 'danger',
        primaryTo: '/kontakt',
        primaryLabel: 'Свържете се с нас',
        secondaryTo: '/pro/onboarding',
        secondaryLabel: 'Прегледай кандидатурата',
      }
    }

    if (isPublished) {
      return {
        icon: Sparkles,
        badge: 'Видим в каталога',
        title: 'Профилът ви е публикуван',
        text: 'Партньорският ви профил е видим в каталога и клиентите могат да го разглеждат.',
        tone: 'success',
        primaryTo: `/profil/${profile.slug}`,
        primaryLabel: 'Виж публичния профил',
        secondaryTo: '/moy-profil',
        secondaryLabel: 'Редактирай профила',
      }
    }

    if (isApproved) {
      return {
        icon: ShieldCheck,
        badge: 'Одобрена',
        title: 'Одобрени сте като партньор',
        text: 'Остава да подготвите публичния си профил, преди да бъде видим в каталога.',
        tone: 'success',
        primaryTo: '/moy-profil',
        primaryLabel: 'Към моя профил',
      }
    }

    return {
      icon: Clock3,
      badge: 'В преглед',
      title: 'Кандидатурата ви се преглежда',
      text: 'Ще ви уведомим, когато има решение или ако липсва информация.',
      tone: 'pending',
      primaryTo: '/moy-profil',
      primaryLabel: 'Към моя профил',
    }
  }, [application, isApproved, isPublished, profile, status])

  const Icon = content.icon
  return (
    <section className="rounded-[2rem] border border-white/70 bg-paper/75 p-6 shadow-[0_30px_90px_-60px_rgba(13,35,64,0.55)] backdrop-blur md:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="eyebrow">Totsan Pro</div>
          <h1 className="h-section mt-2">{content.title}</h1>
        </div>
        <StatusBadge tone={content.tone}>{content.badge}</StatusBadge>
      </div>

      <div className="mt-7 flex gap-4 rounded-3xl border border-line bg-soft p-5">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${iconClass(content.tone)}`}>
          <Icon size={24} />
        </div>
        <div>
          <p className="text-muted">{content.text}</p>
          {application?.created_at && (
            <p className="mt-3 text-xs font-medium text-muted">
              Изпратена на {new Date(application.created_at).toLocaleDateString('bg-BG')}
              {application.reviewed_at ? ` · решение на ${new Date(application.reviewed_at).toLocaleDateString('bg-BG')}` : ''}
            </p>
          )}
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        {content.primaryTo && <Link to={content.primaryTo} className="btn btn-primary justify-center">{content.primaryLabel}<ArrowRight size={18} /></Link>}
        {content.secondaryTo && <Link to={content.secondaryTo} className="btn btn-ghost justify-center">{content.secondaryLabel}</Link>}
      </div>
    </section>
  )
}

function TimelineCard({ application, profile }) {
  const status = String(application?.status || '').toLowerCase()
  const isApproved = status === 'approved' || Boolean(profile?.id)
  const isPublished = Boolean(profile?.id && profile.isPublished)
  const completeThrough = !application ? 1 : isPublished ? 5 : isApproved ? 4 : status === 'rejected' ? 3 : 3
  const currentIndex = !application ? 2 : isPublished ? 5 : isApproved ? 4 : status === 'rejected' ? 3 : 3

  return (
    <aside className="rounded-[2rem] border border-white/70 bg-paper/70 p-5 shadow-[0_24px_80px_-60px_rgba(13,35,64,0.55)] backdrop-blur lg:self-start">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <MailCheck size={18} className="text-accentDeep" />
        Следващи стъпки
      </div>
      <div className="mt-5 space-y-3">
        {TIMELINE.map((label, index) => {
          const done = index <= completeThrough && !(status === 'rejected' && index > 2)
          const active = index === currentIndex
          return (
            <div key={label} className={`flex gap-3 rounded-2xl border p-3 text-sm transition ${active ? 'border-accentDeep bg-accentSoft text-accentDeep' : done ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-line bg-soft text-muted'}`}>
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${done ? 'bg-emerald-600 text-white' : active ? 'bg-accentDeep text-paper' : 'bg-paper text-muted'}`}>
                {done ? <Check size={13} /> : index + 1}
              </span>
              <span>{label}</span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

function StatusShell({ children }) {
  return (
    <section className="section !py-8 md:!py-10 relative min-h-[calc(100vh-var(--header-h,0px))] overflow-hidden bg-soft">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-6rem] h-[24rem] w-[24rem] rounded-full bg-accentSoft/80 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-7rem] h-[24rem] w-[24rem] rounded-full bg-cloud/90 blur-3xl" />
      </div>
      <div className="container-page relative">{children}</div>
    </section>
  )
}

function StatusCard({ icon: Icon, title, text, primaryTo = '', primaryLabel = '', tone = 'neutral' }) {
  return (
    <div className="mx-auto max-w-xl rounded-[2rem] border border-white/70 bg-paper/70 p-7 text-center shadow-[0_30px_90px_-60px_rgba(13,35,64,0.55)] backdrop-blur md:p-10">
      <div className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${iconClass(tone)}`}>
        <Icon size={28} />
      </div>
      <h1 className="h-section mt-5">{title}</h1>
      {text && <p className="mt-4 text-muted">{text}</p>}
      {primaryTo && <Link to={primaryTo} className="btn btn-primary mt-7">{primaryLabel}<ArrowRight size={18} /></Link>}
    </div>
  )
}

function StatusBadge({ tone, children }) {
  const classes = {
    success: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    danger: 'border-red-100 bg-red-50 text-red-700',
    pending: 'border-amber-100 bg-amber-50 text-amber-700',
    neutral: 'border-line bg-soft text-muted',
  }
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${classes[tone] || classes.neutral}`}>{children}</span>
}

function iconClass(tone) {
  if (tone === 'success') return 'bg-emerald-50 text-emerald-700'
  if (tone === 'danger') return 'bg-red-50 text-red-700'
  if (tone === 'pending') return 'bg-amber-50 text-amber-700'
  return 'bg-accentSoft text-accentDeep'
}
