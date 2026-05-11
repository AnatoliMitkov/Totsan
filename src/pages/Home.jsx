import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LAYERS } from '../data/layers.js'
import { SERVICE_DETAILS } from '../data/catalog.js'
import { HOME_PROJECTS, HERO_COLLAGE, PARTNER_LOGOS, SERVICE_IMAGES, LAYER_HEROS } from '../data/images.js'

const HERO_POSTER_SRC = '/Videos/totsan-hero-video-building-layers.webp'
const HERO_VIDEO_SOURCES = [
  { src: '/Videos/totsan-hero-video-building-layers.webm', type: 'video/webm' },
  { src: '/Videos/totsan-hero-video-building-layers.mp4', type: 'video/mp4' },
]

export default function Home() {
  return (
    <>
      <Hero />
      <Promise />
      <Story />
      <LayersGrid />
      <SectionDivider label="Услуги" />
      <ServicesStrip />
      <SectionDivider label="Реални примери" />
      <Projects />
      <SectionDivider label="Как работи" />
      <HowItWorks />
      <SectionDivider label="Още от Totsan" />
      <Trust />
      <Testimonial />
      <FAQ />
      <CTA />
    </>
  )
}

function Hero() {
  const [videoReady, setVideoReady] = useState(false)

  return (
    <section className="home-hero">
      <div className="home-hero__media-shell" aria-hidden="true">
        <img
          src={HERO_POSTER_SRC}
          alt=""
          className={`home-hero__image ${videoReady ? 'is-hidden' : ''}`}
          loading="eager"
          decoding="async"
        />
        <video
          className={`home-hero__video ${videoReady ? 'is-ready' : ''}`}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={HERO_POSTER_SRC}
          onCanPlay={() => {
            setVideoReady(true)
          }}
          onError={() => {
            setVideoReady(false)
          }}>
          {HERO_VIDEO_SOURCES.map((source) => (
            <source key={source.src} src={source.src} type={source.type} />
          ))}
        </video>
      </div>
      <div className="home-hero__scrim" aria-hidden="true" />
      <div className="container-page home-hero__overlay">
        <div className="home-hero__content">
          <div className="eyebrow home-hero__eyebrow mb-4">Контрол, качество и сигурност</div>
          <h1 className="h-display home-hero__title text-paper">
            <span className="home-hero__title-line home-hero__title-line--top">Твоят - сигурен избор в</span>
            <span className="home-hero__title-line home-hero__title-line--bottom text-accent italic">строителството.</span>
          </h1>
          <p className="home-hero__lead mt-5 max-w-xl" style={{fontSize:'var(--step-md)'}}>
            Една къща, един ресторант, един апартамент или градина. Започваш от идеята, минаваш през правилните хора, материали и услуги — и стигаш до своя дом. Всичко на едно място. Без хаос.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/sloy/ideya" className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep">Започни от идея →</Link>
            <a href="#story" className="btn btn-ghost !border-paper/25 !bg-paper/10 !text-paper hover:!border-paper/50 hover:!bg-paper/15">Виж как работи</a>
          </div>
        </div>
      </div>
    </section>
  )
}

function SectionDivider({ label }) {
  return (
    <div className="section-divider" aria-hidden="true">
      <div className="container-page section-divider__inner">
        <span className="section-divider__line" />
        <span className="section-divider__label">{label}</span>
        <span className="section-divider__line" />
      </div>
    </div>
  )
}

function Stat({ n, l, tone = 'light' }) {
  const isDark = tone === 'dark'

  return (
    <div className={isDark ? 'border-t border-paper/10 pt-3' : ''}>
      <div className={`font-display ${isDark ? 'text-2xl text-paper' : 'text-3xl text-ink'}`}>{n}</div>
      <div className={`mt-1 leading-snug ${isDark ? 'text-[0.72rem] text-paper/60' : 'text-xs text-muted'}`}>{l}</div>
    </div>
  )
}

function Promise() {
  const items = [
    { k:'Само проверени', v:'Никой не влиза в Totsan, ако не доказва качество.' },
    { k:'Един разказ', v:'Сайтът те води стъпка по стъпка, без да ровиш в Google.' },
    { k:'Реални оферти', v:'Виждаш цени, наличности и условия — без скрити „звездички“.' }
  ]
  return (
    <section className="section !py-14 border-y border-line bg-soft">
      <div className="container-page grid md:grid-cols-3 gap-8">
        {items.map((i,idx) => (
          <div key={idx} className="reveal">
            <div className="font-display text-accentDeep text-2xl">{i.k}</div>
            <div className="text-muted mt-1">{i.v}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Story() {
  return (
    <section id="story" className="section">
      <div className="container-page max-w-4xl">
        <div className="eyebrow reveal">Как мислим</div>
        <h2 className="h-section mt-3 reveal">
          Никой не започва от плочка. Започваш от <em className="text-accentDeep">мечта</em> — и оттам нататък трябва някой да те води.
        </h2>
        <p className="mt-6 text-muted reveal" style={{fontSize:'var(--step-md)'}}>
          Преди години, ако искаш да си построиш нещо, обикаляш десет фирми, питаш роднини, гадаеш цени, надяваш се. Ние подредихме това. Раздробихме целия процес на пет ясни слоя — и във всеки слой намираш само хора и неща, които наистина струват.
        </p>
      </div>
    </section>
  )
}

function LayersGrid() {
  return (
    <section className="section !pt-0">
      <div className="container-page">
        <div className="flex items-end justify-between mb-10 reveal">
          <div>
            <div className="eyebrow">Петте слоя на създаването</div>
            <h2 className="h-section mt-2">Кой етап си днес?</h2>
          </div>
          <Link to="/katalog" className="link-arrow hidden md:inline-flex">Виж всички →</Link>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 items-stretch">
          {LAYERS.map((l, i) => (
            <Link to={`/sloy/${l.slug}`} key={l.slug}
              className="card reveal img-zoom-host block overflow-hidden bg-paper h-full">
              <div className="media-frame aspect-[4/3] no-shade">
                <img src={LAYER_HEROS[l.slug]} alt={l.title} loading="lazy" decoding="async" className="img-cover img-zoom" />
              </div>
              <div className="p-6 flex min-h-[15rem] flex-col justify-between gap-5">
                <div>
                  <div className="font-display text-accentDeep text-3xl">{l.number}</div>
                  <div className="h-card mt-2 text-ink">{l.title}</div>
                  <p className="text-muted mt-3 text-sm">{l.short}</p>
                </div>
                <div className="inline-flex items-center gap-2 text-sm font-medium text-ink">
                  Влез в слоя <span aria-hidden>→</span>
                </div>
              </div>
            </Link>
          ))}
          <Link to="/contact" className="card bg-paper border-2 border-dashed border-accent/60 flex h-full flex-col overflow-hidden reveal hover:border-accent">
            <div className="aspect-[4/3] bg-gradient-to-br from-soft via-paper to-cloud p-6 flex items-end border-b border-line">
              <div>
                <div className="eyebrow">Насочване</div>
                <div className="font-display text-accentDeep text-3xl mt-2">?</div>
              </div>
            </div>
            <div className="p-6 flex min-h-[15rem] flex-col justify-between gap-5">
              <div>
                <div className="h-card text-ink">Не знаеш откъде?</div>
                <p className="text-muted mt-3 text-sm">Кажи ни в две изречения какво искаш — ние те насочваме към правилния слой и правилния човек.</p>
              </div>
              <span className="btn btn-primary self-start">Заяви консултация</span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  )
}

function ServicesStrip() {
  return (
    <section className="section !py-16 bg-ink text-paper">
      <div className="container-page">
        <div className="grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-4 reveal">
            <div className="eyebrow !text-paper/60">Хоризонтален слой</div>
            <h2 className="h-section mt-2 text-paper">Услугите, които вървят с всяко пространство.</h2>
            <p className="mt-4 text-paper/70">Електричар за контактите, ВиК за банята, smart home за светлините. Тези хора те застигат на всеки етап — затова са винаги под ръка.</p>
          </div>
          <div className="md:col-span-8 reveal">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SERVICE_DETAILS.slice(0,8).map(s => (
                <Link key={s.slug} to={`/usluga/${s.slug}`} className="group border border-paper/20 rounded-xl overflow-hidden hover:border-accent transition block">
                  <div className="media-frame aspect-square">
                    <img src={SERVICE_IMAGES[s.slug]} alt={s.name} loading="lazy" className="img-cover img-zoom group-hover:scale-105 transition" />
                  </div>
                  <div className="p-3 text-sm bg-graphite">{s.name}</div>
                </Link>
              ))}
            </div>
            <Link to="/uslugi" className="link-arrow !text-paper !border-paper/40 hover:!text-accent hover:!border-accent inline-flex mt-6 text-sm">Виж всички услуги →</Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function Projects() {
  const projects = [
    { t:'Апартамент в София', who:'Архитект + интериорен дизайнер', layer:'Слоеве 01 → 04', img: HOME_PROJECTS[0] },
    { t:'Семейна къща, Пловдив', who:'Главен изпълнител + материали', layer:'Слоеве 02 → 05', img: HOME_PROJECTS[1] },
    { t:'Ресторант в морска градина', who:'Дизайн + декорация', layer:'Слоеве 01, 04, 05', img: HOME_PROJECTS[2] }
  ]
  return (
    <section className="section">
      <div className="container-page">
        <div className="flex items-end justify-between mb-10 reveal">
          <div>
            <div className="eyebrow">Реализирани с Totsan</div>
            <h2 className="h-section mt-2">Места, които вече съществуват.</h2>
          </div>
          <span className="text-muted text-sm hidden md:block">Примерни проекти</span>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {projects.map((p,i) => (
            <article key={i} className="card reveal img-zoom-host p-0 overflow-hidden bg-paper">
              <div className="media-frame aspect-[4/3]">
                <img src={p.img} alt={p.t} loading="lazy" decoding="async" className="img-cover img-zoom" />
                <div className="absolute top-3 left-3 text-xs px-2.5 py-1 rounded-full bg-paper/90 text-ink backdrop-blur">{p.layer}</div>
              </div>
              <div className="p-6 border-t border-line">
                <div className="h-card">{p.t}</div>
                <div className="text-muted text-sm mt-1">{p.who}</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    { n:'01', t:'Кажи къде си', d:'Избери слоя си или ни опиши с две думи мечтата.' },
    { n:'02', t:'Виж избраните за теб', d:'Показваме ти само хора и марки, които стават за твоя случай.' },
    { n:'03', t:'Сравни и реши спокойно', d:'Реални оферти, наличности и отзиви — без натиск.' },
    { n:'04', t:'Свърши работата', d:'Запазваш, говорите, започвате. Ние сме там, ако нещо засече.' }
  ]
  return (
    <section className="section bg-soft border-y border-line">
      <div className="container-page">
        <div className="eyebrow reveal">Как работи Totsan</div>
        <h2 className="h-section mt-2 reveal max-w-3xl">Четири стъпки. Без излишни думи.</h2>
        <div className="mt-12 grid md:grid-cols-4 gap-8">
          {steps.map(s => (
            <div key={s.n} className="reveal border-t border-ink pt-5">
              <div className="font-display text-3xl text-accentDeep">{s.n}</div>
              <div className="font-display text-xl mt-2">{s.t}</div>
              <p className="text-muted mt-2 text-sm">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Trust() {
  return (
    <section className="section !py-16">
      <div className="container-page">
        <div className="eyebrow text-center reveal">Работим с производители и марки, които познаваш</div>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 items-center reveal">
          {PARTNER_LOGOS.map(p => <PartnerLogoTile key={p.name} brand={p} />)}
        </div>
      </div>
    </section>
  )
}

function PartnerLogoTile({ brand }) {
  const [failed, setFailed] = useState(false)

  return (
    <div className="rounded-2xl border border-line bg-paper p-3 text-center transition hover:-translate-y-0.5 hover:border-ink">
      <div className="flex h-16 items-center justify-center rounded-xl bg-soft/75 px-4">
        {failed ? (
          <span className="font-display text-lg text-ink">{brand.name}</span>
        ) : (
          <img
            src={brand.logo}
            alt={brand.name}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="max-h-10 max-w-full object-contain"
          />
        )}
      </div>
      <div className="mt-3 text-[0.68rem] uppercase tracking-[0.18em] text-muted">{brand.name}</div>
    </div>
  )
}

function Testimonial() {
  return (
    <section className="section bg-soft border-y border-line">
      <div className="container-page max-w-4xl text-center">
        <div className="eyebrow reveal">Защо Totsan</div>
        <p className="font-display reveal mt-4" style={{fontSize:'var(--step-xl)', lineHeight:1.15}}>
          „Обикалях фирми три месеца и не разбирах нищо. <span className="text-accentDeep">Тук за един следобед видях какво ми трябва</span> — и кой ще го направи както трябва.“
        </p>
        <div className="mt-6 text-sm text-muted reveal">— Мария, собственик на нов апартамент в Пловдив</div>
      </div>
    </section>
  )
}

function FAQ() {
  const items = [
    { q:'Колко струва да използвам Totsan?', a:'За теб като клиент — нищо. Платформата е безплатна. Плащаш само на специалистите и марките, с които решиш да работиш.' },
    { q:'Как избирате кои хора влизат?', a:'Всеки специалист минава през преглед — реални проекти, отзиви, документи. Ако не отговаря, не влиза.' },
    { q:'Ами ако нещо се обърка по време на работа?', a:'Имаш на кого да се обадиш. Ние посредничим, ако възникне спор или забавяне.' },
    { q:'Мога ли да започна, без да зная какво искам?', a:'Точно за това е Слой 01. Кажи ни мечтата с две изречения — насочваме те.' }
  ]
  return (
    <section className="section">
      <div className="container-page max-w-4xl">
        <div className="eyebrow reveal">Често задавани въпроси</div>
        <h2 className="h-section mt-2 reveal">Кратко и ясно.</h2>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {items.map((it, i) => (
            <details key={i} className="group py-5 reveal">
              <summary className="cursor-pointer flex items-center justify-between gap-4 list-none">
                <span className="font-display text-xl">{it.q}</span>
                <span className="text-accentDeep text-2xl group-open:rotate-45 transition">+</span>
              </summary>
              <p className="text-muted mt-3 max-w-3xl">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="section">
      <div className="container-page rounded-3xl bg-ink text-paper p-10 md:p-16 grid md:grid-cols-12 gap-8 items-center">
        <div className="md:col-span-8">
          <h2 className="h-section text-paper">Готов да започнеш?</h2>
          <p className="mt-3 text-paper/70 max-w-2xl">Кажи ни в две изречения какво искаш — ние се връщаме към теб с правилните хора още същата седмица.</p>
        </div>
        <div className="md:col-span-4 flex md:justify-end gap-3 flex-wrap">
          <Link to="/contact" className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep">Заяви консултация</Link>
          <Link to="/sloy/ideya" className="btn btn-ghost !border-paper/30 !text-paper">Разгледай слоевете</Link>
        </div>
      </div>
    </section>
  )
}
