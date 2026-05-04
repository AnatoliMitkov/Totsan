import { useEffect, useMemo, useState } from 'react'
import { Mail, RefreshCcw, Search } from 'lucide-react'
import { ADMIN_INPUT_CLASS, ADMIN_SELECT_CLASS, INQUIRY_STATUS_LABELS, contactHref, formatAdminDate, loadInquiries, matchesSearch, paginateRows, updateInquiryStatus } from '../../lib/admin.js'

export default function InquiriesManager({ globalQuery = '' }) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setStatus('loading')
    setError('')
    try {
      setRows(await loadInquiries())
      setStatus('ready')
    } catch (loadError) {
      setError(loadError.message || 'Запитванията не се заредиха.')
      setStatus('error')
    }
  }

  const filtered = useMemo(() => rows.filter((row) => {
    if (statusFilter !== 'all' && row.status !== statusFilter) return false
    return matchesSearch(row, query || globalQuery, ['name', 'contact', 'message', 'source', 'target_slug', 'layer_slug'])
  }), [rows, query, globalQuery, statusFilter])

  const pageData = useMemo(() => paginateRows(filtered, page), [filtered, page])
  useEffect(() => { setPage(1) }, [query, globalQuery, statusFilter])

  async function changeStatus(row, nextStatus) {
    setMessage('Запазваме статус…')
    try {
      await updateInquiryStatus(row.id, nextStatus)
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: nextStatus } : item))
      setMessage('Статусът е обновен и записан в audit log.')
    } catch (actionError) {
      setMessage(actionError.message || 'Статусът не се обнови.')
    }
  }

  if (status === 'loading') return <Panel title="Зареждаме запитванията…" />
  if (status === 'error') return <Panel title="Запитванията не се заредиха"><p className="text-sm text-red-700">{error}</p><button type="button" onClick={load} className="btn btn-ghost mt-5">Опитай пак</button></Panel>

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div><div className="eyebrow">Запитвания</div><h2 className="mt-2 font-display text-3xl text-ink">Входящи заявки от сайта</h2></div>
          <button type="button" onClick={load} className="btn btn-ghost self-start"><RefreshCcw size={17} /> Обнови</button>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem]">
          <label className="relative block text-sm font-medium text-ink">Търсене<Search size={17} className="pointer-events-none absolute left-4 top-[2.35rem] text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} className={`${ADMIN_INPUT_CLASS} pl-11`} placeholder="Име, контакт, съобщение…" /></label>
          <label className="block text-sm font-medium text-ink">Статус<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={`${ADMIN_SELECT_CLASS} mt-2 w-full rounded-2xl`}><option value="all">Всички</option>{Object.entries(INQUIRY_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        {message && <div className="mt-4 text-sm text-muted">{message}</div>}
      </div>

      <div className="space-y-3">
        {pageData.rows.map((row) => (
          <article key={row.id} className="rounded-3xl border border-line bg-paper p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="font-display text-2xl text-ink">{row.name}</div>
                <a href={contactHref(row.contact)} className="mt-1 inline-flex items-center gap-2 text-sm text-muted hover:text-accent"><Mail size={16} /> {row.contact}</a>
              </div>
              <select value={row.status} onChange={(event) => changeStatus(row, event.target.value)} className={ADMIN_SELECT_CLASS}>{Object.entries(INQUIRY_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm text-ink/80">{row.message}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted"><span>{formatAdminDate(row.created_at)}</span><span>· {row.source || 'contact_form'}</span>{row.layer_slug && <span>· слой: {row.layer_slug}</span>}{row.target_slug && <span>· към: {row.target_slug}</span>}</div>
          </article>
        ))}
        {pageData.rows.length === 0 && <Empty text="Няма запитвания по тези филтри." />}
      </div>
      <Pager current={pageData.currentPage} total={pageData.totalPages} onChange={setPage} />
    </section>
  )
}

function Pager({ current, total, onChange }) {
  if (total <= 1) return null
  return <div className="flex items-center justify-end gap-2"><button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => onChange(current - 1)} disabled={current <= 1}>Назад</button><span className="text-sm text-muted">{current} / {total}</span><button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => onChange(current + 1)} disabled={current >= total}>Напред</button></div>
}

function Empty({ text }) { return <div className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">{text}</div> }
function Panel({ title, children }) { return <div className="rounded-3xl border border-line bg-paper p-6"><h2 className="font-display text-2xl text-ink">{title}</h2>{children && <div className="mt-3">{children}</div>}</div> }