import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileCheck2, HandCoins } from 'lucide-react'

export default function Checkout() {
  const { type = '' } = useParams()
  const backPath = type === 'service' ? '/uslugi' : '/inbox'
  const backLabel = type === 'service' ? 'Към услугите' : 'Към разговора'

  return (
    <section className="section min-h-[calc(100vh-var(--header-h,0px))] bg-soft">
      <div className="container-page max-w-3xl">
        <Link to={backPath} className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-ink">
          <ArrowLeft size={17} /> {backLabel}
        </Link>

        <div className="mt-6 rounded-3xl border border-line bg-paper p-6 md:p-9">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accentSoft text-accentDeep">
            <HandCoins size={27} />
          </div>
          <div className="eyebrow mt-6">Директно плащане</div>
          <h1 className="mt-2 font-display text-4xl leading-tight text-ink md:text-5xl">Плащането е директно към партньора.</h1>
          <p className="mt-4 text-base leading-7 text-muted">
            Totsan не приема и не обработва плащането за тази оферта или услуга. Уточнете с партньора метода, срока, аванса и условията за фактуриране и платете директно по предоставените от него данни.
          </p>

          <div className="mt-6 flex gap-3 rounded-2xl border border-line bg-soft p-4 text-sm leading-6 text-muted">
            <FileCheck2 size={19} className="mt-0.5 shrink-0 text-accentDeep" />
            <p>
              Оферта, статус „платено“, качен документ или фактура в Totsan служат само като доказателствена следа. Те не означават, че Totsan е получил, прехвърлил или гарантирал сумата.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={backPath} className="btn btn-primary">{backLabel}</Link>
            <Link to="/obshti-usloviya" className="btn btn-ghost">Общи условия</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
