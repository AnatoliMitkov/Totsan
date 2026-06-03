import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, CheckCircle2, MapPin, Search, ShieldCheck, SlidersHorizontal, UserRound, X } from 'lucide-react'
import { useProfileDirectory } from '../lib/profiles.js'
import { loadPublicPartnerServices, packagePriceLabel } from '../lib/partner-services.js'

function serviceAreas(service) {
  return [service.profile?.city, ...(service.deliveryAreas || [])]
    .map(value => String(value || '').trim())
    .filter(Boolean)
}

export default function Services() {
  const { layers } = useProfileDirectory()
  const [services, setServices] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [layer, setLayer] = useState('all')
  const [city, setCity] = useState('all')

  useEffect(() => {
    let active = true

    async function loadServices() {
      setStatus('loading')
      setError('')
      try {
        const rows = await loadPublicPartnerServices()
        if (!active) return
        setServices(rows)
        setStatus('ready')
      } catch (loadError) {
        if (!active) return
        setServices([])
        setStatus('error')
        setError(loadError.message || 'Услугите не можаха да се заредят.')
      }
    }

    loadServices()
    return () => { active = false }
  }, [])

  const availableCities = useMemo(() => {
    const cities = new Set()
    services.forEach(service => serviceAreas(service).forEach(area => cities.add(area)))
    return Array.from(cities).sort((left, right) => left.localeCompare(right, 'bg'))
  }, [services])

  useEffect(() => {
    if (city !== 'all' && availableCities.length > 0 && !availableCities.includes(city)) {
      setCity('all')
    }
  }, [availableCities, city])

  const selectedLayer = useMemo(() => {
    if (layer === 'all') return null
    return layers.find(item => item.slug === layer) || null
  }, [layer, layers])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return services.filter((service) => {
      if (layer !== 'all' && service.layerSlug !== layer) return false
      if (city !== 'all' && !serviceAreas(service).includes(city)) return false
      if (!needle) return true
      const haystack = [
        service.title,
        service.subtitle,
        service.descriptionMd,
        service.tags.join(' '),
        service.deliveryAreas.join(' '),
        service.profile?.name,
        service.profile?.city,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(needle)
    })
  }, [city, layer, query, services])

  const partnerCount = useMemo(() => {
    return new Set(services.map(service => service.profileId).filter(Boolean)).size
  }, [services])

  const hasActiveFilters = query.trim() || layer !== 'all' || city !== 'all'
  const resetFilters = () => {
    setQuery('')
    setLayer('all')
    setCity('all')
  }

  return (
    <>
      <section className="section !pt-20 bg-gradient-to-br from-soft to-cloud">
        <div className="container-page max-w-5xl reveal">
          <div className="eyebrow">Услуги и пакети</div>
          <h1 className="h-display mt-3">Пакетирани услуги от партньори в Totsan.</h1>
          <p className="mt-5 max-w-3xl text-muted" style={{ fontSize: 'var(--step-md)' }}>
            Тук виждаш конкретни услуги с ясен обхват, партньор и цена. Ако пакетът пасва, можеш да поръчаш директно от детайлната страница; ако има неясноти, първо задай въпрос.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm text-muted">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/70 px-3 py-1.5"><CheckCircle2 size={15} className="text-accentDeep" /> Одобрени услуги</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/70 px-3 py-1.5"><BriefcaseBusiness size={15} className="text-accentDeep" /> Ясен обхват</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/70 px-3 py-1.5"><ShieldCheck size={15} className="text-accentDeep" /> Защитено плащане при checkout</span>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <StatTile icon={BriefcaseBusiness} label="Публикувани пакети" value={services.length} />
            <StatTile icon={UserRound} label="Партньори" value={partnerCount} />
            <StatTile icon={SlidersHorizontal} label="Слоеве" value={layers.length} />
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
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Търси услуга, партньор, град или ключова дума"
                  className="w-full rounded-full border border-line bg-soft py-3 pl-11 pr-4 text-sm outline-none transition focus:border-ink focus:bg-paper"
                />
              </label>
              <select
                value={layer}
                onChange={event => setLayer(event.target.value)}
                className="rounded-full border border-line bg-soft px-4 py-3 text-sm outline-none transition focus:border-ink focus:bg-paper"
              >
                <option value="all">Всички слоеве</option>
                {layers.map(item => <option key={item.slug} value={item.slug}>Слой {item.number} · {item.title}</option>)}
              </select>
              <select
                value={city}
                onChange={event => setCity(event.target.value)}
                className="rounded-full border border-line bg-soft px-4 py-3 text-sm outline-none transition focus:border-ink focus:bg-paper"
              >
                <option value="all">Всички градове</option>
                {availableCities.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm reveal">
              {selectedLayer && <FilterChip label={`Слой ${selectedLayer.number} · ${selectedLayer.title}`} onClear={() => setLayer('all')} />}
              {city !== 'all' && <FilterChip label={`Град: ${city}`} onClear={() => setCity('all')} />}
              {query.trim() && <FilterChip label={`Търсене: ${query.trim()}`} onClear={() => setQuery('')} />}
              <button type="button" onClick={resetFilters} className="inline-flex items-center gap-2 text-sm font-medium text-ink underline underline-offset-4">
                <SlidersHorizontal size={16} /> Изчисти всички
              </button>
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted reveal">
            <span>{status === 'loading' ? 'Зареждаме услугите…' : `${filtered.length} пакета`}</span>
            <Link to="/katalog?kind=service" className="inline-flex items-center gap-2 font-medium text-ink hover:underline">
              Виж услугите в каталога <ArrowRight size={16} />
            </Link>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(service => (
              <ServiceCard key={service.id} service={service} layers={layers} />
            ))}
          </div>

          {status !== 'loading' && filtered.length === 0 && (
            <div className="mt-6 rounded-3xl border border-dashed border-line bg-paper p-10 text-center reveal">
              <h2 className="font-display text-3xl text-ink">Няма услуги за тези филтри.</h2>
              <p className="mx-auto mt-3 max-w-xl text-muted">
                Разшири търсенето или започни с краткия brief, ако още не знаеш кой пакет или специалист ти трябва.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={resetFilters} className="btn btn-primary">Изчисти филтрите</button>
                <Link to="/start" className="btn btn-ghost">Започни от brief</Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-paper/80 p-4 backdrop-blur">
      <Icon size={18} className="text-accentDeep" />
      <div className="mt-3 text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 font-display text-3xl text-ink">{value}</div>
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

function ServiceCard({ service, layers }) {
  const layerInfo = layers.find(item => item.slug === service.layerSlug)
  const cover = service.coverUrl || service.media?.[0]?.url || service.profile?.image_url || ''
  const partnerName = service.profile?.name || 'Партньор в Totsan'
  const city = service.profile?.city || service.deliveryAreas[0] || ''

  return (
    <article className="card reveal overflow-hidden bg-paper p-0">
      <Link to={`/uslugi/${service.slug}`} className="group block">
        <div className="media-frame aspect-[16/10] bg-soft">
          {cover ? <img src={cover} alt={service.title} loading="lazy" decoding="async" className="img-cover img-zoom" /> : null}
          <span className="absolute left-3 top-3 rounded-full bg-paper/90 px-3 py-1 text-xs text-ink backdrop-blur">
            {layerInfo ? `Слой ${layerInfo.number}` : 'Услуга'}
          </span>
          <span className="absolute right-3 top-3 rounded-full bg-ink/90 px-3 py-1 text-xs text-paper backdrop-blur">
            Пакет
          </span>
        </div>
        <div className="p-5">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">{layerInfo?.title || 'Партньорска услуга'}</div>
          <h2 className="mt-2 font-display text-2xl leading-tight text-ink group-hover:underline">{service.title}</h2>
          {service.subtitle && <p className="mt-2 line-clamp-2 text-sm text-muted">{service.subtitle}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {service.tags.slice(0, 3).map(tag => <span key={tag} className="rounded-full bg-soft px-3 py-1 text-xs text-muted">{tag}</span>)}
          </div>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.14em] text-muted">Цена</div>
              <div className="font-display text-2xl text-ink">{packagePriceLabel(service)}</div>
            </div>
            <span className="inline-flex items-center gap-2 text-sm font-medium text-ink">
              Виж пакета <ArrowRight size={16} />
            </span>
          </div>
          <p className="mt-3 text-xs text-muted">На детайлната страница можеш да поръчаш директно или да попиташ първо.</p>
        </div>
      </Link>
      <div className="border-t border-line px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">{partnerName}</div>
            {city && <div className="mt-1 inline-flex items-center gap-1 text-muted"><MapPin size={14} /> {city}</div>}
          </div>
          {service.profile?.slug && (
            <Link to={`/profil/${service.profile.slug}`} className="font-medium text-ink underline underline-offset-4">
              Профил
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
