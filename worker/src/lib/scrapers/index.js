import { parseJsonLdRecipe } from './jsonld.js'
import { parseHeuristicRecipe } from './heuristic.js'
import { evaluateDraftQuality, isDraftAcceptable } from './quality.js'
import { improveStepsReadability } from './readableSteps.js'
import { collectGeminiKeys } from '../geminiClient.js'
import {
  capturePageScreenshotBase64,
  extractReadableRecipeText,
  parseRecipeWithGeminiText,
  parseRecipeWithGeminiVision,
  polishStepsWithGemini
} from './geminiExtract.js'
import { isYoutubeUrl } from '../youtube/ids.js'
import { parseRecipeFromYoutube } from '../youtube/parseRecipe.js'

const USER_AGENT =
  'Mozilla/5.0 (compatible; RecipeBookBot/0.1; +https://recipe-book.pages.dev)'

function detectProvider(url) {
  const host = new URL(url).hostname.replace(/^www\./, '')
  if (host.includes('allrecipes')) return 'allrecipes'
  if (host.includes('giallozafferano')) return 'giallozafferano'
  if (host.includes('bbcgoodfood') || host.includes('bbc.co.uk')) return 'bbcgoodfood'
  if (host.includes('jamieoliver')) return 'jamieoliver'
  if (host.includes('cookaround')) return 'cookaround'
  if (host.includes('tavolartegusto')) return 'tavolartegusto'
  return 'website'
}

async function polishDraftSteps(draft, geminiEnv, { allowGemini = true } = {}) {
  if (!draft?.steps?.length) return draft
  try {
    if (allowGemini && geminiEnv) {
      draft.steps = await polishStepsWithGemini(geminiEnv, draft.steps)
    } else {
      draft.steps = improveStepsReadability(draft.steps)
    }
  } catch (err) {
    console.error('[scraper] step polish failed:', err.message)
    draft.steps = improveStepsReadability(draft.steps)
  }
  return draft
}

function finalizeDraft(draft, { sourceUrl, provider, method, quality }) {
  draft.sourceUrl = sourceUrl
  draft.sourceProvider = provider
  draft.extractMethod = method
  draft.extractQuality = {
    score: quality.score,
    ok: quality.ok,
    reasons: quality.reasons
  }
  if (!draft.ingredients?.length) {
    draft.ingredients = [{ name: '', quantity: '', unit: 'g', notes: '' }]
  }
  if (!draft.steps?.length) {
    draft.steps = [{ instruction: '' }]
  }
  return draft
}

/**
 * Cascade:
 * 1) HTML JSON-LD / heuristic
 * 2) Gemini text (if quality fails and API key present)
 * 3) Screenshot + Gemini vision (last resort)
 */
export async function fetchRecipeFromUrl(url, { geminiEnv, geminiApiKey } = {}) {
  const gemini = geminiEnv || geminiApiKey || null
  const hasGemini = collectGeminiKeys(gemini).length > 0
  let parsedUrl
  try {
    parsedUrl = new URL(url)
  } catch {
    throw Object.assign(new Error('URL non valido'), { status: 400 })
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw Object.assign(new Error('Solo URL http/https'), { status: 400 })
  }

  const sourceUrl = parsedUrl.toString()

  // YouTube → dedicated transcript + Gemini path
  if (isYoutubeUrl(sourceUrl)) {
    return parseRecipeFromYoutube(gemini, { videoUrl: sourceUrl })
  }

  const res = await fetch(sourceUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8'
    },
    redirect: 'follow'
  })

  if (!res.ok) {
    throw Object.assign(new Error(`Impossibile scaricare la pagina (${res.status})`), {
      status: 502
    })
  }

  const html = await res.text()
  const provider = detectProvider(sourceUrl)
  const attempts = []

  // ── 1) HTML parsers ────────────────────────────────────────────────────────
  let draft =
    parseJsonLdRecipe(html, sourceUrl) ||
    parseHeuristicRecipe(html, sourceUrl, parsedUrl.hostname)

  let quality = evaluateDraftQuality(draft)
  attempts.push({ method: 'html', ok: quality.ok, score: quality.score, reasons: quality.reasons })

  const finish = async (method, extras = {}) => {
    // Gemini extract already formats steps; HTML path gets an extra polish pass.
    await polishDraftSteps(draft, hasGemini ? gemini : null, { allowGemini: method === 'html' })
    const out = finalizeDraft(draft, { sourceUrl, provider, method, quality })
    Object.assign(out, extras)
    return out
  }

  if (isDraftAcceptable(draft)) {
    return finish('html')
  }

  // ── 2) Gemini text ─────────────────────────────────────────────────────────
  if (hasGemini) {
    try {
      const aiDraft = await parseRecipeWithGeminiText(gemini, {
        html,
        sourceUrl,
        weakDraft: draft
      })
      const aiQuality = evaluateDraftQuality(aiDraft)
      attempts.push({
        method: 'gemini-text',
        ok: aiQuality.ok,
        score: aiQuality.score,
        reasons: aiQuality.reasons
      })

      if (aiQuality.ok || aiQuality.score > quality.score) {
        draft = aiDraft
        quality = aiQuality
      }

      if (isDraftAcceptable(draft)) {
        return finish('gemini-text')
      }
    } catch (err) {
      attempts.push({ method: 'gemini-text', ok: false, error: err.message })
      console.error('[scraper] gemini-text failed:', err.message)
    }

    // ── 3) Screenshot + vision ───────────────────────────────────────────────
    try {
      const shot = await capturePageScreenshotBase64(sourceUrl)
      if (!shot) {
        attempts.push({ method: 'gemini-vision', ok: false, error: 'screenshot non disponibile' })
      } else {
        const visionDraft = await parseRecipeWithGeminiVision(gemini, {
          imageBase64: shot.base64,
          mimeType: shot.mimeType,
          sourceUrl,
          pageText: extractReadableRecipeText(html, { maxChars: 6000 })
        })
        const visionQuality = evaluateDraftQuality(visionDraft)
        attempts.push({
          method: 'gemini-vision',
          ok: visionQuality.ok,
          score: visionQuality.score,
          reasons: visionQuality.reasons
        })

        if (visionQuality.ok || visionQuality.score > quality.score) {
          draft = visionDraft
          quality = visionQuality
        }

        if (isDraftAcceptable(draft)) {
          return finish('gemini-vision')
        }
      }
    } catch (err) {
      attempts.push({ method: 'gemini-vision', ok: false, error: err.message })
      console.error('[scraper] gemini-vision failed:', err.message)
    }
  } else {
    attempts.push({ method: 'gemini-text', ok: false, error: 'GEMINI_API_KEY assente' })
  }

  // Best effort: return best draft we have, or fail
  if (draft && (draft.title || draft.ingredients?.length || draft.steps?.length)) {
    const method =
      attempts.filter((a) => a.ok !== false && a.score != null).sort((a, b) => b.score - a.score)[0]
        ?.method || 'html'
    return finish(method, {
      extractAttempts: attempts,
      extractWarning:
        'Estrazione parziale: controlla ingredienti e passaggi prima di salvare.'
    })
  }

  throw Object.assign(
    new Error(
      'Nessuna ricetta trovata in questa pagina. Prova un altro URL o aggiungi manualmente.'
    ),
    { status: 422, attempts }
  )
}
