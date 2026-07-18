import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BriefcaseBusiness,
  Camera,
  Check,
  CircleDot,
  Compass,
  CreditCard,
  Eye,
  FileText,
  FolderKanban,
  GripVertical,
  Globe2,
  Home,
  ImagePlus,
  Link2,
  Lock,
  LogOut,
  Loader2,
  Mail,
  MapPin,
  MessagesSquare,
  PlayCircle,
  Plus,
  Save,
  Star,
  Tags,
  Trash2,
  UserRound,
  Video,
  X,
} from 'lucide-react'
import { LAYERS } from '../../data/layers.js'
import { uploadProfileMedia, uploadProfileCover, resizeImageToSize } from '../../lib/profile-media-upload-client.js'
import { getProfileImageStyle, isMissingLayer01MetaColumn, normalizeProfile, PROFILE_SELECT_COLUMNS_BASE, PROFILE_SELECT_COLUMNS_WITH_LAYER01 } from '../../lib/profiles.js'
import { supabase } from '../../lib/supabase.js'
import { getAccountDisplayName } from '../../lib/account.js'
import { saveCustomerAccountProfile } from '../../lib/projects.js'
import { refreshProfileAiSummary } from '../../lib/profile-ai-summary.js'
import { deleteStorageRefs, diffStorageRefs, mediaAndCoverStorageRefs } from '../../lib/storage-media-cleanup.js'
import TotpMfaManager from '../auth/TotpMfa.jsx'
import AccountDangerZone from './AccountDangerZone.jsx'
import {
  DEFAULT_PORTFOLIO_ITEM,
  appendPortfolioMedia,
  deletePortfolioItem,
  loadProfilePortfolio,
  loadProfileStats,
  savePortfolioItem,
  uploadPortfolioImage,
} from '../../lib/portfolio.js'
import {
  createConnectOnboarding,
  getConnectStatus,
} from '../../lib/payments.js'
import {
  cancelPartnerSubscriptionAtPeriodEnd,
  createPartnerSubscriptionPortal,
  ensurePartnerSubscriptionActivationEmail,
  getPartnerSubscriptionEndLabel,
  loadOwnPartnerSubscription,
  reconcilePartnerSubscription,
  resumePartnerSubscriptionRenewal,
  syncPartnerSubscriptionSession,
} from '../../lib/subscriptions.js'
import { getInquirySourceLabel, getInquiryStatusLabel, inquirySupportsProjectContext, loadPartnerInquiries, loadInquiryProjects } from '../../lib/partner-inquiries.js'
import { loadPartnerServicesForProfile } from '../../lib/partner-services.js'
import { formatMoneyRange } from '../../lib/money.js'
import ImageCropperModal from './ImageCropperModal.jsx'
import Avatar from '../Avatar.jsx'
import PublicProfileBanner from './PublicProfileBanner.jsx'
import PublicProfileAvatar from './PublicProfileAvatar.jsx'
import PartnerServiceEditor from './PartnerServiceEditor.jsx'
import PartnerMaterialsEditor from './PartnerMaterialsEditor.jsx'
import PartnerOrders from './PartnerOrders.jsx'
import PartnerInquiries from './PartnerInquiries.jsx'
import Layer01SpecEditor, { cleanLayer01Draft, makeLayer01Draft } from './Layer01SpecEditor.jsx'
import FloatingSaveBar from './FloatingSaveBar.jsx'
import TotsanSelect from '../ui/TotsanSelect.jsx'
import { LocationCombobox, LocationMultiCombobox } from '../ui/LocationCombobox.jsx'
import { normalizeLocationList, normalizeLocationValue } from '../../lib/locations.js'
import { buildPartnerOverviewAction, PARTNER_WORKSPACE_NAV } from '../../lib/profile-workspace.js'
import ProfileWorkspaceShell, { ProfileWorkspaceSectionHeader, ProfileWorkspaceSurface } from './ProfileWorkspaceShell.jsx'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'
const COMPACT_INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-3 py-3 text-sm outline-none transition focus:border-ink'
const MAX_BANNER_BYTES = 12 * 1024 * 1024
const PROFILE_BIO_LIMIT = 300
const PROFILE_DESCRIPTION_LIMIT = 500
const SUPPORTED_PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const BANNER_DESCRIPTION = 'Широк банер работи най-добре около 3:1. Препоръчваме 1600 x 520 px за най-чист резултат.'

function validateBannerFile(file) {
  if (file && !SUPPORTED_PROFILE_IMAGE_TYPES.has(file.type)) return 'Моля, избери JPG, PNG или WEBP изображение за банера.'
  if (!file) return 'Липсва файл.'
  if (!file.type.startsWith('image/')) return 'Моля, избери изображение за банера.'
  if (file.size > MAX_BANNER_BYTES) return 'Банерът трябва да е до 12 MB.'
  return ''
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Файлът не може да бъде прочетен.'))
    reader.readAsDataURL(file)
  })
}

function stripCacheBust(url) {
  if (!url) return ''

  try {
    const parsed = new URL(url)
    parsed.searchParams.delete('v')
    return parsed.toString()
  } catch {
    return String(url).replace(/([?&])v=\d+(&?)/, (_, prefix, suffix) => {
      if (prefix === '?' && suffix) return '?'
      return suffix ? prefix : ''
    }).replace(/[?&]$/, '')
  }
}

function withCacheBust(url) {
  const cleanUrl = stripCacheBust(url)
  if (!cleanUrl) return ''
  const separator = cleanUrl.includes('?') ? '&' : '?'
  return `${cleanUrl}${separator}v=${Date.now()}`
}

const TABS = [
  { id: 'overview', label: 'Преглед', icon: Home },
  { id: 'profile', label: 'Профил', icon: UserRound },
  { id: 'layer01', label: 'Идея и посока', icon: Compass, layerSlug: 'ideya' },
  { id: 'portfolio', label: 'Портфолио', icon: FolderKanban },
  { id: 'services', label: 'Услуги', icon: BriefcaseBusiness },
  { id: 'materials', label: 'Материали и марки', icon: Tags },
  { id: 'orders', label: 'Поръчки', icon: CreditCard },
  { id: 'inquiries', label: 'Запитвания', icon: MessagesSquare },
  { id: 'contact', label: 'Контакт', icon: Mail },
  { id: 'security', label: 'Сигурност', icon: Lock },
]

function csv(value) {
  return Array.isArray(value) ? value.join(', ') : String(value || '')
}

function fromCsv(value, fallback = []) {
  const next = String(value || '').split(',').map(item => item.trim()).filter(Boolean)
  return next.length ? next : fallback
}

function fromLocationCsv(value, fallback = []) {
  const next = normalizeLocationList(value)
  return next.length ? next : fallback
}

function buildAccountNameSyncPayload(account, profileName) {
  return {
    fullName: account?.full_name || '',
    displayName: profileName || account?.display_name || '',
    phone: account?.phone || '',
    avatarUrl: account?.avatar_url || '',
    coverUrl: account?.cover_url || '',
    city: account?.city || '',
    country: account?.country || 'BG',
    bio: account?.bio || '',
    locale: account?.locale || 'bg',
    marketingOptIn: Boolean(account?.marketing_opt_in),
    interests: Array.isArray(account?.interests) ? account.interests : [],
    stylePreferences: Array.isArray(account?.style_preferences) ? account.style_preferences : [],
    preferredContactMethod: account?.preferred_contact_method || '',
    ageGroup: account?.age_group || '',
    gender: account?.gender || '',
  }
}

function makeProfileDraft(profile) {
  return {
    name: profile.name || '',
    tag: profile.tag || '',
    headline: profile.headline || profile.tag || '',
    city: profile.city || '',
    layerSlug: profile.layerSlug || LAYERS[0]?.slug || '',
    since: profile.since || new Date().getFullYear(),
    yearsExperience: profile.yearsExperience || Math.max(0, new Date().getFullYear() - (profile.since || new Date().getFullYear())),
    projects: profile.projects || 0,
    bio: profile.bio || '',
    descriptionLong: profile.descriptionLong || profile.bio || '',
    imageUrl: profile.imageUrl || '',
    imageZoom: profile.imageZoom || 1,
    imageX: profile.imageX || 50,
    imageY: profile.imageY || 50,
    phone: profile.phone || '',
    emailPublic: profile.emailPublic || '',
    website: profile.website || '',
    socialLinks: Array.isArray(profile.socialLinks) ? profile.socialLinks : [],
    languagesText: csv(profile.languages?.length ? profile.languages : ['bg']),
    serviceAreasText: csv(profile.serviceAreas?.length ? profile.serviceAreas : (profile.city ? [profile.city] : [])),
    responseTimeHours: profile.responseTimeHours === null ? '' : profile.responseTimeHours,
    acceptsRemote: Boolean(profile.acceptsRemote),
    remotePricePerHour: profile.remotePricePerHour === null ? '' : profile.remotePricePerHour,
    remoteIsFree: Boolean(profile.remoteIsFree),
    pricingNote: profile.pricingNote || '',
    coverUrl: profile.coverUrl || '',
    coverY: profile.coverY ?? 50,
    layer01Meta: makeLayer01Draft(profile.layer01Meta || {}),
    syncAccountName: false,
  }
}

function makePortfolioDraft(item = null, profile) {
  return {
    ...DEFAULT_PORTFOLIO_ITEM,
    profileId: profile?.id || '',
    layerSlug: profile?.layerSlug || LAYERS[0]?.slug || '',
    city: profile?.city || '',
    ...(item || {}),
  }
}

function paymentMessageFromStripe(result) {
  switch (result?.status) {
    case 'active':
      return 'Платежният профил е активен. Оттук можеш да управляваш плащанията и преводите.'
    case 'pending_review':
      return 'Данните са изпратени за проверка. Платежният профил чака преглед и може да отнеме малко време.'
    case 'needs_information':
      return 'Нужни са още данни, преди плащанията да бъдат активирани.'
    case 'not_started':
      return 'Плащанията още не са настроени.'
    default:
      return 'Проверихме платежния профил.'
  }
}

export default function PartnerProfileWorkspace({ profile, userId, account, session, refreshAccount, onSaved }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [currentProfile, setCurrentProfile] = useState(profile)
  const [profileDraft, setProfileDraft] = useState(() => makeProfileDraft(profile))
  const [portfolio, setPortfolio] = useState([])
  const [stats, setStats] = useState(null)
  const [dashboardState, setDashboardState] = useState({ status: 'loading', inquiries: [], inquiryProjects: {}, services: [], message: '' })
  const [portfolioDraft, setPortfolioDraft] = useState(() => makePortfolioDraft(null, profile))
  const [saveState, setSaveState] = useState({ status: 'idle', message: '' })
  const [portfolioState, setPortfolioState] = useState({ status: 'idle', message: '' })
  const [paymentState, setPaymentState] = useState({ status: 'idle', message: '' })
  const [subscriptionState, setSubscriptionState] = useState({ status: 'loading', subscription: null, message: '', checkoutSuccess: false, confirmingExpired: false })
  const [subscriptionRefreshKey, setSubscriptionRefreshKey] = useState(0)
  const [avatarEditor, setAvatarEditor] = useState({ open: false, file: null, imageUrl: '', fileName: 'avatar.jpg' })
  const [bannerEditor, setBannerEditor] = useState({ open: false, file: null, imageUrl: '', fileName: 'banner.jpg', positionY: 50 })
  const [bannerHintVisible, setBannerHintVisible] = useState(false)
  const workspaceContentRef = useRef(null)

  function openBannerEditor() {
    const input = document.getElementById('partner-cover-upload')
    if (input) input.click()
  }

  function closeBannerEditor() {
    setBannerEditor(current => ({ ...current, open: false }))
  }

  function handleBannerFile(file) {
    if (!file) return
    const error = validateBannerFile(file)
    if (error) {
      setSaveState({ status: 'error', message: error })
      return
    }
    setSaveState({ status: 'idle', message: '' })
    setBannerEditor({
      open: true,
      file,
      imageUrl: '',
      fileName: file.name || 'banner.jpg',
      positionY: profileDraft.coverY ?? 50,
    })
  }

  async function saveBanner(croppedFile) {
    await uploadCover(croppedFile, 50)
  }

  function openAvatarEditor() {
    if (profileDraft.imageUrl) {
      setAvatarEditor({
        open: true,
        file: null,
        imageUrl: profileDraft.imageUrl,
        fileName: profileDraft.name ? `${profileDraft.name}-avatar.jpg` : 'avatar.jpg',
      })
      return
    }
    const input = document.getElementById('partner-avatar-upload')
    if (input) input.click()
  }

  function closeAvatarEditor() {
    setAvatarEditor(current => ({ ...current, open: false }))
  }

  function handleAvatarFile(file) {
    if (!file) return
    if (!SUPPORTED_PROFILE_IMAGE_TYPES.has(file.type)) {
      setSaveState({ status: 'error', message: 'Моля, избери JPG, PNG или WEBP изображение.' })
      return
    }
    if (!file.type.startsWith('image/')) return
    setAvatarEditor({
      open: true,
      file,
      imageUrl: '',
      fileName: file.name || 'avatar.jpg',
    })
  }

  async function saveBannerPosition(positionY) {
    setSaveState({ status: 'saving', message: 'Запазваме позицията на банера…' })
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ cover_y: positionY })
        .eq('id', currentProfile.id)

      if (error) throw error

      updateProfile('coverY', positionY)
      setCurrentProfile((current) => ({ ...current, coverY: positionY }))
      setSaveState({ status: 'saved', message: 'Позицията на банера е запазена.' })
      await refreshAccount?.()
      await onSaved?.()
    } catch (error) {
      setSaveState({ status: 'error', message: error.message || 'Позицията на банера не успя да се запази.' })
      throw error
    }
  }

  async function uploadCover(file, positionY = 50) {
    if (!file) return
    setSaveState({ status: 'uploading', message: 'Оптимизираме и качваме банера…' })
    try {
      const previousCoverUrl = currentProfile.coverUrl || profileDraft.coverUrl || ''
      const result = await uploadProfileCover({ file, target: userId })
      const nextCoverUrl = withCacheBust(result.publicUrl || result.signedUrl || '')
      if (!nextCoverUrl) throw new Error('Банерът е качен, но липсва валиден адрес.')
      updateProfile('coverUrl', nextCoverUrl)
      updateProfile('coverY', positionY)
      
      // Auto-save to database immediately so it is not lost
      const { error } = await supabase
        .from('profiles')
        .update({ cover_url: nextCoverUrl, cover_y: positionY })
        .eq('id', currentProfile.id)
      
      if (error) throw error
      
      setCurrentProfile(current => ({ ...current, coverUrl: nextCoverUrl, coverY: positionY }))
      await deleteStorageRefs(diffStorageRefs(
        mediaAndCoverStorageRefs({ coverUrl: previousCoverUrl }),
        mediaAndCoverStorageRefs({ coverUrl: nextCoverUrl }),
      ))
      setSaveState({ status: 'saved', message: 'Банерът е качен и запазен.' })
      await refreshAccount?.()
      await onSaved?.()
    } catch (error) {
      setSaveState({ status: 'error', message: error.message || 'Качването на банер не успя.' })
      throw error
    }
  }

  function handleCoverFileChange(event) {
    const file = event.target.files?.[0]
    if (file) handleBannerFile(file)
    event.target.value = ''
  }

  async function saveAvatarAndProfile(croppedFile, cropInfo = {}) {
    closeAvatarEditor()
    // Always upload the cropped image directly to ensure clean 512x512 output
    // and reset the zoom/position coordinates since the image is already cropped.
    if (croppedFile) {
      await uploadAvatar(croppedFile, { imageZoom: 1, imageX: 50, imageY: 50 })
      return
    }

    if (avatarEditor.imageUrl) {
      await saveAvatarPosition(cropInfo.displayCrop)
      return
    }
  }

  useEffect(() => {
    setCurrentProfile(profile)
    setProfileDraft(makeProfileDraft(profile))
  }, [profile?.id, profile?.updatedAt])

  useEffect(() => {
    if (!profile?.id) return undefined

    let active = true
    async function load() {
      try {
        const [portfolioRows, statsRow] = await Promise.all([
          loadProfilePortfolio(profile.id, { includeUnpublished: true }),
          loadProfileStats(profile.id),
        ])
        if (!active) return
        setPortfolio(portfolioRows)
        setStats(statsRow)
        setPortfolioDraft(makePortfolioDraft(portfolioRows[0] || null, profile))
      } catch (error) {
        if (!active) return
        setPortfolioState({ status: 'error', message: error.message || 'Портфолиото не успя да зареди.' })
      }
    }
    load()
    return () => { active = false }
  }, [profile?.id])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const paymentsState = params.get('payments')
    if (!paymentsState) return undefined

    let active = true
    setPaymentState({ status: 'saving', message: 'Проверяваме платежния профил...' })

    async function loadStripeStatus() {
      try {
        const result = await getConnectStatus()
        if (!active) return
        setPaymentState({ status: result.status === 'needs_information' || result.status === 'not_started' ? 'idle' : 'saved', message: paymentMessageFromStripe(result) })
        if (result?.stripeAccountId) await refreshAccount?.()
      } catch (error) {
        if (!active) return
        setPaymentState({ status: 'error', message: error.message || 'Не успяхме да проверим платежния профил.' })
      } finally {
        params.delete('payments')
        const query = params.toString()
        const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash || ''}`
        window.history.replaceState({}, '', nextUrl)
      }
    }

    loadStripeStatus()
    return () => { active = false }
  }, [refreshAccount])

  useEffect(() => {
    if (!account?.stripe_account_id) return undefined
    const params = new URLSearchParams(window.location.search)
    if (params.get('payments')) return undefined

    let active = true

    async function loadStripeStatusQuietly() {
      try {
        const result = await getConnectStatus()
        if (!active || !result?.status || result.status === 'not_started') return
        setPaymentState(current => {
          if (current.status === 'opening' || current.status === 'saving') return current
          return {
            status: result.status === 'needs_information' ? 'idle' : 'saved',
            message: paymentMessageFromStripe(result),
          }
        })
      } catch {
        // Keep the workspace usable even if Stripe status cannot be loaded in the background.
      }
    }

    loadStripeStatusQuietly()
    return () => { active = false }
  }, [account?.stripe_account_id])

  useEffect(() => {
    if (!profile?.id) return undefined

    let active = true
    async function loadDashboardData() {
      setDashboardState(current => ({ ...current, status: 'loading', message: '' }))
      try {
        const [inquiryResult, serviceResult] = await Promise.allSettled([
          profile.slug ? loadPartnerInquiries(profile.slug) : Promise.resolve([]),
          loadPartnerServicesForProfile(profile.id),
        ])

        const inquiries = inquiryResult.status === 'fulfilled' ? inquiryResult.value : []
        const services = serviceResult.status === 'fulfilled' ? serviceResult.value : []
        const clientIds = [...new Set(inquiries.map(item => item.client_id).filter(Boolean))]
        const projects = clientIds.length ? await loadInquiryProjects(clientIds) : []
        const inquiryProjects = projects.reduce((map, project) => {
          if (project?.user_id) map[project.user_id] = project
          return map
        }, {})

        if (!active) return
        setDashboardState({
          status: inquiryResult.status === 'rejected' || serviceResult.status === 'rejected' ? 'partial' : 'ready',
          inquiries,
          inquiryProjects,
          services,
          message: '',
        })
      } catch (error) {
        if (!active) return
        setDashboardState({ status: 'error', inquiries: [], inquiryProjects: {}, services: [], message: error.message || 'Работното табло не успя да зареди всички данни.' })
      }
    }

    loadDashboardData()
    return () => { active = false }
  }, [profile?.id, profile?.slug])

  useEffect(() => {
    if (!profile?.id) return undefined

    let active = true
    let pollTimer = null
    let pollAttempts = 0
    const maxPollAttempts = 24
    let isConfirmingPayment = (new URLSearchParams(window.location.search)).get('subscription') === 'success'

    async function loadSubscription(isPoll = false) {
      if (!isPoll) {
        setSubscriptionState(current => ({ ...current, status: 'loading', message: '' }))
      }
      try {
        const params = new URLSearchParams(window.location.search)
        const subscriptionParam = params.get('subscription')
        const sessionId = params.get('session_id')

        if (subscriptionParam === 'success' && sessionId && !isPoll) {
          try {
            await syncPartnerSubscriptionSession(sessionId)
          } catch (syncError) {
            console.error('Failed to sync checkout session with backend', syncError)
          }
        }

        let subscription = await loadOwnPartnerSubscription()
        let repairedFromStripe = false

        if (!subscription?.active && !isPoll) {
          try {
            const reconciliation = await reconcilePartnerSubscription()
            if (reconciliation?.subscription?.row) {
              subscription = reconciliation.subscription
              repairedFromStripe = Boolean(reconciliation.repaired || subscription.active)
            }
          } catch (reconciliationError) {
            console.error('Failed to reconcile subscription with Stripe', reconciliationError)
          }
        }
        if (
          subscription?.active
          && !subscription?.row?.metadata?.activation_email_sent_at
          && !isPoll
        ) {
          try {
            const notification = await ensurePartnerSubscriptionActivationEmail()
            if (notification?.subscription?.row) subscription = notification.subscription
          } catch (notificationError) {
            console.error('Failed to ensure the subscription confirmation email', notificationError)
          }
        }
        if (!active) return

        const hasActiveAccess = Boolean(subscription?.active)

        if (hasActiveAccess && isConfirmingPayment) {
          isConfirmingPayment = false
          refreshAccount?.()
          onSaved?.()
        }

        if (isConfirmingPayment && !hasActiveAccess && pollAttempts < maxPollAttempts) {
          pollAttempts++
          pollTimer = setTimeout(() => {
            if (active) loadSubscription(true)
          }, 2500)
        }

        let message = ''
        if (isConfirmingPayment) {
          message = 'Абонаментното плащане се потвърждава...'
        } else if (hasActiveAccess && (subscriptionParam === 'success' || pollAttempts > 0)) {
          message = 'Абонаментът е активиран успешно!'
        } else if (hasActiveAccess && repairedFromStripe) {
          message = 'Абонаментът беше синхронизиран успешно.'
        } else if (subscriptionParam === 'portal_return') {
          message = 'Върнахте се от управлението на абонамента.'
        }

        setSubscriptionState({
          status: 'ready',
          subscription,
          message,
          checkoutSuccess: isConfirmingPayment,
          confirmingExpired: isConfirmingPayment && pollAttempts >= maxPollAttempts,
        })

        if (subscriptionParam) {
          params.delete('subscription')
          params.delete('session_id')
          const query = params.toString()
          const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash || ''}`
          window.history.replaceState({}, '', nextUrl)
        }
      } catch (error) {
        if (!active) return
        setSubscriptionState({
          status: 'error',
          subscription: null,
          message: error.message || 'Абонаментният статус не успя да зареди.',
          checkoutSuccess: false,
          confirmingExpired: false,
        })
      }
    }

    loadSubscription()
    return () => {
      active = false
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [profile?.id, subscriptionRefreshKey])

  const preview = useMemo(() => normalizeProfile({
    ...currentProfile,
    ...profileDraft,
    layer_slug: profileDraft.layerSlug,
    image_url: profileDraft.imageUrl,
    image_zoom: profileDraft.imageZoom,
    image_x: profileDraft.imageX,
    image_y: profileDraft.imageY,
    cover_url: profileDraft.coverUrl,
    cover_y: profileDraft.coverY,
    description_long: profileDraft.descriptionLong,
    email_public: profileDraft.emailPublic,
    service_areas: fromLocationCsv(profileDraft.serviceAreasText, []),
    languages: fromCsv(profileDraft.languagesText, ['bg']),
    years_experience: profileDraft.yearsExperience,
    response_time_hours: profileDraft.responseTimeHours,
    accepts_remote: profileDraft.acceptsRemote,
    pricing_note: profileDraft.pricingNote,
  }), [currentProfile, profileDraft])

  const availableTabs = useMemo(() => (
    TABS.filter((tab) => !tab.layerSlug || profileDraft.layerSlug === tab.layerSlug)
  ), [profileDraft.layerSlug])
  const availableNavGroups = useMemo(() => {
    const byId = new Map(availableTabs.map((tab) => [tab.id, tab]))
    const newInquiryCount = (dashboardState.inquiries || []).filter((item) => item.status === 'new').length
    return PARTNER_WORKSPACE_NAV.map((group) => ({
      ...group,
      tabs: group.tabIds
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((tab) => tab.id === 'inquiries' && newInquiryCount ? { ...tab, badge: String(newInquiryCount) } : tab),
    })).filter((group) => group.tabs.length)
  }, [availableTabs, dashboardState.inquiries])
  const profileCompletion = useMemo(() => (
    getProfileCompletion(preview, portfolio, profileDraft.layerSlug === 'ideya' ? profileDraft.layer01Meta : null)
  ), [portfolio, preview, profileDraft.layer01Meta, profileDraft.layerSlug])
  const accountDisplayName = getAccountDisplayName(account, session, '')
  const hasNameMismatch = Boolean(accountDisplayName && preview.name && accountDisplayName.trim() !== preview.name.trim())

  useEffect(() => {
    if (!availableTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab('profile')
    }
  }, [activeTab, availableTabs])

  function updateProfile(key, value) {
    setProfileDraft(current => ({ ...current, [key]: value }))
  }

  function cancelProfileChanges() {
    setProfileDraft(makeProfileDraft(currentProfile))
    setSaveState({ status: 'idle', message: '' })
  }

  function scrollToWorkspaceStart() {
    window.setTimeout(() => {
      try {
        const element = workspaceContentRef.current
        if (!element) return

        const headerOffset = window.innerWidth >= 1024 ? 96 : 80
        const top = Math.max(window.scrollY + element.getBoundingClientRect().top - headerOffset, 0)
        window.scrollTo({ top, behavior: 'smooth' })
      } catch (error) {
        console.warn('[PartnerProfileWorkspace] Workspace scroll skipped:', error)
      }
    }, 0)
  }

  function changeActiveTab(nextTab, options = {}) {
    setActiveTab(nextTab)
    if (options.scroll === false) return
    scrollToWorkspaceStart()
  }

  function openWorkspaceTarget(target = 'profile', options = {}) {
    if (target === 'inbox') {
      navigate('/inbox')
      return
    }

    changeActiveTab(target, { scroll: !options.focusId })
    if (!options.focusId) return

    window.setTimeout(() => {
      const element = document.getElementById(options.focusId)
      if (!element) return
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const focusable = element.matches('input, textarea, button, select, a[href]')
        ? element
        : element.querySelector('input, textarea, button, select, a[href]')
      focusable?.focus?.({ preventScroll: true })
    }, 120)
  }

  function updateLayer01(key, value) {
    setProfileDraft(current => ({
      ...current,
      layer01Meta: {
        ...makeLayer01Draft(current.layer01Meta),
        [key]: value,
      },
    }))
  }

  function updatePortfolio(key, value) {
    setPortfolioDraft(current => ({ ...current, [key]: value }))
  }

  async function refreshAiSummaryQuietly(profileId = currentProfile?.id) {
    if (!profileId) return
    try {
      await refreshProfileAiSummary(profileId)
    } catch (error) {
      console.warn('[profile-ai-summary] Refresh skipped:', error?.message || error)
    }
  }

  async function saveAvatarPosition(displayCrop = {}) {
    const nextImageZoom = Number.isFinite(Number(displayCrop?.imageZoom)) ? Number(displayCrop.imageZoom) : 1
    const nextImageX = Number.isFinite(Number(displayCrop?.imageX)) ? Number(displayCrop.imageX) : 50
    const nextImageY = Number.isFinite(Number(displayCrop?.imageY)) ? Number(displayCrop.imageY) : 50

    setSaveState({ status: 'saving', message: 'Запазваме позицията на снимката…' })
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ image_zoom: nextImageZoom, image_x: nextImageX, image_y: nextImageY })
        .eq('id', currentProfile.id)

      if (error) throw error

      updateProfile('imageZoom', nextImageZoom)
      updateProfile('imageX', nextImageX)
      updateProfile('imageY', nextImageY)
      setCurrentProfile(current => ({ ...current, imageZoom: nextImageZoom, imageX: nextImageX, imageY: nextImageY }))
      setSaveState({ status: 'saved', message: 'Позицията на снимката е запазена.' })
      await refreshAccount?.()
      await onSaved?.()
    } catch (error) {
      setSaveState({ status: 'error', message: error.message || 'Позицията на снимката не успя да се запази.' })
    }
  }

  async function uploadAvatar(file, displayCrop = {}) {
    if (!file) return
    setSaveState({ status: 'uploading', message: 'Оптимизираме и качваме снимката…' })
    try {
      const previousImageUrl = currentProfile.imageUrl || profileDraft.imageUrl || ''
      const nextImageZoom = Number.isFinite(Number(displayCrop?.imageZoom)) ? Number(displayCrop.imageZoom) : 1
      const nextImageX = Number.isFinite(Number(displayCrop?.imageX)) ? Number(displayCrop.imageX) : 50
      const nextImageY = Number.isFinite(Number(displayCrop?.imageY)) ? Number(displayCrop.imageY) : 50

      // Generate variants client-side
      const [cardFile, tinyFile] = await Promise.all([
        resizeImageToSize(file, 256, 0.90),
        resizeImageToSize(file, 96, 0.90),
      ])

      // Upload concurrently to edge function
      const [result] = await Promise.all([
        uploadProfileMedia({ file, target: userId }),
        uploadProfileMedia({ file: cardFile, target: userId, variant: 'card' }),
        uploadProfileMedia({ file: tinyFile, target: userId, variant: 'tiny' }),
      ])

      const nextImageUrlRaw = result.publicUrl || result.signedUrl || ''
      if (!nextImageUrlRaw) throw new Error('Снимката е качена, но липсва валиден адрес.')
      const nextImageUrl = `${nextImageUrlRaw.split('?')[0]}?v=${Date.now()}`
      updateProfile('imageUrl', nextImageUrl)
      updateProfile('imageZoom', nextImageZoom)
      updateProfile('imageX', nextImageX)
      updateProfile('imageY', nextImageY)
      
      // Auto-save to database immediately so it is not lost
      const { error } = await supabase
        .from('profiles')
        .update({ image_url: nextImageUrl, image_zoom: nextImageZoom, image_x: nextImageX, image_y: nextImageY })
        .eq('id', currentProfile.id)
      
      if (error) throw error
      
      setCurrentProfile(current => ({ ...current, imageUrl: nextImageUrl, imageZoom: nextImageZoom, imageX: nextImageX, imageY: nextImageY }))
      await deleteStorageRefs(diffStorageRefs(
        mediaAndCoverStorageRefs({ coverUrl: previousImageUrl }),
        mediaAndCoverStorageRefs({ coverUrl: nextImageUrl }),
      ))
      setSaveState({ status: 'saved', message: 'Профилната снимка е качена и запазена.' })
      await refreshAccount?.()
    } catch (error) {
      setSaveState({ status: 'error', message: error.message || 'Качването не успя.' })
    }
  }

  function addSocialLink() {
    setProfileDraft(current => ({
      ...current,
      socialLinks: [...current.socialLinks, { id: `social-${Date.now()}`, url: '' }]
    }))
  }

  function updateSocialLink(id, url) {
    setProfileDraft(current => ({
      ...current,
      socialLinks: current.socialLinks.map(link => link.id === id ? { ...link, url } : link)
    }))
  }

  function removeSocialLink(id) {
    setProfileDraft(current => ({
      ...current,
      socialLinks: current.socialLinks.filter(link => link.id !== id)
    }))
  }

  async function saveProfile(event) {
    event?.preventDefault()
    setSaveState({ status: 'saving', message: 'Запазваме профила…' })

    const savesLayer01 = profileDraft.layerSlug === 'ideya'
    const profilePayload = {
      name: profileDraft.name.trim(),
      tag: profileDraft.tag.trim(),
      headline: profileDraft.headline.trim() || null,
      city: normalizeLocationValue(profileDraft.city),
      layer_slug: profileDraft.layerSlug,
      since: Number(profileDraft.since),
      years_experience: profileDraft.yearsExperience === '' ? null : Number(profileDraft.yearsExperience),
      projects: Number(profileDraft.projects) || 0,
      bio: profileDraft.bio.trim(),
      description_long: profileDraft.descriptionLong.trim() || null,
      image_url: profileDraft.imageUrl.trim(),
      image_zoom: Number(profileDraft.imageZoom),
      image_x: Number(profileDraft.imageX),
      image_y: Number(profileDraft.imageY),
      cover_url: profileDraft.coverUrl.trim(),
      cover_y: Number(profileDraft.coverY),
      phone: profileDraft.phone.trim() || null,
      email_public: profileDraft.emailPublic.trim() || null,
      website: profileDraft.website.trim() || null,
      social_links: profileDraft.socialLinks.map(link => ({ id: link.id, url: link.url.trim() })).filter(link => link.url),
      languages: fromCsv(profileDraft.languagesText, ['bg']),
      service_areas: fromLocationCsv(profileDraft.serviceAreasText, []),
      response_time_hours: profileDraft.responseTimeHours === '' ? null : Number(profileDraft.responseTimeHours),
      accepts_remote: Boolean(profileDraft.acceptsRemote),
      remote_price_per_hour: profileDraft.remotePricePerHour === '' ? null : Number(profileDraft.remotePricePerHour),
      remote_is_free: Boolean(profileDraft.remoteIsFree),
      pricing_note: profileDraft.pricingNote.trim() || null,
    }

    if (savesLayer01) {
      profilePayload.layer01_meta = cleanLayer01Draft(profileDraft.layer01Meta)
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(profilePayload)
      .eq('id', currentProfile.id)
      .select(savesLayer01 ? PROFILE_SELECT_COLUMNS_WITH_LAYER01 : PROFILE_SELECT_COLUMNS_BASE)
      .single()

    if (error) {
      if (isMissingLayer01MetaColumn(error)) {
        setSaveState({ status: 'error', message: 'Липсва Supabase migration за layer01_meta. Пусни migration-а и опитай отново.' })
        return
      }
      setSaveState({ status: 'error', message: error.message })
      return
    }

    const normalized = normalizeProfile(data)
    if (profileDraft.syncAccountName) {
      await saveCustomerAccountProfile(buildAccountNameSyncPayload(account, normalized.name))
      await refreshAccount?.()
      await onSaved?.()
      await onSaved?.()
    }
    setCurrentProfile(normalized)
    setProfileDraft(makeProfileDraft(normalized))
    setSaveState({ status: 'saved', message: profileDraft.syncAccountName ? 'Профилът е запазен и името в акаунта е синхронизирано.' : 'Профилът е запазен.' })
    void refreshAiSummaryQuietly(normalized.id)
    if (!profileDraft.syncAccountName) await refreshAccount?.()
    onSaved?.()
  }

  async function uploadPortfolioFile(files) {
    const isFileList = typeof FileList !== 'undefined' && files instanceof FileList
    const fileList = Array.from(isFileList ? files : (Array.isArray(files) ? files : [files])).filter(Boolean)
    if (!fileList.length) return
    setPortfolioState({ status: 'uploading', message: fileList.length > 1 ? 'Качваме снимките към портфолиото…' : 'Качваме снимка към портфолиото…' })
    try {
      const uploads = []
      for (const file of fileList) {
        uploads.push(await uploadPortfolioImage({ file, target: userId, kind: 'portfolio' }))
      }
      setPortfolioDraft(current => uploads.reduce((next, upload) => appendPortfolioMedia(next, upload), current))
      setPortfolioState({ status: 'uploaded', message: fileList.length > 1 ? 'Снимките са добавени. Подреди ги и натисни „Запази“.' : 'Снимката е добавена. Натисни „Запази“.' })
    } catch (error) {
      setPortfolioState({ status: 'error', message: error.message || 'Качването не успя.' })
    }
  }

  async function savePortfolio(event) {
    event?.preventDefault()
    setPortfolioState({ status: 'saving', message: 'Запазваме портфолио проекта…' })
    try {
      const saved = await savePortfolioItem(currentProfile.id, portfolioDraft)
      setPortfolio(current => [saved, ...current.filter(item => item.id !== saved.id)].sort((left, right) => left.orderIndex - right.orderIndex))
      setPortfolioDraft(makePortfolioDraft(saved, currentProfile))
      setPortfolioState({ status: 'saved', message: 'Портфолио проектът е запазен.' })
      void refreshAiSummaryQuietly(currentProfile.id)
      return true
    } catch (error) {
      setPortfolioState({ status: 'error', message: error.message || 'Записът не успя.' })
      return false
    }
  }

  async function removePortfolioItem(itemId) {
    if (!itemId) return
    setPortfolioState({ status: 'saving', message: 'Изтриваме проекта…' })
    try {
      await deletePortfolioItem(itemId)
      const next = portfolio.filter(item => item.id !== itemId)
      setPortfolio(next)
      setPortfolioDraft(makePortfolioDraft(next[0] || null, currentProfile))
      setPortfolioState({ status: 'saved', message: 'Проектът е изтрит.' })
      void refreshAiSummaryQuietly(currentProfile.id)
    } catch (error) {
      setPortfolioState({ status: 'error', message: error.message || 'Изтриването не успя.' })
    }
  }

  async function startPaymentOnboarding() {
    setPaymentState({ status: 'opening', message: 'Отваряме настройките за плащания...' })
    try {
      const result = await createConnectOnboarding()
      if (result.dashboardUrl) {
        window.location.href = result.dashboardUrl
        return
      }
      if (result.status && result.status !== 'active' && !result.onboardingUrl) {
        setPaymentState({ status: result.status === 'needs_information' ? 'idle' : 'saved', message: paymentMessageFromStripe(result) })
        return
      }
      if (result.onboardingUrl) {
        window.location.href = result.onboardingUrl
        return
      }
      setPaymentState({ status: 'saved', message: 'Платежният профил е проверен.' })
      await refreshAccount?.()
    } catch (error) {
      setPaymentState({ status: 'error', message: error.message || 'Настройката на плащанията не можа да стартира.' })
    }
  }

  async function openSubscriptionPortal() {
    setSubscriptionState(current => ({ ...current, status: 'opening', message: 'Отваряме управлението на абонамента...' }))
    try {
      const result = await createPartnerSubscriptionPortal()
      if (result.portalUrl) {
        window.location.href = result.portalUrl
        return
      }
      setSubscriptionState(current => ({ ...current, status: 'error', message: 'Не получихме адрес за управление на абонамента.' }))
    } catch (error) {
      setSubscriptionState(current => ({ ...current, status: 'error', message: error.message || 'Абонаментът не може да бъде управляван в момента.' }))
    }
  }

  async function cancelSubscriptionAtPeriodEnd() {
    setSubscriptionState(current => ({
      ...current,
      status: 'updating',
      message: 'Спираме автоматичното подновяване…',
    }))
    try {
      const result = await cancelPartnerSubscriptionAtPeriodEnd()
      setSubscriptionState(current => ({
        ...current,
        status: 'ready',
        subscription: result.subscription,
      }))
    } catch (error) {
      setSubscriptionState(current => ({
        ...current,
        status: 'error',
        message: error.message || 'Не успяхме да спрем подновяването.',
      }))
    }
  }

  async function resumeSubscriptionRenewal() {
    setSubscriptionState(current => ({
      ...current,
      status: 'updating',
      message: 'Възстановяваме автоматичното подновяване…',
    }))
    try {
      const result = await resumePartnerSubscriptionRenewal()
      setSubscriptionState(current => ({
        ...current,
        status: 'ready',
        subscription: result.subscription,
        message: 'Автоматичното подновяване е възстановено.',
      }))
    } catch (error) {
      setSubscriptionState(current => ({
        ...current,
        status: 'error',
        message: error.message || 'Не успяхме да възстановим подновяването.',
      }))
    }
  }

  async function resendSubscriptionConfirmation() {
    setSubscriptionState(current => ({
      ...current,
      status: 'notifying',
      message: 'Изпращаме потвърждението за абонамента…',
    }))
    try {
      const result = await ensurePartnerSubscriptionActivationEmail({ force: true })
      const reason = result?.email?.reason || ''
      const message = result?.email?.sent
        ? 'Потвърждението за абонамента е изпратено.'
        : reason === 'stripe_test_mode_receipts_disabled'
          ? 'Тестовите плащания не изпращат реални разписки. За тестови имейли е нужен конфигуриран доставчик за транзакционна поща.'
          : 'Потвърждението не беше изпратено. Проверете конфигурацията на доставчика за транзакционна поща.'
      setSubscriptionState(current => ({
        ...current,
        status: result?.email?.sent ? 'ready' : 'email-error',
        subscription: result?.subscription?.row ? result.subscription : current.subscription,
        message,
      }))
    } catch (error) {
      setSubscriptionState(current => ({
        ...current,
        status: 'email-error',
        message: error.message || 'Не успяхме да изпратим потвърждението за абонамента.',
      }))
    }
  }

  if (!profile?.id || !currentProfile?.id) {
    return (
      <section className="section bg-soft min-h-screen">
        <div className="container-page">
          <div className="rounded-3xl border border-line bg-paper p-5 text-sm text-muted">Loading partner profile...</div>
        </div>
      </section>
    )
  }

  return (
    <>
      <ProfileWorkspaceShell
        banner={(
          <PublicProfileBanner
            imageSrc={preview.coverUrl || ''}
            imageAlt=""
            imageStyle={{ objectPosition: `50% ${preview.coverY ?? 50}%` }}
            heightClass="h-[13rem] md:h-[31.25rem] lg:h-[33.25rem] xl:h-[42.5rem]"
            className="group cursor-pointer focus-visible:ring-2 focus-visible:ring-accentDeep"
            onClick={openBannerEditor}
            onMouseEnter={() => setBannerHintVisible(true)}
            onMouseLeave={() => setBannerHintVisible(false)}
            onFocus={() => setBannerHintVisible(true)}
            onBlur={() => setBannerHintVisible(false)}
            placeholderLabel="Добавете банер"
            placeholderClassName="hidden md:grid"
          />
        )}
        header={(
          <PartnerWorkspaceHeader
            preview={preview}
            subscriptionActive={subscriptionState.subscription?.active}
            bannerHintVisible={bannerHintVisible}
            onEditAvatar={openAvatarEditor}
            onOpenPayments={startPaymentOnboarding}
            paymentBusy={paymentState.status === 'opening' || paymentState.status === 'saving'}
            hasPaymentAccount={Boolean(account?.stripe_account_id)}
            onSignOut={() => supabase.auth.signOut()}
          />
        )}
        notices={subscriptionState.message ? (
          <div
            role={subscriptionState.status === 'error' ? 'alert' : 'status'}
            className={`rounded-2xl border px-4 py-3 text-sm font-medium ${subscriptionState.status === 'error' ? 'border-red-200 bg-red-50 text-red-800' : subscriptionState.status === 'email-error' ? 'border-amber-200 bg-amber-50 text-amber-900' : subscriptionState.subscription?.active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}
          >
            {subscriptionState.message}
          </div>
        ) : null}
        navGroups={availableNavGroups}
        activeTab={activeTab}
        onTabChange={changeActiveTab}
        contentRef={workspaceContentRef}
      >
            {activeTab === 'overview' && (
              <OverviewDashboard
                preview={preview}
                stats={stats}
                portfolio={portfolio}
                completion={profileCompletion}
                dashboardState={dashboardState}
                subscriptionState={subscriptionState}
                paymentState={paymentState}
                onAction={openWorkspaceTarget}
                onOpenPayments={startPaymentOnboarding}
                onManageSubscription={openSubscriptionPortal}
                onRefreshSubscription={() => setSubscriptionRefreshKey(key => key + 1)}
                onCancelSubscription={cancelSubscriptionAtPeriodEnd}
                onResumeSubscription={resumeSubscriptionRenewal}
                onResendSubscriptionEmail={resendSubscriptionConfirmation}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileForm
                draft={profileDraft}
                saveState={saveState}
                accountDisplayName={accountDisplayName}
                hasNameMismatch={hasNameMismatch}
                onChange={updateProfile}
                onAddSocialLink={addSocialLink}
                onUpdateSocialLink={updateSocialLink}
                onRemoveSocialLink={removeSocialLink}
                onSubmit={saveProfile}
                onCancel={cancelProfileChanges}
              />
            )}

            {activeTab === 'layer01' && profileDraft.layerSlug === 'ideya' && (
              <form onSubmit={saveProfile} className="space-y-5 pb-28">
                <Layer01SpecEditor draft={profileDraft.layer01Meta} onChange={updateLayer01} profileDraft={profileDraft} onProfileChange={updateProfile} />
                <SavePanel
                  state={saveState}
                  idleMessage="Промените в Слой 01 се пазят след запис на профила."
                  savingLabel="Запазва се…"
                  saveLabel="Запази профила"
                  onCancel={cancelProfileChanges}
                />
              </form>
            )}

            {activeTab === 'portfolio' && (
              <PortfolioEditor
                items={portfolio}
                draft={portfolioDraft}
                state={portfolioState}
                onSelect={(item) => setPortfolioDraft(makePortfolioDraft(item, currentProfile))}
                onNew={() => setPortfolioDraft(makePortfolioDraft(null, currentProfile))}
                onChange={updatePortfolio}
                onSubmit={savePortfolio}
                onUpload={uploadPortfolioFile}
                onDelete={removePortfolioItem}
              />
            )}

            {activeTab === 'services' && (
              <PartnerServiceEditor profile={currentProfile} userId={userId} onProfileSummaryRefresh={() => refreshAiSummaryQuietly(currentProfile.id)} />
            )}

            {activeTab === 'materials' && (
              <PartnerMaterialsEditor profile={currentProfile} />
            )}

            {activeTab === 'orders' && (
              <PartnerOrders userId={userId} />
            )}

            {activeTab === 'inquiries' && (
              <PartnerInquiries profileSlug={currentProfile.slug} partnerId={userId} />
            )}

            {activeTab === 'security' && (
              <div className="space-y-5">
                <WorkspaceTabIntro eyebrow="Акаунт" title="Сигурност" description="Управлявайте защитата на акаунта и критичните действия от ясно разделени секции." />
                <TotpMfaManager session={session} />
                <AccountDangerZone account={account} session={session} />
              </div>
            )}

            {activeTab === 'contact' && (
              <ContactPreview profile={preview} onEdit={() => changeActiveTab('profile')} />
            )}
      </ProfileWorkspaceShell>

      {/* Keep the file input outside the clickable banner to avoid recursive input.click() bubbling. */}
      <input id="partner-cover-upload" type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handleCoverFileChange} />

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
          emptyStateLabel="Качи банер, за да го позиционираш."
          onClose={closeBannerEditor}
          onSelectFile={async (file) => handleBannerFile(file)}
          onCropSave={saveBanner}
        />
      )}

      {avatarEditor.open && (
        <ImageCropperModal
          file={avatarEditor.file}
          imageUrl={avatarEditor.imageUrl}
          initialFileName={avatarEditor.fileName}
          objectFit="contain"
          initialDisplayCrop={avatarEditor.file ? null : { imageZoom: profileDraft.imageZoom, imageX: profileDraft.imageX, imageY: profileDraft.imageY }}
          onClose={closeAvatarEditor}
          onSelectFile={async (file) => handleAvatarFile(file)}
          onCropSave={saveAvatarAndProfile}
        />
      )}

      <input
        id="partner-avatar-upload"
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) handleAvatarFile(file)
          event.target.value = ''
        }}
      />
    </>
  )
}

function PartnerWorkspaceHeader({
  preview,
  subscriptionActive,
  bannerHintVisible,
  onEditAvatar,
  onOpenPayments,
  paymentBusy,
  hasPaymentAccount,
  onSignOut,
}) {
  const locationLine = [preview.headline || preview.tag, preview.city].filter(Boolean).join(' · ')

  return (
    <ProfileWorkspaceSurface
      className="relative p-4 shadow-[0_30px_95px_rgba(5,12,22,0.28)] sm:p-5 md:p-6"
      style={{
        background: 'linear-gradient(180deg, rgba(5, 12, 22, 0.24) 0%, rgba(5, 12, 22, 0.14) 100%)',
        borderColor: 'rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(18px) saturate(150%)',
        WebkitBackdropFilter: 'blur(18px) saturate(150%)',
      }}
    >
      <div
        aria-hidden={!bannerHintVisible}
        className={`pointer-events-none absolute right-5 -top-36 z-30 hidden w-[min(21rem,calc(100vw-3rem))] origin-bottom-right rounded-2xl border border-white/20 bg-ink/60 p-4 text-left text-paper shadow-[0_24px_70px_-22px_rgba(5,12,22,0.78)] backdrop-blur-xl transition-all duration-300 ease-out md:block ${bannerHintVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-[0.98] opacity-0'}`}
      >
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-paper">Размер на банера</div>
        <p className="mt-1 text-sm leading-6 text-paper/90">{BANNER_DESCRIPTION}</p>
      </div>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:text-left">
          <button
            type="button"
            onClick={onEditAvatar}
            className="group relative shrink-0 rounded-3xl border border-[#1c1c1c] outline-none transition hover:ring-2 hover:ring-ink focus-visible:ring-2 focus-visible:ring-accentDeep/35"
            aria-label={preview.imageUrl ? 'Смени снимка' : 'Добавете снимка'}
          >
            <PublicProfileAvatar
              src={preview.imageUrl || ''}
              alt={preview.name}
              name={preview.name}
              imageStyle={getProfileImageStyle(preview)}
              statusTitle="Партньорски профил"
              sizeClassName="h-24 w-24 sm:h-28 sm:w-28"
              statusClassName="bottom-0.5 right-0.5 h-4 w-4 border-[3px] sm:bottom-1 sm:right-1 sm:h-5 sm:w-5 sm:border-4"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-ink/45 px-3 text-center text-paper opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
              <Camera size={22} aria-hidden="true" />
              <span className="mt-1 text-xs font-semibold">{preview.imageUrl ? 'Смени снимка' : 'Добавете снимка'}</span>
            </div>
          </button>

          <div className="min-w-0 pb-1">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <div className="eyebrow !text-[#f1f1f1]">Партньорски профил</div>
              {subscriptionActive ? <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-paper">PRO</span> : null}
            </div>
            <h1 className="mt-2 break-words font-display text-[clamp(2rem,6vw,2.75rem)] font-semibold leading-[1] tracking-tight text-[#f1f1f1]">{preview.name}</h1>
            {locationLine ? <p className="mt-2 text-sm leading-6 text-[#f1f1f1]">{locationLine}</p> : null}
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span className="rounded-full border border-line bg-soft px-3 py-1 text-xs font-medium text-muted">Слой {preview.layerNumber} · {preview.layerTitle}</span>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${preview.isPublished ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{preview.isPublished ? 'Публичен профил' : 'Скрит профил'}</span>
            </div>
          </div>
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-3 xl:flex xl:w-auto xl:flex-wrap xl:justify-end">
          {preview.isPublished ? <Link to={`/profil/${preview.slug}`} className="btn btn-primary min-h-11 justify-center px-4 py-2.5"><Eye size={17} /> Виж публично</Link> : null}
          <button type="button" onClick={onOpenPayments} disabled={paymentBusy} className="btn btn-ghost !text-[#f1f1f1] min-h-11 justify-center px-4 py-2.5">
            {paymentBusy ? <Loader2 size={17} className="animate-spin" /> : <CreditCard size={17} />}
            {hasPaymentAccount ? 'Плащания' : 'Настрой плащания'}
          </button>
          <button type="button" className="btn btn-ghost !text-[#f1f1f1] min-h-11 justify-center px-4 py-2.5" onClick={onSignOut}><LogOut size={17} /> Изход</button>
        </div>
      </div>
    </ProfileWorkspaceSurface>
  )
}

function WorkspaceTabIntro({ eyebrow, title, description }) {
  return (
    <ProfileWorkspaceSurface>
      <ProfileWorkspaceSectionHeader eyebrow={eyebrow} title={title} description={description} />
    </ProfileWorkspaceSurface>
  )
}

function BannerPositionModal({
  file = null,
  imageUrl = '',
  initialFileName = 'banner.jpg',
  initialPositionY = 50,
  description = '',
  onClose,
  onSave,
  onSelectFile,
}) {
  const [imageSrc, setImageSrc] = useState('')
  const [positionY, setPositionY] = useState(initialPositionY)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function prepareSource() {
      setError('')
      setPositionY(initialPositionY)

      if (file instanceof File) {
        try {
          const nextImageSrc = await readFileAsDataUrl(file)
          if (!active) return
          setImageSrc(nextImageSrc)
        } catch (nextError) {
          if (!active) return
          setImageSrc('')
          setError(nextError.message || 'Файлът не може да бъде прочетен.')
        }
        return
      }

      setImageSrc(imageUrl || '')
    }

    prepareSource()
    return () => { active = false }
  }, [file, imageUrl, initialPositionY])

  async function handleSave() {
    setIsSaving(true)
    setError('')
    let shouldClose = false
    try {
      await onSave?.({ file, positionY })
      shouldClose = true
    } catch (nextError) {
      setError(nextError.message || 'Не успяхме да запазим банера.')
    } finally {
      setIsSaving(false)
      if (shouldClose) onClose?.()
    }
  }

  async function handleFileChange(event) {
    const nextFile = event.target.files?.[0]
    event.target.value = ''
    if (!nextFile) return
    await onSelectFile?.(nextFile)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Редакция на банер"
    >
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-line bg-paper shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-6">
          <div>
            <h3 className="font-medium text-ink">Редактирай банера</h3>
            <p className="mt-1 text-sm text-muted">{description}</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded-full p-2 text-muted transition hover:bg-soft hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-5 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div>
            <div className="relative overflow-hidden rounded-3xl border border-line bg-soft" style={{ aspectRatio: '1600 / 520' }}>
              {imageSrc ? (
                <img src={imageSrc} alt={initialFileName} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: `50% ${positionY}%` }} />
              ) : (
                <div className="flex h-full min-h-[20rem] items-center justify-center px-6 text-center text-sm text-muted">
                  Качи банер, за да го позиционираш.
                </div>
              )}
            </div>

            <label className="mt-4 block text-sm font-medium text-ink">
              <span className="flex items-center justify-between gap-3">
                <span>Вертикална позиция</span>
                <span className="text-xs text-muted">{Math.round(positionY)}%</span>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={positionY}
                onChange={(event) => setPositionY(Number(event.target.value))}
                className="mt-3 w-full accent-ink"
                disabled={!imageSrc || isSaving}
              />
            </label>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-3xl border border-line bg-soft/70 p-4">
              <div className="text-sm font-medium text-ink">Преглед</div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-paper" style={{ aspectRatio: '1600 / 520' }}>
                {imageSrc ? (
                  <img src={imageSrc} alt="" className="h-full w-full object-cover" style={{ objectPosition: `50% ${positionY}%` }} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-muted">Няма снимка</div>
                )}
              </div>
            </div>

            <label className="btn btn-ghost w-full cursor-pointer justify-center">
              <Camera size={18} />
              Качи нова
              <input type="file" accept=".jpg,.jpeg,.png,.webp" className="sr-only" onChange={handleFileChange} disabled={isSaving} />
            </label>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-auto flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={onClose} disabled={isSaving} className="btn btn-ghost flex-1 justify-center">
                Отказ
              </button>
              <button type="button" onClick={handleSave} disabled={!imageSrc || isSaving} className="btn btn-primary flex-1 justify-center">
                <Save size={18} />
                {isSaving ? 'Запазване…' : 'Запази'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function getProfileCompletion(profile, portfolio, layer01Meta) {
  const checks = [
    { done: Boolean(profile.name), label: 'Име' },
    { done: Boolean(profile.headline || profile.tag), label: 'Позициониране' },
    { done: Boolean(profile.descriptionLong || profile.bio), label: 'Описание' },
    { done: Boolean(profile.city), label: 'Град' },
    { done: Boolean(profile.imageUrl), label: 'Снимка' },
    { done: Boolean(profile.phone || profile.emailPublic || profile.website), label: 'Контакт' },
    { done: Boolean(profile.serviceAreas?.length), label: 'Райони' },
    { done: Boolean(profile.pricingNote), label: 'Цени' },
    { done: portfolio.length > 0, label: 'Портфолио' },
  ]

  if (layer01Meta) {
    checks.push({
      done: Boolean(layer01Meta.specialist_type || layer01Meta.specific_services?.length || layer01Meta.process_steps?.length),
      label: 'Слой 01',
    })
  }

  const done = checks.filter((item) => item.done).length
  const total = checks.length || 1
  return {
    done,
    total,
    percent: Math.round((done / total) * 100),
    missing: checks.filter((item) => !item.done).map((item) => item.label),
  }
}

function OverviewDashboard({
  preview,
  stats,
  portfolio,
  completion,
  dashboardState,
  subscriptionState,
  paymentState,
  onAction,
  onOpenPayments,
  onManageSubscription,
  onRefreshSubscription,
  onCancelSubscription,
  onResumeSubscription,
  onResendSubscriptionEmail,
}) {
  const safePreview = preview || {}
  const safeCompletion = completion || { percent: 0, done: 0, total: 1, missing: [] }
  const safePortfolio = Array.isArray(portfolio) ? portfolio : []
  const inquiries = Array.isArray(dashboardState?.inquiries) ? dashboardState.inquiries : []
  const services = Array.isArray(dashboardState?.services) ? dashboardState.services : []
  const inquiryProjects = dashboardState?.inquiryProjects || {}
  const activeInquiries = inquiries.filter(item => item.status === 'new' || item.status === 'seen' || item.status === 'replied')
  const newInquiries = inquiries.filter(item => item.status === 'new')
  const reviewCount = Number(stats?.reviews_count || 0)
  const rating = Number(stats?.avg_rating || 0)
  const publishedServices = services.filter(item => item.isPublished || item.is_published)
  const nextSteps = getDashboardNextSteps({ preview: safePreview, completion: safeCompletion, portfolio: safePortfolio, services }).slice(0, 3)
  const priorityAction = buildPartnerOverviewAction({ dashboardState, subscriptionState, paymentState, completion: safeCompletion, preview: safePreview, nextSteps })
  const actionProject = inquirySupportsProjectContext(priorityAction.inquiry) && priorityAction.inquiry?.client_id
    ? inquiryProjects[priorityAction.inquiry.client_id]
    : null

  return (
    <div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <PriorityActionCard action={priorityAction} project={actionProject} onAction={onAction} onOpenPayments={onOpenPayments} onManageSubscription={onManageSubscription} />

          <ProfileWorkspaceSurface aria-label="Реални показатели" className="p-3 md:p-3">
            <div className="px-2 pb-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Показатели</div>
            <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
              <OverviewMetric label="Нови / активни" value={`${newInquiries.length} / ${activeInquiries.length}`} detail="Клиентски заявки" icon={Mail} onClick={() => onAction('inquiries')} />
              <OverviewMetric label="Видими услуги" value={`${publishedServices.length} / ${services.length}`} detail="Публикувани услуги" icon={BriefcaseBusiness} onClick={() => onAction('services')} />
              <OverviewMetric label="Портфолио" value={String(safePortfolio.length)} detail="Проекти" icon={FolderKanban} onClick={() => onAction('portfolio')} />
              <OverviewMetric label="Рейтинг" value={reviewCount ? rating.toFixed(1) : '—'} detail={reviewCount ? `${reviewCount} отзива` : 'Няма отзиви'} icon={Star} />
            </div>
          </ProfileWorkspaceSurface>

          <ProfileWorkspaceSurface>
            <div className="eyebrow">Работни секции</div>
            <p className="mt-2 text-sm leading-6 text-muted">Продължете към разговорите, изпълнението или новите клиентски заявки.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <WorkShortcut icon={MessagesSquare} title="Разговори" description="Клиентски чатове и оферти" onClick={() => onAction('inbox')} />
              <WorkShortcut icon={CreditCard} title="Поръчки" description="Изпълнение и плащания" onClick={() => onAction('orders')} />
              <WorkShortcut icon={Mail} title="Запитвания" description="Нови клиентски заявки" onClick={() => onAction('inquiries')} />
            </div>
          </ProfileWorkspaceSurface>
        </div>

        <aside className="space-y-5">
          <TrustCard
            preview={safePreview}
            completion={safeCompletion}
            portfolioCount={safePortfolio.length}
            serviceCount={services.length}
            publishedServiceCount={publishedServices.length}
            rating={rating}
            reviewCount={reviewCount}
            accountStatus={safePreview.isPublished ? 'Одобрен профил' : 'Скрит профил'}
            onImprove={() => onAction(nextSteps[0]?.tab || 'profile', nextSteps[0])}
          />
          <SubscriptionStatusCard
            state={subscriptionState}
            onManage={onManageSubscription}
            onRefresh={onRefreshSubscription}
            onCancel={onCancelSubscription}
            onResume={onResumeSubscription}
            onResendEmail={onResendSubscriptionEmail}
          />
        </aside>
      </div>
    </div>
  )
}

function PriorityActionCard({ action, project, onAction, onOpenPayments, onManageSubscription }) {
  const inquiry = action.inquiry || null
  const city = project?.city || inquiry?.city || ''
  const budget = project ? formatMoneyRange(project.budget_min, project.budget_max, project.budget_currency || 'EUR') : ''
  const facts = inquiry ? [
    { label: 'Тип', value: getInquirySourceLabel(inquiry.source) },
    { label: 'Статус', value: getInquiryStatusLabel(inquiry.status) },
    city ? { label: 'Град', value: city } : null,
    budget ? { label: 'Бюджет', value: budget } : null,
  ].filter(Boolean) : []
  const problem = action.kind === 'problem'

  function handleAction() {
    if (action.target === 'payments') return onOpenPayments?.()
    if (action.target === 'subscription') return onManageSubscription?.()
    return onAction(action.target, action.focusId ? { focusId: action.focusId } : undefined)
  }

  return (
    <section className={`overflow-hidden rounded-3xl border p-5 md:p-6 ${problem ? 'border-red-200 bg-red-50/70' : action.kind === 'inquiry' ? 'border-accentDeep/25 bg-accentSoft/45' : 'border-accentDeep/20 bg-gradient-to-br from-paper to-accentSoft/40'}`}>
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${problem ? 'text-red-700' : 'text-accentDeep'}`}>{action.eyebrow}</div>
          <h2 className="mt-2 font-display text-[clamp(1.9rem,4vw,2.6rem)] leading-[1.05] text-ink">{action.title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted md:text-[15px]">{action.description}</p>
        </div>
        <button type="button" onClick={handleAction} className="btn btn-primary shrink-0 justify-center md:self-end">{action.cta}<ArrowRight size={17} /></button>
      </div>
      {facts.length ? (
        <dl className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {facts.map((fact) => <MiniFact key={fact.label} label={fact.label} value={fact.value} />)}
        </dl>
      ) : null}
    </section>
  )
}

function OverviewMetric({ label, value, detail, icon: Icon, onClick }) {
  const Component = onClick ? 'button' : 'div'
  return (
    <Component type={onClick ? 'button' : undefined} onClick={onClick} className={`min-w-0 rounded-2xl bg-soft/65 p-4 text-left ${onClick ? 'transition hover:bg-accentSoft/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentDeep/25' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</div>
          <div className="mt-2 font-display text-2xl leading-none text-ink">{value}</div>
          <div className="mt-2 text-xs leading-5 text-muted">{detail}</div>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-paper text-accentDeep"><Icon size={16} /></span>
      </div>
    </Component>
  )
}

function WorkShortcut({ icon: Icon, title, description, onClick }) {
  return (
    <button type="button" onClick={onClick} className="group flex min-h-20 items-center gap-3 rounded-2xl border border-line bg-soft/60 p-4 text-left outline-none transition hover:border-accentDeep/35 hover:bg-accentSoft/35 focus-visible:ring-2 focus-visible:ring-accentDeep/25">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-paper text-accentDeep"><Icon size={17} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>
      </span>
      <ArrowRight size={15} className="shrink-0 text-accentDeep transition group-hover:translate-x-0.5" />
    </button>
  )
}

function SubscriptionStatusCard({ state, onManage, onRefresh, onCancel, onResume, onResendEmail }) {
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const subscription = state?.subscription
  const isLoading = state?.status === 'loading'
  const isOpening = state?.status === 'opening'
  const isUpdating = state?.status === 'updating' || state?.status === 'notifying'

  const active = Boolean(subscription?.active)
  const canManage = Boolean(subscription?.stripeCustomerId)
  const endLabel = getPartnerSubscriptionEndLabel(subscription)

  const isConfirming = !active && state?.checkoutSuccess && !state?.confirmingExpired
  const isConfirmedPending = active && state?.checkoutSuccess
  const isConfirmFailed = !active && state?.checkoutSuccess && state?.confirmingExpired
  const isActivePartner = active && !state?.checkoutSuccess
  const isNoSubscription = !active && !state?.checkoutSuccess

  let cardClass = 'border-amber-100 bg-amber-50/70'
  let iconClass = 'border-amber-200 bg-amber-100 text-amber-700'
  let icon = <Lock size={18} />

  if (active) {
    cardClass = 'border-emerald-200 bg-paper'
    iconClass = 'border-emerald-200 bg-white/80 text-emerald-600'
    icon = <Check size={18} />
  } else if (isConfirmFailed) {
    cardClass = 'border-red-200 bg-red-50/70'
    iconClass = 'border-red-200 bg-red-100 text-red-700'
    icon = <X size={18} />
  } else if (isConfirming) {
    cardClass = 'border-blue-200 bg-blue-50/70'
    iconClass = 'border-blue-200 bg-blue-100 text-blue-700'
    icon = <Loader2 size={18} className="animate-spin" />
  }

  let title = ''
  let body = ''
  let statusLabel = 'На пауза'
  let planLabel = subscription?.plan?.planName || (subscription?.status === 'founding_free' ? 'Активен партньор' : 'Няма активен план')

  if (isNoSubscription) {
    title = 'Нямате активен партньорски план'
    body = 'Изберете план, за да активирате профила си и да бъдете видими за клиенти.'
    statusLabel = subscription?.statusLabel || 'На пауза'
  } else if (isConfirming) {
    title = 'Абонаментното плащане се потвърждава'
    body = 'Ако вече сте завършили плащането, профилът ви ще се активира автоматично. Това обикновено отнема до 1 минута. Няма нужда да плащате повторно.'
    statusLabel = 'Потвърждаване'
  } else if (isConfirmedPending) {
    title = 'Абонаментното плащане е получено'
    body = 'Активираме партньорския ви профил. Това обикновено отнема до 1 минута. Няма нужда да плащате повторно.'
    statusLabel = 'Активиране'
  } else if (isActivePartner) {
    title = subscription?.cancelAtPeriodEnd
      ? 'Планът остава активен до края на периода'
      : 'Профилът ви е активен'
    body = subscription?.cancelAtPeriodEnd
      ? 'Автоматичното подновяване е спряно. Профилът и партньорските функции остават активни до края на вече платения период.'
      : 'Вече сте активен партньор в Totsan.'
    statusLabel = subscription?.cancelAtPeriodEnd
      ? 'Спира в края на периода'
      : subscription?.statusLabel || 'Активен'
  } else if (isConfirmFailed) {
    title = 'Не успяхме да потвърдим абонаментното плащане'
    body = 'Ако сумата е изтеглена, не плащайте повторно. Свържете се с нас и ще проверим веднага.'
    statusLabel = 'Проблем с абонаментното плащане'
  }

  const endPrefix = subscription?.status === 'founding_free'
    ? 'Промо до'
    : subscription?.status === 'trialing'
      ? 'Пробен период до'
      : subscription?.cancelAtPeriodEnd
        ? 'Активен до'
        : 'Следващо подновяване'

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-line bg-paper p-5">
        <div className="h-4 w-32 rounded-full bg-soft" />
        <div className="mt-4 h-7 w-48 rounded-full bg-soft" />
        <div className="mt-3 h-4 w-full rounded-full bg-soft" />
      </section>
    )
  }

  return (
    <section className={`rounded-3xl border p-5 ${cardClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${active ? 'text-emerald-700' : isConfirmFailed ? 'text-red-700' : isConfirming ? 'text-blue-700' : 'text-muted'}`}>Абонамент</div>
          <h3 className={`mt-2 text-xl font-semibold ${active ? 'text-emerald-950' : isConfirmFailed ? 'text-red-950' : isConfirming ? 'text-blue-950' : 'text-ink'}`}>{title}</h3>
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${iconClass}`}>
          {icon}
        </span>
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div className={`rounded-2xl border px-3 py-2 ${active ? 'border-emerald-100 bg-white/75' : isConfirmFailed ? 'border-red-100 bg-paper/75' : isConfirming ? 'border-blue-100 bg-white/75' : 'border-amber-100 bg-paper/75'}`}>
          <div className={`text-xs ${active ? 'text-emerald-700' : isConfirmFailed ? 'text-red-700' : isConfirming ? 'text-blue-700' : 'text-muted'}`}>План</div>
          <div className={`mt-1 font-semibold ${active ? 'text-emerald-950' : isConfirmFailed ? 'text-red-950' : isConfirming ? 'text-blue-950' : 'text-ink'}`}>{planLabel}</div>
        </div>
        <div className={`rounded-2xl border px-3 py-2 ${active ? 'border-emerald-100 bg-white/75' : isConfirmFailed ? 'border-red-100 bg-paper/75' : isConfirming ? 'border-blue-100 bg-white/75' : 'border-amber-100 bg-paper/75'}`}>
          <div className={`text-xs ${active ? 'text-emerald-700' : isConfirmFailed ? 'text-red-700' : isConfirming ? 'text-blue-700' : 'text-muted'}`}>Статус</div>
          <div className={`mt-1 font-semibold ${active ? 'text-emerald-950' : isConfirmFailed ? 'text-red-950' : isConfirming ? 'text-blue-950' : 'text-ink'}`}>{statusLabel}</div>
        </div>
      </div>

      {endLabel && active && (
        <p className="mt-3 text-sm leading-6 text-muted">{endPrefix}: <span className="font-semibold text-ink">{endLabel}</span></p>
      )}

      <p className={`mt-3 text-sm leading-6 ${active ? 'text-emerald-800' : isConfirmFailed ? 'text-red-800' : isConfirming ? 'text-blue-800' : 'text-muted'}`}>
        {body}
      </p>

      {state?.message && !isConfirming && !isConfirmedPending && !isConfirmFailed && (
        <div className={`mt-3 rounded-2xl px-3 py-2 text-sm ${state.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-paper/80 text-muted'}`}>
          {state.message}
        </div>
      )}

      <div className="mt-5 grid gap-2">
        {isNoSubscription && (
          <>
            <Link to="/pro#pro-plans" className="btn btn-primary justify-center">
              Избери план
            </Link>
            {canManage && (
              <button type="button" onClick={onManage} disabled={isOpening} className="btn btn-ghost justify-center">
                <CreditCard size={18} /> {isOpening ? 'Отваря се...' : 'Управлявай'}
              </button>
            )}
          </>
        )}

        {(isConfirming || isConfirmedPending) && (
          <button type="button" onClick={onRefresh} className="btn btn-primary justify-center">
            <Loader2 size={18} className="animate-spin" /> Провери статуса
          </button>
        )}

        {isActivePartner && (
          <div className="grid min-w-0 gap-2">
            {canManage && (
              <button type="button" onClick={onManage} disabled={isOpening || isUpdating} className="btn btn-primary w-full justify-center">
                <CreditCard size={18} /> {isOpening ? 'Отваря се...' : 'Управлявай'}
              </button>
            )}
            {(subscription?.stripeSubscriptionId || subscription?.invoiceUrl) && (
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                {subscription?.stripeSubscriptionId && (
                  <button type="button" onClick={onResendEmail} disabled={isUpdating} className="btn btn-ghost min-w-0 justify-center !px-3 text-sm">
                    {state?.status === 'notifying' ? <Loader2 size={17} className="shrink-0 animate-spin" /> : <Mail size={17} className="shrink-0" />}
                    <span className="truncate">{state?.status === 'notifying' ? 'Изпращаме…' : 'Потвърждение'}</span>
                  </button>
                )}
                {subscription?.invoiceUrl && (
                  <a
                    href={subscription.invoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost min-w-0 justify-center !px-3 text-sm"
                  >
                    <FileText size={17} className="shrink-0" /> <span className="truncate">Фактура</span>
                  </a>
                )}
              </div>
            )}
            {subscription?.stripeSubscriptionId && subscription?.cancelAtPeriodEnd && (
              <button type="button" onClick={onResume} disabled={isUpdating} className="btn btn-ghost w-full justify-center text-sm">
                {isUpdating ? <Loader2 size={18} className="animate-spin" /> : <PlayCircle size={18} />}
                {isUpdating ? 'Запазваме…' : 'Възстанови подновяването'}
              </button>
            )}
            {subscription?.stripeSubscriptionId && !subscription?.cancelAtPeriodEnd && !confirmingCancel && (
              <button type="button" onClick={() => setConfirmingCancel(true)} disabled={isUpdating} className="btn w-full justify-center border border-red-200 bg-red-50/70 text-sm text-red-700 hover:bg-red-100">
                <CircleDot size={18} /> Спри подновяването
              </button>
            )}
          </div>
        )}

        {isConfirmFailed && (
          <Link to="/kontakt" className="btn btn-primary justify-center">
            Пиши ни
          </Link>
        )}
      </div>

      {isActivePartner && confirmingCancel && !subscription?.cancelAtPeriodEnd && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="font-semibold text-red-900">Да спрем ли автоматичното подновяване?</div>
          <p className="mt-1 text-sm leading-6 text-red-800">
            Няма да губите достъп сега. Планът остава активен до {endLabel || 'края на платения период'} и след това няма да бъде таксуван отново.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setConfirmingCancel(false)
                onCancel()
              }}
              disabled={isUpdating}
              className="btn justify-center border border-red-300 bg-red-600 text-white hover:bg-red-700"
            >
              {isUpdating ? 'Спираме…' : 'Да, спри подновяването'}
            </button>
            <button type="button" onClick={() => setConfirmingCancel(false)} disabled={isUpdating} className="btn btn-ghost justify-center">
              Запази абонамента
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function getDashboardNextSteps({ preview, completion, portfolio, services }) {
  const steps = []
  const hasContact = Boolean(preview.phone || preview.emailPublic || preview.website)

  if (!preview.isPublished) {
    steps.push({ title: 'Публикувай профила', description: 'Профилът е скрит и не се вижда в каталога.', cta: 'Редактирай профила', tab: 'profile' })
  }
  if (!hasContact) {
    steps.push({ title: 'Добави контакт', description: 'Контактът помага на клиента да ти се довери преди разговор.', cta: 'Добави контакт', tab: 'profile', focusId: 'partner-contact-fields' })
  }
  if (!preview.serviceAreas?.length) {
    steps.push({ title: 'Добави райони', description: 'Посочи къде работиш, за да получаваш по-точни заявки.', cta: 'Добави райони', tab: 'profile', focusId: 'partner-service-areas-field' })
  }
  if (!preview.pricingNote && services.length === 0) {
    steps.push({ title: 'Добави цени или услуга', description: 'Ясните услуги и ценови насоки намаляват празните разговори.', cta: 'Добави услуги', tab: 'services' })
  }
  if (!portfolio.length) {
    steps.push({ title: 'Добави портфолио', description: 'Проектите са най-бързият начин да покажеш качество.', cta: 'Добави проект', tab: 'portfolio' })
  }
  if (completion.percent >= 90 && steps.length === 0) {
    steps.push({ title: 'Следи заявките', description: 'Профилът е в добра форма. Следващата работа ще се появи в заявките.', cta: 'Виж заявки', tab: 'inquiries' })
  }

  return steps
}

function TrustCard({ preview, completion, accountStatus, onImprove }) {
  const items = [
    { label: 'Секции', value: `${completion.done}/${completion.total}`, ok: completion.percent === 100 },
    { label: 'Каталог', value: preview.isPublished ? 'Видим' : 'Скрит', ok: preview.isPublished },
    { label: 'Статус', value: accountStatus, ok: preview.isPublished },
  ]

  return (
    <section className="rounded-3xl border border-line bg-paper p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Профил</div>
          <h3 className="mt-2 font-display text-2xl text-ink">Готовност</h3>
        </div>
        <div className="font-display text-4xl leading-none text-ink">{completion.percent}%</div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-soft" role="progressbar" aria-label="Завършеност на профила" aria-valuemin="0" aria-valuemax="100" aria-valuenow={completion.percent}>
        <div className="h-full rounded-full bg-accentDeep transition-all" style={{ width: `${completion.percent}%` }} />
      </div>
      <div className="mt-4 grid gap-2">
        {items.map(item => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl bg-soft/75 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-amber-400'}`} aria-hidden="true" />
              <span className="truncate text-sm font-medium text-ink">{item.label}</span>
            </div>
            <span className="max-w-[55%] truncate text-right text-sm text-muted">{item.value}</span>
          </div>
        ))}
      </div>
      {completion.percent < 100 ? <button type="button" onClick={onImprove} className="btn btn-ghost mt-4 w-full justify-center">Подобри профила</button> : null}
    </section>
  )
}

function MiniFact({ label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-soft px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-ink">{value}</div>
    </div>
  )
}

function SavePanel({ state, idleMessage, savingLabel = 'Запазва се…', saveLabel = 'Запази', onCancel }) {
  return (
    <FloatingSaveBar
      state={state}
      idleMessage={idleMessage}
      savingLabel={savingLabel}
      saveLabel={saveLabel}
      onCancel={onCancel}
      disabled={state.status === 'saving' || state.status === 'uploading'}
    />
  )
}

function ProfileForm({
  draft,
  saveState,
  accountDisplayName,
  hasNameMismatch,
  onChange,
  onAddSocialLink,
  onUpdateSocialLink,
  onRemoveSocialLink,
  onSubmit,
  onCancel,
}) {
  const bioLength = String(draft.bio || '').length
  const descriptionLength = String(draft.descriptionLong || '').length

  function updateLimitedText(key, value, limit) {
    onChange(key, String(value || '').slice(0, limit))
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 pb-28">
      <ProfileIntroCard />

      <ProfileSection number="1" icon={UserRound} title="Основна информация" className="scroll-mt-28">
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="xl:col-span-4">
            <Field label="Име / фирма"><input value={draft.name} onChange={event => onChange('name', event.target.value)} className={INPUT} /></Field>
          </div>
          <div className="xl:col-span-4">
            <Field label="Основна специализация"><input value={draft.headline} onChange={event => onChange('headline', event.target.value)} className={INPUT} placeholder="Напр. ВиК ремонт и поддръжка" /></Field>
          </div>
          <div className="xl:col-span-4">
            <Field label="Категория / роля"><input value={draft.tag} onChange={event => onChange('tag', event.target.value)} className={INPUT} placeholder="Напр. специалист, студио, изпълнител" /></Field>
          </div>

          {hasNameMismatch && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 xl:col-span-8">
              Името в акаунта и името в публичния профил са различни.
              {accountDisplayName && <span className="mt-1 block text-xs text-amber-800">Име в акаунта: {accountDisplayName}</span>}
            </div>
          )}
          <label className={`flex items-start gap-3 rounded-2xl border border-line bg-soft p-4 text-sm text-muted ${hasNameMismatch ? 'xl:col-span-4' : 'xl:col-span-12'}`}>
            <input type="checkbox" checked={draft.syncAccountName} onChange={event => onChange('syncAccountName', event.target.checked)} className="mt-1 accent-black" />
            <span>Синхронизирай и името в акаунта</span>
          </label>

          <div className="xl:col-span-3">
            <TotsanSelect label="Слой" value={draft.layerSlug} onChange={(value) => onChange('layerSlug', value)} options={LAYERS.map(layer => ({ value: layer.slug, label: `Слой ${layer.number} · ${layer.title}` }))} />
          </div>
          <div className="xl:col-span-5">
            <LocationCombobox label="Град и основен район" value={draft.city} onChange={(value) => onChange('city', value)} required helper="" />
          </div>
          <div className="sm:max-xl:max-w-40 xl:col-span-2">
            <Field label="Години опит"><input type="number" min="0" max="100" inputMode="numeric" value={draft.yearsExperience} onChange={event => onChange('yearsExperience', event.target.value)} className={COMPACT_INPUT} /></Field>
          </div>
          <div className="sm:max-xl:max-w-40 xl:col-span-2">
            <Field label="Проекти"><input type="number" min="0" inputMode="numeric" value={draft.projects} onChange={event => onChange('projects', event.target.value)} className={COMPACT_INPUT} /></Field>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Field label={<FieldLabelWithCounter label="Кратко позициониране" count={bioLength} limit={PROFILE_BIO_LIMIT} />}>
            <textarea rows={4} maxLength={PROFILE_BIO_LIMIT} value={draft.bio} onChange={event => updateLimitedText('bio', event.target.value, PROFILE_BIO_LIMIT)} className={`${INPUT} min-h-32 resize-y`} placeholder="Напишете с 1–2 изречения с какво помагате на клиентите. Например: „Помагам с интериорни концепции, разпределения и 3D визуализации за жилища.“" />
            <p className="mt-2 text-xs font-normal text-muted">
              Това описание се вижда публично. Използвайте само вярна информация.
            </p>
          </Field>
          <Field label={<FieldLabelWithCounter label="С какво може да помогнете" count={descriptionLength} limit={PROFILE_DESCRIPTION_LIMIT} />}>
            <textarea rows={4} maxLength={PROFILE_DESCRIPTION_LIMIT} value={draft.descriptionLong} onChange={event => updateLimitedText('descriptionLong', event.target.value, PROFILE_DESCRIPTION_LIMIT)} className={`${INPUT} min-h-32 resize-y`} placeholder="Опишете конкретните задачи, услуги и тип обекти, с които помагате." />
          </Field>
        </div>
      </ProfileSection>

      <ProfileSection number="2" icon={MapPin} title="Локация и покритие">
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="xl:col-span-3">
            <Field label="Езици"><input value={draft.languagesText} onChange={event => onChange('languagesText', event.target.value)} className={INPUT} placeholder="Български, Английски" /></Field>
          </div>
          <div id="partner-service-areas-field" className="xl:col-span-9">
            <LocationMultiCombobox label="Райони на работа" value={draft.serviceAreasText} onChange={(value) => onChange('serviceAreasText', value)} />
          </div>
        </div>
      </ProfileSection>

      <ProfileSection number="3" icon={Link2} title="Контакти и линкове">
        <div id="partner-contact-fields" className="grid gap-4 md:grid-cols-3 scroll-mt-28">
          <Field label="Телефон"><input value={draft.phone} onChange={event => onChange('phone', event.target.value)} type="tel" className={INPUT} /></Field>
          <Field label="Публичен имейл"><input value={draft.emailPublic} onChange={event => onChange('emailPublic', event.target.value)} type="email" className={INPUT} /></Field>
          <Field label="Сайт"><input value={draft.website} onChange={event => onChange('website', event.target.value)} className={INPUT} placeholder="https://" /></Field>
        </div>
        <div className="rounded-3xl border border-line bg-soft/60 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-ink">Допълнителни социални мрежи</div>
            </div>
            {draft.socialLinks.length < 3 && (
              <button type="button" onClick={onAddSocialLink} className="btn btn-ghost justify-center">
                <Plus size={18} />
                Добави
              </button>
            )}
          </div>
          {draft.socialLinks.length > 0 && (
            <div className="mt-4 space-y-3">
              {draft.socialLinks.map(link => (
                <div key={link.id} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <Field label="Линк"><input value={link.url} onChange={event => onUpdateSocialLink(link.id, event.target.value)} className={INPUT} placeholder="https://" /></Field>
                  <button type="button" onClick={() => onRemoveSocialLink(link.id)} className="btn btn-ghost justify-center text-red-700">
                    <Trash2 size={18} />
                    Махни
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-line bg-soft/65 px-4 py-3 text-sm text-muted">
          Тези данни са публични и ще помогнат на клиентите да се свържат с Вас по-лесно.
        </div>
      </ProfileSection>



      <FloatingSaveBar
        state={saveState}
        idleMessage="Промените се пазят след запазване."
        saveLabel="Запази профила"
        onCancel={onCancel}
        disabled={saveState.status === 'saving' || saveState.status === 'uploading'}
      />
    </form>
  )
}

const PORTFOLIO_GUIDE_STEPS = [
  { id: 'basics', label: 'Карта', icon: FolderKanban, helper: 'Заглавие, слой, град, година и акцент за бързата карта.' },
  { id: 'story', label: 'История', icon: FileText, helper: 'Кратко описание какво беше, какво направи и какъв е резултатът.' },
  { id: 'media', label: 'Медии', icon: Camera, helper: 'Снимки и видео, които продават проекта визуално.' },
  { id: 'publish', label: 'Видимост', icon: Globe2, helper: 'Дали проектът е публичен в портфолиото и как ще се показва.' },
]

function PortfolioEditor({ items, draft, state, onSelect, onNew, onChange, onSubmit, onUpload, onDelete }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [portfolioFilter, setPortfolioFilter] = useState('all')
  const sortedItems = Array.isArray(items) ? items : []
  const publicCount = sortedItems.filter(item => item.isPublished).length
  const hiddenCount = sortedItems.filter(item => !item.isPublished).length
  const withVideoCount = sortedItems.filter(item => Array.isArray(item.media) && item.media.some(mediaItem => isVideoMedia(mediaItem))).length
  const filteredItems = useMemo(() => {
    if (portfolioFilter === 'public') return sortedItems.filter(item => item.isPublished)
    if (portfolioFilter === 'hidden') return sortedItems.filter(item => !item.isPublished)
    if (portfolioFilter === 'video') return sortedItems.filter(item => Array.isArray(item.media) && item.media.some(mediaItem => isVideoMedia(mediaItem)))
    return sortedItems
  }, [portfolioFilter, sortedItems])

  useEffect(() => {
    if (!isModalOpen) return undefined
    const scrollY = window.scrollY
    const previousHtmlOverflow = document.documentElement.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    const previousBodyPosition = document.body.style.position
    const previousBodyTop = document.body.style.top
    const previousBodyLeft = document.body.style.left
    const previousBodyRight = document.body.style.right
    const previousBodyWidth = document.body.style.width
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      document.body.style.position = previousBodyPosition
      document.body.style.top = previousBodyTop
      document.body.style.left = previousBodyLeft
      document.body.style.right = previousBodyRight
      document.body.style.width = previousBodyWidth
      window.scrollTo(0, scrollY)
    }
  }, [isModalOpen])

  function openNewProject() {
    onNew()
    setIsModalOpen(true)
  }

  function openProject(item) {
    onSelect(item)
    setIsModalOpen(true)
  }

  async function handleDelete() {
    if (!draft.id) return
    if (!window.confirm('Сигурни ли сте, че искате да изтриете този проект?')) return
    await onDelete(draft.id)
    setIsModalOpen(false)
  }

  async function handleSubmit(event) {
    const didSave = await onSubmit(event)
    if (didSave) setIsModalOpen(false)
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-line bg-paper p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="eyebrow">Портфолио</div>
            <h2 className="mt-2 font-display text-3xl leading-tight text-ink md:text-4xl">Проекти като продуктови карти</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Покажи най-важното първо: снимка, заглавие, слой, град, година и силен акцент. Детайлите се отварят в popup.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-soft px-4 py-3 text-sm text-muted">
            {sortedItems.length ? `${sortedItems.length} проекта` : 'Още няма проекти'}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PortfolioStatTile label="Всички" value={sortedItems.length} active={portfolioFilter === 'all'} onClick={() => setPortfolioFilter('all')} />
          <PortfolioStatTile label="Публични" value={publicCount} tone="green" active={portfolioFilter === 'public'} onClick={() => setPortfolioFilter('public')} />
          <PortfolioStatTile label="Скрити" value={hiddenCount} tone="blue" active={portfolioFilter === 'hidden'} onClick={() => setPortfolioFilter('hidden')} />
          <PortfolioStatTile label="С видео" value={withVideoCount} active={portfolioFilter === 'video'} onClick={() => setPortfolioFilter('video')} />
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <button
            type="button"
            onClick={openNewProject}
            className="group flex min-h-[24rem] flex-col justify-between overflow-hidden rounded-[1.75rem] border border-dashed border-accent/45 bg-[linear-gradient(135deg,rgba(244,248,252,0.92),rgba(255,255,255,0.72))] p-5 text-left shadow-[0_14px_44px_rgba(13,35,64,0.04)] transition duration-300 hover:-translate-y-1 hover:scale-[1.015] hover:border-accent/70 hover:shadow-[0_26px_70px_rgba(13,35,64,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          >
            <div className="flex aspect-[4/3] items-center justify-center rounded-[1.35rem] border border-white/80 bg-paper/80 text-accentDeep shadow-inner">
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-paper shadow-lg transition group-hover:scale-105">
                  <Plus size={26} />
                </span>
                <div className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Нов проект</div>
              </div>
            </div>
            <div className="pt-5">
              <h3 className="font-display text-3xl leading-none text-ink">Добави портфолио проект</h3>
              <p className="mt-2 text-sm leading-6 text-muted">Бърза карта с основна снимка, заглавие, град, слой и кратко описание.</p>
              <span className="mt-4 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">Създай карта</span>
            </div>
          </button>

          {filteredItems.map(item => (
            <PortfolioProjectCard key={item.id} item={item} active={draft.id === item.id && isModalOpen} onOpen={() => openProject(item)} />
          ))}
        </div>
      </section>

      {isModalOpen && createPortal(
        <PortfolioProjectDialog
          draft={draft}
          state={state}
          onClose={() => setIsModalOpen(false)}
          onChange={onChange}
          onSubmit={handleSubmit}
          onUpload={onUpload}
          onDelete={handleDelete}
        />,
        document.body,
      )}
    </div>
  )
}

function getPortfolioLayer(item = {}) {
  return LAYERS.find(layer => layer.slug === item.layerSlug || layer.slug === item.layer_slug) || null
}

function isVideoMedia(item = {}) {
  return item.type === 'video' || item.provider === 'youtube' || item.kind === 'video'
}

function getYoutubeVideoId(url = '') {
  const value = String(url || '').trim()
  if (!value) return ''

  try {
    const parsed = new URL(value)
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.replace('/', '').split(/[?&]/)[0]
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2] || ''
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] || ''
      return parsed.searchParams.get('v') || ''
    }
  } catch {
    const match = value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&/\s]+)/)
    return match?.[1] || ''
  }

  return ''
}

function normalizeVideoUrl(url = '') {
  const value = String(url || '').trim()
  if (!value) return ''
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    const parsed = new URL(candidate)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : ''
  } catch {
    return ''
  }
}

function getYoutubeThumbnail(url = '') {
  const id = getYoutubeVideoId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : ''
}

function getYoutubeEmbedUrl(url = '') {
  const id = getYoutubeVideoId(url)
  return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&enablejsapi=1` : ''
}

function getMediaPreviewUrl(item = {}) {
  if (!item) return ''
  if (isVideoMedia(item)) return item.thumbnail || getYoutubeThumbnail(item.url) || ''
  return item.url || ''
}

function getCoverFromMedia(media = []) {
  const firstVisual = media.find(item => getMediaPreviewUrl(item))
  return firstVisual ? getMediaPreviewUrl(firstVisual) : ''
}

function getPortfolioImage(item = {}) {
  const media = Array.isArray(item.media) ? item.media : []
  return getCoverFromMedia(media) || item.coverUrl || item.cover_url || ''
}

function getMediaSortKey(item = {}, index = 0) {
  return item.path || item.url || item.thumbnail || item.caption || `${item.provider || item.type || 'media'}-${index}`
}

function getPortfolioMeta(item = {}) {
  return [item.city, item.year].filter(Boolean).join(' · ')
}

function PortfolioProjectCard({ item, active = false, onOpen }) {
  const image = getPortfolioImage(item)
  const layer = getPortfolioLayer(item)
  const meta = getPortfolioMeta(item)
  const accent = item.budgetBand || item.budget_band || 'Проект от практиката'

  let pills = []
  if (accent.includes(',')) {
    pills = accent.split(',').map(s => s.trim()).filter(Boolean)
  } else if (accent.includes('·')) {
    pills = accent.split('·').map(s => s.trim()).filter(Boolean)
  } else {
    pills = [accent.trim()].filter(Boolean)
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group overflow-hidden rounded-[1.75rem] border text-left shadow-[0_14px_44px_rgba(13,35,64,0.06)] transition duration-300 hover:-translate-y-1 hover:scale-[1.015] hover:shadow-[0_28px_75px_rgba(13,35,64,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${active ? 'border-ink bg-soft' : 'border-white/75 bg-paper hover:border-ink/15'}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-soft">
        {image ? (
          <img src={image} alt={item.title || 'Портфолио проект'} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.06]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(217,230,244,0.86),rgba(255,255,255,0.82))] text-sm text-muted">
            Няма снимка
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink/58 to-transparent" />
        <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${item.isPublished ? 'bg-white/90 text-ink' : 'bg-amber-100 text-amber-800'}`}>
          {item.isPublished ? 'Публичен' : 'Скрит'}
        </span>
        <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-1.5">
          {pills.slice(0, 5).map((pill, idx) => (
            <span
              key={idx}
              className="rounded-full border border-white/15 bg-ink/28 px-3 py-1 text-xs font-semibold text-paper backdrop-blur-md whitespace-nowrap"
            >
              {pill}
            </span>
          ))}
        </div>
      </div>

      <div className="p-5">
        <h3 className="line-clamp-2 font-display text-2xl leading-none text-ink">{item.title || 'Проект без заглавие'}</h3>
        <p className="mt-3 line-clamp-2 min-h-[2.75rem] text-sm leading-6 text-muted">
          {item.description || 'Добави кратко описание: проблем, роля, решение и резултат.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {layer && <span className="rounded-full bg-soft px-3 py-1 text-xs font-semibold text-accentDeep">Слой {layer.number} · {layer.title}</span>}
          {meta && <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted">{meta}</span>}
        </div>
      </div>
    </button>
  )
}

function PortfolioProjectModal({ draft, state, onClose, onChange, onSubmit, onUpload, onDelete }) {
  const media = Array.isArray(draft.media) ? draft.media : []
  const image = getPortfolioImage(draft)
  const layer = getPortfolioLayer(draft)
  const meta = getPortfolioMeta(draft)
  const [activeSection, setActiveSection] = useState('basics')
  const [showPreview, setShowPreview] = useState(true)
  const [videoUrl, setVideoUrl] = useState('')
  const [videoError, setVideoError] = useState('')
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const dragIndexRef = useRef(null)
  const dragOverIndexRef = useRef(null)
  const dragPointerIdRef = useRef(null)
  const isDraggingRef = useRef(false)
  const mediaListRef = useRef(null)
  const accentCount = (draft.budgetBand || '').split(',').map(s => s.trim()).filter(Boolean).length
  const checklist = getPortfolioChecklist(draft, media)
  const requiredChecks = getPortfolioRequiredChecks(draft, media)
  const missingRequired = requiredChecks.filter(item => !item.done)
  const completionPercent = Math.round((checklist.filter(item => item.done).length / checklist.length) * 100)

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape' && !isDraggingRef.current && state.status !== 'saving') onClose()
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      removePointerDragListeners()
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [onClose, state.status])

  function captureMediaRects() {
    const list = mediaListRef.current
    if (!list) return null
    return new Map(
      Array.from(list.querySelectorAll('[data-media-key]')).map((node) => [
        node.dataset.mediaKey,
        node.getBoundingClientRect(),
      ]),
    )
  }

  function animateMediaList(snapshot) {
    if (!snapshot) return
    window.requestAnimationFrame(() => {
      const list = mediaListRef.current
      if (!list) return
      const nodes = Array.from(list.querySelectorAll('[data-media-key]'))
      nodes.forEach((node) => {
        const before = snapshot.get(node.dataset.mediaKey)
        if (!before) return
        const after = node.getBoundingClientRect()
        const deltaX = before.left - after.left
        const deltaY = before.top - after.top
        if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return

        node.style.transition = 'none'
        node.style.transform = `translate(${deltaX}px, ${deltaY}px)`
        node.style.zIndex = '2'

        window.requestAnimationFrame(() => {
          node.style.transition = 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1)'
          node.style.transform = ''
          window.setTimeout(() => {
            node.style.transition = ''
            node.style.zIndex = ''
          }, 260)
        })
      })
    })
  }

  function updateMedia(nextMedia, options = {}) {
    const snapshot = options.animate ? captureMediaRects() : null
    onChange('media', nextMedia)
    onChange('coverUrl', getCoverFromMedia(nextMedia))
    animateMediaList(snapshot)
  }

  function handleReorder(fromIndex, toIndex) {
    const from = Number(fromIndex)
    const to = Number(toIndex)
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to || from < 0 || to < 0) return
    const nextMedia = [...media]
    const [moved] = nextMedia.splice(from, 1)
    if (!moved) return
    const insertionIndex = from < to ? to - 1 : to
    nextMedia.splice(insertionIndex, 0, moved)
    updateMedia(nextMedia, { animate: true })
  }

  function updateDropIndex(index) {
    if (dragIndexRef.current === null) return
    dragOverIndexRef.current = index
    setDragOverIndex(index)
  }

  function getDropIndex(clientY) {
    const rows = Array.from(mediaListRef.current?.querySelectorAll('[data-media-key]') || [])
    if (!rows.length) return 0

    const targetIndex = rows.findIndex((node) => {
      const rect = node.getBoundingClientRect()
      return clientY < rect.top + rect.height / 2
    })
    return targetIndex === -1 ? rows.length : targetIndex
  }

  function handlePointerDragStart(event, index) {
    if (event.button !== undefined && event.button !== 0) return
    event.preventDefault()
    dragIndexRef.current = index
    dragOverIndexRef.current = index
    dragPointerIdRef.current = event.pointerId
    isDraggingRef.current = true
    setDragIndex(index)
    setDragOverIndex(index)
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', handlePointerDragMove)
    window.addEventListener('pointerup', handlePointerDragEnd)
    window.addEventListener('pointercancel', handlePointerDragEnd)
  }

  function handlePointerDragMove(event) {
    if (!isDraggingRef.current) return
    if (dragPointerIdRef.current !== null && event.pointerId !== dragPointerIdRef.current) return
    event.preventDefault()
    updateDropIndex(getDropIndex(event.clientY))
  }

  function handlePointerDragEnd(event) {
    if (!isDraggingRef.current) return
    if (dragPointerIdRef.current !== null && event.pointerId !== dragPointerIdRef.current) return
    event.preventDefault()
    commitDrop(dragOverIndexRef.current ?? dragIndexRef.current)
  }

  function removePointerDragListeners() {
    window.removeEventListener('pointermove', handlePointerDragMove)
    window.removeEventListener('pointerup', handlePointerDragEnd)
    window.removeEventListener('pointercancel', handlePointerDragEnd)
  }

  function handleRemoveMedia(index) {
    updateMedia(media.filter((_, itemIndex) => itemIndex !== index), { animate: true })
  }

  function finishDrag() {
    removePointerDragListeners()
    dragIndexRef.current = null
    dragOverIndexRef.current = null
    dragPointerIdRef.current = null
    isDraggingRef.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function commitDrop(index) {
    const fromIndex = dragIndexRef.current
    if (fromIndex !== null) handleReorder(fromIndex, index)
    finishDrag()
  }

  function isDropSlotActive(index) {
    if (dragIndex === null || dragOverIndex !== index) return false
    return index !== dragIndex && index !== dragIndex + 1
  }

  function handleAddVideo() {
    const cleanUrl = normalizeVideoUrl(videoUrl)
    if (!cleanUrl) {
      setVideoError('Добави валиден YouTube или видео линк.')
      return
    }
    const youtubeId = getYoutubeVideoId(cleanUrl)
    updateMedia([
      ...media,
      {
        type: 'video',
        provider: youtubeId ? 'youtube' : 'link',
        url: cleanUrl,
        thumbnail: youtubeId ? getYoutubeThumbnail(cleanUrl) : '',
      },
    ])
    setVideoError('')
    setVideoUrl('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (missingRequired.length > 0) {
      setAttemptedSubmit(true)
      setActiveSection(missingRequired[0]?.step || 'basics')
      return
    }
    onSubmit(event)
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-ink/60 p-3 backdrop-blur-sm sm:p-5 lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={draft.id ? 'Редакция на портфолио проект' : 'Нов портфолио проект'}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDraggingRef.current) {
          event.preventDefault()
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="flex h-full items-center justify-center overflow-y-auto">
        <div className="relative w-[90vw] max-w-[1280px] overflow-hidden rounded-[2rem] border border-line bg-paper shadow-2xl">
          <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
            <div>
              <div className="eyebrow">Portfolio Project v1</div>
              <h3 className="mt-1 font-display text-3xl leading-none text-ink">{draft.id ? 'Редактирай проект' : 'Нов портфолио проект'}</h3>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-muted transition hover:bg-soft hover:text-ink" aria-label="Затвори">
              <X size={22} />
            </button>
          </div>

          <div className="grid max-h-[calc(100dvh-4rem)] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(25rem,0.96fr)] xl:grid-cols-[minmax(0,1.02fr)_minmax(30rem,0.98fr)]">
            <section className="min-w-0 bg-soft/60 p-4 sm:p-6 lg:p-7">
              <div className="overflow-hidden rounded-[1.65rem] border border-white/80 bg-paper shadow-[0_18px_55px_rgba(13,35,64,0.08)]">
                <div className="aspect-[16/10] bg-soft">
                  {image ? (
                    <img src={image} alt={draft.title || 'Портфолио проект'} className="h-full w-full object-cover" draggable={false} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted">Качи основна снимка, за да продава картата визуално.</div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap gap-2">
                    {layer && <span className="rounded-full bg-soft px-3 py-1 text-xs font-semibold text-accentDeep">Слой {layer.number} · {layer.title}</span>}
                    {draft.budgetBand && (() => {
                      let draftPills = []
                      const accentVal = draft.budgetBand
                      if (accentVal.includes(',')) {
                        draftPills = accentVal.split(',').map(s => s.trim()).filter(Boolean)
                      } else if (accentVal.includes('·')) {
                        draftPills = accentVal.split('·').map(s => s.trim()).filter(Boolean)
                      } else {
                        draftPills = [accentVal.trim()].filter(Boolean)
                      }
                      return draftPills.slice(0, 5).map((pill, idx) => (
                        <span key={idx} className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper">
                          {pill}
                        </span>
                      ))
                    })()}
                    {!draft.isPublished && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Скрит</span>}
                  </div>
                  <h4 className="mt-4 break-words font-display text-[clamp(2.2rem,4vw,3.25rem)] leading-none text-ink">{draft.title || 'Заглавие на проекта'}</h4>
                  <p className="mt-3 break-words text-sm leading-6 text-muted">{draft.description || 'Опиши накратко: какъв беше проблемът, каква беше твоята роля, какво решение даде и какъв е резултатът.'}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MiniFact label="Локация" value={draft.city || 'Не е посочена'} />
                <MiniFact label="Година" value={draft.year || 'Не е посочена'} />
                <MiniFact label="Акценти" value={draft.budgetBand || 'Добави акценти'} />
              </div>

              {media.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {media.map((item, index) => (
                    <div key={`${item.url}-${index}`} className="overflow-hidden rounded-2xl border border-line bg-paper">
                      <div className="aspect-[4/3] bg-soft">
                        {isVideoMedia(item) ? (
                          <LazyVideoEmbed item={item} title={draft.title || 'Видео към портфолио проект'} />
                        ) : (
                          <img src={getMediaPreviewUrl(item)} alt={item.caption || draft.title || 'Портфолио'} className="img-cover" draggable={false} />
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-muted">
                        <span className="truncate">{index === 0 ? 'Основна медия' : `Медия ${index + 1}`}</span>
                        {isVideoMedia(item) && <span className="rounded-full bg-ink px-2 py-0.5 text-paper">Видео</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {meta && <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{meta}</p>}
            </section>

            <form onSubmit={handleSubmit} className="min-w-0 space-y-5 p-4 sm:p-6 lg:p-7">
              <div className="rounded-3xl border border-line bg-soft/70 p-4">
                <div className="text-sm font-semibold text-ink">Бърза формула</div>
                <p className="mt-1 text-sm leading-6 text-muted">Проблем → Роля → Решение → Резултат. Достатъчно е кратко, но конкретно.</p>
              </div>

              <PortfolioValidationPanel checks={requiredChecks} attempted={attemptedSubmit} />

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Заглавие"><input value={draft.title} onChange={event => onChange('title', event.target.value)} className={INPUT} placeholder="Модерна баня в Русе" /></Field>
                <Field label="Слой"><TotsanSelect value={draft.layerSlug} onChange={(value) => onChange('layerSlug', value)} options={LAYERS.map(layer => ({ value: layer.slug, label: `Слой ${layer.number} · ${layer.title}` }))} /></Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="min-w-0 xl:col-span-2">
                  <LocationCombobox
                    label={<LabelWithHelp text="Град" help="Избери град от официалния списък." />}
                    value={draft.city}
                    onChange={(value) => onChange('city', value)}
                    helper=""
                  />
                </div>
                <Field label="Година"><input type="number" min="1900" max="2100" value={draft.year} onChange={event => onChange('year', event.target.value)} className={INPUT} /></Field>
                <Field label={<FieldLabelWithCounter label="Акценти" count={accentCount} limit={5} />}>
                  <input
                    value={draft.budgetBand}
                    onChange={event => onChange('budgetBand', event.target.value)}
                    className={`${INPUT} ${accentCount > 5 ? 'border-red-500 focus:ring-red-500' : ''}`}
                    placeholder="55 кв.м., Минимализъм, Преди/След"
                  />
                  {accentCount > 5 && (
                    <p className="mt-1 text-xs text-red-500 font-medium">Моля, въведете до 5 акцента.</p>
                  )}
                </Field>
              </div>

              <Field label="Кратко описание"><textarea rows={5} value={draft.description} onChange={event => onChange('description', event.target.value)} className={INPUT} placeholder="Проблем → роля → решение → резултат" /></Field>

              <label className="btn btn-ghost w-full cursor-pointer justify-center">
                <ImagePlus size={18} /> Качи снимки към проекта
                <input type="file" accept="image/*" multiple className="sr-only" onChange={async (event) => { await onUpload(event.target.files); event.target.value = '' }} />
              </label>

              <div className="rounded-3xl border border-line bg-soft/70 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-paper text-accentDeep shadow-sm">
                    <Video size={18} />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-ink">Добави видео с линк</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    inputMode="url"
                    value={videoUrl}
                    onChange={(event) => {
                      setVideoUrl(event.target.value)
                      if (videoError) setVideoError('')
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleAddVideo()
                      }
                    }}
                    className="min-w-0 flex-1 rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink"
                    placeholder="youtube.com/watch?v=..."
                  />
                  <button type="button" onClick={handleAddVideo} disabled={!videoUrl.trim()} className="btn btn-ghost justify-center sm:w-auto">
                    <Link2 size={18} /> Добави
                  </button>
                </div>
                {videoError && <div className="mt-2 text-sm text-red-700">{videoError}</div>}
              </div>

              {media.length > 0 && (
                <div className="rounded-3xl border border-line bg-paper/80 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-ink">Медии към проекта</div>
                      <p className="mt-1 text-sm leading-6 text-muted">Първата позиция е основната снимка/визия. Хвани ред и го премести нагоре или надолу.</p>
                    </div>
                    <span className="rounded-full bg-soft px-3 py-1 text-xs font-semibold text-muted">{media.length}</span>
                  </div>
                  <div
                    ref={mediaListRef}
                    className="mt-4 space-y-2"
                  >
                    {media.map((item, index) => (
                      <div key={getMediaSortKey(item, index)} className="space-y-2">
                        <DropSlot active={isDropSlotActive(index)} />
                        <PortfolioMediaManagerItem
                          mediaKey={getMediaSortKey(item, index)}
                          item={item}
                          index={index}
                          isDragging={dragIndex === index}
                          isDragTarget={false}
                          onPointerDown={(event) => handlePointerDragStart(event, index)}
                          onRemove={() => handleRemoveMedia(index)}
                        />
                      </div>
                    ))}
                    <DropSlot active={isDropSlotActive(media.length)} />
                  </div>
                </div>
              )}

              <label className="flex items-start gap-3 rounded-2xl border border-line bg-soft p-4 text-sm text-muted">
                <input type="checkbox" checked={draft.isPublished} onChange={event => onChange('isPublished', event.target.checked)} className="mt-1 accent-black" />
                <span>Публикуван проект в публичното портфолио.</span>
              </label>

              {attemptedSubmit && missingRequired.length > 0 && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {missingRequired[0].message}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className={`text-sm ${state.status === 'error' ? 'text-red-700' : 'text-muted'}`}>{state.message || 'Запази проекта, за да се появи като продуктова карта.'}</div>
                <div className="flex shrink-0 gap-2">
                  {draft.id && <button type="button" onClick={onDelete} className="btn btn-ghost"><Trash2 size={18} /> Изтрий</button>}
                  <button className="btn btn-primary" disabled={state.status === 'saving'}><Save size={18} /> {state.status === 'saving' ? 'Запазва се…' : 'Запази'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

function PortfolioProjectDialog({ draft, state, onClose, onChange, onSubmit, onUpload, onDelete }) {
  const media = Array.isArray(draft.media) ? draft.media : []
  const layer = getPortfolioLayer(draft)
  const [activeSection, setActiveSection] = useState('basics')
  const [showPreview, setShowPreview] = useState(true)
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const checklist = getPortfolioChecklist(draft, media)
  const requiredChecks = getPortfolioRequiredChecks(draft, media)
  const missingRequired = requiredChecks.filter(item => !item.done)
  const completionPercent = Math.round((checklist.filter(item => item.done).length / checklist.length) * 100)
  const accentCount = (draft.budgetBand || '').split(',').map(s => s.trim()).filter(Boolean).length

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape' && state.status !== 'saving') onClose()
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose, state.status])

  function handleSave(event) {
    event.preventDefault()
    if (missingRequired.length > 0) {
      setAttemptedSubmit(true)
      setActiveSection(missingRequired[0]?.step || 'basics')
      return
    }
    onSubmit(event)
  }

  return (
    <div
      className="fixed inset-0 z-[100] h-[100dvh] w-screen overflow-hidden bg-ink/65 p-0 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={draft.id ? 'Редакция на портфолио проект' : 'Нов портфолио проект'}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && state.status !== 'saving') onClose()
      }}
    >
      <div className="flex h-full w-full items-stretch">
        <div className="relative flex h-full w-full flex-col overflow-hidden border border-line bg-paper shadow-2xl">
          <div className="shrink-0 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="eyebrow">Портфолио</div>
                <h3 className="mt-1 font-display text-3xl leading-none text-ink">{draft.id ? 'Редактирай проект' : 'Нов портфолио проект'}</h3>
              </div>
              <button type="button" onClick={onClose} disabled={state.status === 'saving'} className="rounded-full p-2 text-muted transition hover:bg-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-60" aria-label="Затвори">
                <X size={22} />
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="min-w-0 p-4 sm:p-5 lg:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-ink">
                    {(() => {
                      const ActiveIcon = PORTFOLIO_GUIDE_STEPS.find(step => step.id === activeSection)?.icon || FolderKanban
                      return <ActiveIcon size={18} className="text-accentDeep" />
                    })()}
                    Редакция
                  </div>
                  <h3 className="mt-2 font-display text-3xl text-ink">{PORTFOLIO_GUIDE_STEPS.find(step => step.id === activeSection)?.label}</h3>
                </div>
                <button type="button" onClick={() => setShowPreview(value => !value)} className="btn btn-ghost">
                  <Eye size={18} /> {showPreview ? 'Скрий преглед' : 'Покажи преглед'}
                </button>
              </div>

              <div className="mt-5 grid gap-2 md:grid-cols-4">
                {PORTFOLIO_GUIDE_STEPS.map((step, index) => (
                  <PortfolioGuideStepButton
                    key={step.id}
                    step={step}
                    index={index}
                    active={activeSection === step.id}
                    done={stepDone(step.id, checklist)}
                    onClick={() => setActiveSection(step.id)}
                  />
                ))}
              </div>

              <form onSubmit={handleSave} className="mt-5 space-y-5">
                {activeSection === 'basics' && (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Заглавие"><input value={draft.title} onChange={event => onChange('title', event.target.value)} className={INPUT} placeholder="Хармония в едно помещение" /></Field>
                      <Field label="Слой"><TotsanSelect className="mt-2" value={draft.layerSlug} onChange={(value) => onChange('layerSlug', value)} placeholder="Избери слой" options={LAYERS.map(item => ({ value: item.slug, label: `Слой ${item.number} · ${item.title}` }))} /></Field>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="min-w-0 xl:col-span-2">
                        <LocationCombobox
                          label={<LabelWithHelp text="Град" help="Избери град от официалния списък." />}
                          value={draft.city}
                          onChange={(value) => onChange('city', value)}
                          helper=""
                        />
                      </div>
                      <Field label="Година"><input type="number" min="1900" max="2100" value={draft.year} onChange={event => onChange('year', event.target.value)} className={INPUT} placeholder="2025" /></Field>
                      <Field label={<FieldLabelWithCounter label="Акценти" count={accentCount} limit={5} />}>
                        <input
                          value={draft.budgetBand}
                          onChange={event => onChange('budgetBand', event.target.value)}
                          className={`${INPUT} ${accentCount > 5 ? 'border-red-500 focus:ring-red-500' : ''}`}
                          placeholder="55 кв.м., Минимализъм, Преди/След"
                        />
                        {accentCount > 5 && (
                          <p className="mt-1 text-xs text-red-500 font-medium">Моля, въведете до 5 акцента.</p>
                        )}
                      </Field>
                    </div>
                  </>
                )}

                {activeSection === 'story' && (
                  <>
                    <div className="rounded-3xl border border-line bg-soft/70 p-4">
                      <div className="text-sm font-semibold text-ink">Бърза формула</div>
                      <p className="mt-1 text-sm leading-6 text-muted">Проблем → Роля → Решение → Резултат. Достатъчно е кратко, но конкретно.</p>
                    </div>
                    <Field label="Кратко описание"><textarea rows={6} value={draft.description} onChange={event => onChange('description', event.target.value)} className={INPUT} placeholder="Опиши накратко: какъв беше проблемът, каква беше твоята роля, какво решение даде и какъв е резултатът." /></Field>
                  </>
                )}

                {activeSection === 'media' && <PortfolioMediaWorkspace draft={draft} onChange={onChange} onUpload={onUpload} />}

                {activeSection === 'publish' && (
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-line bg-soft/70 p-4">
                      <div className="text-sm font-semibold text-ink">Публичност</div>
                      <p className="mt-1 text-sm leading-6 text-muted">Когато проектът е публичен, се показва в портфолиото на профила. Ако е скрит, остава само за вътрешна работа.</p>
                    </div>
                    <label className="flex items-start gap-3 rounded-2xl border border-line bg-soft p-4 text-sm text-muted">
                      <input type="checkbox" checked={draft.isPublished} onChange={event => onChange('isPublished', event.target.checked)} className="mt-1 accent-black" />
                      <span>Публикуван проект в публичното портфолио.</span>
                    </label>
                  </div>
                )}

                {showPreview && (
                  <div className="mt-7 rounded-3xl border border-line bg-soft/60 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="eyebrow">Преглед</div>
                        <h3 className="mt-2 font-display text-3xl text-ink">Как ще изглежда за клиента</h3>
                      </div>
                    </div>
                    <div className="pointer-events-none mt-5 max-w-[26rem]">
                      <PortfolioProjectCard item={draft} onOpen={() => {}} />
                    </div>
                  </div>
                )}
              </form>
            </div>

            <aside className="space-y-4 border-t border-line bg-soft/50 p-4 sm:p-5 lg:border-l lg:border-t-0">
              <PortfolioValidationPanel checks={requiredChecks} attempted={attemptedSubmit} onSelectStep={setActiveSection} />
              <PortfolioReadinessPanel checklist={checklist} percent={completionPercent} />
              <PortfolioVisibilityPanel draft={draft} state={state} />
              <PortfolioHelpPanel section={activeSection} layer={layer} />
            </aside>
          </div>

          <div className="shrink-0 border-t border-line bg-paper/95 px-4 py-3 shadow-[0_-18px_40px_rgba(7,31,55,0.08)] backdrop-blur sm:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className={`text-sm ${state.status === 'error' ? 'text-red-700' : 'text-muted'}`}>{state.message || 'Запази проекта, за да се покаже като продуктова карта в портфолиото.'}</div>
              <div className="flex flex-wrap gap-2">
                {draft.id && <button type="button" onClick={onDelete} disabled={state.status === 'saving'} className="btn btn-ghost"><Trash2 size={18} /> Изтрий</button>}
                <button type="button" onClick={handleSave} className="btn btn-primary" disabled={state.status === 'saving'}><Save size={18} /> {state.status === 'saving' ? 'Запазва се…' : 'Запази'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PortfolioMediaWorkspace({ draft, onChange, onUpload }) {
  const media = Array.isArray(draft.media) ? draft.media : []
  const [videoUrl, setVideoUrl] = useState('')
  const [videoError, setVideoError] = useState('')
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const mediaListRef = useRef(null)
  const dragIndexRef = useRef(null)
  const dragOverIndexRef = useRef(null)
  const dragPointerIdRef = useRef(null)
  const isDraggingRef = useRef(false)

  useEffect(() => () => {
    removePointerDragListeners()
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  function captureMediaRects() {
    const list = mediaListRef.current
    if (!list) return null
    return new Map(Array.from(list.querySelectorAll('[data-media-key]')).map((node) => [node.dataset.mediaKey, node.getBoundingClientRect()]))
  }

  function animateMediaList(snapshot) {
    if (!snapshot) return
    window.requestAnimationFrame(() => {
      const list = mediaListRef.current
      if (!list) return
      Array.from(list.querySelectorAll('[data-media-key]')).forEach((node) => {
        const before = snapshot.get(node.dataset.mediaKey)
        if (!before) return
        const after = node.getBoundingClientRect()
        const deltaX = before.left - after.left
        const deltaY = before.top - after.top
        if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return

        node.style.transition = 'none'
        node.style.transform = `translate(${deltaX}px, ${deltaY}px)`
        node.style.zIndex = '2'

        window.requestAnimationFrame(() => {
          node.style.transition = 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1)'
          node.style.transform = ''
          window.setTimeout(() => {
            node.style.transition = ''
            node.style.zIndex = ''
          }, 260)
        })
      })
    })
  }

  function updateMedia(nextMedia, options = {}) {
    const snapshot = options.animate ? captureMediaRects() : null
    onChange('media', nextMedia)
    onChange('coverUrl', getCoverFromMedia(nextMedia))
    animateMediaList(snapshot)
  }

  function handleReorder(fromIndex, toIndex) {
    const from = Number(fromIndex)
    const to = Number(toIndex)
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to || from < 0 || to < 0) return
    const nextMedia = [...media]
    const [moved] = nextMedia.splice(from, 1)
    if (!moved) return
    const insertionIndex = from < to ? to - 1 : to
    nextMedia.splice(insertionIndex, 0, moved)
    updateMedia(nextMedia, { animate: true })
  }

  function updateDropIndex(index) {
    if (dragIndexRef.current === null) return
    dragOverIndexRef.current = index
    setDragOverIndex(index)
  }

  function getDropIndex(clientY) {
    const rows = Array.from(mediaListRef.current?.querySelectorAll('[data-media-key]') || [])
    if (!rows.length) return 0
    const targetIndex = rows.findIndex((node) => {
      const rect = node.getBoundingClientRect()
      return clientY < rect.top + rect.height / 2
    })
    return targetIndex === -1 ? rows.length : targetIndex
  }

  function handlePointerDragStart(event, index) {
    if (event.button !== undefined && event.button !== 0) return
    event.preventDefault()
    dragIndexRef.current = index
    dragOverIndexRef.current = index
    dragPointerIdRef.current = event.pointerId
    isDraggingRef.current = true
    setDragIndex(index)
    setDragOverIndex(index)
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', handlePointerDragMove)
    window.addEventListener('pointerup', handlePointerDragEnd)
    window.addEventListener('pointercancel', handlePointerDragEnd)
  }

  function handlePointerDragMove(event) {
    if (!isDraggingRef.current) return
    if (dragPointerIdRef.current !== null && event.pointerId !== dragPointerIdRef.current) return
    event.preventDefault()
    updateDropIndex(getDropIndex(event.clientY))
  }

  function handlePointerDragEnd(event) {
    if (!isDraggingRef.current) return
    if (dragPointerIdRef.current !== null && event.pointerId !== dragPointerIdRef.current) return
    event.preventDefault()
    commitDrop(dragOverIndexRef.current ?? dragIndexRef.current)
  }

  function removePointerDragListeners() {
    window.removeEventListener('pointermove', handlePointerDragMove)
    window.removeEventListener('pointerup', handlePointerDragEnd)
    window.removeEventListener('pointercancel', handlePointerDragEnd)
  }

  function finishDrag() {
    removePointerDragListeners()
    dragIndexRef.current = null
    dragOverIndexRef.current = null
    dragPointerIdRef.current = null
    isDraggingRef.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function commitDrop(index) {
    const fromIndex = dragIndexRef.current
    if (fromIndex !== null) handleReorder(fromIndex, index)
    finishDrag()
  }

  function isDropSlotActive(index) {
    if (dragIndex === null || dragOverIndex !== index) return false
    return index !== dragIndex && index !== dragIndex + 1
  }

  function handleAddVideo() {
    const cleanUrl = normalizeVideoUrl(videoUrl)
    if (!cleanUrl) {
      setVideoError('Добави валиден YouTube или видео линк.')
      return
    }
    const youtubeId = getYoutubeVideoId(cleanUrl)
    updateMedia([
      ...media,
      {
        type: 'video',
        provider: youtubeId ? 'youtube' : 'link',
        url: cleanUrl,
        thumbnail: youtubeId ? getYoutubeThumbnail(cleanUrl) : '',
      },
    ])
    setVideoError('')
    setVideoUrl('')
  }

  function handleRemoveMedia(index) {
    updateMedia(media.filter((_, itemIndex) => itemIndex !== index), { animate: true })
  }

  return (
    <div className="space-y-5">
      <label className="btn btn-ghost w-full cursor-pointer justify-center">
        <ImagePlus size={18} /> Качи снимки към проекта
        <input type="file" accept="image/*" multiple className="sr-only" onChange={async (event) => { await onUpload(event.target.files); event.target.value = '' }} />
      </label>

      <div className="rounded-3xl border border-line bg-soft/70 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-paper text-accentDeep shadow-sm">
            <Video size={18} />
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">Добави видео с линк</div>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            inputMode="url"
            value={videoUrl}
            onChange={(event) => {
              setVideoUrl(event.target.value)
              if (videoError) setVideoError('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleAddVideo()
              }
            }}
            className="min-w-0 flex-1 rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink"
            placeholder="youtube.com/watch?v=..."
          />
          <button type="button" onClick={handleAddVideo} disabled={!videoUrl.trim()} className="btn btn-ghost justify-center sm:w-auto">
            <Link2 size={18} /> Добави
          </button>
        </div>
        {videoError && <div className="mt-2 text-sm text-red-700">{videoError}</div>}
      </div>

      {media.length > 0 && (
        <div className="rounded-3xl border border-line bg-paper/80 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-ink">Медии към проекта</div>
              <p className="mt-1 text-sm leading-6 text-muted">Първата позиция е основната снимка/визия. Хвани ред и го премести нагоре или надолу.</p>
            </div>
            <span className="rounded-full bg-soft px-3 py-1 text-xs font-semibold text-muted">{media.length}</span>
          </div>
          <div ref={mediaListRef} className="mt-4 space-y-2">
            {media.map((item, index) => (
              <div key={getMediaSortKey(item, index)} className="space-y-2">
                <DropSlot active={isDropSlotActive(index)} />
                <PortfolioMediaManagerItem
                  mediaKey={getMediaSortKey(item, index)}
                  item={item}
                  index={index}
                  isDragging={dragIndex === index}
                  isDragTarget={false}
                  onPointerDown={(event) => handlePointerDragStart(event, index)}
                  onRemove={() => handleRemoveMedia(index)}
                />
              </div>
            ))}
            <DropSlot active={isDropSlotActive(media.length)} />
          </div>
        </div>
      )}
    </div>
  )
}

function PortfolioStatTile({ label, value, tone = 'neutral', active = false, onClick }) {
  const toneClass = tone === 'green'
    ? 'bg-trustGreen/10 text-trustGreen'
    : tone === 'blue'
      ? 'bg-accentSoft text-accentDeep'
      : 'bg-soft text-ink'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-2xl border bg-paper p-4 text-left transition hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-sm ${active ? 'border-ink shadow-sm ring-2 ring-ink/5' : 'border-line'}`}
    >
      <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className={`mt-2 inline-flex rounded-full px-3 py-1 font-display text-2xl ${toneClass}`}>{value}</div>
    </button>
  )
}

function PortfolioGuideStepButton({ step, index, active, done, onClick }) {
  const Icon = step.icon

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3 py-3 text-left transition ${active ? 'border-ink bg-ink text-paper' : 'border-line bg-soft text-ink hover:border-ink/30'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${active ? 'bg-paper/12' : 'bg-paper'}`}>
            <Icon size={15} />
          </span>
          <div>
            <div className={`text-[11px] uppercase tracking-[0.14em] ${active ? 'text-paper/60' : 'text-muted'}`}>Стъпка {index + 1}</div>
            <div className="font-medium">{step.label}</div>
          </div>
        </div>
        {done && <Check size={18} className={active ? 'text-paper' : 'text-trustGreen'} />}
      </div>
      <p className={`mt-1.5 line-clamp-2 text-xs leading-5 ${active ? 'text-paper/65' : 'text-muted'}`}>{step.helper}</p>
    </button>
  )
}

function getPortfolioChecklist(draft, media) {
  return [
    { key: 'title', label: 'Има ясно заглавие', done: Boolean(String(draft.title || '').trim()) },
    { key: 'layer', label: 'Избран е слой', done: Boolean(String(draft.layerSlug || '').trim()) },
    { key: 'city', label: 'Има град', done: Boolean(String(draft.city || '').trim()) },
    { key: 'year', label: 'Има година', done: Boolean(String(draft.year || '').trim()) },
    { key: 'accent', label: 'Има силен акцент', done: Boolean(String(draft.budgetBand || '').trim()) },
    { key: 'description', label: 'Има кратка история', done: Boolean(String(draft.description || '').trim()) },
    { key: 'media', label: 'Има поне една медия', done: media.length > 0 },
  ]
}

function getPortfolioRequiredChecks(draft, media) {
  return [
    {
      key: 'title',
      step: 'basics',
      label: 'Заглавие',
      message: 'Добави заглавие на проекта.',
      done: Boolean(String(draft.title || '').trim()),
    },
    {
      key: 'layer',
      step: 'basics',
      label: 'Слой',
      message: 'Избери слой, за да подредим проекта правилно в профила.',
      done: Boolean(String(draft.layerSlug || '').trim()),
    },
    {
      key: 'description',
      step: 'story',
      label: 'Кратко описание',
      message: 'Опиши накратко проблем, роля, решение и резултат.',
      done: Boolean(String(draft.description || '').trim()),
    },
    {
      key: 'media',
      step: 'media',
      label: 'Поне една медия',
      message: 'Добави поне една снимка или видео към проекта.',
      done: media.length > 0,
    },
  ]
}

function PortfolioValidationPanel({ checks, attempted, onSelectStep }) {
  const missing = checks.filter(item => !item.done)
  const complete = missing.length === 0

  return (
    <div className={`rounded-3xl border p-4 ${complete ? 'border-emerald-100 bg-emerald-50' : attempted ? 'border-red-100 bg-red-50' : 'border-line bg-paper'}`}>
      <div className={`text-sm font-semibold ${complete ? 'text-emerald-800' : attempted ? 'text-red-700' : 'text-ink'}`}>
        {complete ? 'Готово за запазване' : attempted ? 'Остава още малко' : 'Задължително за портфолио'}
      </div>
      <p className={`mt-1 text-sm leading-5 ${complete ? 'text-emerald-800/80' : attempted ? 'text-red-700/80' : 'text-muted'}`}>
        {complete ? 'Всички задължителни елементи са попълнени.' : 'Можеш да запазиш проекта по всяко време, но за добра карта попълни тези полета.'}
      </p>
      <div className="mt-3 space-y-2">
        {checks.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelectStep?.(item.step)}
            className={`flex w-full items-start gap-2 rounded-2xl px-3 py-2 text-left text-sm transition ${item.done ? 'bg-paper/70 text-ink' : attempted ? 'bg-white/70 text-red-700 hover:bg-white' : 'bg-soft text-muted hover:bg-paper'}`}
          >
            <span className="flex items-start gap-2 font-medium">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${item.done ? 'bg-trustGreen text-paper' : attempted ? 'bg-red-100 text-red-700' : 'bg-paper text-muted'}`}>
                {item.done ? <Check size={13} /> : <CircleDot size={13} />}
              </span>
              <span>
                <span className="block font-medium">{item.label}</span>
                {!item.done && attempted && <span className="mt-1 block text-xs leading-5">{item.message}</span>}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function PortfolioReadinessPanel({ checklist, percent }) {
  return (
    <div className="rounded-3xl border border-line bg-paper p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-ink">Готовност</div>
          <div className="mt-1 text-sm text-muted">{percent}% попълнено</div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-soft font-display text-xl text-ink">{percent}</div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-soft">
        <div className="h-full rounded-full bg-accentDeep transition-all" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-4 space-y-2">
        {checklist.map(item => (
          <div key={item.key} className="flex items-start gap-2 text-sm">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${item.done ? 'bg-trustGreen text-paper' : 'bg-soft text-muted'}`}>
              {item.done ? <Check size={13} /> : <CircleDot size={13} />}
            </span>
            <span className={item.done ? 'text-ink' : 'text-muted'}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PortfolioVisibilityPanel({ draft, state }) {
  return (
    <div className={`rounded-3xl border p-5 ${draft.isPublished ? 'border-trustGreen/30 bg-trustGreen/5' : 'border-line bg-paper'}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        {draft.isPublished ? <Check size={18} className="text-trustGreen" /> : <CircleDot size={18} className="text-muted" />}
        {draft.isPublished ? 'Видим за клиенти' : 'Скрит проект'}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">
        {draft.isPublished ? 'Показва се в публичното портфолио на профила.' : 'Остава видим само за теб, докато не решиш да го публикуваш.'}
      </p>
      {state.message && state.status !== 'idle' && (
        <div className={`mt-3 rounded-xl px-3 py-2 text-xs ${state.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-soft text-muted'}`}>
          {state.message}
        </div>
      )}
    </div>
  )
}

function PortfolioHelpPanel({ section, layer }) {
  const content = {
    basics: {
      title: 'Какво вижда клиентът първо',
      lines: ['Кратко и ясно заглавие.', 'Акценти, които хващат окото.', 'Град и слой, за да има контекст.'],
    },
    story: {
      title: 'Как да разкажеш проекта',
      lines: ['Какъв беше проблемът?', 'Какво пое ти като роля?', 'Какво стана след изпълнението?'],
    },
    media: {
      title: 'Кои снимки помагат най-много',
      lines: ['Широк кадър на помещението.', 'Детайл или материален акцент.', 'Видео, ако имаш процес или walkthrough.'],
    },
    publish: {
      title: 'Кога да го пуснеш публично',
      lines: ['Когато картата изглежда завършена.', 'Когато имаш силна основна снимка.', 'Когато описанието е конкретно и полезно.'],
    },
  }[section]

  return (
    <div className="rounded-3xl border border-line bg-soft p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        <FolderKanban size={18} className="text-accentDeep" />
        {content.title}
      </div>
      <div className="mt-3 space-y-2">
        {content.lines.map(line => (
          <div key={line} className="flex gap-2 text-sm leading-6 text-muted">
            <Check size={15} className="mt-1 shrink-0 text-accentDeep" />
            <span>{line}</span>
          </div>
        ))}
      </div>
      {layer && (
        <div className="mt-4 rounded-2xl border border-line bg-paper p-3 text-sm text-muted">
          Текущ слой: <span className="font-medium text-ink">{layer.number}. {layer.title}</span>
        </div>
      )}
    </div>
  )
}

function stepDone(stepId, checklist) {
  const keysByStep = {
    basics: ['title', 'layer', 'city', 'year', 'accent'],
    story: ['description'],
    media: ['media'],
    publish: [],
  }
  const keys = keysByStep[stepId] || []
  if (!keys.length) return stepId === 'publish'
  return keys.every(key => checklist.find(item => item.key === key)?.done)
}

function PortfolioMediaManagerItem({ item, index, mediaKey, isDragging, isDragTarget, onPointerDown, onRemove }) {
  const isVideo = isVideoMedia(item)
  const preview = getMediaPreviewUrl(item)
  const label = isVideo ? (item.provider === 'youtube' ? 'YouTube видео' : 'Видео линк') : 'Снимка'
  const source = item.caption || item.url || item.thumbnail || 'Медия към проекта'
  const stateClass = isDragging
    ? 'relative z-10 scale-[1.035] -translate-y-0.5 rotate-[0.25deg] border-accentDeep bg-paper shadow-[0_22px_60px_rgba(13,35,64,0.18)] ring-4 ring-accent/20'
    : isDragTarget
      ? 'scale-[0.985] border-accent/50 bg-accent/10 shadow-inner'
      : 'border-line bg-soft/65 hover:-translate-y-0.5 hover:border-ink/15 hover:bg-paper hover:shadow-[0_12px_30px_rgba(13,35,64,0.07)]'

  return (
    <div
      data-media-key={mediaKey}
      className={`group flex transform-gpu select-none items-center gap-3 rounded-2xl border p-2 will-change-transform transition-[transform,box-shadow,border-color,background-color,opacity] duration-200 ease-out ${stateClass}`}
    >
      <span
        role="button"
        tabIndex={0}
        onPointerDown={onPointerDown}
        className={`touch-none flex h-12 w-9 shrink-0 cursor-grab select-none items-center justify-center rounded-2xl transition active:cursor-grabbing ${isDragging ? 'cursor-grabbing bg-ink text-paper shadow-sm' : 'text-muted group-hover:bg-paper group-hover:text-ink'}`}
        aria-label="Премести медия"
      >
        <GripVertical size={19} />
      </span>
      <div className={`relative h-14 w-16 shrink-0 overflow-hidden rounded-xl border bg-paper transition ${isDragging ? 'border-accentDeep shadow-sm' : 'border-line'}`}>
        {preview ? (
          <img src={preview} alt="" className="pointer-events-none img-cover select-none" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <Video size={18} />
          </div>
        )}
        {isVideo && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/28 text-paper">
            <PlayCircle size={17} />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${index === 0 ? 'bg-ink text-paper' : 'bg-paper text-muted'}`}>
            {index === 0 ? 'Основна' : `#${index + 1}`}
          </span>
          <span className="text-sm font-semibold text-ink">{label}</span>
        </div>
        <div className="mt-1 truncate text-xs text-muted">{source}</div>
      </div>
      <button type="button" onClick={onRemove} className="rounded-full p-2 text-muted transition hover:bg-red-50 hover:text-red-700" aria-label="Премахни медия">
        <Trash2 size={16} />
      </button>
    </div>
  )
}

function DropSlot({ active }) {
  return (
    <div
      aria-hidden="true"
      className={`overflow-hidden rounded-2xl transition-all duration-200 ease-out ${active ? 'h-6 opacity-100' : 'h-0 opacity-0'}`}
    >
      <div className="flex h-full items-center rounded-2xl border border-dashed border-accent/45 bg-accent/10 px-3">
        <div className="h-1.5 w-full rounded-full bg-accent/35" />
      </div>
    </div>
  )
}

function LabelWithHelp({ text, help }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span>{text}</span>
      <HelpTooltip text={help} />
    </span>
  )
}

function HelpTooltip({ text }) {
  const id = useId()
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={text}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-line bg-paper text-[11px] font-semibold leading-none text-muted transition hover:border-ink/25 hover:text-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
      >
        ?
      </button>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-2xl bg-ink px-3 py-2 text-left text-xs font-medium leading-5 text-paper shadow-[0_18px_45px_rgba(13,35,64,0.24)] transition ${open ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}`}
      >
        {text}
      </span>
    </span>
  )
}

function LazyVideoEmbed({ item, title }) {
  const containerRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)
  const embedUrl = getYoutubeEmbedUrl(item.url)
  const thumbnail = getMediaPreviewUrl(item)
  const safeUrl = normalizeVideoUrl(item.url)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return undefined
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.35 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  if (!embedUrl) {
    return (
      <div ref={containerRef} className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[linear-gradient(135deg,rgba(13,35,64,0.92),rgba(25,84,143,0.72))] p-4 text-center text-paper">
        <Video size={26} />
        <div className="text-sm font-semibold">Видео линк</div>
        {safeUrl && (
          <a href={safeUrl} target="_blank" rel="noreferrer" className="rounded-full bg-white/16 px-3 py-1 text-xs font-semibold transition hover:bg-white/24">
            Отвори
          </a>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-ink">
      {isVisible ? (
        <iframe
          key={embedUrl}
          src={embedUrl}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <div className="relative h-full w-full">
          {thumbnail ? <img src={thumbnail} alt="" className="img-cover opacity-75" draggable={false} /> : <div className="h-full w-full bg-ink" />}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/35 text-paper">
            <PlayCircle size={34} />
            <span className="text-xs font-semibold uppercase tracking-[0.16em]">Видео</span>
          </div>
        </div>
      )}
    </div>
  )
}

function ContactPreview({ profile, onEdit }) {
  const contacts = [
    profile.phone,
    profile.emailPublic,
    profile.website,
    profile.instagram,
    profile.facebook,
  ].filter(Boolean)

  return (
    <div className="rounded-3xl border border-line bg-paper p-5 md:p-7">
      <div className="eyebrow">Контакт</div>
      <h2 className="mt-2 font-display text-3xl text-ink">Публични канали</h2>
      {contacts.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {contacts.map(contact => <div key={contact} className="rounded-2xl border border-line bg-soft p-4 text-sm text-ink"><Globe2 size={18} className="mb-2 text-accentDeep" />{contact}</div>)}
        </div>
      ) : (
        <p className="mt-4 text-muted">Няма попълнени публични контактни полета.</p>
      )}
      <button type="button" onClick={onEdit} className="btn btn-primary mt-6">Редактирай контакти</button>
    </div>
  )
}

function ProfileIntroCard() {
  return (
    <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
      <div className="flex items-start gap-4">
        <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] border border-line bg-soft text-accentDeep">
          <UserRound size={24} />
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-ink">Основна информация</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            Актуализирайте данните на Вашия профил. Информацията е видима публично и помага на клиентите да разберат с какво точно се занимавате.
          </p>
        </div>
      </div>
    </div>
  )
}

function ProfileSection({ number, icon: Icon, title, children, className = '' }) {
  return (
    <section className={`rounded-3xl border border-line bg-paper p-5 md:p-6 ${className}`.trim()}>
      <div className="flex items-center gap-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-soft text-accentDeep">
          <Icon size={20} />
        </div>
        <h3 className="text-xl font-semibold text-ink">{number}. {title}</h3>
      </div>
      <div className="mt-5 space-y-4">
        {children}
      </div>
    </section>
  )
}

function FieldLabelWithCounter({ label, count, limit }) {
  return (
    <span className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className={`text-xs font-medium ${count >= limit ? 'text-amber-700' : 'text-muted'}`}>{count} / {limit}</span>
    </span>
  )
}

function Field({ label, children }) {
  return <div className="min-w-0 block text-sm font-medium text-ink">{label}{children}</div>
}

function Range({ label, value, min, max, step, onChange }) {
  return (
    <label className="block text-sm font-medium text-ink">
      <span className="flex items-center justify-between gap-4"><span>{label}</span><span className="text-xs text-muted">{Number(value).toFixed(step < 1 ? 2 : 0)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} className="mt-3 w-full accent-black" />
    </label>
  )
}
