import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, CheckCircle2, MapPin, PackageSearch, Search, SlidersHorizontal, UserRound, X } from 'lucide-react'
import { useProfileDirectory } from '../lib/profiles.js'
import { loadPublicPartnerServices, packagePriceLabel } from '../lib/partner-services.js'
import { loadPublicPortfolioCounts } from '../lib/portfolio.js'
import { productImageFor } from '../data/images.js'
import { productSlugFor } from '../lib/product-metadata.js'
import { buildMaterialSolutionItems, loadPublicMaterialCapabilities } from '../lib/partner-materials.js'
import FallbackImage from '../components/FallbackImage.jsx'
import ProfessionalCard from '../components/ProfessionalCard.jsx'
import { formatMoney, formatMoneyText, normalizeMoneyValue } from '../lib/money.js'
import { getPartnerServiceCoverCandidates } from '../lib/service-media.js'
import { trackEvent } from '../lib/analytics.js'
import { buildBreadcrumbSchema, useSeo } from '../lib/seo.js'

const VALID_KINDS = new Set(['all', 'pro', 'service', 'material'])
const KIND_TABS = [
  { value: 'all', label: 'Всичко', helper: 'Целият marketplace' },
  { value: 'pro', label: 'Специалисти', helper: 'Профили за запитване' },
  { value: 'service', label: 'Услуги', helper: 'Пакети и оферти' },
  { value: 'material', label: 'Материали', helper: 'Материали, марки и решения' },
]

const KIND_COPY = {
  all: { label: 'Всичко', resultLabel: 'резултата' },
  pro: { label: 'Специалисти', resultLabel: 'специалисти' },
  service: { label: 'Услуги', resultLabel: 'услуги' },
  material: { label: 'Материали', resultLabel: 'материали' },
}

const SECTION_LIMITS = {
  pro: 4,
  service: 3,
  material: 6,
}

function normalizeKind(value) {
  if (value === 'product') return 'material'
  return VALID_KINDS.has(value) ? value : 'all'
}

function itemAreas(item) {
  return [item.city, ...(item.serviceAreas || []), ...(item.deliveryAreas || [])]
    .map(value => String(value || '').trim())
    .filter(Boolean)
}

function buildServiceInsightsByProfile(services = []) {
  const byProfile = new Map()

  services.forEach((service) => {
    const profileId = service.profileId || service.profile?.id
    if (!profileId) return

    const current = byProfile.get(profileId) || {
      count: 0,
      titles: [],
      prices: [],
    }

    current.count += 1
    if (service.title) current.titles.push(service.title)

    const price = normalizeMoneyValue(service.lowestPrice)
    if (price !== null) current.prices.push(price)

    byProfile.set(profileId, current)
  })

  byProfile.forEach((value) => {
    const averagePrice = value.prices.length
      ? Math.round(value.prices.reduce((sum, price) => sum + price, 0) / value.prices.length)
      : 0
    value.averagePrice = averagePrice
    value.priceGuide = averagePrice ? `Среден старт ${formatMoney(averagePrice, 'EUR')}` : ''
    value.titles = Array.from(new Set(value.titles)).slice(0, 3)
  })

  return byProfile
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
    item.categoryLabel,
    item.brandLabel,
    item.source === 'partner_capability' ? 'партньор материал марка' : '',
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
  const [materialCapabilities, setMaterialCapabilities] = useState([])
  const [portfolioCounts, setPortfolioCounts] = useState({})
  const [materialsError, setMaterialsError] = useState('')
  const [q, setQ] = useState(() => searchParams.get('q') || '')
  const [layer, setLayer] = useState(() => searchParams.get('layer') || 'all')
  const [kind, setKind] = useState(() => normalizeKind(searchParams.get('kind')))
  const [city, setCity] = useState(() => searchParams.get('city') || 'all')
  const filterTelemetryRef = useRef({ mounted: false, key: '' })

  useEffect(() => {
    let active = true
    async function loadMarketplaceData() {
      try {
        const [serviceRows, capabilityRows, portfolioCountRows] = await Promise.all([
          loadPublicPartnerServices(),
          loadPublicMaterialCapabilities(),
          loadPublicPortfolioCounts().catch(() => ({})),
        ])
        if (!active) return
        setServices(serviceRows)
        setMaterialCapabilities(capabilityRows)
        setPortfolioCounts(portfolioCountRows)
        setServicesError('')
        setMaterialsError('')
      } catch (error) {
        if (!active) return
        setServices([])
        setMaterialCapabilities([])
        setPortfolioCounts({})
        setServicesError(error.message || 'Marketplace данните не се заредиха.')
        setMaterialsError(error.message || 'Материалите не се заредиха.')
      }
    }
    loadMarketplaceData()
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
    const servicesByProfile = buildServiceInsightsByProfile(services)
    const profileItems = profileCatalog.map((profile) => ({
      ...profile,
      serviceCount: servicesByProfile.get(profile.id)?.count || 0,
      serviceTitles: servicesByProfile.get(profile.id)?.titles || [],
      averageServicePrice: servicesByProfile.get(profile.id)?.averagePrice || 0,
      priceGuide: servicesByProfile.get(profile.id)?.priceGuide || profile.pricingNote || '',
      portfolioCount: portfolioCounts[profile.id] || 0,
    }))
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
    const materialItems = buildMaterialSolutionItems({
      templates: [],
      capabilities: materialCapabilities,
      layers,
    })
    return [...profileItems, ...serviceItems, ...materialItems]
  }, [layers, materialCapabilities, portfolioCounts, profileCatalog, services])

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

  const baseFiltered = useMemo(() => all.filter(item => itemMatchesFilters(item, { layer, city, query: q })), [all, city, layer, q])

  const professionals = useMemo(() => baseFiltered.filter(item => item.kind === 'pro'), [baseFiltered])
  const serviceResults = useMemo(() => baseFiltered.filter(item => item.kind === 'service'), [baseFiltered])
  const materialResults = useMemo(() => baseFiltered.filter(item => item.kind === 'material'), [baseFiltered])

  const kindCounts = useMemo(() => {
    const counts = { all: 0, pro: 0, service: 0, material: 0 }
    baseFiltered.forEach((item) => {
      counts.all += 1
      if (counts[item.kind] !== undefined) counts[item.kind] += 1
    })
    return counts
  }, [baseFiltered])

  const filtered = useMemo(() => {
    if (kind === 'all') return baseFiltered
    return baseFiltered.filter(item => item.kind === kind)
  }, [baseFiltered, kind])

  const selectedKind = KIND_COPY[kind] || KIND_COPY.all
  const hasActiveFilters = q.trim() || layer !== 'all' || kind !== 'all' || city !== 'all'

  useSeo({
    title: selectedLayer
      ? `Каталог за ${selectedLayer.title.toLowerCase()} | Totsan`
      : kind !== 'all'
        ? `${selectedKind.label} в каталога | Totsan`
        : 'Каталог със специалисти, услуги и материали | Totsan',
    description: selectedLayer
      ? `Разгледай публични профили, услуги и материални решения за Слой ${selectedLayer.number} · ${selectedLayer.title}.`
      : 'Каталогът на Totsan събира публични профили, партньорски услуги и материали за петте слоя на проекта.',
    canonicalPath: '/katalog',
    jsonLd: [
      buildBreadcrumbSchema([
        { name: 'Начало', path: '/' },
        { name: 'Каталог', path: '/katalog' },
      ]),
    ],
  })

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextKey = `${q.trim()}|${layer}|${city}`
      if (!filterTelemetryRef.current.mounted) {
        filterTelemetryRef.current = { mounted: true, key: nextKey }
        return
      }

      if (filterTelemetryRef.current.key === nextKey) return
      filterTelemetryRef.current.key = nextKey

      trackEvent('apply_catalog_filter', {
        layer: layer !== 'all' ? layer : undefined,
        city: city !== 'all' ? city : undefined,
        has_query: q.trim() ? 'yes' : 'no',
      })
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [city, layer, q])

  const resetFilters = () => {
    setQ('')
    setLayer('all')
    setKind('all')
    setCity('all')
  }

  return (
    <>
      <section className="section !pt-10 !pb-10 bg-gradient-to-br from-soft to-cloud">
        <div className="container-page max-w-5xl reveal">
          <div className="eyebrow">{selectedLayer ? `Слой ${selectedLayer.number}` : 'Totsan marketplace'}</div>
          <h1 className="h-display mt-3">
            {selectedLayer ? `Marketplace за ${selectedLayer.title.toLowerCase()}.` : 'Намери правилните хора, услуги и материали.'}
          </h1>
          <p className="mt-5 max-w-3xl text-muted" style={{fontSize:'var(--step-md)'}}>
            {selectedLayer
              ? 'Виж специалисти, готови услуги и материални решения, които пасват на този етап. Филтрирай по тип, град или ключова дума и продължи към профил, пакет или запитване.'
              : 'Каталогът събира публични профили, одобрени партньорски услуги и материали от петте слоя. Избери какво търсиш, после продължи към запитване, оферта или детайли.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm text-muted">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/70 px-3 py-1.5"><CheckCircle2 size={15} className="text-accentDeep" /> Публични профили</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/70 px-3 py-1.5"><BriefcaseBusiness size={15} className="text-accentDeep" /> Одобрени услуги</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/70 px-3 py-1.5"><PackageSearch size={15} className="text-accentDeep" /> Материали и марки</span>
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
            <div className="flex w-full min-w-max gap-2 rounded-full border border-line bg-paper p-1">
              {KIND_TABS.map((tab) => {
                const isActive = kind === tab.value
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => {
                      if (kind === tab.value) return
                      setKind(tab.value)
                      trackEvent('select_catalog_tab', { tab: tab.value })
                    }}
                    className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-left text-sm font-medium transition ${
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
            <SummaryTile icon={PackageSearch} label="Материали" value={kindCounts.material} />
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
            <span>{kind === 'all' ? 'Разделено по типове за по-лесен избор' : (KIND_TABS.find(tab => tab.value === kind)?.helper || '')}</span>
          </div>

          {kind === 'all' ? (
            <MarketplaceSections
              professionals={professionals}
              services={serviceResults}
              materials={materialResults}
              onSelectKind={setKind}
              resetFilters={resetFilters}
            />
          ) : (
            <CatalogGrid items={filtered} resetFilters={resetFilters} />
          )}
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

function MarketplaceSections({ professionals, services, materials, onSelectKind, resetFilters }) {
  const hasAnyResults = professionals.length || services.length || materials.length
  if (!hasAnyResults) {
    return (
      <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <EmptyCatalogState resetFilters={resetFilters} />
      </div>
    )
  }

  return (
    <div className="mt-8 space-y-12">
      {professionals.length > 0 && (
        <MarketplaceSection
          eyebrow="Профили"
          title="Избрани специалисти"
          count={`${professionals.length} специалисти`}
          actionLabel="Виж всички специалисти"
          onAction={() => onSelectKind('pro')}
        >
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {professionals.slice(0, SECTION_LIMITS.pro).map((item) => (
              <CatalogCard key={`featured-${item.kind}-${item.slug || item.name}`} it={item} />
            ))}
          </div>
        </MarketplaceSection>
      )}

      {services.length > 0 && (
        <MarketplaceSection
          eyebrow="Пакети"
          title="Услуги и пакети"
          count={`${services.length} услуги`}
          actionLabel="Виж всички услуги"
          onAction={() => onSelectKind('service')}
        >
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {services.slice(0, SECTION_LIMITS.service).map((item) => (
              <CatalogCard key={`featured-${item.kind}-${item.slug || item.name}`} it={item} />
            ))}
          </div>
        </MarketplaceSection>
      )}

      {materials.length > 0 && (
        <MarketplaceSection
          eyebrow="Материали"
          title="Материали, марки и решения"
          count={`${materials.length} материала`}
          actionLabel="Виж всички материали"
          onAction={() => onSelectKind('material')}
        >
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {materials.slice(0, SECTION_LIMITS.material).map((item) => (
              <CatalogCard key={`featured-${item.kind}-${item.slug || item.name}`} it={item} />
            ))}
          </div>
        </MarketplaceSection>
      )}
    </div>
  )
}

function MarketplaceSection({ eyebrow, title, count, actionLabel, onAction, children }) {
  return (
    <section className="reveal">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="font-display text-3xl text-ink md:text-4xl">{title}</h2>
          <p className="mt-2 text-sm text-muted">{count}</p>
        </div>
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium text-ink transition hover:border-ink"
        >
          {actionLabel}
          <ArrowRight size={16} />
        </button>
      </div>
      {children}
    </section>
  )
}

function CatalogGrid({ items, resetFilters }) {
  return (
    <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <CatalogCard key={`${item.kind}-${item.slug || item.name}`} it={item} />
      ))}
      {items.length === 0 && (
        <EmptyCatalogState resetFilters={resetFilters} />
      )}
    </div>
  )
}

function CatalogCard({ it }) {
  const isPro = it.kind === 'pro'
  const isService = it.kind === 'service'
  const isMaterial = it.kind === 'material'
  const to = isPro ? `/profil/${it.slug || slugify(it.name)}` : `/produkt/${it.slug || productSlugFor(it.name)}`
  if (isService) return <ServiceCatalogCard it={it} />
  if (isMaterial) return <MaterialCatalogCard it={it} to={to} />
  const img = productImageFor(it.name, it.layer)
  if (isPro) {
    return (
      <ProfessionalCard
        person={it}
        to={to}
        state={{ item: it }}
        layerLabel={`Слой ${it.layerNumber} · ${it.layerTitle}`}
        cta="Виж профила"
      />
    )
  }

  return (
    <Link to={to} state={{ item: it }} className="card reveal img-zoom-host flex h-full min-h-[28rem] flex-col overflow-hidden bg-paper p-0">
      <div className="media-frame aspect-[16/10]">
        <img src={img} alt={it.name} loading="lazy" decoding="async" className="img-cover img-zoom" />
        <span className="absolute top-3 right-3 rounded-full bg-ink/90 px-2.5 py-1 text-xs text-paper backdrop-blur">
          Материал
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <span className="text-xs text-muted">Слой {it.layerNumber} · {it.layerTitle}</span>
        <div className="mt-2 font-display text-xl text-ink">{it.name}</div>
        <div className="text-sm text-muted">{it.sub}{it.city ? ` · ${it.city}` : ''}</div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">{formatMoneyText(it.price)}</span>
          <span className="truncate text-muted">{it.tag}</span>
        </div>
        <div className="mt-auto pt-5">
          <span className="btn btn-ghost w-full justify-center">Виж материал</span>
        </div>
      </div>
    </Link>
  )
}

function MaterialCatalogCard({ it, to }) {
  const img = productImageFor(it.name || it.categoryLabel, it.layer)
  const hasPartners = Number(it.partnerCount || 0) > 0

  return (
    <Link to={to} state={{ item: it }} className="card reveal img-zoom-host flex h-full min-h-[28rem] flex-col overflow-hidden bg-paper p-0">
      <div className="media-frame aspect-[16/10]">
        <img src={img} alt={it.name} loading="lazy" decoding="async" className="img-cover img-zoom" />
        <span className="absolute top-3 right-3 rounded-full bg-ink/90 px-2.5 py-1 text-xs text-paper backdrop-blur">
          Материал
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <span className="text-xs text-muted">Слой {it.layerNumber} · {it.layerTitle}</span>
        <div className="mt-2 font-display text-xl text-ink">{it.brandLabel || it.name}</div>
        <div className="text-sm text-muted">{it.categoryLabel || it.sub}</div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-line bg-soft px-3 py-1 text-muted">
            {it.source === 'partner_capability' ? 'От партньорски данни' : 'Ориентировъчна категория'}
          </span>
          <span className={`rounded-full border px-3 py-1 ${hasPartners ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-line bg-soft text-muted'}`}>
            {hasPartners ? `${it.partnerCount} партньор${it.partnerCount === 1 ? '' : 'и'}` : 'Очаква партньори'}
          </span>
        </div>
        {it.tag && <p className="mt-4 line-clamp-2 text-sm text-muted">{it.tag}</p>}
        <div className="mt-auto pt-5">
          <span className="btn btn-ghost w-full justify-center">{hasPartners ? 'Виж партньори' : 'Попитай за материала'}</span>
        </div>
      </div>
    </Link>
  )
}

function ServiceCatalogCard({ it }) {
  const service = it.service
  const coverCandidates = getPartnerServiceCoverCandidates(service, service.profile)
  return (
    <Link to={`/uslugi/${service.slug}`} className="card reveal img-zoom-host flex h-full min-h-[28rem] flex-col overflow-hidden bg-paper p-0">
      <div className="media-frame aspect-[16/10] bg-soft">
        <FallbackImage sources={coverCandidates} alt={service.title} loading="lazy" decoding="async" className="img-cover img-zoom" />
        <span className="absolute top-3 right-3 rounded-full bg-ink/90 px-2.5 py-1 text-xs text-paper backdrop-blur">
          Услуга
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <span className="text-xs text-muted">Слой {it.layerNumber} · {it.layerTitle}</span>
        <div className="mt-2 font-display text-xl text-ink">{service.title}</div>
        <div className="text-sm text-muted">{service.subtitle || service.profile?.name}</div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">{formatMoneyText(it.price)}</span>
          <span className="truncate text-muted">{service.profile?.name}</span>
        </div>
        <div className="mt-3 flex items-center gap-1 text-xs text-muted">
          <MapPin size={14} /> {it.city || it.deliveryAreas?.[0] || 'По запитване'}
        </div>
        <div className="mt-auto pt-5">
          <span className="btn btn-ghost w-full justify-center">Виж пакет</span>
        </div>
      </div>
    </Link>
  )
}

function slugify(s) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
}
