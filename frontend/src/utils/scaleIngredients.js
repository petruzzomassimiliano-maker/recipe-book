/**
 * Scale recipe ingredient quantities by servings ratio.
 * Non-numeric quantities (q.b., text) are left unchanged.
 */

function roundNice(n) {
  if (!Number.isFinite(n)) return n
  const abs = Math.abs(n)
  if (abs >= 100) return Math.round(n)
  if (abs >= 10) return Math.round(n * 10) / 10
  if (abs >= 1) return Math.round(n * 100) / 100
  // fractions under 1: keep up to 3 decimals, trim trailing zeros via Number
  return Math.round(n * 1000) / 1000
}

export function scaleQuantity(quantity, factor) {
  if (quantity == null || quantity === '') return quantity
  if (typeof quantity === 'string') {
    const s = quantity.trim()
    if (!s) return quantity
    if (/^q\.?\s*b\.?$/i.test(s) || /^qb$/i.test(s)) return 'q.b.'
    const asNum = Number(s.replace(',', '.'))
    if (!Number.isFinite(asNum)) return quantity
    return roundNice(asNum * factor)
  }
  if (typeof quantity === 'number') {
    if (!Number.isFinite(quantity)) return quantity
    return roundNice(quantity * factor)
  }
  return quantity
}

export function scaleIngredients(ingredients, baseServings, targetServings) {
  const base = Number(baseServings) || 1
  const target = Number(targetServings) || base
  if (base <= 0 || target <= 0 || target === base) {
    return ingredients || []
  }
  const factor = target / base
  return (ingredients || []).map((ing) => ({
    ...ing,
    quantity: scaleQuantity(ing.quantity, factor)
  }))
}

export function formatScaledQty(quantity, unit) {
  const parts = [quantity, unit].filter((v) => v != null && v !== '')
  return parts.length ? parts.join(' ') : null
}
