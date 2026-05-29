import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { 
  Sprout, 
  Droplet, 
  Sun, 
  Flame, 
  Sparkles, 
  Check, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  Compass, 
  Trees 
} from 'lucide-react'
import { gsap } from 'gsap'

// Unsplash image helpers
const U = (id, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=${w}`

export default function GardenAndYard() {
  const pageRef = useRef(null)

  // GSAP animations on page load
  useEffect(() => {
    window.scrollTo({ top: 0 })
    const ctx = gsap.context(() => {
      gsap.fromTo('.garden-animate-fade',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.15 }
      )
      gsap.fromTo('.garden-hero-bg',
        { scale: 1.05 },
        { scale: 1, duration: 1.5, ease: 'power2.out' }
      )
    }, pageRef)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={pageRef} className="min-h-screen bg-paper text-ink">
      <Hero />
      <Intro />
      <GardenBudgetCalculator />
      <GardenShowcase />
      <LandscapeExperts />
      <GardenFAQ />
      <GardenCTA />
    </div>
  )
}

function Hero() {
  return (
    <section className="section relative min-h-[75svh] flex items-center overflow-hidden py-24">
      <div className="absolute inset-0 z-0">
        <img 
          src={U('1416879595882-3373a0480b5b', 1800)} 
          alt="Градина и двор" 
          className="img-cover garden-hero-bg"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/65 to-transparent z-10" />
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-paper to-transparent z-10" />
      </div>

      <div className="container-page relative z-20 w-full">
        <div className="max-w-3xl text-paper">
          <div className="flex items-center gap-3 mb-6 garden-animate-fade">
            <span className="font-mono text-xs px-3 py-1 bg-trustGreen text-paper rounded-full font-bold">
              ВЪНШНИ ПРОСТРАНСТВА
            </span>
            <div className="h-px w-12 bg-paper/20" />
            <span className="eyebrow !text-paper/70">СВЕТЪТ НА ОТКРИТО</span>
          </div>

          <h1 className="h-display font-display text-5xl lg:text-7xl leading-none garden-animate-fade">
            Градина <br />
            <span className="text-trustGreen italic">&amp; Двор.</span>
          </h1>

          <p className="mt-6 text-paper/85 text-lg leading-relaxed max-w-xl garden-animate-fade">
            Твоят външен оазис — създаден от идея до последното растение. Ландшафтен дизайн, умна автоматизация, перголи, настилки и вечнозелени кътчета на едно място.
          </p>

          <div className="mt-8 flex flex-wrap gap-4 garden-animate-fade">
            <a href="#calculator" className="btn btn-primary !bg-trustGreen !text-paper hover:!bg-trustGreen/90 shadow-md">
              Изчисли бюджет
            </a>
            <a href="#experts" className="btn btn-ghost !border-paper/20 !bg-paper/10 !text-paper hover:!border-paper/40">
              Виж ландшафтни архитекти
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function Intro() {
  const steps = [
    { title: 'Биофилен дизайн', desc: 'Хармония с природата, подбор на местна растителност, която изисква минимални грижи.', icon: <Trees className="text-trustGreen" size={24} /> },
    { title: 'Умна автоматизация', desc: 'Поливни системи и сензорно осветление, които контролираш директно от мобилния си телефон.', icon: <Droplet className="text-trustGreen" size={24} /> },
    { title: 'Зони за релакс', desc: 'Проектиране на перголи, дървени декинги, барбекю кътове и огнища за споделени вечери.', icon: <Sun className="text-trustGreen" size={24} /> }
  ]

  return (
    <section className="section bg-paper">
      <div className="container-page">
        <div className="grid lg:grid-cols-12 gap-12 items-center mb-16">
          <div className="lg:col-span-5 reveal">
            <p className="font-display italic text-accentDeep text-3xl lg:text-4xl leading-tight">
              „Къщата не спира до прага на вратата. Външното пространство е естественото продължение на дома.“
            </p>
          </div>
          <div className="lg:col-span-7 reveal">
            <p className="text-muted leading-relaxed text-base">
              Често дворът остава на заден план след ремонт на интериора. В Totsan съчетаваме ландшафтните архитекти с най-добрите изпълнители на автоматизирани системи, настилки и перголи. Ние подреждаме целия процес стъпка по стъпка, гарантирайки бърз и безпроблемен резултат.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="reveal p-6 bg-soft/50 rounded-2xl border border-line flex gap-4">
              <div className="p-3 bg-paper rounded-xl border border-line h-fit shrink-0">
                {s.icon}
              </div>
              <div>
                <h3 className="font-display text-xl text-ink font-semibold">{s.title}</h3>
                <p className="text-muted text-sm mt-2 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Interactive Garden Budget Calculator ──────────────────────────────────────
function GardenBudgetCalculator() {
  const [size, setSize] = useState(100) // Default 100 m2
  const [selectedFeatures, setSelectedFeatures] = useState({
    irrigation: true,
    deck: false,
    turf: true,
    smartLight: false,
    pathway: false,
    firepit: false
  })

  const FEATURES_CONFIG = [
    { id: 'irrigation', name: 'Автоматизирана поливна система', desc: 'Умни разпръсквачи, капково напояване и датчик за дъжд.', baseCost: 1600, icon: <Droplet size={18} /> },
    { id: 'deck', name: 'Пергола с дървен декинг', desc: 'Зона за хранене на открито с масивна конструкция.', baseCost: 4500, icon: <Sun size={18} /> },
    { id: 'turf', name: 'Полагане на тревен чим', desc: 'Незабавен гъст зелен килим (изчислява се според площта).', costPerM2: 12, icon: <Sprout size={18} /> },
    { id: 'smartLight', name: 'Интелигентно градинско осветление', desc: 'LED лампи за алеи, акценти върху дървета и автоматичен таймер.', baseCost: 1100, icon: <Sparkles size={18} /> },
    { id: 'pathway', name: 'Каменни пътеки и алеи', desc: 'Издръжливи плочи от естествен камък с пясъчна основа.', baseCost: 1900, icon: <Compass size={18} /> },
    { id: 'firepit', name: 'Барбекю зона с огнище', desc: 'Изградено огнище от огнеупорни тухли и каменна облицовка.', baseCost: 3200, icon: <Flame size={18} /> }
  ]

  const handleToggle = (id) => {
    setSelectedFeatures(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Calculate prices dynamically
  const calculateTotal = () => {
    let minCost = 500 // Base landscaper fee
    let maxCost = 800

    // Size impact
    minCost += size * 10
    maxCost += size * 15

    FEATURES_CONFIG.forEach(f => {
      if (selectedFeatures[f.id]) {
        if (f.baseCost) {
          minCost += f.baseCost
          maxCost += f.baseCost * 1.25
        }
        if (f.costPerM2) {
          minCost += size * f.costPerM2
          maxCost += size * f.costPerM2 * 1.3
        }
      }
    })

    return {
      min: Math.round(minCost),
      max: Math.round(maxCost)
    }
  }

  const totals = calculateTotal()

  return (
    <section id="calculator" className="section bg-soft border-y border-line">
      <div className="container-page">
        <div className="max-w-3xl mb-12">
          <div className="eyebrow">Бюджетен планиращ инструмент</div>
          <h2 className="h-section mt-2">Колко би струвала твоята градина?</h2>
          <p className="mt-3 text-muted">
            Настрой размера на двора си и избери какви екстри желаеш. Нашата интелигентна система ще изчисли примерен ценови диапазон за материали и монтаж.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Controls Left */}
          <div className="lg:col-span-7 card p-6 bg-paper border border-line rounded-3xl shadow-md">
            {/* Size Slider */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <span className="font-display text-lg text-ink font-semibold">Размер на двора:</span>
                <span className="text-xl text-trustGreen font-bold font-mono">{size} м²</span>
              </div>
              <input 
                type="range" 
                min="30" 
                max="500" 
                step="10" 
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full h-2 bg-soft rounded-lg appearance-none cursor-pointer accent-trustGreen"
              />
              <div className="flex justify-between text-xs text-muted mt-2">
                <span>30 м² (Малък кът)</span>
                <span>500 м² (Голям парцел)</span>
              </div>
            </div>

            {/* Feature Checkbox Grid */}
            <div>
              <span className="font-display text-lg text-ink font-semibold block mb-4">Избери елементи на градината:</span>
              <div className="space-y-3">
                {FEATURES_CONFIG.map(f => {
                  const active = selectedFeatures[f.id]
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleToggle(f.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-4 ${
                        active 
                          ? 'border-trustGreen bg-trustGreen/5 shadow-sm' 
                          : 'border-line hover:border-muted/30 bg-paper'
                      }`}>
                      <div className="flex gap-3 items-start">
                        <span className={`p-2 rounded-xl mt-0.5 ${
                          active ? 'bg-trustGreen text-paper' : 'bg-soft text-muted'
                        }`}>
                          {f.icon}
                        </span>
                        <div>
                          <div className="font-display text-base text-ink font-semibold leading-tight">{f.name}</div>
                          <p className="text-xs text-muted mt-1 leading-normal">{f.desc}</p>
                        </div>
                      </div>
                      <div className={`shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                        active ? 'bg-trustGreen border-trustGreen text-paper' : 'border-line bg-paper'
                      }`}>
                        {active && <Check size={14} strokeWidth={3} />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Results Summary Right */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="card p-8 bg-gradient-to-br from-ink to-graphite text-paper border-0 shadow-lg rounded-3xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-trustGreen/20 rounded-full blur-[70px] pointer-events-none" />
              
              <div className="relative z-10 text-center">
                <div className="text-xs uppercase tracking-wider text-accentSoft font-bold">ОРИЕНТИРОВЪЧЕН БЮДЖЕТ</div>
                
                <div className="font-display text-4xl lg:text-5xl font-bold mt-4 tracking-tight">
                  {totals.min.toLocaleString('bg-BG')} - {totals.max.toLocaleString('bg-BG')} лв.
                </div>
                
                <p className="text-paper/70 text-xs mt-3 leading-relaxed max-w-sm mx-auto">
                  *Диапазонът е базиран на средните пазарни цени на материали и труд в България за 2026 г. Включва проектиране, доставка и полагане.
                </p>

                <div className="h-px bg-paper/10 my-6" />

                <div className="text-left space-y-3">
                  <div className="flex justify-between text-xs text-paper/85">
                    <span>Базово оформяне &amp; труд:</span>
                    <span className="font-mono">включено</span>
                  </div>
                  <div className="flex justify-between text-xs text-paper/85">
                    <span>Подготовка на почвата (фрезоване):</span>
                    <span className="font-mono">включено</span>
                  </div>
                  {FEATURES_CONFIG.map(f => {
                    if (!selectedFeatures[f.id]) return null
                    return (
                      <div key={f.id} className="flex justify-between text-xs text-paper/80">
                        <span className="truncate max-w-[16rem]">{f.name}:</span>
                        <span className="font-mono text-accentSoft">добавено</span>
                      </div>
                    )
                  })}
                </div>

                <div className="h-px bg-paper/10 my-6" />

                <Link 
                  to="/contact" 
                  className="btn btn-primary !bg-trustGreen !text-paper hover:!bg-trustGreen/90 w-full justify-center">
                  Поискай точна оферта →
                </Link>
              </div>
            </div>

            {/* Quick recommendation */}
            <div className="card p-6 bg-paper border border-line rounded-2xl flex gap-3 items-start shadow-sm">
              <span className="p-2 bg-trustGreen/10 text-trustGreen rounded-xl shrink-0 mt-0.5">
                <CheckCircle2 size={18} />
              </span>
              <div>
                <div className="text-sm font-semibold text-ink">Безплатен първи оглед</div>
                <p className="text-xs text-muted mt-1 leading-normal">
                  Свържи се с Totsan днес и нашият ландшафтен архитект ще направи оглед на терена напълно безплатно в рамките на София и Пловдив.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Showcase Gallery ──────────────────────────────────────────────────────────
function GardenShowcase() {
  const [activeTab, setActiveTab] = useState(0)

  const ITEMS = [
    {
      title: 'Модерна пергола с декинг',
      location: 'Пловдив, Нов двор',
      desc: 'Цялостно изграждане на дървена конструкция с автоматизирана покривна тента върху декинг от термобор. Инсталирано е интелигентно LED осветление с топла светлина.',
      img: U('1505843513577-22bb7d21e455', 900)
    },
    {
      title: 'Зелен семеен оазис',
      location: 'София, кв. Драгалевци',
      desc: 'Преобразяване на занемарен терен. Изравняване на почвата, полагане на бързорастящ тревен чим и засаждане на вечнозелени туи покрай оградата. Монтирана е капкова поливна система.',
      img: U('1416879595882-3373a0480b5b', 900)
    },
    {
      title: 'Уютен градски балкон',
      location: 'Варна, Тераса апартамент',
      desc: 'Миниатюрен зелен дизайн за апартамент. Кашпи от терацо с бамбук за защита от вятър и интимност, допълнени от декоративни лампи и градински столове за следобедно кафе.',
      img: U('1485955900006-10f4d324d411', 900)
    }
  ]

  return (
    <section className="section bg-paper">
      <div className="container-page">
        <div className="text-center mb-10">
          <div className="eyebrow">Галерия проекти</div>
          <h2 className="h-section mt-2">Реализирани външни пространства</h2>
          <p className="text-muted mt-3 max-w-2xl mx-auto">
            Виж как сме преобразили различни дворове и тераси в България. Всеки проект е съобразен с изложението на терена и изискванията за поддръжка.
          </p>
        </div>

        {/* Tab Headers */}
        <div className="flex justify-center gap-2 mb-8 border-b border-line pb-3 overflow-x-auto whitespace-nowrap">
          {ITEMS.map((item, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`px-4 py-2 text-sm rounded-full transition-all ${
                index === activeTab 
                  ? 'bg-trustGreen text-paper font-semibold shadow-sm' 
                  : 'hover:bg-soft text-muted hover:text-ink'
              }`}>
              {item.title}
            </button>
          ))}
        </div>

        {/* Tab Content Display */}
        <div className="card bg-paper border border-line rounded-3xl overflow-hidden shadow-sm grid md:grid-cols-12 items-stretch min-h-[22rem]">
          <div className="md:col-span-7 relative h-72 md:h-auto">
            <img 
              src={ITEMS[activeTab].img} 
              alt={ITEMS[activeTab].title} 
              className="absolute inset-0 w-full h-full object-cover transition-all duration-500" 
            />
          </div>
          <div className="md:col-span-5 p-8 flex flex-col justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-trustGreen font-bold font-mono">
                {ITEMS[activeTab].location}
              </div>
              <h3 className="font-display text-2xl text-ink font-bold mt-2">
                {ITEMS[activeTab].title}
              </h3>
              <p className="text-muted text-sm mt-4 leading-relaxed">
                {ITEMS[activeTab].desc}
              </p>
            </div>
            
            <Link 
              to="/contact" 
              className="link-arrow text-sm self-start mt-6 !text-trustGreen !border-trustGreen hover:!text-ink hover:!border-ink">
              Искам подобен дизайн →
            </Link>
          </div>
        </div>

      </div>
    </section>
  )
}

// ── Experts Directory ──────────────────────────────────────────────────────────
function LandscapeExperts() {
  const EXPERTS = [
    {
      name: 'арх. Велислава Колева',
      role: 'Ландшафтен архитект',
      rating: '4.95',
      reviews: '28 отзива',
      location: 'София и областта',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      name: 'Студио „Зелен Кът“',
      role: 'Озеленяване & Системи',
      rating: '4.88',
      reviews: '41 отзива',
      location: 'Пловдив и Пазарджик',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      name: 'Димитър Иванов',
      role: 'Инженер поливни системи',
      rating: '4.90',
      reviews: '19 отзива',
      location: 'Варна и Бургас',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400&h=400'
    }
  ]

  return (
    <section id="experts" className="section bg-soft border-y border-line">
      <div className="container-page">
        <div className="flex justify-between items-end mb-10 flex-wrap gap-4">
          <div>
            <div className="eyebrow">Доверени партньори</div>
            <h2 className="h-section mt-2">Специалисти по Ландшафт</h2>
          </div>
          <Link to="/katalog" className="link-arrow text-sm !text-trustGreen !border-trustGreen hover:!text-ink hover:!border-ink">
            Виж всички в каталога →
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {EXPERTS.map((ex, i) => (
            <div key={i} className="card p-6 bg-paper border border-line rounded-2xl flex flex-col justify-between shadow-sm">
              <div className="flex gap-4 items-center">
                <img 
                  src={ex.avatar} 
                  alt={ex.name} 
                  className="w-16 h-16 rounded-full object-cover border border-line" 
                />
                <div>
                  <h3 className="font-display text-lg text-ink font-semibold">{ex.name}</h3>
                  <div className="text-xs text-muted font-medium mt-0.5">{ex.role}</div>
                  <div className="flex items-center gap-1.5 text-xs text-trustGreen mt-1">
                    <span>★ {ex.rating}</span>
                    <span className="text-muted">• {ex.reviews}</span>
                  </div>
                </div>
              </div>

              <div className="h-px bg-line my-4" />

              <div className="flex items-center justify-between text-xs text-muted">
                <span>Регион: <b>{ex.location}</b></span>
                <Link 
                  to="/contact" 
                  className="text-trustGreen font-bold hover:text-ink transition flex items-center gap-0.5">
                  Свържи се &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function GardenFAQItem({ question, answer }) {
  const [isOpen, setIsOpen] = useState(false)
  const contentRef = useRef(null)

  return (
    <div className="border-b border-line py-5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left flex items-center justify-between gap-4 font-display text-xl py-2 focus:outline-none transition-colors hover:text-trustGreen font-bold"
        aria-expanded={isOpen}
      >
        <span>{question}</span>
        <span className={`text-trustGreen text-3xl font-mono transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}>
          +
        </span>
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: isOpen ? `${contentRef.current?.scrollHeight}px` : '0px' }}
      >
        <p className="text-muted pt-3 pb-1 text-sm leading-relaxed max-w-3xl">
          {answer}
        </p>
      </div>
    </div>
  )
}

// ── FAQ ──────────────────────────────────────────────────────────────────────
function GardenFAQ() {
  const FAQ_ITEMS = [
    {
      q: 'Кога е най-подходящото време за засяване или озеленяване?',
      a: 'Пролетта (март-май) и есента (септември-ноември) са най-подходящите периоди за засаждане на растителност и полагане на тревни чимове поради по-меките температури и честите дъждове, които спомагат за по-доброто вкореняване.'
    },
    {
      q: 'Колко често се полива нова градина?',
      a: 'През първите 2-3 седмици след засаждането новата градина трябва да се полива ежедневно (сутрин или вечер). След като чимовете и храстите се вкоренят успешно, поливането може да бъде намалено до 2-3 пъти седмично, но с по-голямо количество вода.'
    },
    {
      q: 'Каква е разликата между тревна смеска и тревен чим?',
      a: 'Тревната смеска е по-евтина, но изисква месеци редовни грижи, плевене и поливане преди да израсне. Тревният чим дава готов зелен ефект веднага при полагане и е по-устойчив на износване от самото начало.'
    },
    {
      q: 'Предлагате ли поддръжка след завършване на проекта?',
      a: 'Да. През Totsan можете да намерите специалисти за абонаментна поддръжка, включваща косене на трева, плевене, торене, подрязване на жив плет и зазимяване/пролетно отваряне на поливната система.'
    }
  ]

  return (
    <section className="section bg-paper">
      <div className="container-page max-w-4xl">
        <div className="eyebrow text-center">Често задавани въпроси</div>
        <h2 className="h-section text-center mt-2">Всичко за градинския проект</h2>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {FAQ_ITEMS.map((item, i) => (
            <GardenFAQItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>
      </div>
    </section>
  )
}

function GardenCTA() {
  return (
    <section className="section bg-paper !pt-0">
      <div className="container-page rounded-3xl bg-gradient-to-br from-ink via-graphite to-ink text-paper p-10 md:p-16 grid md:grid-cols-12 gap-8 items-center relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-trustGreen/15 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="md:col-span-8 relative z-10">
          <h2 className="h-section text-paper font-display">Твоят мечтан двор е на един разказ разстояние</h2>
          <p className="mt-3 text-paper/70 max-w-2xl leading-relaxed text-sm">
            Сподели ни как изглежда твоята идеална градина или тераса. Нашите специалисти ще превърнат концепцията ти в реалност — от почвените изследвания до последната пергола.
          </p>
        </div>
        
        <div className="md:col-span-4 flex md:justify-end gap-3 flex-wrap relative z-10">
          <Link 
            to="/contact" 
            className="btn btn-primary !bg-trustGreen !text-paper hover:!bg-trustGreen/90 shadow-md">
            Консултирай се безплатно
          </Link>
        </div>
      </div>
    </section>
  )
}
