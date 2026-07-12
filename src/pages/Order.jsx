import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, CreditCard, MapPin, MessageSquare, ShieldCheck } from 'lucide-react'
import { useAccount } from '../lib/account.js'
import { ORDER_ACTION_LABELS, ORDER_STATUS_LABELS, formatOrderDate, formatOrderMoney, loadOrderDetails, orderStatusTone } from '../lib/orders.js'
import { normalizeAcceptedOffer, OFFER_TYPE_LABELS, PRICE_TYPE_LABELS, MATERIAL_MODE_LABELS, VAT_LABELS, PAYMENT_METHOD_LABELS, MILESTONE_STATUS_LABELS } from '../lib/offers.js'
import { PROPERTY_TYPES, getLocationAccessSummary, getSafeGoogleMapsUrl } from '../lib/projects.js'
import { runMilestoneAction, runOrderAction } from '../lib/payments.js'
import { loadOrderReview } from '../lib/reviews.js'
import ReviewForm from '../components/reviews/ReviewForm.jsx'
import OfferDocumentView from '../components/offers/OfferDocumentView.jsx'
import { supabase } from '../lib/supabase.js'
import { formatEurWithBgn } from '../lib/money.js'

export default function Order() {
  const { orderId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const { session, loading, isAdmin } = useAccount()
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
  const isAdminView = Boolean(isAdmin)
  const role = order?.clientId === userId ? 'client' : order?.partnerId === userId ? 'partner' : 'guest'
  const checkoutPath = useMemo(() => checkoutPathForOrder(order), [order])
  const actions = useMemo(() => buildActions(order, role, checkoutPath), [order, role, checkoutPath])
  const visibleEvents = useMemo(() => dedupeEvents(details.events), [details.events])
  const visiblePayments = useMemo(() => dedupePayments(details.payments), [details.payments])
  const projectLocation = details.projectLocation

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
      <Link to="/porachki" className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-ink"><ArrowLeft size={17} /> Моите поръчки</Link>
      {searchParams.get('payment') === 'cancelled' && <div role="status" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Плащането е прекъснато и не е начислена сума. Можеш да опиташ отново, когато си готов.</div>}

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <section className="lg:col-span-8 rounded-3xl border border-line bg-paper p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="eyebrow">Поръчка</div>
              <h1 className="mt-2 break-words font-display text-4xl leading-[1.05] text-ink md:text-[2.8rem]">{order.title}</h1>
              {order.description && <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-muted md:text-base">{order.description}</p>}
            </div>
            <span className={`rounded-full px-3 py-1 text-sm ${orderStatusTone(order.status)}`}>{ORDER_STATUS_LABELS[order.status] || order.status}</span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Info icon={CreditCard} label="Сума" value={formatOrderMoney(order.amountTotal, order.currency)} />
            <Info icon={Clock} label="Срок" value={order.deliveryDueAt ? formatOrderDate(order.deliveryDueAt) : 'По уговорка'} />
            <Info icon={ShieldCheck} label="Плащане" value={PAYMENT_METHOD_LABELS[order.paymentMethod] || 'По договорка'} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PartyCard label="Клиент" party={order.clientAccount} fallbackId={order.clientId} showEmail={isAdminView} />
            <PartyCard label="Партньор" party={order.partnerAccount} fallbackId={order.partnerId} showEmail={isAdminView} />
          </div>

          <div className="mt-4 lg:hidden">
            <OrderActionPanel order={order} role={role} checkoutPath={checkoutPath} actions={actions} revisionNote={revisionNote} setRevisionNote={setRevisionNote} status={status} message={message} onRun={run} compact />
          </div>

          {projectLocation && <OrderLocationCard location={projectLocation} />}

          {order.deliverables.length > 0 && !agreedOffer && (
            <div className="mt-7">
              <div className="eyebrow">Договорено</div>
              <ul className="mt-3 grid gap-2 text-sm text-ink/80">
                {order.deliverables.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accentDeep" /> <span>{item}</span></li>)}
              </ul>
            </div>
          )}

          {agreedOffer && <div className="mt-8 border-t border-line pt-6"><div className="eyebrow mb-4">Договорена оферта</div><OfferDocumentView offer={agreedOffer} showStatus={false} /></div>}

          {details.milestones.length > 0 && <MilestoneTimeline milestones={details.milestones} role={role} busy={status === 'saving'} onAction={runMilestone} />}

          {agreedOffer && false && (() => {
            const norm = agreedOffer
            return (
              <div className="mt-8 border-t border-line pt-6 space-y-6">
                <div>
                  <div className="eyebrow">Договорена оферта</div>
                  {norm.summary && (
                    <p className="mt-3 text-sm whitespace-pre-wrap leading-relaxed text-ink/80">{norm.summary}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {norm.offerType && (
                    <span className="rounded-full px-3 py-1.5 border border-line bg-paper text-muted">
                      {OFFER_TYPE_LABELS[norm.offerType] || norm.offerType}
                    </span>
                  )}
                  {norm.priceType && (
                    <span className="rounded-full px-3 py-1.5 border border-line bg-paper text-muted">
                      {PRICE_TYPE_LABELS[norm.priceType] || norm.priceType}
                    </span>
                  )}
                  {norm.materialsMode && (
                    <span className="rounded-full px-3 py-1.5 border border-line bg-paper text-muted">
                      {MATERIAL_MODE_LABELS[norm.materialsMode] || norm.materialsMode}
                    </span>
                  )}
                  {norm.vatStatus && (
                    <span className="rounded-full px-3 py-1.5 border border-line bg-paper text-muted">
                      {VAT_LABELS[norm.vatStatus] || norm.vatStatus}
                    </span>
                  )}
                </div>

                {(Number(norm.priceBreakdown?.labor) > 0 || Number(norm.priceBreakdown?.materials) > 0 || Number(norm.priceBreakdown?.transport) > 0) && (
                  <div className="rounded-2xl border border-line bg-soft/30 p-4 space-y-3">
                    <span className="font-bold text-xs uppercase tracking-wider block text-muted">Ценово разпределение</span>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                      {Number(norm.priceBreakdown.labor) > 0 && (
                        <div className="rounded-xl border border-line bg-paper px-3 py-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">Труд</span>
                          <span className="text-ink font-semibold">{formatEurWithBgn(norm.priceBreakdown.labor)}</span>
                        </div>
                      )}
                      {Number(norm.priceBreakdown.materials) > 0 && (
                        <div className="rounded-xl border border-line bg-paper px-3 py-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">Материали</span>
                          <span className="text-ink font-semibold">{formatEurWithBgn(norm.priceBreakdown.materials)}</span>
                        </div>
                      )}
                      {Number(norm.priceBreakdown.transport) > 0 && (
                        <div className="rounded-xl border border-line bg-paper px-3 py-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">Транспорт</span>
                          <span className="text-ink font-semibold">{formatEurWithBgn(norm.priceBreakdown.transport)}</span>
                        </div>
                      )}
                      <div className="rounded-xl border border-line bg-paper px-3 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">Общо</span>
                        <span className="text-ink font-semibold">{formatEurWithBgn(norm.priceAmount)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {(norm.timeline.days > 0 || norm.validUntil || norm.timeline.earliestStartDate || norm.timeline.dependencies) && (
                  <div className="grid gap-3 sm:grid-cols-3 text-xs bg-soft rounded-2xl p-4">
                    {norm.timeline.days > 0 && (
                      <div>
                        <span className="font-semibold text-muted block">Работни дни:</span>
                        <span className="text-ink font-medium">{norm.timeline.days}</span>
                      </div>
                    )}
                    {norm.validUntil && (
                      <div>
                        <span className="font-semibold text-muted block">Валидна до:</span>
                        <span className="text-ink font-medium">{formatDate(norm.validUntil)}</span>
                      </div>
                    )}
                    {norm.timeline.earliestStartDate && (
                      <div>
                        <span className="font-semibold text-muted block">Най-ранен старт:</span>
                        <span className="text-ink font-medium">{formatDate(norm.timeline.earliestStartDate)}</span>
                      </div>
                    )}
                    {norm.timeline.dependencies && (
                      <div className="sm:col-span-3">
                        <span className="font-semibold text-muted block">Зависимости:</span>
                        <span className="text-ink block whitespace-pre-wrap">{norm.timeline.dependencies}</span>
                      </div>
                    )}
                  </div>
                )}

                {(norm.includedItems.length > 0 || norm.excludedItems.length > 0 || norm.clientRequirements.length > 0) && (
                  <div className="grid gap-4 md:grid-cols-3 text-sm">
                    {norm.includedItems.length > 0 && (
                      <div className="rounded-2xl border border-line bg-soft/30 p-4 space-y-2">
                        <span className="font-bold text-xs uppercase tracking-wider block text-muted">Какво включва</span>
                        <ul className="space-y-1.5 text-ink/80 text-xs">
                          {norm.includedItems.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-accentDeep mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {norm.excludedItems.length > 0 && (
                      <div className="rounded-2xl border border-line bg-soft/30 p-4 space-y-2">
                        <span className="font-bold text-xs uppercase tracking-wider block text-muted">Не е включено</span>
                        <ul className="space-y-1.5 text-ink/80 text-xs">
                          {norm.excludedItems.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-red-500 mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {norm.clientRequirements.length > 0 && (
                      <div className="rounded-2xl border border-line bg-soft/30 p-4 space-y-2">
                        <span className="font-bold text-xs uppercase tracking-wider block text-muted">Клиентът осигурява</span>
                        <ul className="space-y-1.5 text-ink/80 text-xs">
                          {norm.clientRequirements.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-blue-500 mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {norm.stages.length > 0 && (
                  <div className="space-y-3">
                    <span className="eyebrow block">Етапи на изпълнение</span>
                    <div className="space-y-3">
                      {norm.stages.map((stage) => (
                        <div key={stage.order} className="border border-line rounded-2xl p-4 bg-paper shadow-sm space-y-2">
                          <div className="flex justify-between items-center gap-4">
                            <span className="font-bold text-ink text-sm">{stage.order}. {stage.title || `Етап ${stage.order}`}</span>
                            {stage.priceAmount > 0 && (
                              <span className="font-bold text-ink text-sm bg-soft px-2.5 py-1 rounded-full">
                                {formatEurWithBgn(stage.priceAmount)}
                              </span>
                            )}
                          </div>
                          {stage.description && (
                            <p className="text-muted text-xs leading-relaxed whitespace-pre-wrap">{stage.description}</p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted border-t border-line/40 pt-2 mt-1">
                            {stage.durationDays > 0 && <span>Срок: {stage.durationDays} работни дни</span>}
                            {stage.startCondition && <span>Старт условие: {stage.startCondition}</span>}
                            {stage.payment && <span>Плащане: {stage.payment}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(norm.payment.method || norm.payment.terms || norm.payment.notes || norm.conditions.cancellation || norm.conditions.scopeChanges || norm.conditions.unforeseenWork) && (
                  <div className="border border-line rounded-2xl p-4 bg-soft/20 text-xs space-y-3">
                    <span className="font-bold uppercase tracking-wider block text-muted">Плащане и Условия</span>

                    {norm.payment.method && (
                      <div>
                        <span className="font-semibold text-muted block">Метод:</span>
                        <span className="text-ink block">{PAYMENT_METHOD_LABELS[norm.payment.method] || norm.payment.method}</span>
                      </div>
                    )}

                    {norm.payment.terms && (
                      <div>
                        <span className="font-semibold text-muted block">Условия за плащане:</span>
                        <span className="text-ink block whitespace-pre-wrap">{norm.payment.terms}</span>
                      </div>
                    )}

                    {norm.payment.notes && (
                      <div className="mt-2">
                        <span className="font-semibold text-muted block">Бележка към плащането:</span>
                        <span className="text-ink block whitespace-pre-wrap">{norm.payment.notes}</span>
                      </div>
                    )}

                    {norm.conditions.cancellation && (
                      <div className="mt-2">
                        <span className="font-semibold text-muted block">Отказ / анулиране:</span>
                        <span className="text-ink block whitespace-pre-wrap">{norm.conditions.cancellation}</span>
                      </div>
                    )}

                    {norm.conditions.scopeChanges && (
                      <div className="mt-2">
                        <span className="font-semibold text-muted block">Промени в обхвата:</span>
                        <span className="text-ink block whitespace-pre-wrap">{norm.conditions.scopeChanges}</span>
                      </div>
                    )}

                    {norm.conditions.unforeseenWork && (
                      <div className="mt-2">
                        <span className="font-semibold text-muted block">Непредвидена работа:</span>
                        <span className="text-ink block whitespace-pre-wrap">{norm.conditions.unforeseenWork}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          <div className="mt-8 border-t border-line pt-6">
            <div className="eyebrow">История на поръчката</div>
            <div className="mt-4 space-y-3">
              {visibleEvents.map((event) => <EventRow key={event.id} event={event} />)}
              {visibleEvents.length === 0 && <div className="rounded-2xl border border-dashed border-line p-5 text-center text-sm text-muted">Още няма събития.</div>}
            </div>
          </div>

          <ReviewForm order={order} review={review} role={role} onChange={setReview} />
        </section>

        <aside className="lg:col-span-4">
          <div className="space-y-5 lg:sticky lg:top-24">
            <div className="hidden lg:block">
              <OrderActionPanel order={order} role={role} checkoutPath={checkoutPath} actions={actions} revisionNote={revisionNote} setRevisionNote={setRevisionNote} status={status} message={message} onRun={run} />
            </div>

            {visiblePayments.length > 0 && <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
              <div className="eyebrow">Плащания и потвърждения</div>
              <div className="mt-4 space-y-3">
                {visiblePayments.map((payment) => <PaymentRow key={payment.id} payment={payment} />)}
              </div>
            </div>}
          </div>
        </aside>
      </div>
    </OrderShell>
  )
}

function OrderActionPanel({ order, role, checkoutPath, actions, revisionNote, setRevisionNote, status, message, onRun, compact = false }) {
  const nextStep = orderNextStep(order, role, checkoutPath)
  const saving = status === 'saving'
  return (
    <section className={`rounded-3xl border border-line bg-paper ${compact ? 'p-4 shadow-[0_20px_55px_-46px_rgba(13,35,64,0.7)]' : 'p-5 md:p-6'}`} aria-label="Следваща стъпка">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Следваща стъпка</div>
          {!compact && <div className="mt-3 font-display text-4xl leading-none text-ink">{formatOrderMoney(order.amountTotal, order.currency)}</div>}
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${orderStatusTone(order.status)}`}>{ORDER_STATUS_LABELS[order.status] || order.status}</span>
      </div>
      <p className={`${compact ? 'mt-3' : 'mt-4'} text-sm leading-6 text-muted`}>{nextStep}</p>
      {message && <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</div>}

      {actions.includes('request_revision') && (
        <div className="mt-4">
          <label htmlFor={compact ? 'revision-note-mobile' : 'revision-note-desktop'} className="text-sm font-medium text-ink">Какво трябва да се коригира</label>
          <textarea id={compact ? 'revision-note-mobile' : 'revision-note-desktop'} rows={3} value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} className="mt-2 w-full rounded-2xl border border-line bg-soft px-4 py-3 text-sm outline-none transition focus:border-ink focus:ring-4 focus:ring-accent/10" />
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {role === 'client' && order.status === 'pending_payment' && checkoutPath && (
          <Link to={checkoutPath} className="btn btn-primary min-h-11 w-full justify-center"><CreditCard size={18} /> Към плащане</Link>
        )}
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onRun(action)}
            disabled={saving}
            className={`${['confirm_direct_payment', 'confirm_completed', 'mark_delivered', 'start_work'].includes(action) ? 'btn btn-primary' : 'btn btn-ghost'} min-h-11 justify-center disabled:opacity-55`}
          >
            {saving ? 'Запазваме…' : ORDER_ACTION_LABELS[action] || action}
          </button>
        ))}
        {order.conversationId && <Link to={`/inbox/${order.conversationId}`} className="btn btn-ghost min-h-11 w-full justify-center"><MessageSquare size={18} /> Отвори чата</Link>}
      </div>

      <div className="mt-4 flex items-start gap-2 border-t border-line pt-4 text-xs leading-5 text-muted"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-accentDeep" /> Плащанията и промените по статуса се записват към поръчката.</div>
    </section>
  )
}

function orderNextStep(order, role, checkoutPath) {
  if (!order) return ''
  if (order.status === 'pending_payment' && role === 'client' && checkoutPath) return 'Прегледай договореното и завърши защитеното плащане.'
  if (order.status === 'pending_payment' && role === 'client' && order.paymentMethod === 'staged_platform') return 'Плати първия готов етап от секцията „Изпълнение и плащане“.'
  if (order.status === 'pending_payment' && role === 'client') return 'Изчакай партньорът да потвърди договореното плащане или използвай чата при въпрос.'
  if (order.status === 'pending_payment' && role === 'partner' && order.paymentMethod === 'staged_platform') return 'Клиентът ще плати първия етап. След потвърждението можеш да започнеш работа.'
  if (order.status === 'pending_payment' && role === 'partner') return 'Потвърди плащането едва след като реално го получиш.'
  if (order.status === 'paid' && role === 'partner') return 'Плащането е потвърдено. Започни работата, когато си готов.'
  if (order.status === 'in_progress' && role === 'partner') return 'Работата е в ход. Маркирай я като предадена, когато резултатът е готов.'
  if (order.status === 'delivered' && role === 'client') return 'Прегледай предаденото и го приеми или поискай конкретна корекция.'
  if (order.status === 'completed') return 'Поръчката е завършена. Всички договорени детайли остават достъпни тук.'
  return 'Следи статуса тук и използвай чата, ако трябва да уточните следващото действие.'
}

function checkoutPathForOrder(order) {
  if (!order) return ''
  if (['staged_platform', 'custom'].includes(order.paymentMethod)) return ''
  if (order.offerId) return `/checkout/offer/${order.offerId}`
  if (order.servicePackageId) return `/checkout/service/${order.servicePackageId}`
  return ''
}

function buildActions(order, role, checkoutPath = '') {
  if (!order || role === 'guest') return []
  if (order.paymentMethod === 'staged_platform') return []
  const actions = []
  if (role === 'partner' && order.status === 'pending_payment' && !checkoutPath) actions.push('confirm_direct_payment')
  if (role === 'partner' && order.status === 'paid') actions.push('start_work')
  if (role === 'partner' && order.status === 'in_progress') actions.push('mark_delivered')
  if (role === 'client' && order.status === 'delivered') actions.push('confirm_completed', 'request_revision')
  if (role === 'client' && order.status === 'pending_payment') actions.push('cancel_pending')
  return actions
}

function MilestoneTimeline({ milestones, role, busy, onAction }) {
  const acceptedCount = milestones.filter((item) => item.status === 'accepted').length
  return (
    <section className="mt-8 border-t border-line pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="eyebrow">Етапи</div><h2 className="mt-1 font-display text-2xl text-ink">Изпълнение и плащане</h2></div>
        <div className="text-sm text-muted">{acceptedCount} от {milestones.length} приети</div>
      </div>
      <div className="mt-4 space-y-3">{milestones.map((milestone) => <MilestoneCard key={milestone.id} milestone={milestone} role={role} busy={busy} onAction={onAction} />)}</div>
    </section>
  )
}

function MilestoneCard({ milestone, role, busy, onAction }) {
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
      // The order-level error is already displayed in the actions panel.
    }
  }

  return (
    <article className="rounded-2xl border border-line bg-soft/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><div className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Етап {milestone.position}</div><h3 className="mt-1 break-words text-sm font-semibold text-ink">{milestone.title}</h3></div>
        <div className="text-right"><div className="font-semibold text-ink">{formatOrderMoney(milestone.amount, milestone.currency)}</div><span className="mt-1 inline-block rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] text-muted">{MILESTONE_STATUS_LABELS[milestone.status] || milestone.status}</span></div>
      </div>
      {milestone.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{milestone.description}</p>}
      {(canSubmit || canReview) && <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} className="mt-3 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none focus:border-ink" placeholder={canReview ? 'Бележка при корекция или спор' : 'Бележка към предаването (по избор)'} />}
      {localError && <p className="mt-2 text-xs text-red-700">{localError}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {canPay && <Link to={`/checkout/milestone/${milestone.id}`} className="btn btn-primary min-h-11 text-sm"><CreditCard size={16} /> Плати този етап</Link>}
        {canStart && <button type="button" disabled={busy} onClick={() => act('start')} className="btn btn-primary min-h-11 text-sm">Започни етапа</button>}
        {canSubmit && <button type="button" disabled={busy} onClick={() => act('submit')} className="btn btn-primary min-h-11 text-sm">Предай етапа</button>}
        {canReview && <button type="button" disabled={busy} onClick={() => act('accept')} className="btn btn-primary min-h-11 text-sm">Приеми етапа</button>}
        {canReview && <button type="button" disabled={busy} onClick={() => act('request_revision', true)} className="btn btn-ghost min-h-11 text-sm">Поискай корекция</button>}
        {canReview && <button type="button" disabled={busy} onClick={() => act('dispute', true)} className="btn btn-ghost min-h-11 text-sm text-red-700">Оспори</button>}
      </div>
    </article>
  )
}

function getPartyDisplayName(party, fallbackId) {
  if (!party) return shortId(fallbackId)
  const name = party.name || party.display_name || party.displayName || party.company_name || party.companyName || party.full_name || party.fullName || party.email
  return name || shortId(fallbackId)
}

function shortId(value = '') {
  return value ? value.slice(0, 8) : '—'
}

function OrderShell({ children }) {
  return <section className="section !pt-6 md:!pt-8 bg-soft min-h-[calc(100vh-var(--header-h,0px))]"><div className="container-page">{children}</div></section>
}

function Panel({ title, children }) {
  return <div className="rounded-3xl border border-line bg-paper p-6 md:p-8"><h1 className="font-display text-3xl text-ink">{title}</h1>{children}</div>
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-soft p-4">
      <div className="flex items-center gap-2">
        <Icon size={17} className="text-accentDeep" />
        <div className="text-xs uppercase tracking-[0.14em] text-muted leading-none">
          {label}
        </div>
      </div>

      <div className="mt-2 text-md font-medium text-ink">
        {value}
      </div>
    </div>
  )
}

function PartyCard({ label, party, fallbackId, showEmail = false }) {
  const hasName = Boolean(party?.name)
  const displayName = hasName ? party.name : `ID ${shortId(fallbackId)}`
  const email = party?.email || ''

  return (
    <div className="rounded-2xl border border-line bg-soft p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 text-md font-medium text-ink break-all">{displayName}</div>
      {showEmail && <div className="mt-1 text-xs text-muted break-all">{email || 'Без имейл'}</div>}
      {!showEmail && !hasName && <div className="mt-1 text-xs text-muted break-all">ID: {shortId(fallbackId)}</div>}
    </div>
  )
}

function orderExactLocationLabels(propertyType) {
  if (propertyType === 'house') {
    return {
      entrance: 'Двор / портал',
      unit: 'Номер / ориентир',
      showFloor: false,
      showEntrance: true,
      showUnit: true,
    }
  }

  if (propertyType === 'office' || propertyType === 'commercial') {
    return {
      entrance: 'Вход / рецепция / охрана',
      floor: 'Етаж',
      unit: 'Офис / обект №',
      showFloor: true,
      showEntrance: true,
      showUnit: true,
    }
  }

  return {
    entrance: 'Вход',
    floor: 'Етаж',
    unit: 'Апартамент',
    showFloor: true,
    showEntrance: true,
    showUnit: true,
  }
}

function OrderLocationCard({ location }) {
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
    <div className="mt-5 rounded-3xl border border-line bg-soft p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
        <MapPin size={16} className="text-accentDeep" />
        Локация и достъп до обекта
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <LocationMini label="Локация" value={roughLocation || 'Не е посочена'} />
        <LocationMini label="Тип обект" value={objectTypeLabel || 'Не е посочен'} />
        <LocationMini label="Достъп" value={accessSummary || 'Няма допълнителни детайли'} className="sm:col-span-2" />
      </div>

      {location.canViewExact ? (
        <div className="mt-5 rounded-2xl border border-line bg-paper p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-accentDeep">
            <ShieldCheck size={15} />
            Точна локация
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Тази информация е споделена само с партньора по поръчката.
          </p>
          {exactRows.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {exactRows.map((item) => (
                <LocationMini key={item.label} label={item.label} value={item.value} className={item.wide ? 'sm:col-span-2' : ''} />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-line p-4 text-sm text-muted">Клиентът още не е добавил точен адрес.</div>
          )}
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-4 w-full justify-center sm:w-auto">
              <MapPin size={16} />
              Отвори Google Maps
            </a>
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-line bg-paper p-4 text-sm leading-relaxed text-muted">
          Точният адрес ще бъде видим след потвърдена поръчка или разрешен оглед.
        </div>
      )}
    </div>
  )
}

function LocationMini({ label, value, className = '' }) {
  return (
    <div className={className}>
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-ink">{value}</div>
    </div>
  )
}

function EventRow({ event }) {
  const count = Number(event.repeatCount || 1)
  const fromLabel = event.fromStatus ? (ORDER_STATUS_LABELS[event.fromStatus] || event.fromStatus) : '—'
  const toLabel = event.toStatus ? (ORDER_STATUS_LABELS[event.toStatus] || event.toStatus) : '—'
  const message = orderEventMessage(event)

  return (
    <div className="rounded-2xl border border-line bg-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-ink">
          {message}
          {count > 1 && <span className="ml-2 rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-normal text-muted">x{count}</span>}
        </div>
        <div className="text-xs text-muted">{formatOrderDate(event.createdAt)}</div>
      </div>
      {(event.fromStatus || event.toStatus) && <div className="mt-1 text-xs text-muted">{fromLabel} → {toLabel}</div>}
    </div>
  )
}

function PaymentRow({ payment }) {
  const count = Number(payment.repeatCount || 1)
  const typeLabel = paymentTypeLabel(payment.type)
  const statusLabel = paymentStatusLabel(payment.status)
  const statusTone = paymentStatusTone(payment.status)

  return (
    <div className="rounded-2xl border border-line bg-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-ink">
            {typeLabel}
            {count > 1 && <span className="ml-2 rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-normal text-muted">x{count}</span>}
          </div>
          <div className="mt-1 text-xs text-muted">{formatOrderDate(payment.createdAt)}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right text-sm font-medium text-ink leading-tight">
          <span>{formatOrderMoney(payment.amount, payment.currency)}</span>
          <div className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-normal ${statusTone}`}>{statusLabel}</div>
        </div>
      </div>
    </div>
  )
}

function paymentTypeLabel(value = '') {
  const labels = {
    charge: 'Плащане',
    payout: 'Превод към партньора',
    refund: 'Възстановяване',
  }
  return labels[value] || 'Платежен документ или потвърждение'
}

function paymentStatusLabel(value = '') {
  const labels = {
    pending: 'Обработва се',
    succeeded: 'Успешно',
    failed: 'Неуспешно',
    manual: 'Ръчно',
    cancelled: 'Отказано',
  }
  return labels[value] || value || 'Непознато'
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
    const key = [
      payment.type || '',
      payment.provider || '',
      payment.status || '',
      payment.amount || 0,
      payment.currency || '',
      paymentExternalId(payment),
    ].join('|')

    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, { ...payment, repeatCount: 1 })
      return
    }

    const newer = new Date(payment.createdAt || 0).getTime() > new Date(existing.createdAt || 0).getTime()
    grouped.set(key, {
      ...(newer ? payment : existing),
      repeatCount: Number(existing.repeatCount || 1) + 1,
    })
  })

  return [...grouped.values()].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
}

function paymentExternalId(payment = {}) {
  const raw = payment.raw || {}
  const paymentIntentId = typeof raw.payment_intent === 'string' ? raw.payment_intent : raw.payment_intent?.id
  const checkoutSessionId = raw.checkout_session_id || raw.id || ''
  return String(paymentIntentId || checkoutSessionId || '')
}

function dedupeEvents(events = []) {
  const grouped = new Map()

  events.forEach((event) => {
    const normalizedType = normalizeOrderEventType(event.type)
    const key = normalizedType === 'payment_succeeded'
      ? [
        normalizedType,
        event.fromStatus || '',
        event.toStatus || '',
        paymentEventId(event),
      ].join('|')
      : [
        normalizedType,
        event.message || '',
        event.fromStatus || '',
        event.toStatus || '',
        event.payload ? JSON.stringify(event.payload) : '',
      ].join('|')

    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, { ...event, repeatCount: 1 })
      return
    }

    const newer = new Date(event.createdAt || 0).getTime() > new Date(existing.createdAt || 0).getTime()
    grouped.set(key, {
      ...(newer ? event : existing),
      repeatCount: Number(existing.repeatCount || 1) + 1,
    })
  })

  return [...grouped.values()].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
}

function normalizeOrderEventType(type = '') {
  if (['payment_succeeded', 'payment_succeeded_webhook', 'payment_intent_succeeded_webhook'].includes(type)) {
    return 'payment_succeeded'
  }
  return type || ''
}

function paymentEventId(event = {}) {
  const payload = event.payload || {}
  const paymentIntent = payload.payment_intent || payload.paymentIntentId || payload.payment_intent_id || ''
  const checkoutSession = payload.checkout_session_id || payload.checkoutSessionId || payload.id || ''
  return String(paymentIntent || checkoutSession || '')
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}
