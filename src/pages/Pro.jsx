import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  Euro,
  FileCheck2,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Tags,
  UserCheck,
  Wrench,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { LAYER_HEROS } from '../data/images.js'
import { DELIVERABLES, SPECIALIST_TYPES, SPECIFIC_SERVICES, TARGET_OBJECTS } from '../data/layer01-meta.js'
import { getProfileImage, getProfileImageStyle, normalizePricingNoteDisplay, normalizeProfile, runProfileSelectWithLayer01Fallback, slugify, useProfileDirectory } from '../lib/profiles.js'
import { loadProfilePortfolio, loadProfileStats } from '../lib/portfolio.js'
import { loadPublicPartnerServicesForProfile, packagePriceLabel } from '../lib/partner-services.js'
import { useAccount } from '../lib/account.js'
import { createConversationFromProfile } from '../lib/chat.js'
import { normalizeAiFitSummary } from '../lib/profile-ai-summary.js'
import PortfolioGallery from '../components/profile/PortfolioGallery.jsx'
import PublicProfileBanner from '../components/profile/PublicProfileBanner.jsx'
import PublicProfilePanel from '../components/profile/PublicProfilePanel.jsx'
import ReviewsList from '../components/reviews/ReviewsList.jsx'
import { formatEurWithBgn } from '../lib/money.js'
import { getPageLocation, trackEvent, trackPageView } from '../lib/analytics.js'
import { buildBreadcrumbSchema, buildPersonSchema, useSeo } from '../lib/seo.js'

const GENERIC_TARGETS = {
  ideya: 'жилища, търговски обекти и проекти в ранен етап',
  postroyka: 'ремонти, строителни задачи и обекти на място',
  materiali: 'избор на материали, продукти и обекти с конкретни изисквания',
  obzavezhdane: 'жилища, кухни, мебели и обзавеждане по проект',
  dekoraciya: 'финален styling, декорация и завършване на пространства',
}

function compactText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function uniqueList(values = [], limit = 6) {
  const seen = new Set()
  const result = []
  values.forEach((value) => {
    const text = compactText(value)
    const key = text.toLocaleLowerCase('bg')
    if (!text || seen.has(key)) return
    seen.add(key)
    result.push(text)
  })
  return result.slice(0, limit)
}

function splitKeywords(value = '') {
  return String(value || '')
    .split(/[,\n;/|]+/)
    .map(item => item.trim())
    .filter(Boolean)
}

function getPrimarySpecialization(profile, layer) {
  return compactText(profile.headline || profile.tag || profile.sub || layer?.title)
}

function getServiceKeywords(profile, services, layer) {
  const serviceTerms = services.flatMap((service) => [
    service.title,
    service.subtitle,
    ...(service.tags || []),
  ])
  return uniqueList([
    ...splitKeywords(profile.headline),
    ...splitKeywords(profile.tag || profile.sub),
    ...serviceTerms,
    layer?.title,
  ], 7)
}

function getServiceAreaLabel(profile) {
  const areas = Array.isArray(profile.serviceAreas) ? profile.serviceAreas.filter(Boolean) : []
  if (areas.length > 1) return areas.join(', ')
  if (areas.length === 1 && areas[0] !== profile.city) return `${areas[0]} / регион`
  if (profile.city) return `${profile.city} / регион`
  return 'България'
}

function getExplicitServiceAreaLabel(profile) {
  const areas = Array.isArray(profile.serviceAreas) ? profile.serviceAreas.filter(Boolean) : []
  if (areas.length > 1) return areas.join(', ')
  if (areas.length === 1 && areas[0] !== profile.city) return `${areas[0]} / регион`
  if (profile.city) return `${profile.city} / регион`
  return ''
}

function formatResponseLabel(hours) {
  const value = Number(hours)
  if (!Number.isFinite(value) || value <= 0) return 'Отговор до 48 ч.'
  if (value < 1) return 'Отговор под 1 ч.'
  return `Отговор до ${Math.round(value)} ч.`
}

function getPriceGuide(profile, services) {
  if (profile.pricingNote) return normalizePricingNoteDisplay(profile.pricingNote)
  const pricedService = services.find((service) => service.lowestPrice)
  if (pricedService) return `Ориентир от ${packagePriceLabel(pricedService)}`
  return 'След оглед / по оферта'
}

function getLayer01Labels(options, values) {
  if (!Array.isArray(values)) return []
  return values.map((value) => findLayer01Option(options, value)?.label).filter(Boolean)
}

function getTargetObjectLabel(layer, layer01Meta) {
  const objects = getLayer01Labels(TARGET_OBJECTS, layer01Meta?.target_objects)
  if (objects.length) return objects.join(', ')
  return GENERIC_TARGETS[layer?.slug] || 'индивидуални запитвания и конкретни обекти'
}

function getExplicitTargetObjectLabel(layer, layer01Meta) {
  const objects = getLayer01Labels(TARGET_OBJECTS, layer01Meta?.target_objects)
  if (objects.length) return objects.join(', ')
  return GENERIC_TARGETS[layer?.slug] || ''
}

function getWorkMethodLabel(layer01Process) {
  if (layer01Process.length) {
    return layer01Process.slice(0, 3).map(step => compactText(step.title)).filter(Boolean).join(' / ')
  }
  return 'запитване / уточнение / оферта'
}

function getExperienceLabel(profile) {
  const years = Number(profile.yearsExperience || Math.max(0, new Date().getFullYear() - profile.since))
  if (!Number.isFinite(years) || years <= 0) return ''
  return `${Math.round(years)} години`
}

function getInquiryStartLabel(layer) {
  if (layer?.slug === 'ideya') return 'Описание, снимки, размери'
  if (layer?.slug === 'postroyka') return 'Описание, снимки, оглед'
  if (layer?.slug === 'materiali') return 'Описание, снимки, мостри'
  if (layer?.slug === 'obzavezhdane') return 'Размери, снимки, монтаж'
  if (layer?.slug === 'dekoraciya') return 'Снимки, стил, бюджет'
  return 'Описание, снимки, уточнение'
}

function getOfferTimingLabel(layer) {
  if (['postroyka', 'obzavezhdane'].includes(layer?.slug)) return 'След оглед'
  return 'След уточнение'
}

function fitTileIcon(label) {
  if (label === 'Работи в') return MapPin
  if (label === 'Подходящ за') return UserCheck
  if (label === 'Как започва') return FileCheck2
  if (label === 'Оферта') return Euro
  return CheckCircle2
}

function getInquiryGuidance(layer) {
  if (layer?.slug === 'ideya') return 'За по-точна преценка изпратете кратко описание, снимки, размери и какво искате като концепция, разпределение, 3D визуализации, проект или материали.'
  if (layer?.slug === 'postroyka') return 'За по-точна преценка изпратете кратко описание, снимки, обхват на ремонта и какво искате да се изпълни на обекта.'
  if (layer?.slug === 'materiali') return 'За по-точна преценка изпратете кратко описание, снимки, предпочитан ценови клас и дали търсите продукти, мостри или доставка.'
  if (layer?.slug === 'obzavezhdane') return 'За по-точна преценка изпратете кратко описание, снимки, размери и дали търсите изработка, доставка, монтаж или мебели по поръчка.'
  if (layer?.slug === 'dekoraciya') return 'За по-точна преценка изпратете кратко описание, снимки и какво искате да се промени чрез стайлинг, текстил, осветление, декорация или финални детайли.'
  return 'За по-точна преценка изпратете кратко описание, снимки и какво искате да се направи.'
}

function getHelpText(profile, primarySpecialization, serviceAreaLabel, targetObjectLabel, layer) {
  const name = profile.name || 'Този специалист'
  const introParts = []
  const specialization = compactText(primarySpecialization).toLocaleLowerCase('bg')

  if (specialization) {
    introParts.push(`${name} е подходящ избор за клиенти, които търсят ${specialization}.`)
  } else {
    introParts.push(`${name} е подходящ избор, когато искате конкретна преценка преди запитване.`)
  }

  if (targetObjectLabel && serviceAreaLabel) {
    introParts.push(`Работи по ${targetObjectLabel} в ${serviceAreaLabel}.`)
  } else if (targetObjectLabel) {
    introParts.push(`Работи по ${targetObjectLabel}.`)
  } else if (serviceAreaLabel) {
    introParts.push(`Работи в ${serviceAreaLabel}.`)
  }

  introParts.push(getInquiryGuidance(layer))
  return introParts.join(' ')
}

export default function Pro() {
  const location = useLocation()
  const { state } = location
  const navigate = useNavigate()
  const { slug } = useParams()
  const { catalog, layers, profiles, status } = useProfileDirectory()
  const { session, account, loading: accountLoading } = useAccount()
  const [previewState, setPreviewState] = useState({ status: 'idle', profile: null, message: '' })
  const [portfolio, setPortfolio] = useState([])
  const [stats, setStats] = useState(null)
  const [services, setServices] = useState([])
  const [chatState, setChatState] = useState({ status: 'idle', message: '' })
  const trackedProfileSlugRef = useRef('')
  const inquirySectionRef = useRef(null)
  const servicesSectionRef = useRef(null)
  const portfolioSectionRef = useRef(null)
  const reviewsSectionRef = useRef(null)
  const profilePath = slug ? `/profil/${slug}` : '/katalog'
  const previewRequested = new URLSearchParams(location.search || '').get('preview') === 'true'
  const canAdminPreview = Boolean(previewRequested && account?.role === 'admin')

  useEffect(() => {
    if (!previewRequested || !slug || accountLoading) return
    if (account?.role !== 'admin') {
      setPreviewState({ status: 'ready', profile: null, message: '' })
      return
    }

    let active = true
    setPreviewState({ status: 'loading', profile: null, message: '' })

    async function loadPreviewProfile() {
      const { data, error } = await runProfileSelectWithLayer01Fallback((columns) => (
        supabase.from('profiles').select(columns).eq('slug', slug).maybeSingle()
      ))

      if (!active) return
      if (error && error.code !== 'PGRST116') {
        setPreviewState({ status: 'error', profile: null, message: error.message })
        return
      }
      setPreviewState({ status: 'ready', profile: data ? normalizeProfile(data) : null, message: '' })
    }

    loadPreviewProfile()
    return () => { active = false }
  }, [account?.role, accountLoading, previewRequested, slug])

  const item = useMemo(() => {
    if (canAdminPreview && previewState.profile) return previewState.profile
    const liveProfile = profiles.find((profile) => profile.slug === slug)
    if (liveProfile) return liveProfile
    if (state?.item?.kind === 'pro') {
      return {
        ...state.item,
        slug: state.item.slug || slugify(state.item.name),
      }
    }
    return catalog.find((entry) => entry.kind === 'pro' && (entry.slug || slugify(entry.name)) === slug)
  }, [canAdminPreview, catalog, previewState.profile, profiles, slug, state])
  const layer = useMemo(() => {
    if (!item) return layers[0] || null
    return layers.find((current) => current.slug === (item.layerSlug || item.layer)) || layers[0] || null
  }, [item, layers])

  const seoConfig = useMemo(() => {
    if (!slug) return null
    if (item && layer) {
      const title = `${item.name}${item.tag ? ` — ${item.tag}` : ''} | Totsan`
      const description = item.descriptionLong || item.headline || `${item.name} е публичен профил в Totsan за ${item.tag || 'специалист'}${item.city ? ` в ${item.city}` : ''}.`

      return {
        title,
        description,
        canonicalPath: profilePath,
        jsonLd: [
          buildBreadcrumbSchema([
            { name: 'Начало', path: '/' },
            { name: 'Каталог', path: '/katalog' },
            { name: item.name, path: profilePath },
          ]),
          buildPersonSchema(item, profilePath),
        ],
        robots: canAdminPreview ? 'noindex, nofollow' : undefined,
      }
    }

    if (status === 'loading' || previewState.status === 'loading' || (previewRequested && accountLoading)) return null

    return {
      title: 'Специалистът не е намерен | Totsan',
      description: 'Този публичен профил не е наличен или вече не се показва в Totsan.',
      canonicalPath: profilePath,
      robots: 'noindex, nofollow',
    }
  }, [accountLoading, canAdminPreview, item, layer, previewRequested, previewState.status, profilePath, slug, status])

  useSeo(seoConfig)

  useEffect(() => {
    if (!item?.id || item.isStatic) {
      setPortfolio([])
      setStats(null)
      setServices([])
      return undefined
    }

    let active = true
    async function loadV2Data() {
      try {
        const [portfolioRows, statsRow, serviceRows] = await Promise.all([
          loadProfilePortfolio(item.id),
          loadProfileStats(item.id),
          loadPublicPartnerServicesForProfile(item.id),
        ])
        if (!active) return
        setPortfolio(portfolioRows)
        setStats(statsRow)
        setServices(serviceRows)
      } catch (error) {
        if (!active) return
        console.error('Profile v2 data load failed:', error)
        setPortfolio([])
        setStats(null)
        setServices([])
      }
    }

    loadV2Data()
    return () => { active = false }
  }, [item?.id, item?.isStatic])

  useEffect(() => {
    if (!item || !layer || !seoConfig?.title) return
    const profileSlug = item.slug || slug || ''
    if (!profileSlug || trackedProfileSlugRef.current === profileSlug) return

    trackedProfileSlugRef.current = profileSlug
    trackPageView({
      pagePath: profilePath,
      pageTitle: seoConfig.title,
      pageLocation: getPageLocation(profilePath),
    })
    trackEvent('view_professional', {
      professional_slug: profileSlug,
      professional_role: item.tag || undefined,
      layer: layer.slug,
      city: item.city || undefined,
    })
  }, [item, layer, profilePath, seoConfig?.title, slug])

  if (!item && (status === 'loading' || previewState.status === 'loading' || (previewRequested && accountLoading))) return <LoadingProfile />
  if (!item && previewState.status === 'error') return <NotFound type="специалист" />
  if (!item) return <NotFound type="специалист" />
  if (!layer && status === 'loading') return <LoadingProfile />
  if (!layer) return <NotFound type="специалист" />
  const partnerUserId = item.userId || stats?.user_id || ''
  const viewerUserId = session?.user?.id || ''
  const isOwnProfile = Boolean(viewerUserId && partnerUserId && viewerUserId === partnerUserId)
  const layer01Meta = layer?.slug === 'ideya' ? item.layer01Meta || {} : {}
  const layer01Process = Array.isArray(layer01Meta.process_steps)
    ? layer01Meta.process_steps.filter((step) => step?.title || step?.description || step?.duration)
    : []
  const hasLayer01Details = Object.keys(layer01Meta).length > 0
  const primarySpecialization = getPrimarySpecialization(item, layer)
  const serviceKeywords = getServiceKeywords(item, services, layer)
  const serviceAreaLabel = getServiceAreaLabel(item)
  const fitServiceAreaLabel = getExplicitServiceAreaLabel(item)
  const targetObjectLabel = getTargetObjectLabel(layer, layer01Meta)
  const fitTargetObjectLabel = getExplicitTargetObjectLabel(layer, layer01Meta)
  const workMethodLabel = getWorkMethodLabel(layer01Process)
  const priceGuide = getPriceGuide(item, services)
  const experienceLabel = getExperienceLabel(item)
  const helpText = getHelpText(item, primarySpecialization, fitServiceAreaLabel, fitTargetObjectLabel, layer)
  const inquiryStartLabel = getInquiryStartLabel(layer)
  const offerTimingLabel = getOfferTimingLabel(layer)
  const aiFitSummary = normalizeAiFitSummary(item.aiFitSummary)
  const aboutText = compactText(item.descriptionLong || item.displayBio)
  const showAboutText = aboutText && compactText(aboutText) !== compactText(aiFitSummary?.summary || helpText)
  const responseLabel = formatResponseLabel(stats?.response_time_hours ?? item.responseTimeHours)
  const reviewCount = Number(stats?.reviews_count || 0)
  const averageRating = Number(stats?.avg_rating || 0)

  function scrollToSection(sectionRef) {
    const node = sectionRef.current
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function startChat() {
    if (!session) {
      navigate(`/login?next=${encodeURIComponent(profilePath)}`)
      return
    }
    if (isOwnProfile) {
      setChatState({ status: 'error', message: 'Не можеш да започнеш чат със собствения си публичен профил.' })
      return
    }
    if ((!item.id && !partnerUserId) || item.isStatic) {
      setChatState({ status: 'error', message: 'Този профил още не е свързан с чат.' })
      return
    }
    trackEvent('start_chat', {
      source: 'profile_page',
      professional_slug: item.slug || slug || undefined,
      layer: item.layerSlug || item.layer || undefined,
    })
    setChatState({ status: 'loading', message: 'Отваряме защитен чат…' })
    try {
      const conversation = await createConversationFromProfile({
        profileId: item.id,
        partnerId: partnerUserId,
        subject: `Разговор с ${item.name}`,
      })
      navigate(`/inbox/${conversation.id}`)
    } catch (error) {
      setChatState({ status: 'error', message: error.message || 'Чатът не се отвори.' })
    }
  }

  return (
    <>
      <PublicProfileBanner
        imageSrc={item.coverUrl || LAYER_HEROS[layer.slug]}
        imageAlt=""
        imageStyle={{ objectPosition: `50% ${item.coverY ?? 50}%` }}
        heightClass="h-[clamp(12.5rem,52vw,15rem)] md:aspect-[1600/520] md:h-auto md:min-h-0"
      />

      <div className="relative z-10 bg-soft flex flex-col pb-10">
        <div className="container-page -mt-8 w-full px-4 sm:-mt-12 md:-mt-24 md:px-6">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">

            <aside className="lg:col-span-4 reveal">
              <div className="lg:sticky lg:top-24 space-y-6">

                <PublicProfilePanel className="transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)]">
                  <div className="flex flex-col items-center text-center">
                    <div className="relative group">
                      <div className="w-32 h-32 rounded-3xl overflow-hidden border-4 border-paper bg-paper shadow-md transition-transform duration-300 group-hover:scale-[1.02]">
                        <img src={getProfileImage(item, 'profile')} alt={item.name} className="img-cover" style={getProfileImageStyle(item)} />
                      </div>
                      <span className="absolute bottom-1 right-1 flex h-5 w-5 rounded-full border-4 border-paper bg-trustGreen" title="Онлайн в Totsan" />
                    </div>

                    <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-accentSoft/60 border border-accent/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accentDeep">
                      Слой {layer.number} · {layer.title.split(' ')[0]}
                    </div>

                    <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">{item.name}</h1>
                    <p className="mt-2 max-w-[300px] text-base font-semibold leading-relaxed text-ink/85">{primarySpecialization}</p>

                    <div className="mt-3 flex items-center gap-1.5 text-xs text-muted font-medium">
                      <MapPin size={14} className="text-accent" />
                      <span>{serviceAreaLabel}</span>
                      <span className="text-line">•</span>
                      <span>{responseLabel}</span>
                    </div>
                  </div>

                  {serviceKeywords.length > 0 && (
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                      {serviceKeywords.slice(0, 5).map((keyword) => (
                        <span key={keyword} className="rounded-full border border-line bg-soft px-3 py-1 text-xs font-medium text-ink">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}

                  <ProfileTrustSignals
                    profile={item}
                    responseLabel={responseLabel}
                    serviceAreaLabel={serviceAreaLabel}
                    serviceCount={services.length}
                    projectCount={portfolio.length}
                    reviewCount={reviewCount}
                    averageRating={averageRating}
                    onServicesClick={() => scrollToSection(servicesSectionRef)}
                    onProjectsClick={() => scrollToSection(portfolioSectionRef)}
                    onReviewsClick={() => scrollToSection(reviewsSectionRef)}
                  />

                </PublicProfilePanel>

                <div ref={inquirySectionRef} className="scroll-mt-24">
                  <InquiryBox
                    proName={item.name}
                    title={item.name ? `Изпрати запитване до ${item.name}` : 'Опиши проекта си'}
                    layerSlug={item.layerSlug || item.layer}
                    targetSlug={item.slug}
                    clientId={session?.user?.id}
                  />
                </div>

                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted">
                  <span className="h-px flex-1 bg-line/80" />или чат след запитване<span className="h-px flex-1 bg-line/80" />
                </div>

                <ContactCard onStartChat={startChat} chatState={chatState} />

              </div>
            </aside>

            <div className="lg:col-span-8 reveal lg:pt-6 space-y-12">

              <div>
                <Link to="/katalog" className="group inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted hover:text-ink transition-colors duration-200 mb-6">
                  <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span> Обратно в каталога
                </Link>
                <QuickOverviewSection
                  serviceAreaLabel={serviceAreaLabel}
                  serviceKeywords={serviceKeywords}
                  targetObjectLabel={targetObjectLabel}
                  workMethodLabel={workMethodLabel}
                  priceGuide={priceGuide}
                  experienceLabel={experienceLabel}
                />
              </div>

              <HelpSection
                profileName={item.name}
                aiFitSummary={aiFitSummary}
                helpText={helpText}
                aboutText={showAboutText ? aboutText : ''}
                serviceKeywords={serviceKeywords}
                serviceAreaLabel={fitServiceAreaLabel}
                targetObjectLabel={fitTargetObjectLabel}
                inquiryStartLabel={inquiryStartLabel}
                offerTimingLabel={offerTimingLabel}
              />

              <ProfileServicesSection
                ref={servicesSectionRef}
                services={services}
                profile={item}
                onInquiryClick={() => scrollToSection(inquirySectionRef)}
              />

              {hasLayer01Details && <Layer01ProfileDetails meta={layer01Meta} />}

              {hasLayer01Details && Number.isFinite(Number(layer01Meta.consultation_fee)) && (
                <div className="rounded-3xl border border-line/60 bg-paper p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-wrap items-center justify-between gap-6">
                  <div>
                    <div className="eyebrow mb-2">Консултации</div>
                    <div className="font-display text-2xl font-semibold text-ink">Първоначална среща за проекта</div>
                    {layer01Meta.consultation_note && <p className="mt-1.5 text-sm text-muted max-w-lg leading-relaxed">{layer01Meta.consultation_note}</p>}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Такса за консултация</div>
                    <div className="font-display text-3xl font-bold text-accentDeep mt-1">
                      {Number(layer01Meta.consultation_fee) === 0 ? 'Безплатна' : formatEurWithBgn(layer01Meta.consultation_fee)}
                    </div>
                  </div>
                </div>
              )}

              <div
                ref={portfolioSectionRef}
                id="profile-projects"
                className="scroll-mt-24 rounded-3xl border border-line bg-paper p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
              >
                <div className="eyebrow mb-2">Портфолио</div>
                <h2 className="font-display text-3xl font-semibold text-ink mb-6">Реални реализирани проекти</h2>
                <div>
                  <PortfolioGallery items={portfolio} profileSlug={item.slug} emptyText="Портфолиото ще се появи тук, когато партньорът добави реализирани проекти." />
                </div>
              </div>

              <div ref={reviewsSectionRef} id="profile-reviews" className="scroll-mt-24">
                <ReviewsList partnerId={partnerUserId} title={`Отзиви за ${item.name}`} emptyText="Отзивите ще се появят тук след завършени Totsan проекти." />
              </div>

              <TrustVerificationBlock />

            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function MetaTile({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-paper p-4 border border-line/40 transition-all duration-300 hover:border-line hover:shadow-[0_8px_25px_rgba(0,0,0,0.02)]">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accentSoft/60 text-accentDeep">
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</div>
        <div className="mt-0.5 break-words text-sm font-semibold leading-5 text-ink">{value}</div>
      </div>
    </div>
  )
}

function countLabel(count, singular, plural) {
  const value = Number(count || 0)
  if (!value) return ''
  return `${value} ${value === 1 ? singular : plural}`
}

function ProfileTrustSignals({
  profile,
  responseLabel,
  serviceAreaLabel,
  serviceCount,
  projectCount,
  reviewCount,
  averageRating,
  onServicesClick,
  onProjectsClick,
  onReviewsClick,
}) {
  const signals = [
    { key: 'verified', label: 'Проверен профил', icon: ShieldCheck },
    { key: 'since', label: `В Totsan от ${profile?.since || new Date().getFullYear()} г.`, icon: CheckCircle2 },
    { key: 'area', label: `Обслужва: ${serviceAreaLabel}`, icon: MapPin },
    { key: 'response', label: responseLabel, icon: Clock },
    serviceCount > 0 ? { key: 'services', label: countLabel(serviceCount, 'услуга', 'услуги'), icon: BriefcaseBusiness, onClick: onServicesClick } : null,
    projectCount > 0 
      ? { key: 'projects', label: countLabel(projectCount, 'проект в портфолиото', 'проекта в портфолиото'), icon: FileCheck2, onClick: onProjectsClick } 
      : { key: 'projects', label: 'Няма добавени проекти в Totsan', icon: FileCheck2 },
    reviewCount > 0 ? { key: 'reviews', label: `${Number(averageRating || 0).toFixed(1)} оценка от ${countLabel(reviewCount, 'отзив', 'отзива')}`, icon: UserCheck, onClick: onReviewsClick } : null,
  ].filter(Boolean)

  return (
    <div className="mt-7 border-t border-line/60 pt-6">
      <div className="grid gap-2">
        {signals.map((signal) => {
          const Icon = signal.icon
          const className = 'flex w-full items-center gap-3 rounded-2xl bg-soft/55 px-3.5 py-3 text-left text-sm font-semibold text-ink transition hover:bg-soft'
          const content = (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper text-accentDeep shadow-sm">
                <Icon size={16} />
              </span>
              <span>{signal.label}</span>
            </>
          )

          if (signal.onClick) {
            return (
              <button key={signal.key} type="button" onClick={signal.onClick} className={className}>
                {content}
              </button>
            )
          }

          return <div key={signal.key} className={className}>{content}</div>
        })}
      </div>
    </div>
  )
}

function QuickOverviewSection({
  serviceAreaLabel,
  serviceKeywords,
  targetObjectLabel,
  workMethodLabel,
  priceGuide,
  experienceLabel,
}) {
  const servicesLabel = serviceKeywords.length ? serviceKeywords.slice(0, 4).join(', ') : 'Индивидуални запитвания'
  const items = [
    { icon: MapPin, label: 'Работи в', value: serviceAreaLabel },
    { icon: Tags, label: 'Услуги', value: servicesLabel },
    { icon: UserCheck, label: 'Подходящ за', value: targetObjectLabel },
    { icon: FileCheck2, label: 'Начин на работа', value: workMethodLabel },
    { icon: Euro, label: 'Ценови ориентир', value: priceGuide },
    experienceLabel ? { icon: CheckCircle2, label: 'Опит', value: experienceLabel } : null,
  ].filter(Boolean)

  return (
    <section className="rounded-3xl border border-line bg-paper p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <div className="eyebrow mb-2">Бърз преглед</div>
      <h2 className="font-display text-3xl font-semibold text-ink">Най-важното преди запитване</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <MetaTile key={item.label} icon={item.icon} label={item.label} value={item.value} />
        ))}
      </div>
    </section>
  )
}

function HelpSection({
  profileName,
  aiFitSummary,
  helpText,
  aboutText,
  serviceKeywords,
  serviceAreaLabel,
  targetObjectLabel,
  inquiryStartLabel,
  offerTimingLabel,
}) {
  const displayName = compactText(profileName) || 'този специалист'
  const fallbackFitItems = [
    serviceAreaLabel ? { icon: MapPin, label: 'Работи в', value: serviceAreaLabel } : null,
    targetObjectLabel ? { icon: UserCheck, label: 'Подходящ за', value: targetObjectLabel } : null,
    inquiryStartLabel ? { icon: FileCheck2, label: 'Как започва', value: inquiryStartLabel } : null,
    offerTimingLabel ? { icon: Euro, label: 'Оферта', value: offerTimingLabel } : null,
  ].filter(Boolean)
  const fitItems = aiFitSummary?.tiles?.length
    ? aiFitSummary.tiles.map(tile => ({ ...tile, icon: fitTileIcon(tile.label) }))
    : fallbackFitItems
  const chips = aiFitSummary?.chips?.length ? aiFitSummary.chips : serviceKeywords
  const eyebrow = aiFitSummary?.eyebrow || 'Подходящ за'
  const heading = aiFitSummary?.heading || `Кога да изберете ${displayName}`
  const summary = aiFitSummary?.summary || helpText

  return (
    <section className="rounded-3xl border border-line bg-paper p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <div className="eyebrow mb-2">{eyebrow}</div>
      <h2 className="font-display text-3xl font-semibold leading-tight text-ink">{heading}</h2>
      <p className="mt-4 max-w-3xl text-ink/82 leading-7" style={{ fontSize: 'var(--step-sm)' }}>
        {summary}
      </p>

      {chips.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {chips.map((keyword) => (
            <span key={keyword} className="rounded-full border border-line bg-soft px-3 py-1.5 text-sm font-medium text-ink">
              {keyword}
            </span>
          ))}
        </div>
      )}

      {fitItems.length > 0 && (
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {fitItems.map((item) => (
            <MetaTile key={item.label} icon={item.icon} label={item.label} value={item.value} />
          ))}
        </div>
      )}

      {aboutText && (
        <div className="mt-7 border-t border-line pt-6">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Повече за профила</div>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted">{aboutText}</p>
        </div>
      )}
    </section>
  )
}

function TrustVerificationBlock() {
  return (
    <section className="rounded-3xl border border-line bg-paper p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accentSoft/60 text-accentDeep">
          <ShieldCheck size={22} />
        </div>
        <div>
          <div className="eyebrow mb-2">Доверие и проверка</div>
          <h2 className="font-display text-2xl font-semibold text-ink">Проверка от Totsan</h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            Този профил е прегледан по основни критерии: контакт, дейност, район на работа и представена информация. Проверката помага за ориентация, без да обещава гарантирано качество извън реалната комуникация и договорка.
          </p>
        </div>
      </div>
    </section>
  )
}

function Layer01ProfileDetails({ meta }) {
  const specialist = findLayer01Option(SPECIALIST_TYPES, meta.specialist_type)
  const services = findLayer01Options(SPECIFIC_SERVICES, meta.specific_services)
  const deliverables = findLayer01Options(DELIVERABLES, meta.deliverables)
  const objects = findLayer01Options(TARGET_OBJECTS, meta.target_objects)
  const hasLists = services.length > 0 || deliverables.length > 0 || objects.length > 0 || specialist

  if (!hasLists) return null

  return (
    <div className="rounded-3xl border border-line/50 bg-paper p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <div className="eyebrow mb-4">Идея и посока</div>
      <div className="grid gap-6 md:grid-cols-2">
        {specialist && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Профил</div>
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-soft px-3 py-1.5 text-sm font-medium text-ink">
              <span>{specialist.icon}</span>
              {specialist.label}
            </div>
          </div>
        )}

        {objects.length > 0 && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Обекти</div>
            <div className="flex flex-wrap gap-2">
              {objects.map((item) => (
                <span key={item.value} className="inline-flex items-center gap-2 rounded-full border border-line bg-soft px-3 py-1.5 text-sm text-ink">
                  <span>{item.icon}</span>
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {services.length > 0 && <Layer01List title="Конкретни услуги" items={services} />}
        {deliverables.length > 0 && <Layer01List title="Какво получавате" items={deliverables} />}
      </div>
    </div>
  )
}

function Layer01List({ title, items }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">{title}</div>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.value} className="flex items-start gap-2.5 text-sm text-ink/90">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-trustGreen" />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function findLayer01Option(options, value) {
  return options.find((item) => item.value === value) || null
}

function findLayer01Options(options, values) {
  if (!Array.isArray(values)) return []
  return values.map((value) => findLayer01Option(options, value)).filter(Boolean)
}

function serviceFitText(service) {
  const packageDescription = service.packages?.find((item) => item.description)?.description || ''
  const features = service.packages?.flatMap((item) => item.features || []).filter(Boolean) || []
  return compactText(service.subtitle || packageDescription || service.tags?.join(', ') || features.slice(0, 3).join(', ')) || 'Подходящо за конкретно запитване и уточнение според обекта.'
}

const ProfileServicesSection = forwardRef(function ProfileServicesSection({ services, profile, onInquiryClick }, ref) {
  return (
    <div ref={ref} id="profile-services" className="scroll-mt-24 rounded-3xl border border-line bg-paper p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
        <div>
          <div className="eyebrow">Услуги и пакети</div>
          <h2 className="mt-2 font-display text-3xl text-ink">Какво конкретно предлага {profile.name}</h2>
        </div>
        <Link to="/uslugi" className="inline-flex items-center gap-2 text-sm font-medium text-ink underline underline-offset-4 hover:text-accentDeep transition-colors duration-200">
          Всички услуги <ArrowRight size={16} />
        </Link>
      </div>

      {services.length > 0 ? (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {services.map(service => (
            <Link
              key={service.id}
              to={`/uslugi/${service.slug}`}
              className="group flex min-h-[22rem] flex-col overflow-hidden rounded-3xl border border-line/60 bg-paper text-left transition-all duration-300 hover:-translate-y-1 hover:border-ink/25 hover:shadow-[0_12px_30px_rgba(13,35,64,0.08)]"
            >
              <div className="relative aspect-[16/9] bg-soft">
                {service.coverUrl ? (
                  <img src={service.coverUrl} alt={service.title} className="img-cover transition duration-700 group-hover:scale-[1.04]" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-soft text-accentDeep">
                    <Wrench size={32} />
                  </div>
                )}
                <span className="absolute left-4 top-4 rounded-full bg-paper/92 px-3 py-1 text-xs font-bold text-accentDeep shadow-sm">
                  {packagePriceLabel(service)}
                </span>
              </div>
              <div>
                <div className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accentSoft/60 text-accentDeep">
                    <BriefcaseBusiness size={20} />
                  </div>
                  <h3 className="mt-4 font-display text-2xl leading-tight text-ink group-hover:text-accentDeep transition-colors duration-200">{service.title}</h3>
                  <div className="mt-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Подходящо за</div>
                    <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-muted">{serviceFitText(service)}</p>
                  </div>
                  {service.tags?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {service.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded-full border border-line bg-soft px-2.5 py-1 text-[11px] font-medium text-ink">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-auto border-t border-line px-6 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink group-hover:text-accent transition-colors duration-200">
                  Запитай за тази услуга <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-3xl border border-dashed border-line/80 bg-soft/40 p-6 md:p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-paper text-accentDeep shadow-sm">
            <BriefcaseBusiness size={22} />
          </div>
          <h3 className="mt-4 font-display text-2xl font-semibold text-ink">Този партньор още не е публикувал конкретни услуги.</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
            Можете да изпратите запитване с описание на проекта. Партньорът ще уточни обхвата, огледа и офертата според конкретния обект.
          </p>
          <button type="button" onClick={onInquiryClick} className="btn btn-primary mt-6 justify-center">
            Изпрати запитване
          </button>
        </div>
      )}
    </div>
  )
})

function ContactCard({ onStartChat, chatState }) {
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accentSoft/60 text-accentDeep">
          <MessageCircle size={19} />
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted">Директна връзка</div>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted leading-relaxed">Опишете какво искате да направите, изпратете снимки или задайте въпрос за оглед, срок и ориентировъчна оферта.</p>
      <button
        type="button"
        onClick={onStartChat}
        disabled={chatState.status === 'loading'}
        className="btn btn-ghost mt-6 w-full justify-center py-3.5 text-sm font-semibold rounded-xl hover:bg-ink hover:text-paper hover:border-ink transition-all duration-200 disabled:opacity-50"
      >
        {chatState.status === 'loading' ? 'Отваряме чат…' : 'Започни чат'}
      </button>
      {chatState.message && (
        <div className={`mt-3 text-center text-xs font-medium ${chatState.status === 'error' ? 'text-amber-800' : 'text-muted'}`}>
          {chatState.message}
        </div>
      )}
    </div>
  )
}

function NotFound({ type }) {
  return (
    <section className="section">
      <div className="container-page max-w-2xl text-center">
        <h1 className="h-section">Този {type} не е намерен.</h1>
        <p className="text-muted mt-3">Може да си отворил линк директно. Върни се в каталога и избери от списъка.</p>
        <Link to="/katalog" className="btn btn-primary mt-6 inline-flex">Към каталога</Link>
      </div>
    </section>
  )
}

function LoadingProfile() {
  return (
    <section className="section">
      <div className="container-page max-w-2xl text-center">
        <h1 className="h-section">Зареждаме профила…</h1>
        <p className="text-muted mt-3">Още малко и ще видиш всички детайли за специалиста.</p>
      </div>
    </section>
  )
}

function InquiryBox({ proName, title, layerSlug, targetSlug, clientId }) {
  const [form, setForm] = useState({ name: '', contact: '', message: '' })
  const [status, setStatus] = useState('idle')
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.contact.trim() || !form.message.trim()) return
    setStatus('sending')
    const { data: newInquiry, error } = await supabase.from('inquiries').insert({
      name: form.name.trim(),
      contact: form.contact.trim(),
      layer_slug: layerSlug,
      message: form.message.trim(),
      source: 'pro_inquiry',
      target_slug: targetSlug || proName,
      client_id: clientId || null,
    }).select().single()
    setStatus(error ? 'error' : 'sent')
    if (!error) {
      supabase.functions.invoke('notify-inquiry', {
        body: { record: newInquiry }
      }).catch(err => console.error('[pro] failed to notify:', err))

      trackEvent('submit_inquiry', {
        source: 'pro_profile',
        target_slug: targetSlug || undefined,
        layer: layerSlug || undefined,
      })
      setForm({ name: '', contact: '', message: '' })
    }
  }

  return (
    <form onSubmit={submit} className="border border-line rounded-3xl p-6 md:p-8 bg-paper shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <div className="text-xs font-bold uppercase tracking-wider text-accentDeep mb-2">{title || 'Опиши проекта си'}</div>
      {status === 'sent' ? (
        <div className="py-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-trustGreen/10 text-trustGreen">
            <CheckCircle2 size={24} />
          </div>
          <h4 className="mt-4 font-display text-xl font-bold text-ink">Запитването е изпратено!</h4>
          <p className="text-sm text-muted mt-2 leading-relaxed">
            {proName} ще получи твоето съобщение и ще се свърже с теб в рамките на 48 часа.
          </p>
          <button type="button" onClick={() => setStatus('idle')} className="btn btn-ghost w-full justify-center mt-6 py-3.5 text-sm font-semibold rounded-xl">
            Изпрати ново запитване
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted leading-relaxed">Попълни бързото запитване за оглед, оферта или съвместна работа. Отговор до 48 часа.</p>
          <div className="mt-6 space-y-4">
            <div>
              <input
                value={form.name}
                onChange={set('name')}
                placeholder="Твоето име"
                className="w-full px-4 py-3.5 rounded-xl border border-line/75 bg-soft/20 focus:bg-paper focus:border-accentDeep outline-none text-sm transition-all duration-200 placeholder:text-muted/60"
              />
            </div>
            <div>
              <input
                value={form.contact}
                onChange={set('contact')}
                placeholder="Имейл или телефон"
                className="w-full px-4 py-3.5 rounded-xl border border-line/75 bg-soft/20 focus:bg-paper focus:border-accentDeep outline-none text-sm transition-all duration-200 placeholder:text-muted/60"
              />
            </div>
            <div>
              <textarea
                value={form.message}
                onChange={set('message')}
                rows={4}
                placeholder="Разкажи ни накратко за проекта си..."
                className="w-full px-4 py-3.5 rounded-xl border border-line/75 bg-soft/20 focus:bg-paper focus:border-accentDeep outline-none text-sm transition-all duration-200 placeholder:text-muted/60 resize-none"
              />
            </div>
            <button
              disabled={status === 'sending'}
              className="btn btn-primary w-full justify-center py-3.5 text-sm font-semibold tracking-wide shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:opacity-50"
            >
              {status === 'sending' ? 'Изпращане…' : 'Изпрати запитване'}
            </button>
          </div>
          {status === 'error' && (
            <div className="mt-3 text-center text-xs font-semibold text-red-600">
              Грешка при изпращане. Опитай пак.
            </div>
          )}
          <div className="mt-4 text-center text-[11px] text-muted">
            Безплатно · Без допълнително обвързване
          </div>
        </>
      )}
    </form>
  )
}
