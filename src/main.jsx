import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import './index.css'
import Layout from './components/Layout.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { supabase } from './lib/supabase.js'
import Home from './pages/Home.jsx'
import Start from './pages/Start.jsx'
import Layer from './pages/Layer.jsx'
import Services from './pages/Services.jsx'
import Service from './pages/Service.jsx'
import PartnerService from './pages/PartnerService.jsx'
import Catalog from './pages/Catalog.jsx'
import Pro from './pages/Pro.jsx'
import TotsanPro from './pages/TotsanPro.jsx'
import Product from './pages/Product.jsx'
import HowItWorks from './pages/HowItWorks.jsx'
import About from './pages/About.jsx'
import Contact from './pages/Contact.jsx'
import Vizualizacia from './pages/Vizualizacia.jsx'
import Admin from './pages/Admin.jsx'
import MyProfile from './pages/MyProfile.jsx'
import Inbox from './pages/Inbox.jsx'
import Checkout from './pages/Checkout.jsx'
import Order from './pages/Order.jsx'
import MyOrders from './pages/MyOrders.jsx'
import GardenAndYard from './pages/GardenAndYard.jsx'
import WallpapersAndColors from './pages/WallpapersAndColors.jsx'
import DecorativeAccents from './pages/DecorativeAccents.jsx'
import TerracesAndOutdoor from './pages/TerracesAndOutdoor.jsx'
import Kitchens from './pages/Kitchens.jsx'
import BedroomAndLiving from './pages/BedroomAndLiving.jsx'
import Bathroom from './pages/Bathroom.jsx'
import LightingAndTextiles from './pages/LightingAndTextiles.jsx'
import SharedProject from './pages/SharedProject.jsx'
import Portfolio from './pages/Portfolio.jsx'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import MfaSessionLock from './components/auth/MfaSessionLock.jsx'
import { signOutAndRedirect } from './lib/account.js'
import { loadMfaStatus } from './lib/mfa.js'
import { trackPageView, canAutoTrackPath, getPageLocation } from './lib/analytics.js'
import { applySeo, getDefaultSeo } from './lib/seo.js'
import { getAnalyticsPath } from './lib/site-routes.js'

let mfaNextPath = ''

function normalizeNextPath(value = '') {
  const raw = String(value || '').trim()
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return ''
  if (raw.startsWith('/login')) return ''
  return raw
}

function nextPathFromLocation(location) {
  if (location.pathname === '/login') {
    const params = new URLSearchParams(location.search || '')
    return normalizeNextPath(params.get('next') || '')
  }

  return normalizeNextPath(`${location.pathname}${location.search || ''}${location.hash || ''}`)
}

function readStoredMfaNext() {
  return normalizeNextPath(mfaNextPath)
}

function storeMfaNext(value) {
  const next = normalizeNextPath(value)
  if (next) mfaNextPath = next
}

function clearMfaNext() {
  mfaNextPath = ''
}

function RouteSeoManager() {
  const location = useLocation()

  useEffect(() => {
    applySeo(getDefaultSeo(location.pathname))
  }, [location.pathname])

  return null
}

function RouteAnalyticsManager() {
  const location = useLocation()

  useEffect(() => {
    if (!canAutoTrackPath(location.pathname)) return

    const seo = getDefaultSeo(location.pathname)
    trackPageView({
      pagePath: getAnalyticsPath(location.pathname),
      pageTitle: seo.title,
      pageLocation: getPageLocation(location.pathname),
    })
  }, [location.pathname])

  return null
}

function MfaAppGate({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const locationRef = useRef(location)
  const [state, setState] = useState({
    loading: true,
    session: null,
    locked: false,
    factor: null,
    error: '',
  })

  useEffect(() => {
    locationRef.current = location
  }, [location])

  const syncMfaState = useCallback(async (nextSession) => {
    if (!nextSession?.user) {
      clearMfaNext()
      setState({ loading: false, session: null, locked: false, factor: null, error: '' })
      return { locked: false }
    }

    setState((current) => ({
      ...current,
      loading: true,
      session: nextSession,
      error: '',
    }))

    try {
      const status = await loadMfaStatus()
      const locked = status.nextLevel === 'aal2' && status.currentLevel !== 'aal2'

      if (locked) {
        const intended = nextPathFromLocation(locationRef.current)
        storeMfaNext(intended || readStoredMfaNext() || '/moy-profil')
      }

      setState({
        loading: false,
        session: nextSession,
        locked,
        factor: status.primaryFactor,
        error: '',
      })

      return { locked }
    } catch (error) {
      setState({
        loading: false,
        session: nextSession,
        locked: false,
        factor: null,
        error: error?.message || '',
      })
      return { locked: false }
    }
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      syncMfaState(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      syncMfaState(nextSession)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [syncMfaState])

  async function handleVerified() {
    const { data } = await supabase.auth.getSession()
    const result = await syncMfaState(data.session)
    if (result.locked) return

    const next = readStoredMfaNext() || '/moy-profil'
    clearMfaNext()
    navigate(next, { replace: true })
  }

  if (state.loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-soft px-4">
        <div className="text-sm text-muted">Проверяваме достъпа…</div>
      </main>
    )
  }

  if (state.session && state.locked) {
    return (
      <MfaSessionLock
        factor={state.factor}
        onLogout={() => signOutAndRedirect(state.session?.user?.id)}
        onVerified={handleVerified}
      />
    )
  }

  return children
}

function AppRoutes() {
  const location = useLocation()

  return (
    <MfaAppGate>
      <ErrorBoundary key={location.pathname}>
        <Routes>
          <Route path="/portfolio" element={<Portfolio />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/start" element={<Start />} />
            <Route path="/landing" element={<Navigate to="/" replace />} />
            <Route path="/sloy/:slug" element={<Layer />} />
            <Route path="/uslugi" element={<Services />} />
            <Route path="/uslugi/:slug" element={<PartnerService />} />
            <Route path="/usluga/:slug" element={<Service />} />
            <Route path="/katalog" element={<Catalog />} />
            <Route path="/profil/:slug" element={<Pro />} />
            <Route path="/pro" element={<TotsanPro />} />
            <Route path="/totsan-pro" element={<Navigate to="/pro" replace />} />
            <Route path="/produkt/:slug" element={<Product />} />
            <Route path="/kak-raboti" element={<HowItWorks />} />
            <Route path="/za-nas" element={<About />} />
            <Route path="/kontakt" element={<Contact />} />
            <Route path="/contact" element={<Navigate to="/kontakt" replace />} />
            <Route path="/vizualizacia" element={<Vizualizacia />} />
            <Route path="/gradina-i-dvor" element={<GardenAndYard />} />
            <Route path="/tapeti-i-cvetove" element={<WallpapersAndColors />} />
            <Route path="/dekorativni-akcenti" element={<DecorativeAccents />} />
            <Route path="/terasi-i-vunshni-zoni" element={<TerracesAndOutdoor />} />
            <Route path="/kuhni" element={<Kitchens />} />
            <Route path="/spalnya-i-dnevna" element={<BedroomAndLiving />} />
            <Route path="/banya" element={<Bathroom />} />
            <Route path="/osvetlenie-i-tekstil" element={<LightingAndTextiles />} />
            <Route path="/login" element={<Admin />} />
            <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
            <Route path="/moy-profil" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
            <Route path="/porachki" element={<ProtectedRoute><MyOrders /></ProtectedRoute>} />
            <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
            <Route path="/inbox/:conversationId" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
            <Route path="/checkout/success" element={<Checkout />} />
            <Route path="/checkout/:type/:id" element={<Checkout />} />
            <Route path="/order/:orderId" element={<ProtectedRoute><Order /></ProtectedRoute>} />
            <Route path="/proekt/:shareId" element={<SharedProject />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </MfaAppGate>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <RouteSeoManager />
      <RouteAnalyticsManager />
      <AppRoutes />
    </BrowserRouter>
  </React.StrictMode>
)

function NotFound() {
  return (
    <section className="section">
      <div className="container-page max-w-2xl text-center">
        <h1 className="h-display">404</h1>
        <p className="text-muted mt-3">Тази страница я няма. Върни се към началото.</p>
        <Link to="/" className="btn btn-primary mt-6 inline-flex">Към началото</Link>
      </div>
    </section>
  )
}
