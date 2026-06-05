import { Link } from 'react-router-dom'
import { LAYER_HEROS } from '../data/images.js'
import { getProfileImage, getProfileImageStyle } from '../lib/profiles.js'

export default function ProfessionalCard({ person, to, state, layerLabel, cta = 'Виж профила' }) {
  const profileImage = person?.imageUrl || person?.image_url || ''
  const layerSlug = person?.layer || person?.layerSlug || person?.layer_slug || ''
  const coverUrl = person?.coverUrl || person?.portfolioCoverUrl || profileImage || LAYER_HEROS[layerSlug] || getProfileImage(person)
  const avatarUrl = getProfileImage(person)
  const responseLabel = formatResponseTime(person?.responseTimeHours ?? person?.response_time_hours)
  const hasProjects = Number.isFinite(Number(person?.projects))
  const hasRating = Number.isFinite(Number(person?.rating))

  return (
    <Link to={to} state={state} className="card reveal img-zoom-host group flex h-full min-h-[28rem] flex-col overflow-hidden bg-paper p-0">
      <div className="media-frame aspect-[16/10] bg-soft">
        <img
          src={coverUrl}
          alt={person.name}
          loading="lazy"
          decoding="async"
          className="img-cover img-zoom"
          style={coverUrl === profileImage ? getProfileImageStyle(person) : undefined}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/45 via-ink/5 to-transparent" />
        {layerLabel && (
          <span className="absolute left-4 top-4 max-w-[calc(100%-2rem)] truncate rounded-full bg-paper/90 px-3 py-1 text-xs text-ink shadow-sm backdrop-blur">
            {layerLabel}
          </span>
        )}
        {person.tag && (
          <span className="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] truncate rounded-full bg-ink/90 px-3 py-1 text-xs text-paper backdrop-blur">
            {person.tag}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6 pt-0">
        <div className="-mt-8 flex items-end justify-between gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-4 border-paper bg-soft shadow-sm">
            <img src={avatarUrl} alt={person.name} loading="lazy" decoding="async" className="img-cover" style={getProfileImageStyle(person)} />
          </div>
          {person.city && (
            <span className="mb-1 max-w-[60%] truncate rounded-full border border-line bg-paper px-3 py-1 text-xs text-muted">
              {person.city}
            </span>
          )}
        </div>

        <div className="mt-4 min-w-0">
          <div className="font-display text-2xl leading-tight text-ink">{person.name}</div>
          <div className="mt-1 min-h-[1.25rem] text-sm text-muted">
            {person.tag || 'Специалист'}
            {person.since ? ` · от ${person.since} г.` : ''}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          {hasRating && (
            <div className="rounded-xl border border-line bg-soft/70 px-4 py-3">
              <div className="text-xs text-muted">Оценка</div>
              <div className="mt-1 font-medium">★ {person.rating}</div>
            </div>
          )}
          {hasProjects && (
            <div className="rounded-xl border border-line bg-soft/70 px-4 py-3">
              <div className="text-xs text-muted">Проекти</div>
              <div className="mt-1 font-medium">{person.projects}</div>
            </div>
          )}
          {responseLabel && (
            <div className="col-span-2 rounded-xl border border-line bg-paper px-4 py-3">
              <div className="text-xs text-muted">Отговор</div>
              <div className="mt-1 font-medium">{responseLabel}</div>
            </div>
          )}
        </div>

        <div className="mt-auto pt-5">
          <span className="btn btn-ghost w-full justify-center">{cta}</span>
        </div>
      </div>
    </Link>
  )
}

function formatResponseTime(value) {
  const hours = Number(value)
  if (!Number.isFinite(hours) || hours <= 0) return ''
  if (hours < 24) return `до ${Math.round(hours)} ч.`
  const days = Math.max(1, Math.round(hours / 24))
  return `до ${days} д.`
}
