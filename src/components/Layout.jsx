import { Outlet, Link, NavLink, useLocation } from 'react-router-dom'
import { LAYERS } from '../data/layers.js'
import { useEffect, useRef, useState } from 'react'
import { Menu, MessageCircle, X } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { getAccountDisplayName, getAccountInitial, useAccount } from '../lib/account.js'
import { loadUnreadConversationCount, subscribeToConversationList } from '../lib/chat.js'

export default function Layout() {
  const { pathname, search, hash } = useLocation()
  const isAuthPage = pathname === '/login'

  // На всяка смяна на страница: скрол нагоре + ново наблюдение за reveal анимациите
  useEffect(() => {
    window.scrollTo({ top: 0 })
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } })
    }, { threshold: 0.1 })

    const observed = new WeakSet()
    const observeReveal = (node) => {
      if (!(node instanceof Element) || observed.has(node) || !node.classList.contains('reveal') || node.classList.contains('in')) return
      observed.add(node)
      io.observe(node)
    }

    const scanReveals = (root) => {
      if (!(root instanceof Element)) return
      observeReveal(root)
      root.querySelectorAll('.reveal:not(.in)').forEach(observeReveal)
    }

    const root = document.body
    if (!(root instanceof Element)) {
      io.disconnect()
      return () => io.disconnect()
    }

    scanReveals(root)

    const mo = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => scanReveals(node))
      })
    })
    mo.observe(root, { childList: true, subtree: true })

    return () => {
      mo.disconnect()
      io.disconnect()
    }
  }, [pathname])

  useEffect(() => {
    const setHeaderHeight = () => {
      const el = document.querySelector('header')
      if (el) document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`)
    }
    setHeaderHeight()
    window.addEventListener('resize', setHeaderHeight)
    return () => window.removeEventListener('resize', setHeaderHeight)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 min-h-0"><Outlet /></main>
      <Footer isAuthPage={isAuthPage} />
    </div>
  )
}

function Header() {
  const [open, setOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const close = () => setOpen(false)
  const { pathname, search, hash } = useLocation()
  const { session, account, isAdmin } = useAccount()
  const unreadCount = useUnreadCount(session?.user?.id)
  const isHomePage = pathname === '/'
  const isServicesActive = pathname.startsWith('/uslugi')
  const isCatalogActive = pathname === '/katalog'
  const isProActive = pathname === '/pro' || pathname === '/totsan-pro'
  const isVisualizationActive = pathname === '/vizualizacia'
  const isHomeHeroMode = isHomePage && !isScrolled && !open
  const shouldShowScrolledShadow = isScrolled && !open
  const headerSurfaceClass = isHomeHeroMode
    ? 'border-transparent bg-transparent shadow-none'
    : `border-line bg-paper/90 backdrop-blur-xl ${open ? 'shadow-[0_10px_18px_-18px_rgba(13,35,64,0.38)]' : shouldShowScrolledShadow ? 'shadow-[0_10px_22px_-18px_rgba(13,35,64,0.4)]' : 'shadow-none'}`
  const loginHref = `/login?next=${encodeURIComponent(`${pathname}${search}${hash}`)}`

  useEffect(() => {
    setOpen(false)
    setIsMoreOpen(false)
  }, [pathname])

  useEffect(() => {
    const syncScrolledState = () => {
      setIsScrolled(window.scrollY > 24)
    }

    syncScrolledState()
    window.addEventListener('scroll', syncScrolledState, { passive: true })
    return () => window.removeEventListener('scroll', syncScrolledState)
  }, [pathname])

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    const onResize = () => {
      if (window.innerWidth >= 1280) setOpen(false)
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <header className={`${isHomePage ? 'fixed inset-x-0 top-0' : 'sticky top-0'} z-40 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${headerSurfaceClass}`}>
        <div className="container-page grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-4 px-[var(--pad-x)] xl:gap-8">
          <Link to="/" className={`brand-logo shrink-0 transition-colors duration-300 ${isHomeHeroMode ? 'text-paper [text-shadow:0_10px_28px_rgba(0,0,0,0.48)]' : 'text-ink'}`} onClick={close}>Totsan</Link>

        <div className="min-w-0">
          <nav aria-label="Основна навигация" className="hidden min-w-0 xl:flex xl:flex-wrap xl:items-center xl:gap-2 2xl:flex-nowrap">
            {LAYERS.map(l => (
              <NavLink key={l.slug} to={`/sloy/${l.slug}`}
                className={({isActive}) => desktopNavClassName(isActive, isHomeHeroMode)}>
                {l.number} · {l.title.split(' ')[0]}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 xl:gap-3">
          <DesktopMoreMenu
            isOpen={isMoreOpen}
            setIsOpen={setIsMoreOpen}
            isHomeHeroMode={isHomeHeroMode}
            isServicesActive={isServicesActive}
            isCatalogActive={isCatalogActive}
            isProActive={isProActive}
            isVisualizationActive={isVisualizationActive}
          />
          {session && <Link to="/inbox" className={desktopUtilityLinkClassName(isHomeHeroMode)}>
            <MessageCircle size={17} />
            <span className="hidden xl:inline">Съобщения</span>
            {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accentDeep px-1.5 text-[11px] font-medium text-paper">{unreadCount}</span>}
          </Link>}
          {session ? <UserMenu session={session} account={account} isAdmin={isAdmin} /> : (
            <>
              <Link to={loginHref} className={`mobile-header-auth xl:hidden ${isHomeHeroMode ? 'mobile-header-auth-on-dark' : ''}`}>Вход</Link>
              <Link to={loginHref} className={`desktop-header-auth ${isHomeHeroMode ? 'desktop-header-auth-on-dark' : ''}`}>Вход</Link>
            </>
          )}
          <button
            aria-label="Меню"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            className={`mobile-menu-toggle xl:hidden ${open ? 'is-open' : ''} ${isHomeHeroMode ? 'mobile-menu-toggle-on-dark' : ''}`}>
            <span className="mobile-menu-toggle__icon mobile-menu-toggle__icon--menu" aria-hidden="true"><Menu size={18}/></span>
            <span className="mobile-menu-toggle__icon mobile-menu-toggle__icon--close" aria-hidden="true"><X size={18}/></span>
          </button>
        </div>
        </div>
      </header>

      {open && (
        <div id="mobile-navigation" className="mobile-nav-shell xl:hidden">
          <div className="container-page mobile-nav-panel px-[var(--pad-x)] pb-8 text-sm">
            <div className="mobile-nav-group">
              <div className="grid gap-3 mb-3">
                <NavLink to="/start" onClick={close} className={({ isActive }) => mobileNavClassName(isActive)}>
                  <span>Започни проект</span>
                  <span className="mobile-nav-arrow">→</span>
                </NavLink>
              </div>
              <div className="mobile-nav-group__label">Петте слоя</div>
              <div className="grid gap-3">
                {LAYERS.map(l => (
                  <NavLink
                    key={l.slug}
                    to={`/sloy/${l.slug}`}
                    onClick={close}
                    className={({ isActive }) => mobileNavClassName(isActive)}
                  >
                    <span>{l.number} · {l.title}</span>
                    <span className="mobile-nav-arrow">→</span>
                  </NavLink>
                ))}
              </div>
            </div>

            <div className="mobile-nav-group">
              <div className="mobile-nav-group__label">Разгледай</div>
              <div className="grid gap-3">
                <NavLink to="/uslugi" onClick={close} className={() => mobileNavClassName(isServicesActive)}><span>Услуги</span><span className="mobile-nav-arrow">→</span></NavLink>
                <NavLink to="/katalog" onClick={close} className={() => mobileNavClassName(isCatalogActive)}><span>Каталог</span><span className="mobile-nav-arrow">→</span></NavLink>
                <NavLink to="/pro" onClick={close} className={() => mobileNavClassName(isProActive)}><span>Totsan Pro</span><span className="mobile-nav-arrow">→</span></NavLink>
                <NavLink to="/kak-raboti" onClick={close} className={({ isActive }) => mobileNavClassName(isActive)}><span>Как работи Totsan</span><span className="mobile-nav-arrow">→</span></NavLink>
                <NavLink to="/za-nas" onClick={close} className={({ isActive }) => mobileNavClassName(isActive)}><span>За нас</span><span className="mobile-nav-arrow">→</span></NavLink>
                <NavLink to="/contact" onClick={close} className={({ isActive }) => mobileNavClassName(isActive)}><span>Контакт</span><span className="mobile-nav-arrow">→</span></NavLink>
              </div>
            </div>

            {session ? (
              <div className="mobile-nav-group">
                <div className="mobile-nav-group__label">Профил</div>
                <div className="grid gap-3">
                {isAdmin && (
                  <NavLink to="/admin" onClick={close} className={({ isActive }) => mobileNavClassName(isActive)}><span>Админ</span><span className="mobile-nav-arrow">→</span></NavLink>
                )}
                <NavLink to="/inbox" onClick={close} className={({ isActive }) => mobileNavClassName(isActive)}><span>Съобщения{unreadCount > 0 ? ` (${unreadCount})` : ''}</span><span className="mobile-nav-arrow">→</span></NavLink>
                <NavLink to="/porachki" onClick={close} className={({ isActive }) => mobileNavClassName(isActive)}><span>Поръчки</span><span className="mobile-nav-arrow">→</span></NavLink>
                <NavLink to="/moy-profil" onClick={close} className={({ isActive }) => mobileNavClassName(isActive)}><span>Моят профил</span><span className="mobile-nav-arrow">→</span></NavLink>
                <button onClick={() => { close(); supabase.auth.signOut() }} className="mobile-nav-item text-left text-muted hover:text-ink">Изход</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}

function desktopNavClassName(isActive, onDarkHero = false) {
  return `nav-pill header-layer-pill ${onDarkHero ? 'nav-pill-on-dark' : ''} ${isActive ? 'nav-pill-active' : ''}`
}

function mobileNavClassName(isActive) {
  return `mobile-nav-item ${isActive ? 'mobile-nav-item-active' : ''}`
}

function desktopUtilityLinkClassName(onDarkHero = false) {
  return `desktop-header-utility ${onDarkHero ? 'desktop-header-utility-on-dark' : ''}`
}

function DesktopMoreMenu({ isOpen, setIsOpen, isHomeHeroMode, isServicesActive, isCatalogActive, isProActive, isVisualizationActive }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    const onClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setIsOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, setIsOpen])

  const triggerClass = `desktop-header-utility ${isHomeHeroMode ? 'desktop-header-utility-on-dark' : ''}`

  return (
    <div ref={ref} className="relative hidden xl:block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="desktop-more-menu"
        onClick={() => setIsOpen((value) => !value)}
        className={triggerClass}
      >
        <span>Още</span>
        <span aria-hidden="true" className={`text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {isOpen && (
        <div id="desktop-more-menu" role="menu" className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-paper shadow-lg">
          <NavLink to="/uslugi" onClick={() => setIsOpen(false)} className={({ isActive }) => `block px-4 py-2.5 text-sm transition hover:bg-soft ${isServicesActive || isActive ? 'bg-accentSoft text-ink' : 'text-ink'}`}>Услуги</NavLink>
          <NavLink to="/katalog" onClick={() => setIsOpen(false)} className={({ isActive }) => `block px-4 py-2.5 text-sm transition hover:bg-soft ${isCatalogActive || isActive ? 'bg-accentSoft text-ink' : 'text-ink'}`}>Каталог</NavLink>
          <NavLink to="/vizualizacia" onClick={() => setIsOpen(false)} className={({ isActive }) => `block px-4 py-2.5 text-sm transition hover:bg-soft ${isVisualizationActive || isActive ? 'bg-accentSoft text-ink' : 'text-ink'}`}>3D визуализация</NavLink>
          <NavLink to="/pro" onClick={() => setIsOpen(false)} className={({ isActive }) => `block px-4 py-2.5 text-sm transition hover:bg-soft ${isProActive || isActive ? 'bg-accentSoft text-ink' : 'text-ink'}`}>Totsan Pro</NavLink>
        </div>
      )}
    </div>
  )
}

function useUnreadCount(userId) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId) {
      setCount(0)
      return undefined
    }

    let active = true
    async function load() {
      try {
        const nextCount = await loadUnreadConversationCount(userId)
        if (active) setCount(nextCount)
      } catch {
        if (active) setCount(0)
      }
    }

    load()
    const unsubscribe = subscribeToConversationList(userId, load)
    return () => {
      active = false
      unsubscribe()
    }
  }, [userId])

  return count
}

function UserMenu({ session, account, isAdmin }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const email = session.user.email || ''
  const displayName = getAccountDisplayName(account, session, email)
  const initial = getAccountInitial(account, session)

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 rounded-full border border-line bg-paper px-2 py-1.5 text-sm hover:border-ink/40 transition">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-paper text-xs font-medium">{initial}</span>
        <span className="hidden max-w-[10rem] truncate text-muted xl:inline">{displayName}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-line bg-paper shadow-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <div className="text-xs text-muted">Влязъл като</div>
            <div className="text-sm truncate">{displayName}</div>
            {email && <div className="mt-0.5 text-xs text-muted truncate">{email}</div>}
          </div>
          {isAdmin && <Link to="/admin" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-soft">Админ панел</Link>}
          <Link to="/porachki" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-soft">Поръчки</Link>
          <Link to="/moy-profil" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-soft">Моят профил</Link>
          <button onClick={() => { setOpen(false); supabase.auth.signOut() }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-soft border-t border-line">Изход</button>
        </div>
      )}
    </div>
  )
}

function Footer({ isAuthPage = false }) {
  return (
    <footer className={`border-t border-line ${isAuthPage ? 'mt-0' : 'mt-24'}`}>
      <div className="container-page section !py-12 grid gap-10 md:grid-cols-4">
        <div>
          <div className="font-display text-2xl">Totsan</div>
          <p className="text-muted mt-2 text-sm max-w-xs">Пространството ти — от идея до последния щрих, на едно място.</p>
        </div>
        <div>
          <div className="eyebrow mb-3">Слоеве</div>
          <ul className="space-y-1.5 text-sm">
            {LAYERS.map(l => <li key={l.slug}><Link to={`/sloy/${l.slug}`} className="text-muted hover:text-ink">{l.title}</Link></li>)}
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-3">Сайт</div>
          <ul className="space-y-1.5 text-sm">
            <li><Link to="/start" className="text-muted hover:text-ink">Започни проект</Link></li>
            <li><Link to="/vizualizacia" className="text-muted hover:text-ink">3D визуализация</Link></li>
            <li><Link to="/kak-raboti" className="text-muted hover:text-ink">Как работи Totsan</Link></li>
            <li><Link to="/za-nas" className="text-muted hover:text-ink">За нас</Link></li>
            <li><Link to="/uslugi" className="text-muted hover:text-ink">Услуги</Link></li>
            <li><Link to="/katalog" className="text-muted hover:text-ink">Каталог</Link></li>
            <li><Link to="/contact" className="text-muted hover:text-ink">Контакт</Link></li>
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-3">За професионалисти</div>
          <ul className="space-y-1.5 text-sm text-muted">
            <li><Link to="/pro" className="hover:text-ink">Totsan Pro</Link></li>
            <li><Link to="/login?signup=true&role=pro" className="hover:text-ink">Стани партньор</Link></li>
          </ul>
        </div>
      </div>
      <div className="container-page px-[var(--pad-x)] py-6 text-xs text-muted border-t border-line flex flex-col md:flex-row justify-between gap-2">
        <span>© {new Date().getFullYear()} Totsan. Всички права запазени.</span>
        <span>Демо версия</span>
      </div>
    </footer>
  )
}
