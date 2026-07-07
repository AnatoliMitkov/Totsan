import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FileType,
  Files,
  Home,
  Image,
  Layers3,
  LayoutList,
  LogIn,
  MapPin,
  Maximize2,
  MessageCircle,
  Ruler,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import { useAccount } from '../lib/account.js'
import { createConversationWithClient } from '../lib/chat.js'
import PublicProfileAvatar from '../components/profile/PublicProfileAvatar.jsx'
import { LAYERS } from '../data/layers.js'
import {
  formatProjectBudget,
  formatProjectLocation,
  getLocationAccessSummary,
  getProjectLayerLabel,
  getProjectPropertyTypeLabel,
  getProjectStageLabel,
  loadSharedClientProject,
  getProjectAccessItems,
} from '../lib/projects.js'

import { getMediaUrl, isImageMedia, getExtension } from '../components/media/MediaCarousel.jsx'
import MediaCarousel from '../components/media/MediaCarousel.jsx'

function getDocumentTypeLabel(item) {
  const extension = getExtension(item?.fileName || item?.path || getMediaUrl(item))
  return extension ? extension.toUpperCase() : 'FILE'
}

function getDocumentIcon(item) {
  const typeLabel = getDocumentTypeLabel(item)
  if (typeLabel === 'DOC' || typeLabel === 'DOCX') return FileType
  if (typeLabel === 'XLS' || typeLabel === 'XLSX') return FileSpreadsheet
  return FileText
}

function getDisplayFileName(item) {
  if (item?.fileName) return item.fileName
  const source = item?.path || getMediaUrl(item)
  const fileName = String(source).split('/').pop() || ''
  return decodeURIComponent(fileName.split('?')[0] || '')
}

function hasValue(value) {
  return String(value ?? '').trim().length > 0
}

function formatFileSize(size) {
  const bytes = Number(size)
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatProjectDate(value) {
  if (!hasValue(value)) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatArea(value) {
  const area = Number(value)
  if (!Number.isFinite(area) || area <= 0) return ''
  return `${area} кв.м`
}

function formatRooms(value) {
  const rooms = Number(value)
  if (!Number.isFinite(rooms) || rooms <= 0) return ''
  return `${rooms} ${rooms === 1 ? 'стая' : 'стаи'}`
}

function mediaAvailabilityLabel(imageCount, documentCount) {
  const parts = []
  if (imageCount > 0) parts.push(`${imageCount} ${imageCount === 1 ? 'снимка' : 'снимки'}`)
  if (documentCount > 0) parts.push(`${documentCount} ${documentCount === 1 ? 'документ' : 'документа'}`)
  return parts.length ? parts.join(' · ') : 'няма качени файлове'
}

function getCtaConfig({ viewerIsOwner, isAuthenticated, isSpecialist, loginHref, viewerLoading, chatStatus }) {
  if (viewerLoading) {
    return {
      icon: CheckCircle2,
      label: 'Проверяваме достъпа',
      disabled: true,
      variant: 'button',
    }
  }

  if (viewerIsOwner) {
    return {
      icon: Edit3,
      label: 'Редактирай проекта',
      to: '/moy-profil',
      variant: 'link',
    }
  }

  if (isAuthenticated && isSpecialist) {
    return {
      icon: MessageCircle,
      label: chatStatus === 'opening' ? 'Отваряме чат…' : 'Свържи се с клиента',
      disabled: chatStatus === 'opening',
      variant: 'button',
    }
  }

  if (!isAuthenticated) {
    return {
      icon: LogIn,
      label: 'Влез, за да предложиш оферта',
      to: loginHref,
      variant: 'link',
    }
  }

  return {
    icon: Home,
    label: 'Към профила',
    to: '/moy-profil',
    variant: 'link',
  }
}

export default function SharedProject() {
  const { shareId } = useParams()
  const navigate = useNavigate()
  const {
    account: viewerAccount,
    isAuthenticated,
    isSpecialist,
    loading: viewerLoading,
  } = useAccount()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [chatAction, setChatAction] = useState({ status: 'idle', message: '' })

  useEffect(() => {
    let active = true
    loadSharedClientProject(shareId)
      .then((res) => {
        if (!active) return
        if (!res) setError('Проектът не е намерен или не е споделен.')
        else setData(res)
      })
      .catch(() => {
        if (!active) return
        setError('Възникна грешка при зареждането на проекта.')
      })
    return () => {
      active = false
    }
  }, [shareId])

  useEffect(() => {
    setChatAction({ status: 'idle', message: '' })
  }, [shareId])

  if (error) {
    return (
      <section className="section flex min-h-[60vh] items-center justify-center bg-soft">
        <div className="container-page max-w-lg space-y-4 px-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
            <User size={32} />
          </div>
          <h1 className="font-display text-2xl text-ink">Недостъпен проект</h1>
          <p className="text-muted">{error}</p>
          <div className="pt-4">
            <Link to="/" className="btn btn-primary">
              Към началото
            </Link>
          </div>
        </div>
      </section>
    )
  }

  if (!data) {
    return (
      <section className="section flex min-h-[60vh] items-center justify-center bg-soft">
        <div className="text-sm text-muted">Зареждане...</div>
      </section>
    )
  }

  const { project, account } = data
  const mediaItems = Array.isArray(data.media) ? data.media : []
  const imageMedia = mediaItems.filter(isImageMedia)
  const documentMedia = mediaItems.filter((item) => !isImageMedia(item))
  const activeLayer = LAYERS.find((layer) => layer.slug === project?.currentLayerSlug) || LAYERS[0]
  const layerLabel = getProjectLayerLabel(project, LAYERS) || `Слой ${activeLayer.number}`
  const locationLabel = formatProjectLocation(project)
  const accessSummary = getLocationAccessSummary(project)
  const budgetLabel = formatProjectBudget(project)
  const propertyTypeLabel = getProjectPropertyTypeLabel(project)
  const stageLabel = getProjectStageLabel(project)
  const desiredStartLabel = formatProjectDate(project?.desiredStartDate)
  const desiredEndLabel = formatProjectDate(project?.desiredEndDate)
  const areaLabel = formatArea(project?.areaSqm)
  const roomsLabel = formatRooms(project?.roomsCount)
  const displayName = account.display_name || account.full_name || 'Клиент'
  const heroImageUrl = getMediaUrl(imageMedia[0])
  const clientProjectUserId = project?.userId || project?.user_id || ''
  const viewerIsOwner = Boolean(viewerAccount?.id && clientProjectUserId && viewerAccount.id === clientProjectUserId)
  const loginHref = `/login?next=${encodeURIComponent(`/proekt/${shareId}`)}`
  const cta = getCtaConfig({
    viewerIsOwner,
    isAuthenticated,
    isSpecialist,
    loginHref,
    viewerLoading,
    chatStatus: chatAction.status,
  })
  const description = project.ideaDescription || 'Клиентът все още не е добавил подробно описание към проекта.'
  const uploadedFilesLabel = mediaAvailabilityLabel(imageMedia.length, documentMedia.length)
  const objectLabel = [propertyTypeLabel, roomsLabel].filter(hasValue).join(', ')

  const accessItems = getProjectAccessItems(project)

  const heroSignals = [
    { key: 'layer', label: 'Категория', value: layerLabel, icon: Layers3 },
  ].filter((item) => hasValue(item.value))

  const parameterItems = [
    { key: 'layer', label: 'Категория', value: layerLabel, icon: Layers3 },
    { key: 'location', label: 'Локация', value: locationLabel, icon: MapPin },
    { key: 'property', label: 'Тип обект', value: propertyTypeLabel, icon: Home },
    { key: 'area', label: 'Квадратура', value: areaLabel, icon: Ruler },
    { key: 'rooms', label: 'Стаи', value: roomsLabel, icon: LayoutList },
    { key: 'start', label: 'Желан старт', value: desiredStartLabel, icon: CalendarDays },
    { key: 'end', label: 'Желан край', value: desiredEndLabel, icon: CalendarDays },
    { key: 'stage', label: 'Етап', value: stageLabel, icon: Sparkles },
  ].filter((item) => hasValue(item.value))

  const availabilityItems = [
    { key: 'budget', label: 'Бюджет', value: budgetLabel, icon: Banknote },
    { key: 'images', label: 'Снимки', value: imageMedia.length > 0 ? `${imageMedia.length} ${imageMedia.length === 1 ? 'снимка' : 'снимки'}` : '', icon: Image },
    { key: 'documents', label: 'Документи', value: documentMedia.length > 0 ? `${documentMedia.length} ${documentMedia.length === 1 ? 'документ' : 'документа'}` : '', icon: Files },
  ].filter((item) => hasValue(item.value))

  const quickItems = [
    { key: 'budget', label: 'Бюджет', value: budgetLabel },
    { key: 'location', label: 'Локация', value: locationLabel },
    { key: 'access', label: 'Достъп', value: accessSummary },
    { key: 'layer', label: 'Услуга', value: layerLabel },
    { key: 'object', label: 'Обект', value: objectLabel },
    { key: 'area', label: 'Размер', value: areaLabel },
    { key: 'files', label: 'Качени файлове', value: uploadedFilesLabel },
    { key: 'start', label: 'Старт', value: desiredStartLabel },
    { key: 'end', label: 'Край', value: desiredEndLabel },
  ].filter((item) => hasValue(item.value))

  const clarificationItems = [
    'точен обхват',
    'предпочитани материали',
    'срок за изпълнение',
    'нужда от оглед',
    'начин на офериране',
  ]

  async function startChatWithClient() {
    if (chatAction.status === 'opening') return
    if (!clientProjectUserId || !viewerAccount?.id) {
      setChatAction({ status: 'error', message: 'Липсва клиент или специалист за отваряне на чат.' })
      return
    }

    setChatAction({ status: 'opening', message: '' })
    try {
      const conversation = await createConversationWithClient({
        clientId: clientProjectUserId,
        partnerId: viewerAccount.id,
        projectId: project.id || '',
        subject: `Връзка по проект: ${project.title || 'Клиентски проект'}`,
        sharedProjectContext: {
          shareId,
          projectId: project.id || '',
          projectTitle: project.title || '',
          clientId: clientProjectUserId,
          clientDisplayName: displayName,
          clientFullName: account.full_name || displayName,
          clientAvatarUrl: account.avatar_url || '',
          clientCity: account.city || '',
        },
      })
      setChatAction({ status: 'opened', message: '' })
      navigate(`/inbox/${conversation.id}`)
    } catch (chatError) {
      setChatAction({
        status: 'error',
        message: chatError.message || 'Чатът не се отвори. Опитай пак след малко.',
      })
    }
  }

  return (
    <div className="bg-soft">
      <section className="relative min-h-[460px] bg-[#0d2340] text-paper sm:min-h-[520px] lg:min-h-[580px]">
        <div className="absolute inset-0 overflow-hidden">
          {heroImageUrl ? (
            <img
              src={heroImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full scale-[1.02] object-cover"
              aria-hidden="true"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(255,255,255,0.42),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(47,143,116,0.30),transparent_34%),linear-gradient(135deg,#0d2340_0%,#476a7e_48%,#e0e8e2_100%)]" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,35,64,0.86)_0%,rgba(13,35,64,0.56)_48%,rgba(13,35,64,0.18)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-soft to-transparent" />
        </div>

        <div 
          className="container-page relative z-10 flex min-h-[460px] items-start px-4 pb-10 sm:min-h-[520px] md:px-6 lg:min-h-[580px] lg:pb-16 [--pad-t:1rem] lg:[--pad-t:1.5rem]"
          style={{ paddingTop: 'calc(var(--header-h, 64px) + var(--pad-t))' }}
        >
          <div className="grid w-full items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div 
              className="max-w-4xl lg:sticky lg:self-start rounded-[2rem] border border-white/22 bg-paper/90 p-5 text-ink shadow-[0_26px_80px_rgba(13,35,64,0.22)] backdrop-blur-xl sm:p-7 lg:p-8"
              style={{ top: 'calc(var(--header-h, 64px) + var(--pad-t))' }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accentSoft/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accentDeep">
                  <ShieldCheck size={13} />
                  Проектно задание
                </span>
                {locationLabel && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold text-ink/75">
                    <MapPin size={13} className="text-accentDeep" />
                    {locationLabel}
                  </span>
                )}
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-end">
                <div className="min-w-0">
                  <h1 className="break-words font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl lg:text-5xl">
                    {project.title || 'Проект'}
                  </h1>
                  <p className="mt-4 max-w-2xl line-clamp-3 break-words text-sm leading-relaxed text-ink/78 sm:text-base">
                    {description}
                  </p>
                </div>

                {budgetLabel && (
                  <div className="rounded-[1.5rem] border border-ink/10 bg-[linear-gradient(155deg,rgba(13,35,64,0.96),rgba(36,67,94,0.94))] p-5 text-paper shadow-[0_18px_40px_rgba(13,35,64,0.18)]">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-paper/65">
                      <Banknote size={15} />
                      Бюджет
                    </div>
                    <div className="mt-3 break-words font-display text-2xl font-semibold leading-tight">
                      {budgetLabel}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-paper/65">
                      Ключов ориентир за оферта и капацитет.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {heroSignals.map((item) => (
                  <BriefSignal key={item.key} item={item} />
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ProjectCta
                  cta={cta}
                  className="w-full justify-center sm:w-auto"
                  onAction={isAuthenticated && isSpecialist && !viewerIsOwner ? startChatWithClient : undefined}
                />
                <span className="text-xs leading-relaxed text-muted">
                  Видимо само чрез споделен линк или контекст от Totsan.
                </span>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/20 bg-paper/88 p-5 text-ink shadow-[0_22px_64px_rgba(13,35,64,0.18)] backdrop-blur-xl">
              <div className="eyebrow">Бърз преглед</div>
              <div className="mt-4 space-y-3">
                {quickItems.map((item) => (
                  <div key={item.key} className="flex gap-3 rounded-2xl border border-line/70 bg-paper/80 px-3 py-2.5">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accentDeep" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{item.label}</div>
                      <div className="mt-0.5 break-words text-sm font-semibold text-ink">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 pb-16 md:pb-24">
        <div className="container-page px-4 md:px-6">
          <div className="-mt-6 rounded-[2rem] border border-line bg-paper p-5 shadow-[0_18px_50px_rgba(13,35,64,0.06)] sm:p-6 lg:-mt-10">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                <PublicProfileAvatar
                  src={account.avatar_url}
                  alt={displayName}
                  imageClassName="h-full w-full object-cover"
                  statusTitle="Споделен проект в Totsan"
                  fallbackIcon={User}
                  sizeClassName="h-20 w-20"
                  statusClassName="bottom-0 right-0 h-4 w-4 border-[3px]"
                />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Клиент / проект</div>
                  <h2 className="mt-1 break-words font-display text-2xl font-semibold text-ink">{displayName}</h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-muted">
                    {account.city && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-soft px-3 py-1.5">
                        <MapPin size={13} className="text-accentDeep" />
                        {account.city}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-soft px-3 py-1.5">
                      <ShieldCheck size={13} className="text-accentDeep" />
                      Споделен проект чрез Totsan
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-soft px-3 py-1.5">
                      <Files size={13} className="text-accentDeep" />
                      {uploadedFilesLabel}
                    </span>
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink/72">
                    Клиентът е споделил проектно задание с бюджет, локация и визуален контекст. Проектът е видим само чрез споделен линк или контекст от Totsan и не се показва публично в каталога.
                  </p>
                </div>
              </div>

              <div className="lg:min-w-[15rem]">
                <ProjectCta
                  cta={cta}
                  className="w-full justify-center lg:w-auto"
                  onAction={isAuthenticated && isSpecialist && !viewerIsOwner ? startChatWithClient : undefined}
                />
                {chatAction.status === 'error' && chatAction.message && (
                  <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {chatAction.message}
                  </div>
                )}
              </div>
            </div>
          </div>

          <main className="mt-6 space-y-6">
            <div className="rounded-[2rem] border border-line bg-paper p-5 shadow-[0_18px_50px_rgba(13,35,64,0.06)] sm:p-6 lg:p-8">
              <div>
                <div className="eyebrow">Проектно задание</div>
                <h2 className="mt-2 break-words font-display text-3xl font-semibold text-ink">
                  Пълно задание за преценка
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                  Детайлите тук помагат да прецениш обхват, капацитет и какво трябва да се уточни преди оферта.
                </p>
              </div>

              <div className="mt-7 rounded-[1.5rem] border border-line/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(245,248,251,0.92))] p-5">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-accentDeep">
                  <LayoutList size={15} />
                  Какво търси клиентът
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/84 sm:text-base">
                  {description}
                </p>
              </div>

              {parameterItems.length > 0 && (
                <div className="mt-7">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                    <Layers3 size={15} />
                    Основни параметри
                  </div>
                  <div className="mt-3 grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {parameterItems.map((item) => (
                      <BriefMetric key={item.key} item={item} />
                    ))}
                  </div>

                  {accessItems.length > 0 && (
                    <div className="mt-5 border-t border-line/50 pt-5">
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                        <ShieldCheck size={15} />
                        Достъп до обекта
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {accessItems.map((val, idx) => (
                          <div key={idx} className="flex items-center gap-2 rounded-2xl border border-line/70 bg-soft/38 px-3 py-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-paper text-accentDeep shadow-sm">
                              <ShieldCheck size={13} />
                            </div>
                            <span className="text-xs font-semibold text-ink">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {availabilityItems.length > 0 && (
                <div className="mt-7">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                    <CheckCircle2 size={15} />
                    Какво е налично
                  </div>
                  <div className="mt-3 grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {availabilityItems.map((item) => (
                      <BriefMetric key={item.key} item={item} />
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-7 rounded-[1.5rem] border border-line bg-soft/45 p-5">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-accentDeep">
                  <ShieldCheck size={15} />
                  Поверителност на адреса
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink/76">
                  Точният адрес ще бъде видим след потвърдена поръчка или разрешен оглед.
                </p>
              </div>

              <div className="mt-7 rounded-[1.5rem] border border-accent/15 bg-accentSoft/35 p-5">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-accentDeep">
                  <MessageCircle size={15} />
                  Какво може да уточните с клиента
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink/76">
                  Тези въпроси помагат разговорът да стане работен още от първото съобщение.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {clarificationItems.map((item) => (
                    <span key={item} className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink/78">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>

        <MediaCarousel images={imageMedia} />

        <div className="container-page px-4 md:px-6">
          <div className="space-y-6">
            {documentMedia.length > 0 && (
              <div className="rounded-[2rem] border border-line bg-paper p-5 shadow-[0_18px_50px_rgba(13,35,64,0.06)] sm:p-6 lg:p-8">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="eyebrow">Файлове и документи</div>
                    <h3 className="mt-2 font-display text-3xl font-semibold text-ink">Прикачени файлове</h3>
                  </div>
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-soft px-3 py-1.5 text-xs font-semibold text-muted">
                    <Files size={14} />
                    {documentMedia.length} {documentMedia.length === 1 ? 'файл' : 'файла'}
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {documentMedia.map((item, index) => (
                    <DocumentRow key={item.id || `${getMediaUrl(item)}-${index}`} item={item} />
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[2rem] border border-line/70 bg-[linear-gradient(135deg,rgba(224,232,226,0.52),rgba(255,255,255,0.86))] p-5 shadow-[0_16px_42px_rgba(13,35,64,0.05)] sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-accentDeep">Следваща стъпка</div>
                  <p className="mt-1 break-words text-sm leading-relaxed text-ink/78">
                    Ако проектът е релевантен за услугите ти, продължи към контакт с клиента.
                  </p>
                </div>
                <div className="w-full sm:w-auto">
                  <ProjectCta
                    cta={cta}
                    className="w-full justify-center sm:w-auto"
                    onAction={isAuthenticated && isSpecialist && !viewerIsOwner ? startChatWithClient : undefined}
                  />
                  {chatAction.status === 'error' && chatAction.message && (
                    <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 sm:max-w-sm">
                      {chatAction.message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function ProjectCta({ cta, className = '', onAction }) {
  const Icon = cta.icon
  const classes = `btn btn-primary ${className}`.trim()

  if (cta.disabled) {
    return (
      <button type="button" disabled className={`${classes} cursor-wait opacity-75`}>
        <Icon size={18} />
        {cta.label}
      </button>
    )
  }

  if (cta.variant === 'button') {
    return (
      <button type="button" onClick={onAction} className={classes}>
        <Icon size={18} />
        {cta.label}
      </button>
    )
  }

  return (
    <Link to={cta.to} className={classes}>
      <Icon size={18} />
      {cta.label}
    </Link>
  )
}

function BriefSignal({ item }) {
  const Icon = item.icon
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-line/80 bg-paper/78 px-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-soft text-accentDeep">
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{item.label}</div>
        <div className="mt-0.5 truncate text-sm font-semibold text-ink" title={item.value}>{item.value}</div>
      </div>
    </div>
  )
}

function BriefMetric({ item }) {
  const Icon = item.icon
  return (
    <div className="flex min-w-0 gap-3 rounded-[1.25rem] border border-line/70 bg-soft/38 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-paper text-accentDeep shadow-sm">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{item.label}</div>
        <div className="mt-1 break-words text-sm font-semibold leading-snug text-ink">{item.value}</div>
      </div>
    </div>
  )
}



function DocumentRow({ item }) {
  const mediaUrl = getMediaUrl(item)
  const fileName = getDisplayFileName(item) || 'Документ'
  const fileType = getDocumentTypeLabel(item)
  const fileSize = formatFileSize(item?.size)
  const DocumentIcon = getDocumentIcon(item)

  return (
    <div className="flex flex-col gap-4 rounded-[1.5rem] border border-line/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,249,252,0.92))] px-4 py-4 shadow-[0_10px_24px_rgba(13,35,64,0.04)] sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-paper text-accentDeep">
          <DocumentIcon size={20} strokeWidth={1.7} />
        </div>
        <div className="min-w-0">
          <div className="break-words text-sm font-semibold text-ink sm:truncate" title={fileName}>{fileName}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted">
            <span>{fileType}</span>
            {fileSize ? <span>{fileSize}</span> : null}
          </div>
        </div>
      </div>

      {mediaUrl ? (
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost whitespace-nowrap !rounded-full !px-4 !py-2"
          >
            <ExternalLink size={16} />
            Отвори
          </a>
          <a
            href={mediaUrl}
            download={fileName}
            className="btn btn-primary whitespace-nowrap !rounded-full !px-4 !py-2"
          >
            <Download size={16} />
            Изтегли
          </a>
        </div>
      ) : null}
    </div>
  )
}
