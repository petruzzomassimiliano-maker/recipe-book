import { Hono } from 'hono'
import { DropboxClient } from '../lib/dropboxClient.js'
import {
  authorKey,
  canViewRecipe,
  canEditRecipe,
  canDeleteRecipe,
  canShareRecipe,
  isStaff,
  sharedWithUserIds
} from '../lib/rbac.js'
import { authMiddleware } from '../middleware/auth.js'
import { coerceQuantity } from '../lib/scrapers/_base.js'
import { calculateRecipeNutrition } from '../lib/nutrition/calculate.js'
import { findOwner, findUserById, loadUsers } from '../lib/users.js'

const recipes = new Hono()
recipes.use('*', authMiddleware)

function dbx(c) {
  return new DropboxClient(c.get('dropboxToken'))
}

function usersByAuthorKey(users) {
  const map = new Map()
  for (const u of users || []) {
    map.set(`user-${u.id}`, u)
  }
  return map
}

function displayNameForAuthor(author, byKey) {
  const u = byKey.get(author)
  if (!u) return 'Utente'
  return u.displayName || u.username || 'Utente'
}

/** Bare user UUIDs (no user- prefix), unique, stable order. */
function normalizeSharedWithUserIds(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const out = []
  for (const item of raw) {
    const id = String(item || '')
      .trim()
      .replace(/^user-/, '')
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/**
 * Staff may assign recipes to another active family user via assignToUserId.
 * Members always get themselves as author.
 */
async function resolveAuthorAssignment(client, actor, body) {
  const users = await loadUsers(client)
  let target = findUserById(users, actor.userId)

  if (isStaff(actor) && body?.assignToUserId) {
    const chosen = findUserById(users, String(body.assignToUserId).trim())
    if (!chosen) {
      const err = new Error('Utente destinatario non trovato')
      err.status = 400
      throw err
    }
    if (chosen.active === false) {
      const err = new Error('Utente destinatario disattivato')
      err.status = 400
      throw err
    }
    target = chosen
  }

  if (!target) {
    return {
      author: authorKey(actor),
      displayName: actor.name || actor.username || 'Utente',
      users
    }
  }

  return {
    author: `user-${target.id}`,
    displayName: target.displayName || target.username || 'Utente',
    users
  }
}

function toIndexEntry(recipe, authorDisplayName) {
  const isPrivate = !!recipe.metadata?.isPrivate
  const shared = isPrivate ? [] : sharedWithUserIds(recipe)
  return {
    id: recipe.id,
    title: recipe.title,
    author: recipe.author,
    authorDisplayName:
      authorDisplayName || recipe.authorDisplayName || null,
    tags: recipe.metadata?.tags || [],
    isShared: isPrivate ? false : shared.length > 0 || recipe.metadata?.isShared !== false,
    isPrivate,
    sharedWithUserIds: shared,
    servings: recipe.metadata?.servings || 1,
    difficulty: recipe.metadata?.difficulty || 'easy',
    imageUrl: recipe.imageUrl || null,
    caloriesPerServing: recipe.nutritionInfo?.perServing?.calories ?? null,
    updatedAt: recipe.updatedAt
  }
}

const SHARES_PATH = '/recipes/recipe-shares.json'

async function loadShareMap(client) {
  const raw = await client.readJSON(SHARES_PATH)
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
}

async function saveShareMap(client, map) {
  await client.createFolderIfNotExists('/recipes')
  return client.writeJSON(SHARES_PATH, map)
}

/**
 * Reverse index: userId → [recipeId]. Keeps recipient lists reliable
 * even if recipes-index.json is stale.
 */
async function syncShareMapForRecipe(client, recipeId, userIds) {
  const map = await loadShareMap(client)
  const id = String(recipeId)
  const targets = new Set(normalizeSharedWithUserIds(userIds))

  for (const [uid, list] of Object.entries(map)) {
    if (!Array.isArray(list)) {
      delete map[uid]
      continue
    }
    const next = list.filter((rid) => rid !== id)
    if (next.length) map[uid] = next
    else delete map[uid]
  }

  for (const uid of targets) {
    const list = Array.isArray(map[uid]) ? [...map[uid]] : []
    if (!list.includes(id)) list.push(id)
    map[uid] = list
  }

  await saveShareMap(client, map)
  return map
}

/**
 * Recipes without a valid family user author → assign to owner.
 * Updates index + recipe files when needed.
 */
async function migrateOrphanRecipesToOwner(client, index, users) {
  const owner = findOwner(users)
  if (!owner || !Array.isArray(index) || index.length === 0) {
    return { index, byKey: usersByAuthorKey(users) }
  }

  const byKey = usersByAuthorKey(users)
  const ownerAuthor = `user-${owner.id}`
  const ownerName = owner.displayName || owner.username || 'Owner'
  let changed = false
  const next = []

  for (const entry of index) {
    const author = entry?.author
    const valid = typeof author === 'string' && byKey.has(author)
    if (valid) {
      next.push({
        ...entry,
        authorDisplayName:
          entry.authorDisplayName || displayNameForAuthor(author, byKey)
      })
      continue
    }

    changed = true
    const patched = {
      ...entry,
      author: ownerAuthor,
      authorDisplayName: ownerName
    }
    next.push(patched)

    try {
      const recipe = await client.getRecipe(entry.id)
      if (recipe && recipe.author !== ownerAuthor) {
        await client.saveRecipe(entry.id, {
          ...recipe,
          author: ownerAuthor,
          authorDisplayName: ownerName
        })
      }
    } catch (err) {
      console.warn('[recipes] migrate author:', entry.id, err.message)
    }
  }

  if (changed) {
    await client.saveRecipesIndex(next)
  }

  return { index: next, byKey }
}

function parseTags(input) {
  if (Array.isArray(input)) return input.map((t) => String(t).trim()).filter(Boolean)
  if (typeof input === 'string') {
    return input.split(',').map((t) => t.trim()).filter(Boolean)
  }
  return []
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
      nutritionId: i.nutritionId || null
    }))
  const steps = (input.steps || [])
    .filter((s) => s?.instruction?.trim())
    .map((s, idx) => ({
      id: s.id || `step-${idx + 1}`,
      order: idx + 1,
      instruction: s.instruction.trim()
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
    nutritionInfo: {
      servings,
      perServing: input.nutritionInfo?.perServing || null,
      perRecipe: input.nutritionInfo?.perRecipe || null,
      source: input.nutritionInfo?.source || 'manual',
      lastCalculated: input.nutritionInfo?.lastCalculated || null,
      lines: Array.isArray(input.nutritionInfo?.lines) ? input.nutritionInfo.lines : [],
      skippedCount: Number(input.nutritionInfo?.skippedCount) || 0,
      matchedCount: Number(input.nutritionInfo?.matchedCount) || 0
    },
    metadata: {
      tags: parseTags(input.tags ?? input.metadata?.tags),
      servings,
      prepTime: Number(input.prepTime ?? input.metadata?.prepTime) || 0,
      cookTime: Number(input.cookTime ?? input.metadata?.cookTime) || 0,
      difficulty: input.difficulty || input.metadata?.difficulty || 'easy',
      cuisine: input.cuisine || input.metadata?.cuisine || '',
      isPrivate: Boolean(input.isPrivate ?? input.metadata?.isPrivate),
      isShared: Boolean(input.isPrivate ?? input.metadata?.isPrivate)
        ? false
        : input.isShared ?? input.metadata?.isShared ?? true,
      isPublic: false,
      sharedWithUserIds: normalizeSharedWithUserIds(
        input.sharedWithUserIds ?? input.metadata?.sharedWithUserIds
      )
    },
    imageUrl: input.imageUrl || null,
    sourceUrl: input.sourceUrl || null,
    sourceProvider: input.sourceProvider || 'manual',
    notes: input.notes || '',
    cookingMethods: Array.isArray(input.cookingMethods) ? input.cookingMethods : [],
    cookingMethodsSummary: String(input.cookingMethodsSummary || '')
  }
}

async function upsertIndex(client, recipe, authorDisplayName, { remove = false } = {}) {
  const index = await client.getRecipesIndex()
  const next = index.filter((entry) => entry.id !== recipe.id)
  if (!remove) next.unshift(toIndexEntry(recipe, authorDisplayName))
  await client.saveRecipesIndex(next)
  return next
}

/** Auto-calcola calorie (DB locale + custom utente). Non blocca il salvataggio. */
async function applyAutoNutrition(client, recipe) {
  try {
    await client.createFolderIfNotExists('/nutrition-cache')
    const result = await calculateRecipeNutrition(recipe, { dbxClient: client })
    const ingredients = (recipe.ingredients || []).map((ing) => {
      const line = result.lines.find((l) => l.ingredientId === ing.id)
      return {
        ...ing,
        nutritionId: line?.nutritionId || ing.nutritionId || null
      }
    })
    return {
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
      }
    }
  } catch (err) {
    console.warn('[recipes] auto nutrition failed:', err.message)
    return recipe
  }
}

function ingredientsSignature(recipe) {
  return JSON.stringify(
    (recipe?.ingredients || []).map((i) => [i.name, i.quantity, i.unit])
  )
}

function resolveSharedWith(users, recipeOrEntry) {
  return sharedWithUserIds(recipeOrEntry).map((id) => {
    const u = findUserById(users, id)
    return {
      id,
      displayName: u?.displayName || u?.username || 'Utente'
    }
  })
}

recipes.get('/', async (c) => {
  const user = c.get('user')
  const q = (c.req.query('q') || '').trim().toLowerCase()
  const client = dbx(c)
  const users = await loadUsers(client)
  const rawIndex = await client.getRecipesIndex()
  const { index, byKey } = await migrateOrphanRecipesToOwner(client, rawIndex, users)
  const shareMap = await loadShareMap(client)
  const inboxIds = new Set(
    Array.isArray(shareMap[user.userId]) ? shareMap[user.userId].map(String) : []
  )

  const enriched = index.map((entry) => {
    const fromIndex = sharedWithUserIds(entry)
    const shared =
      inboxIds.has(String(entry.id)) && !fromIndex.includes(String(user.userId))
        ? [...fromIndex, String(user.userId)]
        : fromIndex
    const withShares = {
      ...entry,
      sharedWithUserIds: shared,
      isPrivate: !!entry.isPrivate,
      authorDisplayName:
        entry.authorDisplayName || displayNameForAuthor(entry.author, byKey)
    }
    return {
      ...withShares,
      sharedWith: resolveSharedWith(users, withShares)
    }
  })

  const visible = enriched.filter(
    (entry) => canViewRecipe(user, entry) || inboxIds.has(String(entry.id))
  )
  const filtered = q
    ? visible.filter((entry) => {
        const tags = (entry.tags || []).join(' ').toLowerCase()
        return entry.title.toLowerCase().includes(q) || tags.includes(q)
      })
    : visible
  return c.json({ success: true, data: filtered })
})

recipes.get('/:id', async (c) => {
  const user = c.get('user')
  const client = dbx(c)
  const recipe = await client.getRecipe(c.req.param('id'))
  if (!recipe) return c.json({ error: 'Recipe not found' }, 404)

  // Orphan / legacy author → owner (same rule as list)
  const users = await loadUsers(client)
  const byKey = usersByAuthorKey(users)
  if (!byKey.has(recipe.author)) {
    const owner = findOwner(users)
    if (owner) {
      const ownerAuthor = `user-${owner.id}`
      const ownerName = owner.displayName || owner.username || 'Owner'
      const patched = { ...recipe, author: ownerAuthor, authorDisplayName: ownerName }
      try {
        await client.saveRecipe(recipe.id, patched)
        await upsertIndex(client, patched, ownerName)
      } catch (err) {
        console.warn('[recipes] migrate on get:', err.message)
      }
      Object.assign(recipe, patched)
    }
  } else if (!recipe.authorDisplayName) {
    recipe.authorDisplayName = displayNameForAuthor(recipe.author, byKey)
  }

  const shareMap = await loadShareMap(client)
  const inInbox = Array.isArray(shareMap[user.userId])
    ? shareMap[user.userId].map(String).includes(String(recipe.id))
    : false

  if (!canViewRecipe(user, recipe) && !inInbox) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  // Keep reverse share index in sync with the recipe file (repairs older shares)
  const fileShares = sharedWithUserIds(recipe)
  if (fileShares.length > 0 || inInbox) {
    try {
      await syncShareMapForRecipe(client, recipe.id, fileShares)
      await upsertIndex(client, recipe, recipe.authorDisplayName)
    } catch (err) {
      console.warn('[recipes] share sync on get:', err.message)
    }
  }

  return c.json({
    success: true,
    data: {
      ...recipe,
      sharedWith: resolveSharedWith(users, recipe)
    }
  })
})

recipes.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  if (!body.title?.trim()) return c.json({ error: 'Title is required' }, 400)

  const client = dbx(c)
  let assignment
  try {
    assignment = await resolveAuthorAssignment(client, user, body)
  } catch (err) {
    return c.json({ error: err.message }, err.status || 400)
  }

  let recipe = normalizeRecipe(body, {
    id: crypto.randomUUID(),
    author: assignment.author
  })
  recipe.authorDisplayName = assignment.displayName

  recipe = await applyAutoNutrition(client, recipe)
  await client.saveRecipe(recipe.id, recipe)
  await upsertIndex(client, recipe, assignment.displayName)
  return c.json({ success: true, data: recipe }, 201)
})

/**
 * Replace share list. Recipe stays on the author; recipients only gain view access.
 * Body: { userIds: string[] }
 */
recipes.put('/:id/share', async (c) => {
  const user = c.get('user')
  const client = dbx(c)
  const existing = await client.getRecipe(c.req.param('id'))
  if (!existing) return c.json({ error: 'Recipe not found' }, 404)
  if (!canShareRecipe(user, existing)) return c.json({ error: 'Forbidden' }, 403)

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'JSON non valido' }, 400)
  }

  const requested = normalizeSharedWithUserIds(body?.userIds)
  const users = await loadUsers(client)
  const authorId = String(existing.author || '').replace(/^user-/, '')
  const resolved = []
  for (const id of requested) {
    if (id === authorId) continue
    const target = findUserById(users, id)
    if (!target) return c.json({ error: `Utente non trovato: ${id}` }, 400)
    if (target.active === false) {
      return c.json({ error: `${target.displayName || target.username} è disattivato` }, 400)
    }
    resolved.push(id)
  }

  const recipe = {
    ...existing,
    updatedAt: new Date().toISOString(),
    metadata: {
      ...(existing.metadata || {}),
      sharedWithUserIds: resolved,
      isPrivate: false,
      isShared: resolved.length > 0 ? true : existing.metadata?.isShared !== false
    }
  }

  await client.saveRecipe(recipe.id, recipe)
  await upsertIndex(client, recipe, recipe.authorDisplayName)
  await syncShareMapForRecipe(client, recipe.id, resolved)
  return c.json({
    success: true,
    data: recipe,
    sharedWithUserIds: resolved,
    sharedWith: resolved.map((id) => {
      const u = findUserById(users, id)
      return {
        id,
        displayName: u?.displayName || u?.username || id
      }
    })
  })
})

recipes.put('/:id', async (c) => {
  const user = c.get('user')
  const client = dbx(c)
  const existing = await client.getRecipe(c.req.param('id'))
  if (!existing) return c.json({ error: 'Recipe not found' }, 404)
  if (!canEditRecipe(user, existing)) return c.json({ error: 'Forbidden' }, 403)

  const body = await c.req.json()
  if (!body.title?.trim()) return c.json({ error: 'Title is required' }, 400)

  let author = existing.author
  let authorDisplayName = existing.authorDisplayName || null
  if (isStaff(user) && body.assignToUserId) {
    try {
      const assignment = await resolveAuthorAssignment(client, user, body)
      author = assignment.author
      authorDisplayName = assignment.displayName
    } catch (err) {
      return c.json({ error: err.message }, err.status || 400)
    }
  }

  let recipe = normalizeRecipe(
    {
      ...body,
      cookingMethods: body.cookingMethods ?? existing.cookingMethods,
      cookingMethodsSummary: body.cookingMethodsSummary ?? existing.cookingMethodsSummary,
      nutritionInfo: body.nutritionInfo ?? existing.nutritionInfo,
      // Preserve shares unless the client explicitly sends them
      sharedWithUserIds:
        body.sharedWithUserIds ??
        body.metadata?.sharedWithUserIds ??
        existing.metadata?.sharedWithUserIds
    },
    {
      id: existing.id,
      author,
      createdAt: existing.createdAt
    }
  )
  recipe.authorDisplayName = authorDisplayName
  if (recipe.metadata.isPrivate) {
    recipe.metadata.sharedWithUserIds = []
    recipe.metadata.isShared = false
  }

  const ingredientsChanged = ingredientsSignature(recipe) !== ingredientsSignature(existing)
  const servingsChanged =
    Number(recipe.metadata?.servings) !== Number(existing.metadata?.servings)
  const wasManual = existing.nutritionInfo?.source === 'manual'

  // Ricalcola se ingredienti/porzioni cambiano, o se non c'era ancora un totale manuale
  if (ingredientsChanged || servingsChanged || !wasManual || !existing.nutritionInfo?.perServing) {
    recipe = await applyAutoNutrition(client, recipe)
  }

  await client.saveRecipe(recipe.id, recipe)
  await upsertIndex(client, recipe, recipe.authorDisplayName)
  const prevShared = sharedWithUserIds(existing)
  const nextShared = sharedWithUserIds(recipe)
  if (prevShared.join(',') !== nextShared.join(',')) {
    await syncShareMapForRecipe(client, recipe.id, nextShared)
  }
  return c.json({ success: true, data: recipe })
})

recipes.delete('/:id', async (c) => {
  const user = c.get('user')
  const client = dbx(c)
  const id = c.req.param('id')

  // Auth via index (skip full recipe download) → parallel delete + index write
  const index = await client.getRecipesIndex()
  const entry = index.find((e) => e.id === id)
  if (!entry) return c.json({ error: 'Recipe not found' }, 404)
  if (!canDeleteRecipe(user, entry)) return c.json({ error: 'Forbidden' }, 403)

  const next = index.filter((e) => e.id !== id)
  // Always drop from index; file may already be missing (orphan)
  try {
    await client.deleteRecipe(id)
  } catch (err) {
    console.warn('[recipes/delete] file:', err.message)
  }
  await client.saveRecipesIndex(next)
  try {
    await syncShareMapForRecipe(client, id, [])
  } catch (err) {
    console.warn('[recipes/delete] share map:', err.message)
  }

  return c.json({ success: true, data: { id } })
})

export default recipes
