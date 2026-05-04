import { LogOut, UserRound } from 'lucide-react'

function formatMemberDate(value) {
  if (!value) return 'днес'
  return new Date(value).toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' })
}

export default function CustomerHeader({ account, displayName, completeness, onSignOut }) {
  const initial = (displayName?.[0] || '?').toUpperCase()
  const avatarUrl = account?.avatar_url || ''
  const percent = completeness?.percent || 0

  return (
    <div className="rounded-3xl border border-line bg-paper p-5 md:p-7">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24 shrink-0 rounded-full p-1" style={{ background: `conic-gradient(#1B1D1F ${percent * 3.6}deg, #ECEEF0 0deg)` }}>
            <div className="h-full w-full overflow-hidden rounded-full border border-line bg-soft">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="img-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-medium text-muted">
                  {initial || <UserRound size={28} />}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="eyebrow">Моят профил</div>
            <h1 className="mt-1 font-display text-4xl leading-none text-ink md:text-5xl">{displayName}</h1>
            <p className="mt-2 text-sm text-muted">В Totsan от {formatMemberDate(account?.created_at)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <div className="rounded-2xl border border-line bg-soft px-4 py-3 text-sm">
            <span className="text-muted">Попълване</span>
            <span className="ml-2 font-medium text-ink">{percent}%</span>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onSignOut}>
            <LogOut size={18} />
            Изход
          </button>
        </div>
      </div>
    </div>
  )
}