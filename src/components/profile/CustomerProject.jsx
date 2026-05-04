import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, CheckCircle2, ImagePlus, Play, Save, Trash2, UploadCloud } from 'lucide-react'
import { LAYERS } from '../../data/layers.js'
import { DEFAULT_PROJECT, PROJECT_MEDIA_KINDS, PROPERTY_TYPES, mergeQuizAnswer } from '../../lib/projects.js'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'

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

export default function CustomerProject({ project, media, onSave, onUploadMedia, onUpdateMedia, onDeleteMedia }) {
  const [draft, setDraft] = useState(() => makeDraft(project))
  const [saveStatus, setSaveStatus] = useState({ type: 'idle', message: '' })
  const [uploadStatus, setUploadStatus] = useState({ type: 'idle', message: '' })
  const [dragOver, setDragOver] = useState(false)
  const [uploadKind, setUploadKind] = useState('photo')
  const [activeQuizSlug, setActiveQuizSlug] = useState('')
  const [quizStatus, setQuizStatus] = useState({ type: 'idle', message: '' })
  const quizRef = useRef(null)
  const draftRef = useRef(draft)

  useEffect(() => {
    setDraft(makeDraft(project))
  }, [project?.id, project?.updatedAt])

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

  async function saveDraft(options = {}) {
    if (!options.silent) setSaveStatus({ type: 'saving', message: 'Запазваме проекта…' })
    const savedProject = await onSave(draft, options)
    setDraft(makeDraft(savedProject))
    if (!options.silent) setSaveStatus({ type: 'saved', message: 'Проектът е запазен.' })
    return savedProject
  }

  async function submit(event) {
    event.preventDefault()
    try {
      await saveDraft()
    } catch (error) {
      setSaveStatus({ type: 'error', message: error.message || 'Записът не успя.' })
    }
  }

  async function handleUploadFiles(fileList) {
    const files = Array.from(fileList || []).filter(file => file.type.startsWith('image/'))
    if (files.length === 0) {
      setUploadStatus({ type: 'error', message: 'Избери поне една снимка.' })
      return
    }

    setUploadStatus({ type: 'uploading', message: `Качваме ${files.length} файла…` })
    try {
      const savedProject = await saveDraft({ silent: true })
      for (const [index, file] of files.entries()) {
        await onUploadMedia({
          file,
          projectId: savedProject.id,
          kind: uploadKind,
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

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <form onSubmit={submit} className="lg:col-span-8 rounded-3xl border border-line bg-paper p-5 md:p-7 space-y-6">
        <div>
          <div className="eyebrow">Моят проект</div>
          <h2 className="mt-2 font-display text-3xl text-ink">Проект-паспорт</h2>
        </div>

        <label className="block text-sm font-medium text-ink">Заглавие<input value={draft.title} onChange={event => update('title', event.target.value)} className={INPUT} placeholder="Двустаен в Лозенец" /></label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm font-medium text-ink">Тип помещение<select value={draft.propertyType} onChange={event => update('propertyType', event.target.value)} className={INPUT}>
            <option value="">Избери</option>
            {PROPERTY_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select></label>
          <label className="block text-sm font-medium text-ink">Кв.м.<input value={draft.areaSqm} onChange={event => update('areaSqm', event.target.value)} type="number" min="0" step="0.1" className={INPUT} /></label>
          <label className="block text-sm font-medium text-ink">Стаи<input value={draft.roomsCount} onChange={event => update('roomsCount', event.target.value)} type="number" min="0" className={INPUT} /></label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-ink">Град<input value={draft.addressCity} onChange={event => update('addressCity', event.target.value)} className={INPUT} /></label>
          <label className="block text-sm font-medium text-ink">Район<input value={draft.addressRegion} onChange={event => update('addressRegion', event.target.value)} className={INPUT} /></label>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <label className="block text-sm font-medium text-ink md:col-span-2">Текущ слой<select value={draft.currentLayerSlug} onChange={event => update('currentLayerSlug', event.target.value)} className={INPUT}>
            {LAYERS.map(layer => <option key={layer.slug} value={layer.slug}>Слой {layer.number} · {layer.title}</option>)}
          </select></label>
          <label className="block text-sm font-medium text-ink">Бюджет от<input value={draft.budgetMin} onChange={event => update('budgetMin', event.target.value)} type="number" min="0" className={INPUT} /></label>
          <label className="block text-sm font-medium text-ink">Бюджет до<input value={draft.budgetMax} onChange={event => update('budgetMax', event.target.value)} type="number" min="0" className={INPUT} /></label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-ink">Валута<select value={draft.budgetCurrency} onChange={event => update('budgetCurrency', event.target.value)} className={INPUT}>
            <option value="EUR">EUR</option>
            <option value="BGN">BGN</option>
          </select></label>
          <label className="block text-sm font-medium text-ink">Желан старт<input value={draft.desiredStartDate} onChange={event => update('desiredStartDate', event.target.value)} type="date" className={INPUT} /></label>
        </div>

        <label className="block text-sm font-medium text-ink">Идея за проекта<textarea value={draft.ideaDescription} onChange={event => update('ideaDescription', event.target.value)} rows={7} className={INPUT} placeholder="Опиши как искаш да изглежда пространството, какво те притеснява и какъв резултат търсиш." /></label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <div className={`text-sm ${saveStatus.type === 'error' ? 'text-red-700' : 'text-muted'}`}>{saveStatus.message || 'Запази проекта, когато си готов.'}</div>
          <button className="btn btn-primary" disabled={saveStatus.type === 'saving'}>
            <Save size={18} />
            {saveStatus.type === 'saving' ? 'Запазва се…' : 'Запази проекта'}
          </button>
        </div>
      </form>

      <aside className="lg:col-span-4 space-y-5">
        <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
          <div className="eyebrow">Медии</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <label className="block text-sm font-medium text-ink">Тип файл<select value={uploadKind} onChange={event => setUploadKind(event.target.value)} className={INPUT}>
              {PROJECT_MEDIA_KINDS.map(kind => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
            </select></label>
          </div>
          <label
            className={`mt-4 flex min-h-[12rem] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed p-5 text-center transition ${dragOver ? 'border-ink bg-cloud' : 'border-line bg-soft'}`}
            onDragOver={(event) => { event.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => { event.preventDefault(); setDragOver(false); handleUploadFiles(event.dataTransfer.files) }}
          >
            <UploadCloud size={28} className="text-accentDeep" />
            <span className="mt-3 text-sm font-medium text-ink">Качи снимки или планове</span>
            <span className="mt-1 text-xs text-muted">Drag & drop или избор от устройство</span>
            <input type="file" accept="image/*" multiple className="sr-only" onChange={event => { handleUploadFiles(event.target.files); event.target.value = '' }} />
          </label>
          <div className={`mt-3 text-sm ${uploadStatus.type === 'error' ? 'text-red-700' : 'text-muted'}`}>{uploadStatus.message || `${media.length} качени файла`}</div>
        </div>

        <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Quiz</div>
              <div className="mt-1 text-sm text-muted">Слой {currentLayer.number} · {currentLayer.title}</div>
            </div>
            {savedQuizKeys.length > 0 && <CheckCircle2 size={20} className="text-accentDeep" />}
          </div>

          <div className="mt-4 grid gap-2">
            {visibleQuizzes.map(item => (
              <button key={item.quizSlug} type="button" onClick={() => { setActiveQuizSlug(item.quizSlug); setQuizStatus({ type: 'idle', message: '' }) }} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${activeQuizSlug === item.quizSlug ? 'border-ink bg-soft' : 'border-line hover:border-ink/40'}`}>
                <span>{item.title}</span>
                <Play size={16} />
              </button>
            ))}
          </div>

          {activeQuizSlug && (
            <div className="mt-5">
              <material-decision-quiz ref={quizRef}></material-decision-quiz>
            </div>
          )}

          <div className={`mt-3 text-sm ${quizStatus.type === 'error' ? 'text-red-700' : 'text-muted'}`}>{quizStatus.message || (savedQuizKeys.length ? `Записани quiz-ове: ${savedQuizKeys.length}` : 'Резултатът се записва при завършване.')}</div>
        </div>
      </aside>

      <div className="lg:col-span-12 rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow">Галерия</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Снимки и планове</h2>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted"><Camera size={18} />{media.length} файла</div>
        </div>

        {media.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-line bg-soft p-6 text-sm text-muted">Още няма качени медии към проекта.</div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {media.map(item => (
              <article key={item.id} className="overflow-hidden rounded-2xl border border-line bg-paper">
                <div className="aspect-[4/3] bg-soft">
                  {item.url ? <img src={item.url} alt={item.caption || 'Проектна медия'} className="img-cover" /> : <div className="flex h-full w-full items-center justify-center text-muted"><ImagePlus size={24} /></div>}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs uppercase tracking-[0.14em] text-muted">{PROJECT_MEDIA_KINDS.find(kind => kind.value === item.kind)?.label || 'Медия'}</span>
                    <button type="button" onClick={() => onDeleteMedia(item.id)} className="rounded-full border border-line p-2 text-muted transition hover:border-ink hover:text-ink" aria-label="Изтрий медия">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <label className="mt-3 block text-sm font-medium text-ink">Описание<textarea defaultValue={item.caption} onBlur={event => saveMediaCaption(item, event.target.value)} rows={2} className={INPUT} /></label>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}