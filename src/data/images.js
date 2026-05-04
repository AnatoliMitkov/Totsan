// Централен източник на изображения.
// Поддържаме смесен режим: Unsplash CDN и локални файлове от Public/Images.
// За локални файлове използвай P('file.webp') или директен path като '/Images/file.webp'.
// Работят стандартните browser формати: .webp, .jpg, .jpeg, .png, .svg, .avif.

const U = (id, w = 1200, h = null) => {
  const params = `auto=format&fit=crop&q=80&w=${w}` + (h ? `&h=${h}` : '')
  return `https://images.unsplash.com/photo-${id}?${params}`
}

const UD = (id, w = 1200) => `https://unsplash.com/photos/${id}/download?force=true&w=${w}&q=80`
const P = (fileOrPath) => {
  if (!fileOrPath) return ''
  if (/^(?:https?:)?\/\//i.test(fileOrPath) || fileOrPath.startsWith('data:') || fileOrPath.startsWith('blob:')) {
    return fileOrPath
  }

  const normalized = fileOrPath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^Public\//i, '')

  return normalized.includes('/') ? `/${normalized}` : `/Images/${normalized}`
}

// ── HERO снимки за всеки от 5-те слоя ───────────────────────────────
export const LAYER_HEROS = {
  ideya:        U('1503387762-592deb58ef4e', 1800),  // архитектурни скици
  postroyka:    U('1504307651254-35680f356dfd', 1800), // строеж
  materiali:    UD('yg-nrRoZcw0', 1800),               // материали / настилки
  obzavezhdane: U('1493663284031-b7e3aefcae8e', 1800), // модерна дневна
  dekoraciya:   UD('GNTohC2oSCM', 1800)                // стилизирана тераса / финален щрих
}

// ── "Какво намираш тук" thumbs (4 на слой = 20) ─────────────────────
export const WHAT_YOU_FIND_IMAGES = {
  ideya: {
    architect: U('1503551723145-6c040742065b', 600),    // архитектурна скица
    interior:  U('1586023492125-27b2c045efd7', 600),    // интериор муудборд
    render:    U('1545239351-1141bd82e8a6', 600),       // 3D рендер
    consult:   U('1551836022-d5d88e9218df', 600),       // консултация
  },
  postroyka: {
    build:      U('1541123437800-1bb1317badc2', 600),    // строеж
    contractor: U('1581094794329-c8112a89af12', 600),    // изпълнител
    ready:      U('1564013799919-ab600027ffc6', 600),    // готов имот
    engineer:   U('1581092918056-0c4c3acd3789', 600),    // инженер с план
  },
  materiali: {
    paints:     U('1562259949-e8e7689d7828', 600),      // бои / кофи
    tiles:      P('Plochki_1.jpg'),                     // плочки
    flooring:   P('floors.webp'),                       // подови настилки / локален файл
    windows:    UD('ZzAsUYP9kQw', 600),                 // дограма / прозорци
    insulation: U('1558618666-fcd25c85cd64', 600),      // изолация / конструкция
  },
  obzavezhdane: {
    kitchen:  U('1556909114-f6e7ad7d3136', 600),       // кухня
    bedroom:  U('1505691938895-1758d7feb511', 600),    // спалня
    bathroom: U('1552321554-5fefe8c9ef14', 600),       // баня
    lighting: U('1513506003901-1e6a229e2d15', 600),    // лампа / осветление
  },
  dekoraciya: {
    decor:     U('1493809842364-78817add7ffb', 600),    // декорации
    wallpaper: U('1558882224-dda166733046', 600),       // тапети
    garden:    U('1416879595882-3373a0480b5b', 600),    // градина
    terrace:   U('1505843513577-22bb7d21e455', 600),    // тераса
  }
}

// ── Услуги (хоризонтален слой) ──────────────────────────────────────
export const SERVICE_IMAGES = {
  'elektrichar':  U('1621905251189-08b45d6a269e', 800), // електричар
  'vik':          UD('uSfiDo13ois', 900),               // тръби / plumbing
  'otoplenie':    UD('PRvyVbLwJy0', 900),               // климатик / HVAC
  'ventilaciya':  UD('LI2rpZB12ms', 900),               // въздуховоди / vent
  'smart-home':   U('1558002038-1055907df827', 800),    // smart home таблет
  'alarmi':       UD('0wEi4OMKEZY', 900),               // security / CCTV
  'pochistvane':  U('1581578731548-c64695cc6952', 800), // почистване
  'premestvane':  UD('41S8eu6nImg', 900)                // преместване / хора + кашони
}

// ── Продукти / материали — реални снимки ─────────────────────────────
// Ключ = точното име от layers.js
export const PRODUCT_IMAGES = {
  // Слой 03 — материали
  'Caparol Indeko-plus':   U('1562259949-e8e7689d7828', 900),
  'Marazzi Cement Look':   UD('yg-nrRoZcw0', 900),
  'Schüco LivIng PVC':     UD('E8fXT092H5o', 900),
  'Knauf Diamant 12.5':    U('1503387762-592deb58ef4e', 900),
  'Quick-Step Capture':    UD('GctCfIx8taQ', 900),
  'Baumit StarTherm':      U('1558618666-fcd25c85cd64', 900),
  // Слой 04 — обзавеждане
  'Кухня „Линеа“':         U('1556909114-f6e7ad7d3136', 900),
  'Hansgrohe Talis E':     U('1552321554-5fefe8c9ef14', 900),
  'Bosch Series 8':        U('1574269910231-bc508bcb43f8', 900),
  'Диван „Arno“':          U('1567538096630-e0c55bd6374c', 900),
  'Flos IC Lights':        U('1513506003901-1e6a229e2d15', 900),
  'Гардероб по поръчка':   U('1505691938895-1758d7feb511', 900),
  // Слой 05 — декорация
  'Cole & Son „Palm Jungle“':       U('1558882224-dda166733046', 900),
  'Farrow & Ball „Hague Blue“':     U('1562259949-e8e7689d7828', 900),
  'Пергола „Bella“':                U('1505843513577-22bb7d21e455', 900),
  'Поливна система':                U('1416879595882-3373a0480b5b', 900),
  'Външно осветление':              U('1572177812156-58036aae439c', 900),
  'Кашпа „Terrazo“':                U('1485955900006-10f4d324d411', 900)
}

// ── Showcase / завършени проекти по слой ─────────────────────────────
export const SHOWCASE_IMAGES = {
  ideya: [
    U('1567016376408-0226e4d0c1ea', 900), // тавански
    U('1600566753190-17f0baa2a6c3', 900), // двуетажна къща
    U('1559925393-8be0ec4767c8', 900),    // кафене
  ],
  postroyka: [
    U('1600607687939-ce8a6c25118c', 900), // семейна къща
    U('1545324418-cc1a3fa10c00', 900),    // жилищна сграда
    U('1502672260266-1c1ef2d93688', 900), // готов апартамент
  ],
  materiali: [
    U('1556909114-f6e7ad7d3136', 900),    // микроцимент
    UD('yg-nrRoZcw0', 900),               // едроформат / настилка
    UD('ZzAsUYP9kQw', 900),               // дограма
  ],
  obzavezhdane: [
    U('1556909114-f6e7ad7d3136', 900),    // кухня + дневна
    U('1505691938895-1758d7feb511', 900), // спалня
    U('1552321554-5fefe8c9ef14', 900),    // баня
  ],
  dekoraciya: [
    U('1558882224-dda166733046', 900),    // акцентна стена
    UD('CZgbXM3-l1M', 900),               // тераса с мебели
    UD('VKwctsvXYcI', 900),               // декоративен patio кът
  ]
}

// ── Проекти за началната страница ───────────────────────────────────
export const HOME_PROJECTS = [
  U('1502672260266-1c1ef2d93688', 1200), // апартамент в София
  U('1600607687939-ce8a6c25118c', 1200), // семейна къща Пловдив
  U('1559925393-8be0ec4767c8', 1200),    // ресторант
]

// ── Колаж за hero ────────────────────────────────────────────────────
export const HERO_COLLAGE = [
  U('1493663284031-b7e3aefcae8e', 800),  // готов интериор
  U('1503387762-592deb58ef4e', 600),     // архитект
  U('1556909114-f6e7ad7d3136', 600),     // кухня
]

// ── Аватари ─────────────────────────────────────────────────────────
// Stock портрети + неутрални студио снимки за студия/фирми
const PORTRAITS = [
  U('1494790108377-be9c29b29330', 400, 400), // жена 1
  U('1507003211169-0a1dd7228f2d', 400, 400), // мъж 1
  U('1438761681033-6461ffad8d80', 400, 400), // жена 2
  U('1500648767791-00dcc994a43e', 400, 400), // мъж 2
  U('1573496359142-b8d87734a5a2', 400, 400), // жена 3
  U('1472099645785-5658abf4ff4e', 400, 400), // мъж 3
  U('1544005313-94ddf0286df2', 400, 400),    // жена 4
  U('1519085360753-af0119f7cbe7', 400, 400), // мъж 4
  U('1580489944761-15a19d654956', 400, 400), // жена 5
  U('1506794778202-cad84cf45f1d', 400, 400), // мъж 5
  U('1487412720507-e7ab37603c6f', 400, 400), // мъж 6
  U('1534528741775-53994a69daeb', 400, 400), // жена 6
  U('1517841905240-472988babdf9', 400, 400), // мъж 7
  U('1542206395-9feb3edaa68d', 400, 400),    // жена 7
]
const PERSON_AVATARS = {
  'Анна Петкова': PORTRAITS[2],
  'Илиян Радев': PORTRAITS[8],
}
const BADGE_TONES = [
  ['F1E7DE', '8A624B'],
  ['E6ECE8', '466656'],
  ['E8EBF4', '4F6286'],
  ['F1EADF', '9B6B3D'],
  ['EEE7F2', '705B86'],
  ['E7EFF0', '44737B'],
]

// прост детерминистичен hash (име → индекс)
function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Имена, които изглеждат като студио/фирма (не лице) — взимат офис снимка.
const STUDIO_HINTS = ['студио', 'studio', 'lab', 'group', 'арт', 'арти', 'project', 'проект', 'concept', 'group', 'house', 'home', 'build', 'construct', 'брокер', 'мер', 'консулт', 'материали', 'керамика', 'фасада', 'дограма', 'маркет', 'монтаж', 'mood', 'form', 'wall', 'outdoor', 'garden', 'final', 'decor', 'зелен', 'дом', 'каса', 'линеа', 'light', 'textile', 'арх']

function initials(name) {
  const words = (name || '')
    .replace(/["„“'`]+/g, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

  if (!words.length) return 'TT'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

function companyBadgeFor(name) {
  const [bg, fg] = BADGE_TONES[hash(name) % BADGE_TONES.length]
  const label = initials(name)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" role="img" aria-label="${name}">
      <rect width="80" height="80" rx="40" fill="#${bg}" />
      <circle cx="40" cy="40" r="39" fill="none" stroke="#FFFFFF" stroke-opacity="0.6" />
      <text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700" fill="#${fg}">${label}</text>
    </svg>
  `
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export function avatarFor(name) {
  if (PERSON_AVATARS[name]) return PERSON_AVATARS[name]
  const lower = (name || '').toLowerCase()
  if (STUDIO_HINTS.some(h => lower.includes(h))) {
    return companyBadgeFor(name)
  }
  return PORTRAITS[hash(name) % PORTRAITS.length]
}

// ── Партньорски лога (локални SVG файлове от Public/Logos) ──────────
export const PARTNER_LOGOS = [
  { name: 'Bauhaus',   logo: '/Logos/Bauhaus-Logo-SVG_005.svg' },
  { name: 'Praktiker', logo: '/Logos/praktiker.svg' },
  { name: 'IKEA',      logo: '/Logos/IKEA-Logo-1.svg' },
  { name: 'Schüco',    logo: '/Logos/Schuco-Logo-1.svg' },
  { name: 'Knauf',     logo: '/Logos/Knauf-Logo-2.svg' },
  { name: 'Caparol',   logo: '/Logos/caparol.svg' },
  { name: 'Kärcher',   logo: '/Logos/kaercher-5.svg' },
  { name: 'Bosch',     logo: '/Logos/bosch-logo-simple.svg' },
]

// ── Фолбек за продукт без явна снимка — взима по слой ──────────────
export function productImageFor(name, layerSlug) {
  if (PRODUCT_IMAGES[name]) return PRODUCT_IMAGES[name]
  const pool = SHOWCASE_IMAGES[layerSlug] || HOME_PROJECTS
  return pool[hash(name) % pool.length]
}
