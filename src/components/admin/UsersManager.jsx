import { useEffect, useMemo, useState } from 'react'
import { Ban, CheckCircle2, RefreshCcw, Search, ShieldCheck } from 'lucide-react'
import {
  ACCOUNT_ROLE_LABELS,
  ACCOUNT_STATUS_LABELS,
  ADMIN_INPUT_CLASS,
  ADMIN_SELECT_CLASS,
  SPECIALIST_STATUS_LABELS,
  formatAdminDate,
  loadAccounts,
  matchesSearch,
  paginateRows,
  updateAccount,
} from '../../lib/admin.js'

export default function UsersManager({ globalQuery = '', account }) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [actionState, setActionState] = useState({ id: '', message: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setStatus('loading')
    setError('')
    try {
      setRows(await loadAccounts())
      setStatus('ready')
    } catch (loadError) {
      setError(loadError.message || 'Акаунтите не се заредиха.')
      setStatus('error')
    }
  }

  const filtered = useMemo(() => {
    const combinedQuery = query || globalQuery
    return rows.filter((row) => {
      const effectiveStatus = row.account_status === 'banned' ? 'banned' : (row.specialist_status || 'active')
      if (roleFilter !== 'all' && row.role !== roleFilter) return false
      if (statusFilter !== 'all' && effectiveStatus !== statusFilter) return false
      return matchesSearch(row, combinedQuery, ['email', 'full_name', 'display_name', 'phone', 'city'])
    })
  }, [rows, query, globalQuery, roleFilter, statusFilter])

  const pageData = useMemo(() => paginateRows(filtered, page), [filtered, page])

  useEffect(() => { setPage(1) }, [query, globalQuery, roleFilter, statusFilter])

  async function run(row, updates, message) {
    setActionState({ id: row.id, message: 'Запазваме…' })
    setError('')
    try {
      await updateAccount(row.id, updates)
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, ...mapLocalUpdates(updates) } : item))
      setActionState({ id: row.id, message })
    } catch (actionError) {
      setActionState({ id: row.id, message: actionError.message || 'Действието не успя.' })
    }
  }

  if (status === 'loading') return <Panel title="Зареждаме потребителите…" />
  if (status === 'error') return <Panel title="Потребителите не се заредиха"><p className="text-sm text-red-700">{error}</p><button type="button" onClick={load} className="btn btn-ghost mt-5">Опитай пак</button></Panel>

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="eyebrow">Потребители</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Акаунти, роли и статуси</h2>
            <p className="mt-2 text-sm text-muted">Одобрението и блокирането минават през admin-action и се записват в audit log.</p>
          </div>
          <button type="button" onClick={load} className="btn btn-ghost self-start"><RefreshCcw size={17} /> Обнови</button>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_11rem_12rem]">
          <label className="relative block">
            <Search size={17} className="pointer-events-none absolute left-4 top-[2.35rem] text-muted" />
            <span className="text-sm font-medium text-ink">Търсене</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} className={`${ADMIN_INPUT_CLASS} pl-11`} placeholder="Имейл, име, град…" />
          </label>
          <Filter label="Роля" value={roleFilter} onChange={setRoleFilter} options={[['all', 'Всички'], ['user', 'Клиенти'], ['specialist', 'Специалисти'], ['admin', 'Админи']]} />
          <Filter label="Статус" value={statusFilter} onChange={setStatusFilter} options={[['all', 'Всички'], ['active', 'Активни'], ['pending', 'Чакащи'], ['approved', 'Одобрени'], ['rejected', 'Отхвърлени'], ['banned', 'Блокирани']]} />
        </div>
      </div>

      <div className="space-y-3">
        {pageData.rows.map((row) => {
          const isSelf = row.id === account?.id
          const busy = actionState.id === row.id
          return (
            <article key={row.id} className="rounded-3xl border border-line bg-paper p-5">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_12rem_13rem_14rem] xl:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate font-display text-2xl text-ink">{displayName(row)}</div>
                    <StatusPill value={row.account_status === 'banned' ? 'banned' : (row.specialist_status || 'active')} />
                  </div>
                  <div className="mt-1 truncate text-sm text-muted">{row.email || 'без имейл'}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                    <span>Регистрация: {formatAdminDate(row.created_at)}</span>
                    {row.city && <span>· {row.city}</span>}
                    {isSelf && <span>· текущ админ</span>}
                  </div>
                </div>

                <label className="block text-sm font-medium text-ink">Роля
                  <select value={row.role || 'user'} onChange={(event) => run(row, { role: event.target.value }, 'Ролята е обновена.')} className={`${ADMIN_SELECT_CLASS} mt-2 w-full rounded-2xl`}>
                    {Object.entries(ACCOUNT_ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>

                <label className="block text-sm font-medium text-ink">Specialist статус
                  <select value={row.specialist_status || ''} onChange={(event) => run(row, { specialistStatus: event.target.value || null }, 'Статусът е обновен.')} className={`${ADMIN_SELECT_CLASS} mt-2 w-full rounded-2xl`} disabled={row.role !== 'specialist'}>
                    <option value="">—</option>
                    {Object.entries(SPECIALIST_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {row.role === 'specialist' && row.specialist_status !== 'approved' && <button type="button" onClick={() => run(row, { role: 'specialist', specialistStatus: 'approved', accountStatus: 'active' }, 'Специалистът е одобрен.')} className="btn btn-primary !py-2 text-sm"><CheckCircle2 size={17} /> Одобри</button>}
                  <button type="button" disabled={isSelf} onClick={() => run(row, { accountStatus: row.account_status === 'banned' ? 'active' : 'banned' }, row.account_status === 'banned' ? 'Акаунтът е активиран.' : 'Акаунтът е блокиран.')} className="btn btn-ghost !py-2 text-sm disabled:opacity-50">
                    {row.account_status === 'banned' ? <ShieldCheck size={17} /> : <Ban size={17} />} {row.account_status === 'banned' ? 'Активирай' : 'Блокирай'}
                  </button>
                </div>
              </div>
              {busy && actionState.message && <div className="mt-3 text-sm text-muted">{actionState.message}</div>}
            </article>
          )
        })}
        {pageData.rows.length === 0 && <Empty text="Няма потребители по тези филтри." />}
      </div>

      <Pager current={pageData.currentPage} total={pageData.totalPages} onChange={setPage} />
    </section>
  )
}

function displayName(row) {
  return row.full_name || row.display_name || row.email?.split('@')[0] || 'Потребител'
}

function mapLocalUpdates(updates) {
  const next = { last_admin_action_at: new Date().toISOString() }
  if ('role' in updates) next.role = updates.role
  if ('specialistStatus' in updates) next.specialist_status = updates.specialistStatus
  if ('accountStatus' in updates) next.account_status = updates.accountStatus
  return next
}

function StatusPill({ value }) {
  const labels = { active: 'Активен', pending: 'Чака', approved: 'Одобрен', rejected: 'Отхвърлен', banned: 'Блокиран' }
  const tones = { approved: 'bg-green-100 text-green-800', pending: 'bg-amber-100 text-amber-900', rejected: 'bg-red-100 text-red-800', banned: 'bg-red-100 text-red-800', active: 'bg-soft text-muted' }
  return <span className={`rounded-full px-3 py-1 text-xs ${tones[value] || tones.active}`}>{labels[value] || value}</span>
}

function Filter({ label, value, onChange, options }) {
  return <label className="block text-sm font-medium text-ink">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className={`${ADMIN_SELECT_CLASS} mt-2 w-full rounded-2xl`}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>
}

function Pager({ current, total, onChange }) {
  if (total <= 1) return null
  return <div className="flex items-center justify-end gap-2"><button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => onChange(current - 1)} disabled={current <= 1}>Назад</button><span className="text-sm text-muted">{current} / {total}</span><button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => onChange(current + 1)} disabled={current >= total}>Напред</button></div>
}

function Empty({ text }) {
  return <div className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">{text}</div>
}

function Panel({ title, children }) {
  return <div className="rounded-3xl border border-line bg-paper p-6"><h2 className="font-display text-2xl text-ink">{title}</h2>{children && <div className="mt-3">{children}</div>}</div>
}