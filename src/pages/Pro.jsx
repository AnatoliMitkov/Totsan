import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Globe2, Languages, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { LAYER_HEROS } from '../data/images.js'
import { DELIVERABLES, SPECIALIST_TYPES, SPECIFIC_SERVICES, TARGET_OBJECTS } from '../data/layer01-meta.js'
import { getProfileImage, getProfileImageStyle, normalizeProfile, runProfileSelectWithLayer01Fallback, slugify, useProfileDirectory } from '../lib/profiles.js'
import { loadProfilePortfolio, loadProfileStats } from '../lib/portfolio.js'
import { loadPublicPartnerServicesForProfile, packagePriceLabel } from '../lib/partner-services.js'
import { useAccount } from '../lib/account.js'
import { createConversationFromProfile } from '../lib/chat.js'
import PortfolioGallery from '../components/profile/PortfolioGallery.jsx'
import PartnerStats from '../components/profile/PartnerStats.jsx'
import PublicProfileBanner from '../components/profile/PublicProfileBanner.jsx'
import PublicProfilePanel from '../components/profile/PublicProfilePanel.jsx'
import ReviewsList from '../components/reviews/ReviewsList.jsx'
import { getPageLocation, trackEvent, trackPageView } from '../lib/analytics.js'
import { buildBreadcrumbSchema, buildPersonSchema, useSeo } from '../lib/seo.js'

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
      {/* Cover Banner Section */}
      <PublicProfileBanner
        imageSrc={item.coverUrl || LAYER_HEROS[layer.slug]}
        imageAlt=""
        imageStyle={{ objectPosition: `50% ${item.coverY ?? 50}%` }}
      />

      {/* Main Profile Grid Section */}
      <div className="relative z-10 bg-soft flex flex-col pb-16 md:pb-24">
        <div className="container-page w-full px-4 md:px-6 -mt-24">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">

            {/* LEFT COLUMN - Sticky Info, Stats & Inquiry Form */}
            <aside className="lg:col-span-4 reveal">
              <div className="lg:sticky lg:top-24 space-y-6">

                {/* Profile Card */}
                <PublicProfilePanel className="transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)]">
                  <div className="flex flex-col items-center text-center">

                    {/* Squircle Double Border Profile Image */}
                    <div className="relative group">
                      <div className="w-32 h-32 rounded-3xl overflow-hidden border-4 border-paper bg-paper shadow-md transition-transform duration-300 group-hover:scale-[1.02]">
                        <img src={getProfileImage(item)} alt={item.name} className="img-cover" style={getProfileImageStyle(item)} />
                      </div>
                      <span className="absolute bottom-1 right-1 flex h-5 w-5 rounded-full border-4 border-paper bg-trustGreen" title="Онлайн в Totsan" />
                    </div>

                    <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-accentSoft/60 border border-accent/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accentDeep">
                      Слой {layer.number} · {layer.title.split(' ')[0]}
                    </div>

                    <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">{item.name}</h1>
                    <p className="mt-2 text-sm font-medium text-ink/75 max-w-[280px] leading-relaxed">{item.headline || item.sub}</p>

                    <div className="mt-3 flex items-center gap-1.5 text-xs text-muted font-medium">
                      <MapPin size={14} className="text-accent" />
                      <span>{item.city}</span>
                      <span className="text-line">•</span>
                      <span>от {item.since} г.</span>
                    </div>
                  </div>

                  {/* Stats tiles */}
                  <div className="mt-8 border-t border-line/60 pt-6">
                    <PartnerStats
                      profile={item}
                      stats={stats}
                      serviceCount={services.length}
                      projectCount={portfolio.length}
                      onServicesClick={() => scrollToSection(servicesSectionRef)}
                      onProjectsClick={() => scrollToSection(portfolioSectionRef)}
                      onReviewsClick={() => scrollToSection(reviewsSectionRef)}
                      onResponseClick={startChat}
                      responseDisabled={isOwnProfile || (!item.id && !partnerUserId) || chatState.status === 'loading'}
                      responseLabel={isOwnProfile ? 'Не можеш да започнеш чат със собствения си профил' : `Започни чат с ${item.name}`}
                    />
                  </div>
                </PublicProfilePanel>

                {/* Inquiry Box Form */}
                <InquiryBox
                  proName={item.name}
                  title={item.name ? `Изпрати запитване до ${item.name}` : 'Опиши проекта си'}
                  layerSlug={item.layerSlug || item.layer}
                  targetSlug={item.slug}
                  clientId={session?.user?.id}
                />

                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted">
                  <span className="h-px flex-1 bg-line/80" />или чат след запитване<span className="h-px flex-1 bg-line/80" />
                </div>

                {/* Chat Action Card */}
                <ContactCard onStartChat={startChat} chatState={chatState} />

              </div>
            </aside>

            {/* RIGHT COLUMN - Main Content Sections */}
            <div className="lg:col-span-8 reveal lg:pt-6 space-y-12">

              {/* Back Link & Biography */}
              <div className="rounded-3xl border border-line bg-paper p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
                <Link to="/katalog" className="group inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted hover:text-ink transition-colors duration-200 mb-6">
                  <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span> Обратно в каталога
                </Link>

                <div className="eyebrow mb-2">Биография & Професионален опит</div>
                <h2 className="font-display text-2xl font-semibold text-ink mb-4">За {item.name}</h2>
                <p className="whitespace-pre-line text-ink/80 leading-relaxed font-sans" style={{ fontSize: 'var(--step-sm)' }}>
                  {item.descriptionLong || item.bio}
                </p>

                {/* Core Parameters Grid */}
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <MetaTile icon={MapPin} label="Работи в" value={item.serviceAreas?.length ? item.serviceAreas.join(', ') : item.city} />
                  <MetaTile icon={Languages} label="Езици" value={item.languages?.length ? item.languages.join(', ') : 'Български'} />
                  <MetaTile icon={Globe2} label="Формат" value={item.acceptsRemote ? 'На място / Дистанционно' : 'На място'} />
                  <MetaTile icon={CheckCircle2} label="Опит" value={`${item.yearsExperience || Math.max(0, new Date().getFullYear() - item.since)} години`} />
                </div>

                {/* Pricing Banner */}
                {item.pricingNote && (
                  <div className="mt-6 rounded-2xl bg-accentSoft/30 border border-accentSoft/60 p-5 flex items-start gap-4 transition-all duration-300 hover:bg-accentSoft/40">
                    <div className="text-2xl mt-0.5 select-none">💳</div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-accentDeep">Бюджет & Ценови условия</div>
                      <p className="mt-1 text-sm font-semibold text-ink/90">{item.pricingNote}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Services & Offers */}
              <ProfileServicesSection ref={servicesSectionRef} services={services} profile={item} />

              {/* Specialist Extra Details */}
              {hasLayer01Details && <Layer01ProfileDetails meta={layer01Meta} />}

              {/* Stepper Timeline */}
              <div className="rounded-3xl border border-line bg-paper p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
                <div className="eyebrow mb-2">Методология</div>
                <h3 className="font-display text-3xl font-semibold text-ink mb-6">Как протича процесът</h3>

                {layer01Process.length > 0 ? (
                  <div className="relative border-l-2 border-line/60 ml-3 pl-6 space-y-6 py-2">
                    {layer01Process.map((step, index) => (
                      <div key={`${step.title}-${index}`} className="relative group">
                        {/* Stepper Dot */}
                        <div className="absolute -left-[2.05rem] top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-accentDeep bg-paper transition-colors duration-200 group-hover:bg-accentDeep" />

                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <div className="font-display text-xl font-semibold text-ink group-hover:text-accentDeep transition-colors duration-200">{step.title || `Стъпка ${index + 1}`}</div>
                          {step.duration && <div className="text-[10px] font-bold uppercase tracking-wider text-accentDeep bg-accentSoft px-2 py-0.5 rounded-md">{step.duration}</div>}
                        </div>
                        {step.description && <p className="mt-1.5 text-sm text-muted leading-relaxed">{step.description}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {layer.process.map(p => (
                      <div key={p.n} className="group relative border border-line bg-soft/30 rounded-2xl p-5 transition-all duration-300 hover:bg-soft hover:shadow-[0_8px_25px_rgba(0,0,0,0.02)]">
                        <div className="absolute top-4 right-4 font-display text-2xl font-bold text-accent/20 transition-colors duration-200 group-hover:text-accent">{p.n}</div>
                        <div className="font-display text-lg font-bold text-ink pr-8">{p.t}</div>
                        <p className="text-sm text-muted mt-2 leading-relaxed">{p.d}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Consultation Info */}
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
                      {Number(layer01Meta.consultation_fee) === 0 ? 'Безплатна' : `${Number(layer01Meta.consultation_fee)} лв.`}
                    </div>
                  </div>
                </div>
              )}

              {/* Portfolio Grid */}
              <div
                ref={portfolioSectionRef}
                id="profile-projects"
                className="scroll-mt-24 rounded-3xl border border-line bg-paper p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
              >
                <div className="eyebrow mb-2">Портфолио</div>
                <h2 className="font-display text-3xl font-semibold text-ink mb-6">Реални реализирани проекти</h2>
                <div>
                  <PortfolioGallery items={portfolio} emptyText="Този партньор още не е публикувал свои проекти." />
                </div>
              </div>

              {/* Reviews List */}
              <div ref={reviewsSectionRef} id="profile-reviews" className="scroll-mt-24">
                <ReviewsList partnerId={partnerUserId} title={`Отзиви за ${item.name}`} emptyText="Все още няма публични отзиви." />
              </div>

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
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</div>
        <div className="mt-0.5 text-sm font-semibold text-ink line-clamp-1">{value}</div>
      </div>
    </div>
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

const ProfileServicesSection = forwardRef(function ProfileServicesSection({ services, profile }, ref) {
  return (
    <div ref={ref} id="profile-services" className="mt-10 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
        <div>
          <div className="eyebrow">Услуги & оферти</div>
          <h2 className="mt-2 font-display text-3xl text-ink">Предложения от {profile.name}</h2>
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
              className="group flex flex-col justify-between rounded-3xl border border-line/50 bg-paper p-6 transition-all duration-300 hover:-translate-y-1 hover:border-ink/25 hover:shadow-[0_12px_30px_rgba(13,35,64,0.06)]"
            >
              <div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accentSoft/60 text-accentDeep">
                    <BriefcaseBusiness size={20} />
                  </div>
                  <span className="rounded-full bg-accentSoft/50 px-3 py-1 text-xs font-bold text-accentDeep border border-accentSoft">
                    {packagePriceLabel(service)}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-2xl leading-tight text-ink group-hover:text-accentDeep transition-colors duration-200">{service.title}</h3>
                {service.subtitle && <p className="mt-2 line-clamp-2 text-sm text-muted">{service.subtitle}</p>}
              </div>
              <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-ink group-hover:text-accent transition-colors duration-200">
                Детайли по офертата <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-3xl border border-dashed border-line/80 bg-soft/30 p-6 text-center text-sm text-muted">
          Този партньор още няма публични услуги. Можеш да започнеш разговор директено от бутона за контакт.
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
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
          </svg>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted">Директна връзка</div>
          <div className="font-display text-lg font-semibold text-ink">Чат на живо</div>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted leading-relaxed">Имаш въпрос за наличност, цени или оглед? Пиши директно в чата на Totsan.</p>
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
