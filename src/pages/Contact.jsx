import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { Turnstile } from '@marsidev/react-turnstile'
import { LAYERS } from '../data/layers.js'
import { supabase, brand } from '../lib/supabase.js'
import { useAccount } from '../lib/account.js'
import { trackEvent } from '../lib/analytics.js'
import { buildBreadcrumbSchema, useSeo } from '../lib/seo.js'
import TotsanSelect from '../components/ui/TotsanSelect.jsx'

const CONTACT_ROUTES = {
  support: {
    label: 'Проблем със сайта',
    target: 'support@totsan.com',
    subject: '[SUPPORT] Проблем със сайта',
    helper: 'Опиши какво не работи, на коя страница се случва и какво се опита да направиш.',
    placeholder: 'Например: не мога да вляза, формата не работи, видях грешка в профила или не се изпраща запитване.',
    extraFields: ['problemUrl'],
  },
  feedback: {
    label: 'Идея или обратна връзка',
    target: 'support@totsan.com',
    subject: '[FEEDBACK] Идея или предложение',
    helper: 'Сподели идея, предложение или нещо, което би направило Totsan по-полезен.',
    placeholder: 'Например: би било полезно да има филтър, нов тип услуга, по-ясна стъпка или подобрение в профила.',
    extraFields: [],
  },
  client: {
    label: 'Въпрос като клиент',
    target: 'sales@totsan.com',
    subject: '[CLIENT] Запитване за проект',
    helper: 'За ремонт, материали, специалист, оглед, консултация или неясен старт на проект.',
    placeholder: 'Опиши какво искаш да направиш - ремонт, материали, специалист, оглед или идея за проект.',
    extraFields: [],
  },
  partner: {
    label: 'Искам да стана партньор',
    target: 'manager@totsan.com',
    subject: '[PARTNER] Кандидат за Totsan партньор',
    helper: 'Кажи какви услуги предлагаш, в кой град работиш и къде можем да видим работата ти.',
    placeholder: 'Напиши какви услуги предлагаш, в кой град работиш и какъв опит имаш.',
    extraFields: ['city', 'businessType', 'portfolioUrl'],
  },
  payment: {
    label: 'Плащане или фактура',
    target: 'payment@totsan.com',
    subject: '[PAYMENT] Плащане или фактура',
    helper: 'За плащания, фактури, абонаменти и въпроси към конкретна поръчка.',
    placeholder: 'Опиши въпроса и добави номер на профил, проект, поръчка или плащане, ако имаш такъв.',
    extraFields: ['referenceId'],
  },
  active_project: {
    label: 'Помощ по активен проект',
    target: 'support@totsan.com',
    subject: '[ACTIVE PROJECT] Помощ по активен проект',
    helper: 'Ако имаш активен проект, най-бързо ще помогнем през профила ти, където виждаме контекста.',
    placeholder: 'Опиши накратко какво се случва по активния проект и добави линк или номер, ако имаш.',
    extraFields: ['referenceId'],
  },
  other: {
    label: 'Друго',
    target: 'support@totsan.com',
    subject: '[OTHER] Контакт през сайта',
    helper: 'Ако не си сигурен къде попада запитването, изпрати го тук и ще го насочим правилно.',
    placeholder: 'Опиши накратко с какво можем да помогнем.',
    extraFields: [],
  },
}

const ROUTE_OPTIONS = [
  { value: '', label: 'Избери тема...' },
  ...Object.entries(CONTACT_ROUTES).map(([value, route]) => ({ value, label: route.label })),
]

const TURNSTILE_SITE_KEY = '0x4AAAAAADoPPM7fsJbPWv96'
const URGENT_PHONE_NUMBERS = [brand.phone, '+359 89 247 7333']

export default function Contact() {
  useSeo({
    canonicalPath: '/kontakt',
    jsonLd: [
      buildBreadcrumbSchema([
        { name: 'Начало', path: '/' },
        { name: 'Контакт', path: '/kontakt' },
      ]),
    ],
  })

  const { state } = useLocation()
  const { session, account } = useAccount()
  const subject = state?.subject || ''

  const [form, setForm] = useState({
    name: '',
    contact: '',
    routeKey: '',
    layer: '',
    message: subject ? `${subject}\n\n` : '',
    problemUrl: '',
    city: '',
    businessType: '',
    portfolioUrl: '',
    referenceId: '',
  })
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetKey, setCaptchaResetKey] = useState(0)

  const route = CONTACT_ROUTES[form.routeKey] || null
  const routeExtraFields = route?.extraFields || []
  const showLayerSelect = !route || ['client', 'other'].includes(form.routeKey)
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || TURNSTILE_SITE_KEY
  const requiresCaptcha = Boolean(turnstileSiteKey)

  useEffect(() => {
    if (!account) return
    setForm((current) => ({
      ...current,
      name: current.name || account.full_name || account.display_name || '',
      contact: current.contact || account.phone || account.email || session?.user?.email || '',
    }))
  }, [account, session])

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const finalMessage = useMemo(() => {
    const details = [
      `Тема: ${route?.label || 'Неизбрана'}`,
      route?.subject ? `Маркер: ${route.subject}` : '',
      form.problemUrl ? `Страница с проблема: ${form.problemUrl.trim()}` : '',
      form.city ? `Град: ${form.city.trim()}` : '',
      form.businessType ? `Тип дейност: ${form.businessType.trim()}` : '',
      form.portfolioUrl ? `Портфолио/сайт: ${form.portfolioUrl.trim()}` : '',
      form.referenceId ? `Референция: ${form.referenceId.trim()}` : '',
    ].filter(Boolean)

    return `${details.join('\n')}\n\n${form.message.trim()}`
  }, [form, route])

  async function resolveFunctionError(error) {
    try {
      const payload = await error?.context?.json?.()
      if (payload?.error) return payload.error
    } catch {
      // Keep the public fallback below when Supabase does not expose a JSON body.
    }
    return error?.message || `Нещо се обърка. Опитай отново след малко или ни пиши директно на ${brand.email}.`
  }

  async function onSubmit(event) {
    event.preventDefault()
    if (!form.name.trim() || !form.contact.trim() || !form.message.trim() || !route) {
      setErrorMsg('Моля, попълни име, контакт, тема и описание.')
      setStatus('error')
      return
    }
    if (requiresCaptcha && !captchaToken) {
      setErrorMsg('Моля, потвърди, че не си робот.')
      setStatus('error')
      return
    }

    setStatus('sending')
    setErrorMsg('')

    const { data, error } = await supabase.functions.invoke('submit-inquiry', {
      body: {
        captchaToken,
        inquiry: {
          name: form.name.trim(),
          contact: form.contact.trim(),
          layer_slug: showLayerSelect ? form.layer || null : null,
          message: finalMessage,
          source: `contact_form:${form.routeKey}`,
        },
      },
    })

    if (error) {
      console.error('[contact] submit-inquiry error:', error)
      setErrorMsg(await resolveFunctionError(error))
      setStatus('error')
      setCaptchaToken('')
      setCaptchaResetKey((key) => key + 1)
      return
    }

    supabase.functions.invoke('notify-inquiry', {
      body: {
        record: {
          ...data?.record,
          route_key: form.routeKey,
          route_label: route.label,
        },
      },
    }).catch((notifyError) => console.error('[contact] failed to notify:', notifyError))

    setStatus('sent')
    trackEvent('submit_inquiry', {
      source: 'contact_form',
      layer: showLayerSelect ? form.layer || undefined : undefined,
      inquiry_type: form.routeKey,
      target: route.target,
      user_id: session?.user?.id || undefined,
      is_authenticated: Boolean(session),
    })
    setForm({
      name: '',
      contact: '',
      routeKey: '',
      layer: '',
      message: '',
      problemUrl: '',
      city: '',
      businessType: '',
      portfolioUrl: '',
      referenceId: '',
    })
    setCaptchaToken('')
    setCaptchaResetKey((key) => key + 1)
  }

  return (
    <>
      <section className="section !pt-10 !pb-10 bg-gradient-to-br from-soft to-cloud">
        <div className="container-page max-w-4xl reveal">
          <div className="eyebrow">Контакт</div>
          <h1 className="h-display mt-3">Насочи запитването към правилния екип.</h1>
          <p className="mt-5 text-muted" style={{ fontSize: 'var(--step-md)' }}>
            Избери тема и формата ще подготви правилния контекст, получател и описание. Така можем да отговорим по-бързо и по-точно.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-12">
          <form onSubmit={onSubmit} className="reveal rounded-2xl border border-line bg-paper p-6 md:p-8 lg:col-span-7">
            {status === 'sent' ? (
              <div className="py-12 text-center">
                <CheckCircle2 size={48} className="mx-auto text-accentDeep" strokeWidth={1.5} />
                <h2 className="h-card mt-4">Получихме запитването ти.</h2>
                <p className="mt-2 text-muted">Ще се върнем към теб на контакта, който даде.</p>
                <button type="button" onClick={() => setStatus('idle')} className="btn btn-ghost mt-6">Изпрати ново</button>
              </div>
            ) : (
              <>
                <div className="eyebrow">Запитване</div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Твоето име" value={form.name} onChange={set('name')} placeholder="Иван Иванов" />
                  <Field label="Телефон или имейл" value={form.contact} onChange={set('contact')} placeholder="+359 88... или name@email.com" />
                </div>

                <div className="mt-4">
                  <TotsanSelect
                    label="От какво имате нужда?"
                    value={form.routeKey}
                    onChange={(value) => setForm((current) => ({ ...current, routeKey: value }))}
                    options={ROUTE_OPTIONS}
                  />
                </div>

                {route && (
                  <div className="mt-4 rounded-2xl border border-line bg-soft/70 p-4 text-sm leading-6 text-muted">
                    <div className="font-medium text-ink">{route.helper}</div>
                    <div className="mt-1">Ще бъде насочено към <span className="font-medium text-ink">{route.target}</span>.</div>
                  </div>
                )}

                {showLayerSelect && (
                  <div className="mt-4">
                    <TotsanSelect
                      label="Свързано ли е с конкретен слой? (незадължително)"
                      value={form.layer}
                      onChange={(value) => setForm((current) => ({ ...current, layer: value }))}
                      options={[
                        { value: '', label: 'Не съм сигурен - насочете ме' },
                        ...LAYERS.map((layer) => ({ value: layer.slug, label: `${layer.number} · ${layer.title}` })),
                      ]}
                    />
                  </div>
                )}

                {routeExtraFields.includes('problemUrl') && (
                  <Field className="mt-4" label="Линк към страницата с проблема" value={form.problemUrl} onChange={set('problemUrl')} placeholder="https://totsan.com/..." />
                )}

                {routeExtraFields.includes('city') && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Град" value={form.city} onChange={set('city')} placeholder="София, Пловдив..." />
                    <Field label="Тип дейност" value={form.businessType} onChange={set('businessType')} placeholder="майстор, дизайнер, магазин..." />
                  </div>
                )}

                {routeExtraFields.includes('portfolioUrl') && (
                  <Field className="mt-4" label="Линк към Facebook / сайт / портфолио" value={form.portfolioUrl} onChange={set('portfolioUrl')} placeholder="https://..." />
                )}

                {routeExtraFields.includes('referenceId') && (
                  <Field className="mt-4" label="Номер на проект, профил, поръчка или плащане" value={form.referenceId} onChange={set('referenceId')} placeholder="Ако имаш такъв" />
                )}

                {form.routeKey === 'active_project' && (
                  <div className="mt-4 rounded-2xl border border-accentSoft bg-accentSoft/60 p-4 text-sm leading-6 text-muted">
                    <div className="font-medium text-ink">Имате активен проект?</div>
                    <p className="mt-1">Най-бързо ще получите помощ през профила си, където виждаме контекста на проекта.</p>
                    <Link to={session ? '/moy-profil' : '/login?next=/moy-profil'} className="btn btn-ghost mt-3 !py-2 text-sm">Към моя профил</Link>
                  </div>
                )}

                <div className="mt-4">
                  <label className="text-xs text-muted">Описание</label>
                  <textarea
                    value={form.message}
                    onChange={set('message')}
                    rows={6}
                    placeholder={route?.placeholder || 'Избери тема и опиши накратко с какво можем да помогнем.'}
                    className="mt-2 w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-ink"
                  />
                </div>

                {status === 'error' && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMsg}</div>
                )}

                {requiresCaptcha && (
                  <div className="mt-6 flex justify-center sm:justify-start">
                    <Turnstile
                      key={captchaResetKey}
                      siteKey={turnstileSiteKey}
                      options={{ action: 'contact_form', theme: 'light' }}
                      onSuccess={(token) => setCaptchaToken(token)}
                      onExpire={() => setCaptchaToken('')}
                      onError={() => {
                        setErrorMsg('Неуспешна верификация. Опитай отново.')
                        setStatus('error')
                      }}
                    />
                  </div>
                )}

                <button disabled={status === 'sending' || (requiresCaptcha && !captchaToken)} className="btn btn-primary mt-6 disabled:opacity-50">
                  {status === 'sending' ? 'Изпраща се...' : 'Изпрати запитване'}
                </button>
                <div className="mt-3 text-xs text-muted">
                  С изпращане се съгласяваш с нашите{' '}
                  <Link to="/obshti-usloviya" className="font-medium text-accent hover:underline">условия</Link>.
                </div>
              </>
            )}
          </form>

          <aside className="reveal space-y-6 lg:col-span-5">
            <div className="rounded-2xl border border-line bg-paper p-6">
              <div className="eyebrow">Контакт според случая</div>
              <div className="mt-5 space-y-4 text-sm">
                <ContactRoute label="Общи клиентски въпроси" email="sales@totsan.com" />
                <ContactRoute label="Проблем със сайта" email="support@totsan.com" />
                <ContactRoute label="Плащания и фактури" email="payment@totsan.com" />
                <ContactRoute label="Партньори" email="manager@totsan.com" />
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-soft p-6">
              <div className="font-display text-xl">Телефон за партньори и спешни случаи</div>
              <p className="mt-2 text-sm text-muted">Телефонът е за ясни случаи: партньори, активни проекти или спешен контакт.</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                {URGENT_PHONE_NUMBERS.map((phone, index) => (
                  <span key={phone} className="inline-flex items-center gap-2">
                    {index > 0 && <span className="text-muted">|</span>}
                    <a href={`tel:${phone.replace(/\s/g, '')}`} className="hover:text-accent">{phone}</a>
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-paper p-6">
              <div className="font-display text-xl">Активен проект?</div>
              <p className="mt-2 text-sm text-muted">За проект, който вече тече с партньор, най-добре започни от профила си.</p>
              <Link to={session ? '/moy-profil' : '/login?next=/moy-profil'} className="btn btn-ghost mt-5 w-full justify-center !border-line hover:!border-ink">
                Към моя профил
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}

function Field({ label, className = '', ...rest }) {
  return (
    <div className={className}>
      <label className="text-xs text-muted">{label}</label>
      <input {...rest} className="mt-2 w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-ink" />
    </div>
  )
}

function ContactRoute({ label, email }) {
  return (
    <div className="border-b border-line pb-3 last:border-b-0 last:pb-0">
      <div className="font-medium text-ink">{label}</div>
      <a href={`mailto:${email}`} className="mt-1 inline-flex text-muted hover:text-accent">{email}</a>
    </div>
  )
}
