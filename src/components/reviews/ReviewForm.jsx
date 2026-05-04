import { useState } from 'react'
import { MessageSquareReply, Send, Star } from 'lucide-react'
import { formatReviewDate, replyToReview, submitReview } from '../../lib/reviews.js'

const RATING_FIELDS = [
  ['ratingOverall', 'Обща оценка'],
  ['ratingCommunication', 'Комуникация'],
  ['ratingQuality', 'Качество'],
  ['ratingValue', 'Стойност'],
]

const INITIAL_DRAFT = {
  ratingOverall: 5,
  ratingCommunication: 5,
  ratingQuality: 5,
  ratingValue: 5,
  body: '',
}

export default function ReviewForm({ order, review, role, onChange }) {
  const [draft, setDraft] = useState(INITIAL_DRAFT)
  const [reply, setReply] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  if (order?.status !== 'completed') return null

  async function saveReview(event) {
    event.preventDefault()
    setStatus('saving')
    setMessage('')
    try {
      const next = await submitReview(order, draft)
      setDraft(INITIAL_DRAFT)
      setStatus('idle')
      setMessage('Отзивът е публикуван. Благодаря!')
      onChange?.(next)
    } catch (error) {
      setStatus('idle')
      setMessage(error.message || 'Отзивът не беше записан.')
    }
  }

  async function saveReply(event) {
    event.preventDefault()
    setStatus('saving')
    setMessage('')
    try {
      const next = await replyToReview(review.id, reply)
      setReply('')
      setStatus('idle')
      setMessage('Отговорът е публикуван.')
      onChange?.(next)
    } catch (error) {
      setStatus('idle')
      setMessage(error.message || 'Отговорът не беше записан.')
    }
  }

  if (review) {
    const canReply = role === 'partner' && !review.partnerReply
    return (
      <section className="mt-6 rounded-3xl border border-line bg-paper p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="eyebrow">Проверен отзив</div>
            <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-ink"><Stars value={review.ratingOverall} /> {review.ratingOverall.toFixed(1)}</div>
          </div>
          <div className="text-xs text-muted">{formatReviewDate(review.createdAt)}</div>
        </div>
        {review.body && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ink/80">{review.body}</p>}
        <div className="mt-4 grid gap-2 text-xs text-muted sm:grid-cols-3">
          <span>Комуникация: {review.ratingCommunication}/5</span>
          <span>Качество: {review.ratingQuality}/5</span>
          <span>Стойност: {review.ratingValue}/5</span>
        </div>
        {review.partnerReply && (
          <div className="mt-5 rounded-2xl border border-line bg-soft p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-ink"><MessageSquareReply size={17} /> Отговор от партньора</div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{review.partnerReply}</p>
          </div>
        )}
        {canReply && (
          <form onSubmit={saveReply} className="mt-5">
            <label className="text-sm font-medium text-ink" htmlFor="partner-review-reply">Отговор към клиента</label>
            <textarea id="partner-review-reply" rows={4} value={reply} onChange={event => setReply(event.target.value)} className="mt-2 w-full rounded-2xl border border-line bg-soft px-4 py-3 text-sm outline-none transition focus:border-ink" placeholder="Благодаря за обратната връзка…" />
            <button type="submit" disabled={status === 'saving'} className="btn btn-primary mt-3 justify-center"><Send size={18} /> Публикувай отговор</button>
          </form>
        )}
        {message && <p className="mt-4 text-sm text-muted">{message}</p>}
      </section>
    )
  }

  if (role !== 'client') {
    return (
      <section className="mt-6 rounded-3xl border border-line bg-paper p-5 md:p-6">
        <div className="eyebrow">Проверен отзив</div>
        <p className="mt-2 text-sm text-muted">Клиентът още не е оставил отзив за тази поръчка.</p>
      </section>
    )
  }

  return (
    <section className="mt-6 rounded-3xl border border-line bg-paper p-5 md:p-6">
      <div className="eyebrow">Проверен отзив</div>
      <h2 className="mt-2 font-display text-3xl text-ink">Оцени изпълнението</h2>
      <form onSubmit={saveReview} className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {RATING_FIELDS.map(([key, label]) => (
            <RatingInput key={key} label={label} value={draft[key]} onChange={value => setDraft(current => ({ ...current, [key]: value }))} />
          ))}
        </div>
        <label className="block text-sm font-medium text-ink" htmlFor="review-body">
          Коментар
          <textarea id="review-body" rows={5} value={draft.body} onChange={event => setDraft(current => ({ ...current, body: event.target.value }))} className="mt-2 w-full rounded-2xl border border-line bg-soft px-4 py-3 text-sm font-normal outline-none transition focus:border-ink" placeholder="Как мина работата, комуникацията и крайният резултат" />
        </label>
        {message && <div className="rounded-2xl bg-soft p-3 text-sm text-muted">{message}</div>}
        <button type="submit" disabled={status === 'saving'} className="btn btn-primary justify-center"><Star size={18} /> Публикувай отзив</button>
      </form>
    </section>
  )
}

function RatingInput({ label, value, onChange }) {
  return (
    <div className="rounded-2xl border border-line bg-soft p-4">
      <div className="text-sm font-medium text-ink">{label}</div>
      <div className="mt-3 flex items-center gap-1" aria-label={label}>
        {[1, 2, 3, 4, 5].map(score => (
          <button key={score} type="button" onClick={() => onChange(score)} className="rounded-full p-1 text-accentDeep transition hover:bg-paper" aria-label={`${score} от 5`}>
            <Star size={22} fill={score <= value ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
    </div>
  )
}

function Stars({ value }) {
  return <span className="inline-flex text-accentDeep">{[1, 2, 3, 4, 5].map(score => <Star key={score} size={18} fill={score <= value ? 'currentColor' : 'none'} />)}</span>
}