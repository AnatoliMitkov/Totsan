import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, CreditCard, Eye, Globe2, ImagePlus, Plus, Save, Trash2 } from 'lucide-react'
import { LAYERS } from '../../data/layers.js'
import { uploadProfileMedia } from '../../lib/profile-media-upload-client.js'
import { getProfileImage, getProfileImageStyle, normalizeProfile, PROFILE_SELECT_COLUMNS } from '../../lib/profiles.js'
import { supabase } from '../../lib/supabase.js'
import {
  DEFAULT_PORTFOLIO_ITEM,
  appendPortfolioMedia,
  deletePortfolioItem,
  loadProfilePortfolio,
  loadProfileStats,
  savePortfolioItem,
  uploadPortfolioImage,
} from '../../lib/portfolio.js'
import { createConnectOnboarding } from '../../lib/payments.js'
import PortfolioGallery from './PortfolioGallery.jsx'
import PartnerStats from './PartnerStats.jsx'
import PartnerServiceEditor from './PartnerServiceEditor.jsx'
import PartnerOrders from './PartnerOrders.jsx'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'
const TABS = [
  ['overview', 'Преглед'],
  ['profile', 'Профил'],
  ['portfolio', 'Портфолио'],
  ['services', 'Услуги'],
  ['orders', 'Поръчки'],
  ['contact', 'Контакт'],
]

function csv(value) {
  return Array.isArray(value) ? value.join(', ') : String(value || '')
}

function fromCsv(value, fallback = []) {
  const next = String(value || '').split(',').map(item => item.trim()).filter(Boolean)
  return next.length ? next : fallback
}

function makeProfileDraft(profile) {
  return {
    name: profile.name || '',
    tag: profile.tag || '',
    headline: profile.headline || profile.tag || '',
    city: profile.city || '',
    layerSlug: profile.layerSlug || LAYERS[0]?.slug || '',
    since: profile.since || new Date().getFullYear(),
    yearsExperience: profile.yearsExperience || Math.max(0, new Date().getFullYear() - (profile.since || new Date().getFullYear())),
    projects: profile.projects || 0,
    bio: profile.bio || '',
    descriptionLong: profile.descriptionLong || profile.bio || '',
    imageUrl: profile.imageUrl || '',
    imageZoom: profile.imageZoom || 1,
    imageX: profile.imageX || 50,
    imageY: profile.imageY || 50,
    phone: profile.phone || '',
    emailPublic: profile.emailPublic || '',
    website: profile.website || '',
    instagram: profile.instagram || '',
    facebook: profile.facebook || '',
    languagesText: csv(profile.languages?.length ? profile.languages : ['bg']),
    serviceAreasText: csv(profile.serviceAreas?.length ? profile.serviceAreas : (profile.city ? [profile.city] : [])),
    responseTimeHours: profile.responseTimeHours || '',
    acceptsRemote: Boolean(profile.acceptsRemote),
    pricingNote: profile.pricingNote || '',
  }
}

function makePortfolioDraft(item = null, profile) {
  return {
    ...DEFAULT_PORTFOLIO_ITEM,
    profileId: profile?.id || '',
    layerSlug: profile?.layerSlug || LAYERS[0]?.slug || '',
    city: profile?.city || '',
    ...(item || {}),
  }
}

export default function PartnerProfileWorkspace({ profile, userId, account, onSaved }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [currentProfile, setCurrentProfile] = useState(profile)
  const [profileDraft, setProfileDraft] = useState(() => makeProfileDraft(profile))
  const [portfolio, setPortfolio] = useState([])
  const [stats, setStats] = useState(null)
  const [portfolioDraft, setPortfolioDraft] = useState(() => makePortfolioDraft(null, profile))
  const [saveState, setSaveState] = useState({ status: 'idle', message: '' })
  const [portfolioState, setPortfolioState] = useState({ status: 'idle', message: '' })
  const [paymentState, setPaymentState] = useState({ status: 'idle', message: '' })

  useEffect(() => {
    setCurrentProfile(profile)
    setProfileDraft(makeProfileDraft(profile))
  }, [profile?.id, profile?.updatedAt])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [portfolioRows, statsRow] = await Promise.all([
          loadProfilePortfolio(profile.id, { includeUnpublished: true }),
          loadProfileStats(profile.id),
        ])
        if (!active) return
        setPortfolio(portfolioRows)
        setStats(statsRow)
        setPortfolioDraft(makePortfolioDraft(portfolioRows[0] || null, profile))
      } catch (error) {
        if (!active) return
        setPortfolioState({ status: 'error', message: error.message || 'Портфолиото не успя да зареди.' })
      }
    }
    load()
    return () => { active = false }
  }, [profile.id])

  const preview = useMemo(() => normalizeProfile({
    ...currentProfile,
    ...profileDraft,
    layer_slug: profileDraft.layerSlug,
    image_url: profileDraft.imageUrl,
    image_zoom: profileDraft.imageZoom,
    image_x: profileDraft.imageX,
    image_y: profileDraft.imageY,
    description_long: profileDraft.descriptionLong,
    email_public: profileDraft.emailPublic,
    service_areas: fromCsv(profileDraft.serviceAreasText, []),
    languages: fromCsv(profileDraft.languagesText, ['bg']),
    years_experience: profileDraft.yearsExperience,
    response_time_hours: profileDraft.responseTimeHours,
    accepts_remote: profileDraft.acceptsRemote,
    pricing_note: profileDraft.pricingNote,
  }), [currentProfile, profileDraft])

  function updateProfile(key, value) {
    setProfileDraft(current => ({ ...current, [key]: value }))
  }

  function updatePortfolio(key, value) {
    setPortfolioDraft(current => ({ ...current, [key]: value }))
  }

  async function uploadAvatar(file) {
    if (!file) return
    setSaveState({ status: 'uploading', message: 'Оптимизираме и качваме снимката…' })
    try {
      const result = await uploadProfileMedia({ file, target: userId })
      updateProfile('imageUrl', result.publicUrl)
      setSaveState({ status: 'uploaded', message: 'Снимката е готова. Натисни „Запази профила“.' })
    } catch (error) {
      setSaveState({ status: 'error', message: error.message || 'Качването не успя.' })
    }
  }

  async function saveProfile(event) {
    event?.preventDefault()
    setSaveState({ status: 'saving', message: 'Запазваме профила…' })

    const { data, error } = await supabase
      .from('profiles')
      .update({
        name: profileDraft.name.trim(),
        tag: profileDraft.tag.trim(),
        headline: profileDraft.headline.trim() || null,
        city: profileDraft.city.trim(),
        layer_slug: profileDraft.layerSlug,
        since: Number(profileDraft.since),
        years_experience: profileDraft.yearsExperience === '' ? null : Number(profileDraft.yearsExperience),
        projects: Number(profileDraft.projects) || 0,
        bio: profileDraft.bio.trim(),
        description_long: profileDraft.descriptionLong.trim() || null,
        image_url: profileDraft.imageUrl.trim(),
        image_zoom: Number(profileDraft.imageZoom),
        image_x: Number(profileDraft.imageX),
        image_y: Number(profileDraft.imageY),
        phone: profileDraft.phone.trim() || null,
        email_public: profileDraft.emailPublic.trim() || null,
        website: profileDraft.website.trim() || null,
        instagram: profileDraft.instagram.trim() || null,
        facebook: profileDraft.facebook.trim() || null,
        languages: fromCsv(profileDraft.languagesText, ['bg']),
        service_areas: fromCsv(profileDraft.serviceAreasText, []),
        response_time_hours: profileDraft.responseTimeHours === '' ? null : Number(profileDraft.responseTimeHours),
        accepts_remote: Boolean(profileDraft.acceptsRemote),
        pricing_note: profileDraft.pricingNote.trim() || null,
      })
      .eq('id', currentProfile.id)
      .select(PROFILE_SELECT_COLUMNS)
      .single()

    if (error) {
      setSaveState({ status: 'error', message: error.message })
      return
    }

    const normalized = normalizeProfile(data)
    setCurrentProfile(normalized)
    setProfileDraft(makeProfileDraft(normalized))
    setSaveState({ status: 'saved', message: 'Профилът е запазен.' })
    onSaved?.()
  }

  async function uploadPortfolioFile(file) {
    if (!file) return
    setPortfolioState({ status: 'uploading', message: 'Качваме снимка към портфолиото…' })
    try {
      const upload = await uploadPortfolioImage({ file, target: userId, kind: 'portfolio' })
      setPortfolioDraft(current => appendPortfolioMedia(current, upload))
      setPortfolioState({ status: 'uploaded', message: 'Снимката е добавена. Натисни „Запази проекта“.' })
    } catch (error) {
      setPortfolioState({ status: 'error', message: error.message || 'Качването не успя.' })
    }
  }

  async function savePortfolio(event) {
    event?.preventDefault()
    setPortfolioState({ status: 'saving', message: 'Запазваме портфолио проекта…' })
    try {
      const saved = await savePortfolioItem(currentProfile.id, portfolioDraft)
      setPortfolio(current => [saved, ...current.filter(item => item.id !== saved.id)].sort((left, right) => left.orderIndex - right.orderIndex))
      setPortfolioDraft(makePortfolioDraft(saved, currentProfile))
      setPortfolioState({ status: 'saved', message: 'Портфолио проектът е запазен.' })
    } catch (error) {
      setPortfolioState({ status: 'error', message: error.message || 'Записът не успя.' })
    }
  }

  async function removePortfolioItem(itemId) {
    if (!itemId) return
    setPortfolioState({ status: 'saving', message: 'Изтриваме проекта…' })
    try {
      await deletePortfolioItem(itemId)
      const next = portfolio.filter(item => item.id !== itemId)
      setPortfolio(next)
      setPortfolioDraft(makePortfolioDraft(next[0] || null, currentProfile))
      setPortfolioState({ status: 'saved', message: 'Проектът е изтрит.' })
    } catch (error) {
      setPortfolioState({ status: 'error', message: error.message || 'Изтриването не успя.' })
    }
  }

  async function startPaymentOnboarding() {
    setPaymentState({ status: 'opening', message: 'Отваряме Stripe onboarding…' })
    try {
      const result = await createConnectOnboarding()
      if (result.onboardingUrl) {
        window.location.href = result.onboardingUrl
        return
      }
      setPaymentState({ status: 'saved', message: 'Плащанията са активирани.' })
    } catch (error) {
      setPaymentState({ status: 'error', message: error.message || 'Плащанията не се активираха.' })
    }
  }

  return (
    <section className="section bg-soft min-h-screen">
      <div className="container-page space-y-5">
        <div className="rounded-3xl border border-line bg-paper p-5 md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 overflow-hidden rounded-full border border-line bg-soft">
                <img src={getProfileImage(preview)} alt={preview.name} className="img-cover" style={getProfileImageStyle(preview)} />
              </div>
              <div>
                <div className="eyebrow">Партньорски профил</div>
                <h1 className="mt-1 font-display text-4xl leading-none text-ink md:text-5xl">{preview.name}</h1>
                <p className="mt-2 text-sm text-muted">{preview.headline || preview.tag} · {preview.city}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {preview.isPublished && <Link to={`/profil/${preview.slug}`} className="btn btn-primary"><Eye size={18} /> Виж публично</Link>}
              <button type="button" onClick={startPaymentOnboarding} disabled={paymentState.status === 'opening'} className="btn btn-ghost"><CreditCard size={18} /> {account?.stripe_account_id ? 'Плащания' : 'Активирай плащания'}</button>
              <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Изход</button>
            </div>
          </div>
          {paymentState.message && <div className={`mt-4 rounded-2xl p-3 text-sm ${paymentState.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-soft text-muted'}`}>{paymentState.message}</div>}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-line bg-paper p-2">
          {TABS.map(([tab, label]) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-full px-4 py-2 text-sm transition ${activeTab === tab ? 'bg-ink text-paper' : 'text-muted hover:bg-soft hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid gap-5 lg:grid-cols-12">
            <div className="lg:col-span-8 rounded-3xl border border-line bg-paper p-5 md:p-7">
              <div className="eyebrow">Преглед</div>
              <h2 className="mt-2 font-display text-3xl text-ink">Как изглежда профилът ти</h2>
              <p className="mt-3 max-w-3xl text-muted">{preview.descriptionLong || preview.bio}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <InfoTile label="Езици" value={preview.languages.join(', ') || 'bg'} />
                <InfoTile label="Райони" value={preview.serviceAreas.join(', ') || preview.city} />
                <InfoTile label="Цени" value={preview.pricingNote || 'Не е посочено'} />
              </div>
            </div>
            <aside className="lg:col-span-4 space-y-5">
              <PartnerStats profile={preview} stats={stats} />
              <div className="rounded-3xl border border-line bg-paper p-5">
                <div className="eyebrow">Портфолио</div>
                <div className="mt-2 font-display text-3xl text-ink">{portfolio.length}</div>
                <p className="mt-2 text-sm text-muted">Добави поне 10 проекта за силен профил.</p>
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'profile' && (
          <ProfileForm
            draft={profileDraft}
            saveState={saveState}
            preview={preview}
            onChange={updateProfile}
            onSubmit={saveProfile}
            onUpload={uploadAvatar}
          />
        )}

        {activeTab === 'portfolio' && (
          <PortfolioEditor
            items={portfolio}
            draft={portfolioDraft}
            state={portfolioState}
            onSelect={(item) => setPortfolioDraft(makePortfolioDraft(item, currentProfile))}
            onNew={() => setPortfolioDraft(makePortfolioDraft(null, currentProfile))}
            onChange={updatePortfolio}
            onSubmit={savePortfolio}
            onUpload={uploadPortfolioFile}
            onDelete={removePortfolioItem}
          />
        )}

        {activeTab === 'services' && (
          <PartnerServiceEditor profile={currentProfile} userId={userId} />
        )}

        {activeTab === 'orders' && (
          <PartnerOrders userId={userId} />
        )}

        {activeTab === 'contact' && (
          <ContactPreview profile={preview} onEdit={() => setActiveTab('profile')} />
        )}
      </div>
    </section>
  )
}

function ProfileForm({ draft, saveState, preview, onChange, onSubmit, onUpload }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-8 rounded-3xl border border-line bg-paper p-5 md:p-7 space-y-5">
        <div>
          <div className="eyebrow">Профил</div>
          <h2 className="mt-2 font-display text-3xl text-ink">Основна информация</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Име / фирма"><input value={draft.name} onChange={event => onChange('name', event.target.value)} className={INPUT} /></Field>
          <Field label="One-liner"><input value={draft.headline} onChange={event => onChange('headline', event.target.value)} className={INPUT} placeholder="Напр. Интериори с точен бюджет и срок" /></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Роля"><input value={draft.tag} onChange={event => onChange('tag', event.target.value)} className={INPUT} /></Field>
          <Field label="Град"><input value={draft.city} onChange={event => onChange('city', event.target.value)} className={INPUT} /></Field>
          <Field label="Слой"><select value={draft.layerSlug} onChange={event => onChange('layerSlug', event.target.value)} className={INPUT}>{LAYERS.map(layer => <option key={layer.slug} value={layer.slug}>Слой {layer.number} · {layer.title}</option>)}</select></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="От година"><input type="number" min="1900" max="2100" value={draft.since} onChange={event => onChange('since', event.target.value)} className={INPUT} /></Field>
          <Field label="Години опит"><input type="number" min="0" value={draft.yearsExperience} onChange={event => onChange('yearsExperience', event.target.value)} className={INPUT} /></Field>
          <Field label="Проекти"><input type="number" min="0" value={draft.projects} onChange={event => onChange('projects', event.target.value)} className={INPUT} /></Field>
          <Field label="Отговор до часове"><input type="number" min="0" value={draft.responseTimeHours} onChange={event => onChange('responseTimeHours', event.target.value)} className={INPUT} /></Field>
        </div>

        <Field label="Кратко био"><textarea rows={4} value={draft.bio} onChange={event => onChange('bio', event.target.value)} className={INPUT} /></Field>
        <Field label="Разширено описание"><textarea rows={7} value={draft.descriptionLong} onChange={event => onChange('descriptionLong', event.target.value)} className={INPUT} /></Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Езици"><input value={draft.languagesText} onChange={event => onChange('languagesText', event.target.value)} className={INPUT} placeholder="bg, en" /></Field>
          <Field label="Райони на работа"><input value={draft.serviceAreasText} onChange={event => onChange('serviceAreasText', event.target.value)} className={INPUT} placeholder="София, Пловдив" /></Field>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Телефон"><input value={draft.phone} onChange={event => onChange('phone', event.target.value)} type="tel" className={INPUT} /></Field>
          <Field label="Публичен имейл"><input value={draft.emailPublic} onChange={event => onChange('emailPublic', event.target.value)} type="email" className={INPUT} /></Field>
          <Field label="Сайт"><input value={draft.website} onChange={event => onChange('website', event.target.value)} className={INPUT} placeholder="https://" /></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Instagram"><input value={draft.instagram} onChange={event => onChange('instagram', event.target.value)} className={INPUT} /></Field>
          <Field label="Facebook"><input value={draft.facebook} onChange={event => onChange('facebook', event.target.value)} className={INPUT} /></Field>
        </div>

        <Field label="Ценова бележка"><textarea rows={3} value={draft.pricingNote} onChange={event => onChange('pricingNote', event.target.value)} className={INPUT} placeholder="Напр. Консултация от 80 EUR, проект по оферта." /></Field>
        <label className="flex items-start gap-3 rounded-2xl border border-line bg-soft p-4 text-sm text-muted">
          <input type="checkbox" checked={draft.acceptsRemote} onChange={event => onChange('acceptsRemote', event.target.checked)} className="mt-1 accent-black" />
          <span>Приемам дистанционни консултации.</span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <div className={`text-sm ${saveState.status === 'error' ? 'text-red-700' : 'text-muted'}`}>{saveState.message || 'Промените се пазят след запазване.'}</div>
          <button className="btn btn-primary" disabled={saveState.status === 'saving'}><Save size={18} /> {saveState.status === 'saving' ? 'Запазва се…' : 'Запази профила'}</button>
        </div>
      </div>

      <aside className="lg:col-span-4 space-y-5">
        <div className="rounded-3xl border border-line bg-paper p-5 md:p-6 lg:sticky lg:top-24">
          <div className="eyebrow">Снимка</div>
          <div className="mt-4 aspect-square overflow-hidden rounded-3xl border border-line bg-soft">
            <img src={getProfileImage(preview)} alt={preview.name} className="img-cover" style={getProfileImageStyle(preview)} />
          </div>
          <label className="btn btn-ghost mt-4 w-full cursor-pointer justify-center">
            <Camera size={18} /> Качи снимка
            <input type="file" accept="image/*" className="sr-only" onChange={async (event) => { await onUpload(event.target.files?.[0]); event.target.value = '' }} />
          </label>
          <div className="mt-5 grid gap-4">
            <Range label="Zoom" value={draft.imageZoom} min={1} max={2.5} step={0.05} onChange={value => onChange('imageZoom', value)} />
            <Range label="Ляво / дясно" value={draft.imageX} min={0} max={100} step={1} onChange={value => onChange('imageX', value)} />
            <Range label="Горе / долу" value={draft.imageY} min={0} max={100} step={1} onChange={value => onChange('imageY', value)} />
          </div>
        </div>
      </aside>
    </form>
  )
}

function PortfolioEditor({ items, draft, state, onSelect, onNew, onChange, onSubmit, onUpload, onDelete }) {
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <aside className="lg:col-span-4 xl:col-span-3">
        <div className="rounded-3xl border border-line bg-paper p-4">
          <button type="button" onClick={onNew} className="btn btn-primary w-full justify-center"><Plus size={18} /> Нов проект</button>
          <div className="mt-4 max-h-[34rem] space-y-2 overflow-auto pr-1">
            {items.map(item => (
              <button key={item.id} type="button" onClick={() => onSelect(item)} className={`w-full rounded-2xl border p-3 text-left transition ${draft.id === item.id ? 'border-ink bg-soft' : 'border-line hover:border-ink/40'}`}>
                <div className="flex gap-3">
                  <div className="h-14 w-14 overflow-hidden rounded-xl bg-soft">
                    {item.coverUrl ? <img src={item.coverUrl} alt={item.title} className="img-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-ink">{item.title || 'Проект'}</div>
                    <div className="mt-1 text-xs text-muted">{item.city || 'Локация'} · {item.year || 'година'}</div>
                    {!item.isPublished && <div className="mt-1 text-xs text-amber-700">Скрит</div>}
                  </div>
                </div>
              </button>
            ))}
            {items.length === 0 && <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-muted">Още няма портфолио.</div>}
          </div>
        </div>
      </aside>

      <form onSubmit={onSubmit} className="lg:col-span-8 xl:col-span-9 rounded-3xl border border-line bg-paper p-5 md:p-7 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="eyebrow">Портфолио</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Проект от практиката</h2>
          </div>
          {draft.id && <button type="button" onClick={() => onDelete(draft.id)} className="btn btn-ghost"><Trash2 size={18} /> Изтрий</button>}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Заглавие"><input value={draft.title} onChange={event => onChange('title', event.target.value)} className={INPUT} placeholder="Апартамент 90 м2" /></Field>
          <Field label="Слой"><select value={draft.layerSlug} onChange={event => onChange('layerSlug', event.target.value)} className={INPUT}>{LAYERS.map(layer => <option key={layer.slug} value={layer.slug}>Слой {layer.number} · {layer.title}</option>)}</select></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Град"><input value={draft.city} onChange={event => onChange('city', event.target.value)} className={INPUT} /></Field>
          <Field label="Година"><input type="number" min="1900" max="2100" value={draft.year} onChange={event => onChange('year', event.target.value)} className={INPUT} /></Field>
          <Field label="Бюджет"><input value={draft.budgetBand} onChange={event => onChange('budgetBand', event.target.value)} className={INPUT} placeholder="5k-10k EUR" /></Field>
          <Field label="Ред"><input type="number" value={draft.orderIndex} onChange={event => onChange('orderIndex', event.target.value)} className={INPUT} /></Field>
        </div>
        <Field label="Описание"><textarea rows={5} value={draft.description} onChange={event => onChange('description', event.target.value)} className={INPUT} /></Field>
        <Field label="Cover URL"><input value={draft.coverUrl} onChange={event => onChange('coverUrl', event.target.value)} className={INPUT} /></Field>

        <label className="btn btn-ghost cursor-pointer justify-center">
          <ImagePlus size={18} /> Качи снимка към проекта
          <input type="file" accept="image/*" className="sr-only" onChange={async (event) => { await onUpload(event.target.files?.[0]); event.target.value = '' }} />
        </label>

        {draft.media.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {draft.media.map((media, index) => (
              <div key={`${media.url}-${index}`} className="overflow-hidden rounded-2xl border border-line bg-soft">
                <div className="aspect-square"><img src={media.url} alt={media.caption || draft.title} className="img-cover" /></div>
              </div>
            ))}
          </div>
        )}

        <label className="flex items-start gap-3 rounded-2xl border border-line bg-soft p-4 text-sm text-muted">
          <input type="checkbox" checked={draft.isPublished} onChange={event => onChange('isPublished', event.target.checked)} className="mt-1 accent-black" />
          <span>Публикуван проект.</span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <div className={`text-sm ${state.status === 'error' ? 'text-red-700' : 'text-muted'}`}>{state.message || 'Запази проекта, за да се появи в публичния профил.'}</div>
          <button className="btn btn-primary" disabled={state.status === 'saving'}><Save size={18} /> {state.status === 'saving' ? 'Запазва се…' : 'Запази проекта'}</button>
        </div>
      </form>

      <div className="lg:col-span-12 rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="eyebrow">Публичен изглед</div>
        <h2 className="mt-2 font-display text-3xl text-ink">Галерия</h2>
        <div className="mt-5"><PortfolioGallery items={items.filter(item => item.isPublished)} /></div>
      </div>
    </div>
  )
}

function ContactPreview({ profile, onEdit }) {
  const contacts = [
    profile.phone,
    profile.emailPublic,
    profile.website,
    profile.instagram,
    profile.facebook,
  ].filter(Boolean)

  return (
    <div className="rounded-3xl border border-line bg-paper p-5 md:p-7">
      <div className="eyebrow">Контакт</div>
      <h2 className="mt-2 font-display text-3xl text-ink">Публични канали</h2>
      {contacts.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {contacts.map(contact => <div key={contact} className="rounded-2xl border border-line bg-soft p-4 text-sm text-ink"><Globe2 size={18} className="mb-2 text-accentDeep" />{contact}</div>)}
        </div>
      ) : (
        <p className="mt-4 text-muted">Няма попълнени публични контактни полета.</p>
      )}
      <button type="button" onClick={onEdit} className="btn btn-primary mt-6">Редактирай контакти</button>
    </div>
  )
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-soft p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 text-sm font-medium text-ink">{value}</div>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="block text-sm font-medium text-ink">{label}{children}</label>
}

function Range({ label, value, min, max, step, onChange }) {
  return (
    <label className="block text-sm font-medium text-ink">
      <span className="flex items-center justify-between gap-4"><span>{label}</span><span className="text-xs text-muted">{Number(value).toFixed(step < 1 ? 2 : 0)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} className="mt-3 w-full accent-black" />
    </label>
  )
}
