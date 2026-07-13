import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  FileCheck2,
  ListChecks,
  MapPin,
  MessageSquare,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useAccount } from '../lib/account.js'
import { ORDER_ACTION_LABELS, ORDER_STATUS_LABELS, formatOrderDate, formatOrderMoney, loadOrderDetails, orderStatusTone } from '../lib/orders.js'
import { MILESTONE_STATUS_LABELS, OFFER_TYPE_LABELS, PAYMENT_METHOD_LABELS, normalizeAcceptedOffer } from '../lib/offers.js'
import { buildOrderWorkspace, checkoutPathForOrder } from '../lib/order-workspace.js'
import { PROPERTY_TYPES, getLocationAccessSummary, getSafeGoogleMapsUrl } from '../lib/projects.js'
import { runMilestoneAction, runOrderAction } from '../lib/payments.js'
import { loadOrderReview } from '../lib/reviews.js'
import ReviewForm from '../components/reviews/ReviewForm.jsx'
import OfferDocumentView from '../components/offers/OfferDocumentView.jsx'
import { supabase } from '../lib/supabase.js'

export default function Order() {
  const { orderId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const { session, loading } = useAccount()
  const userId = session?.user?.id || ''
  const [details, setDetails] = useState({ order: null, events: [], payments: [], milestones: [] })
  const [review, setReview] = useState(null)
  const [offer, setOffer] = useState(null)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [revisionNote, setRevisionNote] = useState('')

  async function load({ background = false } = {}) {
    if (!orderId || !userId) return
    if (!background) {
      setStatus('loading')
      setMessage('')
    }
    try {
      const next = await loadOrderDetails(orderId)
      const nextReview = next.order?.status === 'completed' ? await loadOrderReview(orderId) : null
      let nextOffer = null

      if (next.order?.offerId) {
        const { data: offerData } = await supabase
          .from('offers')
          .select('*')
          .eq('id', next.order.offerId)
          .maybeSingle()
        nextOffer = offerData || null
      }

      setDetails(next)
      setReview(nextReview)
      setOffer(nextOffer)
      setStatus(next.order ? 'ready' : 'not-found')
    } catch (error) {
      setStatus(background ? 'ready' : 'error')
      setMessage(error.message || (background ? 'Поръчката не можа да се обнови.' : 'Поръчката не се зареди.'))
    }
  }

  useEffect(() => {
    if (loading || !userId) return undefined
    load()
    const refreshInBackground = () => load({ background: true })
    window.addEventListener('focus', refreshInBackground)
    return () => window.removeEventListener('focus', refreshInBackground)
  }, [loading, userId, orderId]) // eslint-disable-line react-hooks/exhaustive-deps

  const order = details.order
  const agreedOffer = order && (offer || order.acceptedOfferSnapshot)
    ? normalizeAcceptedOffer(offer, order.acceptedOfferSnapshot || undefined)
    : null
  const role = order?.clientId === userId ? 'client' : order?.partnerId === userId ? 'partner' : 'guest'
  const clientProfilePath = role === 'client'
    ? '/moy-profil'
    : role === 'partner' && order?.conversationId
      ? `/inbox/${order.conversationId}/client-profile`
      : ''
  const partnerProfilePath = role === 'partner'
    ? '/moy-profil'
    : order?.partnerAccount?.profilePath || ''
  const checkoutPath = useMemo(() => checkoutPathForOrder(order), [order])
  const workspace = useMemo(
    () => buildOrderWorkspace({ order, milestones: details.milestones, role, checkoutPath }),
    [order, details.milestones, role, checkoutPath],
  )
  const visibleEvents = useMemo(() => dedupeEvents(details.events), [details.events])
  const visiblePayments = useMemo(() => dedupePayments(details.payments), [details.payments])
  const headerSummary = conciseOrderSummary(agreedOffer?.summary || order?.description || '')

  async function run(action) {
    if (!order?.id) return
    setStatus('saving')
    setMessage('')
    try {
      await runOrderAction(order.id, action, revisionNote)
      setRevisionNote('')
      await load({ background: true })
    } catch (error) {
      setStatus('ready')
      setMessage(error.message || 'Статусът не се промени.')
    }
  }

  async function runMilestone(milestoneId, action, note = '') {
    setStatus('saving')
    setMessage('')
    try {
      await runMilestoneAction(milestoneId, action, note)
      await load({ background: true })
    } catch (error) {
      setStatus('ready')
      setMessage(error.message || 'Етапът не се промени.')
      throw error
    }
  }

  if (loading) return <OrderShell><Panel title="Зареждаме поръчката…" /></OrderShell>
  if (!session) return <OrderShell><Panel title="Влез, за да видиш поръчката"><Link to="/login" className="btn btn-primary mt-5">Вход</Link></Panel></OrderShell>
  if (status === 'loading') return <OrderShell><Panel title="Зареждаме поръчката…" /></OrderShell>
  if (status === 'not-found' || !order) return <OrderShell><Panel title="Поръчката не е налична"><p className="mt-2 text-sm text-muted">Нямаш достъп или линкът е невалиден.</p></Panel></OrderShell>
  if (status === 'error') return <OrderShell><Panel title="Поръчката не се зареди"><p className="mt-2 text-sm text-red-700">{message}</p></Panel></OrderShell>

  return (
    <OrderShell>
      <OrderHeader order={order} summary={headerSummary} />

      {searchParams.get('payment') === 'cancelled' && (
        <div role="status" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Плащането е прекъснато и не е начислена сума. Можеш да опиташ отново, когато си готов.
        </div>
      )}

      <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-12 lg:items-start">
        <main className="min-w-0 space-y-5 lg:col-span-8">
          <CurrentWorkPanel
            order={order}
            milestones={details.milestones}
            workspace={workspace}
            role={role}
            checkoutPath={checkoutPath}
            revisionNote={revisionNote}
            setRevisionNote={setRevisionNote}
            busy={status === 'saving'}
            message={message}
            onOrderAction={run}
            onMilestoneAction={runMilestone}
          />

          <div className="lg:hidden">
            <OrderSummaryCard order={order} clientProfilePath={clientProfilePath} partnerProfilePath={partnerProfilePath} />
          </div>

          {order.status === 'completed' && <ReviewForm order={order} review={review} role={role} onChange={setReview} />}

          {details.projectLocation && <OrderLocationDisclosure location={details.projectLocation} />}

          {!agreedOffer && order.deliverables.length > 0 && <DeliverablesDisclosure items={order.deliverables} />}

          {agreedOffer && <AgreedOfferDisclosure offer={agreedOffer} />}

          <RecordDisclosure
            title="Плащания и потвърждения"
            icon={ReceiptText}
            records={visiblePayments}
            emptyText="Още няма регистрирани плащания или потвърждения."
            renderPreview={(payment) => <PaymentPreview payment={payment} />}
            renderRow={(payment) => <PaymentRow key={payment.id} payment={payment} />}
          />

          <RecordDisclosure
            title="История на поръчката"
            icon={Clock3}
            records={visibleEvents}
            emptyText="Още няма събития по поръчката."
            renderPreview={(event) => <EventPreview event={event} />}
            renderRow={(event) => <EventRow key={event.id} event={event} />}
          />
        </main>

        <aside className="hidden min-w-0 lg:col-span-4 lg:block">
          <div className="sticky top-24">
            <OrderSummaryCard order={order} clientProfilePath={clientProfilePath} partnerProfilePath={partnerProfilePath} />
          </div>
        </aside>
      </div>
    </OrderShell>
  )
}

function OrderHeader({ order, summary }) {
  return (
    <header className="rounded-3xl border border-line bg-paper p-5 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link to="/porachki" className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-ink focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentDeep">
          <ArrowLeft size={17} aria-hidden="true" /> Моите поръчки
        </Link>
        <span className={`rounded-full px-3 py-1.5 text-xs font-medium sm:text-sm ${orderStatusTone(order.status)}`}>
          {ORDER_STATUS_LABELS[order.status] || order.status}
        </span>
      </div>
      <div className="mt-6 max-w-4xl">
        <div className="eyebrow">Поръчка</div>
        <h1 className="mt-2 break-words font-display text-[1.875rem] leading-[1.15] tracking-[-0.015em] text-ink sm:text-[2.5rem]">
          {order.title}
        </h1>
        {summary && <p className="mt-3 max-w-3xl whitespace-pre-wrap text-[0.9375rem] leading-6 text-muted sm:text-base">{summary}</p>}
      </div>
    </header>
  )
}

function CurrentWorkPanel({ order, milestones, workspace, role, checkoutPath, revisionNote, setRevisionNote, busy, message, onOrderAction, onMilestoneAction }) {
  const current = workspace.currentMilestone
  const otherMilestones = current ? milestones.filter((milestone) => milestone.id !== current.id) : []
  const progress = workspace.totalCount > 0 ? Math.round((workspace.acceptedCount / workspace.totalCount) * 100) : 0

  return (
    <section className="rounded-3xl border border-accentDeep/50 bg-paper p-5 shadow-[0_18px_48px_-42px_rgba(13,35,64,0.7)] md:p-6" aria-labelledby="order-work-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Изпълнение и плащане</div>
          <h2 id="order-work-title" className="mt-2 font-display text-2xl leading-tight text-ink sm:text-3xl">
            {current ? 'Текущ етап' : 'Следваща стъпка'}
          </h2>
        </div>
        {workspace.totalCount > 0 && <div className="text-sm font-medium text-muted">{workspace.acceptedCount} от {workspace.totalCount} приети</div>}
      </div>

      {workspace.totalCount > 0 && (
        <div className="mt-4">
          <div
            role="progressbar"
            aria-label={`${workspace.acceptedCount} от ${workspace.totalCount} приети етапа`}
            aria-valuemin="0"
            aria-valuemax={workspace.totalCount}
            aria-valuenow={workspace.acceptedCount}
            className="h-2 overflow-hidden rounded-full bg-soft"
          >
            <div className="h-full rounded-full bg-accentDeep transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {current ? (
        <ActiveMilestone milestone={current} role={role} busy={busy} nextStep={workspace.nextStep} onAction={onMilestoneAction} />
      ) : (
        <OrderLevelAction
          order={order}
          role={role}
          checkoutPath={checkoutPath}
          actions={workspace.orderActions}
          revisionNote={revisionNote}
          setRevisionNote={setRevisionNote}
          busy={busy}
          nextStep={workspace.nextStep}
          onAction={onOrderAction}
        />
      )}

      {message && <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</div>}

      {otherMilestones.length > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            <ListChecks size={16} className="text-accentDeep" aria-hidden="true" /> Преглед на етапите
          </div>
          <ol className="mt-3 space-y-2">
            {otherMilestones.map((milestone) => <MilestoneSummaryRow key={milestone.id} milestone={milestone} />)}
          </ol>
        </div>
      )}
    </section>
  )
}

function ActiveMilestone({ milestone, role, busy, nextStep, onAction }) {
  const [note, setNote] = useState('')
  const [localError, setLocalError] = useState('')
  const canPay = role === 'client' && ['ready', 'payment_pending'].includes(milestone.status)
  const canStart = role === 'partner' && milestone.status === 'paid'
  const canSubmit = role === 'partner' && ['in_progress', 'revision_requested'].includes(milestone.status)
  const canReview = role === 'client' && milestone.status === 'submitted'

  async function act(action, needsNote = false) {
    if (needsNote && !note.trim()) {
      setLocalError('Добави кратка бележка.')
      return
    }
    setLocalError('')
    try {
      await onAction(milestone.id, action, note.trim())
      setNote('')
    } catch {
      // The shared order alert displays the action error.
    }
  }

  return (
    <article className="mt-5 rounded-3xl border border-line bg-soft/65 p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Етап {milestone.position}</div>
          <h3 className="mt-1 break-words text-lg font-semibold leading-6 text-ink">{milestone.title}</h3>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          <div className="font-semibold text-ink">{formatOrderMoney(milestone.amount, milestone.currency)}</div>
          <MilestoneStatus status={milestone.status} />
        </div>
      </div>

      {milestone.description && <p className="mt-4 whitespace-pre-wrap text-[0.9375rem] leading-6 text-muted">{milestone.description}</p>}

      {(milestone.durationDays > 0 || milestone.startCondition || milestone.paymentNote) && (
        <dl className="mt-4 grid gap-3 rounded-2xl border border-line bg-paper p-4 text-sm sm:grid-cols-2">
          {milestone.durationDays > 0 && <MetaValue label="Срок" value={`${milestone.durationDays} работни дни`} />}
          {milestone.startCondition && <MetaValue label="Условие за старт" value={milestone.startCondition} />}
          {milestone.paymentNote && <MetaValue label="Плащане" value={milestone.paymentNote} wide />}
        </dl>
      )}

      <div className="mt-4 rounded-2xl border border-accentDeep/25 bg-accentSoft/35 p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-accentDeep">Следваща стъпка</div>
        <p className="mt-2 text-sm leading-6 text-ink/80">{nextStep}</p>
      </div>

      {(canSubmit || canReview) && (
        <div className="mt-4">
          <label htmlFor={`milestone-note-${milestone.id}`} className="text-sm font-medium text-ink">
            {canReview ? 'Бележка при корекция или спор' : 'Бележка към предаването (по избор)'}
          </label>
          <textarea
            id={`milestone-note-${milestone.id}`}
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-accentDeep focus:ring-4 focus:ring-accent/10"
          />
        </div>
      )}
      {localError && <p className="mt-2 text-sm text-red-700">{localError}</p>}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canPay && <Link to={`/checkout/milestone/${milestone.id}`} className="btn btn-primary min-h-11 w-full justify-center sm:w-auto"><CreditCard size={16} aria-hidden="true" /> Плати този етап</Link>}
        {canStart && <button type="button" disabled={busy} onClick={() => act('start')} className="btn btn-primary min-h-11 w-full justify-center disabled:opacity-55 sm:w-auto">Започни етапа</button>}
        {canSubmit && <button type="button" disabled={busy} onClick={() => act('submit')} className="btn btn-primary min-h-11 w-full justify-center disabled:opacity-55 sm:w-auto">Предай етапа</button>}
        {canReview && <button type="button" disabled={busy} onClick={() => act('accept')} className="btn btn-primary min-h-11 w-full justify-center disabled:opacity-55 sm:w-auto">Приеми етапа</button>}
        {canReview && <button type="button" disabled={busy} onClick={() => act('request_revision', true)} className="btn btn-ghost min-h-11 w-full justify-center disabled:opacity-55 sm:w-auto">Поискай корекция</button>}
        {canReview && <button type="button" disabled={busy} onClick={() => act('dispute', true)} className="btn btn-ghost min-h-11 w-full justify-center text-red-700 disabled:opacity-55 sm:w-auto">Оспори</button>}
      </div>
    </article>
  )
}

function OrderLevelAction({ order, role, checkoutPath, actions, revisionNote, setRevisionNote, busy, nextStep, onAction }) {
  return (
    <div className="mt-5">
      <div className="rounded-2xl border border-accentDeep/25 bg-accentSoft/35 p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-accentDeep">Следваща стъпка</div>
        <p className="mt-2 text-sm leading-6 text-ink/80">{nextStep}</p>
      </div>

      {actions.includes('request_revision') && (
        <div className="mt-4">
          <label htmlFor="order-revision-note" className="text-sm font-medium text-ink">Какво трябва да се коригира</label>
          <textarea id="order-revision-note" rows={3} value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} className="mt-2 w-full rounded-2xl border border-line bg-soft px-4 py-3 text-sm outline-none transition focus:border-accentDeep focus:ring-4 focus:ring-accent/10" />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {role === 'client' && order.status === 'pending_payment' && checkoutPath && (
          <Link to={checkoutPath} className="btn btn-primary min-h-11 w-full justify-center sm:w-auto"><CreditCard size={18} aria-hidden="true" /> Към плащане</Link>
        )}
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onAction(action)}
            disabled={busy}
            className={`${['confirm_direct_payment', 'confirm_completed', 'mark_delivered', 'start_work'].includes(action) ? 'btn btn-primary' : 'btn btn-ghost'} min-h-11 w-full justify-center disabled:opacity-55 sm:w-auto`}
          >
            {busy ? 'Запазваме…' : ORDER_ACTION_LABELS[action] || action}
          </button>
        ))}
      </div>
    </div>
  )
}

function MilestoneSummaryRow({ milestone }) {
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-soft/45 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper">{milestone.position}</span>
        <div className="min-w-0">
          <div className="break-words text-sm font-medium text-ink">{milestone.title}</div>
          <div className="mt-1 text-xs text-muted">{formatOrderMoney(milestone.amount, milestone.currency)}</div>
        </div>
      </div>
      <MilestoneStatus status={milestone.status} />
    </li>
  )
}

function MilestoneStatus({ status }) {
  return <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs ${milestoneStatusTone(status)}`}>{MILESTONE_STATUS_LABELS[status] || status}</span>
}

function OrderSummaryCard({ order, clientProfilePath, partnerProfilePath }) {
  return (
    <section className="rounded-3xl border border-line bg-paper p-5 md:p-6" aria-labelledby="order-summary-title">
      <div className="eyebrow">Обобщение</div>
      <h2 id="order-summary-title" className="mt-2 font-display text-2xl text-ink">Детайли по поръчката</h2>
      <dl className="mt-5 divide-y divide-line rounded-2xl border border-line bg-soft/45 px-4">
        <SummaryValue icon={CreditCard} label="Обща сума" value={formatOrderMoney(order.amountTotal, order.currency)} />
        <SummaryValue icon={CalendarDays} label="Срок" value={order.deliveryDueAt ? formatOrderDate(order.deliveryDueAt) : 'По уговорка'} />
        <SummaryValue icon={ShieldCheck} label="Плащане" value={PAYMENT_METHOD_LABELS[order.paymentMethod] || 'По договорените условия'} />
      </dl>

      <div className="mt-4 grid gap-3">
        <PartyCard label="Клиент" party={order.clientAccount} fallbackId={order.clientId} profilePath={clientProfilePath} />
        <PartyCard label="Партньор" party={order.partnerAccount} fallbackId={order.partnerId} profilePath={partnerProfilePath} />
      </div>

      {order.conversationId && <Link to={`/inbox/${order.conversationId}`} className="btn btn-ghost mt-4 min-h-11 w-full justify-center"><MessageSquare size={18} aria-hidden="true" /> Отвори чата</Link>}
      <div className="mt-4 flex items-start gap-2 border-t border-line pt-4 text-xs leading-5 text-muted"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-accentDeep" aria-hidden="true" /> Плащанията и промените по статуса се записват към поръчката.</div>
    </section>
  )
}

function SummaryValue({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-4">
      <Icon size={17} className="mt-0.5 shrink-0 text-accentDeep" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</dt>
        <dd className="mt-1 break-words text-sm font-medium leading-5 text-ink">{value}</dd>
      </div>
    </div>
  )
}

function PartyCard({ label, party, fallbackId, profilePath = '' }) {
  const displayName = party?.name || 'Профил без име'
  const cardClassName = 'group block rounded-2xl border border-line bg-soft/45 p-4 transition hover:border-accentDeep/45 hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentDeep focus-visible:ring-offset-2'
  const content = (
    <>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted"><UserRound size={15} className="text-accentDeep" aria-hidden="true" />{label}</div>
      <div className="mt-2 break-words text-sm font-medium text-ink">{displayName}</div>
      <div className="mt-1 break-all text-xs text-muted">ID: {shortId(fallbackId)}</div>
      {profilePath && <div className="mt-3 text-xs font-semibold text-accentDeep transition group-hover:underline">Отвори профила <span aria-hidden="true">→</span></div>}
    </>
  )

  return profilePath
    ? <Link to={profilePath} className={cardClassName} aria-label={`Отвори профила на ${displayName}`}>{content}</Link>
    : <div className={cardClassName}>{content}</div>
}

function AgreedOfferDisclosure({ offer }) {
  return (
    <details className="group overflow-hidden rounded-3xl border border-line bg-paper">
      <summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 px-5 py-4 outline-none transition hover:bg-soft/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accentDeep md:px-6">
        <FileCheck2 size={20} className="shrink-0 text-accentDeep" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Договорена оферта</div>
          <div className="mt-1 flex min-w-0 flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span className="break-words font-medium text-ink">{offer.title}</span>
            <span className="shrink-0 text-muted">{OFFER_TYPE_LABELS[offer.offerType] || 'Оферта'} · {formatOrderMoney(offer.priceAmount, offer.currency)}</span>
          </div>
        </div>
        <ChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-line bg-soft/35 p-3 sm:p-5">
        <OfferDocumentView offer={offer} showStatus={false} defaultConditionsOpen={false} />
      </div>
    </details>
  )
}

function DeliverablesDisclosure({ items }) {
  return (
    <details className="group overflow-hidden rounded-3xl border border-line bg-paper">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-5 py-4 outline-none transition hover:bg-soft/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accentDeep md:px-6">
        <FileCheck2 size={20} className="shrink-0 text-accentDeep" aria-hidden="true" />
        <div className="min-w-0 flex-1"><div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Договорено</div><div className="mt-1 text-sm text-ink">{items.length} договорени позиции</div></div>
        <ChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="space-y-3 border-t border-line px-5 py-5 text-sm text-ink/80 md:px-6">
        {items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accentDeep" aria-hidden="true" /><span className="break-words">{item}</span></li>)}
      </ul>
    </details>
  )
}

function OrderLocationDisclosure({ location }) {
  const access = location?.access || {}
  const exact = location?.exact || {}
  const objectTypeLabel = PROPERTY_TYPES.find((item) => item.value === location.objectType)?.label || ''
  const roughLocation = [location.city, location.district].filter(Boolean).join(', ')
  const accessSummary = getLocationAccessSummary(access, { includeExact: location.canViewExact })
  const mapsUrl = location.canViewExact ? getSafeGoogleMapsUrl(exact) : ''
  const exactLabels = orderExactLocationLabels(location.objectType)
  const exactRows = [
    { label: 'Точен адрес', value: exact.exactAddress },
    ...(exactLabels.showEntrance ? [{ label: exactLabels.entrance, value: exact.entrance }] : []),
    ...(exactLabels.showFloor ? [{ label: exactLabels.floor, value: exact.floor }] : []),
    ...(exactLabels.showUnit ? [{ label: exactLabels.unit, value: exact.unitNumber }] : []),
    { label: 'Телефон за оглед', value: exact.visitPhone },
    { label: 'Инструкции', value: exact.accessInstructions, wide: true },
  ].filter((item) => String(item.value || '').trim())

  return (
    <details className="group overflow-hidden rounded-3xl border border-line bg-paper">
      <summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 px-5 py-4 outline-none transition hover:bg-soft/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accentDeep md:px-6">
        <MapPin size={20} className="shrink-0 text-accentDeep" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Обект и достъп</div>
          <div className="mt-1 break-words text-sm text-ink">{roughLocation || 'Не е посочена локация'}{objectTypeLabel ? ` · ${objectTypeLabel}` : ''}</div>
        </div>
        <ChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-line px-5 py-5 md:px-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <LocationMini label="Локация" value={roughLocation || 'Не е посочена'} />
          <LocationMini label="Тип обект" value={objectTypeLabel || 'Не е посочен'} />
          <LocationMini label="Достъп" value={accessSummary || 'Няма допълнителни детайли'} className="sm:col-span-2" />
        </dl>

        {location.canViewExact ? (
          <div className="mt-5 rounded-2xl border border-line bg-soft/45 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-accentDeep"><ShieldCheck size={15} aria-hidden="true" />Точна локация</div>
            <p className="mt-2 text-xs leading-5 text-muted">Тази информация е споделена само с партньора по поръчката.</p>
            {exactRows.length > 0 ? (
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                {exactRows.map((item) => <LocationMini key={item.label} label={item.label} value={item.value} className={item.wide ? 'sm:col-span-2' : ''} />)}
              </dl>
            ) : <div className="mt-4 rounded-2xl border border-dashed border-line p-4 text-sm text-muted">Клиентът още не е добавил точен адрес.</div>}
            {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-4 w-full justify-center sm:w-auto"><MapPin size={16} aria-hidden="true" />Отвори Google Maps</a>}
          </div>
        ) : <div className="mt-5 rounded-2xl border border-line bg-soft/45 p-4 text-sm leading-6 text-muted">Точният адрес ще бъде видим след потвърдена поръчка или разрешен оглед.</div>}
      </div>
    </details>
  )
}

function RecordDisclosure({ title, icon: Icon, records, emptyText, renderPreview, renderRow }) {
  const [latest, ...older] = records

  if (!latest) {
    return (
      <section className="rounded-3xl border border-dashed border-line bg-paper p-5 md:p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted"><Icon size={17} className="text-accentDeep" aria-hidden="true" />{title}</div>
        <p className="mt-3 text-sm text-muted">{emptyText}</p>
      </section>
    )
  }

  return (
    <details className="group overflow-hidden rounded-3xl border border-line bg-paper">
      <summary className="cursor-pointer list-none px-5 py-4 outline-none transition hover:bg-soft/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accentDeep md:px-6">
        <div className="flex items-center gap-3">
          <Icon size={18} className="shrink-0 text-accentDeep" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted">{title}</div>
          <span className="rounded-full bg-soft px-2.5 py-1 text-xs text-muted">{records.length}</span>
          <ChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
        </div>
        <div className="mt-3">{renderPreview(latest)}</div>
      </summary>
      <div className="space-y-3 border-t border-line px-5 py-5 md:px-6">
        {older.length > 0 ? older.map(renderRow) : <p className="text-sm text-muted">Няма по-стари записи.</p>}
      </div>
    </details>
  )
}

function EventPreview({ event }) {
  return <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"><span className="break-words font-medium text-ink">{orderEventMessage(event)}</span><span className="shrink-0 text-xs text-muted">{formatOrderDate(event.createdAt)}</span></div>
}

function PaymentPreview({ payment }) {
  return <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"><span className="font-medium text-ink">{paymentTypeLabel(payment.type)} · {paymentStatusLabel(payment.status)}</span><span className="shrink-0 font-medium text-ink">{formatOrderMoney(payment.amount, payment.currency)}</span></div>
}

function EventRow({ event }) {
  const count = Number(event.repeatCount || 1)
  const fromLabel = event.fromStatus ? (ORDER_STATUS_LABELS[event.fromStatus] || event.fromStatus) : '—'
  const toLabel = event.toStatus ? (ORDER_STATUS_LABELS[event.toStatus] || event.toStatus) : '—'
  return (
    <div className="rounded-2xl border border-line bg-soft/45 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="break-words text-sm font-medium text-ink">{orderEventMessage(event)}{count > 1 && <span className="ml-2 rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-normal text-muted">x{count}</span>}</div>
        <div className="shrink-0 text-xs text-muted">{formatOrderDate(event.createdAt)}</div>
      </div>
      {(event.fromStatus || event.toStatus) && <div className="mt-1 text-xs text-muted">{fromLabel} → {toLabel}</div>}
    </div>
  )
}

function PaymentRow({ payment }) {
  const count = Number(payment.repeatCount || 1)
  return (
    <div className="rounded-2xl border border-line bg-soft/45 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="text-sm font-medium text-ink">{paymentTypeLabel(payment.type)}{count > 1 && <span className="ml-2 rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-normal text-muted">x{count}</span>}</div><div className="mt-1 text-xs text-muted">{formatOrderDate(payment.createdAt)}</div></div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end"><span className="text-sm font-medium text-ink">{formatOrderMoney(payment.amount, payment.currency)}</span><span className={`rounded-full px-2 py-0.5 text-[11px] ${paymentStatusTone(payment.status)}`}>{paymentStatusLabel(payment.status)}</span></div>
      </div>
    </div>
  )
}

function MetaValue({ label, value, wide = false }) {
  return <div className={wide ? 'sm:col-span-2' : ''}><dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</dt><dd className="mt-1 break-words leading-5 text-ink">{value}</dd></div>
}

function LocationMini({ label, value, className = '' }) {
  return <div className={className}><dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</dt><dd className="mt-1 break-words text-sm font-medium leading-5 text-ink">{value}</dd></div>
}

function OrderShell({ children }) {
  return <section className="section min-h-[calc(100vh-var(--header-h,0px))] bg-soft !pt-6 md:!pt-8"><div className="container-page">{children}</div></section>
}

function Panel({ title, children }) {
  return <div className="rounded-3xl border border-line bg-paper p-6 md:p-8"><h1 className="font-display text-3xl text-ink">{title}</h1>{children}</div>
}

function shortId(value = '') {
  return value ? value.slice(0, 8) : '—'
}

function conciseOrderSummary(value = '') {
  return String(value).split(/\n\s*\n/u).map((part) => part.trim()).find(Boolean) || ''
}

function milestoneStatusTone(status) {
  if (status === 'accepted') return 'bg-green-100 text-green-800'
  if (['ready', 'payment_pending', 'submitted'].includes(status)) return 'bg-amber-100 text-amber-800'
  if (['paid', 'in_progress', 'revision_requested'].includes(status)) return 'bg-blue-100 text-blue-800'
  if (['disputed', 'cancelled'].includes(status)) return 'bg-red-100 text-red-700'
  return 'bg-paper text-muted'
}

function orderExactLocationLabels(propertyType) {
  if (propertyType === 'house') return { entrance: 'Двор / портал', unit: 'Номер / ориентир', showFloor: false, showEntrance: true, showUnit: true }
  if (propertyType === 'office' || propertyType === 'commercial') return { entrance: 'Вход / рецепция / охрана', floor: 'Етаж', unit: 'Офис / обект №', showFloor: true, showEntrance: true, showUnit: true }
  return { entrance: 'Вход', floor: 'Етаж', unit: 'Апартамент', showFloor: true, showEntrance: true, showUnit: true }
}

function paymentTypeLabel(value = '') {
  return { charge: 'Плащане', payout: 'Превод към партньора', refund: 'Възстановяване' }[value] || 'Платежен документ или потвърждение'
}

function paymentStatusLabel(value = '') {
  return { pending: 'Обработва се', succeeded: 'Успешно', failed: 'Неуспешно', manual: 'Ръчно', cancelled: 'Отказано' }[value] || value || 'Непознато'
}

function paymentStatusTone(value = '') {
  if (value === 'succeeded') return 'bg-green-100 text-green-800'
  if (value === 'pending') return 'bg-amber-100 text-amber-800'
  if (value === 'failed') return 'bg-red-100 text-red-700'
  if (value === 'manual') return 'bg-blue-100 text-blue-700'
  return 'bg-soft text-muted'
}

function orderEventMessage(event) {
  const messages = {
    order_created: 'Поръчката е създадена',
    checkout_refreshed: 'Стар платежен запис е обновен',
    payment_succeeded: 'Добавено е потвърждение за плащане',
    payment_succeeded_webhook: 'Добавено е автоматично потвърждение',
    payment_intent_succeeded_webhook: 'Добавено е автоматично потвърждение',
    admin_status_update: 'Админ промени статуса',
    start_work: 'Работата е започната',
    mark_delivered: 'Поръчката е маркирана като предадена',
    confirm_completed: 'Поръчката е потвърдена като завършена',
    request_revision: 'Поискана е корекция',
    cancel_pending: 'Неплатената поръчка е отменена',
  }
  return event.message || messages[event.type] || event.type || 'Събитие'
}

function dedupePayments(payments = []) {
  const grouped = new Map()
  payments.forEach((payment) => {
    const key = [payment.type || '', payment.provider || '', payment.status || '', payment.amount || 0, payment.currency || '', paymentExternalId(payment)].join('|')
    const existing = grouped.get(key)
    if (!existing) return grouped.set(key, { ...payment, repeatCount: 1 })
    const newer = new Date(payment.createdAt || 0).getTime() > new Date(existing.createdAt || 0).getTime()
    grouped.set(key, { ...(newer ? payment : existing), repeatCount: Number(existing.repeatCount || 1) + 1 })
  })
  return [...grouped.values()].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
}

function paymentExternalId(payment = {}) {
  const raw = payment.raw || {}
  const paymentIntentId = typeof raw.payment_intent === 'string' ? raw.payment_intent : raw.payment_intent?.id
  return String(paymentIntentId || raw.checkout_session_id || raw.id || '')
}

function dedupeEvents(events = []) {
  const grouped = new Map()
  events.forEach((event) => {
    const normalizedType = normalizeOrderEventType(event.type)
    const key = normalizedType === 'payment_succeeded'
      ? [normalizedType, event.fromStatus || '', event.toStatus || '', paymentEventId(event)].join('|')
      : [normalizedType, event.message || '', event.fromStatus || '', event.toStatus || '', event.payload ? JSON.stringify(event.payload) : ''].join('|')
    const existing = grouped.get(key)
    if (!existing) return grouped.set(key, { ...event, repeatCount: 1 })
    const newer = new Date(event.createdAt || 0).getTime() > new Date(existing.createdAt || 0).getTime()
    grouped.set(key, { ...(newer ? event : existing), repeatCount: Number(existing.repeatCount || 1) + 1 })
  })
  return [...grouped.values()].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
}

function normalizeOrderEventType(type = '') {
  return ['payment_succeeded', 'payment_succeeded_webhook', 'payment_intent_succeeded_webhook'].includes(type) ? 'payment_succeeded' : type || ''
}

function paymentEventId(event = {}) {
  const payload = event.payload || {}
  return String(payload.payment_intent || payload.paymentIntentId || payload.payment_intent_id || payload.checkout_session_id || payload.checkoutSessionId || payload.id || '')
}
