import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BriefcaseBusiness, CheckCircle2, MapPin, PackageSearch, Search, SlidersHorizontal, UserRound, X } from 'lucide-react'
import { useProfileDirectory } from '../lib/profiles.js'
import { loadPublicPartnerServices, packagePriceLabel } from '../lib/partner-services.js'
import { productImageFor } from '../data/images.js'
import FallbackImage from '../components/FallbackImage.jsx'
import ProfessionalCard from '../components/ProfessionalCard.jsx'
import { getPartnerServiceCoverCandidates } from '../lib/service-media.js'

const VALID_KINDS = new Set(['all', 'pro', 'service', 'product'])
const KIND_TABS = [
  { value: 'all', label: 'Всичко', helper: 'Целият marketplace' },
  { value: 'pro', label: 'Специалисти', helper: 'Профили за запитване' },
  { value: 'service', label: 'Услуги', helper: 'Пакети и оферти' },
  { value: 'product', label: 'Продукти', helper: 'Материали и решения' },
]

const KIND_COPY = {
  all: { label: 'Всичко', resultLabel: 'резултата' },
  pro: { label: 'Специалисти', resultLabel: 'специалисти' },
  service: { label: 'Услуги', resultLabel: 'услуги' },
  product: { label: 'Продукти', resultLabel: 'продукти' },
}

function normalizeKind(value) {
  return VALID_KINDS.has(value) ? value : 'all'
}

function itemAreas(item) {
  return [item.city, ...(item.serviceAreas || []), ...(item.deliveryAreas || [])]
    .map(value => String(value || '').trim())
    .filter(Boolean)
}

function itemMatchesFilters(item, { layer, city, query }) {
  if (layer !== 'all' && item.layer !== layer) return false
  if (city !== 'all' && !itemAreas(item).includes(city)) return false

  const needle = query.trim().toLowerCase()
  if (!needle) return true

  const haystack = [
    item.name,
    item.sub,
    item.city,
    item.tag,
    item.layerTitle,
    ...(item.serviceAreas || []),
    ...(item.deliveryAreas || []),
  ].filter(Boolean).join(' ').toLowerCase()

  return haystack.includes(needle)
}

export default function Catalog() {
  const { catalog: profileCatalog, layers } = useProfileDirectory()
  const [searchParams, setSearchParams] = useSearchParams()
  const [services, setServices] = useState([])
  const [servicesError, setServicesError] = useState('')
  const [q, setQ] = useState(() => searchParams.get('q') || '')
  const [layer, setLayer] = useState(() => searchParams.get('layer') || 'all')
  const [kind, setKind] = useState(() => normalizeKind(searchParams.get('kind')))
  const [city, setCity] = useState(() => searchParams.get('city') || 'all')

  useEffect(() => {
    let active = true
    async function loadServices() {
      try {
        const rows = await loadPublicPartnerServices()
        if (!active) return
        setServices(rows)
        setServicesError('')
      } catch (error) {
        if (!active) return
        setServices([])
        setServicesError(error.message || 'Услугите не се заредиха.')
      }
    }
    loadServices()
    return () => { active = false }
  }, [])

  const selectedLayer = useMemo(() => {
    if (layer === 'all') return null
    return layers.find(item => item.slug === layer) || null
  }, [layer, layers])

  useEffect(() => {
    if (layer !== 'all' && layers.length > 0 && !selectedLayer) {
      setLayer('all')
    }
  }, [layer, layers.length, selectedLayer])

  useEffect(() => {
    const params = new URLSearchParams()
    const search = q.trim()
    if (search) params.set('q', search)
    if (layer !== 'all') params.set('layer', layer)
    if (kind !== 'all') params.set('kind', kind)
    if (city !== 'all') params.set('city', city)
    setSearchParams(params, { replace: true })
  }, [city, kind, layer, q, setSearchParams])

  const all = useMemo(() => {
    const serviceItems = services.map((service) => {
      const layerInfo = layers.find(item => item.slug === service.layerSlug)
      return {
        kind: 'service',
        slug: service.slug,
        layer: service.layerSlug,
        layerNumber: layerInfo?.number || '',
        layerTitle: layerInfo?.title || '',
        name: service.title,
        sub: service.subtitle,
        city: service.profile?.city || '',
        deliveryAreas: service.deliveryAreas || [],
        price: packagePriceLabel(service),
        tag: service.tags.slice(0, 2).join(', '),
        service,
      }
    })
    return [...profileCatalog, ...serviceItems]
  }, [layers, profileCatalog, services])

  const availableCities = useMemo(() => {
    const cities = new Set()
    all.forEach(item => itemAreas(item).forEach(area => cities.add(area)))
    return Array.from(cities).sort((left, right) => left.localeCompare(right, 'bg'))
  }, [all])

  useEffect(() => {
    if (city !== 'all' && availableCities.length > 0 && !availableCities.includes(city)) {
      setCity('all')
    }
  }, [availableCities, city])

  const kindCounts = useMemo(() => {
    const counts = { all: 0, pro: 0, service: 0, product: 0 }
    all.forEach((item) => {
      if (!itemMatchesFilters(item, { layer, city, query: q })) return
      counts.all += 1
      if (counts[item.kind] !== undefined) counts[item.kind] += 1
    })
    return counts
  }, [all, city, layer, q])

  const filtered = useMemo(() => all.filter((item) => {
    if (!itemMatchesFilters(item, { layer, city, query: q })) return false
    if (kind !== 'all' && item.kind !== kind) return false
    return true
  }), [all, city, kind, layer, q])

  const selectedKind = KIND_COPY[kind] || KIND_COPY.all
  const hasActiveFilters = q.trim() || layer !== 'all' || kind !== 'all' || city !== 'all'
  const resetFilters = () => {
    setQ('')
    setLayer('all')
    setKind('all')
    setCity('all')
  }

  return (
    <>
      <section className="section !pt-20 bg-gradient-to-br from-soft to-cloud">
        <div className="container-page max-w-5xl reveal">
          <div className="eyebrow">{selectedLayer ? `Слой ${selectedLayer.number}` : 'Totsan marketplace'}</div>
          <h1 className="h-display mt-3">
            {selectedLayer ? `Marketplace за ${selectedLayer.title.toLowerCase()}.` : 'Намери правилните хора, услуги и продукти.'}
          </h1>
          <p className="mt-5 max-w-3xl text-muted" style={{fontSize:'var(--step-md)'}}>
            {selectedLayer
              ? 'Виж специалисти, готови услуги и продукти, които пасват на този етап. Филтрирай по тип, град или ключова дума и продължи към профил, пакет или продукт.'
              : 'Каталогът събира публични профили, одобрени партньорски услуги и продукти от петте слоя. Избери какво търсиш, после продължи към запитване, оферта или детайли.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm text-muted">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/70 px-3 py-1.5"><CheckCircle2 size={15} className="text-accentDeep" /> Публични профили</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/70 px-3 py-1.5"><BriefcaseBusiness size={15} className="text-accentDeep" /> Одобрени услуги</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/70 px-3 py-1.5"><PackageSearch size={15} className="text-accentDeep" /> Подбрани продукти</span>
          </div>
        </div>
      </section>

      <section className="section !pt-10">
        <div className="container-page">
          <div className="rounded-3xl border border-line bg-paper p-4 shadow-sm reveal">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative flex-1">
                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={q}
                  onChange={event => setQ(event.target.value)}
                  placeholder="Търси: архитект, плочки, Пловдив, монтаж..."
                  className="w-full rounded-full border border-line bg-soft py-3 pl-11 pr-4 text-sm outline-none transition focus:border-ink focus:bg-paper"
                />
              </label>
              <select value={layer} onChange={event => setLayer(event.target.value)} className="rounded-full border border-line bg-soft px-4 py-3 text-sm outline-none transition focus:border-ink focus:bg-paper">
                <option value="all">Всички слоеве</option>
                {layers.map(item => <option key={item.slug} value={item.slug}>{item.number} · {item.title}</option>)}
              </select>
              <select value={city} onChange={event => setCity(event.target.value)} className="rounded-full border border-line bg-soft px-4 py-3 text-sm outline-none transition focus:border-ink focus:bg-paper">
                <option value="all">Всички градове</option>
                {availableCities.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4 reveal overflow-x-auto pb-1">
            <div className="inline-flex max-w-full gap-2 rounded-full border border-line bg-paper p-1">
              {KIND_TABS.map((tab) => {
                const isActive = kind === tab.value
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setKind(tab.value)}
                    className={`whitespace-nowrap rounded-full px-4 py-2.5 text-left text-sm font-medium transition ${
                      isActive
                        ? 'bg-ink text-paper shadow-sm'
                        : 'text-muted hover:bg-soft hover:text-ink'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${isActive ? 'bg-paper/15 text-paper' : 'bg-soft text-muted'}`}>{kindCounts[tab.value] || 0}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3 reveal">
            <SummaryTile icon={UserRound} label="Специалисти" value={kindCounts.pro} />
            <SummaryTile icon={BriefcaseBusiness} label="Услуги" value={kindCounts.service} />
            <SummaryTile icon={PackageSearch} label="Продукти" value={kindCounts.product} />
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm reveal">
              {selectedLayer && (
                <FilterChip label={`Слой ${selectedLayer.number} · ${selectedLayer.title}`} onClear={() => setLayer('all')} />
              )}
              {kind !== 'all' && <FilterChip label={`Тип: ${selectedKind.label}`} onClear={() => setKind('all')} />}
              {city !== 'all' && <FilterChip label={`Град: ${city}`} onClear={() => setCity('all')} />}
              {q.trim() && <FilterChip label={`Търсене: ${q.trim()}`} onClear={() => setQ('')} />}
              <button type="button" onClick={resetFilters} className="inline-flex items-center gap-2 text-sm font-medium text-ink underline underline-offset-4">
                <SlidersHorizontal size={16} /> Изчисти всички
              </button>
            </div>
          )}

          {servicesError && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{servicesError}</div>}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted reveal">
            <span>{filtered.length} {selectedKind.resultLabel}</span>
            <span>{kind === 'all' ? 'Профил, пакет или продукт според нуждата' : (KIND_TABS.find(tab => tab.value === kind)?.helper || '')}</span>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <CatalogCard key={`${item.kind}-${item.slug || item.name}`} it={item} />
            ))}
            {filtered.length === 0 && (
              <EmptyCatalogState resetFilters={resetFilters} />
            )}
          </div>
        </div>
      </section>
    </>
  )
}

function SummaryTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-paper px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm text-muted"><Icon size={16} className="text-accentDeep" /> {label}</span>
        <span className="font-display text-2xl text-ink">{value}</span>
      </div>
    </div>
  )
}

function FilterChip({ label, onClear }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-soft px-3 py-1.5 text-ink">
      {label}
      <button type="button" onClick={onClear} className="rounded-full text-muted transition hover:text-ink" aria-label={`Премахни филтър ${label}`}>
        <X size={14} />
      </button>
    </span>
  )
}

function EmptyCatalogState({ resetFilters }) {
  return (
    <div className="col-span-full rounded-3xl border border-dashed border-line bg-paper p-10 text-center reveal">
      <h2 className="font-display text-3xl text-ink">Няма резултати за тези филтри.</h2>
      <p className="mx-auto mt-3 max-w-xl text-muted">
        Пробвай друг град, по-широк слой или по-кратка ключова дума. Ако не си сигурен какво търсиш, guided brief-ът ще те насочи.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={resetFilters} className="btn btn-primary">Изчисти филтрите</button>
        <Link to="/start" className="btn btn-ghost">Започни от brief</Link>
      </div>
    </div>
  )
}

function CatalogCard({ it }) {
  const isPro = it.kind === 'pro'
  const isService = it.kind === 'service'
  const to = isPro ? `/profil/${it.slug || slugify(it.name)}` : `/produkt/${slugify(it.name)}`
  if (isService) return <ServiceCatalogCard it={it} />
  const img = productImageFor(it.name, it.layer)
  if (isPro) {
    return (
      <ProfessionalCard
        person={{ slug: it.slug, name: it.name, tag: it.sub, city: it.city, rating: it.rating, projects: it.projects, since: it.since, bio: it.bio, imageUrl: it.imageUrl, imageZoom: it.imageZoom, imageX: it.imageX, imageY: it.imageY }}
        to={to}
        state={{ item: it }}
        layerLabel={`Слой ${it.layerNumber} · ${it.layerTitle}`}
        cta="Виж профил"
      />
    )
  }

  return (
    <Link to={to} state={{ item: it }} className="card reveal img-zoom-host block overflow-hidden bg-paper p-0">
      <div className="media-frame aspect-[16/10]">
        <img src={img} alt={it.name} loading="lazy" decoding="async" className="img-cover img-zoom" />
        <span className="absolute top-3 right-3 rounded-full bg-ink/90 px-2.5 py-1 text-xs text-paper backdrop-blur">
          Продукт
        </span>
      </div>
      <div className="p-6">
        <span className="text-xs text-muted">Слой {it.layerNumber} · {it.layerTitle}</span>
        <div className="mt-2 font-display text-xl text-ink">{it.name}</div>
        <div className="text-sm text-muted">{it.sub}{it.city ? ` · ${it.city}` : ''}</div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">{it.price}</span>
          <span className="truncate text-muted">{it.tag}</span>
        </div>
        <span className="btn btn-ghost mt-5 w-full justify-center">Виж продукт</span>
      </div>
    </Link>
  )
}

function ServiceCatalogCard({ it }) {
  const service = it.service
  const coverCandidates = getPartnerServiceCoverCandidates(service, service.profile)
  return (
    <Link to={`/uslugi/${service.slug}`} className="card reveal img-zoom-host block overflow-hidden bg-paper p-0">
      <div className="media-frame aspect-[16/10] bg-soft">
        <FallbackImage sources={coverCandidates} alt={service.title} loading="lazy" decoding="async" className="img-cover img-zoom" />
        <span className="absolute top-3 right-3 rounded-full bg-ink/90 px-2.5 py-1 text-xs text-paper backdrop-blur">
          Услуга
        </span>
      </div>
      <div className="p-6">
        <span className="text-xs text-muted">Слой {it.layerNumber} · {it.layerTitle}</span>
        <div className="mt-2 font-display text-xl text-ink">{service.title}</div>
        <div className="text-sm text-muted">{service.subtitle || service.profile?.name}</div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">{it.price}</span>
          <span className="truncate text-muted">{service.profile?.name}</span>
        </div>
        <div className="mt-3 flex items-center gap-1 text-xs text-muted">
          <MapPin size={14} /> {it.city || it.deliveryAreas?.[0] || 'По запитване'}
        </div>
        <span className="btn btn-ghost mt-5 w-full justify-center">Виж пакет</span>
      </div>
    </Link>
  )
}

function slugify(s) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
}
