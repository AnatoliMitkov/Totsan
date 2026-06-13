import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Camera, Check, CheckCircle2, ClipboardList, FileCheck2, ImagePlus, MapPin, Plus, ShieldCheck, Sparkles, Trash2, UserRound } from 'lucide-react'
import { useAccount } from '../lib/account.js'
import { supabase } from '../lib/supabase.js'
import { uploadPortfolioMedia, uploadProfileMedia } from '../lib/profile-media-upload-client.js'
import TotsanSelect from '../components/ui/TotsanSelect.jsx'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'
const DRAFT_KEY_PREFIX = 'totsan.proOnboardingDraft'

const PARTNER_TYPES = ['Самостоятелен специалист', 'Бригада', 'Фирма', 'Дизайнер / архитект', 'Доставчик / шоурум']
const MAIN_CATEGORIES = [
  { value: 'ideya', label: 'Идея и визия' },
  { value: 'postroyka', label: 'Строителство и ремонти' },
  { value: 'materiali', label: 'Избор на материали' },
  { value: 'obzavezhdane', label: 'Обзавеждане' },
  { value: 'dekoraciya', label: 'Декорация и финал' },
]
const SERVICE_OPTIONS = ['баня до ключ', 'ВиК', 'електро', 'шпакловка', 'боядисване', 'гипсокартон', 'подови настилки', 'мебели по поръчка', 'кухни', 'интериорен дизайн', 'друго']
const WORK_STYLE_OPTIONS = [
  ['laborOnly', 'Само труд'],
  ['laborMaterials', 'Труд + материали'],
]

const STEPS = [
  { title: 'Основна информация', icon: UserRound },
  { title: 'Услуги', icon: BriefcaseBusiness },
  { title: 'Къде работите', icon: MapPin },
  { title: 'Как работите', icon: ClipboardList },
  { title: 'Доказателства', icon: ShieldCheck },
  { title: 'Как да ви представим', icon: Sparkles },
  { title: 'Преглед', icon: FileCheck2 },
]

const REQUIRED_FIELDS = [
  [
    { key: 'name', isComplete: draft => Boolean(draft.name.trim()), message: 'Добавете име или фирма.' },
    { key: 'partnerType', isComplete: draft => Boolean(draft.partnerType), message: 'Изберете тип партньор.' },
    { key: 'selfPhotoUrl', isComplete: draft => Boolean(draft.selfPhotoUrl), message: 'Добавете една снимка на себе си.' },
    { key: 'phone', isComplete: draft => isValidPhone(draft.phone), message: 'Добавете валиден телефонен номер.' },
    { key: 'city', isComplete: draft => Boolean(draft.city.trim()), message: 'Добавете град.' },
  ],
  [
    { key: 'mainCategory', isComplete: draft => Boolean(draft.mainCategory), message: 'Изберете основен тип услуга.' },
    { key: 'services', isComplete: draft => draft.services.length > 0, message: 'Изберете поне една услуга.' },
  ],
  [
    { key: 'primaryCity', isComplete: draft => Boolean(draft.primaryCity.trim()), message: 'Добавете основен град.' },
    { key: 'outsideCityDecision', isComplete: draft => Boolean(draft.outsideCityDecision), message: 'Изберете дали приемате проекти извън града.' },
    { key: 'workRadius', isComplete: draft => draft.outsideCityDecision !== 'yes' || Boolean(draft.workRadius.trim()), message: 'Добавете радиус на работа.' },
    { key: 'serviceAreas', isComplete: draft => !draft.limitToSpecificAreas || Boolean(draft.serviceAreas.trim()), message: 'Добавете конкретни райони.' },
  ],
  [
    { key: 'workStyle', isComplete: draft => draft.workStyle.length > 0 || Boolean(draft.customWorkStyle.trim()), message: 'Изберете начин на работа или добавете описание.' },
  ],
  [
    { key: 'proofProjects', isComplete: draft => draft.proofProjects.length > 0 && draft.proofProjects.every(project => project.description.trim() && project.photos.length > 0), message: 'Добавете поне един проект с описание и снимка.' },
  ],
  [
    { key: 'intro', isComplete: draft => Boolean(draft.intro.trim()), message: 'Добавете кратко професионално представяне.' },
    { key: 'strongestOrPreferred', isComplete: draft => Boolean(draft.strongestServices.trim() || draft.preferredProjects.trim()), message: 'Добавете най-силни услуги или предпочитан тип проекти.' },
  ],
]

function getStepCompletion(draft, index) {
  if (index >= REQUIRED_FIELDS.length) return { total: 0, complete: 0, missing: [], isComplete: true, isStarted: false }
  const fields = REQUIRED_FIELDS[index] || []
  const missing = fields.filter(field => !field.isComplete(draft))
  const complete = fields.length - missing.length
  return {
    total: fields.length,
    complete,
    missing,
    isComplete: missing.length === 0,
    isStarted: isStepStarted(draft, index),
  }
}

function isStepStarted(draft, index) {
  if (index === 0) return Boolean(draft.name.trim() || draft.partnerType || draft.selfPhotoUrl || hasSocialProfile(draft) || draft.phone.trim() || draft.city.trim() || draft.worksOutsideCity)
  if (index === 1) return Boolean(draft.mainCategory || draft.services.length || draft.customService.trim())
  if (index === 2) return Boolean(draft.primaryCity.trim() || draft.serviceAreas.trim() || draft.workRadius.trim() || draft.outsideCityDecision || draft.limitToSpecificAreas)
  if (index === 3) return Boolean(draft.workStyle.length || draft.customWorkStyleEnabled || draft.customWorkStyle.trim())
  if (index === 4) return draft.proofProjects.length > 0
  if (index === 5) return Boolean(draft.intro.trim() || draft.strongestServices.trim() || draft.preferredProjects.trim() || draft.rejectedProjects.trim())
  return false
}

function hasSocialProfile(draft) {
  return [
    draft.website,
    draft.facebook,
    draft.instagram,
    ...(Array.isArray(draft.socialLinks) ? draft.socialLinks.map(item => item.url) : []),
  ].some(value => String(value || '').trim())
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 15)
}

function isValidPhone(value) {
  const digits = normalizePhone(value)
  return digits.length >= 8 && digits.length <= 15
}

function makeProofProject() {
  return {
    id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: '',
    photos: [],
  }
}

function getOverallProgress(draft) {
  const allFields = REQUIRED_FIELDS.flat()
  if (!allFields.length) return 100
  const complete = allFields.filter(field => field.isComplete(draft)).length
  return Math.round((complete / allFields.length) * 100)
}

function makeInitialDraft(account, session) {
  const email = session?.user?.email || account?.email || ''
  const accountName = getPartnerAccountName(account, session)
  return {
    name: accountName,
    partnerType: '',
    phone: account?.phone || '',
    city: account?.city || '',
    worksOutsideCity: false,
    selfPhotoUrl: '',
    selfPhotoPath: '',
    selfPhotoName: '',
    mainCategory: '',
    services: [],
    customService: '',
    primaryCity: account?.city || '',
    serviceAreas: '',
    workRadius: '',
    limitToSpecificAreas: false,
    acceptsOutsideCity: false,
    outsideCityDecision: '',
    workStyle: [],
    customWorkStyleEnabled: false,
    customWorkStyle: '',
    quoteByPhotos: false,
    warranty: false,
    invoiceContract: false,
    availability: '',
    projectProof: '',
    website: '',
    facebook: '',
    instagram: '',
    socialLinks: [{ id: 'social-primary', label: '', url: '' }],
    proofProjects: [],
    proofNote: '',
    intro: '',
    strongestServices: '',
    preferredProjects: '',
    rejectedProjects: '',
    email,
  }
}

function getPartnerAccountName(account, session) {
  const metadata = session?.user?.user_metadata || {}
  return (
    account?.full_name ||
    account?.display_name ||
    metadata.full_name ||
    metadata.display_name ||
    metadata.name ||
    ''
  )
}

function mergeSavedDraft(base, saved) {
  if (!saved || typeof saved !== 'object') return base
  return {
    ...base,
    ...saved,
    name: saved.name?.trim() ? saved.name : base.name,
    email: base.email,
    phone: saved.phone?.trim() ? saved.phone : base.phone,
    city: saved.city?.trim() ? saved.city : base.city,
    primaryCity: saved.primaryCity?.trim() ? saved.primaryCity : base.primaryCity,
    socialLinks: Array.isArray(saved.socialLinks) && saved.socialLinks.length ? saved.socialLinks : base.socialLinks,
    proofProjects: Array.isArray(saved.proofProjects) ? saved.proofProjects : [],
    limitToSpecificAreas: Boolean(saved.limitToSpecificAreas || saved.serviceAreas?.trim()),
    outsideCityDecision: saved.outsideCityDecision || (saved.acceptsOutsideCity ? 'yes' : ''),
  }
}

export default function ProOnboarding() {
  const navigate = useNavigate()
  const { session, account, loading } = useAccount()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(() => makeInitialDraft(null, null))
  const [loadState, setLoadState] = useState({ status: 'idle', application: null, message: '' })
  const [submitState, setSubmitState] = useState({ status: 'idle', message: '' })
  const [photoUploadState, setPhotoUploadState] = useState({ status: 'idle', message: '' })
  const [proofUploadState, setProofUploadState] = useState({})
  const [touchedFields, setTouchedFields] = useState({})
  const [attemptedSteps, setAttemptedSteps] = useState({})
  const [pulseStep, setPulseStep] = useState(null)

  const draftKey = session?.user?.id ? `${DRAFT_KEY_PREFIX}.${session.user.id}` : `${DRAFT_KEY_PREFIX}.guest`

  useEffect(() => {
    if (loading) return
    const base = makeInitialDraft(account, session)
    try {
      const saved = JSON.parse(window.localStorage.getItem(draftKey) || 'null')
      setDraft(mergeSavedDraft(base, saved))
    } catch {
      setDraft(base)
    }
  }, [account, draftKey, loading, session])

  useEffect(() => {
    if (loading || !session?.user?.id) return
    let active = true
    async function loadApplication() {
      const { data, error } = await supabase
        .from('partner_applications')
        .select('id, status, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!active) return
      if (error && error.code !== 'PGRST116') {
        setLoadState({ status: 'error', application: null, message: error.message })
        return
      }
      setLoadState({ status: 'ready', application: data || null, message: '' })
    }
    loadApplication()
    return () => { active = false }
  }, [loading, session?.user?.id])

  useEffect(() => {
    if (loading || !session?.user?.id) return
    window.localStorage.setItem(draftKey, JSON.stringify(draft))
  }, [draft, draftKey, loading, session?.user?.id])

  const selectedCategory = MAIN_CATEGORIES.find(item => item.value === draft.mainCategory)
  const canSubmit = submitState.status !== 'sending'
  const progressPercent = useMemo(() => getOverallProgress(draft), [draft])
  const stepCompletion = useMemo(() => STEPS.map((_, index) => getStepCompletion(draft, index)), [draft])
  const requiredStepsComplete = stepCompletion.slice(0, STEPS.length - 1).every(item => item.isComplete)

  function update(key, value) {
    setDraft(current => ({ ...current, [key]: value }))
  }

  function markTouched(key) {
    setTouchedFields(current => ({ ...current, [key]: true }))
  }

  function markAttempted(index) {
    setAttemptedSteps(current => ({ ...current, [index]: true }))
  }

  function pulse(index) {
    setPulseStep(index)
    window.setTimeout(() => setPulseStep(current => (current === index ? null : current)), 520)
  }

  function toggleArray(key, value) {
    setDraft(current => {
      const currentValues = Array.isArray(current[key]) ? current[key] : []
      return {
        ...current,
        [key]: currentValues.includes(value)
          ? currentValues.filter(item => item !== value)
          : [...currentValues, value],
      }
    })
  }

  function updateProofProject(projectId, patch) {
    setDraft(current => ({
      ...current,
      proofProjects: current.proofProjects.map(project => (
        project.id === projectId ? { ...project, ...patch } : project
      )),
    }))
  }

  function addProofProject() {
    setDraft(current => (
      current.proofProjects.length >= 5
        ? current
        : { ...current, proofProjects: [...current.proofProjects, makeProofProject()] }
    ))
  }

  function removeProofProject(projectId) {
    setDraft(current => ({
      ...current,
      proofProjects: current.proofProjects.filter(project => project.id !== projectId),
    }))
  }

  async function handleProofProjectPhotos(projectId, files) {
    const selectedFiles = Array.from(files || []).filter(file => file.type.startsWith('image/'))
    if (!selectedFiles.length) return

    const project = draft.proofProjects.find(item => item.id === projectId)
    const remainingSlots = Math.max(0, 8 - (project?.photos?.length || 0))
    const filesToUpload = selectedFiles.slice(0, remainingSlots)
    if (!filesToUpload.length) return

    setProofUploadState(current => ({ ...current, [projectId]: 'uploading' }))
    try {
      const uploads = await Promise.all(filesToUpload.map(async (file) => {
        const result = await uploadPortfolioMedia({ file, target: session.user.id, kind: 'photo' })
        return {
          url: result.publicUrl || result.signedUrl || '',
          path: result.path || '',
          name: file.name || 'project-photo',
          width: result.width || null,
          height: result.height || null,
        }
      }))

      setDraft(current => ({
        ...current,
        proofProjects: current.proofProjects.map(item => (
          item.id === projectId
            ? { ...item, photos: [...item.photos, ...uploads].slice(0, 8) }
            : item
        )),
      }))
      setProofUploadState(current => ({ ...current, [projectId]: 'ready' }))
    } catch (error) {
      setProofUploadState(current => ({ ...current, [projectId]: error.message || 'Качването не успя.' }))
    }
  }

  function removeProofProjectPhoto(projectId, photoIndex) {
    setDraft(current => ({
      ...current,
      proofProjects: current.proofProjects.map(project => (
        project.id === projectId
          ? { ...project, photos: project.photos.filter((_, index) => index !== photoIndex) }
          : project
      )),
    }))
  }

  async function handleSelfPhotoFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setPhotoUploadState({ status: 'error', message: 'Изберете снимка във валиден image формат.' })
      return
    }

    setPhotoUploadState({ status: 'uploading', message: 'Качваме снимката...' })
    try {
      const result = await uploadProfileMedia({ file, target: session.user.id })
      setDraft(current => ({
        ...current,
        selfPhotoUrl: result.publicUrl || '',
        selfPhotoPath: result.path || '',
        selfPhotoName: file.name || 'profile-photo',
      }))
      setPhotoUploadState({ status: 'ready', message: 'Снимката е качена.' })
    } catch (error) {
      setPhotoUploadState({ status: 'error', message: error.message || 'Качването на снимката не успя.' })
    }
  }

  function validateStep(index) {
    const completion = getStepCompletion(draft, index)
    return completion.missing[0]?.message || ''
  }

  function firstIncompleteStepBefore(targetIndex) {
    for (let index = 0; index < targetIndex; index += 1) {
      if (!getStepCompletion(draft, index).isComplete) return index
    }
    return -1
  }

  function goToStep(index) {
    if (index <= step) {
      setSubmitState({ status: 'idle', message: '' })
      setStep(index)
      return
    }
    const blocker = firstIncompleteStepBefore(index)
    if (blocker !== -1) {
      markAttempted(blocker)
      setStep(blocker)
      pulse(blocker)
      setSubmitState({ status: 'error', message: 'Липсва информация по предишна стъпка.' })
      return
    }
    setSubmitState({ status: 'idle', message: '' })
    setStep(index)
  }

  function next() {
    if (step === 0 && photoUploadState.status === 'uploading') {
      setSubmitState({ status: 'error', message: 'Изчакайте снимката да се качи.' })
      return
    }
    if (step === 4 && Object.values(proofUploadState).some(value => value === 'uploading')) {
      setSubmitState({ status: 'error', message: 'Изчакайте снимките към проекта да се качат.' })
      return
    }

    const error = validateStep(step)
    if (error) {
      markAttempted(step)
      pulse(step)
      setSubmitState({ status: 'error', message: error })
      return
    }
    setSubmitState({ status: 'idle', message: '' })
    setStep(current => Math.min(current + 1, STEPS.length - 1))
  }

  function back() {
    setSubmitState({ status: 'idle', message: '' })
    setStep(current => Math.max(current - 1, 0))
  }

  async function submit() {
    for (let index = 0; index < STEPS.length - 1; index += 1) {
      const error = validateStep(index)
      if (error) {
        markAttempted(index)
        pulse(index)
        setStep(index)
        setSubmitState({ status: 'error', message: error })
        return
      }
    }

    setSubmitState({ status: 'sending', message: 'Изпращаме кандидатурата...' })

    const details = {
      basic: {
        name: draft.name.trim(),
        accountEmail: session.user.email || draft.email,
        partnerType: draft.partnerType,
        selfPhotoUrl: draft.selfPhotoUrl,
        selfPhotoPath: draft.selfPhotoPath,
        selfPhotoName: draft.selfPhotoName,
        phone: draft.phone.trim(),
        city: draft.city.trim(),
        worksOutsideCity: draft.worksOutsideCity,
        socialProfiles: {
          website: draft.website.trim(),
          facebook: draft.facebook.trim(),
          instagram: draft.instagram.trim(),
          other: draft.socialLinks.map(item => ({ label: item.label.trim(), url: item.url.trim() })).filter(item => item.url),
        },
      },
      partnerType: draft.partnerType,
      city: draft.city,
      worksOutsideCity: draft.worksOutsideCity,
      services: {
        mainCategory: selectedCategory?.label || '',
        layerSlug: draft.mainCategory,
        selected: draft.services,
        custom: draft.customService.trim(),
      },
      serviceAreas: {
        primaryCity: draft.primaryCity.trim(),
        nearbyPlaces: draft.serviceAreas.trim(),
        radius: draft.workRadius.trim(),
        limitToSpecificAreas: draft.limitToSpecificAreas,
        acceptsOutsideCity: draft.acceptsOutsideCity,
        outsideCityDecision: draft.outsideCityDecision,
      },
      workStyle: {
        modes: draft.workStyle,
        custom: draft.customWorkStyle.trim(),
        quoteByPhotos: draft.quoteByPhotos,
        warranty: draft.warranty,
        invoiceContract: draft.invoiceContract,
        availability: draft.availability,
      },
      proof: {
        projects: draft.proofProjects.map(project => ({
          description: project.description.trim(),
          photos: project.photos,
        })),
        note: draft.proofNote.trim(),
        uploadsDeferred: false,
      },
      presentation: {
        intro: draft.intro.trim(),
        strongestServices: draft.strongestServices.trim(),
        preferredProjects: draft.preferredProjects.trim(),
        rejectedProjects: draft.rejectedProjects.trim(),
      },
    }

    const { error } = await supabase.from('partner_applications').insert({
      name: draft.name.trim(),
      email: session.user.email,
      phone: draft.phone.trim(),
      layer_slug: draft.mainCategory,
      about: draft.intro.trim() || draft.proofProjects[0]?.description?.trim() || null,
      role: 'pro',
      status: 'pending',
      user_id: session.user.id,
      details,
    })

    if (error) {
      setSubmitState({ status: 'error', message: error.message || 'Кандидатурата не се изпрати.' })
      return
    }

    window.localStorage.removeItem(draftKey)
    setLoadState({ status: 'ready', application: { status: 'pending', created_at: new Date().toISOString() }, message: '' })
    setSubmitState({ status: 'sent', message: 'Кандидатурата е изпратена за преглед.' })
    navigate('/pro/status', { replace: true })
  }

  if (loading) {
    return <WizardShell><StatusCard title="Зареждаме кандидатурата..." text="Проверяваме акаунта и текущия статус." /></WizardShell>
  }

  if (!session) {
    return (
      <WizardShell>
        <StatusCard title="Влезте в партньорския акаунт" text="За да попълните кандидатура, първо влезте или създайте партньорски акаунт." primaryTo="/pro/start" primaryLabel="Към Totsan Pro" />
      </WizardShell>
    )
  }

  if (loadState.status === 'idle') {
    return <WizardShell><StatusCard title="Зареждаме кандидатурата..." text="Проверяваме текущия статус." /></WizardShell>
  }

  if (account?.role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  if (account?.role !== 'specialist') {
    return <WizardShell><StatusCard title="Това не е партньорски акаунт" text="Партньорската кандидатура се попълва от акаунт, създаден през Totsan Pro." primaryTo="/pro/start" primaryLabel="Към Totsan Pro" /></WizardShell>
  }

  if (submitState.status === 'sent') {
    return (
      <WizardShell>
        <StatusCard
          title="Кандидатурата е изпратена за преглед"
          text="Ще я прегледаме и ще ви уведомим, когато има решение. Одобрението не публикува автоматично профила в каталога."
          primaryTo="/moy-profil"
          primaryLabel="Към моя профил"
        />
      </WizardShell>
    )
  }

  if (loadState.application && submitState.status !== 'sent') {
    return (
      <WizardShell>
        <StatusCard
          title="Кандидатурата ви е изпратена"
          text="Ще я прегледаме и ще ви уведомим, когато има решение. Одобрението не публикува автоматично профила в каталога."
          primaryTo="/pro/status"
          primaryLabel="Виж статус"
        />
      </WizardShell>
    )
  }

  return (
    <WizardShell>
      <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-line bg-paper/70 p-4 shadow-[0_24px_80px_-60px_rgba(13,35,64,0.55)] backdrop-blur lg:sticky lg:top-24 lg:self-start">
          <div className="eyebrow">Totsan Pro</div>
          <div className="mt-2 font-display text-2xl text-ink">Кандидатура</div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-soft">
            <div className="h-full rounded-full bg-accentDeep transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="mt-2 text-xs font-medium text-muted">{progressPercent}% готовност</div>
          <div className="mt-4 space-y-1.5">
            {STEPS.map((item, index) => {
              const Icon = item.icon
              const active = index === step
              const completion = stepCompletion[index]
              const done = index < STEPS.length - 1 && (completion.total > 0 ? completion.isComplete : completion.isStarted)
              const missing = attemptedSteps[index] && !completion.isComplete
              const partial = !done && completion.isStarted
              const pulseClass = pulseStep === index ? 'pro-wizard-pulse' : ''
              const stateClass = active
                ? 'bg-ink text-paper'
                : done
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  : missing
                    ? 'bg-red-50 text-red-700 border border-red-100'
                    : partial
                      ? 'bg-accentSoft text-accentDeep border border-accentSoft'
                      : 'text-muted hover:bg-soft hover:text-ink'
              return (
                <button key={item.title} type="button" onClick={() => goToStep(index)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition ${stateClass} ${pulseClass}`}>
                  <Icon size={17} className="shrink-0" />
                  <span className="min-w-0 flex-1">{item.title}</span>
                  {done && <Check size={14} aria-label="Готово" />}
                  {missing && <span className="h-2 w-2 rounded-full bg-red-500" aria-label="Остава още малко" />}
                  {partial && !missing && <span className="h-2 w-2 rounded-full bg-accentDeep/70" aria-label="Започнато" />}
                </button>
              )
            })}
          </div>
        </aside>

        <main className="rounded-[2rem] border border-white/70 bg-paper/70 p-5 shadow-[0_30px_90px_-60px_rgba(13,35,64,0.55)] backdrop-blur md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="eyebrow">Стъпка {step + 1} от {STEPS.length}</div>
              <h1 className="h-section mt-2">{STEPS[step].title}</h1>
            </div>
            <div className="rounded-full border border-line bg-soft px-3 py-1 text-xs font-medium text-muted">{progressPercent}%</div>
          </div>

          {submitState.message && (
            <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${submitState.status === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-line bg-soft text-muted'}`}>
              {submitState.message}
            </div>
          )}

          <div className="mt-7">
            {step === 0 && <BasicStep draft={draft} update={update} touchedFields={touchedFields} attempted={attemptedSteps[0]} markTouched={markTouched} photoUploadState={photoUploadState} onPhotoFile={handleSelfPhotoFile} />}
            {step === 1 && <ServicesStep draft={draft} update={update} toggleArray={toggleArray} attempted={attemptedSteps[1]} />}
            {step === 2 && <AreasStep draft={draft} update={update} touchedFields={touchedFields} attempted={attemptedSteps[2]} markTouched={markTouched} />}
            {step === 3 && <WorkStyleStep draft={draft} update={update} toggleArray={toggleArray} attempted={attemptedSteps[3]} />}
            {step === 4 && <ProofStep draft={draft} attempted={attemptedSteps[4]} uploadState={proofUploadState} onAddProject={addProofProject} onRemoveProject={removeProofProject} onUpdateProject={updateProofProject} onProjectPhotos={handleProofProjectPhotos} onRemovePhoto={removeProofProjectPhoto} />}
            {step === 5 && <PresentationStep draft={draft} update={update} touchedFields={touchedFields} attempted={attemptedSteps[5]} markTouched={markTouched} />}
            {step === 6 && <ReviewStep draft={draft} selectedCategory={selectedCategory} stepCompletion={stepCompletion} />}
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={back} disabled={step === 0 || submitState.status === 'sending'} className="btn btn-ghost justify-center disabled:opacity-40">
              <ArrowLeft size={18} /> Назад
            </button>
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={next} className="btn btn-primary justify-center">
                Напред <ArrowRight size={18} />
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={!canSubmit || !requiredStepsComplete} className="btn btn-primary justify-center disabled:opacity-60">
                {submitState.status === 'sending' ? 'Изпращаме...' : 'Изпрати кандидатура за преглед'}
              </button>
            )}
          </div>
        </main>
      </div>
    </WizardShell>
  )
}

function WizardShell({ children }) {
  return (
    <section className="section !py-8 md:!py-10 relative min-h-[calc(100vh-var(--header-h,0px))] overflow-hidden bg-soft">
      <style>{`
        @keyframes proWizardPulse {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          50% { transform: translateX(3px); }
          75% { transform: translateX(-2px); }
        }
        .pro-wizard-pulse {
          animation: proWizardPulse 0.42s ease-in-out;
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-6rem] h-[24rem] w-[24rem] rounded-full bg-accentSoft/80 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-7rem] h-[24rem] w-[24rem] rounded-full bg-cloud/90 blur-3xl" />
      </div>
      <div className="container-page relative">{children}</div>
    </section>
  )
}

function StatusCard({ title, text, primaryTo = '', primaryLabel = '' }) {
  return (
    <div className="mx-auto max-w-xl rounded-[2rem] border border-white/70 bg-paper/70 p-7 text-center shadow-[0_30px_90px_-60px_rgba(13,35,64,0.55)] backdrop-blur md:p-10">
      <CheckCircle2 className="mx-auto text-accentDeep" size={34} />
      <h1 className="h-section mt-5">{title}</h1>
      {text && <p className="mt-4 text-muted">{text}</p>}
      {primaryTo && <Link to={primaryTo} className="btn btn-primary mt-7">{primaryLabel}<ArrowRight size={18} /></Link>}
    </div>
  )
}

function BasicStep({ draft, update, touchedFields, attempted, markTouched, photoUploadState, onPhotoFile }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Име / фирма" value={draft.name} onChange={event => update('name', event.target.value)} onBlur={() => markTouched('name')} required touched={touchedFields.name} attempted={attempted} helper="Името/фирмата ще се използва за кандидатурата и може по-късно да се редактира в профила." errorText="Добавете име или фирма." />
        <Field label="Имейл за акаунта" helper="Имейлът е този, с който влизате в Totsan.">
          <input value={draft.email} readOnly className={`${INPUT} cursor-not-allowed bg-soft text-muted`} />
        </Field>
      </div>
      <TotsanSelect label="Тип партньор" value={draft.partnerType} onChange={(value) => update('partnerType', value)} options={PARTNER_TYPES.map(value => ({ value, label: value }))} placeholder="Изберете" />
      <SelfPhotoField draft={draft} attempted={attempted} uploadState={photoUploadState} onPhotoFile={onPhotoFile} />
      <SocialProfilesField draft={draft} update={update} attempted={attempted} />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Телефон" value={draft.phone} onChange={event => update('phone', normalizePhone(event.target.value))} onBlur={() => markTouched('phone')} type="tel" inputMode="numeric" pattern="[0-9]*" required valid={isValidPhone} touched={touchedFields.phone} attempted={attempted} helper="Въведете само цифри. Телефонът е нужен за проверка от Totsan." errorText="Добавете валиден телефонен номер." />
        <TextField label="Град" value={draft.city} onChange={event => update('city', event.target.value)} onBlur={() => markTouched('city')} required touched={touchedFields.city} attempted={attempted} errorText="Добавете град." />
      </div>
    </div>
  )
}

function SocialProfilesField({ draft, update, attempted }) {
  function addSocialLink() {
    update('socialLinks', [...draft.socialLinks, { id: `social-${Date.now()}`, label: '', url: '' }])
  }

  function updateSocialLink(id, patch) {
    update('socialLinks', draft.socialLinks.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  function removeSocialLink(id) {
    update('socialLinks', draft.socialLinks.filter(item => item.id !== id))
  }

  return (
    <div className="rounded-3xl border border-line bg-soft/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-ink">Линк</div>
        </div>
        <button type="button" onClick={addSocialLink} className="btn btn-ghost justify-center">
          <Plus size={18} />
          Добави друг
        </button>
      </div>
      {draft.socialLinks.length > 0 && (
        <div className="mt-4 space-y-3">
          {draft.socialLinks.map(link => (
            <div key={link.id} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <Field label="Линк"><input value={link.url} onChange={event => updateSocialLink(link.id, { url: event.target.value })} className={INPUT} placeholder="https://" /></Field>
              {draft.socialLinks.length > 1 && (
                <button type="button" onClick={() => removeSocialLink(link.id)} className="btn btn-ghost justify-center text-red-700">
                  <Trash2 size={18} />
                  Махни
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SelfPhotoField({ draft, attempted, uploadState, onPhotoFile }) {
  const showError = attempted && !draft.selfPhotoUrl && uploadState.status !== 'uploading'

  return (
    <div className={`rounded-3xl border p-4 ${showError ? 'border-red-200 bg-red-50/70' : 'border-line bg-soft/60'}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-paper text-muted">
            {draft.selfPhotoUrl ? (
              <img src={draft.selfPhotoUrl} alt="Снимка за кандидатурата" className="h-full w-full object-cover" />
            ) : (
              <Camera size={24} />
            )}
          </div>
          <div>
            <div className="text-sm font-semibold text-ink">Снимка на вас</div>
            <div className="mt-1 text-xs leading-5 text-muted">Добавете една ясна снимка. Тя е задължителна за кандидатурата.</div>
            {draft.selfPhotoName && <div className="mt-1 text-xs font-medium text-muted">{draft.selfPhotoName}</div>}
          </div>
        </div>
        <label className="btn btn-ghost cursor-pointer justify-center">
          <Camera size={18} />
          {draft.selfPhotoUrl ? 'Смени снимка' : 'Добави снимка'}
          <input type="file" accept="image/*" className="sr-only" onChange={(event) => { onPhotoFile(event.target.files?.[0]); event.target.value = '' }} />
        </label>
      </div>
      {uploadState.message && <div className={`mt-3 text-xs font-medium ${uploadState.status === 'error' ? 'text-red-700' : 'text-muted'}`}>{uploadState.message}</div>}
      {showError && <div className="mt-3 text-xs font-medium text-red-700">Добавете една снимка на себе си.</div>}
    </div>
  )
}

function ServicesStep({ draft, update, toggleArray, attempted }) {
  function handleServiceToggle(value) {
    const wasSelected = draft.services.includes(value)
    toggleArray('services', value)
    if (value === 'друго' && wasSelected) {
      update('customService', '')
    }
  }

  const hasOtherService = draft.services.includes('друго')

  return (
    <div className="space-y-5">
      <TotsanSelect label="Какъв тип услуги предлагате?" value={draft.mainCategory} onChange={(value) => update('mainCategory', value)} options={MAIN_CATEGORIES} placeholder="Изберете основна категория" />
      <ChipGrid options={SERVICE_OPTIONS} selected={draft.services} onToggle={handleServiceToggle} />
      {attempted && draft.services.length === 0 && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">Изберете поне една услуга.</div>}
      {hasOtherService && <Field label="Друга услуга (по желание)"><input value={draft.customService} onChange={event => update('customService', event.target.value)} className={INPUT} placeholder="Напр. реставрация, дограма, озеленяване..." /></Field>}
    </div>
  )
}

function AreasStep({ draft, update, touchedFields, attempted, markTouched }) {
  const cityIsValid = Boolean(draft.primaryCity.trim())
  const outsideIsValid = Boolean(draft.outsideCityDecision)
  const radiusIsValid = draft.outsideCityDecision !== 'yes' || Boolean(draft.workRadius.trim())
  const serviceAreasIsValid = !draft.limitToSpecificAreas || Boolean(draft.serviceAreas.trim())
  return (
    <div className="space-y-5">
      <TextField label="Основен град" value={draft.primaryCity} onChange={event => update('primaryCity', event.target.value)} onBlur={() => markTouched('primaryCity')} required valid={() => cityIsValid} touched={touchedFields.primaryCity} attempted={attempted} errorText="Добавете основен град." />
      <div>
        <div className="text-sm font-medium text-ink">Приемате ли проекти извън града?</div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <ToggleCard active={draft.outsideCityDecision === 'yes'} onClick={() => { update('outsideCityDecision', 'yes'); update('acceptsOutsideCity', true) }} label="Да, приемам извън града" />
          <ToggleCard active={draft.outsideCityDecision === 'no'} onClick={() => { update('outsideCityDecision', 'no'); update('acceptsOutsideCity', false); update('workRadius', ''); update('limitToSpecificAreas', false); update('serviceAreas', '') }} label="Не, само в района" />
        </div>
        {attempted && !outsideIsValid && <div className="mt-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">Изберете дали приемате проекти извън града.</div>}
      </div>
      {draft.outsideCityDecision === 'yes' && (
        <>
          <TextField label="Радиус на работа" value={draft.workRadius} onChange={event => update('workRadius', event.target.value)} onBlur={() => markTouched('workRadius')} placeholder="Напр. 30 км" required valid={() => radiusIsValid} touched={touchedFields.workRadius} attempted={attempted} errorText="Добавете радиус на работа." />
          <ToggleCard active={draft.limitToSpecificAreas} onClick={() => update('limitToSpecificAreas', !draft.limitToSpecificAreas)} label="Искам да посоча конкретни райони" />
          {draft.limitToSpecificAreas && (
            <TextField label="Райони / близки населени места" value={draft.serviceAreas} onChange={event => update('serviceAreas', event.target.value)} onBlur={() => markTouched('serviceAreas')} rows={4} placeholder="Русе, Мартен, Басарбово..." required valid={() => serviceAreasIsValid} touched={touchedFields.serviceAreas} attempted={attempted} errorText="Добавете конкретни райони." />
          )}
        </>
      )}
    </div>
  )
}

function WorkStyleStep({ draft, update, toggleArray, attempted }) {
  function toggleWorkStyle(value) {
    const exclusivePair = {
      laborOnly: 'laborMaterials',
      laborMaterials: 'laborOnly',
    }

    if (exclusivePair[value]) {
      const withoutPair = draft.workStyle.filter(item => item !== exclusivePair[value])
      update('workStyle', withoutPair.includes(value) ? withoutPair.filter(item => item !== value) : [...withoutPair, value])
      return
    }

    toggleArray('workStyle', value)
  }

  return (
    <div className="space-y-5">
      <ChipGrid options={WORK_STYLE_OPTIONS.map(([, label]) => label)} selected={WORK_STYLE_OPTIONS.filter(([key]) => draft.workStyle.includes(key)).map(([, label]) => label)} onToggle={(label) => {
        const match = WORK_STYLE_OPTIONS.find(([, itemLabel]) => itemLabel === label)
        if (match) toggleWorkStyle(match[0])
      }} />
      <ToggleCard active={draft.customWorkStyleEnabled} onClick={() => update('customWorkStyleEnabled', !draft.customWorkStyleEnabled)} label="Добави" />
      {draft.customWorkStyleEnabled && (
        <TextField label="Опишете как работите" value={draft.customWorkStyle} onChange={event => update('customWorkStyle', event.target.value)} rows={4} placeholder="Напр. работя само по етапи, с предварителна уговорка..." />
      )}
      {attempted && draft.workStyle.length === 0 && !draft.customWorkStyle.trim() && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">Изберете начин на работа или добавете описание.</div>}
    </div>
  )
}

function ProofStep({ draft, attempted, uploadState, onAddProject, onRemoveProject, onUpdateProject, onProjectPhotos, onRemovePhoto }) {
  const showError = attempted && (draft.proofProjects.length === 0 || draft.proofProjects.some(project => !project.description.trim() || project.photos.length === 0))

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-3xl text-ink">Покажете ни Вашата работа</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Добавете поне един реален проект с кратко описание и снимки. Можете да добавите до 5 проекта.</p>
      </div>

      {draft.proofProjects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {draft.proofProjects.map((project, index) => (
            <div key={project.id} className="rounded-3xl border border-line bg-paper p-4 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-muted">Проект {index + 1}</div>
                  <div className="mt-1 font-semibold text-ink">Продуктова карта</div>
                </div>
                <button type="button" onClick={() => onRemoveProject(project.id)} className="rounded-full p-2 text-muted transition hover:bg-red-50 hover:text-red-700" aria-label="Премахни проект">
                  <Trash2 size={18} />
                </button>
              </div>
              <TextField label="Кратко описание на проекта" value={project.description} onChange={event => onUpdateProject(project.id, { description: event.target.value })} rows={4} placeholder="Какво направихте, какъв беше обхватът, какъв беше резултатът..." />
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-ink">Снимки ({project.photos.length}/8)</div>
                  <label className={`btn btn-ghost cursor-pointer justify-center ${project.photos.length >= 8 ? 'pointer-events-none opacity-50' : ''}`}>
                    <ImagePlus size={18} />
                    Добави снимки
                    <input type="file" accept="image/*" multiple className="sr-only" disabled={project.photos.length >= 8} onChange={(event) => { onProjectPhotos(project.id, event.target.files); event.target.value = '' }} />
                  </label>
                </div>
                {uploadState[project.id] && uploadState[project.id] !== 'ready' && (
                  <div className={`mt-2 text-xs font-medium ${uploadState[project.id] === 'uploading' ? 'text-muted' : 'text-red-700'}`}>
                    {uploadState[project.id] === 'uploading' ? 'Качваме снимките...' : uploadState[project.id]}
                  </div>
                )}
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {project.photos.map((photo, photoIndex) => (
                    <div key={`${photo.path || photo.url}-${photoIndex}`} className="group relative aspect-square overflow-hidden rounded-2xl border border-line bg-soft">
                      <img src={photo.url} alt={`Проект ${index + 1} снимка ${photoIndex + 1}`} className="h-full w-full object-cover" />
                      <button type="button" onClick={() => onRemovePhoto(project.id, photoIndex)} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-paper/90 text-red-700 opacity-0 shadow-sm transition group-hover:opacity-100" aria-label="Премахни снимка">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {draft.proofProjects.length < 5 && (
        <button type="button" onClick={onAddProject} className="flex min-h-32 w-full flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-paper/60 p-6 text-center text-ink transition hover:border-ink/40 hover:bg-paper">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-soft text-accentDeep">
            <Plus size={22} />
          </span>
          <span className="mt-3 font-semibold">Добави проект</span>
          <span className="mt-1 text-sm text-muted">До 5 проектни карти, до 8 снимки във всяка.</span>
        </button>
      )}

      {showError && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">Добавете поне един проект с описание и поне една снимка.</div>}
    </div>
  )
}

function PresentationStep({ draft, update, touchedFields, attempted, markTouched }) {
  const strongestOrPreferred = Boolean(draft.strongestServices.trim() || draft.preferredProjects.trim())
  return (
    <div className="space-y-5">
      <TextField
        label="Кратко професионално представяне"
        value={draft.intro}
        onChange={event => update('intro', event.target.value)}
        onBlur={() => markTouched('intro')}
        rows={6}
        required
        touched={touchedFields.intro}
        attempted={attempted}
        helper="Например: Работим основно по ремонти на бани, ВиК и довършителни работи в Русе и региона. Поемаме оглед, труд и съдействие при избор на материали."
        errorText="Добавете кратко професионално представяне."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <TextField label="Най-силни услуги" value={draft.strongestServices} onChange={event => update('strongestServices', event.target.value)} onBlur={() => markTouched('strongestServices')} rows={4} required valid={() => strongestOrPreferred} touched={touchedFields.strongestServices} attempted={attempted} errorText="Добавете най-силни услуги или предпочитан тип проекти." />
        <TextField label="Предпочитан тип проекти" value={draft.preferredProjects} onChange={event => update('preferredProjects', event.target.value)} onBlur={() => markTouched('preferredProjects')} rows={4} required valid={() => strongestOrPreferred} touched={touchedFields.preferredProjects} attempted={attempted} errorText="Добавете предпочитан тип проекти или най-силни услуги." />
        <TextField label="Какво не приемате" value={draft.rejectedProjects} onChange={event => update('rejectedProjects', event.target.value)} onBlur={() => markTouched('rejectedProjects')} rows={4} touched={touchedFields.rejectedProjects} />
      </div>
    </div>
  )
}

function ReviewStep({ draft, selectedCategory, stepCompletion }) {
  const missingSteps = stepCompletion
    .slice(0, STEPS.length - 1)
    .map((completion, index) => ({ completion, index }))
    .filter(item => !item.completion.isComplete)
  const rows = [
    ['Име / фирма', draft.name],
    ['Тип', draft.partnerType],
    ['Снимка', draft.selfPhotoUrl ? 'Добавена' : '—'],
    ['Сайт / социални профили', [draft.website, draft.facebook, draft.instagram, ...draft.socialLinks.map(item => item.url)].filter(Boolean).join(', ')],
    ['Телефон', draft.phone],
    ['Град / райони', [draft.primaryCity, draft.serviceAreas].filter(Boolean).join(' · ')],
    ['Услуги', [selectedCategory?.label, ...draft.services, draft.customService].filter(Boolean).join(', ')],
    ['Начин на работа', [...draft.workStyle.map(key => WORK_STYLE_OPTIONS.find(([value]) => value === key)?.[1] || key), draft.customWorkStyle].filter(Boolean).join(', ')],
    ['Проекти', draft.proofProjects.map(project => project.description).filter(Boolean).join('\n\n')],
    ['Представяне', draft.intro],
  ]
  return (
    <div className="space-y-3">
      {missingSteps.length > 0 ? (
        <div className="rounded-3xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <div className="font-semibold">Остава още малко</div>
          <div className="mt-1">Попълнете липсващата информация, за да изпратите кандидатурата.</div>
        </div>
      ) : (
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="font-semibold">Готово</div>
          <div className="mt-1">Всичко нужно за първи преглед е попълнено.</div>
        </div>
      )}
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-line bg-soft p-4">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
          <div className="mt-1 whitespace-pre-wrap text-sm text-ink">{value || '—'}</div>
        </div>
      ))}
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  inputMode = undefined,
  pattern = undefined,
  rows = 0,
  placeholder = '',
  helper = '',
  errorText = 'Остава още малко.',
  required = false,
  readOnly = false,
  valid,
  touched = false,
  attempted = false,
}) {
  const normalizedValue = String(value || '')
  const hasValue = normalizedValue.trim().length > 0
  const isValid = valid ? valid(normalizedValue) : required ? hasValue : hasValue
  const showSuccess = touched && isValid && hasValue
  const showError = required && (touched || attempted) && !isValid
  const Tag = rows ? 'textarea' : 'input'
  const className = [
    INPUT,
    'pr-11',
    showSuccess ? 'border-emerald-300 bg-emerald-50/40 focus:border-emerald-500' : '',
    showError ? 'border-red-200 bg-red-50/70 focus:border-red-400' : '',
  ].filter(Boolean).join(' ')

  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <span className="relative block">
        <Tag
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          type={rows ? undefined : type}
          inputMode={rows ? undefined : inputMode}
          pattern={rows ? undefined : pattern}
          rows={rows || undefined}
          placeholder={placeholder}
          required={required}
          readOnly={readOnly}
          aria-invalid={showError ? 'true' : 'false'}
          className={className}
        />
        {showSuccess && (
          <span className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-emerald-100 text-emerald-700" aria-label="Готово">
            <Check size={14} />
          </span>
        )}
      </span>
      {showSuccess && <span className="mt-1.5 block text-xs font-medium text-emerald-700">Изглежда добре</span>}
      {showError && <span className="mt-1.5 block text-xs font-medium text-red-700">{errorText}</span>}
      {!showError && !showSuccess && helper && <span className="mt-1.5 block text-xs font-normal leading-5 text-muted">{helper}</span>}
    </label>
  )
}

function Field({ label, helper = '', children }) {
  return <label className="block text-sm font-medium text-ink">{label}{children}{helper && <span className="mt-1.5 block text-xs font-normal leading-5 text-muted">{helper}</span>}</label>
}

function ChipGrid({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => {
        const active = selected.includes(option)
        return <button key={option} type="button" onClick={() => onToggle(option)} className={`rounded-full border px-4 py-2 text-sm transition ${active ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-ink hover:border-ink/30 hover:bg-soft'}`}>{option}</button>
      })}
    </div>
  )
}

function ToggleCard({ active, onClick, label }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${active ? 'border-accentDeep bg-accentSoft text-accentDeep' : 'border-line bg-paper text-ink hover:border-ink/30'}`}>
      <span>{label}</span>
      <span className={`grid h-5 w-5 place-items-center rounded-full border ${active ? 'border-accentDeep bg-accentDeep text-paper' : 'border-line text-transparent'}`}><Check size={13} /></span>
    </button>
  )
}
