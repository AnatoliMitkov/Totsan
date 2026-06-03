import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  UserCheck,
  Users,
} from 'lucide-react'

const PRO_SIGNUP_URL = '/login?signup=true&role=pro'

const proMetrics = [
  { value: '30', label: 'партньора в първия пилот' },
  { value: '5', label: 'типа професионалисти и марки' },
  { value: '0 лв.', label: 'вход за пилотните партньори' },
]

const productBlocks = [
  {
    title: 'Профил, който продава доверие',
    text: 'Публична карта с име, град, специалност, портфолио, отзиви и видими услуги. Не просто визитка, а доказателство, че можеш да поемеш реален проект.',
    icon: UserCheck,
  },
  {
    title: 'Услуги с цена и обхват',
    text: 'Пакетирани оферти като “ремонт на баня”, “3D концепция”, “монтаж на дограма” или “доставка на материали”, така че клиентът да разбира какво купува.',
    icon: ClipboardList,
  },
  {
    title: 'Чат, заявки и поръчки на едно място',
    text: 'Клиентите идват от quiz, каталог, услуги и профили. Разговорът, офертата и плащането остават в Totsan, вместо да се губят по телефони и бележки.',
    icon: MessageCircle,
  },
  {
    title: 'Проверка, рейтинг и защита на репутацията',
    text: 'Admin одобрение, verified отзиви, сигнали и история на действията. Добрите партньори трябва да изпъкват, а хаосът да се вижда рано.',
    icon: ShieldCheck,
  },
]

const audiences = [
  {
    label: 'Майстори и бригади',
    text: 'По-малко празни разговори, повече ясни заявки с бюджет, град, срок и снимки.',
  },
  {
    label: 'Архитекти и дизайнери',
    text: 'Профил, портфолио, услуги и pipeline от хора, които още не знаят откъде да започнат.',
  },
  {
    label: 'Магазини и марки',
    text: 'Материали, продукти и услуги, вързани към реални проекти, не просто банер реклама.',
  },
]

const launchPlan = [
  {
    step: '01',
    title: 'Събираме първите правилни партньори',
    text: 'Не гоним маса. Избираме хора и марки, които могат да покажат работа, цена, срок и отношение.',
  },
  {
    step: '02',
    title: 'Правим профилите продаваеми',
    text: 'Снимки, услуги, градове, гаранции, ориентировъчни цени и ясни CTA към чат или заявка.',
  },
  {
    step: '03',
    title: 'Пускаме клиентския поток през quiz',
    text: 'Клиентът отговаря на няколко въпроса, а Totsan го насочва към подходящи услуги и партньори.',
  },
  {
    step: '04',
    title: 'Мерим кой носи стойност',
    text: 'Следим заявки, отговори, поръчки, оценки и повторни клиенти. После плащането става логично, не насилено.',
  },
]

const packages = [
  {
    name: 'Pilot',
    price: '0 лв.',
    note: 'за първите одобрени партньори',
    features: ['Публичен профил', 'До 3 услуги', 'Чат със заявки', 'Verified отзиви'],
    highlighted: false,
  },
  {
    name: 'Pro Growth',
    price: 'след пилота',
    note: 'за активни партньори',
    features: ['Приоритет в каталога', 'Повече услуги', 'Оферти и поръчки', 'Месечен отчет'],
    highlighted: true,
  },
  {
    name: 'Studio / Brand',
    price: 'по договорка',
    note: 'за студиа, фирми и марки',
    features: ['Екипен профил', 'Продуктови линии', 'Партньорски кампании', 'Отделна отчетност'],
    highlighted: false,
  },
]

export default function TotsanPro() {
  return (
    <>
      <section className="section relative overflow-hidden bg-ink text-paper">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-8rem] top-[-8rem] h-[24rem] w-[24rem] rounded-full bg-accent/25 blur-3xl"></div>
          <div className="absolute bottom-[-10rem] right-[-7rem] h-[26rem] w-[26rem] rounded-full bg-trustGreen/20 blur-3xl"></div>
          <div className="absolute left-1/2 top-1/3 h-[18rem] w-[18rem] -translate-x-1/2 rounded-full bg-paper/10 blur-3xl"></div>
        </div>

        <div className="container-page relative grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] lg:items-center">
          <div className="reveal">
            <div className="eyebrow !text-paper/60">Totsan Pro</div>
            <h1 className="h-display mt-4 max-w-4xl">
              Работно място за добрите майстори, студиа и марки.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-paper/74">
              Totsan Pro е платената страна на платформата: проверени партньори получават профил, услуги, заявки, чат, поръчки и доверие. Клиентът остава свободен да търси помощ, а професионалистите плащат, когато Totsan започне да носи реална работа.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={PRO_SIGNUP_URL} className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep">
                Кандидатствай за Totsan Pro <ArrowRight size={18} />
              </Link>
              <a href="#pro-plan" className="btn btn-ghost !border-paper/25 !bg-paper/10 !text-paper hover:!border-paper/50">
                Виж плана
              </a>
            </div>
          </div>

          <div className="reveal rounded-[2rem] border border-paper/15 bg-paper/10 p-5 shadow-[0_30px_80px_-45px_rgba(0,0,0,0.65)] backdrop-blur">
            <div className="rounded-[1.5rem] bg-paper p-5 text-ink">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="eyebrow">Pro cockpit</div>
                  <h2 className="mt-2 font-display text-3xl">Какво вижда партньорът</h2>
                </div>
                <span className="rounded-2xl bg-accentSoft p-3 text-accentDeep"><Sparkles size={22} /></span>
              </div>
              <div className="mt-6 grid gap-3">
                {['Нов клиент от quiz', 'Оферта за баня до 6 000 лв.', 'Непрочетен чат', 'Отзив чака потвърждение'].map((item, index) => (
                  <div key={item} className="flex items-center justify-between rounded-2xl border border-line bg-soft px-4 py-3">
                    <span className="text-sm font-medium">{item}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${index === 0 ? 'bg-trustGreen' : 'bg-accent'}`}></span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-ink p-4 text-paper">
                <div className="text-xs uppercase tracking-[0.18em] text-paper/55">Фокус за днес</div>
                <div className="mt-2 font-display text-2xl">Отговори на 2 заявки преди конкурента.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section !py-10 bg-soft">
        <div className="container-page grid gap-3 md:grid-cols-3">
          {proMetrics.map((metric) => (
            <div key={metric.label} className="rounded-3xl border border-line bg-paper p-5">
              <div className="font-display text-4xl text-ink">{metric.value}</div>
              <div className="mt-1 text-sm text-muted">{metric.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section bg-paper">
        <div className="container-page">
          <div className="max-w-3xl reveal">
            <div className="eyebrow">Какво продаваме на Pro страната</div>
            <h2 className="h-section mt-3">Не “още един профил”, а система за работа.</h2>
            <p className="mt-4 text-muted">
              Ако клиентската страна е търсене и доверие, Pro страната трябва да е продуктивност: по-ясни заявки, по-малко шум, по-добро представяне и измерим резултат.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {productBlocks.map((block) => {
              const Icon = block.icon
              return (
                <article key={block.title} className="reveal rounded-3xl border border-line bg-soft p-6">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-paper text-accentDeep"><Icon size={22} /></span>
                  <h3 className="mt-5 font-display text-3xl text-ink">{block.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted">{block.text}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="section bg-soft">
        <div className="container-page grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="reveal lg:sticky lg:top-28">
            <div className="eyebrow">За кого е</div>
            <h2 className="h-section mt-3">Първо малко, но правилно ядро.</h2>
            <p className="mt-4 text-muted">
              Totsan Pro не трябва да пуска всички наведнъж. Най-силният старт е с ограничен пилот от хора, които могат да покажат качество и да отговарят бързо.
            </p>
          </div>

          <div className="grid gap-4">
            {audiences.map((audience) => (
              <article key={audience.label} className="reveal rounded-3xl border border-line bg-paper p-6">
                <div className="flex items-start gap-4">
                  <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accentSoft text-accentDeep"><Users size={20} /></span>
                  <div>
                    <h3 className="font-display text-3xl">{audience.label}</h3>
                    <p className="mt-2 text-sm leading-7 text-muted">{audience.text}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pro-plan" className="section bg-paper">
        <div className="container-page">
          <div className="max-w-3xl reveal">
            <div className="eyebrow">План за действие</div>
            <h2 className="h-section mt-3">Първите 30 дни на Totsan Pro.</h2>
            <p className="mt-4 text-muted">
              Целта не е веднага да строим огромна SaaS система. Целта е да докажем, че Totsan може да носи качествени заявки и че професионалистите виждат стойност.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {launchPlan.map((item) => (
              <article key={item.step} className="reveal rounded-3xl border border-line bg-soft p-6">
                <div className="font-display text-4xl text-accentDeep">{item.step}</div>
                <h3 className="mt-5 text-lg font-semibold text-ink">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-ink text-paper">
        <div className="container-page">
          <div className="max-w-3xl reveal">
            <div className="eyebrow !text-paper/55">Пилотна монетизация</div>
            <h2 className="h-section mt-3">Започваме с ясен, но мек модел.</h2>
            <p className="mt-4 text-paper/70">
              Първият етап трябва да махне риска за добрите партньори: влизат без такса, подреждаме профилите им, мерим резултата и чак след това активираме платен план.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {packages.map((plan) => (
              <article key={plan.name} className={`reveal rounded-[2rem] border p-6 ${plan.highlighted ? 'border-accent bg-paper text-ink shadow-[0_30px_90px_-55px_rgba(44,111,232,0.9)]' : 'border-paper/15 bg-paper/10 text-paper'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-3xl">{plan.name}</h3>
                    <p className={`mt-1 text-sm ${plan.highlighted ? 'text-muted' : 'text-paper/60'}`}>{plan.note}</p>
                  </div>
                  {plan.highlighted ? <Star className="text-accent" size={22} /> : <CheckCircle2 className="text-trustGreen" size={22} />}
                </div>
                <div className="mt-6 font-display text-4xl">{plan.price}</div>
                <ul className="mt-6 space-y-3 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle2 size={17} className={`mt-0.5 shrink-0 ${plan.highlighted ? 'text-accentDeep' : 'text-trustGreen'}`} />
                      <span className={plan.highlighted ? 'text-ink/80' : 'text-paper/75'}>{feature}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-soft">
        <div className="container-page rounded-[2rem] border border-line bg-paper p-6 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="reveal">
              <div className="eyebrow">Следваща стъпка</div>
              <h2 className="h-section mt-3">Кандидатствай като пилотен Pro партньор.</h2>
              <p className="mt-4 max-w-2xl text-muted">
                Ако си майстор, дизайнер, архитект, фирма или марка с реално качество, Totsan Pro започва от профил, услуги и първи измерими заявки.
              </p>
            </div>
            <div className="reveal flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link to={PRO_SIGNUP_URL} className="btn btn-primary justify-center">
                Стани Pro партньор <ArrowRight size={18} />
              </Link>
              <Link to="/contact" className="btn btn-ghost justify-center">
                Говори с екипа
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
