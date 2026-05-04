import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, CreditCard, MessageSquare, PackageCheck, RefreshCw } from 'lucide-react'
import { useAccount } from '../lib/account.js'
import { ORDER_ACTION_LABELS, ORDER_STATUS_LABELS, formatOrderDate, formatOrderMoney, loadOrderDetails, orderStatusTone } from '../lib/orders.js'
import { runOrderAction } from '../lib/payments.js'
import { loadOrderReview } from '../lib/reviews.js'
import ReviewForm from '../components/reviews/ReviewForm.jsx'

export default function Order() {
  const { orderId = '' } = useParams()
  const { session, loading } = useAccount()
  const userId = session?.user?.id || ''
  const [details, setDetails] = useState({ order: null, events: [], payments: [] })
  const [review, setReview] = useState(null)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [revisionNote, setRevisionNote] = useState('')

  async function load() {
    if (!orderId || !userId) return
    setStatus('loading')
    setMessage('')
    try {
      const next = await loadOrderDetails(orderId)
      const nextReview = next.order?.status === 'completed' ? await loadOrderReview(orderId) : null
      setDetails(next)
      setReview(nextReview)
      setStatus(next.order ? 'ready' : 'not-found')
    } catch (error) {
      setStatus('error')
      setMessage(error.message || 'Поръчката не се зареди.')
    }
  }

  useEffect(() => { if (!loading && userId) load() }, [loading, userId, orderId]) // eslint-disable-line react-hooks/exhaustive-deps

  const order = details.order
  const role = order?.clientId === userId ? 'client' : order?.partnerId === userId ? 'partner' : 'guest'
  const actions = useMemo(() => buildActions(order, role), [order, role])
  const checkoutPath = order ? checkoutTarget(order) : ''

  async function run(action) {
    if (!order?.id) return
    setStatus('saving')
    setMessage('')
    try {
      await runOrderAction(order.id, action, revisionNote)
      setRevisionNote('')
      await load()
    } catch (error) {
      setStatus('ready')
      setMessage(error.message || 'Статусът не се промени.')
    }
  }

  if (loading) return <OrderShell><Panel title="Зареждаме поръчката…" /></OrderShell>
  if (!session) return <OrderShell><Panel title="Влез, за да видиш поръчката"><Link to="/login" className="btn btn-primary mt-5">Вход</Link></Panel></OrderShell>
  if (status === 'loading') return <OrderShell><Panel title="Зареждаме поръчката…" /></OrderShell>
  if (status === 'not-found' || !order) return <OrderShell><Panel title="Поръчката не е налична"><p className="mt-2 text-sm text-muted">Нямаш достъп или линкът е невалиден.</p></Panel></OrderShell>
  if (status === 'error') return <OrderShell><Panel title="Поръчката не се зареди"><p className="mt-2 text-sm text-red-700">{message}</p></Panel></OrderShell>

  return (
    <OrderShell>
      <Link to="/porachki" className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-ink"><ArrowLeft size={17} /> Моите поръчки</Link>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <section className="lg:col-span-8 rounded-3xl border border-line bg-paper p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="eyebrow">Поръчка</div>
              <h1 className="mt-2 font-display text-4xl leading-tight text-ink md:text-5xl">{order.title}</h1>
              {order.description && <p className="mt-3 max-w-3xl whitespace-pre-wrap text-muted">{order.description}</p>}
            </div>
            <span className={`rounded-full px-3 py-1 text-xs ${orderStatusTone(order.status)}`}>{ORDER_STATUS_LABELS[order.status] || order.status}</span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Info icon={CreditCard} label="Сума" value={formatOrderMoney(order.amountTotal, order.currency)} />
            <Info icon={PackageCheck} label="Партньор" value={shortId(order.partnerId)} />
            <Info icon={Clock} label="Срок" value={order.deliveryDueAt ? formatOrderDate(order.deliveryDueAt) : 'По уговорка'} />
          </div>

          {order.deliverables.length > 0 && (
            <div className="mt-7">
              <div className="eyebrow">Договорено</div>
              <ul className="mt-3 grid gap-2 text-sm text-ink/80">
                {order.deliverables.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accentDeep" /> <span>{item}</span></li>)}
              </ul>
            </div>
          )}

          <div className="mt-8 border-t border-line pt-6">
            <div className="eyebrow">Timeline</div>
            <div className="mt-4 space-y-3">
              {details.events.map(event => <EventRow key={event.id} event={event} />)}
              {details.events.length === 0 && <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-muted">Още няма събития.</div>}
            </div>
          </div>

          <ReviewForm order={order} review={review} role={role} onChange={setReview} />
        </section>

        <aside className="lg:col-span-4">
          <div className="space-y-5 lg:sticky lg:top-24">
            <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
              <div className="eyebrow">Действия</div>
              <div className="mt-3 font-display text-4xl text-ink">{formatOrderMoney(order.amountTotal, order.currency)}</div>
              <p className="mt-2 text-sm text-muted">Такса: {formatOrderMoney(order.platformFee, order.currency)} · към партньора: {formatOrderMoney(order.partnerPayout, order.currency)}</p>
              {message && <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{message}</div>}
              {checkoutPath && order.status === 'pending_payment' && <Link to={checkoutPath} className="btn btn-primary mt-5 w-full justify-center"><CreditCard size={18} /> Плати</Link>}
              {order.conversationId && <Link to={`/inbox/${order.conversationId}`} className="btn btn-ghost mt-3 w-full justify-center"><MessageSquare size={18} /> Чат</Link>}
              {actions.includes('request_revision') && <textarea rows={3} value={revisionNote} onChange={event => setRevisionNote(event.target.value)} className="mt-4 w-full rounded-2xl border border-line bg-soft px-4 py-3 text-sm outline-none transition focus:border-ink" placeholder="Какво трябва да се коригира" />}
              <div className="mt-4 grid gap-2">
                {actions.map(action => <button key={action} type="button" onClick={() => run(action)} disabled={status === 'saving'} className={action === 'confirm_completed' || action === 'mark_delivered' || action === 'start_work' ? 'btn btn-primary justify-center' : 'btn btn-ghost justify-center'}>{ORDER_ACTION_LABELS[action] || action}</button>)}
              </div>
            </div>

            <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
              <div className="eyebrow">Плащания</div>
              <div className="mt-4 space-y-3">
                {details.payments.map(payment => <PaymentRow key={payment.id} payment={payment} />)}
                {details.payments.length === 0 && <div className="rounded-2xl border border-dashed border-line p-4 text-center text-sm text-muted">Няма записи.</div>}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </OrderShell>
  )
}

function buildActions(order, role) {
  if (!order || role === 'guest') return []
  const actions = []
  if (role === 'partner' && order.status === 'paid') actions.push('start_work')
  if (role === 'partner' && ['paid', 'in_progress'].includes(order.status)) actions.push('mark_delivered')
  if (role === 'client' && order.status === 'delivered') actions.push('confirm_completed', 'request_revision')
  if (role === 'client' && order.status === 'pending_payment') actions.push('cancel_pending')
  return actions
}

function checkoutTarget(order) {
  if (order.offerId) return `/checkout/offer/${order.offerId}`
  if (order.servicePackageId) return `/checkout/service/${order.servicePackageId}`
  return ''
}

function shortId(value = '') {
  return value ? value.slice(0, 8) : '—'
}

function OrderShell({ children }) {
  return <section className="section bg-soft min-h-[calc(100vh-var(--header-h,0px))]"><div className="container-page">{children}</div></section>
}

function Panel({ title, children }) {
  return <div className="rounded-3xl border border-line bg-paper p-6 md:p-8"><h1 className="font-display text-3xl text-ink">{title}</h1>{children}</div>
}

function Info({ icon: Icon, label, value }) {
  return <div className="rounded-2xl border border-line bg-soft p-4"><Icon size={17} className="text-accentDeep" /><div className="mt-2 text-xs uppercase tracking-[0.14em] text-muted">{label}</div><div className="mt-1 text-sm font-medium text-ink">{value}</div></div>
}

function EventRow({ event }) {
  return (
    <div className="rounded-2xl border border-line bg-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-ink">{event.message || event.type}</div>
        <div className="text-xs text-muted">{formatOrderDate(event.createdAt)}</div>
      </div>
      {(event.fromStatus || event.toStatus) && <div className="mt-1 text-xs text-muted">{event.fromStatus || '—'} → {event.toStatus || '—'}</div>}
    </div>
  )
}

function PaymentRow({ payment }) {
  return (
    <div className="rounded-2xl border border-line bg-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-ink">{payment.type} · {payment.provider}</div>
          <div className="mt-1 text-xs text-muted">{formatOrderDate(payment.createdAt)}</div>
        </div>
        <div className="text-right text-sm font-medium text-ink">{formatOrderMoney(payment.amount, payment.currency)}<div className="text-xs font-normal text-muted">{payment.status}</div></div>
      </div>
    </div>
  )
}