import { Clock, FolderKanban, Star, Timer, UserCheck } from 'lucide-react'

function formatMemberSince(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('bg-BG', { month: 'short', year: 'numeric' })
}

function formatResponseTime(hours) {
  if (!hours && hours !== 0) return '—'
  if (hours < 1) return '< 1ч'
  return `< ${hours}ч`
}

export default function PartnerStats({ profile, stats, compact = false }) {
  const reviewCount = Number(stats?.reviews_count || 0)
  const rating = stats?.avg_rating ?? profile?.rating
  const items = [
    { label: 'Член от', value: formatMemberSince(stats?.member_since || profile?.createdAt), icon: UserCheck },
    { label: 'Проекти', value: stats?.total_projects ?? profile?.projects ?? '—', icon: FolderKanban },
    { label: 'Отговор', value: formatResponseTime(stats?.response_time_hours ?? profile?.responseTimeHours), icon: Timer },
    { label: reviewCount ? `${reviewCount} отзива` : 'Оценка', value: rating ? `${Number(rating).toFixed(1)}★` : '—★', icon: Star },
  ]

  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'}`}>
      {items.map((item) => {
        const Icon = item.icon || Clock
        return (
          <div key={item.label} className="flex flex-col items-center justify-center rounded-2xl bg-soft/60 p-4 text-center transition-all duration-300 hover:bg-soft hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
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
