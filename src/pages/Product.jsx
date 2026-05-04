import { Link, useLocation, useParams } from 'react-router-dom'
import { useMemo } from 'react'
import { productImageFor, SHOWCASE_IMAGES } from '../data/images.js'
import ProfessionalCard from '../components/ProfessionalCard.jsx'
import { slugify, useProfileDirectory } from '../lib/profiles.js'

export default function Product() {
  const { state } = useLocation()
  const { slug } = useParams()
  const { catalog, layers } = useProfileDirectory()
  const item = useMemo(() => state?.item || catalog.find(c => c.kind === 'product' && slugify(c.name) === slug), [catalog, state, slug])

  if (!item) return <NotFound />
  const layer = layers.find(l => l.slug === item.layer)

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
                <img src={productImageFor(item.name, item.layer)} alt={item.name} className="img-cover img-zoom" />
                <span className="absolute top-4 left-4 text-xs px-2.5 py-1 rounded-full bg-paper/90 text-ink backdrop-blur">{item.tag}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              {(SHOWCASE_IMAGES[item.layer] || []).slice(0,3).map((img,i) => (
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
              <span className="font-display text-3xl text-ink">{item.price}</span>
              <span className="text-sm text-muted">вкл. ДДС</span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/contact" state={{ subject: `Оферта за: ${item.name}` }} className="btn btn-primary">Поискай оферта</Link>
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
                {item.name} е част от {item.sub.toLowerCase()} с маркер „{item.tag}“. Подбран е от екипа на Totsan заради съчетанието между качество, цена и наличност на пазара.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section !pt-0">
        <div className="container-page">
          <div className="eyebrow reveal">Майстори, които работят с този продукт</div>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {layer.professionals.slice(0,3).map((p,i) => (
              <ProfessionalCard
                key={i}
                to={`/profil/${p.slug || slugify(p.name)}`}
                state={{ item: { kind: 'pro', slug: p.slug, layer: layer.slug, layerNumber: layer.number, layerTitle: layer.title, sub: p.tag, ...p } }}
                person={p}
              />
            ))}
          </div>
        </div>
      </section>
    </>
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

