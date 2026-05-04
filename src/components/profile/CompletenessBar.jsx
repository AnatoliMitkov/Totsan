import { CheckCircle2, Circle } from 'lucide-react'

export default function CompletenessBar({ completeness, compact = false }) {
  const percent = completeness?.percent || 0
  const checks = completeness?.checks || []

  return (
    <div className={compact ? '' : 'rounded-2xl border border-line bg-paper p-5'}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="eyebrow">Профил попълнен</div>
          <div className="mt-1 font-display text-2xl text-ink">{percent}%</div>
        </div>
        <div className="min-w-[5rem] text-right text-sm text-muted">
          {completeness?.completedChecks?.length || 0}/{checks.length}
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-cloud" aria-hidden="true">
        <div className="h-full rounded-full bg-ink transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>

      {!compact && (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {checks.map((check) => {
            const Icon = check.complete ? CheckCircle2 : Circle
            return (
              <div key={check.key} className="flex items-center gap-2 text-sm">
                <Icon size={16} className={check.complete ? 'text-accentDeep' : 'text-muted'} />
                <span className={check.complete ? 'text-ink' : 'text-muted'}>{check.label}</span>
                <span className="ml-auto text-xs text-muted">{check.weight}%</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}