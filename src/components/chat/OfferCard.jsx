import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, HelpCircle, PenLine, Undo2, XCircle } from 'lucide-react'
import { conversationRole } from '../../lib/chat.js'
import { normalizeAcceptedOffer } from '../../lib/offers.js'
import OfferDocumentView from '../offers/OfferDocumentView.jsx'

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const ISO_DATE_PREFIX_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|[Tt ])/

const ACTION_COPY = {
  accepted: {
    busy: 'Приемаме офертата…',
    done: 'Офертата е приета. Подготвяме поръчката.',
    error: 'Офертата не беше приета. Опитай отново.',
  },
  question: {
    busy: 'Подготвяме въпроса…',
    done: 'Въпросът е подготвен. Допълни го и го изпрати в чата.',
    error: 'Въпросът не беше подготвен. Опитай отново.',
  },
  change_requested: {
    busy: 'Изпращаме искането…',
    done: 'Искането за промяна е изпратено в разговора.',
    error: 'Искането за промяна не беше изпратено. Опитай отново.',
  },
  declined: {
    busy: 'Отказваме офертата…',
    done: 'Офертата е отказана.',
    error: 'Офертата не беше отказана. Опитай отново.',
  },
  withdrawn: {
    busy: 'Изтегляме офертата…',
    done: 'Офертата е изтеглена.',
    error: 'Офертата не беше изтеглена. Опитай отново.',
  },
}

export default function OfferCard({ offer, conversation, userId, onAction, compact = false, messageCreatedAt = '' }) {
  const role = conversationRole(conversation, userId)
  const canClientAct = role === 'client' && offer?.status === 'sent'
  const canPartnerAct = role === 'partner' && offer?.status === 'sent'
  const [busyAction, setBusyAction] = useState('')
  const [feedback, setFeedback] = useState({ tone: '', message: '' })
  const busyRef = useRef(false)
  const document = useMemo(() => normalizeAcceptedOffer(offer), [offer])
  const expiry = useMemo(() => getExpiry(document.validUntil), [document.validUntil])
  const canClientAccept = canClientAct && document.offerType !== 'estimate'
  const acceptanceExpired = canClientAccept && expiry.expired
  const isBusy = Boolean(busyAction)
  const providerName = conversation?.partner?.name || conversation?.partner?.display_name || 'Партньорът в разговора'
  const createdLabel = formatTimestamp(offer?.created_at || messageCreatedAt)
  const orderId = offer?.orderId || offer?.order_id || ''
  const outcomeCopy = getOutcomeCopy({
    canClientAct,
    canPartnerAct,
    offerType: document.offerType,
    expiry,
  })

  async function runAction(action) {
    const clientActionAllowed = action === 'accepted'
      ? canClientAccept && !expiry.expired
      : canClientAct
    const allowed = action === 'withdrawn' ? canPartnerAct : clientActionAllowed
    if (!allowed || busyRef.current) return

    busyRef.current = true
    setBusyAction(action)
    setFeedback({ tone: 'status', message: ACTION_COPY[action].busy })
    try {
      await onAction?.(offer, action)
      setFeedback({ tone: 'status', message: ACTION_COPY[action].done })
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error?.message || ACTION_COPY[action].error,
      })
    } finally {
      busyRef.current = false
      setBusyAction('')
    }
  }

  return (
    <div className="min-w-0 max-w-full">
      <OfferDocumentView offer={document} compact={compact} />
      <div className={`mt-3 flex flex-wrap gap-2 text-xs ${compact ? 'text-paper/80' : 'text-muted'}`}>
        <span className={`rounded-full border px-2.5 py-1 ${compact ? 'border-paper/15 bg-paper/10' : 'border-line bg-soft/70'}`}>Партньор: {providerName}</span>
        {createdLabel && <span className={`rounded-full border px-2.5 py-1 ${compact ? 'border-paper/15 bg-paper/10' : 'border-line bg-soft/70'}`}>Изпратена: {createdLabel}</span>}
      </div>

      {outcomeCopy && (
        <p className={`mt-4 rounded-2xl border px-3.5 py-3 text-xs leading-5 ${getOutcomeTone(compact, expiry.expired)}`}>
          {outcomeCopy}
        </p>
      )}

      {(canClientAct || canPartnerAct) && (
        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap" aria-busy={isBusy}>
          {canClientAccept && (
            <button
              type="button"
              onClick={() => runAction('accepted')}
              disabled={isBusy || acceptanceExpired}
              className="btn btn-primary min-h-11 w-full justify-center !py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto sm:min-w-[11rem]"
            >
              <CheckCircle2 size={17} />
              {acceptanceExpired ? 'Срокът е изтекъл' : busyAction === 'accepted' ? 'Приемаме…' : 'Приеми офертата'}
            </button>
          )}
          {canClientAct && (
            <button type="button" onClick={() => runAction('question')} disabled={isBusy} className="btn btn-ghost min-h-11 w-full justify-center !py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto">
              <HelpCircle size={17} /> {busyAction === 'question' ? 'Подготвяме…' : 'Попитай'}
            </button>
          )}
          {canClientAct && (
            <button type="button" onClick={() => runAction('change_requested')} disabled={isBusy} className="btn btn-ghost min-h-11 w-full justify-center !py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto">
              <PenLine size={17} /> {busyAction === 'change_requested' ? 'Изпращаме…' : 'Поискай промяна'}
            </button>
          )}
          {canClientAct && (
            <button type="button" onClick={() => runAction('declined')} disabled={isBusy} className={`btn min-h-11 w-full justify-center border !py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto ${compact ? 'border-red-200/25 text-red-50 hover:bg-red-400/10' : 'border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50'}`}>
              <XCircle size={17} /> {busyAction === 'declined' ? 'Отказваме…' : 'Откажи'}
            </button>
          )}
          {canPartnerAct && (
            <button type="button" onClick={() => runAction('withdrawn')} disabled={isBusy} className="btn btn-ghost min-h-11 w-full justify-center border border-line bg-paper !py-2.5 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto">
              <Undo2 size={17} /> {busyAction === 'withdrawn' ? 'Изтегляме…' : 'Изтегли офертата'}
            </button>
          )}
        </div>
      )}

      {offer?.status === 'accepted' && orderId && (
        <Link to={`/order/${orderId}`} className={`btn btn-primary mt-4 min-h-11 w-full justify-center !py-2.5 text-sm sm:w-auto ${compact ? 'bg-paper text-ink hover:bg-paper/90' : ''}`}>
          Отвори поръчката <ArrowRight size={17} />
        </Link>
      )}

      {feedback.message && (
        <p
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          aria-live={feedback.tone === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
          className={`mt-3 rounded-2xl border px-3.5 py-3 text-xs leading-5 ${getFeedbackTone(compact, feedback.tone)}`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  )
}

function getExpiry(value) {
  const text = String(value || '').trim()
  if (!text) return { expired: false, label: '', timestamp: null }

  const isoDate = ISO_DATE_PREFIX_PATTERN.exec(text)
  if (isoDate && !isValidCalendarDate(Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3]))) {
    return { expired: false, label: '', timestamp: null }
  }

  const dateOnly = DATE_ONLY_PATTERN.exec(text)
  let timestamp = null

  if (dateOnly) {
    const year = Number(dateOnly[1])
    const month = Number(dateOnly[2])
    const day = Number(dateOnly[3])
    const date = new Date(0)
    date.setHours(23, 59, 59, 999)
    date.setFullYear(year, month - 1, day)
    timestamp = date.getTime()
  } else {
    const parsed = Date.parse(text)
    if (Number.isFinite(parsed)) timestamp = parsed
  }

  if (!Number.isFinite(timestamp)) return { expired: false, label: '', timestamp: null }
  return {
    expired: timestamp <= Date.now(),
    label: new Intl.DateTimeFormat('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(timestamp)),
    timestamp,
  }
}

function isValidCalendarDate(year, month, day) {
  const date = new Date(0)
  date.setHours(12, 0, 0, 0)
  date.setFullYear(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function getOutcomeCopy({ canClientAct, canPartnerAct, offerType, expiry }) {
  if (!canClientAct && !canPartnerAct) return ''
  if (expiry.expired) {
    const expiryCopy = `Срокът на офертата изтече${expiry.label ? ` на ${expiry.label}` : ''}.`
    return canClientAct
      ? `${expiryCopy} Поискай актуализирана оферта, преди да продължиш.`
      : `${expiryCopy} Клиентът вече не може да я приеме; изтегли я и изпрати нова.`
  }
  if (canClientAct && offerType === 'estimate') {
    return 'Това е предварителна оценка и не създава поръчка. Уточни детайлите в разговора.'
  }
  if (canClientAct) return 'При приемане ще се създаде поръчка с точно тези условия.'
  if (offerType === 'estimate') return 'Клиентът може да зададе въпрос или да поиска промяна по оценката.'
  return 'Клиентът може да приеме офертата. Изтеглянето спира следващите действия по нея.'
}

function getOutcomeTone(compact, expired) {
  if (expired) return compact ? 'border-amber-200/25 bg-amber-300/10 text-amber-50' : 'border-amber-200 bg-amber-50 text-amber-900'
  return compact ? 'border-paper/15 bg-paper/10 text-paper/80' : 'border-line bg-soft/70 text-muted'
}

function getFeedbackTone(compact, tone) {
  if (tone === 'error') return compact ? 'border-red-200/25 bg-red-400/10 text-red-50' : 'border-red-200 bg-red-50 text-red-800'
  return compact ? 'border-paper/15 bg-paper/10 text-paper/85' : 'border-accent/20 bg-accentSoft/70 text-accentDeep'
}

function formatTimestamp(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}
