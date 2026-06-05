import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Check, CheckCircle2, ArrowRight,
  Droplet, Thermometer, Layers, LayoutGrid, Sparkles,
} from 'lucide-react'
import { gsap } from 'gsap'
import { WHAT_YOU_FIND_IMAGES, SHOWCASE_IMAGES } from '../data/images.js'
import { formatDualCurrency, formatDualCurrencyRange } from '../lib/money.js'

const U = (id, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=${w}`


const IMG = {
  hero: WHAT_YOU_FIND_IMAGES.obzavezhdane.bathroom,
  sc0:  SHOWCASE_IMAGES.obzavezhdane[2] || U('1552321554-5fefe8c9ef14', 900),
  sc1:  U('1552321554-5fefe8c9ef14', 900),
  sc2:  U('1504307651254-35680f356dfd', 900),
  p1:   U('1573496359142-b8d87734a5a2', 480),
  p2:   U('1507003211169-0a1dd7228f2d', 480),
  p3:   U('1580489944761-15a19d654956', 480),
}

const SIZES = [
  { id: 'small',  label: 'Малка (<6 м²)',  baseMin: 2500,  baseMax: 5500  },
  { id: 'medium', label: 'Средна (6–12 м²)', baseMin: 4500,  baseMax: 9500  },
  { id: 'large',  label: 'Голяма (>12 м²)',  baseMin: 7500,  baseMax: 18000 },
]

const STYLES = [
  { id: 'minimal', label: 'Минималист',  min: 0.95, max: 1.05, palette: 'Бяло, матово, скрити фуги' },
  { id: 'luxury',  label: 'Луксозен',    min: 1.15, max: 1.40, palette: 'Мрамор, злато, вана отделно' },
  { id: 'scandi',  label: 'Скандинавски',min: 0.90, max: 1.00, palette: 'Светло дърво, бяло, бетон' },
]

const EXTRAS = [
  { id: 'shower',   label: 'Душ-кабина (ограждение + смесител)', min: 1200, max: 4500, icon: Droplet },
  { id: 'bathtub',  label: 'Вграден ваничка',                     min: 1500, max: 6500, icon: Droplet },
  { id: 'double',   label: 'Двойна мивка с шкаф',                 min:  850, max: 2800, icon: Layers },
  { id: 'heating',  label: 'Подово отопление',                     min:  600, max: 1800, icon: Thermometer },
  { id: 'tiles',    label: 'Плочки (доставка + полагане)',         min: 1400, max: 5500, icon: LayoutGrid },
  { id: 'lighting', label: 'Баня осветление + огледало с LED',    min:  380, max: 1200, icon: Sparkles },
]

export default function Bathroom() {
  const pageRef = useRef(null)

  useEffect(() => {
    window.scrollTo({ top: 0 })
    const ctx = gsap.context(() => {
      gsap.fromTo('.bath-fade', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out', stagger: 0.13 })
      gsap.fromTo('.bath-hero-bg', { scale: 1.06 }, { scale: 1, duration: 1.6, ease: 'power2.out' })
    }, pageRef)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={pageRef} className="min-h-screen bg-paper text-ink">
      <Hero />
      <Intro />
      <BathroomPlanner />
      <BathroomShowcase />
      <BathroomExperts />
      <BathroomFAQ />
      <BathroomCTA />
    </div>
  )
}

function Hero() {
  return (
    <section className="section relative min-h-[74svh] overflow-hidden py-24 flex items-center">
      <div className="absolute inset-0 z-0">
        <img src={IMG.hero} alt="Баня" className="img-cover bath-hero-bg" />
        <div className="absolute inset-0 bg-ink/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/70 to-ink/30" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-paper to-transparent" />
      </div>

      <div className="container-page relative z-10 w-full">
        <div className="max-w-3xl text-paper">
          <div className="bath-fade inline-flex items-center gap-3 rounded-full border border-paper/20 bg-paper/10 px-4 py-1.5 text-xs font-semibold tracking-[0.16em]">
            <Droplet size={14} />
            ЧИСТОТА И РЕЛАКС
          </div>
          <h1 className="h-display mt-6 bath-fade">
            Баня,<br />
            <span className="italic text-trustGreen">каквато заслужаваш.</span>
          </h1>
          <p className="bath-fade mt-6 max-w-2xl text-paper/85 text-lg leading-relaxed">
            Санитария, плочки, смесители и завършен монтаж — намираш всичко от един специалист, без да ходиш по три строителни магазина.
          </p>
          <div className="bath-fade mt-8 flex flex-wrap gap-3">
            <a href="#bathroom-planner" className="btn btn-primary !bg-trustGreen !text-paper hover:!bg-trustGreen/90">
              Планирай бюджета
            </a>
            <a href="#bathroom-experts" className="btn btn-ghost !border-paper/25 !bg-paper/10 !text-paper hover:!border-paper/45">
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
    { title: 'Пълен пакет', desc: 'Демонтаж на старото, ВиК промени, плочки, санитария, смесители и завършени детайли.', icon: <Layers className="text-trustGreen" size={22} /> },
    { title: 'Координиран екип', desc: 'Водопроводчик, плочкаджия и електрик работят заедно — без да ги търсиш поотделно.', icon: <CheckCircle2 className="text-trustGreen" size={22} /> },
    { title: 'Гаранция за херметизация', desc: 'Хидроизолацията под плочките е задължителна стъпка при всеки наш партньор.', icon: <Droplet className="text-trustGreen" size={22} /> },
  ]

  return (
    <section className="section bg-paper">
      <div className="container-page">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="reveal lg:col-span-5">
            <p className="font-display text-3xl italic leading-tight text-accentDeep lg:text-4xl">
              „Банята не е просто функционален кът — тя е малкото лично пространство, в което денят започва или свършва."
            </p>
          </div>
          <div className="reveal lg:col-span-7">
            <p className="text-base leading-relaxed text-muted">
              Ремонтът на баня е един от най-сложните за координация — ВиК, електро, плочки, санитария, вентилация. В Totsan намираш екипи, обединяващи всичко това, с ясен график и крайна цена.
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

function BathroomPlanner() {
  const [sizeId, setSizeId] = useState(SIZES[0].id)
  const [styleId, setStyleId] = useState(STYLES[0].id)
  const [baseBudget, setBase] = useState(3000)
  const [selectedIds, setSelected] = useState(['shower', 'tiles'])

  const size  = SIZES.find((s) => s.id === sizeId)  || SIZES[0]
  const style = STYLES.find((s) => s.id === styleId) || STYLES[0]

  const estimate = useMemo(() => {
    const chosen = EXTRAS.filter((e) => selectedIds.includes(e.id))
    const extMin = chosen.reduce((s, e) => s + e.min, 0)
    const extMax = chosen.reduce((s, e) => s + e.max, 0)
    return {
      min: Math.round((baseBudget + size.baseMin + extMin) * style.min),
      max: Math.round((baseBudget + size.baseMax + extMax) * style.max),
    }
  }, [baseBudget, selectedIds, size, style])

  const toggle = (id) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])

  return (
    <section id="bathroom-planner" className="section border-y border-line bg-soft">
      <div className="container-page">
        <div className="mb-10 max-w-3xl">
          <div className="eyebrow">Интерактивен планировчик</div>
          <h2 className="h-section mt-2">Колко струва ремонтът на банята?</h2>
          <p className="mt-3 text-muted">Избери размер, стил и елементи. Ориентировъчна цена за сравнение с реална оферта.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
          <div className="card rounded-3xl border border-line bg-paper p-6 shadow-sm lg:col-span-7">
            <div>
              <div className="text-sm font-semibold text-ink">Размер на банята</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {SIZES.map((s) => (
                  <button key={s.id} type="button" onClick={() => setSizeId(s.id)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${s.id === sizeId ? 'border-trustGreen bg-trustGreen/10 text-ink' : 'border-line bg-paper text-muted hover:border-muted/40 hover:text-ink'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-7">
              <div className="text-sm font-semibold text-ink">Стилова посока</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {STYLES.map((s) => (
                  <button key={s.id} type="button" onClick={() => setStyleId(s.id)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${s.id === styleId ? 'border-trustGreen bg-trustGreen/10 text-ink' : 'border-line bg-paper text-muted hover:border-muted/40 hover:text-ink'}`}>
                    <div className="font-medium">{s.label}</div>
                    <div className="mt-0.5 text-xs opacity-80">{s.palette}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink">Базов бюджет (труд)</span>
                <span className="text-sm font-semibold text-trustGreen">
                  {formatDualCurrency(baseBudget)}
                </span>
              </div>
              <input type="range" min="1000" max="12000" step="500" value={baseBudget}
                onChange={(e) => setBase(Number(e.target.value))} className="w-full cursor-pointer accent-trustGreen" />
            </div>

            <div className="mt-7">
              <div className="text-sm font-semibold text-ink">Добави елементи</div>
              <div className="mt-3 grid gap-2">
                {EXTRAS.map((extra) => {
                  const active = selectedIds.includes(extra.id)
                  const Icon = extra.icon
                  return (
                    <button key={extra.id} type="button" onClick={() => toggle(extra.id)}
                      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition ${active ? 'border-trustGreen bg-trustGreen/10' : 'border-line bg-paper hover:border-muted/40'}`}>
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`rounded-xl p-2 ${active ? 'bg-trustGreen text-paper' : 'bg-soft text-muted'}`}><Icon size={17} /></span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-ink">{extra.label}</span>
                          <span className="block text-xs text-muted">
                            {formatDualCurrencyRange(extra.min, extra.max)}
                          </span>
                        </span>
                      </span>
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${active ? 'border-trustGreen bg-trustGreen text-paper' : 'border-line bg-paper text-transparent'}`}>
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
                {size.label} в стил „{style.label.toLowerCase()}" с избраните елементи.
              </p>

              <div className="my-6 h-px bg-paper/15" />

              <ul className="space-y-2 text-sm text-paper/85">
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-trustGreen" />Хидроизолация под плочките.</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-trustGreen" />Координиран екип (ВиК + плочки).</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-trustGreen" />Гаранция на монтажа.</li>
              </ul>

              <p className="mt-5 text-center text-xs text-paper/35">1 € = 1.95583 лв. · официален фиксиран курс</p>

              <Link to="/contact" className="btn btn-primary mt-4 w-full justify-center !bg-trustGreen !text-paper hover:!bg-trustGreen/90">
                Поискай точна оферта
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}

function BathroomShowcase() {
  const [activeTab, setActiveTab] = useState(0)
  const items = [
    { title: 'Минималистична баня', location: 'София, Изток', desc: 'Голямоформатни бели плочки 120×60 с тъмни фуги, вграден душ с ниша за аксесоари и огледало с вградено LED осветление. Отоплителен лира в антрацит.', img: IMG.sc0 },
    { title: 'Луксозна главна баня', location: 'Пловдив, Хисар', desc: 'Отделен ваничка с чучур, двойна мивка с плот от Calacatta мрамор и Walk-in душ зад стъклена преграда. Топла подова настилка 24/7.', img: IMG.sc1 },
    { title: 'Гост баня с характер', location: 'Варна, Морска градина', desc: 'Само 4.5 м², но с микроцимент по стените, конзолна мивка и огледало с рафт. Точна смятка за всеки сантиметър.', img: IMG.sc2 },
  ]

  return (
    <section className="section bg-paper">
      <div className="container-page">
        <div className="text-center">
          <div className="eyebrow">Реализирани проекти</div>
          <h2 className="h-section mt-2">Как изглежда завършената баня</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">Три различни подхода — минималист, лукс и компактна — всяка с характер.</p>
        </div>

        <div className="mt-8 flex justify-center gap-2 overflow-x-auto whitespace-nowrap border-b border-line pb-3">
          {items.map((item, index) => (
            <button key={item.title} type="button" onClick={() => setActiveTab(index)}
              className={`rounded-full px-4 py-2 text-sm transition ${index === activeTab ? 'bg-trustGreen text-paper' : 'bg-paper text-muted hover:bg-soft hover:text-ink'}`}>
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
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-trustGreen">{items[activeTab].location}</div>
              <h3 className="mt-2 font-display text-3xl text-ink">{items[activeTab].title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-muted">{items[activeTab].desc}</p>
            </div>
            <Link to="/contact" className="link-arrow mt-6 inline-flex !border-trustGreen !text-trustGreen hover:!border-ink hover:!text-ink">Искам подобна баня</Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function BathroomExperts() {
  const experts = [
    { name: 'Студио „Аква"', role: 'ВиК и обзавеждане на бани', region: 'Цяла България', rating: '4.96', reviews: '72 отзива', avatar: IMG.p1 },
    { name: 'Петко Колев', role: 'Майстор плочкаджия', region: 'София и областта', rating: '4.93', reviews: '55 отзива', avatar: IMG.p2 },
    { name: 'Диана Николова', role: 'Дизайнер интериор бани', region: 'Варна и Бургас', rating: '4.89', reviews: '34 отзива', avatar: IMG.p3 },
  ]

  return (
    <section id="bathroom-experts" className="section border-y border-line bg-soft">
      <div className="container-page">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Препоръчани профили</div>
            <h2 className="h-section mt-2">Специалисти по бани и санитария</h2>
          </div>
          <Link to="/katalog" className="link-arrow !border-trustGreen !text-trustGreen hover:!border-ink hover:!text-ink">Виж всички в каталога</Link>
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
              <Link to="/contact" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-trustGreen hover:text-ink">
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
        <span className={`text-3xl text-trustGreen transition-transform ${isOpen ? 'rotate-45' : ''}`}>+</span>
      </button>
      <div ref={bodyRef} className="overflow-hidden transition-[max-height] duration-300 ease-in-out" style={{ maxHeight: isOpen ? `${bodyRef.current?.scrollHeight}px` : '0px' }}>
        <p className="max-w-3xl pt-3 text-sm leading-relaxed text-muted">{answer}</p>
      </div>
    </div>
  )
}

function BathroomFAQ() {
  const items = [
    { q: 'Колко отнема ремонт на баня?', a: 'Стандартна баня до 8 м² — около 3 до 5 работни седмици. Включва: демонтаж, ВиК преразпределение, хидроизолация, плочки, санитария и завършителни работи.' },
    { q: 'Задължителна ли е хидроизолацията?', a: 'Абсолютно. Без качествена хидроизолация плочките могат да изглеждат перфектно, но влагата ще проникне в конструкцията. Всички наши партньори я включват като стандарт.' },
    { q: 'Може ли да сменим само плочките, без да бутаме всичко?', a: 'Може, ако старите плочки са поставени директно на мазилка и са здрави. Ако обаче под тях има стара хидроизолация с проблеми — по-евтино е да се ремонтира сега, отколкото след 2 години теч.' },
    { q: 'Работите ли и с ВиК разрешителни при преразпределение?', a: 'Да, нашите партньори-специалисти са запознати с изискванията и могат да съдействат за необходимата документация при сградно управление.' },
  ]
  return (
    <section className="section bg-paper">
      <div className="container-page max-w-4xl">
        <div className="text-center">
          <div className="eyebrow">Често задавани въпроси</div>
          <h2 className="h-section mt-2">За ремонта на банята</h2>
        </div>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {items.map((item) => <FAQItem key={item.q} question={item.q} answer={item.a} />)}
        </div>
      </div>
    </section>
  )
}

function BathroomCTA() {
  return (
    <section className="section !pt-0">
      <div className="container-page rounded-3xl bg-gradient-to-br from-ink via-graphite to-ink p-10 text-paper shadow-xl md:grid md:grid-cols-12 md:items-center md:gap-8 md:p-14">
        <div className="md:col-span-8">
          <h2 className="h-section text-paper">Готов ли си да преобразиш банята?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-paper/75">Изпрати снимки на старата баня и размери. До 48 часа ще получиш ориентировъчна оферта от проверен екип.</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3 md:col-span-4 md:mt-0 md:justify-end">
          <Link to="/contact" className="btn btn-primary !bg-trustGreen !text-paper hover:!bg-trustGreen/90">Заяви консултация</Link>
        </div>
      </div>
    </section>
  )
}
