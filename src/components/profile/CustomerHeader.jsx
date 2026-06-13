import { CalendarDays, LogOut, MapPin, Pencil } from 'lucide-react'
import PublicProfileAvatar from './PublicProfileAvatar.jsx'
import PublicProfilePanel from './PublicProfilePanel.jsx'

function formatMemberDate(value) {
  if (!value) return 'днес'
  return new Date(value).toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })
}

export default function CustomerHeader({ account, displayName, completeness, onEditAvatar, onSignOut }) {
  const avatarUrl = account?.avatar_url || ''
  const targetPercent = completeness?.percent || 0
  const city = account?.city || account?.country || ''

  return (
    <PublicProfilePanel className="transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col items-center gap-4 text-center lg:flex-row lg:items-end lg:text-left">
          <div className="group relative">
            <button
              type="button"
              onClick={onEditAvatar}
              className="relative block overflow-hidden rounded-[24px] transition hover:ring-2 hover:ring-ink focus:outline-none focus:ring-2 focus:ring-ink"
              aria-label="Смени снимката"
            >
              <PublicProfileAvatar
                src={avatarUrl}
                alt={displayName}
                name={displayName}
                statusTitle="Профил в Totsan"
                sizeClassName="h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32"
                statusClassName="bottom-0.5 right-0.5 h-4 w-4 border-[3px] sm:bottom-1 sm:right-1 sm:h-5 sm:w-5 sm:border-4"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-ink/45 px-3 text-center text-paper opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                <Pencil size={24} />
                <span className="mt-1 text-xs font-semibold">{avatarUrl ? 'Смени снимка' : 'Добавете снимка'}</span>
              </div>
            </button>
          </div>

          <div className="min-w-0 pb-1">
            <div className="eyebrow">Моят профил</div>
            <h1 className="mt-2 break-words font-display text-[clamp(2rem,7vw,3.25rem)] font-semibold leading-[0.95] tracking-tight text-ink">
              {displayName}
            </h1>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-medium text-muted lg:justify-start">
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

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
          <div className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-line/60 bg-soft/60 px-4 py-3 text-sm sm:w-auto sm:min-w-[9rem]">
            <span className="text-muted">Попълване</span>
            <span className="font-semibold text-ink">{targetPercent}%</span>
          </div>
          <button type="button" className="btn btn-ghost w-full justify-center sm:w-auto" onClick={onSignOut}>
            <LogOut size={18} />
            Изход
          </button>
        </div>
      </div>
    </PublicProfilePanel>
  )
}
