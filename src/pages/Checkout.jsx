import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, CreditCard, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { useAccount } from '../lib/account.js'
import { formatOrderMoney, loadCheckoutPreview } from '../lib/orders.js'
import { startCheckout, syncStripeSession } from '../lib/payments.js'
import { trackEvent } from '../lib/analytics.js'

const PENDING_RETRY_DELAYS_MS = [1500, 3000, 5000]

export default function Checkout() {
  const { type = '', id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id') || ''
  const cancelled = searchParams.get('cancelled') === '1'

  if (sessionId) return <CheckoutSuccess key={sessionId} sessionId={sessionId} />
  return <CheckoutPayment type={type} id={id} cancelled={cancelled} />
}

function CheckoutPayment({ type, id, cancelled = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, loading } = useAccount()
  const userId = session?.user?.id || ''
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [showCancelled, setShowCancelled] = useState(cancelled)
  const [loadCycle, setLoadCycle] = useState(0)
  const beginCheckoutTrackedRef = useRef('')
  const loginPath = `/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`

  useEffect(() => {
    setShowCancelled(cancelled)
  }, [cancelled, id, type])

  useEffect(() => {
    if (loading || !userId) return undefined

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
          setPreview(null)
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
    void load()
    return () => { active = false }
  }, [id, loadCycle, loading, type, userId])

  useEffect(() => {
    if (!session || !preview || status !== 'ready') return

    const trackingKey = `${type}:${id}`
    if (beginCheckoutTrackedRef.current === trackingKey) return

    beginCheckoutTrackedRef.current = trackingKey
    trackEvent('begin_checkout', {
      source: 'checkout_page',
      item_type: preview.type || type || undefined,
      item_id: id || undefined,
      service_slug: preview.service?.slug || undefined,
      currency: preview.currency || undefined,
      value: preview.amountTotal || undefined,
    })
  }, [id, preview, session, status, type])

  async function pay(provider = 'stripe') {
    if (!preview?.isAvailable || status === 'paying') return
    setShowCancelled(false)
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

  if (loading) {
    return <CheckoutStatePage status="loading" title="Подготвяме плащането" description="Проверяваме профила и защитената платежна сесия." />
  }

  if (!session) {
    return (
      <CheckoutStatePage
        icon={ShieldCheck}
        eyebrow="Защитено плащане"
        title="Влез, за да продължиш"
        description="След вход ще се върнеш директно към това плащане."
      >
        <Link to={loginPath} className={PRIMARY_ACTION_CLASS}>Вход</Link>
      </CheckoutStatePage>
    )
  }

  if (status === 'loading') {
    return <CheckoutStatePage status="loading" title="Подготвяме плащането" description="Зареждаме договорените условия и сумата." />
  }

  if (status === 'not-found' || !preview) {
    return (
      <CheckoutStatePage
        icon={AlertTriangle}
        tone="warning"
        eyebrow="Плащане"
        title="Плащането не е налично"
        description="Линкът може да е изтекъл или предложението вече да не е активно."
      >
        <Link to="/porachki" className={SECONDARY_ACTION_CLASS}>Към поръчките</Link>
      </CheckoutStatePage>
    )
  }

  if (status === 'error') {
    return (
      <CheckoutStatePage
        icon={AlertTriangle}
        tone="error"
        role="alert"
        eyebrow="Плащане"
        title="Плащането не се зареди"
        description={message}
      >
        <button type="button" onClick={() => setLoadCycle((value) => value + 1)} className={PRIMARY_ACTION_CLASS}>
          <RefreshCw size={17} /> Опитай отново
        </button>
        <Link to="/porachki" className={SECONDARY_ACTION_CLASS}>Към поръчките</Link>
      </CheckoutStatePage>
    )
  }

  const unavailable = !preview.isAvailable
  const returnTarget = checkoutReturnTarget(preview)
  const amountLabel = formatOrderMoney(preview.amountTotal, preview.currency)
  const deliverables = Array.isArray(preview.deliverables) ? preview.deliverables : []
  const agreement = preview.normalizedOffer || null
  const excludedItems = Array.isArray(agreement?.excludedItems) ? agreement.excludedItems : []
  const clientRequirements = Array.isArray(agreement?.clientRequirements) ? agreement.clientRequirements : []
  const paymentTerms = agreement?.payment?.terms || (preview.type === 'milestone' ? preview.description : '')
  const sourceLabel = checkoutSourceLabel(preview.type)
  const durationLabel = Number(preview.deliveryDays) > 0 ? `${preview.deliveryDays} работни дни` : ''
  const paymentDescriptionId = 'checkout-payment-description'

  return (
    <CheckoutShell withMobileAction>
      <Link to={returnTarget.to} className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentDeep/30 motion-reduce:transition-none">
        <ArrowLeft size={17} /> {returnTarget.label}
      </Link>

      <header className="mt-4 min-w-0 rounded-3xl border border-line bg-paper p-5 shadow-[0_20px_60px_-48px_rgba(13,35,64,0.35)] sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="eyebrow">Защитено плащане</div>
          <span className="rounded-full border border-accentDeep/15 bg-accentSoft px-3 py-1 text-xs font-semibold text-accentDeep">{sourceLabel}</span>
        </div>
        <h1 className="mt-3 break-words font-display text-3xl leading-tight text-ink sm:text-4xl lg:text-5xl">{preview.title}</h1>
        {preview.subtitle && <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-muted sm:text-base">{preview.subtitle}</p>}
      </header>

      <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,23rem)] lg:items-start">
        <aside className="order-first min-w-0 lg:order-last lg:sticky lg:top-24">
          <div className="rounded-3xl border border-line bg-paper p-5 shadow-[0_22px_60px_-48px_rgba(13,35,64,0.4)] sm:p-6">
            <div className="eyebrow">Общо за плащане</div>
            <div className="mt-2 break-words font-display text-3xl leading-tight text-ink sm:text-4xl">{amountLabel}</div>

            <div id={paymentDescriptionId} className="mt-5 flex gap-3 rounded-2xl border border-line bg-soft p-4 text-sm leading-6 text-muted">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accentDeep" />
              <p>{preview.type === 'milestone' ? 'Плащаш само този етап. Потвърждението ще се отрази в поръчката.' : 'Ще продължиш към защитена страница на Stripe. Статусът ще се отрази автоматично в поръчката.'}</p>
            </div>

            {showCancelled && (
              <Notice icon={XCircle} tone="warning" role="status">
                Предишният опит беше прекъснат. Няма потвърдено плащане от тази сесия и можеш да опиташ отново.
              </Notice>
            )}
            {message && <Notice icon={AlertTriangle} tone="error" role="alert">{message}</Notice>}
            {unavailable && (
              <Notice icon={AlertTriangle} tone="warning" role="status">
                Това предложение вече не е активно за плащане.
              </Notice>
            )}

            <PaymentButton
              status={status}
              unavailable={unavailable}
              onClick={() => pay('stripe')}
              describedBy={paymentDescriptionId}
              className="mt-5 !hidden lg:!inline-flex"
            />
          </div>
        </aside>

        <section className="order-last min-w-0 rounded-3xl border border-line bg-paper p-5 sm:p-6 lg:order-first lg:p-7" aria-labelledby="checkout-summary-title">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
            <div>
              <div className="eyebrow">Преглед</div>
              <h2 id="checkout-summary-title" className="mt-1 font-display text-2xl text-ink sm:text-3xl">Какво плащаш</h2>
            </div>
            <div className="text-sm font-semibold text-ink">{amountLabel}</div>
          </div>

          <div className={`mt-5 grid gap-3 ${durationLabel ? 'sm:grid-cols-2' : ''}`}>
            <Info icon={CheckCircle2} label="Източник" value={sourceLabel} />
            {durationLabel && <Info icon={Clock} label="Срок" value={durationLabel} />}
          </div>

          {deliverables.length > 0 && (
            <DetailsSection title="Включено">
              <ul className="grid gap-2.5 text-sm leading-6 text-ink/80">
                {deliverables.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex min-w-0 gap-2.5">
                    <CheckCircle2 size={16} className="mt-1 shrink-0 text-accentDeep" />
                    <span className="min-w-0 break-words">{item}</span>
                  </li>
                ))}
              </ul>
            </DetailsSection>
          )}

          {(excludedItems.length > 0 || clientRequirements.length > 0) && (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {excludedItems.length > 0 && <CompactList title="Не е включено" items={excludedItems} />}
              {clientRequirements.length > 0 && <CompactList title="Клиентът осигурява" items={clientRequirements} />}
            </div>
          )}

          {paymentTerms && (
            <DetailsSection title="Условия за плащане">
              <p className="whitespace-pre-wrap text-sm leading-6 text-muted">{paymentTerms}</p>
            </DetailsSection>
          )}
        </section>
      </div>

      <MobilePaymentBar
        amount={amountLabel}
        status={status}
        unavailable={unavailable}
        onClick={() => pay('stripe')}
        describedBy={paymentDescriptionId}
        message={message}
      />
    </CheckoutShell>
  )
}

function CheckoutSuccess({ sessionId }) {
  const location = useLocation()
  const { session, loading } = useAccount()
  const userId = session?.user?.id || ''
  const [state, setState] = useState({ status: 'idle', message: '', order: null, attemptsRemaining: PENDING_RETRY_DELAYS_MS.length })
  const [syncCycle, setSyncCycle] = useState(0)
  const purchaseTrackedRef = useRef('')
  const loginPath = `/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`

  useEffect(() => {
    if (!userId || !sessionId) return undefined

    let active = true
    let retryTimer = null

    async function sync(attempt = 0) {
      if (!active) return
      const isFirstAutomaticCheck = attempt === 0 && syncCycle === 0
      setState((current) => ({
        ...current,
        status: isFirstAutomaticCheck ? 'loading' : 'checking',
        message: isFirstAutomaticCheck ? '' : 'Проверяваме статуса отново…',
      }))

      try {
        const result = await syncStripeSession(sessionId)
        if (!active) return
        const nextOrder = result.order || null
        if (result.paid) {
          setState({ status: 'paid', message: 'Плащането е потвърдено.', order: nextOrder, attemptsRemaining: 0 })
          return
        }

        const attemptsRemaining = Math.max(0, PENDING_RETRY_DELAYS_MS.length - attempt)
        setState({
          status: 'pending',
          message: 'Плащането още се обработва.',
          order: nextOrder,
          attemptsRemaining,
        })

        if (attempt < PENDING_RETRY_DELAYS_MS.length) {
          retryTimer = window.setTimeout(() => {
            void sync(attempt + 1)
          }, PENDING_RETRY_DELAYS_MS[attempt])
        }
      } catch (error) {
        if (!active) return
        setState((current) => ({
          ...current,
          status: 'error',
          message: error.message || 'Плащането не можа да се потвърди автоматично.',
          attemptsRemaining: 0,
        }))
      }
    }

    void sync()
    return () => {
      active = false
      if (retryTimer) window.clearTimeout(retryTimer)
    }
  }, [sessionId, syncCycle, userId])

  useEffect(() => {
    if (state.status !== 'paid' || !state.order?.id) return
    if (purchaseTrackedRef.current === state.order.id) return

    purchaseTrackedRef.current = state.order.id
    trackEvent('purchase', {
      transaction_id: state.order.id,
      currency: state.order.currency || undefined,
      value: state.order.amountTotal ?? state.order.amount_total ?? undefined,
      items: [{
        item_id: state.order.id,
        item_name: state.order.title || 'Поръчка в Totsan',
        item_category: state.order.type || 'order',
      }],
    })
  }, [state.order, state.status])

  if (loading) {
    return <CheckoutStatePage status="loading" title="Проверяваме плащането" description="Изчакваме защитената сесия и профила ти." />
  }

  if (!session) {
    return (
      <CheckoutStatePage
        icon={ShieldCheck}
        eyebrow="Статус на плащането"
        title="Влез, за да завършим проверката"
        description="След вход ще се върнеш на тази страница и ще проверим плащането автоматично."
      >
        <Link to={loginPath} className={PRIMARY_ACTION_CLASS}>Вход</Link>
      </CheckoutStatePage>
    )
  }

  if (state.status === 'idle' || state.status === 'loading') {
    return <CheckoutStatePage status="loading" title="Проверяваме плащането" description="Това обикновено отнема само няколко секунди." />
  }

  const isError = state.status === 'error'
  const isPaid = state.status === 'paid'
  const isChecking = state.status === 'checking'
  const title = isError ? 'Плащането не се потвърди' : isPaid ? 'Плащането е успешно' : isChecking ? 'Проверяваме отново' : 'Плащането се обработва'
  const description = isError
    ? state.message
    : isPaid
      ? 'Поръчката е обновена и можеш да проследиш следващите стъпки.'
      : isChecking
        ? 'Свързваме се със Stripe за актуален статус.'
        : state.attemptsRemaining > 0
          ? `Ще проверим автоматично още ${state.attemptsRemaining} ${state.attemptsRemaining === 1 ? 'път' : 'пъти'}.`
          : 'Автоматичните проверки приключиха. Можеш да провериш отново ръчно.'
  const icon = isError ? AlertTriangle : isPaid ? CheckCircle2 : isChecking ? Loader2 : Clock
  const tone = isError ? 'error' : isPaid ? 'success' : 'warning'

  return (
    <CheckoutStatePage
      icon={icon}
      iconClassName={isChecking ? 'animate-spin motion-reduce:animate-none' : ''}
      tone={tone}
      role={isError ? 'alert' : 'status'}
      busy={isChecking}
      compact={isPaid}
      eyebrow="Статус на плащането"
      title={title}
      description={description}
    >
      {state.order?.id && <Link to={`/order/${state.order.id}`} className={isPaid ? PRIMARY_ACTION_CLASS : SECONDARY_ACTION_CLASS}>Към поръчката</Link>}
      {(isError || state.status === 'pending') && (
        <button type="button" onClick={() => setSyncCycle((value) => value + 1)} className={isError ? PRIMARY_ACTION_CLASS : SECONDARY_ACTION_CLASS}>
          <RefreshCw size={17} /> Провери отново
        </button>
      )}
      <Link to="/porachki" className={SECONDARY_ACTION_CLASS}>Моите поръчки</Link>
      {state.order?.id && <p className="w-full text-xs text-muted">Номер на поръчка: <span className="font-semibold text-ink">{state.order.id.slice(0, 8)}</span></p>}
    </CheckoutStatePage>
  )
}

const PRIMARY_ACTION_CLASS = 'btn btn-primary min-h-11 justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentDeep/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:!transition-none motion-reduce:hover:!transform-none motion-reduce:before:!hidden'
const SECONDARY_ACTION_CLASS = 'btn btn-ghost min-h-11 justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentDeep/30 focus-visible:ring-offset-2 motion-reduce:!transition-none'

function checkoutReturnTarget(preview) {
  const orderId = preview?.order?.id || preview?.orderId || ''
  if (orderId) return { to: `/order/${orderId}`, label: 'Към поръчката' }

  if (preview?.type === 'service' && preview.service?.slug) {
    return { to: `/uslugi/${preview.service.slug}`, label: 'Към услугата' }
  }

  const conversationId = preview?.offer?.conversation_id || preview?.offer?.conversationId || ''
  if (conversationId) return { to: `/inbox/${conversationId}`, label: 'Към разговора' }

  return { to: '/porachki', label: 'Към поръчките' }
}

function checkoutSourceLabel(type = '') {
  if (type === 'service') return 'Партньорска услуга'
  if (type === 'milestone') return 'Етап от поръчка'
  return 'Индивидуална оферта'
}

function PaymentButton({ status, unavailable, onClick, describedBy, className = '' }) {
  const paying = status === 'paying'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={paying || unavailable}
      aria-busy={paying}
      aria-describedby={describedBy}
      className={`${PRIMARY_ACTION_CLASS} min-h-12 w-full ${className}`}
    >
      {paying ? <><Loader2 size={18} className="animate-spin motion-reduce:animate-none" /> Отваряме Stripe…</> : <><CreditCard size={18} /> Продължи към Stripe</>}
    </button>
  )
}

function MobilePaymentBar({ amount, status, unavailable, onClick, describedBy, message = '' }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-18px_44px_-30px_rgba(13,35,64,0.5)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto max-w-2xl">
        {message && <p role="alert" aria-live="assertive" className="mb-2 line-clamp-2 text-xs leading-4 text-red-700">{message}</p>}
        <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,auto)] sm:gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Общо</div>
            <div className="mt-0.5 break-words text-sm font-semibold leading-5 text-ink">{amount}</div>
          </div>
          <PaymentButton status={status} unavailable={unavailable} onClick={onClick} describedBy={describedBy} />
        </div>
      </div>
    </div>
  )
}

function Notice({ icon: Icon, tone = 'warning', role = 'status', children }) {
  const toneClass = tone === 'error'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-amber-200 bg-amber-50 text-amber-800'
  return (
    <div role={role} aria-live={role === 'alert' ? 'assertive' : 'polite'} className={`mt-4 flex items-start gap-2.5 rounded-2xl border p-3 text-sm leading-5 ${toneClass}`}>
      <Icon size={17} className="mt-0.5 shrink-0" />
      <p>{children}</p>
    </div>
  )
}

function DetailsSection({ title, children }) {
  return (
    <section className="mt-5 rounded-2xl border border-line bg-soft/55 p-4 sm:p-5">
      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function CompactList({ title, items }) {
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-soft/55 p-4">
      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{title}</h3>
      <ul className="mt-3 grid gap-2 text-sm leading-5 text-ink/80">
        {items.map((item, index) => <li key={`${item}-${index}`} className="break-words">{item}</li>)}
      </ul>
    </section>
  )
}

function CheckoutShell({ children, withMobileAction = false, compact = false }) {
  return (
    <section className={`section ${compact ? '' : 'min-h-[calc(100vh-var(--header-h,0px))]'} bg-soft !py-6 sm:!py-8 lg:!py-10 ${withMobileAction ? '!pb-[calc(10rem+env(safe-area-inset-bottom))] lg:!pb-10' : ''}`}>
      <div className="container-page">{children}</div>
    </section>
  )
}

function CheckoutStatePage({ icon: Icon = Loader2, iconClassName = '', status = '', tone = 'neutral', role = 'status', busy = false, compact = false, eyebrow = 'Плащане', title, description, children }) {
  const loading = status === 'loading'
  const toneClasses = {
    neutral: 'border-line bg-soft text-accentDeep',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-green-200 bg-green-50 text-green-700',
  }

  return (
    <CheckoutShell compact={compact}>
      <div className="mx-auto max-w-3xl rounded-3xl border border-line bg-paper p-6 shadow-[0_24px_70px_-54px_rgba(13,35,64,0.4)] sm:p-7">
        <div role={role} aria-live={role === 'alert' ? 'assertive' : 'polite'} aria-busy={loading || busy}>
          <div className={`grid h-12 w-12 place-items-center rounded-2xl border ${toneClasses[tone] || toneClasses.neutral}`}>
            <Icon size={22} className={`${loading ? 'animate-spin motion-reduce:animate-none' : ''} ${iconClassName}`} />
          </div>
          <div className="eyebrow mt-5">{eyebrow}</div>
          <h1 className="mt-2 break-words font-display text-3xl leading-tight text-ink sm:text-4xl">{title}</h1>
          {description && <p className="mt-3 max-w-xl text-sm leading-6 text-muted sm:text-base">{description}</p>}
        </div>
        {children && <div className="mt-6 flex flex-wrap items-center gap-3">{children}</div>}
      </div>
    </CheckoutShell>
  )
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-soft p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">
        <Icon size={16} className="shrink-0 text-accentDeep" />
        <span>{label}</span>
      </div>
      <div className="mt-2 break-words text-sm font-semibold text-ink">{value}</div>
    </div>
  )
}
