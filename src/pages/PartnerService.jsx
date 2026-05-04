import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MessageSquare, ShieldCheck, Star } from 'lucide-react'
import { createConversationFromProfile } from '../lib/chat.js'
import { getProfileImage, getProfileImageStyle, normalizeProfile } from '../lib/profiles.js'
import { formatServicePrice, loadPartnerServiceBySlug, packagePriceLabel } from '../lib/partner-services.js'
import { useAccount } from '../lib/account.js'
import ReviewsList from '../components/reviews/ReviewsList.jsx'

export default function PartnerService() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { session } = useAccount()
  const [service, setService] = useState(null)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [chatState, setChatState] = useState({ status: 'idle', message: '' })

  useEffect(() => {
    let active = true
    async function load() {
      setStatus('loading')
      setMessage('')
      try {
        const row = await loadPartnerServiceBySlug(slug)
        if (!active) return
        if (!row || !row.isPublished || row.moderationStatus !== 'approved') {
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
  }, [slug])

  const profile = useMemo(() => service?.profile ? normalizeProfile(service.profile) : null, [service])
  const packages = useMemo(() => service?.packages?.filter(item => item.isActive) || [], [service])
  const activePackage = packages[0]
  const cover = service?.coverUrl || service?.media?.[0]?.url || profile?.imageUrl

  async function startChat() {
    if (!service || !profile) return
    if (!session) {
      navigate('/login')
      return
    }
    setChatState({ status: 'opening', message: 'Отваряме защитен чат…' })
    try {
      const conversation = await createConversationFromProfile({ profileId: service.profileId, subject: `Въпрос за услуга: ${service.title}` })
      navigate(`/inbox/${conversation.id}`)
    } catch (error) {
      setChatState({ status: 'error', message: error.message || 'Чатът не се отвори.' })
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
      <section className="section !pt-10 bg-soft">
        <div className="container-page">
          <Link to="/katalog" className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-ink"><ArrowLeft size={17} /> Назад към каталога</Link>
          <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-7">
              <div className="eyebrow">Партньорска услуга</div>
              <h1 className="mt-3 font-display text-[clamp(2.5rem,2rem+2vw,5rem)] leading-none text-ink">{service.title}</h1>
              {service.subtitle && <p className="mt-5 max-w-3xl text-lg text-muted">{service.subtitle}</p>}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link to={`/profil/${profile.slug}`} className="inline-flex items-center gap-3 rounded-full border border-line bg-paper px-3 py-2 text-sm text-ink transition hover:border-ink/40">
                  <span className="h-9 w-9 overflow-hidden rounded-full bg-soft"><img src={getProfileImage(profile)} alt={profile.name} className="img-cover" style={getProfileImageStyle(profile)} /></span>
                  <span>{profile.name}</span>
                </Link>
                <span className="inline-flex items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm text-muted"><Star size={16} /> {profile.rating.toFixed(1)}</span>
              </div>
            </div>
            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-3xl border border-line bg-paper">
                <div className="aspect-[16/11] bg-soft">{cover ? <img src={cover} alt={service.title} className="img-cover" /> : null}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section !pt-10">
        <div className="container-page grid gap-8 lg:grid-cols-12">
          <main className="lg:col-span-8 space-y-6">
            <Panel eyebrow="Описание" title="За услугата">
              <TextBlock text={service.descriptionMd || service.subtitle} />
              {service.tags.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{service.tags.map(tag => <span key={tag} className="rounded-full bg-soft px-3 py-1 text-xs text-muted">{tag}</span>)}</div>}
            </Panel>

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
                <div className="h-20 w-20 overflow-hidden rounded-full bg-soft"><img src={getProfileImage(profile)} alt={profile.name} className="img-cover" style={getProfileImageStyle(profile)} /></div>
                <div>
                  <h3 className="font-display text-3xl text-ink">{profile.name}</h3>
                  <p className="mt-1 text-sm text-muted">{profile.tag} · {profile.city}</p>
                  <Link to={`/profil/${profile.slug}`} className="mt-3 inline-flex text-sm font-medium text-ink underline underline-offset-4">Виж профила</Link>
                </div>
              </div>
            </Panel>

            <ReviewsList serviceId={service.id} partnerId={profile.userId} title={`Отзиви за ${service.title}`} />
          </main>

          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-24 rounded-3xl border border-line bg-paper p-5 md:p-6">
              <div className="eyebrow">Оферта</div>

              {activePackage ? (
                <div className="mt-5">
                  <h2 className="font-display text-3xl text-ink">{activePackage.title}</h2>
                  <p className="mt-2 text-sm text-muted">{activePackage.description}</p>
                  <div className="mt-5 font-display text-4xl text-ink">{activePackage.priceAmount ? formatServicePrice(activePackage.priceAmount) : packagePriceLabel(service)}</div>
                  <div className="mt-4 grid gap-2 text-sm text-muted">
                    <span className="inline-flex items-center gap-2"><ShieldCheck size={16} /> Плащане през Totsan</span>
                  </div>
                  {activePackage.features.length > 0 && (
                    <ul className="mt-5 space-y-2 text-sm text-ink/80">
                      {activePackage.features.map(feature => <li key={feature}>• {feature}</li>)}
                    </ul>
                  )}
                </div>
              ) : <p className="mt-5 text-sm text-muted">Няма активна оферта.</p>}

              <div className="mt-6 grid gap-3">
                <button type="button" className="btn btn-primary w-full justify-center" disabled={!activePackage} onClick={() => {
                  if (!session) {
                    navigate('/login')
                    return
                  }
                  if (activePackage?.id) navigate(`/checkout/service/${activePackage.id}`)
                }}>Поръчай</button>
                <button type="button" className="btn btn-ghost w-full justify-center" onClick={startChat} disabled={chatState.status === 'opening'}><MessageSquare size={18} /> {chatState.status === 'opening' ? 'Отваряме…' : 'Питай първо'}</button>
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
  return <div className="space-y-4 text-muted">{paragraphs.map(item => <p key={item}>{item}</p>)}</div>
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
