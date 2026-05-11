import { Outlet, Link, NavLink, useLocation } from 'react-router-dom'
import { LAYERS } from '../data/layers.js'
import { useEffect, useRef, useState } from 'react'
import { Menu, MessageCircle, Volume1, Volume2, VolumeX, X } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { getAccountDisplayName, getAccountInitial, useAccount } from '../lib/account.js'
import { loadUnreadConversationCount, subscribeToConversationList } from '../lib/chat.js'

const MUSIC_TRACKS = [
  '/Music/the_mountain-lofi-lofi-music-496553.mp3',
  '/Music/watermello-lofi-lofi-girl-lofi-chill-484610.mp3',
]

export default function Layout() {
  const { pathname } = useLocation()
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

    scanReveals(document.body)

    const mo = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => scanReveals(node))
      })
    })
    mo.observe(document.body, { childList: true, subtree: true })

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
  const close = () => setOpen(false)
  const { pathname } = useLocation()
  const { session, account, isAdmin } = useAccount()
  const unreadCount = useUnreadCount(session?.user?.id)
  const isHomePage = pathname === '/'
  const isServicesActive = pathname.startsWith('/uslugi') || pathname.startsWith('/usluga/')
  const isCatalogActive = pathname === '/katalog'
  const isHomeHeroMode = isHomePage && !isScrolled && !open

  useEffect(() => {
    setOpen(false)
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
      if (window.innerWidth >= 1024) setOpen(false)
    }

    window.addEventListener('resize', onResize)
    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  return (
    <header className={`${isHomePage ? 'fixed inset-x-0 top-0' : 'sticky top-0'} z-40 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${isHomeHeroMode ? 'border-transparent bg-transparent shadow-none' : 'border-line bg-paper/90 shadow-[0_24px_44px_-36px_rgba(0,0,0,0.5)] backdrop-blur-xl'}`}>
      <div className="container-page flex items-center gap-4 py-4 px-[var(--pad-x)] xl:gap-6">
        <Link to="/" className={`brand-logo shrink-0 transition-colors duration-300 lg:mr-12 xl:mr-16 ${isHomeHeroMode ? 'text-paper [text-shadow:0_10px_28px_rgba(0,0,0,0.48)]' : 'text-ink'}`} onClick={close}>Totsan</Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-2 text-[0.78rem] lg:flex xl:gap-3 xl:text-sm">
          {LAYERS.map(l => (
            <NavLink key={l.slug} to={`/sloy/${l.slug}`}
              className={({isActive}) => desktopNavClassName(isActive, isHomeHeroMode)}>
              {l.number} · {l.title.split(' ')[0]}
            </NavLink>
          ))}
          <span className="nav-divider" aria-hidden="true"></span>
          <NavLink to="/uslugi" className={() => desktopNavClassName(isServicesActive, isHomeHeroMode)}>Услуги</NavLink>
          <NavLink to="/katalog" className={() => desktopNavClassName(isCatalogActive, isHomeHeroMode)}>Каталог</NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {session && <Link to="/inbox" className={desktopUtilityLinkClassName(isHomeHeroMode)}>
            <MessageCircle size={17} />
            <span>Съобщения</span>
            {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accentDeep px-1.5 text-[11px] font-medium text-paper">{unreadCount}</span>}
          </Link>}
          {session ? <UserMenu session={session} account={account} isAdmin={isAdmin} /> : (
            <>
              <Link to="/login" className={`mobile-header-auth ${isHomeHeroMode ? 'mobile-header-auth-on-dark' : ''}`}>Вход</Link>
              <Link to="/login" className={`desktop-header-auth ${isHomeHeroMode ? 'desktop-header-auth-on-dark' : ''}`}>Вход</Link>
            </>
          )}
          <HeaderMusicControl isHomeHeroMode={isHomeHeroMode} />
          <button
            aria-label="Меню"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            className={`mobile-menu-toggle ${open ? 'is-open' : ''} ${isHomeHeroMode ? 'mobile-menu-toggle-on-dark' : ''}`}>
            <span className="mobile-menu-toggle__icon mobile-menu-toggle__icon--menu" aria-hidden="true"><Menu size={18}/></span>
            <span className="mobile-menu-toggle__icon mobile-menu-toggle__icon--close" aria-hidden="true"><X size={18}/></span>
          </button>
        </div>
      </div>

      {open && (
        <div className="mobile-nav-shell lg:hidden">
          <div className="container-page mobile-nav-panel px-[var(--pad-x)] pb-8 pt-5 text-sm">
            <div className="mobile-nav-group">
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
    </header>
  )
}

function desktopNavClassName(isActive, onDarkHero = false) {
  return `nav-pill ${onDarkHero ? 'nav-pill-on-dark' : ''} ${isActive ? 'nav-pill-active' : ''}`
}

function mobileNavClassName(isActive) {
  return `mobile-nav-item ${isActive ? 'mobile-nav-item-active' : ''}`
}

function desktopUtilityLinkClassName(onDarkHero = false) {
  return `desktop-header-utility ${onDarkHero ? 'desktop-header-utility-on-dark' : ''}`
}

function HeaderMusicControl({ isHomeHeroMode = false }) {
  const audioRef = useRef(null)
  const hasPlaybackStartedRef = useRef(false)
  const lastAudibleVolumeRef = useRef(0.42)
  const [trackIndex, setTrackIndex] = useState(0)
  const [volume, setVolume] = useState(() => {
    if (typeof window === 'undefined') return 0.42

    const stored = Number(window.localStorage.getItem('totsan-audio-volume'))
    return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.42
  })
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('totsan-audio-muted') === '1'
  })

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined

    audio.volume = Math.max(0, Math.min(volume, 1))
    audio.muted = isMuted || volume <= 0
    return undefined
  }, [volume, isMuted])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    window.localStorage.setItem('totsan-audio-volume', String(volume))
    window.localStorage.setItem('totsan-audio-muted', isMuted ? '1' : '0')
    return undefined
  }, [volume, isMuted])

  useEffect(() => {
    if (volume > 0) lastAudibleVolumeRef.current = volume
  }, [volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined

    const nextSrc = MUSIC_TRACKS[trackIndex]
    if (!nextSrc) return undefined

    audio.src = nextSrc
    audio.load()
    audio.volume = Math.max(0, Math.min(volume, 1))
    audio.muted = isMuted || volume <= 0

    if (hasPlaybackStartedRef.current) {
      const nextPlay = audio.play()
      if (typeof nextPlay?.catch === 'function') nextPlay.catch(() => {})
    }

    return undefined
  }, [trackIndex])

  useEffect(() => {
    const unlockPlayback = () => {
      const audio = audioRef.current
      if (!audio || hasPlaybackStartedRef.current) return

      hasPlaybackStartedRef.current = true
      const playAttempt = audio.play()
      if (typeof playAttempt?.catch === 'function') playAttempt.catch(() => {})
    }

    window.addEventListener('pointerdown', unlockPlayback, { passive: true, once: true })
    window.addEventListener('keydown', unlockPlayback, { once: true })

    return () => {
      window.removeEventListener('pointerdown', unlockPlayback)
      window.removeEventListener('keydown', unlockPlayback)
    }
  }, [])

  const ensurePlayback = () => {
    const audio = audioRef.current
    if (!audio) return

    hasPlaybackStartedRef.current = true
    const playAttempt = audio.play()
    if (typeof playAttempt?.catch === 'function') playAttempt.catch(() => {})
  }

  const effectiveVolume = isMuted ? 0 : volume
  const volumePercent = Math.round(effectiveVolume * 100)
  const Icon = effectiveVolume <= 0 ? VolumeX : effectiveVolume < 0.58 ? Volume1 : Volume2

  const toggleMute = () => {
    ensurePlayback()

    if (effectiveVolume <= 0) {
      const restoredVolume = lastAudibleVolumeRef.current > 0 ? lastAudibleVolumeRef.current : 0.42
      setVolume(restoredVolume)
      setIsMuted(false)
      return
    }

    setIsMuted(true)
  }

  const handleVolumeChange = (event) => {
    const nextVolume = Number(event.target.value) / 100
    ensurePlayback()

    if (nextVolume <= 0) {
      setVolume(0)
      setIsMuted(true)
      return
    }

    setVolume(nextVolume)
    setIsMuted(false)
  }

  return (
    <div className={`music-control ${isHomeHeroMode ? 'music-control-on-dark' : ''}`}>
      <button
        type="button"
        className="music-control__button"
        onClick={toggleMute}
        aria-label={effectiveVolume <= 0 ? 'Пусни музиката' : 'Спри музиката'}
        title={effectiveVolume <= 0 ? 'Пусни музиката' : 'Спри музиката'}>
        <Icon size={17} />
      </button>

      <div className="music-control__slider-shell">
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={volumePercent}
          onChange={handleVolumeChange}
          className="music-control__slider"
          aria-label="Сила на звука"
        />
      </div>

      <audio
        ref={audioRef}
        preload="auto"
        onEnded={() => {
          setTrackIndex((current) => (current + 1) % MUSIC_TRACKS.length)
        }}
      />
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
        <span className="max-w-[10rem] truncate text-muted">{displayName}</span>
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
            <li><Link to="/login?signup=true" className="hover:text-ink">Стани партньор</Link></li>
            <li><Link to="/login" className="hover:text-ink">За професионалисти</Link></li>
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
