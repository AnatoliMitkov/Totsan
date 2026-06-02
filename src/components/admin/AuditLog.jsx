import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, RefreshCcw, Search, ShieldCheck, UserRound } from 'lucide-react'
import { ADMIN_INPUT_CLASS, formatAdminDate, loadAccounts, loadAuditLog, matchesSearch, paginateRows } from '../../lib/admin.js'

const ROLE_LABELS = {
  user: 'Клиент',
  specialist: 'Специалист',
  admin: 'Админ',
}

const ACCOUNT_STATUS_LABELS = {
  active: 'Активен',
  banned: 'Блокиран',
}

const SPECIALIST_STATUS_LABELS = {
  pending: 'Чака',
  approved: 'Одобрен',
  rejected: 'Отхвърлен',
}

const ENTITY_LABELS = {
  account: 'Акаунт',
  inquiry: 'Запитване',
  partner_application: 'Кандидатура',
  partner_service: 'Партньорска услуга',
  order: 'Поръчка',
  message: 'Съобщение',
}

export default function AuditLog({ globalQuery = '' }) {
  const [rows, setRows] = useState([])
  const [accounts, setAccounts] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setStatus('loading')
    setError('')
    try {
      const [auditRows, accountRows] = await Promise.all([loadAuditLog(), loadAccounts()])
      setRows(auditRows)
      setAccounts(accountRows)
      setStatus('ready')
    } catch (loadError) {
      setError(loadError.message || 'Audit log не се зареди.')
      setStatus('error')
    }
  }

  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])

  const normalizedRows = useMemo(() => rows.map((row) => {
    const view = buildAuditView(row, accountById)
    return {
      ...row,
      ...view,
      searchableText: JSON.stringify({
        action: row.action,
        entity: row.entity_type,
        entityId: row.entity_id,
        payload: row.payload,
        title: view.title,
        summary: view.summary,
        actorLabel: view.actorLabel,
        targetLabel: view.targetLabel,
        chips: view.chips,
      }),
    }
  }), [accountById, rows])

  const filtered = useMemo(
    () => normalizedRows.filter((row) => matchesSearch(row, query || globalQuery, ['title', 'summary', 'entityLabel', 'entity_id', 'actorLabel', 'targetLabel', 'searchableText'])),
    [globalQuery, normalizedRows, query],
  )

  const pageData = useMemo(() => paginateRows(filtered, page), [filtered, page])

  useEffect(() => {
    setPage(1)
  }, [globalQuery, query])

  if (status === 'loading') return <Panel title="Зареждаме audit log…" />
  if (status === 'error') {
    return (
      <Panel title="Audit log не се зареди">
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
            <div className="eyebrow">Audit log</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Следа от админ действия</h2>
            <p className="mt-2 text-sm text-muted">Най-важното е отпред: кой е действал, върху кого, и какво точно е променено.</p>
          </div>
          <button type="button" onClick={load} className="btn btn-ghost self-start"><RefreshCcw size={17} /> Обнови</button>
        </div>
        <label className="relative mt-5 block text-sm font-medium text-ink">
          Търсене
          <Search size={17} className="pointer-events-none absolute left-4 top-[2.35rem] text-muted" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className={`${ADMIN_INPUT_CLASS} pl-11`} placeholder="Имейл, име, действие, модул…" />
        </label>
      </div>

      <div className="space-y-3">
        {pageData.rows.map((row) => (
          <article key={row.id} className="rounded-3xl border border-line bg-paper p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="shrink-0 text-accentDeep" />
                  <div className="font-display text-2xl text-ink">{row.title}</div>
                </div>
                <p className="mt-2 max-w-3xl text-sm text-ink/80">{row.summary}</p>
              </div>
              <div className="shrink-0 text-sm text-muted">{formatAdminDate(row.created_at)}</div>
            </div>

            <div className="mt-4 rounded-2xl border border-line bg-soft p-4 text-sm text-muted">
              <div className="grid gap-3 md:grid-cols-2">
                <InfoLine label="Извършил" value={row.actorLabel} />
                <InfoLine label={row.entityLabel} value={row.targetLabel} />
              </div>

              {row.chips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.chips.map((chip) => (
                    <span key={chip} className="rounded-full border border-line bg-paper px-3 py-1 text-xs text-ink/80">{chip}</span>
                  ))}
                </div>
              )}

              <details className="mt-3 group">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted">
                  <ChevronDown size={14} className="transition group-open:rotate-180" />
                  Технически JSON
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

function buildAuditView(row, accountById) {
  const payload = row.payload || {}
  const actorLabel = getActorLabel(row, payload, accountById)
  const entityLabel = ENTITY_LABELS[row.entity_type] || row.entity_type || 'Запис'

  if (row.action === 'update_account') {
    return buildAccountUpdateView(row, payload, accountById, actorLabel, entityLabel)
  }

  if (row.action === 'update_order_status') {
    const fromStatus = label(payload.from_status)
    const toStatus = label(payload.status)
    const targetLabel = row.entity_id ? `Поръчка ${shortId(row.entity_id)}` : 'Поръчка'

    return {
      title: 'Променен статус на поръчка',
      summary: `${actorLabel} промени ${targetLabel}${toStatus ? `: ${fromStatus || 'предишен статус'} -> ${toStatus}` : ''}.`,
      actorLabel,
      targetLabel,
      entityLabel,
      chips: compact([fromStatus && `От: ${fromStatus}`, toStatus && `Към: ${toStatus}`, payload.note && `Бележка: ${payload.note}`]),
    }
  }

  if (row.action === 'update_inquiry_status') {
    const targetLabel = row.entity_id ? `Запитване ${shortId(row.entity_id)}` : 'Запитване'
    const status = label(payload.status)
    return {
      title: 'Променен статус на запитване',
      summary: `${actorLabel} промени ${targetLabel}${status ? ` на ${status}` : ''}.`,
      actorLabel,
      targetLabel,
      entityLabel,
      chips: compact([status && `Статус: ${status}`]),
    }
  }

  if (row.action === 'approve_specialist' || row.action === 'reject_specialist') {
    const targetAccount = accountById.get(payload.user_id) || null
    const targetLabel = targetAccount ? formatAccountLabel(targetAccount) : (payload.user_id ? `Потребител ${shortId(payload.user_id)}` : formatEntityLabel(row))
    const approved = row.action === 'approve_specialist'
    return {
      title: approved ? 'Одобрен специалист' : 'Отхвърлена кандидатура',
      summary: `${actorLabel} ${approved ? 'одобри' : 'отхвърли'} кандидатурата на ${targetLabel}.`,
      actorLabel,
      targetLabel,
      entityLabel,
      chips: compact([payload.profile_id && `Профил: ${shortId(payload.profile_id)}`]),
    }
  }

  if (row.action === 'approve_partner_service' || row.action === 'reject_partner_service') {
    const approved = row.action === 'approve_partner_service'
    const targetLabel = row.entity_id ? `Услуга ${shortId(row.entity_id)}` : 'Услуга'
    return {
      title: approved ? 'Одобрена услуга' : 'Върната услуга за корекция',
      summary: `${actorLabel} ${approved ? 'одобри' : 'върна'} ${targetLabel}.`,
      actorLabel,
      targetLabel,
      entityLabel,
      chips: compact([payload.moderation_note && `Бележка: ${payload.moderation_note}`]),
    }
  }

  return {
    title: label(row.action) || 'Админ действие',
    summary: `${actorLabel} извърши действие върху ${formatEntityLabel(row)}.`,
    actorLabel,
    targetLabel: formatEntityLabel(row),
    entityLabel,
    chips: [],
  }
}

function buildAccountUpdateView(row, payload, accountById, actorLabel, entityLabel) {
  const updates = payload.updates && typeof payload.updates === 'object' ? payload.updates : {}
  const before = payload.before && typeof payload.before === 'object' ? payload.before : {}
  const after = payload.after && typeof payload.after === 'object' ? payload.after : updates
  const target = payload.target || accountById.get(row.entity_id) || {}
  const targetLabel = formatAccountLabel(target, row.entity_id)
  const changes = describeAccountChanges(updates, before, after)
  const title = accountUpdateTitle(updates, before, after)
  const summary = `${actorLabel} промени ${targetLabel}${changes.length ? `: ${changes.join(', ')}` : ''}.`

  return {
    title,
    summary,
    actorLabel,
    targetLabel,
    entityLabel,
    chips: changes,
  }
}

function accountUpdateTitle(updates, before, after) {
  if ('role' in updates || 'role' in after) {
    const nextRole = after.role || updates.role
    const previousRole = before.role
    if (nextRole === 'admin') return 'Дадени admin права'
    if (previousRole === 'admin' && nextRole !== 'admin') return 'Махнати admin права'
    return 'Променена роля'
  }

  if ('accountStatus' in updates || 'account_status' in after) return 'Променен статус на акаунт'
  if ('specialistStatus' in updates || 'specialist_status' in after) return 'Променен specialist статус'
  return 'Промяна в акаунт'
}

function describeAccountChanges(updates, before, after) {
  const changes = []
  const role = after.role || updates.role
  const accountStatus = after.account_status || after.accountStatus || updates.accountStatus
  const specialistStatus = after.specialist_status || after.specialistStatus || updates.specialistStatus

  if (role) changes.push(formatChange('Роля', ROLE_LABELS[before.role], ROLE_LABELS[role] || role))
  if (accountStatus) changes.push(formatChange('Статус', ACCOUNT_STATUS_LABELS[before.account_status], ACCOUNT_STATUS_LABELS[accountStatus] || accountStatus))
  if (specialistStatus) changes.push(formatChange('Specialist статус', SPECIALIST_STATUS_LABELS[before.specialist_status], SPECIALIST_STATUS_LABELS[specialistStatus] || specialistStatus))
  if (updates.adminNote) changes.push('Добавена admin бележка')

  return changes
}

function formatChange(labelText, beforeValue, afterValue) {
  if (beforeValue && beforeValue !== afterValue) return `${labelText}: ${beforeValue} -> ${afterValue}`
  return `${labelText}: ${afterValue}`
}

function getActorLabel(row, payload, accountById) {
  if (typeof payload.actor_email === 'string' && payload.actor_email) return payload.actor_email
  const actorAccount = accountById.get(row.actor_id)
  if (actorAccount) return formatAccountLabel(actorAccount)
  return row.actor_id ? `ID ${shortId(row.actor_id)}` : 'System'
}

function formatAccountLabel(account = {}, fallbackId = '') {
  const email = account.email || ''
  const name = account.full_name || account.display_name || (email ? email.split('@')[0] : '')
  if (name && email) return `${name} · ${email}`
  return name || email || (fallbackId ? `ID ${shortId(fallbackId)}` : 'Неизвестен акаунт')
}

function formatEntityLabel(row) {
  const entityLabel = ENTITY_LABELS[row.entity_type] || row.entity_type || 'Запис'
  return row.entity_id ? `${entityLabel} ${shortId(row.entity_id)}` : entityLabel
}

function label(value = '') {
  return String(value || '').replace(/_/g, ' ')
}

function compact(values) {
  return values.filter(Boolean)
}

function shortId(value = '') {
  const text = String(value || '')
  if (text.length <= 12) return text
  return `${text.slice(0, 8)}…${text.slice(-4)}`
}

function InfoLine({ label, value }) {
  return (
    <div className="flex items-center gap-2 text-ink/80">
      <UserRound size={15} className="shrink-0" />
      <span className="min-w-0">
        <span className="text-muted">{label}: </span>
        <span className="break-words">{value}</span>
      </span>
    </div>
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
  return (
    <div className="rounded-3xl border border-line bg-paper p-6">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}
