import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, CreditCard, FileClock, Flag, PackageCheck, ShieldCheck, UserCog, Users } from 'lucide-react'
import { formatAdminDate, loadAdminDashboard, loadInquiries, loadPartnerApplications } from '../../lib/admin.js'

export default function Dashboard({ onOpenSection }) {
  const [metrics, setMetrics] = useState({})
  const [inquiries, setInquiries] = useState([])
  const [applications, setApplications] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setStatus('loading')
    setError('')
    try {
      const [dashboard, inquiryRows, applicationRows] = await Promise.all([
        loadAdminDashboard(),
        loadInquiries(),
        loadPartnerApplications(),
      ])
      setMetrics(dashboard || {})
      setInquiries(inquiryRows.slice(0, 4))
      setApplications(applicationRows.slice(0, 4))
      setStatus('ready')
    } catch (loadError) {
      setError(loadError.message || 'Данните не се заредиха.')
      setStatus('error')
    }
  }

  const cards = useMemo(() => [
    { label: 'Нови регистрации / 24ч', value: metrics.new_registrations_24h || 0, icon: Users, section: 'users' },
    { label: 'Чакащи специалисти', value: metrics.pending_specialists || metrics.pending_applications || 0, icon: UserCog, section: 'applications' },
    { label: 'Активни услуги', value: metrics.published_services || metrics.pending_services || 0, icon: PackageCheck, section: 'partner-services' },
    { label: 'Плащания за внимание', value: metrics.payments_attention || 0, icon: CreditCard, section: 'orders' },
    { label: 'Сигнали за отзиви', value: metrics.open_review_reports || 0, icon: Flag, section: 'reviews' },
    { label: 'Отворени запитвания', value: metrics.open_inquiries || 0, icon: ClipboardList, section: 'inquiries' },
    { label: 'Audit събития / 24ч', value: metrics.audit_events_24h || 0, icon: ShieldCheck, section: 'audit' },
  ], [metrics])

  if (status === 'loading') return <Panel title="Зареждаме обзор…" />
  if (status === 'error') return <Panel title="Обзорът не се зареди"><p className="text-sm text-red-700">{error}</p><button type="button" onClick={load} className="btn btn-ghost mt-5">Опитай пак</button></Panel>

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <button key={card.label} type="button" onClick={() => onOpenSection?.(card.section)} className="rounded-3xl border border-line bg-paper p-5 text-left transition hover:border-ink/40">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-display text-4xl text-ink">{card.value}</div>
                  <div className="mt-1 text-xs text-muted">{card.label}</div>
                </div>
                <span className="rounded-2xl bg-soft p-3 text-accentDeep"><Icon size={20} /></span>
              </div>
            </button>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <section className="xl:col-span-7 rounded-3xl border border-line bg-paper p-5 md:p-6">
          <SectionHeader eyebrow="Оперативно" title="Последни запитвания" onClick={() => onOpenSection?.('inquiries')} />
          <div className="mt-5 space-y-3">
            {inquiries.map((row) => <FeedItem key={row.id} title={row.name} meta={`${formatAdminDate(row.created_at)} · ${row.status}`} text={row.message} />)}
            {inquiries.length === 0 && <Empty text="Все още няма запитвания." />}
          </div>
        </section>

        <section className="xl:col-span-5 rounded-3xl border border-line bg-paper p-5 md:p-6">
          <SectionHeader eyebrow="Партньори" title="Кандидатури" onClick={() => onOpenSection?.('applications')} />
          <div className="mt-5 space-y-3">
            {applications.map((row) => <FeedItem key={row.id} title={row.name} meta={`${formatAdminDate(row.created_at)} · ${row.status}`} text={row.company || row.email} />)}
            {applications.length === 0 && <Empty text="Няма нови кандидатури." />}
          </div>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SmallMetric label="Публикувани профили" value={metrics.published_profiles || 0} />
        <SmallMetric label="Скрити профили" value={metrics.hidden_profiles || 0} />
        <SmallMetric label="Блокирани акаунти" value={metrics.banned_accounts || 0} />
      </div>
    </div>
  )
}

function SectionHeader({ eyebrow, title, onClick }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2 className="mt-2 font-display text-3xl text-ink">{title}</h2>
      </div>
      <button type="button" onClick={onClick} className="btn btn-ghost !py-2 text-sm">Отвори</button>
    </div>
  )
}

function FeedItem({ title, meta, text }) {
  return (
    <article className="rounded-2xl border border-line bg-soft p-4">
      <div className="flex items-start gap-3">
        <FileClock size={18} className="mt-1 text-accentDeep" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-ink">{title}</div>
          <div className="mt-1 text-xs text-muted">{meta}</div>
          {text && <p className="mt-2 line-clamp-2 text-sm text-ink/75">{text}</p>}
        </div>
      </div>
    </article>
  )
}

function SmallMetric({ label, value }) {
  return (
    <div className="rounded-3xl border border-line bg-paper p-5">
      <div className="font-display text-3xl text-ink">{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  )
}

function Empty({ text }) {
  return <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-muted">{text}</div>
}

function Panel({ title, children }) {
  return <div className="rounded-3xl border border-line bg-paper p-6"><h2 className="font-display text-2xl text-ink">{title}</h2>{children && <div className="mt-3">{children}</div>}</div>
}