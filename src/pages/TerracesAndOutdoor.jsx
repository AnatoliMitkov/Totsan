import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  CheckCircle2,
  ArrowRight,
  Wind,
  Flame,
  Lamp,
  Armchair,
  LayoutGrid,
  TreePine,
  Sun,
  Sparkles,
} from 'lucide-react'
import { gsap } from 'gsap'
import { LAYER_HEROS, WHAT_YOU_FIND_IMAGES, SHOWCASE_IMAGES } from '../data/images.js'
import { formatDualCurrency, formatDualCurrencyRange } from '../lib/money.js'

// ─────────── Unsplash helper ────────────────────────────────────────────────
const U = (id, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=${w}`

// ─────────── Page-level images ───────────────────────────────────────────────
const IMG = {
  hero:    LAYER_HEROS.dekoraciya,
  terrace: WHAT_YOU_FIND_IMAGES.dekoraciya.terrace,
  garden:  WHAT_YOU_FIND_IMAGES.dekoraciya.garden,
  // showcase
  sc0: SHOWCASE_IMAGES.dekoraciya[2] || U('1505843513577-22bb7d21e455', 900),
  sc1: U('1485955900006-10f4d324d411', 900),
  sc2: U('1558618666-fcd25c85cd64', 900),
  // experts
  p1: U('1573496359142-b8d87734a5a2', 480),
  p2: U('1507003211169-0a1dd7228f2d', 480),
  p3: U('1580489944761-15a19d654956', 480),
}

// ─────────── Currency helpers ─────────────────────────────────────────────────
// Официален фиксиран курс: 1 EUR = 1.95583 лв.

// ─────────── Budget planner data ─────────────────────────────────────────────
const SPACES = [
  { id: 'balcony',  label: 'Балкон',        baseMin: 800,  baseMax: 2000  },
  { id: 'terrace',  label: 'Тераса',         baseMin: 1600, baseMax: 4200  },
  { id: 'rooftop',  label: 'Покривна зона',  baseMin: 2400, baseMax: 6500  },
]

const STYLES = [
  { id: 'lounge',  label: 'Lounge',      min: 1.0, max: 1.15, palette: 'Ратан, тъмно дърво, тъкани в натурален тон' },
  { id: 'minimal', label: 'Минималист',  min: 0.9, max: 1.05, palette: 'Бяло, сиво, алуминий' },
  { id: 'bold',    label: 'Средиземноморски', min: 1.1, max: 1.30, palette: 'Теракота, синьо, бяло мазило' },
]

const EXTRAS = [
  { id: 'pergola',   label: 'Пергола / биоклиматик',      min: 2800, max: 6500, icon: Wind  },
  { id: 'lighting',  label: 'Декоративно осветление',     min:  360, max:  900, icon: Lamp  },
  { id: 'furniture', label: 'Мебели за открито',          min: 1200, max: 3400, icon: Armchair },
  { id: 'tiles',     label: 'Настилка (декинг / плочи)', min:  650, max: 2100, icon: LayoutGrid },
  { id: 'plants',    label: 'Растения и кашпи',           min:  280, max:  750, icon: TreePine },
  { id: 'barbecue',  label: 'Барбекю кът / огнище',       min: 1800, max: 4200, icon: Flame },
]

// ─────────── Export ───────────────────────────────────────────────────────────
export default function TerracesAndOutdoor() {
  const pageRef = useRef(null)

  useEffect(() => {
    window.scrollTo({ top: 0 })
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.terrace-fade',
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out', stagger: 0.13 },
      )
      gsap.fromTo('.terrace-hero-bg', { scale: 1.06 }, { scale: 1, duration: 1.6, ease: 'power2.out' })
    }, pageRef)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={pageRef} className="min-h-screen bg-paper text-ink">
      <Hero />
      <Intro />
      <TerracePlanner />
      <TerraceShowcase />
      <TerraceExperts />
      <TerraceFAQ />
      <TerraceCTA />
    </div>
  )
}

// ─────────── Hero ─────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="section relative min-h-[74svh] overflow-hidden flex items-center" style={{ paddingTop: 'calc(var(--header-h, 64px) + 6rem)', paddingBottom: '6rem' }}>
      <div className="absolute inset-0 z-0">
        <img
          src={IMG.terrace}
          alt="Тераси и външни зони"
          className="img-cover terrace-hero-bg"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/92 via-ink/62 to-ink/30" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-paper to-transparent" />
      </div>

      <div className="container-page relative z-10 w-full">
        <div className="max-w-3xl text-paper">
          <div className="terrace-fade inline-flex items-center gap-3 rounded-full border border-paper/20 bg-paper/10 px-4 py-1.5 text-xs font-semibold tracking-[0.16em]">
            <Sun size={14} />
            ОТВЪД ПРАГА
          </div>
          <h1 className="h-display mt-6 terrace-fade">
            Тераси и
            <br />
            <span className="italic text-trustGreen">външни зони.</span>
          </h1>
          <p className="terrace-fade mt-6 max-w-2xl text-paper/85 text-lg leading-relaxed">
            Перголи, лаундж кътчета, настилки, осветление и растения — всичко, което превръща открития
            квадрат в любимото място у дома. Намираш специалисти и идеи за балкон, тераса или покрив.
          </p>
          <div className="terrace-fade mt-8 flex flex-wrap gap-3">
            <a
              href="#terrace-planner"
              className="btn btn-primary !bg-trustGreen !text-paper hover:!bg-trustGreen/90"
            >
              Планирай пространството
            </a>
            <a
              href="#terrace-experts"
              className="btn btn-ghost !border-paper/25 !bg-paper/10 !text-paper hover:!border-paper/45"
            >
              Виж специалистите
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─────────── Intro ────────────────────────────────────────────────────────────
function Intro() {
  const pillars = [
    {
      title: 'Функционална зона навън',
      desc:  'Проектираме пространството спрямо изложение, използване и бюджет — без излишни компромиси.',
      icon:  <Sun className="text-trustGreen" size={22} />,
    },
    {
      title: 'Устойчиви материали',
      desc:  'Декинг от термобор, алуминиеви конструкции, IP-осветление и текстил с UV защита.',
      icon:  <Sparkles className="text-trustGreen" size={22} />,
    },
    {
      title: 'Готово до сезона',
      desc:  'Координираме изпълнителите, за да е готово докато времето все още е хубаво.',
      icon:  <CheckCircle2 className="text-trustGreen" size={22} />,
    },
  ]

  return (
    <section className="section bg-paper">
      <div className="container-page">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="reveal lg:col-span-5">
            <p className="font-display text-3xl italic leading-tight text-accentDeep lg:text-4xl">
              „Любимото място у дома е там, откъдето виждаш небето."
            </p>
          </div>
          <div className="reveal lg:col-span-7">
            <p className="text-base leading-relaxed text-muted">
              Балконът, терасата или покривната градина са квадратните метри, които най-малко се
              използват — не защото не са важни, а защото остават на последно в плана. В Totsan
              намираш специалисти по пергоали, настилки, озеленяване и осветление, които работят
              заедно, за да получиш завършено пространство, а не купчина каталози.
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

// ─────────── Budget Planner ───────────────────────────────────────────────────
function TerracePlanner() {
  const [spaceId, setSpaceId]   = useState(SPACES[0].id)
  const [styleId, setStyleId]   = useState(STYLES[0].id)
  const [baseBudget, setBase]   = useState(2000)
  const [selectedIds, setSelected] = useState(['pergola', 'lighting'])

  const space = SPACES.find((s) => s.id === spaceId) || SPACES[0]
  const style = STYLES.find((s) => s.id === styleId) || STYLES[0]

  const estimate = useMemo(() => {
    const chosen = EXTRAS.filter((e) => selectedIds.includes(e.id))
    const extMin = chosen.reduce((sum, e) => sum + e.min, 0)
    const extMax = chosen.reduce((sum, e) => sum + e.max, 0)
    return {
      min: Math.round((baseBudget + space.baseMin + extMin) * style.min),
      max: Math.round((baseBudget + space.baseMax + extMax) * style.max),
    }
  }, [baseBudget, selectedIds, space, style])

  const toggleExtra = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  return (
    <section id="terrace-planner" className="section border-y border-line bg-soft">
      <div className="container-page">
        <div className="mb-10 max-w-3xl">
          <div className="eyebrow">Интерактивен планировчик</div>
          <h2 className="h-section mt-2">Колко струва твоята идеална тераса?</h2>
          <p className="mt-3 text-muted">
            Избери тип пространство, стил и елементи. Получаваш ориентир за бюджет и отправна точка за
            конкретна оферта.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
          {/* ── Controls ─────────────────────────────────────────── */}
          <div className="card rounded-3xl border border-line bg-paper p-6 shadow-sm lg:col-span-7">
            {/* Space type */}
            <div>
              <div className="text-sm font-semibold text-ink">Тип пространство</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {SPACES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSpaceId(s.id)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${
                      s.id === spaceId
                        ? 'border-trustGreen bg-trustGreen/10 text-ink'
                        : 'border-line bg-paper text-muted hover:border-muted/40 hover:text-ink'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Style */}
            <div className="mt-7">
              <div className="text-sm font-semibold text-ink">Стилова посока</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyleId(s.id)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                      s.id === styleId
                        ? 'border-trustGreen bg-trustGreen/10 text-ink'
                        : 'border-line bg-paper text-muted hover:border-muted/40 hover:text-ink'
                    }`}
                  >
                    <div className="font-medium">{s.label}</div>
                    <div className="mt-0.5 text-xs opacity-80">{s.palette}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Base budget slider */}
            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink">Базов бюджет</span>
                <span className="text-sm font-semibold text-trustGreen">
                  {formatDualCurrency(baseBudget)}
                </span>
              </div>
              <input
                type="range"
                min="800"
                max="8000"
                step="200"
                value={baseBudget}
                onChange={(e) => setBase(Number(e.target.value))}
                className="w-full cursor-pointer accent-trustGreen"
              />
            </div>

            {/* Extras */}
            <div className="mt-7">
              <div className="text-sm font-semibold text-ink">Добави елементи</div>
              <div className="mt-3 grid gap-2">
                {EXTRAS.map((extra) => {
                  const active = selectedIds.includes(extra.id)
                  const Icon = extra.icon
                  return (
                    <button
                      key={extra.id}
                      type="button"
                      onClick={() => toggleExtra(extra.id)}
                      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? 'border-trustGreen bg-trustGreen/10'
                          : 'border-line bg-paper hover:border-muted/40'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={`rounded-xl p-2 ${active ? 'bg-trustGreen text-paper' : 'bg-soft text-muted'}`}
                        >
                          <Icon size={17} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-ink">{extra.label}</span>
                          <span className="block text-xs text-muted">
                            {formatDualCurrencyRange(extra.min, extra.max)}
                          </span>
                        </span>
                      </span>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                          active ? 'border-trustGreen bg-trustGreen text-paper' : 'border-line bg-paper text-transparent'
                        }`}
                      >
                        <Check size={14} strokeWidth={2.8} />
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Summary ──────────────────────────────────────────── */}
          <aside className="lg:col-span-5">
            <div className="rounded-3xl bg-gradient-to-br from-ink via-graphite to-ink p-8 text-paper shadow-lg">
              <div className="text-xs font-semibold tracking-[0.16em] text-accentSoft">
                ОРИЕНТИРОВЪЧЕН БЮДЖЕТ
              </div>
              <div className="mt-4 font-display text-4xl leading-tight">
                {formatDualCurrencyRange(estimate.min, estimate.max)}
              </div>
              <p className="mt-3 text-sm text-paper/75">
                За {space.label.toLowerCase()} в стил „{style.label.toLowerCase()}" с избраните
                елементи.
              </p>

              <div className="my-6 h-px bg-paper/15" />

              <ul className="space-y-2 text-sm text-paper/85">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-trustGreen" />
                  Включен оглед и измерване на място.
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-trustGreen" />
                  Координация на всички изпълнители.
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-trustGreen" />
                  Гаранция за качество на монтажа.
                </li>
              </ul>

              <p className="mt-5 text-center text-xs text-paper/35">
                1 € = 1.95583 лв. · официален фиксиран курс
              </p>

              <Link
                to="/contact"
                className="btn btn-primary mt-4 w-full justify-center !bg-trustGreen !text-paper hover:!bg-trustGreen/90"
              >
                Поискай точна оферта
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}

// ─────────── Showcase ─────────────────────────────────────────────────────────
function TerraceShowcase() {
  const [activeTab, setActiveTab] = useState(0)

  const items = [
    {
      title:    'Тераса за вечерни срещи',
      location: 'Варна, Бриз',
      desc:     'Lоunge ъгъл от ратанови мебели с ниска маса, декоративни окачени лампи и порцеланови кашпи с маслинени дървета. Настилката е от фибро-цимент плочи 60×60.',
      img:      IMG.sc0,
    },
    {
      title:    'Балкон-оранжерия',
      location: 'София, Лозенец',
      desc:     'Вертикален зелен панел от сочни растения, LED лента по парапета и сгъваема маса за двама. Проектът е изпълнен за 8 дни при живи наематели.',
      img:      IMG.sc1,
    },
    {
      title:    'Покривен лаундж',
      location: 'Пловдив, Капана',
      desc:     'Алуминиева биоклиматична пергола с моторизирани ламели, вграден барплот от тик, подово осветление и декоративна каменна стена.',
      img:      IMG.sc2,
    },
  ]

  return (
    <section className="section bg-paper">
      <div className="container-page">
        <div className="text-center">
          <div className="eyebrow">Реализирани проекти</div>
          <h2 className="h-section mt-2">Как изглежда завършената тераса</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">
            Три различни пространства — балкон, тераса и покрив — преобразени с логика и вкус.
          </p>
        </div>

        <div className="mt-8 flex justify-center gap-2 overflow-x-auto whitespace-nowrap border-b border-line pb-3">
          {items.map((item, index) => (
            <button
              key={item.title}
              type="button"
              onClick={() => setActiveTab(index)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                index === activeTab
                  ? 'bg-trustGreen text-paper'
                  : 'bg-paper text-muted hover:bg-soft hover:text-ink'
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>

        <div className="mt-8 grid min-h-[22rem] items-stretch overflow-hidden rounded-3xl border border-line bg-paper shadow-sm md:grid-cols-12">
          <div className="relative h-72 md:col-span-7 md:h-auto">
            <img
              src={items[activeTab].img}
              alt={items[activeTab].title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-col justify-between p-7 md:col-span-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-trustGreen">
                {items[activeTab].location}
              </div>
              <h3 className="mt-2 font-display text-3xl text-ink">{items[activeTab].title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-muted">{items[activeTab].desc}</p>
            </div>
            <Link
              to="/contact"
              className="link-arrow mt-6 inline-flex !border-trustGreen !text-trustGreen hover:!border-ink hover:!text-ink"
            >
              Искам подобна визия
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─────────── Experts ──────────────────────────────────────────────────────────
function TerraceExperts() {
  const experts = [
    {
      name:    'Outdoor Living BG',
      role:    'Мебели и пергоали за открито',
      region:  'Цяла България',
      rating:  '4.93',
      reviews: '44 отзива',
      avatar:  IMG.p1,
    },
    {
      name:    'Илиян Радев',
      role:    'Настилки и декинг',
      region:  'София и Пловдив',
      rating:  '4.88',
      reviews: '31 отзива',
      avatar:  IMG.p2,
    },
    {
      name:    'Студио „Зеленина"',
      role:    'Растения и вертикални градини',
      region:  'Варна и Бургас',
      rating:  '4.91',
      reviews: '22 отзива',
      avatar:  IMG.p3,
    },
  ]

  return (
    <section id="terrace-experts" className="section border-y border-line bg-soft">
      <div className="container-page">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Препоръчани профили</div>
            <h2 className="h-section mt-2">Специалисти по тераси и открити зони</h2>
          </div>
          <Link
            to="/katalog"
            className="link-arrow !border-trustGreen !text-trustGreen hover:!border-ink hover:!text-ink"
          >
            Виж всички в каталога
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {experts.map((expert) => (
            <article
              key={expert.name}
              className="card rounded-2xl border border-line bg-paper p-6 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <img
                  src={expert.avatar}
                  alt={expert.name}
                  className="h-16 w-16 rounded-full border border-line object-cover"
                />
                <div className="min-w-0">
                  <h3 className="truncate font-display text-2xl text-ink">{expert.name}</h3>
                  <p className="text-xs text-muted">{expert.role}</p>
                </div>
              </div>
              <div className="my-4 h-px bg-line" />
              <div className="flex items-center justify-between text-xs text-muted">
                <span>
                  ★ {expert.rating} • {expert.reviews}
                </span>
                <span>{expert.region}</span>
              </div>
              <Link
                to="/contact"
                className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-trustGreen hover:text-ink"
              >
                Свържи се <ArrowRight size={14} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────── FAQ ──────────────────────────────────────────────────────────────
function FAQItem({ question, answer }) {
  const [isOpen, setIsOpen] = useState(false)
  const bodyRef = useRef(null)

  return (
    <div className="border-b border-line py-5">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 py-1 text-left"
        aria-expanded={isOpen}
      >
        <span className="font-display text-2xl text-ink">{question}</span>
        <span
          className={`text-3xl text-trustGreen transition-transform ${isOpen ? 'rotate-45' : ''}`}
        >
          +
        </span>
      </button>
      <div
        ref={bodyRef}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: isOpen ? `${bodyRef.current?.scrollHeight}px` : '0px' }}
      >
        <p className="max-w-3xl pt-3 text-sm leading-relaxed text-muted">{answer}</p>
      </div>
    </div>
  )
}

function TerraceFAQ() {
  const items = [
    {
      q: 'Може ли проектът да включва и балкон, и тераса едновременно?',
      a: 'Да. Работим с пространствата заедно или поотделно. При обща визия използваме съвместими материали и палитра, за да изглеждат като едно цяло.',
    },
    {
      q: 'Какви материали са подходящи за влажен климат или сянка?',
      a: 'За по-влажни и засенчени зони препоръчваме композитен декинг (WPC), алуминиеви конструкции и сенкоустойчива растителност като папрати, хоста и зеленика.',
    },
    {
      q: 'Колко трае монтажът на пергола с биоклиматик?',
      a: 'Стандартен монтаж отнема между 2 и 5 работни дни в зависимост от размера. Проектирането и поръчката добавят 3–6 седмици за производство.',
    },
    {
      q: 'Може ли да изпълните само осветлението или само настилката?',
      a: 'Разбира се. Нямаш нужда от пълен пакет. Свързваме те с конкретния специалист за точно нужното ти — без пакетни условия.',
    },
  ]

  return (
    <section className="section bg-paper">
      <div className="container-page max-w-4xl">
        <div className="text-center">
          <div className="eyebrow">Често задавани въпроси</div>
          <h2 className="h-section mt-2">За терасите и външните зони</h2>
        </div>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {items.map((item) => (
            <FAQItem key={item.q} question={item.q} answer={item.a} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────── CTA ──────────────────────────────────────────────────────────────
function TerraceCTA() {
  return (
    <section className="section !pt-0">
      <div className="container-page rounded-3xl bg-gradient-to-br from-ink via-graphite to-ink p-10 text-paper shadow-xl md:grid md:grid-cols-12 md:items-center md:gap-8 md:p-14">
        <div className="md:col-span-8">
          <h2 className="h-section text-paper">Готов ли си да оживиш откритото пространство?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-paper/75">
            Изпрати снимки и размери на терасата. До 48 часа ще получиш конкретна идея, специалист и
            ориентировъчна цена.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3 md:col-span-4 md:mt-0 md:justify-end">
          <Link
            to="/contact"
            className="btn btn-primary !bg-trustGreen !text-paper hover:!bg-trustGreen/90"
          >
            Заяви консултация
          </Link>
        </div>
      </div>
    </section>
  )
}
