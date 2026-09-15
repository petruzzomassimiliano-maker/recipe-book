/**
 * Convert recipe ingredient quantity/unit → grams for nutrition scaling.
 */

const UNIT_TO_G = {
  g: 1,
  gr: 1,
  grammi: 1,
  grammo: 1,
  kg: 1000,
  mg: 0.001,
  ml: 1, // ≈ g for water-like
  millilitri: 1,
  cl: 10,
  dl: 100,
  l: 1000,
  lt: 1000,
  litro: 1000,
  litri: 1000
}

/** Approximate piece / spoon weights when ingredient class is known. */
const PIECE_DEFAULTS = {
  uovo: 55,
  uova: 55,
  tuorlo: 18,
  tuorli: 18,
  albume: 33,
  aglio: 5,
  limone: 60,
  arancia: 130,
  mela: 180,
  banana: 120,
  cipolla: 100,
  default: 50
}

const SPOON_G = {
  olio: 14,
  'olio d\'oliva': 14,
  'olio di oliva': 14,
  'olio evo': 14,
  burro: 14,
  miele: 21,
  zucchero: 12,
  farina: 10,
  sale: 6,
  default: 12
}

function isQb(unit, quantity) {
  const u = String(unit || '').toLowerCase().replace(/\./g, '').replace(/\s+/g, '')
  if (/^qb$|^quanto.?basta$/.test(u)) return true
  if (quantity == null || quantity === '' || Number(quantity) === 0) {
    if (!u || u === 'qb') return true
  }
  return false
}

function normalizeUnit(unit) {
  return String(unit || '')
    .toLowerCase()
    .trim()
    .replace(/\.$/, '')
    .replace(/\s+/g, ' ')
}

/**
 * @returns {{ grams: number|null, skipped: boolean, reason?: string }}
 */
export function ingredientToGrams(ingredient, matchedKey = '') {
  const qty = Number(ingredient?.quantity)
  const unit = normalizeUnit(ingredient?.unit)
  const nameKey = String(matchedKey || ingredient?.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (isQb(unit, ingredient?.quantity)) {
    return { grams: null, skipped: true, reason: 'q.b. / senza quantità' }
  }

  if (!Number.isFinite(qty) || qty <= 0) {
    return { grams: null, skipped: true, reason: 'quantità mancante' }
  }

  if (UNIT_TO_G[unit] != null) {
    return { grams: qty * UNIT_TO_G[unit], skipped: false }
  }

  // Cucchiai / cucchiaini
  if (/cucchiai[no]?|tbsp|tablespoon/.test(unit) || unit === 'cucchiaio') {
    const per = SPOON_G[nameKey] || Object.entries(SPOON_G).find(([k]) => nameKey.includes(k))?.[1] || SPOON_G.default
    return { grams: qty * per, skipped: false }
  }
  if (/cucchiain[oi]|tsp|teaspoon/.test(unit)) {
    const per =
      (SPOON_G[nameKey] || Object.entries(SPOON_G).find(([k]) => nameKey.includes(k))?.[1] || SPOON_G.default) / 3
    return { grams: qty * per, skipped: false }
  }

  // Pezzi / unità
  if (!unit || /pezzi?|unita|unità|n|nr|numero/.test(unit)) {
    const piece =
      PIECE_DEFAULTS[nameKey] ||
      Object.entries(PIECE_DEFAULTS).find(([k]) => k !== 'default' && nameKey.includes(k))?.[1] ||
      PIECE_DEFAULTS.default
    return { grams: qty * piece, skipped: false }
  }

  // Fette
  if (/fett[ae]/.test(unit)) {
    return { grams: qty * 25, skipped: false }
  }

  return { grams: null, skipped: true, reason: `unità non convertibile (${unit || '—'})` }
}

/** Scale per-100g macros to actual grams. */
export function scalePer100g(per100g, grams) {
  if (!per100g || !Number.isFinite(grams) || grams <= 0) return null
  const f = grams / 100
  const round1 = (n) => Math.round((Number(per100g[n]) || 0) * f * 10) / 10
  return {
    calories: Math.round((Number(per100g.calories) || 0) * f),
    protein: round1('protein'),
    fat: round1('fat'),
    carbs: round1('carbs'),
    fiber: round1('fiber')
  }
}

export function emptyMacros() {
  return { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }
}

export function addMacros(a, b) {
  const out = emptyMacros()
  for (const k of Object.keys(out)) {
    out[k] = Math.round(((a?.[k] || 0) + (b?.[k] || 0)) * 10) / 10
  }
  out.calories = Math.round(out.calories)
  return out
}

export function divideMacros(macros, servings) {
  const s = Math.max(1, Number(servings) || 1)
  return {
    calories: Math.round((macros.calories || 0) / s),
    protein: Math.round(((macros.protein || 0) / s) * 10) / 10,
    fat: Math.round(((macros.fat || 0) / s) * 10) / 10,
    carbs: Math.round(((macros.carbs || 0) / s) * 10) / 10,
    fiber: Math.round(((macros.fiber || 0) / s) * 10) / 10
  }
}

/** Stable hash for nutrition cache file name. */
export async function hashIngredientKey(name) {
  const normalized = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const data = new TextEncoder().encode(normalized)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}
