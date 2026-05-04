import { useEffect, useMemo, useState } from 'react'
import { Flag, MessageSquareReply, RefreshCw, Send, Star } from 'lucide-react'
import { useAccount } from '../../lib/account.js'
import { formatReviewDate, loadReviewsForPartner, loadReviewsForService, reportReview } from '../../lib/reviews.js'

export default function ReviewsList({ partnerId, serviceId, title = 'Отзиви от клиенти' }) {
  const { session } = useAccount()
  const userId = session?.user?.id || ''
  const [reviews, setReviews] = useState([])
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  async function load() {
    if (!partnerId && !serviceId) return
    setStatus('loading')
    setMessage('')
    try {
      const next = serviceId ? await loadReviewsForService(serviceId) : await loadReviewsForPartner(partnerId)
      setReviews(next)
      setStatus('ready')
    } catch (error) {
      setStatus('error')
      setMessage(error.message || 'Отзивите не се заредиха.')
    }
  }

  useEffect(() => { load() }, [partnerId, serviceId]) // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(() => {
    if (!reviews.length) return { average: 0, count: 0 }
    const total = reviews.reduce((sum, review) => sum + review.ratingOverall, 0)
    return { average: total / reviews.length, count: reviews.length }
  }, [reviews])

  if (!partnerId && !serviceId) return null

  return (
    <section className="mt-10 rounded-3xl border border-line bg-paper p-5 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Проверени отзиви</div>
          <h2 className="mt-2 font-display text-3xl text-ink md:text-4xl">{title}</h2>
        </div>
        <div className="rounded-2xl border border-line bg-soft px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1 text-accentDeep"><Star size={18} fill="currentColor" /> <span className="font-semibold text-ink">{summary.count ? summary.average.toFixed(1) : '—'}</span></div>
          <div className="mt-1 text-xs text-muted">{summary.count} отзива</div>
        </div>
      </div>

      {status === 'loading' && <div className="mt-6 flex items-center gap-2 text-sm text-muted"><RefreshCw size={16} className="animate-spin" /> Зареждаме отзивите…</div>}
      {status === 'error' && <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{message}</div>}
      {status === 'ready' && reviews.length === 0 && <div className="mt-6 rounded-2xl border border-dashed border-line p-5 text-center text-sm text-muted">Още няма публикувани отзиви.</div>}
      {status === 'ready' && reviews.length > 0 && (
        <div className="mt-6 grid gap-4">
          {reviews.map(review => <ReviewItem key={review.id} review={review} userId={userId} onReported={setMessage} />)}
        </div>
      )}
      {message && status === 'ready' && <p className="mt-4 text-sm text-muted">{message}</p>}
    </section>
  )
}

function ReviewItem({ review, userId, onReported }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function sendReport(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await reportReview(review.id, userId, reason)
      setOpen(false)
      setReason('')
      onReported?.('Сигналът е изпратен към екипа.')
    } catch (error) {
      onReported?.(error.message || 'Сигналът не беше изпратен.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="rounded-2xl border border-line bg-soft p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Stars value={review.ratingOverall} /><span className="text-sm font-semibold text-ink">{review.ratingOverall.toFixed(1)}</span></div>
          <div className="mt-1 text-xs text-muted">Проверена поръчка · {formatReviewDate(review.createdAt)}</div>
        </div>
        {userId && userId !== review.clientId && (
          <button type="button" onClick={() => setOpen(current => !current)} className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-muted transition hover:text-ink"><Flag size={14} /> Сигнал</button>
        )}
      </div>
      {review.body && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ink/80">{review.body}</p>}
      <div className="mt-4 grid gap-2 text-xs text-muted sm:grid-cols-3">
        <span>Комуникация: {review.ratingCommunication}/5</span>
        <span>Качество: {review.ratingQuality}/5</span>
        <span>Стойност: {review.ratingValue}/5</span>
      </div>
      {review.partnerReply && (
        <div className="mt-4 rounded-2xl border border-line bg-paper p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-ink"><MessageSquareReply size={17} /> Отговор от партньора</div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{review.partnerReply}</p>
        </div>
      )}
      {open && (
        <form onSubmit={sendReport} className="mt-4 rounded-2xl border border-line bg-paper p-4">
          <label className="text-sm font-medium text-ink" htmlFor={`report-${review.id}`}>Причина за сигнала</label>
          <textarea id={`report-${review.id}`} rows={3} value={reason} onChange={event => setReason(event.target.value)} className="mt-2 w-full rounded-2xl border border-line bg-soft px-4 py-3 text-sm outline-none transition focus:border-ink" />
          <button type="submit" disabled={saving} className="btn btn-primary mt-3 justify-center"><Send size={18} /> Изпрати сигнал</button>
        </form>
      )}
    </article>
  )
}

function Stars({ value }) {
  return <span className="inline-flex text-accentDeep">{[1, 2, 3, 4, 5].map(score => <Star key={score} size={17} fill={score <= value ? 'currentColor' : 'none'} />)}</span>
}