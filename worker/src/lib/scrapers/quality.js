/**
 * Decide if a scraped draft is good enough, or we should escalate to Gemini.
 */

function ingredientLooksUnparsed(ing) {
  const name = String(ing?.name || '')
  if (!name) return false
  // Qty stuck in the name: "300 gr di farina", "1/2 cucchiaino di zucchero"
  if (
    ing.quantity == null &&
    /\d/.test(name) &&
    /\b(g|gr|kg|mg|ml|cl|l|cucchiai[noi]?|cucchiaini?|spicchi?|bustine?)\b/i.test(name)
  ) {
    return true
  }
  // Very long blob that is probably a whole list cell
  if (name.length > 120) return true
  return false
}

/**
 * @returns {{ ok: boolean, score: number, reasons: string[] }}
 */
export function evaluateDraftQuality(draft) {
  const reasons = []
  let score = 0

  if (!draft) {
    return { ok: false, score: 0, reasons: ['nessun draft'] }
  }

  const title = String(draft.title || '').trim()
  if (title.length >= 3) score += 2
  else reasons.push('titolo assente o troppo corto')

  const ingredients = (draft.ingredients || []).filter((i) => String(i?.name || '').trim())
  if (ingredients.length >= 3) score += 3
  else if (ingredients.length >= 2) score += 2
  else if (ingredients.length >= 1) score += 1
  else reasons.push('pochi o nessun ingrediente')

  const withQty = ingredients.filter(
    (i) => i.quantity != null && i.quantity !== ''
  ).length
  if (ingredients.length > 0 && withQty / ingredients.length >= 0.4) score += 2
  else if (ingredients.length >= 2) reasons.push('poche quantità sugli ingredienti')

  const unparsed = ingredients.filter(ingredientLooksUnparsed)
  if (unparsed.length >= 2) {
    score -= 4
    reasons.push(`${unparsed.length} ingredienti con dose nel nome (parsing debole)`)
  }

  const steps = (draft.steps || []).filter((s) => String(s?.instruction || '').trim().length > 12)
  if (steps.length >= 2) score += 3
  else if (steps.length === 1) score += 1
  else reasons.push('passaggi assenti o troppo corti')

  const ok = score >= 6 && ingredients.length >= 2 && steps.length >= 1 && unparsed.length < 2
  return { ok, score, reasons }
}

export function isDraftAcceptable(draft) {
  return evaluateDraftQuality(draft).ok
}
