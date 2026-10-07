/**
 * Shared helpers for recipe HTML scrapers (Cloudflare Worker — no cheerio).
 */

// Longer tokens first so "gr" wins over "g", "cucchiaino" over "cucchiaio"
const UNIT_PATTERN =
  'cucchiaino|cucchiaini|cucchiaio|cucchiai|bustina|bustine|pizzico|pizzichi|confezione|confezioni|mazzetto|mazzetti|rametto|rametti|spicchio|spicchi|fetta|fette|pezzo|pezzi|bicchiere|bicchieri|tazzina|tazzine|tazza|tazze|manciata|manciate|cups|cup|gr|kg|mg|ml|cl|dl|lt|litro|litri|oz|lbs|lb|tsp|tbsp|g|l'

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

/** Mass/volume units — recipeYield is total product, NOT people servings. */
const YIELD_MASS_VOLUME_RE =
  /(\d+(?:[.,]\d+)?)\s*(g|gr|grammi?|kg|chilogrammi?|ml|millilitri|cl|dl|l|litri?|oz|lb|lbs|pounds?)\b/i

/** Explicit people / portion wording. */
const YIELD_PEOPLE_RE =
  /(\d+)\s*(?:-|–|a|to)?\s*(?:porzioni?|persone|servings?|serves?|pers\.?|pax|people|diners?)\b/i

const DEFAULT_SERVINGS = 4
/** Bare numbers above this without unit/wording are almost never servings. */
const MAX_PLAUSIBLE_SERVINGS = 48

/**
 * Giallozafferano & similar: "Dosi per: 850 grammi" in the page body.
 */
export function extractDosiPerFromHtml(html) {
  const raw = String(html || '')
  const strong = raw.match(/Dosi\s*per\s*:\s*<strong>\s*([^<]+?)\s*<\/strong>/i)
  if (strong?.[1]) return strong[1].trim()
  const plain = raw.match(/Dosi\s*per\s*:\s*([^<\n]{1,60})/i)
  if (plain?.[1]) return plain[1].replace(/<[^>]+>/g, '').trim()
  return null
}

function normalizeYieldUnit(unit) {
  const u = String(unit || '').toLowerCase().replace(/\.$/, '')
  if (u === 'gr' || /^gramm/i.test(u)) return 'g'
  if (/^chilogramm/i.test(u)) return 'kg'
  if (/^millilit/i.test(u)) return 'ml'
  if (/^litri?$/i.test(u)) return 'l'
  if (u === 'lbs' || u === 'pounds' || u === 'pound') return 'lb'
  return u
}

function formatYieldLabel(amount, unit) {
  const n = String(amount).replace(',', '.')
  return `${n} ${normalizeYieldUnit(unit)}`
}

/**
 * Resolve schema.org recipeYield (often a bare number) into servings vs product yield.
 * Ex: GZ Hummus → recipeYield:850 + "Dosi per: 850 grammi" → servings 4, yield "850 g"
 */
export function resolveRecipeYield(value, html = '') {
  const texts = []
  const dosiPer = extractDosiPerFromHtml(html)
  if (dosiPer) texts.push(dosiPer)
  for (const item of asArray(value)) {
    if (item == null || item === '') continue
    texts.push(typeof item === 'number' ? String(item) : String(item).trim())
  }

  let servings = null
  let yieldLabel = null

  for (const text of texts) {
    const people = text.match(YIELD_PEOPLE_RE)
    if (people && servings == null) {
      const n = Number(people[1])
      if (n > 0) servings = n
    }

    const mass = text.match(YIELD_MASS_VOLUME_RE)
    if (mass && !yieldLabel) {
      yieldLabel = formatYieldLabel(mass[1], mass[2])
    }
  }

  // Bare numeric recipeYield (common on Giallozafferano)
  const bare =
    typeof value === 'number'
      ? value
      : /^\d+(?:[.,]\d+)?$/.test(String(value ?? '').trim())
        ? Number(String(value).replace(',', '.'))
        : null

  if (bare != null && Number.isFinite(bare) && bare > 0) {
    if (yieldLabel) {
      // Number is the mass/volume amount, not portions
    } else if (bare <= MAX_PLAUSIBLE_SERVINGS) {
      servings = servings ?? Math.round(bare)
    } else {
      // e.g. 850 with no unit in JSON-LD and no HTML context
      yieldLabel = String(Math.round(bare))
    }
  }

  if (servings == null) {
    for (const text of texts) {
      if (YIELD_MASS_VOLUME_RE.test(text) || YIELD_PEOPLE_RE.test(text)) continue
      if (/^\d+$/.test(text)) continue
      const m = text.match(/(\d+)/)
      if (m) {
        const n = Number(m[1])
        if (n > 0 && n <= MAX_PLAUSIBLE_SERVINGS) {
          servings = n
          break
        }
      }
    }
  }

  return {
    servings: servings && servings > 0 ? servings : DEFAULT_SERVINGS,
    yieldLabel
  }
}

/** @deprecated Prefer resolveRecipeYield — kept for call sites that only need a number. */
export function parseServings(value, html = '') {
  return resolveRecipeYield(value, html).servings
}

export function coerceQuantity(value) {
  if (value === '' || value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const s = String(value).trim()
  if (!s) return null
  if (/^q\.?\s*b\.?$/i.test(s) || /^qb$/i.test(s)) return 'q.b.'
  // Range "5 – 6" / "1-2" stays text (normalized "5-6"); scaling and nutrition read it.
  const range = s.match(/^(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)$/)
  if (range) return `${range[1]}-${range[2]}`
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/)
  if (mixed) {
    const n = Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
    return Number.isFinite(n) ? n : s
  }
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
  const single = '(?:\\d+\\s+\\d+\\s*\\/\\s*\\d+|[\\d½¼¾⅓⅔]+(?:[.,]\\d+)?(?:\\s*\\/\\s*\\d+)?)'
  // "5 – 6" range; first number never "0"/"00" so "farina 00 - 300 g" is not a range
  return `((?!0+\\b)${single}\\s*[-–—]\\s*\\d+(?:[.,]\\d+)?(?![\\d\\/])|${single})`
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

function cleanParenNote(inner) {
  return String(inner || '')
    .replace(/^[\s,;]+/, '')
    .replace(/^\(([^()]*)\)$/, '$1')
    .trim()
}

/** Index of the "(" matching the ")" at `close`, or -1 (balanced, handles nesting). */
function matchingOpen(s, close) {
  let depth = 0
  for (let i = close; i >= 0; i--) {
    if (s[i] === ')') depth++
    else if (s[i] === '(' && --depth === 0) return i
  }
  return -1
}

function matchingClose(s, open) {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')' && --depth === 0) return i
  }
  return -1
}

/**
 * Move leading / trailing "(note)" groups into notes:
 * "burro fuso (oppure olio di semi)", "beef mince ((ground beef) (Note 1))",
 * "(tightly packed) mozzarella cheese".
 */
function splitTrailingParenNotes(name) {
  let s = String(name || '').trim()
  const notes = []
  if (s.startsWith('(')) {
    const close = matchingClose(s, 0)
    if (close > 0 && s.slice(close + 1).trim()) {
      notes.push(cleanParenNote(s.slice(1, close)))
      s = s.slice(close + 1).trim()
    }
  }
  const trailing = []
  while (s.endsWith(')')) {
    const open = matchingOpen(s, s.length - 1)
    if (open <= 0 || !s.slice(0, open).trim()) break
    trailing.unshift(cleanParenNote(s.slice(open + 1, -1)))
    s = s.slice(0, open).trim()
  }
  return { name: s, notes: [...notes, ...trailing].filter(Boolean).join('; ') }
}

const UNIT_ADJECTIVE_RE =
  /^(abbondant[ei]|scars[oaie]|ras[oaie]|colm[oaie]|generos[oaie]|pien[oaie]|heaping|heaped|rounded|level|scant)\s+(?:di\s+|of\s+)?(.+)$/i

function joinNotes(...parts) {
  return parts.map((p) => String(p || '').trim()).filter(Boolean).join(' — ')
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
 * Parse ingredient lines — regola generale:
 *
 * 1) Se la riga INIZIA con quantità[+unità], quella è la dose; il resto è il nome
 *    ("300 g di piselli freschi", "2 uova").
 * 2) Altrimenti, se compare quantità+unità DOPO un nome, spezza lì:
 *    nome | qty | unit | eventuale testo dopo → notes
 *    ("piselli 300 g freschi o surgelati", "Farina Manitoba 200 g").
 * 3) Casi speciali: q.b., quantità in lettere, conteggio senza unità in coda.
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
    // "farina '00" / "farina di grano tenero ‘00" → "… 00"
    .replace(/\b(farina\b[^,()]*?)\s+['’‘](0{1,2})(?!\d)/gi, '$1 $2')
    // WP Recipe Maker notes: "(, finely chopped)"
    .replace(/\(\s*,\s*/g, '(')
  if (!raw) return null

  const unit = UNIT_PATTERN
  const qty = qtyToken()
  const extraNotes = []

  // Alternative measure: "1 kg / 2 lb beef mince", "60g / 4 tbsp butter", "350g/ 12 oz sheets"
  const qtyGroup = `(?:${qty.slice(1, -1)})`
  const alt = raw.match(
    new RegExp(
      `^(${qtyGroup})\\s*(${unit})\\.?\\s*\\/\\s*(${qtyGroup}\\s*(?:${unit})\\.?)(?![a-zà-ÿ])\\s*(.+)$`,
      'iu'
    )
  )
  if (alt) {
    raw = `${alt[1]} ${alt[2]} ${alt[4]}`
    extraNotes.push(alt[3].trim())
  }

  const parsed = parseIngredientCore(raw, unit, qty)
  if (!parsed) return null

  if (parsed.unit) {
    const adj = parsed.name.match(UNIT_ADJECTIVE_RE)
    if (adj) {
      parsed.name = adj[2].trim()
      extraNotes.unshift(adj[1].toLowerCase())
    }
  }
  if (extraNotes.length) parsed.notes = joinNotes(...extraNotes, parsed.notes)
  return parsed
}

function parseIngredientCore(raw, unit, qty) {

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

  // Leading dose: "300 gr di farina" / "1 cucchiaio di olio" / "1/2 cucchiaino di zucchero"
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

  // GENERAL — name + qty + unit + optional trailing descriptors/notes:
  // "piselli 300 g freschi o surgelati", "Farina Manitoba 200 g", "zucchero 1 cucchiaio raso"
  // Middle "(…)" is removed first so "Savoiardi (circa 42 pezzi) 350 g" keeps 350 g, not 42 pezzi.
  const generalRe = new RegExp(`^(.+?)\\s+${qty}\\s*(${unit})\\.?(?![a-zà-ÿ])\\s*(.*)$`, 'iu')
  const middleParens = []
  const withoutMiddleParens = raw
    .replace(/\s*\(([^()]*)\)(?=.*\S)/g, (_, inner) => {
      middleParens.push(cleanParenNote(inner))
      return ''
    })
    .trim()
  const generalCandidates = withoutMiddleParens !== raw
    ? [[withoutMiddleParens, middleParens], [raw, []]]
    : [[raw, []]]
  for (const [text, parenNotes] of generalCandidates) {
    m = text.match(generalRe)
    if (!m) continue
    const namePart = m[1].trim().replace(/\s*[-–—,]$/, '')
    if ((namePart.match(/\(/g) || []).length !== (namePart.match(/\)/g) || []).length) continue
    const restClean = String(m[4] || '')
      .trim()
      .replace(/^[–—\-]\s*/, '')
      .replace(/^\((.*)\)$/, '$1')
      .trim()
    if (namePart && !/^\d+[.,]?\d*$/.test(namePart)) {
      const base = withOptionalNotes({
        name: namePart,
        quantity: coerceQuantity(m[2]),
        unit: normalizeUnit(m[3]),
        notes: ''
      })
      return { ...base, notes: joinNotes(...parenNotes, base.notes, restClean) }
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
    const isRange = typeof quantity === 'string' && /^\d+(?:\.\d+)?-\d+(?:\.\d+)?$/.test(quantity)
    const n = typeof quantity === 'number' ? quantity : null
    if (
      namePart &&
      !flourType &&
      !/^\d/.test(namePart) &&
      (isRange || (n != null && n > 0 && n <= 100))
    ) {
      return withOptionalNotes({
        name: namePart,
        quantity,
        unit: '',
        notes: ''
      })
    }
  }

  // Name, bare count, short descriptor: "Uova 2 grandi", "Tuorli 6 (di uova medie)".
  // Not after "tipo"/"n." ("Farina tipo 1 integrale") and never a flour grade "00".
  m = raw.match(new RegExp(`^(.+?)\\s+${qty}\\s+(.+)$`, 'iu'))
  if (m) {
    const namePart = m[1].trim()
    const qRaw = String(m[2]).trim()
    const rest = m[3].trim()
    const restSplit = splitTrailingParenNotes(rest)
    const quantity = coerceQuantity(qRaw)
    const countLike =
      (typeof quantity === 'number' && quantity > 0 && quantity <= 100) ||
      (typeof quantity === 'string' && /^\d+-\d+$/.test(quantity))
    if (
      countLike &&
      !/^0/.test(qRaw) &&
      !/^\d/.test(namePart) &&
      !/(?:^|\s)(tipo|type|n\.?|nr\.?|numero|no\.?|di|da|del|della|dei|delle|con|per|of|from|with)$/i.test(namePart) &&
      (/^\(/.test(rest) || (restSplit.name.split(/\s+/).length <= 3 && !/\d/.test(restSplit.name)))
    ) {
      const base = withOptionalNotes({ name: namePart, quantity, unit: '', notes: '' })
      const restNotes = /^\(/.test(rest)
        ? cleanParenNote(rest.replace(/^\((.*)\)$/, '$1'))
        : [restSplit.name, restSplit.notes].filter(Boolean).join('; ')
      return { ...base, notes: joinNotes(base.notes, restNotes) }
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

const COUNTABLE_NAME_RE =
  /\b(uov[ao]|tuorl|album|savoiard|biscott|amaretti|mandorl|nocciol|noci\b|pinoli|pistacch|olive|pomodorin|ciliegin|acini|foglie|gamber|cozze|vongole|capesante|polpett|ravioli|tortellini|fett[ae]|pezz|eggs?\b|yolks?\b|whites?\b|cookies?\b|almonds?\b|olives?\b|leaves\b|shrimps?\b|prawns?\b)/i

/**
 * Some sites drop the unit ("200 burro", "300 fecola"). When the recipe already
 * weighs in grams, a bare quantity ≥ 50 on a non-countable item is grams.
 */
export function inferMissingGrams(ingredients) {
  const list = ingredients || []
  const withUnit = list.filter((i) => String(i?.unit || '').trim())
  const grams = withUnit.filter((i) => /^(g|gr|kg)$/i.test(String(i.unit).trim()))
  if (!grams.length || grams.length < withUnit.length / 2) return list
  return list.map((ing) => {
    if (String(ing?.unit || '').trim()) return ing
    if (typeof ing?.quantity !== 'number' || ing.quantity < 50) return ing
    if (COUNTABLE_NAME_RE.test(String(ing.name || ''))) return ing
    return { ...ing, unit: 'g' }
  })
}

/**
 * If AI/JSON left dose inside `name`, re-run the general parser.
 */
export function refineIngredientFields(ing) {
  const name = String(ing?.name || '').trim()
  if (!name) return null
  let quantity = ing?.quantity
  let unit = String(ing?.unit || '').trim()
  let notes = String(ing?.notes || '').trim()

  const qtyEmpty =
    quantity === '' || quantity == null || (typeof quantity === 'number' && !Number.isFinite(quantity))
  const looksEmbedded = new RegExp(
    `\\d(?:[.,]\\d+)?\\s*(?:${UNIT_PATTERN})\\.?\\b`,
    'i'
  ).test(name)

  if (looksEmbedded && (qtyEmpty || !unit)) {
    const parsed = parseIngredientLine(name)
    if (parsed && (parsed.quantity != null || parsed.unit)) {
      return {
        name: parsed.name,
        quantity: qtyEmpty ? parsed.quantity : coerceQuantity(quantity),
        unit: unit || parsed.unit || '',
        notes: notes || parsed.notes || ''
      }
    }
  }

  return {
    name,
    quantity: coerceQuantity(quantity),
    unit: normalizeUnit(unit),
    notes
  }
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
