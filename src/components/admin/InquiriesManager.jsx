import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Copy, Forward, LoaderCircle, Mail, Phone, RefreshCcw, Search, UserRoundCheck, X } from 'lucide-react'
import { ADMIN_INPUT_CLASS, INQUIRY_STATUS_LABELS, assignInquiry as assignAdminInquiry, contactHref, deleteInquiry as deleteAdminInquiry, formatAdminDate, loadAssignablePartners, loadInquiries, matchesSearch, paginateRows, updateInquiryStatus } from '../../lib/admin.js'
import { INQUIRY_STATUS_META, StatusSelect } from './AdminStatus.jsx'
import TotsanSelect from '../ui/TotsanSelect.jsx'

const SOURCE_LABELS = {
  project_brief: 'Проектен бриф',
  start_brief: 'Проектен бриф',
  contact_form: 'Контактна форма',
  pro_inquiry: 'Към специалист',
}

const LAYER_LABELS = {
  ideya: 'Слой 01 · Идея',
  postroyka: 'Слой 02 · Постройка',
  materiali: 'Слой 03 · Материали',
  obzavezhdane: 'Слой 04 · Обзавеждане',
  dekoraciya: 'Слой 05 · Декорация',
}

const OPEN_INQUIRY_STATUSES = new Set(['new', 'seen'])
const STATUS_FILTER_OPTIONS = [
  ['all', 'Всички'],
  ['open', 'Без финал'],
  ...Object.entries(INQUIRY_STATUS_LABELS),
]

export default function InquiriesManager({ globalQuery = '', inquiryStatusShortcut = 'all' }) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState('')
  const [rowAction, setRowAction] = useState({ id: '', type: '' })
  const [contactRow, setContactRow] = useState(null)
  const [assignmentRow, setAssignmentRow] = useState(null)
  const [partners, setPartners] = useState([])
  const [partnerStatus, setPartnerStatus] = useState('idle')
  const [partnerQuery, setPartnerQuery] = useState('')

  useEffect(() => { load() }, [])

  useEffect(() => {
    setStatusFilter(inquiryStatusShortcut || 'all')
  }, [inquiryStatusShortcut])

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
    if (statusFilter === 'open' && !OPEN_INQUIRY_STATUSES.has(row.status)) return false
    if (statusFilter !== 'all' && statusFilter !== 'open' && row.status !== statusFilter) return false
    if (!matchesSourceFilter(row, sourceFilter)) return false
    return matchesSearch(row, query || globalQuery, ['name', 'contact', 'message', 'source', 'target_slug', 'layer_slug'])
  }), [rows, query, globalQuery, statusFilter, sourceFilter])

  const pageData = useMemo(() => paginateRows(filtered, page), [filtered, page])
  const filteredPartners = useMemo(() => {
    const needle = partnerQuery.trim().toLowerCase()
    if (!needle) return partners
    return partners.filter((partner) => (
      `${partner.name || ''} ${partner.tag || ''} ${partner.city || ''} ${partner.layer_slug || ''} ${partner.slug || ''}`
        .toLowerCase()
        .includes(needle)
    ))
  }, [partnerQuery, partners])
  useEffect(() => { setPage(1) }, [query, globalQuery, statusFilter, sourceFilter])

  async function changeStatus(row, nextStatus) {
    if (rowAction.id === row.id) return
    setRowAction({ id: row.id, type: 'status' })
    setMessage('Запазваме статус…')
    try {
      const result = await updateInquiryStatus(row.id, nextStatus)
      const updatedRow = result?.row || { ...row, status: nextStatus }
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, ...updatedRow } : item))
      setMessage('Статусът е обновен и записан в audit log.')
    } catch (actionError) {
      setMessage(actionError.message || 'Статусът не се обнови.')
    } finally {
      setRowAction({ id: '', type: '' })
    }
  }

  async function deleteInquiry(row) {
    if (!window.confirm('Сигурни ли сте, че искате да изтриете това запитване?')) return
    setRowAction({ id: row.id, type: 'delete' })
    setMessage('Изтриване...')
    try {
      await deleteAdminInquiry(row.id)
      setRows(current => current.filter(item => item.id !== row.id))
      setMessage('Запитването е изтрито.')
    } catch (err) {
      setMessage(err.message || 'Грешка при изтриване.')
    } finally {
      setRowAction({ id: '', type: '' })
    }
  }

  async function openAssignment(row) {
    setAssignmentRow(row)
    setPartnerQuery('')
    if (partnerStatus !== 'idle') return

    setPartnerStatus('loading')
    try {
      setPartners(await loadAssignablePartners())
      setPartnerStatus('ready')
    } catch (loadError) {
      setPartnerStatus('error')
      setMessage(loadError.message || 'Партньорите не се заредиха.')
    }
  }

  async function saveAssignment(profile) {
    if (!assignmentRow || rowAction.id === assignmentRow.id) return
    setRowAction({ id: assignmentRow.id, type: 'assign' })
    setMessage(profile ? 'Препращаме запитването…' : 'Премахваме назначението…')

    try {
      const result = await assignAdminInquiry(assignmentRow.id, profile?.id || '')
      const updatedRow = {
        ...assignmentRow,
        ...(result?.row || {}),
        assigned_profile: result?.profile || null,
      }
      setRows((current) => current.map((item) => item.id === assignmentRow.id ? { ...item, ...updatedRow } : item))
      setAssignmentRow(null)
      setMessage(profile ? `Запитването е препратено към ${profile.name}.` : 'Назначението е премахнато.')
    } catch (actionError) {
      setMessage(actionError.message || 'Запитването не беше препратено.')
    } finally {
      setRowAction({ id: '', type: '' })
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
        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <label className="relative block text-sm font-medium text-ink">Търсене<Search size={17} className="pointer-events-none absolute left-4 top-[2.35rem] text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} className={`${ADMIN_INPUT_CLASS} pl-11`} placeholder="Име, контакт, съобщение…" /></label>
          <TotsanSelect label="Статус" value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTER_OPTIONS} />
          <TotsanSelect label="Източник" value={sourceFilter} onChange={setSourceFilter} options={[['all', 'Всички източници'], ['project_brief', 'Проектен бриф'], ['contact_form', 'Контактна форма'], ['pro_inquiry', 'Към специалист'], ['other', 'Други']]} />
        </div>
        {message && <div className="mt-4 text-sm text-muted">{message}</div>}
      </div>

      <div className="space-y-3">
        {pageData.rows.map((row) => (
          <article key={row.id} className="rounded-3xl border border-line bg-paper p-5">
            {row.assigned_profile && (
              <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
                <UserRoundCheck size={16} />
                <span>Препратено към <strong>{row.assigned_profile.name}</strong></span>
              </div>
            )}
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap gap-2">
                  <MetaBadge>{sourceLabel(row.source)}</MetaBadge>
                  {row.layer_slug && <MetaBadge>{layerLabel(row.layer_slug)}</MetaBadge>}
                  {row.target_slug && <MetaBadge>{`Директно към: ${row.target_slug}`}</MetaBadge>}
                </div>
                <div className="font-display text-2xl text-ink">{row.name}</div>
                <a href={contactHref(row.contact)} className="mt-1 inline-flex items-center gap-2 text-sm text-muted hover:text-accent"><Mail size={16} /> {row.contact}</a>
              </div>
              <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
                <StatusSelect
                  value={row.status}
                  onChange={(value) => changeStatus(row, value)}
                  options={Object.entries(INQUIRY_STATUS_LABELS)}
                  metaMap={INQUIRY_STATUS_META}
                  disabled={rowAction.id === row.id}
                  ariaLabel="Статус на запитването"
                />
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <button type="button" onClick={() => setContactRow(row)} className="btn btn-ghost !py-2 text-sm"><Mail size={16} /> Свържи се</button>
                  <button type="button" onClick={() => openAssignment(row)} className="btn btn-ghost !py-2 text-sm"><Forward size={16} /> {row.assigned_profile ? 'Пренасочи' : 'Препрати'}</button>
                  {OPEN_INQUIRY_STATUSES.has(row.status) && (
                    <button type="button" onClick={() => changeStatus(row, 'replied')} disabled={rowAction.id === row.id} className="btn btn-primary !py-2 text-sm disabled:cursor-wait disabled:opacity-60">
                      {rowAction.id === row.id && rowAction.type === 'status' ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      {rowAction.id === row.id && rowAction.type === 'status' ? 'Записване…' : 'Отговорено'}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm text-ink/80">{row.message}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted items-center justify-between">
              <div className="flex flex-wrap gap-2"><span>{formatAdminDate(row.created_at)}</span><span>· {row.source || 'contact_form'}</span>{row.layer_slug && <span>· слой: {row.layer_slug}</span>}{row.target_slug && <span>· към: {row.target_slug}</span>}</div>
              <button type="button" onClick={() => deleteInquiry(row)} disabled={rowAction.id === row.id} className="font-medium text-red-600 hover:text-red-700 disabled:cursor-wait disabled:opacity-50">Изтрий</button>
            </div>
          </article>
        ))}
        {pageData.rows.length === 0 && <Empty text="Няма запитвания по тези филтри." />}
      </div>
      <Pager current={pageData.currentPage} total={pageData.totalPages} onChange={setPage} />
      {contactRow ? <ContactDialog row={contactRow} onClose={() => setContactRow(null)} /> : null}
      {assignmentRow ? (
        <AssignmentDialog
          row={assignmentRow}
          partners={filteredPartners}
          query={partnerQuery}
          onQueryChange={setPartnerQuery}
          status={partnerStatus}
          isSaving={rowAction.id === assignmentRow.id && rowAction.type === 'assign'}
          onSelect={saveAssignment}
          onClose={() => setAssignmentRow(null)}
        />
      ) : null}
    </section>
  )
}

function ContactDialog({ row, onClose }) {
  const [copyStatus, setCopyStatus] = useState('idle')
  const isEmail = String(row.contact || '').includes('@')
  const subject = `Запитване в Totsan · ${row.name}`
  const body = `Здравейте, ${row.name},\n\nСвързваме се с Вас относно запитването Ви в Totsan.\n\nПоздрави,\nЕкипът на Totsan`
  const actionHref = isEmail
    ? `mailto:${row.contact}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : contactHref(row.contact)

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  async function copyContact() {
    try {
      await navigator.clipboard.writeText(row.contact)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
  }

  return (
    <DialogFrame title="Свържи се с клиента" onClose={onClose}>
      <div className="rounded-2xl border border-line bg-soft p-4">
        <div className="font-display text-xl text-ink">{row.name}</div>
        <div className="mt-1 text-sm text-muted">{row.contact}</div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={copyContact} className="btn btn-ghost justify-center">
          <Copy size={17} /> {copyStatus === 'copied' ? 'Копирано' : 'Копирай'}
        </button>
        <a href={actionHref} className="btn btn-primary justify-center" onClick={onClose}>
          {isEmail ? <Mail size={17} /> : <Phone size={17} />}
          {isEmail ? 'Изпрати email' : 'Обади се'}
        </a>
      </div>
      {copyStatus === 'error' ? <p className="mt-3 text-sm text-red-700">Контактът не можа да бъде копиран автоматично.</p> : null}
    </DialogFrame>
  )
}

function AssignmentDialog({ row, partners, query, onQueryChange, status, isSaving, onSelect, onClose }) {
  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !isSaving) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isSaving, onClose])

  return (
    <DialogFrame title="Препрати към партньор" onClose={onClose} closeDisabled={isSaving}>
      <p className="text-sm text-muted">Избери партньора, който ще получи запитването в своя профил.</p>
      <label className="relative mt-4 block">
        <span className="sr-only">Търси партньор</span>
        <Search size={17} className="pointer-events-none absolute left-4 top-3.5 text-muted" />
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} className={`${ADMIN_INPUT_CLASS} !mt-0 pl-11`} placeholder="Име, град, слой или специалност…" autoFocus />
      </label>

      <div className="mt-4 max-h-[22rem] space-y-2 overflow-y-auto pr-1">
        {status === 'loading' ? <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted"><LoaderCircle size={18} className="animate-spin" /> Зареждаме партньорите…</div> : null}
        {status === 'error' ? <div className="py-8 text-center text-sm text-red-700">Партньорите не можаха да бъдат заредени.</div> : null}
        {status === 'ready' && partners.length === 0 ? <div className="py-8 text-center text-sm text-muted">Няма намерени партньори.</div> : null}
        {status === 'ready' ? partners.map((partner) => (
          <button
            key={partner.id}
            type="button"
            onClick={() => onSelect(partner)}
            disabled={isSaving}
            className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition hover:border-accent hover:bg-accent/5 disabled:cursor-wait disabled:opacity-60 ${row.assigned_profile_id === partner.id ? 'border-accent bg-accent/5' : 'border-line bg-paper'}`}
          >
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{partner.name}</span>
              <span className="mt-1 block truncate text-xs text-muted">{[partner.tag, partner.city, layerLabel(partner.layer_slug)].filter(Boolean).join(' · ')}</span>
            </span>
            {row.assigned_profile_id === partner.id ? <CheckCircle2 size={18} className="shrink-0 text-accentDeep" /> : <Forward size={18} className="shrink-0 text-muted" />}
          </button>
        )) : null}
      </div>

      {row.assigned_profile_id ? (
        <button type="button" onClick={() => onSelect(null)} disabled={isSaving} className="mt-4 text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-wait disabled:opacity-60">
          Премахни назначението
        </button>
      ) : null}
    </DialogFrame>
  )
}

function DialogFrame({ title, children, onClose, closeDisabled = false }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/45 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-xl rounded-3xl border border-line bg-paper p-5 shadow-2xl md:p-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-display text-2xl text-ink">{title}</h3>
          <button type="button" onClick={onClose} disabled={closeDisabled} className="rounded-full p-2 text-muted transition hover:bg-soft hover:text-ink disabled:cursor-wait disabled:opacity-50" aria-label="Затвори">
            <X size={20} />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}

function Pager({ current, total, onChange }) {
  if (total <= 1) return null
  return <div className="flex items-center justify-end gap-2"><button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => onChange(current - 1)} disabled={current <= 1}>Назад</button><span className="text-sm text-muted">{current} / {total}</span><button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => onChange(current + 1)} disabled={current >= total}>Напред</button></div>
}

function matchesSourceFilter(row, sourceFilter) {
  if (sourceFilter === 'all') return true
  const source = String(row.source || '').trim()
  if (sourceFilter === 'project_brief') return source === 'project_brief' || source === 'start_brief'
  if (sourceFilter === 'contact_form') return source === 'contact_form'
  if (sourceFilter === 'pro_inquiry') return source === 'pro_inquiry'
  if (sourceFilter === 'other') {
    return !source || !['project_brief', 'start_brief', 'contact_form', 'pro_inquiry'].includes(source)
  }
  return true
}

function sourceLabel(source) {
  return SOURCE_LABELS[source] || 'Запитване'
}

function layerLabel(layerSlug) {
  return LAYER_LABELS[layerSlug] || `Слой: ${layerSlug}`
}

function MetaBadge({ children }) {
  return <span className="rounded-full border border-line bg-soft px-3 py-1 text-xs font-medium text-ink">{children}</span>
}

function Empty({ text }) { return <div className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">{text}</div> }
function Panel({ title, children }) { return <div className="rounded-3xl border border-line bg-paper p-6"><h2 className="font-display text-2xl text-ink">{title}</h2>{children && <div className="mt-3">{children}</div>}</div> }
