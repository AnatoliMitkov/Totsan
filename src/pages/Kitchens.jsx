import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Check, CheckCircle2, ArrowRight,
  ChefHat, Refrigerator, Zap, Layers, Sparkles, UtensilsCrossed,
} from 'lucide-react'
import { gsap } from 'gsap'
import { WHAT_YOU_FIND_IMAGES, SHOWCASE_IMAGES } from '../data/images.js'

const U = (id, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=${w}`

const EUR_RATE = 1.95583
const fmtEur = (lv) => Math.round(lv / EUR_RATE)

const IMG = {
  hero: WHAT_YOU_FIND_IMAGES.obzavezhdane.kitchen,
  sc0:  SHOWCASE_IMAGES.obzavezhdane[0] || U('1556909114-f6e7ad7d3136', 900),
  sc1:  U('1574269910231-bc508bcb43f8', 900),
  sc2:  U('1493663284031-b7e3aefcae8e', 900),
  p1:   U('1573496359142-b8d87734a5a2', 480),
  p2:   U('1507003211169-0a1dd7228f2d', 480),
  p3:   U('1580489944761-15a19d654956', 480),
}

const TYPES = [
  { id: 'studio',  label: 'Студио / Права',  baseMin: 3200,  baseMax: 7500  },
  { id: 'island',  label: 'С остров',          baseMin: 5500,  baseMax: 14000 },
  { id: 'lu',      label: 'L / U форма',        baseMin: 4500,  baseMax: 11500 },
]

const STYLES = [
  { id: 'modern',  label: 'Модерна',     min: 1.0, max: 1.15, palette: 'Бяло, матово сиво, скрити дръжки' },
  { id: 'classic', label: 'Класическа',  min: 1.1, max: 1.30, palette: 'Дърво, кремав тон, фрезовани фронтове' },
  { id: 'scandi',  label: 'Скандинавска',min: 0.9, max: 1.05, palette: 'Светло дърво, бяло, функционалност' },
]

const EXTRAS = [
  { id: 'appliances', label: 'Вградени уреди (фурна, печка)', min: 1400, max: 4200, icon: Zap },
  { id: 'hood',       label: 'Абсорбатор',                    min:  480, max: 1800, icon: UtensilsCrossed },
  { id: 'dishwasher', label: 'Съдомиялна машина',             min:  650, max: 1900, icon: Refrigerator },
  { id: 'countertop', label: 'Каменен / Кварцов плот',        min:  900, max: 3500, icon: Layers },
  { id: 'lighting',   label: 'Кухненско осветление',          min:  280, max:  850, icon: Sparkles },
  { id: 'handles',    label: 'Луксозна фурнитура',            min:  160, max:  620, icon: ChefHat },
]

export default function Kitchens() {
  const pageRef = useRef(null)

  useEffect(() => {
    window.scrollTo({ top: 0 })
    const ctx = gsap.context(() => {
      gsap.fromTo('.kitchen-fade', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out', stagger: 0.13 })
      gsap.fromTo('.kitchen-hero-bg', { scale: 1.06 }, { scale: 1, duration: 1.6, ease: 'power2.out' })
    }, pageRef)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={pageRef} className="min-h-screen bg-paper text-ink">
      <Hero />
      <Intro />
      <KitchenPlanner />
      <KitchenShowcase />
      <KitchenExperts />
      <KitchenFAQ />
      <KitchenCTA />
    </div>
  )
}

function Hero() {
  return (
    <section className="section relative min-h-[74svh] overflow-hidden py-24 flex items-center">
      <div className="absolute inset-0 z-0">
        <img src={IMG.hero} alt="Кухни по поръчка" className="img-cover kitchen-hero-bg" />
        <div className="absolute inset-0 bg-ink/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/70 to-ink/30" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-paper to-transparent" />
      </div>

      <div className="container-page relative z-10 w-full">
        <div className="max-w-3xl text-paper">
          <div className="kitchen-fade inline-flex items-center gap-3 rounded-full border border-paper/20 bg-paper/10 px-4 py-1.5 text-xs font-semibold tracking-[0.16em]">
            <ChefHat size={14} />
            СЪРЦЕТО НА ДОМА
          </div>
          <h1 className="h-display mt-6 kitchen-fade">
            Кухни<br />
            <span className="italic text-accent">по поръчка.</span>
          </h1>
          <p className="kitchen-fade mt-6 max-w-2xl text-paper/85 text-lg leading-relaxed">
            От концепция до монтаж — кухня, съобразена с твоите навици, размери и вкус. Намираш производители, дизайнери и монтажни екипи, работещи заедно на едно място.
          </p>
          <div className="kitchen-fade mt-8 flex flex-wrap gap-3">
            <a href="#kitchen-planner" className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep">
              Планирай бюджета
            </a>
            <a href="#kitchen-experts" className="btn btn-ghost !border-paper/25 !bg-paper/10 !text-paper hover:!border-paper/45">
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
    { title: 'Проект по мярка', desc: 'Измерване на място, 3D визуализация и финален план — преди да потвърдиш поръчка.', icon: <Layers className="text-accent" size={22} /> },
    { title: 'Интегрирани уреди', desc: 'Фурна, хладилник, съдомиялна — вградени безупречно в корпуса, с гаранция.', icon: <Refrigerator className="text-accent" size={22} /> },
    { title: 'Монтаж и пускане в ход', desc: 'Един екип монтира, свързва водата и тока и изчиства след себе си.', icon: <Zap className="text-accent" size={22} /> },
  ]

  return (
    <section className="section bg-paper">
      <div className="container-page">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="reveal lg:col-span-5">
            <p className="font-display text-3xl italic leading-tight text-accentDeep lg:text-4xl">
              „Кухнята не е само място за готвене — тя е сцената на семейния живот."
            </p>
          </div>
          <div className="reveal lg:col-span-7">
            <p className="text-base leading-relaxed text-muted">
              Кухнята по поръчка не е лукс — тя е решение, което пасва точно на твоето пространство, начин на живот и бюджет. В Totsan намираш производители, интериорни дизайнери и монтажни бригади, координирани от началото до предаването на ключ.
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

function KitchenPlanner() {
  const [typeId, setTypeId] = useState(TYPES[0].id)
  const [styleId, setStyleId] = useState(STYLES[0].id)
  const [baseBudget, setBase] = useState(6000)
  const [selectedIds, setSelected] = useState(['appliances', 'countertop'])

  const type  = TYPES.find((t) => t.id === typeId)  || TYPES[0]
  const style = STYLES.find((s) => s.id === styleId) || STYLES[0]

  const estimate = useMemo(() => {
    const chosen = EXTRAS.filter((e) => selectedIds.includes(e.id))
    const extMin = chosen.reduce((s, e) => s + e.min, 0)
    const extMax = chosen.reduce((s, e) => s + e.max, 0)
    return {
      min: Math.round((baseBudget + type.baseMin + extMin) * style.min),
      max: Math.round((baseBudget + type.baseMax + extMax) * style.max),
    }
  }, [baseBudget, selectedIds, type, style])

  const toggle = (id) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])

  return (
    <section id="kitchen-planner" className="section border-y border-line bg-soft">
      <div className="container-page">
        <div className="mb-10 max-w-3xl">
          <div className="eyebrow">Интерактивен планировчик</div>
          <h2 className="h-section mt-2">Колко струва твоята кухня?</h2>
          <p className="mt-3 text-muted">Избери конфигурация, стил и допълнения. Получаваш ориентир преди да се срещнеш с производителя.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
          <div className="card rounded-3xl border border-line bg-paper p-6 shadow-sm lg:col-span-7">
            <div>
              <div className="text-sm font-semibold text-ink">Конфигурация</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {TYPES.map((t) => (
                  <button key={t.id} type="button" onClick={() => setTypeId(t.id)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${t.id === typeId ? 'border-accent bg-accent/10 text-ink' : 'border-line bg-paper text-muted hover:border-muted/40 hover:text-ink'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-7">
              <div className="text-sm font-semibold text-ink">Стилова посока</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {STYLES.map((s) => (
                  <button key={s.id} type="button" onClick={() => setStyleId(s.id)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${s.id === styleId ? 'border-accent bg-accent/10 text-ink' : 'border-line bg-paper text-muted hover:border-muted/40 hover:text-ink'}`}>
                    <div className="font-medium">{s.label}</div>
                    <div className="mt-0.5 text-xs opacity-80">{s.palette}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink">Базов бюджет за корпус</span>
                <span className="text-sm font-semibold text-accent">
                  {fmtEur(baseBudget).toLocaleString('bg-BG')} € / {baseBudget.toLocaleString('bg-BG')} лв.
                </span>
              </div>
              <input type="range" min="2000" max="18000" step="500" value={baseBudget}
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
                            {fmtEur(extra.min).toLocaleString('bg-BG')} – {fmtEur(extra.max).toLocaleString('bg-BG')} € &nbsp;·&nbsp; {extra.min.toLocaleString('bg-BG')} – {extra.max.toLocaleString('bg-BG')} лв.
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
                {fmtEur(estimate.min).toLocaleString('bg-BG')} – {fmtEur(estimate.max).toLocaleString('bg-BG')} €
              </div>
              <div className="mt-1 text-base text-paper/55">
                {estimate.min.toLocaleString('bg-BG')} – {estimate.max.toLocaleString('bg-BG')} лв.
              </div>
              <p className="mt-3 text-sm text-paper/75">
                {type.label} в стил „{style.label.toLowerCase()}" с избраните допълнения.
              </p>

              <div className="my-6 h-px bg-paper/15" />

              <ul className="space-y-2 text-sm text-paper/85">
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-accent" />3D визуализация преди поръчка.</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-accent" />Монтаж и пускане в ход от екипа.</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-accent" />Гаранция на корпусите и уредите.</li>
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

function KitchenShowcase() {
  const [activeTab, setActiveTab] = useState(0)
  const items = [
    { title: 'Модерна кухня с остров', location: 'София, Витоша', desc: 'Матово бяло пред плот от кварц с фини вени. Остров с вградена индукционна печка и бар места за три. Интегриран хладилник и фурна с единна фасада.', img: IMG.sc0 },
    { title: 'Готварска кухня за ресторант', location: 'Пловдив, Капана', desc: 'Индустриален дизайн с неръждаем плот, открити рафтове и комбинация от двукрилен хладилник и шкафове до таван за максимален капацитет.', img: IMG.sc1 },
    { title: 'Отворена кухня в дневна', location: 'Варна, Чайка', desc: 'Скандинавски стил с дъбов фурнир и бяла боя. L-образна конфигурация с пенинсула, разделяща кухнята от трапезарията без стена.', img: IMG.sc2 },
  ]

  return (
    <section className="section bg-paper">
      <div className="container-page">
        <div className="text-center">
          <div className="eyebrow">Реализирани проекти</div>
          <h2 className="h-section mt-2">Как изглежда завършената кухня</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">Три различни концепции — от минималистична до гастрономска. Всяка по поръчка, всяка с история.</p>
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
            <Link to="/contact" className="link-arrow mt-6 inline-flex !border-accent !text-accent hover:!border-ink hover:!text-ink">Искам подобна кухня</Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function KitchenExperts() {
  const experts = [
    { name: 'Линеа Кухни', role: 'Производство и монтаж по поръчка', region: 'Цяла България', rating: '4.95', reviews: '61 отзива', avatar: IMG.p1 },
    { name: 'Студио „Форм"', role: 'Дизайн и реализация', region: 'София и Пловдив', rating: '4.90', reviews: '38 отзива', avatar: IMG.p2 },
    { name: 'Андрей Маринов', role: 'Монтажист кухненско обзавеждане', region: 'Варна и Бургас', rating: '4.88', reviews: '29 отзива', avatar: IMG.p3 },
  ]

  return (
    <section id="kitchen-experts" className="section border-y border-line bg-soft">
      <div className="container-page">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Препоръчани профили</div>
            <h2 className="h-section mt-2">Специалисти по кухненско обзавеждане</h2>
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

function KitchenFAQ() {
  const items = [
    { q: 'Колко отнема производство по поръчка?', a: 'Средно между 4 и 8 седмици от потвърдена поръчка. По-сложни конфигурации с камък или специална боя могат да отнемат до 10 седмици.' },
    { q: 'Включен ли е монтажът в цената?', a: 'При повечето производители монтажът е отделна позиция в офертата. В Totsan виждаш и двете заедно — корпуси, уреди и монтажен екип.' },
    { q: 'Може ли кухнята да се проектира с 3D?', a: 'Да. Всички наши партньори-производители работят с 3D планиране — виждаш точния резултат преди да платиш аванс.' },
    { q: 'Какво да правя, ако стените не са прави?', a: 'Точно затова измерването на място е задължително. Производителят отчита всички отклонения и ги компенсира в проекта.' },
  ]
  return (
    <section className="section bg-paper">
      <div className="container-page max-w-4xl">
        <div className="text-center">
          <div className="eyebrow">Често задавани въпроси</div>
          <h2 className="h-section mt-2">За кухните по поръчка</h2>
        </div>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {items.map((item) => <FAQItem key={item.q} question={item.q} answer={item.a} />)}
        </div>
      </div>
    </section>
  )
}

function KitchenCTA() {
  return (
    <section className="section !pt-0">
      <div className="container-page rounded-3xl bg-gradient-to-br from-ink via-graphite to-ink p-10 text-paper shadow-xl md:grid md:grid-cols-12 md:items-center md:gap-8 md:p-14">
        <div className="md:col-span-8">
          <h2 className="h-section text-paper">Готов ли си да проектираш кухнята на мечтите си?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-paper/75">Изпрати ни размерите на помещението и идея за стил. До 48 часа ще получиш оферта от подходящ производител.</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3 md:col-span-4 md:mt-0 md:justify-end">
          <Link to="/contact" className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep">Заяви консултация</Link>
        </div>
      </div>
    </section>
  )
}
