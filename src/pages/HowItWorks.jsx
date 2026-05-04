import { Link } from 'react-router-dom'
import { LAYERS } from '../data/layers.js'

export default function HowItWorks() {
  return (
    <>
      <section className="section !pt-20 bg-gradient-to-br from-soft to-cloud">
        <div className="container-page max-w-4xl reveal">
          <div className="eyebrow">Как работи Totsan</div>
          <h1 className="h-display mt-3">От мечта до завършено пространство — стъпка по стъпка.</h1>
          <p className="mt-5 text-muted" style={{fontSize:'var(--step-md)'}}>
            Никой не започва от плочка. Започваш от усещане. Затова сме разделили целия процес на пет ясни слоя — и ти показваме точно кой какво прави на всеки от тях.
          </p>
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
              { t:'Посредничество', d:'Ако нещо засече, имаш на кого да се обадиш. Стоим между теб и изпълнителя.' },
              { t:'Безплатно за теб', d:'Като клиент не плащаш на платформата. Платформата живее от партньорите.' }
            ].map((p,i) => (
              <div key={i} className="reveal border-t border-paper/20 pt-5">
                <div className="font-display text-2xl text-accent">0{i+1}</div>
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
          <p className="text-muted mt-3 max-w-2xl">Започни от слоя, на който си днес. Ако не знаеш — започни от Слой 01.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/sloy/ideya" className="btn btn-primary">Започни от 01 →</Link>
            <Link to="/katalog" className="btn btn-ghost">Разгледай каталога</Link>
          </div>
        </div>
      </section>
    </>
  )
}
