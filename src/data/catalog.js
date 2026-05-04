import { LAYERS, SERVICES } from './layers.js'

// Богати данни за подкатегория услуги
export const SERVICE_DETAILS = [
  { slug:'elektrichar', name:'Електричар', icon:'⚡', short:'Контакти, осветление, табла, проверки.', work:'Подмяна на ел. инсталация, монтаж на осветителни тела, поправка на табло, изваждане на нови контакти, добавяне на щранг.' },
  { slug:'vik', name:'ВиК', icon:'🔧', short:'Тръби, смесители, бойлери, отпушване.', work:'Подмяна на щрангове, монтаж на смесители, ремонт на бойлер, отпушване, монтаж на санитария.' },
  { slug:'otoplenie', name:'Отопление и климатизация', icon:'🌡️', short:'Климатици, парно, подово отопление.', work:'Монтаж на климатици, инсталация на подово отопление, проверка и сервиз на котел.' },
  { slug:'ventilaciya', name:'Вентилация', icon:'💨', short:'Аспирации, рекуператори, въздуховоди.', work:'Монтаж на рекуператори за свеж въздух, аспирационни системи за кухни и санитарни помещения.' },
  { slug:'smart-home', name:'Smart Home', icon:'📱', short:'Светлини, охрана, сценарии, гласово управление.', work:'Управление на осветление, щори, климатик и звук през телефон. Сценарии „Сутрин/Вечер/Излизам“.' },
  { slug:'alarmi', name:'Алармени системи', icon:'🔒', short:'Сигнализация, камери, контрол на достъп.', work:'Алармени централи, IP камери, видеодомофони, контрол на достъп с карти и кодове.' },
  { slug:'pochistvane', name:'Почистване след ремонт', icon:'🧽', short:'Прах, лепило, боя, прозорци — отиват си.', work:'Дълбоко почистване след строителни и ремонтни работи. Включва прозорци, остъкления, фуги.' },
  { slug:'premestvane', name:'Преместване', icon:'📦', short:'Опаковане, транспорт, монтаж на ново място.', work:'Преместване на жилище или офис с опаковка, транспорт и помощ при подреждане.' }
]

// Каталог: обединява специалисти + продукти от всички слоеве
export function buildCatalog() {
  const items = []
  LAYERS.forEach(l => {
    l.professionals.forEach(p => items.push({
      kind: 'pro', layer: l.slug, layerNumber: l.number, layerTitle: l.title,
      name: p.name, sub: p.tag, city: p.city, rating: p.rating, projects: p.projects, since: p.since
    }))
    if (l.products) {
      l.products.forEach(p => items.push({
        kind: 'product', layer: l.slug, layerNumber: l.number, layerTitle: l.title,
        name: p.name, sub: p.cat, price: p.price, tag: p.tag
      }))
    }
  })
  return items
}

export { LAYERS, SERVICES }
