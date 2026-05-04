import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import './index.css'
import Layout from './components/Layout.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Home from './pages/Home.jsx'
import Layer from './pages/Layer.jsx'
import Services from './pages/Services.jsx'
import Service from './pages/Service.jsx'
import PartnerService from './pages/PartnerService.jsx'
import Catalog from './pages/Catalog.jsx'
import Pro from './pages/Pro.jsx'
import Product from './pages/Product.jsx'
import HowItWorks from './pages/HowItWorks.jsx'
import About from './pages/About.jsx'
import Contact from './pages/Contact.jsx'
import Admin from './pages/Admin.jsx'
import MyProfile from './pages/MyProfile.jsx'
import Inbox from './pages/Inbox.jsx'
import Checkout from './pages/Checkout.jsx'
import Order from './pages/Order.jsx'
import MyOrders from './pages/MyOrders.jsx'
function AppRoutes() {
  const location = useLocation()

  return (
    <ErrorBoundary key={location.pathname}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/sloy/:slug" element={<Layer />} />
          <Route path="/uslugi" element={<Services />} />
          <Route path="/uslugi/:slug" element={<PartnerService />} />
          <Route path="/usluga/:slug" element={<Service />} />
          <Route path="/katalog" element={<Catalog />} />
          <Route path="/profil/:slug" element={<Pro />} />
          <Route path="/produkt/:slug" element={<Product />} />
          <Route path="/kak-raboti" element={<HowItWorks />} />
          <Route path="/za-nas" element={<About />} />
          <Route path="/kontakt" element={<Contact />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Admin />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/moy-profil" element={<MyProfile />} />
          <Route path="/porachki" element={<MyOrders />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/inbox/:conversationId" element={<Inbox />} />
          <Route path="/checkout/success" element={<Checkout />} />
          <Route path="/checkout/:type/:id" element={<Checkout />} />
          <Route path="/order/:orderId" element={<Order />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
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
