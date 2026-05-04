import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProfileDirectory } from '../lib/profiles.js'
import { loadPublicPartnerServices, packagePriceLabel } from '../lib/partner-services.js'
import { productImageFor } from '../data/images.js'
import ProfessionalCard from '../components/ProfessionalCard.jsx'

export default function Catalog() {
  const { catalog: profileCatalog, layers } = useProfileDirectory()
  const [services, setServices] = useState([])
  const [servicesError, setServicesError] = useState('')
  const [q, setQ] = useState('')
  const [layer, setLayer] = useState('all')
  const [kind, setKind] = useState('all')

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
        price: packagePriceLabel(service),
        tag: service.tags.slice(0, 2).join(', '),
        service,
      }
    })
    return [...profileCatalog, ...serviceItems]
  }, [layers, profileCatalog, services])

  const filtered = useMemo(() => all.filter((it) => {
    if (layer !== 'all' && it.layer !== layer) return false
    if (kind !== 'all' && it.kind !== kind) return false
    if (q && !(it.name + ' ' + (it.sub || '') + ' ' + (it.city || '') + ' ' + (it.tag || '')).toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [all, kind, layer, q])

  return (
    <>
      <section className="section !pt-20 bg-gradient-to-br from-soft to-cloud">
        <div className="container-page max-w-4xl reveal">
          <div className="eyebrow">Каталог</div>
          <h1 className="h-display mt-3">Всичко на едно място.</h1>
          <p className="mt-5 text-muted" style={{fontSize:'var(--step-md)'}}>
            Хора, услуги, материали и продукти от всички пет слоя. Филтрирай по слой или вид. Търси по име, град или категория.
          </p>
        </div>
      </section>

      <section className="section !pt-10">
        <div className="container-page">
          <div className="flex flex-wrap gap-3 items-center reveal">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Търси: „архитект“, „плочки“, „Пловдив“…"
              className="flex-1 min-w-[16rem] px-4 py-3 rounded-full bg-paper border border-line focus:border-ink outline-none"
            />
            <select value={layer} onChange={e=>setLayer(e.target.value)} className="px-4 py-3 rounded-full bg-paper border border-line focus:border-ink outline-none">
              <option value="all">Всички слоеве</option>
              {layers.map(l => <option key={l.slug} value={l.slug}>{l.number} · {l.title}</option>)}
            </select>
            <select value={kind} onChange={e=>setKind(e.target.value)} className="px-4 py-3 rounded-full bg-paper border border-line focus:border-ink outline-none">
              <option value="all">Всичко</option>
              <option value="pro">Само специалисти</option>
              <option value="service">Само услуги</option>
              <option value="product">Само продукти</option>
            </select>
          </div>

          {servicesError && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{servicesError}</div>}

          <div className="mt-6 text-sm text-muted reveal">{filtered.length} резултата</div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((it, i) => (
              <CatalogCard key={i} it={it} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full border border-dashed border-line rounded-2xl p-10 text-center text-muted">
                Няма резултати. Опитай с друга дума или махни филтрите.
              </div>
            )}
          </div>
        </div>
      </section>
    </>
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
      />
    )
  }

  return (
    <Link to={to} state={{ item: it }} className="card reveal img-zoom-host p-0 bg-paper block overflow-hidden">
      <div className="media-frame aspect-[16/10]">
        <img src={img} alt={it.name} loading="lazy" decoding="async" className="img-cover img-zoom" />
        <span className="absolute top-3 right-3 rounded-full bg-ink/90 px-2.5 py-1 text-xs text-paper backdrop-blur">
          Продукт
        </span>
      </div>
      <div className="p-6">
        <span className="text-xs text-muted">Слой {it.layerNumber} · {it.layerTitle}</span>
        <div className="font-display text-xl mt-2">{it.name}</div>
        <div className="text-sm text-muted">{it.sub}{it.city ? ` · ${it.city}` : ''}</div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <>
            <span className="font-medium">{it.price}</span>
            <span className="text-muted">{it.tag}</span>
          </>
        </div>
      </div>
    </Link>
  )
}

function ServiceCatalogCard({ it }) {
  const service = it.service
  const img = service.coverUrl || service.media?.[0]?.url || service.profile?.image_url || ''
  return (
    <Link to={`/uslugi/${service.slug}`} className="card reveal img-zoom-host p-0 bg-paper block overflow-hidden">
      <div className="media-frame aspect-[16/10] bg-soft">
        {img ? <img src={img} alt={service.title} loading="lazy" decoding="async" className="img-cover img-zoom" /> : null}
        <span className="absolute top-3 right-3 rounded-full bg-ink/90 px-2.5 py-1 text-xs text-paper backdrop-blur">
          Услуга
        </span>
      </div>
      <div className="p-6">
        <span className="text-xs text-muted">Слой {it.layerNumber} · {it.layerTitle}</span>
        <div className="font-display text-xl mt-2">{service.title}</div>
        <div className="text-sm text-muted">{service.subtitle || service.profile?.name}</div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">{it.price}</span>
          <span className="truncate text-muted">{service.profile?.name}</span>
        </div>
      </div>
    </Link>
  )
}

function slugify(s) {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
}
