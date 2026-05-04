import { useEffect, useMemo, useState } from 'react'
import { RefreshCcw, Search, ShieldCheck } from 'lucide-react'
import { ADMIN_INPUT_CLASS, formatAdminDate, loadAuditLog, matchesSearch, paginateRows } from '../../lib/admin.js'

export default function AuditLog({ globalQuery = '' }) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => { load() }, [])

  async function load() {
    setStatus('loading')
    setError('')
    try {
      setRows(await loadAuditLog())
      setStatus('ready')
    } catch (loadError) {
      setError(loadError.message || 'Audit log не се зареди.')
      setStatus('error')
    }
  }

  const searchableRows = useMemo(() => rows.map((row) => ({ ...row, payload_text: JSON.stringify(row.payload || {}) })), [rows])
  const filtered = useMemo(() => searchableRows.filter((row) => matchesSearch(row, query || globalQuery, ['action', 'entity_type', 'entity_id', 'actor_id', 'payload_text'])), [searchableRows, query, globalQuery])
  const pageData = useMemo(() => paginateRows(filtered, page), [filtered, page])
  useEffect(() => { setPage(1) }, [query, globalQuery])

  if (status === 'loading') return <Panel title="Зареждаме audit log…" />
  if (status === 'error') return <Panel title="Audit log не се зареди"><p className="text-sm text-red-700">{error}</p><button type="button" onClick={load} className="btn btn-ghost mt-5">Опитай пак</button></Panel>

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><div className="eyebrow">Audit log</div><h2 className="mt-2 font-display text-3xl text-ink">Следа от админ действия</h2></div><button type="button" onClick={load} className="btn btn-ghost self-start"><RefreshCcw size={17} /> Обнови</button></div>
        <label className="relative mt-5 block text-sm font-medium text-ink">Търсене<Search size={17} className="pointer-events-none absolute left-4 top-[2.35rem] text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} className={`${ADMIN_INPUT_CLASS} pl-11`} placeholder="Action, entity, ID…" /></label>
      </div>

      <div className="space-y-3">
        {pageData.rows.map((row) => (
          <article key={row.id} className="rounded-3xl border border-line bg-paper p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0"><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-accentDeep" /><div className="font-display text-2xl text-ink">{row.action}</div></div><div className="mt-1 text-sm text-muted">{row.entity_type} · {row.entity_id || 'без entity id'}</div></div>
              <div className="text-sm text-muted">{formatAdminDate(row.created_at)}</div>
            </div>
            <div className="mt-4 rounded-2xl border border-line bg-soft p-4 text-xs text-muted"><div>Actor: {row.actor_id || 'service'}</div><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{JSON.stringify(row.payload || {}, null, 2)}</pre></div>
          </article>
        ))}
        {pageData.rows.length === 0 && <Empty text="Още няма записани действия." />}
      </div>
      <Pager current={pageData.currentPage} total={pageData.totalPages} onChange={setPage} />
    </section>
  )
}

function Pager({ current, total, onChange }) { if (total <= 1) return null; return <div className="flex items-center justify-end gap-2"><button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => onChange(current - 1)} disabled={current <= 1}>Назад</button><span className="text-sm text-muted">{current} / {total}</span><button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => onChange(current + 1)} disabled={current >= total}>Напред</button></div> }
function Empty({ text }) { return <div className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">{text}</div> }
function Panel({ title, children }) { return <div className="rounded-3xl border border-line bg-paper p-6"><h2 className="font-display text-2xl text-ink">{title}</h2>{children && <div className="mt-3">{children}</div>}</div> }