import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Plus, Save, Search, Tags, Trash2 } from 'lucide-react'
import {
  MATERIAL_RELATION_TYPES,
  deletePartnerMaterialCapability,
  loadPartnerMaterialCapabilitiesForProfile,
  makeMaterialCapabilityDraft,
  relationTypePills,
  savePartnerMaterialCapability,
} from '../../lib/partner-materials.js'
import { getBrandsForCategory, getMaterialCategories, getMaterialCategory } from '../../lib/product-metadata.js'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'

export default function PartnerMaterialsEditor({ profile }) {
  const [items, setItems] = useState([])
  const [draft, setDraft] = useState(() => makeMaterialCapabilityDraft(profile))
  const [query, setQuery] = useState('')
  const [state, setState] = useState({ status: 'loading', message: 'Зареждаме материалите…' })

  useEffect(() => {
    let active = true
    async function load() {
      setState({ status: 'loading', message: 'Зареждаме материалите…' })
      try {
        const rows = await loadPartnerMaterialCapabilitiesForProfile(profile.id)
        if (!active) return
        setItems(rows)
        setDraft(makeMaterialCapabilityDraft(profile, rows[0] || null))
        setState({ status: 'ready', message: '' })
      } catch (error) {
        if (!active) return
        setItems([])
        setState({ status: 'error', message: error.message || 'Материалите и марките не успяха да заредят.' })
      }
    }
    load()
    return () => { active = false }
  }, [profile.id, profile.updatedAt])

  const categories = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return getMaterialCategories().filter((category) => {
      if (!needle) return true
      return `${category.label} ${category.slug}`.toLowerCase().includes(needle)
    })
  }, [query])

  const selectedCategory = getMaterialCategory(draft.categorySlug)
  const brandOptions = selectedCategory ? getBrandsForCategory(selectedCategory.slug) : []

  function update(key, value) {
    setDraft(current => ({ ...current, [key]: value }))
  }

  function selectCategory(category) {
    setDraft(current => ({
      ...current,
      layerSlug: category.layerSlug,
      categorySlug: category.slug,
      brandSlug: '',
    }))
  }

  function toggleRelation(type) {
    setDraft(current => {
      const currentTypes = current.relationTypes || []
      const hasType = currentTypes.includes(type)
      const next = hasType ? currentTypes.filter(item => item !== type) : [...currentTypes, type]
      return { ...current, relationTypes: next }
    })
  }

  function selectCapability(item) {
    setDraft(makeMaterialCapabilityDraft(profile, item))
    setState({ status: 'ready', message: '' })
  }

  function newCapability() {
    setDraft(makeMaterialCapabilityDraft(profile))
    setState({ status: 'ready', message: '' })
  }

  async function saveCapability(event) {
    event?.preventDefault()

    const duplicate = items.find(item =>
      item.id !== draft.id
      && item.categorySlug === draft.categorySlug
      && (item.brandSlug || '') === (draft.brandSlug || '')
    )
    if (duplicate) {
      setState({ status: 'error', message: 'Вече има такава категория/марка. Редактирай съществуващия запис.' })
      setDraft(makeMaterialCapabilityDraft(profile, duplicate))
      return
    }

    setState({ status: 'saving', message: 'Запазваме материалите…' })
    try {
      const saved = await savePartnerMaterialCapability(profile, draft)
      setItems(current => [saved, ...current.filter(item => item.id !== saved.id)])
      setDraft(makeMaterialCapabilityDraft(profile, saved))
      setState({ status: 'saved', message: 'Материалите и марките са запазени.' })
    } catch (error) {
      setState({ status: 'error', message: error.message || 'Записът не успя.' })
    }
  }

  async function removeCapability() {
    if (!draft.id) return
    setState({ status: 'saving', message: 'Премахваме записа…' })
    try {
      await deletePartnerMaterialCapability(draft.id)
      const next = items.filter(item => item.id !== draft.id)
      setItems(next)
      setDraft(makeMaterialCapabilityDraft(profile, next[0] || null))
      setState({ status: 'saved', message: 'Записът е премахнат.' })
    } catch (error) {
      setState({ status: 'error', message: error.message || 'Изтриването не успя.' })
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="eyebrow">Материали и марки</div>
            <h2 className="mt-2 font-display text-3xl text-ink">С какво работиш</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Избери категории и, ако е важно, конкретни марки. Това помага продуктите да показват правилните специалисти без да избираш стотици отделни артикули.
            </p>
          </div>
          <button type="button" onClick={newCapability} className="btn btn-primary"><Plus size={18} /> Нова категория</button>
        </div>

        {items.length > 0 ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map(item => (
              <CapabilityCard key={item.id} item={item} active={draft.id === item.id} onSelect={() => selectCapability(item)} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-line bg-soft p-5 text-sm text-muted">
            Още няма добавени материали или марки. Започни с категорията, която най-често използваш.
          </div>
        )}
      </section>

      <form onSubmit={saveCapability} className="grid gap-5 lg:grid-cols-12">
        <section className="lg:col-span-7 rounded-3xl border border-line bg-paper p-5 md:p-7">
          <div className="eyebrow">Категория</div>
          <h3 className="mt-2 font-display text-3xl text-ink">Избери тип материал</h3>
          <label className="relative mt-5 block">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input value={query} onChange={event => setQuery(event.target.value)} className={`${INPUT} pl-11`} placeholder="Търси категория, напр. боя, дограма, осветление" />
          </label>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {categories.map(category => {
              const isActive = draft.categorySlug === category.slug
              return (
                <button
                  key={category.slug}
                  type="button"
                  onClick={() => selectCategory(category)}
                  className={`rounded-2xl border p-4 text-left transition ${isActive ? 'border-ink bg-ink text-paper' : 'border-line bg-soft text-ink hover:border-ink/40'}`}
                >
                  <div className={`text-xs uppercase tracking-[0.14em] ${isActive ? 'text-paper/60' : 'text-muted'}`}>{category.layerSlug}</div>
                  <div className="mt-2 font-medium">{category.label}</div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="lg:col-span-5 rounded-3xl border border-line bg-paper p-5 md:p-7 space-y-5">
          <div>
            <div className="eyebrow">Детайли</div>
            <h3 className="mt-2 font-display text-3xl text-ink">Марка и роля</h3>
          </div>

          <Field label="Марка (по избор)">
            <select value={draft.brandSlug || ''} onChange={event => update('brandSlug', event.target.value)} className={INPUT} disabled={!selectedCategory}>
              <option value="">Всички марки в категорията</option>
              {brandOptions.map(brand => <option key={brand.slug} value={brand.slug}>{brand.label}</option>)}
            </select>
          </Field>

          <div>
            <div className="text-sm font-medium text-ink">Как работиш с това</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {MATERIAL_RELATION_TYPES.map(type => {
                const isActive = draft.relationTypes.includes(type.value)
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => toggleRelation(type.value)}
                    className={`rounded-full border px-3 py-2 text-sm transition ${isActive ? 'border-ink bg-ink text-paper' : 'border-line bg-soft text-muted hover:text-ink'}`}
                  >
                    {type.editLabel}
                  </button>
                )
              })}
            </div>
          </div>

          <Field label="Кратка бележка (по избор)">
            <textarea rows={4} value={draft.note} onChange={event => update('note', event.target.value)} className={INPUT} placeholder="Напр. Работя основно с монтаж и консултация за избор." />
          </Field>

          <label className="flex items-start gap-3 rounded-2xl border border-line bg-soft p-4 text-sm text-muted">
            <input type="checkbox" checked={draft.isPublic} onChange={event => update('isPublic', event.target.checked)} className="mt-1 accent-black" />
            <span>Покажи публично в продуктови препоръки.</span>
          </label>

          <div className={`rounded-2xl p-3 text-sm ${state.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-soft text-muted'}`}>
            {state.message || 'Запази, за да се използва при продуктови препоръки.'}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-line pt-5">
            <button className="btn btn-primary" disabled={state.status === 'saving'}><Save size={18} /> {state.status === 'saving' ? 'Запазва се…' : 'Запази'}</button>
            {draft.id && <button type="button" onClick={removeCapability} className="btn btn-ghost"><Trash2 size={18} /> Изтрий</button>}
          </div>
        </section>
      </form>
    </div>
  )
}

function CapabilityCard({ item, active, onSelect }) {
  const pills = relationTypePills(item.relationTypes)
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${active ? 'border-ink bg-ink text-paper' : 'border-line bg-soft text-ink hover:border-ink/30'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`flex items-center gap-2 text-xs uppercase tracking-[0.14em] ${active ? 'text-paper/60' : 'text-muted'}`}>
            <Tags size={14} /> {item.brandLabel || 'Категория'}
          </div>
          <div className="mt-2 line-clamp-2 font-display text-xl leading-tight">{item.brandLabel || item.categoryLabel}</div>
          {item.brandLabel && <div className={`mt-1 text-sm ${active ? 'text-paper/70' : 'text-muted'}`}>{item.categoryLabel}</div>}
        </div>
        {item.isPublic ? <Eye size={18} className={active ? 'text-paper' : 'text-accentDeep'} /> : <EyeOff size={18} className={active ? 'text-paper/70' : 'text-muted'} />}
      </div>
      {pills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {pills.slice(0, 3).map(label => <span key={label} className={`rounded-full px-2 py-1 text-xs ${active ? 'bg-paper/15 text-paper' : 'bg-paper text-muted'}`}>{label}</span>)}
        </div>
      )}
    </button>
  )
}

function Field({ label, children }) {
  return <label className="block text-sm font-medium text-ink">{label}{children}</label>
}
