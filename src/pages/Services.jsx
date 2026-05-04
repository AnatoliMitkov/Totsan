import { Link } from 'react-router-dom'
import { SERVICE_DETAILS } from '../data/catalog.js'
import { SERVICE_IMAGES } from '../data/images.js'

export default function Services() {
  return (
    <>
      <section className="section !pt-20 bg-gradient-to-br from-soft to-cloud">
        <div className="container-page max-w-4xl reveal">
          <div className="eyebrow">Хоризонтален слой</div>
          <h1 className="h-display mt-3">Услугите, които вървят с всяко пространство.</h1>
          <p className="mt-5 text-muted" style={{fontSize:'var(--step-md)'}}>
            Електричарят за контактите, ВиК-то за банята, smart home за светлините. Тези хора те застигат на всеки от петте слоя — затова са винаги под ръка, на едно място.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container-page">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {SERVICE_DETAILS.map(s => (
              <Link to={`/usluga/${s.slug}`} key={s.slug} className="reveal card img-zoom-host bg-paper p-0 overflow-hidden block">
                <div className="media-frame aspect-[16/10]">
                  <img src={SERVICE_IMAGES[s.slug]} alt={s.name} loading="lazy" decoding="async" className="img-cover img-zoom" />
                </div>
                <div className="p-7">
                  <div className="font-display text-2xl">{s.name}</div>
                  <p className="text-muted text-sm mt-2">{s.short}</p>
                  <div className="mt-4 text-sm border-t border-line pt-4 text-ink/80">{s.work}</div>
                  <span className="mt-6 btn btn-ghost w-full justify-center">Виж специалистите</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section !pt-0">
        <div className="container-page rounded-3xl bg-ink text-paper p-10 md:p-16 grid md:grid-cols-12 gap-8 items-center reveal">
          <div className="md:col-span-8">
            <h2 className="h-section text-paper">Не виждаш услугата, която ти трябва?</h2>
            <p className="mt-3 text-paper/70 max-w-2xl">Кажи ни с две изречения какво ти трябва — намираме правилния човек и се връщаме до 24 часа.</p>
          </div>
          <div className="md:col-span-4 flex md:justify-end gap-3 flex-wrap">
            <Link to="/contact" className="btn btn-primary !bg-accent !text-ink hover:!bg-paper">Заяви услуга</Link>
          </div>
        </div>
      </section>
    </>
  )
}
