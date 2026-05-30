import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, MapPin, Search, SlidersHorizontal, UserRound } from 'lucide-react'
import { useProfileDirectory } from '../lib/profiles.js'
import { loadPublicPartnerServices, packagePriceLabel } from '../lib/partner-services.js'

export default function Services() {
  const { layers } = useProfileDirectory()
  const [services, setServices] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [layer, setLayer] = useState('all')

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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return services.filter((service) => {
      if (layer !== 'all' && service.layerSlug !== layer) return false
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
  }, [layer, query, services])

  const partnerCount = useMemo(() => {
    return new Set(services.map(service => service.profileId).filter(Boolean)).size
  }, [services])

  return (
    <>
      <section className="section !pt-20 bg-gradient-to-br from-soft to-cloud">
        <div className="container-page max-w-5xl reveal">
          <div className="eyebrow">Услуги</div>
          <h1 className="h-display mt-3">Реални услуги от партньори в Totsan.</h1>
          <p className="mt-5 max-w-3xl text-muted" style={{ fontSize: 'var(--step-md)' }}>
            Тук се виждат само публикувани партньорски услуги. Старите демо категории вече не се показват като реални оферти.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <StatTile icon={BriefcaseBusiness} label="Публикувани услуги" value={services.length} />
            <StatTile icon={UserRound} label="Партньори" value={partnerCount} />
            <StatTile icon={SlidersHorizontal} label="Филтри" value={layers.length} />
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
                  className="w-full rounded-2xl border border-line bg-soft py-3 pl-11 pr-4 text-sm outline-none transition focus:border-ink focus:bg-paper"
                />
              </label>
              <select
                value={layer}
                onChange={event => setLayer(event.target.value)}
                className="rounded-2xl border border-line bg-soft px-4 py-3 text-sm outline-none transition focus:border-ink focus:bg-paper"
              >
                <option value="all">Всички слоеве</option>
                {layers.map(item => <option key={item.slug} value={item.slug}>Слой {item.number} · {item.title}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted reveal">
            <span>{status === 'loading' ? 'Зареждаме услугите…' : `${filtered.length} резултата`}</span>
            <Link to="/katalog" className="inline-flex items-center gap-2 font-medium text-ink hover:underline">
              Виж и каталога <ArrowRight size={16} />
            </Link>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(service => (
              <ServiceCard key={service.id} service={service} layers={layers} />
            ))}
          </div>

          {status !== 'loading' && filtered.length === 0 && (
            <div className="mt-6 rounded-3xl border border-dashed border-line bg-paper p-10 text-center reveal">
              <h2 className="font-display text-3xl text-ink">Няма публикувани услуги тук.</h2>
              <p className="mx-auto mt-3 max-w-xl text-muted">
                Ако току-що си публикувал услуга като партньор, провери дали профилът и услугата са активни, после опресни страницата.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link to="/moy-profil" className="btn btn-primary">Към моя профил</Link>
                <Link to="/katalog" className="btn btn-ghost">Към каталога</Link>
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
              Детайли <ArrowRight size={16} />
            </span>
          </div>
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
