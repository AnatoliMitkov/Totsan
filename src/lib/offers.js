/**
 * Canonical offer document helpers.
 *
 * A sent offer is normalized from the current row. Once accepted, schema v2
 * snapshots are treated as immutable and are never completed from mutable
 * offer fields. Older/incomplete snapshots retain a narrow legacy fallback.
 */

export const OFFER_DOCUMENT_VERSION = 2

export function normalizeAcceptedOffer(offer = null, snapshot = undefined) {
  const row = asObject(offer)
  const explicitSnapshot = snapshot === undefined ? row.accepted_offer_snapshot : snapshot
  const rawSnapshot = parseObject(explicitSnapshot)
  const hasSnapshot = Object.keys(rawSnapshot).length > 0
  const nestedSnapshot = parseObject(rawSnapshot.offerDetails)
  const document = hasSnapshot
    ? { ...nestedSnapshot, ...rawSnapshot }
    : parseObject(row.offer_details)
  const strictSnapshot = hasSnapshot && Number(document.schemaVersion || 0) >= OFFER_DOCUMENT_VERSION
  const fallback = strictSnapshot ? {} : row

  const offerType = firstText(
    document.offerType,
    document.offer_type,
    fallback.offer_type,
    document.executionMode === 'staged' || document.execution_mode === 'staged' || fallback.execution_mode === 'staged'
      ? 'staged'
      : 'final',
  )
  const priceType = firstText(
    document.priceType,
    document.price_type,
    fallback.price_type,
    offerType === 'staged' ? 'staged' : 'fixed',
  )
  const title = firstText(document.title, fallback.title)
  const summary = firstText(document.summary, document.description, fallback.summary, fallback.description)
  const priceAmount = positiveNumber(document.priceAmount, document.price_amount, fallback.price_amount)
  const currency = firstText(document.currency, fallback.currency, 'EUR').toUpperCase()
  const deliverables = stringArray(document.deliverables, document.includedItems, fallback.deliverables)
  const includedItems = stringArray(document.includedItems, document.deliverables, fallback.deliverables)
  const timelineSource = asObject(document.timeline)
  const scopeSource = asObject(document.scope)
  const paymentSource = asObject(document.payment)
  const conditionSource = asObject(document.conditions)

  return {
    schemaVersion: Number(document.schemaVersion || (hasSnapshot ? 1 : 0)),
    source: hasSnapshot ? 'snapshot' : 'offer',
    offerId: firstText(document.offerId, row.id),
    offerType,
    priceType,
    title,
    summary,
    description: firstText(document.description, summary),
    priceAmount,
    currency,
    deliverables,
    includedItems,
    excludedItems: stringArray(
      document.excludedItems,
      document.excluded,
      document.notIncluded,
      scopeSource.excludedItems,
      scopeSource.excluded,
      fallback.excludedItems,
      fallback.excluded,
    ),
    clientRequirements: stringArray(
      document.clientRequirements,
      document.clientRequirementItems,
      document.clientProvides,
      scopeSource.clientRequirements,
      scopeSource.clientProvides,
      fallback.clientRequirements,
    ),
    materialsMode: firstText(document.materialsMode, document.materialsNote),
    vatStatus: firstText(document.vatStatus),
    timeline: {
      days: positiveNumber(timelineSource.days, document.deliveryDays, document.delivery_days, fallback.delivery_days),
      earliestStartDate: firstText(timelineSource.earliestStartDate, document.earliestStartDate),
      dependencies: firstText(timelineSource.dependencies, document.dependencies),
    },
    stages: normalizeStages(document.stages ?? fallback.stages),
    payment: {
      method: firstText(paymentSource.method, document.paymentMethod),
      terms: firstText(paymentSource.terms, document.paymentTerms),
      notes: firstText(paymentSource.notes, document.paymentNotes),
    },
    conditions: {
      scopeChanges: firstText(conditionSource.scopeChanges, document.scopeChangeTerms),
      cancellation: firstText(conditionSource.cancellation, document.cancellationTerms),
      unforeseenWork: firstText(conditionSource.unforeseenWork, document.unforeseenTerms),
    },
    validUntil: firstText(document.validUntil, document.expiresAt, document.expires_at, fallback.expires_at),
    priceBreakdown: numberRecord(document.priceBreakdown),
    acceptedAt: firstText(document.acceptedAt, document.accepted_at, row.accepted_at),
    status: firstText(row.status, document.status),
    offerDetails: document,
  }
}

export function offerDocumentFromDraft(draft = {}) {
  const source = asObject(draft)
  const details = parseObject(source.offerDetails)
  return normalizeAcceptedOffer({
    id: source.id,
    title: source.title,
    offer_type: source.offerType,
    price_type: source.priceType,
    summary: source.summary,
    description: source.description,
    price_amount: source.priceAmount,
    currency: source.currency,
    delivery_days: source.deliveryDays,
    deliverables: source.deliverables,
    execution_mode: source.executionMode,
    stages: source.stages,
    expires_at: source.expiresAt,
    offer_details: details,
    status: source.status || 'draft',
  })
}

export function normalizeStages(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter((stage) => stage && typeof stage === 'object' && !Array.isArray(stage))
    .map((stage, index) => ({
      id: firstText(stage.id),
      title: firstText(stage.title),
      description: firstText(stage.description),
      durationDays: positiveNumber(stage.durationDays, stage.duration_days, stage.days),
      priceAmount: positiveNumber(stage.priceAmount, stage.price_amount, stage.price, stage.amount),
      currency: firstText(stage.currency),
      payment: firstText(stage.payment, stage.paymentNote, stage.payment_note),
      startCondition: firstText(stage.startCondition, stage.start_condition),
      status: firstText(stage.status, 'pending'),
      order: Number.isFinite(Number(stage.order ?? stage.position))
        ? Math.max(1, Math.round(Number(stage.order ?? stage.position)))
        : index + 1,
    }))
    .filter((stage) => stage.title || stage.description || stage.priceAmount > 0)
    .sort((left, right) => left.order - right.order)
}

export function validateOfferDocument(document = {}) {
  const offer = normalizeAcceptedOffer(null, {
    schemaVersion: OFFER_DOCUMENT_VERSION,
    ...asObject(document),
  })
  const errors = []

  if (!offer.title) errors.push('Добави заглавие на офертата.')
  if (!offer.summary) errors.push('Добави кратко резюме.')
  if (offer.offerType !== 'estimate' && offer.includedItems.length === 0) {
    errors.push('Добави поне една включена дейност или краен резултат.')
  }
  if (offer.offerType !== 'estimate' && offer.priceAmount <= 0) errors.push('Добави валидна обща цена.')
  if (!offer.payment.terms) errors.push('Добави условия за плащане.')

  if (offer.offerType === 'staged') {
    if (offer.stages.length < 2) errors.push('Поетапната оферта трябва да има поне два етапа.')
    const stageTotal = offer.stages.reduce((sum, stage) => sum + stage.priceAmount, 0)
    if (offer.stages.some((stage) => !stage.title || stage.priceAmount <= 0)) {
      errors.push('Всеки етап трябва да има заглавие и цена.')
    }
    if (offer.priceAmount > 0 && Math.abs(stageTotal - offer.priceAmount) > 0.005) {
      errors.push('Сборът на етапите трябва да е равен на общата цена.')
    }
  }

  return { offer, errors, valid: errors.length === 0 }
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function parseObject(value) {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return asObject(parsed)
  } catch {
    return {}
  }
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) return text
  }
  return ''
}

function positiveNumber(...values) {
  for (const value of values) {
    if (value === '' || value === null || value === undefined) continue
    const number = Number(value)
    if (Number.isFinite(number)) return Math.max(0, number)
  }
  return 0
}

function stringArray(...sources) {
  for (const source of sources) {
    const values = Array.isArray(source)
      ? source.map((item) => firstText(item)).filter(Boolean)
      : typeof source === 'string'
        ? source.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
        : []
    if (values.length > 0) return values
  }
  return []
}

function numberRecord(value) {
  const record = asObject(value)
  return {
    labor: positiveNumber(record.labor),
    materials: positiveNumber(record.materials),
    transport: positiveNumber(record.transport),
  }
}

export const OFFER_TYPE_LABELS = {
  final: 'Финална оферта',
  estimate: 'Предварителна оценка',
  staged: 'Поетапна оферта',
}

export const PRICE_TYPE_LABELS = {
  fixed: 'Фиксирана цена',
  estimate: 'Ориентировъчна цена',
  hourly: 'Почасова / на ден',
  staged: 'По етапи',
}

export const MATERIAL_MODE_LABELS = {
  included: 'Материалите са включени',
  client: 'Материалите се осигуряват от клиента',
  separate: 'Материалите се уточняват отделно',
}

export const VAT_LABELS = {
  included: 'С ДДС',
  excluded: 'Без ДДС',
  not_registered: 'Партньорът не е регистриран по ДДС',
  invoice: 'Уточнява се във фактурата',
}

export const PAYMENT_METHOD_LABELS = {
  platform: 'Еднократно плащане през Totsan',
  staged_platform: 'Плащане през Totsan по етапи',
  custom: 'Плащане по договорени условия',
}

export const STATUS_LABELS = {
  draft: 'Чернова',
  sent: 'Изпратена',
  viewed: 'Видяна',
  question: 'Има въпрос',
  accepted: 'Приета',
  declined: 'Отказана',
  withdrawn: 'Изтеглена',
  expired: 'Изтекла',
  change_requested: 'Искана промяна',
}

export const MILESTONE_STATUS_LABELS = {
  pending: 'Предстоящ',
  ready: 'Готов за плащане',
  in_progress: 'В работа',
  submitted: 'Предаден',
  revision_requested: 'Искана корекция',
  accepted: 'Приет',
  payment_pending: 'Очаква плащане',
  paid: 'Платен',
  disputed: 'Оспорен',
  cancelled: 'Отменен',
}
