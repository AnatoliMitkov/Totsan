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
import { LocationCombobox } from '../components/ui/LocationCombobox.jsx'
import { normalizeLocationValue } from '../lib/locations.js'
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
const SUPPORTED_PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const BANNER_RATIO_TEXT = 'Препоръчителен размер: 1600 x 520 px'
const BANNER_DESCRIPTION = 'Широк банер работи най-добре около 3:1. Препоръчваме 1600 x 520 px за най-чист резултат.'

function CustomSpaceIcon({ size = 18, className = '' }) {
  return (
    <svg
      id="Layer_2"
      data-name="Layer 2"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 2639.63 2316.21"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <g id="Layer_1-2" data-name="Layer 1">
        <circle cx="344.77" cy="1598.91" r="47.16"/>
        <path d="M2337.99,1853.85v333.17l133.65,92.31,5.67,17.47-11.86,17.7-389.92,1.71c-12.4-4.46-18.75-16.6-14.92-29.54l138.32-99.65v-333.17h-324.48v223.08c0,23.29-45.58,49.73-46.46,53.34-5.52,22.67,13.24,84.76-15.55,93.24-13.27,3.91-82.52,3.49-92.1-4.07-16.27-12.83-4.79-66.38-8.13-87.47h-648.96c-3.34,21.09,8.13,74.65-8.13,87.47-9.58,7.55-78.83,7.98-92.1,4.07-28.79-8.49-10.03-70.58-15.55-93.24-.88-3.61-46.46-30.05-46.46-53.34v-223.08h-136.16L17.64,2271.18l-17.64-11.75L2.46,425.12,759.36,0l1871.79,4.93,8.47,26.3-3.32,1810.95c-1.28,2.74-10.5,11.68-11.5,11.68h-286.82ZM2592.94,46.05H785.13v1761.45h121.68c3.03-34.34,34.14-55.96,64.08-67.35,5.24-71.7-29.78-178.27,71.86-187.82,223.43,12.23,462.65-15.5,684.19-.02,109,7.61,72.14,110.23,77.63,187.84,29.94,11.39,61.05,33.01,64.08,67.35h330.27v-370.83h-147.75c-18.5,0-11.97-32.38-8.92-43.72,28.53-106.38,100.7-222.97,132.37-331.14l12.7-16.27c9.52-4.55,137.94-5.73,153.44-2.76,8.01,1.53,13.23,4.48,17.32,11.65l164.4,351.81c6.91,40.64-41.48,29.63-68.62,30.43v162.24h-46.35v-162.24h-69.53v370.83h254.95V46.05ZM576.54,1906l162.24-89.81V63.43L43.47,451.64v1755.66l162.48-90.78,2.61-900.08,333.01-194.51c9.36-8.48,34.96,4.36,34.96,12.03v872.03ZM252.06,2091.42l278.12-159.34v-848.86l-278.12,156.44v851.75ZM2094.63,1390.31h365.04l-141.73-301.73c-22.28,4.65-91.64-7.38-104.7,6.05l-118.61,295.68ZM2291.64,1436.67h-46.35v773.53l-81.12,60.84h208.59l-81.12-60.84v-773.53ZM1364.56,1598.9h-333.17c-25.14,0-10.56,119.58-14.83,141.24,50.42,17.22,76.87,60.51,69.85,113.73,82.02,6.57,177.51-8.95,257.87-.03,16.23,1.8,41.28,16.86,45.23,16.28,8.38-1.23,21.36-14.02,41.68-16.28,80.34-8.94,175.87,6.61,257.87.03-7.02-53.22,19.43-96.51,69.85-113.73-4.27-21.67,10.31-141.24-14.83-141.24h-333.17v162.24h-46.35v-162.24ZM980.55,1785.46c-20.73,4.53-31.01,22.36-33.31,42.19-2.96,25.49-2.4,235.31,3,246.41,2.36,4.85,7.6,8.87,12.78,10.39l853.51-1.7,10.39-12.78c-5.9-75.38,12.14-175.28.82-247.64-6.01-38.47-55.67-52.02-80.91-23.65-25.36,28.51-3.77,131.92-11.62,173.8-1.78,9.51-6,16.09-15.49,19.28l-668.1-1.7c-39.63-19.27,36.38-228.04-71.09-204.58ZM1364.56,1946.56c3.4-11.01-2.18-46.35-14.49-46.35h-263.64v46.35h278.12ZM1689.03,1900.21h-263.64c-12.31,0-17.88,35.35-14.49,46.35h278.12v-46.35ZM1016.94,2131.92l-23.3.03.06,46.44,23.3-.03-.06-46.44ZM1781.78,2131.92l-23.3.03.06,46.44,23.3-.03-.06-46.44Z"/>
        <path d="M2106.48,138.35l.07,881.4-881.33.07-.07-881.4,881.33-.07ZM2059.87,185.11h-788.02v788.02h788.02V185.11Z"/>
        <path d="M1642.94,231.05l.08,325.15-325.15.08-.08-325.15,325.15-.08ZM1364.56,277.82v231.77h231.77v-231.77h-231.77Z"/>
        <path d="M2013.77,231.05l.08,325.15-325.15.08-.08-325.15,325.15-.08ZM1735.39,277.82v231.77h231.77v-231.77h-231.77Z"/>
        <path d="M1643.02,601.96v325.15h-325.15v-325.15h325.15ZM1364.56,648.65v231.77h231.77v-231.77h-231.77Z"/>
        <path d="M2013.84,601.95l.08,325.08-325.22.08-.08-325.08,325.22-.08ZM1735.39,648.65v231.77h231.77v-231.77h-231.77Z"/>
      </g>
    </svg>
  )
}

const CUSTOMER_TABS = [
  { id: 'overview', label: 'Преглед', icon: Home },
  { id: 'personal', label: 'Лични данни', icon: UserRound },
  { id: 'preferences', label: 'Предпочитания', icon: Settings2 },
  { id: 'project', label: 'Моето пространство', icon: CustomSpaceIcon },
  { id: 'activity', label: 'Активност', icon: Activity },
  { id: 'security', label: 'Сигурност', icon: Lock },
]

const MAX_AVATAR_BYTES = 10 * 1024 * 1024
function validateAvatarFile(file) {
  if (file && !SUPPORTED_PROFILE_IMAGE_TYPES.has(file.type)) return 'Моля, избери JPG, PNG или WEBP изображение.'
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

function getApplicationDetails(row) {
  const raw = row?.details
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
}

function getApplicationSelfPhotoUrl(row) {
  const details = getApplicationDetails(row)
  return String(details?.basic?.selfPhotoUrl || '').trim()
}

function validateBannerFile(file) {
  if (file && !SUPPORTED_PROFILE_IMAGE_TYPES.has(file.type)) return 'Моля, избери JPG, PNG или WEBP изображение за банера.'
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
    <section className="min-h-[calc(100dvh-var(--header-h,0px))] bg-soft pb-8 md:pb-10 pt-[calc(var(--header-h,64px)+2rem)] md:pt-[calc(var(--header-h,64px)+2.5rem)]">
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

        <div className="mx-auto max-w-4xl space-y-6">
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
        </div>
      </div>
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
        heightClass="h-[200px] sm:h-[240px] md:aspect-[1600/520] md:h-auto md:min-h-0"
        className="group cursor-pointer focus-within:ring-2 focus-within:ring-ink"
        onClick={openBannerEditor}
        placeholderLabel="Добавете банер"
        placeholderClassName="hidden md:grid"
      >
        {!localAccount?.cover_url && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pt-[var(--header-h,64px)] pb-10 md:hidden">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openBannerEditor() }}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-paper/88 text-ink shadow-sm backdrop-blur transition hover:bg-paper"
              aria-label="Добавете банер"
            >
              <Camera size={20} />
            </button>
          </div>
        )}
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
                      {/* Размерът на иконата се контролира тук (за "Моето пространство" е 22, за останалите е 18) */}
                      <Icon size={tab.id === 'project' ? 22 : 18} />
                      {/* Размерът на текста се контролира от Tailwind класа 'text-sm' в бутона горе или директно тук */}
                      <span className="text-sm">{tab.label}</span>
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
        accept=".jpg,.jpeg,.png,.webp"
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
        accept=".jpg,.jpeg,.png,.webp"
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

    if (appRes.data) {
      setApplication(appRes.data)
    } else {
      setApplication(null)
    }

    if (profRes.data) {
      const fallbackSelfPhotoUrl = getApplicationSelfPhotoUrl(appRes.data)
      const normalizedProfile = normalizeProfile(profRes.data)
      setProfile(
        !normalizedProfile.imageUrl && fallbackSelfPhotoUrl
          ? { ...normalizedProfile, imageUrl: fallbackSelfPhotoUrl }
          : normalizedProfile
      )
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
    <section className="section" style={{ paddingTop: 'calc(var(--header-h, 64px) + var(--section-pad-y, 4rem))' }}>
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
      city: normalizeLocationValue(draft.city),
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
    <section className="section bg-soft min-h-screen" style={{ paddingTop: 'calc(var(--header-h, 64px) + var(--section-pad-y, 4rem))' }}>
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
              <LocationCombobox label="Град" value={draft.city} onChange={(value) => update('city', value)} required />
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
