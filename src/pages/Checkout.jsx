import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, CreditCard, ShieldCheck } from 'lucide-react'
import { useAccount } from '../lib/account.js'
import { formatOrderMoney, loadCheckoutPreview } from '../lib/orders.js'
import { startCheckout, syncStripeSession } from '../lib/payments.js'

export default function Checkout() {
  const { type = '', id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id') || ''

  if (sessionId) return <CheckoutSuccess sessionId={sessionId} />
  return <CheckoutPayment type={type} id={id} />
}

function CheckoutPayment({ type, id }) {
  const navigate = useNavigate()
  const { session, loading } = useAccount()
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      if (!type || !id) {
        setStatus('not-found')
        return
      }
      setStatus('loading')
      setMessage('')
      try {
        const data = await loadCheckoutPreview(type, id)
        if (!active) return
        if (!data) {
          setStatus('not-found')
          return
        }
        setPreview(data)
        setStatus('ready')
      } catch (error) {
        if (!active) return
        setStatus('error')
        setMessage(error.message || 'Плащането не се зареди.')
      }
    }
    load()
    return () => { active = false }
  }, [type, id])

  async function pay(provider = 'stripe') {
    if (!preview?.isAvailable) return
    setStatus('paying')
    setMessage('')
    try {
      const result = await startCheckout({ type, id, provider })
      const checkoutUrl = result.checkoutUrl || ''
      if (checkoutUrl) {
        const url = new URL(checkoutUrl, window.location.origin)
        if (url.origin === window.location.origin) {
          navigate(`${url.pathname}${url.search}`)
          return
        }
        window.location.href = checkoutUrl
        return
      }
      if (result.order?.id) navigate(`/order/${result.order.id}`)
    } catch (error) {
      setStatus('ready')
      setMessage(error.message || 'Плащането не можа да стартира.')
    }
  }

  if (loading) return <CheckoutShell><Panel title="Зареждаме плащането…" /></CheckoutShell>

  if (!session) {
    return (
      <CheckoutShell>
        <Panel title="Влез, за да продължиш">
          <p className="mt-2 text-sm text-muted">Поръчките са достъпни само за профили в Totsan.</p>
          <Link to="/login" className="btn btn-primary mt-5">Вход</Link>
        </Panel>
      </CheckoutShell>
    )
  }

  if (status === 'loading') return <CheckoutShell><Panel title="Зареждаме плащането…" /></CheckoutShell>

  if (status === 'not-found' || !preview) {
    return <CheckoutShell><Panel title="Плащането не е налично"><p className="mt-2 text-sm text-muted">Линкът е изтекъл или офертата вече не е активна.</p></Panel></CheckoutShell>
  }

  if (status === 'error') {
    return <CheckoutShell><Panel title="Плащането не се зареди"><p className="mt-2 text-sm text-red-700">{message}</p></Panel></CheckoutShell>
  }

  const unavailable = !preview.isAvailable

  return (
    <CheckoutShell>
      <Link to={preview.type === 'service' && preview.service?.slug ? `/uslugi/${preview.service.slug}` : '/inbox'} className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-ink">
        <ArrowLeft size={17} /> Назад
      </Link>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <section className="lg:col-span-8 rounded-3xl border border-line bg-paper p-5 md:p-7">
          <div className="eyebrow">Checkout</div>
          <h1 className="mt-2 font-display text-4xl leading-tight text-ink md:text-5xl">{preview.title}</h1>
          {preview.subtitle && <p className="mt-3 max-w-3xl text-muted">{preview.subtitle}</p>}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Info icon={CreditCard} label="Сума" value={formatOrderMoney(preview.amountTotal, preview.currency)} />
            <Info icon={CheckCircle2} label="Оферта" value={preview.type === 'service' ? 'Официална услуга' : 'Индивидуална оферта'} />
          </div>

          {preview.deliverables.length > 0 && (
            <div className="mt-7">
              <div className="eyebrow">Включва</div>
              <ul className="mt-3 grid gap-2 text-sm text-ink/80">
                {preview.deliverables.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accentDeep" /> <span>{item}</span></li>)}
              </ul>
            </div>
          )}

          {message && <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{message}</div>}
          {unavailable && <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">Тази оферта или услуга вече не е активна за плащане.</div>}
        </section>

        <aside className="lg:col-span-4">
          <div className="rounded-3xl border border-line bg-paper p-5 md:p-6 lg:sticky lg:top-24">
            <div className="eyebrow">Общо</div>
            <div className="mt-3 font-display text-5xl text-ink">{formatOrderMoney(preview.amountTotal, preview.currency)}</div>
            <div className="mt-5 flex gap-3 rounded-2xl border border-line bg-soft p-4 text-sm text-muted">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accentDeep" />
              <p>Плащането остава в Totsan до потвърждение на завършването.</p>
            </div>
            <button type="button" onClick={() => pay('stripe')} disabled={status === 'paying' || unavailable} className="btn btn-primary mt-5 w-full justify-center">
              {status === 'paying' ? 'Обработваме…' : 'Плати със Stripe Sandbox'}
            </button>
          </div>
        </aside>
      </div>
    </CheckoutShell>
  )
}

function CheckoutSuccess({ sessionId }) {
  const { session, loading } = useAccount()
  const [state, setState] = useState({ status: 'loading', message: '', order: null })

  useEffect(() => {
    let active = true
    async function sync() {
      if (!session || !sessionId) return
      setState({ status: 'loading', message: '', order: null })
      try {
        const result = await syncStripeSession(sessionId)
        if (!active) return
        setState({ status: result.paid ? 'paid' : 'pending', message: result.paid ? 'Плащането е потвърдено.' : 'Плащането още се обработва.', order: result.order || null })
      } catch (error) {
        if (!active) return
        setState({ status: 'error', message: error.message || 'Stripe сесията не се синхронизира.', order: null })
      }
    }
    sync()
    return () => { active = false }
  }, [session, sessionId])

  if (loading || state.status === 'loading') return <CheckoutShell><Panel title="Потвърждаваме плащането…" /></CheckoutShell>
  if (!session) return <CheckoutShell><Panel title="Влез, за да завършим плащането"><Link to="/login" className="btn btn-primary mt-5">Вход</Link></Panel></CheckoutShell>

  return (
    <CheckoutShell>
      <Panel title={state.status === 'error' ? 'Плащането не се потвърди' : 'Плащането е обработено'}>
        <p className={`mt-2 text-sm ${state.status === 'error' ? 'text-red-700' : 'text-muted'}`}>{state.message}</p>
        {state.order?.id && <Link to={`/order/${state.order.id}`} className="btn btn-primary mt-5">Към поръчката</Link>}
      </Panel>
    </CheckoutShell>
  )
}

function CheckoutShell({ children }) {
  return <section className="section bg-soft min-h-[calc(100vh-var(--header-h,0px))]"><div className="container-page">{children}</div></section>
}

function Panel({ title, children }) {
  return <div className="rounded-3xl border border-line bg-paper p-6 md:p-8"><h1 className="font-display text-3xl text-ink">{title}</h1>{children}</div>
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-soft p-4">
      <Icon size={17} className="text-accentDeep" />
      <div className="mt-2 text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 text-sm font-medium text-ink">{value}</div>
    </div>
  )
}