import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Compass,
  Frame,
  LampFloor,
  Palette,
  Sparkles,
  SwatchBook,
} from 'lucide-react'
import { gsap } from 'gsap'
import { LAYER_HEROS, SHOWCASE_IMAGES, WHAT_YOU_FIND_IMAGES } from '../data/images.js'

const U = (id, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=${w}`

// Официален фиксиран курс: 1 EUR = 1.95583 лв.
const EUR_RATE = 1.95583
const fmtEur = (lv) => Math.round(lv / EUR_RATE)

const DECOR_IMAGES = {
  hero: LAYER_HEROS.dekoraciya,
  decor: WHAT_YOU_FIND_IMAGES.dekoraciya.decor,
  wallpaper: WHAT_YOU_FIND_IMAGES.dekoraciya.wallpaper,
  terrace: WHAT_YOU_FIND_IMAGES.dekoraciya.terrace,
  garden: WHAT_YOU_FIND_IMAGES.dekoraciya.garden,
  styling: U('1513694203232-719a280e022f', 1200),
  profile1: U('1573496359142-b8d87734a5a2', 480),
  profile2: U('1580489944761-15a19d654956', 480),
  profile3: U('1507003211169-0a1dd7228f2d', 480),
}

const ROOMS = [
  { id: 'living', label: 'Дневна', baseMin: 950, baseMax: 1900 },
  { id: 'bedroom', label: 'Спалня', baseMin: 800, baseMax: 1650 },
  { id: 'hallway', label: 'Антре', baseMin: 620, baseMax: 1320 },
]

const MOODS = [
  { id: 'clean', label: 'Минимален', min: 0.95, max: 1.08, palette: 'Топло бяло, лен, дърво' },
  { id: 'bold', label: 'Смел акцент', min: 1.08, max: 1.24, palette: 'Наситено синьо, черно, месинг' },
  { id: 'soft', label: 'Уют и текстил', min: 1.02, max: 1.16, palette: 'Пясък, маслинено, теракота' },
]

const FEATURES = [
  { id: 'wall-art', label: 'Галерия от картини', min: 280, max: 650, icon: Frame },
  { id: 'lighting', label: 'Декоративно осветление', min: 320, max: 780, icon: LampFloor },
  { id: 'textiles', label: 'Текстил и възглавници', min: 180, max: 520, icon: SwatchBook },
  { id: 'plants', label: 'Растения и кашпи', min: 170, max: 460, icon: Sparkles },
]

export default function DecorativeAccents() {
  const pageRef = useRef(null)

  useEffect(() => {
    window.scrollTo({ top: 0 })
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.decor-animate-in',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.12 },
      )
      gsap.fromTo('.decor-hero-bg', { scale: 1.05 }, { scale: 1, duration: 1.5, ease: 'power2.out' })
    }, pageRef)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={pageRef} className="min-h-screen bg-paper text-ink">
      <Hero />
      <Intro />
      <DecorPlanner />
      <DecorShowcase />
      <DecorExperts />
      <DecorFAQ />
      <DecorCTA />
    </div>
  )
}

function Hero() {
  return (
    <section className="section relative min-h-[72svh] overflow-hidden py-24">
      <div className="absolute inset-0 z-0">
        <img src={DECOR_IMAGES.hero} alt="Декоративни акценти" className="img-cover decor-hero-bg" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/65 to-ink/35" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-paper to-transparent" />
      </div>

      <div className="container-page relative z-10">
        <div className="max-w-3xl text-paper">
          <div className="decor-animate-in inline-flex items-center gap-3 rounded-full border border-paper/20 bg-paper/10 px-4 py-1.5 text-xs font-semibold tracking-[0.16em]">
            <Palette size={14} />
            ФИНАЛНИЯТ ЩРИХ
          </div>
          <h1 className="h-display mt-6 decor-animate-in">
            Декоративни
            <br />
            <span className="italic text-trustPurple">акценти.</span>
          </h1>
          <p className="decor-animate-in mt-6 max-w-2xl text-paper/85 text-lg leading-relaxed">
            Завършваме дома с характер: правилният цвят, картини, текстил, осветление и детайли, които
            правят пространството лично. Точно тук една стая започва да изглежда като твоя.
          </p>
          <div className="decor-animate-in mt-8 flex flex-wrap gap-3">
            <a href="#decor-planner" className="btn btn-primary !bg-trustPurple !text-paper hover:!bg-trustPurple/90">
              Планирай акцентите
            </a>
            <a href="#decor-experts" className="btn btn-ghost !border-paper/25 !bg-paper/10 !text-paper hover:!border-paper/45">
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
    {
      title: 'Ясна визия за стил',
      desc: 'Подреждаме идея, цветове и материали така, че всяко помещение да има собствен ритъм.',
      icon: <Compass className="text-trustPurple" size={22} />,
    },
    {
      title: 'Избор без хаос',
      desc: 'Филтрирани решения за картини, огледала, текстил и осветление от проверени доставчици.',
      icon: <SwatchBook className="text-trustPurple" size={22} />,
    },
    {
      title: 'Бързо изпълнение',
      desc: 'От одобрен moodboard до доставка и монтаж с координация на едно място.',
      icon: <Clock3 className="text-trustPurple" size={22} />,
    },
  ]

  return (
    <section className="section bg-paper">
      <div className="container-page">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="reveal lg:col-span-5">
            <p className="font-display text-3xl italic leading-tight text-accentDeep lg:text-4xl">
              „Стаята е готова, когато всеки детайл разказва една и съща история.“
            </p>
          </div>
          <div className="reveal lg:col-span-7">
            <p className="text-base leading-relaxed text-muted">
              Работим със стъпки, които правят избора лесен: стилова посока, визуална дъска, реални продукти и
              ясен бюджет. Вместо да събираш идеи от 20 места, получаваш работеща композиция за дома и
              външните зони.
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

function DecorPlanner() {
  const [roomId, setRoomId] = useState(ROOMS[0].id)
  const [moodId, setMoodId] = useState(MOODS[0].id)
  const [baseBudget, setBaseBudget] = useState(2200)
  const [selectedFeatureIds, setSelectedFeatureIds] = useState(['wall-art', 'lighting'])

  const selectedRoom = ROOMS.find((room) => room.id === roomId) || ROOMS[0]
  const selectedMood = MOODS.find((mood) => mood.id === moodId) || MOODS[0]

  const estimate = useMemo(() => {
    const extras = FEATURES.filter((feature) => selectedFeatureIds.includes(feature.id))
    const extrasMin = extras.reduce((sum, feature) => sum + feature.min, 0)
    const extrasMax = extras.reduce((sum, feature) => sum + feature.max, 0)
    const rawMin = (baseBudget + selectedRoom.baseMin + extrasMin) * selectedMood.min
    const rawMax = (baseBudget + selectedRoom.baseMax + extrasMax) * selectedMood.max
    return {
      min: Math.round(rawMin),
      max: Math.round(rawMax),
    }
  }, [baseBudget, selectedFeatureIds, selectedMood.max, selectedMood.min, selectedRoom.baseMax, selectedRoom.baseMin])

  const toggleFeature = (featureId) => {
    setSelectedFeatureIds((prev) =>
      prev.includes(featureId) ? prev.filter((id) => id !== featureId) : [...prev, featureId],
    )
  }

  return (
    <section id="decor-planner" className="section border-y border-line bg-soft">
      <div className="container-page">
        <div className="mb-10 max-w-3xl">
          <div className="eyebrow">Интерактивен планировчик</div>
          <h2 className="h-section mt-2">Как изглежда твоят финален щрих?</h2>
          <p className="mt-3 text-muted">
            Избери помещение, стил и елементи. Ще получиш ориентир за бюджет и посока за реална оферта.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
          <div className="card rounded-3xl border border-line bg-paper p-6 shadow-sm lg:col-span-7">
            <div>
              <div className="text-sm font-semibold text-ink">Помещение</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {ROOMS.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setRoomId(room.id)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${
                      room.id === roomId
                        ? 'border-trustPurple bg-trustPurple/10 text-ink'
                        : 'border-line bg-paper text-muted hover:border-muted/40 hover:text-ink'
                    }`}
                  >
                    {room.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-7">
              <div className="text-sm font-semibold text-ink">Стилова посока</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {MOODS.map((mood) => (
                  <button
                    key={mood.id}
                    type="button"
                    onClick={() => setMoodId(mood.id)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                      mood.id === moodId
                        ? 'border-trustPurple bg-trustPurple/10 text-ink'
                        : 'border-line bg-paper text-muted hover:border-muted/40 hover:text-ink'
                    }`}
                  >
                    <div className="font-medium">{mood.label}</div>
                    <div className="mt-0.5 text-xs opacity-80">{mood.palette}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink">Базов бюджет</span>
                <span className="text-sm font-semibold text-trustPurple">
                  {fmtEur(baseBudget).toLocaleString('bg-BG')} € / {baseBudget.toLocaleString('bg-BG')} лв.
                </span>
              </div>
              <input
                type="range"
                min="1200"
                max="7800"
                step="200"
                value={baseBudget}
                onChange={(event) => setBaseBudget(Number(event.target.value))}
                className="w-full cursor-pointer accent-trustPurple"
              />
            </div>

            <div className="mt-7">
              <div className="text-sm font-semibold text-ink">Добави елементи</div>
              <div className="mt-3 grid gap-2">
                {FEATURES.map((feature) => {
                  const active = selectedFeatureIds.includes(feature.id)
                  const Icon = feature.icon
                  return (
                    <button
                      key={feature.id}
                      type="button"
                      onClick={() => toggleFeature(feature.id)}
                      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? 'border-trustPurple bg-trustPurple/10'
                          : 'border-line bg-paper hover:border-muted/40'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`rounded-xl p-2 ${active ? 'bg-trustPurple text-paper' : 'bg-soft text-muted'}`}>
                          <Icon size={17} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-ink">{feature.label}</span>
                          <span className="block text-xs text-muted">
                            {fmtEur(feature.min).toLocaleString('bg-BG')} – {fmtEur(feature.max).toLocaleString('bg-BG')} € &nbsp;·&nbsp; {feature.min.toLocaleString('bg-BG')} – {feature.max.toLocaleString('bg-BG')} лв.
                          </span>
                        </span>
                      </span>
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${active ? 'border-trustPurple bg-trustPurple text-paper' : 'border-line bg-paper text-transparent'}`}>
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
                {fmtEur(estimate.min).toLocaleString('bg-BG')} – {fmtEur(estimate.max).toLocaleString('bg-BG')} €
              </div>
              <div className="mt-1 text-base text-paper/55">
                {estimate.min.toLocaleString('bg-BG')} – {estimate.max.toLocaleString('bg-BG')} лв.
              </div>
              <p className="mt-3 text-sm text-paper/75">
                За {selectedRoom.label.toLowerCase()} в стил „{selectedMood.label.toLowerCase()}“ с избраните елементи.
              </p>

              <div className="my-6 h-px bg-paper/15" />

              <ul className="space-y-2 text-sm text-paper/85">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-trustPurple" />
                  Включен подбор на продукти и доставчици.
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-trustPurple" />
                  Ясни етапи за доставка и монтаж.
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-trustPurple" />
                  Финален стилен чек на място.
                </li>
              </ul>

              <p className="mt-5 text-center text-xs text-paper/35">
                1 € = 1.95583 лв. · официален фиксиран курс
              </p>

              <Link to="/contact" className="btn btn-primary mt-4 w-full justify-center !bg-trustPurple !text-paper hover:!bg-trustPurple/90">
                Поискай точна оферта
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}

function DecorShowcase() {
  const [activeTab, setActiveTab] = useState(0)

  const items = [
    {
      title: 'Галерия от картини в дневна',
      location: 'София, Лозенец',
      desc: 'Акцентна композиция от рамки, текстил в два тона и лампа с мека температура за вечерна атмосфера.',
      img: SHOWCASE_IMAGES.dekoraciya[0] || DECOR_IMAGES.wallpaper,
    },
    {
      title: 'Тераса за вечерни срещи',
      location: 'Варна, Бриз',
      desc: 'Комбинация от кашпи, външно осветление и lounge мебели с устойчив текстил.',
      img: SHOWCASE_IMAGES.dekoraciya[1] || DECOR_IMAGES.terrace,
    },
    {
      title: 'Антре с огледала и светлина',
      location: 'Пловдив, Капана',
      desc: 'Огледален ритъм и декоративни аплици, които отварят визуално пространството и пазят чиста линия.',
      img: SHOWCASE_IMAGES.dekoraciya[2] || DECOR_IMAGES.decor,
    },
  ]

  return (
    <section className="section bg-paper">
      <div className="container-page">
        <div className="text-center">
          <div className="eyebrow">Реални проекти</div>
          <h2 className="h-section mt-2">Как изглежда завършеният ефект</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">
            От първа идея до финален styling ден. Ето три различни посоки, които работят в реални домове.
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
                  ? 'bg-trustPurple text-paper'
                  : 'bg-paper text-muted hover:bg-soft hover:text-ink'
              }`}
            >
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
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-trustPurple">{items[activeTab].location}</div>
              <h3 className="mt-2 font-display text-3xl text-ink">{items[activeTab].title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-muted">{items[activeTab].desc}</p>
            </div>
            <Link to="/contact" className="link-arrow mt-6 inline-flex !border-trustPurple !text-trustPurple hover:!border-ink hover:!text-ink">
              Искам подобна визия
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function DecorExperts() {
  const experts = [
    {
      name: 'Мария Николова',
      role: 'Интериорен декоратор',
      region: 'София и Перник',
      rating: '4.96',
      reviews: '36 отзива',
      avatar: DECOR_IMAGES.profile1,
    },
    {
      name: 'Studio Layer 05',
      role: 'Wall styling и текстил',
      region: 'Пловдив и Стара Загора',
      rating: '4.89',
      reviews: '42 отзива',
      avatar: DECOR_IMAGES.profile2,
    },
    {
      name: 'Георги Тодоров',
      role: 'Осветление и атмосфера',
      region: 'Варна и Бургас',
      rating: '4.91',
      reviews: '27 отзива',
      avatar: DECOR_IMAGES.profile3,
    },
  ]

  return (
    <section id="decor-experts" className="section border-y border-line bg-soft">
      <div className="container-page">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Препоръчани профили</div>
            <h2 className="h-section mt-2">Експерти по декоративен финал</h2>
          </div>
          <Link to="/katalog" className="link-arrow !border-trustPurple !text-trustPurple hover:!border-ink hover:!text-ink">
            Виж всички в каталога
          </Link>
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
                <span>
                  ★ {expert.rating} • {expert.reviews}
                </span>
                <span>{expert.region}</span>
              </div>
              <Link to="/contact" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-trustPurple hover:text-ink">
                Свържи се <ArrowRight size={14} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function DecorFAQItem({ question, answer }) {
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
        <span className={`text-3xl text-trustPurple transition-transform ${isOpen ? 'rotate-45' : ''}`}>+</span>
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

function DecorFAQ() {
  const items = [
    {
      q: 'Мога ли да направя само декоративен пакет без ремонт?',
      a: 'Да. Работим и по завършени жилища: оценка на пространството, подбор на елементи, доставка и подреждане.',
    },
    {
      q: 'Колко време отнема един проект за финален стил?',
      a: 'Обикновено между 7 и 21 дни според наличностите и броя помещения. Получаваш график още в началото.',
    },
    {
      q: 'Работите ли с мой бюджет и вече купени мебели?',
      a: 'Разбира се. Интегрираме наличните мебели и насочваме бюджета към елементи, които носят най-голяма промяна.',
    },
    {
      q: 'Има ли опция за тераса и външна зона в същия проект?',
      a: 'Да. Можем да комбинираме интериорни акценти с тераса, осветление и сезонни растения в един общ план.',
    },
  ]

  return (
    <section className="section bg-paper">
      <div className="container-page max-w-4xl">
        <div className="text-center">
          <div className="eyebrow">Често задавани въпроси</div>
          <h2 className="h-section mt-2">За декоративните акценти</h2>
        </div>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {items.map((item) => (
            <DecorFAQItem key={item.q} question={item.q} answer={item.a} />
          ))}
        </div>
      </div>
    </section>
  )
}

function DecorCTA() {
  return (
    <section className="section !pt-0">
      <div className="container-page rounded-3xl bg-gradient-to-br from-ink via-graphite to-ink p-10 text-paper shadow-xl md:grid md:grid-cols-12 md:items-center md:gap-8 md:p-14">
        <div className="md:col-span-8">
          <h2 className="h-section text-paper">Готов ли си за финалната визия на дома?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-paper/75">
            Изпрати ни снимки и кратко описание. До 48 часа ще получиш конкретна посока, етапи и хора за изпълнение.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3 md:col-span-4 md:mt-0 md:justify-end">
          <Link to="/contact" className="btn btn-primary !bg-trustPurple !text-paper hover:!bg-trustPurple/90">
            Заяви консултация
          </Link>
        </div>
      </div>
    </section>
  )
}
