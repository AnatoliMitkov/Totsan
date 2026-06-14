import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BriefcaseBusiness,
  Camera,
  Compass,
  CreditCard,
  Eye,
  FolderKanban,
  Globe2,
  Home,
  ImagePlus,
  Lock,
  LogOut,
  Mail,
  MessagesSquare,
  Plus,
  Save,
  Tags,
  Trash2,
  UserRound,
} from 'lucide-react'
import { LAYERS } from '../../data/layers.js'
import { uploadProfileMedia, uploadProfileCover } from '../../lib/profile-media-upload-client.js'
import { getProfileImageStyle, isMissingLayer01MetaColumn, normalizeProfile, PROFILE_SELECT_COLUMNS, PROFILE_SELECT_COLUMNS_BASE } from '../../lib/profiles.js'
import { supabase } from '../../lib/supabase.js'
import { getAccountDisplayName } from '../../lib/account.js'
import { saveCustomerAccountProfile } from '../../lib/projects.js'
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
import PortfolioGallery from './PortfolioGallery.jsx'
import ImageCropperModal from './ImageCropperModal.jsx'
import Avatar from '../Avatar.jsx'
import PartnerStats from './PartnerStats.jsx'
import PublicProfileBanner from './PublicProfileBanner.jsx'
import PublicProfileAvatar from './PublicProfileAvatar.jsx'
import PublicProfilePanel from './PublicProfilePanel.jsx'
import PartnerServiceEditor from './PartnerServiceEditor.jsx'
import PartnerMaterialsEditor from './PartnerMaterialsEditor.jsx'
import PartnerOrders from './PartnerOrders.jsx'
import PartnerInquiries from './PartnerInquiries.jsx'
import Layer01SpecEditor, { cleanLayer01Draft, makeLayer01Draft } from './Layer01SpecEditor.jsx'
import TotsanSelect from '../ui/TotsanSelect.jsx'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'
const MAX_BANNER_BYTES = 12 * 1024 * 1024
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
    responseTimeHours: profile.responseTimeHours || '',
    acceptsRemote: Boolean(profile.acceptsRemote),
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
  const [activeTab, setActiveTab] = useState('overview')
  const [currentProfile, setCurrentProfile] = useState(profile)
  const [profileDraft, setProfileDraft] = useState(() => makeProfileDraft(profile))
  const [portfolio, setPortfolio] = useState([])
  const [stats, setStats] = useState(null)
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

  async function saveBanner(payload) {
    const nextFile = payload?.file || null
    const nextPositionY = Number.isFinite(Number(payload?.positionY)) ? Number(payload.positionY) : 50
    if (nextFile) {
      await uploadCover(nextFile, nextPositionY)
      return
    }
    await saveBannerPosition(nextPositionY)
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
      const result = await uploadProfileCover({ file, target: userId })
      const nextCoverUrl = result.publicUrl || result.signedUrl || ''
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
    service_areas: fromCsv(profileDraft.serviceAreasText, []),
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
      city: profileDraft.city.trim(),
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
      service_areas: fromCsv(profileDraft.serviceAreasText, []),
      response_time_hours: profileDraft.responseTimeHours === '' ? null : Number(profileDraft.responseTimeHours),
      accepts_remote: Boolean(profileDraft.acceptsRemote),
      pricing_note: profileDraft.pricingNote.trim() || null,
    }

    if (savesLayer01) {
      profilePayload.layer01_meta = cleanLayer01Draft(profileDraft.layer01Meta)
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(profilePayload)
      .eq('id', currentProfile.id)
      .select(savesLayer01 ? PROFILE_SELECT_COLUMNS : PROFILE_SELECT_COLUMNS_BASE)
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
    if (!profileDraft.syncAccountName) await refreshAccount?.()
    onSaved?.()
  }

  async function uploadPortfolioFile(file) {
    if (!file) return
    setPortfolioState({ status: 'uploading', message: 'Качваме снимка към портфолиото…' })
    try {
      const upload = await uploadPortfolioImage({ file, target: userId, kind: 'portfolio' })
      setPortfolioDraft(current => appendPortfolioMedia(current, upload))
      setPortfolioState({ status: 'uploaded', message: 'Снимката е добавена. Натисни „Запази проекта“.' })
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
    } catch (error) {
      setPortfolioState({ status: 'error', message: error.message || 'Записът не успя.' })
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
        heightClass="min-h-[clamp(14rem,46vw,18rem)] sm:min-h-[16rem] md:aspect-[1600/520] md:min-h-0"
        className="group cursor-pointer focus-within:ring-2 focus-within:ring-ink"
        onClick={openBannerEditor}
        placeholderLabel="Добавете банер"
        placeholderClassName="hidden md:grid"
      >
        <div className="absolute right-3 top-[calc(var(--header-h,64px)+0.75rem)] z-20 md:hidden">
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); openBannerEditor() }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-paper/88 text-ink shadow-sm backdrop-blur transition hover:bg-paper"
            aria-label={preview.coverUrl ? 'Смени банер' : 'Добавете банер'}
          >
            <Camera size={18} />
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 hidden pointer-events-none md:block">
          <div className="container-page flex justify-end px-6 pb-6 pt-0">
            <div className="w-auto max-w-xs rounded-3xl border border-white/30 bg-ink/55 p-3 text-paper shadow-lg backdrop-blur-sm transition-all duration-300 pointer-events-auto translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <div className="text-sm font-medium">{preview.coverUrl ? 'Смени банер' : 'Добавете банер'}</div>
              <p className="mt-1 text-[11px] leading-4 text-paper/85 sm:text-xs">Препоръчителен размер: 1600 × 600 px</p>
              <button type="button" onClick={(event) => { event.stopPropagation(); openBannerEditor() }} className="btn mt-3 w-full justify-center border-0 bg-white/90 text-ink hover:bg-white">
                <Camera size={18} />
                {preview.coverUrl ? 'Смени банер' : 'Добавете банер'}
              </button>
            </div>
          </div>
        </div>
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
        <div className="container-page -mt-10 w-full space-y-5 px-4 sm:-mt-12 md:-mt-24 md:px-6">
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

        <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
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
                onTabChange={setActiveTab}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileForm
                draft={profileDraft}
                saveState={saveState}
                preview={preview}
                accountDisplayName={accountDisplayName}
                hasNameMismatch={hasNameMismatch}
                onChange={updateProfile}
                onSubmit={saveProfile}
                onOpenAvatarEditor={openAvatarEditor}
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
              <PartnerServiceEditor profile={currentProfile} userId={userId} />
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
        <BannerPositionModal
          file={bannerEditor.file}
          imageUrl={bannerEditor.imageUrl}
          initialFileName={bannerEditor.fileName}
          initialPositionY={bannerEditor.positionY ?? profileDraft.coverY ?? 50}
          description={BANNER_DESCRIPTION}
          onClose={closeBannerEditor}
          onSelectFile={async (file) => handleBannerFile(file)}
          onSave={saveBanner}
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
    <aside className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-line bg-paper p-3 shadow-[0_8px_30px_rgb(0,0,0,0.02)] lg:sticky lg:top-24 lg:overflow-visible">
      <nav className="flex w-full min-w-0 max-w-full gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:overflow-visible lg:pb-0">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`inline-flex min-h-11 shrink-0 snap-start items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm font-medium transition lg:w-full ${isActive ? 'bg-ink text-paper shadow-sm' : 'text-muted hover:bg-soft hover:text-ink'}`}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="mt-3 hidden border-t border-line pt-4 lg:block">
        <div className="px-2">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">Готовност</div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="font-display text-4xl leading-none text-ink">{completion.percent}%</div>
            <div className="pb-1 text-xs text-muted">{completion.done}/{completion.total}</div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-soft">
            <div className="h-full rounded-full bg-accentDeep" style={{ width: `${completion.percent}%` }} />
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <InfoTile label="Статус" value={profile.isPublished ? 'Публичен' : 'Скрит'} />
          <InfoTile label="Слой" value={`${profile.layerNumber} · ${profile.layerTitle}`} />
          <InfoTile label="Проекти" value={portfolioCount} />
        </div>
      </div>
    </aside>
  )
}

function OverviewDashboard({ preview, stats, portfolio, completion, onTabChange }) {
  const missing = completion.missing.slice(0, 4)

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="eyebrow">Преглед</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Работно табло</h2>
            <p className="mt-3 text-muted">{preview.descriptionLong || preview.bio || 'Добави кратко описание, за да е по-ясно как помагаш на клиентите.'}</p>
          </div>
          <div className="w-full rounded-2xl border border-line bg-soft p-4 xl:w-72">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-muted">Готовност</div>
                <div className="mt-2 font-display text-4xl leading-none text-ink">{completion.percent}%</div>
              </div>
              <div className="pb-1 text-sm text-muted">{completion.done}/{completion.total}</div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-paper">
              <div className="h-full rounded-full bg-accentDeep" style={{ width: `${completion.percent}%` }} />
            </div>
            {missing.length > 0 && <p className="mt-3 text-xs text-muted">Липсва: {missing.join(', ')}</p>}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoTile label="Езици" value={preview.languages.join(', ') || 'bg'} />
          <InfoTile label="Райони" value={preview.serviceAreas.join(', ') || preview.city || 'Не е посочено'} />
          <InfoTile label="Цени" value={preview.pricingNote || 'Не е посочено'} />
          <InfoTile label="Портфолио" value={`${portfolio.length} проекта`} />
        </div>


      </section>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <PartnerStats profile={preview} stats={stats} />
        </div>
        <section className="rounded-3xl border border-line bg-paper p-5 md:p-7 lg:col-span-7">
          <div className="eyebrow">Публичен профил</div>
          <h3 className="mt-2 font-display text-3xl text-ink">{preview.name}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoTile label="Позициониране" value={preview.headline || preview.tag || 'Не е посочено'} />
            <InfoTile label="Формат" value={preview.acceptsRemote ? 'На място и дистанционно' : 'На място'} />
            <InfoTile label="Опит" value={`${preview.yearsExperience || Math.max(0, new Date().getFullYear() - preview.since)} г.`} />
            <InfoTile label="Статус" value={preview.isPublished ? 'Публичен' : 'Скрит'} />
          </div>
        </section>
      </div>
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
  preview,
  accountDisplayName,
  hasNameMismatch,
  onChange,
  onSubmit,
  onOpenAvatarEditor,
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-8 rounded-3xl border border-line bg-paper p-5 md:p-7 space-y-5">
        <div>
          <div className="eyebrow">Профил</div>
          <h2 className="mt-2 font-display text-3xl text-ink">Основна информация</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Име / фирма"><input value={draft.name} onChange={event => onChange('name', event.target.value)} className={INPUT} /></Field>
          <Field label="One-liner"><input value={draft.headline} onChange={event => onChange('headline', event.target.value)} className={INPUT} placeholder="Напр. Интериори с точен бюджет и срок" /></Field>
        </div>
        {hasNameMismatch && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Името в акаунта и името в публичния профил са различни.
            {accountDisplayName && <span className="mt-1 block text-xs text-amber-800">Име в акаунта: {accountDisplayName}</span>}
          </div>
        )}
        <label className="flex items-start gap-3 rounded-2xl border border-line bg-soft p-4 text-sm text-muted">
          <input type="checkbox" checked={draft.syncAccountName} onChange={event => onChange('syncAccountName', event.target.checked)} className="mt-1 accent-black" />
          <span>Синхронизирай и името в акаунта</span>
        </label>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Роля"><input value={draft.tag} onChange={event => onChange('tag', event.target.value)} className={INPUT} /></Field>
          <Field label="Град"><input value={draft.city} onChange={event => onChange('city', event.target.value)} className={INPUT} /></Field>
          <Field label="Слой"><TotsanSelect value={draft.layerSlug} onChange={(value) => onChange('layerSlug', value)} options={LAYERS.map(layer => ({ value: layer.slug, label: `Слой ${layer.number} · ${layer.title}` }))} /></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="От година"><input type="number" min="1900" max="2100" value={draft.since} onChange={event => onChange('since', event.target.value)} className={INPUT} /></Field>
          <Field label="Години опит"><input type="number" min="0" value={draft.yearsExperience} onChange={event => onChange('yearsExperience', event.target.value)} className={INPUT} /></Field>
          <Field label="Проекти"><input type="number" min="0" value={draft.projects} onChange={event => onChange('projects', event.target.value)} className={INPUT} /></Field>
          <Field label="Отговор до часове"><input type="number" min="0" value={draft.responseTimeHours} onChange={event => onChange('responseTimeHours', event.target.value)} className={INPUT} /></Field>
        </div>

        <Field label="Кратко био"><textarea rows={4} value={draft.bio} onChange={event => onChange('bio', event.target.value)} className={INPUT} /></Field>
        <Field label="Разширено описание"><textarea rows={7} value={draft.descriptionLong} onChange={event => onChange('descriptionLong', event.target.value)} className={INPUT} /></Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Езици"><input value={draft.languagesText} onChange={event => onChange('languagesText', event.target.value)} className={INPUT} placeholder="bg, en" /></Field>
          <Field label="Райони на работа"><input value={draft.serviceAreasText} onChange={event => onChange('serviceAreasText', event.target.value)} className={INPUT} placeholder="София, Пловдив" /></Field>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Телефон"><input value={draft.phone} onChange={event => onChange('phone', event.target.value)} type="tel" className={INPUT} /></Field>
          <Field label="Публичен имейл"><input value={draft.emailPublic} onChange={event => onChange('emailPublic', event.target.value)} type="email" className={INPUT} /></Field>
          <Field label="Сайт"><input value={draft.website} onChange={event => onChange('website', event.target.value)} className={INPUT} placeholder="https://" /></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Instagram"><input value={draft.instagram} onChange={event => onChange('instagram', event.target.value)} className={INPUT} /></Field>
          <Field label="Facebook"><input value={draft.facebook} onChange={event => onChange('facebook', event.target.value)} className={INPUT} /></Field>
        </div>

        <Field label="Ценова бележка"><textarea rows={3} value={draft.pricingNote} onChange={event => onChange('pricingNote', event.target.value)} className={INPUT} placeholder="Напр. Консултация от 80€, проект по оферта." /></Field>
        <label className="flex items-start gap-3 rounded-2xl border border-line bg-soft p-4 text-sm text-muted">
          <input type="checkbox" checked={draft.acceptsRemote} onChange={event => onChange('acceptsRemote', event.target.checked)} className="mt-1 accent-black" />
          <span>Приемам дистанционни консултации.</span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <div className={`text-sm ${saveState.status === 'error' ? 'text-red-700' : 'text-muted'}`}>{saveState.message || 'Промените се пазят след запазване.'}</div>
          <button className="btn btn-primary" disabled={saveState.status === 'saving'}><Save size={18} /> {saveState.status === 'saving' ? 'Запазва се…' : 'Запази профила'}</button>
        </div>
      </div>

      <aside className="lg:col-span-4 space-y-5">
        <div className="rounded-3xl border border-line bg-paper p-5 md:p-6 lg:sticky lg:top-24">
          <div className="eyebrow">Снимка</div>
          <div className="group relative mt-4 flex justify-center">
            <button type="button" onClick={onOpenAvatarEditor} className="relative rounded-full transition hover:ring-2 hover:ring-ink focus:outline-none focus:ring-2 focus:ring-ink" aria-label="Смени снимката">
              <Avatar src={preview.imageUrl || ''} name={preview.name} size={200} imgStyle={getProfileImageStyle(preview)} />
              <div className="absolute inset-0 hidden flex-col items-center justify-center rounded-full bg-ink/45 px-5 text-center text-paper opacity-0 transition md:flex md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                <Camera size={32} />
                <span className="mt-2 text-sm font-semibold">{preview.imageUrl ? 'Смени снимка' : 'Добавете снимка'}</span>
              </div>
            </button>
          </div>
          <button type="button" onClick={onOpenAvatarEditor} className="btn btn-ghost mt-4 w-full cursor-pointer justify-center">
            <Camera size={18} /> {preview.imageUrl ? 'Смени снимката' : 'Добавете снимка'}
          </button>
        </div>
      </aside>
    </form>
  )
}

function PortfolioEditor({ items, draft, state, onSelect, onNew, onChange, onSubmit, onUpload, onDelete }) {
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <aside className="lg:col-span-4 xl:col-span-3">
        <div className="rounded-3xl border border-line bg-paper p-4">
          <button type="button" onClick={onNew} className="btn btn-primary w-full justify-center"><Plus size={18} /> Нов проект</button>
          <div className="mt-4 max-h-[34rem] space-y-2 overflow-auto pr-1">
            {items.map(item => (
              <button key={item.id} type="button" onClick={() => onSelect(item)} className={`w-full rounded-2xl border p-3 text-left transition ${draft.id === item.id ? 'border-ink bg-soft' : 'border-line hover:border-ink/40'}`}>
                <div className="flex gap-3">
                  <div className="h-14 w-14 overflow-hidden rounded-xl bg-soft">
                    {item.coverUrl ? <img src={item.coverUrl} alt={item.title} className="img-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-ink">{item.title || 'Проект'}</div>
                    <div className="mt-1 text-xs text-muted">{item.city || 'Локация'} · {item.year || 'година'}</div>
                    {!item.isPublished && <div className="mt-1 text-xs text-amber-700">Скрит</div>}
                  </div>
                </div>
              </button>
            ))}
            {items.length === 0 && <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-muted">Още няма портфолио.</div>}
          </div>
        </div>
      </aside>

      <form onSubmit={onSubmit} className="lg:col-span-8 xl:col-span-9 rounded-3xl border border-line bg-paper p-5 md:p-7 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="eyebrow">Портфолио</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Проект от практиката</h2>
          </div>
          {draft.id && <button type="button" onClick={() => onDelete(draft.id)} className="btn btn-ghost"><Trash2 size={18} /> Изтрий</button>}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Заглавие"><input value={draft.title} onChange={event => onChange('title', event.target.value)} className={INPUT} placeholder="Апартамент 90 м2" /></Field>
          <Field label="Слой"><TotsanSelect value={draft.layerSlug} onChange={(value) => onChange('layerSlug', value)} options={LAYERS.map(layer => ({ value: layer.slug, label: `Слой ${layer.number} · ${layer.title}` }))} /></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Град"><input value={draft.city} onChange={event => onChange('city', event.target.value)} className={INPUT} /></Field>
          <Field label="Година"><input type="number" min="1900" max="2100" value={draft.year} onChange={event => onChange('year', event.target.value)} className={INPUT} /></Field>
          <Field label="Бюджет"><input value={draft.budgetBand} onChange={event => onChange('budgetBand', event.target.value)} className={INPUT} placeholder="5k-10k €" /></Field>
          <Field label="Ред"><input type="number" value={draft.orderIndex} onChange={event => onChange('orderIndex', event.target.value)} className={INPUT} /></Field>
        </div>
        <Field label="Описание"><textarea rows={5} value={draft.description} onChange={event => onChange('description', event.target.value)} className={INPUT} /></Field>
        <Field label="Cover URL"><input value={draft.coverUrl} onChange={event => onChange('coverUrl', event.target.value)} className={INPUT} /></Field>

        <label className="btn btn-ghost cursor-pointer justify-center">
          <ImagePlus size={18} /> Качи снимка към проекта
          <input type="file" accept="image/*" className="sr-only" onChange={async (event) => { await onUpload(event.target.files?.[0]); event.target.value = '' }} />
        </label>

        {draft.media.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {draft.media.map((media, index) => (
              <div key={`${media.url}-${index}`} className="overflow-hidden rounded-2xl border border-line bg-soft">
                <div className="aspect-square"><img src={media.url} alt={media.caption || draft.title} className="img-cover" /></div>
              </div>
            ))}
          </div>
        )}

        <label className="flex items-start gap-3 rounded-2xl border border-line bg-soft p-4 text-sm text-muted">
          <input type="checkbox" checked={draft.isPublished} onChange={event => onChange('isPublished', event.target.checked)} className="mt-1 accent-black" />
          <span>Публикуван проект.</span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <div className={`text-sm ${state.status === 'error' ? 'text-red-700' : 'text-muted'}`}>{state.message || 'Запази проекта, за да се появи в публичния профил.'}</div>
          <button className="btn btn-primary" disabled={state.status === 'saving'}><Save size={18} /> {state.status === 'saving' ? 'Запазва се…' : 'Запази проекта'}</button>
        </div>
      </form>

      <div className="lg:col-span-12 rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="eyebrow">Публичен изглед</div>
        <h2 className="mt-2 font-display text-3xl text-ink">Галерия</h2>
        <div className="mt-5"><PortfolioGallery items={items.filter(item => item.isPublished)} /></div>
      </div>
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

function InfoTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-soft p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 text-sm font-medium text-ink">{value}</div>
    </div>
  )
}

function Field({ label, children }) {
  return <label className="block text-sm font-medium text-ink">{label}{children}</label>
}

function Range({ label, value, min, max, step, onChange }) {
  return (
    <label className="block text-sm font-medium text-ink">
      <span className="flex items-center justify-between gap-4"><span>{label}</span><span className="text-xs text-muted">{Number(value).toFixed(step < 1 ? 2 : 0)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} className="mt-3 w-full accent-black" />
    </label>
  )
}
