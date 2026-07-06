import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  BadgeEuro,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Eye,
  FileQuestion,
  GripVertical,
  ImagePlus,
  Images,
  Lightbulb,
  Link2,
  MapPin,
  PlayCircle,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Video,
  X,
} from 'lucide-react'
import { LAYERS } from '../../data/layers.js'
import { getPartnerServiceCoverCandidates } from '../../lib/service-media.js'
import {
  SERVICE_STATUS_LABELS,
  appendPartnerServiceMedia,
  deletePartnerService,
  formatServicePrice,
  loadPartnerServicesForProfile,
  makeEmptyPackage,
  makePartnerServiceDraft,
  resolveServiceModerationAttachments,
  savePartnerService,
  uploadPartnerServiceImage,
} from '../../lib/partner-services.js'
import { getBgnEquivalentText } from '../../lib/money.js'
import { deleteStorageRefs, diffStorageRefs, mediaAndCoverStorageRefs } from '../../lib/storage-media-cleanup.js'
import FallbackImage from '../FallbackImage.jsx'
import TotsanSelect from '../ui/TotsanSelect.jsx'
import { LocationMultiCombobox } from '../ui/LocationCombobox.jsx'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base font-normal leading-6 outline-none transition focus:border-ink'

const GUIDE_STEPS = [
  { id: 'info', label: 'Оферта', icon: BriefcaseBusiness, helper: 'Какво продаваш и за кого е подходящо.' },
  { id: 'price', label: 'Цена', icon: BadgeEuro, helper: 'Една ясна стартова цена с включени дейности.' },
  { id: 'media', label: 'Снимки', icon: Images, helper: 'Покажи работа, детайл или реален резултат.' },
  { id: 'faq', label: 'Въпроси', icon: FileQuestion, helper: 'Отговори на нещата, които клиентите питат първо.' },
]

const SERVICE_STARTERS = [
  {
    title: 'Боядисване на стая',
    group: 'Ремонт',
    subtitle: 'Подготовка, боядисване и чист финал за жилищни помещения',
    tagsText: 'боя, шпакловка, освежаване',
    descriptionMd: 'Подходящо за освежаване на стая, коридор или малък офис. Оглеждам основата, пазя пода и мебелите, правя нужната подготовка и оставям помещението чисто след работа.',
    packageTitle: 'Стартова оферта за помещение',
    packageDescription: 'Цената се уточнява според квадратурата, състоянието на стените и избраната боя.',
    priceAmount: '180',
    features: ['Оглед и уточняване на обема', 'Покриване и защита на мебели и под', 'Подготовка на основата', 'Два слоя боя при нормално покритие', 'Финално почистване на работната зона'],
    faq: [
      { question: 'Материалите включени ли са?', answer: 'Мога да работя с материали на клиента или да препоръчам подходяща боя според помещението.', orderIndex: 0 },
      { question: 'Колко време отнема?', answer: 'Обикновено една стандартна стая се изпълнява в рамките на 1 до 2 работни дни.', orderIndex: 1 },
    ],
  },
  {
    title: 'Монтаж на ламиниран паркет',
    group: 'Подове',
    subtitle: 'Подготовка, подложка, монтаж и первази за завършен под',
    tagsText: 'паркет, подложка, первази',
    descriptionMd: 'Услугата е за монтаж на ламиниран паркет в жилища и офиси. Проверявам основата, уточнявам посоката на редене и изпълнявам детайлите около врати, ъгли и первази.',
    packageTitle: 'Монтаж на подова настилка',
    packageDescription: 'Стартова цена за труд. Финалната оферта зависи от квадратурата, основата и броя детайли.',
    priceAmount: '220',
    features: ['Оглед на основата', 'Полагане на подложка', 'Монтаж на ламиниран паркет', 'Изрязване около каси и ъгли', 'Монтаж на первази при нужда'],
    faq: [
      { question: 'Трябва ли подът да е равен?', answer: 'Да, при големи неравности първо се уточнява подготовка, за да няма проблеми след монтажа.', orderIndex: 0 },
      { question: 'Мога ли да купя материалите сам?', answer: 'Да. Мога и да помогна с препоръка за подходящ клас паркет и подложка.', orderIndex: 1 },
    ],
  },
  {
    title: 'Монтаж на баня до ключ',
    group: 'Баня',
    subtitle: 'Координирана услуга за ВиК, плочки, санитария и завършване',
    tagsText: 'баня, плочки, ВиК, санитария',
    descriptionMd: 'Подходящо за цялостен ремонт на баня. Започваме с оглед и план, после уточняваме демонтаж, ВиК, хидроизолация, плочки и монтаж на санитария.',
    packageTitle: 'Оглед и стартова организация',
    packageDescription: 'Начална оферта за оглед, планиране и координация. Пълната цена се дава след размери и избор на материали.',
    priceAmount: '120',
    features: ['Оглед на място', 'Списък с нужни дейности', 'Препоръка за последователност', 'Ориентир за срок и бюджет', 'Следваща оферта за изпълнение'],
    faq: [
      { question: 'Може ли без оглед?', answer: 'За цяла баня огледът е силно препоръчителен, защото ВиК, размери и основа влияят на цената.', orderIndex: 0 },
      { question: 'Помагате ли с материали?', answer: 'Да, мога да насоча към подходящи материали и решения според бюджета.', orderIndex: 1 },
    ],
  },
  {
    title: 'Интериорен дизайн',
    group: 'Проектиране',
    subtitle: 'Концепция, разпределение, визуализации и насоки за изпълнение',
    tagsText: 'интериорен дизайн, 3D визуализация, разпределение',
    descriptionMd: 'Услугата помага на клиента да вземе ясни решения преди ремонта. Подготвям концепция, функционално разпределение, стилова посока и визуални насоки, така че изпълнението да започне с план, а не с догадки.',
    packageTitle: 'Дизайн концепция за помещение',
    packageDescription: 'Стартова цена за едно помещение. Финалната оферта зависи от квадратурата, броя варианти и нужните чертежи.',
    priceAmount: '300',
    features: ['Разговор за нуждите и бюджета', 'Функционално разпределение', 'Стилова посока и цветове', 'Списък с ключови материали', 'Визуална посока за изпълнение'],
    faq: [
      { question: 'Получавам ли списък с материали?', answer: 'Да, при нужда включвам препоръки за основни материали, мебели и довършителни решения.', orderIndex: 0 },
      { question: 'Може ли онлайн?', answer: 'Да, при добри размери и снимки част от процеса може да мине дистанционно.', orderIndex: 1 },
    ],
  },
  {
    title: 'Мебели по поръчка',
    group: 'Обзавеждане',
    subtitle: 'Проектиране, изработка и монтаж на мебели по размер',
    tagsText: 'мебели по поръчка, гардероб, кухня, шкафове',
    descriptionMd: 'Подходящо за кухни, гардероби, шкафове и вградени решения. Уточняваме размери, материали, механизми и начин на монтаж, след което подготвям оферта за изработка и поставяне.',
    packageTitle: 'Оглед и оферта за мебели',
    packageDescription: 'Стартова цена за оглед и подготовка на предложение. Изработката се оферира след размери и избор на материали.',
    priceAmount: '90',
    features: ['Оглед и взимане на размери', 'Обсъждане на материали и механизми', 'Предложение за разпределение', 'Оферта за изработка', 'Монтаж при одобрена поръчка'],
    faq: [
      { question: 'Колко време отнема изработката?', answer: 'Срокът зависи от сложността и материалите, но се уточнява предварително в офертата.', orderIndex: 0 },
      { question: 'Мога ли да избера обков?', answer: 'Да, обсъждаме клас обков и механизми според бюджета и натоварването.', orderIndex: 1 },
    ],
  },
  {
    title: 'Монтаж на кухня',
    group: 'Обзавеждане',
    subtitle: 'Сглобяване, нивелиране, фиксиране и довършване на кухня',
    tagsText: 'кухня, монтаж, шкафове, плот',
    descriptionMd: 'Услугата е за монтаж на готова или поръчкова кухня. Проверявам стените и нивата, сглобявам модулите, фиксирам ги, подготвям отвори при нужда и завършвам детайлите около плот и шкафове.',
    packageTitle: 'Монтаж на кухненски модули',
    packageDescription: 'Стартова цена за труд. Финалната цена зависи от броя шкафове, плот, уреди и нужни корекции.',
    priceAmount: '280',
    features: ['Проверка на мястото и нивата', 'Сглобяване на модули', 'Монтаж и фиксиране', 'Монтаж на плот при нужда', 'Финална настройка на врати и чекмеджета'],
    faq: [
      { question: 'Монтирате ли уреди?', answer: 'Мога да подготвя отвори и позициониране, а електро и ВиК връзките се уточняват според случая.', orderIndex: 0 },
      { question: 'Какво трябва да е готово?', answer: 'Добре е подът, стените и основните изводи да са подготвени преди монтажа.', orderIndex: 1 },
    ],
  },
  {
    title: 'Електро ремонт',
    group: 'Инсталации',
    subtitle: 'Контакти, ключове, осветление и корекции по електро инсталация',
    tagsText: 'електро, контакти, осветление, ключове',
    descriptionMd: 'Подходящо за подмяна на контакти, ключове, осветителни тела и дребни корекции по електро инсталация. Оглеждам проблема, уточнявам безопасното решение и изпълнявам с подходящи материали.',
    packageTitle: 'Електро посещение',
    packageDescription: 'Стартова цена за посещение и дребна работа. По-големи ремонти се оферират след оглед.',
    priceAmount: '80',
    features: ['Оглед на място', 'Диагностика на проблема', 'Подмяна или монтаж при възможност', 'Съвет за нужни материали', 'Проверка след изпълнение'],
    faq: [
      { question: 'Материалите включени ли са?', answer: 'Дребни материали могат да се уточнят на място, а специфични тела и компоненти се избират предварително.', orderIndex: 0 },
      { question: 'Работите ли по аварии?', answer: 'При възможност, но спешността и часът се уточняват допълнително.', orderIndex: 1 },
    ],
  },
  {
    title: 'ВиК ремонт',
    group: 'Инсталации',
    subtitle: 'Смесители, сифони, течове и дребни ВиК корекции',
    tagsText: 'ВиК, теч, смесител, сифон',
    descriptionMd: 'Услугата е за дребни ВиК ремонти и подмени в баня, кухня или мокро помещение. Проверявам проблема, уточнявам нужните части и изпълнявам ремонта с тест след приключване.',
    packageTitle: 'ВиК посещение',
    packageDescription: 'Стартова цена за посещение и дребен ремонт. По-сложни случаи се оферират след оглед.',
    priceAmount: '80',
    features: ['Оглед и диагностика', 'Подмяна на дребни компоненти', 'Монтаж на смесител или сифон', 'Тест за течове', 'Съвет за превенция'],
    faq: [
      { question: 'Трябва ли да купя части предварително?', answer: 'Може, но е добре първо да уточним точния размер и тип, за да няма грешни покупки.', orderIndex: 0 },
      { question: 'Работите ли по скрити течове?', answer: 'Скрити течове често изискват допълнителна диагностика и се уточняват отделно.', orderIndex: 1 },
    ],
  },
  {
    title: 'Лепене на плочки',
    group: 'Довършителни',
    subtitle: 'Подготовка, лепене, фугиране и чист финал',
    tagsText: 'плочки, баня, гранитогрес, фугиране',
    descriptionMd: 'Подходящо за баня, коридор, кухня или тераса. Проверявам основата, нивата и детайлите, след което изпълнявам лепене, рязане, фугиране и почистване на работната зона.',
    packageTitle: 'Лепене на плочки',
    packageDescription: 'Стартова цена за труд. Финалната оферта зависи от квадратурата, размерите на плочките и сложността на детайлите.',
    priceAmount: '350',
    features: ['Оглед на основата', 'Подготовка за лепене', 'Лепене и рязане', 'Фугиране', 'Почистване след работа'],
    faq: [
      { question: 'Работите ли с голям формат?', answer: 'Да, но големият формат изисква специална подготовка и се оферира отделно.', orderIndex: 0 },
      { question: 'Нужна ли е хидроизолация?', answer: 'За мокри помещения обикновено е препоръчителна и се уточнява преди лепене.', orderIndex: 1 },
    ],
  },
  {
    title: 'Смяна на дограма',
    group: 'Фасада',
    subtitle: 'Оглед, размери, демонтаж и монтаж на прозорци',
    tagsText: 'дограма, прозорци, монтаж, демонтаж',
    descriptionMd: 'Услугата започва с оглед и взимане на размери. След избор на профил и стъклопакет се уточняват демонтаж, монтаж, уплътняване и довършване около прозорците.',
    packageTitle: 'Оглед за дограма',
    packageDescription: 'Стартова цена за оглед и размери. Производството и монтажът се оферират след избор на система.',
    priceAmount: '70',
    features: ['Оглед и размери', 'Консултация за профил и стъклопакет', 'Оферта за производство', 'Планиране на демонтаж', 'Монтаж и уплътняване при одобрение'],
    faq: [
      { question: 'Колко време отнема производството?', answer: 'Срокът зависи от системата и натовареността, но се уточнява при офертата.', orderIndex: 0 },
      { question: 'Включено ли е обръщането?', answer: 'Обръщането около дограмата може да се включи или оферира отделно според обекта.', orderIndex: 1 },
    ],
  },
  {
    title: 'Озеленяване на двор',
    group: 'Външни площи',
    subtitle: 'План, подготовка, засаждане и поддръжка на двор',
    tagsText: 'двор, озеленяване, тревна площ, растения',
    descriptionMd: 'Подходящо за двор, тераса или малка външна зона. Уточняваме слънце, почва, вода, стил и бюджет, след което подготвям предложение за растения, тревна площ и поддръжка.',
    packageTitle: 'Консултация за озеленяване',
    packageDescription: 'Стартова цена за оглед и концепция. Изпълнението се оферира след избор на растения и обем работа.',
    priceAmount: '100',
    features: ['Оглед на външната зона', 'Идея за разпределение', 'Препоръка за растения', 'Ориентир за бюджет', 'План за следващи стъпки'],
    faq: [
      { question: 'Може ли с малък бюджет?', answer: 'Да, може да се работи на етапи според приоритетите и сезона.', orderIndex: 0 },
      { question: 'Предлагате ли поддръжка?', answer: 'Поддръжка може да се уточни отделно според растенията и честотата.', orderIndex: 1 },
    ],
  },
]

function makeNeutralServiceDraft(profile) {
  const nextDraft = makePartnerServiceDraft(profile)
  return {
    ...nextDraft,
    layerSlug: '',
    deliveryAreasText: '',
  }
}

function serializeServiceDraftForCompare(draft) {
  const source = draft || {}
  const primaryPackage = source.packages?.[0] || makeEmptyPackage('basic')
  return {
    id: source.id || '',
    layerSlug: source.layerSlug || '',
    title: String(source.title || '').trim(),
    subtitle: String(source.subtitle || '').trim(),
    descriptionMd: String(source.descriptionMd || '').trim(),
    coverUrl: String(source.coverUrl || '').trim(),
    tags: String(source.tagsText || '').split(',').map(item => item.trim()).filter(Boolean),
    deliveryAreas: String(source.deliveryAreasText || '').split(',').map(item => item.trim()).filter(Boolean),
    media: (Array.isArray(source.media) ? source.media : []).map(item => ({
      type: item?.type || '',
      provider: item?.provider || '',
      url: item?.url || '',
      path: item?.path || '',
      thumbnail: item?.thumbnail || '',
      caption: item?.caption || '',
      bucket: item?.bucket || '',
    })),
    package: {
      title: String(primaryPackage.title || '').trim(),
      description: String(primaryPackage.description || '').trim(),
      priceAmount: String(primaryPackage.priceAmount ?? '').trim(),
      features: (Array.isArray(primaryPackage.features) ? primaryPackage.features : []).map(item => String(item || '').trim()),
    },
    faq: (Array.isArray(source.faq) ? source.faq : []).map(item => ({
      question: String(item?.question || '').trim(),
      answer: String(item?.answer || '').trim(),
    })),
  }
}

export default function PartnerServiceEditor({ profile, userId, onProfileSummaryRefresh }) {
  const [items, setItems] = useState([])
  const [draft, setDraft] = useState(() => makeNeutralServiceDraft(profile))
  const [activeSection, setActiveSection] = useState('info')
  const [showPreview, setShowPreview] = useState(true)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [serviceFilter, setServiceFilter] = useState('all')
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [state, setState] = useState({ status: 'loading', message: 'Зареждаме услугите...' })
  const loadedProfileRef = useRef('')

  useEffect(() => {
    let active = true
    async function load(showLoading = false) {
      if (showLoading) setState({ status: 'loading', message: 'Зареждаме услугите...' })
      try {
        const rows = await loadPartnerServicesForProfile(profile.id)
        if (!active) return
        setItems(rows)
        setDraft(current => {
          const selected = rows.find(item => item.id === current.id) || rows[0] || null
          return selected ? makePartnerServiceDraft(profile, selected) : makeNeutralServiceDraft(profile)
        })
        loadedProfileRef.current = profile.id
        setState({ status: 'ready', message: '' })
      } catch (error) {
        if (!active) return
        setState({ status: 'error', message: error.message || 'Услугите не успяха да заредят.' })
      }
    }

    function refreshWhenVisible() {
      if (!isEditorOpen && document.visibilityState === 'visible') void load(false)
    }

    if (!isEditorOpen) void load(loadedProfileRef.current !== profile.id)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      active = false
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [profile.id, profile.updatedAt, isEditorOpen])

  useEffect(() => {
    if (!isEditorOpen) return undefined
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
  }, [isEditorOpen])

  const primaryPackage = draft.packages[0] || makeEmptyPackage('basic')
  const checklist = useMemo(() => getServiceChecklist(draft, primaryPackage), [draft, primaryPackage])
  const requiredChecks = useMemo(() => getServiceRequiredChecks(draft, primaryPackage), [draft, primaryPackage])
  const missingRequired = requiredChecks.filter(item => !item.done)
  const doneCount = checklist.filter(item => item.done).length
  const completionPercent = Math.round((doneCount / checklist.length) * 100)
  const canSubmit = missingRequired.length === 0
  const publishedCount = items.filter(item => item.isPublished && item.moderationStatus === 'approved').length
  const pendingCount = items.filter(item => item.moderationStatus === 'pending').length
  const rejectedCount = items.filter(item => item.moderationStatus === 'rejected').length
  const filteredItems = useMemo(() => {
    if (serviceFilter === 'published') {
      return items.filter(item => item.isPublished && item.moderationStatus === 'approved')
    }
    if (serviceFilter === 'pending') return items.filter(item => item.moderationStatus === 'pending')
    if (serviceFilter === 'draft') return items.filter(item => item.moderationStatus === 'draft')
    if (serviceFilter === 'rejected') return items.filter(item => item.moderationStatus === 'rejected')
    return items
  }, [items, serviceFilter])
  const persistedDraft = useMemo(() => {
    const selected = draft.id ? items.find(item => item.id === draft.id) || null : null
    return selected ? makePartnerServiceDraft(profile, selected) : makeNeutralServiceDraft(profile)
  }, [draft.id, items, profile])
  const hasUnsavedChanges = useMemo(() => (
    JSON.stringify(serializeServiceDraftForCompare(draft)) !== JSON.stringify(serializeServiceDraftForCompare(persistedDraft))
  ), [draft, persistedDraft])

  const previewService = useMemo(() => ({
    ...draft,
    tags: draft.tagsText.split(',').map(item => item.trim()).filter(Boolean),
    deliveryAreas: draft.deliveryAreasText.split(',').map(item => item.trim()).filter(Boolean),
    lowestPrice: Number(primaryPackage.priceAmount || 0),
    lowestCurrency: 'EUR',
    packages: [{ ...primaryPackage, currency: 'EUR', deliveryDays: '', revisions: '', isActive: true }],
  }), [draft, primaryPackage])

  function update(key, value) {
    setDraft(current => ({ ...current, [key]: value }))
  }

  function updatePackage(key, value) {
    setDraft(current => ({
      ...current,
      packages: [{ ...(current.packages[0] || makeEmptyPackage('basic')), [key]: value, tier: 'basic', currency: 'EUR', isActive: true }],
    }))
  }

  function updateFeature(index, value) {
    setDraft(current => {
      const item = current.packages[0] || makeEmptyPackage('basic')
      const features = [...(Array.isArray(item.features) ? item.features : [])]
      features[index] = value
      return { ...current, packages: [{ ...item, features, tier: 'basic', currency: 'EUR', isActive: true }] }
    })
  }

  function addFeature() {
    setDraft(current => {
      const item = current.packages[0] || makeEmptyPackage('basic')
      return { ...current, packages: [{ ...item, features: [...(item.features || []), ''], tier: 'basic', currency: 'EUR', isActive: true }] }
    })
  }

  function removeFeature(index) {
    setDraft(current => {
      const item = current.packages[0] || makeEmptyPackage('basic')
      const features = (item.features || []).filter((_, itemIndex) => itemIndex !== index)
      return { ...current, packages: [{ ...item, features: features.length ? features : [''], tier: 'basic', currency: 'EUR', isActive: true }] }
    })
  }

  function updateFaq(index, key, value) {
    setDraft(current => ({
      ...current,
      faq: current.faq.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    }))
  }

  function addFaq() {
    setDraft(current => ({ ...current, faq: [...current.faq, { question: '', answer: '', orderIndex: current.faq.length }] }))
  }

  function removeFaq(index) {
    setDraft(current => ({
      ...current,
      faq: current.faq.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, orderIndex: itemIndex })),
    }))
  }

  function startNewService() {
    setDraft(makeNeutralServiceDraft(profile))
    setActiveSection('info')
    setShowPreview(true)
    setIsEditorOpen(true)
    setAttemptedSubmit(false)
    setState(current => ({ ...current, message: current.status === 'error' ? current.message : '' }))
  }

  function applyStarter(starter) {
    setDraft(current => ({
      ...current,
      title: starter.title,
      subtitle: starter.subtitle,
      tagsText: starter.tagsText,
      descriptionMd: starter.descriptionMd,
      packages: [{
        ...(current.packages[0] || makeEmptyPackage('basic')),
        title: starter.packageTitle,
        description: starter.packageDescription,
        priceAmount: starter.priceAmount,
        features: starter.features,
        tier: 'basic',
        currency: 'EUR',
        deliveryDays: '',
        revisions: '',
        isActive: true,
      }],
      faq: starter.faq,
    }))
    setActiveSection('price')
    setShowPreview(true)
  }

  async function handleSave(publish = false) {
    if (publish && !canSubmit) {
      setAttemptedSubmit(true)
      setActiveSection(missingRequired[0]?.step || 'info')
      setState({ status: 'error', message: missingRequired[0]?.message || 'Попълни липсващата информация, за да изпратиш услугата.' })
      return
    }

    setState({ status: 'saving', message: publish ? 'Изпращаме услугата за преглед...' : 'Запазваме черновата...' })
    try {
      const saved = await savePartnerService(profile, draft, { submit: publish })
      setItems(current => [saved, ...current.filter(item => item.id !== saved.id)])
      setDraft(makePartnerServiceDraft(profile, saved))
      setIsEditorOpen(false)
      setState({ status: 'saved', message: publish ? 'Услугата е изпратена за одобрение. Ще стане публична след преглед от Totsan.' : 'Черновата е запазена.' })
      void onProfileSummaryRefresh?.()
    } catch (error) {
      setState({ status: 'error', message: error.message || 'Записът не успя.' })
    }
  }

  async function handleDelete() {
    if (!draft.id) return
    setState({ status: 'saving', message: 'Изтриваме услугата...' })
    try {
      await deletePartnerService(draft.id)
      const next = items.filter(item => item.id !== draft.id)
      setItems(next)
      setDraft(makePartnerServiceDraft(profile, next[0] || null))
      setIsEditorOpen(false)
      setState({ status: 'saved', message: 'Услугата е изтрита.' })
      void onProfileSummaryRefresh?.()
    } catch (error) {
      setState({ status: 'error', message: error.message || 'Изтриването не успя.' })
    }
  }

  async function uploadImage(file) {
    if (!file) return
    setState({ status: 'uploading', message: 'Качваме снимката към услугата...' })
    try {
      const upload = await uploadPartnerServiceImage({ file, target: userId, kind: 'service' })
      setDraft(current => appendPartnerServiceMedia(current, upload))
      setState({ status: 'uploaded', message: 'Снимката е добавена. Запази услугата.' })
    } catch (error) {
      setState({ status: 'error', message: error.message || 'Качването не успя.' })
    }
  }

  function selectService(serviceId) {
    const selected = items.find(item => item.id === serviceId) || null
    setDraft(makePartnerServiceDraft(profile, selected))
    setActiveSection('info')
    setShowPreview(true)
    setIsEditorOpen(true)
    setAttemptedSubmit(false)
  }

  async function closeEditorSafely() {
    if (state.status === 'saving') return
    if (hasUnsavedChanges) {
      const shouldDiscard = window.confirm('Има незапазени промени. Ако затворите сега, те няма да бъдат записани.')
      if (!shouldDiscard) return
      await deleteStorageRefs(diffStorageRefs(
        mediaAndCoverStorageRefs(draft, 'service-media'),
        mediaAndCoverStorageRefs(persistedDraft, 'service-media'),
      ))
    }
    setDraft(persistedDraft)
    setActiveSection('info')
    setShowPreview(true)
    setAttemptedSubmit(false)
    setIsEditorOpen(false)
    setState(current => (current.status === 'error' ? current : { status: 'ready', message: '' }))
  }

  function handleEditorBackdropMouseDown(event) {
    if (event.target === event.currentTarget) {
      void closeEditorSafely()
    }
  }

  function handleClearDraft() {
    if (!window.confirm('Сигурни ли сте, че искате да изчистите тази услуга?')) return
    setDraft(makeNeutralServiceDraft(profile))
    setActiveSection('info')
    setShowPreview(true)
    setAttemptedSubmit(false)
  }

  async function handleDeleteWithConfirm() {
    if (!draft.id) return
    if (!window.confirm('Сигурни ли сте, че искате да изтриете тази услуга?')) return
    await handleDelete()
  }

  const sectionTitle = draft.id ? draft.title || 'Редакция на услуга' : 'Нова услуга'
  const ActiveIcon = GUIDE_STEPS.find(step => step.id === activeSection)?.icon || BriefcaseBusiness

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="eyebrow">Моите услуги</div>
            <h2 className="mt-2 font-display text-4xl leading-none text-ink md:text-5xl">Моите услуги</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Подреди офертите си като ясни продуктови карти: какво включват, от каква цена започват, къде работиш и дали са готови за публикуване.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={startNewService} className="btn btn-primary"><Plus size={18} /> Нова услуга</button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile label="Всички услуги" value={items.length} active={serviceFilter === 'all'} onClick={() => setServiceFilter('all')} />
          <StatTile label="Публични" value={publishedCount} tone="green" active={serviceFilter === 'published'} onClick={() => setServiceFilter('published')} />
          <StatTile label="За преглед" value={pendingCount} tone="blue" active={serviceFilter === 'pending'} onClick={() => setServiceFilter('pending')} />
          <StatTile label="Чернови" value={items.filter(item => item.moderationStatus === 'draft').length} active={serviceFilter === 'draft'} onClick={() => setServiceFilter('draft')} />
          <StatTile label="Върнати" value={rejectedCount} tone="red" active={serviceFilter === 'rejected'} onClick={() => setServiceFilter('rejected')} />
        </div>

        {items.length > 0 ? (
          filteredItems.length > 0 ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map(item => (
                <ServicePickerCard
                  key={item.id}
                  item={item}
                  active={draft.id === item.id}
                  onSelect={() => selectService(item.id)}
                />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-dashed border-line bg-soft/60 p-6 text-center text-sm text-muted">
              Няма услуги с този статус.
            </div>
          )
        ) : (
          <div className="mt-6 rounded-[1.75rem] border border-dashed border-line bg-soft/70 p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-paper text-accentDeep shadow-sm">
              <BriefcaseBusiness size={24} />
            </div>
            <h3 className="mt-4 font-display text-3xl leading-none text-ink">Още няма услуги</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">Добави първата оферта, за да я покажеш като карта в профила и каталога след одобрение.</p>
            <button type="button" onClick={startNewService} className="btn btn-primary mt-5"><Plus size={18} /> Нова услуга</button>
          </div>
        )}
      </section>

      {isEditorOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] h-[100dvh] w-screen overflow-hidden bg-ink/65 p-0 backdrop-blur-sm"
          onMouseDown={handleEditorBackdropMouseDown}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="flex h-full w-full items-stretch"
            onMouseDown={handleEditorBackdropMouseDown}
          >
          <div className="flex h-full w-full items-stretch">
            <div className="relative flex h-full w-full flex-col overflow-hidden border border-line bg-paper shadow-2xl">
              <div className="shrink-0 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur sm:px-6">
                <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="eyebrow">Услуга</div>
                  <h3 className="mt-1 font-display text-3xl leading-none text-ink">{sectionTitle}</h3>
                </div>
                <button type="button" onClick={() => void closeEditorSafely()} className="rounded-full p-2 text-muted transition hover:bg-soft hover:text-ink" aria-label="Затвори">
                  <X size={22} />
                </button>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
                <div className="min-w-0 p-4 sm:p-5 lg:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium text-ink">
                        <ActiveIcon size={18} className="text-accentDeep" />
                        Редакция
                      </div>
                      <h3 className="mt-2 font-display text-3xl text-ink">{GUIDE_STEPS.find(step => step.id === activeSection)?.label}</h3>
                    </div>
                    <button type="button" onClick={() => setShowPreview(value => !value)} className="btn btn-ghost">
                      <Eye size={18} /> {showPreview ? 'Скрий преглед' : 'Покажи преглед'}
                    </button>
                  </div>

                  <div className="mt-5 grid gap-2 md:grid-cols-4">
                    {GUIDE_STEPS.map((step, index) => (
                      <GuideStepButton
                        key={step.id}
                        step={step}
                        index={index}
                        active={activeSection === step.id}
                        done={stepDone(step.id, checklist)}
                        onClick={() => setActiveSection(step.id)}
                      />
                    ))}
                  </div>

                  <div className="mt-5">
                    {activeSection === 'info' && <InfoSection draft={draft} onChange={update} onStarter={applyStarter} />}
                    {activeSection === 'price' && <PriceSection item={primaryPackage} onChange={updatePackage} onFeatureChange={updateFeature} onAddFeature={addFeature} onRemoveFeature={removeFeature} />}
                    {activeSection === 'media' && <MediaSection draft={draft} onChange={update} onUpload={uploadImage} />}
                    {activeSection === 'faq' && <FaqSection draft={draft} onFaqChange={updateFaq} onAddFaq={addFaq} onRemoveFaq={removeFaq} />}
                  </div>

                  {showPreview && (
                    <div className="mt-7 flex min-h-[36rem] flex-col justify-center rounded-3xl border border-line bg-soft/60 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="eyebrow">Преглед</div>
                          <h3 className="mt-2 font-display text-3xl text-ink">Как ще изглежда за клиента</h3>
                        </div>
                        {draft.slug && draft.isPublished && (
                          <Link to={`/uslugi/${draft.slug}`} className="btn btn-ghost">
                            Отвори страницата <ArrowUpRight size={18} />
                          </Link>
                        )}
                      </div>
                      <ServicePreview service={previewService} profile={profile} />
                    </div>
                  )}
                </div>

                <aside className="space-y-4 border-t border-line bg-soft/50 p-4 sm:p-5 lg:border-l lg:border-t-0">
                  <ServiceValidationPanel checks={requiredChecks} attempted={attemptedSubmit} onSelectStep={setActiveSection} />
                  <ReadinessPanel checklist={checklist} percent={completionPercent} />
                  <VisibilityPanel draft={draft} state={state} />
                  <HelpPanel section={activeSection} profile={profile} />
                </aside>
              </div>

              <div className="shrink-0 border-t border-line bg-paper/95 px-4 py-3 shadow-[0_-18px_40px_rgba(7,31,55,0.08)] backdrop-blur sm:px-6">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className={`text-sm ${state.status === 'error' ? 'text-red-700' : 'text-muted'}`}>
                    {state.message || (canSubmit ? 'Готово за запазване и изпращане.' : 'Можеш да запазиш чернова. За изпращане попълни задължителните полета.')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={handleClearDraft} disabled={state.status === 'saving'} className="btn justify-center border border-amber-300 bg-amber-100 text-amber-950 hover:border-amber-400 hover:bg-amber-200">
                      <X size={18} /> Изчисти
                    </button>
                    {draft.isPublished && <Link to={`/uslugi/${draft.slug}`} className="btn btn-ghost justify-center"><Eye size={18} /> Виж публично</Link>}
                    <button type="button" onClick={() => handleSave(false)} disabled={state.status === 'saving'} className="btn btn-ghost justify-center bg-paper hover:bg-soft">
                      <Save size={18} /> Запази
                    </button>
                    <button type="button" onClick={() => handleSave(true)} disabled={state.status === 'saving'} className="btn btn-primary justify-center">
                      <ClipboardList size={18} /> Изпрати
                    </button>
                    {draft.id && (
                      <button type="button" onClick={handleDeleteWithConfirm} disabled={state.status === 'saving'} className="btn justify-center border border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700">
                        <Trash2 size={18} /> Изтрий
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
        , document.body
      )}
    </div>
  )
}

function ServicePickerCard({ item, active, onSelect }) {
  const statusLabel = SERVICE_STATUS_LABELS[item.moderationStatus] || item.moderationStatus
  const isPublic = item.isPublished && item.moderationStatus === 'approved'
  const image = item.coverUrl || item.media?.[0]?.url || ''

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`overflow-hidden rounded-[24px] border text-left transition hover:-translate-y-0.5 hover:shadow-sm ${active ? 'border-ink bg-ink text-paper' : 'border-line bg-soft text-ink hover:border-ink/30'}`}
    >
      <div className="flex gap-3 p-3">
        <div className={`h-20 w-20 shrink-0 overflow-hidden rounded-2xl ${active ? 'bg-paper/10' : 'bg-paper'}`}>
          {image ? <img src={image} alt={item.title || 'Услуга'} className="img-cover" /> : <div className="flex h-full w-full items-center justify-center"><BriefcaseBusiness size={22} className={active ? 'text-paper/60' : 'text-muted'} /></div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className={`truncate text-xs uppercase tracking-[0.14em] ${active ? 'text-paper/60' : 'text-muted'}`}>{statusLabel}</div>
            {isPublic ? <CheckCircle2 size={18} className={active ? 'text-paper' : 'text-accentDeep'} /> : <CircleDot size={18} className={active ? 'text-paper/80' : 'text-muted'} />}
          </div>
          <div className="mt-2 line-clamp-2 font-display text-xl leading-tight">{item.title || 'Услуга без заглавие'}</div>
          <div className={`mt-2 text-sm ${active ? 'text-paper/70' : 'text-muted'}`}>
            {item.lowestPrice ? formatServicePrice(item.lowestPrice) : 'Цена по оферта'}
          </div>
        </div>
      </div>
    </button>
  )
}

function EmptyServicesPanel({ onStarter }) {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-line bg-soft p-5 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 text-sm font-medium text-ink"><Sparkles size={18} className="text-accentDeep" /> Шаблони за първа услуга</div>
          <p className="mt-2 text-sm leading-6 text-muted">
            Избери най-близката работа. Ще попълним заглавие, цена, включени дейности и въпроси, а ти само ги редактираш.
          </p>
        </div>
      </div>
      <StarterTemplateGrid onStarter={onStarter} />
    </div>
  )
}

function StarterTemplateGrid({ onStarter, compact = false }) {
  return (
    <div className={`mt-4 grid gap-2 ${compact ? 'md:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
      {SERVICE_STARTERS.map(starter => (
        <button
          key={starter.title}
          type="button"
          onClick={() => onStarter(starter)}
          className="rounded-2xl border border-line bg-paper p-3 text-left transition hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">{starter.group}</div>
              <div className="mt-1 line-clamp-1 font-medium text-ink">{starter.title}</div>
            </div>
            <ChevronRight size={16} className="mt-1 shrink-0 text-muted" />
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted">{starter.subtitle}</p>
        </button>
      ))}
    </div>
  )
}

function VisibilityPanel({ draft, state }) {
  const isPublic = draft.isPublished && draft.moderationStatus === 'approved' && draft.slug
  const statusLabel = SERVICE_STATUS_LABELS[draft.moderationStatus] || draft.moderationStatus || 'Чернова'
  return (
    <div className={`rounded-3xl border p-5 ${isPublic ? 'border-trustGreen/30 bg-trustGreen/5' : 'border-line bg-paper'}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        {isPublic ? <CheckCircle2 size={18} className="text-trustGreen" /> : <CircleDot size={18} className="text-muted" />}
        {isPublic ? 'Видима за клиенти' : statusLabel}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">
        {isPublic ? 'Показва се в услугите, каталога и публичния ти профил.' : 'Черновите са видими само за теб. Изпратените услуги чакат преглед от Totsan.'}
      </p>
      {draft.moderationNote && (
        <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
          Бележка от модерация: {draft.moderationNote}
        </div>
      )}
      {draft.moderationAttachments?.length > 0 && (
        <ModerationFeedbackImages attachments={draft.moderationAttachments} />
      )}
      {isPublic && (
        <Link to={`/uslugi/${draft.slug}`} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-ink underline underline-offset-4">
          Отвори страницата <ArrowUpRight size={16} />
        </Link>
      )}
      {state.message && state.status !== 'ready' && (
        <div className={`mt-3 rounded-xl px-3 py-2 text-xs ${state.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-soft text-muted'}`}>
          {state.message}
        </div>
      )}
    </div>
  )
}

function ModerationFeedbackImages({ attachments }) {
  const [images, setImages] = useState([])

  useEffect(() => {
    let active = true
    resolveServiceModerationAttachments(attachments)
      .then((nextImages) => {
        if (active) setImages(nextImages.filter(item => item.url))
      })
      .catch(() => {
        if (active) setImages([])
      })
    return () => { active = false }
  }, [attachments])

  if (!images.length) return null
  return (
    <div className="mt-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-amber-800">Приложени снимки</div>
      <div className="grid grid-cols-2 gap-2">
        {images.map(image => (
          <a key={image.path} href={image.url} target="_blank" rel="noreferrer" className="aspect-[4/3] overflow-hidden rounded-2xl border border-amber-200 bg-paper">
            <img src={image.url} alt={image.name || 'Снимка от модерацията'} className="h-full w-full object-cover transition hover:scale-[1.03]" />
          </a>
        ))}
      </div>
    </div>
  )
}

function ReadinessPanel({ checklist, percent }) {
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

function ServiceValidationPanel({ checks, attempted, onSelectStep }) {
  const missing = checks.filter(item => !item.done)
  const complete = missing.length === 0

  return (
    <div className={`rounded-3xl border p-4 ${complete ? 'border-emerald-100 bg-emerald-50' : attempted ? 'border-red-100 bg-red-50' : 'border-line bg-paper'}`}>
      <div className={`text-sm font-semibold ${complete ? 'text-emerald-800' : attempted ? 'text-red-700' : 'text-ink'}`}>
        {complete ? 'Готово за изпращане' : attempted ? 'Остава още малко' : 'Задължително за изпращане'}
      </div>
      <p className={`mt-1 text-sm leading-5 ${complete ? 'text-emerald-800/80' : attempted ? 'text-red-700/80' : 'text-muted'}`}>
        {complete ? 'Всички задължителни полета са попълнени.' : 'Чернова може да се запази по всяко време. За изпращане попълни тези полета.'}
      </p>
      <div className="mt-3 space-y-2">
        {checks.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelectStep(item.step)}
            className={`flex w-full items-start gap-2 rounded-2xl px-3 py-2 text-left text-sm transition ${
              item.done
                ? 'bg-paper/70 text-ink'
                : attempted
                  ? 'bg-white/70 text-red-700 hover:bg-white'
                  : 'bg-soft text-muted hover:bg-paper'
            }`}
          >
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${item.done ? 'bg-trustGreen text-paper' : attempted ? 'bg-red-100 text-red-700' : 'bg-paper text-muted'}`}>
              {item.done ? <Check size={13} /> : <CircleDot size={13} />}
            </span>
            <span>
              <span className="block font-medium">{item.label}</span>
              {!item.done && attempted && <span className="mt-0.5 block text-xs leading-5">{item.message}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function HelpPanel({ section, profile }) {
  const layer = LAYERS.find(item => item.slug === profile.layerSlug)
  const content = {
    info: {
      title: 'Какво търси клиентът',
      lines: ['Ясно име на услугата.', 'Кратко обещание без сложни думи.', 'Райони, за да знае дали работиш при него.'],
    },
    price: {
      title: 'Как да дадеш цена',
      lines: ['Сложи стартова цена, не крайна гаранция.', 'Напиши какво влиза в нея.', 'Обясни кога цената се уточнява след оглед.'],
    },
    media: {
      title: 'Какви снимки помагат',
      lines: ['Реален обект или детайл от работа.', 'Преди и след, ако имаш.', 'Светла снимка без тежки филтри.'],
    },
    faq: {
      title: 'Най-полезни въпроси',
      lines: ['Материалите включени ли са?', 'Колко време отнема?', 'Трябва ли оглед преди оферта?'],
    },
  }[section]

  return (
    <div className="rounded-3xl border border-line bg-soft p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        <Lightbulb size={18} className="text-accentDeep" />
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

function InfoSection({ draft, onChange, onStarter }) {
  return (
    <div className="space-y-5">
      <details className="group rounded-3xl border border-line bg-soft p-4">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <span className="flex items-start gap-3">
            <ClipboardList size={20} className="mt-0.5 shrink-0 text-accentDeep" />
            <span>
              <span className="block font-medium text-ink">Бърз старт от готов шаблон</span>
            </span>
          </span>
          <ChevronRight size={18} className="mt-1 shrink-0 text-muted transition group-open:rotate-90" />
        </summary>
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-sm leading-6 text-muted">Избери най-близък тип работа. После промени думите, цената и детайлите според твоята оферта.</p>
          <StarterTemplateGrid onStarter={onStarter} compact />
        </div>
      </details>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(26rem,0.82fr)]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <Field label="Заглавие" hint="Кратко и конкретно, например “Монтаж на паркет”, не “Всякакви ремонти”.">
            <input value={draft.title} onChange={event => onChange('title', event.target.value)} className={INPUT} placeholder="Боядисване на стая" />
          </Field>
          <Field label="Кратко подзаглавие" hint="Едно изречение с ползата за клиента.">
            <input value={draft.subtitle} onChange={event => onChange('subtitle', event.target.value)} className={INPUT} placeholder="Подготовка, чисто изпълнение и финално почистване" />
          </Field>
          <Field label="Слой">
            <TotsanSelect className="mt-2" value={draft.layerSlug} onChange={(value) => onChange('layerSlug', value)} placeholder="Избери слой" options={LAYERS.map(layer => ({ value: layer.slug, label: `Слой ${layer.number} · ${layer.title}` }))} />
          </Field>
          <Field label="Тагове" hint="Раздели с запетая. Използват се за търсене.">
            <input value={draft.tagsText} onChange={event => onChange('tagsText', event.target.value)} className={INPUT} placeholder="боя, шпакловка, освежаване" />
          </Field>
        </div>
        <div className="min-w-0 rounded-3xl border border-line bg-paper/70 p-4 shadow-[0_14px_35px_rgba(13,35,64,0.04)]">
          <div className="mb-3 inline-flex items-center gap-2 text-base font-semibold text-ink">
            Райони
            <HelperHint text="Градове или населени места, в които работиш." />
          </div>
          <LocationMultiCombobox
            label="Обслужвани места"
            value={draft.deliveryAreasText}
            onChange={(value) => onChange('deliveryAreasText', value)}
            helper=""
          />
        </div>
      </div>
      <Field label="Описание" hint="Опиши обхвата, процеса и какво трябва да подготви клиентът.">
        <textarea rows={8} value={draft.descriptionMd} onChange={event => onChange('descriptionMd', event.target.value)} className={INPUT} placeholder="Подходящо за освежаване на стая, коридор или малък офис. Оглеждам основата, пазя пода и мебелите, правя нужната подготовка и оставям помещението чисто след работа." />
      </Field>
    </div>
  )
}

function PriceSection({ item, onChange, onFeatureChange, onAddFeature, onRemoveFeature }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Име на офертата" hint="Например “Стартова оферта” или “Оглед и планиране”.">
          <input value={item.title} onChange={event => onChange('title', event.target.value)} className={INPUT} placeholder="Стартова оферта" />
        </Field>
        <div className="flex flex-col">
          <Field label="Стартова цена" hint="По-добре ориентир, отколкото празно поле.">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">€</span>
              <input type="number" min="0" value={item.priceAmount} onChange={event => onChange('priceAmount', event.target.value)} className={`${INPUT} pl-14`} placeholder="250" />
            </div>
          </Field>
          {Number(item.priceAmount) > 0 && (
            <div className="mt-2 text-xs text-muted">
              Ще се показва като {item.priceAmount} € / {getBgnEquivalentText(item.priceAmount).replace('≈ ', '')}
            </div>
          )}
        </div>
      </div>
      <Field label="Кратко описание на цената" hint="Кажи от какво зависи финалната оферта.">
        <textarea rows={4} value={item.description} onChange={event => onChange('description', event.target.value)} className={INPUT} placeholder="Цената е стартова и се уточнява според квадратурата, състоянието на основата и избраните материали." />
      </Field>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-ink">Какво включва</div>
          </div>
          <button type="button" onClick={onAddFeature} className="btn btn-ghost !py-2 text-sm"><Plus size={16} /> Добави ред</button>
        </div>
        <div className="mt-3 space-y-2">
          {(item.features || []).map((feature, index) => (
            <div key={index} className="flex gap-2">
              <input value={feature} onChange={event => onFeatureChange(index, event.target.value)} className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-base font-normal leading-6 outline-none focus:border-ink" placeholder="Напр. Подготовка, труд и финално почистване" />
              <button type="button" onClick={() => onRemoveFeature(index)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-700" aria-label="Премахни ред">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
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

function getMediaPreviewUrl(item = {}) {
  if (!item) return ''
  if (isVideoMedia(item)) return item.thumbnail || getYoutubeThumbnail(item.url) || ''
  return item.url || ''
}

function getCoverFromMedia(media = []) {
  const firstVisual = media.find(item => getMediaPreviewUrl(item))
  return firstVisual ? getMediaPreviewUrl(firstVisual) : ''
}

function getMediaSortKey(item = {}, index = 0) {
  return item.path || item.url || item.thumbnail || item.caption || `${item.provider || item.type || 'media'}-${index}`
}

function MediaSection({ draft, onChange, onUpload }) {
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

  async function handleUploadFiles(files) {
    const nextFiles = Array.from(files || [])
    for (const file of nextFiles) {
      await onUpload(file)
    }
  }

  function handleRemoveMedia(index) {
    updateMedia(media.filter((_, itemIndex) => itemIndex !== index), { animate: true })
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

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-line bg-soft p-4">
        <div className="flex items-start gap-3">
          <Images size={20} className="mt-0.5 shrink-0 text-accentDeep" />
          <div>
            <div className="font-medium text-ink">Снимката продава доверието</div>
            <p className="mt-1 text-sm leading-6 text-muted">Добави снимки и YouTube видео към услугата. Първата визуална позиция става основна снимка.</p>
          </div>
        </div>
      </div>
      <label className="btn btn-primary cursor-pointer justify-center">
        <ImagePlus size={18} /> Качи снимки към услугата
        <input type="file" accept="image/*" multiple className="sr-only" onChange={async (event) => { await handleUploadFiles(event.target.files); event.target.value = '' }} />
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

      {media.length > 0 ? (
        <div className="rounded-3xl border border-line bg-paper/80 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-ink">Медии към услугата</div>
              <p className="mt-1 text-sm leading-6 text-muted">Първата позиция е основната снимка/визия. Хвани ред и го премести нагоре или надолу.</p>
            </div>
            <span className="rounded-full bg-soft px-3 py-1 text-xs font-semibold text-muted">{media.length}</span>
          </div>
          <div ref={mediaListRef} className="mt-4 space-y-2">
            {media.map((item, index) => (
              <div key={getMediaSortKey(item, index)} className="space-y-2">
                <DropSlot active={isDropSlotActive(index)} />
                <ServiceMediaManagerItem
                  mediaKey={getMediaSortKey(item, index)}
                  item={item}
                  index={index}
                  isDragging={dragIndex === index}
                  onPointerDown={(event) => handlePointerDragStart(event, index)}
                  onRemove={() => handleRemoveMedia(index)}
                />
              </div>
            ))}
            <DropSlot active={isDropSlotActive(media.length)} />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-soft p-5 text-sm text-muted">
          Още няма качени снимки или видео към тази услуга.
        </div>
      )}
    </div>
  )
}

function ServiceMediaManagerItem({ item, index, mediaKey, isDragging, onPointerDown, onRemove }) {
  const isVideo = isVideoMedia(item)
  const preview = getMediaPreviewUrl(item)
  const label = isVideo ? (item.provider === 'youtube' ? 'YouTube видео' : 'Видео линк') : 'Снимка'
  const source = item.caption || item.url || item.thumbnail || 'Медия към услугата'
  const stateClass = isDragging
    ? 'relative z-10 scale-[1.035] -translate-y-0.5 rotate-[0.25deg] border-accentDeep bg-paper shadow-[0_22px_60px_rgba(13,35,64,0.18)] ring-4 ring-accent/20'
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

function FaqSection({ draft, onFaqChange, onAddFaq, onRemoveFaq }) {
  return (
    <div className="space-y-4">
      {draft.faq.map((item, index) => (
        <div key={index} className="rounded-3xl border border-line bg-soft p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-ink">Въпрос {index + 1}</div>
            <button type="button" onClick={() => onRemoveFaq(index)} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-paper text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-700" aria-label="Премахни въпрос">
              <X size={16} />
            </button>
          </div>
          <Field label="Въпрос"><input value={item.question} onChange={event => onFaqChange(index, 'question', event.target.value)} className={INPUT} placeholder="Материалите включени ли са?" /></Field>
          <Field label="Отговор"><textarea rows={3} value={item.answer} onChange={event => onFaqChange(index, 'answer', event.target.value)} className={INPUT} placeholder="Мога да работя с материали на клиента или да препоръчам подходящи варианти." /></Field>
        </div>
      ))}
      <button type="button" onClick={onAddFaq} className="btn btn-ghost"><Plus size={18} /> Добави въпрос</button>
    </div>
  )
}

function ServicePreview({ service, profile }) {
  const offer = service.packages[0] || makeEmptyPackage('basic')
  const areas = service.deliveryAreas || []
  const layer = LAYERS.find(item => item.slug === service.layerSlug)
  const previewProfile = profile || service.profile || {}
  const coverCandidates = getPartnerServiceCoverCandidates({ ...service, profile: previewProfile }, previewProfile)
  const location = previewProfile.city || areas[0] || 'По запитване'

  return (
    <article className="card img-zoom-host mx-auto mt-5 flex h-full min-h-[28rem] max-w-md flex-col overflow-hidden bg-paper p-0">
      <div className="media-frame aspect-[16/10] bg-soft">
        <FallbackImage sources={coverCandidates} alt={service.title || 'Услуга'} loading="lazy" decoding="async" className="img-cover img-zoom" />
        <span className="absolute right-3 top-3 rounded-full bg-ink/90 px-2.5 py-1 text-xs text-paper backdrop-blur">
          Услуга
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <span className="text-xs text-muted">
          {layer ? `Слой ${layer.number} · ${layer.title}` : 'Услуга'}
        </span>
        <div className="mt-2 font-display text-xl text-ink">{service.title || 'Заглавие на услугата'}</div>
        <div className="text-sm text-muted">{service.subtitle || previewProfile?.name || 'Кратко описание на услугата'}</div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">{formatServicePrice(offer.priceAmount)}</span>
          <span className="truncate text-muted">{previewProfile?.name || 'Твоят профил'}</span>
        </div>
        <div className="mt-3 flex items-center gap-1 text-xs text-muted">
          <MapPin size={14} /> {location}
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(service.tags || []).slice(0, 3).map(tag => (
            <span key={tag} className="rounded-full bg-soft px-2.5 py-1 text-xs text-muted">{tag}</span>
          ))}
        </div>
        <div className="mt-auto pt-5">
          <span className="btn btn-ghost w-full justify-center">Виж пакет</span>
        </div>
      </div>
    </article>
  )
}

function GuideStepButton({ step, index, active, done, onClick }) {
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
        {done && <CheckCircle2 size={18} className={active ? 'text-paper' : 'text-trustGreen'} />}
      </div>
      <p className={`mt-1.5 line-clamp-2 text-xs leading-5 ${active ? 'text-paper/65' : 'text-muted'}`}>{step.helper}</p>
    </button>
  )
}

function StatTile({ label, value, tone = 'neutral', active = false, onClick }) {
  const toneClass = tone === 'green'
    ? 'bg-trustGreen/10 text-trustGreen'
    : tone === 'blue'
      ? 'bg-accentSoft text-accentDeep'
      : tone === 'red'
        ? 'bg-red-50 text-red-700 ring-1 ring-red-100'
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

function Field({ label, hint, children }) {
  return (
    <div className="relative block text-base font-semibold text-ink">
      <span className="inline-flex items-center gap-2">
        {label}
        {hint && <HelperHint text={hint} />}
      </span>
      {children}
    </div>
  )
}

function HelperHint({ text }) {
  return (
    <span className="group/help relative inline-flex">
      <span tabIndex={0} className="flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-line bg-soft text-[11px] font-semibold text-muted outline-none transition hover:border-ink/30 hover:text-ink focus:border-ink/30 focus:text-ink">
        ?
      </span>
      <span className="pointer-events-none absolute left-0 top-7 z-20 hidden w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-line bg-ink px-3 py-2 text-xs font-normal leading-5 text-paper shadow-xl group-hover/help:block group-focus-within/help:block">
        {text}
      </span>
    </span>
  )
}

function getServiceChecklist(draft, primaryPackage) {
  return [
    { key: 'layer', label: 'Има избран слой', done: Boolean(draft.layerSlug) },
    { key: 'title', label: 'Има ясно заглавие', done: Boolean(draft.title.trim()) },
    { key: 'subtitle', label: 'Има кратко подзаглавие', done: Boolean(draft.subtitle.trim()) },
    { key: 'price', label: 'Има стартова цена', done: Number(primaryPackage.priceAmount) > 0 },
    { key: 'features', label: 'Има включени дейности', done: (primaryPackage.features || []).filter(Boolean).length >= 3 },
    { key: 'areas', label: 'Има райони на работа', done: Boolean(draft.deliveryAreasText.trim()) },
    { key: 'description', label: 'Има описание на процеса', done: draft.descriptionMd.trim().length >= 80 },
    { key: 'media', label: 'Има поне една снимка', done: Boolean(draft.media?.length) },
    { key: 'faq', label: 'Има полезен въпрос и отговор', done: draft.faq.some(item => item.question.trim() && item.answer.trim()) },
  ]
}

function getServiceRequiredChecks(draft, primaryPackage) {
  return [
    {
      key: 'layer',
      step: 'info',
      label: 'Избран слой',
      message: 'Избери слой, за да знаем в коя категория да показваме услугата.',
      done: Boolean(draft.layerSlug),
    },
    {
      key: 'title',
      step: 'info',
      label: 'Заглавие на услугата',
      message: 'Добави кратко и ясно заглавие.',
      done: Boolean(draft.title.trim()),
    },
    {
      key: 'price',
      step: 'price',
      label: 'Стартова цена',
      message: 'Добави стартова цена в евро.',
      done: Number(primaryPackage.priceAmount) > 0,
    },
  ]
}

function stepDone(stepId, checklist) {
  const keysByStep = {
    info: ['layer', 'title', 'subtitle', 'areas', 'description'],
    price: ['price', 'features'],
    media: ['media'],
    faq: ['faq'],
  }
  const keys = keysByStep[stepId] || []
  return keys.every(key => checklist.find(item => item.key === key)?.done)
}
