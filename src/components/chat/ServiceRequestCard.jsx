import { CheckCircle2, Clock3, PackageCheck, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { conversationRole } from '../../lib/chat.js'
import { formatEurWithBgn } from '../../lib/money.js'

const STATUS_LABELS = {
  requested: 'Нова заявка',
  negotiating: 'Уточняване',
  declined: 'Отказана',
  converted: 'Създадена поръчка',
  cancelled: 'Отменена',
}

export default function ServiceRequestCard({ request, conversation, userId, onAction, compact = false }) {
  const role = conversationRole(conversation, userId)
  const snapshot = request?.snapshot || {}
  const canPartnerAct = role === 'partner' && request.status === 'requested'
  const canClientCancel = role === 'client' && ['requested', 'negotiating'].includes(request.status)
  const features = Array.isArray(snapshot.features) ? snapshot.features : []
  const serviceHref = snapshot.service_slug ? `/uslugi/${encodeURIComponent(snapshot.service_slug)}` : ''

  return (
    <div className={compact ? 'text-paper' : 'text-ink'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.14em] opacity-65">Заявка за услуга</div>
          {serviceHref ? (
            <Link to={serviceHref} className="mt-1 inline-flex font-display text-2xl leading-tight underline decoration-current/20 underline-offset-4 transition hover:decoration-current">
              {snapshot.service_title || 'Услуга'}
            </Link>
          ) : (
            <h3 className="mt-1 font-display text-2xl leading-tight">{snapshot.service_title || 'Услуга'}</h3>
          )}
        </div>
        <span className="rounded-full border border-current/15 bg-current/5 px-3 py-1 text-xs font-medium">
          {STATUS_LABELS[request.status] || request.status}
        </span>
      </div>

      {snapshot.service_subtitle && <p className="mt-3 text-sm opacity-75">{snapshot.service_subtitle}</p>}

      <div className="mt-4 rounded-2xl border border-current/10 bg-current/5 p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] opacity-60">
          <PackageCheck size={15} /> Избран пакет
        </div>
        <div className="mt-2 font-medium">{snapshot.package_title || 'Стартова оферта'}</div>
        {snapshot.package_description && <p className="mt-1 text-sm opacity-70">{snapshot.package_description}</p>}
        <div className="mt-3 font-display text-3xl">
          {snapshot.starting_price ? formatEurWithBgn(snapshot.starting_price) : 'Цена след уточнение'}
        </div>
      </div>

      {features.length > 0 && (
        <ul className="mt-4 grid gap-2 text-sm opacity-80">
          {features.slice(0, 6).map((feature, index) => (
            <li key={`${feature}-${index}`} className="flex items-start gap-2">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      )}

      {request.status === 'requested' && (
        <p className="mt-4 flex items-start gap-2 text-xs opacity-70">
          <Clock3 size={15} className="shrink-0" />
          Няма плащане на този етап. Партньорът първо потвърждава възможност и изпраща финална оферта.
        </p>
      )}

      {(canPartnerAct || canClientCancel) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {canPartnerAct && (
            <button type="button" onClick={() => onAction?.(request, 'negotiating')} className="btn btn-primary !py-2 text-sm">
              <CheckCircle2 size={17} /> Приеми и подготви оферта
            </button>
          )}
          {canPartnerAct && (
            <button type="button" onClick={() => onAction?.(request, 'declined')} className="btn btn-ghost !py-2 text-sm">
              <XCircle size={17} /> Откажи
            </button>
          )}
          {canClientCancel && (
            <button type="button" onClick={() => onAction?.(request, 'cancelled')} className="btn btn-ghost !py-2 text-sm">
              Отмени заявката
            </button>
          )}
        </div>
      )}
    </div>
  )
}
