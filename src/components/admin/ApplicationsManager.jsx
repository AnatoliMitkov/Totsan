import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, RefreshCcw, Search, XCircle } from 'lucide-react'
import { ADMIN_INPUT_CLASS, ADMIN_SELECT_CLASS, APPLICATION_STATUS_LABELS, approveSpecialist, formatAdminDate, loadPartnerApplications, matchesSearch, paginateRows, rejectSpecialist } from '../../lib/admin.js'

export default function ApplicationsManager({ globalQuery = '' }) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setStatus('loading')
    setError('')
    try {
      setRows(await loadPartnerApplications())
      setStatus('ready')
    } catch (loadError) {
      setError(loadError.message || 'Кандидатурите не се заредиха.')
      setStatus('error')
    }
  }

  const filtered = useMemo(() => rows.filter((row) => {
    if (statusFilter !== 'all' && row.status !== statusFilter) return false
    return matchesSearch(row, query || globalQuery, ['name', 'company', 'email', 'phone', 'about', 'layer_slug'])
  }), [rows, query, globalQuery, statusFilter])

  const pageData = useMemo(() => paginateRows(filtered, page), [filtered, page])
  useEffect(() => { setPage(1) }, [query, globalQuery, statusFilter])

  async function approve(row) {
    setMessage('Одобряваме специалист…')
    try {
      await approveSpecialist(row.id)
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: 'approved', reviewed_at: new Date().toISOString() } : item))
      setMessage('Кандидатурата е одобрена, акаунтът е обновен и е създаден скрит профил при нужда.')
    } catch (actionError) {
      setMessage(actionError.message || 'Одобрението не успя.')
    }
  }

  async function reject(row) {
    setMessage('Отхвърляме кандидатура…')
    try {
      await rejectSpecialist(row.id)
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: 'rejected', reviewed_at: new Date().toISOString() } : item))
      setMessage('Кандидатурата е отхвърлена и действието е записано.')
    } catch (actionError) {
      setMessage(actionError.message || 'Отхвърлянето не успя.')
    }
  }

  if (status === 'loading') return <Panel title="Зареждаме кандидатурите…" />
  if (status === 'error') return <Panel title="Кандидатурите не се заредиха"><p className="text-sm text-red-700">{error}</p><button type="button" onClick={load} className="btn btn-ghost mt-5">Опитай пак</button></Panel>

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><div className="eyebrow">Кандидатури</div><h2 className="mt-2 font-display text-3xl text-ink">Партньори за одобрение</h2></div><button type="button" onClick={load} className="btn btn-ghost self-start"><RefreshCcw size={17} /> Обнови</button></div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem]"><label className="relative block text-sm font-medium text-ink">Търсене<Search size={17} className="pointer-events-none absolute left-4 top-[2.35rem] text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} className={`${ADMIN_INPUT_CLASS} pl-11`} placeholder="Име, фирма, имейл…" /></label><label className="block text-sm font-medium text-ink">Статус<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={`${ADMIN_SELECT_CLASS} mt-2 w-full rounded-2xl`}><option value="all">Всички</option>{Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        {message && <div className="mt-4 text-sm text-muted">{message}</div>}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {pageData.rows.map((row) => (
          <article key={row.id} className="rounded-3xl border border-line bg-paper p-5">
            <div className="flex items-start justify-between gap-4"><div><div className="font-display text-2xl text-ink">{row.name}</div><div className="mt-1 text-sm text-muted">{row.company || 'Без фирма'} · {row.email}</div>{row.phone && <div className="text-sm text-muted">{row.phone}</div>}</div><StatusPill value={row.status} /></div>
            {row.about && <p className="mt-4 whitespace-pre-wrap text-sm text-ink/80">{row.about}</p>}
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted"><span>{formatAdminDate(row.created_at)}</span>{row.layer_slug && <span>· слой: {row.layer_slug}</span>}{!row.user_id && <span className="text-amber-700">· без свързан акаунт</span>}</div>
            {row.status === 'pending' && <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => approve(row)} disabled={!row.user_id} className="btn btn-primary !py-2 text-sm disabled:opacity-50"><CheckCircle2 size={17} /> Одобри</button><button type="button" onClick={() => reject(row)} className="btn btn-ghost !py-2 text-sm"><XCircle size={17} /> Отхвърли</button></div>}
          </article>
        ))}
        {pageData.rows.length === 0 && <Empty text="Няма кандидатури по тези филтри." />}
      </div>
      <Pager current={pageData.currentPage} total={pageData.totalPages} onChange={setPage} />
    </section>
  )
}

function StatusPill({ value }) {
  const tones = { approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', pending: 'bg-amber-100 text-amber-900' }
  return <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${tones[value] || tones.pending}`}>{APPLICATION_STATUS_LABELS[value] || value}</span>
}

function Pager({ current, total, onChange }) { if (total <= 1) return null; return <div className="flex items-center justify-end gap-2"><button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => onChange(current - 1)} disabled={current <= 1}>Назад</button><span className="text-sm text-muted">{current} / {total}</span><button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => onChange(current + 1)} disabled={current >= total}>Напред</button></div> }
function Empty({ text }) { return <div className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">{text}</div> }
function Panel({ title, children }) { return <div className="rounded-3xl border border-line bg-paper p-6"><h2 className="font-display text-2xl text-ink">{title}</h2>{children && <div className="mt-3">{children}</div>}</div> }