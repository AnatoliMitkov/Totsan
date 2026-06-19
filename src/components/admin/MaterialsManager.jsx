import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, EyeOff, Search, Tags, XCircle } from 'lucide-react'
import {
  MATERIAL_MODERATION_STATUS_LABELS,
  formatAdminDate,
  loadAdminMaterialCapabilities,
  paginateRows,
  updateMaterialCapabilityModeration,
} from '../../lib/admin.js'
import { LAYERS } from '../../data/layers.js'
import { normalizeMaterialCapability, relationTypePills } from '../../lib/partner-materials.js'
import { getStaticProductCatalog } from '../../lib/product-metadata.js'

const STATUS_TONE = {
  pending: 'border-amber-200 bg-amber-50 text-amber-900',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  rejected: 'border-red-200 bg-red-50 text-red-800',
  hidden: 'border-line bg-soft text-muted',
}

export default function MaterialsManager({ globalQuery = '' }) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [actionState, setActionState] = useState({ id: '', message: '' })
  const templateMaterials = useMemo(() => getStaticProductCatalog(), [])

  useEffect(() => { load() }, [])

  async function load() {
    setStatus('loading')
    setError('')
    try {
      const data = await loadAdminMaterialCapabilities()
      setRows((data || []).map(normalizeMaterialCapability))
      setStatus('ready')
    } catch (loadError) {
      setRows([])
      setError(loadError.message || 'Материалите не се заредиха.')
      setStatus('error')
    }
  }

  const filtered = useMemo(() => {
    const needle = String(query || globalQuery || '').trim().toLowerCase()
    return rows.filter((row) => {
      if (filter !== 'all' && row.moderationStatus !== filter) return false
      if (!needle) return true
      return [
        row.categoryLabel,
        row.brandLabel,
        row.layerSlug,
        row.profile?.name,
        row.profile?.city,
        row.note,
        row.moderationStatus,
        MATERIAL_MODERATION_STATUS_LABELS[row.moderationStatus],
      ].filter(Boolean).join(' ').toLowerCase().includes(needle)
    })
  }, [filter, globalQuery, query, rows])

  const pageData = useMemo(() => paginateRows(filtered, page), [filtered, page])

  useEffect(() => { setPage(1) }, [filter, globalQuery, query])

  async function moderate(row, moderationStatus) {
    const note = moderationStatus === 'rejected'
      ? window.prompt('Причина за отказ/корекция:', row.moderationNote || '')
      : row.moderationNote || ''
    if (note === null) return

    setActionState({ id: row.id, message: 'Запазваме промяната...' })
    try {
      const result = await updateMaterialCapabilityModeration(row.id, moderationStatus, note)
      setRows((current) => current.map((item) => item.id === row.id ? normalizeMaterialCapability({ ...item, ...result.row, profile: item.profile }) : item))
      setActionState({ id: row.id, message: 'Статусът е обновен.' })
      setTimeout(() => setActionState({ id: '', message: '' }), 2500)
    } catch (moderationError) {
      setActionState({ id: row.id, message: moderationError.message || 'Промяната не успя.' })
    }
  }

  if (status === 'loading') return <Panel title="Зареждаме материалите..." />
  if (status === 'error') return <Panel title="Материалите не се заредиха"><p className="text-sm text-red-700">{error}</p></Panel>

  return (
    <section className="space-y-5">
      <TemplateMaterialsPanel templates={templateMaterials} />

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="relative block">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-14 w-full rounded-3xl border border-line bg-paper pl-14 pr-4 text-sm outline-none transition focus:border-ink"
            placeholder="Търсене по категория, марка, партньор, град..."
          />
        </label>
        <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-3xl border border-line bg-paper px-4 py-3 text-sm outline-none">
          <option value="all">Всички статуси</option>
          {Object.entries(MATERIAL_MODERATION_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {pageData.rows.map((row) => (
          <MaterialCard key={row.id} row={row} busyMessage={actionState.id === row.id ? actionState.message : ''} onModerate={moderate} />
        ))}
        {pageData.rows.length === 0 && <div className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">Няма материали за тези филтри.</div>}
      </div>

      <Pager current={pageData.currentPage} total={pageData.totalPages} onChange={setPage} />
    </section>
  )
}

function TemplateMaterialsPanel({ templates = [] }) {
  const byLayer = templates.reduce((acc, item) => {
    const key = item.layerSlug || 'other'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return (
    <div className="rounded-3xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Шаблони от кода</div>
          <h2 className="mt-2 font-display text-2xl text-ink">Непубликувани шаблони, които не са създадени от партньор</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Тези {templates.length} карти идват от <code className="rounded bg-soft px-1.5 py-0.5">src/data/layers.js</code> и се нормализират през <code className="rounded bg-soft px-1.5 py-0.5">src/lib/product-metadata.js</code>. Те са seed/template съдържание, не записи в Supabase, и вече не се показват в публичния каталог.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(byLayer).map(([layerSlug, count]) => {
            const layer = LAYERS.find((item) => item.slug === layerSlug)
            return (
              <span key={layerSlug} className="rounded-full border border-line bg-soft px-3 py-1 text-muted">
                {layer ? `Слой ${layer.number}` : layerSlug}: {count}
              </span>
            )
          })}
        </div>
      </div>

      <details className="mt-4 rounded-2xl border border-line bg-soft/50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-ink">Покажи template материалите</summary>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((item) => (
            <article key={item.slug} className="rounded-2xl border border-line bg-paper p-4">
              <div className="text-xs text-muted">/{item.slug}</div>
              <h3 className="mt-1 font-display text-xl text-ink">{item.brandLabel || item.name}</h3>
              <p className="text-sm text-muted">{item.categoryLabel || item.sub}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                <span className="rounded-full border border-line bg-soft px-2.5 py-1">{item.layerTitle || item.layerSlug}</span>
                {item.brandLabel && <span className="rounded-full border border-line bg-soft px-2.5 py-1">{item.brandLabel}</span>}
              </div>
            </article>
          ))}
        </div>
      </details>
    </div>
  )
}

function MaterialCard({ row, busyMessage, onModerate }) {
  const layer = LAYERS.find((item) => item.slug === row.layerSlug)
  const relationLabels = relationTypePills(row.relationTypes)

  return (
    <article className="rounded-3xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_TONE[row.moderationStatus] || STATUS_TONE.pending}`}>
              {MATERIAL_MODERATION_STATUS_LABELS[row.moderationStatus] || row.moderationStatus}
            </span>
            <span className="rounded-full border border-line bg-soft px-3 py-1 text-xs text-muted">
              {layer ? `Слой ${layer.number} · ${layer.title}` : row.layerSlug}
            </span>
          </div>
          <h3 className="mt-3 font-display text-2xl text-ink">{row.brandLabel || row.categoryLabel}</h3>
          {row.brandLabel && <p className="text-sm text-muted">{row.categoryLabel}</p>}
          <p className="mt-2 text-sm text-muted">{row.profile?.name || 'Профил без име'}{row.profile?.city ? ` · ${row.profile.city}` : ''}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {relationLabels.map((label) => <span key={label} className="rounded-full border border-line bg-soft px-3 py-1 text-muted">{label}</span>)}
            <span className="rounded-full border border-line bg-soft px-3 py-1 text-muted">{row.isPublic ? 'Публичен' : 'Скрит от партньора'}</span>
          </div>
          {row.note && <p className="mt-3 line-clamp-2 text-sm text-muted">{row.note}</p>}
          {row.moderationNote && <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{row.moderationNote}</p>}
          <p className="mt-3 text-xs text-muted">Създаден: {formatAdminDate(row.createdAt)}</p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 xl:flex-col">
          <button type="button" onClick={() => onModerate(row, 'approved')} className="btn btn-primary !py-2 text-sm"><CheckCircle2 size={16} /> Одобри</button>
          <button type="button" onClick={() => onModerate(row, 'hidden')} className="btn btn-ghost !py-2 text-sm"><EyeOff size={16} /> Скрий</button>
          <button type="button" onClick={() => onModerate(row, 'rejected')} className="btn btn-ghost !py-2 text-sm text-red-700"><XCircle size={16} /> Откажи</button>
          <button type="button" onClick={() => onModerate(row, 'pending')} className="btn btn-ghost !py-2 text-sm"><Tags size={16} /> Чака</button>
        </div>
      </div>
      {busyMessage && <div className="mt-4 text-xs font-medium text-accent">{busyMessage}</div>}
    </article>
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

function Panel({ title, children }) {
  return <div className="rounded-3xl border border-line bg-paper p-6"><h2 className="font-display text-2xl text-ink">{title}</h2>{children && <div className="mt-3">{children}</div>}</div>
}
