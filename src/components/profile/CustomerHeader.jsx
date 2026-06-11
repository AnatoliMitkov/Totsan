import { CalendarDays, LogOut, MapPin, UserRound } from 'lucide-react'
import PublicProfileAvatar from './PublicProfileAvatar.jsx'
import PublicProfilePanel from './PublicProfilePanel.jsx'

function formatMemberDate(value) {
  if (!value) return 'днес'
  return new Date(value).toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })
}

export default function CustomerHeader({ account, displayName, completeness, onSignOut }) {
  const avatarUrl = account?.avatar_url || ''
  const targetPercent = completeness?.percent || 0
  const city = account?.city || account?.country || ''

  return (
    <PublicProfilePanel className="transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:text-left">
          <PublicProfileAvatar
            src={avatarUrl}
            alt={displayName}
            fallbackIcon={UserRound}
            statusTitle="Профил в Totsan"
          />

          <div className="min-w-0 pb-1">
            <div className="eyebrow">Моят профил</div>
            <h1 className="mt-2 break-words font-display text-3xl font-semibold leading-none tracking-tight text-ink md:text-5xl">
              {displayName}
            </h1>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-medium text-muted sm:justify-start">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} className="text-accent" />
                В Totsan от {formatMemberDate(account?.created_at)}
              </span>
              {city && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} className="text-accent" />
                  {city}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-end">
          <div className="rounded-2xl border border-line/60 bg-soft/60 px-4 py-3 text-sm">
            <span className="text-muted">Попълване</span>
            <span className="ml-2 font-semibold text-ink">{targetPercent}%</span>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onSignOut}>
            <LogOut size={18} />
            Изход
          </button>
        </div>
      </div>
    </PublicProfilePanel>
  )
}
