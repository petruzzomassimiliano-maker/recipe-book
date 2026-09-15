import { Hono } from 'hono'
import { DropboxClient } from '../lib/dropboxClient.js'
import { canViewRecipe, canEditRecipe } from '../lib/rbac.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  calculateRecipeNutrition,
  loadCustomDb,
  resolvePer100g,
  upsertCustomNutrition
} from '../lib/nutrition/calculate.js'
import { ingredientToGrams, scalePer100g } from '../lib/nutrition/scale.js'

const nutrition = new Hono()
nutrition.use('*', authMiddleware)

function dbx(c) {
  return new DropboxClient(c.get('dropboxToken'))
}

/**
 * POST /api/nutrition/search
 * Body: { ingredient, quantity?, unit? }
 */
nutrition.post('/search', async (c) => {
  try {
    const body = await c.req.json()
    const name = String(body.ingredient || body.name || '').trim()
    if (!name) return c.json({ error: 'ingredient obbligatorio' }, 400)

    const client = dbx(c)
    const resolved = await resolvePer100g(name, { dbxClient: client })
    if (!resolved.per100g) {
      return c.json({
        success: true,
        data: { ingredient: name, found: false }
      })
    }

    const qty = body.quantity
    const unit = body.unit
    let scaled = null
    if (qty != null || unit) {
      const { grams, skipped, reason } = ingredientToGrams(
        { quantity: qty, unit, name },
        resolved.matchKey || name
      )
      if (!skipped) scaled = scalePer100g(resolved.per100g, grams)
      else scaled = { skipped: true, reason }
    }

    return c.json({
      success: true,
      data: {
        ingredient: name,
        found: true,
        label: resolved.label,
        source: resolved.source,
        nutritionId: `ingredient-${resolved.hash}`,
        per100g: {
          calories: resolved.per100g.calories,
          protein: resolved.per100g.protein,
          fat: resolved.per100g.fat,
          carbs: resolved.per100g.carbs,
          fiber: resolved.per100g.fiber
        },
        scaled
      }
    })
  } catch (err) {
    console.error('[nutrition/search]', err.message)
    return c.json({ error: err.message || 'Ricerca fallita' }, 500)
  }
})

/**
 * POST /api/nutrition/custom
 * Body: { name, label?, calories, protein, fat, carbs, fiber } — valori per 100 g
 */
nutrition.post('/custom', async (c) => {
  try {
    const body = await c.req.json()
    const name = String(body.name || body.ingredient || '').trim()
    if (!name) return c.json({ error: 'Nome alimento obbligatorio' }, 400)
    if (body.calories == null || body.calories === '') {
      return c.json({ error: 'calorie (per 100 g) obbligatorie' }, 400)
    }

    const client = dbx(c)
    await client.createFolderIfNotExists('/nutrition-cache')
    const saved = await upsertCustomNutrition(client, {
      name,
      label: body.label,
      calories: body.calories,
      protein: body.protein,
      fat: body.fat,
      carbs: body.carbs,
      fiber: body.fiber
    })

    return c.json({
      success: true,
      data: {
        key: saved.key,
        nutritionId: `ingredient-${saved.hash}`,
        per100g: saved.entry,
        source: 'manual'
      }
    })
  } catch (err) {
    console.error('[nutrition/custom]', err.message)
    return c.json({ error: err.message || 'Salvataggio fallito' }, 500)
  }
})

/**
 * GET /api/nutrition/custom — lista alimenti aggiunti dall'utente
 */
nutrition.get('/custom', async (c) => {
  try {
    const db = await loadCustomDb(dbx(c))
    const items = Object.entries(db).map(([key, per100g]) => ({ key, ...per100g }))
    return c.json({ success: true, data: items })
  } catch (err) {
    console.error('[nutrition/custom GET]', err.message)
    return c.json({ error: err.message || 'Lettura fallita' }, 500)
  }
})

/**
 * POST /api/nutrition/calculate
 * Body: { recipeId } or { recipe }
 * Optional: { perServing } for manual total override
 */
nutrition.post('/calculate', async (c) => {
  try {
    const body = await c.req.json()
    const user = c.get('user')
    const client = dbx(c)
    let recipe = body.recipe || null

    if (body.recipeId) {
      recipe = await client.getRecipe(body.recipeId)
      if (!recipe) return c.json({ error: 'Ricetta non trovata' }, 404)
      if (!canViewRecipe(user, recipe)) return c.json({ error: 'Forbidden' }, 403)
    }
    if (!recipe?.title) return c.json({ error: 'Ricetta obbligatoria' }, 400)

    if (body.perServing && typeof body.perServing === 'object') {
      const servings = Math.max(1, Number(recipe.metadata?.servings) || 1)
      const perServing = {
        calories: Math.round(Number(body.perServing.calories) || 0),
        protein: Number(body.perServing.protein) || 0,
        fat: Number(body.perServing.fat) || 0,
        carbs: Number(body.perServing.carbs) || 0,
        fiber: Number(body.perServing.fiber) || 0
      }
      const perRecipe = {
        calories: Math.round(perServing.calories * servings),
        protein: Math.round(perServing.protein * servings * 10) / 10,
        fat: Math.round(perServing.fat * servings * 10) / 10,
        carbs: Math.round(perServing.carbs * servings * 10) / 10,
        fiber: Math.round(perServing.fiber * servings * 10) / 10
      }
      const nutritionInfo = {
        servings,
        perServing,
        perRecipe,
        source: 'manual',
        lastCalculated: new Date().toISOString(),
        lines: recipe.nutritionInfo?.lines || [],
        skippedCount: 0,
        matchedCount: 0
      }

      let saved = false
      if (body.recipeId && canEditRecipe(user, recipe)) {
        recipe = { ...recipe, nutritionInfo, updatedAt: new Date().toISOString() }
        await client.saveRecipe(recipe.id, recipe)
        saved = true
      }

      return c.json({
        success: true,
        data: { ...nutritionInfo, recipe: saved ? recipe : undefined }
      })
    }

    const result = await calculateRecipeNutrition(recipe, { dbxClient: client })

    let saved = false
    if (body.recipeId && canEditRecipe(user, recipe)) {
      const ingredients = (recipe.ingredients || []).map((ing) => {
        const line = result.lines.find((l) => l.ingredientId === ing.id)
        return {
          ...ing,
          nutritionId: line?.nutritionId || ing.nutritionId || null
        }
      })
      recipe = {
        ...recipe,
        ingredients,
        nutritionInfo: {
          servings: result.servings,
          perServing: result.perServing,
          perRecipe: result.perRecipe,
          source: result.source,
          lastCalculated: result.lastCalculated,
          lines: result.lines,
          skippedCount: result.skippedCount,
          matchedCount: result.matchedCount
        },
        updatedAt: new Date().toISOString()
      }
      await client.saveRecipe(recipe.id, recipe)
      saved = true
    }

    return c.json({
      success: true,
      data: { ...result, recipe: saved ? recipe : undefined }
    })
  } catch (err) {
    console.error('[nutrition/calculate]', err.message)
    return c.json({ error: err.message || 'Calcolo fallito' }, 500)
  }
})

export default nutrition
