import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, RefreshCw } from 'lucide-react'
import { ORDER_STATUS_LABELS, formatOrderDate, formatOrderMoney, loadPartnerOrders, orderStatusTone } from '../../lib/orders.js'

export default function PartnerOrders({ userId }) {
  const [orders, setOrders] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  async function load() {
    if (!userId) return
    setStatus('loading')
    setError('')
    try {
      const rows = await loadPartnerOrders(userId)
      setOrders(rows)
      setStatus('ready')
    } catch (loadError) {
      setStatus('error')
      setError(loadError.message || 'Поръчките не се заредиха.')
    }
  }

  useEffect(() => { load() }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading') return <Panel title="Зареждаме поръчките…" />
  if (status === 'error') return <Panel title="Поръчките не се заредиха"><p className="text-sm text-red-700">{error}</p><button type="button" onClick={load} className="btn btn-ghost mt-5"><RefreshCw size={18} /> Опитай пак</button></Panel>

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="eyebrow">Поръчки</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Работа към клиенти</h2>
            <p className="mt-2 text-sm text-muted">Поръчките от оферти и партньорски услуги се управляват от детайлната страница.</p>
          </div>
          <button type="button" onClick={load} className="btn btn-ghost"><RefreshCw size={18} /> Обнови</button>
        </div>
      </div>

      <div className="grid gap-4">
        {orders.map(order => <PartnerOrderCard key={order.id} order={order} />)}
        {orders.length === 0 && <div className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">Все още няма активни поръчки.</div>}
      </div>
    </div>
  )
}

function PartnerOrderCard({ order }) {
  return (
    <article className="rounded-3xl border border-line bg-paper p-5 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs ${orderStatusTone(order.status)}`}>{ORDER_STATUS_LABELS[order.status] || order.status}</span>
            <span className="text-xs text-muted">{formatOrderDate(order.createdAt)}</span>
          </div>
          <h3 className="mt-3 font-display text-3xl text-ink">{order.title}</h3>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-soft px-3 py-1 text-sm text-muted"><CreditCard size={15} /> {formatOrderMoney(order.partnerPayout, order.currency)} към партньора</div>
        </div>
        <Link to={`/order/${order.id}`} className="btn btn-primary shrink-0 justify-center">Управлявай</Link>
      </div>
    </article>
  )
}

function Panel({ title, children }) {
  return <div className="rounded-3xl border border-line bg-paper p-6"><h2 className="font-display text-2xl text-ink">{title}</h2>{children && <div className="mt-3">{children}</div>}</div>
}