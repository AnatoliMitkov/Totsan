import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MessageSquare, ShieldCheck, Star, Layers3, MapPin, CalendarDays, RefreshCcw, WalletCards, Package, Image as ImageIcon, LayoutList, CheckCircle2, MessageCircle } from 'lucide-react'
import FallbackImage from '../components/FallbackImage.jsx'
import { createConversationFromProfile, createServiceRequest, sendCatalogReference } from '../lib/chat.js'
import { getProfileImageCandidates, getProfileImageStyle, normalizeProfile } from '../lib/profiles.js'
import { formatServicePrice, loadPartnerServiceBySlug, packagePriceLabel } from '../lib/partner-services.js'
import { getPartnerServiceCoverCandidates } from '../lib/service-media.js'
import MediaCarousel, { isValidMedia } from '../components/media/MediaCarousel.jsx'
import { useAccount } from '../lib/account.js'
import ReviewsList from '../components/reviews/ReviewsList.jsx'
import { getPageLocation, trackEvent, trackPageView } from '../lib/analytics.js'
import { buildBreadcrumbSchema, buildFaqSchema, buildServiceSchema, useSeo } from '../lib/seo.js'

export default function PartnerService() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { session, isAdmin, loading: accountLoading } = useAccount()
  const contentSectionRef = useRef(null)
  const packageAsideRef = useRef(null)
  const packageCardRef = useRef(null)
  const [service, setService] = useState(null)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [chatState, setChatState] = useState({ status: 'idle', message: '' })
  const trackedServiceSlugRef = useRef('')
  const servicePath = slug ? `/uslugi/${slug}` : '/uslugi'

  useEffect(() => {
    if (accountLoading) return
    let active = true
    async function load() {
      setStatus('loading')
      setMessage('')
      try {
        const row = await loadPartnerServiceBySlug(slug)
        if (!active) return
        if (!row || (!isAdmin && (!row.isPublished || row.moderationStatus !== 'approved'))) {
          setStatus('not-found')
          return
        }
        setService(row)
        setStatus('ready')
      } catch (error) {
        if (!active) return
        setStatus('error')
        setMessage(error.message || 'Услугата не се зареди.')
      }
    }
    load()
    return () => { active = false }
  }, [slug, accountLoading, isAdmin])

  const profile = useMemo(() => {
    if (!service) return null
    if (service.profile) return normalizeProfile(service.profile)
    return normalizeProfile({
      id: service.profileId,
      slug: '',
      name: 'Партньор в Totsan',
      tag: 'Партньор',
      city: service.deliveryAreas?.[0] || '',
      layer_slug: service.layerSlug,
      is_published: true,
      user_id: service.partnerId,
    })
  }, [service])
  const packages = useMemo(() => service?.packages?.filter(item => item.isActive) || [], [service])
  const activePackage = packages[0]
  const coverCandidates = useMemo(() => getPartnerServiceCoverCandidates(service, profile), [profile, service])
  const imageMedia = useMemo(() => (service?.media || []).filter(isValidMedia), [service])
  const profileImageCandidates = useMemo(() => getProfileImageCandidates(profile), [profile])
  const seoConfig = useMemo(() => {
    if (!slug) return null
    if (status === 'ready' && service && profile) {
      const description = service.subtitle || service.descriptionMd || `${service.title} е публикувана партньорска услуга в Totsan.`
      return {
        title: `${service.title} | Totsan`,
        description,
        canonicalPath: servicePath,
        jsonLd: [
          buildBreadcrumbSchema([
            { name: 'Начало', path: '/' },
            { name: 'Услуги', path: '/uslugi' },
            { name: service.title, path: servicePath },
          ]),
          buildServiceSchema(service, profile, servicePath),
          service.faq.length > 0 ? buildFaqSchema(service.faq.map((item) => ({ question: item.question, answer: item.answer }))) : null,
        ].filter(Boolean),
      }
    }

    if (status === 'loading') return null

    return {
      title: 'Услугата не е налична | Totsan',
      description: 'Тази услуга още не е одобрена или вече не е публична.',
      canonicalPath: servicePath,
      robots: 'noindex, nofollow',
    }
  }, [profile, service, servicePath, slug, status])

  useSeo(seoConfig)

  const parameterItems = useMemo(() => {
    const items = []
    if (service?.layerSlug) items.push({ key: 'layer', label: 'Категория', value: `Слой ${profile?.layerNumber || ''} - ${profile?.layerTitle || ''}`, icon: Layers3 })
    if (service?.deliveryAreas?.length > 0) items.push({ key: 'location', label: 'Локация', value: service.deliveryAreas.join(', '), icon: MapPin })
    if (activePackage?.deliveryDays) items.push({ key: 'delivery', label: 'Време за изпълнение', value: `${activePackage.deliveryDays} ${activePackage.deliveryDays === 1 ? 'ден' : 'дни'}`, icon: CalendarDays })
    if (activePackage?.revisions) items.push({ key: 'revisions', label: 'Включени ревизии', value: `${activePackage.revisions}`, icon: RefreshCcw })
    return items
  }, [service, profile, activePackage])

  const availabilityItems = useMemo(() => {
    const items = []
    if (activePackage?.priceAmount) items.push({ key: 'budget', label: 'Начална цена', value: formatServicePrice(activePackage.priceAmount), icon: WalletCards })
    if (service?.packages?.length > 0) items.push({ key: 'packages', label: 'Опции', value: `${service.packages.length} ${service.packages.length === 1 ? 'пакет' : 'пакета'}`, icon: Package })
    if (imageMedia?.length > 0) items.push({ key: 'media', label: 'Галерия', value: `${imageMedia.length} снимки/видеа`, icon: ImageIcon })
    return items
  }, [service, activePackage, imageMedia])

  useEffect(() => {
    if (status !== 'ready' || !service || !profile || !seoConfig?.title) return
    if (!service.slug || trackedServiceSlugRef.current === service.slug) return

    trackedServiceSlugRef.current = service.slug
    trackPageView({
      pagePath: servicePath,
      pageTitle: seoConfig.title,
      pageLocation: getPageLocation(servicePath),
    })
    trackEvent('view_service', {
      service_slug: service.slug,
      layer: service.layerSlug || undefined,
      profile_slug: profile.slug || undefined,
    })
  }, [profile, seoConfig?.title, service, servicePath, status])

  useEffect(() => {
    let frameId = 0

    function updatePackageOffset() {
      const cardElement = packageCardRef.current
      if (typeof window === 'undefined') return
      if (window.innerWidth < 1024) {
        if (cardElement) cardElement.style.transform = 'translateY(0px)'
        return
      }

      const sectionRect = contentSectionRef.current?.getBoundingClientRect()
      const asideHeight = packageAsideRef.current?.offsetHeight || 0
      const cardHeight = cardElement?.offsetHeight || 0

      if (!sectionRect || !asideHeight || !cardHeight) {
        if (cardElement) cardElement.style.transform = 'translateY(0px)'
        return
      }

      const maxOffset = Math.max(0, asideHeight - cardHeight)
      const viewportCenter = window.innerHeight / 2
      const desiredOffset = viewportCenter - sectionRect.top - (cardHeight / 2)
      const nextOffset = Math.max(0, Math.min(maxOffset, desiredOffset))
      if (cardElement) cardElement.style.transform = `translate3d(0, ${nextOffset}px, 0)`
    }

    function requestUpdate() {
      if (frameId) return
      frameId = window.requestAnimationFrame(() => {
        frameId = 0
        updatePackageOffset()
      })
    }

    updatePackageOffset()

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => requestUpdate())
      : null

    if (resizeObserver) {
      if (contentSectionRef.current) resizeObserver.observe(contentSectionRef.current)
      if (packageAsideRef.current) resizeObserver.observe(packageAsideRef.current)
      if (packageCardRef.current) resizeObserver.observe(packageCardRef.current)
    }

    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
    }
  }, [activePackage, chatState.message, chatState.status])

  async function startChat() {
    if (!service || !profile) return
    trackEvent('start_chat', {
      source: 'service_page',
      service_slug: service.slug || undefined,
      layer: service.layerSlug || undefined,
    })
    if (!session) {
      navigate('/login')
      return
    }
    setChatState({ status: 'opening', message: 'Отваряме защитен чат…' })
    try {
      const conversation = await createConversationFromProfile({ profileId: service.profileId, subject: `Въпрос за услуга: ${service.title}` })
      await sendCatalogReference({ conversationId: conversation.id, referenceType: 'service', referenceId: service.id })
      navigate(`/inbox/${conversation.id}`)
    } catch (error) {
      setChatState({ status: 'error', message: error.message || 'Чатът не се отвори.' })
    }
  }

  async function startServiceRequest() {
    if (!service || !profile || !activePackage) return
    trackEvent('request_service', {
      source: 'service_page',
      service_slug: service.slug || undefined,
      layer: service.layerSlug || undefined,
    })
    if (!session) {
      navigate('/login')
      return
    }
    setChatState({ status: 'opening', message: 'Създаваме заявката…' })
    try {
      const result = await createServiceRequest({
        serviceId: service.id,
        servicePackageId: activePackage.id,
      })
      navigate(`/inbox/${result.conversation.id}`)
    } catch (error) {
      setChatState({ status: 'error', message: error.message || 'Заявката не беше създадена.' })
    }
  }

  if (status === 'loading') {
    return <section className="section"><div className="container-page text-muted">Зареждаме услугата…</div></section>
  }

  if (status === 'error') {
    return <StatusPanel title="Услугата не се зареди" text={message} />
  }

  if (status === 'not-found' || !service || !profile) {
    return <StatusPanel title="Услугата не е налична" text="Тази услуга още не е одобрена или вече не е публична." />
  }

  return (
    <>
      <section className="section !pt-8 !pb-0 bg-soft">
        <div className="container-page">
          <Link to="/uslugi" className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-ink"><ArrowLeft size={17} /> Назад към услугите</Link>
          {isAdmin && (!service.isPublished || service.moderationStatus !== 'approved') && (
            <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
              <span className="font-medium">Режим на преглед (Админ):</span> Тази услуга все още не е публична за клиенти (статус: {service.moderationStatus}).
            </div>
          )}
          
          <div className="mt-6 max-w-4xl">
            <div className="eyebrow">Партньорска услуга</div>
            <h1 className="mt-3 font-display text-[clamp(2.5rem,2rem+2vw,5rem)] leading-none text-ink">{service.title}</h1>
            {service.subtitle && <p className="mt-5 text-lg text-muted">{service.subtitle}</p>}
          </div>
        </div>

        {imageMedia.length > 0 ? (
          <MediaCarousel 
            images={imageMedia} 
            eyebrow="Снимки и визуален контекст" 
            title="Галерия на услугата" 
          />
        ) : (
          <div className="container-page mt-8 mb-8">
            <div className="overflow-hidden rounded-3xl border border-line bg-paper max-w-5xl">
              <div className="aspect-[21/9] bg-soft"><FallbackImage sources={coverCandidates} alt={service.title} className="img-cover" /></div>
            </div>
          </div>
        )}
      </section>

      <section ref={contentSectionRef} className="section !pt-4 !pb-6">
        <div className="container-page grid gap-8 lg:grid-cols-12">
          <main className="lg:col-span-8 space-y-6">
            <div className="rounded-[2rem] border border-line bg-paper p-5 shadow-[0_18px_50px_rgba(13,35,64,0.06)] sm:p-6 lg:p-8">
              <div>
                <div className="eyebrow">Описание</div>
                <h2 className="mt-2 break-words font-display text-3xl font-semibold text-ink">
                  За услугата
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                  Детайли за това какво включва услугата и какви са нейните параметри.
                </p>
              </div>

              <div className="mt-7 rounded-[1.5rem] border border-line/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(245,248,251,0.92))] p-5">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-accentDeep">
                  <LayoutList size={15} />
                  Какво предлага услугата
                </div>
                <div className="mt-3 text-sm leading-relaxed text-ink/84 sm:text-base">
                  <TextBlock text={service.descriptionMd || service.subtitle} />
                </div>
              </div>

              {parameterItems.length > 0 && (
                <div className="mt-7">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                    <Layers3 size={15} />
                    Основни параметри
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {parameterItems.map((item) => (
                      <BriefMetric key={item.key} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {availabilityItems.length > 0 && (
                <div className="mt-7">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                    <CheckCircle2 size={15} />
                    Цени и условия
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {availabilityItems.map((item) => (
                      <BriefMetric key={item.key} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {service.tags.length > 0 && (
                <div className="mt-7 rounded-[1.5rem] border border-accent/15 bg-accentSoft/35 p-5">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-accentDeep">
                    <MessageCircle size={15} />
                    Етикети и ключови думи
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink/76">
                    Свързани дейности и характеристики.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {service.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink/78">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Panel eyebrow="Въпроси" title="FAQ">
              <div className="space-y-3">
                {service.faq.map(item => (
                  <details key={`${item.question}-${item.orderIndex}`} className="rounded-2xl border border-line bg-soft p-4">
                    <summary className="cursor-pointer font-medium text-ink">{item.question}</summary>
                    <p className="mt-3 text-sm text-muted">{item.answer}</p>
                  </details>
                ))}
                {service.faq.length === 0 && <p className="text-muted">Партньорът още не е добавил често задавани въпроси.</p>}
              </div>
            </Panel>

            <Panel eyebrow="Партньор" title="За изпълнителя">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="h-20 w-20 overflow-hidden rounded-full bg-soft"><FallbackImage sources={profileImageCandidates} alt={profile.name} className="img-cover" style={getProfileImageStyle(profile)} /></div>
                <div>
                  <h3 className="font-display text-3xl text-ink">{profile.name}</h3>
                  <p className="mt-1 text-sm text-muted">{profile.tag} · {profile.city}</p>
                  {profile.slug && <Link to={`/profil/${profile.slug}`} className="mt-3 inline-flex text-sm font-medium text-ink underline underline-offset-4">Виж профила</Link>}
                </div>
              </div>
            </Panel>

            <ReviewsList serviceId={service.id} partnerId={profile.userId} title={`Отзиви за ${service.title}`} />
          </main>

          <aside ref={packageAsideRef} className="lg:col-span-4 lg:self-stretch">
            <div
              ref={packageCardRef}
              className="rounded-3xl border border-line bg-paper p-5 md:p-6 lg:will-change-transform"
            >
              <div className="eyebrow">Пакет и поръчка</div>

              {activePackage ? (
                <div className="mt-5">
                  <h2 className="font-display text-3xl text-ink">{activePackage.title}</h2>
                  <p className="mt-2 text-sm text-muted">{activePackage.description}</p>
                  <div className="mt-5 font-display text-4xl text-ink">{activePackage.priceAmount ? formatServicePrice(activePackage.priceAmount) : packagePriceLabel(service)}</div>
                  <div className="mt-4 grid gap-2 text-sm text-muted">
                    <span className="inline-flex items-center gap-2 text-base font-medium text-emerald-600"><ShieldCheck size={18} /> Директно плащане към партньора</span>
                    <span>Totsan пази офертата и комуникацията, но не приема или гарантира плащането.</span>
                  </div>
                  {activePackage.features.length > 0 && (
                    <ul className="mt-5 space-y-2 text-sm text-ink/80">
                      {activePackage.features.map(feature => <li key={feature}>• {feature}</li>)}
                    </ul>
                  )}
                </div>
              ) : <p className="mt-5 text-sm text-muted">Няма активна оферта.</p>}

              <div className="mt-6 grid gap-3">
                <button type="button" className="btn btn-primary w-full justify-center" disabled={!activePackage || chatState.status === 'opening'} onClick={startServiceRequest}>
                  {chatState.status === 'opening' ? 'Създаваме заявката…' : 'Заяви услугата'}
                </button>
                <p className="text-xs text-muted">Не плащаш сега. Партньорът първо потвърждава възможност и изпраща финална оферта.</p>
                <button type="button" className="btn btn-ghost w-full justify-center" onClick={startChat} disabled={chatState.status === 'opening'}><MessageSquare size={18} /> {chatState.status === 'opening' ? 'Отваряме…' : 'Питай първо'}</button>
                <p className="text-xs text-muted">Използвай чат, ако искаш уточнение преди поръчка.</p>
                {chatState.message && <div className={`rounded-2xl p-3 text-sm ${chatState.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-soft text-muted'}`}>{chatState.message}</div>}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}

function Panel({ eyebrow, title, children }) {
  return (
    <section className="rounded-3xl border border-line bg-paper p-5 md:p-7">
      <div className="eyebrow">{eyebrow}</div>
      <h2 className="mt-2 font-display text-3xl text-ink">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function TextBlock({ text = '' }) {
  const paragraphs = String(text || '').split('\n').map(item => item.trim()).filter(Boolean)
  if (!paragraphs.length) return <p className="text-muted">Описание предстои.</p>
  return <div className="space-y-4 text-muted">{paragraphs.map((item, i) => <p key={i}>{item}</p>)}</div>
}

function BriefMetric({ item }) {
  const Icon = item.icon
  return (
    <div className="flex min-w-0 gap-3 rounded-[1.25rem] border border-line/70 bg-soft/38 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-paper text-accentDeep shadow-sm">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{item.label}</div>
        <div className="mt-1 break-words text-sm font-semibold leading-snug text-ink">{item.value}</div>
      </div>
    </div>
  )
}

function StatusPanel({ title, text }) {
  return (
    <section className="section">
      <div className="container-page max-w-xl text-center">
        <h1 className="h-section">{title}</h1>
        <p className="mt-3 text-muted">{text}</p>
        <Link to="/uslugi" className="btn btn-primary mt-6 inline-flex">Към услугите</Link>
      </div>
    </section>
  )
}
