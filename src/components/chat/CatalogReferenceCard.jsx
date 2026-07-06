import { ArrowUpRight, BriefcaseBusiness, CalendarDays, FolderKanban, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import FallbackImage from '../FallbackImage.jsx'
import { getChatReferenceHref, getChatReferenceLabel } from '../../lib/chat.js'
import { LAYERS } from '../../data/layers.js'

function formatLayerLabel(value = '') {
  const layer = LAYERS.find((item) => item.slug === value)
  return layer ? `Слой ${layer.number} · ${layer.title}` : value
}

function DetailPill({ icon: Icon, value }) {
  if (!value) return null
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-current/10 bg-current/5 px-2.5 py-1 text-[11px] font-medium opacity-85">
      <Icon size={13} />
      <span>{value}</span>
    </span>
  )
}

export default function CatalogReferenceCard({ reference, compact = false }) {
  if (!reference) return null

  const href = getChatReferenceHref(reference)
  const isService = reference.type === 'service'
  const label = getChatReferenceLabel(reference)
  const coverSources = [reference.coverUrl].filter(Boolean)
  const accentIcon = isService ? BriefcaseBusiness : FolderKanban
  const AccentIcon = accentIcon
  const secondaryMeta = isService
    ? [formatLayerLabel(reference.layerLabel), reference.priceLabel || reference.deliveryLabel].filter(Boolean)
    : [reference.badge].filter(Boolean)

  const cardInner = (
    <div className="overflow-hidden rounded-[1.35rem] border border-current/10 bg-current/5">
      <div className="grid min-w-0 gap-0 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <div className="bg-paper/35">
          <div className="aspect-[4/3] h-full min-h-32 w-full">
            <FallbackImage
              sources={coverSources}
              alt={reference.title}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
        <div className="min-w-0 p-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
                <AccentIcon size={14} />
                <span>{label}</span>
              </div>
              <h3 className={`mt-2 break-words font-display leading-tight ${compact ? 'text-2xl' : 'text-[1.65rem]'}`}>
                {reference.title}
              </h3>
            </div>
            {href && (
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-current/10 bg-paper/40 opacity-80">
                <ArrowUpRight size={16} />
              </span>
            )}
          </div>

          {reference.subtitle && (
            <p className="mt-2 text-sm leading-6 opacity-78">{reference.subtitle}</p>
          )}

          {!reference.subtitle && reference.description && (
            <p className="mt-2 line-clamp-3 text-sm leading-6 opacity-78">{reference.description}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {secondaryMeta.map((value) => (
              <span key={value} className="rounded-full border border-current/10 bg-paper/30 px-2.5 py-1 text-[11px] font-medium opacity-85">
                {value}
              </span>
            ))}
            <DetailPill icon={MapPin} value={!isService ? reference.city : ''} />
            <DetailPill icon={CalendarDays} value={!isService && reference.year ? `${reference.year}` : ''} />
          </div>

          {href && (
            <div className="mt-4 text-sm font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <span>Отвори страницата</span>
                <ArrowUpRight size={15} />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (!href) return cardInner

  return (
    <Link to={href} className="block transition hover:translate-y-[-1px] hover:opacity-95">
      {cardInner}
    </Link>
  )
}
