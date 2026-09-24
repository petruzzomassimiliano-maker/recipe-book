import { geminiGenerateContent, parseGeminiJson } from '../geminiClient.js'
import { emptyDraft, refineIngredientFields, stripTags } from './_base.js'
import { STEPS_READABILITY_RULES, improveStepsReadability } from './readableSteps.js'
import { withSection } from './sections.js'

function normalizeAiUnit(unit) {
  const u = String(unit || '').trim().toLowerCase().replace(/\.$/, '')
  if (!u) return ''
  if (/^q\.?\s*b\.?$|^qb$/.test(u)) return ''
  if (u === 'gr') return 'g'
  if (u === 'lt' || u === 'litro' || u === 'litri') return 'l'
  return u
}

export const RECIPE_JSON_SCHEMA_HINT = `{
  "title": "string",
  "servings": number (persone/porzioni, NON grammi/ml della resa),
  "prepTime": number (minutes),
  "cookTime": number (minutes),
  "difficulty": "easy"|"medium"|"hard",
  "cuisine": "string",
  "notes": "string (se la pagina dice resa in g/ml es. 850 grammi, mettila qui come Resa: 850 g)",
  "ingredients": [{ "name": "string", "quantity": number|string|null, "unit": "string", "notes": "string", "section": "string (opzionale)" }],
  "steps": [{ "instruction": "string", "section": "string (opzionale)" }],
  "imageUrl": "string|null"
}
Sezioni (componenti): se la ricetta originale divide ingredienti e/o procedimento per componente
(es. "Pan di Spagna", "Crema al burro al cioccolato", "Bagna", "Assemblaggio"), metti quel nome in
"section" su ogni ingrediente/passo del gruppo, nello stesso ordine della pagina. Se la ricetta NON
è divisa, ometti "section". Non inventare sezioni.`

/**
 * Pull a compact, recipe-relevant text blob from HTML for Gemini.
 */
export function extractReadableRecipeText(html, { maxChars = 14000 } = {}) {
  let text = String(html || '')
  text = text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')

  // Prefer main / article if present
  const main = text.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i)
  if (main?.[1] && main[1].length > 400) text = main[1]

  text = stripTags(text)
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length > maxChars) text = text.slice(0, maxChars)
  return text
}

export function normalizeAiDraft(parsed, sourceUrl, sourceProvider = 'gemini') {
  const draft = emptyDraft(sourceUrl, sourceProvider)
  draft.title = String(parsed.title || '').trim()
  // Guard: AI sometimes copies yield grams into servings (e.g. 850 g → 850 porzioni)
  const rawServings = Number(parsed.servings)
  draft.servings =
    Number.isFinite(rawServings) && rawServings > 0 && rawServings <= 48
      ? Math.round(rawServings)
      : 4
  draft.prepTime = Number(parsed.prepTime) || 0
  draft.cookTime = Number(parsed.cookTime) || 0
  const diff = String(parsed.difficulty || 'easy').toLowerCase()
  draft.difficulty = ['easy', 'medium', 'hard'].includes(diff) ? diff : 'easy'
  draft.cuisine = String(parsed.cuisine || '').trim()
  draft.notes = String(parsed.notes || '').trim()
  draft.imageUrl = parsed.imageUrl || null
  draft.tags = []

  draft.ingredients = (Array.isArray(parsed.ingredients) ? parsed.ingredients : [])
    .map((ing) => {
      const refined = refineIngredientFields({
        name: String(ing?.name || '').trim().replace(/farina['’]0\b/gi, 'farina 00'),
        quantity: ing?.quantity,
        unit: normalizeAiUnit(ing?.unit),
        notes: String(ing?.notes || '').trim()
      })
      if (!refined) return null
      let { name, quantity, unit, notes } = refined
      if (/^q\.?\s*b\.?$/i.test(String(ing?.unit || '')) || quantity === 'q.b.') {
        quantity = 'q.b.'
        unit = ''
      }
      return withSection({ name, quantity, unit, notes }, ing?.section)
    })
    .filter((ing) => ing?.name)

  draft.steps = improveStepsReadability(
    (Array.isArray(parsed.steps) ? parsed.steps : [])
      .map((s) =>
        withSection({ instruction: String(s?.instruction || s?.text || '').trim() }, s?.section)
      )
      .filter((s) => s.instruction)
  )

  return draft
}

export async function parseRecipeWithGeminiText(apiKey, { html, sourceUrl, weakDraft = null }) {
  const pageText = extractReadableRecipeText(html)
  if (pageText.length < 80) {
    throw new Error('Testo pagina troppo corto per Gemini')
  }

  const weakHint = weakDraft
    ? `\nBozza precedente (da correggere se sbagliata):\n${JSON.stringify({
        title: weakDraft.title,
        ingredients: weakDraft.ingredients,
        steps: weakDraft.steps
      }).slice(0, 4000)}\n`
    : ''

  const prompt = `Sei un estrattore di ricette. Dal testo di una pagina web, restituisci SOLO un JSON valido con questo schema:
${RECIPE_JSON_SCHEMA_HINT}

Regole:
- Lingua: mantieni italiano se la pagina è in italiano
- servings = numero di PORZIONI/PERSONE (tipicamente 2–12). Se la pagina dice "Dosi per: 850 grammi" o resa in g/ml/kg, NON usare quel numero come servings: metti Resa in notes e stima porzioni ragionevoli (es. 4) oppure 4
- quantity: numero, frazione decimale, oppure la stringa "q.b." quando è quanto basta; null se sconosciuta
- unit: g, ml, cucchiaio, cucchiaino, ecc. (vuoto se q.b.)
- name: solo il nome dell'ingrediente, SENZA dose
- Ignora pubblicità, commenti, newsletter
${STEPS_READABILITY_RULES}
${weakHint}
URL: ${sourceUrl}

TESTO PAGINA:
${pageText}`

  const text = await geminiGenerateContent(apiKey, [{ text: prompt }])
  const parsed = parseGeminiJson(text)
  return normalizeAiDraft(parsed, sourceUrl)
}

export async function parseRecipeWithGeminiVision(apiKey, { imageBase64, mimeType = 'image/png', sourceUrl, pageText = '' }) {
  const prompt = `Analizza lo screenshot di una pagina ricetta (OCR + comprensione). Restituisci SOLO JSON con schema:
${RECIPE_JSON_SCHEMA_HINT}

Regole:
- Estrai titolo, ingredienti con dose separate (quantity/unit/name), passaggi
- quantity "q.b." se quanto basta; name senza dose
- Ignora menu, cookie banner, ads
- Se il testo sotto aiuta, usalo come supporto
${STEPS_READABILITY_RULES}

URL: ${sourceUrl}
TESTO SUPPORTO (opzionale):
${String(pageText || '').slice(0, 6000)}`

  const text = await geminiGenerateContent(apiKey, [
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: imageBase64
      }
    }
  ])
  const parsed = parseGeminiJson(text)
  return normalizeAiDraft(parsed, sourceUrl)
}

/**
 * Foto di ricetta (libro, appunti, schermo telefono) → draft.
 * envOrKey: c.env oppure una API key (compatibile con geminiGenerateContent).
 */
export async function parseRecipePhotoWithGemini(
  envOrKey,
  { imageBase64, mimeType = 'image/jpeg', sourceUrl = null }
) {
  const prompt = `Sei un assistente di cucina. Analizza la FOTO di una ricetta (libro, quaderno, schermo, foglio stampato).
Estrai la ricetta completa. Restituisci SOLO JSON con schema:
${RECIPE_JSON_SCHEMA_HINT}

Regole:
- OCR + comprensione: leggi titolo, ingredienti e passaggi anche se scritti a mano (meglio sforzo che inventare)
- quantity: numero o "q.b."; name SENZA dose; unit tipiche IT (g, ml, cucchiaio…)
- Non inventare ingredienti o passi non visibili; se poco leggibile, metti notes con cosa manca
- Lingua: italiano se il testo è in italiano
- imageUrl: null
${STEPS_READABILITY_RULES}`

  const text = await geminiGenerateContent(envOrKey, [
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: imageBase64
      }
    }
  ])
  const parsed = parseGeminiJson(text)
  const draft = normalizeAiDraft(parsed, sourceUrl, 'photo')
  draft.extractMethod = 'gemini-photo'
  return draft
}

/**
 * Rewrite only the steps for kitchen readability (used after HTML scrape too).
 */
export async function polishStepsWithGemini(apiKey, steps) {
  // AI rewrite returns a flat list and would drop component sections.
  if ((steps || []).some((s) => String(s?.section || '').trim())) {
    return improveStepsReadability(steps)
  }
  const input = (steps || [])
    .map((s) => String(s?.instruction || '').trim())
    .filter(Boolean)
  if (!input.length) return steps

  const needsPolish = input.some(
    (t) => t.length > 140 || (t.match(/[.!?]/g) || []).length >= 2
  )
  if (!needsPolish) return improveStepsReadability(steps)

  const prompt = `Riscrivi SOLO i passi di preparazione di una ricetta per renderli più leggibili in cucina.
Restituisci SOLO JSON: { "steps": [{ "instruction": "string" }] }

${STEPS_READABILITY_RULES}

Passi originali:
${JSON.stringify(input)}`

  const text = await geminiGenerateContent(apiKey, [{ text: prompt }])
  const parsed = parseGeminiJson(text)
  const next = Array.isArray(parsed.steps) ? parsed.steps : parsed
  if (!Array.isArray(next) || !next.length) return improveStepsReadability(steps)
  return improveStepsReadability(
    next.map((s) => ({
      instruction: String(s?.instruction || s || '').trim()
    })).filter((s) => s.instruction)
  )
}

/**
 * Capture a page screenshot as base64 (best-effort, no Browser Rendering required).
 */
export async function capturePageScreenshotBase64(pageUrl) {
  // 1) thum.io free image endpoint
  try {
    const thum = `https://image.thum.io/get/width/960/crop/1600/noanimate/${pageUrl}`
    const res = await fetch(thum, {
      headers: { Accept: 'image/png,image/jpeg,*/*' },
      redirect: 'follow'
    })
    if (res.ok) {
      const buf = await res.arrayBuffer()
      if (buf.byteLength > 8000) {
        const mime = res.headers.get('content-type')?.split(';')[0] || 'image/png'
        return { base64: arrayBufferToBase64(buf), mimeType: mime.startsWith('image/') ? mime : 'image/png' }
      }
    }
  } catch {
    // try next
  }

  // 2) microlink screenshot URL
  try {
    const metaRes = await fetch(
      `https://api.microlink.io?url=${encodeURIComponent(pageUrl)}&screenshot=true&meta=false&embed=screenshot.url`
    )
    const meta = await metaRes.json().catch(() => null)
    const shotUrl = meta?.data?.screenshot?.url
    if (shotUrl) {
      const imgRes = await fetch(shotUrl)
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer()
        if (buf.byteLength > 8000) {
          const mime = imgRes.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
          return { base64: arrayBufferToBase64(buf), mimeType: mime.startsWith('image/') ? mime : 'image/jpeg' }
        }
      }
    }
  } catch {
    // give up
  }

  return null
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}
