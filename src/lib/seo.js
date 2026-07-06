import { useEffect } from 'react'
import { LAYERS } from '../data/layers.js'
import { CANONICAL_ORIGIN, isNoindexPath, toAbsoluteUrl, toCanonicalPath } from './site-routes.js'

const DEFAULT_TITLE = 'Totsan — пространството ти, създадено както трябва'
const DEFAULT_DESCRIPTION = 'Totsan е платформа за ремонт, строителство и обзавеждане. Свързваме те с проверени специалисти, услуги и материали за твоя етап от проекта.'
const DEFAULT_IMAGE = `${CANONICAL_ORIGIN}/Logos/TD-Logo.jpg`

const STATIC_ROUTE_SEO = {
  '/': {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    jsonLd: [buildOrganizationSchema(), buildWebsiteSchema()],
  },
  '/start': {
    title: 'Започни проект — Guided Project Brief | Totsan',
    description: 'Отговори на три кратки въпроса и Totsan ще те насочи към правилния слой, специалист или следваща стъпка за проекта ти.',
  },
  '/uslugi': {
    title: 'Услуги и пакети от партньори | Totsan',
    description: 'Разгледай публикувани партньорски услуги с ясен обхват, цена и директен път към разговор с партньора.',
  },
  '/katalog': {
    title: 'Каталог със специалисти, услуги и материали | Totsan',
    description: 'Намери проверени специалисти, одобрени услуги и материални решения за петте слоя на ремонта, строителството и обзавеждането.',
  },
  '/pro': {
    title: 'Totsan Pro — за специалисти, студиа и марки',
    description: 'Totsan Pro събира профил, услуги, заявки и чат на едно място за майстори, студиа, изпълнители и марки.',
  },
  '/kak-raboti': {
    title: 'Как работи Totsan',
    description: 'Виж как Totsan подрежда проекта ти в пет слоя и те води от brief до правилния специалист, услуга или материално решение.',
  },
  '/za-nas': {
    title: 'За Totsan',
    description: 'Научи повече за Totsan, подхода ни към проверените партньори и защо подреждаме целия процес в пет ясни слоя.',
  },
  '/kontakt': {
    title: 'Контакт | Totsan',
    description: 'Изпрати кратко запитване до Totsan и ще се върнем с подходящи хора и следващи стъпки за проекта ти.',
  },
  '/obshti-usloviya': {
    title: 'Общи условия | Totsan',
    description: 'Общи условия за използване на платформата Totsan.',
  },
  '/politika-za-poveritelnost': {
    title: 'Политика за поверителност | Totsan',
    description: 'Политика за поверителност и обработване на лични данни в Totsan.',
  },
  '/vizualizacia': {
    title: '3D визуализация | Totsan',
    description: 'Разгледай 3D визуализация като част от началните слоеве на проекта и заяви следваща стъпка през Totsan.',
  },
  '/gradina-i-dvor': {
    title: 'Градина и двор | Totsan',
    description: 'Идеи, специалисти и решения за градина, двор и външни пространства в слоя за декорация и финал.',
  },
  '/tapeti-i-cvetove': {
    title: 'Тапети и цветове | Totsan',
    description: 'Разгледай идеи, материали и специалисти за тапети, акцентни стени и цветови решения през Totsan.',
  },
  '/dekorativni-akcenti': {
    title: 'Декоративни акценти | Totsan',
    description: 'Подбрани идеи и решения за декоративни акценти, финални щрихи и завършен вид на пространството.',
  },
  '/terasi-i-vunshni-zoni': {
    title: 'Тераси и външни зони | Totsan',
    description: 'Решения за тераси, външни зони, осветление, перголи и озеленяване през финалния слой на Totsan.',
  },
  '/kuhni': {
    title: 'Кухни | Totsan',
    description: 'Разгледай кухни, мебели по поръчка и свързани специалисти и материални решения за слоя на обзавеждането.',
  },
  '/spalnya-i-dnevna': {
    title: 'Спалня и дневна | Totsan',
    description: 'Идеи и решения за спалня и дневна с правилните специалисти, материали и следващи стъпки в Totsan.',
  },
  '/banya': {
    title: 'Баня | Totsan',
    description: 'Специалисти, услуги и материални решения за баня, довършителни работи и обзавеждане през Totsan.',
  },
  '/osvetlenie-i-tekstil': {
    title: 'Осветление и текстил | Totsan',
    description: 'Открий осветление, текстил и финални решения за завършване на интериора и атмосферата у дома.',
  },
}

export function getDefaultSeo(pathname = '/') {
  const canonicalPath = toCanonicalPath(pathname)
  const layerMatch = canonicalPath.match(/^\/sloy\/([^/]+)$/u)

  if (layerMatch) {
    const layer = LAYERS.find((item) => item.slug === layerMatch[1])
    if (layer) {
      return {
        title: `Слой ${layer.number} · ${layer.title} | Totsan`,
        description: layer.long,
        canonicalPath,
        jsonLd: [
          buildBreadcrumbSchema([
            { name: 'Начало', path: '/' },
            { name: layer.title, path: canonicalPath },
          ]),
        ],
      }
    }
  }

  if (/^\/profil\/[^/]+$/u.test(canonicalPath)) {
    return {
      title: 'Профил на специалист | Totsan',
      description: 'Разгледай публичния профил на специалист в Totsan, с описание, град, услуги, портфолио и възможност за запитване.',
      canonicalPath,
    }
  }

  if (/^\/uslugi\/[^/]+$/u.test(canonicalPath)) {
    return {
      title: 'Партньорска услуга | Totsan',
      description: 'Виж детайли за одобрена партньорска услуга в Totsan, с ясен обхват, FAQ и възможност за директен разговор с партньора.',
      canonicalPath,
    }
  }

  if (/^\/produkt\/[^/]+$/u.test(canonicalPath)) {
    return {
      title: 'Материално решение | Totsan',
      description: 'Разгледай материално решение в Totsan с контекст, слой, свързани специалисти и следваща стъпка към запитване.',
      canonicalPath,
    }
  }

  if (STATIC_ROUTE_SEO[canonicalPath]) {
    return {
      ...STATIC_ROUTE_SEO[canonicalPath],
      canonicalPath,
    }
  }

  if (isNoindexPath(canonicalPath)) {
    return {
      title: 'Лична зона | Totsan',
      description: 'Тази страница е част от личната зона на Totsan и не е предназначена за индексиране.',
      canonicalPath,
      robots: 'noindex, nofollow',
    }
  }

  return {
    title: 'Страницата не е намерена | Totsan',
    description: 'Страницата не е налична или линкът е невалиден.',
    canonicalPath,
    robots: 'noindex, nofollow',
  }
}

export function applySeo(config = {}) {
  if (typeof document === 'undefined') return
  if (!config) return

  const canonicalPath = config.canonicalPath || (typeof window !== 'undefined' ? window.location.pathname : '/')
  const canonicalUrl = config.canonicalUrl || toAbsoluteUrl(canonicalPath)
  const title = config.title || DEFAULT_TITLE
  const description = config.description || DEFAULT_DESCRIPTION
  const robots = config.robots || (isNoindexPath(canonicalPath) ? 'noindex, nofollow' : 'index, follow')
  const ogTitle = config.ogTitle || title
  const ogDescription = config.ogDescription || description
  const ogImage = config.ogImage || DEFAULT_IMAGE
  const twitterCard = config.twitterCard || 'summary_large_image'
  const jsonLd = Array.isArray(config.jsonLd) ? config.jsonLd.filter(Boolean) : config.jsonLd ? [config.jsonLd] : []

  document.title = title

  upsertMeta('name', 'description', description)
  upsertMeta('name', 'robots', robots)
  upsertLink('canonical', canonicalUrl)
  upsertMeta('property', 'og:type', config.ogType || 'website')
  upsertMeta('property', 'og:site_name', 'Totsan')
  upsertMeta('property', 'og:locale', 'bg_BG')
  upsertMeta('property', 'og:title', ogTitle)
  upsertMeta('property', 'og:description', ogDescription)
  upsertMeta('property', 'og:url', canonicalUrl)
  upsertMeta('property', 'og:image', ogImage)
  upsertMeta('name', 'twitter:card', twitterCard)
  upsertMeta('name', 'twitter:title', config.twitterTitle || ogTitle)
  upsertMeta('name', 'twitter:description', config.twitterDescription || ogDescription)
  upsertMeta('name', 'twitter:image', config.twitterImage || ogImage)
  replaceJsonLd(jsonLd)
}

export function useSeo(config) {
  const jsonLdKey = JSON.stringify(config?.jsonLd || null)

  useEffect(() => {
    if (!config) return
    applySeo(config)
  }, [
    config?.canonicalPath,
    config?.canonicalUrl,
    config?.description,
    jsonLdKey,
    config?.ogDescription,
    config?.ogImage,
    config?.ogTitle,
    config?.ogType,
    config?.robots,
    config?.title,
    config?.twitterCard,
    config?.twitterDescription,
    config?.twitterImage,
    config?.twitterTitle,
  ])
}

export function buildBreadcrumbSchema(items = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: toAbsoluteUrl(item.path),
    })),
  }
}

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Totsan',
    url: `${CANONICAL_ORIGIN}/`,
    logo: DEFAULT_IMAGE,
  }
}

export function buildWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Totsan',
    url: `${CANONICAL_ORIGIN}/`,
  }
}

export function buildFaqSchema(items = []) {
  const mainEntity = items
    .filter((item) => item?.question && item?.answer)
    .map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    }))

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity,
  }
}

export function buildPersonSchema(profile, path) {
  const sameAs = [profile?.website, profile?.instagram, profile?.facebook].filter(Boolean)
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile?.name,
    description: profile?.headline || profile?.descriptionLong || profile?.bio || undefined,
    image: profile?.imageUrl || profile?.image_url || undefined,
    jobTitle: profile?.tag || undefined,
    url: toAbsoluteUrl(path),
    address: profile?.city ? {
      '@type': 'PostalAddress',
      addressLocality: profile.city,
      addressCountry: 'BG',
    } : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  }

  return stripEmpty(schema)
}

export function buildServiceSchema(service, profile, path) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service?.title,
    description: service?.subtitle || service?.descriptionMd || undefined,
    category: service?.layerSlug || undefined,
    url: toAbsoluteUrl(path),
    areaServed: (service?.deliveryAreas || []).filter(Boolean).map((city) => ({
      '@type': 'City',
      name: city,
    })),
    provider: profile?.name ? stripEmpty({
      '@type': 'Person',
      name: profile.name,
      url: profile.slug ? toAbsoluteUrl(`/profil/${profile.slug}`) : undefined,
    }) : undefined,
  }

  return stripEmpty(schema)
}

function stripEmpty(value) {
  if (Array.isArray(value)) return value.map(stripEmpty).filter(Boolean)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => {
        if (Array.isArray(entry)) return entry.length > 0
        return entry !== undefined && entry !== null && entry !== ''
      })
      .map(([key, entry]) => [key, stripEmpty(entry)]),
  )
}

function upsertMeta(attributeName, attributeValue, content) {
  let node = document.head.querySelector(`meta[${attributeName}="${attributeValue}"]`)
  if (!node) {
    node = document.createElement('meta')
    node.setAttribute(attributeName, attributeValue)
    document.head.appendChild(node)
  }
  node.setAttribute('content', content)
  node.setAttribute('data-totsan-seo', 'managed')
}

function upsertLink(rel, href) {
  let node = document.head.querySelector(`link[rel="${rel}"]`)
  if (!node) {
    node = document.createElement('link')
    node.setAttribute('rel', rel)
    document.head.appendChild(node)
  }
  node.setAttribute('href', href)
  node.setAttribute('data-totsan-seo', 'managed')
}

function replaceJsonLd(entries) {
  document.head.querySelectorAll('script[data-totsan-seo="jsonld"]').forEach((node) => node.remove())
  entries.forEach((entry) => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute('data-totsan-seo', 'jsonld')
    script.textContent = JSON.stringify(entry)
    document.head.appendChild(script)
  })
}
