export const LEGAL_OPERATOR_NAME = 'СИ-МОУШЪН ЕООД'
export const LEGAL_OPERATOR_LATIN = 'SI-MOTION'
export const LEGAL_OPERATOR_EIK = '208548353'
export const LEGAL_OPERATOR_MANAGER = 'Ивайло Иванов Николов'
export const LEGAL_OPERATOR_ADDRESS = 'с. Липник 7242, ул. Никола Йонков Вапцаров № 3, обл. Разград, България'
export const LEGAL_OPERATOR_EMAIL = 'ivaylo.nikolov@simotionbg.com'
export const LEGAL_OPERATOR_PHONE = '+359895645164'
export const LEGAL_OPERATOR_IBAN = 'TODO: добавете IBAN само в защитен административен/фактурен контекст'
export const LEGAL_LAST_UPDATED = '05.07.2026'
export const SUBSCRIPTION_PAYMENT_PROVIDER_NAME = 'Stripe'
export const DUAL_PRICE_DISPLAY_END = '08.08.2026'

// TODO(legal/accounting): Confirm the VAT status immediately before publication.
export const VAT_STATUS_NOTE = 'Към момента операторът не е регистриран по ЗДДС.'

export const LEGAL_OPERATOR_SHORT = `${LEGAL_OPERATOR_NAME}, ЕИК ${LEGAL_OPERATOR_EIK}`
export const LEGAL_OPERATOR_FULL = `${LEGAL_OPERATOR_SHORT}, със седалище и адрес на управление: ${LEGAL_OPERATOR_ADDRESS}`

export const LEGAL_REVIEW_TODOS = [
  'Потвърждение на ЗДДС статуса от счетоводител.',
  'Потвърждение на юридически имейл и телефон за контакт.',
  'Потвърждение на фактурирането за партньорските абонаменти и другите собствени услуги на оператора.',
  'Финална редакция на Общите условия и Политиката за поверителност от адвокат.',
]