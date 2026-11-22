import { fold } from './ingredientMatch.js'

/** Comparable form of a recipe URL: no protocol, www, tracking params, hash or trailing slash. */
export function normalizeUrl(url) {
  const raw = String(url || '').trim()
  if (!/^https?:\/\//i.test(raw)) return ''
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase().replace(/^(www|m|amp)\./, '')
    const params = [...u.searchParams.entries()]
      .filter(([k]) => !/^(utm_|fbclid|gclid|igsh|si$|feature$|ref$|amp$)/i.test(k))
      .sort(([a], [b]) => a.localeCompare(b))
    // YouTube: the video id is the identity
    if (/youtube\.com$/.test(host) && u.searchParams.get('v')) return `youtube:${u.searchParams.get('v')}`
    if (host === 'youtu.be') return `youtube:${u.pathname.slice(1)}`
    if (/youtube\.com$/.test(host) && u.pathname.startsWith('/shorts/')) return `youtube:${u.pathname.split('/')[2]}`
    const path = u.pathname.replace(/\/(amp\/?)?$/, '').replace(/\/+$/, '') || '/'
    const query = params.length ? `?${params.map(([k, v]) => `${k}=${v}`).join('&')}` : ''
    return `${host}${path}${query}`
  } catch {
    return ''
  }
}

const TITLE_STOP = new Set(['di', 'e', 'con', 'al', 'alla', 'alle', 'ai', 'il', 'la', 'le', 'lo', 'i', 'gli', 'in', 'del', 'della', 'ricetta', 'facile', 'veloce'])

function titleWords(title) {
  return new Set(
    fold(title)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1 && !TITLE_STOP.has(w))
      .map((w) => (w.length > 3 ? w.replace(/[aeiou]$/, '') : w))
  )
}

function titleSimilarity(a, b) {
  const A = titleWords(a)
  const B = titleWords(b)
  if (!A.size || !B.size) return 0
  let common = 0
  for (const w of A) if (B.has(w)) common += 1
  return common / (A.size + B.size - common)
}

/**
 * Recipes already in the book that look like `candidate` ({ sourceUrl?, title? }).
 * Same source URL → "same"; very similar title → "similar".
 * @returns {{ recipe, reason: 'same' | 'similar' }[]}
 */
export function findDuplicates(candidate, recipes) {
  const url = normalizeUrl(candidate?.sourceUrl)
  const title = String(candidate?.title || '').trim()
  const out = []
  for (const recipe of recipes || []) {
    if (url && normalizeUrl(recipe.sourceUrl) === url) {
      out.push({ recipe, reason: 'same' })
    } else if (title && titleSimilarity(title, recipe.title) >= 0.75) {
      out.push({ recipe, reason: 'similar' })
    }
  }
  return out.sort((a, b) => (a.reason === b.reason ? 0 : a.reason === 'same' ? -1 : 1)).slice(0, 3)
}
