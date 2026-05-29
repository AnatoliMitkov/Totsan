import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, RefreshCcw, Search, ShieldCheck, UserRound } from 'lucide-react'
import { ADMIN_INPUT_CLASS, formatAdminDate, loadAuditLog, matchesSearch, paginateRows } from '../../lib/admin.js'

const ACTION_LABELS = {
  update_account: 'Промяна на акаунт',
  update_inquiry_status: 'Промяна на запитване',
  approve_specialist: 'Одобрение на специалист',
  reject_specialist: 'Отказ на специалист',
  approve_partner_service: 'Одобрение на услуга',
  reject_partner_service: 'Връщане на услуга',
  update_order_status: 'Промяна на поръчка',
}

const ENTITY_LABELS = {
  account: 'Акаунт',
  inquiry: 'Запитване',
  partner_application: 'Кандидатура',
  partner_service: 'Партньорска услуга',
  order: 'Поръчка',
}

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

  const normalizedRows = useMemo(() => rows.map((row) => {
    const payload = row.payload || {}
    const actionLabel = ACTION_LABELS[row.action] || row.action
    const entityLabel = ENTITY_LABELS[row.entity_type] || row.entity_type
    const actorEmail = typeof payload.actor_email === 'string' ? payload.actor_email : ''
    const actorId = row.actor_id || ''
    const actorLabel = actorEmail || (actorId ? `ID ${shortId(actorId)}` : 'System')
    const highlights = extractHighlights(row)
    return {
      ...row,
      actionLabel,
      entityLabel,
      actorLabel,
      highlights,
      searchableText: JSON.stringify({
        action: row.action,
        actionLabel,
        entity: row.entity_type,
        entityLabel,
        entityId: row.entity_id,
        actorId: row.actor_id,
        actorEmail,
        payload,
      }),
    }
  }), [rows])

  const filtered = useMemo(
    () => normalizedRows.filter((row) => matchesSearch(row, query || globalQuery, ['actionLabel', 'entityLabel', 'entity_id', 'actorLabel', 'searchableText'])),
    [normalizedRows, query, globalQuery],
  )
  const pageData = useMemo(() => paginateRows(filtered, page), [filtered, page])

  useEffect(() => { setPage(1) }, [query, globalQuery])

  if (status === 'loading') return <Panel title="Зареждаме audit log…" />
  if (status === 'error') return <Panel title="Audit log не се зареди"><p className="text-sm text-red-700">{error}</p><button type="button" onClick={load} className="btn btn-ghost mt-5">Опитай пак</button></Panel>

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="eyebrow">Audit log</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Следа от админ действия</h2>
          </div>
          <button type="button" onClick={load} className="btn btn-ghost self-start"><RefreshCcw size={17} /> Обнови</button>
        </div>
        <label className="relative mt-5 block text-sm font-medium text-ink">
          Търсене
          <Search size={17} className="pointer-events-none absolute left-4 top-[2.35rem] text-muted" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className={`${ADMIN_INPUT_CLASS} pl-11`} placeholder="Действие, модул, актьор…" />
        </label>
      </div>

      <div className="space-y-3">
        {pageData.rows.map((row) => (
          <article key={row.id} className="rounded-3xl border border-line bg-paper p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-accentDeep" />
                  <div className="font-display text-2xl text-ink">{row.actionLabel}</div>
                </div>
                <div className="mt-1 text-sm text-muted">{row.entityLabel} · {row.entity_id ? shortId(row.entity_id) : 'без entity id'}</div>
              </div>
              <div className="text-sm text-muted">{formatAdminDate(row.created_at)}</div>
            </div>

            <div className="mt-4 rounded-2xl border border-line bg-soft p-4 text-sm text-muted">
              <div className="flex items-center gap-2 text-ink/80">
                <UserRound size={15} />
                <span>Извършил: {row.actorLabel}</span>
              </div>
              {row.highlights.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.highlights.map((chip) => (
                    <span key={chip} className="rounded-full border border-line bg-paper px-3 py-1 text-xs text-ink/80">{chip}</span>
                  ))}
                </div>
              )}
              <details className="mt-3 group">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted">
                  <ChevronDown size={14} className="transition group-open:rotate-180" />
                  Технически детайли
                </summary>
                <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-paper p-3 font-mono text-[11px] leading-relaxed text-muted">{JSON.stringify(row.payload || {}, null, 2)}</pre>
              </details>
            </div>
          </article>
        ))}
        {pageData.rows.length === 0 && <Empty text="Още няма записани действия." />}
      </div>
      <Pager current={pageData.currentPage} total={pageData.totalPages} onChange={setPage} />
    </section>
  )
}

function shortId(value = '') {
  const text = String(value || '')
  if (text.length <= 12) return text
  return `${text.slice(0, 8)}…${text.slice(-4)}`
}

function extractHighlights(row) {
  const payload = row.payload || {}
  const chips = []

  if (row.action === 'update_account' && payload.updates && typeof payload.updates === 'object') {
    const updates = payload.updates
    if (updates.role) chips.push(`Роля: ${updates.role}`)
    if (updates.accountStatus) chips.push(`Статус: ${updates.accountStatus}`)
    if (updates.specialistStatus) chips.push(`Спец. статус: ${updates.specialistStatus}`)
  }
  if (row.action === 'update_order_status') {
    if (payload.from_status) chips.push(`От: ${payload.from_status}`)
    if (payload.status) chips.push(`Към: ${payload.status}`)
  }
  if (row.action === 'update_inquiry_status' && payload.status) chips.push(`Статус: ${payload.status}`)
  if (row.action === 'approve_specialist' && payload.user_id) chips.push(`Потребител: ${shortId(payload.user_id)}`)
  if (row.action === 'reject_specialist' && payload.user_id) chips.push(`Потребител: ${shortId(payload.user_id)}`)
  if (row.action === 'approve_partner_service' && row.entity_id) chips.push(`Услуга: ${shortId(row.entity_id)}`)
  if (row.action === 'reject_partner_service' && row.entity_id) chips.push(`Услуга: ${shortId(row.entity_id)}`)

  return chips
}

function Pager({ current, total, onChange }) {
  if (total <= 1) return null
  return (
    <div className="flex items-center justify-end gap-2">
      <button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => onChange(current - 1)} disabled={current <= 1}>Назад</button>
      <span className="text-sm text-muted">{current} / {total}</span>
      <button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => onChange(current + 1)} disabled={current >= total}>Напред</button>
    </div>
  )
}

function Empty({ text }) {
  return <div className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">{text}</div>
}

function Panel({ title, children }) {
  return (
    <div className="rounded-3xl border border-line bg-paper p-6">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}
