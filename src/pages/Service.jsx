import { Link, useParams } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import { SERVICE_DETAILS } from '../data/catalog.js'
import { SERVICE_IMAGES } from '../data/images.js'
import ProfessionalCard from '../components/ProfessionalCard.jsx'
import { slugify, useProfileDirectory } from '../lib/profiles.js'

// Ключови думи, с които намираме специалисти от каталога, подходящи за дадена услуга.
const SERVICE_PRO_HINTS = {
  'elektrichar':  ['електро', 'инженер', 'ел.'],
  'vik':          ['вик', 'инженер', 'санитар'],
  'otoplenie':    ['отоплен', 'климат', 'инженер'],
  'ventilaciya':  ['вентилац', 'инженер'],
  'smart-home':   ['smart', 'консулт', 'инженер'],
  'alarmi':       ['аларм', 'охран', 'инженер'],
  'pochistvane':  ['почистване', 'фасада', 'монтаж'],
  'premestvane':  ['монтаж', 'дом', 'преместване']
}

export default function Service() {
  const { slug } = useParams()
  const service = SERVICE_DETAILS.find(s => s.slug === slug)
  const { layers } = useProfileDirectory()

  useEffect(() => { window.scrollTo({ top: 0 }) }, [slug])

  const pros = useMemo(() => {
    if (!service) return []
    const hints = SERVICE_PRO_HINTS[service.slug] || []
    const all = layers.flatMap(l => l.professionals.map(p => ({ ...p, layer: l })))
    const matched = all.filter(p => {
      const t = (p.tag + ' ' + p.name).toLowerCase()
      return hints.some(h => t.includes(h))
    })
    // ако няма съвпадение — показваме топ 6 общи
    return (matched.length ? matched : all).slice(0, 6)
  }, [layers, service])

  if (!service) return <NotFound />

  const heroImg = SERVICE_IMAGES[service.slug]

  return (
    <>
      <section className="section relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImg} alt="" className="img-cover" />
          <div className="hero-overlay-dark"></div>
        </div>
        <div className="container-page grid lg:grid-cols-12 gap-10 items-end relative text-paper">
          <div className="lg:col-span-8 reveal">
            <Link to="/uslugi" className="eyebrow !text-paper/70 hover:!text-paper">← Всички услуги</Link>
            <div className="mt-3 eyebrow !text-paper/70">Хоризонтален слой · Услуга</div>
            <h1 className="h-display mt-3 text-paper">{service.name}</h1>
            <p className="mt-5 max-w-2xl text-paper/85" style={{fontSize:'var(--step-md)'}}>{service.work}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#majstori" className="btn btn-primary !bg-accent !text-ink hover:!bg-paper">Виж специалистите</a>
              <Link to="/contact" state={{ subject: `Запитване: ${service.name}` }} className="btn btn-ghost !border-paper/40 !text-paper hover:!bg-paper hover:!text-ink">Заяви услуга</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 reveal">
            <div className="eyebrow">Какво включва</div>
            <p className="mt-3" style={{fontSize:'var(--step-md)'}}>{service.short}</p>
            <p className="mt-4 text-muted">{service.work}</p>

            <div className="mt-10 eyebrow">Как протича</div>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              {[
                { n:'01', t:'Запитване', d:'Кажи ни какво ти трябва — отговор до 48 часа.' },
                { n:'02', t:'Оглед / уточнение', d:'Специалистът преценява обема и подготвя оферта.' },
                { n:'03', t:'Изпълнение', d:'Уговорка на удобен ден и час, чисто и точно.' },
                { n:'04', t:'Гаранция', d:'Писмена гаранция за извършената работа през платформата.' }
              ].map(p => (
                <div key={p.n} className="border border-line rounded-xl p-5">
                  <div className="font-display text-2xl text-accentDeep">{p.n}</div>
                  <div className="font-display text-lg mt-1">{p.t}</div>
                  <p className="text-sm text-muted mt-1">{p.d}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="lg:col-span-5 reveal">
            <div className="border border-line rounded-2xl p-6 bg-paper sticky top-24">
              <div className="eyebrow">Заяви услуга</div>
              <p className="text-sm text-muted mt-2">Кратко описание — препращаме на най-подходящия специалист и се връщаме с оферта.</p>
              <Link to="/contact" state={{ subject: `Запитване: ${service.name}` }} className="btn btn-primary w-full justify-center mt-5">Изпрати запитване</Link>
              <div className="mt-4 text-xs text-muted">Безплатно. Без обвързване.</div>
            </div>
          </aside>
        </div>
      </section>

      <section id="majstori" className="section !pt-0">
        <div className="container-page">
          <div className="eyebrow reveal">Специалисти за тази услуга</div>
          <h2 className="h-section mt-2 reveal max-w-3xl">Хора, които работят точно с {service.name.toLowerCase()}.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {pros.map((p, i) => (
              <ProfessionalCard
                key={i}
                to={`/profil/${p.slug || slugify(p.name)}`}
                state={{ item: { kind: 'pro', slug: p.slug, layer: p.layer.slug, layerNumber: p.layer.number, layerTitle: p.layer.title, sub: p.tag, ...p } }}
                person={p}
                layerLabel={`Слой ${p.layer.number} · ${p.layer.title}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page rounded-3xl bg-ink text-paper p-10 md:p-16 grid md:grid-cols-12 gap-8 items-center reveal">
          <div className="md:col-span-8">
            <h2 className="h-section text-paper">Готов да заявиш {service.name.toLowerCase()}?</h2>
            <p className="mt-3 text-paper/70 max-w-2xl">Кажи ни кратко какво ти трябва — връщаме се с подходящ специалист и оферта.</p>
          </div>
          <div className="md:col-span-4 flex md:justify-end gap-3 flex-wrap">
            <Link to="/contact" state={{ subject: `Запитване: ${service.name}` }} className="btn btn-primary !bg-accent !text-ink hover:!bg-paper">Заяви услуга</Link>
          </div>
        </div>
      </section>
    </>
  )
}

function NotFound() {
  return (
    <section className="section">
      <div className="container-page max-w-2xl text-center">
        <h1 className="h-section">Тази услуга не е намерена.</h1>
        <p className="text-muted mt-3">Върни се към списъка с услуги.</p>
        <Link to="/uslugi" className="btn btn-primary mt-6 inline-flex">Към услугите</Link>
      </div>
    </section>
  )
}

