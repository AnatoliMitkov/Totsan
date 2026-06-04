import { Navigate, useLocation } from 'react-router-dom'
import { useAccount } from '../../lib/account.js'

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { session, account, loading, mfaRequired } = useAccount()
  const location = useLocation()

  if (loading) {
    return (
      <section className="flex h-[calc(100vh-var(--header-h,0px))] items-center justify-center bg-soft">
        <div className="text-muted">Проверяваме достъпа…</div>
      </section>
    )
  }

  if (!session) {
    const searchParams = new URLSearchParams()
    searchParams.set('next', location.pathname + location.search)
    return <Navigate to={`/login?${searchParams.toString()}`} replace />
  }

  if (mfaRequired) return null

  if (requireAdmin && account?.role !== 'admin') {
    return <Navigate to="/moy-profil" replace />
  }

  return children
}
