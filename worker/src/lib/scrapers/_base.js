/**
 * Shared helpers for recipe HTML scrapers (Cloudflare Worker — no cheerio).
 */

// Longer tokens first so "gr" wins over "g", "cucchiaino" over "cucchiaio"
const UNIT_PATTERN =
  'cucchiaino|cucchiaini|cucchiaio|cucchiai|bustina|bustine|pizzico|pizzichi|confezione|confezioni|mazzetto|mazzetti|rametto|rametti|spicchio|spicchi|fetta|fette|pezzo|pezzi|gr|kg|mg|ml|cl|dl|lt|litro|litri|oz|lb|tsp|tbsp|g|l'

export function decodeHtmlEntities(text) {
  if (!text) return ''
  return String(text)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .trim()
}

export function stripTags(html) {
  return decodeHtmlEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
  ).trim()
}

/**
 * Remove Giallozafferano-style orange photo markers (1)(2)(3) from step HTML/text.
 */
export function cleanInstructionText(htmlOrText) {
  let html = String(htmlOrText || '')
  html = html.replace(
    /<(span|div|sup|i|em|b|strong)[^>]{0,200}>\s*\d{1,2}\s*<\/\1>/gi,
    ' '
  )
  html = html.replace(
    /<(span|div)[^>]*(?:gz-|num|marker|badge|circle|step|foto|photo)[^>]*>[\s\S]*?<\/\1>/gi,
    ' '
  )

  let text = stripTags(html)
  text = text.replace(/\s+(\d{1,2})(?=\s*[,.;])/g, '')
  text = text.replace(/\s+(\d{1,2})(?=\s+(?:e|ed|o|oppure|poi|quindi|infine)\b)/gi, '')
  text = text.replace(/\s+([,.;])/g, '$1')
  return text.replace(/\s{2,}/g, ' ').trim()
}

export function parseDurationMinutes(value) {
  if (value == null || value === '') return 0
  if (typeof value === 'number') return value
  const str = String(value)
  const iso = str.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i)
  if (iso) {
    return (Number(iso[1]) || 0) * 60 + (Number(iso[2]) || 0) + Math.round((Number(iso[3]) || 0) / 60)
  }
  const mins = str.match(/(\d+)\s*min/i)
  if (mins) return Number(mins[1])
  const hours = str.match(/(\d+)\s*h/i)
  if (hours) return Number(hours[1]) * 60
  const asNum = Number(str)
  return Number.isFinite(asNum) ? asNum : 0
}

export function parseServings(value) {
  if (value == null) return 4
  if (typeof value === 'number') return value || 4
  const m = String(value).match(/(\d+)/)
  return m ? Number(m[1]) : 4
}

export function coerceQuantity(value) {
  if (value === '' || value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const s = String(value).trim()
  if (!s) return null
  if (/^q\.?\s*b\.?$/i.test(s) || /^qb$/i.test(s)) return 'q.b.'
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (frac) {
    const n = Number(frac[1]) / Number(frac[2])
    return Number.isFinite(n) ? n : s
  }
  const normalized = s
    .replace(',', '.')
    .replace('½', '.5')
    .replace('¼', '.25')
    .replace('¾', '.75')
    .replace('⅓', '.33')
    .replace('⅔', '.67')
  const quantity = Number(normalized)
  return Number.isFinite(quantity) ? quantity : s
}

function normalizeUnit(unit) {
  const u = String(unit || '').trim().toLowerCase().replace(/\.$/, '')
  if (!u) return ''
  if (/^q\.?\s*b\.?$|^qb$/.test(u)) return '' // q.b. lives in quantity
  if (u === 'gr') return 'g'
  if (u === 'lt' || u === 'litro' || u === 'litri') return 'l'
  return u
}

function qtyToken() {
  return '([\\d½¼¾⅓⅔]+(?:[.,]\\d+)?(?:\\s*\\/\\s*\\d+)?)'
}

/** Italian number words → quantity */
const WORD_QTY_PATTERN =
  "un['’]?|una|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|mezzo|mezza"

const WORD_QTY_MAP = {
  un: 1,
  "un'": 1,
  "un’": 1,
  uno: 1,
  una: 1,
  due: 2,
  tre: 3,
  quattro: 4,
  cinque: 5,
  sei: 6,
  sette: 7,
  otto: 8,
  nove: 9,
  dieci: 10,
  mezzo: 0.5,
  mezza: 0.5
}

function wordToQuantity(word) {
  const key = String(word || '')
    .trim()
    .toLowerCase()
    .replace(/’/g, "'")
  return WORD_QTY_MAP[key] ?? null
}

/** Move trailing "(note)" into notes field when useful. */
function splitTrailingParenNotes(name) {
  const m = String(name || '').match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (!m) return { name: String(name || '').trim(), notes: '' }
  return { name: m[1].trim(), notes: m[2].trim() }
}

function withOptionalNotes(base) {
  const { name, notes } = splitTrailingParenNotes(base.name)
  return {
    ...base,
    name,
    notes: notes || base.notes || ''
  }
}

/**
 * Parse ingredient lines:
 * - "300 gr di farina 00" (IT common)
 * - "Farina Manitoba 200 g"
 * - "Olio q.b."
 * - "200 g spaghetti"
 */
export function parseIngredientLine(line) {
  let raw = stripTags(line)
  if (!raw) return null

  raw = raw
    .replace(/\u00a0/g, ' ')
    .replace(/\s*:\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // typo seen on some sites: farina'0 → farina 00
    .replace(/farina['’]0\b/gi, 'farina 00')

  const unit = UNIT_PATTERN
  const qty = qtyToken()

  // "Sale q.b." / "Olio extravergine q.b."
  let m = raw.match(/^(.+?)\s+q\.?\s*b\.?$/iu)
  if (m) {
    return withOptionalNotes({ name: m[1].trim(), quantity: 'q.b.', unit: '', notes: '' })
  }

  // "q.b. di sale"
  m = raw.match(/^q\.?\s*b\.?\s+(?:di\s+)?(.+)$/iu)
  if (m) {
    return withOptionalNotes({ name: m[1].trim(), quantity: 'q.b.', unit: '', notes: '' })
  }

  // "300 gr di farina" / "1 cucchiaio di olio" / "1/2 cucchiaino di zucchero"
  m = raw.match(new RegExp(`^${qty}\\s*(${unit})\\.?\\s+(?:di\\s+)?(.+)$`, 'iu'))
  if (m) {
    const unitNorm = normalizeUnit(m[2])
    const quantity = /^q/i.test(m[2]) ? 'q.b.' : coerceQuantity(m[1])
    return withOptionalNotes({
      name: m[3].trim(),
      quantity,
      unit: quantity === 'q.b.' ? '' : unitNorm,
      notes: ''
    })
  }

  // "Farina Manitoba 200 g"
  m = raw.match(new RegExp(`^(.+?)\\s+${qty}\\s*(${unit})\\.?$`, 'iu'))
  if (m) {
    return withOptionalNotes({
      name: m[1].trim(),
      quantity: coerceQuantity(m[2]),
      unit: normalizeUnit(m[3]),
      notes: ''
    })
  }

  // "Lievito fresco 10 g (oppure 1,5 g di secco)" — keep paren on name if it's a variant
  m = raw.match(new RegExp(`^(.+?)\\s+${qty}\\s*(${unit})\\.?\\s*(\\([^)]*\\))?$`, 'iu'))
  if (m) {
    const note = (m[4] || '').trim()
    return {
      name: `${m[1].trim()}${note ? ` ${note}` : ''}`.trim(),
      quantity: coerceQuantity(m[2]),
      unit: normalizeUnit(m[3]),
      notes: ''
    }
  }

  // Countable / no-unit: "6 tuorli medi freschissimi", "2 uova", "1 baccello di vaniglia"
  m = raw.match(new RegExp(`^${qty}\\s+(.+)$`, 'iu'))
  if (m) {
    const name = m[2].trim()
    if (name && !/^\d/.test(name)) {
      return withOptionalNotes({
        name,
        quantity: coerceQuantity(m[1]),
        unit: '',
        notes: ''
      })
    }
  }

  // Name then bare count (no unit) — common on GialloZafferano JSON-LD:
  // "Melanzane (violetta, di Vittoria) 1", "Uova 4"
  // Avoid false positives like "farina 00"
  m = raw.match(new RegExp(`^(.+?)\\s+${qty}$`, 'iu'))
  if (m) {
    const namePart = m[1].trim()
    const qRaw = String(m[2]).trim()
    const quantity = coerceQuantity(qRaw)
    const flourType = /^(0|00)$/.test(qRaw)
    const n = typeof quantity === 'number' ? quantity : null
    if (
      namePart &&
      !flourType &&
      !/^\d/.test(namePart) &&
      n != null &&
      n > 0 &&
      n <= 100
    ) {
      return withOptionalNotes({
        name: namePart,
        quantity: n,
        unit: '',
        notes: ''
      })
    }
  }

  // "un'arancia" / "un’olio" (elision, no space)
  m = raw.match(/^(un['’])([a-zà-ü].+)$/iu)
  if (m) {
    return withOptionalNotes({
      name: m[2].trim(),
      quantity: 1,
      unit: '',
      notes: ''
    })
  }

  // Word qty IT: "un limone non trattato (...)", "due uova", "una arancia"
  m = raw.match(new RegExp(`^(${WORD_QTY_PATTERN})\\s+(.+)$`, 'iu'))
  if (m) {
    const quantity = wordToQuantity(m[1])
    const name = m[2].trim()
    if (quantity != null && name && !/^\d/.test(name)) {
      return withOptionalNotes({
        name,
        quantity,
        unit: '',
        notes: ''
      })
    }
  }

  // "scorza di 1 limone" / "la scorza di 2 arance"
  m = raw.match(
    new RegExp(
      `^((?:la|il|lo|l['’])?\\s*[a-zà-ü][\\wà-ü'\\s]{1,40}?)\\s+di\\s+${qty}\\s+(.+)$`,
      'iu'
    )
  )
  if (m) {
    return withOptionalNotes({
      name: `${m[1].trim()} di ${m[3].trim()}`.replace(/\s+/g, ' '),
      quantity: coerceQuantity(m[2]),
      unit: '',
      notes: ''
    })
  }

  return withOptionalNotes({ name: raw, quantity: null, unit: '', notes: '' })
}

export function asArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

export function firstImage(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return firstImage(value[0])
  if (typeof value === 'object' && value.url) return value.url
  return null
}

export function emptyDraft(sourceUrl, sourceProvider = 'website') {
  return {
    title: '',
    servings: 4,
    prepTime: 0,
    cookTime: 0,
    difficulty: 'easy',
    cuisine: '',
    tags: [],
    notes: '',
    isShared: true,
    isPrivate: false,
    ingredients: [],
    steps: [],
    imageUrl: null,
    sourceUrl,
    sourceProvider
  }
}
