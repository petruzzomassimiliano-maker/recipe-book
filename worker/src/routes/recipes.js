import { Hono } from 'hono'
import { familyMiddleware, requireEditor } from '../middleware/auth.js'
import { coerceQuantity } from '../lib/scrapers/_base.js'
import { refreshStorageInBackground, storageSignature } from '../lib/storageAdvice.js'

const recipes = new Hono()
// Lettura libera; creazione/modifica/eliminazione con PIN di famiglia
recipes.use('*', familyMiddleware)

function dbx(c) {
  return c.get('dbx')
}

const FAMILY_AUTHOR = 'family'

/** Run after the response (storage advice must not slow down saving). */
function afterResponse(c, promise) {
  try {
    c.executionCtx.waitUntil(promise)
  } catch {
    promise.catch(() => {})
  }
}
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/

// Reject odd ids before they reach a Dropbox path
recipes.use('/:id', async (c, next) => {
  if (!ID_RE.test(c.req.param('id') || '')) return c.json({ error: 'Recipe not found' }, 404)
  await next()
})

function toIndexEntry(recipe) {
  return {
    id: recipe.id,
    title: recipe.title,
    tags: recipe.metadata?.tags || [],
    servings: recipe.metadata?.servings || 1,
    difficulty: recipe.metadata?.difficulty || 'easy',
    imageUrl: recipe.imageUrl || null,
    createdAt: recipe.createdAt || null,
    updatedAt: recipe.updatedAt
  }
}

function parseTags(input) {
  if (Array.isArray(input)) return input.map((t) => String(t).trim()).filter(Boolean)
  if (typeof input === 'string') {
    return input.split(',').map((t) => t.trim()).filter(Boolean)
  }
  return []
}

/** Optional recipe component (e.g. "Pan di Spagna"); omitted when empty. */
function sectionField(item) {
  const section = String(item?.section || '').replace(/\s+/g, ' ').trim().slice(0, 80)
  return section ? { section } : {}
}

function normalizeRecipe(input, { id, author, createdAt }) {
  const now = new Date().toISOString()
  const servings = Number(input.servings ?? input.metadata?.servings) || 1
  const ingredients = (input.ingredients || [])
    .filter((i) => i?.name?.trim())
    .map((i, idx) => ({
      id: i.id || `ing-${idx + 1}`,
      name: i.name.trim(),
      quantity: coerceQuantity(i.quantity),
      unit: (i.unit || '').trim(),
      notes: i.notes || '',
      ...sectionField(i)
    }))
  const steps = (input.steps || [])
    .filter((s) => s?.instruction?.trim())
    .map((s, idx) => ({
      id: s.id || `step-${idx + 1}`,
      order: idx + 1,
      instruction: s.instruction.trim(),
      ...sectionField(s)
    }))

  return {
    schema_version: 1,
    id,
    title: String(input.title || '').trim(),
    author,
    createdAt: createdAt || now,
    updatedAt: now,
    ingredients,
    steps,
    metadata: {
      tags: parseTags(input.tags ?? input.metadata?.tags),
      servings,
      prepTime: Number(input.prepTime ?? input.metadata?.prepTime) || 0,
      cookTime: Number(input.cookTime ?? input.metadata?.cookTime) || 0,
      difficulty: input.difficulty || input.metadata?.difficulty || 'easy',
      cuisine: input.cuisine || input.metadata?.cuisine || ''
    },
    imageUrl: input.imageUrl || null,
    sourceUrl: input.sourceUrl || null,
    sourceProvider: input.sourceProvider || 'manual',
    notes: input.notes || '',
    cookingMethods: Array.isArray(input.cookingMethods) ? input.cookingMethods : [],
    cookingMethodsSummary: String(input.cookingMethodsSummary || '')
  }
}

async function upsertIndex(client, recipe) {
  const index = await client.getRecipesIndex()
  const next = index.filter((entry) => entry.id !== recipe.id)
  next.unshift(toIndexEntry(recipe))
  await client.saveRecipesIndex(next)
  return next
}

recipes.get('/', async (c) => {
  const q = (c.req.query('q') || '').trim().toLowerCase()
  const index = await dbx(c).getRecipesIndex()
  const list = index.map(toPublicEntry)
  const filtered = q
    ? list.filter((entry) => {
        const tags = (entry.tags || []).join(' ').toLowerCase()
        return String(entry.title || '').toLowerCase().includes(q) || tags.includes(q)
      })
    : list
  return c.json({ success: true, data: filtered })
})

/** Strip legacy per-user fields (author, shares, private) from old index rows. */
function toPublicEntry(entry) {
  const {
    author: _a,
    authorDisplayName: _n,
    isShared: _s,
    isPrivate: _p,
    sharedWithUserIds: _w,
    sharedWith: _sw,
    caloriesPerServing: _kcal,
    ...rest
  } = entry || {}
  return rest
}

function toPublicRecipe(recipe) {
  const {
    author: _a,
    authorDisplayName: _n,
    sharedWith: _sw,
    nutritionInfo: _ni,
    ...rest
  } = recipe
  const {
    isShared: _s,
    isPrivate: _p,
    isPublic: _pub,
    sharedWithUserIds: _w,
    ...metadata
  } = rest.metadata || {}
  return { ...rest, metadata }
}

recipes.get('/:id', async (c) => {
  const recipe = await dbx(c).getRecipe(c.req.param('id'))
  if (!recipe) return c.json({ error: 'Recipe not found' }, 404)
  return c.json({ success: true, data: toPublicRecipe(recipe) })
})

recipes.post('/', requireEditor, async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body?.title?.trim()) return c.json({ error: 'Title is required' }, 400)

  const client = dbx(c)
  const recipe = normalizeRecipe(body, { id: crypto.randomUUID(), author: FAMILY_AUTHOR })
  await client.saveRecipe(recipe.id, recipe)
  await upsertIndex(client, recipe)
  afterResponse(c, refreshStorageInBackground(c.env, client, recipe.id))
  return c.json({ success: true, data: toPublicRecipe(recipe) }, 201)
})

recipes.put('/:id', requireEditor, async (c) => {
  const client = dbx(c)
  const existing = await client.getRecipe(c.req.param('id'))
  if (!existing) return c.json({ error: 'Recipe not found' }, 404)

  const body = await c.req.json().catch(() => null)
  if (!body?.title?.trim()) return c.json({ error: 'Title is required' }, 400)

  const recipe = normalizeRecipe(
    {
      ...body,
      cookingMethods: body.cookingMethods ?? existing.cookingMethods,
      cookingMethodsSummary: body.cookingMethodsSummary ?? existing.cookingMethodsSummary
    },
    {
      id: existing.id,
      author: existing.author || FAMILY_AUTHOR,
      createdAt: existing.createdAt
    }
  )

  // Storage advice: keep it if what you'd store didn't change, otherwise regenerate after saving
  const storageStillValid = Boolean(
    existing.storage && existing.storage.sig === (await storageSignature(recipe))
  )
  if (storageStillValid) recipe.storage = existing.storage

  await client.saveRecipe(recipe.id, recipe)
  await upsertIndex(client, recipe)
  if (!storageStillValid) afterResponse(c, refreshStorageInBackground(c.env, client, recipe.id))
  return c.json({ success: true, data: toPublicRecipe(recipe) })
})

recipes.delete('/:id', requireEditor, async (c) => {
  const client = dbx(c)
  const id = c.req.param('id')

  const index = await client.getRecipesIndex()
  if (!index.some((e) => e.id === id)) return c.json({ error: 'Recipe not found' }, 404)

  // Always drop from index; file may already be missing (orphan)
  try {
    await client.deleteRecipe(id)
  } catch (err) {
    console.warn('[recipes/delete] file:', err.message)
  }
  await client.saveRecipesIndex(index.filter((e) => e.id !== id))
  return c.json({ success: true, data: { id } })
})

export default recipes
