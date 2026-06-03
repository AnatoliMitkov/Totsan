import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, CircleDot, Eye, ImagePlus, Plus, Save, Trash2 } from 'lucide-react'
import { LAYERS } from '../../data/layers.js'
import {
  SERVICE_STATUS_LABELS,
  appendPartnerServiceMedia,
  deletePartnerService,
  formatServicePrice,
  loadPartnerServicesForProfile,
  makeEmptyPackage,
  makePartnerServiceDraft,
  savePartnerService,
  uploadPartnerServiceImage,
} from '../../lib/partner-services.js'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'
const SECTIONS = [
  ['info', 'Основно'],
  ['price', 'Цена и включено'],
  ['media', 'Медии'],
  ['faq', 'FAQ'],
]

export default function PartnerServiceEditor({ profile, userId }) {
  const [items, setItems] = useState([])
  const [draft, setDraft] = useState(() => makePartnerServiceDraft(profile))
  const [activeSection, setActiveSection] = useState('info')
  const [showPreview, setShowPreview] = useState(false)
  const [state, setState] = useState({ status: 'loading', message: 'Зареждаме услугите…' })

  useEffect(() => {
    let active = true
    async function load() {
      setState({ status: 'loading', message: 'Зареждаме услугите…' })
      try {
        const rows = await loadPartnerServicesForProfile(profile.id)
        if (!active) return
        setItems(rows)
        setDraft(makePartnerServiceDraft(profile, rows[0] || null))
        setState({ status: 'ready', message: '' })
      } catch (error) {
        if (!active) return
        setState({ status: 'error', message: error.message || 'Услугите не успяха да заредят.' })
      }
    }
    load()
    return () => { active = false }
  }, [profile.id, profile.updatedAt])

  const primaryPackage = draft.packages[0] || makeEmptyPackage('basic')
  const previewService = useMemo(() => ({
    ...draft,
    tags: draft.tagsText.split(',').map(item => item.trim()).filter(Boolean),
    deliveryAreas: draft.deliveryAreasText.split(',').map(item => item.trim()).filter(Boolean),
    lowestPrice: Number(primaryPackage.priceAmount || 0),
    lowestCurrency: 'EUR',
    packages: [{ ...primaryPackage, currency: 'EUR', deliveryDays: '', revisions: '', isActive: true }],
  }), [draft, primaryPackage])

  function update(key, value) {
    setDraft(current => ({ ...current, [key]: value }))
  }

  function updatePackage(key, value) {
    setDraft(current => ({
      ...current,
      packages: [{ ...(current.packages[0] || makeEmptyPackage('basic')), [key]: value, tier: 'basic', currency: 'EUR', isActive: true }],
    }))
  }

  function updateFeature(index, value) {
    setDraft(current => {
      const item = current.packages[0] || makeEmptyPackage('basic')
      const features = [...(Array.isArray(item.features) ? item.features : [])]
      features[index] = value
      return { ...current, packages: [{ ...item, features, tier: 'basic', currency: 'EUR', isActive: true }] }
    })
  }

  function addFeature() {
    setDraft(current => {
      const item = current.packages[0] || makeEmptyPackage('basic')
      return { ...current, packages: [{ ...item, features: [...(item.features || []), ''], tier: 'basic', currency: 'EUR', isActive: true }] }
    })
  }

  function updateFaq(index, key, value) {
    setDraft(current => ({
      ...current,
      faq: current.faq.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    }))
  }

  function addFaq() {
    setDraft(current => ({ ...current, faq: [...current.faq, { question: '', answer: '', orderIndex: current.faq.length }] }))
  }

  async function handleSave(publish = false) {
    setState({ status: 'saving', message: publish ? 'Създаваме услугата…' : 'Запазваме черновата…' })
    try {
      const saved = await savePartnerService(profile, draft, { submit: publish })
      setItems(current => [saved, ...current.filter(item => item.id !== saved.id)])
      setDraft(makePartnerServiceDraft(profile, saved))
      setState({ status: 'saved', message: publish ? 'Услугата е изпратена за одобрение. Ще стане публична след преглед от Totsan.' : 'Черновата е запазена.' })
      if (publish) setShowPreview(false)
    } catch (error) {
      setState({ status: 'error', message: error.message || 'Записът не успя.' })
    }
  }

  async function handleDelete() {
    if (!draft.id) return
    setState({ status: 'saving', message: 'Изтриваме услугата…' })
    try {
      await deletePartnerService(draft.id)
      const next = items.filter(item => item.id !== draft.id)
      setItems(next)
      setDraft(makePartnerServiceDraft(profile, next[0] || null))
      setState({ status: 'saved', message: 'Услугата е изтрита.' })
    } catch (error) {
      setState({ status: 'error', message: error.message || 'Изтриването не успя.' })
    }
  }

  async function uploadImage(file) {
    if (!file) return
    setState({ status: 'uploading', message: 'Качваме снимката към услугата…' })
    try {
      const upload = await uploadPartnerServiceImage({ file, target: userId, kind: 'service' })
      setDraft(current => appendPartnerServiceMedia(current, upload))
      setState({ status: 'uploaded', message: 'Снимката е добавена. Запази услугата.' })
    } catch (error) {
      setState({ status: 'error', message: error.message || 'Качването не успя.' })
    }
  }

  function selectService(serviceId) {
    const selected = items.find(item => item.id === serviceId) || null
    setDraft(makePartnerServiceDraft(profile, selected))
    setActiveSection('info')
    setShowPreview(false)
  }

  const sectionTitle = draft.id ? draft.title || 'Редакция на услуга' : 'Нова услуга'

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="eyebrow">Моите услуги</div>
            <h2 className="mt-2 font-display text-3xl text-ink">{sectionTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Създай ясна оферта. След изпращане Totsan я преглежда и тогава я показва в услугите, каталога и профила ти.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {draft.isPublished && <Link to={`/uslugi/${draft.slug}`} className="btn btn-ghost"><Eye size={18} /> Виж публично</Link>}
            {draft.id && <button type="button" onClick={handleDelete} className="btn btn-ghost"><Trash2 size={18} /> Изтрий</button>}
            <button type="button" onClick={() => { setDraft(makePartnerServiceDraft(profile)); setActiveSection('info'); setShowPreview(false) }} className="btn btn-primary"><Plus size={18} /> Нова услуга</button>
          </div>
        </div>

        {items.length > 0 ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map(item => (
              <ServicePickerCard
                key={item.id}
                item={item}
                active={draft.id === item.id}
                onSelect={() => selectService(item.id)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-line bg-soft p-5 text-sm text-muted">
            Все още няма създадени услуги. Започни с първата оферта и я изпрати за одобрение, за да се появи пред клиентите.
          </div>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex flex-wrap gap-2 rounded-2xl bg-soft p-1">
            {SECTIONS.map(([section, label]) => (
              <button key={section} type="button" onClick={() => setActiveSection(section)} className={`rounded-full px-4 py-2 text-sm transition ${activeSection === section ? 'bg-ink text-paper' : 'text-muted hover:bg-paper hover:text-ink'}`}>{label}</button>
            ))}
            <button type="button" onClick={() => setShowPreview(value => !value)} className={`rounded-full px-4 py-2 text-sm transition ${showPreview ? 'bg-ink text-paper' : 'text-muted hover:bg-paper hover:text-ink'}`}>Преглед</button>
          </div>
          <VisibilityPanel draft={draft} state={state} />
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-paper p-5 md:p-7">
        {activeSection === 'info' && <InfoSection draft={draft} onChange={update} />}
        {activeSection === 'price' && <PriceSection item={primaryPackage} onChange={updatePackage} onFeatureChange={updateFeature} onAddFeature={addFeature} />}
        {activeSection === 'media' && <MediaSection draft={draft} onChange={update} onUpload={uploadImage} />}
        {activeSection === 'faq' && <FaqSection draft={draft} onFaqChange={updateFaq} onAddFaq={addFaq} />}
      </section>

      {showPreview && (
        <section className="rounded-3xl border border-line bg-paper p-5 md:p-7">
          <div className="eyebrow">Преглед</div>
          <ServicePreview service={previewService} profile={profile} />
        </section>
      )}

      <section className="rounded-3xl border border-line bg-paper p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className={`text-sm ${state.status === 'error' ? 'text-red-700' : 'text-muted'}`}>{state.message || 'Запази чернова или изпрати услугата за одобрение.'}</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => handleSave(false)} disabled={state.status === 'saving'} className="btn btn-ghost"><Save size={18} /> Запази чернова</button>
            <button type="button" onClick={() => handleSave(true)} disabled={state.status === 'saving'} className="btn btn-primary">{draft.id ? 'Изпрати промените' : 'Изпрати за одобрение'}</button>
          </div>
        </div>
      </section>
    </div>
  )
}

function ServicePickerCard({ item, active, onSelect }) {
  const statusLabel = SERVICE_STATUS_LABELS[item.moderationStatus] || item.moderationStatus
  const isPublic = item.isPublished && item.moderationStatus === 'approved'
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${active ? 'border-ink bg-ink text-paper' : 'border-line bg-soft text-ink hover:border-ink/30'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`truncate text-xs uppercase tracking-[0.14em] ${active ? 'text-paper/60' : 'text-muted'}`}>{statusLabel}</div>
          <div className="mt-2 line-clamp-2 font-display text-xl leading-tight">{item.title || 'Услуга без заглавие'}</div>
        </div>
        {isPublic ? <CheckCircle2 size={19} className={active ? 'text-paper' : 'text-accentDeep'} /> : <CircleDot size={19} className={active ? 'text-paper/80' : 'text-muted'} />}
      </div>
      <div className={`mt-3 text-sm ${active ? 'text-paper/70' : 'text-muted'}`}>
        {item.lowestPrice ? formatServicePrice(item.lowestPrice) : 'Цена по оферта'}
      </div>
    </button>
  )
}

function VisibilityPanel({ draft, state }) {
  const isPublic = draft.isPublished && draft.moderationStatus === 'approved' && draft.slug
  const statusLabel = SERVICE_STATUS_LABELS[draft.moderationStatus] || draft.moderationStatus || 'Чернова'
  return (
    <div className={`rounded-2xl border p-4 ${isPublic ? 'border-accentDeep/30 bg-accentDeep/5' : 'border-line bg-soft'}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        {isPublic ? <CheckCircle2 size={18} className="text-accentDeep" /> : <CircleDot size={18} className="text-muted" />}
        {isPublic ? 'Видима за клиенти' : statusLabel}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        {isPublic ? 'Показва се в “Услуги”, “Каталог” и публичния ти профил.' : 'Черновите са видими само за теб. Изпратените услуги чакат преглед от Totsan.'}
      </p>
      {isPublic && (
        <Link to={`/uslugi/${draft.slug}`} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-ink underline underline-offset-4">
          Отвори страницата <ArrowUpRight size={16} />
        </Link>
      )}
      {state.message && state.status !== 'ready' && (
        <div className={`mt-3 rounded-xl px-3 py-2 text-xs ${state.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-paper text-muted'}`}>
          {state.message}
        </div>
      )}
    </div>
  )
}

function InfoSection({ draft, onChange }) {
  return (
    <div className="space-y-5">
      <SectionTitle title="Информация за услугата" />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Заглавие"><input value={draft.title} onChange={event => onChange('title', event.target.value)} className={INPUT} placeholder="Боядисване на стая" /></Field>
        <Field label="Кратко подзаглавие"><input value={draft.subtitle} onChange={event => onChange('subtitle', event.target.value)} className={INPUT} placeholder="Чисто изпълнение, защита на мебели, финално почистване" /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Слой"><select value={draft.layerSlug} onChange={event => onChange('layerSlug', event.target.value)} className={INPUT}>{LAYERS.map(layer => <option key={layer.slug} value={layer.slug}>Слой {layer.number} · {layer.title}</option>)}</select></Field>
        <Field label="Тагове"><input value={draft.tagsText} onChange={event => onChange('tagsText', event.target.value)} className={INPUT} placeholder="боя, шпакловка, освежаване" /></Field>
        <Field label="Райони"><input value={draft.deliveryAreasText} onChange={event => onChange('deliveryAreasText', event.target.value)} className={INPUT} placeholder="София, Пловдив" /></Field>
      </div>
      <Field label="Описание"><textarea rows={8} value={draft.descriptionMd} onChange={event => onChange('descriptionMd', event.target.value)} className={INPUT} placeholder="Опиши какво включва услугата, как протича работата и какво трябва да подготви клиентът." /></Field>
    </div>
  )
}

function PriceSection({ item, onChange, onFeatureChange, onAddFeature }) {
  return (
    <div className="space-y-5">
      <SectionTitle title="Официална цена" />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Име на офертата"><input value={item.title} onChange={event => onChange('title', event.target.value)} className={INPUT} placeholder="Официална оферта" /></Field>
        <Field label="Цена">
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">€</span>
            <input type="number" min="0" value={item.priceAmount} onChange={event => onChange('priceAmount', event.target.value)} className={`${INPUT} pl-10`} placeholder="250" />
          </div>
        </Field>
      </div>
      <Field label="Кратко описание на офертата"><textarea rows={4} value={item.description} onChange={event => onChange('description', event.target.value)} className={INPUT} placeholder="Какво включва тази цена и при какви условия се уточнява финална оферта." /></Field>
      <div>
        <div className="text-sm font-medium text-ink">Какво включва</div>
        <div className="mt-2 space-y-2">
          {(item.features || []).map((feature, index) => (
            <input key={index} value={feature} onChange={event => onFeatureChange(index, event.target.value)} className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-ink" placeholder="Напр. Подготовка, труд и финално почистване" />
          ))}
        </div>
        <button type="button" onClick={onAddFeature} className="mt-3 text-sm font-medium text-ink underline underline-offset-4">Добави ред</button>
      </div>
    </div>
  )
}

function MediaSection({ draft, onChange, onUpload }) {
  return (
    <div className="space-y-5">
      <SectionTitle title="Снимки" />
      <Field label="Cover URL"><input value={draft.coverUrl} onChange={event => onChange('coverUrl', event.target.value)} className={INPUT} /></Field>
      <label className="btn btn-ghost cursor-pointer justify-center">
        <ImagePlus size={18} /> Качи снимка към услугата
        <input type="file" accept="image/*" className="sr-only" onChange={async (event) => { await onUpload(event.target.files?.[0]); event.target.value = '' }} />
      </label>
      {draft.media.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {draft.media.map((media, index) => (
            <div key={`${media.url}-${index}`} className="overflow-hidden rounded-2xl border border-line bg-soft">
              <div className="aspect-square"><img src={media.url} alt={media.caption || draft.title} className="img-cover" /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FaqSection({ draft, onFaqChange, onAddFaq }) {
  return (
    <div className="space-y-4">
      <SectionTitle title="Често задавани въпроси" />
      {draft.faq.map((item, index) => (
        <div key={index} className="rounded-3xl border border-line bg-soft p-4">
          <Field label={`Въпрос ${index + 1}`}><input value={item.question} onChange={event => onFaqChange(index, 'question', event.target.value)} className={INPUT} /></Field>
          <Field label="Отговор"><textarea rows={3} value={item.answer} onChange={event => onFaqChange(index, 'answer', event.target.value)} className={INPUT} /></Field>
        </div>
      ))}
      <button type="button" onClick={onAddFaq} className="btn btn-ghost"><Plus size={18} /> Добави въпрос</button>
    </div>
  )
}

function ServicePreview({ service, profile }) {
  const offer = service.packages[0] || makeEmptyPackage('basic')
  const cover = service.coverUrl || service.media?.[0]?.url || profile.imageUrl
  return (
    <article className="mt-5 overflow-hidden rounded-3xl border border-line bg-soft">
      <div className="aspect-[16/8] bg-soft">
        {cover ? <img src={cover} alt={service.title || 'Услуга'} className="img-cover" /> : null}
      </div>
      <div className="p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-muted">Услуга</div>
            <h3 className="mt-2 font-display text-4xl leading-tight text-ink">{service.title || 'Заглавие на услугата'}</h3>
            <p className="mt-2 max-w-3xl text-sm text-muted">{service.subtitle || 'Кратко описание на стойността за клиента.'}</p>
          </div>
          <div className="rounded-2xl border border-line bg-paper px-4 py-3 text-right">
            <div className="text-xs uppercase tracking-[0.14em] text-muted">Цена</div>
            <div className="mt-1 font-display text-3xl text-ink">{formatServicePrice(offer.priceAmount)}</div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {(service.tags || []).slice(0, 5).map(tag => <span key={tag} className="rounded-full bg-paper px-3 py-1 text-xs text-muted">{tag}</span>)}
        </div>
        {offer.description && <p className="mt-5 whitespace-pre-wrap text-sm text-muted">{offer.description}</p>}
        {(offer.features || []).filter(Boolean).length > 0 && (
          <ul className="mt-5 grid gap-2 text-sm text-ink/80 md:grid-cols-2">
            {offer.features.filter(Boolean).map(feature => <li key={feature}>• {feature}</li>)}
          </ul>
        )}
      </div>
    </article>
  )
}

function SectionTitle({ title }) {
  return <div><div className="eyebrow">Редакция</div><h3 className="mt-2 font-display text-3xl text-ink">{title}</h3></div>
}

function Field({ label, children }) {
  return <label className="block text-sm font-medium text-ink">{label}{children}</label>
}
