import { Link } from 'react-router-dom'

export default function About() {
  return (
    <>
      <section className="section !pt-20 bg-gradient-to-br from-soft to-cloud">
        <div className="container-page max-w-4xl reveal">
          <div className="eyebrow">За Totsan</div>
          <h1 className="h-display mt-3">Един адрес за пространството, което създаваш.</h1>
          <p className="mt-5 text-muted" style={{fontSize:'var(--step-md)'}}>
            Преди години, ако искаш да си построиш или обзаведеш нещо, обикаляш десет фирми, питаш роднини, гадаеш цени, надяваш се. Totsan събира всичко на едно място — и подрежда хаоса в пет ясни слоя.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container-page grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 reveal">
            <div className="eyebrow">Историята накратко</div>
            <p className="mt-3" style={{fontSize:'var(--step-md)'}}>
              Започнахме с проста идея: човекът, който прави свой дом, заслужава да бъде разбран. Не да бъде продаден. Не да обикаля цял ден. Да бъде изслушан и насочен — както при добър приятел, който познава всички правилни хора.
            </p>
            <p className="mt-5 text-muted">
              Затова Totsan е едновременно платформа и общност. Платформа, защото на едно място виждаш специалисти, материали и услуги. Общност, защото внимателно подбираме кой влиза — и стоим зад всеки, когото препоръчваме.
            </p>
          </div>
          <aside className="lg:col-span-5 reveal">
            <div className="border border-line rounded-2xl p-6 bg-paper">
              <div className="eyebrow">В числа</div>
              <div className="grid grid-cols-2 gap-6 mt-4">
                <Stat n="320+" l="Проверени специалисти" />
                <Stat n="1 800" l="Материали и марки" />
                <Stat n="5" l="Слоя на създаване" />
                <Stat n="48ч" l="Среден отговор" />
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="section bg-soft border-y border-line">
        <div className="container-page">
          <div className="eyebrow reveal">Принципи</div>
          <h2 className="h-section mt-2 reveal max-w-3xl">Какво няма да направим.</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {[
              { t:'Няма да продаваме внимание', d:'Никакви платени класирания, които да заблудят клиента. Реда го определя качеството.' },
              { t:'Няма да крием цени', d:'Ако партньор не може да покаже реална цена — не влиза в Totsan.' },
              { t:'Няма да изоставим', d:'След първия контакт оставаме до края на проекта, ако е нужно.' }
            ].map((p,i) => (
              <div key={i} className="reveal border-t border-ink pt-5">
                <div className="font-display text-2xl">{p.t}</div>
                <p className="text-muted mt-2 text-sm">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-page rounded-3xl bg-ink text-paper p-10 md:p-16 reveal">
          <h2 className="h-section text-paper">Искаш да станеш партньор?</h2>
          <p className="mt-3 text-paper/70 max-w-2xl">Архитект, изпълнител, производител, майстор. Ако работиш качествено, разкажи ни.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/contact" className="btn btn-primary !bg-accent !text-ink hover:!bg-paper">Свържи се с нас</Link>
          </div>
        </div>
      </section>
    </>
  )
}

function Stat({ n, l }) {
  return (
    <div>
      <div className="font-display text-3xl text-ink">{n}</div>
      <div className="text-xs text-muted mt-1">{l}</div>
    </div>
  )
}
