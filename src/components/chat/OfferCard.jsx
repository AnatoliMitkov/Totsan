import { useState } from 'react'
import { HelpCircle, PenLine, XCircle } from 'lucide-react'
import { conversationRole } from '../../lib/chat.js'
import { normalizeAcceptedOffer } from '../../lib/offers.js'
import OfferDocumentView from '../offers/OfferDocumentView.jsx'

export default function OfferCard({ offer, conversation, userId, onAction, compact = false, messageCreatedAt = '' }) {
  const role = conversationRole(conversation, userId)
  const canClientAct = role === 'client' && offer.status === 'sent'
  const canPartnerAct = role === 'partner' && offer.status === 'sent'
  const [withdrawStatus, setWithdrawStatus] = useState('idle')
  const document = normalizeAcceptedOffer(offer)
  const canClientAccept = canClientAct && document.offerType !== 'estimate'
  const providerName = conversation?.partner?.name || conversation?.partner?.display_name || 'Партньорът в разговора'
  const createdLabel = formatTimestamp(offer.created_at || messageCreatedAt)

  async function handleWithdraw() {
    if (!canPartnerAct || withdrawStatus === 'withdrawing') return
    setWithdrawStatus('withdrawing')
    try {
      await onAction?.(offer, 'withdrawn')
    } finally {
      setWithdrawStatus('idle')
    }
  }

  return (
    <div className="min-w-0 max-w-full">
      <OfferDocumentView offer={document} compact={compact} />
      <div className={`mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] ${compact ? 'text-paper/60' : 'text-muted'}`}>
        <span>Партньор: {providerName}</span>
        {createdLabel && <span>Изпратена: {createdLabel}</span>}
      </div>

      {(canClientAct || canPartnerAct) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {canClientAccept && <button type="button" onClick={() => onAction?.(offer, 'accepted')} className="btn btn-primary !py-2 text-sm">Приеми офертата</button>}
          {canClientAct && <button type="button" onClick={() => onAction?.(offer, 'question')} className="btn btn-ghost !py-2 text-sm"><HelpCircle size={17} /> Попитай</button>}
          {canClientAct && <button type="button" onClick={() => onAction?.(offer, 'change_requested')} className="btn btn-ghost !py-2 text-sm"><PenLine size={17} /> Поискай промяна</button>}
          {canClientAct && <button type="button" onClick={() => onAction?.(offer, 'declined')} className="btn btn-ghost !py-2 text-sm"><XCircle size={17} /> Откажи</button>}
          {canPartnerAct && <button type="button" onClick={handleWithdraw} disabled={withdrawStatus === 'withdrawing'} className="btn btn-ghost border border-line bg-paper !py-2 text-sm text-ink disabled:opacity-60">{withdrawStatus === 'withdrawing' ? 'Изтегля се...' : 'Изтегли офертата'}</button>}
        </div>
      )}
    </div>
  )
}

function formatTimestamp(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}
