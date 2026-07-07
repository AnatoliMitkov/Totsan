import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, CreditCard, MapPin, MessageSquare, PackageCheck, ShieldCheck } from 'lucide-react'
import { useAccount } from '../lib/account.js'
import { ORDER_ACTION_LABELS, ORDER_STATUS_LABELS, formatOrderDate, formatOrderMoney, loadOrderDetails, orderStatusTone } from '../lib/orders.js'
import { PROPERTY_TYPES, getLocationAccessSummary, getSafeGoogleMapsUrl } from '../lib/projects.js'
import { runOrderAction } from '../lib/payments.js'
import { loadOrderReview } from '../lib/reviews.js'
import ReviewForm from '../components/reviews/ReviewForm.jsx'

export default function Order() {
  const { orderId = '' } = useParams()
  const { session, loading, isAdmin } = useAccount()
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
  const isAdminView = Boolean(isAdmin)
  const role = order?.clientId === userId ? 'client' : order?.partnerId === userId ? 'partner' : 'guest'
  const checkoutPath = useMemo(() => checkoutPathForOrder(order), [order])
  const actions = useMemo(() => buildActions(order, role, checkoutPath), [order, role, checkoutPath])
  const visibleEvents = useMemo(() => dedupeEvents(details.events), [details.events])
  const visiblePayments = useMemo(() => dedupePayments(details.payments), [details.payments])
  const projectLocation = details.projectLocation

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
            <Info icon={PackageCheck} label="Партньор ID" value={shortId(order.partnerId)} />
            <Info icon={Clock} label="Срок" value={order.deliveryDueAt ? formatOrderDate(order.deliveryDueAt) : 'По уговорка'} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PartyCard label="Клиент" party={order.clientAccount} fallbackId={order.clientId} showEmail={isAdminView} />
            <PartyCard label="Партньор" party={order.partnerAccount} fallbackId={order.partnerId} showEmail={isAdminView} />
          </div>

          {projectLocation && <OrderLocationCard location={projectLocation} />}

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
              {visibleEvents.map((event) => <EventRow key={event.id} event={event} />)}
              {visibleEvents.length === 0 && <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-muted">Още няма събития.</div>}
            </div>
          </div>

          <ReviewForm order={order} review={review} role={role} onChange={setReview} />
        </section>

        <aside className="lg:col-span-4">
          <div className="space-y-5 lg:sticky lg:top-24">
            <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
              <div className="eyebrow">Действия</div>
              <div className="mt-3 font-display text-4xl text-ink">{formatOrderMoney(order.amountTotal, order.currency)}</div>
              <p className="mt-2 text-sm text-muted">Клиентът плаща през Totsan. Сумата се превежда към партньора след потвърждение, че поръчката е завършена.</p>
              <p className="mt-3 rounded-2xl border border-line bg-soft p-3 text-xs leading-5 text-muted">
                Партньорската сума се освобождава чрез платежния профил след приспадане на приложимите Stripe такси и 2% платформена комисионна.
              </p>
              {message && <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{message}</div>}
              {role === 'client' && order.status === 'pending_payment' && checkoutPath && (
                <Link to={checkoutPath} className="btn btn-primary mt-3 w-full justify-center"><CreditCard size={18} /> Плати</Link>
              )}
              {order.conversationId && <Link to={`/inbox/${order.conversationId}`} className="btn btn-ghost mt-3 w-full justify-center"><MessageSquare size={18} /> Чат</Link>}
              {actions.includes('request_revision') && <textarea rows={3} value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} className="mt-4 w-full rounded-2xl border border-line bg-soft px-4 py-3 text-sm outline-none transition focus:border-ink" placeholder="Какво трябва да се коригира" />}
              <div className="mt-4 grid gap-2">
                {actions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => run(action)}
                    disabled={status === 'saving'}
                    className={['confirm_direct_payment', 'confirm_completed', 'mark_delivered', 'start_work'].includes(action) ? 'btn btn-primary justify-center' : 'btn btn-ghost justify-center'}
                  >
                    {ORDER_ACTION_LABELS[action] || action}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
              <div className="eyebrow">Доказателствена следа</div>
              <p className="mt-2 text-xs leading-5 text-muted">Тук се пазят записите за плащането, освобождаването на сумата към партньора и евентуални възстановявания.</p>
              <div className="mt-4 space-y-3">
                {visiblePayments.map((payment) => <PaymentRow key={payment.id} payment={payment} />)}
                {visiblePayments.length === 0 && <div className="rounded-2xl border border-dashed border-line p-4 text-center text-sm text-muted">Няма добавено потвърждение или документ.</div>}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </OrderShell>
  )
}

function checkoutPathForOrder(order) {
  if (!order) return ''
  if (order.offerId) return `/checkout/offer/${order.offerId}`
  if (order.servicePackageId) return `/checkout/service/${order.servicePackageId}`
  return ''
}

function buildActions(order, role, checkoutPath = '') {
  if (!order || role === 'guest') return []
  const actions = []
  if (role === 'partner' && order.status === 'pending_payment' && !checkoutPath) actions.push('confirm_direct_payment')
  if (role === 'partner' && order.status === 'paid') actions.push('start_work')
  if (role === 'partner' && ['paid', 'in_progress'].includes(order.status)) actions.push('mark_delivered')
  if (role === 'client' && order.status === 'delivered') actions.push('confirm_completed', 'request_revision')
  if (role === 'client' && order.status === 'pending_payment') actions.push('cancel_pending')
  return actions
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

function PartyCard({ label, party, fallbackId, showEmail = false }) {
  const hasName = Boolean(party?.name)
  const displayName = hasName ? party.name : `ID ${shortId(fallbackId)}`
  const email = party?.email || ''

  return (
    <div className="rounded-2xl border border-line bg-soft p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 text-sm font-medium text-ink break-all">{displayName}</div>
      {showEmail && <div className="mt-1 text-xs text-muted break-all">{email || 'Без имейл'}</div>}
      {!showEmail && <div className="mt-1 text-xs text-muted break-all">ID: {shortId(fallbackId)}</div>}
    </div>
  )
}

function orderExactLocationLabels(propertyType) {
  if (propertyType === 'house') {
    return {
      entrance: 'Двор / портал',
      unit: 'Номер / ориентир',
      showFloor: false,
      showEntrance: true,
      showUnit: true,
    }
  }

  if (propertyType === 'office' || propertyType === 'commercial') {
    return {
      entrance: 'Вход / рецепция / охрана',
      floor: 'Етаж',
      unit: 'Офис / обект №',
      showFloor: true,
      showEntrance: true,
      showUnit: true,
    }
  }

  return {
    entrance: 'Вход',
    floor: 'Етаж',
    unit: 'Апартамент',
    showFloor: true,
    showEntrance: true,
    showUnit: true,
  }
}

function OrderLocationCard({ location }) {
  const access = location?.access || {}
  const exact = location?.exact || {}
  const objectTypeLabel = PROPERTY_TYPES.find((item) => item.value === location.objectType)?.label || ''
  const roughLocation = [location.city, location.district].filter(Boolean).join(', ')
  const accessSummary = getLocationAccessSummary(access, { includeExact: location.canViewExact })
  const mapsUrl = location.canViewExact ? getSafeGoogleMapsUrl(exact) : ''
  const exactLabels = orderExactLocationLabels(location.objectType)
  const exactRows = [
    { label: 'Точен адрес', value: exact.exactAddress },
    ...(exactLabels.showEntrance ? [{ label: exactLabels.entrance, value: exact.entrance }] : []),
    ...(exactLabels.showFloor ? [{ label: exactLabels.floor, value: exact.floor }] : []),
    ...(exactLabels.showUnit ? [{ label: exactLabels.unit, value: exact.unitNumber }] : []),
    { label: 'Телефон за оглед', value: exact.visitPhone },
    { label: 'Инструкции', value: exact.accessInstructions, wide: true },
  ].filter((item) => String(item.value || '').trim())

  return (
    <div className="mt-5 rounded-3xl border border-line bg-soft p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
        <MapPin size={16} className="text-accentDeep" />
        Локация и достъп до обекта
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <LocationMini label="Локация" value={roughLocation || 'Не е посочена'} />
        <LocationMini label="Тип обект" value={objectTypeLabel || 'Не е посочен'} />
        <LocationMini label="Достъп" value={accessSummary || 'Няма допълнителни детайли'} className="sm:col-span-2" />
      </div>

      {location.canViewExact ? (
        <div className="mt-5 rounded-2xl border border-line bg-paper p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-accentDeep">
            <ShieldCheck size={15} />
            Точна локация
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Тази информация е споделена само с партньора по поръчката.
          </p>
          {exactRows.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {exactRows.map((item) => (
                <LocationMini key={item.label} label={item.label} value={item.value} className={item.wide ? 'sm:col-span-2' : ''} />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-line p-4 text-sm text-muted">Клиентът още не е добавил точен адрес.</div>
          )}
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-4 w-full justify-center sm:w-auto">
              <MapPin size={16} />
              Отвори Google Maps
            </a>
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-line bg-paper p-4 text-sm leading-relaxed text-muted">
          Точният адрес ще бъде видим след потвърдена поръчка или разрешен оглед.
        </div>
      )}
    </div>
  )
}

function LocationMini({ label, value, className = '' }) {
  return (
    <div className={className}>
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-ink">{value}</div>
    </div>
  )
}

function EventRow({ event }) {
  const count = Number(event.repeatCount || 1)
  const fromLabel = event.fromStatus ? (ORDER_STATUS_LABELS[event.fromStatus] || event.fromStatus) : '—'
  const toLabel = event.toStatus ? (ORDER_STATUS_LABELS[event.toStatus] || event.toStatus) : '—'
  const message = orderEventMessage(event)

  return (
    <div className="rounded-2xl border border-line bg-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-ink">
          {message}
          {count > 1 && <span className="ml-2 rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-normal text-muted">x{count}</span>}
        </div>
        <div className="text-xs text-muted">{formatOrderDate(event.createdAt)}</div>
      </div>
      {(event.fromStatus || event.toStatus) && <div className="mt-1 text-xs text-muted">{fromLabel} → {toLabel}</div>}
    </div>
  )
}

function PaymentRow({ payment }) {
  const count = Number(payment.repeatCount || 1)
  const typeLabel = paymentTypeLabel(payment.type)
  const statusLabel = paymentStatusLabel(payment.status)
  const statusTone = paymentStatusTone(payment.status)

  return (
    <div className="rounded-2xl border border-line bg-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-ink">
            {typeLabel}
            {count > 1 && <span className="ml-2 rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-normal text-muted">x{count}</span>}
          </div>
          <div className="mt-1 text-xs text-muted">{formatOrderDate(payment.createdAt)}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right text-sm font-medium text-ink leading-tight">
          <span>{formatOrderMoney(payment.amount, payment.currency)}</span>
          <div className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-normal ${statusTone}`}>{statusLabel}</div>
        </div>
      </div>
    </div>
  )
}

function paymentTypeLabel(value = '') {
  const labels = {
    charge: 'Плащане',
    payout: 'Превод към партньора',
    refund: 'Възстановяване',
  }
  return labels[value] || 'Платежен документ или потвърждение'
}

function paymentStatusLabel(value = '') {
  const labels = {
    pending: 'Обработва се',
    succeeded: 'Успешно',
    failed: 'Неуспешно',
    manual: 'Ръчно',
    cancelled: 'Отказано',
  }
  return labels[value] || value || 'Непознато'
}

function paymentStatusTone(value = '') {
  if (value === 'succeeded') return 'bg-green-100 text-green-800'
  if (value === 'pending') return 'bg-amber-100 text-amber-800'
  if (value === 'failed') return 'bg-red-100 text-red-700'
  if (value === 'manual') return 'bg-blue-100 text-blue-700'
  return 'bg-soft text-muted'
}

function orderEventMessage(event) {
  const messages = {
    order_created: 'Поръчката е създадена',
    checkout_refreshed: 'Стар платежен запис е обновен',
    payment_succeeded: 'Добавено е потвърждение за плащане',
    payment_succeeded_webhook: 'Добавено е автоматично потвърждение',
    payment_intent_succeeded_webhook: 'Добавено е автоматично потвърждение',
    admin_status_update: 'Админ промени статуса',
    start_work: 'Работата е започната',
    mark_delivered: 'Поръчката е маркирана като предадена',
    confirm_completed: 'Поръчката е потвърдена като завършена',
    request_revision: 'Поискана е корекция',
    cancel_pending: 'Неплатената поръчка е отменена',
  }
  return event.message || messages[event.type] || event.type || 'Събитие'
}

function dedupePayments(payments = []) {
  const grouped = new Map()

  payments.forEach((payment) => {
    const key = [
      payment.type || '',
      payment.provider || '',
      payment.status || '',
      payment.amount || 0,
      payment.currency || '',
      paymentExternalId(payment),
    ].join('|')

    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, { ...payment, repeatCount: 1 })
      return
    }

    const newer = new Date(payment.createdAt || 0).getTime() > new Date(existing.createdAt || 0).getTime()
    grouped.set(key, {
      ...(newer ? payment : existing),
      repeatCount: Number(existing.repeatCount || 1) + 1,
    })
  })

  return [...grouped.values()].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
}

function paymentExternalId(payment = {}) {
  const raw = payment.raw || {}
  const paymentIntentId = typeof raw.payment_intent === 'string' ? raw.payment_intent : raw.payment_intent?.id
  const checkoutSessionId = raw.checkout_session_id || raw.id || ''
  return String(paymentIntentId || checkoutSessionId || '')
}

function dedupeEvents(events = []) {
  const grouped = new Map()

  events.forEach((event) => {
    const normalizedType = normalizeOrderEventType(event.type)
    const key = normalizedType === 'payment_succeeded'
      ? [
        normalizedType,
        event.fromStatus || '',
        event.toStatus || '',
        paymentEventId(event),
      ].join('|')
      : [
        normalizedType,
        event.message || '',
        event.fromStatus || '',
        event.toStatus || '',
        event.payload ? JSON.stringify(event.payload) : '',
      ].join('|')

    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, { ...event, repeatCount: 1 })
      return
    }

    const newer = new Date(event.createdAt || 0).getTime() > new Date(existing.createdAt || 0).getTime()
    grouped.set(key, {
      ...(newer ? event : existing),
      repeatCount: Number(existing.repeatCount || 1) + 1,
    })
  })

  return [...grouped.values()].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
}

function normalizeOrderEventType(type = '') {
  if (['payment_succeeded', 'payment_succeeded_webhook', 'payment_intent_succeeded_webhook'].includes(type)) {
    return 'payment_succeeded'
  }
  return type || ''
}

function paymentEventId(event = {}) {
  const payload = event.payload || {}
  const paymentIntent = payload.payment_intent || payload.paymentIntentId || payload.payment_intent_id || ''
  const checkoutSession = payload.checkout_session_id || payload.checkoutSessionId || payload.id || ''
  return String(paymentIntent || checkoutSession || '')
}
