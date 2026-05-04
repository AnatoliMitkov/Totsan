import { Link, useParams } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { LAYER_HEROS, WHAT_YOU_FIND_IMAGES, SHOWCASE_IMAGES, SERVICE_IMAGES, productImageFor } from '../data/images.js'
import { SERVICE_DETAILS } from '../data/catalog.js'
import ProfessionalCard from '../components/ProfessionalCard.jsx'
import { useProfileDirectory } from '../lib/profiles.js'

export default function Layer({ slug }) {
  const { slug: routeSlug } = useParams()
  const currentSlug = slug || routeSlug
  const { layers } = useProfileDirectory()
  const layer = layers.find(l => l.slug === currentSlug)

  if (!layer) return <LayerNotFound />

  const idx = layers.findIndex(l => l.slug === currentSlug)
  const prev = layers[idx - 1]
  const next = layers[idx + 1]

  // скролни нагоре при смяна на слой
  useEffect(() => { window.scrollTo({ top: 0 }) }, [currentSlug])

  const hasProducts = !!layer.products

  return (
    <>
      <Hero layer={layer} />
      <Intro layer={layer} />
      <WhatYouFind layer={layer} />
      <Professionals layer={layer} />
      {hasProducts && <Products layer={layer} />}
      <Showcase layer={layer} />
      <ProcessSection layer={layer} />
      <ServicesBand />
      <FAQ layer={layer} />
      <RelatedLayers prev={prev} next={next} />
      <CTA layer={layer} />
    </>
  )
}

function Hero({ layer }) {
  const heroImg = LAYER_HEROS[layer.slug]
  return (
    <section className="section relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroImg} alt="" className="img-cover" loading="eager" />
        <div className="hero-overlay"></div>
      </div>
      <div className="container-page grid lg:grid-cols-12 gap-10 items-end relative">
        <div className="lg:col-span-8 reveal">
          <div className="flex items-center gap-3">
            <span className="eyebrow">Слой {layer.number} от 05</span>
            <span className="h-px flex-1 bg-ink/20 max-w-[8rem]"></span>
          </div>
          <h1 className="h-display mt-3">{layer.title}</h1>
          <p className="mt-5 max-w-2xl text-ink/80" style={{fontSize:'var(--step-md)'}}>{layer.long}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/contact" className="btn btn-primary">Заяви консултация</Link>
            <a href="#specialisti" className="btn btn-ghost bg-paper/80 backdrop-blur">Виж специалистите</a>
          </div>
        </div>
        <div className="lg:col-span-4 reveal">
          <div className="bg-paper/90 backdrop-blur border border-line rounded-2xl p-6">
            <div className="eyebrow mb-3">В този слой намираш</div>
            <ul className="space-y-2">
              {layer.pros.map(p => (
                <li key={p} className="flex items-center justify-between border-b border-line/80 pb-2 text-sm">
                  <span>{p}</span><span className="text-accentDeep">→</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

function Intro({ layer }) {
  return (
    <section className="section !py-20">
      <div className="container-page grid lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-5 reveal">
          <p className="font-display italic text-accentDeep" style={{fontSize:'var(--step-lg)', lineHeight:1.25}}>
            {layer.heroQuote}
          </p>
        </div>
        <div className="lg:col-span-7 reveal">
          <p className="text-muted" style={{fontSize:'var(--step-md)'}}>{layer.intro}</p>
        </div>
      </div>
    </section>
  )
}

const QUIZ_CONFIG_LOADERS = {
  paint:    () => import('../components/quiz/paint-config.js').then(m => m.paintConfig),
  windows:  () => import('../components/quiz/windows-config.js').then(m => m.windowsConfig),
  tiles:    () => import('../components/quiz/tiles-config.js').then(m => m.tilesConfig),
  flooring: () => import('../components/quiz/flooring-config.js').then(m => m.flooringConfig),
}

function WhatYouFind({ layer }) {
  const imgs = WHAT_YOU_FIND_IMAGES[layer.slug] || {}
  const [activeQuizSlug, setActiveQuizSlug] = useState(null)
  const quizRef = useRef(null)
  const headingText = layer.whatYouFind.length === 5 ? 'Пет посоки. Един слой.' : 'Четири посоки. Един слой.'

  const activeItem = activeQuizSlug
    ? layer.whatYouFind.find(w => w.quizSlug === activeQuizSlug)
    : null

  useEffect(() => {
    if (!activeQuizSlug) return undefined

    let cancelled = false
    Promise.all([
      import('../components/quiz/quiz-engine.js'),
      QUIZ_CONFIG_LOADERS[activeQuizSlug]?.(),
    ])
      .then(([, config]) => {
        if (cancelled || !config) return
        if (quizRef.current) quizRef.current.config = config
      })
      .catch(err => console.error('Quiz load failed:', err))

    return () => { cancelled = true }
  }, [activeQuizSlug])

  return (
    <section className="section !pt-0">
      <div className="container-page">
        <div className="flex items-end justify-between flex-wrap gap-4 reveal">
          <div>
            <div className="eyebrow">Какво намираш тук</div>
            <h2 className="h-section mt-2 max-w-3xl">{activeItem ? activeItem.title : headingText}</h2>
          </div>
          {activeQuizSlug && (
            <button onClick={() => setActiveQuizSlug(null)} className="btn btn-ghost border border-line text-sm bg-soft">
              &larr; Назад към картите
            </button>
          )}
        </div>

        {activeQuizSlug ? (
          <div className="mt-10 max-w-2xl mx-auto w-full">
            <material-decision-quiz key={activeQuizSlug} ref={quizRef}></material-decision-quiz>
          </div>
        ) : (
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {layer.whatYouFind.map((w, i) => {
              const showQuizBtn = Boolean(w.quizSlug && QUIZ_CONFIG_LOADERS[w.quizSlug])
              return (
                <article
                  key={w.key || i}
                  className={`card img-zoom-host bg-paper p-0 overflow-hidden ${showQuizBtn ? 'cursor-pointer hover:border-ink/30 transition-colors' : ''}`}
                  onClick={() => showQuizBtn && setActiveQuizSlug(w.quizSlug)}
                >
                  <div className="media-frame aspect-[4/3]">
                    <img src={imgs[w.key]} alt={w.title} loading="lazy" decoding="async" className="img-cover img-zoom" />
                  </div>
                  <div className="p-6">
                    <div className="font-display text-xl">{w.title}</div>
                    <p className="text-muted text-sm mt-2">{w.text}</p>
                    {showQuizBtn && <div className="mt-4 text-xs font-semibold text-accentDeep flex items-center gap-1">Стартирай избора &rarr;</div>}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

function Professionals({ layer }) {
  const professionals = layer.professionals ?? []

  return (
    <section id="specialisti" className="section bg-soft border-y border-line">
      <div className="container-page">
        <div className="flex items-end justify-between mb-10 reveal flex-wrap gap-4">
          <div>
            <div className="eyebrow">Препоръчани за теб</div>
            <h2 className="h-section mt-2">Хора, на които можеш да разчиташ.</h2>
          </div>
          <Link to="/katalog" className="link-arrow text-sm">Виж всички в каталога →</Link>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {professionals.map((p,i) => (
            <ProfessionalCard
              key={i}
              to={`/profil/${p.slug || slugify(p.name)}`}
              state={{ item: { kind: 'pro', slug: p.slug, layer: layer.slug, layerNumber: layer.number, layerTitle: layer.title, sub: p.tag, ...p } }}
              person={p}
            />
          ))}
          {professionals.length === 0 && (
            <div className="col-span-full border border-dashed border-line rounded-2xl p-8 text-center text-muted">
              Добавяме проверени специалисти за този слой.
            </div>
          )}
        </div>

        <div className="mt-10 text-center reveal">
          <Link to="/katalog" className="btn btn-primary">Виж всички в каталога</Link>
        </div>
      </div>
    </section>
  )
}

function Products({ layer }) {
  const products = layer.products ?? []

  return (
    <section className="section">
      <div className="container-page">
        <div className="flex items-end justify-between mb-10 reveal flex-wrap gap-4">
          <div>
            <div className="eyebrow">{layer.slug === 'materiali' ? 'Подбрани материали' : 'Подбрани продукти'}</div>
            <h2 className="h-section mt-2">{layer.slug === 'materiali' ? 'Качество, на което се разчита.' : 'Готови за поръчка.'}</h2>
          </div>
          <span className="text-sm text-muted hidden md:block">Цените са примерни</span>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {products.map((p,i) => (
            <Link
              key={i}
              to={`/produkt/${slugify(p.name)}`}
              state={{ item: { kind: 'product', layer: layer.slug, layerNumber: layer.number, layerTitle: layer.title, sub: p.cat, ...p } }}
              className="card reveal img-zoom-host p-0 overflow-hidden bg-paper block"
            >
              <div className="media-frame aspect-[4/3]">
                <img src={productImageFor(p.name, layer.slug)} alt={p.name} loading="lazy" decoding="async" className="img-cover img-zoom" />
                <span className="absolute top-3 left-3 text-xs px-2.5 py-1 rounded-full bg-paper/90 text-ink backdrop-blur">{p.tag}</span>
              </div>
              <div className="p-6 border-t border-line">
                <div className="text-xs text-muted">{p.cat}</div>
                <div className="font-display text-xl mt-1">{p.name}</div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-medium">{p.price}</span>
                  <span className="link-arrow text-sm">Виж →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function Showcase({ layer }) {
  const sc = layer.showcase
  const imgs = SHOWCASE_IMAGES[layer.slug] || []
  return (
    <section className="section !pt-0">
      <div className="container-page">
        <div className="eyebrow reveal">{sc.label}</div>
        <h2 className="h-section mt-2 reveal max-w-3xl">Виж какво вече е създадено.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {sc.items.map((it,i) => (
            <article key={i} className="card reveal img-zoom-host p-0 overflow-hidden bg-paper">
              <div className="media-frame aspect-[4/3]">
                <img src={imgs[i]} alt={it.t} loading="lazy" decoding="async" className="img-cover img-zoom" />
                <div className="absolute top-3 left-3 text-xs px-2.5 py-1 rounded-full bg-paper/90 text-ink backdrop-blur">Слой {layer.number}</div>
              </div>
              <div className="p-6 border-t border-line">
                <div className="h-card">{it.t}</div>
                <div className="text-muted text-sm mt-1">{it.who}</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function ProcessSection({ layer }) {
  return (
    <section className="section bg-ink text-paper">
      <div className="container-page">
        <div className="eyebrow !text-paper/60 reveal">Как работим в този слой</div>
        <h2 className="h-section text-paper mt-2 reveal max-w-3xl">Четири стъпки до резултат.</h2>
        <div className="mt-12 grid md:grid-cols-4 gap-8">
          {layer.process.map(s => (
            <div key={s.n} className="reveal border-t border-paper/20 pt-5">
              <div className="font-display text-3xl text-accent">{s.n}</div>
              <div className="font-display text-xl mt-2 text-paper">{s.t}</div>
              <p className="text-paper/70 mt-2 text-sm">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ServicesBand() {
  return (
    <section className="section !py-16">
      <div className="container-page">
        <div className="grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-4 reveal">
            <div className="eyebrow">Нужна е и услуга?</div>
            <h2 className="h-section mt-2">Хоризонталният слой винаги е под ръка.</h2>
            <p className="text-muted mt-3 text-sm">Електричар, ВиК, отопление, smart home — добавяш ги към всеки слой, по всяко време.</p>
            <Link to="/uslugi" className="link-arrow inline-flex mt-5 text-sm">Всички услуги →</Link>
          </div>
          <div className="md:col-span-8 reveal grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SERVICE_DETAILS.slice(0,8).map(s => (
              <Link key={s.slug} to={`/usluga/${s.slug}`} className="group border border-line rounded-xl overflow-hidden hover:border-ink transition block">
                <div className="media-frame aspect-square">
                  <img src={SERVICE_IMAGES[s.slug]} alt={s.name} loading="lazy" decoding="async" className="img-cover img-zoom group-hover:scale-105 transition" />
                </div>
                <div className="p-3 text-sm">{s.name}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function FAQ({ layer }) {
  return (
    <section className="section bg-soft border-y border-line">
      <div className="container-page max-w-4xl">
        <div className="eyebrow reveal">Често задавани въпроси</div>
        <h2 className="h-section mt-2 reveal">За този слой.</h2>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {layer.faq.map((it, i) => (
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

function RelatedLayers({ prev, next }) {
  return (
    <section className="section">
      <div className="container-page flex flex-col md:flex-row gap-6 justify-between border-t border-line pt-10">
        {prev ? (
          <Link to={`/sloy/${prev.slug}`} className="group reveal">
            <div className="eyebrow">← Преди това</div>
            <div className="font-display text-2xl mt-1 group-hover:text-accentDeep transition">{prev.number} · {prev.title}</div>
          </Link>
        ) : <span/>}
        {next ? (
          <Link to={`/sloy/${next.slug}`} className="group md:text-right reveal">
            <div className="eyebrow">След това →</div>
            <div className="font-display text-2xl mt-1 group-hover:text-accentDeep transition">{next.number} · {next.title}</div>
          </Link>
        ) : (
          <Link to="/" className="group md:text-right reveal">
            <div className="eyebrow">Готов кръг →</div>
            <div className="font-display text-2xl mt-1 group-hover:text-accentDeep transition">Обратно към началото</div>
          </Link>
        )}
      </div>
    </section>
  )
}

function CTA({ layer }) {
  return (
    <section className="section !pt-0">
      <div className="container-page rounded-3xl bg-ink text-paper p-10 md:p-16 grid md:grid-cols-12 gap-8 items-center reveal">
        <div className="md:col-span-8">
          <h2 className="h-section text-paper">Готов да влезеш в Слой {layer.number}?</h2>
          <p className="mt-3 text-paper/70 max-w-2xl">Кажи ни в две изречения какво ти трябва. Връщаме се с подходящи хора още същата седмица.</p>
        </div>
        <div className="md:col-span-4 flex md:justify-end gap-3 flex-wrap">
          <Link to="/contact" className="btn btn-primary !bg-accent !text-ink hover:!bg-paper">Заяви консултация</Link>
        </div>
      </div>
    </section>
  )
}

function LayerNotFound() {
  return (
    <section className="section min-h-screen flex items-center bg-soft">
      <div className="container-page max-w-2xl text-center">
        <div className="eyebrow">Слой</div>
        <h1 className="h-section mt-3">Този слой не е намерен.</h1>
        <p className="text-muted mt-3">Върни се към началото и избери един от петте слоя.</p>
        <Link to="/" className="btn btn-primary mt-6 inline-flex">Към началото</Link>
      </div>
    </section>
  )
}

function slugify(s) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
}
