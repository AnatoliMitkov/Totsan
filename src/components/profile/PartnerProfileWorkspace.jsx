import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BriefcaseBusiness,
  Camera,
  Check,
  CircleDot,
  Compass,
  CreditCard,
  Eye,
  FolderKanban,
  GripVertical,
  Globe2,
  Home,
  ImagePlus,
  Link2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessagesSquare,
  PlayCircle,
  Plus,
  Save,
  Send,
  Tags,
  Trash2,
  UserRound,
  Video,
  X,
} from 'lucide-react'
import { LAYERS } from '../../data/layers.js'
import { uploadProfileMedia, uploadProfileCover } from '../../lib/profile-media-upload-client.js'
import { getProfileImageStyle, isMissingLayer01MetaColumn, normalizeProfile, PROFILE_SELECT_COLUMNS_BASE, PROFILE_SELECT_COLUMNS_WITH_LAYER01 } from '../../lib/profiles.js'
import { supabase } from '../../lib/supabase.js'
import { getAccountDisplayName } from '../../lib/account.js'
import { saveCustomerAccountProfile } from '../../lib/projects.js'
import { refreshProfileAiSummary } from '../../lib/profile-ai-summary.js'
import { deleteStorageRefs, diffStorageRefs, mediaAndCoverStorageRefs } from '../../lib/storage-media-cleanup.js'
import TotpMfaManager from '../auth/TotpMfa.jsx'
import {
  DEFAULT_PORTFOLIO_ITEM,
  appendPortfolioMedia,
  deletePortfolioItem,
  loadProfilePortfolio,
  loadProfileStats,
  savePortfolioItem,
  uploadPortfolioImage,
} from '../../lib/portfolio.js'
import { createConnectOnboarding, getConnectStatus } from '../../lib/payments.js'
import { loadPartnerInquiries, loadInquiryProjects } from '../../lib/partner-inquiries.js'
import { loadPartnerServicesForProfile } from '../../lib/partner-services.js'
import { formatMoneyRange } from '../../lib/money.js'
import ImageCropperModal from './ImageCropperModal.jsx'
import Avatar from '../Avatar.jsx'
import PublicProfileBanner from './PublicProfileBanner.jsx'
import PublicProfileAvatar from './PublicProfileAvatar.jsx'
import PublicProfilePanel from './PublicProfilePanel.jsx'
import PartnerServiceEditor from './PartnerServiceEditor.jsx'
import PartnerMaterialsEditor from './PartnerMaterialsEditor.jsx'
import PartnerOrders from './PartnerOrders.jsx'
import PartnerInquiries from './PartnerInquiries.jsx'
import Layer01SpecEditor, { cleanLayer01Draft, makeLayer01Draft } from './Layer01SpecEditor.jsx'
import FloatingSaveBar from './FloatingSaveBar.jsx'
import TotsanSelect from '../ui/TotsanSelect.jsx'
import { LocationCombobox, LocationMultiCombobox } from '../ui/LocationCombobox.jsx'
import { normalizeLocationList, normalizeLocationValue } from '../../lib/locations.js'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'
const COMPACT_INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-3 py-3 text-sm outline-none transition focus:border-ink'
const MAX_BANNER_BYTES = 12 * 1024 * 1024
const PROFILE_BIO_LIMIT = 300
const PROFILE_DESCRIPTION_LIMIT = 500
const PROFILE_PRICING_LIMIT = 300
const PRICE_UNIT_OPTIONS = [
  { value: 'sqm', label: 'на квадратен метър', suffix: 'м²' },
  { value: 'hour', label: 'на час', suffix: 'час' },
  { value: 'linear_meter', label: 'на линеен метър', suffix: 'л.м.' },
  { value: 'day', label: 'на ден', suffix: 'ден' },
  { value: 'project', label: 'на проект', suffix: 'проект' },
]
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

function normalizePriceInput(value) {
  return String(value || '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '')
    .replace(/(\..*)\./g, '$1')
}

function getPriceUnit(value) {
  return PRICE_UNIT_OPTIONS.find((option) => option.value === value) || PRICE_UNIT_OPTIONS[0]
}

function detectPriceUnit(value) {
  const text = String(value || '').toLowerCase()
  if (text.includes('л.м') || text.includes('лине')) return 'linear_meter'
  if (text.includes('час')) return 'hour'
  if (text.includes('ден')) return 'day'
  if (text.includes('проект')) return 'project'
  return 'sqm'
}

function parsePriceGuide(value) {
  const text = String(value || '')
  const amount = normalizePriceInput(text.match(/\d+(?:[.,]\d+)?/)?.[0] || '')
  return { amount, unit: detectPriceUnit(text) }
}

function formatPriceGuide(amount, unit) {
  const normalizedAmount = normalizePriceInput(amount)
  if (!normalizedAmount) return ''
  return `${normalizedAmount}€/${getPriceUnit(unit).suffix}`
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
    instagram: profile.instagram || '',
    facebook: profile.facebook || '',
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
      return 'Stripe профилът е активен.'
    case 'pending_review':
      return 'Данните са изпратени към Stripe. Профилът чака преглед и може да отнеме малко време, преди плащанията да станат активни.'
    case 'needs_information':
      return 'Stripe има нужда от още данни, преди да активира плащанията.'
    default:
      return 'Проверихме Stripe профила.'
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
  const [avatarEditor, setAvatarEditor] = useState({ open: false, file: null, imageUrl: '', fileName: 'avatar.jpg' })
  const [bannerEditor, setBannerEditor] = useState({ open: false, file: null, imageUrl: '', fileName: 'banner.jpg', positionY: 50 })

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
    if (cropInfo.originalFile) {
      await uploadAvatar(cropInfo.originalFile, cropInfo.displayCrop)
      return
    }

    if (avatarEditor.imageUrl) {
      await saveAvatarPosition(cropInfo.displayCrop)
      return
    }

    await uploadAvatar(croppedFile, cropInfo.displayCrop)
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
    const params = new URLSearchParams(window.location.search)
    const paymentsState = params.get('payments')
    if (!paymentsState || !account?.stripe_account_id) return undefined

    let active = true
    setPaymentState({ status: 'saving', message: 'Проверяваме Stripe профила…' })

    async function loadStripeStatus() {
      try {
        const result = await getConnectStatus()
        if (!active) return
        setPaymentState({ status: result.status === 'needs_information' ? 'idle' : 'saved', message: paymentMessageFromStripe(result) })
      } catch (error) {
        if (!active) return
        setPaymentState({ status: 'error', message: error.message || 'Не успяхме да проверим Stripe профила.' })
      } finally {
        params.delete('payments')
        const query = params.toString()
        const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash || ''}`
        window.history.replaceState({}, '', nextUrl)
      }
    }

    loadStripeStatus()
    return () => { active = false }
  }, [account?.stripe_account_id])

  useEffect(() => {
    if (!account?.stripe_account_id) return undefined
    const params = new URLSearchParams(window.location.search)
    if (params.get('payments')) return undefined

    let active = true

    async function loadStripeStatusQuietly() {
      try {
        const result = await getConnectStatus()
        if (!active || !result?.status || result.status === 'not_started') return
        setPaymentState((current) => {
          if (current.status === 'opening' || current.status === 'saving') return current
          return {
            status: result.status === 'needs_information' ? 'idle' : 'saved',
            message: paymentMessageFromStripe(result),
          }
        })
      } catch {
        // Keep the page usable even if Stripe status cannot be loaded in the background.
      }
    }

    loadStripeStatusQuietly()
    return () => { active = false }
  }, [account?.stripe_account_id])

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

  function openWorkspaceTarget(target = 'profile', options = {}) {
    if (target === 'inbox') {
      navigate('/inbox')
      return
    }

    setActiveTab(target)
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
      const result = await uploadProfileMedia({ file, target: userId })
      const nextImageUrl = result.publicUrl || result.signedUrl || ''
      if (!nextImageUrl) throw new Error('Снимката е качена, но липсва валиден адрес.')
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
      instagram: profileDraft.instagram.trim() || null,
      facebook: profileDraft.facebook.trim() || null,
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
    setPaymentState({ status: 'opening', message: 'Отваряме Stripe onboarding…' })
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
      setPaymentState({ status: 'saved', message: 'Плащанията са активирани.' })
    } catch (error) {
      setPaymentState({ status: 'error', message: error.message || 'Плащанията не се активираха.' })
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
      <PublicProfileBanner
        imageSrc={preview.coverUrl || ''}
        imageAlt=""
        imageStyle={{ objectPosition: `50% ${preview.coverY ?? 50}%` }}
        heightClass="h-[clamp(12.5rem,52vw,15rem)] md:aspect-[1600/520] md:h-auto md:min-h-0"
        className="group cursor-pointer focus-within:ring-2 focus-within:ring-ink"
        onClick={openBannerEditor}
        placeholderLabel="Добавете банер"
        placeholderClassName="hidden md:grid"
      >
      </PublicProfileBanner>
      {/* Keep the file input outside the clickable banner to avoid recursive input.click() bubbling. */}
      <input
        id="partner-cover-upload"
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleCoverFileChange}
      />
      <div className="relative z-10 flex flex-col bg-soft pb-16 md:pb-24">
        <div className="container-page -mt-8 w-full space-y-5 px-4 sm:-mt-12 md:-mt-24 md:px-6">
        <PublicProfilePanel className="transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)]">
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col items-center gap-4 text-center lg:flex-row lg:items-end lg:text-left">
              <button
                type="button"
                onClick={openAvatarEditor}
                className="group relative shrink-0 rounded-3xl transition hover:ring-2 hover:ring-ink focus:outline-none focus:ring-2 focus:ring-ink"
                aria-label={preview.imageUrl ? 'Смени снимка' : 'Добавете снимка'}
              >
                <PublicProfileAvatar src={preview.imageUrl || ''} alt={preview.name} name={preview.name} imageStyle={getProfileImageStyle(preview)} statusTitle="Партньорски профил" sizeClassName="h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32" statusClassName="bottom-0.5 right-0.5 h-4 w-4 border-[3px] sm:bottom-1 sm:right-1 sm:h-5 sm:w-5 sm:border-4" />
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-ink/45 px-3 text-center text-paper opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                  <Camera size={24} />
                  <span className="mt-1 text-xs font-semibold">{preview.imageUrl ? 'Смени снимка' : 'Добавете снимка'}</span>
                </div>
              </button>
              <div className="min-w-0 pb-1">
                <div className="eyebrow">Партньорски профил</div>
                <h1 className="mt-2 break-words font-display text-[clamp(2rem,7vw,3.25rem)] font-semibold leading-[0.95] tracking-tight text-ink">{preview.name}</h1>
                <p className="mt-2 text-sm text-muted">{preview.headline || preview.tag} · {preview.city}</p>
                <div className="mt-3 inline-flex max-w-full rounded-full border border-line bg-soft px-3 py-1 text-center text-xs font-medium text-muted">
                  Слой {preview.layerNumber} · {preview.layerTitle}
                </div>
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 pb-1 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
              {preview.isPublished && <Link to={`/profil/${preview.slug}`} className="btn btn-primary w-full justify-center sm:w-auto"><Eye size={18} /> Виж публично</Link>}
              <button type="button" onClick={startPaymentOnboarding} disabled={paymentState.status === 'opening'} className="btn btn-ghost w-full justify-center sm:w-auto"><CreditCard size={18} /> {account?.stripe_account_id ? 'Плащания' : 'Активирай плащания'}</button>
              <button className="btn btn-ghost w-full justify-center sm:w-auto" onClick={() => supabase.auth.signOut()}><LogOut size={18} /> Изход</button>
            </div>
          </div>
        </PublicProfilePanel>

        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
          <WorkspaceSidebar
            tabs={availableTabs}
            activeTab={activeTab}
            profile={preview}
            completion={profileCompletion}
            portfolioCount={portfolio.length}
            onTabChange={setActiveTab}
          />

          <main className="min-w-0 space-y-5">
            {activeTab === 'overview' && (
              <OverviewDashboard
                preview={preview}
                stats={stats}
                portfolio={portfolio}
                completion={profileCompletion}
                dashboardState={dashboardState}
                onAction={openWorkspaceTarget}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileForm
                draft={profileDraft}
                saveState={saveState}
                accountDisplayName={accountDisplayName}
                hasNameMismatch={hasNameMismatch}
                onChange={updateProfile}
                onSubmit={saveProfile}
              />
            )}

            {activeTab === 'layer01' && profileDraft.layerSlug === 'ideya' && (
              <form onSubmit={saveProfile} className="space-y-5">
                <Layer01SpecEditor draft={profileDraft.layer01Meta} onChange={updateLayer01} />
                <SavePanel
                  state={saveState}
                  idleMessage="Промените в Слой 01 се пазят след запис на профила."
                  savingLabel="Запазва се…"
                  saveLabel="Запази профила"
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
                <TotpMfaManager session={session} />
              </div>
            )}

            {activeTab === 'contact' && (
              <ContactPreview profile={preview} onEdit={() => setActiveTab('profile')} />
            )}
          </main>
        </div>
        </div>
      </div>

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 p-3 backdrop-blur-sm sm:p-6">
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

function WorkspaceSidebar({ tabs, activeTab, profile, completion, portfolioCount, onTabChange }) {
  return (
    <aside className="min-w-0 max-w-full overflow-hidden rounded-[2rem] border border-line bg-paper p-4 shadow-[0_20px_65px_-45px_rgba(13,35,64,0.28)] lg:sticky lg:top-24 lg:overflow-visible">
      <nav className="flex w-full min-w-0 max-w-full gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:overflow-visible lg:pb-0">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`inline-flex min-h-12 shrink-0 snap-start items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition lg:w-full ${isActive ? 'bg-ink text-paper shadow-[0_16px_35px_-22px_rgba(13,35,64,0.8)]' : 'text-muted hover:bg-soft hover:text-ink'}`}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="mt-4 hidden border-t border-line pt-5 lg:block">
        <div className="rounded-[1.5rem] border border-line bg-soft/70 p-4">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">Профил завършеност</div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="font-display text-4xl leading-none text-ink">{completion.percent}%</div>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
              <Check size={18} />
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper">
            <div className="h-full rounded-full bg-accentDeep" style={{ width: `${completion.percent}%` }} />
          </div>
          <div className="mt-3 text-sm text-muted">{completion.done}/{completion.total} попълнени секции</div>
        </div>

        <div className="mt-4 grid gap-3">
          <InfoTile label="Статус" value={profile.isPublished ? 'Публичен' : 'Скрит'} icon={CircleDot} tone={profile.isPublished ? 'success' : 'neutral'} />
          <InfoTile label="Слой" value={`${profile.layerNumber} · ${profile.layerTitle}`} icon={Compass} />
          <InfoTile label="Проекти" value={portfolioCount} icon={FolderKanban} />
        </div>

      </div>
    </aside>
  )
}

function OverviewDashboard({ preview, stats, portfolio, completion, dashboardState, onAction }) {
  const safePreview = preview || {}
  const safeCompletion = completion || { percent: 0, done: 0, total: 1, missing: [] }
  const safePortfolio = Array.isArray(portfolio) ? portfolio : []
  const inquiries = Array.isArray(dashboardState?.inquiries) ? dashboardState.inquiries : []
  const services = Array.isArray(dashboardState?.services) ? dashboardState.services : []
  const inquiryProjects = dashboardState?.inquiryProjects || {}
  const activeInquiries = inquiries.filter(item => item.status === 'new' || item.status === 'seen')
  const newInquiries = inquiries.filter(item => item.status === 'new')
  const latestInquiry = inquiries[0] || null
  const latestProject = latestInquiry?.client_id ? inquiryProjects[latestInquiry.client_id] : null
  const reviewCount = Number(stats?.reviews_count || 0)
  const rating = Number(stats?.avg_rating || 0)
  const publishedServices = services.filter(item => item.isPublished || item.is_published)
  const nextSteps = getDashboardNextSteps({ preview: safePreview, completion: safeCompletion, portfolio: safePortfolio, services }).slice(0, 3)
  const heroMessage = getDashboardHeroMessage(safePreview, safeCompletion, safePortfolio)

  const kpis = [
    {
      label: 'Нови заявки',
      value: String(newInquiries.length),
      detail: activeInquiries.length ? `${activeInquiries.length} активни общо` : 'Няма нови заявки',
      icon: Mail,
      tone: 'bg-accent/10 text-accentDeep',
      onClick: () => onAction('inquiries'),
    },
    {
      label: 'Активни разговори',
      value: '0',
      detail: 'Ще се отчита от реални чатове',
      icon: MessagesSquare,
      tone: 'bg-[#E9F1FF] text-[#16468F]',
      onClick: () => onAction('inbox'),
    },
    {
      label: 'Изпратени оферти',
      value: '0',
      detail: 'Скоро',
      icon: Send,
      tone: 'bg-[#EEF7F1] text-[#207246]',
      disabled: true,
    },
    {
      label: 'Активна работа',
      value: '0',
      detail: 'Скоро',
      icon: BriefcaseBusiness,
      tone: 'bg-[#F7F1E8] text-[#8A5B18]',
      disabled: true,
    },
  ]

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),rgba(236,244,253,0.88)_42%,rgba(255,255,255,0.78)),linear-gradient(135deg,rgba(13,35,64,0.08),rgba(255,255,255,0))] p-5 shadow-[0_24px_70px_rgba(13,35,64,0.08)] md:p-7">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-stretch">
          <div>
            <div className="eyebrow">Totsan Pro workspace</div>
            <h2 className="mt-3 max-w-3xl font-display text-[clamp(2.2rem,5vw,4.4rem)] leading-[0.9] tracking-tight text-ink">
              Здравей, {safePreview.name || 'партньор'}.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted md:text-lg">{heroMessage}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <StatusPill label={safePreview.isPublished ? 'Published' : 'Hidden'} value={safePreview.isPublished ? 'Профилът е видим' : 'Профилът е скрит'} strong={safePreview.isPublished} />
              <StatusPill label="Каталог" value={safePreview.isPublished ? 'Видим в каталога' : 'Не се показва'} strong={safePreview.isPublished} />
              <StatusPill label="Готовност" value={`${safeCompletion.percent}%`} strong={safeCompletion.percent >= 80} />
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/80 bg-paper/80 p-5 shadow-[0_18px_50px_rgba(13,35,64,0.08)] backdrop-blur">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Следваща стъпка</div>
                <div className="mt-3 font-display text-5xl leading-none text-ink">{safeCompletion.percent}%</div>
              </div>
              <div className="pb-1 text-sm font-medium text-muted">{safeCompletion.done}/{safeCompletion.total}</div>
            </div>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-soft">
              <div className="h-full rounded-full bg-ink shadow-[0_0_24px_rgba(13,35,64,0.28)]" style={{ width: `${safeCompletion.percent}%` }} />
            </div>
            <p className="mt-4 text-sm leading-6 text-muted">{nextSteps[0]?.description || 'Профилът изглежда готов. Следи заявките и поддържай портфолиото актуално.'}</p>
            <button type="button" onClick={() => onAction(nextSteps[0]?.tab || 'profile', nextSteps[0])} className="btn btn-primary mt-5 w-full justify-center">
              {nextSteps[0]?.cta || 'Подобри профила'}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(item => <DashboardKpi key={item.label} {...item} />)}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <LatestInquiryCard inquiry={latestInquiry} project={latestProject} status={dashboardState?.status} onOpen={() => onAction('inquiries')} onImprove={() => onAction('profile')} />

        <div className="space-y-5">
          <TrustCard
            preview={safePreview}
            completion={safeCompletion}
            portfolioCount={safePortfolio.length}
            serviceCount={services.length}
            publishedServiceCount={publishedServices.length}
            rating={rating}
            reviewCount={reviewCount}
            accountStatus={safePreview.isPublished ? 'Одобрен профил' : 'Скрит профил'}
          />
          <NextStepsCard steps={nextSteps} onAction={onAction} />
        </div>
      </div>
    </div>
  )
}

function getDashboardHeroMessage(preview, completion, portfolio) {
  if (!preview.isPublished) return 'Профилът е скрит — довърши липсващите полета, за да го публикуваш уверено.'
  if (!portfolio.length) return 'Профилът е видим. Добави портфолио, за да повишиш доверието преди първата оферта.'
  if (completion.percent < 80) return 'Профилът е видим, но има още няколко детайла, които ще помогнат на клиентите да изберат теб.'
  return 'Профилът е видим — готов си да получаваш повече запитвания и да работиш от едно място.'
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

function DashboardKpi({ label, value, detail, icon: Icon, tone, onClick, disabled = false }) {
  const isClickable = typeof onClick === 'function' && !disabled
  const Component = isClickable ? 'button' : 'article'
  const interactiveClass = isClickable
    ? 'cursor-pointer text-left hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-[0_20px_55px_rgba(13,35,64,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-offset-2 focus-visible:ring-offset-soft'
    : 'cursor-default opacity-85'

  return (
    <Component type={isClickable ? 'button' : undefined} onClick={isClickable ? onClick : undefined} className={`group w-full rounded-[1.65rem] border border-white/70 bg-paper/88 p-5 shadow-[0_14px_42px_rgba(13,35,64,0.06)] transition ${interactiveClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
          <Icon size={20} />
        </div>
        <div className="font-display text-4xl leading-none text-ink">{value}</div>
      </div>
      <div className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 text-sm text-ink/75">{detail}</div>
    </Component>
  )
}

function LatestInquiryCard({ inquiry, project, status, onOpen, onImprove }) {
  if (!inquiry) {
    return (
      <section className="rounded-[2rem] border border-line bg-paper p-5 shadow-[0_18px_55px_rgba(13,35,64,0.05)] md:p-7">
        <div className="eyebrow">Последен клиентски контекст</div>
        <div className="mt-8 rounded-[1.75rem] border border-dashed border-line bg-soft/70 p-7 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-paper text-accentDeep shadow-sm">
            <Mail size={24} />
          </div>
          <h3 className="mt-4 font-display text-3xl text-ink">Първата подходяща заявка ще се появи тук.</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            {status === 'loading' ? 'Проверяваме за реални заявки...' : 'Няма да показваме примерни клиенти или измислени бюджети.'}
          </p>
          <button type="button" onClick={onImprove} className="btn btn-primary mt-6 justify-center">Подобри профила</button>
        </div>
      </section>
    )
  }

  const city = project?.address_city || project?.city || ''
  const budget = project?.budget_min ? formatMoneyRange(project.budget_min, project.budget_max, project.budget_currency) : ''
  const context = project?.idea_description || inquiry.message || ''
  const title = project?.title || inquiry.name || 'Клиентска заявка'

  return (
    <section className="rounded-[2rem] border border-line bg-paper p-5 shadow-[0_18px_55px_rgba(13,35,64,0.05)] md:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="eyebrow">Последна заявка</div>
          <h3 className="mt-2 break-words font-display text-3xl text-ink">{title}</h3>
        </div>
        {inquiry.status === 'new' && <span className="inline-flex w-fit rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white">Ново</span>}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniFact label="Град" value={city || 'Не е посочен'} />
        <MiniFact label="Бюджет" value={budget || 'Не е посочен'} />
        <MiniFact label="Статус" value={inquiry.status || 'получена'} />
      </div>

      {context && (
        <div className="mt-5 rounded-3xl border border-line bg-soft/70 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Контекст</div>
          <p className="mt-2 line-clamp-4 text-sm leading-6 text-ink">{context}</p>
        </div>
      )}

      <button type="button" onClick={onOpen} className="btn btn-primary mt-6 justify-center">
        Виж заявката
      </button>
    </section>
  )
}

function TrustCard({ preview, completion, portfolioCount, serviceCount, publishedServiceCount, rating, reviewCount, accountStatus }) {
  const items = [
    { label: 'Готовност', value: `${completion.percent}%`, ok: completion.percent >= 80 },
    { label: 'Портфолио', value: portfolioCount ? `${portfolioCount} проекта` : 'Няма още', ok: portfolioCount > 0 },
    { label: 'Услуги', value: serviceCount ? `${publishedServiceCount}/${serviceCount} видими` : 'Няма още', ok: publishedServiceCount > 0 },
    { label: 'Каталог', value: preview.isPublished ? 'Видим' : 'Скрит', ok: preview.isPublished },
    { label: 'Оценка', value: reviewCount ? `${rating.toFixed(1)} (${reviewCount})` : 'Няма още', ok: reviewCount > 0 },
    { label: 'Статус', value: accountStatus, ok: preview.isPublished },
  ]

  return (
    <section className="rounded-[2rem] border border-line bg-paper p-5 shadow-[0_18px_55px_rgba(13,35,64,0.05)] md:p-6">
      <div className="eyebrow">Доверие</div>
      <h3 className="mt-2 font-display text-3xl text-ink">Профилна готовност</h3>
      <div className="mt-5 grid gap-2">
        {items.map(item => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl bg-soft/75 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              <span className="truncate text-sm font-medium text-ink">{item.label}</span>
            </div>
            <span className="max-w-[55%] truncate text-right text-sm text-muted">{item.value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function NextStepsCard({ steps, onAction }) {
  return (
    <section className="rounded-[2rem] border border-line bg-paper p-5 shadow-[0_18px_55px_rgba(13,35,64,0.05)] md:p-6">
      <div className="eyebrow">Следващи действия</div>
      <div className="mt-4 space-y-3">
        {steps.length ? steps.map((step, index) => (
          <button key={`${step.title}-${index}`} type="button" onClick={() => onAction(step.tab, step)} className="group w-full rounded-3xl border border-line bg-soft/65 p-4 text-left transition hover:-translate-y-0.5 hover:border-ink/25 hover:bg-paper hover:shadow-[0_12px_35px_rgba(13,35,64,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium text-ink">{step.title}</div>
                <p className="mt-1 text-sm leading-5 text-muted">{step.description}</p>
              </div>
              <span className="shrink-0 rounded-full bg-paper px-3 py-1 text-xs font-semibold text-accentDeep shadow-sm transition group-hover:bg-ink group-hover:text-paper">{step.cta}</span>
            </div>
          </button>
        )) : (
          <div className="rounded-3xl border border-dashed border-line bg-soft p-5 text-sm leading-6 text-muted">Няма критични липси. Поддържай заявките и портфолиото актуални.</div>
        )}
      </div>
    </section>
  )
}

function StatusPill({ label, value, strong = false }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] ${strong ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-line bg-paper/80 text-muted'}`}>
      <span className={`h-2 w-2 rounded-full ${strong ? 'bg-emerald-500' : 'bg-amber-400'}`} />
      <span className="normal-case tracking-normal">{label}: {value}</span>
    </span>
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

function SavePanel({ state, idleMessage, savingLabel = 'Запазва се…', saveLabel = 'Запази' }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-paper p-5 md:p-6">
      <div className={`text-sm ${state.status === 'error' ? 'text-red-700' : 'text-muted'}`}>
        {state.message || idleMessage}
      </div>
      <button className="btn btn-primary" disabled={state.status === 'saving'}>
        <Save size={18} />
        {state.status === 'saving' ? savingLabel : saveLabel}
      </button>
    </div>
  )
}

function ProfileForm({
  draft,
  saveState,
  accountDisplayName,
  hasNameMismatch,
  onChange,
  onSubmit,
}) {
  const bioLength = String(draft.bio || '').length
  const descriptionLength = String(draft.descriptionLong || '').length
  const priceGuide = parsePriceGuide(draft.pricingNote)

  function updateLimitedText(key, value, limit) {
    onChange(key, String(value || '').slice(0, limit))
  }

  function updateRemotePrice(value) {
    const normalized = String(value || '')
      .replace(',', '.')
      .replace(/[^\d.]/g, '')
      .replace(/(\..*)\./g, '$1')
    onChange('remotePricePerHour', normalized)
    if (normalized) onChange('remoteIsFree', false)
  }

  function updatePriceGuide(nextAmount = priceGuide.amount, nextUnit = priceGuide.unit) {
    onChange('pricingNote', formatPriceGuide(nextAmount, nextUnit).slice(0, PROFILE_PRICING_LIMIT))
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
            <Field label="Слой"><TotsanSelect value={draft.layerSlug} onChange={(value) => onChange('layerSlug', value)} options={LAYERS.map(layer => ({ value: layer.slug, label: `Слой ${layer.number} · ${layer.title}` }))} /></Field>
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
            <textarea rows={4} maxLength={PROFILE_BIO_LIMIT} value={draft.bio} onChange={event => updateLimitedText('bio', event.target.value, PROFILE_BIO_LIMIT)} className={`${INPUT} min-h-32 resize-y`} placeholder="Обяснете с едно-две изречения за какви клиенти и проекти сте най-подходящи." />
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
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Instagram"><input value={draft.instagram} onChange={event => onChange('instagram', event.target.value)} className={INPUT} /></Field>
          <Field label="Facebook"><input value={draft.facebook} onChange={event => onChange('facebook', event.target.value)} className={INPUT} /></Field>
        </div>
        <div className="rounded-2xl border border-line bg-soft/65 px-4 py-3 text-sm text-muted">
          Тези данни са публични и ще помогнат на клиентите да се свържат с Вас по-лесно.
        </div>
      </ProfileSection>

      <ProfileSection number="4" icon={CreditCard} title="Ценови ориентир и допълнителни настройки">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
          <div className="rounded-2xl border border-line bg-paper p-5 shadow-[0_14px_38px_rgba(13,35,64,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-base font-semibold leading-6 text-ink">Ценови ориентир</div>
                <p className="mt-1 text-sm leading-6 text-muted">Въведете стартова стойност и база, по която обикновено калкулирате.</p>
              </div>
            </div>
            <div className="mt-4 grid items-end gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,0.85fr)]">
              <label className="flex min-w-0 flex-col">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Стартова цена</span>
                <span className="relative mt-2 block h-[3.05rem]">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-ink">€</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={priceGuide.amount}
                    onChange={event => updatePriceGuide(event.target.value, priceGuide.unit)}
                    className={`${INPUT} !mt-0 h-full w-full pl-10`}
                    placeholder="80"
                  />
                </span>
              </label>
              <div className="flex min-w-0 flex-col">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">База</span>
                <div className="mt-2 h-[3.05rem]">
                  <TotsanSelect
                    value={priceGuide.unit}
                    onChange={(value) => updatePriceGuide(priceGuide.amount, value)}
                    options={PRICE_UNIT_OPTIONS.map(({ value, label }) => ({ value, label }))}
                    className="h-full"
                    buttonClassName="h-full min-h-0"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-5 shadow-[0_14px_38px_rgba(13,35,64,0.06)]">
            <label className="flex cursor-pointer items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-line bg-soft">
                <img src="/svg/Asset%201.svg" alt="" className="h-7 w-7 object-contain" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-3">
                  <span className="text-base font-semibold leading-6 text-ink">Дистанционни консултации</span>
                  <input
                    type="checkbox"
                    checked={draft.acceptsRemote}
                    onChange={event => {
                      onChange('acceptsRemote', event.target.checked)
                      if (!event.target.checked) {
                        onChange('remoteIsFree', false)
                        onChange('remotePricePerHour', '')
                      }
                    }}
                    className="mt-1 h-4 w-4 rounded accent-black"
                  />
                </span>
                <span className="mt-1 block text-sm leading-6 text-muted">Покажете дали предлагате разговор от разстояние и какъв е ориентирът на час.</span>
              </span>
            </label>

            <div className={`mt-4 grid gap-3 border-t border-line/60 pt-4 transition ${draft.acceptsRemote ? 'opacity-100' : 'pointer-events-none opacity-45'}`}>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-line bg-soft/65 px-4 py-3 text-sm text-ink">
                <span className="font-medium">Безплатна консултация</span>
                <input
                  type="checkbox"
                  checked={draft.remoteIsFree}
                  disabled={!draft.acceptsRemote}
                  onChange={event => {
                    onChange('remoteIsFree', event.target.checked)
                    if (event.target.checked) onChange('remotePricePerHour', '')
                  }}
                  className="h-4 w-4 rounded accent-black disabled:opacity-50"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Цена на час</span>
                <span className="relative mt-2 block">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-ink">€</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draft.remotePricePerHour}
                    disabled={!draft.acceptsRemote || draft.remoteIsFree}
                    onChange={event => updateRemotePrice(event.target.value)}
                    className={`${INPUT} w-full pl-10 pr-20 disabled:bg-soft disabled:text-muted`}
                    placeholder="80"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">/ час</span>
                </span>
              </label>
            </div>
          </div>
        </div>
      </ProfileSection>

      <FloatingSaveBar
        state={saveState}
        idleMessage="Промените се пазят след запазване."
        saveLabel="Запази профила"
      />
    </form>
  )
}

function PortfolioEditor({ items, draft, state, onSelect, onNew, onChange, onSubmit, onUpload, onDelete }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const sortedItems = Array.isArray(items) ? items : []

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
    await onDelete(draft.id)
    setIsModalOpen(false)
  }

  async function handleSubmit(event) {
    const didSave = await onSubmit(event)
    if (didSave) setIsModalOpen(false)
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-white/70 bg-paper/90 p-5 shadow-[0_18px_55px_rgba(13,35,64,0.05)] md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="eyebrow">Портфолио</div>
            <h2 className="mt-2 font-display text-4xl leading-none text-ink md:text-5xl">Проекти като продуктови карти</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Покажи най-важното първо: снимка, заглавие, слой, град, година и силен акцент. Детайлите се отварят в popup.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-soft px-4 py-3 text-sm text-muted">
            {sortedItems.length ? `${sortedItems.length} проекта` : 'Още няма проекти'}
          </div>
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

          {sortedItems.map(item => (
            <PortfolioProjectCard key={item.id} item={item} onOpen={() => openProject(item)} />
          ))}
        </div>
      </section>

      {isModalOpen && (
        <PortfolioProjectModal
          draft={draft}
          state={state}
          onClose={() => setIsModalOpen(false)}
          onChange={onChange}
          onSubmit={handleSubmit}
          onUpload={onUpload}
          onDelete={handleDelete}
        />
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

function PortfolioProjectCard({ item, onOpen }) {
  const image = getPortfolioImage(item)
  const layer = getPortfolioLayer(item)
  const meta = getPortfolioMeta(item)
  const accent = item.budgetBand || item.budget_band || 'Проект от практиката'

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-[1.75rem] border border-white/75 bg-paper text-left shadow-[0_14px_44px_rgba(13,35,64,0.06)] transition duration-300 hover:-translate-y-1 hover:scale-[1.015] hover:border-ink/15 hover:shadow-[0_28px_75px_rgba(13,35,64,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
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
        <span className="absolute bottom-4 left-4 right-4 truncate rounded-full bg-white/88 px-3 py-1.5 text-xs font-semibold text-ink shadow-sm backdrop-blur">
          {accent}
        </span>
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
  const requiredChecks = getPortfolioRequiredChecks(draft, media)
  const missingRequired = requiredChecks.filter(item => !item.done)

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape' && !isDraggingRef.current) onClose()
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      removePointerDragListeners()
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [onClose])

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
      return
    }
    onSubmit(event)
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-ink/60 p-3 backdrop-blur-sm sm:p-5 lg:p-6"
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
                    {draft.budgetBand && <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper">{draft.budgetBand}</span>}
                    {!draft.isPublished && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Скрит</span>}
                  </div>
                  <h4 className="mt-4 break-words font-display text-[clamp(2.2rem,4vw,3.25rem)] leading-none text-ink">{draft.title || 'Заглавие на проекта'}</h4>
                  <p className="mt-3 break-words text-sm leading-6 text-muted">{draft.description || 'Опиши накратко: какъв беше проблемът, каква беше твоята роля, какво решение даде и какъв е резултатът.'}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MiniFact label="Локация" value={draft.city || 'Не е посочена'} />
                <MiniFact label="Година" value={draft.year || 'Не е посочена'} />
                <MiniFact label="Акцент" value={draft.budgetBand || 'Добави силен акцент'} />
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
                <Field label="Силен акцент"><input value={draft.budgetBand} onChange={event => onChange('budgetBand', event.target.value)} className={INPUT} placeholder="Преди/След · 6 кв.м." /></Field>
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

function getPortfolioRequiredChecks(draft, media) {
  return [
    {
      key: 'title',
      label: 'Заглавие',
      message: 'Добави заглавие на проекта.',
      done: Boolean(String(draft.title || '').trim()),
    },
    {
      key: 'description',
      label: 'Кратко описание',
      message: 'Опиши накратко проблем, роля, решение и резултат.',
      done: Boolean(String(draft.description || '').trim()),
    },
    {
      key: 'media',
      label: 'Поне една медия',
      message: 'Добави поне една снимка или видео към проекта.',
      done: media.length > 0,
    },
  ]
}

function PortfolioValidationPanel({ checks, attempted }) {
  const missing = checks.filter(item => !item.done)
  const complete = missing.length === 0

  return (
    <div className={`rounded-3xl border p-4 ${complete ? 'border-emerald-100 bg-emerald-50' : attempted ? 'border-red-100 bg-red-50' : 'border-line bg-paper'}`}>
      <div className={`text-sm font-semibold ${complete ? 'text-emerald-800' : attempted ? 'text-red-700' : 'text-ink'}`}>
        {complete ? 'Готово за запазване' : attempted ? 'Остава още малко' : 'Задължително за портфолио'}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {checks.map(item => (
          <div key={item.key} className={`rounded-2xl px-3 py-2 text-sm ${item.done ? 'bg-paper/70 text-ink' : attempted ? 'bg-white/70 text-red-700' : 'bg-soft text-muted'}`}>
            <span className="flex items-center gap-2 font-medium">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${item.done ? 'bg-trustGreen text-paper' : attempted ? 'bg-red-100 text-red-700' : 'bg-paper text-muted'}`}>
                {item.done ? <Check size={13} /> : <CircleDot size={13} />}
              </span>
              {item.label}
            </span>
            {!item.done && attempted && <span className="mt-1 block text-xs leading-5">{item.message}</span>}
          </div>
        ))}
      </div>
    </div>
  )
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
    <div className="rounded-[2rem] border border-line bg-paper p-5 shadow-[0_20px_65px_-45px_rgba(13,35,64,0.28)] md:p-6">
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
    <section className={`rounded-[2rem] border border-line bg-paper p-5 shadow-[0_20px_65px_-45px_rgba(13,35,64,0.28)] md:p-6 ${className}`.trim()}>
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

function InfoTile({ label, value, icon: Icon, tone = 'neutral' }) {
  const iconTone = tone === 'success'
    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
    : 'bg-soft text-accentDeep border-line'

  return (
    <div className="rounded-[1.4rem] border border-line bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
          <div className="mt-2 text-sm font-medium text-ink">{value}</div>
        </div>
        {Icon && (
          <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border ${iconTone}`}>
            <Icon size={16} />
          </div>
        )}
      </div>
    </div>
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
