import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { 
  Palette, 
  Paintbrush, 
  Layers, 
  Sparkles, 
  Check, 
  CheckCircle2, 
  Image as ImageIcon 
} from 'lucide-react'
import { gsap } from 'gsap'

// Unsplash image helpers
const U = (id, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=${w}`

// Официален фиксиран курс: 1 EUR = 1.95583 лв.
const EUR_RATE = 1.95583
const fmtEur = (lv) => Math.round(lv / EUR_RATE)

export default function WallpapersAndColors() {
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
      <WallBudgetCalculator />
      <Showcase />
      <Experts />
      <WallFAQ />
      <CTA />
    </div>
  )
}

function Hero() {
  return (
    <section className="section relative min-h-[75svh] flex items-center overflow-hidden py-24">
      <div className="absolute inset-0 z-0">
        <img 
          src={U('1558882224-dda166733046', 1800)} 
          alt="Тапети и цветове" 
          className="img-cover garden-hero-bg"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/65 to-transparent z-10" />
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-paper to-transparent z-10" />
      </div>

      <div className="container-page relative z-20 w-full">
        <div className="max-w-3xl text-paper">
          <div className="flex items-center gap-3 mb-6 garden-animate-fade">
            <span className="font-mono text-xs px-3 py-1 bg-accent text-paper rounded-full font-bold">
              ВЪТРЕШНИ ПРОСТРАНСТВА
            </span>
            <div className="h-px w-12 bg-paper/20" />
            <span className="eyebrow !text-white/70">ХАРАКТЕР НА СТЕНИТЕ</span>
          </div>

          <h1 className="h-display font-display text-5xl lg:text-7xl leading-none garden-animate-fade">
            Тапети <br />
            <span className="text-accent italic">&amp; Цветове.</span>
          </h1>

          <p className="mt-6 text-white/80 text-lg leading-relaxed max-w-xl garden-animate-fade">
            Пространството придобива душа чрез правилните цветове и текстури. Разгледай премиум тапети, декоративни мазилки и интериорни бои, които преобразяват всяка стая.
          </p>

          <div className="mt-8 flex flex-wrap gap-4 garden-animate-fade">
            <a href="#calculator" className="btn btn-primary !bg-accent !text-paper hover:!bg-accent/90 shadow-md">
              Изчисли бюджет
            </a>
            <a href="#experts" className="btn btn-ghost !border-paper/20 !bg-paper/10 !text-paper hover:!border-paper/40">
              Виж декоратори
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function Intro() {
  const steps = [
    { title: 'Цветова хармония', desc: 'Експертен подбор на тонове, които оптически разширяват и освежават помещенията.', icon: <Palette className="text-accent" size={24} /> },
    { title: 'Премиум тапети', desc: 'Богато разнообразие от текстури, флорални мотиви и геометрични шарки за акцентни стени.', icon: <ImageIcon className="text-accent" size={24} /> },
    { title: 'Декоративни мазилки', desc: 'Венецианска мазилка, травертино и други ефекти, добавящи дълбочина и лукс.', icon: <Layers className="text-accent" size={24} /> }
  ]

  return (
    <section className="section bg-paper">
      <div className="container-page">
        <div className="grid lg:grid-cols-12 gap-12 items-center mb-16">
          <div className="lg:col-span-5 reveal">
            <p className="font-display italic text-accentDeep text-3xl lg:text-4xl leading-tight">
              „Цветът е клавишът, окото е чукчето, а душата е пианото с много струни.“
            </p>
          </div>
          <div className="lg:col-span-7 reveal">
            <p className="text-muted leading-relaxed text-base">
              Стените са платното на вашия дом. Изборът между тапет, боя или мазилка не е само естетически, но и функционален. В Totsan ви свързваме с топ декоратори и доставчици на материали, за да направите най-добрия избор за вашия интериор.
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

// ── Interactive Budget Calculator ──────────────────────────────────────
function WallBudgetCalculator() {
  const [size, setSize] = useState(50) // Default 50 m2 wall area
  const [selectedFeatures, setSelectedFeatures] = useState({
    paint: true,
    wallpaper: false,
    plaster: false,
    prep: true,
    primer: true
  })

  const FEATURES_CONFIG = [
    { id: 'paint', name: 'Боядисване с интериорна боя', desc: 'Висококачествен латекс (2 ръце).', costPerM2: 7, icon: <Paintbrush size={18} /> },
    { id: 'wallpaper', name: 'Полагане на тапети', desc: 'Премиум флис или винилови тапети за акцентна стена.', costPerM2: 25, icon: <ImageIcon size={18} /> },
    { id: 'plaster', name: 'Декоративна мазилка', desc: 'Италианска мазилка (Оточенто, Стуко).', costPerM2: 55, icon: <Layers size={18} /> },
    { id: 'prep', name: 'Подготовка (шпакловка)', desc: 'Фина шпакловка за идеално гладка основа.', costPerM2: 12, icon: <Check size={18} /> },
    { id: 'primer', name: 'Грундиране', desc: 'Дълбокопроникващ грунд преди боя/тапети.', costPerM2: 3, icon: <Sparkles size={18} /> }
  ]

  const handleToggle = (id) => {
    setSelectedFeatures(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Calculate prices dynamically
  const calculateTotal = () => {
    let minCost = 150 // Base fee
    let maxCost = 250

    FEATURES_CONFIG.forEach(f => {
      if (selectedFeatures[f.id]) {
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
          <h2 className="h-section mt-2">Колко би струвало освежаването?</h2>
          <p className="mt-3 text-muted">
            Настрой квадратурата на стените и избери желаните услуги. Системата ще изчисли примерен ценови диапазон за труд и базови материали.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Controls Left */}
          <div className="lg:col-span-7 card p-6 bg-paper border border-line rounded-3xl shadow-md">
            {/* Size Slider */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <span className="font-display text-lg text-ink font-semibold">Площ на стените:</span>
                <span className="text-xl text-accent font-bold font-mono">{size} м²</span>
              </div>
              <input 
                type="range" 
                min="10" 
                max="300" 
                step="5" 
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full h-2 bg-soft rounded-lg appearance-none cursor-pointer accent-accent"
              />
              <div className="flex justify-between text-xs text-muted mt-2">
                <span>10 м² (Една стена)</span>
                <span>300 м² (Цяло жилище)</span>
              </div>
            </div>

            {/* Feature Checkbox Grid */}
            <div>
              <span className="font-display text-lg text-ink font-semibold block mb-4">Избери обработки:</span>
              <div className="space-y-3">
                {FEATURES_CONFIG.map(f => {
                  const active = selectedFeatures[f.id]
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleToggle(f.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-4 ${
                        active 
                          ? 'border-accent bg-accent/5 shadow-sm' 
                          : 'border-line hover:border-muted/30 bg-paper'
                      }`}>
                      <div className="flex gap-3 items-start">
                        <span className={`p-2 rounded-xl mt-0.5 ${
                          active ? 'bg-accent text-paper' : 'bg-soft text-muted'
                        }`}>
                          {f.icon}
                        </span>
                        <div>
                          <div className="font-display text-base text-ink font-semibold leading-tight">{f.name}</div>
                          <p className="text-xs text-muted mt-1 leading-normal">{f.desc}</p>
                        </div>
                      </div>
                      <div className={`shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                        active ? 'bg-accent border-accent text-paper' : 'border-line bg-paper'
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
            <div className="card p-8 border-0 shadow-lg rounded-3xl relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0D2340 0%, #163250 100%)', color: '#F8FBFF' }}>
              <div className="absolute top-0 right-0 w-48 h-48 bg-accent/20 rounded-full blur-[70px] pointer-events-none" />
              
              <div className="relative z-10 text-center">
                <div className="text-xs uppercase tracking-wider text-accentSoft font-bold">ОРИЕНТИРОВЪЧЕН БЮДЖЕТ</div>
                
                <div className="font-display text-4xl lg:text-5xl font-bold mt-4 tracking-tight">
                  {fmtEur(totals.min).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} – {fmtEur(totals.max).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}€
                </div>
                <div className="text-lg text-white/55 mt-1">
                  ({totals.min.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} – {totals.max.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} лв.)
                </div>
                
                <p className="text-white/70 text-xs mt-3 leading-relaxed max-w-sm mx-auto">
                  *Диапазонът включва труд и материали от среден клас. За ексклузивни тапети и бои цената може да варира.
                </p>

                <div className="h-px bg-paper/10 my-6" />

                <div className="text-left space-y-3">
                  <div className="flex justify-between text-xs text-white/80">
                    <span>Оглед и консултация:</span>
                    <span className="font-mono">включено</span>
                  </div>
                  {FEATURES_CONFIG.map(f => {
                    if (!selectedFeatures[f.id]) return null
                    return (
                      <div key={f.id} className="flex justify-between text-xs text-white/80">
                        <span className="truncate max-w-[16rem]">{f.name}:</span>
                        <span className="font-mono text-accentSoft">добавено</span>
                      </div>
                    )
                  })}
                </div>

                <div className="h-px bg-paper/10 my-6" />

                <p className="text-center text-xs text-white/35 mb-4">
                  1 € = 1.95583 лв. · официален фиксиран курс
                </p>

                <Link 
                  to="/contact" 
                  className="btn btn-primary !bg-accent !text-paper hover:!bg-accent/90 w-full justify-center">
                  Поискай точна оферта →
                </Link>
              </div>
            </div>

            {/* Quick recommendation */}
            <div className="card p-6 bg-paper border border-line rounded-2xl flex gap-3 items-start shadow-sm">
              <span className="p-2 bg-accent/10 text-accent rounded-xl shrink-0 mt-0.5">
                <CheckCircle2 size={18} />
              </span>
              <div>
                <div className="text-sm font-semibold text-ink">Мостри на място</div>
                <p className="text-xs text-muted mt-1 leading-normal">
                  Нашите специалисти могат да донесат каталози с тапети и цветови ветрила директно във вашия дом за точен избор спрямо светлината.
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
function Showcase() {
  const [activeTab, setActiveTab] = useState(0)

  const ITEMS = [
    {
      title: 'Дълбоко синьо за акцент',
      location: 'София, Център',
      desc: 'Използвана е боя Farrow & Ball в нюанс Hague Blue за създаване на драматичен акцент в дневната, перфектно комбиниран с месингови елементи.',
      img: U('1562259949-e8e7689d7828', 900)
    },
    {
      title: 'Флорален рай в спалнята',
      location: 'Пловдив, Кършияка',
      desc: 'Премиум тапети Cole & Son от серията Palm Jungle превръщат главната стена в спалнята в истинско произведение на изкуството.',
      img: U('1558882224-dda166733046', 900)
    },
    {
      title: 'Венецианска мазилка',
      location: 'Варна, Чайка',
      desc: 'Луксозна декоративна мазилка с перлен ефект, отразяваща светлината и придаваща неповторим уют на коридора и дневната.',
      img: U('1505691938895-1758d7feb511', 900)
    }
  ]

  return (
    <section className="section bg-paper">
      <div className="container-page">
        <div className="text-center mb-10">
          <div className="eyebrow">Галерия проекти</div>
          <h2 className="h-section mt-2">Цветове, които говорят</h2>
          <p className="text-muted mt-3 max-w-2xl mx-auto">
            Виж как различните текстури и нюанси могат напълно да трансформират усещането за едно помещение.
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
                  ? 'bg-accent text-paper font-semibold shadow-sm' 
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
              <div className="text-xs uppercase tracking-wider text-accent font-bold font-mono">
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
              className="link-arrow text-sm self-start mt-6 !text-accent !border-accent hover:!text-ink hover:!border-ink">
              Искам подобен ефект →
            </Link>
          </div>
        </div>

      </div>
    </section>
  )
}

// ── Experts Directory ──────────────────────────────────────────────────────────
function Experts() {
  const EXPERTS = [
    {
      name: 'Студио „Цвят и Стил“',
      role: 'Интериорни бояджии',
      rating: '4.98',
      reviews: '56 отзива',
      location: 'София и областта',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      name: 'Иван Петров',
      role: 'Майстор декоративни мазилки',
      rating: '4.92',
      reviews: '34 отзива',
      location: 'Пловдив',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400&h=400'
    },
    {
      name: 'Мария Иванова',
      role: 'Специалист тапети',
      rating: '4.89',
      reviews: '22 отзива',
      location: 'Варна',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400&h=400'
    }
  ]

  return (
    <section id="experts" className="section bg-soft border-y border-line">
      <div className="container-page">
        <div className="flex justify-between items-end mb-10 flex-wrap gap-4">
          <div>
            <div className="eyebrow">Доверени партньори</div>
            <h2 className="h-section mt-2">Специалисти по Декорация</h2>
          </div>
          <Link to="/katalog" className="link-arrow text-sm !text-accent !border-accent hover:!text-ink hover:!border-ink">
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
                  <div className="flex items-center gap-1.5 text-xs text-accent mt-1">
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
                  className="text-accent font-bold hover:text-ink transition flex items-center gap-0.5">
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

function WallFAQItem({ question, answer }) {
  const [isOpen, setIsOpen] = useState(false)
  const contentRef = useRef(null)

  return (
    <div className="border-b border-line py-5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left flex items-center justify-between gap-4 font-display text-xl py-2 focus:outline-none transition-colors hover:text-accent font-bold"
        aria-expanded={isOpen}
      >
        <span>{question}</span>
        <span className={`text-accent text-3xl font-mono transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}>
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
function WallFAQ() {
  const FAQ_ITEMS = [
    {
      q: 'Каква е разликата между флис и винилови тапети?',
      a: 'Флис тапетите са дишащи, лесни за лепене (лепилото се нанася само на стената) и екологични. Виниловите тапети имат PVC покритие, което ги прави изключително устойчиви на влага и миене, идеални за кухни и коридори.'
    },
    {
      q: 'Трябва ли стената да е идеално гладка преди боядисване?',
      a: 'Да. Всяка неравност си личи още повече след нанасяне на боята, особено ако тя е с матов завършек или при странично осветление. Затова фината шпакловка е препоръчителна.'
    },
    {
      q: 'Мога ли да сложа тапет върху стара боя?',
      a: 'Ако старата боя е здрава и добре прилепнала, може. Задължително е обаче стената да се грундира предварително, за да се осигури добро сцепление на лепилото.'
    },
    {
      q: 'Колко време отнема изсъхването на декоративната мазилка?',
      a: 'Повечето мазилки изсъхват на допир за няколко часа, но пълното им втвърдяване и придобиване на окончателна здравина може да отнеме до 2-3 седмици.'
    }
  ]

  return (
    <section className="section bg-paper">
      <div className="container-page max-w-4xl">
        <div className="eyebrow text-center">Често задавани въпроси</div>
        <h2 className="h-section text-center mt-2">Всичко за стените</h2>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {FAQ_ITEMS.map((item, i) => (
            <WallFAQItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="section bg-paper !pt-0">
      <div className="container-page rounded-3xl p-10 md:p-16 grid md:grid-cols-12 gap-8 items-center relative overflow-hidden shadow-xl" style={{ background: 'linear-gradient(135deg, #0D2340 0%, #163250 100%)', color: '#F8FBFF' }}>
        <div className="absolute top-0 right-0 w-80 h-80 bg-accent/15 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="md:col-span-8 relative z-10">
          <h2 className="h-section text-white font-display">Стените, които заслужаваш</h2>
          <p className="mt-3 text-white/70 max-w-2xl leading-relaxed text-sm">
            От идеалния нюанс бяло до най-екстравагантния тапет. Сподели ни какво търсиш и ще те свържем с хората, които ще го реализират.
          </p>
        </div>
        
        <div className="md:col-span-4 flex md:justify-end gap-3 flex-wrap relative z-10">
          <Link 
            to="/contact" 
            className="btn btn-primary !bg-accent !text-paper hover:!bg-accent/90 shadow-md">
            Свържи се с нас
          </Link>
        </div>
      </div>
    </section>
  )
}
