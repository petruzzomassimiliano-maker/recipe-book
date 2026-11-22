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
const checkId = async (c, next) => {
  if (!ID_RE.test(c.req.param('id') || '')) return c.json({ error: 'Recipe not found' }, 404)
  await next()
}
recipes.use('/:id', checkId)
recipes.use('/:id/*', checkId)

/** Bump when index rows gain fields that must be backfilled from the recipe files. */
const INDEX_VERSION = 2

function toIndexEntry(recipe) {
  const meta = recipe.metadata || {}
  return {
    id: recipe.id,
    title: recipe.title,
    tags: meta.tags || [],
    servings: meta.servings || 1,
    difficulty: meta.difficulty || 'easy',
    totalTime: (Number(meta.prepTime) || 0) + (Number(meta.cookTime) || 0),
    imageUrl: recipe.imageUrl || null,
    sourceUrl: recipe.sourceUrl || null,
    // For search, "cosa cucino" and duplicate checks without opening every file
    ingredientNames: (recipe.ingredients || [])
      .map((i) => String(i?.name || '').trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 60),
    lastCookedAt: recipe.diary?.[0]?.date || null,
    createdAt: recipe.createdAt || null,
    updatedAt: recipe.updatedAt,
    iv: INDEX_VERSION
  }
}

// Cloudflare caps subrequests per request: backfill old index rows a few at a time
const BACKFILL_PER_REQUEST = 20

async function backfillIndex(client, index) {
  const stale = index.filter((e) => e?.id && e.iv !== INDEX_VERSION).slice(0, BACKFILL_PER_REQUEST)
  if (!stale.length) return index
  const fresh = new Map()
  await Promise.all(
    stale.map(async (entry) => {
      try {
        const recipe = await client.getRecipe(entry.id)
        // Missing file (orphan): keep the row as it is, just stop retrying
        fresh.set(entry.id, recipe ? toIndexEntry(recipe) : { ...entry, iv: INDEX_VERSION })
      } catch (err) {
        console.warn('[recipes/backfill]', entry.id, err.message)
      }
    })
  )
  if (!fresh.size) return index
  const next = index.map((e) => fresh.get(e?.id) || e)
  try {
    await client.saveRecipesIndex(next)
  } catch (err) {
    console.warn('[recipes/backfill] save:', err.message)
  }
  return next
}

/** Lowercase, no accents/apostrophes: «Melanzane» ~ «melanzana», «perché» ~ «perche». */
function fold(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, ' ')
}

/** Rough Italian stem so singular/plural match (pomodoro/pomodori, uovo/uova). */
function stem(word) {
  return word.length > 3 ? word.replace(/[aeiou]$/, '') : word
}

function matchesQuery(entry, q) {
  const haystack = fold(
    [entry.title, (entry.tags || []).join(' '), (entry.ingredientNames || []).join(' ')].join(' ')
  )
  const words = fold(q).split(/[^a-z0-9]+/).filter(Boolean)
  return words.every((w) => haystack.includes(stem(w)))
}

const MAX_DIARY = 300

function cleanDiaryEntry(input) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(input?.date || ''))
    ? input.date
    : new Date().toISOString().slice(0, 10)
  const rating = Math.max(0, Math.min(5, Math.round(Number(input?.rating) || 0)))
  const note = String(input?.note || '').trim().slice(0, 2000)
  const photoUrl = /^https?:\/\//i.test(String(input?.photoUrl || '')) ? String(input.photoUrl).slice(0, 2000) : null
  return {
    id: ID_RE.test(String(input?.id || '')) ? input.id : crypto.randomUUID(),
    date,
    rating,
    note,
    photoUrl,
    createdAt: input?.createdAt || new Date().toISOString()
  }
}

/** Newest first (by cooking date, then by when it was written). */
function sortDiary(entries) {
  return [...entries]
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, MAX_DIARY)
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
  const q = (c.req.query('q') || '').trim()
  const client = dbx(c)
  const index = await backfillIndex(client, await client.getRecipesIndex())
  const list = index.map(toPublicEntry)
  const filtered = q ? list.filter((entry) => matchesQuery(entry, q)) : list
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
    iv: _iv,
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
  // The diary has its own endpoints: the edit form never touches it
  if (existing.diary?.length) recipe.diary = existing.diary

  await client.saveRecipe(recipe.id, recipe)
  await upsertIndex(client, recipe)
  if (!storageStillValid) afterResponse(c, refreshStorageInBackground(c.env, client, recipe.id))
  return c.json({ success: true, data: toPublicRecipe(recipe) })
})

// ── Diario: ogni volta che la ricetta è stata fatta ─────────────────────────
recipes.post('/:id/diary', requireEditor, async (c) => {
  const client = dbx(c)
  const recipe = await client.getRecipe(c.req.param('id'))
  if (!recipe) return c.json({ error: 'Recipe not found' }, 404)
  const body = await c.req.json().catch(() => null)
  const entry = cleanDiaryEntry({ ...body, id: null, createdAt: null })
  if (!entry.note && !entry.rating && !entry.photoUrl && !body?.date) {
    return c.json({ error: 'Scrivi una nota, dai un voto o aggiungi una foto' }, 400)
  }
  recipe.diary = sortDiary([entry, ...(recipe.diary || [])])
  await client.saveRecipe(recipe.id, recipe)
  await upsertIndex(client, recipe)
  return c.json({ success: true, data: toPublicRecipe(recipe) }, 201)
})

recipes.delete('/:id/diary/:entryId', requireEditor, async (c) => {
  const client = dbx(c)
  const recipe = await client.getRecipe(c.req.param('id'))
  if (!recipe) return c.json({ error: 'Recipe not found' }, 404)
  const entryId = c.req.param('entryId')
  const before = recipe.diary || []
  recipe.diary = before.filter((e) => e.id !== entryId)
  if (recipe.diary.length === before.length) return c.json({ error: 'Voce non trovata' }, 404)
  await client.saveRecipe(recipe.id, recipe)
  await upsertIndex(client, recipe)
  return c.json({ success: true, data: toPublicRecipe(recipe) })
})

/**
 * POST /api/recipes/restore — one recipe from a backup file.
 * Body: { recipe, overwrite?: boolean }. Keeps the original id, dates, diary,
 * storage advice and cooking methods. Without `overwrite`, existing ids are skipped.
 */
recipes.post('/restore', requireEditor, async (c) => {
  const body = await c.req.json().catch(() => null)
  const input = body?.recipe
  if (!input?.title?.trim()) return c.json({ error: 'Ricetta non valida nel backup' }, 400)
  const client = dbx(c)
  const id = ID_RE.test(String(input.id || '')) ? input.id : crypto.randomUUID()
  const existing = await client.getRecipe(id)
  if (existing && !body.overwrite) return c.json({ success: true, data: { id, skipped: true } })

  const recipe = normalizeRecipe(input, {
    id,
    author: FAMILY_AUTHOR,
    createdAt: input.createdAt || existing?.createdAt
  })
  if (typeof input.updatedAt === 'string' && !Number.isNaN(Date.parse(input.updatedAt))) {
    recipe.updatedAt = input.updatedAt
  }
  if (input.storage && typeof input.storage === 'object') recipe.storage = input.storage
  if (Array.isArray(input.diary) && input.diary.length) {
    recipe.diary = sortDiary(input.diary.map(cleanDiaryEntry))
  }
  await client.saveRecipe(recipe.id, recipe)
  await upsertIndex(client, recipe)
  return c.json({ success: true, data: { id, skipped: false, restored: true } })
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
