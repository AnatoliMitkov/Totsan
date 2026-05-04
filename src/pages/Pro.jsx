import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Globe2, Languages, Mail, MapPin, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { LAYER_HEROS } from '../data/images.js'
import { getProfileImage, getProfileImageStyle, slugify, useProfileDirectory } from '../lib/profiles.js'
import { loadProfilePortfolio, loadProfileStats } from '../lib/portfolio.js'
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
      return undefined
    }

    let active = true
    async function loadV2Data() {
      try {
        const [portfolioRows, statsRow] = await Promise.all([
          loadProfilePortfolio(item.id),
          loadProfileStats(item.id),
        ])
        if (!active) return
        setPortfolio(portfolioRows)
        setStats(statsRow)
      } catch (error) {
        if (!active) return
        console.error('Profile v2 data load failed:', error)
        setPortfolio([])
        setStats(null)
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
      <section className="section relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={LAYER_HEROS[layer.slug]} alt="" className="img-cover" />
          <div className="hero-overlay"></div>
        </div>
        <div className="container-page grid lg:grid-cols-12 gap-10 items-center relative">
          <div className="lg:col-span-8 reveal">
            <Link to="/katalog" className="eyebrow !text-ink/70 hover:!text-ink">← Обратно в каталога</Link>
            <div className="mt-4 flex items-center gap-3">
              <span className="eyebrow">Слой {layer.number} · {layer.title}</span>
            </div>
            <div className="mt-3 flex items-center gap-5">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-paper shadow-lg shrink-0">
                <img src={getProfileImage(item)} alt={item.name} className="img-cover" style={getProfileImageStyle(item)} />
              </div>
              <div>
                <h1 className="h-display">{item.name}</h1>
                <p className="mt-1 text-ink/75">{item.headline || item.sub} · {item.city} · от {item.since} г.</p>
              </div>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={startChat} disabled={chatState.status === 'loading'} className="btn btn-primary disabled:opacity-50">{chatState.status === 'loading' ? 'Отваряме…' : 'Свържи се'}</button>
              <Link to="/katalog" className="btn btn-ghost bg-paper/80 backdrop-blur">Други специалисти</Link>
            </div>
            {chatState.status === 'error' && <div className="mt-3 max-w-xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{chatState.message}</div>}
          </div>
          <div className="lg:col-span-4 reveal">
            <PartnerStats profile={item} stats={stats} />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 reveal">
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

            <div className="mt-10 eyebrow">Как работят</div>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              {layer.process.map(p => (
                <div key={p.n} className="border border-line rounded-xl p-5">
                  <div className="font-display text-2xl text-accentDeep">{p.n}</div>
                  <div className="font-display text-lg mt-1">{p.t}</div>
                  <p className="text-sm text-muted mt-1">{p.d}</p>
                </div>
              ))}
            </div>

            <div className="mt-10">
              <div className="eyebrow">Портфолио</div>
              <h2 className="mt-2 font-display text-3xl text-ink">Реални проекти</h2>
              <div className="mt-5">
                <PortfolioGallery items={portfolio} emptyText="Този партньор още не е публикувал портфолио." />
              </div>
            </div>

            <ReviewsList partnerId={partnerUserId} title={`Отзиви за ${item.name}`} />
          </div>

          <aside id="zapitvane" className="lg:col-span-4 reveal">
            <ContactCard profile={item} onStartChat={startChat} chatState={chatState} />
            <div className="mt-5">
              <InquiryBox proName={item.name} layerSlug={item.layerSlug || item.layer} targetSlug={item.slug} />
            </div>
          </aside>
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

function ContactCard({ onStartChat, chatState }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-6 lg:sticky lg:top-24">
      <div className="eyebrow">Контакт</div>
      <p className="mt-2 text-sm text-muted">Започни защитен разговор в Totsan. Контакти и външни линкове се скриват автоматично.</p>
      <button type="button" onClick={onStartChat} disabled={chatState.status === 'loading'} className="btn btn-primary mt-5 w-full justify-center disabled:opacity-50">{chatState.status === 'loading' ? 'Отваряме…' : 'Отвори чат'}</button>
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

function InquiryBox({ proName, layerSlug, targetSlug }) {
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
    })
    setStatus(error ? 'error' : 'sent')
    if (!error) setForm({ name: '', contact: '', message: '' })
  }

  return (
    <form onSubmit={submit} className="border border-line rounded-2xl p-6 bg-paper sticky top-24">
      <div className="eyebrow">Поискай оферта</div>
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
