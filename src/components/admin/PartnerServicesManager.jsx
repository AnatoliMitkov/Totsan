import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Eye, RefreshCw, Search } from 'lucide-react'
import { ADMIN_INPUT_CLASS, formatAdminDate } from '../../lib/admin.js'
import { SERVICE_STATUS_LABELS, loadAdminPartnerServices, packagePriceLabel } from '../../lib/partner-services.js'

const STATUS_FILTERS = [
  ['all', 'Всички'],
  ['pending', 'Чакащи'],
  ['approved', 'Одобрени'],
  ['rejected', 'Върнати'],
  ['draft', 'Чернови'],
]

export default function PartnerServicesManager({ globalQuery }) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [localQuery, setLocalQuery] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setStatus('loading')
    setError('')
    try {
      const data = await loadAdminPartnerServices()
      setRows(data)
      setStatus('ready')
    } catch (loadError) {
      setError(loadError.message || 'Услугите не се заредиха.')
      setStatus('error')
    }
  }

  const filtered = useMemo(() => {
    const needle = `${globalQuery || ''} ${localQuery || ''}`.trim().toLowerCase()
    return rows.filter((row) => {
      if (filter !== 'all' && row.moderationStatus !== filter) return false
      if (!needle) return true
      return `${row.title} ${row.subtitle} ${row.profile?.name || ''} ${row.tags.join(' ')}`.toLowerCase().includes(needle)
    })
  }, [filter, globalQuery, localQuery, rows])

  if (status === 'loading') return <Panel title="Зареждаме услугите…" />
  if (status === 'error') return <Panel title="Услугите не се заредиха"><p className="text-sm text-red-700">{error}</p><button type="button" onClick={load} className="btn btn-ghost mt-5">Опитай пак</button></Panel>

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="eyebrow">Управление</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Партньорски услуги</h2>
            <p className="mt-2 text-sm text-muted">Следи публичните услуги, черновите и партньорите без отделна опашка за одобрение.</p>
          </div>
          <button type="button" onClick={load} className="btn btn-ghost"><RefreshCw size={18} /> Обнови</button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {STATUS_FILTERS.map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-4 py-2 text-sm transition ${filter === value ? 'bg-ink text-paper' : 'bg-soft text-muted hover:text-ink'}`}>{label}</button>
          ))}
        </div>
        <label className="relative mt-5 block max-w-xl">
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input value={localQuery} onChange={event => setLocalQuery(event.target.value)} className={`${ADMIN_INPUT_CLASS} !mt-0 pl-11`} placeholder="Търси по услуга, партньор или таг" />
        </label>
      </div>

      <div className="grid gap-4">
        {filtered.map(service => (
          <article key={service.id} className="rounded-3xl border border-line bg-paper p-5 md:p-6">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_14rem]">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="rounded-full bg-soft px-3 py-1">{SERVICE_STATUS_LABELS[service.moderationStatus] || service.moderationStatus}</span>
                  <span className="inline-flex items-center gap-1"><Clock size={14} /> {formatAdminDate(service.createdAt)}</span>
                  {service.isPublished && <span className="rounded-full bg-green-50 px-3 py-1 text-green-700">Публична</span>}
                </div>
                <h3 className="mt-3 font-display text-3xl text-ink">{service.title}</h3>
                <p className="mt-2 text-sm text-muted">{service.subtitle || 'Без подзаглавие'}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Info label="Партньор" value={service.profile?.name || '—'} />
                  <Info label="Цена" value={packagePriceLabel(service)} />
                  <Info label="Оферта" value={service.packages.some(item => item.isActive) ? 'Активна' : 'Липсва'} />
                </div>
                {service.moderationNote && <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">Последна бележка: {service.moderationNote}</p>}
              </div>
              <div className="space-y-3">
                {service.isPublished && <Link to={`/uslugi/${service.slug}`} className="btn btn-ghost w-full justify-center"><Eye size={18} /> Публична страница</Link>}
                {!service.isPublished && <div className="rounded-2xl border border-line bg-soft p-4 text-sm text-muted">Тази услуга е запазена като чернова от партньора.</div>}
              </div>
            </div>
          </article>
        ))}
        {filtered.length === 0 && <div className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">Няма услуги в този филтър.</div>}
      </div>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-soft p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 text-sm font-medium text-ink">{value}</div>
    </div>
  )
}

function Panel({ title, children }) {
  return <div className="rounded-3xl border border-line bg-paper p-6"><h2 className="font-display text-2xl text-ink">{title}</h2>{children && <div className="mt-3">{children}</div>}</div>
}
