import { Outlet, Link, NavLink, useLocation } from 'react-router-dom'
import { LAYERS } from '../data/layers.js'
import { useEffect, useRef, useState } from 'react'
import { Menu, MessageCircle, X } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { getAccountDisplayName, getAccountInitial, useAccount } from '../lib/account.js'
import { loadUnreadConversationCount, subscribeToConversationList } from '../lib/chat.js'

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
  const close = () => setOpen(false)
  const { session, account, isAdmin } = useAccount()
  const unreadCount = useUnreadCount(session?.user?.id)

  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-paper/85 border-b border-line">
      <div className="container-page flex items-center justify-between py-4 px-[var(--pad-x)]">
        <Link to="/" className="font-display text-2xl tracking-tight" onClick={close}>Totsan</Link>

        <nav className="hidden lg:flex items-center gap-7 text-sm">
          {LAYERS.map(l => (
            <NavLink key={l.slug} to={`/sloy/${l.slug}`}
              className={({isActive}) => `text-muted hover:text-ink transition ${isActive ? '!text-ink' : ''}`}>
              {l.number} · {l.title.split(' ')[0]}
            </NavLink>
          ))}
          <span className="w-px h-4 bg-line"></span>
          <NavLink to="/uslugi" className={({isActive}) => `text-muted hover:text-ink transition ${isActive ? '!text-ink' : ''}`}>Услуги</NavLink>
          <NavLink to="/katalog" className={({isActive}) => `text-muted hover:text-ink transition ${isActive ? '!text-ink' : ''}`}>Каталог</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          {session && <Link to="/inbox" className="relative hidden items-center gap-2 rounded-full border border-line bg-paper px-3 py-2 text-sm text-muted transition hover:border-ink/40 hover:text-ink sm:inline-flex">
            <MessageCircle size={17} />
            <span>Съобщения</span>
            {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accentDeep px-1.5 text-[11px] font-medium text-paper">{unreadCount}</span>}
          </Link>}
          {session ? <UserMenu session={session} account={account} isAdmin={isAdmin} /> : (
            <Link to="/login" className="btn btn-primary text-sm hidden sm:inline-flex">Вход</Link>
          )}
          <button
            aria-label="Меню"
            onClick={() => setOpen(o => !o)}
            className="lg:hidden btn btn-ghost text-sm !px-3 !py-2">
            {open ? <X size={18}/> : <Menu size={18}/>}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-line bg-paper">
          <div className="container-page px-[var(--pad-x)] py-5 grid gap-2 text-sm">
            {LAYERS.map(l => (
              <NavLink key={l.slug} to={`/sloy/${l.slug}`} onClick={close} className="py-2 border-b border-line/60 flex justify-between">
                <span>{l.number} · {l.title}</span><span className="text-muted">→</span>
              </NavLink>
            ))}
            <NavLink to="/uslugi" onClick={close} className="py-2 border-b border-line/60 flex justify-between"><span>Услуги</span><span className="text-muted">→</span></NavLink>
            <NavLink to="/katalog" onClick={close} className="py-2 border-b border-line/60 flex justify-between"><span>Каталог</span><span className="text-muted">→</span></NavLink>
            <NavLink to="/kak-raboti" onClick={close} className="py-2 border-b border-line/60 flex justify-between"><span>Как работи Totsan</span><span className="text-muted">→</span></NavLink>
            <NavLink to="/za-nas" onClick={close} className="py-2 border-b border-line/60 flex justify-between"><span>За нас</span><span className="text-muted">→</span></NavLink>
            <NavLink to="/contact" onClick={close} className="py-2 border-b border-line/60 flex justify-between"><span>Контакт</span><span className="text-muted">→</span></NavLink>
            {session ? (
              <>
                {isAdmin && (
                  <NavLink to="/admin" onClick={close} className="py-2 border-b border-line/60 flex justify-between"><span>Админ</span><span className="text-muted">→</span></NavLink>
                )}
                <NavLink to="/inbox" onClick={close} className="py-2 border-b border-line/60 flex justify-between"><span>Съобщения{unreadCount > 0 ? ` (${unreadCount})` : ''}</span><span className="text-muted">→</span></NavLink>
                <NavLink to="/porachki" onClick={close} className="py-2 border-b border-line/60 flex justify-between"><span>Поръчки</span><span className="text-muted">→</span></NavLink>
                <NavLink to="/moy-profil" onClick={close} className="py-2 border-b border-line/60 flex justify-between"><span>Моят профил</span><span className="text-muted">→</span></NavLink>
                <button onClick={() => { close(); supabase.auth.signOut() }} className="py-2 text-left text-muted">Изход</button>
              </>
            ) : (
              <NavLink to="/login" onClick={close} className="py-2 flex justify-between"><span>Вход / Регистрация</span><span className="text-muted">→</span></NavLink>
            )}
          </div>
        </div>
      )}
    </header>
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
