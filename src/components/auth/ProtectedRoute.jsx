import { Navigate, useLocation } from 'react-router-dom'
import { useAccount } from '../../lib/account.js'
import { useMfaGate } from '../../lib/mfa.js'
import { TotpMfaChallengeGate } from './TotpMfa.jsx'

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { session, account, loading } = useAccount()
  const mfaGate = useMfaGate(session)
  const location = useLocation()

  if (loading || mfaGate.loading) {
    return (
      <section className="flex h-[calc(100vh-var(--header-h,0px))] items-center justify-center bg-soft">
        <div className="text-muted">Проверяваме достъпа…</div>
      </section>
    )
  }

  if (!session) {
    // Save the intended destination to return to after login
    const searchParams = new URLSearchParams()
    searchParams.set('next', location.pathname + location.search)
    return <Navigate to={`/login?${searchParams.toString()}`} replace />
  }

  if (mfaGate.needsMfa) {
    return (
      <section className="section bg-soft min-h-[calc(100vh-var(--header-h,0px))]">
        <div className="container-page max-w-3xl">
          <TotpMfaChallengeGate factor={mfaGate.factor} onVerified={mfaGate.refresh} />
        </div>
      </section>
    )
  }

  if (requireAdmin && account?.role !== 'admin') {
    return <Navigate to="/moy-profil" replace />
  }

  return children
}
