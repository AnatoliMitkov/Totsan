const TERMINAL_MILESTONE_STATUSES = new Set(['accepted', 'cancelled'])
const HISTORY_ORDER_STATUSES = new Set(['completed', 'cancelled', 'refunded'])

const ORDER_STATUS_COPY = {
  pending_payment: 'Очаква плащане',
  paid: 'Платено',
  in_progress: 'В работа',
  delivered: 'Предадена за преглед',
  completed: 'Поръчката е завършена',
  disputed: 'Има спор по поръчката',
  refunded: 'Плащането е възстановено',
  cancelled: 'Поръчката е отменена',
}

export function selectCurrentMilestone(milestones = []) {
  if (!milestones.length) return null
  return milestones.find((milestone) => !TERMINAL_MILESTONE_STATUSES.has(milestone.status)) || milestones[milestones.length - 1]
}

export function checkoutPathForOrder(order) {
  if (!order || ['staged_platform', 'custom'].includes(order.paymentMethod)) return ''
  if (order.offerId) return `/checkout/offer/${order.offerId}`
  if (order.servicePackageId) return `/checkout/service/${order.servicePackageId}`
  return ''
}

export function buildOrderActions(order, role, checkoutPath = '') {
  if (!order || role === 'guest' || order.paymentMethod === 'staged_platform') return []
  const actions = []
  if (role === 'partner' && order.status === 'pending_payment' && !checkoutPath) actions.push('confirm_direct_payment')
  if (role === 'partner' && order.status === 'paid') actions.push('start_work')
  if (role === 'partner' && order.status === 'in_progress') actions.push('mark_delivered')
  if (role === 'client' && order.status === 'delivered') actions.push('confirm_completed', 'request_revision')
  if (role === 'client' && order.status === 'pending_payment') actions.push('cancel_pending')
  return actions
}

export function buildOrderWorkspace({ order, milestones = [], role = 'guest', checkoutPath = '' }) {
  const currentMilestone = selectCurrentMilestone(milestones)
  return {
    currentMilestone,
    acceptedCount: milestones.filter((milestone) => milestone.status === 'accepted').length,
    totalCount: milestones.length,
    nextStep: currentMilestone
      ? milestoneNextStep(currentMilestone, role)
      : orderNextStep(order, role, checkoutPath),
    orderActions: buildOrderActions(order, role, checkoutPath),
  }
}

export function buildOrderListItem({ order, milestones = [], role = 'guest' }) {
  const orderPath = order?.id ? `/order/${order.id}` : ''
  const checkoutPath = checkoutPathForOrder(order)
  const currentMilestone = milestones.length > 0 ? selectCurrentMilestone(milestones) : null
  const acceptedCount = milestones.filter((milestone) => milestone.status === 'accepted').length

  const base = {
    order,
    milestones,
    currentMilestone,
    acceptedCount,
    totalCount: milestones.length,
    updatedAt: order?.updatedAt || order?.createdAt || '',
    statusLabel: ORDER_STATUS_COPY[order?.status] || 'Статусът се обновява',
    primaryAction: null,
    nextStep: '',
    group: 'active',
    waitingFor: '',
  }

  if (!order) return { ...base, group: 'history', statusLabel: 'Поръчката не е налична' }
  if (HISTORY_ORDER_STATUSES.has(order.status)) {
    return {
      ...base,
      group: 'history',
      nextStep: orderNextStep(order, role, checkoutPath),
    }
  }

  if (currentMilestone && !TERMINAL_MILESTONE_STATUSES.has(currentMilestone.status)) {
    return buildMilestoneListItem(base, role, orderPath)
  }

  return buildOrderLevelListItem(base, role, checkoutPath, orderPath)
}

export function groupOrderListItems(items = []) {
  const groups = { action: [], active: [], history: [] }
  items.forEach((item) => {
    const group = groups[item.group] ? item.group : 'active'
    groups[group].push(item)
  })

  Object.values(groups).forEach((itemsInGroup) => itemsInGroup.sort((left, right) => dateValue(right.updatedAt) - dateValue(left.updatedAt)))
  return groups
}

function buildMilestoneListItem(base, role, orderPath) {
  const milestone = base.currentMilestone
  const stageName = milestone.title ? `Етап ${milestone.position}: ${milestone.title}` : `Етап ${milestone.position}`
  const milestoneStatusLabel = {
    ready: 'Етапът очаква плащане',
    payment_pending: 'Плащането се обработва',
    paid: 'Етапът е платен',
    in_progress: 'Етапът е в работа',
    revision_requested: 'Поискана е корекция',
    submitted: 'Етапът чака преглед',
    disputed: 'Има спор по етапа',
    pending: 'Етапът е предстоящ',
  }[milestone.status] || base.statusLabel

  const item = { ...base, stageName, statusLabel: milestoneStatusLabel }
  if (role === 'client' && ['ready', 'payment_pending'].includes(milestone.status)) {
    return {
      ...item,
      group: 'action',
      nextStep: `${stageName} очаква твоето плащане.`,
      primaryAction: milestone.id ? { label: 'Плати етапа', to: `/checkout/milestone/${milestone.id}` } : null,
    }
  }
  if (role === 'client' && milestone.status === 'submitted') {
    return {
      ...item,
      group: 'action',
      nextStep: `${stageName} е предаден и очаква твоя преглед.`,
      primaryAction: orderPath ? { label: 'Прегледай предадения етап', to: orderPath } : null,
    }
  }
  if (role === 'partner' && milestone.status === 'paid') {
    return {
      ...item,
      group: 'action',
      nextStep: `${stageName} е платен и може да бъде започнат.`,
      primaryAction: orderPath ? { label: 'Започни етапа', to: orderPath } : null,
    }
  }
  if (role === 'partner' && ['in_progress', 'revision_requested'].includes(milestone.status)) {
    return {
      ...item,
      group: 'action',
      nextStep: milestone.status === 'revision_requested'
        ? `${stageName} има поискана корекция.`
        : `${stageName} е в работа и може да бъде предаден.`,
      primaryAction: orderPath ? { label: 'Предай етапа', to: orderPath } : null,
    }
  }
  if (milestone.status === 'disputed') {
    return {
      ...item,
      nextStep: `${stageName} е оспорен. Прегледайте историята и уточнете следващите стъпки.`,
      waitingFor: 'Нужни са уточнения',
    }
  }

  return {
    ...item,
    nextStep: milestoneNextStep(milestone, role),
    waitingFor: role === 'client' ? 'Очаква се партньорът' : 'Очаква се клиентът',
  }
}

function buildOrderLevelListItem(base, role, checkoutPath, orderPath) {
  const { order } = base
  if (order.status === 'pending_payment') {
    if (order.paymentMethod === 'staged_platform') {
      return {
        ...base,
        statusLabel: 'Очаква актуален етап',
        nextStep: 'Поръчката е по етапи. Отвори я, за да видиш актуалния статус на плащането.',
        waitingFor: 'Статусът на етапите се обновява',
      }
    }
    if (role === 'client' && checkoutPath) {
      return {
        ...base,
        group: 'action',
        statusLabel: 'Очаква твоето плащане',
        nextStep: 'Завърши защитеното плащане, за да започне работата.',
        primaryAction: { label: 'Плати', to: checkoutPath },
      }
    }
    if (role === 'partner' && order.paymentMethod === 'custom') {
      return {
        ...base,
        group: 'action',
        statusLabel: 'Потвърди полученото плащане',
        nextStep: 'Потвърди плащането само след като реално е получено.',
        primaryAction: orderPath ? { label: 'Потвърди плащането', to: orderPath } : null,
      }
    }
    return {
      ...base,
      statusLabel: 'Очаква плащане',
      nextStep: role === 'partner'
        ? 'Клиентът трябва да завърши плащането, преди работата да започне.'
        : 'Плащането се подготвя. Отвори поръчката при нужда от уточнение.',
      waitingFor: role === 'partner' ? 'Очаква се клиентът' : 'Статусът на плащането се обновява',
    }
  }
  if (order.status === 'paid' && role === 'partner') {
    return {
      ...base,
      group: 'action',
      nextStep: 'Плащането е потвърдено и работата може да започне.',
      primaryAction: orderPath ? { label: 'Започни работа', to: orderPath } : null,
    }
  }
  if (order.status === 'in_progress' && role === 'partner') {
    return {
      ...base,
      group: 'action',
      nextStep: 'Работата е в ход. Предай я, когато резултатът е готов.',
      primaryAction: orderPath ? { label: 'Предай работата', to: orderPath } : null,
    }
  }
  if (order.status === 'delivered' && role === 'client') {
    return {
      ...base,
      group: 'action',
      statusLabel: 'Чака твоя преглед',
      nextStep: 'Прегледай предаденото и го приеми или поискай корекция.',
      primaryAction: orderPath ? { label: 'Прегледай и потвърди', to: orderPath } : null,
    }
  }
  if (order.status === 'disputed') {
    return {
      ...base,
      nextStep: 'Има спор по поръчката. Прегледайте историята и уточнете следващите стъпки.',
      waitingFor: 'Нужни са уточнения',
    }
  }

  return {
    ...base,
    nextStep: orderNextStep(order, role, checkoutPath),
    waitingFor: role === 'client' ? 'Очаква се партньорът' : 'Очаква се клиентът',
  }
}

function dateValue(value) {
  const date = new Date(value || 0).getTime()
  return Number.isFinite(date) ? date : 0
}

export function orderNextStep(order, role, checkoutPath = '') {
  if (!order) return ''
  if (order.status === 'pending_payment' && role === 'client' && checkoutPath) return 'Прегледай договореното и завърши защитеното плащане.'
  if (order.status === 'pending_payment' && role === 'client') return 'Изчакай партньорът да потвърди договореното плащане или използвай чата при въпрос.'
  if (order.status === 'pending_payment' && role === 'partner') return 'Потвърди плащането едва след като реално го получиш.'
  if (order.status === 'paid' && role === 'partner') return 'Плащането е потвърдено. Започни работата, когато си готов.'
  if (order.status === 'paid' && role === 'client') return 'Плащането е потвърдено. Партньорът може да започне работа.'
  if (order.status === 'in_progress' && role === 'partner') return 'Работата е в ход. Маркирай я като предадена, когато резултатът е готов.'
  if (order.status === 'in_progress' && role === 'client') return 'Работата е в ход. Използвай чата, ако трябва да уточните детайл.'
  if (order.status === 'delivered' && role === 'client') return 'Прегледай предаденото и го приеми или поискай конкретна корекция.'
  if (order.status === 'delivered' && role === 'partner') return 'Резултатът е предаден. Изчакай потвърждение или бележки от клиента.'
  if (order.status === 'completed') return 'Поръчката е завършена. Всички договорени детайли остават достъпни тук.'
  if (order.status === 'disputed') return 'Поръчката е оспорена. Следи историята и използвай чата за следващите уточнения.'
  if (order.status === 'refunded') return 'Плащането е възстановено. Подробностите остават в историята на поръчката.'
  if (order.status === 'cancelled') return 'Поръчката е отменена. Договорените детайли остават достъпни за справка.'
  return 'Следи статуса тук и използвай чата, ако трябва да уточните следващото действие.'
}

export function milestoneNextStep(milestone, role) {
  if (!milestone) return ''
  const status = milestone.status

  if (role === 'client') {
    if (['ready', 'payment_pending'].includes(status)) return 'Плати този етап, за да може работата по него да започне.'
    if (status === 'paid') return 'Плащането е потвърдено. Партньорът може да започне етапа.'
    if (status === 'in_progress') return 'Партньорът работи по този етап. Използвай чата при нужда от уточнение.'
    if (status === 'revision_requested') return 'Партньорът подготвя поисканата корекция.'
    if (status === 'submitted') return 'Прегледай предадения етап и го приеми или поискай конкретна корекция.'
    if (status === 'disputed') return 'Етапът е оспорен. Следи историята и уточнете следващите действия в чата.'
    if (status === 'pending') return 'Този етап ще стане достъпен след приключване на предходния.'
  }

  if (role === 'partner') {
    if (['ready', 'payment_pending'].includes(status)) return 'Изчакай клиентът да плати този етап, преди да започнеш работа.'
    if (status === 'paid') return 'Плащането е потвърдено. Започни етапа, когато си готов.'
    if (['in_progress', 'revision_requested'].includes(status)) return 'Предай етапа, когато резултатът е готов за преглед.'
    if (status === 'submitted') return 'Етапът е предаден. Изчакай клиента да го прегледа.'
    if (status === 'disputed') return 'Етапът е оспорен. Следи историята и уточнете следващите действия в чата.'
    if (status === 'pending') return 'Този етап ще стане активен след приключване на предходния.'
  }

  if (status === 'accepted') return 'Етапът е приет и завършен.'
  if (status === 'cancelled') return 'Етапът е отменен.'
  return 'Следи статуса на етапа и използвай чата при нужда от уточнение.'
}
