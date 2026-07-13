import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, ArrowRight, CircleAlert, Clock3, CreditCard, ListChecks, RefreshCw } from 'lucide-react'
import { useAccount } from '../lib/account.js'
import { formatOrderDate, formatOrderMoney, loadMyOrdersWorkspace } from '../lib/orders.js'
import { buildOrderListItem, groupOrderListItems } from '../lib/order-workspace.js'

const FILTERS = [
  { id: 'all', label: 'Всички' },
  { id: 'action', label: 'Изискват действие' },
  { id: 'active', label: 'Активни' },
  { id: 'history', label: 'Завършени' },
]

const GROUP_DETAILS = {
  action: {
    title: 'Изискват действие от мен',
    description: 'Тези поръчки имат конкретна следваща стъпка за теб.',
    icon: CircleAlert,
  },
  active: {
    title: 'Активни',
    description: 'Работата продължава; виж какво се очаква по-нататък.',
    icon: Clock3,
  },
  history: {
    title: 'История',
    description: 'Завършени, отменени и възстановени поръчки.',
    icon: Archive,
  },
}

export default function MyOrders() {
  const { session, account, loading } = useAccount()
  const userId = session?.user?.id || ''
  const role = account?.role === 'specialist' ? 'partner' : 'client'
  const [orders, setOrders] = useState([])
  const [milestonesByOrder, setMilestonesByOrder] = useState(new Map())
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  async function load() {
    if (!userId) return
    setStatus('loading')
    setError('')
    try {
      const result = await loadMyOrdersWorkspace(userId, role)
      setOrders(result.orders)
      setMilestonesByOrder(result.milestonesByOrder)
      setStatus('ready')
    } catch (loadError) {
      setStatus('error')
      setError(loadError.message || 'Поръчките не се заредиха.')
    }
  }

  useEffect(() => {
    if (!loading && userId) load()
  }, [loading, userId, role]) // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => groupOrderListItems(
    orders.map((order) => buildOrderListItem({
      order,
      milestones: milestonesByOrder.get(order.id) || [],
      role,
    })),
  ), [orders, milestonesByOrder, role])

  if (loading) return <OrdersShell><Panel title="Зареждаме поръчките…" /></OrdersShell>
  if (!session) return <OrdersShell><Panel title="Влез, за да видиш поръчките"><Link to="/login" className="btn btn-primary mt-5">Вход</Link></Panel></OrdersShell>
  if (status === 'loading') return <OrdersShell><Panel title="Зареждаме поръчките…" /></OrdersShell>
  if (status === 'error') return <OrdersShell><Panel title="Поръчките не се заредиха"><p className="mt-2 text-sm leading-6 text-red-700">{error}</p><button type="button" onClick={load} className="btn btn-ghost mt-5"><RefreshCw size={18} aria-hidden="true" />Опитай пак</button></Panel></OrdersShell>

  const counts = Object.fromEntries(Object.entries(grouped).map(([key, items]) => [key, items.length]))
  const visibleGroups = filter === 'all'
    ? ['action', 'active', 'history']
    : [filter]

  return (
    <OrdersShell>
      <header className="rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="eyebrow">Поръчки</div>
            <h1 className="mt-2 font-display text-4xl leading-[1.1] text-ink md:text-5xl">Моите поръчки</h1>
            <p className="mt-3 text-sm leading-6 text-muted md:text-base">Следи текущите задачи, плащанията и напредъка по проектите си.</p>
          </div>
          <button type="button" onClick={load} className="btn btn-ghost min-h-10 self-start px-3 text-sm md:self-auto" aria-label="Обнови поръчките"><RefreshCw size={16} aria-hidden="true" />Обнови</button>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Филтър на поръчките">
          {FILTERS.map((item) => {
            const count = item.id === 'all' ? orders.length : counts[item.id]
            const selected = filter === item.id
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setFilter(item.id)}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentDeep focus-visible:ring-offset-2 ${selected ? 'border-accentDeep bg-accentDeep text-paper' : 'border-line bg-paper text-muted hover:border-accentDeep/45 hover:text-ink'}`}
              >
                {item.label}
                <span className={`rounded-full px-2 py-0.5 text-xs ${selected ? 'bg-paper/15 text-paper' : 'bg-soft text-muted'}`}>{count}</span>
              </button>
            )
          })}
        </div>
      </header>

      {orders.length === 0 ? (
        <EmptyState title="Още няма поръчки" description="Когато приемеш оферта или поръчаш услуга, тя ще се появи тук." />
      ) : (
        <div className="mt-6 space-y-8">
          {visibleGroups.map((group) => grouped[group].length > 0 && <OrderGroup key={group} group={group} items={grouped[group]} />)}
          {visibleGroups.every((group) => grouped[group].length === 0) && (
            <EmptyState title="Няма поръчки в този филтър" description="Избери друг филтър, за да видиш останалите си поръчки." action={() => setFilter('all')} />
          )}
        </div>
      )}
    </OrdersShell>
  )
}

function OrderGroup({ group, items }) {
  const detail = GROUP_DETAILS[group]
  const Icon = detail.icon
  return (
    <section aria-labelledby={`orders-${group}-title`}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Icon size={17} className={group === 'action' ? 'text-accentDeep' : 'text-muted'} aria-hidden="true" /><h2 id={`orders-${group}-title`}>{detail.title}</h2><span className="rounded-full bg-soft px-2 py-0.5 text-xs font-medium text-muted">{items.length}</span></div>
          <p className="mt-1 text-sm text-muted">{detail.description}</p>
        </div>
      </div>
      <div className="grid gap-3">
        {items.map((item) => <OrderCard key={item.order.id} item={item} />)}
      </div>
    </section>
  )
}

function OrderCard({ item }) {
  const { order, primaryAction, group } = item
  const isAction = group === 'action'
  const isDisputed = order.status === 'disputed'
  const cardClassName = isAction
    ? 'border-accentDeep/45 bg-accentSoft/45 shadow-[0_16px_38px_-32px_rgba(22,62,162,0.65)]'
    : group === 'active'
      ? 'border-accentDeep/25 bg-paper'
      : 'border-line bg-paper/80'

  return (
    <article className={`rounded-3xl border p-5 md:p-6 ${cardClassName}`}>
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {isAction && <span className="inline-flex items-center gap-1.5 rounded-full bg-accentDeep px-2.5 py-1 text-xs font-semibold text-paper"><CircleAlert size={14} aria-hidden="true" />Изисква действие</span>}
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${isDisputed ? 'bg-red-50 text-red-700' : isAction ? 'bg-paper text-accentDeep ring-1 ring-accentDeep/20' : 'bg-soft text-muted'}`}>{item.statusLabel}</span>
            <span className="inline-flex items-center gap-1 text-xs text-muted"><Clock3 size={14} aria-hidden="true" />Обновена {formatOrderDate(item.updatedAt)}</span>
          </div>

          <h3 className="mt-3 break-words font-display text-[1.9rem] leading-[1.1] text-ink md:text-[2.1rem]">{order.title}</h3>
          <div className={`mt-4 rounded-2xl border p-4 ${isAction ? 'border-accentDeep/20 bg-paper/75' : 'border-line bg-soft/45'}`}>
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Следваща стъпка</div>
            <p className="mt-1 break-words text-sm leading-6 text-ink">{item.nextStep || 'Отвори поръчката, за да видиш актуалния статус.'}</p>
            {item.waitingFor && <div className="mt-2 text-xs font-medium text-muted">{item.waitingFor}</div>}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
            {order.hasAmount && <span className="inline-flex items-center gap-2 rounded-full bg-soft px-3 py-1.5"><CreditCard size={15} className="text-accentDeep" aria-hidden="true" />{formatOrderMoney(order.amountTotal, order.currency)}</span>}
            {item.totalCount > 0 && <span className="inline-flex items-center gap-2 rounded-full bg-soft px-3 py-1.5"><ListChecks size={15} className="text-accentDeep" aria-hidden="true" />{item.acceptedCount} от {item.totalCount} етапа приети</span>}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 lg:items-end">
          {primaryAction ? (
            <Link to={primaryAction.to} className="btn btn-primary min-h-11 justify-center lg:min-w-52"><span>{primaryAction.label}</span><ArrowRight size={17} aria-hidden="true" /></Link>
          ) : (
            <Link to={`/order/${order.id}`} className="btn btn-ghost min-h-11 justify-center lg:min-w-52">Виж поръчката<ArrowRight size={17} aria-hidden="true" /></Link>
          )}
        </div>
      </div>
    </article>
  )
}

function EmptyState({ title, description, action }) {
  return (
    <section className="mt-6 rounded-3xl border border-dashed border-line bg-paper p-8 text-center">
      <h2 className="font-display text-3xl text-ink">{title}</h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">{description}</p>
      {action && <button type="button" onClick={action} className="btn btn-ghost mt-5">Виж всички поръчки</button>}
    </section>
  )
}

function OrdersShell({ children }) {
  return <section className="section min-h-[calc(100vh-var(--header-h,0px))] bg-soft !pt-6 md:!pt-8"><div className="container-page">{children}</div></section>
}

function Panel({ title, children }) {
  return <div className="rounded-3xl border border-line bg-paper p-6 md:p-8"><h1 className="font-display text-3xl text-ink">{title}</h1>{children}</div>
}
