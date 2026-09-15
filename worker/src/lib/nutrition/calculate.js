import { lookupStatic, normalizeIngredientName } from './staticDb.js'
import {
  addMacros,
  divideMacros,
  emptyMacros,
  hashIngredientKey,
  ingredientToGrams,
  scalePer100g
} from './scale.js'

const CUSTOM_DB_PATH = '/nutrition-cache/custom-db.json'

/**
 * User-authored per-100g entries saved on Dropbox.
 * Shape: { [normalizedName]: { label, calories, protein, fat, carbs, fiber } }
 */
export async function loadCustomDb(dbxClient) {
  if (!dbxClient) return {}
  try {
    const data = await dbxClient.readJSON(CUSTOM_DB_PATH)
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

export async function upsertCustomNutrition(dbxClient, { name, label, calories, protein, fat, carbs, fiber }) {
  const key = normalizeIngredientName(name)
  if (!key) throw new Error('Nome alimento obbligatorio')
  const entry = {
    label: String(label || name).trim(),
    calories: Math.round(Number(calories) || 0),
    protein: Number(protein) || 0,
    fat: Number(fat) || 0,
    carbs: Number(carbs) || 0,
    fiber: Number(fiber) || 0
  }
  const db = await loadCustomDb(dbxClient)
  db[key] = entry
  await dbxClient.writeJSON(CUSTOM_DB_PATH, db)

  const hash = await hashIngredientKey(name)
  await dbxClient.saveNutritionCache(hash, {
    name,
    label: entry.label,
    per100g: entry,
    source: 'manual'
  })
  return { key, hash, entry }
}

function lookupCustom(customDb, name) {
  if (!customDb || typeof customDb !== 'object') return null
  const n = normalizeIngredientName(name)
  if (!n) return null
  if (customDb[n]) {
    return { key: n, per100g: customDb[n], matchScore: 1, source: 'manual' }
  }
  const keys = Object.keys(customDb).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (n.includes(key) || key.includes(n)) {
      return { key, per100g: customDb[key], matchScore: 0.85, source: 'manual' }
    }
  }
  return null
}

/**
 * Resolve per-100g: custom DB utente → Dropbox cache → static DB locale.
 * Custom first so un alimento appena aggiunto/aggiornato vince sulla cache.
 */
export async function resolvePer100g(name, { dbxClient, customDb } = {}) {
  const hash = await hashIngredientKey(name)

  const db = customDb ?? (await loadCustomDb(dbxClient))
  const customHit = lookupCustom(db, name)
  if (customHit) {
    return {
      hash,
      name,
      per100g: customHit.per100g,
      source: 'manual',
      label: customHit.per100g.label || customHit.key,
      matchKey: customHit.key
    }
  }

  if (dbxClient) {
    try {
      const cached = await dbxClient.getNutritionCache(hash)
      if (cached?.per100g) {
        return {
          hash,
          name: cached.name || name,
          per100g: cached.per100g,
          source: cached.source || 'cache',
          label: cached.label || cached.name || name
        }
      }
    } catch {
      // ignore
    }
  }

  const staticHit = lookupStatic(name)
  if (staticHit) {
    const entry = {
      hash,
      name,
      per100g: staticHit.per100g,
      source: 'static',
      label: staticHit.per100g.label || staticHit.key,
      matchKey: staticHit.key
    }
    if (dbxClient) {
      try {
        await dbxClient.saveNutritionCache(hash, {
          name,
          label: entry.label,
          per100g: entry.per100g,
          source: 'static'
        })
      } catch {
        // ignore
      }
    }
    return entry
  }

  return { hash, name, per100g: null, source: 'none', label: name }
}

/**
 * Calculate full recipe nutrition.
 */
export async function calculateRecipeNutrition(recipe, { dbxClient } = {}) {
  const servings = Math.max(1, Number(recipe?.metadata?.servings || recipe?.nutritionInfo?.servings) || 1)
  const customDb = await loadCustomDb(dbxClient)
  const lines = []
  let total = emptyMacros()
  const sources = new Set()

  for (const ing of recipe?.ingredients || []) {
    if (!ing?.name?.trim()) continue

    const resolved = await resolvePer100g(ing.name, { dbxClient, customDb })
    const matchKey = resolved.matchKey || ''
    const { grams, skipped, reason } = ingredientToGrams(ing, matchKey || ing.name)

    if (skipped || !resolved.per100g) {
      lines.push({
        ingredientId: ing.id,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        skipped: true,
        reason: skipped ? reason : 'nessun dato nutrizionale — aggiungilo al DB (per 100 g)',
        source: resolved.source,
        nutritionId: resolved.hash ? `ingredient-${resolved.hash}` : null,
        macros: null
      })
      continue
    }

    const macros = scalePer100g(resolved.per100g, grams)
    total = addMacros(total, macros)
    sources.add(resolved.source)

    lines.push({
      ingredientId: ing.id,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      grams: Math.round(grams * 10) / 10,
      skipped: false,
      source: resolved.source,
      label: resolved.label,
      nutritionId: `ingredient-${resolved.hash}`,
      macros
    })
  }

  const sourceTag = sources.has('manual')
    ? sources.has('static')
      ? 'mixed'
      : 'manual'
    : sources.has('static')
      ? 'static'
      : sources.has('cache')
        ? 'cache'
        : 'none'

  return {
    servings,
    perRecipe: total,
    perServing: divideMacros(total, servings),
    source: sourceTag,
    lastCalculated: new Date().toISOString(),
    lines,
    skippedCount: lines.filter((l) => l.skipped).length,
    matchedCount: lines.filter((l) => !l.skipped).length
  }
}
