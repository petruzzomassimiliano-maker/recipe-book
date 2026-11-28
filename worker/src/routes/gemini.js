import { Hono } from 'hono'
import { canViewRecipe, canEditRecipe } from '../lib/rbac.js'
import { editorMiddleware } from '../middleware/auth.js'
import { detectRecipeMethods } from '../lib/cookingDetect.js'
import { generateStorageAdvice } from '../lib/storageAdvice.js'
import { buildCookingPrompt } from '../lib/cookingPrompt.js'
import {
  collectGeminiKeys,
  geminiChat,
  geminiGenerateContent,
  parseGeminiJson,
  recipeContextSummary
} from '../lib/geminiClient.js'

const gemini = new Hono()
// Gemini/scraping costs quota → PIN di famiglia richiesto
gemini.use('*', ...editorMiddleware)

function dbx(c) {
  return c.get('dbx')
}

const METHOD_ALIASES = {
  friggitrice: 'friggitrice_aria',
  air_fryer: 'friggitrice_aria',
  airfryer: 'friggitrice_aria',
  oven: 'forno',
  pan: 'padella',
  boil: 'bollitura',
  steam: 'vapore',
  microwave: 'microonde'
}

const KNOWN_METHODS = new Set([
  'forno',
  'padella',
  'friggitrice_aria',
  'bollitura',
  'vapore',
  'grill',
  'microonde',
  'altro'
])

/** Methods cooked on the hob, where gas vs induction matters. */
const STOVETOP = new Set(['padella', 'bollitura', 'vapore', 'grill'])

function normalizeMethodId(raw) {
  const id = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  const aliased = METHOD_ALIASES[id] || id
  return KNOWN_METHODS.has(aliased) ? aliased : 'altro'
}

function normalizeMethods(raw) {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.methods) ? raw.methods : []
  return list
    .map((m) => ({
      id: m.id || crypto.randomUUID(),
      method: normalizeMethodId(m.method || m.id || 'altro'),
      label: String(m.label || m.method || 'Metodo').trim(),
      temperature: String(m.temperature || m.temp || '').trim(),
      time: String(m.time || m.duration || '').trim(),
      notes: String(m.notes || '').trim(),
      differences: String(m.differences || m.diff || '').trim(),
      // Stovetop methods only: what changes on an induction hob (power level, times, pans)
      induction: STOVETOP.has(normalizeMethodId(m.method || m.id)) ? String(m.induction || '').trim() : '',
      recommended: Boolean(m.recommended)
    }))
    .filter((m) => m.label)
}

function mergeMethods(existing, incoming, recommendedId) {
  const map = new Map()
  for (const m of existing || []) {
    map.set(normalizeMethodId(m.method), { ...m, method: normalizeMethodId(m.method) })
  }
  for (const m of incoming || []) {
    const id = normalizeMethodId(m.method)
    map.set(id, { ...m, method: id, id: m.id || map.get(id)?.id || crypto.randomUUID() })
  }
  if (recommendedId) {
    const rec = normalizeMethodId(recommendedId)
    for (const [id, m] of map) {
      map.set(id, { ...m, recommended: id === rec })
    }
  }
  return [...map.values()]
}

/**
 * POST /api/gemini/cooking-methods
 * Body: { recipeId } or { recipe }
 * Analyzes cooking methods; if recipeId + can edit, saves on recipe.
 */
gemini.post('/cooking-methods', async (c) => {
  try {
    const keys = collectGeminiKeys(c.env)
    if (!keys.length) return c.json({ error: 'GEMINI_API_KEY non configurata' }, 500)

    const body = await c.req.json()
    const user = c.get('user')
    let recipe = body.recipe || null

    if (body.recipeId) {
      recipe = await dbx(c).getRecipe(body.recipeId)
      if (!recipe) return c.json({ error: 'Ricetta non trovata' }, 404)
      if (!canViewRecipe(user, recipe)) return c.json({ error: 'Forbidden' }, 403)
    }
    if (!recipe?.title) return c.json({ error: 'Ricetta obbligatoria' }, 400)

    const focusMethod = body.focusMethod ? normalizeMethodId(body.focusMethod) : null
    // The recipe's own method comes from its text, never from the model
    const detected = detectRecipeMethods(recipe)
    const primary = detected.primary
    const LABELS = {
      friggitrice_aria: 'Friggitrice ad aria',
      forno: 'Forno',
      padella: 'Padella',
      bollitura: 'Bollitura',
      vapore: 'Vapore',
      grill: 'Grill / griglia',
      microonde: 'Microonde'
    }

    const prompt = buildCookingPrompt(recipe, { primary, params: detected.params, focusMethod })

    const text = await geminiGenerateContent(c.env, [{ text: prompt }], {
      temperature: 0.2,
      json: true
    })
    const parsed = parseGeminiJson(text)
    let methods = normalizeMethods(parsed).filter((m) => m.method !== 'altro' || m.method === focusMethod)

    if (focusMethod && !methods.some((m) => m.method === focusMethod)) {
      return c.json({ error: `L'IA non ha prodotto indicazioni per ${LABELS[focusMethod] || focusMethod}` }, 502)
    }

    // Tapping one appliance only adds/refreshes that guide; "Aggiorna tutti" replaces the list
    if (focusMethod) methods = mergeMethods(recipe.cookingMethods || [], methods, null)

    // Recipe's own method: always present, params copied from the text
    if (primary) {
      let own = methods.find((m) => m.method === primary)
      if (!own) {
        own = {
          id: crypto.randomUUID(),
          method: primary,
          label: LABELS[primary] || primary,
          temperature: '',
          time: '',
          notes: 'Metodo indicato nella ricetta: segui i passi della preparazione.',
          differences: '',
          recommended: true
        }
        methods.unshift(own)
      }
      if (detected.params.temperature) own.temperature = detected.params.temperature
      if (detected.params.time) own.time = detected.params.time
    }

    // Recommended = the recipe's method; tapping an alternative never changes it
    const previousRec = (recipe.cookingMethods || []).find((m) => m.recommended)?.method
    const preferred =
      primary || (previousRec ? normalizeMethodId(previousRec) : null) || methods[0]?.method || null
    methods = methods.map((m) => ({ ...m, recommended: m.method === preferred }))

    // A single-appliance answer talks about that appliance: keep the overall summary
    const summary = String(
      (focusMethod ? recipe.cookingMethodsSummary || parsed.summary : parsed.summary || recipe.cookingMethodsSummary) || ''
    ).trim()

    let saved = false
    if (body.recipeId && canEditRecipe(user, recipe)) {
      recipe = {
        ...recipe,
        cookingMethods: methods,
        cookingMethodsSummary: summary || recipe.cookingMethodsSummary || '',
        updatedAt: new Date().toISOString()
      }
      await dbx(c).saveRecipe(recipe.id, recipe)
      saved = true
    }

    return c.json({
      success: true,
      data: { methods, summary: summary || recipe.cookingMethodsSummary || '', recipe: saved ? recipe : undefined }
    })
  } catch (err) {
    console.error('[gemini/cooking-methods]', err.message)
    return c.json({ error: err.message || 'Analisi fallita' }, 500)
  }
})

/**
 * POST /api/gemini/ask-recipe
 * Body: { recipeId? , recipe?, messages: [{ role, text }] }
 */
gemini.post('/ask-recipe', async (c) => {
  try {
    const keys = collectGeminiKeys(c.env)
    if (!keys.length) return c.json({ error: 'GEMINI_API_KEY non configurata' }, 500)

    const body = await c.req.json()
    const user = c.get('user')
    let recipe = body.recipe || null

    if (body.recipeId) {
      recipe = await dbx(c).getRecipe(body.recipeId)
      if (!recipe) return c.json({ error: 'Ricetta non trovata' }, 404)
      if (!canViewRecipe(user, recipe)) return c.json({ error: 'Forbidden' }, 403)
    }
    if (!recipe?.title) return c.json({ error: 'Ricetta obbligatoria' }, 400)

    const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : []
    if (!messages.length) return c.json({ error: 'Scrivi una domanda' }, 400)

    const systemInstruction = `Sei un assistente di cucina esperto per l'app Recipe Book.
Rispondi in italiano, in modo pratico e chiaro.
Formato obbligatorio:
- Sezioni con titoli brevi in grassetto che finiscono con i due punti (es. **In frigorifero:**)
- Dettagli in elenco con trattino (- )
- Frasi corte; evita un unico blocco di testo lungo
Puoi suggerire modifiche, sostituzioni, conservazione, tempi, temperature, varianti, errori comuni.
Basa le risposte su QUESTA ricetta; se non sai qualcosa, dillo.
Non inventare allergeni certi se non indicati — segnala solo possibilità.

RICETTA DI RIFERIMENTO:
${recipeContextSummary(recipe)}
${
  recipe.cookingMethods?.length
    ? `\nMetodi cottura noti:\n${JSON.stringify(recipe.cookingMethods)}\n${recipe.cookingMethodsSummary || ''}`
    : ''
}`

    const reply = await geminiChat(c.env, messages, {
      temperature: 0.45,
      systemInstruction
    })

    return c.json({ success: true, data: { reply } })
  } catch (err) {
    console.error('[gemini/ask-recipe]', err.message)
    return c.json({ error: err.message || 'Chat fallita' }, 500)
  }
})

/**
 * POST /api/gemini/what-to-cook
 * Body: { have: string[] } — ingredients at home → best recipes from the family book.
 * Returns { suggestions: [{ id, title, reason, missing: string[] }] } (ids from the index only).
 */
gemini.post('/what-to-cook', async (c) => {
  try {
    const keys = collectGeminiKeys(c.env)
    if (!keys.length) return c.json({ error: 'GEMINI_API_KEY non configurata' }, 500)
    const body = await c.req.json().catch(() => ({}))
    const have = (Array.isArray(body.have) ? body.have : [])
      .map((h) => String(h || '').trim().slice(0, 60))
      .filter(Boolean)
      .slice(0, 30)
    if (!have.length) return c.json({ error: 'Scrivi almeno un ingrediente' }, 400)

    const index = await dbx(c).getRecipesIndex()
    const catalog = index
      .filter((e) => e?.id && e.title)
      .map((e) => ({
        id: e.id,
        t: e.title,
        i: (e.ingredientNames || []).slice(0, 40)
      }))
    if (!catalog.length) return c.json({ success: true, data: { suggestions: [] } })

    const prompt = `Ho in casa: ${have.join(', ')}.
Ecco il ricettario di famiglia (JSON: id, t = titolo, i = ingredienti; se i è vuoto deduci dal titolo):
${JSON.stringify(catalog)}

Scegli fino a 6 ricette DI QUESTO RICETTARIO che conviene fare con quello che ho, dalla più adatta.
Considera sinonimi e varianti (es. "passata" ~ "pomodoro", "grana" ~ "parmigiano").
Dispensa di base sempre disponibile: sale, pepe, olio, acqua, zucchero, farina — non contarli come mancanti.
Rispondi SOLO con JSON:
{"suggestions":[{"id":"…","reason":"frase breve in italiano su perché va bene","missing":["ingrediente che manca", …]}]}
Usa solo id presenti nell'elenco. Se nessuna ricetta è adatta, restituisci {"suggestions":[]}.`

    const text = await geminiGenerateContent(c.env, [{ text: prompt }], { temperature: 0.2, json: true })
    const parsed = parseGeminiJson(text)
    const byId = new Map(catalog.map((r) => [r.id, r]))
    const seen = new Set()
    const suggestions = (Array.isArray(parsed?.suggestions) ? parsed.suggestions : [])
      .filter((s) => byId.has(s?.id) && !seen.has(s.id) && seen.add(s.id))
      .slice(0, 6)
      .map((s) => ({
        id: s.id,
        title: byId.get(s.id).t,
        reason: String(s.reason || '').slice(0, 300),
        missing: (Array.isArray(s.missing) ? s.missing : []).map((m) => String(m).slice(0, 60)).slice(0, 12)
      }))
    return c.json({ success: true, data: { suggestions } })
  } catch (err) {
    console.error('[gemini/what-to-cook]', err.message)
    return c.json({ error: err.message || 'Suggerimenti non riusciti' }, 500)
  }
})

/**
 * POST /api/gemini/from-photo
 * Body: { imageBase64, mimeType? } — foto o PDF di una ricetta → draft (come scraper)
 */
gemini.post('/from-photo', async (c) => {
  try {
    const body = await c.req.json()
    let imageBase64 = String(body.imageBase64 || body.image || '').trim()
    if (imageBase64.includes(',')) imageBase64 = imageBase64.split(',').pop()
    imageBase64 = imageBase64.replace(/\s/g, '')
    if (!imageBase64) return c.json({ error: 'Immagine obbligatoria (imageBase64)' }, 400)

    const mimeType = String(body.mimeType || 'image/jpeg').toLowerCase()
    const isPdf = mimeType === 'application/pdf'
    if (!isPdf && !/^image\/(jpeg|jpg|png|webp)$/.test(mimeType)) {
      return c.json({ error: 'Formato non supportato (jpeg, png, webp o pdf)' }, 400)
    }

    // base64 ceiling: ~6 MB images (client resizes them), ~10 MB PDF
    if (imageBase64.length > (isPdf ? 14_000_000 : 8_000_000)) {
      return c.json({ error: isPdf ? 'PDF troppo grande (max 10 MB)' : 'Immagine troppo grande (max ~6 MB)' }, 413)
    }

    if (!collectGeminiKeys(c.env).length) {
      return c.json({ error: 'GEMINI_API_KEY non configurata' }, 503)
    }

    const { parseRecipePhotoWithGemini } = await import('../lib/scrapers/geminiExtract.js')
    const draft = await parseRecipePhotoWithGemini(c.env, {
      imageBase64,
      mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType,
      sourceUrl: body.sourceUrl || null
    })

    if (!draft.title && !draft.ingredients?.length) {
      return c.json({ error: isPdf ? 'Nessuna ricetta riconosciuta nel PDF' : 'Nessuna ricetta riconosciuta nella foto' }, 422)
    }

    return c.json({
      success: true,
      data: draft
    })
  } catch (err) {
    console.error('[gemini/from-photo]', err.message)
    const status = err.status === 429 ? 429 : 500
    return c.json({ error: err.message || 'Analisi file fallita' }, status)
  }
})

/**
 * POST /api/gemini/storage  Body: { recipeId }
 * Generate (or regenerate) "come conservarla" now and save it on the recipe.
 * New/edited recipes get it automatically in the background (routes/recipes.js).
 */
gemini.post('/storage', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const recipeId = String(body.recipeId || '')
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(recipeId)) return c.json({ error: 'Ricetta non valida' }, 400)
    const client = dbx(c)
    const recipe = await client.getRecipe(recipeId)
    if (!recipe) return c.json({ error: 'Ricetta non trovata' }, 404)

    const storage = await generateStorageAdvice(c.env, recipe)
    const latest = (await client.getRecipe(recipeId)) || recipe
    await client.saveRecipe(recipeId, { ...latest, storage })
    return c.json({ success: true, data: { storage } })
  } catch (err) {
    console.error('[gemini/storage]', err.message)
    return c.json({ error: err.message || 'Consigli di conservazione non disponibili' }, err.status === 429 ? 429 : 500)
  }
})

export default gemini
