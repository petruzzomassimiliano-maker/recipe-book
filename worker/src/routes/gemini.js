import { Hono } from 'hono'
import { DropboxClient } from '../lib/dropboxClient.js'
import { canViewRecipe, canEditRecipe } from '../lib/rbac.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  collectGeminiKeys,
  geminiChat,
  geminiGenerateContent,
  parseGeminiJson,
  recipeContextSummary
} from '../lib/geminiClient.js'

const gemini = new Hono()
gemini.use('*', authMiddleware)

function dbx(c) {
  return new DropboxClient(c.get('dropboxToken'))
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

function normalizeMethodId(raw) {
  const id = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  const aliased = METHOD_ALIASES[id] || id
  return KNOWN_METHODS.has(aliased) ? aliased : 'altro'
}

function detectHintedMethods(recipe) {
  const title = String(recipe?.title || '')
  const blob = [
    title,
    recipe?.notes,
    recipe?.sourceUrl,
    ...(recipe?.steps || []).map((s) => s.instruction || ''),
    ...(recipe?.metadata?.tags || [])
  ]
    .filter(Boolean)
    .join('\n')

  const rules = [
    {
      id: 'friggitrice_aria',
      re: /friggitrice\s+ad\s+aria|air\s*[- ]?\s*fryer|\bairfryer\b|cottura\s+ad\s+aria/i
    },
    { id: 'forno', re: /\bforno\b|in\s+forno/i },
    { id: 'padella', re: /\bpadella\b|in\s+padella|soffrigg|\bwok\b/i },
    { id: 'bollitura', re: /\bboll[ie]|acqua\s+bollente/i },
    { id: 'vapore', re: /\ba\s+vapore\b|\bvaporiera\b|\bsteam/i },
    { id: 'grill', re: /\bgrill\b|\bgriglia\b|\bbarbecue\b/i },
    { id: 'microonde', re: /\bmicroonde\b|\bmicrowave\b/i }
  ]

  const hinted = []
  for (const rule of rules) {
    const inTitle = rule.re.test(title)
    if (inTitle || rule.re.test(blob)) {
      hinted.push({ id: rule.id, fromTitle: inTitle })
    }
  }
  return hinted
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
    const hinted = detectHintedMethods(recipe)
    const titleHints = hinted.filter((h) => h.fromTitle).map((h) => h.id)
    const allHints = hinted.map((h) => h.id)

    const focusBlock = focusMethod
      ? `
FOCUS OBBLIGATORIO: l'utente ha scelto "${focusMethod}".
Devi restituire UN metodo dettagliato con method="${focusMethod}" (temperature, tempo, notes pratiche passo-passo, differences rispetto al metodo della ricetta).
Puoi aggiungere al massimo 1-2 alternative brevi.
`
      : ''

    const prompt = `Analizza questa ricetta e individua i metodi di cottura possibili/consigliati.
Restituisci SOLO JSON:
{
  "methods": [
    {
      "method": "forno|padella|friggitrice_aria|bollitura|vapore|grill|microonde|altro",
      "label": "nome leggibile IT",
      "temperature": "es. 180°C oppure vuoto",
      "time": "es. 25-30 min",
      "notes": "come procedere in breve (passi concreti)",
      "differences": "cosa cambia rispetto agli altri metodi (texture, tempo, grassi…)",
      "recommended": true/false
    }
  ],
  "summary": "1-2 frasi su quale metodo preferire e perché"
}

Regole PRIORITARIE:
- Il TITOLO è vincolante: se cita un elettrodomestico/metodo, quel method DEVE comparire con recommended:true
- Hint già rilevati nel titolo: ${titleHints.length ? titleHints.join(', ') : '(nessuno)'}
- Hint nel testo/URL: ${allHints.length ? allHints.join(', ') : '(nessuno)'}
- "friggitrice ad aria" / air fryer → method="friggitrice_aria" (NON confonderla con frittura in padella)
- Se ha senso proporre alternative (forno ↔ friggitrice_aria ↔ padella), aggiungile con tempi/temperature stimati
- Non inventare metodi assurdi; massimo 4 metodi (o 1-3 se c'è FOCUS)
- Lingua italiana
${focusBlock}
RICETTA:
${recipeContextSummary(recipe)}
${recipe.sourceUrl ? `URL fonte: ${recipe.sourceUrl}` : ''}`

    const text = await geminiGenerateContent(c.env, [{ text: prompt }], {
      temperature: 0.2,
      json: true
    })
    const parsed = parseGeminiJson(text)
    let methods = normalizeMethods(parsed)

    // Garantisce metodi hintati dal titolo anche se il modello li omette
    for (const hint of titleHints) {
      if (!methods.some((m) => m.method === hint)) {
        const labels = {
          friggitrice_aria: 'Friggitrice ad aria',
          forno: 'Forno',
          padella: 'Padella',
          bollitura: 'Bollitura',
          vapore: 'Vapore',
          grill: 'Grill',
          microonde: 'Microonde'
        }
        methods.unshift({
          id: crypto.randomUUID(),
          method: hint,
          label: labels[hint] || hint,
          temperature: '',
          time: '',
          notes: 'Metodo indicato nel titolo della ricetta.',
          differences: '',
          recommended: true
        })
      } else {
        methods = methods.map((m) =>
          m.method === hint ? { ...m, recommended: true } : { ...m, recommended: false }
        )
      }
    }

    if (focusMethod && !methods.some((m) => m.method === focusMethod)) {
      return c.json({ error: `L'IA non ha prodotto indicazioni per ${focusMethod}` }, 502)
    }

    const preferred = titleHints[0] || methods.find((m) => m.recommended)?.method || focusMethod || null
    if (focusMethod) {
      methods = mergeMethods(recipe.cookingMethods || [], methods, preferred)
    } else if (preferred) {
      methods = methods.map((m) => ({ ...m, recommended: m.method === preferred }))
    }

    const summary = String(parsed.summary || recipe.cookingMethodsSummary || '').trim()

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
 * POST /api/gemini/from-photo
 * Body: { imageBase64, mimeType? } — foto ricetta → draft (come scraper)
 */
gemini.post('/from-photo', async (c) => {
  try {
    const body = await c.req.json()
    let imageBase64 = String(body.imageBase64 || body.image || '').trim()
    if (imageBase64.includes(',')) imageBase64 = imageBase64.split(',').pop()
    imageBase64 = imageBase64.replace(/\s/g, '')
    if (!imageBase64) return c.json({ error: 'Immagine obbligatoria (imageBase64)' }, 400)

    const mimeType = String(body.mimeType || 'image/jpeg').toLowerCase()
    if (!/^image\/(jpeg|jpg|png|webp)$/.test(mimeType)) {
      return c.json({ error: 'Formato non supportato (jpeg, png, webp)' }, 400)
    }

    // ~6 MB base64 ceiling
    if (imageBase64.length > 8_000_000) {
      return c.json({ error: 'Immagine troppo grande (max ~6 MB)' }, 413)
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
      return c.json({ error: 'Nessuna ricetta riconosciuta nella foto' }, 422)
    }

    return c.json({
      success: true,
      data: {
        ...draft,
        isShared: true,
        isPrivate: false
      }
    })
  } catch (err) {
    console.error('[gemini/from-photo]', err.message)
    const status = err.status === 429 ? 429 : 500
    return c.json({ error: err.message || 'Analisi foto fallita' }, status)
  }
})

export default gemini
