import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Camera, CheckCircle2, FileSpreadsheet, FileText, FileType, ImagePlus, Play, Save, Trash2, UploadCloud,
  Edit3, MapPin, Home, Banknote, Calendar, AlignLeft, Layers, ShieldCheck
} from 'lucide-react'
import { LAYERS } from '../../data/layers.js'
import {
  DEFAULT_PROJECT,
  LOCATION_ACCESS_OPTIONS,
  PROJECT_MEDIA_KINDS,
  PROPERTY_TYPES,
  getLocationAccessLabel,
  getLocationAccessSummary,
  getProjectLocationAccess,
  mergeQuizAnswer,
  isMeaningfulProject,
  withProjectLocationAccess,
} from '../../lib/projects.js'
import TotsanSelect from '../ui/TotsanSelect.jsx'
import { LocationCombobox } from '../ui/LocationCombobox.jsx'

const INPUT = 'mt-2 w-full rounded-2xl border border-line/75 bg-soft/30 px-4 py-3.5 text-sm outline-none transition-all duration-200 focus:bg-paper focus:border-accentDeep focus:shadow-sm'
const TEXTAREA = 'mt-2 w-full rounded-2xl border border-line/75 bg-soft/30 px-4 py-3.5 text-sm outline-none transition-all duration-200 focus:bg-paper focus:border-accentDeep focus:shadow-sm resize-none'
const PROJECT_UPLOAD_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx'
const PROJECT_UPLOAD_ERROR = 'Този тип файл не се поддържа. Можете да качите JPG, PNG, WEBP, PDF, DOC, DOCX, XLS или XLSX.'
const SUPPORTED_PROJECT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])
const PROJECT_UPLOAD_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx'])

function getExtension(fileName = '') {
  const match = String(fileName).toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] || ''
}

function getMediaUrl(item) {
  return item?.url || item?.publicUrl || item?.signedUrl || ''
}

function isImageMedia(item) {
  return String(item?.type || '').startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(getExtension(item?.fileName || item?.path || getMediaUrl(item)))
}

function isDocumentMedia(item) {
  return !isImageMedia(item)
}

function isImageFile(file) {
  return String(file?.type || '').startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(getExtension(file?.name || ''))
}

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

function LocationAccessSelect({ label, value, onChange, options, helper = '' }) {
  return (
    <TotsanSelect
      label={label}
      value={value}
      onChange={onChange}
      options={[{ value: '', label: 'Избери...' }, ...(options || [])]}
      helper={helper}
    />
  )
}

function CheckboxGroup({ values = [], options = [], onToggle }) {
  const selected = new Set(values)
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const active = selected.has(option.value)
        return (
          <label
            key={option.value}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-2.5 text-sm transition ${active ? 'border-accentDeep bg-accentSoft text-accentDeep' : 'border-line bg-paper text-ink hover:border-ink/30'}`}
          >
            <input
              type="checkbox"
              checked={active}
              onChange={() => onToggle(option.value)}
              className="mt-1 h-4 w-4 rounded border-line text-accentDeep focus:ring-accentDeep"
            />
            {option.label}
          </label>
        )
      })}
    </div>
  )
}

function ReadOnlyItem({ label, value, className = '' }) {
  if (!String(value || '').trim()) return null
  return (
    <div className={className}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-ink">{value}</div>
    </div>
  )
}

function hasExactLocationDetails(access) {
  return Boolean(
    access?.exactAddress
    || access?.googleMapsUrl
    || access?.entrance
    || access?.floor
    || access?.unitNumber
    || access?.accessInstructions
    || access?.visitPhone
  )
}

function exactLocationLabels(propertyType) {
  if (propertyType === 'apartment') {
    return { entrance: 'Вход', floor: 'Етаж', unit: 'Апартамент', showFloor: true, showEntrance: true, showUnit: true }
  }
  if (propertyType === 'house') {
    return { entrance: 'Двор / портал', unit: 'Номер / ориентир', showFloor: false, showEntrance: true, showUnit: true }
  }
  if (propertyType === 'office' || propertyType === 'commercial') {
    return { entrance: 'Вход / рецепция / охрана', floor: 'Етаж', unit: 'Офис / обект №', showFloor: true, showEntrance: true, showUnit: true }
  }
  return { entrance: 'Вход / достъп', floor: 'Етаж', unit: 'Номер / ориентир', showFloor: propertyType !== 'outdoor', showEntrance: true, showUnit: true }
}

function getDisplayFileName(item) {
  if (item?.fileName) return item.fileName
  const source = item?.path || getMediaUrl(item)
  const lastSegment = String(source).split('/').pop() || ''
  return decodeURIComponent(lastSegment.split('?')[0] || '')
}

function formatFileSize(size) {
  const bytes = Number(size)
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function cleanBudgetInput(value) {
  return String(value || '').replace(/[^\d]/g, '')
}

function formatBudgetInput(value) {
  const digits = cleanBudgetInput(value)
  return digits ? Number(digits).toLocaleString('en-US') : ''
}

function isSupportedProjectFile(file) {
  if (!file) return false
  const extension = getExtension(file.name)
  return SUPPORTED_PROJECT_MIME_TYPES.has(file.type) || PROJECT_UPLOAD_EXTENSIONS.has(extension)
}

const QUIZ_CONFIG_LOADERS = {
  paint: () => import('../quiz/paint-config.js').then(module => module.paintConfig),
  windows: () => import('../quiz/windows-config.js').then(module => module.windowsConfig),
  tiles: () => import('../quiz/tiles-config.js').then(module => module.tilesConfig),
  flooring: () => import('../quiz/flooring-config.js').then(module => module.flooringConfig),
}

const MATERIAL_QUIZZES = (LAYERS.find(layer => layer.slug === 'materiali')?.whatYouFind || [])
  .filter(item => item.quizSlug && QUIZ_CONFIG_LOADERS[item.quizSlug])

function makeDraft(project) {
  return {
    ...DEFAULT_PROJECT,
    ...(project || {}),
    quizAnswers: project?.quizAnswers || {},
  }
}

function CustomSpaceIcon({ size = 14, className = '' }) {
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
        <path d="M2337.99,1853.85v333.17l133.65,92.31,5.67,17.47-11.86,17.7-389.92,1.71c-12.4-4.46-18.75-16.6-14.92-29.54l138.32-99.65v-333.17h-324.48v223.08c0,23.29-45.58,49.73-46.46,53.34-5.52,22.67,13.24,84.76-15.55,93.24-13.27,3.91-82.52,3.49-92.1-4.07-16.27-12.83-4.79-66.38-8.13-87.47h-648.96c-3.34,21.09,8.13,74.65-8.13,87.47-9.58,7.55-78.83,7.98-92.1,4.07-28.79-8.49-10.03-70.58-15.55-93.24-.88-3.61-46.46-30.05-46.46-53.34v-223.08h-136.16L17.64,2271.18l-17.64-11.75L2.46,425.12,759.36,0l1871.79,4.93,8.47,26.3-3.32,1810.95c-1.28,2.74-10.5,11.68-11.5,11.68h-286.82ZM2592.94,46.05H785.13v1761.45h121.68c3.03-34.34,34.14-55.96,64.08-67.35,5.24-71.7-29.78-178.27,71.86-187.82,223.43,12.23,462.65-15.5,684.19-.02,109,7.61,72.14,110.23,77.63,187.84,29.94,11.39,61.05,33.01,64.08,67.35h330.27v-370.83h-147.75c-18.5,0-11.97-32.38-8.92-43.72,28.53-106.38,100.7-222.97,132.37-331.14l12.7-16.27c9.52-4.55,137.94-5.73,153.44-2.76,8.01,1.53,13.23,4.48,17.32,11.65l164.4,351.81c6.91,40.64-41.48,29.63-68.62,30.43v162.24h-46.35v-162.24h-69.53v370.83h254.95V46.05ZM576.54,1906l162.24-89.81V63.43L43.47,451.64v1755.66l162.48-90.78,2.61-900.08,333.01-194.51c9.36-8.48,34.96,4.36,34.96,12.03v872.03ZM252.06,2091.42l278.12-159.34v-848.86l-278.12,156.44v851.75ZM2094.63,1390.31h365.04l-141.73-301.73c-22.28,4.65-91.64-7.38-104.7,6.05l-118.61,295.68ZM2291.64,1436.67h-46.35v773.53l-81.12,60.84h208.59l-81.12-60.84v-773.53ZM1364.56,1598.9h-333.17c-25.14,0-10.56,119.58-14.83,141.24,50.42,17.22,76.87,60.51,69.85,113.73,82.02,6.57,177.51-8.95,257.87-.03,16.23,1.8,41.28,16.86,45.23,16.28,8.38-1.23,21.36-14.02,41.68-16.28,80.34-8.94,175.87,6.61,257.87.03-7.02-53.22,19.43-96.51,69.85-113.73-4.27-21.67,10.31-141.24-14.83-141.24h-333.17v162.24h-46.35v-162.24ZM980.55,1785.46c-20.73,4.53-31.01,22.36-33.31,42.19-2.96,25.49-2.4,235.31,3,246.41,2.36,4.85,7.6,8.87,12.78,10.39l853.51-1.7,10.39-12.78c-5.9-75.38,12.14-175.28.82-247.64-6.01-38.47-55.67-52.02-80.91-23.65-25.36,28.51-3.77,131.92-11.62,173.8-1.78,9.51-6,16.09-15.49,19.28l-668.1-1.7c-39.63-19.27,36.38-228.04-71.09-204.58ZM1364.56,1946.56c3.4-11.01-2.18-46.35-14.49-46.35h-263.64v46.35h278.12ZM1689.03,1900.21h-263.64c-12.31,0-17.88,35.35-14.49,46.35h278.12v-46.35ZM1016.94,2131.92l-23.3.03.06,46.44,23.3-.03-.06-46.44ZM1781.78,2131.92l-23.3.03.06,46.44,23.3-.03-.06-46.44ZM2106.48,138.35l.07,881.4-881.33.07-.07-881.4,881.33-.07ZM2059.87,185.11h-788.02v788.02h788.02V185.11Z"/>
        <path d="M1642.94,231.05l.08,325.15-325.15.08-.08-325.15,325.15-.08ZM1364.56,277.82v231.77h231.77v-231.77h-231.77Z"/>
        <path d="M2013.77,231.05l.08,325.15-325.15.08-.08-325.15,325.15-.08ZM1735.39,277.82v231.77h231.77v-231.77h-231.77Z"/>
        <path d="M1643.02,601.96v325.15h-325.15v-325.15h325.15ZM1364.56,648.65v231.77h231.77v-231.77h-231.77Z"/>
        <path d="M2013.84,601.95l.08,325.08-325.22.08-.08-325.08,325.22-.08ZM1735.39,648.65v231.77h231.77v-231.77h-231.77Z"/>
      </g>
    </svg>
  )
}

export default function CustomerProject({ project, pendingBrief, media, onSave, onImportPendingBrief, onUploadMedia, onUpdateMedia, onDeleteMedia }) {
  const [draft, setDraft] = useState(() => makeDraft(project))
  const [saveStatus, setSaveStatus] = useState({ type: 'idle', message: '' })
  const [uploadStatus, setUploadStatus] = useState({ type: 'idle', message: '' })
  const [dragOver, setDragOver] = useState(false)
  const [activeQuizSlug, setActiveQuizSlug] = useState('')
  const [quizStatus, setQuizStatus] = useState({ type: 'idle', message: '' })
  const quizRef = useRef(null)
  const draftRef = useRef(draft)

  // UX View Mode State
  const hasMeaningfulContent = Boolean(project?.title || project?.ideaDescription || project?.addressCity)
  const [isEditing, setIsEditing] = useState(!hasMeaningfulContent)
  const [exactLocationOpen, setExactLocationOpen] = useState(() => hasExactLocationDetails(getProjectLocationAccess(project)))

  useEffect(() => {
    setDraft(makeDraft(project))
    setExactLocationOpen(hasExactLocationDetails(getProjectLocationAccess(project)))
    if (project?.title || project?.ideaDescription) {
      setIsEditing(false)
    }
  }, [project?.id, project?.updatedAt])

  const [conflictModal, setConflictModal] = useState(false)
  const handledBriefRef = useRef(null)

  useEffect(() => {
    if (!pendingBrief) return
    const briefKey = JSON.stringify(pendingBrief)
    if (handledBriefRef.current === briefKey) return

    const pendingBriefId = pendingBrief.quizAnswers?.start?.briefId
    const currentBriefId = project?.quizAnswers?.start?.briefId
    const hasSameBriefId = pendingBriefId && currentBriefId && pendingBriefId === currentBriefId

    if (!isMeaningfulProject(project, media) || hasSameBriefId) {
      handledBriefRef.current = briefKey
      setDraft(current => ({
        ...current,
        title: current.title || pendingBrief.title || '',
        currentLayerSlug: pendingBrief.currentLayerSlug || current.currentLayerSlug,
        ideaDescription: current.ideaDescription ? `${current.ideaDescription}\n\n${pendingBrief.ideaDescription || ''}` : pendingBrief.ideaDescription || current.ideaDescription,
        quizAnswers: { ...(current.quizAnswers || {}), ...(pendingBrief.quizAnswers || {}) },
      }))
      setSaveStatus({ type: 'idle', message: 'Импортирахме резултата от началния quiz. Прегледай и запази проекта.' })
      setIsEditing(true)
      onImportPendingBrief?.()
    } else {
      handledBriefRef.current = briefKey
      setConflictModal(true)
    }
  }, [pendingBrief, project, media, onImportPendingBrief])

  const handleUpdateCurrent = () => {
    setDraft(current => ({
      ...current,
      title: current.title || pendingBrief.title || '',
      currentLayerSlug: pendingBrief.currentLayerSlug || current.currentLayerSlug,
      ideaDescription: current.ideaDescription ? `${current.ideaDescription}\n\n${pendingBrief.ideaDescription || ''}` : pendingBrief.ideaDescription || current.ideaDescription,
      quizAnswers: { ...(current.quizAnswers || {}), ...(pendingBrief.quizAnswers || {}) },
    }))
    setConflictModal(false)
    setIsEditing(true)
    setSaveStatus({ type: 'idle', message: 'Брифът е добавен към текущия проект. Запази, за да потвърдиш.' })
    onImportPendingBrief?.()
  }

  const handleCreateNew = async () => {
    setConflictModal(false)
    setSaveStatus({ type: 'saving', message: 'Създаваме нов проект...' })
    const nextDraft = {
      ...DEFAULT_PROJECT,
      title: pendingBrief.title || '',
      currentLayerSlug: pendingBrief.currentLayerSlug || DEFAULT_PROJECT.currentLayerSlug,
      ideaDescription: pendingBrief.ideaDescription || '',
      quizAnswers: pendingBrief.quizAnswers || {},
    }
    try {
      await onSave(nextDraft, { createNew: true })
      setSaveStatus({ type: 'saved', message: 'Новият проект е създаден.' })
      setIsEditing(false)
      onImportPendingBrief?.()
    } catch (error) {
      setSaveStatus({ type: 'error', message: error.message || 'Създаването не успя.' })
    }
  }

  const handleCancelConflict = () => {
    setConflictModal(false)
  }

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const currentLayer = useMemo(
    () => LAYERS.find(layer => layer.slug === draft.currentLayerSlug) || LAYERS[0],
    [draft.currentLayerSlug],
  )

  const currentLayerQuizzes = useMemo(
    () => (currentLayer?.whatYouFind || []).filter(item => item.quizSlug && QUIZ_CONFIG_LOADERS[item.quizSlug]),
    [currentLayer],
  )

  const visibleQuizzes = currentLayerQuizzes.length > 0 ? currentLayerQuizzes : MATERIAL_QUIZZES
  const savedQuizKeys = Object.keys(draft.quizAnswers || {})

  useEffect(() => {
    if (!activeQuizSlug || !quizRef.current) return undefined

    const node = quizRef.current
    const loader = QUIZ_CONFIG_LOADERS[activeQuizSlug]
    let cancelled = false

    function handleQuizComplete(event) {
      const quizMeta = visibleQuizzes.find(item => item.quizSlug === activeQuizSlug)
      const nextDraft = mergeQuizAnswer(draftRef.current, activeQuizSlug, {
        title: quizMeta?.title || activeQuizSlug,
        answers: event.detail.answers,
        recommendation: event.detail.recommendation,
      })

      setDraft(nextDraft)
      setQuizStatus({ type: 'saving', message: 'Записваме quiz резултата…' })
      onSave(nextDraft, { silent: true })
        .then((savedProject) => {
          setDraft(makeDraft(savedProject))
          setQuizStatus({ type: 'saved', message: 'Quiz резултатът е записан към проекта.' })
        })
        .catch((error) => {
          setQuizStatus({ type: 'error', message: error.message || 'Quiz резултатът не се запази.' })
        })
    }

    node.addEventListener('quiz-complete', handleQuizComplete)

    Promise.all([
      import('../quiz/quiz-engine.js'),
      loader?.(),
    ])
      .then(([, config]) => {
        if (cancelled || !config || !quizRef.current) return
        quizRef.current.config = { ...config, consultationUrl: '' }
      })
      .catch((error) => {
        console.error('Profile quiz load failed:', error)
        setQuizStatus({ type: 'error', message: 'Quiz-ът не успя да зареди.' })
      })

    return () => {
      cancelled = true
      node.removeEventListener('quiz-complete', handleQuizComplete)
    }
  }, [activeQuizSlug, onSave, visibleQuizzes])

  function update(key, value) {
    setDraft(current => ({ ...current, [key]: value }))
  }

  function updateLocationAccess(key, value) {
    setDraft(current => withProjectLocationAccess(current, { [key]: value }))
  }

  function toggleLocationAccessChip(key, value) {
    setDraft(current => {
      const access = getProjectLocationAccess(current)
      const currentValues = Array.isArray(access[key]) ? access[key] : []
      let nextValues
      if (value === 'unknown') {
        nextValues = currentValues.includes(value) ? [] : ['unknown']
      } else {
        const withoutUnknown = currentValues.filter(item => item !== 'unknown')
        nextValues = withoutUnknown.includes(value)
          ? withoutUnknown.filter(item => item !== value)
          : [...withoutUnknown, value]
      }
      return withProjectLocationAccess(current, { [key]: nextValues })
    })
  }

  async function saveDraft(options = {}) {
    if (!options.silent) setSaveStatus({ type: 'saving', message: 'Запазваме проекта…' })
    const savedProject = await onSave(draft, options)
    setDraft(makeDraft(savedProject))
    if (!options.silent) {
      setSaveStatus({ type: 'saved', message: 'Проектът е запазен успешно.' })
      setIsEditing(false)
    }
    return savedProject
  }

  async function submit(event) {
    event.preventDefault()
    if (!String(draft.addressCity || '').trim() || !String(draft.propertyType || '').trim()) {
      setSaveStatus({ type: 'error', message: 'Моля, попълни град и тип обект в секцията „Локация и достъп до обекта“.' })
      return
    }
    try {
      await saveDraft()
    } catch (error) {
      setSaveStatus({ type: 'error', message: error.message || 'Записът не успя.' })
    }
  }

  async function handleUploadFiles(fileList) {
    const allFiles = Array.from(fileList || [])
    const files = allFiles
    if (allFiles.length === 0) {
      setUploadStatus({ type: 'error', message: 'Избери поне един файл.' })
      return
    }

    setUploadStatus({ type: 'uploading', message: `Качваме ${files.length} файла…` })
    if (allFiles.some(file => !isSupportedProjectFile(file))) {
      setUploadStatus({ type: 'error', message: PROJECT_UPLOAD_ERROR })
      return
    }

    try {
      const savedProject = await saveDraft({ silent: true })
      for (const [index, file] of files.entries()) {
        await onUploadMedia({
          file,
          projectId: savedProject.id,
          kind: isImageFile(file) ? 'photo' : 'document',
          caption: '',
          orderIndex: media.length + index,
        })
      }
      setUploadStatus({ type: 'uploaded', message: 'Медиите са качени.' })
    } catch (error) {
      setUploadStatus({ type: 'error', message: error.message || 'Качването не успя.' })
    }
  }

  async function saveMediaCaption(item, caption) {
    if (caption === item.caption) return
    try {
      await onUpdateMedia(item.id, { caption, kind: item.kind, orderIndex: item.orderIndex })
    } catch (error) {
      setUploadStatus({ type: 'error', message: error.message || 'Описанието не се запази.' })
    }
  }

  const imageMedia = media.filter(isImageMedia)
  const documentMedia = media.filter(isDocumentMedia)
  const locationAccess = getProjectLocationAccess(draft)
  const logisticsSummary = getLocationAccessSummary(draft)
  const exactLabels = exactLocationLabels(draft.propertyType)
  const hasExactDetails = hasExactLocationDetails(locationAccess)

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
      {conflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-3xl bg-paper p-6 md:p-8 shadow-2xl">
            <h2 className="font-display text-2xl text-ink">Имаш съществуващ проект</h2>
            <p className="mt-3 text-muted">Искаш ли този бриф да стане нов проект или да обнови текущия?</p>
            <div className="mt-8 flex flex-col gap-3">
              <button type="button" onClick={handleCreateNew} className="btn btn-primary justify-center">Създай нов проект</button>
              <button type="button" onClick={handleUpdateCurrent} className="btn border border-line bg-soft text-ink hover:border-ink justify-center">Обнови текущия</button>
              <button type="button" onClick={handleCancelConflict} className="btn btn-ghost justify-center text-muted">Отказ</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Project Passport Area */}
      <div className="lg:col-span-8 space-y-6">
        <div className="rounded-3xl border border-line bg-paper p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] md:p-8">

          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <div className="eyebrow flex items-center gap-2">
                <CustomSpaceIcon size={18} className="text-accentDeep" /> Моето пространство
              </div>
            </div>
            {!isEditing && (
              <button onClick={() => setIsEditing(true)} className="btn border border-line bg-paper text-ink hover:border-ink">
                <Edit3 size={16} className="text-muted" /> Редактирай
              </button>
            )}
          </div>

          {saveStatus.message && (
            <div className={`mb-6 rounded-2xl p-4 text-sm font-medium flex items-center gap-3 ${saveStatus.type === 'error' ? 'border border-red-200 bg-red-50 text-red-700' : 'bg-trustGreen/10 text-trustGreen'}`}>
              <CheckCircle2 size={18} />
              {saveStatus.message}
            </div>
          )}

          {isEditing ? (
            <form onSubmit={submit} className="space-y-8 animate-in fade-in duration-300">

              {/* Zone 1: Basic Info */}
              <div className="space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2 mb-2">
                  <AlignLeft size={16} /> Основна информация
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink">Заглавие</label>
                  <input value={draft.title} onChange={e => update('title', e.target.value)} className={INPUT} placeholder="Двустаен в Лозенец" autoFocus />
                </div>
                <div>
                  <TotsanSelect
                    label="Текущ слой на изпълнение"
                    value={draft.currentLayerSlug}
                    onChange={(val) => update('currentLayerSlug', val)}
                    options={LAYERS.map(l => ({ value: l.slug, label: `Слой ${l.number} · ${l.title}` }))}
                  />
                </div>
              </div>

              {/* Zone 2: Property Parameters */}
              <div className="space-y-4 rounded-2xl bg-soft/50 p-5 border border-line/50">
                <div className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2 mb-2">
                  <Home size={16} /> Параметри на имота
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <TotsanSelect label="Тип обект" value={draft.propertyType} onChange={(val) => update('propertyType', val)} options={[{ value: '', label: 'Избери...' }, ...PROPERTY_TYPES]} />
                  <div>
                    <label className="block text-sm font-medium text-ink">Квадратура (кв.м)</label>
                    <input value={draft.areaSqm} onChange={e => update('areaSqm', e.target.value)} type="number" min="0" step="0.1" className={INPUT} placeholder="напр. 82.5" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink">Брой стаи</label>
                    <input value={draft.roomsCount} onChange={e => update('roomsCount', e.target.value)} type="number" min="0" className={INPUT} placeholder="напр. 3" />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-12 mt-4">
                  <LocationCombobox className="md:col-span-8" label="Населено място" value={draft.addressCity} onChange={(value) => update('addressCity', value)} />
                  <div className="md:col-span-4">
                    <label className="block text-sm font-medium text-ink">Район / квартал</label>
                    <input value={draft.addressRegion} onChange={e => update('addressRegion', e.target.value)} className={INPUT} placeholder="централна част, квартал или ориентир" />
                  </div>
                </div>
              </div>

              <div className="space-y-5 rounded-2xl border border-line/50 bg-soft/50 p-5">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                    <MapPin size={16} /> Локация и достъп до обекта
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    Тези детайли помагат на специалиста да прецени оглед, транспорт, материали и време. Точният адрес остава скрит и се споделя само с избрания партньор след потвърдена поръчка или след ваше разрешение за оглед.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <LocationAccessSelect label="Паркиране" helper="Има ли къде да се паркира?" value={locationAccess.parkingAvailability} onChange={(value) => updateLocationAccess('parkingAvailability', value)} options={LOCATION_ACCESS_OPTIONS.parkingAvailability} />
                  <LocationAccessSelect label="Място за материали" value={locationAccess.materialStorage} onChange={(value) => updateLocationAccess('materialStorage', value)} options={LOCATION_ACCESS_OPTIONS.materialStorage} />
                  <LocationAccessSelect label="Място за отпадъци" value={locationAccess.wasteSpace} onChange={(value) => updateLocationAccess('wasteSpace', value)} options={LOCATION_ACCESS_OPTIONS.wasteSpace} />
                  <LocationAccessSelect label="Ограничения за работа" value={locationAccess.workTimeRestrictions} onChange={(value) => updateLocationAccess('workTimeRestrictions', value)} options={LOCATION_ACCESS_OPTIONS.workTimeRestrictions} />
                </div>

                <div>
                  <div className="text-sm font-medium text-ink">Има ли нещо специфично при достъпа?</div>
                  <CheckboxGroup
                    values={locationAccess.specialAccess}
                    options={LOCATION_ACCESS_OPTIONS.specialAccess}
                    onToggle={(value) => toggleLocationAccessChip('specialAccess', value)}
                  />
                </div>

                {draft.propertyType === 'apartment' && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <LocationAccessSelect label="Етажност" value={locationAccess.floorLevel} onChange={(value) => updateLocationAccess('floorLevel', value)} options={LOCATION_ACCESS_OPTIONS.floorLevel} />
                    <LocationAccessSelect label="Асансьор" value={locationAccess.elevator} onChange={(value) => updateLocationAccess('elevator', value)} options={LOCATION_ACCESS_OPTIONS.elevator} />
                    <LocationAccessSelect label="Асансьор за материали" value={locationAccess.elevatorForMaterials} onChange={(value) => updateLocationAccess('elevatorForMaterials', value)} options={LOCATION_ACCESS_OPTIONS.elevatorForMaterials} />
                    <LocationAccessSelect label="Достъп до входа" value={locationAccess.entranceAccess} onChange={(value) => updateLocationAccess('entranceAccess', value)} options={LOCATION_ACCESS_OPTIONS.entranceAccess} />
                  </div>
                )}

                {draft.propertyType === 'house' && (
                  <div className="grid gap-4 md:grid-cols-1">
                    <LocationAccessSelect label="Достъп с автомобил" helper="Може ли автомобил/бус да стигне близо до обекта?" value={locationAccess.vehicleAccess} onChange={(value) => updateLocationAccess('vehicleAccess', value)} options={LOCATION_ACCESS_OPTIONS.vehicleAccess} />
                  </div>
                )}

                {draft.propertyType === 'roof' && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <LocationAccessSelect label="Достъп до покрив / тераса" value={locationAccess.roofAccess} onChange={(value) => updateLocationAccess('roofAccess', value)} options={LOCATION_ACCESS_OPTIONS.roofAccess} />
                    <LocationAccessSelect label="Нужно разрешение" value={locationAccess.roofPermissionNeeded} onChange={(value) => updateLocationAccess('roofPermissionNeeded', value)} options={LOCATION_ACCESS_OPTIONS.roofPermissionNeeded} />
                  </div>
                )}

                {(draft.propertyType === 'office' || draft.propertyType === 'commercial') && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <LocationAccessSelect label="Работа в бизнес часове" value={locationAccess.businessHoursWork} onChange={(value) => updateLocationAccess('businessHoursWork', value)} options={LOCATION_ACCESS_OPTIONS.businessHoursWork} />
                    <LocationAccessSelect label="Товарен достъп" value={locationAccess.loadingAccess} onChange={(value) => updateLocationAccess('loadingAccess', value)} options={LOCATION_ACCESS_OPTIONS.loadingAccess} />
                  </div>
                )}

                <div className="rounded-2xl border border-line/70 bg-paper p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accentDeep">
                        <ShieldCheck size={15} /> Точна локация
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted">
                        Скрито за партньори до потвърждение. Видимо само за избрания партньор след потвърдена поръчка или разрешен оглед.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExactLocationOpen(current => !current)}
                      className="btn btn-ghost shrink-0 justify-center"
                    >
                      {exactLocationOpen ? 'Скрий точния адрес' : hasExactDetails ? 'Редактирай точния адрес' : 'Добави точен адрес'}
                    </button>
                  </div>

                  {exactLocationOpen && (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-ink">Точен адрес</label>
                        <input value={locationAccess.exactAddress} onChange={e => updateLocationAccess('exactAddress', e.target.value)} className={INPUT} placeholder="ул., номер, блок или местност" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-ink">Google Maps линк</label>
                        <input value={locationAccess.googleMapsUrl} onChange={e => updateLocationAccess('googleMapsUrl', e.target.value)} className={INPUT} placeholder="https://maps.google.com/..." />
                      </div>
                      {exactLabels.showEntrance && (
                        <div>
                          <label className="block text-sm font-medium text-ink">{exactLabels.entrance}</label>
                          <input value={locationAccess.entrance} onChange={e => updateLocationAccess('entrance', e.target.value)} className={INPUT} />
                        </div>
                      )}
                      {exactLabels.showFloor && (
                        <div>
                          <label className="block text-sm font-medium text-ink">{exactLabels.floor}</label>
                          <input value={locationAccess.floor} onChange={e => updateLocationAccess('floor', e.target.value)} className={INPUT} />
                        </div>
                      )}
                      {exactLabels.showUnit && (
                        <div>
                          <label className="block text-sm font-medium text-ink">{exactLabels.unit}</label>
                          <input value={locationAccess.unitNumber} onChange={e => updateLocationAccess('unitNumber', e.target.value)} className={INPUT} />
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-ink">Телефон за оглед</label>
                        <input value={locationAccess.visitPhone} onChange={e => updateLocationAccess('visitPhone', e.target.value)} className={INPUT} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-ink">Инструкции за достъп</label>
                        <textarea value={locationAccess.accessInstructions} onChange={e => updateLocationAccess('accessInstructions', e.target.value)} rows={3} className={TEXTAREA} placeholder="Къде се влиза, с кого да се говори, удобен час за оглед..." />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Zone 3: Financials & Timeline */}
              <div className="space-y-4 rounded-2xl bg-soft/50 p-5 border border-line/50">
                <div className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2 mb-2">
                  <Banknote size={16} /> Бюджет и Срокове
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-ink">Бюджет от (€)</label>
                    <input value={formatBudgetInput(draft.budgetMin)} onChange={e => update('budgetMin', cleanBudgetInput(e.target.value))} type="text" inputMode="numeric" className={INPUT} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink">Бюджет до (€)</label>
                    <input value={formatBudgetInput(draft.budgetMax)} onChange={e => update('budgetMax', cleanBudgetInput(e.target.value))} type="text" inputMode="numeric" className={INPUT} placeholder="100,000" />
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-ink">Желан старт на проекта</label>
                    <input value={draft.desiredStartDate} onChange={e => update('desiredStartDate', e.target.value)} type="date" className={INPUT} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink">Желан край на проекта</label>
                    <input value={draft.desiredEndDate} onChange={e => update('desiredEndDate', e.target.value)} type="date" className={INPUT} />
                  </div>
                </div>
              </div>

              {/* Zone 4: Vision & Details */}
              <div className="space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2 mb-2">
                  <AlignLeft size={16} /> Идея и визия
                </div>
                <div>
                  <textarea
                    value={draft.ideaDescription}
                    onChange={e => update('ideaDescription', e.target.value)}
                    rows={6}
                    className={TEXTAREA}
                    placeholder="Опиши как искаш да изглежда пространството, какво те притеснява и какъв резултат търсиш."
                  />
                </div>
              </div>

              <div className="sticky bottom-0 z-30 -mx-5 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper/92 px-5 py-4 shadow-[0_-18px_45px_-32px_rgba(13,35,64,0.55)] backdrop-blur md:-mx-7 md:px-7">
                <button type="button" onClick={() => hasMeaningfulContent && setIsEditing(false)} className="btn btn-ghost justify-center text-muted hover:text-ink">
                  Отказ
                </button>
                <button type="submit" className="btn btn-primary justify-center px-8 py-3.5" disabled={saveStatus.type === 'saving'}>
                  <Save size={18} />
                  {saveStatus.type === 'saving' ? 'Запазва се…' : 'Запази'}
                </button>
              </div>

            </form>
          ) : (
            /* Read-Only Passport View */
            <div className="space-y-8 animate-in fade-in duration-300">

              {/* Headings */}
              <div>
                <h3 className="font-display text-4xl text-ink font-semibold">{draft.title || 'Безименен проект'}</h3>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-accentDeep/20 bg-accentSoft/30 px-4 py-1.5 text-sm font-medium text-accentDeep">
                  <Layers size={16} /> Слой {currentLayer.number} · {currentLayer.title}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                {/* Specs Card */}
                <div className="rounded-2xl border border-line/60 bg-soft/30 p-6 transition hover:shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-2 mb-4">
                    <Home size={14} /> Параметри
                  </div>
                  <ul className="space-y-3">
                    <li className="flex justify-between items-center text-sm border-b border-line/50 pb-2">
                      <span className="text-muted">Тип обект</span>
                      <span className="font-medium text-ink">{PROPERTY_TYPES.find(p => p.value === draft.propertyType)?.label || 'Не е посочен'}</span>
                    </li>
                    <li className="flex justify-between items-center text-sm border-b border-line/50 pb-2">
                      <span className="text-muted">Квадратура</span>
                      <span className="font-medium text-ink">{draft.areaSqm ? `${draft.areaSqm} кв.м` : '-'}</span>
                    </li>
                    <li className="flex justify-between items-center text-sm border-b border-line/50 pb-2">
                      <span className="text-muted">Брой стаи</span>
                      <span className="font-medium text-ink">{draft.roomsCount || '-'}</span>
                    </li>
                    <li className="flex justify-between items-center text-sm">
                      <span className="text-muted">Локация</span>
                      <span className="font-medium text-ink">{[draft.addressCity, draft.addressRegion].filter(Boolean).join(', ') || 'Не е посочена'}</span>
                    </li>
                  </ul>
                </div>

                {/* Logistics Card */}
                <div className="rounded-2xl border border-line/60 bg-soft/30 p-6 transition hover:shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-2 mb-4">
                    <Banknote size={14} /> Бюджет и срокове
                  </div>
                  <ul className="space-y-3">
                    <li className="flex justify-between items-center text-sm border-b border-line/50 pb-2">
                      <span className="text-muted">Бюджет</span>
                      <span className="font-semibold text-accentDeep">
                        {draft.budgetMin || draft.budgetMax
                          ? `${draft.budgetMin ? Number(draft.budgetMin).toLocaleString('en-US') + '€' : '0€'} - ${draft.budgetMax ? Number(draft.budgetMax).toLocaleString('en-US') + '€' : 'без таван'}`
                          : 'Не е посочен'}
                      </span>
                    </li>
                    <li className="flex justify-between items-center text-sm">
                      <span className="text-muted">Желан старт</span>
                      <span className="font-medium text-ink flex items-center gap-1.5">
                        <Calendar size={14} className="text-muted" />
                        {draft.desiredStartDate ? new Date(draft.desiredStartDate).toLocaleDateString('bg-BG') : 'Не е посочен'}
                      </span>
                    </li>
                    <li className="flex justify-between items-center text-sm">
                      <span className="text-muted">Желан край</span>
                      <span className="font-medium text-ink flex items-center gap-1.5">
                        <Calendar size={14} className="text-muted" />
                        {draft.desiredEndDate ? new Date(draft.desiredEndDate).toLocaleDateString('bg-BG') : 'Не е посочен'}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="rounded-2xl border border-line/60 bg-soft/30 p-6 transition hover:shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-2 mb-4">
                  <MapPin size={14} /> Локация и достъп до обекта
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ReadOnlyItem label="Тип обект" value={PROPERTY_TYPES.find(p => p.value === draft.propertyType)?.label || ''} />
                  <ReadOnlyItem label="Локация" value={[draft.addressCity, draft.addressRegion].filter(Boolean).join(', ')} />
                  <ReadOnlyItem label="Достъп" value={logisticsSummary} />
                  <ReadOnlyItem label="Паркиране" value={getLocationAccessLabel('parkingAvailability', locationAccess.parkingAvailability)} />
                </div>
                {(locationAccess.exactAddress || locationAccess.googleMapsUrl || locationAccess.entrance || locationAccess.floor || locationAccess.unitNumber || locationAccess.accessInstructions || locationAccess.visitPhone) && (
                  <div className="mt-5 rounded-2xl border border-line bg-paper p-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accentDeep">
                      <ShieldCheck size={14} /> Частна точна локация
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted">
                      Тези данни са видими за теб и за избрания партньор само след потвърдена поръчка или разрешен оглед.
                    </p>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <ReadOnlyItem label="Адрес" value={locationAccess.exactAddress} />
                      <ReadOnlyItem label="Вход / етаж" value={[locationAccess.entrance, locationAccess.floor].filter(Boolean).join(', ')} />
                      <ReadOnlyItem label={exactLabels.unit} value={locationAccess.unitNumber} />
                      <ReadOnlyItem label="Телефон за оглед" value={locationAccess.visitPhone} />
                      <ReadOnlyItem label="Инструкции" value={locationAccess.accessInstructions} className="sm:col-span-2" />
                    </div>
                  </div>
                )}
              </div>

              {/* Vision Card */}
              {draft.ideaDescription && (
                <div className="rounded-2xl border border-line/60 bg-soft/30 p-6 transition hover:shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-2 mb-3">
                    <AlignLeft size={14} /> Описание на идеята
                  </div>
                  <p className="text-sm leading-relaxed text-ink whitespace-pre-line font-sans" style={{ fontSize: 'var(--step-sm)' }}>
                    {draft.ideaDescription}
                  </p>
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Sidebar Areas */}
      <aside className="lg:col-span-4 space-y-6">

        {/* Media Block */}
        <div className="rounded-3xl border border-line bg-paper p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
          <div className="eyebrow flex items-center gap-2 mb-4"><Camera size={14} /> Медии и документи</div>
          <label
            className={`mt-4 flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center transition-all duration-200 ${dragOver ? 'border-accent bg-accentSoft/30 scale-[1.02]' : 'border-line/80 bg-soft/50 hover:bg-soft hover:border-line'}`}
            onDragOver={(event) => { event.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => { event.preventDefault(); setDragOver(false); handleUploadFiles(event.dataTransfer.files) }}
          >
            <UploadCloud size={32} className="text-accentDeep mb-3" strokeWidth={1.5} />
            <span className="text-sm font-semibold text-ink">Добави файлове</span>
            <span className="mt-1 text-xs text-muted max-w-[180px]">Drag & drop или кликни за да избереш</span>
            <input type="file" accept={PROJECT_UPLOAD_ACCEPT} multiple className="sr-only" onChange={event => { handleUploadFiles(event.target.files); event.target.value = '' }} />
          </label>
          <div className={`mt-4 text-xs font-medium text-center ${uploadStatus.type === 'error' ? 'text-red-700' : 'text-muted'}`}>{uploadStatus.message || `${media.length} качени файла`}</div>
          {documentMedia.length > 0 && (
            <div className="mt-5 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Документи</div>
              <div className="space-y-2">
                {documentMedia.map(item => {
                  const mediaUrl = getMediaUrl(item)
                  const fileName = getDisplayFileName(item) || 'Документ'
                  const fileType = getDocumentTypeLabel(item)
                  const fileSize = formatFileSize(item?.size)
                  const DocumentIcon = getDocumentIcon(item)

                  return (
                    <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-line/75 bg-soft/35 px-3 py-3 shadow-[0_8px_20px_rgb(0,0,0,0.02)]">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-accentDeep">
                        <DocumentIcon size={20} strokeWidth={1.7} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink" title={fileName}>{fileName}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                          <span>{fileType}</span>
                          {fileSize ? <span>{fileSize}</span> : null}
                        </div>
                      </div>
                      {mediaUrl ? (
                        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-accentDeep hover:text-accentDeep">
                          Отвори
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onDeleteMedia(item.id)}
                        className="shrink-0 rounded-full border border-line bg-paper p-2 text-muted transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        aria-label="Изтрий документ"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Quizzes Block */}
        <div className="rounded-3xl border border-line bg-paper p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="eyebrow">Конфигуратор (Quiz)</div>
              <div className="mt-1 text-xs text-muted">Слой {currentLayer.number}</div>
            </div>
            {savedQuizKeys.length > 0 && <CheckCircle2 size={24} className="text-trustGreen" strokeWidth={1.5} />}
          </div>

          <div className="grid gap-2.5">
            {visibleQuizzes.map(item => (
              <button key={item.quizSlug} type="button" onClick={() => { setActiveQuizSlug(item.quizSlug); setQuizStatus({ type: 'idle', message: '' }) }} className={`group flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-sm transition-all duration-200 ${activeQuizSlug === item.quizSlug ? 'border-accent bg-accentSoft/20 text-accentDeep font-medium' : 'border-line/75 hover:border-ink hover:shadow-sm text-ink'}`}>
                <span>{item.title}</span>
                <Play size={16} className={`transition-transform duration-200 ${activeQuizSlug === item.quizSlug ? 'text-accentDeep' : 'text-muted group-hover:text-ink'}`} />
              </button>
            ))}
          </div>

          {activeQuizSlug && (
            <div className="mt-6 rounded-2xl border border-line/60 bg-soft/30 p-4">
              <material-decision-quiz ref={quizRef}></material-decision-quiz>
            </div>
          )}

          <div className={`mt-4 text-xs font-medium text-center ${quizStatus.type === 'error' ? 'text-red-700' : 'text-muted'}`}>{quizStatus.message || (savedQuizKeys.length ? `${savedQuizKeys.length} завършени теста` : 'Избери и попълни, за да събереш повече детайли.')}</div>
        </div>
      </aside>

      {/* Gallery Section */}
      <div className="lg:col-span-12 mt-4 rounded-3xl border border-line bg-paper p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line/60 pb-5 mb-6">
          <div>
            <div className="eyebrow flex items-center gap-2"><Camera size={14} /> Галерия</div>
            <h2 className="mt-2 font-display text-3xl font-semibold text-ink">Снимки</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-soft px-3 py-1.5 text-xs font-semibold text-ink">
            Общо {imageMedia.length}
          </div>
        </div>

        {imageMedia.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line/80 bg-soft/30 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-paper shadow-sm text-muted mb-4">
              <ImagePlus size={32} strokeWidth={1.5} />
            </div>
            <h3 className="font-display text-xl font-semibold text-ink mb-2">Тук е малко празно</h3>
            <p className="text-sm text-muted max-w-md">Добави снимки, скици, PDF планове или вдъхновения в панела горе, за да придобие проектът ти ясен облик.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {imageMedia.map(item => {
              const mediaUrl = getMediaUrl(item)
              const isImage = isImageMedia(item)
              const isPdf = !isImage && Boolean(mediaUrl)
              const fileName = getDisplayFileName(item) || 'Документ'
              const fileType = getDocumentTypeLabel(item)
              const fileSize = formatFileSize(item?.size)
              const DocumentIcon = getDocumentIcon(item)
              return (
                <article key={item.id} className="group overflow-hidden rounded-2xl border border-line/80 bg-paper transition-shadow duration-300 hover:shadow-md">
                  <div className="relative aspect-[4/3] bg-soft overflow-hidden">
                    {isPdf ? (
                      <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex h-full w-full flex-col justify-between bg-[linear-gradient(160deg,rgba(224,232,226,0.95),rgba(244,238,228,0.95))] p-5 text-ink transition-colors hover:bg-[linear-gradient(160deg,rgba(216,227,218,0.98),rgba(241,233,219,0.98))]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-paper/70 bg-paper/80 text-accentDeep shadow-sm">
                            <DocumentIcon size={24} strokeWidth={1.75} />
                          </div>
                          <span className="rounded-full border border-ink/10 bg-paper/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">{fileType}</span>
                        </div>
                        <div className="mt-4 space-y-2">
                          <div className="line-clamp-2 break-words text-sm font-semibold text-ink">{fileName}</div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span>{fileType}</span>
                            {fileSize ? <span>{fileSize}</span> : null}
                          </div>
                        </div>
                        <span className="mt-3 text-xs font-semibold">Отвори PDF документа</span>
                      </a>
                    ) : item.url ? (
                      <img src={item.url} alt={item.caption || 'Проектна медия'} className="img-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted"><ImagePlus size={24} /></div>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteMedia(item.id)}
                      className="absolute top-3 right-3 rounded-full bg-paper/90 backdrop-blur border border-line p-2 text-muted transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      aria-label="Изтрий медия"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="absolute bottom-3 left-3 rounded-md bg-ink/70 backdrop-blur px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-paper">
                      {PROJECT_MEDIA_KINDS.find(kind => kind.value === item.kind)?.label || 'Медия'}
                    </div>
                  </div>
                  <div className="p-5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Описание</label>
                    <textarea
                      defaultValue={item.caption}
                      onBlur={event => saveMediaCaption(item, event.target.value)}
                      rows={2}
                      className={TEXTAREA}
                      placeholder="Добави бележка..."
                    />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
