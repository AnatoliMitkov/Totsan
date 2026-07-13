import { Link, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState, useRef } from 'react'
import { LAYER_HEROS, WHAT_YOU_FIND_IMAGES, SHOWCASE_IMAGES } from '../data/images.js'
import ProfessionalCard from '../components/ProfessionalCard.jsx'
import { useProfileDirectory } from '../lib/profiles.js'
import { buildBreadcrumbSchema, buildFaqSchema, useSeo } from '../lib/seo.js'
import { loadPublicPortfolioByLayer, getProjectCover, getPortfolioMeta, portfolioProjectPath } from '../lib/portfolio.js'

export default function Layer({ slug }) {
  const { slug: routeSlug } = useParams()
  const currentSlug = slug || routeSlug
  const { layers } = useProfileDirectory()
  const layer = layers.find(l => l.slug === currentSlug)

  const seoConfig = useMemo(() => {
    if (!currentSlug) return null
    if (!layer) {
      return {
        title: 'Слоят не е намерен | Totsan',
        description: 'Този слой не е наличен или линкът е невалиден.',
        canonicalPath: `/sloy/${currentSlug}`,
        robots: 'noindex, nofollow',
      }
    }

    return {
      title: `Слой ${layer.number} · ${layer.title} | Totsan`,
      description: layer.long,
      canonicalPath: `/sloy/${layer.slug}`,
      jsonLd: [
        buildBreadcrumbSchema([
          { name: 'Начало', path: '/' },
          { name: layer.title, path: `/sloy/${layer.slug}` },
        ]),
        buildFaqSchema(layer.faq.map((item) => ({ question: item.q, answer: item.a }))),
      ],
    }
  }, [currentSlug, layer])

  useSeo(seoConfig)

  if (!layer) return <LayerNotFound />

  const idx = layers.findIndex(l => l.slug === currentSlug)
  const prev = layers[idx - 1]
  const next = layers[idx + 1]

  // скролни нагоре при смяна на слой
  useEffect(() => { window.scrollTo({ top: 0 }) }, [currentSlug])

  const isIdeaLayer = layer.slug === 'ideya'
  const isConstructionLayer = layer.slug === 'postroyka'
  const isMaterialsLayer = layer.slug === 'materiali'
  const isFurnishingLayer = layer.slug === 'obzavezhdane'
  const isDecorationLayer = layer.slug === 'dekoraciya'

  return (
    <>
      <Hero layer={layer} />
      {!isIdeaLayer && !isConstructionLayer && !isMaterialsLayer && !isFurnishingLayer && !isDecorationLayer && <Intro layer={layer} />}
      <WhatYouFind layer={layer} />
      <Professionals layer={layer} />
      <Showcase layer={layer} />
      <ProcessSection layer={layer} />
      {!isIdeaLayer && !isFurnishingLayer && !isDecorationLayer && <ServicesBand layer={layer} />}
      <FAQ layer={layer} />
      <RelatedLayers prev={prev} next={next} />
      <CTA layer={layer} />
    </>
  )
}

function Hero({ layer }) {
  const heroImg = LAYER_HEROS[layer.slug]
  const isIdeaLayer = layer.slug === 'ideya'
  const isConstructionLayer = layer.slug === 'postroyka'
  const isMaterialsLayer = layer.slug === 'materiali'
  const isFurnishingLayer = layer.slug === 'obzavezhdane'
  const isDecorationLayer = layer.slug === 'dekoraciya'
  return (
    <section className="section relative overflow-hidden" style={{ paddingTop: 'calc(var(--header-h, 64px) + var(--section-pad-y, 4rem))' }}>
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
            <Link to={isIdeaLayer || isConstructionLayer || isMaterialsLayer || isFurnishingLayer || isDecorationLayer ? '/start' : '/contact'} className="btn btn-primary">{isIdeaLayer ? 'Опиши идеята си' : isConstructionLayer ? 'Опиши какво ти трябва' : isMaterialsLayer ? 'Намери подходяща посока' : isFurnishingLayer ? 'Опиши какво ти трябва' : isDecorationLayer ? 'Опиши от какво имаш нужда' : 'Заяви консултация'}</Link>
            {isIdeaLayer ? (
              <Link to="/katalog?layer=ideya" className="btn btn-ghost bg-paper/80 backdrop-blur">Разгледай специалистите</Link>
            ) : isConstructionLayer ? (
              <Link to="/katalog?layer=postroyka" className="btn btn-ghost bg-paper/80 backdrop-blur">Разгледай строителите и майсторите</Link>
            ) : isMaterialsLayer ? (
              <Link to="/katalog?layer=materiali&kind=material" className="btn btn-ghost bg-paper/80 backdrop-blur">Разгледай материалите</Link>
            ) : isFurnishingLayer ? (
              <Link to="/katalog?layer=obzavezhdane" className="btn btn-ghost bg-paper/80 backdrop-blur">Разгледай производителите</Link>
            ) : isDecorationLayer ? (
              <Link to="/katalog?layer=dekoraciya" className="btn btn-ghost bg-paper/80 backdrop-blur">Разгледай специалистите</Link>
            ) : (
              <a href="#specialisti" className="btn btn-ghost bg-paper/80 backdrop-blur">Виж специалистите</a>
            )}
          </div>
        </div>
        <div className="lg:col-span-4 reveal">
          <div className="bg-paper/90 backdrop-blur border border-line rounded-2xl p-6">
            <div className="eyebrow mb-3">{isMaterialsLayer ? 'В този раздел ще намерите' : 'В този слой намираш'}</div>
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
  const isMaterialsLayer = layer.slug === 'materiali'
  const headingText = isMaterialsLayer
    ? 'Започнете от това, което избирате'
    : layer.whatYouFind.length === 5
      ? 'Пет посоки. Един слой.'
      : 'Четири посоки. Един слой.'
  const helperText = isMaterialsLayer
    ? 'Изберете категория и Totsan ще ви помогне да разберете какво е важно преди покупка, монтаж или разговор със специалист.'
    : ''

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
            {!activeItem && helperText && <p className="mt-3 max-w-2xl text-muted">{helperText}</p>}
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
              const hasDirectHref = Boolean(w.href)
              const sectionRoute = w.key === 'garden'
                ? '/gradina-i-dvor'
                : w.key === 'wallpaper'
                  ? '/tapeti-i-cvetove'
                : w.key === 'decor'
                  ? '/dekorativni-akcenti'
                : w.key === 'terrace'
                  ? '/terasi-i-vunshni-zoni'
                : w.key === 'kitchen'
                  ? '/kuhni'
                : w.key === 'bedroom'
                  ? '/spalnya-i-dnevna'
                : w.key === 'bathroom'
                  ? '/banya'
                : w.key === 'lighting'
                  ? '/osvetlenie-i-tekstil'
                  : ''

              const cardContent = (
                <>
                  <div className="media-frame aspect-[4/3]">
                    <img src={imgs[w.key]} alt={w.title} loading="lazy" decoding="async" className="img-cover img-zoom" />
                  </div>
                  <div className="p-6">
                    <div className="font-display text-xl">{w.title}</div>
                    <p className="text-muted text-sm mt-2">{w.text}</p>
                    {hasDirectHref && <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-accentSoft px-3 py-1.5 text-xs font-semibold text-accentDeep">{w.ctaText || 'Отвори'} &rarr;</div>}
                    {showQuizBtn && <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-accentSoft px-3 py-1.5 text-xs font-semibold text-accentDeep">{w.ctaText || 'Стартирай избора'} &rarr;</div>}
                    {sectionRoute && <div className="mt-4 text-xs font-semibold text-accentDeep flex items-center gap-1">Разгледай секцията &rarr;</div>}
                  </div>
                </>
              )

              if (hasDirectHref) {
                return (
                  <Link
                    key={w.key || i}
                    to={w.href}
                    className="card img-zoom-host bg-paper p-0 overflow-hidden cursor-pointer hover:border-ink/30 transition-colors block"
                  >
                    {cardContent}
                  </Link>
                )
              }

              if (sectionRoute) {
                return (
                  <Link
                    key={w.key || i}
                    to={sectionRoute}
                    className="card img-zoom-host bg-paper p-0 overflow-hidden cursor-pointer hover:border-ink/30 transition-colors block"
                  >
                    {cardContent}
                  </Link>
                )
              }

              return (
                <article
                  key={w.key || i}
                  className={`card img-zoom-host bg-paper p-0 overflow-hidden ${showQuizBtn ? 'cursor-pointer hover:border-ink/30 transition-colors' : ''}`}
                  onClick={() => showQuizBtn && setActiveQuizSlug(w.quizSlug)}
                >
                  {cardContent}
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
  const catalogLayerPath = `/katalog?layer=${layer.slug}`
  const isMaterialsLayer = layer.slug === 'materiali'

  return (
    <section id="specialisti" className="section bg-soft border-y border-line">
      <div className="container-page">
        <div className="flex items-end justify-between mb-10 reveal flex-wrap gap-4">
          <div>
            <div className="eyebrow">{isMaterialsLayer ? 'Материали и монтаж' : 'Препоръчани за теб'}</div>
            <h2 className="h-section mt-2">{isMaterialsLayer ? 'Специалисти за материали и монтаж' : 'Хора, на които можеш да разчиташ.'}</h2>
          </div>
          <Link to={catalogLayerPath} className="link-arrow text-sm">{isMaterialsLayer ? 'Виж специалисти за материали →' : 'Виж каталога за този слой →'}</Link>
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
              {isMaterialsLayer
                ? 'Добавяме проверени партньори за този раздел — доставчици, консултанти и изпълнители, които могат да помогнат с избор, доставка или монтаж.'
                : 'Добавяме проверени специалисти за този слой.'}
            </div>
          )}
        </div>

        <div className="mt-10 text-center reveal">
          <Link to={catalogLayerPath} className="btn btn-primary">{isMaterialsLayer ? 'Виж специалисти за материали' : 'Виж каталога за този слой'}</Link>
        </div>
      </div>
    </section>
  )
}

function Showcase({ layer }) {
  const sc = layer.showcase
  const imgs = SHOWCASE_IMAGES[layer.slug] || []
  const isMaterialsLayer = layer.slug === 'materiali'
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    async function fetchProjects() {
      try {
        const data = await loadPublicPortfolioByLayer(layer.slug)
        if (!active) return
        setProjects(data || [])
      } catch (err) {
        console.error('Failed to load portfolio items for showcase:', err)
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchProjects()
    return () => {
      active = false
    }
  }, [layer.slug])

  const fallbackItems = useMemo(() => {
    return sc.items.map(it => {
      let whoClean = 'Вдъхновение от практиката'
      if (it.who) {
        const parts = it.who.split('·')
        if (parts.length > 1) {
          whoClean = `Вдъхновение · ${parts[1].trim()}`
        } else {
          whoClean = `Вдъхновение · ${it.who.trim()}`
        }
      }
      return {
        ...it,
        who: whoClean
      }
    })
  }, [sc.items])

  const itemsToRender = useMemo(() => {
    if (projects.length === 0) return []
    let list = [...projects]
    while (list.length < 8) {
      list = [...list, ...projects]
    }
    return [...list, ...list]
  }, [projects])

  if (loading) {
    return (
      <section className="section !pt-0">
        <div className="container-page">
          <div className="eyebrow">{sc.label}</div>
          <h2 className="h-section mt-2 max-w-3xl">
            {isMaterialsLayer ? 'Материали в реални проекти' : 'Виж какво вече е създадено.'}
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="card p-0 overflow-hidden bg-paper/50 animate-pulse h-[400px] flex flex-col justify-between border border-line/40">
                <div className="aspect-[4/3] bg-cloud/50 w-full" />
                <div className="p-6 flex-1 space-y-3">
                  <div className="h-4 bg-cloud/60 rounded w-1/4" />
                  <div className="h-6 bg-cloud/70 rounded w-3/4" />
                </div>
                <div className="p-6 border-t border-line/40 h-16 bg-cloud/30" />
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="section !pt-0 overflow-hidden">
      <div className="container-page">
        <div className="eyebrow">{sc.label}</div>
        <h2 className="h-section mt-2 max-w-3xl">{isMaterialsLayer ? 'Материали в реални проекти' : 'Виж какво вече е създадено.'}</h2>
        {isMaterialsLayer && (
          <p className="mt-3 max-w-2xl text-muted">
            Вижте как различни материали изглеждат в завършени обекти и каква роля имат в проекта.
          </p>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="container-page mt-10">
          <div className="grid gap-5 md:grid-cols-3">
            {fallbackItems.map((it, i) => (
              <article key={i} className="card img-zoom-host p-0 overflow-hidden bg-paper">
                <div className="media-frame aspect-[4/3]">
                  <img src={imgs[i]} alt={it.t} loading="lazy" decoding="async" className="img-cover img-zoom" />
                  <div className="absolute top-3 left-3 text-xs px-2.5 py-1 rounded-full bg-paper/90 text-ink backdrop-blur font-semibold">{isMaterialsLayer ? 'Материали' : `Слой ${layer.number}`}</div>
                </div>
                <div className="p-6 border-t border-line">
                  <div className="h-card">{it.t}</div>
                  <div className="text-muted text-sm mt-1">{it.who}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : projects.length < 3 ? (
        <div className="container-page mt-10">
          <div className="flex flex-wrap justify-center gap-6">
            {projects.map((item) => {
              const cover = getProjectCover(item)
              const meta = getPortfolioMeta(item)
              return (
                <Link
                  key={item.id}
                  to={portfolioProjectPath(item.profile?.slug || '', item.id)}
                  className="card img-zoom-host p-0 overflow-hidden bg-paper w-[290px] sm:w-[360px] md:w-[400px] shrink-0 flex flex-col justify-between hover:border-ink/30 transition-colors block group"
                >
                  <div>
                    <div className="media-frame aspect-[4/3] relative overflow-hidden bg-soft">
                      {cover ? (
                        <img
                          src={cover}
                          alt={item.title}
                          loading="lazy"
                          decoding="async"
                          className="img-cover img-zoom w-full h-full object-cover transition duration-700 ease-out"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-soft text-muted text-sm font-medium">Няма снимка</div>
                      )}
                      <div className="absolute top-3 left-3 text-xs px-2.5 py-1 rounded-full bg-paper/90 text-ink backdrop-blur font-semibold">Слой {layer.number}</div>
                      {meta && (
                        <span className="absolute bottom-3 left-3 right-3 truncate rounded-full border border-white/15 bg-ink/28 px-3 py-1.5 text-xs font-semibold text-paper shadow-[0_14px_35px_rgba(7,31,55,0.18)] backdrop-blur-md">{meta}</span>
                      )}
                    </div>
                    <div className="p-6">
                      {item.profile?.tag && (
                        <span className="inline-flex items-center rounded-full bg-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accentDeep mb-2">{item.profile.tag}</span>
                      )}
                      <h3 className="h-card line-clamp-2 leading-tight text-ink font-semibold group-hover:text-accentDeep transition-colors duration-200">{item.title}</h3>
                    </div>
                  </div>
                  <div className="px-6 pb-6 border-t border-line/60 pt-4 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-xs text-muted">Студио / Партньор</div>
                      <div className="text-sm font-semibold text-ink truncate mt-0.5">{item.profile?.name || 'Totsan Партньор'}</div>
                    </div>
                    <div className="text-accentDeep font-semibold text-xs shrink-0 flex items-center gap-1 group-hover:underline">Виж проекта &rarr;</div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="mask-marquee w-full mt-10 relative">
          <div className="animate-marquee-ltr flex gap-6 py-4">
            {itemsToRender.map((item, index) => {
              const cover = getProjectCover(item)
              const meta = getPortfolioMeta(item)
              return (
                <Link
                  key={`${item.id}-${index}`}
                  to={portfolioProjectPath(item.profile?.slug || '', item.id)}
                  className="card img-zoom-host p-0 overflow-hidden bg-paper w-[290px] sm:w-[360px] md:w-[400px] shrink-0 flex flex-col justify-between hover:border-ink/30 transition-colors block group"
                >
                  <div>
                    <div className="media-frame aspect-[4/3] relative overflow-hidden bg-soft">
                      {cover ? (
                        <img
                          src={cover}
                          alt={item.title}
                          loading="lazy"
                          decoding="async"
                          className="img-cover img-zoom w-full h-full object-cover transition duration-700 ease-out"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-soft text-muted text-sm font-medium">Няма снимка</div>
                      )}
                      <div className="absolute top-3 left-3 text-xs px-2.5 py-1 rounded-full bg-paper/90 text-ink backdrop-blur font-semibold">Слой {layer.number}</div>
                      {meta && (
                        <span className="absolute bottom-3 left-3 right-3 truncate rounded-full border border-white/15 bg-ink/28 px-3 py-1.5 text-xs font-semibold text-paper shadow-[0_14px_35px_rgba(7,31,55,0.18)] backdrop-blur-md">{meta}</span>
                      )}
                    </div>
                    <div className="p-6">
                      {item.profile?.tag && (
                        <span className="inline-flex items-center rounded-full bg-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accentDeep mb-2">{item.profile.tag}</span>
                      )}
                      <h3 className="h-card line-clamp-2 leading-tight text-ink font-semibold group-hover:text-accentDeep transition-colors duration-200">{item.title}</h3>
                    </div>
                  </div>
                  <div className="px-6 pb-6 border-t border-line/60 pt-4 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-xs text-muted">Студио / Партньор</div>
                      <div className="text-sm font-semibold text-ink truncate mt-0.5">{item.profile?.name || 'Totsan Партньор'}</div>
                    </div>
                    <div className="text-accentDeep font-semibold text-xs shrink-0 flex items-center gap-1 group-hover:underline">Виж проекта &rarr;</div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

function ProcessSection({ layer }) {
  const isMaterialsLayer = layer.slug === 'materiali'

  return (
    <section className="section bg-ink text-paper">
      <div className="container-page">
        <div className="eyebrow !text-paper/60 reveal">{isMaterialsLayer ? 'Как Totsan помага при избор на материал' : 'Как работим в този слой'}</div>
        <h2 className="h-section text-paper mt-2 reveal max-w-3xl">{isMaterialsLayer ? 'От неясен избор до подготвено запитване' : 'Четири стъпки до резултат.'}</h2>
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

function ServicesBand({ layer }) {
  const isMaterialsLayer = layer.slug === 'materiali'
  const cards = isMaterialsLayer
    ? [
        { title: 'Публикувай запитване', text: 'Опишете какво избирате, за кое помещение е и какво ви притеснява.', to: '/start', cta: 'Създай запитване' },
        { title: 'Разгледай каталога', text: 'Вижте специалисти, услуги и материали, свързани с този раздел.', to: `/katalog?layer=${layer.slug}`, cta: 'Отвори каталога' },
      ]
    : [
        { title: 'Публикувани услуги', text: 'Само реални оферти от партньори с профил в Totsan.', to: '/uslugi' },
        { title: 'Каталог', text: 'Прегледай специалисти, услуги и материални решения за този слой.', to: `/katalog?layer=${layer.slug}` },
      ]

  return (
    <section className="section !py-16">
      <div className="container-page">
        <div className="grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-4 reveal">
            <div className="eyebrow">{isMaterialsLayer ? 'Неясен избор?' : 'Нужна е и услуга?'}</div>
            <h2 className="h-section mt-2">{isMaterialsLayer ? 'Не сте сигурни откъде да започнете?' : 'Хоризонталният слой винаги е под ръка.'}</h2>
            <p className="text-muted mt-3 text-sm">
              {isMaterialsLayer
                ? 'При материалите правилният избор често зависи от помещението, основата, монтажа и поддръжката. Започнете с помощник или изпратете запитване към специалист.'
                : 'Електричар, ВиК, отопление, smart home — добавяш ги към всеки слой, по всяко време.'}
            </p>
            <Link to={isMaterialsLayer ? '/start' : '/uslugi'} className="link-arrow inline-flex mt-5 text-sm">{isMaterialsLayer ? 'Започни помощника →' : 'Всички услуги →'}</Link>
          </div>
          <div className="md:col-span-8 reveal grid gap-4 sm:grid-cols-2">
            {cards.map(card => (
              <Link key={card.title} to={card.to} className="rounded-2xl border border-line bg-paper p-6 transition hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-sm">
                <div className="font-display text-3xl text-ink">{card.title}</div>
                <p className="mt-3 text-sm leading-relaxed text-muted">{card.text}</p>
                <div className="mt-5 text-sm font-medium text-ink underline underline-offset-4">{card.cta || 'Отвори'} →</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function FAQ({ layer }) {
  const isMaterialsLayer = layer.slug === 'materiali'

  return (
    <section className="section bg-soft border-y border-line">
      <div className="container-page max-w-4xl">
        <div className="eyebrow reveal">Често задавани въпроси</div>
        <h2 className="h-section mt-2 reveal">{isMaterialsLayer ? 'Често задавани въпроси за материалите' : 'За този слой.'}</h2>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {layer.faq.map((it, i) => (
            <details key={i} className="group py-5 reveal">
              <summary className="cursor-pointer flex items-center justify-between gap-4 list-none">
                <span className="font-display text-[1.5rem] leading-tight md:text-[1.75rem]">{it.q}</span>
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
  const isIdeaLayer = layer.slug === 'ideya'
  const isConstructionLayer = layer.slug === 'postroyka'
  const isMaterialsLayer = layer.slug === 'materiali'
  const isFurnishingLayer = layer.slug === 'obzavezhdane'
  const isDecorationLayer = layer.slug === 'dekoraciya'
  return (
    <section className="section !pt-0">
      <div className="container-page rounded-3xl bg-ink text-paper p-10 md:p-16 grid md:grid-cols-12 gap-8 items-center reveal">
        <div className="md:col-span-8">
          <h2 className="h-section text-paper">{isMaterialsLayer ? 'Готови ли сте да изберете по-уверено?' : `Готов да влезеш в Слой ${layer.number}?`}</h2>
          <p className="mt-3 text-paper/70 max-w-2xl">
            {isMaterialsLayer
              ? 'Започнете с помощник или разгледайте материалните категории, за да разберете какво е подходящо за вашия проект.'
              : 'Кажи ни в две изречения какво ти трябва. Връщаме се с подходящи хора още същата седмица.'}
          </p>
        </div>
        <div className="md:col-span-4 flex md:justify-end gap-3 flex-wrap">
          <Link to={isIdeaLayer || isConstructionLayer || isMaterialsLayer || isFurnishingLayer || isDecorationLayer ? '/start' : '/contact'} className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep">{isIdeaLayer ? 'Опиши идеята си' : isConstructionLayer ? 'Опиши какво ти трябва' : isMaterialsLayer ? 'Намери подходяща посока' : isFurnishingLayer ? 'Опиши какво ти трябва' : isDecorationLayer ? 'Опиши от какво имаш нужда' : 'Заяви консултация'}</Link>
          {isIdeaLayer && <Link to="/katalog?layer=ideya" className="btn btn-ghost !border-paper/30 !text-paper hover:!bg-paper/10">Разгледай специалистите</Link>}
          {isConstructionLayer && <Link to="/katalog?layer=postroyka" className="btn btn-ghost !border-paper/30 !text-paper hover:!bg-paper/10">Разгледай строителите и майсторите</Link>}
          {isMaterialsLayer && <Link to="/katalog?layer=materiali&kind=material" className="btn btn-ghost !border-paper/30 !text-paper hover:!bg-paper/10">Разгледай материалите</Link>}
          {isFurnishingLayer && <Link to="/katalog?layer=obzavezhdane" className="btn btn-ghost !border-paper/30 !text-paper hover:!bg-paper/10">Разгледай производителите</Link>}
          {isDecorationLayer && <Link to="/katalog?layer=dekoraciya" className="btn btn-ghost !border-paper/30 !text-paper hover:!bg-paper/10">Разгледай специалистите</Link>}
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
