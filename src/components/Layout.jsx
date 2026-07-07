import { Outlet, Link, NavLink, useLocation } from 'react-router-dom'
import { LAYERS } from '../data/layers.js'
import { useEffect, useRef, useState } from 'react'
import { Menu, MessageCircle, X } from 'lucide-react'
import { getAccountDisplayName, getAccountAvatar, useAccount, signOutAndRedirect } from '../lib/account.js'
import { loadUnreadConversationCount, subscribeToConversationList } from '../lib/chat.js'
import Avatar from './Avatar.jsx'
import { openCookieSettings } from './CookieConsent.jsx'

const BLOCKED_ACCOUNT_STATUSES = new Set(['banned', 'blocked'])

const HEADER_LAYER_LABELS = {
  materiali: 'Материали',
}

const PAGES_WITH_HERO = [
  '/',
  '/moy-profil',
  '/pro',
  '/gradina-i-dvor',
  '/tapeti-i-cvetove',
  '/dekorativni-akcenti',
  '/terasi-i-vunshni-zoni',
  '/kuhni',
  '/spalnya-i-dnevna',
  '/banya',
  '/osvetlenie-i-tekstil'
]

function hasHeroBanner(pathname) {
  if (PAGES_WITH_HERO.includes(pathname)) return true
  if (pathname.startsWith('/sloy/') || pathname.startsWith('/profil/') || pathname.startsWith('/proekt/')) return true
  return false
}

export default function Layout() {
  const { pathname } = useLocation()
  const { account } = useAccount()
  const isAuthPage = pathname === '/login'
  const isInboxPage = pathname === '/inbox' || pathname.startsWith('/inbox/')
  const isInboxThreadPage = /^\/inbox\/[^/?#]+/.test(pathname)
  const isBlockedAccount = BLOCKED_ACCOUNT_STATUSES.has(account?.account_status)
  const isHeroPage = hasHeroBanner(pathname)

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
    const el = document.querySelector('header')
    const ro = el && 'ResizeObserver' in window ? new ResizeObserver(setHeaderHeight) : null
    if (el && ro) ro.observe(el)
    window.addEventListener('resize', setHeaderHeight)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', setHeaderHeight)
    }
  }, [])

  useEffect(() => {
    const setAppViewportHeight = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight
      document.documentElement.style.setProperty('--app-vh', `${Math.round(viewportHeight)}px`)
    }

    setAppViewportHeight()
    window.addEventListener('resize', setAppViewportHeight)
    window.addEventListener('orientationchange', setAppViewportHeight)
    window.visualViewport?.addEventListener('resize', setAppViewportHeight)
    window.visualViewport?.addEventListener('scroll', setAppViewportHeight)

    return () => {
      window.removeEventListener('resize', setAppViewportHeight)
      window.removeEventListener('orientationchange', setAppViewportHeight)
      window.visualViewport?.removeEventListener('resize', setAppViewportHeight)
      window.visualViewport?.removeEventListener('scroll', setAppViewportHeight)
    }
  }, [])

  return (
    <div className={isInboxPage ? `app-shell--inbox ${isInboxThreadPage ? 'app-shell--inbox-thread' : ''} flex h-[100dvh] min-h-0 flex-col overflow-hidden` : 'min-h-screen flex flex-col'}>
      <Header />
      <main
        className={isInboxPage ? `app-main--inbox h-[100dvh] min-h-0 flex-none overflow-hidden ${isInboxThreadPage ? 'mobile-inbox-thread-main' : ''}` : `relative z-10 flex-1 min-h-0 ${isHeroPage ? 'homepage-main' : ''}`}
        style={{ paddingTop: isHeroPage ? '0px' : 'var(--header-h, 64px)' }}>
        <Outlet />
      </main>
      {!isInboxPage && <Footer isAuthPage={isAuthPage || isBlockedAccount} />}
    </div>
  )
}

function Header() {
  const [open, setOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const close = () => setOpen(false)
  const { pathname, search, hash } = useLocation()
  const { session, account, isAdmin, loading, mfaRequired } = useAccount()
  const canShowPrivateHeader = Boolean(session && account && !mfaRequired)
  const unreadCount = useUnreadCount(session?.user?.id, !loading && canShowPrivateHeader)
  const isServicesActive = pathname.startsWith('/uslugi')
  const isCatalogActive = pathname === '/katalog'
  const isProActive = pathname === '/pro' || pathname === '/totsan-pro'
  const isVisualizationActive = pathname === '/vizualizacia'
  const isInboxPage = pathname === '/inbox' || pathname.startsWith('/inbox/')
  const isInboxThreadPage = /^\/inbox\/[^/?#]+/.test(pathname)
  const isTopOverlayMode = !isScrolled && !open
  const headerSurfaceClass = isTopOverlayMode ? 'site-header--hero' : 'site-header--solid'
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
      <header className={`site-header fixed inset-x-0 top-0 z-20 border-b ${headerSurfaceClass} ${isInboxPage ? 'site-header--inbox' : ''} ${isInboxThreadPage ? 'site-header--inbox-thread' : ''} ${open ? 'site-header--menu-open' : ''} ${isScrolled && !open ? 'site-header--announcement-hidden' : ''}`}>
        <AnnouncementBar />
        <div className="container-header grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-5 py-4 px-4 sm:px-6 lg:px-8 xl:gap-4 2xl:gap-12">
          <Link to="/" className={`brand-logo shrink-0 transition-colors duration-300 ${isTopOverlayMode ? 'text-paper' : 'text-ink'}`} onClick={close}>Totsan</Link>

          <div className="min-w-0 flex justify-center">
            <nav aria-label="Основна навигация" className="hidden min-w-0 xl:flex xl:flex-nowrap xl:items-center xl:gap-1.5 2xl:gap-3">
              {LAYERS.map(l => (
                <NavLink key={l.slug} to={`/sloy/${l.slug}`}
                  className={({ isActive }) => desktopNavClassName(isActive, isTopOverlayMode)}>
                  {l.number} · {headerLayerLabel(l)}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex min-w-0 shrink-0 items-center justify-end gap-2 xl:gap-3">
            <DesktopMoreMenu
              isOpen={isMoreOpen}
              setIsOpen={setIsMoreOpen}
              isHomeHeroMode={isTopOverlayMode}
              isServicesActive={isServicesActive}
              isCatalogActive={isCatalogActive}
              isProActive={isProActive}
              isVisualizationActive={isVisualizationActive}
            />
            {loading ? null : canShowPrivateHeader ? (
              <Link to="/inbox" className={desktopUtilityLinkClassName(isTopOverlayMode)}>
                <MessageCircle size={17} />
                <span className="hidden 2xl:inline">Съобщения</span>
                {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accentDeep px-1.5 text-[11px] font-medium text-paper">{unreadCount}</span>}
              </Link>
            ) : null}
            {loading ? (
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-transparent px-2 py-1.5">
                <div className="h-7 w-7 rounded-full bg-line/50 animate-pulse"></div>
                <div className="hidden xl:block h-4 w-20 bg-line/50 animate-pulse rounded"></div>
              </div>
            ) : canShowPrivateHeader ? (
              <UserMenu session={session} account={account} isAdmin={isAdmin} />
            ) : (
              <>
                <Link to={loginHref} className={`mobile-header-auth xl:hidden ${isTopOverlayMode ? 'mobile-header-auth-on-dark' : ''}`}>Вход</Link>
                <Link to={loginHref} className={`desktop-header-auth ${isTopOverlayMode ? 'desktop-header-auth-on-dark' : ''}`}>Вход</Link>
              </>
            )}
            <button
              aria-label="Меню"
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
              aria-controls="mobile-navigation"
              className={`mobile-menu-toggle xl:hidden ${open ? 'is-open' : ''} ${isTopOverlayMode ? 'mobile-menu-toggle-on-dark' : ''}`}>
              <span className="mobile-menu-toggle__icon mobile-menu-toggle__icon--menu" aria-hidden="true"><Menu size={18} /></span>
              <span className="mobile-menu-toggle__icon mobile-menu-toggle__icon--close" aria-hidden="true"><X size={18} /></span>
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div id="mobile-navigation" className="mobile-nav-shell xl:hidden">
          <div className="mobile-nav-backdrop" aria-hidden="true" />
          <div className="mobile-nav-panel">
            <div className="container-page mobile-nav-scroll px-[var(--pad-x)] pb-8 text-sm">
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
                      <span>{l.number} · {headerLayerLabel(l)}</span>
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
                  <NavLink to="/kontakt" onClick={close} className={({ isActive }) => mobileNavClassName(isActive)}><span>Контакт</span><span className="mobile-nav-arrow">→</span></NavLink>
                </div>
              </div>

              {canShowPrivateHeader && !loading ? (
                <div className="mobile-nav-group">
                  <div className="mobile-nav-group__label">Профил</div>
                  <div className="grid gap-3">
                    {isAdmin && (
                      <NavLink to="/admin" onClick={close} className={({ isActive }) => mobileNavClassName(isActive)}><span>Админ</span><span className="mobile-nav-arrow">→</span></NavLink>
                    )}
                    <NavLink to="/inbox" onClick={close} className={({ isActive }) => mobileNavClassName(isActive)}><span>Съобщения{unreadCount > 0 ? ` (${unreadCount})` : ''}</span><span className="mobile-nav-arrow">→</span></NavLink>
                    <NavLink to="/porachki" onClick={close} className={({ isActive }) => mobileNavClassName(isActive)}><span>Поръчки</span><span className="mobile-nav-arrow">→</span></NavLink>
                    <NavLink to="/moy-profil" onClick={close} className={({ isActive }) => mobileNavClassName(isActive)}><span>Моят профил</span><span className="mobile-nav-arrow">→</span></NavLink>
                    <button onClick={() => { close(); signOutAndRedirect(session?.user?.id) }} className="mobile-nav-item text-left text-muted hover:text-ink">Изход</button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function AnnouncementBar() {
  return (
    <div className="site-announcement" role="status" aria-live="polite">
      <div className="container-header px-4 sm:px-6 lg:px-8">
        <p>
          Изграждаме Totsan стъпка по стъпка. Възможно е някои неща още да се променят. Благодарим, че сте тук в началото.
          <span className="site-announcement__separator" aria-hidden="true">|</span>
          <span>Забелязахте проблем? <Link to="/kontakt">Пишете ни тук.</Link></span>
        </p>
      </div>
    </div>
  )
}

function desktopNavClassName(isActive, onDarkHero = false) {
  return `nav-pill header-layer-pill ${onDarkHero ? 'nav-pill-on-dark' : ''} ${isActive ? 'nav-pill-active' : ''}`
}

function headerLayerLabel(layer) {
  return HEADER_LAYER_LABELS[layer.slug] || layer.title.split(' ')[0]
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

function useUnreadCount(userId, isReady) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId || !isReady) {
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
  }, [userId, isReady])

  return count
}

function UserMenu({ session, account, isAdmin }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const email = session.user.email || ''
  const displayName = getAccountDisplayName(account, session, email)
  const avatarUrl = getAccountAvatar(account, session)

  useEffect(() => {
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div
      ref={ref}
      className="relative hidden sm:block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <Link
        to="/moy-profil"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu"
        className="flex items-center gap-2 rounded-full border border-line bg-paper px-2 py-1.5 text-sm hover:border-ink/40 transition"
      >
        <Avatar src={avatarUrl} name={displayName} size={28} />
        <span className="hidden max-w-[10rem] truncate text-muted xl:inline">{displayName}</span>
      </Link>
      {open && (
        <div className="absolute right-0 top-full pt-2">
          <div id="user-menu" role="menu" className="w-56 rounded-2xl border border-line bg-paper shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-line">
              <div className="text-xs text-muted">Влязъл като</div>
              <div className="text-sm truncate">{displayName}</div>
              {email && <div className="mt-0.5 text-xs text-muted truncate">{email}</div>}
            </div>
            {isAdmin && <Link to="/admin" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-soft">Админ панел</Link>}
            <Link to="/porachki" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-soft">Поръчки</Link>
            <Link to="/moy-profil" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-soft">Моят профил</Link>
            <button onClick={() => { setOpen(false); signOutAndRedirect(session?.user?.id) }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-soft border-t border-line">Изход</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Footer({ isAuthPage = false }) {
  return (
    <footer className={`border-t border-line ${isAuthPage ? 'mt-0' : 'mt-0'}`}>
      <div className="container-page section !py-12 grid gap-10 md:grid-cols-5">
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
            <li><Link to="/kontakt" className="text-muted hover:text-ink">Контакт</Link></li>
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-3">За професионалисти</div>
          <ul className="space-y-1.5 text-sm text-muted">
            <li><Link to="/pro" className="hover:text-ink">Totsan Pro</Link></li>
            <li><Link to="/pro/start" className="hover:text-ink">Стани партньор</Link></li>
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-3">Правни</div>
          <ul className="space-y-1.5 text-sm text-muted">
            <li><Link to="/obshti-usloviya" className="hover:text-ink">Общи условия</Link></li>
            <li><Link to="/politika-za-poveritelnost" className="hover:text-ink">Политика за поверителност</Link></li>
            <li><Link to="/kontakt" className="hover:text-ink">Контакт</Link></li>
            <li><Link to="/pro" className="hover:text-ink">Партньори</Link></li>
            <li><Link to="/kontakt" state={{ routeKey: 'content_report' }} className="hover:text-ink">Сигнал за съдържание</Link></li>
            <li>
              <button type="button" className="text-left hover:text-ink" onClick={openCookieSettings}>
                Настройки за бисквитки
              </button>
            </li>
          </ul>
        </div>
      </div>
      <div className="container-page px-[var(--pad-x)] py-6 text-xs text-muted border-t border-line">
        <span>© {new Date().getFullYear()} Totsan.</span>
      </div>
    </footer>
  )
}
