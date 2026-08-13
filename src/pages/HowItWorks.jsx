import { Link } from 'react-router-dom'
import { LAYERS } from '../data/layers.js'
import { buildBreadcrumbSchema, buildFaqSchema, useSeo } from '../lib/seo.js'

export default function HowItWorks() {
  useSeo({
    title: 'Как работи Totsan — стъпка по стъпка',
    description: 'Виж как Totsan подрежда проекта ти в пет слоя и те води от brief до правилния специалист, услуга или материално решение.',
    canonicalPath: '/kak-raboti',
    jsonLd: [
      buildBreadcrumbSchema([
        { name: 'Начало', path: '/' },
        { name: 'Как работи', path: '/kak-raboti' },
      ]),
      buildFaqSchema([
        { question: 'Какво представляват петте слоя на Totsan?', answer: 'Totsan разделя целия процес на ремонт, строителство и обзавеждане на 5 последователни слоя: от концепция и архитектура до финални декоративни акценти.' },
        { question: 'Как започва един проект?', answer: 'Започваш с краткия Guided Project Brief, отговаряш на няколко въпроса и Totsan те насочва към правилния слой, специалист или следваща стъпка.' },
      ]),
    ],
  })
  return (
    <>
      <section className="section !pt-20 bg-gradient-to-br from-soft to-cloud">
        <div className="container-page max-w-4xl reveal">
          <div className="eyebrow">Как работи Totsan</div>
          <h1 className="h-display mt-3">От мечта до завършено пространство — стъпка по стъпка.</h1>
          <p className="mt-5 text-muted" style={{fontSize:'var(--step-md)'}}>
            Никой не започва от плочка. Започваш от нужда. Затова първата практична стъпка е краткият Guided Project Brief, а после Totsan те насочва към правилния слой, специалист или следващо действие.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/start" className="btn btn-primary">Започни проект →</Link>
            <Link to="/katalog" className="btn btn-ghost">Разгледай каталога</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page">
          <div className="eyebrow reveal">Реалният път</div>
          <h2 className="h-section mt-2 reveal max-w-3xl">Как започва един проект в Totsan.</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {[
              { n: '01', t: 'Описваш проекта', d: 'Разказваш какво планираш, на какъв етап си и какво ти е най-важно.' },
              { n: '02', t: 'Получаваш насока', d: 'Totsan ти показва най-подходящия слой, първи ход и как да не губиш време.' },
              { n: '03', t: 'Свързваш се с проверен специалист', d: 'Изпращаш запитване и продължаваш с точните хора, продукти или услуги.' },
            ].map((item) => (
              <div key={item.n} className="reveal border border-line rounded-2xl bg-paper p-6">
                <div className="font-display text-3xl text-accentDeep">{item.n}</div>
                <div className="font-display text-2xl mt-3">{item.t}</div>
                <p className="text-muted text-sm mt-3">{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page">
          <div className="eyebrow reveal">Петте слоя в едно изречение всеки</div>
          <div className="mt-8 space-y-3">
            {LAYERS.map(l => (
              <Link to={`/sloy/${l.slug}`} key={l.slug}
                className="reveal flex items-center gap-6 p-6 border border-line rounded-2xl hover:border-ink transition group bg-paper">
                <span className="font-display text-3xl text-accentDeep w-14 shrink-0">{l.number}</span>
                <div className="flex-1">
                  <div className="font-display text-xl">{l.title}</div>
                  <div className="text-muted text-sm mt-1">{l.short}</div>
                </div>
                <span className="text-accentDeep group-hover:translate-x-1 transition">→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-ink text-paper">
        <div className="container-page">
          <div className="eyebrow !text-paper/60 reveal">Четирите ни обещания</div>
          <h2 className="h-section text-paper mt-2 reveal max-w-3xl">Как пазим качеството.</h2>
          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { t:'Лична проверка', d:'Всеки специалист минава през преглед — реални проекти, отзиви, документи.' },
              { t:'Прозрачни цени', d:'Виждаш цени, наличности и условия — без скрити „звездички“.' },
              { t:'Плащане през Stripe', d:'Клиентът плаща според условията на офертата, а статусът се проследява в поръчката.' },
              { t:'Безплатно за теб', d:'Като клиент не плащаш такси на платформата. Totsan живее от партньорите.' }
            ].map((p,i) => (
              <div key={i} className="reveal border-t border-paper/20 pt-5">
                <div className="font-display text-2xl text-accentDeep">0{i+1}</div>
                <div className="font-display text-xl mt-2 text-paper">{p.t}</div>
                <p className="text-paper/70 mt-2 text-sm">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page rounded-3xl bg-soft border border-line p-10 md:p-16 reveal">
          <h2 className="h-section">Готов за първа стъпка?</h2>
          <p className="text-muted mt-3 max-w-2xl">Ако не си сигурен откъде да тръгнеш, започни с Guided Project Brief и ще получиш ясна насока още в първите минути.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/start" className="btn btn-primary">Започни проект →</Link>
            <Link to="/katalog" className="btn btn-ghost">Разгледай каталога</Link>
          </div>
        </div>
      </section>
    </>
  )
}
