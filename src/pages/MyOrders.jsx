import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, PackageCheck, RefreshCw } from 'lucide-react'
import { useAccount } from '../lib/account.js'
import { ORDER_STATUS_LABELS, formatOrderDate, formatOrderMoney, loadClientOrders, loadPartnerOrders, orderStatusTone } from '../lib/orders.js'

export default function MyOrders() {
  const { session, account, loading } = useAccount()
  const userId = session?.user?.id || ''
  const [clientOrders, setClientOrders] = useState([])
  const [partnerOrders, setPartnerOrders] = useState([])
  const [activeTab, setActiveTab] = useState('client')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  async function load() {
    if (!userId) return
    setStatus('loading')
    setError('')
    try {
      const [clientRows, partnerRows] = await Promise.all([loadClientOrders(userId), loadPartnerOrders(userId)])
      setClientOrders(clientRows)
      setPartnerOrders(partnerRows)
      setStatus('ready')
    } catch (loadError) {
      setStatus('error')
      setError(loadError.message || 'Поръчките не се заредиха.')
    }
  }

  useEffect(() => { if (!loading && userId) load() }, [loading, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const isPartner = account?.role === 'specialist' || partnerOrders.length > 0
  const rows = activeTab === 'partner' ? partnerOrders : clientOrders
  const totals = useMemo(() => ({ client: clientOrders.length, partner: partnerOrders.length }), [clientOrders.length, partnerOrders.length])

  if (loading) return <OrdersShell><Panel title="Зареждаме поръчките…" /></OrdersShell>
  if (!session) return <OrdersShell><Panel title="Влез, за да видиш поръчките"><Link to="/login" className="btn btn-primary mt-5">Вход</Link></Panel></OrdersShell>
  if (status === 'loading') return <OrdersShell><Panel title="Зареждаме поръчките…" /></OrdersShell>
  if (status === 'error') return <OrdersShell><Panel title="Поръчките не се заредиха"><p className="mt-2 text-sm text-red-700">{error}</p><button type="button" onClick={load} className="btn btn-ghost mt-5"><RefreshCw size={18} /> Опитай пак</button></Panel></OrdersShell>

  return (
    <OrdersShell>
      <div className="rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="eyebrow">Поръчки</div>
            <h1 className="mt-2 font-display text-4xl text-ink md:text-5xl">Моите поръчки</h1>
          </div>
          <button type="button" onClick={load} className="btn btn-ghost"><RefreshCw size={18} /> Обнови</button>
        </div>
        {isPartner && (
          <div className="mt-5 flex flex-wrap gap-2 rounded-2xl bg-soft p-1">
            <TabButton active={activeTab === 'client'} onClick={() => setActiveTab('client')} label={`Като клиент · ${totals.client}`} />
            <TabButton active={activeTab === 'partner'} onClick={() => setActiveTab('partner')} label={`Като партньор · ${totals.partner}`} />
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-4">
        {rows.map(order => <OrderCard key={order.id} order={order} />)}
        {rows.length === 0 && <div className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">Още няма поръчки в този списък.</div>}
      </div>
    </OrdersShell>
  )
}

function OrdersShell({ children }) {
  return <section className="section bg-soft min-h-[calc(100vh-var(--header-h,0px))]"><div className="container-page">{children}</div></section>
}

function Panel({ title, children }) {
  return <div className="rounded-3xl border border-line bg-paper p-6 md:p-8"><h1 className="font-display text-3xl text-ink">{title}</h1>{children}</div>
}

function TabButton({ active, onClick, label }) {
  return <button type="button" onClick={onClick} className={`rounded-full px-4 py-2 text-sm transition ${active ? 'bg-ink text-paper' : 'text-muted hover:bg-paper hover:text-ink'}`}>{label}</button>
}

function OrderCard({ order }) {
  return (
    <article className="rounded-3xl border border-line bg-paper p-5 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs ${orderStatusTone(order.status)}`}>{ORDER_STATUS_LABELS[order.status] || order.status}</span>
            <span className="text-xs text-muted">{formatOrderDate(order.createdAt)}</span>
          </div>
          <h2 className="mt-3 font-display text-3xl text-ink">{order.title}</h2>
          {order.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{order.description}</p>}
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
            <span className="inline-flex items-center gap-2 rounded-full bg-soft px-3 py-1"><CreditCard size={15} /> {formatOrderMoney(order.amountTotal, order.currency)}</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-soft px-3 py-1"><PackageCheck size={15} /> {order.deliverables.length} точки</span>
          </div>
        </div>
        <Link to={`/order/${order.id}`} className="btn btn-primary shrink-0 justify-center">Отвори</Link>
      </div>
    </article>
  )
}