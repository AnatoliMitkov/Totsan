import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Pause, 
  Play, 
  ChevronRight, 
  Sparkles, 
  ArrowRight, 
  Compass, 
  CheckCircle2, 
  UserCheck, 
  ShieldCheck, 
  Clock, 
  HelpCircle 
} from 'lucide-react'
import { gsap } from 'gsap'
import { LAYERS } from '../data/layers.js'
import { HOME_PROJECTS, PARTNER_LOGOS, LAYER_HEROS } from '../data/images.js'

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
      <LayersTimelineExplorer />
      <DreamBuilderQuiz />
      <SectionDivider label="Услуги" />
      <ServicesStrip />
      <SectionDivider label="Реални примери" />
      <Projects />
      <SectionDivider label="Как работи" />
      <HowItWorks />
      <SectionDivider label="Още от Totsan" />
      <Trust />
      <ProTeaser />
      <Testimonial />
      <FAQ />
      <CTA />
    </>
  )
}

function Hero() {
  const videoRef = useRef(null)
  const heroRef = useRef(null)
  const hideTimerRef = useRef(null)
  const [videoReady, setVideoReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)
  const [isTouchMode, setIsTouchMode] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(false)

  // GSAP Entrance Animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.hero-animate-eyebrow',
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }
      )
      gsap.fromTo('.hero-animate-title-line',
        { opacity: 0, y: 25 },
        { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.18, delay: 0.15 }
      )
      gsap.fromTo('.hero-animate-lead',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out', delay: 0.5 }
      )
      gsap.fromTo('.hero-animate-cta',
        { opacity: 0, scale: 0.96, y: 10 },
        { opacity: 1, scale: 1, y: 0, duration: 0.8, ease: 'back.out(1.2)', delay: 0.7, stagger: 0.1 }
      )
    }, heroRef)

    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(hover: none), (pointer: coarse)')
    const syncTouchMode = () => {
      setIsTouchMode(mediaQuery.matches)
    }

    syncTouchMode()
    mediaQuery.addEventListener('change', syncTouchMode)

    return () => {
      mediaQuery.removeEventListener('change', syncTouchMode)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined

    const updateDuration = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0)
    }
    const updateTime = () => {
      if (!isSeeking) {
        setCurrentTime(video.currentTime || 0)
      }
    }
    const updatePlaying = () => {
      setIsPlaying(!video.paused)
    }

    updateDuration()
    updateTime()
    updatePlaying()

    video.addEventListener('loadedmetadata', updateDuration)
    video.addEventListener('durationchange', updateDuration)
    video.addEventListener('timeupdate', updateTime)
    video.addEventListener('play', updatePlaying)
    video.addEventListener('pause', updatePlaying)

    return () => {
      video.removeEventListener('loadedmetadata', updateDuration)
      video.removeEventListener('durationchange', updateDuration)
      video.removeEventListener('timeupdate', updateTime)
      video.removeEventListener('play', updatePlaying)
      video.removeEventListener('pause', updatePlaying)
    }
  }, [isSeeking])

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return '0:00'
    const totalSeconds = Math.max(0, Math.floor(seconds))
    const minutes = Math.floor(totalSeconds / 60)
    const remainingSeconds = totalSeconds % 60

    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const togglePlayback = async () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      try {
        await video.play()
      } catch {
        setIsPlaying(false)
      }
      return
    }

    video.pause()
  }

  const handleSeek = (event) => {
    const nextTime = Number(event.target.value)
    setCurrentTime(nextTime)

    if (videoRef.current) {
      videoRef.current.currentTime = nextTime
    }
  }

  const scheduleHideControls = () => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current)
    }
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false)
    }, 3000)
  }

  const showControlsWithTimeout = () => {
    setControlsVisible(true)
    scheduleHideControls()
  }

  const handleHeroPointerDown = (event) => {
    if (!heroRef.current) return

    if (event.pointerType === 'mouse') {
      showControlsWithTimeout()
      return
    }

    if (!isTouchMode) return

    const controls = heroRef.current.querySelector('.home-hero__video-controls')
    const content = heroRef.current.querySelector('.home-hero__content')

    if (controls?.contains(event.target) || content?.contains(event.target)) return

    setControlsVisible((visible) => {
      if (visible) {
        if (hideTimerRef.current) {
          window.clearTimeout(hideTimerRef.current)
        }
        return false
      }
      scheduleHideControls()
      return true
    })
  }

  const handleHeroPointerMove = (event) => {
    if (event.pointerType !== 'mouse') return
    showControlsWithTimeout()
  }

  const handleControlsInteraction = () => {
    showControlsWithTimeout()
  }

  return (
    <section
      ref={heroRef}
      className={`home-hero ${controlsVisible ? 'home-hero--controls-visible' : ''}`}
      onPointerDown={handleHeroPointerDown}
      onPointerMove={handleHeroPointerMove}
      onMouseLeave={() => setControlsVisible(false)}
      onKeyDown={handleControlsInteraction}
      onFocus={handleControlsInteraction}>
      <div className="home-hero__media-shell" aria-hidden="true">
        <img
          src={HERO_POSTER_SRC}
          alt=""
          className={`home-hero__image ${videoReady ? 'is-hidden' : ''}`}
          loading="eager"
          decoding="async"
        />
        <video
          ref={videoRef}
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
      <div
        className={`home-hero__video-controls ${controlsVisible ? 'is-visible' : ''}`}
        aria-label="Hero video controls">
        <button
          type="button"
          className={`home-hero__video-button ${isPlaying ? 'is-playing' : ''}`}
          onClick={togglePlayback}
          onPointerDown={handleControlsInteraction}
          aria-label={isPlaying ? 'Pause hero video' : 'Play hero video'}>
          <span className="home-hero__video-button-icon" aria-hidden="true">
            {isPlaying ? <Pause size={18} strokeWidth={2.4} /> : <Play size={18} strokeWidth={2.4} />}
          </span>
        </button>
        <span className="home-hero__video-time">{formatTime(currentTime)}</span>
        <input
          className="home-hero__video-slider"
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          onChange={handleSeek}
          onInput={handleControlsInteraction}
          onPointerDown={() => setIsSeeking(true)}
          onPointerUp={() => setIsSeeking(false)}
          onKeyDown={() => setIsSeeking(true)}
          onKeyUp={() => setIsSeeking(false)}
          aria-label="Seek hero video"
          style={{ '--video-progress': `${duration ? (currentTime / duration) * 100 : 0}%` }}
        />
        <span className="home-hero__video-time">{formatTime(duration)}</span>
      </div>
      <div className="container-page home-hero__overlay">
        <div className="home-hero__content">
          <div className="eyebrow home-hero__eyebrow mb-4 hero-animate-eyebrow">Платформа за ремонт, строителство и обзавеждане</div>
          <h1 className="h-display home-hero__title text-paper">
            <span className="home-hero__title-line home-hero__title-line--top hero-animate-title-line">Твоят сигурен избор в</span>
            <span className="home-hero__title-line home-hero__title-line--bottom text-accent italic hero-animate-title-line">строителството.</span>
          </h1>
          <p className="home-hero__lead mt-5 max-w-xl hero-animate-lead" style={{fontSize:'var(--step-md)'}}>
            От идея до завършен дом — на едно място. Отговаряш на няколко въпроса, а ние те насочваме към правилните проверени специалисти, материали и услуги. Безплатно за теб, със защитено плащане.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/start" className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep hero-animate-cta">
              Започни оттук — безплатно →
            </Link>
            <a href="#layers-explorer" className="btn btn-ghost !border-paper/25 !bg-paper/10 !text-paper hover:!border-paper/50 hover:!bg-paper/15 hero-animate-cta">
              Виж слоевете
            </a>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-paper/80 hero-animate-cta">
            <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-accent" /> Защитено плащане</span>
            <span className="inline-flex items-center gap-2"><UserCheck size={16} className="text-accent" /> Проверени партньори</span>
            <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-accent" /> Безплатно за клиенти</span>
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

function AnimatedStatCounter({ end, suffix = '', label }) {
  const [count, setCount] = useState(0)
  const elementRef = useRef(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true
        let startTimestamp = null
        const duration = 1600
        const step = (timestamp) => {
          if (!startTimestamp) startTimestamp = timestamp
          const progress = Math.min((timestamp - startTimestamp) / duration, 1)
          setCount(Math.floor(progress * end))
          if (progress < 1) {
            window.requestAnimationFrame(step)
          } else {
            setCount(end)
          }
        }
        window.requestAnimationFrame(step)
      }
    }, { threshold: 0.15 })

    if (elementRef.current) {
      observer.observe(elementRef.current)
    }

    return () => observer.disconnect()
  }, [end])

  return (
    <div ref={elementRef} className="text-center p-4 border border-line bg-paper/50 rounded-2xl">
      <div className="font-display text-4xl lg:text-5xl text-accentDeep font-bold">
        {count}
        {suffix}
      </div>
      <div className="mt-2 text-xs uppercase tracking-wider text-muted font-medium">
        {label}
      </div>
    </div>
  )
}

function Promise() {
  const items = [
    { k:'Само проверени', v:'Никой не влиза в Totsan, ако не доказва качество.', icon: <UserCheck className="text-accent" size={24} /> },
    { k:'Един разказ', v:'Сайтът те води стъпка по стъпка, без да ровиш в Google.', icon: <Compass className="text-accent" size={24} /> },
    { k:'Реални оферти', v:'Виждаш цени, наличности и условия — без скрити „звездички“.', icon: <ShieldCheck className="text-accent" size={24} /> }
  ]
  return (
    <section className="section bg-soft border-y border-line">
      <div className="container-page">
        <div className="mb-6 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            <Sparkles size={14} className="text-accent" /> Ранен достъп · пилотна фаза
          </span>
        </div>
        {/* Rolling Counters Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          <AnimatedStatCounter end={5} label="Слоя на създаване" suffix="" />
          <AnimatedStatCounter end={100} label="Проверени партньори" suffix="%" />
          <AnimatedStatCounter end={0} label="Такси за клиента" suffix="%" />
          <AnimatedStatCounter end={100} label="Защитено плащане" suffix="%" />
        </div>

        {/* Value Propositions */}
        <div className="grid md:grid-cols-3 gap-8">
          {items.map((i, idx) => (
            <div key={idx} className="reveal flex gap-4 p-6 bg-paper rounded-2xl border border-line shadow-sm">
              <div className="shrink-0 p-3 bg-accentSoft rounded-xl h-fit">
                {i.icon}
              </div>
              <div>
                <div className="font-display text-ink text-2xl font-bold">{i.k}</div>
                <div className="text-muted mt-2 text-sm leading-relaxed">{i.v}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Interactive Layers Timeline Explorer (GSAP) ──────────────────────────────
function LayersTimelineExplorer() {
  const [activeIndex, setActiveIndex] = useState(0)
  const detailPanelRef = useRef(null)

  useEffect(() => {
    // GSAP fade-up effect on content switch
    if (detailPanelRef.current) {
      gsap.fromTo(detailPanelRef.current,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
      )
    }
  }, [activeIndex])

  const activeLayer = LAYERS[activeIndex]

  return (
    <section id="layers-explorer" className="section bg-paper">
      <div className="container-page">
        <div className="max-w-3xl mb-12">
          <div className="eyebrow reveal">Петте слоя на създаването</div>
          <h2 className="h-section mt-3 reveal">Кой етап от строежа си днес?</h2>
          <p className="mt-4 text-muted reveal">
            Раздробихме целия хаотичен процес на 5 последователни етапа. Избери своя етап и виж как можем да ти помогнем.
          </p>
        </div>

        <div className="grid min-w-0 lg:grid-cols-[22rem_minmax(0,1fr)] gap-10 items-start">
          {/* Vertical Menu Timeline */}
          <div className="flex w-full min-w-0 flex-col gap-3 relative border-l border-line pl-4 py-2">
            {LAYERS.map((layer, index) => {
              const isActive = index === activeIndex
              return (
                <button
                  key={layer.slug}
                  onClick={() => setActiveIndex(index)}
                  className={`timeline-btn w-full max-w-full text-left py-3 px-4 rounded-xl transition-all duration-300 relative focus:outline-none overflow-hidden ${
                    isActive 
                      ? 'bg-accentSoft text-accentDeep font-bold border-l-2 border-accent' 
                      : 'hover:bg-soft text-muted hover:text-ink'
                  }`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`font-mono text-sm px-2 py-0.5 rounded ${
                      isActive ? 'bg-accent text-paper' : 'bg-cloud text-ink/70'
                    }`}>
                      {layer.number}
                    </span>
                    <span className="font-display text-lg min-w-0 truncate">{layer.title}</span>
                  </div>
                  <p className="text-xs text-muted/70 mt-1 pl-10 font-normal truncate">
                    {layer.short}
                  </p>
                </button>
              )
            })}
          </div>

          {/* Interactive Glassmorphic Display Panel */}
          <div 
            ref={detailPanelRef}
            className="layer-detail-panel card w-full max-w-full p-8 bg-gradient-to-br from-soft/50 via-paper to-cloud/20 border border-line shadow-md rounded-3xl grid md:grid-cols-12 gap-8 min-h-[30rem] items-stretch min-w-0 overflow-hidden">
            
            <div className="md:col-span-7 flex min-w-0 flex-col justify-between gap-6">
              <div>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="font-display text-4xl text-accentDeep font-bold">
                    {activeLayer.number}
                  </span>
                  <div className="h-px w-8 bg-accent" />
                  <span className="eyebrow min-w-0 tracking-wider">{activeLayer.title}</span>
                </div>

                <h3 className="font-display text-3xl text-ink font-bold mt-4 min-w-0">
                  {activeLayer.short}
                </h3>
                
                <p className="text-muted mt-4 text-sm leading-relaxed">
                  {activeLayer.long}
                </p>

                <blockquote className="mt-5 border-l-4 border-accentSoft pl-4 italic text-xs text-muted/80">
                  {activeLayer.heroQuote}
                </blockquote>

                <div className="mt-6">
                  <div className="text-xs uppercase tracking-wider text-ink font-bold mb-3 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-accent" />
                    <span>Какво включва:</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {activeLayer.pros.map((pro, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted">
                        <CheckCircle2 size={12} className="text-trustGreen" />
                        <span>{pro}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 items-center mt-4">
                <Link 
                  to={`/sloy/${activeLayer.slug}`}
                  className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep">
                  Влез в слоя →
                </Link>
                <Link 
                  to="/contact" 
                  className="btn btn-ghost !border-accent/30 hover:!border-accent !text-accent hover:bg-accentSoft/30">
                  Заяви консултация
                </Link>
              </div>
            </div>

            {/* Visual Panel Right */}
            <div className="md:col-span-5 relative rounded-2xl overflow-hidden min-h-[16rem] md:min-h-full">
              <img 
                src={LAYER_HEROS[activeLayer.slug]} 
                alt={activeLayer.title} 
                className="absolute inset-0 w-full h-full object-cover rounded-2xl transform scale-100 hover:scale-105 transition-transform duration-700" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent pointer-events-none" />
              
              <div className="absolute bottom-4 left-4 right-4 text-paper">
                <div className="text-[10px] uppercase tracking-wider text-accentSoft font-bold">Препоръчан старт</div>
                <div className="font-display text-lg font-medium leading-tight mt-0.5">
                  {activeLayer.process ? activeLayer.process[0].t : 'Консултация'}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}

// ── Interactive Dream Builder Quiz Widget ────────────────────────────────────
function DreamBuilderQuiz() {
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState({
    scope: '',
    stage: '',
    priority: ''
  })
  const [result, setResult] = useState(null)

  const quizRef = useRef(null)

  const handleSelect = (field, val) => {
    setAnswers(prev => ({ ...prev, [field]: val }))
  }

  const nextStep = () => {
    if (step < 3) {
      setStep(prev => prev + 1)
      // Smooth slide-up transition
      gsap.fromTo('.quiz-step-container', 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
      )
    } else {
      calculateResult()
    }
  }

  const resetQuiz = () => {
    setAnswers({ scope: '', stage: '', priority: '' })
    setResult(null)
    setStep(1)
  }

  const saveResultAsProjectBrief = () => {
    if (!result?.layer || typeof window === 'undefined') return

    window.localStorage.setItem('totsan.pendingProjectBrief', JSON.stringify({
      title: `Проект: ${result.layer.title}`,
      currentLayerSlug: result.layer.slug,
      ideaDescription: [
        'Начален резултат от Totsan quiz:',
        result.description,
        'Препоръчителни стъпки:',
        ...result.steps.map((item, index) => `${index + 1}. ${item}`),
      ].join('\n'),
      quizAnswers: {
        home: {
          title: 'Начален Totsan quiz',
          answers,
          recommendation: {
            layerSlug: result.layer.slug,
            layerTitle: result.layer.title,
            description: result.description,
            steps: result.steps,
          },
        },
      },
    }))
  }

  const calculateResult = () => {
    let recommendedLayer = 'ideya'
    let text = ''
    let stepsList = []

    const { scope, stage } = answers

    if (stage === 'idea') {
      recommendedLayer = 'ideya'
      text = 'Тъй като проектът ви е още в концептуална фаза, препоръчваме да започнете от Слой 01: Идея и консултация. Тук архитекти и интериорни дизайнери ще оформят визията и плановете ви.'
      stepsList = [
        'Намерете архитект за идейно заснемане.',
        'Направете 3D визуализация, за да усетите пространството.',
        'Консултирайте се безплатно по бюджетирането.'
      ]
    } else if (stage === 'plans') {
      recommendedLayer = 'postroyka'
      text = 'С готови планове сте готови за Слой 02: Постройка и имот. Имате нужда от инженери, надзор и проверени строителни екипи, които да реализират плановете.'
      stepsList = [
        'Поискайте оферти за груб или довършителен строеж.',
        'Намерете технически ръководител или строителен инспектор.',
        'Прегледайте договорите и гаранциите с юрист.'
      ]
    } else if (stage === 'materials') {
      if (scope === 'cosmetic' || scope === 'room') {
        recommendedLayer = 'obzavezhdane'
        text = 'Вие сте на крачка от завършването. Слой 04: Обзавеждане ще ви предложи мебели по поръчка, електроуреди и осветление за конкретните стаи.'
        stepsList = [
          'Разгледайте готови кухни или поръчайте индивидуален дизайн.',
          'Свържете се със специалисти за монтаж на уреди.',
          'Изберете осветление с комфортен светлинен спектър.'
        ]
      } else {
        recommendedLayer = 'materiali'
        text = 'Имате планове, но търсите верния баланс между цена и качество. Препоръчваме ви Слой 03: Материали. Сравнете цени и поръчайте настилки, изолации и дограма.'
        stepsList = [
          'Вземете мостри за бои и настилки.',
          'Изберете профили за високоенергийна дограма.',
          'Свържете се с дистрибутори директно за проектни цени.'
        ]
      }
    } else {
      recommendedLayer = 'dekoraciya'
      text = 'Строежът и големите мебели са готови. Слой 05: Декорация и финал ще ви помогне да превърнете пространството в дом със стенни облицовки, перголи, озеленяване и финални детайли.'
      stepsList = [
        'Намерете ландшафтен архитект за озеленяване на двора/терасата.',
        'Поръчайте дизайнерски тапети или декоративни мазилки.',
        'Добавете смарт поливна система за градината.'
      ]
    }

    const layerObj = LAYERS.find(l => l.slug === recommendedLayer)

    setResult({
      layer: layerObj,
      description: text,
      steps: stepsList
    })

    setTimeout(() => {
      gsap.fromTo('.quiz-result-container',
        { opacity: 0, scale: 0.98, y: 15 },
        { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'power2.out' }
      )
    }, 50)
  }

  const progressPercent = (step / 3) * 100

  return (
    <section id="start" className="section bg-soft border-y border-line" ref={quizRef}>
      <div className="container-page max-w-3xl">
        <div className="text-center mb-10">
          <div className="eyebrow reveal">Започни оттук · безплатно</div>
          <h2 className="h-section mt-2 reveal">Откъде да започнеш?</h2>
          <p className="mt-3 text-muted reveal">
            Отговори на 3 бързи въпроса и ще те насочим към правилния етап, проверени специалисти и следващи стъпки — без обвързване.
          </p>
        </div>

        {!result ? (
          <div className="card p-8 bg-paper border border-line shadow-md rounded-3xl quiz-step-container">
            {/* Progress Bar */}
            <div className="w-full bg-soft h-1.5 rounded-full overflow-hidden mb-8">
              <div 
                className="bg-accent h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Quiz Step 1 */}
            {step === 1 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted font-bold mb-2">Стъпка 1 от 3</div>
                <h3 className="font-display text-2xl text-ink font-semibold mb-6">Какъв е мащабът на вашия проект?</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { id: 'house', label: 'Строителство на нова къща' },
                    { id: 'apartment', label: 'Ремонт на цял апартамент' },
                    { id: 'room', label: 'Обзавеждане на отделно помещение' },
                    { id: 'cosmetic', label: 'Декорация, двор или градина' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => handleSelect('scope', opt.id)}
                      className={`quiz-option-card p-5 text-left rounded-2xl ${
                        answers.scope === opt.id ? 'selected' : ''
                      }`}>
                      <div className="font-display text-lg text-ink font-semibold">{opt.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quiz Step 2 */}
            {step === 2 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted font-bold mb-2">Стъпка 2 от 3</div>
                <h3 className="font-display text-2xl text-ink font-semibold mb-6">На какъв етап сте в момента?</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { id: 'idea', label: 'Имам само идея в главата си' },
                    { id: 'plans', label: 'Имам готови планове и чертежи' },
                    { id: 'materials', label: 'Търся материали / обзавеждане' },
                    { id: 'finish', label: 'Стените са готови, остава финалът' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => handleSelect('stage', opt.id)}
                      className={`quiz-option-card p-5 text-left rounded-2xl ${
                        answers.stage === opt.id ? 'selected' : ''
                      }`}>
                      <div className="font-display text-lg text-ink font-semibold">{opt.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quiz Step 3 */}
            {step === 3 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted font-bold mb-2">Стъпка 3 от 3</div>
                <h3 className="font-display text-2xl text-ink font-semibold mb-6">Кой е вашият основен приоритет?</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { id: 'quality', label: 'Максимално високо качество' },
                    { id: 'speed', label: 'Бързо изпълнение и срокове' },
                    { id: 'price', label: 'Оптимален бюджет и отстъпки' },
                    { id: 'support', label: 'Спестяване на време и пълна координация' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => handleSelect('priority', opt.id)}
                      className={`quiz-option-card p-5 text-left rounded-2xl ${
                        answers.priority === opt.id ? 'selected' : ''
                      }`}>
                      <div className="font-display text-lg text-ink font-semibold">{opt.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-line">
              <button
                disabled={step === 1}
                onClick={() => setStep(prev => prev - 1)}
                className="btn btn-ghost disabled:opacity-40 disabled:cursor-not-allowed">
                ← Назад
              </button>
              <button
                disabled={
                  (step === 1 && !answers.scope) ||
                  (step === 2 && !answers.stage) ||
                  (step === 3 && !answers.priority)
                }
                onClick={nextStep}
                className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep">
                {step === 3 ? 'Виж резултата' : 'Продължи'}
              </button>
            </div>
          </div>
        ) : (
          <div className="card p-8 bg-paper border border-line shadow-lg rounded-3xl quiz-result-container">
            <div className="text-center mb-6">
              <div className="inline-flex p-3 bg-accentSoft rounded-full text-accent mb-3">
                <Sparkles size={28} />
              </div>
              <h3 className="font-display text-3xl text-ink font-bold">Твоят персонализиран резултат</h3>
              <p className="text-muted mt-1 text-sm">Въз основа на твоите нужди подготвихме следния план</p>
            </div>

            <div className="p-6 bg-soft/50 rounded-2xl border border-line">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs px-2.5 py-1 bg-accentDeep text-paper rounded-full font-bold">
                  СЛОЙ {result.layer.number}
                </span>
                <span className="font-display text-xl text-ink font-bold">{result.layer.title}</span>
              </div>
              <p className="text-sm text-muted mt-3 leading-relaxed">
                {result.description}
              </p>
            </div>

            <div className="mt-8">
              <h4 className="font-display text-lg text-ink font-semibold mb-4">Препоръчителни стъпки:</h4>
              <div className="space-y-3">
                {result.steps.map((st, idx) => (
                  <div key={idx} className="flex gap-3 items-start text-sm">
                    <span className="shrink-0 p-1 bg-accentSoft text-accentDeep rounded-full font-bold font-mono text-[10px] w-5 h-5 flex items-center justify-center mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="text-muted leading-relaxed">{st}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-center mt-8 pt-6 border-t border-line">
              <button 
                onClick={resetQuiz} 
                className="btn btn-ghost !border-line hover:!border-ink">
                Започни отначало
              </button>
              <Link 
                to={`/sloy/${result.layer.slug}#specialisti`} 
                className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep">
                Виж проверени специалисти →
              </Link>
              <Link
                to="/moy-profil?tab=project&from=quiz"
                onClick={saveResultAsProjectBrief}
                className="btn btn-ghost !border-line hover:!border-ink">
                Запази като проект
              </Link>
            </div>
            <p className="mt-4 text-center text-xs text-muted">
              Безплатно и без обвързване · плащането е защитено и се освобождава едва след завършване.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function ServicesStrip() {
  const serviceCards = [
    { title: 'Реални оферти', text: 'Публикувани услуги от активни партньори, не демо категории.' },
    { title: 'Ясен партньор', text: 'Всяка услуга води към профил, цена и директна заявка.' },
    { title: 'Едно място', text: 'Клиентът намира услугата, профила и поръчката без обикаляне.' },
  ]

  return (
    <section className="section !py-16 bg-ink text-paper">
      <div className="container-page">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-4 reveal">
            <div className="eyebrow !text-paper/60">Хоризонтален слой</div>
            <h2 className="h-section mt-2 text-paper">Услугите, които вървят с всяко пространство.</h2>
            <p className="mt-4 text-paper/70 leading-relaxed">
              Електричар за контактите, ВиК за банята, smart home за светлините. Тези хора те застигат на всеки етап — затова са винаги под ръка.
            </p>
          </div>
          <div className="lg:col-span-8 reveal">
            <div className="grid gap-3 sm:grid-cols-3">
              {serviceCards.map((card) => (
                <Link
                  key={card.title}
                  to="/uslugi"
                  className="group rounded-2xl border border-paper/20 bg-graphite/40 p-5 backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-accent"
                >
                  <div className="font-display text-2xl text-paper">{card.title}</div>
                  <p className="mt-3 text-sm leading-relaxed text-paper/65">{card.text}</p>
                  <div className="mt-5 text-sm font-medium text-accent">Отвори услугите →</div>
                </Link>
              ))}
            </div>
            <Link to="/uslugi" className="link-arrow !text-paper !border-paper/40 hover:!text-accent hover:!border-accent inline-flex mt-6 text-sm">
              Виж всички услуги →
            </Link>
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
    <section className="section bg-paper">
      <div className="container-page">
        <div className="flex items-end justify-between mb-10 reveal">
          <div>
            <div className="eyebrow">Реализирани с Totsan</div>
            <h2 className="h-section mt-2">Места, които вече съществуват.</h2>
          </div>
          <span className="text-muted text-sm hidden md:block font-medium">Примерни обекти</span>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {projects.map((p, i) => (
            <article 
              key={i} 
              className="card reveal img-zoom-host p-0 overflow-hidden bg-paper shadow-sm hover:shadow-md border border-line">
              <div className="media-frame aspect-[4/3] relative">
                <img src={p.img} alt={p.t} loading="lazy" decoding="async" className="img-cover img-zoom" />
                <div className="absolute top-3 left-3 text-xs px-2.5 py-1 rounded-full bg-paper/90 text-ink backdrop-blur-md shadow-sm font-semibold">{p.layer}</div>
              </div>
              <div className="p-6 border-t border-line">
                <div className="h-card text-ink font-bold">{p.t}</div>
                <div className="text-muted text-sm mt-2">{p.who}</div>
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
    { n:'01', t:'Кажи къде си', d:'Избери своя слой в Timeline или опиши мечтата си през интерактивния съветник.' },
    { n:'02', t:'Виж избраните за теб', d:'Показваме ти само проверени марки, продукти и хора, подходящи за твоя етап.' },
    { n:'03', t:'Сравни и реши спокойно', d:'Реални оферти, наличности, цени и условия — без скрити „звездички“.' },
    { n:'04', t:'Свърши работата спокойно', d:'Заяви услуга или приеми оферта през Totsan. Плащането е защитено и се освобождава едва след като потвърдиш завършването.' }
  ]
  return (
    <section className="section bg-soft border-y border-line">
      <div className="container-page">
        <div className="eyebrow reveal">Как работи Totsan</div>
        <h2 className="h-section mt-2 reveal max-w-3xl">Четири лесни стъпки. Без излишен шум.</h2>
        <div className="mt-12 grid md:grid-cols-4 gap-8">
          {steps.map((s, idx) => (
            <div key={s.n} className="reveal border-t border-ink pt-5 relative">
              <div className="absolute top-0 right-0 font-display text-9xl text-accentSoft/30 select-none pointer-events-none font-bold -translate-y-8 z-0">
                {s.n}
              </div>
              <div className="relative z-10">
                <div className="font-mono text-sm px-2 py-0.5 rounded bg-accentSoft text-accentDeep w-fit font-bold">{s.n}</div>
                <div className="font-display text-xl mt-3 font-bold text-ink">{s.t}</div>
                <p className="text-muted mt-2 text-sm leading-relaxed">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Trust() {
  return (
    <section className="section bg-paper !py-16">
      <div className="container-page">
        <div className="eyebrow text-center reveal">Работим с производители и марки, които познаваш</div>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 items-center reveal">
          {PARTNER_LOGOS.map(p => <PartnerLogoTile key={p.name} brand={p} />)}
        </div>
      </div>
    </section>
  )
}

function ProTeaser() {
  const points = [
    { icon: UserCheck, title: 'Проверен профил', text: 'Портфолио, услуги, градове, рейтинг и ясна специализация.' },
    { icon: Clock, title: 'По-малко шум', text: 'Заявки с контекст: бюджет, срок, снимки и реална нужда.' },
    { icon: ShieldCheck, title: 'Доверие', text: 'Admin одобрение, verified отзиви и видима история на работа.' },
  ]

  return (
    <section className="section bg-ink text-paper">
      <div className="container-page grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="reveal">
          <div className="eyebrow !text-paper/55">За професионалисти</div>
          <h2 className="h-section mt-3 max-w-3xl">Totsan Pro е платената страна на платформата.</h2>
          <p className="mt-4 max-w-2xl text-paper/70">
            Клиентът използва Totsan безплатно. Професионалистите, студиата и марките получават профил, услуги, заявки, чат и доверие — и плащат, когато платформата започне да носи реална работа.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/pro" className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep">
              Виж Totsan Pro <ArrowRight size={18} />
            </Link>
            <Link to="/login?signup=true&role=pro" className="btn btn-ghost !border-paper/25 !text-paper hover:!bg-paper/10">
              Стани партньор
            </Link>
          </div>
        </div>

        <div className="grid gap-4">
          {points.map((point) => {
            const Icon = point.icon
            return (
              <article key={point.title} className="reveal rounded-3xl border border-paper/15 bg-paper/10 p-5">
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-paper text-accentDeep"><Icon size={21} /></span>
                  <div>
                    <h3 className="font-display text-2xl">{point.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-paper/65">{point.text}</p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function PartnerLogoTile({ brand }) {
  const [failed, setFailed] = useState(false)

  return (
    <div className="rounded-2xl border border-line bg-paper p-3 text-center transition hover:-translate-y-1 hover:border-accent hover:shadow-sm">
      <div className="flex h-16 items-center justify-center rounded-xl bg-soft/75 px-4">
        {failed ? (
          <span className="font-display text-lg text-ink font-semibold">{brand.name}</span>
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
      <div className="mt-3 text-[0.68rem] uppercase tracking-[0.18em] text-muted font-bold">{brand.name}</div>
    </div>
  )
}

function Testimonial() {
  return (
    <section className="section bg-soft border-y border-line">
      <div className="container-page max-w-4xl text-center">
        <div className="eyebrow reveal">Защо Totsan</div>
        <p className="font-display reveal mt-4 leading-normal" style={{fontSize:'var(--step-xl)', lineHeight:1.2}}>
          „Обикалях фирми три месеца и не разбирах нищо. <span className="text-accentDeep font-semibold">Тук за един следобед видях какво ми трябва</span> — и кой ще го направи както трябва.“
        </p>
        <div className="mt-6 text-sm text-muted reveal font-medium">— Мария, собственик на нов апартамент в Пловдив</div>
      </div>
    </section>
  )
}

function FAQItem({ question, answer }) {
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
        <span className={`text-accentDeep text-3xl font-mono transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`}>
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

function FAQ() {
  const items = [
    { q:'Колко струва да използвам Totsan?', a:'За теб като клиент Totsan е безплатен — не взимаме такси от клиенти. Когато платиш услуга през платформата, парите се задържат защитено и се освобождават към специалиста едва след като потвърдиш, че работата е завършена.' },
    { q:'Как избирате кои хора влизат?', a:'Всеки специалист минава през преглед от нашия екип — реално завършени проекти, отзиви от клиенти и проверка на документи. Ако не отговаря на стандартите, не влиза.' },
    { q:'Ами ако нещо се обърка по време на работа?', a:'Имаш на кого да се обадиш. Ние посредничим и съдействаме за намиране на бързо решение, ако възникне спор, забавяне или недоразумение с изпълнител.' },
    { q:'Мога ли да започна, без да зная какво точно искам?', a:'Точно за това е Слой 01. Кажи ни мечтата си в две изречения или използвай нашия бърз Интерактивен съветник — ние ще те насочим към правилната посока.' }
  ]
  return (
    <section className="section bg-paper">
      <div className="container-page max-w-4xl">
        <div className="eyebrow reveal">Често задавани въпроси</div>
        <h2 className="h-section mt-2 reveal">Кратко, ясно и прозрачно.</h2>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {items.map((it, i) => (
            <FAQItem key={i} question={it.q} answer={it.a} />
          ))}
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="section bg-paper">
      <div className="container-page rounded-3xl bg-ink text-paper p-10 md:p-16 grid md:grid-cols-12 gap-8 items-center relative overflow-hidden shadow-xl">
        <div className="hidden sm:block absolute top-0 right-0 w-80 h-80 bg-accent/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="hidden sm:block absolute bottom-0 left-0 w-80 h-80 bg-trustPurple/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="md:col-span-8 relative z-10">
          <h2 className="h-section text-paper">Готов да започнеш своя проект?</h2>
          <p className="mt-3 text-paper/70 max-w-2xl leading-relaxed">
            Кажи ни в две изречения какво искаш — ние се връщаме към теб с правилните хора и препоръки още същата седмица.
          </p>
        </div>
        <div className="md:col-span-4 flex md:justify-end gap-3 flex-wrap relative z-10">
          <Link to="/contact" className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep shadow-md hover:shadow-lg">
            Заяви консултация
          </Link>
          <Link to="/sloy/ideya" className="btn btn-ghost !border-paper/30 !text-paper hover:!bg-paper/10">
            Разгледай слоевете
          </Link>
        </div>
      </div>
    </section>
  )
}
