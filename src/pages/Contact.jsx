import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { LAYERS } from '../data/layers.js'
import { supabase, brand } from '../lib/supabase.js'
import { useAccount } from '../lib/account.js'
import { trackEvent } from '../lib/analytics.js'
import { buildBreadcrumbSchema, useSeo } from '../lib/seo.js'
import TotsanSelect from '../components/ui/TotsanSelect.jsx'
import { Turnstile } from '@marsidev/react-turnstile'

const INQUIRY_TYPES = [
  { value: 'question', label: 'Въпрос' },
  { value: 'offer', label: 'Запитване за оферта' },
  { value: 'problem', label: 'Проблем / Техническа помощ' },
  { value: 'specific', label: 'Специфична нужда' }
]

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
    layer: '', 
    inquiryType: '',
    message: subject ? `${subject}\n\n` : '' 
  })
  
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')

  // Testing site key for local dev if real key isn't provided in .env
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'

  useEffect(() => {
    if (account) {
      setForm(f => ({
        ...f,
        name: f.name || account.full_name || account.display_name || '',
        contact: f.contact || account.phone || account.email || session?.user?.email || ''
      }))
    }
  }, [account, session])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.contact.trim() || !form.message.trim() || !form.inquiryType) {
      setErrorMsg('Моля попълни всички задължителни полета.')
      setStatus('error')
      return
    }
    if (!captchaToken) {
      setErrorMsg('Моля, потвърди, че не си робот.')
      setStatus('error')
      return
    }
    setStatus('sending')
    setErrorMsg('')

    const inquiryLabel = INQUIRY_TYPES.find(t => t.value === form.inquiryType)?.label || form.inquiryType
    const finalMessage = `[Тип: ${inquiryLabel}]\n\n${form.message.trim()}`

    const { data: newInquiry, error } = await supabase.from('inquiries').insert({
      name: form.name.trim(),
      contact: form.contact.trim(),
      layer_slug: form.layer || null,
      message: finalMessage,
      source: 'contact_form',
      client_id: session?.user?.id || null,
    }).select().single()

    if (error) {
      console.error('[contact] insert error:', error)
      setErrorMsg('Нещо се обърка. Опитай отново след малко или ни пиши директно на ' + brand.email + '.')
      setStatus('error')
      return
    }

    // Trigger email notification (fire and forget)
    supabase.functions.invoke('notify-inquiry', {
      body: { record: newInquiry }
    }).catch(err => console.error('[contact] failed to notify:', err))

    setStatus('sent')
    trackEvent('submit_inquiry', {
      source: 'contact_form',
      layer: form.layer || undefined,
      inquiry_type: form.inquiryType,
      user_id: session?.user?.id || undefined,
      is_authenticated: Boolean(session),
    })
    setForm({ name: '', contact: '', layer: '', inquiryType: '', message: '' })
    setCaptchaToken('')
  }

  return (
    <>
      <section className="section !pt-20 bg-gradient-to-br from-soft to-cloud">
        <div className="container-page max-w-4xl reveal">
          <div className="eyebrow">Контакт</div>
          <h1 className="h-display mt-3">Кажи ни в две изречения какво искаш.</h1>
          <p className="mt-5 text-muted" style={{fontSize:'var(--step-md)'}}>
            Връщаме се с подходящи хора още същата седмица. Безплатно, без обвързване.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container-page grid lg:grid-cols-12 gap-12">
          <form onSubmit={onSubmit} className="lg:col-span-7 reveal border border-line rounded-2xl p-8 bg-paper">
            {status === 'sent' ? (
              <div className="text-center py-12">
                <CheckCircle2 size={48} className="mx-auto text-accentDeep" strokeWidth={1.5} />
                <h2 className="h-card mt-4">Получихме запитването ти.</h2>
                <p className="text-muted mt-2">Връщаме се в рамките на 48 часа на контакта, който даде.</p>
                <button type="button" onClick={() => setStatus('idle')} className="btn btn-ghost mt-6">Изпрати ново</button>
              </div>
            ) : (
              <>
                <div className="eyebrow">Запитване</div>
                <div className="mt-5 grid sm:grid-cols-2 gap-4">
                  <Field label="Твоето име" value={form.name} onChange={set('name')} placeholder="Иван Иванов" />
                  <Field label="Телефон или имейл" value={form.contact} onChange={set('contact')} placeholder="+359 88 …" />
                </div>
                <div className="mt-4">
                  <TotsanSelect
                    label="От какво имаш нужда?"
                    value={form.inquiryType}
                    onChange={(val) => setForm(f => ({ ...f, inquiryType: val }))}
                    options={[
                      { value: '', label: 'Избери тип запитване...' },
                      ...INQUIRY_TYPES
                    ]}
                  />
                </div>
                <div className="mt-4">
                  <TotsanSelect
                    label="Свързано ли е с конкретен слой? (Незадължително)"
                    value={form.layer}
                    onChange={(val) => setForm(f => ({ ...f, layer: val }))}
                    options={[
                      { value: '', label: 'Не съм сигурен — насочете ме' },
                      ...LAYERS.map(l => ({ value: l.slug, label: `${l.number} · ${l.title}` }))
                    ]}
                  />
                </div>
                <div className="mt-4">
                  <label className="text-xs text-muted">Описание на запитването</label>
                  <textarea value={form.message} onChange={set('message')} rows={6}
                    placeholder="Например: Имам апартамент 75 м² в София, искам да го преобразувам — нямам идея откъде да започна."
                    className="mt-2 w-full px-4 py-3 rounded-xl border border-line focus:border-ink outline-none text-sm"></textarea>
                </div>

                <div className="mt-6 flex justify-center sm:justify-start">
                  <Turnstile 
                    siteKey={turnstileSiteKey} 
                    onSuccess={(token) => setCaptchaToken(token)}
                    onError={() => setErrorMsg('Неуспешна верификация. Опитай отново.')}
                  />
                </div>

                {status === 'error' && (
                  <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{errorMsg}</div>
                )}

                <button disabled={status === 'sending' || !captchaToken} className="btn btn-primary mt-6 disabled:opacity-50">
                  {status === 'sending' ? 'Изпраща се…' : 'Изпрати запитване'}
                </button>
                <div className="mt-3 text-xs text-muted">
                  С изпращане се съгласяваш с нашите{' '}
                  <Link to="/obshti-usloviya" className="font-medium text-accent hover:underline">условия</Link>.
                </div>
              </>
            )}
          </form>

          <aside className="lg:col-span-5 reveal space-y-6">
            <div className="border border-line rounded-2xl p-6 bg-paper">
              <div className="eyebrow">Директен контакт</div>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex justify-between border-b border-line pb-3"><span className="text-muted">Имейл</span><a href={`mailto:${brand.email}`} className="hover:text-accent">{brand.email}</a></li>
                <li className="flex justify-between border-b border-line pb-3"><span className="text-muted">Телефон</span><a href={`tel:${brand.phone.replace(/\s/g,'')}`} className="hover:text-accent">{brand.phone}</a></li>
                <li className="flex justify-between border-b border-line pb-3"><span className="text-muted">Адрес</span><span>1000 София, България</span></li>
                <li className="flex justify-between"><span className="text-muted">Работно време</span><span>пн–пт · 9:00–18:00</span></li>
              </ul>
            </div>
            <div className="border border-line rounded-2xl p-6 bg-soft">
              <div className="font-display text-xl">Спешно?</div>
              <p className="text-sm text-muted mt-2">За проектите, които вече текат с наши партньори, имаме отделна линия за поддръжка — намираш я в профила си.</p>
              <Link to={session ? "/moy-profil?tab=inbox" : "/login?next=/moy-profil"} className="btn btn-ghost !border-line hover:!border-ink mt-5 w-full justify-center">
                Към моя профил
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}

function Field({ label, ...rest }) {
  return (
    <div>
      <label className="text-xs text-muted">{label}</label>
      <input {...rest} className="mt-2 w-full px-4 py-3 rounded-xl border border-line focus:border-ink outline-none text-sm" />
    </div>
  )
}
