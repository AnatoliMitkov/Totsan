import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  UserCheck,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { trackEvent } from '../lib/analytics.js'
import { buildBreadcrumbSchema, useSeo } from '../lib/seo.js'

const PRO_SIGNUP_URL = '/pro/start'
const PRO_ASSET_BASE = '/Images/images-for-pro-page'

const assets = {
  hero: `${PRO_ASSET_BASE}/01-totsan-pro-hero-visual.png`,
  without: `${PRO_ASSET_BASE}/02-without-totsan-pro.png`,
  with: `${PRO_ASSET_BASE}/03-with-totsan-pro.png`,
  pilot: `${PRO_ASSET_BASE}/04-pilot.png`,
  growth: `${PRO_ASSET_BASE}/05-pro-growth.png`,
  studio: `${PRO_ASSET_BASE}/06-studio-brand.png`,
  createProfile: `${PRO_ASSET_BASE}/07-create-profile.png`,
  publishServices: `${PRO_ASSET_BASE}/08-publish-services.png`,
  getOffers: `${PRO_ASSET_BASE}/09-get-offers.png`,
  workers: `${PRO_ASSET_BASE}/10-workers.png`,
  designers: `${PRO_ASSET_BASE}/11-designers.png`,
  brands: `${PRO_ASSET_BASE}/12-store-and-brands.png`,
  profile: `${PRO_ASSET_BASE}/13-profile.png`,
}

const comparisonPanels = [
  {
    label: 'Без Totsan Pro',
    tone: 'red',
    image: assets.without,
    intro: 'Работата идва от разпръснати разговори, неясни въпроси и изгубена история.',
    points: [
      'Запитванията са в чатове, телефон и социални мрежи.',
      'Трудно се следят оферти, условия и уговорки.',
      'Доверието зависи от случайни препоръки.',
      'Пропускаш клиенти, които не знаят как да те намерят.',
    ],
  },
  {
    label: 'С Totsan Pro',
    tone: 'green',
    image: assets.with,
    intro: 'Профилът, услугите, запитванията и офертите живеят на едно място.',
    points: [
      'Получаваш заявки по дейност, район и реален клиентски контекст.',
      'Виждаш снимки, бюджет, локация и важните детайли преди разговор.',
      'Изпращаш оферта, която изглежда подредено и професионално.',
      'Профилът изгражда доверие преди клиентът да пише.',
    ],
  },
]

const plans = [
  {
    name: 'Pilot',
    price: '0 лв./месец',
    note: 'за стартови професионалисти',
    image: assets.pilot,
    features: ['Публичен профил', 'До 5 услуги', 'Чат с клиенти', 'Verified отметка'],
    highlighted: false,
    cta: 'Кандидатствай безплатно',
    to: PRO_SIGNUP_URL,
    imageWidth: '18rem',
    imageRight: '-1rem',
    imageBottom: '3rem',
    imageOpacity: 0.7,
  },
  {
    name: 'Pro Growth',
    price: 'след пилота',
    note: 'за активни професионалисти',
    image: assets.growth,
    features: ['Приоритет в каталога', 'Неограничени услуги', 'Оферти и поръчки', 'Месечни отчети'],
    highlighted: true,
    cta: 'Научи повече',
    to: PRO_SIGNUP_URL,
    imageWidth: '18rem',
    imageRight: '-1rem',
    imageBottom: '3rem',
    imageOpacity: 0.7,
  },
  {
    name: 'Studio / Brand',
    price: 'по договоряне',
    note: 'за студиа, брандове и магазини',
    image: assets.studio,
    features: ['Брандов профил', 'Продуктов каталог', 'Партньорски кампании', 'Отделен мениджър'],
    highlighted: false,
    cta: 'Говори с нас',
    to: '/kontakt',
    imageWidth: '18rem',
    imageRight: '-1rem',
    imageBottom: '3rem',
    imageOpacity: 0.7,
  },
]

const steps = [
  {
    n: '01',
    title: 'Създай профил',
    text: 'Попълваш специалност, град, снимки и портфолио. Одобряваме само реални професионалисти.',
    image: assets.createProfile,
    icon: UserCheck,
  },
  {
    n: '02',
    title: 'Публикувай услуги',
    text: 'Описваш услугите си с цени, обхват и условия, за да те намират точните клиенти.',
    image: assets.publishServices,
    icon: ClipboardList,
  },
  {
    n: '03',
    title: 'Получавай заявки',
    text: 'Отговаряш на запитвания, изпращаш оферти и печелиш доверие от едно работно място.',
    image: assets.getOffers,
    icon: MessageCircle,
  },
]

const audiences = [
  {
    label: 'Майстори и бригади',
    text: 'Видими строителни, ремонтни и довършителни услуги. Без безсмислени разговори.',
    image: assets.workers,
    icon: Wrench,
  },
  {
    label: 'Архитекти и дизайнери',
    text: 'Показваш портфолио и се свързваш с клиенти, готови за реализация.',
    image: assets.designers,
    icon: Building2,
  },
  {
    label: 'Магазини и марки',
    text: 'Представяш продукти, материали и решения пред точната аудитория.',
    image: assets.brands,
    icon: Users,
  },
]

const workspaceFeatures = [
  { icon: UserCheck, title: 'Профил, който продава доверие', text: 'Показва опит, сертификати, услуги и реални проекти.' },
  { icon: ClipboardList, title: 'Услуги с цени и оферти', text: 'Създаваш ясни предложения, които клиентът разбира бързо.' },
  { icon: MessageCircle, title: 'Чат, заявки и поръчки', text: 'Разговорът и следващата стъпка остават в едно място.' },
  { icon: ShieldCheck, title: 'Проверка и рейтинг', text: 'Одобрен профил и обратна връзка, която носи доверие.' },
]

export default function TotsanPro() {
  useSeo({
    canonicalPath: '/pro',
    jsonLd: [
      buildBreadcrumbSchema([
        { name: 'Начало', path: '/' },
        { name: 'Totsan Pro', path: '/pro' },
      ]),
    ],
  })

  const trackPartnerApplicationStart = (source) => {
    trackEvent('partner_application_start', { source })
  }

  return (
    <>
      <section
        className="relative isolate overflow-hidden bg-[#020b18] text-paper"
        style={{
          '--pro-hero-mobile-x': '62%',
          '--pro-hero-mobile-y': '50%',
          '--pro-hero-desktop-x': '58%',
          '--pro-hero-desktop-y': '50%',
        }}
      >
        <div className="absolute inset-0 md:hidden">
          <img
            src={assets.hero}
            alt=""
            className="h-full w-full object-cover opacity-95"
            style={{ objectPosition: 'var(--pro-hero-mobile-x) var(--pro-hero-mobile-y)' }}
            fetchpriority="high"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,11,24,0.9)_0%,rgba(2,11,24,0.56)_42%,rgba(2,11,24,0.88)_100%)]" />
        </div>
        <div className="absolute inset-0 hidden md:block">
          <img
            src={assets.hero}
            alt=""
            className="h-full w-full object-cover opacity-95"
            style={{ objectPosition: 'var(--pro-hero-desktop-x) var(--pro-hero-desktop-y)' }}
            fetchpriority="high"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_34%,rgba(44,111,232,0.12),transparent_34%),linear-gradient(90deg,#020b18_0%,rgba(2,11,24,0.95)_18%,rgba(2,11,24,0.62)_42%,rgba(2,11,24,0.12)_76%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#020b18]/40 via-transparent to-[#020b18]" />
        </div>

        <div className="section relative z-10 flex min-h-[calc(100svh+1px)] items-center pt-[calc(var(--header-h,64px)+3rem)] md:min-h-[760px] md:pt-[calc(var(--header-h,64px)+2rem)]">
          <div className="container-page grid items-center gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
            <div className="max-w-[40rem]">
              <div className="eyebrow !text-paper/55">Totsan Pro</div>
              <h1 className="mt-28 max-w-full font-display text-[2.35rem] font-medium leading-none text-paper sm:text-[3.6rem] lg:text-[5.35rem]">
                Работно място за добрите майстори, студиа и марки.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-paper/78 sm:text-lg">
                Профил, услуги, заявки и чат — всичко на едно място. Безплатен вход за мотивирани професионалисти.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  to={PRO_SIGNUP_URL}
                  onClick={() => trackPartnerApplicationStart('totsan_pro_hero')}
                  className="btn btn-primary btn-shine justify-center !bg-accent !text-sm !text-paper hover:!bg-accentDeep sm:!text-base"
                >
                  Кандидатствай безплатно <ArrowRight size={18} />
                </Link>
                <a
                  href="#pro-plans"
                  className="btn btn-ghost btn-fill justify-center !border-paper/25 !bg-paper/10 !text-paper hover:!border-paper/50"
                >
                  Виж повече
                </a>
              </div>
              <div className="mt-8 flex flex-wrap justify-start gap-3 text-sm text-paper/82">
                <TrustPill icon={CheckCircle2} label="Безплатен вход" />
                <TrustPill icon={UserCheck} label="Проверени клиенти" />
                <TrustPill icon={ShieldCheck} label="Сигурни плащания" />
              </div>
            </div>
            <div className="hidden lg:block" aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className="section bg-paper">
        <div className="container-page">
          <SectionIntro
            eyebrow="Заслужава ли си?"
            title="С Totsan Pro и без него."
            text="Ясно се вижда разликата между разпиляната работа днес и подреденото работно място утре."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {comparisonPanels.map((panel) => (
              <ComparisonCard key={panel.label} panel={panel} />
            ))}
          </div>
        </div>
      </section>

      <section id="pro-plans" className="section bg-soft">
        <div className="container-page">
          <SectionIntro
            eyebrow="Избери своя план"
            title="Планове, създадени за вашия растеж."
            text="Започваш леко, доказваш профила си и надграждаш когато Totsan започне да носи реална работа."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.name}
                plan={plan}
                onTrack={() => {
                  if (plan.to === PRO_SIGNUP_URL) {
                    trackPartnerApplicationStart(`totsan_pro_plan_${plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`)
                  }
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-paper">
        <div className="container-page">
          <SectionIntro
            eyebrow="Започни лесно"
            title="Три стъпки до първата поръчка."
            text="Профилът ти не стои сам. Той води към услуги, заявки, оферти и реална работа."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {steps.map((step) => (
              <StepCard key={step.n} step={step} />
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-soft">
        <div className="container-page">
          <SectionIntro
            eyebrow="За кого"
            title="Правилните хора на правилното място."
            text="Totsan Pro е за професионалисти и брандове, които искат работата им да изглежда толкова добре, колкото я изпълняват."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {audiences.map((audience) => (
              <AudienceCard key={audience.label} audience={audience} />
            ))}
          </div>
        </div>
      </section>

      <section
        className="section relative isolate overflow-hidden bg-paper"
        style={{
          '--pro-profile-overlay-rgb': '13, 35, 64',
          '--pro-profile-overlay-left': '0.74',
          '--pro-profile-overlay-mid': '0.42',
          '--pro-profile-overlay-right': '0.16',
          backgroundImage: `linear-gradient(90deg, rgba(var(--pro-profile-overlay-rgb), var(--pro-profile-overlay-left)) 0%, rgba(var(--pro-profile-overlay-rgb), var(--pro-profile-overlay-mid)) 44%, rgba(var(--pro-profile-overlay-rgb), var(--pro-profile-overlay-right)) 100%), url(${assets.profile})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      >
        <div className="container-page relative z-10 grid min-h-[34rem] items-center gap-8 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)]">
          <div className="reveal flex h-full flex-col justify-center">
            <div className="max-w-[38rem] rounded-[2rem] border border-paper/18 bg-ink/38 p-6 shadow-[0_28px_90px_-64px_rgba(13,35,64,0.85)] backdrop-blur-sm sm:p-8">
              <div className="eyebrow !text-white">Повече от профил</div>
              <h2 className="h-section mt-3 max-w-[34rem] text-white">Система за работа, не само страница в каталог.</h2>
              <p className="mt-4 max-w-xl text-white">
                Totsan Pro събира доверието, заявките, офертите и клиентската комуникация в един спокоен работен ритъм.
              </p>
            </div>
          </div>

          <div className="reveal overflow-hidden rounded-[2rem] border border-line/70 bg-paper/42 p-5 shadow-[0_28px_90px_-64px_rgba(13,35,64,0.7)] backdrop-blur-sm sm:p-7">
            <div className="grid gap-4 sm:grid-cols-2">
              {workspaceFeatures.map((feature) => (
                <WorkspaceFeature key={feature.title} feature={feature} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section bg-soft">
        <div className="container-page">
          <div className="relative isolate overflow-hidden rounded-[2rem] bg-[#06152b] p-7 text-paper shadow-[0_28px_90px_-60px_rgba(13,35,64,0.9)] md:p-12">
            <img
              src={assets.pilot}
              alt=""
              loading="lazy"
              className="absolute bottom-[-16rem] right-[-8rem] z-0 hidden w-[34rem] opacity-50 mix-blend-screen md:block"
              style={{
                WebkitMaskImage: 'radial-gradient(circle at 50% 42%, black 0%, black 48%, transparent 74%)',
                maskImage: 'radial-gradient(circle at 50% 42%, black 0%, black 48%, transparent 74%)',
              }}
            />
            <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_78%_42%,rgba(44,111,232,0.32),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_42%)]" />
            <div className="relative z-10 max-w-3xl reveal">
              <div className="eyebrow !text-paper/55">Следваща стъпка</div>
              <h2 className="mt-3 font-display text-[clamp(2.25rem,1.55rem+2.7vw,4.6rem)] leading-none">
                Готов ли си да станеш Pro партньор?
              </h2>
              <p className="mt-4 max-w-2xl text-paper/72">
                Създай доверен профил, покажи услугите си и започни да получаваш по-качествени заявки от клиенти, които вече знаят какво търсят.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to={PRO_SIGNUP_URL} onClick={() => trackPartnerApplicationStart('totsan_pro_cta')} className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep justify-center">
                  Кандидатствай безплатно <ArrowRight size={18} />
                </Link>
                <Link to="/kontakt" className="btn btn-ghost justify-center !border-paper/25 !bg-paper/10 !text-paper hover:!border-paper/50">
                  Говори с екипа
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function SectionIntro({ eyebrow, title, text }) {
  return (
    <div className="reveal mx-auto max-w-3xl text-center">
      <div className="eyebrow">{eyebrow}</div>
      <h2 className="h-section mt-3 text-ink">{title}</h2>
      {text && <p className="mx-auto mt-3 max-w-2xl text-muted">{text}</p>}
    </div>
  )
}

function TrustPill({ icon: Icon, label }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-paper/12 bg-paper/8 px-3.5 py-2">
      <Icon size={16} className="text-accent" />
      {label}
    </span>
  )
}

function ComparisonCard({ panel }) {
  const isPositive = panel.tone === 'green'
  const Icon = isPositive ? Check : X
  return (
    <article className={`reveal overflow-hidden rounded-[2rem] border bg-paper shadow-[0_24px_80px_-64px_rgba(13,35,64,0.75)] ${isPositive ? 'border-green-200' : 'border-red-100'}`}>
      <div className="grid min-h-full gap-0 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className={`relative min-h-[21rem] overflow-hidden ${isPositive ? 'bg-green-50' : 'bg-red-50'}`}>
          <img
            src={panel.image}
            alt=""
            loading="lazy"
            className={`absolute inset-0 h-full w-full ${isPositive ? 'object-cover' : 'object-contain p-4'}`}
            style={{
              objectPosition: isPositive ? '34% center' : 'center center',
              WebkitMaskImage: 'linear-gradient(90deg, black 76%, transparent 100%)',
              maskImage: 'linear-gradient(90deg, black 76%, transparent 100%)',
            }}
          />
        </div>
        <div className="p-6 md:p-7">
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${isPositive ? 'bg-green-100 text-trustGreen' : 'bg-red-100 text-red-600'}`}>
            <Icon size={14} />
            {panel.label}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">{panel.intro}</p>
          <ul className="mt-5 space-y-3 text-sm text-ink">
            {panel.points.map((point) => (
              <li key={point} className="flex gap-3">
                <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isPositive ? 'bg-green-100 text-trustGreen' : 'bg-red-100 text-red-500'}`}>
                  <Icon size={13} />
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  )
}

function PlanCard({ plan, onTrack }) {
  return (
    <article className={`reveal relative flex min-h-[27rem] flex-col overflow-hidden rounded-[2rem] border p-6 shadow-[0_24px_80px_-66px_rgba(13,35,64,0.8)] ${plan.highlighted ? 'border-accent bg-paper ring-2 ring-accent/20' : 'border-line bg-paper'}`}>
      <img
        src={plan.image}
        alt=""
        loading="lazy"
        className="absolute z-0"
        style={{
          width: plan.imageWidth,
          right: plan.imageRight,
          bottom: plan.imageBottom,
          opacity: plan.imageOpacity,
          WebkitMaskImage: 'radial-gradient(circle at 52% 44%, black 0%, black 48%, transparent 76%)',
          maskImage: 'radial-gradient(circle at 52% 44%, black 0%, black 48%, transparent 76%)',
        }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-3xl text-ink">{plan.name}</h3>
            <p className="mt-1 text-xs text-muted">{plan.note}</p>
          </div>
          <span className={`rounded-2xl p-2 ${plan.highlighted ? 'bg-accent text-paper' : 'bg-accentSoft text-accentDeep'}`}>
            {plan.highlighted ? <Star size={18} /> : <CheckCircle2 size={18} />}
          </span>
        </div>
        <div className="mt-6 font-display text-4xl text-ink">{plan.price}</div>
        <ul className="mt-6 space-y-2.5 text-sm text-ink/82">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-center gap-2.5">
              <CheckCircle2 size={16} className="shrink-0 text-trustGreen" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
      <div className="relative z-10 mt-auto pt-7">
        <Link to={plan.to} onClick={onTrack} className={`btn w-full justify-center ${plan.highlighted ? 'btn-primary' : 'btn-ghost bg-paper/75'}`}>
          {plan.cta} <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  )
}

function StepCard({ step }) {
  const Icon = step.icon
  return (
    <article className="reveal overflow-hidden rounded-[2rem] border border-line bg-paper shadow-[0_22px_70px_-62px_rgba(13,35,64,0.72)]">
      <div className="relative h-48 overflow-hidden bg-soft">
        <img
          src={step.image}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          style={{
            objectPosition: step.n === '01' ? 'center 38%' : 'center center',
            WebkitMaskImage: 'linear-gradient(180deg, black 66%, transparent 100%)',
            maskImage: 'linear-gradient(180deg, black 66%, transparent 100%)',
          }}
        />
      </div>
      <div className="p-6">
        <div className="flex items-center justify-between gap-4">
          <span className="font-display text-4xl text-line">{step.n}</span>
          <span className="rounded-2xl bg-accentSoft p-3 text-accentDeep"><Icon size={20} /></span>
        </div>
        <h3 className="mt-5 font-display text-2xl text-ink">{step.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
      </div>
    </article>
  )
}

function AudienceCard({ audience }) {
  const Icon = audience.icon
  return (
    <article className="reveal overflow-hidden rounded-[2rem] border border-line bg-paper shadow-[0_22px_70px_-62px_rgba(13,35,64,0.72)]">
      <div className="relative h-48 overflow-hidden bg-soft">
        <img
          src={audience.image}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          style={{
            objectPosition: 'center 48%',
            WebkitMaskImage: 'linear-gradient(180deg, black 70%, transparent 100%)',
            maskImage: 'linear-gradient(180deg, black 70%, transparent 100%)',
          }}
        />
      </div>
      <div className="p-6">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accentSoft text-accentDeep">
          <Icon size={21} />
        </span>
        <h3 className="mt-5 font-display text-2xl text-ink">{audience.label}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{audience.text}</p>
        <Link to={PRO_SIGNUP_URL} className="btn btn-ghost mt-5 !py-2 text-sm">
          Към профила <ArrowRight size={15} />
        </Link>
      </div>
    </article>
  )
}

function WorkspaceFeature({ feature }) {
  const Icon = feature.icon
  return (
    <article className="flex gap-4 rounded-3xl border border-line bg-soft p-4">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-paper text-accentDeep shadow-sm">
        <Icon size={19} />
      </span>
      <div>
        <h3 className="font-semibold text-ink">{feature.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{feature.text}</p>
      </div>
    </article>
  )
}
