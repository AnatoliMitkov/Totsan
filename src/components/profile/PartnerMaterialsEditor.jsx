import { useEffect, useMemo, useState } from 'react'
import { Check, Eye, EyeOff, Plus, Save, Search, Tags, Trash2, X } from 'lucide-react'
import { LAYERS } from '../../data/layers.js'
import { PARTNER_LOGOS, WHAT_YOU_FIND_IMAGES, productImageFor } from '../../data/images.js'
import {
  MATERIAL_RELATION_TYPES,
  deletePartnerMaterialCapability,
  loadPartnerMaterialCapabilitiesForProfile,
  makeMaterialCapabilityDraft,
  relationTypePills,
  savePartnerMaterialCapability,
} from '../../lib/partner-materials.js'
import { getBrandsForCategory, getMaterialCategories, getMaterialCategory, getProductBrand } from '../../lib/product-metadata.js'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'

const MATERIAL_LAYER_SLUGS = ['materiali', 'obzavezhdane', 'dekoraciya']

const CATEGORY_IMAGE_BY_SLUG = {
  'interior-paint': WHAT_YOU_FIND_IMAGES.materiali.paints,
  'porcelain-tiles': WHAT_YOU_FIND_IMAGES.materiali.tiles,
  windows: WHAT_YOU_FIND_IMAGES.materiali.windows,
  drywall: productImageFor('Knauf Diamant 12.5', 'materiali'),
  'laminate-flooring': WHAT_YOU_FIND_IMAGES.materiali.flooring,
  insulation: WHAT_YOU_FIND_IMAGES.materiali.insulation,
  'custom-kitchens': WHAT_YOU_FIND_IMAGES.obzavezhdane.kitchen,
  'bathroom-fixtures': WHAT_YOU_FIND_IMAGES.obzavezhdane.bathroom,
  appliances: productImageFor('Bosch Series 8', 'obzavezhdane'),
  sofas: productImageFor('soft-furniture', 'obzavezhdane'),
  lighting: WHAT_YOU_FIND_IMAGES.obzavezhdane.lighting,
  wardrobes: WHAT_YOU_FIND_IMAGES.obzavezhdane.bedroom,
  wallpapers: WHAT_YOU_FIND_IMAGES.dekoraciya.wallpaper,
  'accent-paint': WHAT_YOU_FIND_IMAGES.dekoraciya.decor,
  pergolas: WHAT_YOU_FIND_IMAGES.dekoraciya.terrace,
  irrigation: WHAT_YOU_FIND_IMAGES.dekoraciya.garden,
  'outdoor-lighting': productImageFor('outdoor-lighting', 'dekoraciya'),
  planters: productImageFor('planters', 'dekoraciya'),
}

const BRAND_LOGO_BY_SLUG = {
  caparol: '/Logos/caparol.svg',
  schuco: '/Logos/Schuco-Logo-1.svg',
  knauf: '/Logos/Knauf-Logo-2.svg',
  bosch: '/Logos/bosch-logo-simple.svg',
}

const BRAND_LOGO_LOOKUP = new Map(PARTNER_LOGOS.map((item) => [String(item.name || '').toLowerCase(), item.logo]))

export default function PartnerMaterialsEditor({ profile }) {
  const [items, setItems] = useState([])
  const [draft, setDraft] = useState(() => makeMaterialCapabilityDraft(profile))
  const [query, setQuery] = useState('')
  const [layerFilter, setLayerFilter] = useState('all')
  const [isEditorOpen, setIsEditorOpen] = useState(false)
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

  const allCategories = useMemo(() => getMaterialCategories(), [])

  const layerOptions = useMemo(() => (
    MATERIAL_LAYER_SLUGS
      .map((slug) => LAYERS.find((layer) => layer.slug === slug))
      .filter(Boolean)
  ), [])

  const categories = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return allCategories.filter((category) => {
      if (layerFilter !== 'all' && category.layerSlug !== layerFilter) return false
      if (!needle) return true
      return `${category.label} ${category.slug}`.toLowerCase().includes(needle)
    })
  }, [allCategories, layerFilter, query])

  const selectedCategory = getMaterialCategory(draft.categorySlug)
  const selectedBrand = getProductBrand(draft.brandSlug)
  const brandOptions = selectedCategory ? getBrandsForCategory(selectedCategory.slug) : []
  const publicCount = items.filter((item) => item.isPublic && item.moderationStatus === 'approved').length
  const categoryUsage = useMemo(() => {
    const usage = new Map()
    items.forEach((item) => usage.set(item.categorySlug, (usage.get(item.categorySlug) || 0) + 1))
    return usage
  }, [items])

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function openNewCapability() {
    setDraft(makeMaterialCapabilityDraft(profile))
    setLayerFilter('all')
    setQuery('')
    setState((current) => ({ ...current, message: current.status === 'error' ? current.message : '' }))
    setIsEditorOpen(true)
  }

  function openExistingCapability(item) {
    setDraft(makeMaterialCapabilityDraft(profile, item))
    setLayerFilter(item.layerSlug || 'all')
    setQuery('')
    setState({ status: 'ready', message: '' })
    setIsEditorOpen(true)
  }

  function closeEditor() {
    setIsEditorOpen(false)
    setQuery('')
    setLayerFilter('all')
    if (state.status !== 'error') {
      setState((current) => ({ ...current, message: '' }))
    }
  }

  function selectCategory(category) {
    setDraft((current) => ({
      ...current,
      layerSlug: category.layerSlug,
      categorySlug: category.slug,
      brandSlug: '',
    }))
  }

  function selectBrand(brandSlug) {
    update('brandSlug', brandSlug)
  }

  function toggleRelation(type) {
    setDraft((current) => {
      const currentTypes = current.relationTypes || []
      const hasType = currentTypes.includes(type)
      const next = hasType ? currentTypes.filter((item) => item !== type) : [...currentTypes, type]
      return { ...current, relationTypes: next }
    })
  }

  async function saveCapability(event) {
    event?.preventDefault()

    const duplicate = items.find((item) =>
      item.id !== draft.id
      && item.categorySlug === draft.categorySlug
      && (item.brandSlug || '') === (draft.brandSlug || '')
    )
    if (duplicate) {
      setState({ status: 'error', message: 'Вече има такава категория/марка. Редактирай съществуващия запис.' })
      setDraft(makeMaterialCapabilityDraft(profile, duplicate))
      setLayerFilter(duplicate.layerSlug || 'all')
      return
    }

    setState({ status: 'saving', message: 'Запазваме материалите…' })
    try {
      const saved = await savePartnerMaterialCapability(profile, draft)
      setItems((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
      setDraft(makeMaterialCapabilityDraft(profile, saved))
      setState({ status: 'saved', message: 'Материалите и марките са запазени.' })
      setIsEditorOpen(false)
      setLayerFilter('all')
      setQuery('')
    } catch (error) {
      setState({ status: 'error', message: error.message || 'Записът не успя.' })
    }
  }

  async function removeCapability() {
    if (!draft.id) return
    setState({ status: 'saving', message: 'Премахваме записа…' })
    try {
      await deletePartnerMaterialCapability(draft.id)
      const next = items.filter((item) => item.id !== draft.id)
      setItems(next)
      setDraft(makeMaterialCapabilityDraft(profile, next[0] || null))
      setState({ status: 'saved', message: 'Записът е премахнат.' })
      setIsEditorOpen(false)
    } catch (error) {
      setState({ status: 'error', message: error.message || 'Изтриването не успя.' })
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">Материали и марки</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Запазени категории</h2>
            <p className="mt-2 text-sm text-muted">Подреди материалите и марките, с които работиш. Новите записи чакат кратък admin преглед преди да излязат публично.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatPill label="Активни" value={items.length} />
            <StatPill label="Публични" value={publicCount} />
            <button type="button" onClick={openNewCapability} className="btn btn-primary">
              <Plus size={18} /> Нова категория
            </button>
          </div>
        </div>

        {items.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {items.map((item) => (
              <CapabilityCard key={item.id} item={item} onSelect={() => openExistingCapability(item)} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-line bg-soft p-5 text-sm text-muted">
            Още няма добавени материали или марки. Започни от бутона за нова категория.
          </div>
        )}
      </section>

      {isEditorOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/60 p-3 backdrop-blur-sm md:items-center md:p-6">
          <div className="max-h-[calc(100dvh-4rem)] w-[90vw] max-w-[1500px] overflow-hidden rounded-[32px] border border-line bg-paper shadow-2xl">
            <form onSubmit={saveCapability} className="flex h-full max-h-[92vh] flex-col">
              <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 md:px-7">
                <div>
                  <div className="eyebrow">Материали и марки</div>
                  <h3 className="mt-1 font-display text-2xl text-ink">{draft.id ? 'Редакция на запис' : 'Нова категория'}</h3>
                </div>
                <button type="button" onClick={closeEditor} className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-soft text-ink transition hover:bg-paper">
                  <X size={18} />
                </button>
              </div>

              <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[1.6fr_0.9fr]">
                <section className="min-h-0 overflow-y-auto border-b border-line p-5 md:p-7 xl:border-b-0 xl:border-r">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="text-sm font-medium text-ink">Избери категория</div>
                      <div className="mt-1 text-sm text-muted">Всички опции са в popup-а, подредени като продуктови карти.</div>
                    </div>
                    <label className="relative block w-full max-w-md">
                      <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        className={`${INPUT} mt-0 pl-11`}
                        placeholder="Търси категория, напр. боя, дограма, осветление"
                      />
                    </label>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <LayerFilterButton active={layerFilter === 'all'} onClick={() => setLayerFilter('all')}>Всички</LayerFilterButton>
                    {layerOptions.map((layer) => (
                      <LayerFilterButton key={layer.slug} active={layerFilter === layer.slug} onClick={() => setLayerFilter(layer.slug)}>
                        {layer.number} · {layer.title}
                      </LayerFilterButton>
                    ))}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                    {categories.map((category) => (
                      <CategoryCard
                        key={category.slug}
                        category={category}
                        active={draft.categorySlug === category.slug}
                        count={categoryUsage.get(category.slug) || 0}
                        brandsCount={getBrandsForCategory(category.slug).length}
                        onSelect={() => selectCategory(category)}
                      />
                    ))}
                  </div>

                  {!categories.length && (
                    <div className="mt-5 rounded-2xl border border-dashed border-line bg-soft p-5 text-sm text-muted">
                      Няма категории за този филтър. Смени слоя или търсенето.
                    </div>
                  )}
                </section>

                <aside className="min-h-0 overflow-y-auto p-5 md:p-7">
                  <div className="space-y-5">
                    <SelectionPreview category={selectedCategory} brand={selectedBrand} relationTypes={draft.relationTypes} isPublic={draft.isPublic} />

                    <div>
                      <div className="text-sm font-medium text-ink">Марка</div>
                      {selectedCategory ? (
                        <div className="mt-3 space-y-3">
                          <button
                            type="button"
                            onClick={() => selectBrand('')}
                            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${!draft.brandSlug ? 'border-ink bg-ink text-paper' : 'border-line bg-soft text-ink hover:border-ink/40'}`}
                          >
                            <div>
                              <div className={`text-xs uppercase tracking-[0.14em] ${!draft.brandSlug ? 'text-paper/65' : 'text-muted'}`}>Всички марки</div>
                              <div className="mt-1 font-medium">Работя на ниво категория</div>
                            </div>
                            {!draft.brandSlug && <Check size={18} />}
                          </button>

                          {brandOptions.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              {brandOptions.map((brand) => (
                                <BrandCard
                                  key={brand.slug}
                                  brand={brand}
                                  active={draft.brandSlug === brand.slug}
                                  onSelect={() => selectBrand(brand.slug)}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-line bg-soft p-4 text-sm text-muted">
                              За тази категория още няма подготвени конкретни марки. Можеш да я запазиш само на ниво категория.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-2xl border border-dashed border-line bg-soft p-4 text-sm text-muted">
                          Избери категория, за да се появят подходящите марки.
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-medium text-ink">Как работиш с това</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {MATERIAL_RELATION_TYPES.map((type) => {
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
                      <textarea
                        rows={4}
                        value={draft.note}
                        onChange={(event) => update('note', event.target.value)}
                        className={INPUT}
                        placeholder="Напр. Монтирам, консултирам и препоръчвам правилната серия според помещението."
                      />
                    </Field>

                    <label className="flex items-start gap-3 rounded-2xl border border-line bg-soft p-4 text-sm text-muted">
                      <input type="checkbox" checked={draft.isPublic} onChange={(event) => update('isPublic', event.target.checked)} className="mt-1 accent-black" />
                      <span>Покажи публично след admin одобрение.</span>
                    </label>

                    <div className={`rounded-2xl p-3 text-sm ${state.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-soft text-muted'}`}>
                      {state.message || 'Запази, за да изпратиш материала за преглед.'}
                    </div>
                  </div>
                </aside>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 md:px-7">
                <div className="text-sm text-muted">Пази се само една комбинация на категория и марка.</div>
                <div className="flex flex-wrap gap-2">
                  {draft.id && (
                    <button type="button" onClick={removeCapability} className="btn btn-ghost">
                      <Trash2 size={18} /> Изтрий
                    </button>
                  )}
                  <button className="btn btn-primary" disabled={state.status === 'saving'}>
                    <Save size={18} /> {state.status === 'saving' ? 'Запазва се…' : 'Запази'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function CapabilityCard({ item, onSelect }) {
  const pills = relationTypePills(item.relationTypes)
  const image = imageForCategory(item.categorySlug, item.layerSlug)

  return (
    <button
      type="button"
      onClick={onSelect}
      className="overflow-hidden rounded-[24px] border border-line bg-soft text-left transition hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-sm"
    >
      <div className="relative aspect-[0.9/1]">
        <img src={image} alt={item.categoryLabel} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-transparent" />
        <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
          <BrandBadge brandSlug={item.brandSlug} brandLabel={item.brandLabel || 'Категория'} compact />
          {item.isPublic && item.moderationStatus === 'approved' ? <Eye size={16} className="text-paper" /> : <EyeOff size={16} className="text-paper/80" />}
        </div>
        <div className="absolute inset-x-3 bottom-3">
          <div className="line-clamp-2 font-display text-xl leading-tight text-paper">{item.brandLabel || item.categoryLabel}</div>
          {item.brandLabel && <div className="mt-1 line-clamp-1 text-xs text-paper/75">{item.categoryLabel}</div>}
        </div>
      </div>
      <div className="space-y-2 bg-paper p-3">
        {pills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pills.slice(0, 2).map((label) => (
              <span key={label} className="rounded-full bg-soft px-2 py-1 text-[11px] text-muted">{label}</span>
            ))}
          </div>
        )}
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{statusLabel(item.moderationStatus)}</div>
        <div className="line-clamp-2 text-xs text-muted">{item.note || 'Кликни за редакция на детайлите.'}</div>
      </div>
    </button>
  )
}

function statusLabel(value) {
  if (value === 'approved') return 'Одобрен'
  if (value === 'rejected') return 'Отхвърлен'
  if (value === 'hidden') return 'Скрит'
  return 'Чака преглед'
}

function CategoryCard({ category, active, count, brandsCount, onSelect }) {
  const image = imageForCategory(category.slug, category.layerSlug)
  const layer = LAYERS.find((item) => item.slug === category.layerSlug)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`overflow-hidden rounded-[24px] border text-left transition hover:-translate-y-0.5 hover:shadow-sm ${active ? 'border-ink' : 'border-line hover:border-ink/30'}`}
    >
      <div className="relative aspect-[0.9/1]">
        <img src={image} alt={category.label} className="h-full w-full object-cover" />
        <div className={`absolute inset-0 ${active ? 'bg-gradient-to-t from-ink via-ink/65 to-transparent' : 'bg-gradient-to-t from-ink/70 via-ink/25 to-transparent'}`} />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="rounded-full bg-paper/12 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-paper/85">
            {layer ? layer.number : category.layerSlug}
          </span>
          {count > 0 && <span className="rounded-full bg-paper/12 px-2.5 py-1 text-[11px] text-paper/85">{count}</span>}
        </div>
        <div className="absolute inset-x-3 bottom-3">
          <div className="line-clamp-2 font-display text-xl leading-tight text-paper">{category.label}</div>
          <div className="mt-1 text-xs text-paper/75">
            {brandsCount > 0 ? `${brandsCount} марки` : 'Без фиксирани марки'}
          </div>
        </div>
        {active && (
          <div className="absolute right-3 top-10 flex h-8 w-8 items-center justify-center rounded-full bg-paper text-ink">
            <Check size={16} />
          </div>
        )}
      </div>
    </button>
  )
}

function BrandCard({ brand, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${active ? 'border-ink bg-ink text-paper' : 'border-line bg-soft text-ink hover:border-ink/40'}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <BrandBadge brandSlug={brand.slug} brandLabel={brand.label} active={active} />
        <div className="min-w-0">
          <div className="truncate font-medium">{brand.label}</div>
          <div className={`text-sm ${active ? 'text-paper/65' : 'text-muted'}`}>Марка в тази категория</div>
        </div>
      </div>
      {active && <Check size={18} />}
    </button>
  )
}

function SelectionPreview({ category, brand, relationTypes, isPublic }) {
  const pills = relationTypePills(relationTypes)
  return (
    <div className="overflow-hidden rounded-[28px] border border-line bg-soft">
      <div className="relative aspect-[1.45/1]">
        <img src={imageForCategory(category?.slug, category?.layerSlug)} alt={category?.label || 'Предварителен преглед'} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-transparent" />
        <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
          <div className="rounded-full bg-paper/12 px-3 py-1 text-xs uppercase tracking-[0.14em] text-paper/85">
            {category?.label ? 'Текущ избор' : 'Preview'}
          </div>
          {isPublic ? <Eye size={18} className="text-paper" /> : <EyeOff size={18} className="text-paper/80" />}
        </div>
        <div className="absolute inset-x-4 bottom-4 text-paper">
          <div className="font-display text-3xl leading-tight">{brand?.label || category?.label || 'Избери категория'}</div>
          <div className="mt-2 text-sm text-paper/75">
            {brand?.label && category?.label ? `${brand.label} · ${category.label}` : category?.label || 'Ще видиш тук текущата селекция.'}
          </div>
        </div>
      </div>
      <div className="space-y-3 bg-paper p-4">
        <div className="flex items-center gap-3">
          <BrandBadge brandSlug={brand?.slug} brandLabel={brand?.label || category?.label || 'Избор'} />
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">{brand?.label || category?.label || 'Очаква избор'}</div>
            <div className="text-sm text-muted">{category?.label ? `Категория: ${category.label}` : 'Няма избрана категория'}</div>
          </div>
        </div>
        {pills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {pills.map((label) => (
              <span key={label} className="rounded-full bg-soft px-2.5 py-1 text-xs text-muted">{label}</span>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted">Добави поне един начин на работа, за да стане полезно в препоръките.</div>
        )}
      </div>
    </div>
  )
}

function BrandBadge({ brandSlug, brandLabel, active = false, compact = false }) {
  const logo = logoForBrand(brandSlug, brandLabel)

  if (logo) {
    return (
      <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl ${compact ? 'h-9 w-9 bg-paper/12' : 'h-11 w-11 bg-paper'} ${active && compact ? 'border border-paper/15' : 'border border-line/60'}`}>
        <img src={logo} alt={brandLabel} className="h-6 w-6 object-contain" />
      </span>
    )
  }

  return (
    <span className={`flex shrink-0 items-center justify-center rounded-2xl text-xs font-semibold uppercase ${compact ? 'h-9 w-9 bg-paper/12 text-paper' : active ? 'h-11 w-11 bg-paper/12 text-paper' : 'h-11 w-11 bg-ink text-paper'}`}>
      {initialsFor(brandLabel)}
    </span>
  )
}

function LayerFilterButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition ${active ? 'border-ink bg-ink text-paper' : 'border-line bg-soft text-muted hover:text-ink'}`}
    >
      {children}
    </button>
  )
}

function StatPill({ label, value }) {
  return (
    <div className="rounded-full border border-line bg-soft px-4 py-2">
      <span className="text-xs uppercase tracking-[0.14em] text-muted">{label}</span>
      <span className="ml-2 text-sm font-medium text-ink">{value}</span>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="block text-sm font-medium text-ink">{label}{children}</label>
}

function imageForCategory(categorySlug, layerSlug = 'materiali') {
  return CATEGORY_IMAGE_BY_SLUG[categorySlug] || productImageFor(categorySlug || 'category', layerSlug || 'materiali')
}

function logoForBrand(brandSlug, brandLabel) {
  if (brandSlug && BRAND_LOGO_BY_SLUG[brandSlug]) return BRAND_LOGO_BY_SLUG[brandSlug]
  const match = BRAND_LOGO_LOOKUP.get(String(brandLabel || '').toLowerCase())
  return match || ''
}

function initialsFor(value = '') {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 'TT'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}
