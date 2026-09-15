import { Hono } from 'hono'
import { DropboxClient } from '../lib/dropboxClient.js'
import { authMiddleware } from '../middleware/auth.js'
import { coerceQuantity } from '../lib/scrapers/_base.js'

const shopping = new Hono()
shopping.use('*', authMiddleware)

function dbx(c) {
  return new DropboxClient(c.get('dropboxToken'))
}

function emptyList(userId) {
  const now = new Date().toISOString()
  return {
    schema_version: 2,
    id: `shopping-list-${userId}`,
    userId,
    createdAt: now,
    updatedAt: now,
    items: []
  }
}

function ensureItemIds(list) {
  let changed = false
  for (const item of list.items) {
    if (!item.id) {
      item.id = crypto.randomUUID()
      changed = true
    }
  }
  return changed
}

async function loadList(c) {
  const user = c.get('user')
  const client = dbx(c)
  const existing = await client.getShoppingList(user.userId)
  const list = existing || emptyList(user.userId)
  if (!Array.isArray(list.items)) list.items = []
  if (ensureItemIds(list) && existing) {
    list.updatedAt = new Date().toISOString()
    await client.saveShoppingList(user.userId, list)
  }
  return list
}

shopping.get('/', async (c) => {
  const list = await loadList(c)
  return c.json({ success: true, data: list })
})

shopping.put('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const list = {
    ...emptyList(user.userId),
    ...body,
    id: `shopping-list-${user.userId}`,
    userId: user.userId,
    updatedAt: new Date().toISOString(),
    items: Array.isArray(body.items) ? body.items : []
  }
  await dbx(c).saveShoppingList(user.userId, list)
  return c.json({ success: true, data: list })
})

shopping.post('/items', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const ingredient = String(body.ingredient || body.name || '').trim()
  if (!ingredient) return c.json({ error: 'Ingrediente obbligatorio' }, 400)

  const list = await loadList(c)
  const item = {
    id: crypto.randomUUID(),
    ingredient,
    quantity: coerceQuantity(body.quantity),
    unit: body.unit || '',
    checked: false,
    recipeId: body.recipeId || null,
    recipeTitle: body.recipeTitle || null,
    recipeIds: body.recipeId ? [body.recipeId] : [],
    notes: body.notes || ''
  }
  list.items.unshift(item)
  list.updatedAt = new Date().toISOString()
  await dbx(c).saveShoppingList(user.userId, list)
  return c.json({ success: true, data: list }, 201)
})

shopping.post('/from-recipe', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const recipe = body.recipe
  if (!recipe?.ingredients?.length) {
    return c.json({ error: 'Ricetta senza ingredienti' }, 400)
  }

  const list = await loadList(c)
  const recipeId = recipe.id || null
  const recipeTitle = recipe.title || 'Ricetta'

  // Drop unchecked items from this recipe, then add all ingredients under it
  list.items = list.items.filter(
    (i) => i.checked || (i.recipeId || i.recipeIds?.[0]) !== recipeId
  )

  for (const ing of recipe.ingredients) {
    if (!ing?.name?.trim()) continue
    list.items.push({
      id: crypto.randomUUID(),
      ingredient: ing.name.trim(),
      quantity: coerceQuantity(ing.quantity),
      unit: ing.unit || '',
      checked: false,
      recipeId,
      recipeTitle,
      recipeIds: recipeId ? [recipeId] : [],
      notes: ing.notes || ''
    })
  }
  list.updatedAt = new Date().toISOString()
  await dbx(c).saveShoppingList(user.userId, list)
  return c.json({ success: true, data: list })
})

shopping.patch('/items/:itemId', async (c) => {
  const user = c.get('user')
  const itemId = c.req.param('itemId')
  const patch = await c.req.json()
  const list = await loadList(c)
  const item = list.items.find((i) => i.id === itemId)
  if (!item) return c.json({ error: 'Voce non trovata' }, 404)

  if (typeof patch.checked === 'boolean') item.checked = patch.checked
  if (patch.ingredient != null) item.ingredient = String(patch.ingredient).trim()
  if (patch.quantity !== undefined) item.quantity = coerceQuantity(patch.quantity)
  if (patch.unit != null) item.unit = patch.unit
  if (patch.notes != null) item.notes = patch.notes

  list.updatedAt = new Date().toISOString()
  await dbx(c).saveShoppingList(user.userId, list)
  return c.json({ success: true, data: list })
})

shopping.delete('/items/:itemId', async (c) => {
  const user = c.get('user')
  const itemId = c.req.param('itemId')
  const list = await loadList(c)
  const before = list.items.length
  list.items = list.items.filter((i) => i.id !== itemId)
  if (list.items.length === before) {
    return c.json({ error: 'Voce non trovata' }, 404)
  }
  list.updatedAt = new Date().toISOString()
  await dbx(c).saveShoppingList(user.userId, list)
  return c.json({ success: true, data: list })
})

shopping.post('/clear-recipe', async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const recipeId = body.recipeId ?? null
  const list = await loadList(c)
  list.items = list.items.filter((i) => {
    const key = i.recipeId || i.recipeIds?.[0] || null
    return key !== recipeId
  })
  list.updatedAt = new Date().toISOString()
  await dbx(c).saveShoppingList(user.userId, list)
  return c.json({ success: true, data: list })
})

shopping.post('/clear-checked', async (c) => {
  const user = c.get('user')
  const list = await loadList(c)
  list.items = list.items.filter((i) => !i.checked)
  list.updatedAt = new Date().toISOString()
  await dbx(c).saveShoppingList(user.userId, list)
  return c.json({ success: true, data: list })
})

export default shopping
