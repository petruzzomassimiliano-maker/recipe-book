/**
 * "Come conservarla": Gemini suggests how and how long to keep a dish
 * (room temperature / fridge / freezer, reheating, food-safety warnings).
 * Stored on the recipe as `storage`, tied to a signature of title+ingredients+steps
 * so it is regenerated only when the recipe content changes.
 */
import { collectGeminiKeys, geminiGenerateContent, parseGeminiJson, recipeContextSummary } from './geminiClient.js'

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Bump when the prompt rules change: old advice is then redone at the next save. */
const STORAGE_PROMPT_VERSION = 2

/** Changes only when what you'd store changes (not servings, tags, photo…) or the rules do. */
export async function storageSignature(recipe) {
  const basis = JSON.stringify([
    STORAGE_PROMPT_VERSION,
    String(recipe?.title || '').trim().toLowerCase(),
    (recipe?.ingredients || []).map((i) => String(i?.name || '').trim().toLowerCase()),
    (recipe?.steps || []).map((s) => String(s?.instruction || '').trim())
  ])
  return (await sha256Hex(basis)).slice(0, 16)
}

function str(v, max = 400) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function place(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, duration: '', how: '' }
  return {
    ok: raw.ok !== false && Boolean(str(raw.duration) || str(raw.how)),
    duration: str(raw.duration, 60),
    how: str(raw.how)
  }
}

function normalize(parsed) {
  const p = parsed && typeof parsed === 'object' ? parsed : {}
  const freezer = place(p.freezer)
  return {
    room: place(p.room),
    fridge: place(p.fridge),
    freezer: { ...freezer, thaw: freezer.ok ? str(p.freezer?.thaw, 300) : '' },
    reheat: str(p.reheat),
    tips: (Array.isArray(p.tips) ? p.tips : []).map((t) => str(t, 200)).filter(Boolean).slice(0, 4),
    warning: str(p.warning, 300)
  }
}

export async function generateStorageAdvice(env, recipe) {
  const prompt = `Sei un esperto di sicurezza alimentare e cucina casalinga italiana.
Per il piatto PRONTO di questa ricetta indica come conservarlo e per quanto tempo.
Restituisci SOLO JSON:
{
  "room":    { "ok": true/false, "duration": "es. max 2 ore", "how": "come" },
  "fridge":  { "ok": true/false, "duration": "es. 2-3 giorni", "how": "contenitore, ripiano, separare la salsa…" },
  "freezer": { "ok": true/false, "duration": "es. fino a 3 mesi", "how": "come congelare (porzioni, prima/dopo cottura)", "thaw": "come scongelare" },
  "reheat": "come riscaldare (o 'si mangia freddo')",
  "tips": ["1-3 consigli brevi e specifici per QUESTO piatto"],
  "warning": "avvertenza di sicurezza se serve (es. uova crude, riso, pesce, panna), altrimenti stringa vuota"
}

Regole:
- Tempi PRUDENTI secondo le linee guida di sicurezza alimentare (EFSA/Ministero della Salute): piatti cotti in frigo (a 4 °C o meno) di norma 2-3 giorni (max 4); pesce, molluschi, uova crude o poco cotte, creme, panna e mascarpone 1-2 giorni.
- A temperatura ambiente i cibi deperibili stanno al massimo 2 ore: vanno messi in frigo entro 2 ore dalla cottura, divisi in contenitori bassi per raffreddarli in fretta. Prodotti secchi da forno (pane, biscotti, torte senza creme) invece si conservano a temperatura ambiente, ben chiusi.
- Riso cotto: raffreddare in fretta, frigo max 1 giorno, riscaldare una sola volta fino a fumante. Pasta cotta: frigo 2-3 giorni.
- Preparazioni fatte in casa sott'olio o sottovuoto (aglio, erbe, pesto, verdure, funghi): rischio botulino. Solo in frigo, pochi giorni, mai a temperatura ambiente; per tenerle a lungo meglio congelarle. Segnalalo in "warning".
- Se un luogo non è adatto (es. fritti o insalate crude in congelatore, creme a temperatura ambiente) metti "ok": false e spiega il motivo in "how".
- Distingui, se utile, cosa congelare prima o dopo la cottura.
- Frasi brevi, pratiche, in italiano. Non inventare ingredienti.

RICETTA:
${recipeContextSummary(recipe)}`

  const text = await geminiGenerateContent(env, [{ text: prompt }], { temperature: 0.2, json: true })
  const storage = normalize(parseGeminiJson(text))
  if (!storage.fridge.how && !storage.freezer.how && !storage.room.how) {
    throw new Error('Gemini non ha restituito indicazioni di conservazione')
  }
  return { ...storage, sig: await storageSignature(recipe), generatedAt: new Date().toISOString() }
}

/**
 * Background job after a save: generate and attach `storage`, unless the recipe
 * changed again in the meantime (signature check on a fresh read).
 */
export async function refreshStorageInBackground(env, client, recipeId) {
  try {
    if (!collectGeminiKeys(env).length) return
    const recipe = await client.getRecipe(recipeId)
    if (!recipe) return
    const sig = await storageSignature(recipe)
    if (recipe.storage?.sig === sig) return
    const storage = await generateStorageAdvice(env, recipe)
    const latest = await client.getRecipe(recipeId)
    if (!latest || (await storageSignature(latest)) !== storage.sig) return
    await client.saveRecipe(recipeId, { ...latest, storage })
  } catch (err) {
    console.warn('[storage] background generation failed:', recipeId, err.message)
  }
}
