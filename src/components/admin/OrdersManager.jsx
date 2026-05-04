import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, RefreshCw, Search } from 'lucide-react'
import { ADMIN_INPUT_CLASS, ADMIN_SELECT_CLASS, adminUpdateOrderStatus, formatAdminDate, loadAdminOrders } from '../../lib/admin.js'
import { ORDER_STATUS_LABELS, formatOrderMoney, orderStatusTone } from '../../lib/orders.js'

const STATUS_FILTERS = [
  ['all', 'Всички'],
  ['pending_payment', 'Очакват плащане'],
  ['paid', 'Платени'],
  ['in_progress', 'В работа'],
  ['delivered', 'Предадени'],
  ['completed', 'Завършени'],
  ['disputed', 'Спорове'],
  ['refunded', 'Refund'],
]

const STATUS_OPTIONS = ['pending_payment', 'paid', 'in_progress', 'delivered', 'completed', 'disputed', 'refunded', 'cancelled']

export default function OrdersManager({ globalQuery }) {
  const [orders, setOrders] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [localQuery, setLocalQuery] = useState('')
  const [drafts, setDrafts] = useState({})
  const [actionState, setActionState] = useState({ status: 'idle', message: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setStatus('loading')
    setError('')
    try {
      const rows = await loadAdminOrders()
      setOrders(rows)
      setDrafts(Object.fromEntries(rows.map(order => [order.id, { status: order.status, note: '' }])))
      setStatus('ready')
    } catch (loadError) {
      setStatus('error')
      setError(loadError.message || 'Поръчките не се заредиха.')
    }
  }

  const filtered = useMemo(() => {
    const needle = `${globalQuery || ''} ${localQuery || ''}`.trim().toLowerCase()
    return orders.filter((order) => {
      if (filter !== 'all' && order.status !== filter) return false
      if (!needle) return true
      return `${order.title} ${order.description || ''} ${order.id} ${order.client_id} ${order.partner_id}`.toLowerCase().includes(needle)
    })
  }, [filter, globalQuery, localQuery, orders])

  function updateDraft(orderId, key, value) {
    setDrafts(current => ({ ...current, [orderId]: { ...(current[orderId] || {}), [key]: value } }))
  }

  async function saveStatus(order) {
    const draft = drafts[order.id] || { status: order.status, note: '' }
    setActionState({ status: 'saving', message: 'Запазваме статуса…' })
    try {
      await adminUpdateOrderStatus(order.id, draft.status, draft.note)
      await load()
      setActionState({ status: 'saved', message: 'Поръчката е обновена.' })
    } catch (saveError) {
      setActionState({ status: 'error', message: saveError.message || 'Статусът не се запази.' })
    }
  }

  if (status === 'loading') return <Panel title="Зареждаме поръчките…" />
  if (status === 'error') return <Panel title="Поръчките не се заредиха"><p className="text-sm text-red-700">{error}</p><button type="button" onClick={load} className="btn btn-ghost mt-5">Опитай пак</button></Panel>

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="eyebrow">Плащания</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Поръчки и статуси</h2>
            <p className="mt-2 text-sm text-muted">Следи активни поръчки, спорове и refund статуси.</p>
          </div>
          <button type="button" onClick={load} className="btn btn-ghost"><RefreshCw size={18} /> Обнови</button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {STATUS_FILTERS.map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-4 py-2 text-sm transition ${filter === value ? 'bg-ink text-paper' : 'bg-soft text-muted hover:text-ink'}`}>{label}</button>)}
        </div>
        <label className="relative mt-5 block max-w-xl">
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input value={localQuery} onChange={event => setLocalQuery(event.target.value)} className={`${ADMIN_INPUT_CLASS} !mt-0 pl-11`} placeholder="Търси по заглавие или ID" />
        </label>
        {actionState.message && <div className={`mt-4 rounded-2xl p-3 text-sm ${actionState.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-soft text-muted'}`}>{actionState.message}</div>}
      </div>

      <div className="grid gap-4">
        {filtered.map(order => {
          const draft = drafts[order.id] || { status: order.status, note: '' }
          return (
            <article key={order.id} className="rounded-3xl border border-line bg-paper p-5 md:p-6">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs ${orderStatusTone(order.status)}`}>{ORDER_STATUS_LABELS[order.status] || order.status}</span>
                    <span className="text-xs text-muted">{formatAdminDate(order.created_at)}</span>
                  </div>
                  <h3 className="mt-3 font-display text-3xl text-ink">{order.title}</h3>
                  <p className="mt-2 text-sm text-muted">{order.description || 'Без описание'}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Info label="Сума" value={formatOrderMoney(order.amount_total, order.currency)} />
                    <Info label="Клиент" value={shortId(order.client_id)} />
                    <Info label="Партньор" value={shortId(order.partner_id)} />
                  </div>
                </div>
                <div className="space-y-3">
                  <Link to={`/order/${order.id}`} className="btn btn-ghost w-full justify-center"><CreditCard size={18} /> Детайли</Link>
                  <select value={draft.status} onChange={event => updateDraft(order.id, 'status', event.target.value)} className={`${ADMIN_SELECT_CLASS} w-full rounded-2xl px-4 py-3`}>
                    {STATUS_OPTIONS.map(option => <option key={option} value={option}>{ORDER_STATUS_LABELS[option] || option}</option>)}
                  </select>
                  <textarea rows={3} value={draft.note} onChange={event => updateDraft(order.id, 'note', event.target.value)} className={ADMIN_INPUT_CLASS} placeholder="Админ бележка" />
                  <button type="button" onClick={() => saveStatus(order)} disabled={actionState.status === 'saving'} className="btn btn-primary w-full justify-center">Запази статус</button>
                </div>
              </div>
            </article>
          )
        })}
        {filtered.length === 0 && <div className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">Няма поръчки в този филтър.</div>}
      </div>
    </div>
  )
}

function shortId(value = '') {
  return value ? value.slice(0, 8) : '—'
}

function Info({ label, value }) {
  return <div className="rounded-2xl border border-line bg-soft p-4"><div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div><div className="mt-1 text-sm font-medium text-ink">{value}</div></div>
}

function Panel({ title, children }) {
  return <div className="rounded-3xl border border-line bg-paper p-6"><h2 className="font-display text-2xl text-ink">{title}</h2>{children && <div className="mt-3">{children}</div>}</div>
}