import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  UserCheck,
  Users,
  Wrench,
  Building2,
  X,
  Check,
} from 'lucide-react'
import { trackEvent } from '../lib/analytics.js'
import { buildBreadcrumbSchema, useSeo } from '../lib/seo.js'

const comparison = [
  {
    topic: 'Видимост пред клиенти',
    without: 'Намират те по случайност — Facebook, препоръки, Viber групи.',
    with: 'Профил в каталога, видим за хора, търсещи точно твоята специалност.',
  },
  {
    topic: 'Качество на заявките',
    without: 'Обаждания без бюджет, без срок, без ясна идея.',
    with: 'Заявки с описание, местоположение, бюджет и прикачени снимки.',
  },
  {
    topic: 'Комуникация',
    without: 'Разпръснато по WhatsApp, Viber, телефон и имейл.',
    with: 'Чат, оферта и поръчка на едно място. Историята не се губи.',
  },
  {
    topic: 'Доверие и репутация',
    without: 'Трудно доказуемо. Разчиташ само на устни препоръки.',
    with: 'Verified отзиви, рейтинг и одобрен профил — видимо за всеки клиент.',
  },
  {
    topic: 'Цена за влизане',
    without: '—',
    with: 'Безплатно за одобрените пилотни партньори.',
  },
]

const PRO_SIGNUP_URL = '/pro/start'

const steps = [
  {
    n: '01',
    title: 'Създай профил',
    text: 'Попълваш специалност, град и портфолио. Ние одобряваме.',
    icon: UserCheck,
  },
  {
    n: '02',
    title: 'Публикувай услуги',
    text: 'Добавяш пакетирани оферти с ясна цена и обхват.',
    icon: ClipboardList,
  },
  {
    n: '03',
    title: 'Получавай заявки',
    text: 'Клиенти те намират, пишат и поръчват — всичко на едно място.',
    icon: MessageCircle,
  },
]

const audiences = [
  {
    label: 'Майстори и бригади',
    text: 'Ясни заявки с бюджет, город и срок. Без безсмислени разговори.',
    icon: Wrench,
  },
  {
    label: 'Архитекти и дизайнери',
    text: 'Профил, портфолио и pipeline от клиенти, готови да работят.',
    icon: Building2,
  },
  {
    label: 'Магазини и марки',
    text: 'Продукти и услуги, вързани към реални проекти.',
    icon: Users,
  },
]

const plans = [
  {
    name: 'Pilot',
    price: '0 лв.',
    note: 'за одобрени партньори',
    features: ['Публичен профил', 'До 3 услуги', 'Чат и заявки', 'Verified отзиви'],
    highlighted: false,
    cta: 'Кандидатствай',
  },
  {
    name: 'Pro Growth',
    price: 'след пилота',
    note: 'за активни партньори',
    features: ['Приоритет в каталога', 'Неограничени услуги', 'Оферти и поръчки', 'Месечен отчет'],
    highlighted: true,
    cta: 'Научи повече',
  },
  {
    name: 'Studio / Brand',
    price: 'по договорка',
    note: 'за студиа, фирми и марки',
    features: ['Екипен профил', 'Продуктови линии', 'Партньорски кампании', 'Отделна отчетност'],
    highlighted: false,
    cta: 'Говори с нас',
  },
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
      {/* ── Hero ── */}
      <section className="section relative overflow-hidden bg-ink text-paper">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-6rem] top-[-6rem] h-[22rem] w-[22rem] rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute bottom-[-8rem] right-[-5rem] h-[24rem] w-[24rem] rounded-full bg-trustGreen/15 blur-3xl" />
        </div>

        <div className="container-page relative grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="reveal">
            <div className="eyebrow !text-paper/55">Totsan Pro</div>
            <h1 className="h-display mt-4">
              Работно място за добрите майстори, студиа и марки.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-paper/70">
              Профил, услуги, заявки и чат — всичко на едно място. Безплатен вход за пилотния кръг.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={PRO_SIGNUP_URL} onClick={() => trackPartnerApplicationStart('totsan_pro_hero')} className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep">
                Кандидатствай безплатно <ArrowRight size={18} />
              </Link>
              <a href="#pro-plans" className="btn btn-ghost !border-paper/25 !bg-paper/10 !text-paper hover:!border-paper/50">
                Виж плановете
              </a>
            </div>
          </div>

          {/* Cockpit preview */}
          <div className="reveal rounded-[2rem] border border-paper/15 bg-paper/8 p-5 backdrop-blur shadow-[0_30px_80px_-45px_rgba(0,0,0,0.65)]">
            <div className="rounded-[1.5rem] bg-paper p-5 text-ink">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="eyebrow">Cockpit</div>
                  <p className="mt-1 font-display text-2xl">Какво вижда партньорът</p>
                </div>
                <span className="rounded-2xl bg-accentSoft p-3 text-accentDeep"><Sparkles size={20} /></span>
              </div>
              <div className="mt-5 grid gap-2.5">
                {[
                  { label: 'Нов клиент от quiz', color: 'bg-trustGreen' },
                  { label: 'Оферта за баня до 6 000 лв.', color: 'bg-accent' },
                  { label: 'Непрочетен чат', color: 'bg-accent' },
                  { label: 'Отзив чака потвърждение', color: 'bg-accent/60' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-2xl border border-line bg-soft px-4 py-2.5">
                    <span className="text-sm font-medium text-ink">{item.label}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl bg-ink p-4 text-paper">
                <div className="text-[11px] uppercase tracking-[0.16em] text-paper/50">Фокус за днес</div>
                <div className="mt-1.5 font-display text-xl leading-snug">Отговори на 2 заявки преди конкурента.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Comparison: с Pro vs. без Pro ── */}
      <section className="section bg-paper">
        <div className="container-page">
          <div className="reveal text-center">
            <div className="eyebrow">Заслужава ли си?</div>
            <h2 className="h-section mt-3">С Totsan Pro и без него.</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">
              Ясна разлика между това как изглежда работата сега и как може да изглежда.
            </p>
          </div>

          {/* Column headers */}
          <div className="mt-10 reveal">
            <div className="grid grid-cols-[1fr_1fr_1fr] gap-0 overflow-hidden rounded-3xl border border-line text-sm font-semibold">
              <div className="border-r border-line bg-soft px-5 py-3.5 text-muted">Аспект</div>
              <div className="flex items-center gap-2 border-r border-line bg-red-50 px-5 py-3.5 text-red-500">
                <X size={15} strokeWidth={2.5} />
                Без Pro
              </div>
              <div className="flex items-center gap-2 bg-green-50 px-5 py-3.5 text-trustGreen">
                <Check size={15} strokeWidth={2.5} />
                С Totsan Pro
              </div>
            </div>

            <div className="divide-y divide-line overflow-hidden rounded-b-3xl border-x border-b border-line">
              {comparison.map((row, i) => (
                <div
                  key={row.topic}
                  className={`grid grid-cols-[1fr_1fr_1fr] gap-0 transition-colors ${i % 2 === 0 ? 'bg-paper' : 'bg-soft/40'}`}
                >
                  <div className="border-r border-line px-5 py-4 text-sm font-medium text-ink">
                    {row.topic}
                  </div>
                  <div className="border-r border-line px-5 py-4 text-sm leading-relaxed text-muted">
                    {row.without === '—' ? (
                      <span className="text-line">—</span>
                    ) : (
                      <span className="flex gap-2">
                        <X size={15} className="mt-0.5 shrink-0 text-red-400" />
                        {row.without}
                      </span>
                    )}
                  </div>
                  <div className="px-5 py-4 text-sm leading-relaxed text-ink">
                    <span className="flex gap-2">
                      <Check size={15} className="mt-0.5 shrink-0 text-trustGreen" />
                      {row.with}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="reveal mt-8 flex justify-center">
            <Link to={PRO_SIGNUP_URL} onClick={() => trackPartnerApplicationStart('totsan_pro_comparison')} className="btn btn-primary">
              Кандидатствай безплатно <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Plans ── (moved up right after comparison) */}
      <section id="pro-plans" className="section bg-ink text-paper">
        <div className="container-page">
          <div className="text-center reveal">
            <div className="eyebrow !text-paper/55">Планове</div>
            <h2 className="h-section mt-3">Влизаш безплатно, плащаш когато Totsan носи работа.</h2>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`reveal flex flex-col rounded-[2rem] border p-7 transition-all duration-300
                  ${plan.highlighted
                    ? 'border-accent bg-paper text-ink shadow-[0_30px_90px_-55px_rgba(44,111,232,0.8)] hover:scale-[1.03] hover:shadow-[0_0_55px_-10px_rgba(44,111,232,0.55)]'
                    : 'border-paper/15 bg-paper/10 hover:scale-[1.02] hover:border-paper/35 hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.12)]'
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-2xl">{plan.name}</h3>
                    <p className={`mt-1 text-xs ${plan.highlighted ? 'text-muted' : 'text-paper/55'}`}>{plan.note}</p>
                  </div>
                  {plan.highlighted ? <Star className="text-accent shrink-0" size={20} /> : <CheckCircle2 className="text-trustGreen shrink-0" size={20} />}
                </div>

                <div className="mt-5 font-display text-4xl">{plan.price}</div>

                <ul className="mt-6 grow space-y-2.5 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5">
                      <CheckCircle2 size={16} className={`shrink-0 ${plan.highlighted ? 'text-accentDeep' : 'text-trustGreen'}`} />
                      <span className={plan.highlighted ? 'text-ink/80' : 'text-paper/75'}>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={plan.name === 'Studio / Brand' ? '/kontakt' : PRO_SIGNUP_URL}
                  onClick={() => {
                    if (plan.name !== 'Studio / Brand') trackPartnerApplicationStart(`totsan_pro_plan_${plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`)
                  }}
                  className={`mt-7 btn justify-center ${plan.highlighted ? 'btn-primary' : 'btn-ghost !border-paper/25 !bg-paper/10 !text-paper hover:!border-paper/45'}`}
                >
                  {plan.cta} <ArrowRight size={16} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="section bg-soft">
        <div className="container-page">
          <div className="text-center reveal">
            <div className="eyebrow">Как работи</div>
            <h2 className="h-section mt-3">Три стъпки до първата поръчка.</h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon
              return (
                <article key={step.n} className="reveal relative rounded-3xl border border-line bg-paper p-7">
                  <div className="flex items-start justify-between">
                    <span className="font-display text-4xl text-line">{step.n}</span>
                    <span className="rounded-2xl bg-accentSoft p-3 text-accentDeep"><Icon size={20} /></span>
                  </div>
                  <h3 className="mt-5 font-display text-2xl text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── For whom ── */}
      <section className="section bg-paper">
        <div className="container-page">
          <div className="text-center reveal">
            <div className="eyebrow">За кого</div>
            <h2 className="h-section mt-3">Правилните хора на правилното място.</h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {audiences.map((audience) => {
              const Icon = audience.icon
              return (
                <article key={audience.label} className="reveal rounded-3xl border border-line bg-soft p-7">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-paper text-accentDeep shadow-sm">
                    <Icon size={22} />
                  </span>
                  <h3 className="mt-5 font-display text-2xl text-ink">{audience.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{audience.text}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── What's included ── */}
      <section className="section bg-soft">
        <div className="container-page">
          <div className="text-center reveal">
            <div className="eyebrow">Какво включва</div>
            <h2 className="h-section mt-3">Не само профил — система за работа.</h2>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {[
              { icon: UserCheck, title: 'Профил, който продава доверие', text: 'Карта с портфолио, отзиви и видими услуги. Не визитка, а доказателство.' },
              { icon: ClipboardList, title: 'Услуги с цена и обхват', text: 'Пакетирани оферти — клиентът разбира точно какво купува.' },
              { icon: MessageCircle, title: 'Чат, заявки и поръчки', text: 'Разговорът и плащането остават в Totsan, не се губят по телефони.' },
              { icon: ShieldCheck, title: 'Проверка и рейтинг', text: 'Одобрение, verified отзиви и история. Добрите изпъкват.' },
            ].map((item) => {
              const Icon = item.icon
              return (
                <article key={item.title} className="reveal flex gap-5 rounded-3xl border border-line bg-paper p-6">
                  <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accentSoft text-accentDeep">
                    <Icon size={20} />
                  </span>
                  <div>
                    <h3 className="font-display text-xl text-ink">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.text}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>


      {/* ── CTA ── */}
      <section className="section bg-soft">
        <div className="container-page rounded-[2rem] border border-line bg-paper p-8 text-center md:p-14">
          <div className="reveal mx-auto max-w-2xl">
            <div className="eyebrow">Следваща стъпка</div>
            <h2 className="h-section mt-3">Готов ли си да станеш Pro партньор?</h2>
            <p className="mt-4 text-muted">
              Майстори, дизайнери, архитекти, фирми и марки с реално качество — кандидатствайте за пилотния кръг.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to={PRO_SIGNUP_URL} onClick={() => trackPartnerApplicationStart('totsan_pro_cta')} className="btn btn-primary">
                Кандидатствай безплатно <ArrowRight size={18} />
              </Link>
              <Link to="/kontakt" className="btn btn-ghost">
                Говори с екипа
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
