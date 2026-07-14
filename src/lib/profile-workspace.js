export const PARTNER_WORKSPACE_NAV = [
  { id: 'work', label: 'Работа', tabIds: ['overview', 'orders', 'inquiries'] },
  { id: 'profile', label: 'Профил', tabIds: ['profile', 'layer01', 'portfolio', 'services', 'materials', 'contact'] },
  { id: 'account', label: 'Акаунт', tabIds: ['security'] },
]

export function buildPartnerOverviewAction({
  dashboardState = {},
  subscriptionState = {},
  paymentState = {},
  completion = {},
  preview = {},
  nextSteps = [],
} = {}) {
  if (paymentState.status === 'error') {
    return {
      kind: 'problem',
      eyebrow: 'Нужно е внимание',
      title: 'Плащанията имат нужда от проверка',
      description: paymentState.message || 'Проверете настройките за получаване на плащания.',
      cta: 'Отвори плащанията',
      target: 'payments',
    }
  }

  if (subscriptionState.status === 'error' || subscriptionState.status === 'email-error') {
    return {
      kind: 'problem',
      eyebrow: 'Нужно е внимание',
      title: 'Абонаментът има нужда от проверка',
      description: subscriptionState.message || 'Проверете състоянието на партньорския план.',
      cta: 'Управлявай абонамента',
      target: 'subscription',
    }
  }

  if (dashboardState.status === 'error') {
    return {
      kind: 'problem',
      eyebrow: 'Данните не са заредени',
      title: 'Работното табло не е напълно достъпно',
      description: dashboardState.message || 'Опитайте отново след малко или отворете запитванията директно.',
      cta: 'Виж запитванията',
      target: 'inquiries',
    }
  }

  const inquiries = Array.isArray(dashboardState.inquiries) ? dashboardState.inquiries : []
  const newInquiry = inquiries.find((item) => item?.status === 'new')
  const activeInquiry = newInquiry || inquiries.find((item) => item?.status === 'seen' || item?.status === 'replied')

  if (activeInquiry) {
    return {
      kind: 'inquiry',
      eyebrow: newInquiry ? 'Нова заявка' : 'Активна заявка',
      title: activeInquiry.name ? `Заявка от ${activeInquiry.name}` : 'Клиентска заявка очаква действие',
      description: activeInquiry.message || activeInquiry.description || 'Прегледайте контекста и отговорете на клиента.',
      cta: 'Виж заявката',
      target: 'inquiries',
      inquiry: activeInquiry,
    }
  }

  const firstStep = Array.isArray(nextSteps) ? nextSteps[0] : null
  if (Number(completion.percent || 0) < 100 || !preview.isPublished) {
    return {
      kind: 'profile',
      eyebrow: 'Следваща стъпка',
      title: firstStep?.title || (!preview.isPublished ? 'Направете профила видим' : 'Довършете профила си'),
      description: firstStep?.description || 'Добавете липсващата информация, за да получавате по-точни клиентски заявки.',
      cta: firstStep?.cta || 'Подобри профила',
      target: firstStep?.tab || 'profile',
      focusId: firstStep?.focusId || '',
    }
  }

  return {
    kind: 'ready',
    eyebrow: 'Най-важно сега',
    title: 'Следете новите запитвания',
    description: 'Профилът е видим и подготвен. Новите клиентски заявки ще се появят първо в секция „Запитвания“.',
    cta: 'Виж запитванията',
    target: 'inquiries',
  }
}
