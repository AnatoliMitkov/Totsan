import { useEffect, useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Printer, FileText, FileClock, MessageSquare, Tag, CreditCard, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAccount } from '../lib/account.js'
import { supabase } from '../lib/supabase.js'
import { loadConversation, loadMessages } from '../lib/chat.js'
import { formatEurWithBgn } from '../lib/money.js'
import { MATERIAL_MODE_LABELS, MILESTONE_STATUS_LABELS, OFFER_TYPE_LABELS, PRICE_TYPE_LABELS, VAT_LABELS, normalizeAcceptedOffer } from '../lib/offers.js'

export default function AdminEvidence() {
  const { session, account, loading: accountLoading } = useAccount()
  const { conversationId } = useParams()

  const [data, setData] = useState({
    conversation: null,
    messages: [],
    offers: [],
    order: null,
    payments: [],
    events: [],
    milestones: [],
    accounts: new Map(),
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [messagesError, setMessagesError] = useState('')
  const [fingerprint, setFingerprint] = useState('')

  const userEmail = String(session?.user?.email || '').trim().toLowerCase()
  const isAuthorizedAdmin = account?.role === 'admin'

  useEffect(() => {
    if (accountLoading || !session) return
    if (!isAuthorizedAdmin) {
      setLoading(false)
      return
    }

    let active = true
    async function loadAllEvidence() {
      setLoading(true)
      setError('')
      setMessagesError('')

      try {
        // 1. Load conversation (Required)
        let conversation = null
        try {
          conversation = await loadConversation(conversationId)
        } catch (convErr) {
          setError('Разговорът не беше намерен или липсва достъп.')
          setLoading(false)
          return
        }

        if (!active) return

        if (!conversation) {
          setError('Разговорът не беше намерен.')
          setLoading(false)
          return
        }

        // 2. Load other sections using individual try-catches (errors in optional queries shouldn't block metadata)
        let messages = []
        try {
          messages = await loadMessages(conversationId)
        } catch (msgErr) {
          setMessagesError(msgErr.message || 'Неуспешно зареждане на хронологията на съобщенията.')
        }

        let accountsData = []
        try {
          const participantIds = [conversation.client_id, conversation.partner_id].filter(Boolean)
          if (participantIds.length > 0) {
            const { data } = await supabase.from('accounts').select('id, email, full_name, display_name').in('id', participantIds)
            accountsData = data || []
          }
        } catch (accErr) {
          console.error('Failed to load accounts metadata', accErr)
        }

        const accountMap = new Map((accountsData || []).map((acc) => [acc.id, acc]))

        let offersData = []
        try {
          const { data } = await supabase
            .from('offers')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true })
          offersData = data || []
        } catch (offerErr) {
          console.error('Failed to load offers', offerErr)
        }

        let orderData = null
        try {
          const { data } = await supabase
            .from('orders')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          orderData = data || null
        } catch (ordErr) {
          console.error('Failed to load order', ordErr)
        }

        let paymentsData = []
        let eventsData = []
        let milestonesData = []
        if (orderData?.id) {
          try {
            const { data } = await supabase
              .from('payment_transactions')
              .select('*')
              .eq('order_id', orderData.id)
              .order('created_at', { ascending: true })
            paymentsData = data || []
          } catch (payErr) {
            console.error('Failed to load payment transactions', payErr)
          }

          try {
            const { data } = await supabase
              .from('order_events')
              .select('*')
              .eq('order_id', orderData.id)
              .order('created_at', { ascending: true })
            eventsData = data || []
          } catch (evtErr) {
            console.error('Failed to load order events', evtErr)
          }

          try {
            const { data } = await supabase.from('order_milestones').select('*').eq('order_id', orderData.id).order('position')
            milestonesData = data || []
          } catch (milestoneErr) {
            console.error('Failed to load order milestones', milestoneErr)
          }
        }

        if (!active) return

        setData({
          conversation,
          messages: messages || [],
          offers: offersData || [],
          order: orderData || null,
          payments: paymentsData || [],
          events: eventsData || [],
          milestones: milestonesData || [],
          accounts: accountMap,
        })
      } catch (err) {
        if (!active) return
        setError(err.message || 'Грешка при зареждане на данните за доказателства.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadAllEvidence()
    return () => {
      active = false
    }
  }, [conversationId, accountLoading, session, isAuthorizedAdmin])

  useEffect(() => {
    let active = true
    async function createFingerprint() {
      if (!data.conversation) return
      const payload = new TextEncoder().encode(stableStringify(evidenceExport(data)))
      const digest = await crypto.subtle.digest('SHA-256', payload)
      const value = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
      if (active) setFingerprint(value)
    }
    void createFingerprint()
    return () => { active = false }
  }, [data])

  // Build the chronological timeline
  const timeline = useMemo(() => {
    if (!data.conversation) return []

    const items = []

    // 1. Add Messages
    data.messages.forEach((msg) => {
      const sender = msg.sender_id === data.conversation.client_id ? 'Клиент' : 'Партньор'
      items.push({
        id: `msg-${msg.id}`,
        timestamp: new Date(msg.created_at).getTime(),
        type: 'message',
        label: `Съобщение (${msg.kind || 'text'}) от ${sender}`,
        detail: msg.body,
        timeString: formatTimestamp(msg.created_at),
      })
    })

    // 2. Add Offers Sent
    data.offers.forEach((offer) => {
      items.push({
        id: `offer-sent-${offer.id}`,
        timestamp: new Date(offer.created_at).getTime(),
        type: 'offer_sent',
        label: `Изпратена оферта: "${offer.title}"`,
        detail: `Сума: ${formatEurWithBgn(offer.price_amount)}`,
        timeString: formatTimestamp(offer.created_at),
      })

      if (offer.status !== 'sent') {
        const actionLabel = offer.status === 'accepted' ? 'Приета оферта' : 'Отхвърлена оферта'
        items.push({
          id: `offer-action-${offer.id}`,
          timestamp: new Date(offer.updated_at || offer.created_at).getTime(),
          type: 'offer_status',
          label: `${actionLabel}: "${offer.title}"`,
          detail: `Статус: ${offer.status}`,
          timeString: formatTimestamp(offer.updated_at || offer.created_at),
        })
      }
    })

    // 3. Add Order Events
    data.events.forEach((evt) => {
      items.push({
        id: `order-evt-${evt.id}`,
        timestamp: new Date(evt.created_at).getTime(),
        type: 'order_event',
        label: `Събитие по поръчка: ${evt.type}`,
        detail: evt.message || `Преход от ${evt.from_status || '—'} към ${evt.to_status || '—'}`,
        timeString: formatTimestamp(evt.created_at),
      })
    })

    // 4. Add Payment Transactions
    data.payments.forEach((pay) => {
      items.push({
        id: `payment-${pay.id}`,
        timestamp: new Date(pay.created_at).getTime(),
        type: 'payment',
        label: `Плащане (${pay.type}): ${pay.status}`,
        detail: `${pay.amount} ${pay.currency} през ${pay.provider}`,
        timeString: formatTimestamp(pay.created_at),
      })
    })

    // Sort chronologically
    return items.sort((a, b) => a.timestamp - b.timestamp)
  }, [data])

  // AUTHENTICATION GUARD SECTION (MUST EVALUATE BEFORE LOADING CHECK TO PREVENT STUCK LOADING SCREEN)
  if (accountLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-soft">
        <div className="text-muted text-sm animate-pulse">Проверяваме достъпа…</div>
      </div>
    )
  }

  if (!session || !isAuthorizedAdmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6 text-center bg-soft">
        <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-red-200 bg-red-50 text-red-600 shadow-sm mb-4">
          <ShieldAlert size={30} strokeWidth={1.9} />
        </div>
        <h1 className="text-2xl font-bold text-ink">Нямате достъп до този админ преглед.</h1>
        <p className="text-muted mt-2 max-w-md">Данните за спорове и досиета са достъпни само за оторизирани администратори.</p>
        <Link to="/moy-profil" className="btn btn-ghost mt-6 border-line bg-paper">Към профила</Link>
      </div>
    )
  }

  if (loading && !error) {
    return (
      <div className="flex h-screen items-center justify-center bg-soft">
        <div className="text-muted text-sm animate-pulse">Зареждаме доказателствата за досието…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container-page py-10 max-w-4xl">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle size={40} className="text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-800">Възникна грешка</h2>
          <p className="text-red-700 mt-2">{error}</p>
          <Link to="/admin" className="btn btn-ghost mt-6 border-red-200 hover:bg-red-100">Назад към админ панела</Link>
        </div>
      </div>
    )
  }

  const { conversation, order, payments, offers, accounts } = data

  const clientAccount = accounts.get(conversation.client_id)
  const partnerAccount = accounts.get(conversation.partner_id)

  function downloadEvidenceJson() {
    const blob = new Blob([JSON.stringify({ ...evidenceExport(data), sha256: fingerprint }, null, 2)], { type: 'application/json;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `totsan-evidence-${conversation.id}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <section className="min-h-screen bg-soft py-6 px-4 sm:px-6 lg:px-8 print:bg-white print:py-0 print:px-0">
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .grid {
            display: block !important;
          }
          .grid > * {
            width: 100% !important;
            margin-bottom: 2rem !important;
          }
          .print-card {
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
            border-radius: 12px !important;
            background: white !important;
            page-break-inside: avoid !important;
            margin-bottom: 2rem !important;
          }
          .print-timeline-item {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="mx-auto max-w-6xl">
        {/* Navigation & Action Header */}
        <div className="no-print mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="btn btn-ghost border-line bg-paper p-3 rounded-full hover:bg-soft">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="font-display text-2xl text-ink">Досие на разговор</h1>
              <p className="text-xs text-muted">Администратор: {userEmail}</p>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="btn btn-primary bg-ink text-paper rounded-full px-5 py-3 hover:bg-accentDeep flex items-center justify-center gap-2 self-start sm:self-auto"
          >
            <Printer size={18} />
            Печат / Запази като PDF
          </button>
          <button type="button" onClick={downloadEvidenceJson} className="btn btn-ghost border-line bg-paper"><Download size={18} /> Експорт на данните</button>
        </div>

        <div className="print-card mb-6 rounded-3xl border border-line bg-paper p-5">
          <div className="eyebrow">Totsan evidence dossier</div>
          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
            <div><span className="text-muted">Досие:</span> <span className="font-mono text-ink">{conversation.id}</span></div>
            <div><span className="text-muted">Генерирано:</span> <span className="text-ink">{formatTimestamp(new Date().toISOString())}</span></div>
            <div className="sm:col-span-2 break-all"><span className="text-muted">SHA-256 на експортираните данни:</span> <span className="font-mono text-ink">{fingerprint || 'Изчислява се…'}</span></div>
          </div>
        </div>

        {/* Audit Details */}
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            {/* 1. Timeline Section */}
            <div className="print-card rounded-3xl border border-line bg-paper p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-lg text-ink border-b border-line pb-4 mb-4">
                <FileClock size={20} className="text-muted" />
                Хронологичен Одит (Пътека на транзакцията)
              </h2>
              <div className="relative border-l border-line pl-5 ml-2.5 space-y-6">
                {timeline.map((item) => (
                  <div key={item.id} className="print-timeline-item relative group">
                    <span className="absolute -left-7 top-1 flex h-4 w-4 items-center justify-center rounded-full border border-line bg-paper text-[8px] text-muted">
                      •
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <span className="font-semibold text-sm text-ink">{item.label}</span>
                      <span className="text-xs text-muted">{item.timeString}</span>
                    </div>
                    <p className="text-sm text-muted mt-1 whitespace-pre-wrap leading-relaxed">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Messages List */}
            <div className="print-card rounded-3xl border border-line bg-paper p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-lg text-ink border-b border-line pb-4 mb-4">
                <MessageSquare size={20} className="text-muted" />
                История на съобщенията ({data.messages.length})
              </h2>

              {messagesError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-4 flex items-start gap-2">
                  <AlertCircle className="shrink-0 mt-0.5" size={16} />
                  <div>
                    <span className="font-semibold">Грешка при зареждане на съобщенията: </span>
                    <span>{messagesError}</span>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {data.messages.map((msg) => {
                  const isClientMsg = msg.sender_id === conversation.client_id
                  const senderName = isClientMsg
                    ? clientAccount?.full_name || clientAccount?.display_name || 'Клиент'
                    : partnerAccount?.full_name || partnerAccount?.display_name || 'Партньор'

                  const linkedOffer = msg.offer || offers.find((o) => o.id === msg.offer_id)
                  const linkedOfferNorm = linkedOffer ? getAdminOfferDetails(linkedOffer) : null

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] p-4 rounded-2xl ${
                        isClientMsg
                          ? 'bg-soft/75 text-ink self-start border border-line/60'
                          : 'bg-ink/5 text-ink self-end border border-ink/10'
                      }`}
                      style={{ alignSelf: isClientMsg ? 'flex-start' : 'flex-end' }}
                    >
                      <div className="flex justify-between items-center gap-6 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-ink/80">{senderName}</span>
                          <span className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-mono border border-line/60 text-muted uppercase">
                            {msg.kind || 'text'}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted">{formatTimestamp(msg.created_at)}</span>
                      </div>
                      
                      {msg.body && <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.body}</p>}
                      
                      {linkedOfferNorm && (
                        <div className="mt-3 border-t border-line/60 pt-2 text-xs bg-paper border border-line/65 rounded-xl p-3 space-y-2">
                          <span className="font-semibold text-ink block">Свързана оферта:</span>
                          <span className="block font-semibold text-ink">{linkedOfferNorm.summary || linkedOffer.title}</span>
                          <span className="block text-muted">
                            Цена: {formatEurWithBgn(linkedOffer.price_amount)} | Статус: {linkedOffer.status}
                          </span>
                        </div>
                      )}
                      
                      <span className="text-[9px] text-muted font-mono mt-2 block">ID на подател: {msg.sender_id}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 3. Offers Cards Details */}
            {offers.length > 0 && (
              <div className="print-card rounded-3xl border border-line bg-paper p-6 shadow-sm">
                <h2 className="flex items-center gap-2 font-display text-lg text-ink border-b border-line pb-4 mb-4">
                  <Tag size={20} className="text-muted" />
                  Изпратени Оферти ({offers.length})
                </h2>
                <div className="space-y-6">
                  {offers.map((offer) => {
                    const norm = getAdminOfferDetails(offer)
                    return (
                      <div key={offer.id} className="border border-line rounded-2xl p-5 bg-soft/20 print:bg-white space-y-4 print-card">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <h3 className="font-semibold text-base text-ink">{offer.title}</h3>
                            <p className="text-xs text-muted mt-0.5">Оферта ID: {offer.id}</p>
                          </div>
                          <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-paper border border-line">
                            {offer.status}
                          </span>
                        </div>

                        {norm.summary && (
                          <p className="text-sm text-muted whitespace-pre-wrap leading-relaxed">{norm.summary}</p>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2 text-sm">
                          <div>
                            <span className="font-semibold text-xs block text-muted">Крайна цена:</span>
                            <span className="font-bold text-ink">{offer.price_amount ? formatEurWithBgn(offer.price_amount) : 'По уточнение'}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-xs block text-muted">Срок:</span>
                            <span className="text-ink">{offer.delivery_days ? `${offer.delivery_days} работни дни` : 'По уточнение'}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          {norm.offerType && (
                            <span className="rounded-full px-2.5 py-1 bg-paper border border-line text-muted">
                              {OFFER_TYPE_LABELS[norm.offerType] || norm.offerType}
                            </span>
                          )}
                          {norm.priceType && (
                            <span className="rounded-full px-2.5 py-1 bg-paper border border-line text-muted">
                              {PRICE_TYPE_LABELS[norm.priceType] || norm.priceType}
                            </span>
                          )}
                          {norm.materialsMode && (
                            <span className="rounded-full px-2.5 py-1 bg-paper border border-line text-muted">
                              {MATERIAL_MODE_LABELS[norm.materialsMode] || norm.materialsMode}
                            </span>
                          )}
                          {norm.vatStatus && (
                            <span className="rounded-full px-2.5 py-1 bg-paper border border-line text-muted">
                              {VAT_LABELS[norm.vatStatus] || norm.vatStatus}
                            </span>
                          )}
                        </div>

                        {/* Valid until, start date, dependencies */}
                        {(norm.validUntil || norm.timeline.earliestStartDate || norm.timeline.dependencies) && (
                          <div className="grid gap-3 sm:grid-cols-3 text-xs bg-paper border border-line rounded-xl p-3">
                            {norm.validUntil && (
                              <div>
                                <span className="font-semibold text-muted block">Валидна до:</span>
                                <span className="text-ink">{formatDate(norm.validUntil)}</span>
                              </div>
                            )}
                            {norm.timeline.earliestStartDate && (
                              <div>
                                <span className="font-semibold text-muted block">Най-ранен старт:</span>
                                <span className="text-ink">{formatDate(norm.timeline.earliestStartDate)}</span>
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

                        {/* Structured Scope Details */}
                        {(norm.includedItems.length > 0 || norm.excludedItems.length > 0 || norm.clientRequirements.length > 0) && (
                          <div className="border-t border-line/60 pt-4 space-y-3 text-xs">
                            {norm.includedItems.length > 0 && (
                              <div>
                                <span className="font-semibold text-muted block">Какво включва:</span>
                                <ul className="list-disc pl-4 space-y-1 mt-1 text-ink">
                                  {norm.includedItems.map((item, idx) => <li key={idx}>{item}</li>)}
                                </ul>
                              </div>
                            )}
                            {norm.excludedItems.length > 0 && (
                              <div>
                                <span className="font-semibold text-muted block">Не е включено:</span>
                                <ul className="list-disc pl-4 space-y-1 mt-1 text-ink">
                                  {norm.excludedItems.map((item, idx) => <li key={idx}>{item}</li>)}
                                </ul>
                              </div>
                            )}
                            {norm.clientRequirements.length > 0 && (
                              <div>
                                <span className="font-semibold text-muted block">Клиентът осигурява:</span>
                                <ul className="list-disc pl-4 space-y-1 mt-1 text-ink">
                                  {norm.clientRequirements.map((item, idx) => <li key={idx}>{item}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Stages */}
                        {norm.stages.length > 0 && (
                          <div className="border-t border-line/60 pt-4 space-y-2">
                            <span className="font-semibold text-xs text-muted block">Етапи на изпълнение:</span>
                            <div className="space-y-3">
                              {norm.stages.map((stage) => (
                                <div key={stage.order} className="border border-line/60 bg-paper rounded-xl p-3 text-xs space-y-2">
                                  <div className="flex justify-between items-center gap-4">
                                    <span className="font-bold text-ink">{stage.order}. {stage.title || `Етап ${stage.order}`}</span>
                                    {stage.priceAmount > 0 && (
                                      <span className="font-bold text-ink bg-soft px-2 py-0.5 rounded">
                                        {formatEurWithBgn(stage.priceAmount)}
                                      </span>
                                    )}
                                  </div>
                                  {stage.description && (
                                    <p className="text-muted leading-relaxed whitespace-pre-wrap">{stage.description}</p>
                                  )}
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted border-t border-line/40 pt-1.5">
                                    {stage.durationDays > 0 && (
                                      <span>Срок: {stage.durationDays} работни дни</span>
                                    )}
                                    {stage.startCondition && (
                                      <span>Старт условие: {stage.startCondition}</span>
                                    )}
                                    {stage.payment && (
                                      <span>Плащане: {stage.payment}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Payment & Conditions Details */}
                        {(norm.payment.terms || norm.payment.notes || norm.conditions.cancellation || norm.conditions.scopeChanges || norm.conditions.unforeseenWork) && (
                          <div className="border-t border-line/60 pt-4 space-y-3 text-xs bg-paper border border-line rounded-xl p-3">
                            <span className="font-semibold text-muted block mb-1">Плащане и Условия:</span>
                            
                            {norm.payment.terms && (
                              <div>
                                <span className="font-semibold text-[10px] text-muted block">Условия за плащане:</span>
                                <span className="text-ink block whitespace-pre-wrap">{norm.payment.terms}</span>
                              </div>
                            )}
                            
                            {norm.payment.notes && (
                              <div className="mt-2">
                                <span className="font-semibold text-[10px] text-muted block">Бележка към плащането:</span>
                                <span className="text-ink block whitespace-pre-wrap">{norm.payment.notes}</span>
                              </div>
                            )}

                            {norm.conditions.cancellation && (
                              <div className="mt-2">
                                <span className="font-semibold text-[10px] text-muted block">Отказ / анулиране:</span>
                                <span className="text-ink block whitespace-pre-wrap">{norm.conditions.cancellation}</span>
                              </div>
                            )}

                            {norm.conditions.scopeChanges && (
                              <div className="mt-2">
                                <span className="font-semibold text-[10px] text-muted block">Промени в обхвата:</span>
                                <span className="text-ink block whitespace-pre-wrap">{norm.conditions.scopeChanges}</span>
                              </div>
                            )}

                            {norm.conditions.unforeseenWork && (
                              <div className="mt-2">
                                <span className="font-semibold text-[10px] text-muted block">Непредвидена работа:</span>
                                <span className="text-ink block whitespace-pre-wrap">{norm.conditions.unforeseenWork}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* 4. Metadata Details */}
            <div className="print-card rounded-3xl border border-line bg-paper p-6 shadow-sm">
              <h2 className="font-display text-lg text-ink border-b border-line pb-4 mb-4">Данни на разговора</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <span className="text-xs font-semibold text-muted block">Conversation ID:</span>
                  <span className="font-mono text-xs select-all text-ink block">{conversation.id}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-muted block">Създаден на:</span>
                  <span className="text-ink">{formatTimestamp(conversation.created_at)}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-muted block">Текущ статус:</span>
                  <span className="text-ink font-semibold">{conversation.status}</span>
                </div>
                <div className="border-t border-line/60 pt-3">
                  <span className="text-xs font-semibold text-muted block">Клиент:</span>
                  <span className="text-ink block">{conversation.client?.name || 'Няма име'}</span>
                  <span className="text-xs text-muted block">{clientAccount?.email || 'Липсва имейл'}</span>
                  <span className="text-[10px] text-muted font-mono block">ID: {conversation.client_id}</span>
                </div>
                <div className="border-t border-line/60 pt-3">
                  <span className="text-xs font-semibold text-muted block">Партньор:</span>
                  <span className="text-ink block">{conversation.partner?.name || 'Няма име'}</span>
                  <span className="text-xs text-muted block">{partnerAccount?.email || 'Липсва имейл'}</span>
                  <span className="text-[10px] text-muted font-mono block">ID: {conversation.partner_id}</span>
                </div>
              </div>
            </div>

            {/* 5. Order & Finance details */}
            {order && (
              <div className="print-card rounded-3xl border border-line bg-paper p-6 shadow-sm">
                <h2 className="flex items-center gap-2 font-display text-lg text-ink border-b border-line pb-4 mb-4">
                  <CreditCard size={20} className="text-muted" />
                  Поръчка и Финанси
                </h2>
                <div className="space-y-4 text-sm">
                  <div>
                    <span className="text-xs font-semibold text-muted block">Поръчка ID:</span>
                    <span className="font-mono text-xs select-all text-ink block">{order.id}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted block">Статус:</span>
                    <span className="font-bold text-ink">{order.status}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted block">Обща цена:</span>
                    <span className="font-bold text-ink">{formatEurWithBgn(order.amount_total)}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted block">Платформена такса:</span>
                    <span className="text-ink">{formatEurWithBgn(order.platform_fee)}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted block">Изплащане на партньор:</span>
                    <span className="text-ink">{formatEurWithBgn(order.partner_payout)}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted block">Валута:</span>
                    <span className="text-ink">{order.currency}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted block">Направена на:</span>
                    <span className="text-ink">{formatTimestamp(order.created_at)}</span>
                  </div>
                </div>
              </div>
            )}

            {data.milestones.length > 0 && (
              <div className="print-card rounded-3xl border border-line bg-paper p-6 shadow-sm">
                <h2 className="font-display text-lg text-ink border-b border-line pb-4 mb-4">Етапи на поръчката</h2>
                <div className="space-y-3">{data.milestones.map((milestone) => <div key={milestone.id} className="rounded-xl border border-line p-3 text-xs"><div className="flex justify-between gap-3"><strong>{milestone.position}. {milestone.title}</strong><span>{MILESTONE_STATUS_LABELS[milestone.status] || milestone.status}</span></div><div className="mt-2 text-muted">{formatEurWithBgn(milestone.amount)} · {milestone.id}</div>{milestone.evidence?.length > 0 && <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-soft p-2 text-[10px]">{JSON.stringify(milestone.evidence, null, 2)}</pre>}</div>)}</div>
              </div>
            )}

            {/* 6. Payments/Transactions List */}
            {payments.length > 0 && (
              <div className="print-card rounded-3xl border border-line bg-paper p-6 shadow-sm">
                <h2 className="font-display text-lg text-ink border-b border-line pb-4 mb-4">Транзакции</h2>
                <div className="space-y-4">
                  {payments.map((pay) => (
                    <div key={pay.id} className="border border-line rounded-xl p-3 text-xs bg-soft/10 space-y-2">
                      <div className="flex justify-between items-center font-semibold text-ink">
                        <span>{pay.type === 'charge' ? 'Плащане' : 'Изплащане'}</span>
                        <span className={pay.status === 'succeeded' ? 'text-green-600' : 'text-amber-600'}>
                          {pay.status}
                        </span>
                      </div>
                      <div className="space-y-1 text-muted">
                        <div>
                          <span>Сума: </span>
                          <span className="font-bold text-ink">{pay.amount} {pay.currency}</span>
                        </div>
                        <div>
                          <span>Дата: </span>
                          <span>{formatTimestamp(pay.created_at)}</span>
                        </div>
                        {pay.provider === 'stripe' && pay.raw?.id && (
                          <div>
                            <span className="block font-semibold">Stripe ID:</span>
                            <span className="font-mono text-[10px] select-all block text-ink">{pay.raw.id}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function formatTimestamp(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('bg-BG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function getAdminOfferDetails(offer) {
  return normalizeAcceptedOffer(offer)
}

function evidenceExport(data) {
  return {
    schemaVersion: 2,
    conversation: data.conversation,
    messages: data.messages,
    offers: data.offers,
    order: data.order,
    milestones: data.milestones,
    payments: data.payments,
    events: data.events,
    accounts: Array.from(data.accounts?.values?.() || []),
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}
