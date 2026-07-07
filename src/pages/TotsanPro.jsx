import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  Check,
  CheckCircle2,
  CirclePause,
  ClipboardList,
  CreditCard,
  Info,
  MessageCircle,
  ShieldCheck,
  Star,
  UserCheck,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { trackEvent } from '../lib/analytics.js'
import { useAccount } from '../lib/account.js'
import { VAT_STATUS_NOTE } from '../lib/legalInfo.js'
import { formatEurWithBgn } from '../lib/money.js'
import { buildBreadcrumbSchema, useSeo } from '../lib/seo.js'
import {
  PARTNER_BILLING_INTERVALS,
  PARTNER_SUBSCRIPTION_PLANS,
  buildPartnerFlowPath,
  clearPendingPartnerSubscriptionIntent,
  getPartnerSubscriptionIntentFromSearch,
  getPartnerPlanPrice,
  loadOwnPartnerSubscription,
  reconcilePartnerSubscription,
  savePendingPartnerSubscriptionIntent,
  startPartnerSubscriptionCheckout,
} from '../lib/subscriptions.js'

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

const subscriptionComparisonPanels = [
  {
    label: 'Без активен Totsan Pro',
    tone: 'red',
    image: assets.without,
    intro: 'Работата идва от разпръснати разговори, неясни въпроси и изгубена история.',
    points: [
      'Запитванията са в чатове, телефон и социални мрежи.',
      'Трудно се следят оферти, условия и уговорки.',
      'Доверието зависи от случайни препоръки.',
      'Профилът няма активна видимост в каталога на Totsan.',
    ],
  },
  {
    label: 'С активен Totsan Pro',
    tone: 'green',
    image: assets.with,
    intro: 'Профилът, услугите, запитванията и офертите живеят на едно работно място.',
    points: [
      'Показваш професионален профил, услуги и реални проекти.',
      'Получаваш по-структуриран клиентски контекст, когато има запитване.',
      'Виждаш снимки, бюджет, локация и важни детайли преди разговор.',
      'Изпращаш оферта, която изглежда подредено и професионално.',
    ],
  },
]

const foundingCampaign = {
  label: 'Кампания до 31 юли 2026',
  title: 'Първи партньори на Totsan',
  text: 'Одобрените партньори получават 6 месеца активен профил безплатно. Периодът започва след одобрение и публикуване на профила.',
  footnote: 'Без карта за първите 6 месеца. Един промо период на човек или фирма. Няма гаранция за брой клиенти.',
}

const subscriptionValue = [
  'Професионален профил в Totsan',
  'Видимост пред клиенти без такса на запитване',
  'Запитвания с описание, снимки, бюджет, срокове и локация',
  'По-малко хаотични разговори',
  'Портфолио, ревюта и потвърдени проекти',
  'Структурирани оферти, поръчки и история на комуникацията',
]

const pausedProfileLimits = [
  'Профилът не е активен в каталога',
  'Няма нови клиентски запитвания',
  'Няма активен CTA за клиенти',
  'Профилът остава запазен и може да бъде активиран отново',
]

const planVisuals = {
  active_partner: {
    image: assets.growth,
    imageWidth: '18rem',
    imageRight: '-1rem',
    imageBottom: '3rem',
    imageOpacity: 0.68,
  },
  company_team: {
    image: assets.studio,
    imageWidth: '18rem',
    imageRight: '-1rem',
    imageBottom: '3rem',
    imageOpacity: 0.66,
  },
}

const subscriptionConsentItems = [
  {
    id: 'terms',
    label: 'Приемам Общите условия и Политиката за поверителност.',
  },
  {
    id: 'renewal',
    label: 'Разбирам, че абонаментът се подновява автоматично според избрания период, освен ако бъде спрян преди следващото подновяване.',
  },
  {
    id: 'noGuarantee',
    label: 'Разбирам, че Totsan не гарантира фиксиран брой клиенти или запитвания.',
  },
  {
    id: 'pausedProfile',
    label: 'Разбирам, че без активен план профилът ми може да остане запазен, но да не бъде активен за нови клиентски запитвания.',
  },
]

const pricingFaqItems = [
  {
    question: 'Има ли комисионна?',
    answer: 'Абонаментът не добавя такса на запитване. При поръчки, платени през Totsan, от сумата се приспадат Stripe таксите и 2% платформена комисионна преди превода към партньора.',
  },
  {
    question: 'Гарантирате ли клиенти?',
    answer: 'Не обещаваме фиксиран брой клиенти. Абонаментът дава активен профил, видимост и инструменти за по-ясни запитвания.',
  },
  {
    question: 'Какво става, ако не продължа след безплатния период?',
    answer: 'Профилът остава запазен, но става неактивен за нови клиентски запитвания. Можете да го активирате отново по всяко време.',
  },
  {
    question: 'Мога ли да спра абонамента?',
    answer: 'Да. Абонаментът може да бъде спрян преди следващо подновяване.',
  },
  {
    question: 'Какво означава одобрен партньор?',
    answer: 'Профил с реална информация, услуги, зона на работа и съдържание, което отговаря на стандартите на Totsan.',
  },
]

const subscriptionSteps = [
  {
    n: '01',
    title: 'Създай профил',
    text: 'Попълваш специалност, район, снимки и портфолио. Одобряваме само реални професионалисти.',
    image: assets.createProfile,
    icon: UserCheck,
  },
  {
    n: '02',
    title: 'Публикувай услуги',
    text: 'Описваш услугите си с обхват, условия и ориентировъчни цени, за да е ясно как работиш.',
    image: assets.publishServices,
    icon: ClipboardList,
  },
  {
    n: '03',
    title: 'Работи със структурирани запитвания',
    text: 'Когато клиент изпрати запитване, виждаш контекст, снимки и детайли преди разговора и офертата.',
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
  const navigate = useNavigate()
  const location = useLocation()
  const { session, account, loading: accountLoading } = useAccount()
  const checkoutIntentHandled = useRef(false)
  const [billingInterval, setBillingInterval] = useState('monthly')
  const [consents, setConsents] = useState({
    terms: false,
    renewal: false,
    noGuarantee: false,
    pausedProfile: false,
  })
  const [checkoutState, setCheckoutState] = useState({ status: 'idle', planKey: '', message: '' })
  const [selectedSubscription, setSelectedSubscription] = useState(null)
  const [currentSubscription, setCurrentSubscription] = useState({ status: 'loading', subscription: null })
  const requestedCheckoutIntent = useMemo(
    () => getPartnerSubscriptionIntentFromSearch(location.search),
    [location.search],
  )

  useEffect(() => {
    if (accountLoading) return undefined
    if (!session) {
      setCurrentSubscription({ status: 'ready', subscription: null })
      return undefined
    }

    let active = true

    async function loadSubscription() {
      try {
        let subscription = await loadOwnPartnerSubscription()
        if (!subscription.active && subscription.row) {
          try {
            const reconciliation = await reconcilePartnerSubscription()
            if (reconciliation?.subscription?.row) subscription = reconciliation.subscription
          } catch (error) {
            console.error('Could not reconcile the current subscription', error)
          }
        }
        if (active) setCurrentSubscription({ status: 'ready', subscription })
      } catch (error) {
        console.error('Could not load the current subscription', error)
        if (active) setCurrentSubscription({ status: 'error', subscription: null })
      }
    }

    loadSubscription()
    return () => { active = false }
  }, [accountLoading, session])

  useSeo({
    canonicalPath: '/pro',
    title: 'Totsan Pro — партньорски планове и защитени плащания',
    description: 'Активен професионален профил, видимост, структурирани запитвания и инструменти за по-ясна комуникация с клиенти в Totsan.',
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

  const planCards = useMemo(() => (
    PARTNER_SUBSCRIPTION_PLANS.map((plan) => ({
      ...plan,
      ...(planVisuals[plan.id] || {}),
    }))
  ), [])
  const acceptedConsents = subscriptionConsentItems.every((item) => consents[item.id])

  useEffect(() => {
    if (
      checkoutIntentHandled.current
      || !requestedCheckoutIntent
      || accountLoading
      || currentSubscription.status === 'loading'
    ) return

    if (currentSubscription.subscription?.active) {
      clearPendingPartnerSubscriptionIntent()
      checkoutIntentHandled.current = true
      return
    }

    const intent = savePendingPartnerSubscriptionIntent(requestedCheckoutIntent)
    if (!session) {
      checkoutIntentHandled.current = true
      navigate(buildPartnerFlowPath('/pro/start', intent), { replace: true })
      return
    }

    const isApprovedSpecialist = account?.role === 'specialist' && account?.specialist_status === 'approved'
    if (!isApprovedSpecialist) {
      checkoutIntentHandled.current = true
      navigate(buildPartnerFlowPath('/pro/onboarding', intent), { replace: true })
      return
    }

    const plan = planCards.find((item) => item.id === intent.plan.planId)
    const price = getPartnerPlanPrice(plan, intent.billingInterval)
    if (!plan || !price) return

    setBillingInterval(intent.billingInterval)
    setConsents({
      terms: false,
      renewal: false,
      noGuarantee: false,
      pausedProfile: false,
    })
    setCheckoutState({ status: 'idle', planKey: price.key, message: '' })
    setSelectedSubscription({ plan, billingInterval: intent.billingInterval, price })
    checkoutIntentHandled.current = true
  }, [
    account?.role,
    account?.specialist_status,
    accountLoading,
    currentSubscription.status,
    currentSubscription.subscription?.active,
    navigate,
    planCards,
    requestedCheckoutIntent,
    session,
  ])

  function updateConsent(id, checked) {
    setConsents((current) => ({ ...current, [id]: checked }))
  }

  function openSubscriptionConfirmation(plan) {
    if (currentSubscription.subscription?.active) return
    const price = getPartnerPlanPrice(plan, billingInterval)
    if (!price?.key) return
    const intent = savePendingPartnerSubscriptionIntent({
      planKey: price.key,
      billingInterval,
    })

    if (!session) {
      navigate(buildPartnerFlowPath('/pro/start', intent))
      return
    }

    const isApprovedSpecialist = account?.role === 'specialist' && account?.specialist_status === 'approved'
    if (!isApprovedSpecialist) {
      navigate(buildPartnerFlowPath('/pro/onboarding', intent))
      return
    }

    setConsents({
      terms: false,
      renewal: false,
      noGuarantee: false,
      pausedProfile: false,
    })
    setCheckoutState({ status: 'idle', planKey: price.key, message: '' })
    setSelectedSubscription({ plan, billingInterval, price })
    trackEvent('partner_subscription_plan_selected', {
      plan_key: price.key,
      billing_interval: billingInterval,
      source: 'totsan_pro_pricing',
    })
  }

  function closeSubscriptionConfirmation() {
    if (checkoutState.status === 'opening') return
    setSelectedSubscription(null)
    setCheckoutState({ status: 'idle', planKey: '', message: '' })
  }

  async function startSubscriptionCheckout() {
    const plan = selectedSubscription?.plan
    const selectedBillingInterval = selectedSubscription?.billingInterval || billingInterval
    const price = selectedSubscription?.price || getPartnerPlanPrice(plan, selectedBillingInterval)
    if (!price?.key) return

    trackEvent('partner_subscription_checkout_start', {
      plan_key: price.key,
      billing_interval: selectedBillingInterval,
      source: 'totsan_pro_confirmation',
    })

    if (!acceptedConsents) {
      setCheckoutState({
        status: 'error',
        planKey: price.key,
        message: 'Потвърди всички условия, преди да продължиш към плащане.',
      })
      return
    }

    setCheckoutState({ status: 'opening', planKey: price.key, message: '' })
    try {
      const result = await startPartnerSubscriptionCheckout({
        planKey: price.key,
        billingInterval: selectedBillingInterval,
        consents,
      })
      if (result.checkoutUrl) {
        clearPendingPartnerSubscriptionIntent()
        window.location.href = result.checkoutUrl
        return
      }
      setCheckoutState({
        status: 'error',
        planKey: price.key,
        message: 'Платежният процес не върна валиден адрес. Провери конфигурацията и опитай отново.',
      })
    } catch (error) {
      const message = error.message || 'Абонаментът не можа да стартира.'
      if (error.code === 'active_subscription') {
        setCurrentSubscription({
          status: 'ready',
          subscription: error.subscription || currentSubscription.subscription,
        })
        setSelectedSubscription(null)
        setCheckoutState({ status: 'idle', planKey: '', message: '' })
        return
      }
      setCheckoutState({ status: 'error', planKey: price.key, message })
    }
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
          <div className="container-page grid items-center gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:grid-cols-[minmax(0,45.9375rem)_minmax(0,1fr)]">
            <div className="max-w-[45.9375rem]">
              <div className="eyebrow !text-paper/55">Totsan Pro</div>
              <h1 className="mt-2 max-w-full font-display text-[2.35rem] font-medium leading-none text-paper sm:text-[3.6rem] lg:text-[5.35rem]">
                Професионален канал за добрите майстори, студиа и фирми.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-paper/78 sm:text-lg">
                Активен профил, видимост, структурирани запитвания и инструменти за ясна комуникация. Без такса на запитване; при защитено плащане се прилагат Stripe такси и 2% комисионна.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  to={PRO_SIGNUP_URL}
                  onClick={() => trackPartnerApplicationStart('totsan_pro_hero')}
                  className="btn btn-primary btn-shine justify-center !bg-accent !text-sm !text-paper hover:!bg-accentDeep sm:!text-base"
                >
                  Кандидатствай като партньор <ArrowRight size={18} />
                </Link>
                <a
                  href="#pro-plans"
                  className="btn btn-ghost btn-fill justify-center !border-paper/25 !bg-paper/10 !text-paper hover:!border-paper/50"
                >
                  Виж плановете
                </a>
              </div>
              <div className="mt-8 flex flex-wrap justify-start gap-3 text-sm text-paper/82">
                <TrustPill icon={CheckCircle2} label="Без такса на запитване" />
                <TrustPill icon={UserCheck} label="6 месеца промо до 31 юли" />
                <TrustPill icon={ShieldCheck} label="Проверка преди видимост" />
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
            {subscriptionComparisonPanels.map((panel) => (
              <ComparisonCard key={panel.label} panel={panel} />
            ))}
          </div>
        </div>
      </section>

      <section id="pro-plans" className="section bg-soft !pt-10 !pb-10">
        <div className="container-page">
          <SectionIntro
            eyebrow="Цени за партньори"
            title="Партньорски планове за специалисти и фирми."
            text="Без такса на запитване. Плащате за активен професионален профил, видимост и инструменти за по-ясна комуникация; при поръчки през Totsan се прилагат Stripe такси и 2% комисионна."
          />

          <CampaignBanner campaign={foundingCampaign} onTrack={() => trackPartnerApplicationStart('totsan_pro_campaign')} />

          <BillingToggle interval={billingInterval} onChange={setBillingInterval} />

          {currentSubscription.subscription?.active && (
            <div className="mt-6 flex flex-col gap-4 rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Активен абонамент</div>
                <div className="mt-1 text-lg font-semibold">
                  Вече използвате {currentSubscription.subscription.plan?.planName || 'партньорски план'}.
                </div>
                <p className="mt-1 text-sm text-emerald-800">Не е необходимо и не можете да закупите втори план, докато този е активен.</p>
              </div>
              <Link to="/moy-profil" className="btn btn-primary shrink-0 justify-center">Управлявай от профила</Link>
            </div>
          )}

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {planCards.map((plan) => {
              const price = getPartnerPlanPrice(plan, billingInterval)
              const isBusy = checkoutState.status === 'opening' && checkoutState.planKey === price?.key
              return (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  price={price}
                  billingInterval={billingInterval}
                  disabled={accountLoading || checkoutState.status === 'opening' || currentSubscription.status === 'loading' || Boolean(currentSubscription.subscription?.active)}
                  busy={isBusy}
                  activeSubscription={currentSubscription.subscription}
                  onCheckout={() => openSubscriptionConfirmation(plan)}
                />
              )
            })}
          </div>

          <SubscriptionValuePanel />

          <PricingFaq items={pricingFaqItems} />

          <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-muted">
            {VAT_STATUS_NOTE} Данъчният статус следва да бъде потвърден във фактурата.
          </p>
        </div>
      </section>

      <SubscriptionConfirmationModal
        selection={selectedSubscription}
        consents={consents}
        consentItems={subscriptionConsentItems}
        acceptedConsents={acceptedConsents}
        checkoutState={checkoutState}
        onConsentChange={updateConsent}
        onClose={closeSubscriptionConfirmation}
        onContinue={startSubscriptionCheckout}
      />

      <section className="section bg-paper">
        <div className="container-page">
          <SectionIntro
            eyebrow="Започни лесно"
            title="Три стъпки до активен професионален профил."
            text="Профилът не стои сам. Той води към услуги, структурирани запитвания, оферти и подредена комуникация."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {subscriptionSteps.map((step) => (
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
                Създай доверен профил, покажи услугите си и кандидатствай за активна видимост в Totsan. Първите одобрени партньори получават 6 месеца активен профил безплатно.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to={PRO_SIGNUP_URL} onClick={() => trackPartnerApplicationStart('totsan_pro_cta')} className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep justify-center">
                  Кандидатствай като партньор <ArrowRight size={18} />
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

function CampaignBanner({ campaign, onTrack }) {
  return (
    <div className="reveal mt-10 overflow-hidden rounded-[2rem] border border-accent/25 bg-paper shadow-[0_24px_80px_-66px_rgba(13,35,64,0.8)]">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="p-6 md:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accentSoft px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-accentDeep">
            <CalendarCheck size={14} />
            {campaign.label}
          </div>
          <h3 className="mt-4 font-display text-3xl text-ink md:text-4xl">{campaign.title}</h3>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted md:text-base">{campaign.text}</p>
          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted">{campaign.footnote}</p>
        </div>
        <div className="flex items-center border-t border-line bg-soft p-6 lg:w-80 lg:border-l lg:border-t-0">
          <div className="w-full">
            <div className="font-display text-4xl text-ink">6 месеца</div>
            <div className="mt-1 text-sm text-muted">активен профил безплатно за одобрени партньори</div>
            <Link to={PRO_SIGNUP_URL} onClick={onTrack} className="btn btn-primary mt-5 w-full justify-center">
              Кандидатствай <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function BillingToggle({ interval, onChange }) {
  const options = Object.values(PARTNER_BILLING_INTERVALS)
  const helper = interval === 'yearly'
    ? PARTNER_BILLING_INTERVALS.yearly.helper
    : 'Таксуване месечно.'
  return (
    <div className="reveal mx-auto mt-8 max-w-xl rounded-[1.5rem] border border-line bg-paper p-2 shadow-[0_18px_55px_-44px_rgba(13,35,64,0.7)]">
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const selected = interval === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-[1.1rem] px-4 py-3 text-sm font-semibold transition ${selected ? 'bg-ink text-paper shadow-[0_14px_35px_-24px_rgba(13,35,64,0.85)]' : 'text-muted hover:bg-soft hover:text-ink'}`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {helper && (
        <p className="mt-3 px-2 pb-1 text-center text-xs text-muted">
          {helper}
        </p>
      )}
    </div>
  )
}

function SubscriptionConfirmationModal({
  selection,
  consents,
  consentItems,
  acceptedConsents,
  checkoutState,
  onConsentChange,
  onClose,
  onContinue,
}) {
  if (!selection?.plan || !selection?.price) return null

  const { plan, price, billingInterval } = selection
  const isYearly = billingInterval === 'yearly'
  const busy = checkoutState.status === 'opening'
  const error = checkoutState.status === 'error' ? checkoutState.message : ''
  const periodLabel = isYearly ? 'Годишно' : 'Месечно'
  const renewalLabel = isYearly
    ? 'Автоматично всяка година, освен ако абонаментът бъде спрян преди следващото подновяване.'
    : 'Автоматично всеки месец, освен ако абонаментът бъде спрян преди следващото подновяване.'

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/48 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="subscription-confirmation-title">
      <div className="max-h-[min(92vh,52rem)] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-line bg-paper shadow-[0_30px_100px_rgba(13,35,64,0.28)]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-paper/95 px-5 py-4 backdrop-blur md:px-6">
          <div>
            <div className="eyebrow">Totsan Pro</div>
            <h3 id="subscription-confirmation-title" className="mt-1 font-display text-3xl text-ink">Потвърждение на абонамент</h3>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-line bg-soft p-2 text-muted transition hover:border-ink/20 hover:text-ink disabled:opacity-50" aria-label="Затвори потвърждението">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 md:p-6">
          <div className="grid gap-3 md:grid-cols-2">
            <ConfirmationDetail label="План" value={plan.name} />
            <ConfirmationDetail label="Период" value={periodLabel} />
            <ConfirmationDetail label="Пробен период" value="14 дни безплатно, ако е приложимо" />
            <ConfirmationDetail label="След пробния период" value={price.legal} />
            {isYearly && <ConfirmationDetail label="Еквивалент" value={price.equivalent || `${price.displayAmount} / месец`} />}
            <ConfirmationDetail label="Подновяване" value={renewalLabel} wide={!isYearly} />
          </div>

          <div className="mt-4 rounded-2xl border border-accent/20 bg-accentSoft/60 px-4 py-3 text-sm leading-6 text-accentDeep">
            Totsan не гарантира фиксиран брой клиенти или запитвания. Абонаментът активира профил, видимост и инструменти за по-ясна комуникация.
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold text-ink">Потвърди преди плащане</div>
            <div className="mt-3 grid gap-3">
              {consentItems.map((item) => (
                <label key={item.id} className="flex cursor-pointer gap-3 rounded-2xl border border-line bg-soft/70 px-4 py-3 text-sm leading-6 text-ink">
                  <input
                    type="checkbox"
                    checked={Boolean(consents[item.id])}
                    onChange={(event) => onConsentChange(item.id, event.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#244766]"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={onClose} disabled={busy} className="btn btn-ghost justify-center">
              Назад към плановете
            </button>
            <button type="button" onClick={onContinue} disabled={!acceptedConsents || busy} className="btn btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-55">
              {busy ? 'Отваряме плащането...' : 'Продължи към плащане'} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfirmationDetail({ label, value, wide = false }) {
  return (
    <div className={`rounded-2xl border border-line bg-soft/70 px-4 py-3 ${wide ? 'md:col-span-2' : ''}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold leading-6 text-ink">{value}</div>
    </div>
  )
}

function SubscriptionValuePanel() {
  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <article className="reveal rounded-[2rem] border border-line bg-paper p-6 shadow-[0_22px_70px_-62px_rgba(13,35,64,0.72)] md:p-8">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-accentSoft p-3 text-accentDeep">
            <CreditCard size={21} />
          </span>
          <div>
            <div className="eyebrow">Какво отключва абонаментът</div>
            <h3 className="mt-2 font-display text-3xl text-ink">Плащате за активен професионален канал; проектните плащания имат отделни такси.</h3>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {subscriptionValue.map((item) => (
            <div key={item} className="flex gap-3 rounded-2xl border border-line bg-soft/70 px-4 py-3 text-sm text-ink">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-trustGreen" />
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-3 rounded-2xl border border-accent/20 bg-accentSoft/70 px-4 py-3 text-sm text-accentDeep">
          <Info size={17} className="mt-0.5 shrink-0" />
          <span>Totsan не обещава “магически клиенти”. Totsan помага добрите специалисти да изглеждат професионално и да получават по-ясни запитвания.</span>
        </div>
      </article>

      <article className="reveal rounded-[2rem] border border-line bg-paper p-6 shadow-[0_22px_70px_-62px_rgba(13,35,64,0.72)] md:p-8">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-soft p-3 text-muted">
            <CirclePause size={21} />
          </span>
          <div>
            <div className="eyebrow">Без активен план</div>
            <h3 className="mt-2 font-display text-3xl text-ink">Профилът остава запазен, но е на пауза.</h3>
          </div>
        </div>
        <ul className="mt-6 space-y-3 text-sm text-ink">
          {pausedProfileLimits.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-soft text-muted">
                <X size={13} />
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 rounded-2xl border border-line bg-soft/70 px-4 py-3 text-sm text-muted">
          След края на промо периода или trial-а партньорът избира месечен или годишен план. Ако не избере, профилът не се изтрива, а спира да бъде активен за нови запитвания.
        </p>
      </article>
    </div>
  )
}

function PricingFaq({ items }) {
  return (
    <div className="reveal mt-8 rounded-[2rem] border border-line bg-paper p-6 shadow-[0_22px_70px_-62px_rgba(13,35,64,0.72)] md:p-8">
      <div className="mx-auto max-w-3xl text-center">
        <div className="eyebrow">Въпроси за абонамента</div>
        <h3 className="mt-2 font-display text-3xl text-ink">Кратко и без скрити обещания.</h3>
      </div>
      <div className="mt-7 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <article key={item.question} className="rounded-2xl border border-line bg-soft/70 p-4">
            <h4 className="font-semibold text-ink">{item.question}</h4>
            <p className="mt-2 text-sm leading-6 text-muted">{item.answer}</p>
          </article>
        ))}
      </div>
    </div>
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

function PlanCard({ plan, price, billingInterval, disabled, busy, activeSubscription, onCheckout }) {
  const isYearly = billingInterval === 'yearly'
  const displayAmount = price?.displayAmount || price?.amount
  const displayNumericAmount = Number.parseFloat(String(displayAmount || '').replace(',', '.'))
  const displayPrice = Number.isFinite(displayNumericAmount) ? formatEurWithBgn(displayNumericAmount) : displayAmount
  const displayPeriod = price?.displayPeriod || price?.period
  const hasActiveSubscription = Boolean(activeSubscription?.active)
  const isCurrentPlan = hasActiveSubscription && activeSubscription?.plan?.planId === plan.id
  return (
    <article className={`reveal relative flex min-h-[31rem] flex-col overflow-hidden rounded-[2rem] border p-6 shadow-[0_24px_80px_-66px_rgba(13,35,64,0.8)] ${plan.highlighted ? 'border-accent bg-paper ring-2 ring-accent/20' : 'border-line bg-paper'}`}>
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
            <p className="mt-1 text-xs text-muted">{plan.audience}</p>
          </div>
          <span className={`rounded-2xl p-2 ${plan.highlighted ? 'bg-accent text-paper' : 'bg-accentSoft text-accentDeep'}`}>
            {plan.highlighted ? <Star size={18} /> : <CheckCircle2 size={18} />}
          </span>
        </div>
        <div className="mt-0 flex flex-wrap items-end gap-x-2 gap-y-1">
          <span className="font-display text-[clamp(2rem,1.65rem+1vw,3rem)] leading-none text-ink">{displayPrice}</span>
          <span className="pb-1 text-sm text-muted">{displayPeriod}</span>
        </div>
        <div className="mt-3 px-1">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted">
            {isYearly ? (
              <AnnualSavingsInfo price={price} />
            ) : (
              <span>{price?.billingHelper || 'Таксуване месечно.'}</span>
            )}
          </div>
        </div>
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
        <button
          type="button"
          onClick={onCheckout}
          disabled={disabled || busy}
          className={`btn w-full justify-center disabled:cursor-not-allowed disabled:opacity-55 ${plan.highlighted ? 'btn-primary' : 'btn-ghost bg-paper/75'}`}
        >
          {busy
            ? 'Отваря се...'
            : hasActiveSubscription
              ? (isCurrentPlan ? 'Текущ активен план' : 'Вече имате активен план')
              : `Избери ${plan.name}`}
          {!hasActiveSubscription && <ArrowRight size={16} />}
        </button>
      </div>
    </article>
  )
}

function AnnualSavingsInfo({ price }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span>{price?.savingsLabel || price?.badge || 'Спестявате с годишен план'}</span>
      <span className="group relative inline-flex">
        <button
          type="button"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-ink/25 text-[10px] font-bold leading-none text-paper transition hover:bg-ink focus:bg-ink focus:outline-none focus:ring-2 focus:ring-ink/15"
          aria-label="Детайли за годишното таксуване"
        >
          ?
        </button>
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 translate-y-1 rounded-lg bg-ink px-3 py-2 text-left text-xs font-medium leading-5 text-paper opacity-0 shadow-[0_16px_40px_rgba(13,35,64,0.22)] transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
        >
          {price?.savingsTooltip || price?.billingHelper}
        </span>
      </span>
    </span>
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
