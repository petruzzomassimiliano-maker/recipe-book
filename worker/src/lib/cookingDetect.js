/**
 * Cooking-method detection from recipe text (no AI).
 * KEEP IN SYNC: worker/src/lib/cookingDetect.js and frontend/src/utils/cookingDetect.js are the same file.
 *
 * - mentioned: every method the recipe talks about
 * - primary: the method the recipe actually cooks with — the step that carries a
 *   temperature/time wins; on a tie the later step (final cooking) wins; a method
 *   in the title always wins.
 * - params: temperature / oven mode / time read from that step
 */

export const METHOD_PATTERNS = {
  friggitrice_aria: /friggitrice\s+ad\s*aria|air\s*-?\s*fryer|airfryer|cottura\s+ad\s+aria/i,
  microonde: /microonde|microwave/i,
  forno: /\bforn[oi]\b|\binforn|\bsforn/i,
  padella: /\bpadell|\bsoffrigg|\brosol|\bwok\b|\btegame\b|\bfrigg(?!itric)/i,
  // not "brodo/latte/olio bollente" nor "bollore" (sauces, risotti): only real boiling
  bollitura: /\b(bollir\w*|bollitur\w*|bollit[aoie]\b|less[aoie]\w*|ebollizione)|acqua\s+(salata\s+)?bollent/i,
  vapore: /\ba\s+vapore\b|vaporiera|\bsteam/i,
  grill: /\bgrigli|\bbistecchiera|\bpiastra\b|barbecue|\bbbq\b|\bgrill\b/i
}

/** Phrases that contain a method word without meaning that method. */
function stripFalseFriends(text) {
  return String(text || '')
    .replace(/carta\s+(da\s+)?forno/gi, ' ')
    .replace(/forno\s+(a\s+)?microonde/gi, ' microonde ')
    .replace(/(griglia|grill|ripiano)\s+(del|nel)\s+forno/gi, ' forno ')
    .replace(/friggitrice\s+ad\s*aria/gi, ' airfryer ')
}

const TEMP_RE = /(\d{2,3})\s*(?:°|gradi)(?:\s*c\b)?/i
const TIME_RE = /(\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)\s*(minuti|minuto|min|ore|ora|h)\b/i
const MODE_RE = /\b(static[oa]|ventilat[oa])\b/i

function formatTime(match) {
  const amount = match[1].replace(/\s*[-–]\s*/, '-')
  if (!/^(ore|ora|h)$/i.test(match[2])) return `${amount} min`
  return `${amount} ${amount === '1' ? 'ora' : 'ore'}`
}

function stepParams(text) {
  const t = String(text || '')
  const temp = t.match(TEMP_RE)
  // "riposare 10 minuti, poi inforna a 180° per 25 minuti": the cooking time is the
  // one that follows the temperature, not the first one in the step
  const time = (temp && t.slice(temp.index).match(TIME_RE)) || t.match(TIME_RE)
  const mode = t.match(MODE_RE)
  return {
    temperature: temp
      ? `${temp[1]}°C${mode ? (/^stat/i.test(mode[1]) ? ' statico' : ' ventilato') : ''}`
      : '',
    time: time ? formatTime(time) : ''
  }
}

function methodsIn(text) {
  const clean = stripFalseFriends(text)
  return Object.keys(METHOD_PATTERNS).filter((id) => METHOD_PATTERNS[id].test(clean))
}

export function detectRecipeMethods(recipe) {
  const title = String(recipe?.title || '')
  const titleIds = methodsIn(title)
  const steps = (recipe?.steps || []).map((s) => String(s?.instruction || s?.text || ''))
  const extra = [recipe?.notes, ...(recipe?.metadata?.tags || [])].filter(Boolean).join('\n')

  const score = new Map() // id → { weight, index, params }
  steps.forEach((text, index) => {
    const ids = methodsIn(text)
    if (!ids.length) return
    const params = stepParams(text)
    const timed = Boolean(params.time) || /minut|\bore\b/i.test(text) // "per pochi minuti" counts too
    const weight = 1 + (params.temperature ? 2 : 0) + (timed ? 1 : 0)
    for (const id of ids) {
      const prev = score.get(id)
      if (!prev || weight > prev.weight || (weight === prev.weight && index >= prev.index)) {
        score.set(id, { weight, index, params })
      }
    }
  })

  const mentioned = new Set([...titleIds, ...score.keys(), ...methodsIn(extra)])

  let primary = titleIds[0] || null
  if (!primary && score.size) {
    primary = [...score.entries()].sort(
      (a, b) => b[1].weight - a[1].weight || b[1].index - a[1].index
    )[0][0]
  }
  const params = primary && score.has(primary) ? score.get(primary).params : { temperature: '', time: '' }

  return { mentioned: [...mentioned], titleIds, primary, params }
}
