import { Link } from 'react-router-dom'
import { getProfileImage, getProfileImageStyle } from '../lib/profiles.js'

export default function ProfessionalCard({ person, to, state, layerLabel, cta = 'Виж профила' }) {
  return (
    <Link to={to} state={state} className="card reveal block h-full bg-paper p-6">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-line bg-soft">
          <img src={getProfileImage(person)} alt={person.name} loading="lazy" decoding="async" className="img-cover" style={getProfileImageStyle(person)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {person.tag && <span className="rounded-full bg-soft px-2.5 py-1 text-xs text-ink">{person.tag}</span>}
            {layerLabel && <span className="text-xs text-muted">{layerLabel}</span>}
          </div>
          <div className="mt-3 font-display text-xl text-ink">{person.name}</div>
          <div className="mt-1 text-sm text-muted">{person.city} · от {person.since} г.</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-line bg-soft/70 px-4 py-3">
          <div className="text-xs text-muted">Оценка</div>
          <div className="mt-1 font-medium">★ {person.rating}</div>
        </div>
        <div className="rounded-xl border border-line bg-soft/70 px-4 py-3">
          <div className="text-xs text-muted">Проекти</div>
          <div className="mt-1 font-medium">{person.projects}</div>
        </div>
      </div>

      <span className="btn btn-ghost mt-5 w-full justify-center">{cta}</span>
    </Link>
  )
}