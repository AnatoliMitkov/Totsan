import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Eye, EyeOff, Flag, RefreshCw, Search, Star } from 'lucide-react'
import { ADMIN_INPUT_CLASS, formatAdminDate } from '../../lib/admin.js'
import { REVIEW_STATUS_LABELS, formatReviewDate, loadAdminReviewReports, loadAdminReviews, resolveReviewReport, updateReviewModeration } from '../../lib/reviews.js'

const FILTERS = [
  ['all', 'Всички'],
  ['reported', 'Със сигнал'],
  ['visible', 'Видими'],
  ['hidden', 'Скрити'],
]

export default function ReviewsManager({ globalQuery }) {
  const [reviews, setReviews] = useState([])
  const [reports, setReports] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [localQuery, setLocalQuery] = useState('')
  const [actionState, setActionState] = useState({ status: 'idle', message: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setStatus('loading')
    setError('')
    try {
      const [reviewRows, reportRows] = await Promise.all([loadAdminReviews(), loadAdminReviewReports()])
      setReviews(reviewRows)
      setReports(reportRows)
      setStatus('ready')
    } catch (loadError) {
      setStatus('error')
      setError(loadError.message || 'Отзивите не се заредиха.')
    }
  }

  const openReportsByReview = useMemo(() => reports.reduce((map, report) => {
    if (report.status !== 'open') return map
    map.set(report.reviewId, [...(map.get(report.reviewId) || []), report])
    return map
  }, new Map()), [reports])

  const filtered = useMemo(() => {
    const needle = `${globalQuery || ''} ${localQuery || ''}`.trim().toLowerCase()
    return reviews.filter((review) => {
      if (filter === 'reported' && !openReportsByReview.has(review.id)) return false
      if (filter === 'visible' && review.moderationStatus !== 'visible') return false
      if (filter === 'hidden' && review.moderationStatus !== 'hidden') return false
      if (!needle) return true
      return `${review.id} ${review.orderId} ${review.clientId} ${review.partnerId} ${review.body} ${review.partnerReply}`.toLowerCase().includes(needle)
    })
  }, [filter, globalQuery, localQuery, openReportsByReview, reviews])

  async function changeVisibility(review, moderationStatus) {
    setActionState({ status: 'saving', message: 'Запазваме модерацията…' })
    try {
      const next = await updateReviewModeration(review.id, moderationStatus)
      setReviews(current => current.map(item => item.id === next.id ? next : item))
      setActionState({ status: 'saved', message: 'Отзивът е обновен.' })
    } catch (saveError) {
      setActionState({ status: 'error', message: saveError.message || 'Модерацията не се запази.' })
    }
  }

  async function resolveReport(report) {
    setActionState({ status: 'saving', message: 'Затваряме сигнала…' })
    try {
      const next = await resolveReviewReport(report.id, 'Прегледано от админ')
      setReports(current => current.map(item => item.id === next.id ? next : item))
      setActionState({ status: 'saved', message: 'Сигналът е затворен.' })
    } catch (saveError) {
      setActionState({ status: 'error', message: saveError.message || 'Сигналът не се затвори.' })
    }
  }

  if (status === 'loading') return <Panel title="Зареждаме отзивите…" />
  if (status === 'error') return <Panel title="Отзивите не се заредиха"><p className="text-sm text-red-700">{error}</p><button type="button" onClick={load} className="btn btn-ghost mt-5">Опитай пак</button></Panel>

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="eyebrow">Trust</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Verified отзиви и сигнали</h2>
            <p className="mt-2 text-sm text-muted">Модерирай публичните отзиви, без да променяш оценките на клиентите.</p>
          </div>
          <button type="button" onClick={load} className="btn btn-ghost"><RefreshCw size={18} /> Обнови</button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {FILTERS.map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-4 py-2 text-sm transition ${filter === value ? 'bg-ink text-paper' : 'bg-soft text-muted hover:text-ink'}`}>{label}</button>)}
        </div>
        <label className="relative mt-5 block max-w-xl">
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input value={localQuery} onChange={event => setLocalQuery(event.target.value)} className={`${ADMIN_INPUT_CLASS} !mt-0 pl-11`} placeholder="Търси по ID, клиент, партньор или текст" />
        </label>
        {actionState.message && <div className={`mt-4 rounded-2xl p-3 text-sm ${actionState.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-soft text-muted'}`}>{actionState.message}</div>}
      </div>

      <div className="grid gap-4">
        {filtered.map(review => {
          const openReports = openReportsByReview.get(review.id) || []
          return (
            <article key={review.id} className="rounded-3xl border border-line bg-paper p-5 md:p-6">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs ${review.moderationStatus === 'visible' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{REVIEW_STATUS_LABELS[review.moderationStatus] || review.moderationStatus}</span>
                    {openReports.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800"><Flag size={13} /> {openReports.length} сигнал</span>}
                    <span className="text-xs text-muted">{formatReviewDate(review.createdAt)}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-lg font-semibold text-ink"><Star size={19} className="text-accentDeep" fill="currentColor" /> {review.ratingOverall.toFixed(1)}</div>
                  {review.body && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/80">{review.body}</p>}
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Info label="Клиент" value={shortId(review.clientId)} />
                    <Info label="Партньор" value={shortId(review.partnerId)} />
                    <Info label="Поръчка" value={shortId(review.orderId)} />
                  </div>
                  {review.partnerReply && <div className="mt-4 rounded-2xl border border-line bg-soft p-4 text-sm text-muted"><strong className="text-ink">Отговор:</strong> {review.partnerReply}</div>}
                  {openReports.length > 0 && (
                    <div className="mt-5 grid gap-3">
                      {openReports.map(report => (
                        <div key={report.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-amber-950">Сигнал от {shortId(report.reporterId)}</div>
                              <div className="mt-1 text-xs text-amber-800">{formatAdminDate(report.createdAt)}</div>
                            </div>
                            <button type="button" onClick={() => resolveReport(report)} disabled={actionState.status === 'saving'} className="inline-flex items-center gap-1 rounded-full bg-paper px-3 py-1 text-xs font-medium text-amber-950"><CheckCircle2 size={14} /> Затвори</button>
                          </div>
                          <p className="mt-2 text-sm text-amber-950">{report.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <button type="button" onClick={() => changeVisibility(review, 'hidden')} disabled={review.moderationStatus === 'hidden' || actionState.status === 'saving'} className="btn btn-ghost w-full justify-center disabled:opacity-50"><EyeOff size={18} /> Скрий</button>
                  <button type="button" onClick={() => changeVisibility(review, 'visible')} disabled={review.moderationStatus === 'visible' || actionState.status === 'saving'} className="btn btn-primary w-full justify-center disabled:opacity-50"><Eye size={18} /> Покажи</button>
                </div>
              </div>
            </article>
          )
        })}
        {filtered.length === 0 && <div className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">Няма отзиви в този филтър.</div>}
      </div>
    </div>
  )
}

function shortId(value = '') {
  return value ? value.slice(0, 8) : '—'
}

function Info({ label, value }) {
  return <div className="rounded-2xl border border-line bg-soft p-4"><div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div><div className="mt-1 text-sm font-medium text-ink">{value}</div></div>
}

function Panel({ title, children }) {
  return <div className="rounded-3xl border border-line bg-paper p-6"><h2 className="font-display text-2xl text-ink">{title}</h2>{children && <div className="mt-3">{children}</div>}</div>
}