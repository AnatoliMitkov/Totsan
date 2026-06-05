import { Link, useLocation, useParams } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { productImageFor, SHOWCASE_IMAGES } from '../data/images.js'
import { getProfileImage, getProfileImageStyle, slugify, useProfileDirectory } from '../lib/profiles.js'
import { formatMoneyText } from '../lib/money.js'
import {
  buildProductPartnerRecommendations,
  loadPublicMaterialCapabilitiesForProduct,
} from '../lib/partner-materials.js'
import { findStaticProductBySlug, normalizeProductItem } from '../lib/product-metadata.js'
import { getPageLocation, trackEvent, trackPageView } from '../lib/analytics.js'
import { buildBreadcrumbSchema, useSeo } from '../lib/seo.js'

export default function Product() {
  const { state } = useLocation()
  const { slug } = useParams()
  const { catalog, layers } = useProfileDirectory()
  const [capabilities, setCapabilities] = useState([])
  const trackedProductSlugRef = useRef('')
  const productPath = slug ? `/produkt/${slug}` : '/katalog'

  const item = useMemo(() => {
    if (state?.item?.kind === 'product') return normalizeProductItem(state.item)
    return findStaticProductBySlug(slug) || normalizeProductItem(catalog.find(c => c.kind === 'product' && (c.slug === slug || slugify(c.name) === slug)) || {})
  }, [catalog, state, slug])

  const hasProduct = Boolean(item?.name)
  const layer = layers.find(l => l.slug === (item.layerSlug || item.layer))
  const recommendations = useMemo(() => {
    if (!hasProduct || !layer) return []
    return buildProductPartnerRecommendations({
      product: item,
      capabilities,
      fallbackProfessionals: layer.professionals || [],
      limit: 3,
    })
  }, [capabilities, hasProduct, item, layer])

  useEffect(() => {
    if (!hasProduct) return undefined
    let active = true
    async function loadCapabilities() {
      try {
        const rows = await loadPublicMaterialCapabilitiesForProduct(item)
        if (!active) return
        setCapabilities(rows)
      } catch {
        if (!active) return
        setCapabilities([])
      }
    }
    loadCapabilities()
    return () => { active = false }
  }, [hasProduct, item])

  const seoConfig = useMemo(() => {
    if (!slug) return null
    if (hasProduct && layer) {
      const description = item.sub
        ? `${item.name} в категория ${item.sub}${layer ? ` за Слой ${layer.number} · ${layer.title}` : ''}.`
        : `${item.name} е продуктова страница в Totsan.`

      return {
        title: `${item.name} | Totsan`,
        description,
        canonicalPath: productPath,
        jsonLd: [
          buildBreadcrumbSchema([
            { name: 'Начало', path: '/' },
            { name: 'Каталог', path: '/katalog' },
            { name: item.name, path: productPath },
          ]),
        ],
      }
    }

    return {
      title: 'Продуктът не е намерен | Totsan',
      description: 'Този продукт не е наличен или линкът е невалиден.',
      canonicalPath: productPath,
      robots: 'noindex, nofollow',
    }
  }, [hasProduct, item.name, item.sub, layer, productPath, slug])

  useSeo(seoConfig)

  useEffect(() => {
    if (!hasProduct || !layer || !item.slug || !seoConfig?.title) return
    if (trackedProductSlugRef.current === item.slug) return

    trackedProductSlugRef.current = item.slug
    trackPageView({
      pagePath: productPath,
      pageTitle: seoConfig.title,
      pageLocation: getPageLocation(productPath),
    })
    trackEvent('view_product', {
      product_slug: item.slug,
      layer: layer.slug,
      category: item.categorySlug || undefined,
    })
  }, [hasProduct, item.slug, layer, productPath, seoConfig?.title])

  if (!hasProduct || !layer) return <NotFound />
  const layerSlug = item.layerSlug || item.layer

  return (
    <>
      <section className="section !pt-20 bg-soft border-b border-line">
        <div className="container-page reveal">
          <Link to="/katalog" className="eyebrow !text-ink/70 hover:!text-ink">← Обратно в каталога</Link>
        </div>
      </section>

      <section className="section">
        <div className="container-page grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 reveal">
            <div className="rounded-3xl overflow-hidden border border-line img-zoom-host">
              <div className="media-frame aspect-[4/3] no-shade">
                <img src={productImageFor(item.name, layerSlug)} alt={item.name} className="img-cover img-zoom" />
                <span className="absolute top-4 left-4 text-xs px-2.5 py-1 rounded-full bg-paper/90 text-ink backdrop-blur">{item.tag}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              {(SHOWCASE_IMAGES[layerSlug] || []).slice(0,3).map((img,i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden border border-line">
                  <img src={img} alt="" loading="lazy" className="img-cover" />
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 reveal">
            <div className="eyebrow">Слой {layer.number} · {layer.title}</div>
            <h1 className="h-display mt-2">{item.name}</h1>
            <div className="text-muted mt-2">{item.sub}</div>

            <div className="mt-6 flex items-baseline gap-3">
              <span className="font-display text-3xl text-ink">{formatMoneyText(item.price)}</span>
              <span className="text-sm text-muted">вкл. ДДС</span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/kontakt" state={{ subject: `Оферта за: ${item.name}` }} className="btn btn-primary">Поискай оферта</Link>
              <Link to="/katalog" className="btn btn-ghost">Назад в каталога</Link>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
              <Info k="Доставка" v="2–5 работни дни" />
              <Info k="Гаранция" v="24 месеца" />
              <Info k="Връщане" v="14 дни" />
              <Info k="Наличност" v="В склад" />
            </div>

            <div className="mt-8 border-t border-line pt-6">
              <div className="eyebrow mb-3">За продукта</div>
              <p className="text-sm text-muted">
                {item.name} е част от {item.categoryLabel || String(item.sub || 'продукт').toLowerCase()} с маркер „{item.tag}“. Подбран е от екипа на Totsan заради съчетанието между качество, цена и наличност на пазара.
              </p>
            </div>
          </div>
        </div>
      </section>

      {recommendations.length > 0 && (
        <section className="section !pt-0">
          <div className="container-page">
            <div className="eyebrow reveal">Специалисти за този тип материал</div>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {recommendations.map((recommendation) => (
                <ProductPartnerCard key={recommendation.person.id || recommendation.person.slug || recommendation.person.name} recommendation={recommendation} product={item} layer={layer} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}

function ProductPartnerCard({ recommendation, product, layer }) {
  const { person, relationshipLabel, relationLabels, note } = recommendation
  const profilePath = `/profil/${person.slug || slugify(person.name)}`
  const state = { item: { kind: 'pro', slug: person.slug, layer: layer.slug, layerNumber: layer.number, layerTitle: layer.title, sub: person.tag, ...person } }

  return (
    <article className="card reveal flex h-full flex-col bg-paper p-5">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-line bg-soft">
          <img src={getProfileImage(person)} alt={person.name} className="img-cover" loading="lazy" decoding="async" style={getProfileImageStyle(person)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="rounded-full bg-soft px-3 py-1 text-xs text-muted">{relationshipLabel}</div>
          <h2 className="mt-3 font-display text-2xl leading-tight text-ink">{person.name}</h2>
          <p className="mt-1 text-sm text-muted">{person.tag}{person.city ? ` · ${person.city}` : ''}</p>
        </div>
      </div>

      {relationLabels.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {relationLabels.slice(0, 3).map(label => <span key={label} className="rounded-full border border-line bg-soft px-3 py-1 text-xs text-muted">{label}</span>)}
        </div>
      )}

      {note && <p className="mt-4 line-clamp-3 text-sm text-muted">{note}</p>}

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Link
          to="/kontakt"
          state={{ subject: `Запитване към ${person.name} за ${product.name}` }}
          className="btn btn-primary flex-1 justify-center"
        >
          Запитай специалист
        </Link>
        <Link to={profilePath} state={state} className="btn btn-ghost flex-1 justify-center">Виж профила</Link>
      </div>
    </article>
  )
}

function Info({ k, v }) {
  return (
    <div className="border border-line rounded-xl p-4">
      <div className="text-xs text-muted">{k}</div>
      <div className="text-sm mt-1">{v}</div>
    </div>
  )
}

function NotFound() {
  return (
    <section className="section">
      <div className="container-page max-w-2xl text-center">
        <h1 className="h-section">Този продукт не е намерен.</h1>
        <p className="text-muted mt-3">Може да си отворил линк директно. Върни се в каталога.</p>
        <Link to="/katalog" className="btn btn-primary mt-6 inline-flex">Към каталога</Link>
      </div>
    </section>
  )
}

