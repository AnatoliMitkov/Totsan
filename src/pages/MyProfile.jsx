import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Activity, AlertTriangle, CalendarDays, Camera, ClipboardList, FolderKanban, Home, Lock, LogOut, Mail, MessageCircle, ShieldCheck, Settings2, UserRound, Users, X } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { getAccountDisplayName, useAccount, signOutAndRedirect } from '../lib/account.js'
import { uploadProfileCover, uploadProfileMedia } from '../lib/profile-media-upload-client.js'
import { LAYERS } from '../data/layers.js'
import CustomerHeader from '../components/profile/CustomerHeader.jsx'
import CustomerOverview from '../components/profile/CustomerOverview.jsx'
import CustomerPersonal from '../components/profile/CustomerPersonal.jsx'
import CustomerPreferences from '../components/profile/CustomerPreferences.jsx'
import CustomerProject from '../components/profile/CustomerProject.jsx'
import CompletenessBar from '../components/profile/CompletenessBar.jsx'
import ImageCropperModal from '../components/profile/ImageCropperModal.jsx'
import PartnerProfileWorkspace from '../components/profile/PartnerProfileWorkspace.jsx'
import PublicProfileBanner from '../components/profile/PublicProfileBanner.jsx'
import Avatar from '../components/Avatar.jsx'
import TotpMfaManager from '../components/auth/TotpMfa.jsx'
import TotsanSelect from '../components/ui/TotsanSelect.jsx'
import {
  calculateClientProfileCompleteness,
  deactivateClientProject,
  deleteClientProjectMedia,
  loadActiveClientProject,
  saveActiveClientProject,
  saveCustomerAccountProfile,
  updateClientProjectMedia,
  uploadClientProjectMedia,
} from '../lib/projects.js'
import {
  getProfileImageStyle,
  normalizeProfile,
  runProfileSelectWithLayer01Fallback,
  slugify,
} from '../lib/profiles.js'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'
const MAX_BANNER_BYTES = 12 * 1024 * 1024
const BANNER_RATIO_TEXT = 'Препоръчителен размер: 1600 x 520 px'
const BANNER_DESCRIPTION = 'Широк банер работи най-добре около 3:1. Препоръчваме 1600 x 520 px за най-чист резултат.'

const CUSTOMER_TABS = [
  { id: 'overview', label: 'Преглед', icon: Home },
  { id: 'personal', label: 'Лични данни', icon: UserRound },
  { id: 'preferences', label: 'Предпочитания', icon: Settings2 },
  { id: 'project', label: 'Моят проект', icon: FolderKanban },
  { id: 'activity', label: 'Активност', icon: Activity },
  { id: 'security', label: 'Сигурност', icon: Lock },
]

const MAX_AVATAR_BYTES = 10 * 1024 * 1024
function validateAvatarFile(file) {
  if (!file) return 'Липсва файл.'
  if (!file.type.startsWith('image/')) return 'Моля, избери изображение.'
  if (file.size > MAX_AVATAR_BYTES) return 'Снимката трябва да е до 10 MB.'
  return ''
}

function withCacheBust(url) {
  if (!url) return ''
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}v=${Date.now()}`
}

function stripCacheBust(url) {
  if (!url) return ''

  try {
    const parsed = new URL(url)
    parsed.searchParams.delete('v')
    return parsed.toString()
  } catch {
    return url.replace(/([?&])v=\d+(&?)/, (_, prefix, suffix) => {
      if (prefix === '?' && suffix) return '?'
      return suffix ? prefix : ''
    }).replace(/[?&]$/, '')
  }
}

function validateBannerFile(file) {
  if (!file) return 'Липсва файл.'
  if (!file.type.startsWith('image/')) return 'Моля, избери изображение за банера.'
  if (file.size > MAX_BANNER_BYTES) return 'Банерът трябва да е до 12 MB.'
  return ''
}

function buildAccountSavePayload(account, values = {}) {
  return {
    fullName: values.fullName ?? account?.full_name ?? '',
    displayName: values.displayName ?? account?.display_name ?? '',
    phone: values.phone ?? account?.phone ?? '',
    avatarUrl: values.avatarUrl ?? stripCacheBust(account?.avatar_url || ''),
    coverUrl: values.coverUrl ?? stripCacheBust(account?.cover_url || ''),
    city: values.city ?? account?.city ?? '',
    country: values.country ?? account?.country ?? 'BG',
    bio: values.bio ?? account?.bio ?? '',
    locale: values.locale ?? account?.locale ?? 'bg',
    marketingOptIn: values.marketingOptIn ?? Boolean(account?.marketing_opt_in),
    interests: Array.isArray(values.interests) ? values.interests : (Array.isArray(account?.interests) ? account.interests : []),
    stylePreferences: Array.isArray(values.stylePreferences) ? values.stylePreferences : (Array.isArray(account?.style_preferences) ? account.style_preferences : []),
    preferredContactMethod: values.preferredContactMethod ?? account?.preferred_contact_method ?? '',
    ageGroup: values.ageGroup ?? account?.age_group ?? '',
    gender: values.gender ?? account?.gender ?? '',
  }
}

export default function MyProfile() {
  const { session, account, loading, refresh } = useAccount()
  const [searchParams] = useSearchParams()

  if (loading) {
    return <div className="section"><div className="container-page text-muted">Зареждане…</div></div>
  }

  if (!session) {
    const fromQuiz = searchParams.get('from') === 'quiz'
    return (
      <section className="section">
        <div className="container-page max-w-xl">
          <h1 className="h-section">Моят профил</h1>
          <p className="text-muted mt-3">
            {fromQuiz ? 'Резултатът от quiz-а е подготвен за проект-паспорт. Влез в акаунта си, за да го прегледаш и запазиш.' : 'За да видиш профила си, трябва първо да влезеш в акаунта си.'}
          </p>
          <Link to="/login" className="btn btn-primary mt-6 inline-flex">Вход</Link>
        </div>
      </section>
    )
  }

  if (account?.role === 'admin') {
    return <AdminProfile session={session} account={account} />
  }

  if (account?.role === 'specialist') {
    return <ProEditor session={session} account={account} refreshAccount={refresh} />
  }

  return <CustomerProfile session={session} account={account} refreshAccount={refresh} />
}

function AdminProfile({ session, account }) {
  const [dangerOpen, setDangerOpen] = useState(false)
  const displayName = getAccountDisplayName(account, session, 'Администратор')
  const email = account?.email || session?.user?.email || ''
  const createdAt = account?.created_at ? new Date(account.created_at).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Не е налично'
  const accountStatus = account?.account_status || 'active'

  const shortcuts = [
    { to: '/admin', label: 'Админ панел', description: 'Основен административен преглед.', icon: ShieldCheck },
    { to: '/admin#users', label: 'Потребители', description: 'Акаунти, роли и статуси.', icon: Users },
    { to: '/admin#applications', label: 'Кандидатури', description: 'Партньорски заявки и проверки.', icon: ClipboardList },
    { to: '/inbox', label: 'Съобщения', description: 'Разговори, достъпни за акаунта.', icon: MessageCircle },
  ]

  return (
    <section className="min-h-[calc(100dvh-var(--header-h,0px))] bg-soft py-8 md:py-10">
      <div className="container-page space-y-6">
        <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-paper/85 shadow-[0_22px_70px_rgba(13,35,64,0.08)] backdrop-blur">
          <div className="relative p-6 md:p-8">
            <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(135deg,rgba(217,230,244,0.9),rgba(255,255,255,0))]" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                <Avatar src={account?.avatar_url || ''} name={displayName} size={104} className="border-4 border-paper shadow-md" />
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-line bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                    <ShieldCheck size={14} />
                    Вътрешен акаунт
                  </div>
                  <h1 className="mt-3 break-words font-display text-[clamp(2.25rem,8vw,3rem)] leading-[0.95] text-ink md:text-5xl">{displayName}</h1>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted">
                    {email && <span className="inline-flex items-center gap-1.5 rounded-full bg-soft px-3 py-1"><Mail size={14} />{email}</span>}
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-soft px-3 py-1"><CalendarDays size={14} />{createdAt}</span>
                  </div>
                </div>
              </div>
              <button type="button" className="btn btn-ghost w-full justify-center self-start sm:w-auto lg:self-auto" onClick={() => signOutAndRedirect(session?.user?.id)}>
                <LogOut size={18} />
                Изход
              </button>
            </div>

            <div className="relative mt-7 grid gap-3 md:grid-cols-3">
              <InfoPill label="Роля" value="Админ" />
              <InfoPill label="Статус" value={accountStatus} />
              <InfoPill label="Профил" value="Не е публичен" />
            </div>

            <div className="relative mt-5 rounded-2xl border border-line bg-soft/70 p-4 text-sm leading-6 text-muted">
              Това е вътрешен администраторски акаунт. Той не е публичен профил в каталога.
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <main className="space-y-6">
            <section className="rounded-[2rem] border border-line bg-paper p-5 shadow-[0_12px_40px_rgba(13,35,64,0.04)] md:p-7">
              <div className="eyebrow">Бърз достъп</div>
              <h2 className="mt-2 font-display text-3xl text-ink">Административни инструменти</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {shortcuts.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link key={item.to} to={item.to} className="group rounded-3xl border border-line bg-soft/70 p-5 transition hover:-translate-y-0.5 hover:border-ink/30 hover:bg-paper hover:shadow-[0_14px_34px_rgba(13,35,64,0.07)]">
                      <div className="flex items-start gap-4">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-paper text-accentDeep shadow-sm transition group-hover:bg-ink group-hover:text-paper">
                          <Icon size={21} />
                        </span>
                        <span>
                          <span className="block font-medium text-ink">{item.label}</span>
                          <span className="mt-1 block text-sm leading-5 text-muted">{item.description}</span>
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>

            <section className="rounded-[2rem] border border-line bg-paper p-5 shadow-[0_12px_40px_rgba(13,35,64,0.04)] md:p-7">
              <div className="eyebrow">Сигурност</div>
              <h2 className="mt-2 font-display text-3xl text-ink">Защита на акаунта</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Управлението на многофакторна автентикация използва съществуващия защитен поток на Totsan.
              </p>
              <div className="mt-5">
                <TotpMfaManager session={session} />
              </div>
            </section>
          </main>

          <aside className="space-y-6 lg:sticky lg:top-24">
            <section className="rounded-[2rem] border border-red-100 bg-red-50/80 p-5 shadow-[0_12px_40px_rgba(127,29,29,0.05)] md:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-red-700 shadow-sm">
                  <AlertTriangle size={22} />
                </span>
                <div>
                  <div className="eyebrow text-red-800">Опасна зона</div>
                  <h2 className="font-display text-2xl text-red-950">Опасна зона</h2>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-red-950/75">
                Тези действия могат да засегнат достъпа до акаунта и административните права.
              </p>
              <button type="button" onClick={() => setDangerOpen(true)} className="btn mt-5 w-full justify-center border-red-200 bg-white text-red-800 hover:border-red-300 hover:bg-red-50">
                Заяви промяна или деактивация
              </button>
            </section>
          </aside>
        </div>
      </div>

      {dangerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-line bg-paper p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow text-red-800">Опасна зона</div>
                <h2 className="mt-2 font-display text-3xl text-ink">Допълнителна проверка</h2>
              </div>
              <button type="button" onClick={() => setDangerOpen(false)} className="rounded-full p-2 text-muted transition hover:bg-soft hover:text-ink" aria-label="Затвори">
                <X size={20} />
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted">
              Промени по администраторски акаунт се извършват само след допълнителна проверка.
            </p>
            <button type="button" onClick={() => setDangerOpen(false)} className="btn btn-primary mt-6 w-full justify-center">
              Разбрах
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-white/65 p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 font-medium text-ink">{value}</div>
    </div>
  )
}

function CustomerProfile({ session, account, refreshAccount }) {
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState('profile')
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') === 'project' ? 'project' : 'overview')
  const [localAccount, setLocalAccount] = useState(account)
  const [project, setProject] = useState(null)
  const [pendingBrief, setPendingBrief] = useState(null)
  const [media, setMedia] = useState([])
  const [loadState, setLoadState] = useState({ status: 'loading', message: '' })
  const [bannerEditor, setBannerEditor] = useState({ open: false, file: null, imageUrl: '', fileName: 'banner.jpg' })
  const [avatarEditor, setAvatarEditor] = useState({ open: false, file: null, imageUrl: '', fileName: 'avatar.jpg' })
  const email = session.user.email || account?.email || ''
  const userId = session.user.id
  const displayName = getAccountDisplayName(localAccount, session, 'приятел')
  const isAdmin = localAccount?.role === 'admin'

  useEffect(() => {
    setLocalAccount(account)
  }, [account])

  useEffect(() => {
    if (searchParams.get('tab') === 'project') setActiveTab('project')
  }, [searchParams])

  useEffect(() => {
    const raw = window.localStorage.getItem('totsan.pendingProjectBrief')
    if (!raw) return

    try {
      setPendingBrief(JSON.parse(raw))
    } catch {
      window.localStorage.removeItem('totsan.pendingProjectBrief')
    }
  }, [])

  const clearPendingBrief = useCallback(() => {
    window.localStorage.removeItem('totsan.pendingProjectBrief')
    setPendingBrief(null)
  }, [])

  useEffect(() => {
    let active = true
    async function loadProject() {
      setLoadState({ status: 'loading', message: '' })
      try {
        const data = await loadActiveClientProject(userId)
        if (!active) return
        setProject(data.project)
        setMedia(data.media)
        setLoadState({ status: 'ready', message: '' })
      } catch (error) {
        if (!active) return
        setLoadState({ status: 'error', message: error.message || 'Проектът не успя да зареди.' })
      }
    }
    loadProject()
    return () => { active = false }
  }, [userId])

  const completeness = useMemo(() => calculateClientProfileCompleteness({
    account: localAccount,
    session,
    project,
    media,
  }), [localAccount, session, project, media])

  async function savePersonal(values) {
    const savedAccount = await saveCustomerAccountProfile(buildAccountSavePayload(localAccount, values))
    const nextAccount = {
      ...savedAccount,
      avatar_url: savedAccount?.avatar_url ? withCacheBust(savedAccount.avatar_url) : '',
      cover_url: savedAccount?.cover_url ? withCacheBust(savedAccount.cover_url) : '',
    }
    await refreshAccount?.()
    setLocalAccount(nextAccount)
    return savedAccount
  }

  async function uploadAvatar(file) {
    const result = await uploadProfileMedia({ file, target: userId })
    return result.publicUrl
  }

  function openAvatarEditor() {
    if (localAccount?.avatar_url) {
      setAvatarEditor({
        open: true,
        file: null,
        imageUrl: stripCacheBust(localAccount.avatar_url),
        fileName: displayName ? `${displayName}-avatar.jpg` : 'avatar.jpg',
      })
      return
    }

    const input = document.getElementById('customer-avatar-upload')
    if (input) input.click()
  }

  function closeAvatarEditor() {
    setAvatarEditor(current => ({ ...current, open: false }))
  }

  function handleAvatarFile(file) {
    const error = validateAvatarFile(file)
    if (error) {
      setLoadState({ status: 'error', message: error })
      return
    }

    setAvatarEditor({
      open: true,
      file,
      imageUrl: '',
      fileName: file.name || 'avatar.jpg',
    })
  }

  async function saveAvatar(croppedFile) {
    setLoadState({ status: 'loading', message: 'Запазваме снимката…' })
    try {
      const avatarUrl = await uploadAvatar(croppedFile)
      await savePersonal({ avatarUrl })
      setLoadState({ status: 'ready', message: 'Снимката е запазена успешно.' })
    } catch (error) {
      setLoadState({ status: 'error', message: error.message || 'Снимката не успя да се запази.' })
      throw error
    }
  }

  function openBannerEditor() {
    if (localAccount?.cover_url) {
      setBannerEditor({
        open: true,
        file: null,
        imageUrl: stripCacheBust(localAccount.cover_url),
        fileName: displayName ? `${displayName}-banner.jpg` : 'banner.jpg',
      })
      return
    }

    const input = document.getElementById('customer-banner-upload')
    if (input) input.click()
  }

  function closeBannerEditor() {
    setBannerEditor(current => ({ ...current, open: false }))
  }

  function handleBannerFile(file) {
    const error = validateBannerFile(file)
    if (error) {
      setLoadState({ status: 'error', message: error })
      return
    }

    setBannerEditor({
      open: true,
      file,
      imageUrl: '',
      fileName: file.name || 'banner.jpg',
    })
  }

  async function saveBanner(croppedFile) {
    try {
      const result = await uploadProfileCover({ file: croppedFile, target: userId })
      const coverUrl = result.publicUrl
      const savedAccount = await saveCustomerAccountProfile(buildAccountSavePayload(localAccount, { coverUrl }))

      const nextAccount = {
        ...savedAccount,
        avatar_url: savedAccount?.avatar_url ? withCacheBust(savedAccount.avatar_url) : '',
        cover_url: coverUrl ? withCacheBust(coverUrl) : '',
      }

      await refreshAccount?.()
      setLocalAccount(nextAccount)
    } catch (error) {
      setLoadState({ status: 'error', message: error.message || 'Банерът не успя да се запази.' })
      throw error
    }
  }

  async function saveProject(projectDraft, options = {}) {
    let existingId = projectDraft.id || project?.id || ''
    if (options.createNew) {
      if (existingId) {
        await deactivateClientProject(existingId, userId)
      }
      existingId = ''
      projectDraft = { ...projectDraft, id: '' }
    }
    const savedProject = await saveActiveClientProject(userId, projectDraft, existingId)
    setProject(savedProject)
    return savedProject
  }

  async function uploadProjectMediaRow({ file, projectId, kind, caption, orderIndex }) {
    const nextMedia = await uploadClientProjectMedia({ file, userId, projectId, kind, caption, orderIndex })
    setMedia(current => [...current, nextMedia])
    return nextMedia
  }

  async function updateProjectMediaRow(mediaId, updates) {
    const updated = await updateClientProjectMedia(mediaId, updates)
    setMedia(current => current.map(item => item.id === mediaId ? { ...item, ...updated, url: updated.url || item.url, signedUrl: updated.signedUrl || item.signedUrl } : item))
    return updated
  }

  async function deleteProjectMediaRow(mediaId) {
    await deleteClientProjectMedia(mediaId)
    setMedia(current => current.filter(item => item.id !== mediaId))
  }

  if (mode === 'application') {
    return (
      <CenteredCard title="Стани партньор">
        <p className="text-muted mt-3">Попълни кратка заявка и ще я прегледаме от админ панела.</p>
        <ApplicationForm userId={userId} email={email} initialName={displayName} onCreated={() => setMode('sent')} />
      </CenteredCard>
    )
  }

  if (mode === 'sent') {
    return (
      <CenteredCard title="Заявката е изпратена">
        <p className="text-muted mt-3">Ще я прегледаме и след одобрение тук ще се появи редакторът на професионалния ти профил.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={() => setMode('overview')}>Към профила</button>
          <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Изход</button>
        </div>
      </CenteredCard>
    )
  }

  return (
    <>
      <PublicProfileBanner
        imageSrc={localAccount?.cover_url || ''}
        imageAlt={displayName}
        heightClass="min-h-[clamp(14rem,46vw,18rem)] sm:min-h-[16rem] md:aspect-[1600/520] md:min-h-0"
        className="group cursor-pointer focus-within:ring-2 focus-within:ring-ink"
        onClick={openBannerEditor}
        placeholderLabel="Добавете банер"
        placeholderClassName="hidden md:grid"
      >
        <div className="absolute right-3 top-3 z-20 md:hidden">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openBannerEditor() }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-paper/88 text-ink shadow-sm backdrop-blur transition hover:bg-paper"
            aria-label={localAccount?.cover_url ? 'Смени банер' : 'Добавете банер'}
          >
            <Camera size={18} />
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 hidden pointer-events-none md:block">
          <div className="container-page flex justify-end px-6 pb-6 pt-0">
            <div className="w-auto max-w-xs rounded-3xl border border-white/30 bg-ink/55 p-3 text-paper shadow-lg backdrop-blur-sm transition-all duration-300 pointer-events-auto translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <div className="text-sm font-medium">Снимка на банера</div>
              <p className="mt-1 text-[11px] leading-4 text-paper/85 sm:text-xs">{BANNER_RATIO_TEXT}</p>
              <button type="button" onClick={(e) => { e.stopPropagation(); openBannerEditor(); }} className="btn mt-3 w-full justify-center border-0 bg-white/90 text-ink hover:bg-white">
                <Camera size={18} />
                {localAccount?.cover_url ? 'Смени банер' : 'Добавете банер'}
              </button>
            </div>
          </div>
        </div>
      </PublicProfileBanner>
      <div className="relative z-10 flex flex-col bg-soft pb-16 md:pb-24">
        <div className="container-page -mt-10 w-full space-y-5 px-4 sm:-mt-12 md:-mt-24 md:px-6">
        <CustomerHeader account={localAccount} displayName={displayName} completeness={completeness} onEditAvatar={openAvatarEditor} onSignOut={() => signOutAndRedirect(session?.user?.id)} />

        <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
          <aside className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-line bg-paper p-3 shadow-[0_8px_30px_rgb(0,0,0,0.02)] lg:sticky lg:top-24 lg:overflow-visible">
            <nav className="flex w-full min-w-0 max-w-full gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:overflow-visible lg:pb-0">
              {CUSTOMER_TABS.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex min-h-11 shrink-0 snap-start items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm font-medium transition lg:w-full ${isActive ? 'bg-ink text-paper shadow-sm' : 'text-muted hover:bg-soft hover:text-ink'}`}
                  >
                    <Icon size={18} />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
              <button type="button" onClick={() => setMode('application')} className="mt-2 inline-flex min-h-11 shrink-0 snap-start items-center justify-center rounded-2xl border border-line px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ink lg:w-full">
                Стани партньор
              </button>
            </nav>
            <div className="mt-3 hidden border-t border-line pt-4 lg:block">
              <div className="px-2">
                <div className="text-xs uppercase tracking-[0.14em] text-muted">Попълване</div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="font-display text-4xl leading-none text-ink">{completeness.percent}%</div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-soft">
                  <div className="h-full rounded-full bg-accentDeep" style={{ width: `${completeness.percent}%` }} />
                </div>
              </div>
            </div>
          </aside>

          <main className="min-w-0 space-y-5">
            {loadState.status === 'error' && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadState.message}</div>
            )}

            {loadState.status === 'loading' && (
              <div className="rounded-2xl border border-line bg-paper p-5 text-sm text-muted">Зареждаме проекта…</div>
            )}

            {activeTab === 'overview' && (
              <CustomerOverview
                account={localAccount}
                project={project}
                media={media}
                completeness={completeness}
                isAdmin={isAdmin}
                onSelectTab={setActiveTab}
                onToggleShare={async (isShareable) => {
                  if (!project?.id) return
                  try {
                    const { toggleClientProjectShare } = await import('../lib/projects.js')
                    const data = await toggleClientProjectShare(session.user.id, project.id, isShareable)
                    setProject(prev => ({ ...prev, isShareable: data.is_shareable, publicShareId: data.public_share_id }))
                  } catch (e) {
                    console.error(e)
                    alert('Грешка при споделяне на профила.')
                  }
                }}
              />
            )}

            {activeTab === 'personal' && (
              <CustomerPersonal
                account={localAccount}
                session={session}
                onSave={savePersonal}
              />
            )}

            {activeTab === 'preferences' && (
              <CustomerPreferences
                account={localAccount}
                session={session}
                onSave={savePersonal}
              />
            )}

            {activeTab === 'project' && (
              <CustomerProject
                project={project}
                pendingBrief={loadState.status === 'ready' ? pendingBrief : null}
                media={media}
                onSave={saveProject}
                onImportPendingBrief={clearPendingBrief}
                onUploadMedia={uploadProjectMediaRow}
                onUpdateMedia={updateProjectMediaRow}
                onDeleteMedia={deleteProjectMediaRow}
              />
            )}

            {activeTab === 'activity' && <CustomerActivity account={localAccount} completeness={completeness} />}
            {activeTab === 'security' && (
              <div className="space-y-5">
                <TotpMfaManager session={session} />
              </div>
            )}
          </main>
        </div>
        </div>
      </div>

      <input
        id="customer-banner-upload"
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) handleBannerFile(file)
        }}
      />

      <input
        id="customer-avatar-upload"
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) handleAvatarFile(file)
        }}
      />

      {bannerEditor.open && (
        <ImageCropperModal
          file={bannerEditor.file}
          imageUrl={bannerEditor.imageUrl}
          initialFileName={bannerEditor.fileName}
          title="Редактирай банера"
          description={BANNER_DESCRIPTION}
          aspect={1600 / 520}
          cropShape="rect"
          objectFit="horizontal-cover"
          outputWidth={1600}
          outputHeight={520}
          minZoom={1}
          maxZoom={4}
          zoomStep={0.05}
          previewClassName="w-full rounded-2xl relative"
          previewStyle={{ aspectRatio: '1600 / 520' }}
          previewImageClassName="absolute inset-0 h-full w-full object-cover"
          emptyStateLabel="Качи банер, за да го позиционираш."
          onClose={closeBannerEditor}
          onSelectFile={async (file) => {
            const error = validateBannerFile(file)
            if (error) {
              setLoadState({ status: 'error', message: error })
              return
            }

            setBannerEditor({
              open: true,
              file,
              imageUrl: '',
              fileName: file.name || 'banner.jpg',
            })
          }}
          onCropSave={saveBanner}
        />
      )}

      {avatarEditor.open && (
        <ImageCropperModal
          file={avatarEditor.file}
          imageUrl={avatarEditor.imageUrl}
          initialFileName={avatarEditor.fileName}
          title="Редактирай снимка"
          description="Премести снимката и виж как ще изглежда като аватар."
          aspect={1}
          cropShape="round"
          outputWidth={512}
          outputHeight={512}
          previewClassName="h-36 w-36 rounded-full"
          previewImageClassName="h-full w-full object-cover"
          emptyStateLabel="Качи снимка, за да я позиционираш."
          onClose={closeAvatarEditor}
          onSelectFile={async (file) => {
            const error = validateAvatarFile(file)
            if (error) {
              setLoadState({ status: 'error', message: error })
              return
            }

            setAvatarEditor({
              open: true,
              file,
              imageUrl: '',
              fileName: file.name || 'avatar.jpg',
            })
          }}
          onCropSave={saveAvatar}
        />
      )}
    </>
  )
}

function CustomerActivity({ account, completeness }) {
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-8 rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="eyebrow">Активност</div>
        <h2 className="mt-2 font-display text-3xl text-ink">История на профила</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ActivityTile label="Регистриран" value={account?.created_at ? new Date(account.created_at).toLocaleDateString('bg-BG') : 'Скоро'} />
          <ActivityTile label="Запитвания" value="Скоро" />
          <ActivityTile label="Активни разговори" value="Скоро" />
        </div>
      </div>
      <aside className="lg:col-span-4">
        <CompletenessBar completeness={completeness} />
      </aside>
    </div>
  )
}

function ActivityTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-soft p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 font-medium text-ink">{value}</div>
    </div>
  )
}

function ProEditor({ session, account, refreshAccount }) {
  const userId = session.user.id
  const email = session.user.email
  const displayName = getAccountDisplayName(account, session, email?.split('@')[0] || '')

  const [status, setStatus] = useState('loading') // loading | needs_application | pending | ready | error
  const [profile, setProfile] = useState(null)
  const [application, setApplication] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setStatus('loading')
    setError('')

    const [profRes, appRes] = await Promise.all([
      runProfileSelectWithLayer01Fallback((columns) => (
        supabase.from('profiles').select(columns).eq('user_id', userId).maybeSingle()
      )),
      supabase.from('partner_applications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    if (profRes.error && profRes.error.code !== 'PGRST116') {
      setError(profRes.error.message)
      setStatus('error')
      return
    }

    if (profRes.data) {
      setProfile(normalizeProfile(profRes.data))
      setStatus('ready')
      return
    }

    if (appRes.data) {
      setApplication(appRes.data)
      setStatus(appRes.data.status === 'rejected' ? 'rejected' : 'pending')
      return
    }

    setStatus('needs_application')
  }

  if (status === 'loading') {
    return <div className="section"><div className="container-page text-muted">Зареждане…</div></div>
  }

  if (status === 'error') {
    return (
      <section className="section">
        <div className="container-page max-w-xl">
          <h1 className="h-section">Моят профил</h1>
          <p className="text-red-700 text-sm mt-4">{error}</p>
        </div>
      </section>
    )
  }

  if (status === 'needs_application') {
    return <Navigate to="/pro/onboarding" replace />
  }

  if (status === 'pending') {
    return (
      <CenteredCard title="Заявката ти се преглежда">
        <p className="text-muted mt-3">Получихме регистрацията ти{application?.created_at ? ` на ${new Date(application.created_at).toLocaleDateString('bg-BG')}` : ''}. Ще те уведомим веднага щом профилът е активиран.</p>
        <div className="mt-6 flex gap-2">
          <Link to="/" className="btn btn-ghost">Към сайта</Link>
          <button className="btn btn-primary" onClick={() => signOutAndRedirect(session?.user?.id)}>Изход</button>
        </div>
      </CenteredCard>
    )
  }

  if (status === 'rejected') {
    return (
      <CenteredCard title="Заявката не е одобрена">
        <p className="text-muted mt-3">За съжаление в момента не можем да активираме профил за този акаунт.{application?.decision_note ? ` Бележка: ${application.decision_note}` : ''}</p>
        <div className="mt-6 flex gap-2">
          <Link to="/contact" className="btn btn-ghost">Свържи се с нас</Link>
          <button className="btn btn-primary" onClick={() => signOutAndRedirect(session?.user?.id)}>Изход</button>
        </div>
      </CenteredCard>
    )
  }

  if (!profile?.id) {
    return (
      <section className="section">
        <div className="container-page max-w-xl">
          <h1 className="h-section">My Profile</h1>
          <p className="text-muted mt-3">Loading your partner profile...</p>
        </div>
      </section>
    )
  }

  return <PartnerProfileWorkspace profile={profile} userId={userId} account={account} session={session} refreshAccount={refreshAccount} onSaved={load} />
}

function CenteredCard({ title, children }) {
  return (
    <section className="section">
      <div className="container-page max-w-xl">
        <div className="rounded-3xl border border-line bg-paper p-8">
          <h1 className="h-section">{title}</h1>
          {children}
        </div>
      </div>
    </section>
  )
}

function ApplicationForm({ userId, email, initialName = '', onCreated }) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState('')
  const [layerSlug, setLayerSlug] = useState(LAYERS[0]?.slug || '')
  const [about, setAbout] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await supabase.from('partner_applications').insert({
      name: name.trim(),
      email,
      phone: phone.trim() || null,
      layer_slug: layerSlug,
      about: about.trim() || null,
      user_id: userId,
      role: 'pro',
      status: 'pending',
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    onCreated?.()
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block text-sm font-medium text-ink">Име / фирма<input value={name} onChange={e => setName(e.target.value)} required className={INPUT} /></label>
      <label className="block text-sm font-medium text-ink">Телефон<input value={phone} onChange={e => setPhone(e.target.value)} type="tel" className={INPUT} /></label>
      <TotsanSelect label="В кой слой работиш" value={layerSlug} onChange={setLayerSlug} options={LAYERS.map(l => ({ value: l.slug, label: `Слой ${l.number} · ${l.title}` }))} />
      <label className="block text-sm font-medium text-ink">Кратко представяне<textarea value={about} onChange={e => setAbout(e.target.value)} rows={4} className={INPUT} /></label>
      {err && <div className="text-sm text-red-700">{err}</div>}
      <button disabled={busy} className="btn btn-primary w-full justify-center">{busy ? 'Изпращане…' : 'Изпрати заявка'}</button>
    </form>
  )
}

function ProForm({ profile, userId, onSaved }) {
  const [draft, setDraft] = useState({
    name: profile.name,
    tag: profile.tag,
    city: profile.city,
    bio: profile.bio,
    imageUrl: profile.imageUrl,
    imageZoom: profile.imageZoom,
    imageX: profile.imageX,
    imageY: profile.imageY,
    layerSlug: profile.layerSlug,
    since: profile.since,
  })
  const [save, setSave] = useState({ status: 'idle', message: '' })

  function update(key, value) { setDraft(d => ({ ...d, [key]: value })) }

  const preview = useMemo(() => normalizeProfile({
    ...profile,
    ...draft,
    layer_slug: draft.layerSlug,
    image_url: draft.imageUrl,
    image_zoom: draft.imageZoom,
    image_x: draft.imageX,
    image_y: draft.imageY,
  }), [draft, profile])

  async function uploadImage(file) {
    if (!file) return
    setSave({ status: 'uploading', message: 'Оптимизираме и качваме снимката…' })
    try {
      const result = await uploadProfileMedia({ file, target: userId })
      update('imageUrl', result.publicUrl)
      const reuseMessage = result.reused ? 'Същото изображение вече съществува и го използвахме повторно.' : 'Снимката е качена.'
      const compressMessage = result.precompressed ? ' Преди upload я компресирахме локално.' : ''
      setSave({ status: 'uploaded', message: `${reuseMessage}${compressMessage} Натисни „Запази“.` })
    } catch (error) {
      setSave({ status: 'error', message: error.message || 'Качването не успя.' })
    }
  }

  async function submit(e) {
    e.preventDefault()
    setSave({ status: 'saving', message: 'Запазваме…' })
    const { error } = await supabase.from('profiles').update({
      name: draft.name.trim(),
      tag: draft.tag.trim(),
      city: draft.city.trim(),
      bio: draft.bio.trim(),
      image_url: draft.imageUrl.trim(),
      image_zoom: Number(draft.imageZoom),
      image_x: Number(draft.imageX),
      image_y: Number(draft.imageY),
      layer_slug: draft.layerSlug,
      since: Number(draft.since),
    }).eq('id', profile.id)
    if (error) { setSave({ status: 'error', message: error.message }); return }
    setSave({ status: 'saved', message: 'Профилът е запазен.' })
    onSaved?.()
  }

  return (
    <section className="section bg-soft min-h-screen">
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
          <div>
            <div className="eyebrow">Моят профил</div>
            <h1 className="h-section mt-2">Редактирай информацията си.</h1>
            <p className="text-muted text-sm mt-2">
              {profile.isPublished ? 'Профилът ти е публикуван.' : 'Профилът още не е публикуван — администратор го преглежда.'}
              {profile.slug && profile.isPublished && <> Линк: <Link to={`/profil/${profile.slug}`} className="text-accent hover:underline">/profil/{profile.slug}</Link></>}
            </p>
          </div>
          <button className="btn btn-ghost" onClick={() => signOutAndRedirect(session?.user?.id)}>Изход</button>
        </div>

        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8 rounded-3xl border border-line bg-paper p-6 md:p-8 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-ink">Име / фирма<input value={draft.name} onChange={e => update('name', e.target.value)} className={INPUT} /></label>
              <label className="block text-sm font-medium text-ink">Роля / етикет<input value={draft.tag} onChange={e => update('tag', e.target.value)} className={INPUT} placeholder="Архитект, Майстор..." /></label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block text-sm font-medium text-ink">Град<input value={draft.city} onChange={e => update('city', e.target.value)} className={INPUT} /></label>
              <label className="block text-sm font-medium text-ink">От година<input type="number" min="1900" max="2100" value={draft.since} onChange={e => update('since', e.target.value)} className={INPUT} /></label>
              <TotsanSelect label="Слой" value={draft.layerSlug} onChange={(value) => update('layerSlug', value)} options={LAYERS.map(l => ({ value: l.slug, label: `Слой ${l.number} · ${l.title}` }))} />
            </div>
            <label className="block text-sm font-medium text-ink">Кратко за теб<textarea rows={6} value={draft.bio} onChange={e => update('bio', e.target.value)} className={INPUT} /></label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-ink">URL на снимка<input value={draft.imageUrl} onChange={e => update('imageUrl', e.target.value)} className={INPUT} placeholder="https://..." /></label>
              <label className="block text-sm font-medium text-ink">Качи файл<input type="file" accept="image/*" className={`${INPUT} file:mr-3 file:rounded-full file:border-0 file:bg-soft file:px-4 file:py-2 file:text-sm file:font-medium`} onChange={async (e) => { await uploadImage(e.target.files?.[0]); e.target.value = '' }} /></label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Range label="Zoom" value={draft.imageZoom} min={1} max={2.5} step={0.05} onChange={(v) => update('imageZoom', v)} />
              <Range label="Ляво / дясно" value={draft.imageX} min={0} max={100} step={1} onChange={(v) => update('imageX', v)} />
              <Range label="Горе / долу" value={draft.imageY} min={0} max={100} step={1} onChange={(v) => update('imageY', v)} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <div className={`text-sm ${save.status === 'error' ? 'text-red-700' : 'text-muted'}`}>{save.message || 'Промените се отразяват веднага след запазване.'}</div>
              <button className="btn btn-primary" disabled={save.status === 'saving'}>{save.status === 'saving' ? 'Запазва се…' : 'Запази'}</button>
            </div>
          </div>

          <aside className="lg:col-span-4">
            <div className="rounded-3xl border border-line bg-paper p-6 sticky top-24">
              <div className="eyebrow">Преглед</div>
              <div className="mt-4 flex items-center gap-4">
                <Avatar src={preview.imageUrl || ''} name={preview.name} size={80} imgStyle={getProfileImageStyle(preview)} />
                <div>
                  <div className="font-display text-xl">{preview.name}</div>
                  <div className="text-sm text-muted">{preview.tag} · {preview.city}</div>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted whitespace-pre-wrap">{preview.bio}</p>
            </div>
          </aside>
        </form>
      </div>
    </section>
  )
}

function Range({ label, value, min, max, step, onChange }) {
  return (
    <label className="block text-sm font-medium text-ink">
      <span className="flex items-center justify-between gap-4"><span>{label}</span><span className="text-xs text-muted">{Number(value).toFixed(step < 1 ? 2 : 0)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-3 w-full accent-black" />
    </label>
  )
}
