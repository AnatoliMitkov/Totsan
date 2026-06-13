import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Eye, RefreshCcw, Search, X, XCircle } from 'lucide-react'
import { ADMIN_INPUT_CLASS, APPLICATION_STATUS_LABELS, approveSpecialist, formatAdminDate, loadPartnerApplications, matchesSearch, paginateRows, rejectSpecialist } from '../../lib/admin.js'
import { supabase } from '../../lib/supabase.js'
import TotsanSelect from '../ui/TotsanSelect.jsx'

const CATEGORY_LABELS = {
  ideya: 'Идея и визия',
  postroyka: 'Строителство и ремонти',
  materiali: 'Избор на материали',
  obzavezhdane: 'Обзавеждане',
  dekoraciya: 'Декорация и финал',
}

const WORK_STYLE_LABELS = {
  laborOnly: 'Само труд',
  laborMaterials: 'Труд + материали',
  consultation: 'Консултация',
  siteVisit: 'Оглед на място',
  fullOrganization: 'Цялостна организация',
}

export default function ApplicationsManager({ globalQuery = '' }) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [page, setPage] = useState(1)
  const [message, setMessage] = useState('')
  const [selectedApplication, setSelectedApplication] = useState(null)

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

  async function deleteApplication(row) {
    if (!window.confirm('Сигурни ли сте, че искате да изтриете тази кандидатура?')) return
    setMessage('Изтриване...')
    try {
      const { error: delError } = await supabase.from('partner_applications').delete().eq('id', row.id)
      if (delError) throw delError
      setRows(current => current.filter(item => item.id !== row.id))
      setMessage('Кандидатурата е изтрита.')
    } catch (err) {
      setMessage(err.message || 'Грешка при изтриване.')
    }
  }

  if (status === 'loading') return <Panel title="Зареждаме кандидатурите…" />
  if (status === 'error') return <Panel title="Кандидатурите не се заредиха"><p className="text-sm text-red-700">{error}</p><button type="button" onClick={load} className="btn btn-ghost mt-5">Опитай пак</button></Panel>

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><div className="eyebrow">Кандидатури</div><h2 className="mt-2 font-display text-3xl text-ink">Партньори за одобрение</h2></div><button type="button" onClick={load} className="btn btn-ghost self-start"><RefreshCcw size={17} /> Обнови</button></div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem]"><label className="relative block text-sm font-medium text-ink">Търсене<Search size={17} className="pointer-events-none absolute left-4 top-[2.35rem] text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} className={`${ADMIN_INPUT_CLASS} pl-11`} placeholder="Име, фирма, имейл…" /></label><TotsanSelect label="Статус" value={statusFilter} onChange={setStatusFilter} options={[['all', 'Всички'], ...Object.entries(APPLICATION_STATUS_LABELS)]} /></div>
        {message && <div className="mt-4 text-sm text-muted">{message}</div>}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {pageData.rows.map((row) => <ApplicationCard key={row.id} row={row} onOpen={setSelectedApplication} onApprove={approve} onReject={reject} onDelete={deleteApplication} />)}
        {pageData.rows.length === 0 && <Empty text="Няма кандидатури по тези филтри." />}
      </div>
      <Pager current={pageData.currentPage} total={pageData.totalPages} onChange={setPage} />
      {selectedApplication && <ApplicationDetailsModal row={selectedApplication} onClose={() => setSelectedApplication(null)} />}
    </section>
  )
}

function ApplicationCard({ row, onOpen, onApprove, onReject, onDelete }) {
  const details = getDetails(row)
  const summary = row.about || details.presentation?.intro || details.proof?.projectDescription || 'Няма кратко описание.'
  const category = getCategoryLabel(row, details)
  const primaryCity = details.serviceAreas?.primaryCity || row.city || details.city || ''

  return (
    <article className="rounded-3xl border border-line bg-paper p-5 shadow-[0_20px_70px_-55px_rgba(13,35,64,0.55)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-display text-2xl text-ink">{row.name || 'Без име'}</div>
          <div className="mt-1 text-sm text-muted">{row.company || 'Без фирма'} · {row.email || 'без имейл'}</div>
          {row.phone && <div className="text-sm text-muted">{row.phone}</div>}
        </div>
        <StatusPill value={row.status} />
      </div>

      <p className="mt-4 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-ink/80">{summary}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <InfoChip>{formatAdminDate(row.created_at)}</InfoChip>
        {category && <InfoChip>{category}</InfoChip>}
        {primaryCity && <InfoChip>{primaryCity}</InfoChip>}
        {!row.user_id && <InfoChip tone="warning">без свързан акаунт</InfoChip>}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onOpen(row)} className="btn btn-ghost !py-2 text-sm"><Eye size={17} /> Виж детайли</button>
          {row.status === 'pending' && (
            <>
              <button type="button" onClick={() => onApprove(row)} disabled={!row.user_id} className="btn btn-primary !py-2 text-sm disabled:opacity-50"><CheckCircle2 size={17} /> Одобри</button>
              <button type="button" onClick={() => onReject(row)} className="btn btn-ghost !py-2 text-sm"><XCircle size={17} /> Отхвърли</button>
            </>
          )}
        </div>
        <button type="button" onClick={() => onDelete(row)} className="text-sm font-medium text-red-600 hover:text-red-700">Изтрий</button>
      </div>
    </article>
  )
}

function StatusPill({ value }) {
  const tones = { approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', pending: 'bg-amber-100 text-amber-900' }
  return <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${tones[value] || tones.pending}`}>{APPLICATION_STATUS_LABELS[value] || value}</span>
}

function ApplicationDetailsModal({ row, onClose }) {
  const details = getDetails(row)
  const services = details.services || {}
  const areas = details.serviceAreas || {}
  const workStyle = details.workStyle || {}
  const proof = details.proof || {}
  const presentation = details.presentation || {}
  const basic = details.basic || {}
  const category = getCategoryLabel(row, details)
  const areaChips = splitTextList(areas.nearbyPlaces)
  const outsideCity = getOutsideCityValue(details, areas)
  const socialProfiles = basic.socialProfiles || {}
  const socialProfileLinks = [
    ['Website', socialProfiles.website],
    ['Facebook', socialProfiles.facebook],
    ['Instagram', socialProfiles.instagram],
    ...toArray(socialProfiles.other).map((item) => [item.label || 'Профил', item.url]),
  ].filter(([, value]) => hasValue(value))
  const proofLinks = [
    ['Website', proof.website],
    ['Facebook', proof.facebook],
    ['Instagram', proof.instagram],
  ].filter(([, value]) => hasValue(value))
  const proofProjects = toArray(proof.projects)
  const workStyleChips = toArray(workStyle.modes).map(value => WORK_STYLE_LABELS[value] || value)
  const workStyleRows = [
    ['Допълнително описание', workStyle.custom],
    ['Оферира по снимки', formatBoolean(workStyle.quoteByPhotos)],
    ['Гаранция', formatBoolean(workStyle.warranty)],
    ['Фактура / договор', formatBoolean(workStyle.invoiceContract)],
    ['Наличност', workStyle.availability],
  ]

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/35 px-4 py-6 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/70 bg-paper p-5 shadow-[0_40px_120px_-60px_rgba(13,35,64,0.75)] md:p-7">
        <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="eyebrow">Преглед на кандидатура</div>
            <h2 className="mt-2 font-display text-3xl text-ink">{row.name || 'Без име'}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusPill value={row.status} />
              <InfoChip>{formatAdminDate(row.created_at)}</InfoChip>
              {row.reviewed_at && <InfoChip>решение: {formatAdminDate(row.reviewed_at)}</InfoChip>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost self-start !px-3" aria-label="Затвори"><X size={18} /></button>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <DetailSection title="Основна информация">
            <Rows rows={[
              ['Име / фирма', row.name],
              ['Фирма', row.company],
              ['Тип партньор', details.partnerType],
              ['Имейл', row.email],
              ['Телефон', row.phone],
              ['Град', details.city || row.city],
              ['Статус', APPLICATION_STATUS_LABELS[row.status] || row.status],
              ['Бележка при решение', row.decision_note],
            ]} />
            {socialProfileLinks.length > 0 && (
              <div className="mt-3 space-y-2">
                {socialProfileLinks.map(([label, value]) => <LinkRow key={`${label}-${value}`} label={label} value={value} />)}
              </div>
            )}
          </DetailSection>

          <DetailSection title="Услуги">
            <Rows rows={[
              ['Категория', category],
              ['Друга услуга', services.custom],
            ]} />
            <TitledChips title="Услуги" values={services.selected} />
          </DetailSection>

          <DetailSection title="Къде работи">
            <Rows rows={[
              ['Основен град', areas.primaryCity],
              ['Радиус', areas.radius],
              ['Работи извън основния град', formatBoolean(outsideCity)],
            ]} hideEmpty={areaChips.length > 0} />
            <TitledChips title="Райони / населени места" values={areaChips} />
          </DetailSection>

          <DetailSection title="Как работи">
            <TitledChips title="Начин на работа" values={workStyleChips} />
            <Rows rows={workStyleRows} hideEmpty={workStyleChips.length > 0} />
          </DetailSection>

          <DetailSection title="Доказателства">
            <Rows rows={[
              ['Примерен проект', proof.projectDescription],
              ['Бележка', proof.note],
              ['Снимки', proof.uploadsDeferred ? 'Ще бъдат добавени по-късно' : ''],
            ]} hideEmpty={proofLinks.length > 0} />
            {proofLinks.length > 0 && (
              <div className="mt-3 space-y-2">
                {proofLinks.map(([label, value]) => <LinkRow key={label} label={label} value={value} />)}
              </div>
            )}
            <ProjectProofCards projects={proofProjects} />
          </DetailSection>

          <DetailSection title="Представяне">
            <Rows rows={[
              ['Кратко представяне', cleanPresentationValue('Кратко представяне', presentation.intro || row.about)],
              ['Най-силни услуги', cleanPresentationValue('Най-силни услуги', presentation.strongestServices)],
              ['Предпочитан тип проекти', cleanPresentationValue('Предпочитан тип проекти', presentation.preferredProjects)],
              ['Какво не приема', cleanPresentationValue('Какво не приема', presentation.rejectedProjects)],
            ]} />
          </DetailSection>
        </div>

        <DetailSection title="Преглед" className="mt-5">
          <div className="grid gap-3 md:grid-cols-5">
            <ReviewTile label="Кандидат" value={row.name || '—'} />
            <ReviewTile label="Категория" value={category || '—'} />
            <ReviewTile label="Район" value={areas.primaryCity || areas.nearbyPlaces || details.city || '—'} />
            <ReviewTile label="Статус" value={APPLICATION_STATUS_LABELS[row.status] || row.status || '—'} />
            <ReviewTile label="Подадена на" value={formatAdminDate(row.created_at)} />
          </div>
        </DetailSection>
      </div>
    </div>
  )
}

function DetailSection({ title, children, className = '' }) {
  return (
    <section className={`rounded-3xl border border-line bg-soft/70 p-4 ${className}`}>
      <h3 className="font-display text-xl text-ink">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Rows({ rows, hideEmpty = false }) {
  const visibleRows = rows.filter(([, value]) => hasValue(value))
  if (visibleRows.length === 0) return hideEmpty ? null : <EmptySection />
  return (
    <div className="space-y-2">
      {visibleRows.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-white/70 bg-paper/75 p-3">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
          <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">{formatValue(value)}</div>
        </div>
      ))}
    </div>
  )
}

function ChipList({ values }) {
  const items = toArray(values).filter(Boolean)
  if (items.length === 0) return <EmptySection />
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => <InfoChip key={item}>{item}</InfoChip>)}
    </div>
  )
}

function TitledChips({ title, values }) {
  const items = toArray(values).filter(Boolean)
  if (items.length === 0) return null
  return (
    <div className="mt-3 rounded-2xl border border-white/70 bg-paper/75 p-3">
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">{title}</div>
      <div className="mt-2">
        <ChipList values={items} />
      </div>
    </div>
  )
}

function LinkRow({ label, value }) {
  const isLocal = isLocalOrTestLink(value)
  return (
    <div className="rounded-2xl border border-white/70 bg-paper/75 p-3">
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 break-words text-sm leading-6 text-ink">
        {value}
        {isLocal && <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.68rem] font-medium text-amber-800">локален/тестов линк</span>}
      </div>
    </div>
  )
}

function ProjectProofCards({ projects }) {
  const items = toArray(projects).filter(project => hasValue(project?.description) || toArray(project?.photos).length > 0)
  if (items.length === 0) return null

  return (
    <div className="mt-3 space-y-3">
      {items.map((project, index) => {
        const photos = toArray(project.photos).filter(photo => hasValue(photo?.url))
        return (
          <div key={project.id || index} className="rounded-2xl border border-white/70 bg-paper/75 p-3">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">Проект {index + 1}</div>
            {project.description && <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{project.description}</div>}
            {photos.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {photos.map((photo, photoIndex) => (
                  <a key={`${photo.url}-${photoIndex}`} href={photo.url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-xl border border-line bg-soft">
                    <img src={photo.url} alt={`Проект ${index + 1} снимка ${photoIndex + 1}`} className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function InfoChip({ children, tone = 'neutral' }) {
  const classes = tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-line bg-soft text-muted'
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${classes}`}>{children}</span>
}

function ReviewTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-paper/75 p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 font-semibold text-ink">{value}</div>
    </div>
  )
}

function EmptySection() {
  return <div className="rounded-2xl border border-dashed border-line bg-paper/50 p-4 text-sm text-muted">Няма добавена информация.</div>
}

function Pager({ current, total, onChange }) { if (total <= 1) return null; return <div className="flex items-center justify-end gap-2"><button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => onChange(current - 1)} disabled={current <= 1}>Назад</button><span className="text-sm text-muted">{current} / {total}</span><button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => onChange(current + 1)} disabled={current >= total}>Напред</button></div> }
function Empty({ text }) { return <div className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">{text}</div> }
function Panel({ title, children }) { return <div className="rounded-3xl border border-line bg-paper p-6"><h2 className="font-display text-2xl text-ink">{title}</h2>{children && <div className="mt-3">{children}</div>}</div> }

function getDetails(row) {
  const raw = row?.details
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
}

function getCategoryLabel(row, details = getDetails(row)) {
  const services = details.services || {}
  return services.mainCategory || CATEGORY_LABELS[services.layerSlug] || CATEGORY_LABELS[row.layer_slug] || row.layer_slug || ''
}

function toArray(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(',').map(item => item.trim()).filter(Boolean)
  return []
}

function splitTextList(value) {
  if (Array.isArray(value)) return toArray(value)
  return String(value || '')
    .split(/[,;\n]+/)
    .map(item => item.trim())
    .filter(Boolean)
}

function getOutsideCityValue(details, areas) {
  if (areas.outsideCityDecision === 'yes') return true
  if (areas.outsideCityDecision === 'no') return false
  if (typeof areas.acceptsOutsideCity === 'boolean') return areas.acceptsOutsideCity
  if (typeof details.worksOutsideCity === 'boolean') return details.worksOutsideCity
  return null
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'boolean') return true
  return value !== null && value !== undefined && String(value).trim() !== ''
}

function formatValue(value) {
  if (typeof value === 'boolean') return formatBoolean(value)
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function formatBoolean(value) {
  if (typeof value !== 'boolean') return ''
  return value ? 'Да' : 'Не'
}

function formatOutsideDecision(value) {
  if (value === 'yes') return 'Да'
  if (value === 'no') return 'Не'
  return ''
}

function isLocalOrTestLink(value) {
  const text = String(value || '').toLowerCase()
  return text.includes('localhost') || text.includes('127.0.0.1') || text.includes('test') || text.includes('example.')
}

function cleanPresentationValue(label, value) {
  if (!hasValue(value)) return ''
  const text = String(value).trim()
  const normalizedText = normalizeHumanText(text)
  const normalizedLabel = normalizeHumanText(label)
  const placeholders = [
    normalizedLabel,
    normalizeHumanText('Кратко професионално представяне'),
    normalizeHumanText('Най-силни услуги'),
    normalizeHumanText('Предпочитан тип проекти'),
    normalizeHumanText('Какво не приемате'),
    normalizeHumanText('Какво не приема'),
  ]
  return placeholders.includes(normalizedText) ? 'Не е добавена реална информация.' : text
}

function normalizeHumanText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}
