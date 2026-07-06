import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { CheckCircle2, Clock, Eye, ImagePlus, LayoutGrid, List, Pencil, RefreshCw, Search, X, XCircle, Trash2 } from 'lucide-react'
import { ADMIN_INPUT_CLASS, approvePartnerService, editAndApprovePartnerService, formatAdminDate, rejectPartnerService } from '../../lib/admin.js'
import {
  SERVICE_STATUS_LABELS,
  deletePartnerService,
  deleteServiceModerationAttachments,
  loadAdminPartnerServices,
  packagePriceLabel,
  uploadServiceModerationAttachment,
} from '../../lib/partner-services.js'
import { getPartnerServiceCoverCandidates } from '../../lib/service-media.js'
import { supabase } from '../../lib/supabase.js'
import FallbackImage from '../FallbackImage.jsx'

const STATUS_FILTERS = [
  ['all', 'Всички'],
  ['pending', 'Чакащи'],
  ['approved', 'Одобрени'],
  ['rejected', 'Върнати'],
]

export default function PartnerServicesManager({ globalQuery }) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [localQuery, setLocalQuery] = useState('')
  const [viewMode, setViewMode] = useState('details')
  const [actionState, setActionState] = useState({ id: '', status: 'idle' })
  const [serviceToDelete, setServiceToDelete] = useState(null)
  const [moderationDialog, setModerationDialog] = useState(null)

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

  async function updateServiceStatus(service, nextStatus) {
    if (nextStatus === 'rejected') {
      setModerationDialog({ mode: 'reject', service })
      return
    }
    setActionState({ id: service.id, status: nextStatus })
    setError('')
    try {
      await approvePartnerService(service.id, 'Одобрено от Totsan.')
      await load()
    } catch (actionError) {
      setError(actionError.message || 'Статусът не се обнови.')
    } finally {
      setActionState({ id: '', status: 'idle' })
    }
  }

  async function submitRejection({ note, files }) {
    const service = moderationDialog?.service
    if (!service) return
    setActionState({ id: service.id, status: 'rejected' })
    setError('')
    const uploaded = []
    try {
      for (const file of files) {
        uploaded.push(await uploadServiceModerationAttachment({ serviceId: service.id, file }))
      }
      await rejectPartnerService(service.id, note, uploaded)
      setModerationDialog(null)
      await load()
    } catch (actionError) {
      if (uploaded.length) {
        deleteServiceModerationAttachments(uploaded).catch(() => {})
      }
      setError(actionError.message || 'Услугата не беше върната.')
      throw actionError
    } finally {
      setActionState({ id: '', status: 'idle' })
    }
  }

  async function submitEditorialApproval({ updates, note }) {
    const service = moderationDialog?.service
    if (!service) return
    setActionState({ id: service.id, status: 'approved' })
    setError('')
    try {
      await editAndApprovePartnerService(service.id, updates, note)
      setModerationDialog(null)
      await load()
    } catch (actionError) {
      setError(actionError.message || 'Редакцията не беше запазена.')
      throw actionError
    } finally {
      setActionState({ id: '', status: 'idle' })
    }
  }

  function deleteService(service) {
    setServiceToDelete(service)
  }

  async function confirmDeleteService() {
    if (!serviceToDelete) return
    const service = serviceToDelete
    setServiceToDelete(null)
    setActionState({ id: service.id, status: 'saving' })
    try {
      await deletePartnerService(service.id)
      setRows(current => current.filter(item => item.id !== service.id))
    } catch (err) {
      setError(err.message || 'Грешка при изтриване.')
    } finally {
      setActionState({ id: '', status: 'idle' })
    }
  }

  if (status === 'loading') return <Panel title="Зареждаме услугите…" />
  if (status === 'error') return <Panel title="Услугите не се заредиха"><p className="text-sm text-red-700">{error}</p><button type="button" onClick={load} className="btn btn-ghost mt-5">Опитай пак</button></Panel>

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="eyebrow">Управление</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Партньорски услуги</h2>
            <p className="mt-2 text-sm text-muted">Преглеждай изпратени услуги преди да станат публични в каталога, услугите и партньорските профили.</p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <div className="inline-flex rounded-full border border-line bg-soft p-1" aria-label="Изглед">
              <ViewModeButton icon={LayoutGrid} active={viewMode === 'grid'} label="Grid View" onClick={() => setViewMode('grid')} />
              <ViewModeButton icon={List} active={viewMode === 'details'} label="Details View" onClick={() => setViewMode('details')} />
            </div>
            <button type="button" onClick={load} className="btn btn-ghost"><RefreshCw size={18} /> Обнови</button>
          </div>
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
        {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      </div>

      <div className={viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 2xl:grid-cols-3' : 'grid gap-4'}>
        {filtered.map(service => (
          viewMode === 'grid'
            ? <ServiceGridCard key={service.id} service={service} actionState={actionState} updateServiceStatus={updateServiceStatus} editService={(item) => setModerationDialog({ mode: 'edit', service: item })} deleteService={deleteService} />
            : <ServiceDetailsCard key={service.id} service={service} actionState={actionState} updateServiceStatus={updateServiceStatus} editService={(item) => setModerationDialog({ mode: 'edit', service: item })} deleteService={deleteService} />
        ))}
        {filtered.length === 0 && <div className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">Няма изпратени услуги в този филтър.</div>}
      </div>

      {serviceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-line bg-paper p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Trash2 size={24} />
            </div>
            <h3 className="mt-4 font-display text-2xl text-ink">Изтриване на услуга</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Сигурни ли сте, че искате да изтриете услугата <strong className="text-ink font-medium">„{serviceToDelete.title}“</strong>? Това действие е окончателно и ще изтрие всички данни и прикачените файлове.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setServiceToDelete(null)}
                className="btn btn-ghost flex-1 justify-center py-2.5 text-sm"
              >
                Отказ
              </button>
              <button
                type="button"
                onClick={confirmDeleteService}
                className="btn bg-red-600 text-white hover:bg-red-700 active:bg-red-800 flex-1 justify-center py-2.5 text-sm font-medium"
              >
                Да, изтрий
              </button>
            </div>
          </div>
        </div>
      )}

      {moderationDialog?.mode === 'reject' && createPortal(
        <ReturnServiceDialog
          service={moderationDialog.service}
          saving={actionState.id === moderationDialog.service.id}
          onClose={() => setModerationDialog(null)}
          onSubmit={submitRejection}
        />,
        document.body,
      )}

      {moderationDialog?.mode === 'edit' && createPortal(
        <EditorialServiceDialog
          service={moderationDialog.service}
          saving={actionState.id === moderationDialog.service.id}
          onClose={() => setModerationDialog(null)}
          onSubmit={submitEditorialApproval}
        />,
        document.body,
      )}
    </div>
  )
}

function ReturnServiceDialog({ service, saving, onClose, onSubmit }) {
  const [note, setNote] = useState('')
  const [files, setFiles] = useState([])
  const [localError, setLocalError] = useState('')

  function close() {
    files.forEach(item => URL.revokeObjectURL(item.preview))
    onClose()
  }

  function queueFiles(selected) {
    setLocalError('')
    const next = []
    for (const file of selected) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setLocalError('Разрешени са JPG, PNG и WebP изображения.')
        continue
      }
      if (file.size > 5 * 1024 * 1024) {
        setLocalError('Всяка снимка трябва да бъде до 5 MB.')
        continue
      }
      next.push({ file, preview: URL.createObjectURL(file) })
    }
    setFiles(current => {
      const availableSlots = Math.max(0, 3 - current.length)
      next.slice(availableSlots).forEach(item => URL.revokeObjectURL(item.preview))
      return [...current, ...next.slice(0, availableSlots)]
    })
  }

  function addFiles(event) {
    queueFiles(Array.from(event.target.files || []))
    event.target.value = ''
  }

  function pasteFiles(event) {
    const pastedImages = Array.from(event.clipboardData?.items || [])
      .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter(Boolean)
    if (!pastedImages.length) return
    event.preventDefault()
    queueFiles(pastedImages)
  }

  function removeFile(index) {
    setFiles(current => current.filter((item, itemIndex) => {
      if (itemIndex === index) URL.revokeObjectURL(item.preview)
      return itemIndex !== index
    }))
  }

  async function submit(event) {
    event.preventDefault()
    if (!note.trim()) {
      setLocalError('Напиши конкретна причина и какво трябва да се коригира.')
      return
    }
    setLocalError('')
    try {
      await onSubmit({ note: note.trim(), files: files.map(item => item.file) })
      files.forEach(item => URL.revokeObjectURL(item.preview))
    } catch (error) {
      setLocalError(error.message || 'Обратната връзка не беше изпратена.')
    }
  }

  return (
    <ModalShell title="Върни услугата за корекция" subtitle={service.title} onClose={close}>
      <form onSubmit={submit} onPaste={pasteFiles}>
        <label className="block text-sm font-medium text-ink">
          Бележка към партньора
          <textarea
            value={note}
            onChange={event => setNote(event.target.value)}
            rows={6}
            maxLength={2000}
            className={`${ADMIN_INPUT_CLASS} resize-none`}
            placeholder="Опиши какво не е наред и как партньорът може да го поправи."
            autoFocus
          />
        </label>
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-ink">Снимки към бележката</div>
              <div className="mt-1 text-xs text-muted">Постави screenshot с Ctrl+V или прикачи до 3 изображения, максимум 5 MB всяко.</div>
            </div>
            {files.length < 3 && (
              <label className="btn btn-ghost cursor-pointer !px-4 !py-2 text-sm">
                <ImagePlus size={17} /> Прикачи
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={addFiles} />
              </label>
            )}
          </div>
          {files.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {files.map((item, index) => (
                <div key={item.preview} className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-soft">
                  <img src={item.preview} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeFile(index)} className="absolute right-2 top-2 rounded-full bg-ink/75 p-1.5 text-paper backdrop-blur" aria-label="Премахни снимката">
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {localError && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{localError}</div>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={close} disabled={saving} className="btn btn-ghost justify-center">Отказ</button>
          <button type="submit" disabled={saving} className="btn justify-center border border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-200">
            <XCircle size={18} /> {saving ? 'Изпращаме…' : 'Върни с бележка'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function EditorialServiceDialog({ service, saving, onClose, onSubmit }) {
  const [draft, setDraft] = useState({
    title: service.title || '',
    subtitle: service.subtitle || '',
    descriptionMd: service.descriptionMd || '',
    tagsText: (service.tags || []).join(', '),
  })
  const [note, setNote] = useState('Коригирано редакторски и одобрено от Totsan.')
  const [localError, setLocalError] = useState('')
  const original = {
    title: service.title || '',
    subtitle: service.subtitle || '',
    descriptionMd: service.descriptionMd || '',
    tagsText: (service.tags || []).join(', '),
  }
  const changedFields = Object.keys(original).filter(key => draft[key] !== original[key])

  function update(field, value) {
    setDraft(current => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    if (!draft.title.trim()) {
      setLocalError('Заглавието е задължително.')
      return
    }
    setLocalError('')
    try {
      await onSubmit({
        updates: {
          title: draft.title,
          subtitle: draft.subtitle,
          description_md: draft.descriptionMd,
          tags: draft.tagsText.split(',').map(item => item.trim()).filter(Boolean),
        },
        note: note.trim(),
      })
    } catch (error) {
      setLocalError(error.message || 'Редакцията не беше запазена.')
    }
  }

  return (
    <ModalShell title="Редактирай и одобри" subtitle={service.title} onClose={onClose} wide>
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          <AdminEditField label="Заглавие" value={draft.title} original={original.title} onChange={value => update('title', value)} maxLength={140} />
          <AdminEditField label="Кратко подзаглавие" value={draft.subtitle} original={original.subtitle} onChange={value => update('subtitle', value)} maxLength={280} />
          <AdminEditField label="Тагове" value={draft.tagsText} original={original.tagsText} onChange={value => update('tagsText', value)} />
          <label className="block text-sm font-medium text-ink">
            Описание
            <textarea value={draft.descriptionMd} onChange={event => update('descriptionMd', event.target.value)} rows={10} maxLength={12000} className={`${ADMIN_INPUT_CLASS} resize-y`} />
            {draft.descriptionMd !== original.descriptionMd && <ChangePreview before={original.descriptionMd} />}
          </label>
        </div>
        <aside className="space-y-4">
          <div className="rounded-3xl border border-line bg-soft p-4">
            <div className="text-sm font-medium text-ink">Редакторска следа</div>
            <p className="mt-2 text-xs leading-5 text-muted">Промените ще бъдат записани в audit log с предишната и новата стойност.</p>
            <div className="mt-3 rounded-2xl bg-paper px-3 py-2 text-sm text-ink">
              Променени полета: <strong>{changedFields.length}</strong>
            </div>
          </div>
          <label className="block text-sm font-medium text-ink">
            Бележка
            <textarea value={note} onChange={event => setNote(event.target.value)} rows={5} maxLength={2000} className={`${ADMIN_INPUT_CLASS} resize-none`} />
          </label>
          {localError && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{localError}</div>}
          <button type="submit" disabled={saving} className="btn btn-primary w-full justify-center">
            <CheckCircle2 size={18} /> {saving ? 'Публикуваме…' : 'Запази и одобри'}
          </button>
          <button type="button" onClick={onClose} disabled={saving} className="btn btn-ghost w-full justify-center">Отказ</button>
        </aside>
      </form>
    </ModalShell>
  )
}

function AdminEditField({ label, value, original, onChange, maxLength }) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <input value={value} onChange={event => onChange(event.target.value)} maxLength={maxLength} className={ADMIN_INPUT_CLASS} />
      {value !== original && <ChangePreview before={original} />}
    </label>
  )
}

function ChangePreview({ before }) {
  return <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Преди: {before || '—'}</div>
}

function ModalShell({ title, subtitle, onClose, wide = false, children }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-ink/65 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`my-auto w-full overflow-hidden rounded-[2rem] border border-line bg-paper shadow-2xl ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h3 className="font-display text-3xl text-ink">{title}</h3>
            <p className="mt-1 text-sm text-muted">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-muted transition hover:bg-soft hover:text-ink" aria-label="Затвори">
            <X size={21} />
          </button>
        </div>
        <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto p-5 sm:p-6">{children}</div>
      </div>
    </div>
  )
}

function ViewModeButton({ icon: Icon, active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition ${active ? 'bg-ink text-paper shadow-sm' : 'text-muted hover:bg-paper hover:text-ink'}`}
    >
      <Icon size={18} />
    </button>
  )
}

function ServiceDetailsCard({ service, actionState, updateServiceStatus, editService, deleteService }) {
  return (
    <article className="rounded-3xl border border-line bg-paper p-5 md:p-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <ServiceStatusPill service={service} />
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
        <ServiceActions service={service} actionState={actionState} updateServiceStatus={updateServiceStatus} editService={editService} deleteService={deleteService} />
      </div>
    </article>
  )
}

function ServiceGridCard({ service, actionState, updateServiceStatus, editService, deleteService }) {
  const coverCandidates = getPartnerServiceCoverCandidates(service, service.profile)

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-paper transition hover:border-ink/20">
      <div className="media-frame aspect-[16/10] bg-soft">
        <FallbackImage sources={coverCandidates} alt={service.title} loading="lazy" decoding="async" className="img-cover img-zoom" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <ServiceStatusPill service={service} />
          {service.isPublished && <span className="rounded-full bg-paper/95 px-3 py-1 text-xs font-medium text-green-700 backdrop-blur">Публична</span>}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-1 text-xs text-muted"><Clock size={14} /> {formatAdminDate(service.createdAt)}</div>
        <h3 className="mt-3 line-clamp-2 font-display text-2xl text-ink">{service.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{service.subtitle || 'Без подзаглавие'}</p>
        <div className="mt-4 grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="text-muted">Партньор</span>
            <span className="truncate font-medium text-ink">{service.profile?.name || '—'}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="text-muted">Цена</span>
            <span className="font-medium text-ink">{packagePriceLabel(service)}</span>
          </div>
        </div>
        <div className="mt-auto pt-5">
          <ServiceActions service={service} actionState={actionState} updateServiceStatus={updateServiceStatus} editService={editService} deleteService={deleteService} compact />
        </div>
      </div>
    </article>
  )
}

function ServiceActions({ service, actionState, updateServiceStatus, editService, deleteService, compact = false }) {
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {service.moderationStatus === 'pending' && (
        <>
          <button type="button" onClick={() => updateServiceStatus(service, 'approved')} disabled={actionState.id === service.id} className="btn btn-primary w-full justify-center whitespace-nowrap !py-2 text-sm"><CheckCircle2 size={16} /> Одобри</button>
          <button type="button" onClick={() => editService(service)} disabled={actionState.id === service.id} className="btn btn-ghost w-full justify-center whitespace-nowrap !py-2 text-sm"><Pencil size={16} /> Редактирай и одобри</button>
          <button type="button" onClick={() => updateServiceStatus(service, 'rejected')} disabled={actionState.id === service.id} className="btn btn-ghost w-full justify-center whitespace-nowrap !py-2 text-sm"><XCircle size={16} /> Върни</button>
        </>
      )}
      {service.isPublished ? (
        <Link to={`/uslugi/${service.slug}`} className="btn btn-ghost w-full justify-center whitespace-nowrap !py-2 text-sm"><Eye size={16} /> Публична страница</Link>
      ) : (
        <Link to={`/uslugi/${service.slug}`} className="btn btn-ghost w-full justify-center whitespace-nowrap !py-2 text-sm text-amber-700 hover:bg-amber-50"><Eye size={16} /> Преглед на услугата</Link>
      )}
      {!service.isPublished && service.moderationStatus !== 'pending' && !compact && <div className="rounded-2xl border border-line bg-soft p-4 text-sm text-muted">Тази услуга не е публична за клиенти.</div>}
      <button type="button" onClick={() => deleteService(service)} disabled={actionState.id === service.id} className="btn border border-red-200 text-red-600 hover:bg-red-50 w-full justify-center whitespace-nowrap !py-2 text-sm"><Trash2 size={16} className="mr-1.5" /> Изтрий</button>
    </div>
  )
}

function ServiceStatusPill({ service }) {
  const status = service.moderationStatus
  const tone = status === 'approved'
    ? 'bg-green-50 text-green-700'
    : status === 'pending'
      ? 'bg-amber-50 text-amber-800'
      : status === 'rejected'
        ? 'bg-red-50 text-red-700'
        : 'bg-soft text-muted'

  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${tone}`}>{SERVICE_STATUS_LABELS[status] || status}</span>
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
