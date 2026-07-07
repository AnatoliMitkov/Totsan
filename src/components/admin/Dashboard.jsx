import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  CreditCard,
  FileClock,
  Flag,
  PackageCheck,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
} from 'lucide-react'
import {
  formatAdminDate,
  loadAccounts,
  loadAdminDashboard,
  loadAdminOrders,
  loadAuditLog,
  loadInquiries,
  loadPartnerApplications,
} from '../../lib/admin.js'
import { loadAdminPartnerServices } from '../../lib/partner-services.js'
import { loadAdminReviewReports, loadAdminReviews } from '../../lib/reviews.js'
import { INQUIRY_STATUS_META, StatusBadge } from './AdminStatus.jsx'

const ORDER_STATUS_LABELS = {
  pending_payment: 'Очаква плащане',
  paid: 'Платена',
  in_progress: 'В работа',
  delivered: 'Доставена',
  completed: 'Завършена',
  disputed: 'Спор',
  refunded: 'Възстановена',
  cancelled: 'Отказана',
}

export default function Dashboard({ onOpenSection }) {
  const [data, setData] = useState(createEmptyData())
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setStatus('loading')
    setError('')

    const [
      dashboard,
      inquiries,
      applications,
      accounts,
      audit,
      orders,
      services,
      reviews,
      reports,
    ] = await Promise.all([
      safeLoad(loadAdminDashboard, {}),
      safeLoad(loadInquiries, []),
      safeLoad(loadPartnerApplications, []),
      safeLoad(loadAccounts, []),
      safeLoad(loadAuditLog, []),
      safeLoad(loadAdminOrders, []),
      safeLoad(loadAdminPartnerServices, []),
      safeLoad(loadAdminReviews, []),
      safeLoad(loadAdminReviewReports, []),
    ])

    const failed = [dashboard, inquiries, applications, accounts, audit, orders, services, reviews, reports].filter(item => item.error)

    setData({
      metrics: dashboard.value || {},
      inquiries: inquiries.value || [],
      applications: applications.value || [],
      accounts: accounts.value || [],
      audit: audit.value || [],
      orders: orders.value || [],
      services: services.value || [],
      reviews: reviews.value || [],
      reports: reports.value || [],
    })
    setError(failed.map(item => item.error?.message).filter(Boolean).join(' · '))
    setStatus('ready')
  }

  const view = useMemo(() => buildDashboardView(data), [data])

  if (status === 'loading') return <Panel title="Зареждаме обзор…" />

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Част от данните не се заредиха, но обзорът остана активен: {error}
        </div>
      )}

      <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="eyebrow">Днес в Totsan</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Какво изисква внимание</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted">Обзорът показва решенията, които движат платформата: нови хора, модерация, trust, партньорски абонаменти и admin промени.</p>
          </div>
          <button type="button" onClick={load} className="btn btn-ghost self-start"><RefreshCcw size={17} /> Обнови</button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <TopMetric label="Нуждаят се от действие" value={view.actionTotal} icon={AlertTriangle} tone={view.actionTotal ? 'warning' : 'calm'} />
          <TopMetric label="Нови регистрации / 24ч" value={data.metrics.new_registrations_24h || 0} icon={Users} />
          <TopMetric label="Проверени партньори" value={data.metrics.approved_specialists || 0} icon={ShieldCheck} />
          <TopMetric label="Admin събития / 24ч" value={data.metrics.audit_events_24h || 0} icon={FileClock} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <section className="rounded-3xl border border-line bg-paper p-5 md:p-6">
          <SectionHeader eyebrow="Оперативно" title="Чака действие" action="Виж всички потребители" onClick={() => onOpenSection?.('users')} />
          <div className="mt-5 grid gap-3">
            {view.actions.map((item) => <ActionRow key={item.key} item={item} onOpenSection={onOpenSection} />)}
            {view.actions.length === 0 && <Empty text="Няма нещо спешно за действие. Добър момент за качество и съдържание." />}
          </div>
        </section>

        <section className="rounded-3xl border border-line bg-paper p-5 md:p-6">
          <SectionHeader eyebrow="Риск" title="Неща, които могат да болят" action="Audit log" onClick={() => onOpenSection?.('audit')} />
          <div className="mt-5 space-y-3">
            {view.risks.map((item) => <RiskRow key={item.key} item={item} onOpenSection={onOpenSection} />)}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <section className="xl:col-span-7 rounded-3xl border border-line bg-paper p-5 md:p-6">
          <SectionHeader eyebrow="Входящ поток" title="Нови неща" action="Запитвания" onClick={() => onOpenSection?.('inquiries')} />
          <div className="mt-5 grid gap-3">
            {view.newItems.map((item) => <FeedItem key={item.key} item={item} onOpenSection={onOpenSection} />)}
            {view.newItems.length === 0 && <Empty text="Няма нови запитвания, кандидатури или регистрации." />}
          </div>
        </section>

        <section className="xl:col-span-5 rounded-3xl border border-line bg-paper p-5 md:p-6">
          <SectionHeader eyebrow="Контрол" title="Последни admin промени" action="Audit log" onClick={() => onOpenSection?.('audit')} />
          <div className="mt-5 grid gap-3">
            {view.activity.map((item) => <FeedItem key={item.key} item={item} onOpenSection={onOpenSection} />)}
            {view.activity.length === 0 && <Empty text="Още няма admin действия." />}
          </div>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SmallMetric label="Публикувани профили" value={data.metrics.published_profiles || 0} />
        <SmallMetric label="Скрити профили" value={data.metrics.hidden_profiles || 0} />
        <SmallMetric label="Публични услуги" value={view.publishedServices} />
        <SmallMetric label="Средна оценка" value={view.averageRating || '—'} />
      </div>
    </div>
  )
}

function createEmptyData() {
  return {
    metrics: {},
    inquiries: [],
    applications: [],
    accounts: [],
    audit: [],
    orders: [],
    services: [],
    reviews: [],
    reports: [],
  }
}

async function safeLoad(loader, fallback) {
  try {
    return { value: await loader() }
  } catch (error) {
    return { value: fallback, error }
  }
}

function buildDashboardView(data) {
  const openInquiries = data.inquiries.filter(row => ['new', 'seen'].includes(row.status))
  const pendingApplications = data.applications.filter(row => row.status === 'pending')
  const pendingSpecialists = data.accounts.filter(row => row.role === 'specialist' && row.specialist_status === 'pending')
  const pendingServices = data.services.filter(row => row.moderationStatus === 'pending')
  const draftServices = data.services.filter(row => row.moderationStatus === 'draft')
  const openReports = data.reports.filter(row => row.status === 'open')
  const disputedOrders = data.orders.filter(row => row.status === 'disputed')
  const paymentAttention = data.orders.filter(row => row.status === 'pending_payment')
  const activeOrders = data.orders.filter(row => ['paid', 'in_progress', 'delivered'].includes(row.status))
  const adminAccounts = data.accounts.filter(row => row.role === 'admin')
  const adminRoleChanges = data.audit.filter(row => row.action === 'update_account' && row.payload?.updates?.role === 'admin')
  const publishedServices = data.services.filter(row => row.isPublished && row.moderationStatus === 'approved').length
  const averageRating = average(data.reviews.map(row => row.ratingOverall).filter(Boolean))

  const actions = [
    actionItem('applications', pendingApplications.length, 'Кандидатури за партньор', 'Нов специалист чака решение.', 'applications', UserCog, 'warning'),
    actionItem('services', pendingServices.length, 'Услуги за модерация', 'Партньорска услуга чака да бъде пусната или върната.', 'partner-services', PackageCheck, 'warning'),
    actionItem('inquiries', openInquiries.length, 'Запитвания без финал', 'Клиент чака отговор или преглед.', 'inquiries', ClipboardList, openInquiries.length ? 'warning' : 'calm', { inquiryStatusFilter: 'open' }),
    actionItem('reports', openReports.length, 'Сигнали за отзиви', 'Trust проблем, който трябва да се затвори.', 'reviews', Flag, openReports.length ? 'danger' : 'calm'),
    actionItem('disputes', disputedOrders.length, 'Спорни поръчки', 'Поръчка е в спор и има нужда от намеса.', 'orders', CreditCard, disputedOrders.length ? 'danger' : 'calm'),
  ].filter(item => item.count > 0)

  const risks = [
    riskItem('admins', adminAccounts.length, 'Admin акаунти', adminAccounts.map(formatAccountName).join(', ') || 'Няма admin акаунти', 'users', ShieldCheck),
    riskItem('admin-role-changes', adminRoleChanges.length, 'Дадени admin права', 'Следи всяка промяна на роли. Това е security зоната.', 'audit', AlertTriangle),
    riskItem('payment-attention', paymentAttention.length, 'Плащания без потвърждение', 'Провери поръчките, които още чакат плащане или потвърждение.', 'orders', CreditCard),
    riskItem('draft-services', draftServices.length, 'Услуги в чернова', 'Партньорите може да имат нужда от помощ да ги завършат.', 'partner-services', PackageCheck),
  ]

  const newItems = [
    ...data.inquiries.slice(0, 3).map(row => ({
      key: `inquiry-${row.id}`,
      title: row.name || 'Ново запитване',
      meta: formatAdminDate(row.created_at),
      text: row.message || row.contact || '',
      section: 'inquiries',
      icon: ClipboardList,
      status: row.status,
      statusType: 'inquiry',
    })),
    ...pendingApplications.slice(0, 2).map(row => ({
      key: `application-${row.id}`,
      title: row.name || 'Нова кандидатура',
      meta: `${formatAdminDate(row.created_at)} · ${row.email || 'без имейл'}`,
      text: row.company || row.about || '',
      section: 'applications',
      icon: UserCog,
    })),
    ...data.accounts.slice(0, 2).map(row => ({
      key: `account-${row.id}`,
      title: formatAccountName(row),
      meta: `${formatAdminDate(row.created_at)} · ${roleLabel(row.role)}`,
      text: row.email || '',
      section: 'users',
      icon: Users,
    })),
  ].sort((left, right) => timestamp(right.meta) - timestamp(left.meta)).slice(0, 6)

  const activity = data.audit.slice(0, 5).map(row => ({
    key: `audit-${row.id}`,
    title: auditTitle(row, data.accounts),
    meta: formatAdminDate(row.created_at),
    text: auditText(row, data.accounts),
    section: 'audit',
    icon: FileClock,
  }))

  return {
    actions,
    risks,
    newItems,
    activity,
    actionTotal: actions.reduce((sum, item) => sum + item.count, 0),
    publishedServices,
    activeOrders: activeOrders.length,
    averageRating: averageRating ? averageRating.toFixed(1) : '',
  }
}

function actionItem(key, count, title, text, section, icon, tone = 'calm', context = {}) {
  return { key, count, title, text, section, icon, tone, context }
}

function riskItem(key, count, title, text, section, icon) {
  return { key, count, title, text, section, icon }
}

function average(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length
}

function timestamp(value = '') {
  const match = String(value).match(/\d{1,2}\.\d{1,2}\.\d{4}/)
  if (!match) return 0
  const [day, month, year] = match[0].split('.').map(Number)
  return new Date(year, month - 1, day).getTime()
}

function formatAccountName(row = {}) {
  return row.full_name || row.display_name || row.email || 'Неизвестен акаунт'
}

function roleLabel(role) {
  if (role === 'admin') return 'Админ'
  if (role === 'specialist') return 'Специалист'
  return 'Клиент'
}

function statusLabel(status) {
  const labels = { new: 'Ново', seen: 'Прегледано', replied: 'Отговорено', closed: 'Затворено', completed: 'Завършено' }
  return labels[status] || status || '—'
}

function auditTitle(row, accounts) {
  if (row.action === 'update_account' && row.payload?.updates?.role === 'admin') return 'Дадени admin права'
  if (row.action === 'update_account') return 'Промяна на акаунт'
  if (row.action === 'approve_specialist') return 'Одобрен специалист'
  if (row.action === 'reject_specialist') return 'Отхвърлена кандидатура'
  if (row.action === 'update_inquiry_status') return 'Променено запитване'
  if (row.action === 'update_order_status') return 'Променена поръчка'
  return String(row.action || 'Админ действие').replace(/_/g, ' ')
}

function auditText(row, accounts) {
  const payload = row.payload || {}
  const actor = payload.actor_email || 'admin'
  const target = payload.target
    ? formatAccountName(payload.target)
    : formatAccountName(accounts.find(account => account.id === row.entity_id) || {})

  if (row.action === 'update_account' && payload.updates?.role) {
    return `${actor} промени ${target}: роля ${roleLabel(payload.updates.role)}.`
  }
  if (row.action === 'update_inquiry_status') return `${actor} зададе статус ${statusLabel(payload.status)}.`
  if (row.action === 'update_order_status') return `${actor} промени статус към ${ORDER_STATUS_LABELS[payload.status] || payload.status}.`
  return `${actor} извърши действие в ${row.entity_type || 'системата'}.`
}

function TopMetric({ label, value, icon: Icon, tone = 'calm' }) {
  const toneClass = tone === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-soft text-accentDeep'
  return (
    <div className="rounded-2xl border border-line bg-soft/40 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-display text-4xl text-ink">{value}</div>
          <div className="mt-1 text-xs text-muted">{label}</div>
        </div>
        <span className={`rounded-2xl p-3 ${toneClass}`}><Icon size={20} /></span>
      </div>
    </div>
  )
}

function SectionHeader({ eyebrow, title, action, onClick }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2 className="mt-2 font-display text-3xl text-ink">{title}</h2>
      </div>
      {action && <button type="button" onClick={onClick} className="btn btn-ghost !py-2 text-sm">{action}</button>}
    </div>
  )
}

function ActionRow({ item, onOpenSection }) {
  const Icon = item.icon
  const toneClass = item.tone === 'danger'
    ? 'border-red-200 bg-red-50 text-red-800'
    : item.tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-line bg-soft text-muted'

  return (
    <button type="button" onClick={() => onOpenSection?.(item.section, item.context)} className={`w-full rounded-2xl border p-4 text-left transition hover:border-ink/40 ${toneClass}`}>
      <div className="flex items-center gap-4">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-paper/80 text-ink"><Icon size={19} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">{item.title}</span>
          <span className="mt-1 block text-xs opacity-80">{item.text}</span>
        </span>
        <span className="font-display text-3xl text-ink">{item.count}</span>
        <ArrowRight size={17} className="shrink-0 text-ink/70" />
      </div>
    </button>
  )
}

function RiskRow({ item, onOpenSection }) {
  const Icon = item.icon
  return (
    <button type="button" onClick={() => onOpenSection?.(item.section, item.context)} className="w-full rounded-2xl border border-line bg-soft p-4 text-left transition hover:border-ink/40">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper text-accentDeep"><Icon size={17} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink">{item.title}</span>
            <span className="text-sm font-semibold text-ink">{item.count}</span>
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted">{item.text}</span>
        </span>
      </div>
    </button>
  )
}

function FeedItem({ item, onOpenSection }) {
  const Icon = item.icon || Sparkles
  return (
    <button type="button" onClick={() => onOpenSection?.(item.section, item.context)} className="w-full rounded-2xl border border-line bg-soft p-4 text-left transition hover:border-ink/40">
      <div className="flex items-start gap-3">
        <Icon size={18} className="mt-1 shrink-0 text-accentDeep" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{item.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{item.meta}</span>
            {item.statusType === 'inquiry' && <StatusBadge value={item.status} metaMap={INQUIRY_STATUS_META} className="!px-2 !py-0.5" />}
          </span>
          {item.text && <span className="mt-2 block line-clamp-2 text-sm leading-6 text-ink/75">{item.text}</span>}
        </span>
      </div>
    </button>
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
