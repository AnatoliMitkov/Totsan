import { Link } from 'react-router-dom'
import { BriefcaseBusiness, Euro, FolderKanban, MapPin, Tags } from 'lucide-react'
import FallbackImage from './FallbackImage.jsx'
import { LAYER_HEROS } from '../data/images.js'
import { getProfileImage, getProfileImageCandidates, getProfileImageStyle, normalizePricingNoteDisplay } from '../lib/profiles.js'

const CARD_IMAGE_ASPECT_CLASS = 'aspect-[16/9]'
const PROFILE_AVATAR_SIZE_CLASS = 'h-32 w-32'
const PROFILE_AVATAR_OVERLAP_CLASS = '-mt-20'

export default function ProfessionalCard({ person, to, state, layerLabel, cta = 'Виж профила' }) {
  const profileImage = person?.imageUrl || person?.image_url || ''
  const layerSlug = person?.layer || person?.layerSlug || person?.layer_slug || ''
  const coverUrl = person?.coverUrl || person?.portfolioCoverUrl || profileImage || LAYER_HEROS[layerSlug] || getProfileImage(person)
  const layerName = layerLabel || person?.layerTitle || person?.layer_title || ''
  const specialization = person?.headline || person?.tag || person?.sub || 'Специалист'
  const serviceAreas = normalizeList(person?.serviceAreas || person?.service_areas)
  const visibleAreas = serviceAreas.slice(0, 3)
  const serviceCount = toCount(person?.serviceCount)
  const portfolioCount = toCount(person?.portfolioCount)
  const hasServiceMetric = person?.serviceCount !== undefined && person?.serviceCount !== null
  const hasPortfolioMetric = person?.portfolioCount !== undefined && person?.portfolioCount !== null
  const yearsExperience = toCount(person?.yearsExperience ?? person?.years_experience)
  const priceGuide = normalizePricingNoteDisplay(person?.priceGuide || person?.pricingNote || person?.pricing_note || '')
  const serviceTitles = normalizeList(person?.serviceTitles)
  const description = person?.hasProfileDescription
    ? compactText(person?.descriptionLong || person?.description_long || person?.bio)
    : ''

  return (
    <Link to={to} state={state} className="card reveal img-zoom-host group flex h-full min-h-[31rem] flex-col overflow-hidden bg-paper p-0">
      <div className={`media-frame ${CARD_IMAGE_ASPECT_CLASS} bg-soft`}>
        <img
          src={coverUrl}
          alt={person.name}
          loading="lazy"
          decoding="async"
          className="img-cover img-zoom"
          style={coverUrl === profileImage ? getProfileImageStyle(person) : undefined}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/45 via-ink/5 to-transparent" />
        {layerName && (
          <span className="absolute left-4 top-4 max-w-[calc(100%-2rem)] truncate rounded-full bg-paper/90 px-3 py-1 text-xs text-ink shadow-sm backdrop-blur">
            {layerName}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6 pt-0">
        <div className={`${PROFILE_AVATAR_OVERLAP_CLASS} flex items-end justify-between gap-4`}>
          <div className={`${PROFILE_AVATAR_SIZE_CLASS} shrink-0 overflow-hidden rounded-full border-4 border-paper bg-soft shadow-sm`}>
            <FallbackImage sources={getProfileImageCandidates(person)} alt={person.name} loading="lazy" decoding="async" className="img-cover" style={getProfileImageStyle(person)} />
          </div>
          {person.city && (
            <span className="mb-1 max-w-[60%] truncate rounded-full border border-line bg-paper px-3 py-1 text-xs text-muted">
              {person.city}
            </span>
          )}
        </div>

        <div className="mt-4 min-w-0">
          <div className="font-display text-2xl leading-tight text-ink">{person.name}</div>
          <div className="mt-1 min-h-[1.25rem] text-sm text-muted">{specialization}</div>
        </div>

        <p className="mt-4 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-muted">
          {description || 'Партньорът още не е добавил кратко описание към профила си.'}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <InfoTile icon={Tags} label="Категория" value={person?.tag || layerName || 'Не е посочена'} />
          <InfoTile icon={Euro} label="Цена" value={priceGuide || 'По запитване'} />
          <InfoTile icon={BriefcaseBusiness} label="Услуги" value={hasServiceMetric ? (serviceCount ? countLabel(serviceCount, 'услуга', 'услуги') : 'Няма публикувани') : 'Виж профила'} />
          <InfoTile icon={FolderKanban} label="Портфолио" value={hasPortfolioMetric ? (portfolioCount ? countLabel(portfolioCount, 'проект', 'проекта') : 'Няма качено') : 'Виж профила'} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {yearsExperience > 0 && <Badge>{yearsExperience} г. опит</Badge>}
          {visibleAreas.map((area) => <Badge key={area}><MapPin size={12} /> {area}</Badge>)}
          {serviceAreas.length > visibleAreas.length && <Badge>+{serviceAreas.length - visibleAreas.length} района</Badge>}
          {!serviceAreas.length && person.city && <Badge><MapPin size={12} /> {person.city}</Badge>}
        </div>

        {serviceTitles.length > 0 && (
          <div className="mt-4 line-clamp-2 text-xs leading-5 text-muted">
            Публикувани услуги: {serviceTitles.join(', ')}
          </div>
        )}

        <div className="mt-auto pt-5">
          <span className="btn btn-ghost w-full justify-center">{cta}</span>
        </div>
      </div>
    </Link>
  )
}

function InfoTile({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-soft/70 px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-muted"><Icon size={13} /> {label}</div>
      <div className="mt-1 truncate font-medium text-ink">{value}</div>
    </div>
  )
}

function Badge({ children }) {
  return <span className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-3 py-1 text-muted">{children}</span>
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean)
}

function toCount(value) {
  const next = Number(value)
  return Number.isFinite(next) && next > 0 ? Math.round(next) : 0
}

function countLabel(count, one, many) {
  return `${count} ${count === 1 ? one : many}`
}

function compactText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim()
}
