import { BriefcaseBusiness, Clock, FolderKanban, Star, Timer } from 'lucide-react'

function formatResponseTime(hours) {
  if (!hours && hours !== 0) return '—'
  if (hours < 1) return '< 1ч'
  return `< ${hours}ч`
}

function cardBaseClass(isInteractive, disabled) {
  const base = 'flex flex-col items-center justify-center rounded-2xl bg-soft/60 p-4 text-center transition-all duration-300'
  if (!isInteractive) return `${base} hover:bg-soft hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]`
  if (disabled) return `${base} cursor-not-allowed opacity-60`
  return `${base} cursor-pointer hover:bg-soft hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-offset-2 focus-visible:ring-offset-paper active:translate-y-0`
}

export default function PartnerStats({
  profile,
  stats,
  serviceCount = null,
  projectCount = null,
  compact = false,
  onServicesClick,
  onProjectsClick,
  onReviewsClick,
  onResponseClick,
  responseDisabled = false,
  responseLabel = '',
}) {
  const reviewCount = Number(stats?.reviews_count || 0)
  const rating = stats?.avg_rating
  const servicesValue = Number.isFinite(Number(serviceCount)) ? String(Number(serviceCount)) : '—'
  const projectsValue = Number.isFinite(Number(projectCount)) ? String(Number(projectCount)) : '—'
  const items = [
    { key: 'services', label: 'Услуги', value: servicesValue, icon: BriefcaseBusiness, onClick: onServicesClick, ariaLabel: 'Покажи публичните услуги на този профил' },
    { key: 'projects', label: 'Проекти', value: projectsValue, icon: FolderKanban, onClick: onProjectsClick, ariaLabel: 'Покажи проектите на този профил' },
    { key: 'response', label: 'Отговор', value: formatResponseTime(stats?.response_time_hours ?? profile?.responseTimeHours), icon: Timer, onClick: onResponseClick, disabled: responseDisabled, ariaLabel: responseLabel || 'Отвори чат с този профил' },
    { key: 'reviews', label: reviewCount ? `${reviewCount} отзива` : 'Оценка', value: rating ? `${Number(rating).toFixed(1)}★` : '—★', icon: Star, onClick: onReviewsClick, ariaLabel: 'Покажи публичните отзиви за този профил' },
  ]

  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'}`}>
      {items.map((item) => {
        const Icon = item.icon || Clock
        const interactive = typeof item.onClick === 'function'

        if (interactive) {
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              disabled={item.disabled}
              aria-label={item.ariaLabel}
              className={cardBaseClass(true, item.disabled)}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-paper text-accent shadow-sm">
                <Icon size={16} />
              </div>
              <div className="mt-2.5 font-display text-xl font-semibold text-ink">{item.value}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted">{item.label}</div>
            </button>
          )
        }

        return (
          <div key={item.key} className={cardBaseClass(false, false)}>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-paper text-accent shadow-sm">
              <Icon size={16} />
            </div>
            <div className="mt-2.5 font-display text-xl font-semibold text-ink">{item.value}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted">{item.label}</div>
          </div>
        )
      })}
    </div>
  )
}
