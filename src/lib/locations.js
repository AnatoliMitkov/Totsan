import { BULGARIA_CITIES } from '../data/bulgaria-cities.js'

export { BULGARIA_CITIES }

export const BULGARIA_REGIONS = Array.from(new Set(BULGARIA_CITIES.map((city) => city.oblast)))

export const BULGARIA_SETTLEMENTS = BULGARIA_CITIES.map((city) => ({
  ...city,
  label: city.name,
  region: city.oblast,
  aliases: [city.nameEn, city.slug, city.searchText].filter(Boolean),
}))

function cleanLocationText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function keyForLocation(value) {
  return cleanLocationText(value)
    .toLocaleLowerCase('bg-BG')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
}

export function cityStorageValue(city) {
  return city ? `${city.name} — ${city.oblast}` : ''
}

export function cityDisplayValue(city) {
  return city ? `${city.name}, обл. ${city.oblast}` : ''
}

function splitStoredLocation(value) {
  const clean = cleanLocationText(value)
  if (!clean) return null

  const match = clean.match(/^(.+?)(?:\s*,\s*обл\.\s*|\s*[–—-]\s*)(.+)$/i)
  if (!match) return null

  return {
    name: cleanLocationText(match[1]),
    oblast: cleanLocationText(match[2]),
  }
}

const CITY_BY_ID = new Map()
const CITY_BY_FULL_KEY = new Map()
const CITY_BY_SEARCH_KEY = new Map()
const CITIES_BY_NAME_KEY = new Map()

BULGARIA_CITIES.forEach((city) => {
  CITY_BY_ID.set(city.id, city)
  CITY_BY_FULL_KEY.set(`${city.slug}|${city.oblastSlug}`, city)
  CITY_BY_SEARCH_KEY.set(keyForLocation(cityStorageValue(city)), city)
  CITY_BY_SEARCH_KEY.set(keyForLocation(cityDisplayValue(city)), city)
  CITY_BY_SEARCH_KEY.set(keyForLocation(`${city.name} ${city.oblast}`), city)
  CITY_BY_SEARCH_KEY.set(keyForLocation(`${city.nameEn} ${city.oblast}`), city)
  CITY_BY_SEARCH_KEY.set(keyForLocation(`${city.slug} ${city.oblastSlug}`), city)

  const nameKey = keyForLocation(city.name)
  const sameName = CITIES_BY_NAME_KEY.get(nameKey) || []
  sameName.push(city)
  CITIES_BY_NAME_KEY.set(nameKey, sameName)

  for (const alias of [city.nameEn, city.slug]) {
    const aliasKey = keyForLocation(alias)
    if (!aliasKey || CITY_BY_SEARCH_KEY.has(aliasKey)) continue
    const sameAlias = BULGARIA_CITIES.filter((item) => keyForLocation(item.nameEn) === aliasKey || keyForLocation(item.slug) === aliasKey)
    if (sameAlias.length === 1) CITY_BY_SEARCH_KEY.set(aliasKey, city)
  }
})

export function findBulgarianCity(value, oblast = '') {
  const clean = cleanLocationText(value)
  if (!clean) return null

  if (CITY_BY_ID.has(clean)) return CITY_BY_ID.get(clean)

  const split = splitStoredLocation(clean)
  if (split) {
    const fullKey = keyForLocation(`${split.name} ${split.oblast}`)
    const found = CITY_BY_SEARCH_KEY.get(fullKey)
    if (found) return found
  }

  const rawKey = keyForLocation(clean)
  const oblastKey = keyForLocation(oblast)
  if (oblastKey) {
    const exactInOblast = BULGARIA_CITIES.find((city) => (
      keyForLocation(city.name) === rawKey &&
      keyForLocation(city.oblast) === oblastKey
    ))
    if (exactInOblast) return exactInOblast
  }

  const direct = CITY_BY_SEARCH_KEY.get(rawKey)
  if (direct) return direct

  const sameName = CITIES_BY_NAME_KEY.get(rawKey) || []
  return sameName.length === 1 ? sameName[0] : null
}

export function findBulgarianSettlement(value, oblast = '') {
  return findBulgarianCity(value, oblast)
}

export function isOfficialBulgarianCity(value, oblast = '') {
  return Boolean(findBulgarianCity(value, oblast))
}

export function normalizeLocationValue(value, options = {}) {
  const clean = cleanLocationText(value)
  if (!clean) return ''

  const city = findBulgarianCity(clean, options.oblast)
  if (!city) return clean

  if (options.storage === 'cityWithOblast') return cityStorageValue(city)
  if (options.storage === 'id') return city.id
  return city.name
}

export function normalizeLocationList(value, options = {}) {
  const storage = options.storage || 'cityWithOblast'
  const list = Array.isArray(value) ? value : String(value || '').split(/,\s*(?!обл\.)/i)
  const seen = new Set()
  const normalized = []

  list.forEach((item) => {
    const city = findBulgarianCity(item)
    const label = city ? normalizeLocationValue(city.id, { storage }) : cleanLocationText(item)
    const key = city ? locationCountKey(city.id) : keyForLocation(label)
    if (!label || seen.has(key)) return
    seen.add(key)
    normalized.push(label)
  })

  return normalized
}

export function locationCountKey(value) {
  const city = findBulgarianCity(value)
  return city ? `${city.slug}|${city.oblastSlug}` : ''
}

export function locationDisplayValue(value) {
  const city = findBulgarianCity(value)
  return city ? cityDisplayValue(city) : cleanLocationText(value)
}
