import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, FolderKanban, Layers3, MapPin, MessageSquare, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import FallbackImage from '../components/FallbackImage.jsx'
import MediaCarousel, { isValidMedia } from '../components/media/MediaCarousel.jsx'
import { useAccount } from '../lib/account.js'
import { createConversationFromProfile, sendCatalogReference } from '../lib/chat.js'
import { loadPublicPortfolioItem, portfolioProjectPath } from '../lib/portfolio.js'
import { getProfileImageCandidates, getProfileImageStyle, normalizeProfile } from '../lib/profiles.js'
import { getPageLocation, trackEvent, trackPageView } from '../lib/analytics.js'
import { buildBreadcrumbSchema, useSeo } from '../lib/seo.js'
import { LAYERS } from '../data/layers.js'

function getLayerLabel(slug = '') {
  const layer = LAYERS.find(item => item.slug === slug)
  return layer ? `Слой ${layer.number} · ${layer.title}` : 'Портфолио проект'
}

function TextBlock({ text = '' }) {
  const paragraphs = String(text || '').split('\n').map(item => item.trim()).filter(Boolean)
  if (!paragraphs.length) return <p className="text-muted">Описание предстои.</p>
  return <div className="space-y-4 text-muted">{paragraphs.map((item, index) => <p key={index}>{item}</p>)}</div>
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
        <Link to="/katalog" className="btn btn-primary mt-6 inline-flex">Към каталога</Link>
      </div>
    </section>
  )
}

export default function PortfolioProject() {
  const { profileSlug, projectId } = useParams()
  const navigate = useNavigate()
  const { session, loading: accountLoading } = useAccount()
  const contentSectionRef = useRef(null)
  const actionAsideRef = useRef(null)
  const actionCardRef = useRef(null)
  const trackedProjectRef = useRef('')
  const [item, setItem] = useState(null)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [chatState, setChatState] = useState({ status: 'idle', message: '' })
  const projectPath = portfolioProjectPath(profileSlug, projectId)

  useEffect(() => {
    if (accountLoading) return
    let active = true

    async function load() {
      setStatus('loading')
      setMessage('')
      try {
        const row = await loadPublicPortfolioItem(projectId)
        if (!active) return
        if (!row?.profile || !row.isPublished) {
          setStatus('not-found')
          return
        }
        const normalizedProfile = normalizeProfile(row.profile)
        if (!normalizedProfile.isPublished || normalizedProfile.slug !== profileSlug) {
          setStatus('not-found')
          return
        }
        setItem({ ...row, profile: normalizedProfile })
        setStatus('ready')
      } catch (error) {
        if (!active) return
        setStatus('error')
        setMessage(error.message || 'Портфолио проектът не се зареди.')
      }
    }

    load()
    return () => { active = false }
  }, [accountLoading, profileSlug, projectId])

  const profile = item?.profile || null
  const media = useMemo(() => (item?.media || []).filter(isValidMedia), [item])
  const profileImageCandidates = useMemo(() => getProfileImageCandidates(profile), [profile])
  const heroImage = media[0]?.url || item?.coverUrl || profile?.coverUrl || profile?.imageUrl || ''
  const layerLabel = getLayerLabel(item?.layerSlug)
  const metrics = useMemo(() => ([
    item?.layerSlug ? { key: 'layer', label: 'Категория', value: layerLabel, icon: Layers3 } : null,
    item?.city ? { key: 'city', label: 'Град', value: item.city, icon: MapPin } : null,
    item?.year ? { key: 'year', label: 'Година', value: String(item.year), icon: CalendarDays } : null,
    item?.budgetBand ? { key: 'accent', label: 'Акцент', value: item.budgetBand, icon: Sparkles } : null,
  ].filter(Boolean)), [item?.budgetBand, item?.city, item?.layerSlug, item?.year, layerLabel])

  const seoConfig = useMemo(() => {
    if (!profileSlug || !projectId) return null
    if (status === 'ready' && item && profile) {
      const description = item.description || `${item.title} е реализиран проект от ${profile.name} в Totsan.`
      return {
        title: `${item.title} | Портфолио на ${profile.name} | Totsan`,
        description,
        canonicalPath: projectPath,
        jsonLd: [
          buildBreadcrumbSchema([
            { name: 'Начало', path: '/' },
            { name: profile.name, path: `/profil/${profile.slug}` },
            { name: item.title, path: projectPath },
          ]),
        ],
      }
    }

    if (status === 'loading') return null

    return {
      title: 'Портфолио проектът не е наличен | Totsan',
      description: 'Този портфолио проект още не е публичен или вече не е наличен.',
      canonicalPath: projectPath,
      robots: 'noindex, nofollow',
    }
  }, [item, profile, profileSlug, projectId, projectPath, status])

  useSeo(seoConfig)

  useEffect(() => {
    if (status !== 'ready' || !item || !profile || !seoConfig?.title) return
    const trackedKey = `${profile.slug}:${item.id}`
    if (trackedProjectRef.current === trackedKey) return
    trackedProjectRef.current = trackedKey
    trackPageView({
      pagePath: projectPath,
      pageTitle: seoConfig.title,
      pageLocation: getPageLocation(projectPath),
    })
    trackEvent('view_portfolio_project', {
      profile_slug: profile.slug || undefined,
      project_id: item.id || undefined,
      layer: item.layerSlug || undefined,
    })
  }, [item, profile, projectPath, seoConfig?.title, status])

  useEffect(() => {
    let frameId = 0

    function updateCardOffset() {
      const cardElement = actionCardRef.current
      if (typeof window === 'undefined') return
      if (window.innerWidth < 1024) {
        if (cardElement) cardElement.style.transform = 'translateY(0px)'
        return
      }

      const sectionRect = contentSectionRef.current?.getBoundingClientRect()
      const asideHeight = actionAsideRef.current?.offsetHeight || 0
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
        updateCardOffset()
      })
    }

    updateCardOffset()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId)
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
    }
  }, [chatState.message, chatState.status, item?.id])

  async function startChat() {
    if (!profile?.id) return
    trackEvent('start_chat', {
      source: 'portfolio_project_page',
      profile_slug: profile.slug || undefined,
      project_id: item?.id || undefined,
      layer: item?.layerSlug || undefined,
    })
    if (!session) {
      navigate('/login')
      return
    }
    setChatState({ status: 'opening', message: 'Отваряме защитен чат…' })
    try {
      const conversation = await createConversationFromProfile({ profileId: profile.id, subject: `Въпрос за проект: ${item?.title || 'Портфолио проект'}` })
      await sendCatalogReference({ conversationId: conversation.id, referenceType: 'portfolio', referenceId: item.id })
      navigate(`/inbox/${conversation.id}`)
    } catch (error) {
      setChatState({ status: 'error', message: error.message || 'Чатът не се отвори.' })
    }
  }

  if (status === 'loading') {
    return <section className="section"><div className="container-page text-muted">Зареждаме проекта…</div></section>
  }

  if (status === 'error') {
    return <StatusPanel title="Проектът не се зареди" text={message} />
  }

  if (status === 'not-found' || !item || !profile) {
    return <StatusPanel title="Проектът не е наличен" text="Този портфолио проект още не е публичен или вече не е наличен." />
  }

  return (
    <>
      <section className="section !pt-8 !pb-0 bg-soft">
        <div className="container-page">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to={`/profil/${profile.slug}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-ink"><ArrowLeft size={17} /> Назад към профила</Link>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted">
              <ShieldCheck size={14} className="text-accentDeep" />
              Публичен портфолио проект
            </span>
          </div>

          <div className="mt-6 max-w-4xl">
            <div className="eyebrow">Портфолио</div>
            <h1 className="mt-3 font-display text-[clamp(2.5rem,2rem+2vw,5rem)] leading-none text-ink">{item.title}</h1>
            {item.description && <p className="mt-5 text-lg text-muted">{item.description}</p>}
          </div>
        </div>

        {heroImage ? (
          <MediaCarousel
            images={media.length ? media : [{ type: 'image/jpeg', url: heroImage, caption: item.title }]}
            eyebrow="Снимки и визуален контекст"
            title="Галерия на проекта"
          />
        ) : (
          <div className="container-page mt-8 mb-8">
            <div className="overflow-hidden rounded-3xl border border-line bg-paper max-w-5xl">
              <div className="aspect-[21/9] bg-soft">
                <FallbackImage
                  sources={[heroImage, profile.coverUrl, profile.imageUrl].filter(Boolean)}
                  alt={item.title}
                  className="img-cover"
                  style={heroImage ? undefined : getProfileImageStyle(profile)}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      <section ref={contentSectionRef} className="section !pt-4 !pb-6">
        <div className="container-page grid gap-8 lg:grid-cols-12">
          <main className="lg:col-span-8 space-y-6">
            <div className="rounded-[2rem] border border-line bg-paper p-5 shadow-[0_18px_50px_rgba(13,35,64,0.06)] sm:p-6 lg:p-8">
              <div>
                <div className="eyebrow">История на проекта</div>
                <h2 className="mt-2 break-words font-display text-3xl font-semibold text-ink">Какво е реализирано</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                  Портфолиото е доказателството за реален вкус, изпълнение и внимание към детайла.
                </p>
              </div>

              <div className="mt-7 rounded-[1.5rem] border border-line/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(245,248,251,0.92))] p-5">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-accentDeep">
                  <FolderKanban size={15} />
                  Какво вижда клиентът
                </div>
                <div className="mt-3 text-sm leading-relaxed text-ink/84 sm:text-base">
                  <TextBlock text={item.description || `${item.title} е част от публичното портфолио на ${profile.name}.`} />
                </div>
              </div>

              {metrics.length > 0 && (
                <div className="mt-7">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                    <Layers3 size={15} />
                    Основни параметри
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {metrics.map((metric) => <BriefMetric key={metric.key} item={metric} />)}
                  </div>
                </div>
              )}
            </div>

            <Panel eyebrow="Партньор" title="Кой стои зад проекта">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="h-20 w-20 overflow-hidden rounded-full bg-soft">
                  <FallbackImage sources={profileImageCandidates} alt={profile.name} className="img-cover" style={getProfileImageStyle(profile)} />
                </div>
                <div>
                  <h3 className="font-display text-3xl text-ink">{profile.name}</h3>
                  <p className="mt-1 text-sm text-muted">{profile.tag} · {profile.city}</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link to={`/profil/${profile.slug}`} className="inline-flex text-sm font-medium text-ink underline underline-offset-4">Виж профила</Link>
                    <Link to={`/profil/${profile.slug}#profile-services`} className="inline-flex text-sm font-medium text-ink underline underline-offset-4">Виж услугите</Link>
                  </div>
                </div>
              </div>
            </Panel>
          </main>

          <aside ref={actionAsideRef} className="lg:col-span-4 lg:self-stretch">
            <div ref={actionCardRef} className="rounded-3xl border border-line bg-paper p-5 md:p-6 lg:will-change-transform">
              <div className="eyebrow">Следваща стъпка</div>
              <div className="mt-5">
                <h2 className="font-display text-3xl text-ink">Харесва ли ти тази посока?</h2>
                <p className="mt-2 text-sm text-muted">
                  Използвай този проект като ориентир и продължи към услугите или директно към чат с партньора.
                </p>
                <div className="mt-5 grid gap-2 text-sm text-muted">
                  <span className="inline-flex items-center gap-2 text-base font-medium text-emerald-600"><ShieldCheck size={18} /> Портфолиото служи като доказателство за качество</span>
                  <span>Totsan пази публичния контекст, а разговорът и поръчката продължават през профила на партньора.</span>
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                <Link to={`/profil/${profile.slug}#profile-services`} className="btn btn-primary w-full justify-center">
                  Разгледай услугите
                </Link>
                <button type="button" className="btn btn-ghost w-full justify-center" onClick={startChat} disabled={chatState.status === 'opening'}>
                  <MessageSquare size={18} /> {chatState.status === 'opening' ? 'Отваряме…' : 'Попитай за подобен проект'}
                </button>
                <Link to={`/profil/${profile.slug}`} className="btn btn-ghost w-full justify-center">
                  <UserRound size={18} /> Виж целия профил
                </Link>
                {chatState.message && <div className={`rounded-2xl p-3 text-sm ${chatState.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-soft text-muted'}`}>{chatState.message}</div>}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}
