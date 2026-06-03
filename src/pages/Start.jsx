import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react'
import { gsap } from 'gsap'
import { LAYERS } from '../data/layers.js'
import { supabase } from '../lib/supabase.js'

const SCOPE_OPTIONS = [
  { id: 'house', label: 'Строителство на нова къща' },
  { id: 'apartment', label: 'Ремонт на цял апартамент' },
  { id: 'room', label: 'Обзавеждане на отделно помещение' },
  { id: 'cosmetic', label: 'Декорация, двор или градина' },
]

const STAGE_OPTIONS = [
  { id: 'idea', label: 'Имам само идея в главата си' },
  { id: 'plans', label: 'Имам готови планове и чертежи' },
  { id: 'materials', label: 'Търся материали / обзавеждане' },
  { id: 'finish', label: 'Стените са готови, остава финалът' },
]

const PRIORITY_OPTIONS = [
  { id: 'quality', label: 'Максимално високо качество' },
  { id: 'speed', label: 'Бързо изпълнение и срокове' },
  { id: 'price', label: 'Оптимален бюджет и отстъпки' },
  { id: 'support', label: 'Спестяване на време и пълна координация' },
]

export default function Start() {
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState({
    scope: '',
    stage: '',
    priority: '',
  })
  const [result, setResult] = useState(null)
  const [leadForm, setLeadForm] = useState({
    name: '',
    contact: '',
    details: '',
  })
  const [leadStatus, setLeadStatus] = useState('idle')
  const [leadError, setLeadError] = useState('')

  const briefRef = useRef(null)

  const handleSelect = (field, value) => {
    setAnswers((prev) => ({ ...prev, [field]: value }))
  }

  const handleLeadFieldChange = (field) => (event) => {
    setLeadForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const nextStep = () => {
    if (step < 3) {
      setStep((prev) => prev + 1)
      gsap.fromTo(
        '.quiz-step-container',
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
      )
      return
    }

    calculateResult()
  }

  const resetQuiz = () => {
    setAnswers({ scope: '', stage: '', priority: '' })
    setResult(null)
    setStep(1)
    setLeadForm({ name: '', contact: '', details: '' })
    setLeadStatus('idle')
    setLeadError('')
  }

  const saveResultAsProjectBrief = () => {
    if (!result?.layer || typeof window === 'undefined') return

    window.localStorage.setItem('totsan.pendingProjectBrief', JSON.stringify({
      title: `Проект: ${result.layer.title}`,
      currentLayerSlug: result.layer.slug,
      ideaDescription: [
        'Начален резултат от Totsan quiz:',
        result.description,
        'Препоръчителни стъпки:',
        ...result.steps.map((item, index) => `${index + 1}. ${item}`),
      ].join('\n'),
      quizAnswers: {
        start: {
          title: 'Guided Project Brief',
          answers,
          recommendation: {
            layerSlug: result.layer.slug,
            layerTitle: result.layer.title,
            description: result.description,
            steps: result.steps,
          },
        },
      },
    }))
  }

  const calculateResult = () => {
    let recommendedLayer = 'ideya'
    let text = ''
    let stepsList = []

    const { scope, stage } = answers

    if (stage === 'idea') {
      recommendedLayer = 'ideya'
      text = 'Тъй като проектът ви е още в концептуална фаза, препоръчваме да започнете от Слой 01: Идея и консултация. Тук архитекти и интериорни дизайнери ще оформят визията и плановете ви.'
      stepsList = [
        'Намерете архитект за идейно заснемане.',
        'Направете 3D визуализация, за да усетите пространството.',
        'Консултирайте се безплатно по бюджетирането.',
      ]
    } else if (stage === 'plans') {
      recommendedLayer = 'postroyka'
      text = 'С готови планове сте готови за Слой 02: Постройка и имот. Имате нужда от инженери, надзор и проверени строителни екипи, които да реализират плановете.'
      stepsList = [
        'Поискайте оферти за груб или довършителен строеж.',
        'Намерете технически ръководител или строителен инспектор.',
        'Прегледайте договорите и гаранциите с юрист.',
      ]
    } else if (stage === 'materials') {
      if (scope === 'cosmetic' || scope === 'room') {
        recommendedLayer = 'obzavezhdane'
        text = 'Вие сте на крачка от завършването. Слой 04: Обзавеждане ще ви предложи мебели по поръчка, електроуреди и осветление за конкретните стаи.'
        stepsList = [
          'Разгледайте готови кухни или поръчайте индивидуален дизайн.',
          'Свържете се със специалисти за монтаж на уреди.',
          'Изберете осветление с комфортен светлинен спектър.',
        ]
      } else {
        recommendedLayer = 'materiali'
        text = 'Имате планове, но търсите верния баланс между цена и качество. Препоръчваме ви Слой 03: Материали. Сравнете цени и поръчайте настилки, изолации и дограма.'
        stepsList = [
          'Вземете мостри за бои и настилки.',
          'Изберете профили за високоенергийна дограма.',
          'Свържете се с дистрибутори директно за проектни цени.',
        ]
      }
    } else {
      recommendedLayer = 'dekoraciya'
      text = 'Строежът и големите мебели са готови. Слой 05: Декорация и финал ще ви помогне да превърнете пространството в дом със стенни облицовки, перголи, озеленяване и финални детайли.'
      stepsList = [
        'Намерете ландшафтен архитект за озеленяване на двора/терасата.',
        'Поръчайте дизайнерски тапети или декоративни мазилки.',
        'Добавете смарт поливна система за градината.',
      ]
    }

    const layerObj = LAYERS.find((layer) => layer.slug === recommendedLayer)

    setResult({
      layer: layerObj,
      description: text,
      steps: stepsList,
    })
    setLeadStatus('idle')
    setLeadError('')

    setTimeout(() => {
      gsap.fromTo(
        '.quiz-result-container',
        { opacity: 0, scale: 0.98, y: 15 },
        { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'power2.out' },
      )
    }, 50)
  }

  const submitLead = async (event) => {
    event.preventDefault()

    if (!result?.layer) return

    if (!leadForm.name.trim() || !leadForm.contact.trim()) {
      setLeadError('Моля попълни име и контакт.')
      setLeadStatus('error')
      return
    }

    setLeadStatus('sending')
    setLeadError('')

    const projectDescription = leadForm.details.trim() || 'Няма добавено допълнително описание.'
    const message = [
      projectDescription,
      '',
      `Препоръчан слой: ${result.layer.number} · ${result.layer.title}`,
      `Layer slug: ${result.layer.slug}`,
      `Резултат: ${result.description}`,
      '',
      'Отговори от Guided Project Brief:',
      `- Мащаб: ${getOptionLabel(SCOPE_OPTIONS, answers.scope)}`,
      `- Етап: ${getOptionLabel(STAGE_OPTIONS, answers.stage)}`,
      `- Приоритет: ${getOptionLabel(PRIORITY_OPTIONS, answers.priority)}`,
      '',
      'Препоръчителни стъпки:',
      ...result.steps.map((item, index) => `${index + 1}. ${item}`),
    ].join('\n')

    const { error } = await supabase.from('inquiries').insert({
      name: leadForm.name.trim(),
      contact: leadForm.contact.trim(),
      layer_slug: result.layer.slug,
      message,
      source: 'start_brief',
    })

    if (error) {
      console.error('[start] inquiry insert error:', error)
      setLeadError('Не успяхме да изпратим запитването. Опитай отново след малко.')
      setLeadStatus('error')
      return
    }

    setLeadStatus('sent')
    setLeadForm({ name: '', contact: '', details: '' })
  }

  const progressPercent = (step / 3) * 100

  return (
    <section className="section bg-soft border-y border-line" ref={briefRef}>
      <div className="container-page max-w-4xl">
        <div className="mx-auto max-w-3xl text-center mb-10">
          <div className="eyebrow">Guided Project Brief</div>
          <h1 className="h-section mt-2">Започни оттук — безплатно</h1>
          <p className="mt-3 text-muted">
            Кажи ни какъв проект планираш и на какъв етап си. Ще получиш кратка препоръка, правилния слой и следваща най-смислена стъпка.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted">
            <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-accent" /> Безплатно и без обвързване</span>
            <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-accent" /> Ясен следващ ход</span>
          </div>
        </div>

        {!result ? (
          <div className="card p-8 bg-paper border border-line shadow-md rounded-3xl quiz-step-container">
            <div className="w-full bg-soft h-1.5 rounded-full overflow-hidden mb-8">
              <div className="bg-accent h-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>

            {step === 1 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted font-bold mb-2">Стъпка 1 от 3</div>
                <h2 className="font-display text-2xl text-ink font-semibold mb-6">Какъв е мащабът на вашия проект?</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {SCOPE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleSelect('scope', option.id)}
                      className={`quiz-option-card p-5 text-left rounded-2xl ${answers.scope === option.id ? 'selected' : ''}`}
                    >
                      <div className="font-display text-lg text-ink font-semibold">{option.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted font-bold mb-2">Стъпка 2 от 3</div>
                <h2 className="font-display text-2xl text-ink font-semibold mb-6">На какъв етап сте в момента?</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {STAGE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleSelect('stage', option.id)}
                      className={`quiz-option-card p-5 text-left rounded-2xl ${answers.stage === option.id ? 'selected' : ''}`}
                    >
                      <div className="font-display text-lg text-ink font-semibold">{option.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted font-bold mb-2">Стъпка 3 от 3</div>
                <h2 className="font-display text-2xl text-ink font-semibold mb-6">Кой е вашият основен приоритет?</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {PRIORITY_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleSelect('priority', option.id)}
                      className={`quiz-option-card p-5 text-left rounded-2xl ${answers.priority === option.id ? 'selected' : ''}`}
                    >
                      <div className="font-display text-lg text-ink font-semibold">{option.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between mt-8 pt-6 border-t border-line">
              <button
                disabled={step === 1}
                onClick={() => setStep((prev) => prev - 1)}
                className="btn btn-ghost disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Назад
              </button>
              <button
                disabled={
                  (step === 1 && !answers.scope) ||
                  (step === 2 && !answers.stage) ||
                  (step === 3 && !answers.priority)
                }
                onClick={nextStep}
                className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep"
              >
                {step === 3 ? 'Виж резултата' : 'Продължи'}
              </button>
            </div>
          </div>
        ) : (
          <div className="card p-8 bg-paper border border-line shadow-lg rounded-3xl quiz-result-container">
            <div className="text-center mb-6">
              <div className="inline-flex p-3 bg-accentSoft rounded-full text-accent mb-3">
                <Sparkles size={28} />
              </div>
              <h2 className="font-display text-3xl text-ink font-bold">Твоят персонализиран резултат</h2>
              <p className="text-muted mt-1 text-sm">Въз основа на твоите нужди подготвихме следния стартов план.</p>
            </div>

            <div className="p-6 bg-soft/50 rounded-2xl border border-line">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs px-2.5 py-1 bg-accentDeep text-paper rounded-full font-bold">
                  СЛОЙ {result.layer.number}
                </span>
                <span className="font-display text-xl text-ink font-bold">{result.layer.title}</span>
              </div>
              <p className="text-sm text-muted mt-3 leading-relaxed">{result.description}</p>
            </div>

            <div className="mt-8">
              <h3 className="font-display text-lg text-ink font-semibold mb-4">Препоръчителни стъпки:</h3>
              <div className="space-y-3">
                {result.steps.map((stepText, index) => (
                  <div key={index} className="flex gap-3 items-start text-sm">
                    <span className="shrink-0 p-1 bg-accentSoft text-accentDeep rounded-full font-bold font-mono text-[10px] w-5 h-5 flex items-center justify-center mt-0.5">
                      {index + 1}
                    </span>
                    <span className="text-muted leading-relaxed">{stepText}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-center mt-8 pt-6 border-t border-line">
              <button onClick={resetQuiz} className="btn btn-ghost !border-line hover:!border-ink">
                Започни отначало
              </button>
              <Link to={`/sloy/${result.layer.slug}#specialisti`} className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep">
                Виж препоръчания слой →
              </Link>
            </div>

            <div className="mt-8 rounded-2xl border border-line bg-soft/50 p-6">
              {leadStatus === 'sent' ? (
                <div className="text-center py-4">
                  <CheckCircle2 size={40} className="mx-auto text-accentDeep" strokeWidth={1.5} />
                  <h3 className="font-display text-xl text-ink font-semibold mt-4">Запитването е изпратено.</h3>
                  <p className="text-sm text-muted mt-2">
                    Ще се свържем с теб с правилната следваща стъпка.
                  </p>
                </div>
              ) : (
                <form onSubmit={submitLead}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="eyebrow">Следваща стъпка</div>
                      <h3 className="font-display text-xl text-ink font-semibold mt-2">Изпрати запитване</h3>
                      <p className="text-sm text-muted mt-2">
                        Вече знаем кой слой е най-подходящ. Остави контакт и малко контекст, за да те насочим по-точно.
                      </p>
                    </div>
                    <Link
                      to="/moy-profil?tab=project&from=quiz"
                      onClick={saveResultAsProjectBrief}
                      className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
                    >
                      Запази като проект
                    </Link>
                  </div>

                  <div className="mt-5 grid sm:grid-cols-2 gap-4">
                    <Field
                      label="Име"
                      value={leadForm.name}
                      onChange={handleLeadFieldChange('name')}
                      placeholder="Иван Иванов"
                    />
                    <Field
                      label="Телефон или имейл"
                      value={leadForm.contact}
                      onChange={handleLeadFieldChange('contact')}
                      placeholder="+359 88... или name@email.com"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="text-xs text-muted">Какво още трябва да знаем?</label>
                    <textarea
                      value={leadForm.details}
                      onChange={handleLeadFieldChange('details')}
                      rows={5}
                      placeholder="Например: жилище 82 кв.м в София, искам ремонт поетапно, важно ми е да получа оферта и срок."
                      className="mt-2 w-full px-4 py-3 rounded-xl border border-line focus:border-ink outline-none text-sm"
                    />
                  </div>

                  {leadStatus === 'error' && (
                    <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                      {leadError}
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={leadStatus === 'sending'}
                      className="btn btn-primary !bg-accent !text-paper hover:!bg-accentDeep disabled:opacity-50"
                    >
                      {leadStatus === 'sending' ? 'Изпраща се...' : 'Изпрати запитване'}
                    </button>
                    <span className="text-xs text-muted">
                      Изпращаме и твоя резултат от brief-а, за да не обясняваш всичко отначало.
                    </span>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function getOptionLabel(options, value) {
  return options.find((option) => option.id === value)?.label || value
}

function Field({ label, ...rest }) {
  return (
    <div>
      <label className="text-xs text-muted">{label}</label>
      <input {...rest} className="mt-2 w-full px-4 py-3 rounded-xl border border-line focus:border-ink outline-none text-sm" />
    </div>
  )
}
