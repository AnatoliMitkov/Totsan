import { LAYERS } from '../data/layers.js'

export const PRODUCT_RELATION_SCOPE = {
  exact: 'exact',
  brand: 'brand',
  category: 'category',
  fallback: 'fallback',
}

export const MATERIAL_CATEGORIES = [
  { slug: 'interior-paint', label: 'интериорни бои', layerSlug: 'materiali' },
  { slug: 'porcelain-tiles', label: 'гранитогрес и плочки', layerSlug: 'materiali' },
  { slug: 'windows', label: 'дограма', layerSlug: 'materiali' },
  { slug: 'drywall', label: 'гипсокартон', layerSlug: 'materiali' },
  { slug: 'laminate-flooring', label: 'ламиниран паркет', layerSlug: 'materiali' },
  { slug: 'insulation', label: 'фасадна изолация', layerSlug: 'materiali' },
  { slug: 'custom-kitchens', label: 'кухни по поръчка', layerSlug: 'obzavezhdane' },
  { slug: 'bathroom-fixtures', label: 'смесители и санитария', layerSlug: 'obzavezhdane' },
  { slug: 'appliances', label: 'електроуреди', layerSlug: 'obzavezhdane' },
  { slug: 'sofas', label: 'мека мебел', layerSlug: 'obzavezhdane' },
  { slug: 'lighting', label: 'осветление', layerSlug: 'obzavezhdane' },
  { slug: 'wardrobes', label: 'гардероби по поръчка', layerSlug: 'obzavezhdane' },
  { slug: 'wallpapers', label: 'тапети', layerSlug: 'dekoraciya' },
  { slug: 'accent-paint', label: 'акцентни бои', layerSlug: 'dekoraciya' },
  { slug: 'pergolas', label: 'перголи', layerSlug: 'dekoraciya' },
  { slug: 'irrigation', label: 'поливни системи', layerSlug: 'dekoraciya' },
  { slug: 'outdoor-lighting', label: 'външно осветление', layerSlug: 'dekoraciya' },
  { slug: 'planters', label: 'кашпи и съдове', layerSlug: 'dekoraciya' },
]

export const PRODUCT_BRANDS = [
  { slug: 'caparol', label: 'Caparol', categorySlugs: ['interior-paint', 'accent-paint'] },
  { slug: 'marazzi', label: 'Marazzi', categorySlugs: ['porcelain-tiles'] },
  { slug: 'schuco', label: 'Schüco', categorySlugs: ['windows'] },
  { slug: 'knauf', label: 'Knauf', categorySlugs: ['drywall'] },
  { slug: 'quick-step', label: 'Quick-Step', categorySlugs: ['laminate-flooring'] },
  { slug: 'baumit', label: 'Baumit', categorySlugs: ['insulation'] },
  { slug: 'hansgrohe', label: 'Hansgrohe', categorySlugs: ['bathroom-fixtures'] },
  { slug: 'bosch', label: 'Bosch', categorySlugs: ['appliances'] },
  { slug: 'flos', label: 'Flos', categorySlugs: ['lighting'] },
  { slug: 'cole-and-son', label: 'Cole & Son', categorySlugs: ['wallpapers'] },
  { slug: 'farrow-and-ball', label: 'Farrow & Ball', categorySlugs: ['accent-paint'] },
]

const PRODUCT_METADATA = {
  'caparol-indeko-plus': { categorySlug: 'interior-paint', brandSlug: 'caparol' },
  'marazzi-cement-look': { categorySlug: 'porcelain-tiles', brandSlug: 'marazzi' },
  'schüco-living-pvc': { categorySlug: 'windows', brandSlug: 'schuco' },
  'knauf-diamant-12-5': { categorySlug: 'drywall', brandSlug: 'knauf' },
  'quick-step-capture': { categorySlug: 'laminate-flooring', brandSlug: 'quick-step' },
  'baumit-startherm': { categorySlug: 'insulation', brandSlug: 'baumit' },
  'кухня-линеа': { categorySlug: 'custom-kitchens', brandSlug: null },
  'hansgrohe-talis-e': { categorySlug: 'bathroom-fixtures', brandSlug: 'hansgrohe' },
  'bosch-series-8': { categorySlug: 'appliances', brandSlug: 'bosch' },
  'диван-arno': { categorySlug: 'sofas', brandSlug: null },
  'flos-ic-lights': { categorySlug: 'lighting', brandSlug: 'flos' },
  'гардероб-по-поръчка': { categorySlug: 'wardrobes', brandSlug: null },
  'cole-son-palm-jungle': { categorySlug: 'wallpapers', brandSlug: 'cole-and-son' },
  'farrow-ball-hague-blue': { categorySlug: 'accent-paint', brandSlug: 'farrow-and-ball' },
  'пергола-bella': { categorySlug: 'pergolas', brandSlug: null },
  'поливна-система': { categorySlug: 'irrigation', brandSlug: null },
  'външно-осветление': { categorySlug: 'outdoor-lighting', brandSlug: null },
  'кашпа-terrazo': { categorySlug: 'planters', brandSlug: null },
}

const CATEGORY_BY_SLUG = new Map(MATERIAL_CATEGORIES.map(item => [item.slug, item]))
const BRAND_BY_SLUG = new Map(PRODUCT_BRANDS.map(item => [item.slug, item]))

export function productSlugFor(value = '') {
  return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
}

export function getMaterialCategory(slug) {
  return CATEGORY_BY_SLUG.get(slug) || null
}

export function getProductBrand(slug) {
  return BRAND_BY_SLUG.get(slug) || null
}

export function getMaterialCategories({ layerSlug = 'all' } = {}) {
  return MATERIAL_CATEGORIES.filter(item => layerSlug === 'all' || item.layerSlug === layerSlug)
}

export function getBrandsForCategory(categorySlug) {
  return PRODUCT_BRANDS.filter(brand => brand.categorySlugs.includes(categorySlug))
}

export function normalizeStaticProduct(product = {}, layer = {}) {
  const slug = product.slug || productSlugFor(product.name)
  const meta = PRODUCT_METADATA[slug] || {}
  const category = getMaterialCategory(meta.categorySlug) || {
    slug: productSlugFor(product.cat || 'product'),
    label: product.cat || 'продукт',
    layerSlug: layer.slug,
  }
  const brand = meta.brandSlug ? getProductBrand(meta.brandSlug) : null

  return {
    ...product,
    kind: 'product',
    slug,
    layer: layer.slug,
    layerSlug: layer.slug,
    layerNumber: layer.number,
    layerTitle: layer.title,
    sub: product.cat,
    categorySlug: category.slug,
    categoryLabel: category.label,
    brandSlug: brand?.slug || null,
    brandLabel: brand?.label || null,
  }
}

const STATIC_PRODUCT_CATALOG = LAYERS.flatMap(layer => (layer.products || []).map(product => normalizeStaticProduct(product, layer)))

export function getStaticProductCatalog() {
  return STATIC_PRODUCT_CATALOG
}

export function getStaticProductsForLayer(layerSlug) {
  return STATIC_PRODUCT_CATALOG.filter(product => product.layerSlug === layerSlug)
}

export function findStaticProductBySlug(slug) {
  return STATIC_PRODUCT_CATALOG.find(product => product.slug === slug) || null
}

export function normalizeProductItem(item = {}) {
  if (item.categorySlug && item.slug) return item
  const slug = item.slug || productSlugFor(item.name)
  const known = findStaticProductBySlug(slug)
  if (!known) return { ...item, slug }
  return { ...known, ...item, slug: known.slug }
}
