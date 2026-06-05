import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Globe2, Languages, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { LAYER_HEROS } from '../data/images.js'
import { getProfileImage, getProfileImageStyle, slugify, useProfileDirectory } from '../lib/profiles.js'
import { loadProfilePortfolio, loadProfileStats } from '../lib/portfolio.js'
import { loadPublicPartnerServicesForProfile, packagePriceLabel } from '../lib/partner-services.js'
import { useAccount } from '../lib/account.js'
import { createConversationFromProfile } from '../lib/chat.js'
import PortfolioGallery from '../components/profile/PortfolioGallery.jsx'
import PartnerStats from '../components/profile/PartnerStats.jsx'
import ReviewsList from '../components/reviews/ReviewsList.jsx'

export default function Pro() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const { slug } = useParams()
  const { catalog, layers, profiles, status } = useProfileDirectory()
  const { session } = useAccount()
  const [portfolio, setPortfolio] = useState([])
  const [stats, setStats] = useState(null)
  const [services, setServices] = useState([])
  const [chatState, setChatState] = useState({ status: 'idle', message: '' })
  const item = useMemo(() => {
    const liveProfile = profiles.find((profile) => profile.slug === slug)
    if (liveProfile) return liveProfile
    if (state?.item?.kind === 'pro') {
      return {
        ...state.item,
        slug: state.item.slug || slugify(state.item.name),
      }
    }
    return catalog.find((entry) => entry.kind === 'pro' && (entry.slug || slugify(entry.name)) === slug)
  }, [catalog, profiles, slug, state])

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

  if (!item && status === 'loading') return <LoadingProfile />
  if (!item) return <NotFound type="специалист" />
  const layer = layers.find((current) => current.slug === (item.layerSlug || item.layer)) || layers[0]
  const partnerUserId = item.userId || stats?.user_id || ''

  async function startChat() {
    if (!session) {
      navigate('/login')
      return
    }
    if (!item.id || item.isStatic) {
      setChatState({ status: 'error', message: 'Този профил още не е свързан с чат.' })
      return
    }
    setChatState({ status: 'loading', message: 'Отваряме защитен чат…' })
    try {
      const conversation = await createConversationFromProfile({ profileId: item.id, subject: `Разговор с ${item.name}` })
      navigate(`/inbox/${conversation.id}`)
    } catch (error) {
      setChatState({ status: 'error', message: error.message || 'Чатът не се отвори.' })
    }
  }

  return (
    <>
      <section className="relative h-64 md:h-80 w-full overflow-hidden bg-ink">
        <img src={LAYER_HEROS[layer.slug]} alt="" className="img-cover opacity-60 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-t from-soft via-transparent to-transparent"></div>
      </section>

      <section className="section pt-0 relative z-10 bg-soft">
        <div className="container-page">
          <div className="grid lg:grid-cols-12 gap-10">
            {/* LEFT SIDEBAR */}
            <aside className="lg:col-span-4 reveal -mt-20 md:-mt-32">
              <div className="lg:sticky lg:top-24 space-y-6">
                
                {/* Profile Card */}
                <div className="rounded-3xl border border-line bg-paper p-6 md:p-8 shadow-sm">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-paper shadow-md">
                      <img src={getProfileImage(item)} alt={item.name} className="img-cover" style={getProfileImageStyle(item)} />
                    </div>
                    <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accentDeep">
                      Слой {layer.number}
                    </div>
                    <h1 className="mt-4 font-display text-3xl text-ink">{item.name}</h1>
                    <p className="mt-2 text-sm text-ink/75">{item.headline || item.sub}</p>
                    <p className="mt-1 text-sm text-muted">{item.city} · от {item.since} г.</p>
                  </div>
                  
                  <div className="mt-6 border-t border-line pt-6">
                    <PartnerStats profile={item} stats={stats} />
                  </div>
                </div>

                {/* Contact Actions */}
                <InquiryBox
                  proName={item.name}
                  title={item.name ? `Опиши проекта си на ${item.name}` : 'Опиши проекта си'}
                  layerSlug={item.layerSlug || item.layer}
                  targetSlug={item.slug}
                  clientId={session?.user?.id}
                />
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-muted">
                  <span className="h-px flex-1 bg-line" />или чат след това<span className="h-px flex-1 bg-line" />
                </div>
                <ContactCard onStartChat={startChat} chatState={chatState} />

              </div>
            </aside>

            {/* RIGHT MAIN COLUMN */}
            <div className="lg:col-span-8 reveal lg:pt-8 space-y-12">
              
              <div>
                <Link to="/katalog" className="eyebrow !text-ink/70 hover:!text-ink mb-6 inline-block">← Обратно в каталога</Link>
                
                <div className="eyebrow">За {item.name}</div>
                <p className="mt-3" style={{fontSize:'var(--step-md)'}}>
                  {item.descriptionLong || item.bio}
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetaTile icon={MapPin} label="Работи в" value={item.serviceAreas?.length ? item.serviceAreas.join(', ') : item.city} />
                  <MetaTile icon={Languages} label="Езици" value={item.languages?.length ? item.languages.join(', ') : 'bg'} />
                  <MetaTile icon={Globe2} label="Формат" value={item.acceptsRemote ? 'На място и дистанционно' : 'На място'} />
                  <MetaTile icon={CheckCircle2} label="Опит" value={`${item.yearsExperience || Math.max(0, new Date().getFullYear() - item.since)} г.`} />
                </div>

                {item.pricingNote && (
                  <div className="mt-8 rounded-2xl border border-line bg-soft p-5">
                    <div className="eyebrow">Цени</div>
                    <p className="mt-2 text-muted">{item.pricingNote}</p>
                  </div>
                )}
              </div>

              <ProfileServicesSection services={services} profile={item} />

              <div>
                <div className="eyebrow">Как работят</div>
                <div className="mt-4 grid sm:grid-cols-2 gap-4">
                  {layer.process.map(p => (
                    <div key={p.n} className="border border-line bg-paper rounded-xl p-5">
                      <div className="font-display text-2xl text-accentDeep">{p.n}</div>
                      <div className="font-display text-lg mt-1">{p.t}</div>
                      <p className="text-sm text-muted mt-1">{p.d}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="eyebrow">Портфолио</div>
                <h2 className="mt-2 font-display text-3xl text-ink">Реални проекти</h2>
                <div className="mt-5">
                  <PortfolioGallery items={portfolio} emptyText="Този партньор още не е публикувал портфолио." />
                </div>
              </div>

              <ReviewsList partnerId={partnerUserId} title={`Отзиви за ${item.name}`} />

            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function MetaTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <Icon size={18} className="text-accentDeep" />
      <div className="mt-3 text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 text-sm font-medium text-ink">{value}</div>
    </div>
  )
}

function ProfileServicesSection({ services, profile }) {
  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Услуги</div>
          <h2 className="mt-2 font-display text-3xl text-ink">Публикувани оферти от {profile.name}</h2>
        </div>
        <Link to="/uslugi" className="inline-flex items-center gap-2 text-sm font-medium text-ink underline underline-offset-4">
          Всички услуги <ArrowRight size={16} />
        </Link>
      </div>

      {services.length > 0 ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {services.map(service => (
            <Link key={service.id} to={`/uslugi/${service.slug}`} className="rounded-2xl border border-line bg-paper p-5 transition hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <BriefcaseBusiness size={20} className="mt-1 text-accentDeep" />
                <span className="rounded-full bg-soft px-3 py-1 text-xs text-muted">{packagePriceLabel(service)}</span>
              </div>
              <h3 className="mt-4 font-display text-2xl leading-tight text-ink">{service.title}</h3>
              {service.subtitle && <p className="mt-2 line-clamp-2 text-sm text-muted">{service.subtitle}</p>}
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-ink">
                Детайли <ArrowRight size={16} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-line bg-soft p-5 text-sm text-muted">
          Този партньор още няма публични услуги. Можеш да започнеш разговор директно от бутона за контакт.
        </div>
      )}
    </div>
  )
}

function ContactCard({ onStartChat, chatState }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-6">
      <div className="eyebrow">Чат</div>
      <p className="mt-2 text-sm text-muted">Ако искаш по-директен разговор, можеш да отвориш защитен чат след запитването.</p>
      <button type="button" onClick={onStartChat} disabled={chatState.status === 'loading'} className="btn btn-ghost mt-5 w-full justify-center disabled:opacity-50">{chatState.status === 'loading' ? 'Отваряме…' : 'Отвори чат'}</button>
      {chatState.message && <div className={`mt-3 text-sm ${chatState.status === 'error' ? 'text-amber-800' : 'text-muted'}`}>{chatState.message}</div>}
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
    const { error } = await supabase.from('inquiries').insert({
      name: form.name.trim(),
      contact: form.contact.trim(),
      layer_slug: layerSlug,
      message: form.message.trim(),
      source: 'pro_inquiry',
      target_slug: targetSlug || proName,
      client_id: clientId || null,
    })
    setStatus(error ? 'error' : 'sent')
    if (!error) setForm({ name: '', contact: '', message: '' })
  }

  return (
    <form onSubmit={submit} className="border border-line rounded-2xl p-6 bg-paper">
      <div className="eyebrow">{title || 'Опиши проекта си'}</div>
      {status === 'sent' ? (
        <>
          <p className="text-sm mt-3 flex items-center gap-2"><CheckCircle2 size={18} className="text-accentDeep"/> Запитването е изпратено на {proName}.</p>
          <button type="button" onClick={() => setStatus('idle')} className="btn btn-ghost w-full justify-center mt-4">Изпрати ново</button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted mt-2">Кратко описание на това, което ти трябва — отговор до 48 часа.</p>
          <div className="mt-4 space-y-3">
            <input value={form.name} onChange={set('name')} placeholder="Твоето име" className="w-full px-4 py-3 rounded-xl border border-line focus:border-ink outline-none text-sm"/>
            <input value={form.contact} onChange={set('contact')} placeholder="Имейл или телефон" className="w-full px-4 py-3 rounded-xl border border-line focus:border-ink outline-none text-sm"/>
            <textarea value={form.message} onChange={set('message')} rows={4} placeholder="Какво ти трябва?" className="w-full px-4 py-3 rounded-xl border border-line focus:border-ink outline-none text-sm"/>
            <button disabled={status==='sending'} className="btn btn-primary w-full justify-center disabled:opacity-50">
              {status==='sending' ? 'Изпраща се…' : 'Изпрати запитване'}
            </button>
          </div>
          {status === 'error' && <div className="mt-3 text-xs text-red-700">Грешка при изпращане. Опитай пак.</div>}
          <div className="mt-4 text-xs text-muted">Безплатно. Без обвързване.</div>
        </>
      )}
    </form>
  )
}
