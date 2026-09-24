/**
 * Gemini client with dual-key fallback (GEMINI_API_KEY → GEMINI_API_KEY_2).
 * On per-model free-tier quota (429), try the next model before switching key.
 */

/** Prefer stable free-tier models; "latest" aliases can map to tightly limited previews. */
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.6-flash'
]

function endpointFor(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

export function collectGeminiKeys(env) {
  if (!env) return []
  if (typeof env === 'string') return env.trim() ? [env.trim()] : []
  if (Array.isArray(env)) return env.filter((k) => typeof k === 'string' && k.trim())
  const raw = [env.GEMINI_API_KEY, env.GEMINI_API_KEY_2].filter(
    (k) => typeof k === 'string' && k.trim()
  )
  // Dedupe identical keys
  return [...new Set(raw.map((k) => k.trim()))]
}

function shouldSwitchKey(status, message = '') {
  if (status === 401 || status === 403) return true
  // Auth / key problems — not per-model quota
  if (/api.?key|permission|expired|billing|invalid.*key/i.test(message) && !/quota|rate.?limit/i.test(message)) {
    return true
  }
  return false
}

function isQuotaOrRateLimit(status, message = '') {
  if (status === 429) return true
  return /quota|rate.?limit|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(message)
}

function shouldTryNextModel(status, message = '') {
  if (status === 404) return true
  if (isQuotaOrRateLimit(status, message)) return true
  return /no longer available|not found|high demand|unavailable/i.test(message)
}

function parseRetrySeconds(message = '') {
  const m = String(message).match(/retry in\s+([\d.]+)\s*s/i)
  if (!m) return null
  const sec = Number(m[1])
  return Number.isFinite(sec) ? sec : null
}

function friendlyQuotaMessage(raw, retrySec) {
  const wait =
    retrySec != null && retrySec > 0
      ? ` Riprova tra circa ${Math.ceil(retrySec)} secondi.`
      : ' Riprova tra un minuto.'
  return (
    `Limite gratuito Gemini raggiunto (troppe richieste in poco tempo).${wait} ` +
    `Se hai una seconda chiave, impostala come GEMINI_API_KEY_2 in worker/.dev.vars e riavvia il worker.`
  )
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function postGenerate(apiKey, body) {
  let lastError = null
  let lastStatus = 0
  let lastRetrySec = null
  let waitedOnce = false

  for (const model of GEMINI_MODELS) {
    const response = await fetch(`${endpointFor(model)}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      lastStatus = response.status
      lastError = data?.error?.message || `Gemini error ${response.status}`
      lastRetrySec = parseRetrySeconds(lastError) ?? lastRetrySec

      if (shouldSwitchKey(response.status, lastError)) {
        const err = new Error(lastError)
        err.status = response.status
        err.switchKey = true
        throw err
      }

      // Short one-shot wait if the API says retry in a few seconds (same model)
      if (
        !waitedOnce &&
        isQuotaOrRateLimit(response.status, lastError) &&
        lastRetrySec != null &&
        lastRetrySec > 0 &&
        lastRetrySec <= 8
      ) {
        waitedOnce = true
        console.warn(`[gemini] ${model} quota — wait ${lastRetrySec.toFixed(1)}s then retry`)
        await sleep(Math.ceil(lastRetrySec * 1000) + 200)
        // retry same model once
        const retryRes = await fetch(`${endpointFor(model)}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        const retryData = await retryRes.json().catch(() => ({}))
        if (retryRes.ok) {
          const text =
            retryData?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
          if (text.trim()) return text
        } else {
          lastStatus = retryRes.status
          lastError = retryData?.error?.message || lastError
          lastRetrySec = parseRetrySeconds(lastError) ?? lastRetrySec
          if (shouldSwitchKey(retryRes.status, lastError)) {
            const err = new Error(lastError)
            err.status = retryRes.status
            err.switchKey = true
            throw err
          }
        }
      }

      if (shouldTryNextModel(response.status, lastError)) {
        console.warn(`[gemini] ${model} failed (${lastStatus}): ${String(lastError).slice(0, 120)} — next model`)
        continue
      }

      const err = new Error(lastError)
      err.status = response.status
      throw err
    }

    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
    if (!text.trim()) {
      lastError = 'Gemini ha restituito una risposta vuota'
      continue
    }
    return text
  }

  // All models exhausted — ask caller to try the other API key
  const err = new Error(
    isQuotaOrRateLimit(lastStatus, lastError)
      ? friendlyQuotaMessage(lastError, lastRetrySec)
      : lastError || 'Nessun modello Gemini disponibile'
  )
  err.status = lastStatus || 429
  err.switchKey = isQuotaOrRateLimit(lastStatus, lastError)
  err.retryAfterSec = lastRetrySec
  throw err
}

async function withKeyFallback(envOrKey, run) {
  const keys = collectGeminiKeys(envOrKey)
  if (!keys.length) throw new Error('GEMINI_API_KEY mancante')

  let lastError = null
  for (let i = 0; i < keys.length; i++) {
    try {
      return await run(keys[i])
    } catch (err) {
      lastError = err
      const canFallback =
        err.switchKey || shouldSwitchKey(err.status, err.message) || isQuotaOrRateLimit(err.status, err.message)
      if (canFallback && i < keys.length - 1) {
        console.warn(
          `[gemini] key ${i + 1} failed (${String(err.message).slice(0, 100)}) — trying next key`
        )
        continue
      }
      // Final user-facing message for quota
      if (isQuotaOrRateLimit(err.status, err.message) && !/Limite gratuito Gemini/i.test(err.message)) {
        const wrapped = new Error(friendlyQuotaMessage(err.message, err.retryAfterSec))
        wrapped.status = err.status || 429
        throw wrapped
      }
      throw err
    }
  }
  throw lastError || new Error('Gemini non disponibile')
}

export async function geminiGenerateContent(
  envOrKey,
  parts,
  { temperature = 0.1, json = true, systemInstruction = null, generationConfig = null } = {}
) {
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature,
      ...(json ? { responseMimeType: 'application/json' } : {}),
      ...(generationConfig || {})
    }
  }
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] }
  }

  return withKeyFallback(envOrKey, (apiKey) => postGenerate(apiKey, body))
}

/**
 * Multi-turn chat. messages: [{ role: 'user'|'model', text }]
 */
export async function geminiChat(
  envOrKey,
  messages,
  { temperature = 0.4, systemInstruction = null } = {}
) {
  const contents = (messages || [])
    .filter((m) => m?.text?.trim())
    .map((m) => ({
      role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.text).trim() }]
    }))

  if (!contents.length) throw new Error('Messaggio vuoto')

  const body = {
    contents,
    generationConfig: { temperature }
  }
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] }
  }

  const text = await withKeyFallback(envOrKey, (apiKey) => postGenerate(apiKey, body))
  return text.trim()
}

export function parseGeminiJson(text) {
  const raw = String(text || '').trim()
  try {
    return JSON.parse(raw)
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenced) return JSON.parse(fenced[1].trim())
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1))
    throw new Error('Risposta Gemini non è JSON valido')
  }
}

export function recipeContextSummary(recipe) {
  if (!recipe) return ''
  const ings = (recipe.ingredients || [])
    .map((i) => {
      const qty = [i.quantity, i.unit].filter((v) => v != null && v !== '').join(' ')
      return `- ${qty ? `${qty} ` : ''}${i.name}${i.notes ? ` (${i.notes})` : ''}`
    })
    .join('\n')
  const steps = (recipe.steps || [])
    .map((s, idx) => `${idx + 1}. ${s.instruction || ''}`)
    .join('\n')
  const meta = recipe.metadata || {}
  return [
    `Titolo: ${recipe.title || ''}`,
    recipe.sourceUrl ? `URL: ${recipe.sourceUrl}` : '',
    `Porzioni: ${meta.servings || ''}`,
    `Prep: ${meta.prepTime || 0} min · Cottura: ${meta.cookTime || 0} min`,
    `Difficoltà: ${meta.difficulty || ''}`,
    recipe.notes ? `Note: ${recipe.notes}` : '',
    meta.tags?.length ? `Tag: ${meta.tags.join(', ')}` : '',
    '',
    'Ingredienti:',
    ings || '(nessuno)',
    '',
    'Preparazione:',
    steps || '(nessuna)'
  ]
    .filter(Boolean)
    .join('\n')
}
