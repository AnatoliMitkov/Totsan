import { useEffect, useMemo, useState } from 'react'
import { Ban, CheckCircle2, KeyRound, MailCheck, RefreshCcw, Search, ShieldCheck, Trash2 } from 'lucide-react'
import {
  ACCOUNT_ROLE_LABELS,
  ADMIN_INPUT_CLASS,
  ADMIN_SELECT_CLASS,
  SPECIALIST_STATUS_LABELS,
  deleteUserPasskey,
  formatAdminDate,
  listUserPasskeys,
  loadAccounts,
  matchesSearch,
  paginateRows,
  resetUserPasskeys,
  sendUserRecoveryEmail,
  updateAccount,
} from '../../lib/admin.js'

const ADMIN_ROLE_MANAGER_EMAILS = new Set(['a.mitkov@totsan.com', 'ivelinva2@gmail.com'])

export default function UsersManager({ globalQuery = '', account }) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [actionState, setActionState] = useState({ id: '', message: '' })
  const [authTools, setAuthTools] = useState({ id: '', status: 'idle', passkeys: [], message: '' })

  const canManageAdmins = hasAdminRoleManagerAccess(account)

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const combinedQuery = query || globalQuery
    return rows.filter((row) => {
      const effectiveStatus = row.account_status === 'banned' ? 'banned' : (row.specialist_status || 'active')
      if (roleFilter !== 'all' && row.role !== roleFilter) return false
      if (statusFilter !== 'all' && effectiveStatus !== statusFilter) return false
      return matchesSearch(row, combinedQuery, ['email', 'full_name', 'display_name', 'phone', 'city'])
    })
  }, [globalQuery, page, query, roleFilter, rows, statusFilter])

  const pageData = useMemo(() => paginateRows(filtered, page), [filtered, page])

  useEffect(() => {
    setPage(1)
  }, [globalQuery, query, roleFilter, statusFilter])

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

  async function openAuthTools(row) {
    if (authTools.id === row.id && authTools.status === 'ready') {
      setAuthTools({ id: '', status: 'idle', passkeys: [], message: '' })
      return
    }

    setAuthTools({ id: row.id, status: 'loading', passkeys: [], message: '' })
    try {
      const result = await listUserPasskeys(row.id)
      setAuthTools({ id: row.id, status: 'ready', passkeys: result.passkeys || [], message: '' })
    } catch (toolError) {
      setAuthTools({ id: row.id, status: 'error', passkeys: [], message: toolError.message || 'Не успяхме да заредим входовете.' })
    }
  }

  async function refreshAuthTools(row, message = '') {
    setAuthTools((current) => ({ ...current, id: row.id, status: 'loading', message }))
    try {
      const result = await listUserPasskeys(row.id)
      setAuthTools({ id: row.id, status: 'ready', passkeys: result.passkeys || [], message })
    } catch (toolError) {
      setAuthTools({ id: row.id, status: 'error', passkeys: [], message: toolError.message || 'Не успяхме да обновим входовете.' })
    }
  }

  async function removeUserPasskey(row, passkeyId) {
    setAuthTools((current) => ({ ...current, id: row.id, status: 'saving', message: 'Премахваме входа…' }))
    try {
      await deleteUserPasskey(row.id, passkeyId)
      await refreshAuthTools(row, 'Входът е премахнат.')
    } catch (toolError) {
      setAuthTools((current) => ({ ...current, id: row.id, status: 'error', message: toolError.message || 'Не успяхме да премахнем входа.' }))
    }
  }

  async function resetAuthForUser(row) {
    setAuthTools((current) => ({ ...current, id: row.id, status: 'saving', message: 'Ресетваме бързия вход…' }))
    try {
      const result = await resetUserPasskeys(row.id)
      await refreshAuthTools(row, `Премахнати входове: ${result.deletedCount || 0}.`)
    } catch (toolError) {
      setAuthTools((current) => ({ ...current, id: row.id, status: 'error', message: toolError.message || 'Не успяхме да ресетнем входовете.' }))
    }
  }

  async function sendRecoveryEmail(row) {
    setAuthTools((current) => ({ ...current, id: row.id, status: 'saving', message: 'Изпращаме email…' }))
    try {
      await sendUserRecoveryEmail(row.id)
      setAuthTools((current) => ({ ...current, id: row.id, status: 'ready', message: 'Изпратен е email за нов вход/парола.' }))
    } catch (toolError) {
      setAuthTools((current) => ({ ...current, id: row.id, status: 'error', message: toolError.message || 'Не успяхме да изпратим email.' }))
    }
  }

  if (status === 'loading') return <Panel title="Зареждаме потребителите…" />
  if (status === 'error') {
    return (
      <Panel title="Потребителите не се заредиха">
        <p className="text-sm text-red-700">{error}</p>
        <button type="button" onClick={load} className="btn btn-ghost mt-5">Опитай пак</button>
      </Panel>
    )
  }

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="eyebrow">Потребители</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Акаунти, роли и статуси</h2>
            <p className="mt-2 text-sm text-muted">Одобрението и блокирането минават през `admin-action` и се записват в audit log.</p>
          </div>
          <button type="button" onClick={load} className="btn btn-ghost self-start"><RefreshCcw size={17} /> Обнови</button>
        </div>
        <div className="mt-4 rounded-2xl border border-line bg-soft px-4 py-3 text-sm text-muted">
          Само <span className="font-medium text-ink">a.mitkov@totsan.com</span> може да дава или маха admin права.
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
          const roleOptions = getRoleOptions(row, canManageAdmins)
          const roleLocked = isSelf || (!canManageAdmins && row.role === 'admin')
          const accountStatusLocked = isSelf || (!canManageAdmins && row.role === 'admin')

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
                    {isSelf && <span>· текущият admin</span>}
                  </div>
                </div>

                <label className="block text-sm font-medium text-ink">Роля
                  <select
                    value={row.role || 'user'}
                    onChange={(event) => run(row, { role: event.target.value }, 'Ролята е обновена.')}
                    className={`${ADMIN_SELECT_CLASS} mt-2 w-full rounded-2xl`}
                    disabled={roleLocked}
                  >
                    {roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  {isSelf && <div className="mt-2 text-xs text-muted">Собствената ти admin роля е заключена тук за безопасност.</div>}
                  {!isSelf && !canManageAdmins && row.role === 'admin' && <div className="mt-2 text-xs text-muted">Само a.mitkov@totsan.com може да променя тази admin роля.</div>}
                </label>

                <label className="block text-sm font-medium text-ink">Specialist статус
                  <select
                    value={row.specialist_status || ''}
                    onChange={(event) => run(row, { specialistStatus: event.target.value || null }, 'Статусът е обновен.')}
                    className={`${ADMIN_SELECT_CLASS} mt-2 w-full rounded-2xl`}
                    disabled={row.role !== 'specialist'}
                  >
                    <option value="">—</option>
                    {Object.entries(SPECIALIST_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {row.role === 'specialist' && row.specialist_status !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => run(row, { role: 'specialist', specialistStatus: 'approved', accountStatus: 'active' }, 'Специалистът е одобрен.')}
                      className="btn btn-primary !py-2 text-sm"
                    >
                      <CheckCircle2 size={17} /> Одобри
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={accountStatusLocked}
                    onClick={() => run(row, { accountStatus: row.account_status === 'banned' ? 'active' : 'banned' }, row.account_status === 'banned' ? 'Акаунтът е активиран.' : 'Акаунтът е блокиран.')}
                    className="btn btn-ghost !py-2 text-sm disabled:opacity-50"
                  >
                    {row.account_status === 'banned' ? <ShieldCheck size={17} /> : <Ban size={17} />}
                    {row.account_status === 'banned' ? ' Активирай' : ' Блокирай'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuthTools(row)}
                    className="btn btn-ghost !py-2 text-sm"
                  >
                    <KeyRound size={17} /> Вход
                  </button>
                </div>
              </div>
              {authTools.id === row.id && (
                <UserAuthTools
                  row={row}
                  state={authTools}
                  onRefresh={() => refreshAuthTools(row)}
                  onDelete={(passkeyId) => removeUserPasskey(row, passkeyId)}
                  onReset={() => resetAuthForUser(row)}
                  onSendRecovery={() => sendRecoveryEmail(row)}
                />
              )}
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

function UserAuthTools({ row, state, onRefresh, onDelete, onReset, onSendRecovery }) {
  const busy = state.status === 'loading' || state.status === 'saving'

  return (
    <div className="mt-4 rounded-2xl border border-line bg-soft p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 font-medium text-ink">
            <KeyRound size={18} /> Вход и възстановяване
          </div>
          <p className="mt-1 text-sm text-muted">{row.email || 'Акаунт без имейл'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRefresh} disabled={busy} className="btn btn-ghost !py-2 text-sm disabled:opacity-50">
            <RefreshCcw size={16} /> Обнови
          </button>
          <button type="button" onClick={onSendRecovery} disabled={busy || !row.email} className="btn btn-ghost !py-2 text-sm disabled:opacity-50">
            <MailCheck size={16} /> Reset email
          </button>
          <button type="button" onClick={onReset} disabled={busy || state.passkeys.length === 0} className="btn btn-ghost !py-2 text-sm disabled:opacity-50">
            <Trash2 size={16} /> Reset passkeys
          </button>
        </div>
      </div>

      {state.message && (
        <div className={`mt-3 rounded-2xl px-3 py-2 text-sm ${state.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-paper text-muted'}`}>
          {state.message}
        </div>
      )}

      {state.status === 'loading' && <div className="mt-3 text-sm text-muted">Зареждаме входовете…</div>}

      {state.status !== 'loading' && state.passkeys.length === 0 && (
        <div className="mt-3 rounded-2xl border border-dashed border-line bg-paper px-4 py-3 text-sm text-muted">
          Няма активни passkeys за този потребител.
        </div>
      )}

      {state.passkeys.length > 0 && (
        <div className="mt-3 grid gap-2">
          {state.passkeys.map((passkey) => (
            <div key={passkey.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
              <div className="min-w-0 text-sm">
                <div className="font-medium text-ink">{passkey.friendly_name || 'Бърз вход'}</div>
                <div className="mt-1 text-xs text-muted">Добавен: {formatAdminDate(passkey.created_at)}</div>
                <div className="mt-1 text-xs text-muted">Последно ползване: {passkey.last_used_at ? formatAdminDate(passkey.last_used_at) : 'няма'}</div>
              </div>
              <button type="button" onClick={() => onDelete(passkey.id)} disabled={busy} className="btn btn-ghost !py-2 text-sm disabled:opacity-50">
                <Trash2 size={16} /> Премахни
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function hasAdminRoleManagerAccess(account) {
  return ADMIN_ROLE_MANAGER_EMAILS.has(String(account?.email || '').trim().toLowerCase())
}

function getRoleOptions(row, canManageAdmins) {
  if (canManageAdmins || row.role === 'admin') return Object.entries(ACCOUNT_ROLE_LABELS)
  return Object.entries(ACCOUNT_ROLE_LABELS).filter(([value]) => value !== 'admin')
}

function mapLocalUpdates(updates) {
  const next = { last_admin_action_at: new Date().toISOString() }
  if ('role' in updates) next.role = updates.role
  if ('specialistStatus' in updates) next.specialist_status = updates.specialistStatus
  if ('accountStatus' in updates) next.account_status = updates.accountStatus
  return next
}

function StatusPill({ value }) {
  const labels = {
    active: 'Активен',
    pending: 'Чака',
    approved: 'Одобрен',
    rejected: 'Отхвърлен',
    banned: 'Блокиран',
  }
  const tones = {
    approved: 'bg-green-100 text-green-800',
    pending: 'bg-amber-100 text-amber-900',
    rejected: 'bg-red-100 text-red-800',
    banned: 'bg-red-100 text-red-800',
    active: 'bg-soft text-muted',
  }

  return <span className={`rounded-full px-3 py-1 text-xs ${tones[value] || tones.active}`}>{labels[value] || value}</span>
}

function Filter({ label, value, onChange, options }) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={`${ADMIN_SELECT_CLASS} mt-2 w-full rounded-2xl`}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  )
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
  return <div className="rounded-3xl border border-line bg-paper p-6"><h2 className="font-display text-2xl text-ink">{title}</h2>{children && <div className="mt-3">{children}</div>}</div>
}
