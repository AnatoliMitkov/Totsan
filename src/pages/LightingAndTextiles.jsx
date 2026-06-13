import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Check, CheckCircle2, ArrowRight,
  LampFloor, Sparkles, LayoutGrid, Layers, Sun,
} from 'lucide-react'
import { gsap } from 'gsap'
import { WHAT_YOU_FIND_IMAGES, SHOWCASE_IMAGES } from '../data/images.js'
import { formatDualCurrency, formatDualCurrencyRange } from '../lib/money.js'

const U = (id, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=${w}`


const IMG = {
  hero: WHAT_YOU_FIND_IMAGES.obzavezhdane.lighting,
  sc0:  SHOWCASE_IMAGES.obzavezhdane[3] || U('1513506003901-1e6a229e2d15', 900),
  sc1:  U('1567538096630-e0c55bd6374c', 900),
  sc2:  U('1558882224-dda166733046', 900),
  p1:   U('1573496359142-b8d87734a5a2', 480),
  p2:   U('1507003211169-0a1dd7228f2d', 480),
  p3:   U('1580489944761-15a19d654956', 480),
}

const SCOPE = [
  { id: 'one',   label: '1–2 помещения',  baseMin:  800, baseMax: 2200  },
  { id: 'three', label: '3–4 помещения',  baseMin: 1600, baseMax: 4000  },
  { id: 'all',   label: 'Цяло жилище',    baseMin: 2800, baseMax: 7500  },
]

const MOODS = [
  { id: 'warm',      label: 'Топла атмосфера',    min: 1.0,  max: 1.10, palette: 'Ламели, тъпан лам, мека светлина 2700 K' },
  { id: 'functional',label: 'Функционален',        min: 0.85, max: 1.00, palette: 'Спотове, трак, равномерна 4000 K' },
  { id: 'designer',  label: 'Дизайнерски акцент', min: 1.15, max: 1.35, palette: 'Авторски лампи, тапети, килим' },
]

const EXTRAS = [
  { id: 'pendants',  label: 'Окачени лампи (до 3 бр.)',      min:  480, max: 2200, icon: LampFloor },
  { id: 'track',     label: 'Трак-система с LED спотове',    min:  350, max: 1400, icon: LayoutGrid },
  { id: 'curtains',  label: 'Завеси по поръчка (до 4 прозор.)', min: 600, max: 2400, icon: Layers },
  { id: 'rug',       label: 'Дизайнерски килим',              min:  380, max: 1800, icon: Sparkles },
  { id: 'cushions',  label: 'Декоративни кувертюри и възглавници', min: 180, max:  650, icon: Sun },
]

export default function LightingAndTextiles() {
  const pageRef = useRef(null)

  useEffect(() => {
    window.scrollTo({ top: 0 })
    const ctx = gsap.context(() => {
      gsap.fromTo('.light-fade', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out', stagger: 0.13 })
      gsap.fromTo('.light-hero-bg', { scale: 1.06 }, { scale: 1, duration: 1.6, ease: 'power2.out' })
    }, pageRef)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={pageRef} className="min-h-screen bg-paper text-ink">
      <Hero />
      <Intro />
      <LightingPlanner />
      <LightingShowcase />
      <LightingExperts />
      <LightingFAQ />
      <LightingCTA />
    </div>
  )
}

function Hero() {
  return (
    <section className="section relative min-h-[74svh] overflow-hidden py-24 flex items-center" style={{ paddingTop: 'calc(var(--header-h, 64px) + 6rem)' }}>
      <div className="absolute inset-0 z-0">
        <img src={IMG.hero} alt="Осветление и текстил" className="img-cover light-hero-bg" />
        <div className="absolute inset-0 bg-ink/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/70 to-ink/30" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-paper to-transparent" />
      </div>

      <div className="container-page relative z-10 w-full">
        <div className="max-w-3xl text-paper">
          <div className="light-fade inline-flex items-center gap-3 rounded-full border border-paper/20 bg-paper/10 px-4 py-1.5 text-xs font-semibold tracking-[0.16em]">
            <LampFloor size={14} />
            ФИНАЛНИЯТ СЛОЙ
          </div>
          <h1 className="h-display mt-6 light-fade">
            Осветление<br />
            <span className="italic text-accent">и текстил.</span>
          </h1>
          <p className="light-fade mt-6 max-w-2xl text-paper/85 text-lg leading-relaxed">
            Правилната лампа, завесата на точното място и килимът с правилния размер — дребните детайли, правещи пространството завършено и живо.
          </p>
          <div className="light-fade mt-8 flex flex-wrap gap-3">
            <a href="#lighting-planner" className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep">
              Планирай бюджета
            </a>
            <a href="#lighting-experts" className="btn btn-ghost !border-paper/25 !bg-paper/10 !text-paper hover:!border-paper/45">
              Виж специалистите
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function Intro() {
  const pillars = [
    { title: 'Светлина = усещане', desc: 'Температурата и посоката на светлината определят дали стаята е уютна или студена. Правим правилния избор.', icon: <LampFloor className="text-accent" size={22} /> },
    { title: 'Текстил по размер', desc: 'Завеси, пердета и килими, шити по мярка, не компромис с готово — защото стандартните размери рядко съвпадат.', icon: <Layers className="text-accent" size={22} /> },
    { title: 'Завършено в един ден', desc: 'Монтаж на осветление и окачване на завеси от един екип — без два отделни записа.', icon: <CheckCircle2 className="text-accent" size={22} /> },
  ]

  return (
    <section className="section bg-paper">
      <div className="container-page">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="reveal lg:col-span-5">
            <p className="font-display text-3xl italic leading-tight text-accentDeep lg:text-4xl">
              „Светлината е последният четкин удар — без него картината остава незавършена."
            </p>
          </div>
          <div className="reveal lg:col-span-7">
            <p className="text-base leading-relaxed text-muted">
              Обзавеждането може да е перфектно, а стаята — да не работи. Причината почти винаги е осветлението или текстилът. В Totsan намираш осветители, дизайнери и шивачи на завеси, работещи заедно, за да даде стаята максималното.
            </p>
          </div>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {pillars.map((item) => (
            <article key={item.title} className="reveal rounded-2xl border border-line bg-soft/55 p-6">
              <div className="mb-4 inline-flex rounded-xl border border-line bg-paper p-2.5">{item.icon}</div>
              <h3 className="font-display text-2xl text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function LightingPlanner() {
  const [scopeId, setScopeId] = useState(SCOPE[0].id)
  const [moodId, setMoodId] = useState(MOODS[0].id)
  const [baseBudget, setBase] = useState(1500)
  const [selectedIds, setSelected] = useState(['pendants', 'curtains'])

  const scope = SCOPE.find((s) => s.id === scopeId) || SCOPE[0]
  const mood  = MOODS.find((m) => m.id === moodId)  || MOODS[0]

  const estimate = useMemo(() => {
    const chosen = EXTRAS.filter((e) => selectedIds.includes(e.id))
    const extMin = chosen.reduce((s, e) => s + e.min, 0)
    const extMax = chosen.reduce((s, e) => s + e.max, 0)
    return {
      min: Math.round((baseBudget + scope.baseMin + extMin) * mood.min),
      max: Math.round((baseBudget + scope.baseMax + extMax) * mood.max),
    }
  }, [baseBudget, selectedIds, scope, mood])

  const toggle = (id) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])

  return (
    <section id="lighting-planner" className="section border-y border-line bg-soft">
      <div className="container-page">
        <div className="mb-10 max-w-3xl">
          <div className="eyebrow">Интерактивен планировчик</div>
          <h2 className="h-section mt-2">Колко струва осветлението и текстилът?</h2>
          <p className="mt-3 text-muted">Избери обхват, стилова посока и желаните елементи за ориентировъчна оценка.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
          <div className="card rounded-3xl border border-line bg-paper p-6 shadow-sm lg:col-span-7">
            <div>
              <div className="text-sm font-semibold text-ink">Обхват</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {SCOPE.map((s) => (
                  <button key={s.id} type="button" onClick={() => setScopeId(s.id)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${s.id === scopeId ? 'border-accent bg-accent/10 text-ink' : 'border-line bg-paper text-muted hover:border-muted/40 hover:text-ink'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-7">
              <div className="text-sm font-semibold text-ink">Атмосфера</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {MOODS.map((m) => (
                  <button key={m.id} type="button" onClick={() => setMoodId(m.id)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${m.id === moodId ? 'border-accent bg-accent/10 text-ink' : 'border-line bg-paper text-muted hover:border-muted/40 hover:text-ink'}`}>
                    <div className="font-medium">{m.label}</div>
                    <div className="mt-0.5 text-xs opacity-80">{m.palette}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink">Базов бюджет</span>
                <span className="text-sm font-semibold text-accent">
                  {formatDualCurrency(baseBudget)}
                </span>
              </div>
              <input type="range" min="500" max="8000" step="250" value={baseBudget}
                onChange={(e) => setBase(Number(e.target.value))} className="w-full cursor-pointer accent-accent" />
            </div>

            <div className="mt-7">
              <div className="text-sm font-semibold text-ink">Добави елементи</div>
              <div className="mt-3 grid gap-2">
                {EXTRAS.map((extra) => {
                  const active = selectedIds.includes(extra.id)
                  const Icon = extra.icon
                  return (
                    <button key={extra.id} type="button" onClick={() => toggle(extra.id)}
                      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition ${active ? 'border-accent bg-accent/10' : 'border-line bg-paper hover:border-muted/40'}`}>
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`rounded-xl p-2 ${active ? 'bg-accent text-paper' : 'bg-soft text-muted'}`}><Icon size={17} /></span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-ink">{extra.label}</span>
                          <span className="block text-xs text-muted">
                            {formatDualCurrencyRange(extra.min, extra.max)}
                          </span>
                        </span>
                      </span>
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${active ? 'border-accent bg-accent text-paper' : 'border-line bg-paper text-transparent'}`}>
                        <Check size={14} strokeWidth={2.8} />
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <aside className="lg:col-span-5">
            <div className="rounded-3xl bg-gradient-to-br from-ink via-graphite to-ink p-8 text-paper shadow-lg">
              <div className="text-xs font-semibold tracking-[0.16em] text-accentSoft">ОРИЕНТИРОВЪЧЕН БЮДЖЕТ</div>
              <div className="mt-4 font-display text-4xl leading-tight">
                {formatDualCurrencyRange(estimate.min, estimate.max)}
              </div>
              <p className="mt-3 text-sm text-paper/75">
                {scope.label}, атмосфера „{mood.label.toLowerCase()}" с избраните елементи.
              </p>

              <div className="my-6 h-px bg-paper/15" />

              <ul className="space-y-2 text-sm text-paper/85">
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-accent" />Консултация на място за светлинен план.</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-accent" />Монтаж на осветление и завеси.</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-accent" />Доставка от дизайнерски марки.</li>
              </ul>

              <p className="mt-5 text-center text-xs text-paper/35">1 € = 1.95583 лв. · официален фиксиран курс</p>

              <Link to="/contact" className="btn btn-primary mt-4 w-full justify-center !bg-accent !text-paper hover:!bg-accentDeep">
                Поискай точна оферта
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}

function LightingShowcase() {
  const [activeTab, setActiveTab] = useState(0)
  const items = [
    { title: 'Топла дневна с лампи', location: 'София, Лозенец', desc: 'Три окачени лампи над трапезарията на регулируема височина, трак с 6 спота в дневната, LED лента зад телевизора — и резултатът: пространство с три режима на осветление.', img: IMG.sc0 },
    { title: 'Завеси по поръчка', location: 'Варна, Чайка', desc: 'Тъмнозелен тежък панелен тул и светлосив ден за спалнята. Ушити на мярка, монтирани на прав корниз до тавана — прозорците изглеждат двойно по-високи.', img: IMG.sc1 },
    { title: 'Ъглов килим за дневна', location: 'Пловдив, Кършияка', desc: 'Берберски килим 2×3 м в цвят слонова кост, в правилния размер за 4-местен диван. Добавен с кафява холна маса и декоративни кошници — стаята спира да изглежда незавършена.', img: IMG.sc2 },
  ]

  return (
    <section className="section bg-paper">
      <div className="container-page">
        <div className="text-center">
          <div className="eyebrow">Реализирани проекти</div>
          <h2 className="h-section mt-2">Как детайлите правят разликата</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">Осветление, завеси, килим — три проекта, три различни трансформации.</p>
        </div>

        <div className="mt-8 flex justify-center gap-2 overflow-x-auto whitespace-nowrap border-b border-line pb-3">
          {items.map((item, index) => (
            <button key={item.title} type="button" onClick={() => setActiveTab(index)}
              className={`rounded-full px-4 py-2 text-sm transition ${index === activeTab ? 'bg-accent text-paper' : 'bg-paper text-muted hover:bg-soft hover:text-ink'}`}>
              {item.title}
            </button>
          ))}
        </div>

        <div className="mt-8 grid min-h-[22rem] items-stretch overflow-hidden rounded-3xl border border-line bg-paper shadow-sm md:grid-cols-12">
          <div className="relative h-72 md:col-span-7 md:h-auto">
            <img src={items[activeTab].img} alt={items[activeTab].title} className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div className="flex flex-col justify-between p-7 md:col-span-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{items[activeTab].location}</div>
              <h3 className="mt-2 font-display text-3xl text-ink">{items[activeTab].title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-muted">{items[activeTab].desc}</p>
            </div>
            <Link to="/contact" className="link-arrow mt-6 inline-flex !border-accent !text-accent hover:!border-ink hover:!text-ink">Искам подобен ефект</Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function LightingExperts() {
  const experts = [
    { name: 'Студио „Луминикс"', role: 'Проектиране на осветление', region: 'Цяла България', rating: '4.94', reviews: '48 отзива', avatar: IMG.p1 },
    { name: 'Ателие „Текстура"', role: 'Завеси и текстил по поръчка', region: 'София и Пловдив', rating: '4.91', reviews: '36 отзива', avatar: IMG.p2 },
    { name: 'Мартина Василева', role: 'Интериорен стилист', region: 'Варна и Бургас', rating: '4.87', reviews: '24 отзива', avatar: IMG.p3 },
  ]

  return (
    <section id="lighting-experts" className="section border-y border-line bg-soft">
      <div className="container-page">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Препоръчани профили</div>
            <h2 className="h-section mt-2">Специалисти по осветление и текстил</h2>
          </div>
          <Link to="/katalog" className="link-arrow !border-accent !text-accent hover:!border-ink hover:!text-ink">Виж всички в каталога</Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {experts.map((expert) => (
            <article key={expert.name} className="card rounded-2xl border border-line bg-paper p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <img src={expert.avatar} alt={expert.name} className="h-16 w-16 rounded-full border border-line object-cover" />
                <div className="min-w-0">
                  <h3 className="truncate font-display text-2xl text-ink">{expert.name}</h3>
                  <p className="text-xs text-muted">{expert.role}</p>
                </div>
              </div>
              <div className="my-4 h-px bg-line" />
              <div className="flex items-center justify-between text-xs text-muted">
                <span>★ {expert.rating} • {expert.reviews}</span>
                <span>{expert.region}</span>
              </div>
              <Link to="/contact" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-ink">
                Свържи се <ArrowRight size={14} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function FAQItem({ question, answer }) {
  const [isOpen, setIsOpen] = useState(false)
  const bodyRef = useRef(null)
  return (
    <div className="border-b border-line py-5">
      <button type="button" onClick={() => setIsOpen((p) => !p)} className="flex w-full items-center justify-between gap-4 py-1 text-left" aria-expanded={isOpen}>
        <span className="font-display text-2xl text-ink">{question}</span>
        <span className={`text-3xl text-accent transition-transform ${isOpen ? 'rotate-45' : ''}`}>+</span>
      </button>
      <div ref={bodyRef} className="overflow-hidden transition-[max-height] duration-300 ease-in-out" style={{ maxHeight: isOpen ? `${bodyRef.current?.scrollHeight}px` : '0px' }}>
        <p className="max-w-3xl pt-3 text-sm leading-relaxed text-muted">{answer}</p>
      </div>
    </div>
  )
}

function LightingFAQ() {
  const items = [
    { q: 'Каква цветна температура е подходяща за всяко помещение?', a: 'Спалня и дневна — 2700–3000 K (топло бяло). Кухня и баня — 3500–4000 K (неутрално). Работно пространство — 4000–5000 K (студено бяло за концентрация).' },
    { q: 'Колко широка трябва да е завесата?', a: 'Стандартно завесата трябва да е 1.5 до 2 пъти по-широка от прозореца. При завеса, изискваща естетическа пълнота, препоръчваме 2× ширина.' },
    { q: 'Мога ли да поръчам само монтаж без доставка?', a: 'Да. Ако вече имаш закупени лампи или завеси, специалистите ни правят само монтажа. Ако имаш нужда от препоръка за конкретни продукти, можем да съдействаме и с това.' },
    { q: 'Какъв е правилният размер килим за дневна?', a: 'За 4-местен диван с холна маса минималният препоръчван размер е 2×3 м. По-малкият килим прави стаята откъсната и незавършена — честа грешка при обзавеждане.' },
  ]
  return (
    <section className="section bg-paper">
      <div className="container-page max-w-4xl">
        <div className="text-center">
          <div className="eyebrow">Често задавани въпроси</div>
          <h2 className="h-section mt-2">За осветлението и текстила</h2>
        </div>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {items.map((item) => <FAQItem key={item.q} question={item.q} answer={item.a} />)}
        </div>
      </div>
    </section>
  )
}

function LightingCTA() {
  return (
    <section className="section !pt-0">
      <div className="container-page rounded-3xl bg-gradient-to-br from-ink via-graphite to-ink p-10 text-paper shadow-xl md:grid md:grid-cols-12 md:items-center md:gap-8 md:p-14">
        <div className="md:col-span-8">
          <h2 className="h-section text-paper">Готов ли си да завършиш пространството?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-paper/75">Изпрати снимки на стаята. До 48 часа ще получиш конкретна идея за осветление и текстил, подходящи за твоето пространство.</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3 md:col-span-4 md:mt-0 md:justify-end">
          <Link to="/contact" className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep">Заяви консултация</Link>
        </div>
      </div>
    </section>
  )
}
