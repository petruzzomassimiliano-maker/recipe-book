/**
 * Loose ingredient matching for "cosa cucino con quello che ho":
 * lowercase, no accents, rough Italian singular/plural stem.
 */
export function fold(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, ' ')
}

const STOP = new Set(['di', 'del', 'della', 'dei', 'delle', 'degli', 'da', 'in', 'e', 'con', 'per', 'al', 'alla', 'il', 'la', 'lo', 'le', 'gli', 'un', 'una', 'q', 'b', 'qb', 'fresco', 'fresca', 'freschi', 'fresche'])

function stem(word) {
  return word.length > 3 ? word.replace(/[aeiou]$/, '') : word
}

export function tokens(text) {
  return fold(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem)
}

/** Always at home: never listed as missing. */
const PANTRY = ['sale', 'pepe', 'olio', 'acqua', 'zucchero', 'farina', 'aceto', 'ghiaccio']
function isPantry(name) {
  const t = tokens(name)
  return t.length > 0 && t.some((w) => PANTRY.some((p) => stem(p) === w)) && t.length <= 3
}

/** Does the recipe ingredient `name` use what the user typed (`have`)? */
function uses(name, haveTokens) {
  const nameTokens = tokens(name)
  return haveTokens.every((h) => nameTokens.some((n) => n === h || (h.length >= 4 && n.startsWith(h))))
}

/**
 * Rank recipes by how many of the typed ingredients they use.
 * @param recipes index rows with `ingredientNames`
 * @param have string[] typed by the user
 * @returns {{ recipe, matched: string[], missing: string[] }[]}
 */
export function rankByIngredients(recipes, have) {
  const wanted = (have || []).map((h) => ({ label: h, toks: tokens(h) })).filter((h) => h.toks.length)
  if (!wanted.length) return []
  const out = []
  for (const recipe of recipes || []) {
    const names = recipe.ingredientNames || []
    if (!names.length) continue
    const matched = wanted.filter((w) => names.some((n) => uses(n, w.toks))).map((w) => w.label)
    if (!matched.length) continue
    const missing = names.filter((n) => !isPantry(n) && !wanted.some((w) => uses(n, w.toks)))
    out.push({ recipe, matched, missing })
  }
  return out.sort(
    (a, b) =>
      b.matched.length - a.matched.length ||
      a.missing.length - b.missing.length ||
      String(a.recipe.title).localeCompare(String(b.recipe.title), 'it')
  )
}
