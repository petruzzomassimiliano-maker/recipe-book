import { emptyDraft, parseIngredientLine, cleanInstructionText, stripTags } from './_base.js'
import { finalizeSteps } from './sections.js'

function matchAll(html, regex) {
  const out = []
  let m
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`)
  while ((m = re.exec(html)) !== null) out.push(m)
  return out
}

function extractBySelectors(html, patterns) {
  for (const pattern of patterns) {
    const m = html.match(pattern)
    if (m?.[1]) return stripTags(m[1])
  }
  return ''
}

/** Lightweight CSS-ish fallbacks when JSON-LD is missing. */
export function parseHeuristicRecipe(html, sourceUrl, hostHint = '') {
  const draft = emptyDraft(sourceUrl, 'website')
  draft.title = extractBySelectors(html, [
    /<h1[^>]*class="[^"]*recipe[^"]*"[^>]*>([\s\S]*?)<\/h1>/i,
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*property=["']og:title["']/i
  ])

  // Whole <li> first: plugins (WP Recipe Maker, Tasty…) split amount/unit/name into
  // inner <span class="…ingredient-…">, which must not become separate ingredients.
  let ingredientMatches = matchAll(
    html,
    /<li\b[^>]*(?:ingredient|mntl-structured-ingredients__list-item)[^>]*>([\s\S]*?)<\/li>/gi
  )
  if (!ingredientMatches.length) {
    ingredientMatches = matchAll(html, /<span\b[^>]*class=["'][^"']*ingredient(?![-_](?:amount|unit|name|notes))[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)
  }
  draft.ingredients = ingredientMatches
    .map((m) => parseIngredientLine(m[1]))
    .filter(Boolean)
    .slice(0, 80)

  const stepMatches = matchAll(
    html,
    /<(?:li|p|div)[^>]*(?:instruction|preparation|mntl-sc-block-group--LI|recipe__steps)[^>]*>([\s\S]*?)<\/(?:li|p|div)>/gi
  )
  draft.steps = finalizeSteps(
    stepMatches
      .map((m) => ({ instruction: cleanInstructionText(m[1]) }))
      .filter((s) => s.instruction.length > 8)
      .slice(0, 40)
  )

  // Giallozafferano-ish
  if (!draft.ingredients.length && /giallozafferano/i.test(hostHint + sourceUrl)) {
    draft.ingredients = matchAll(html, /class="[^"]*gz-ingredient[^"]*"[^>]*>([\s\S]*?)<\/(?:li|span|div)>/gi)
      .map((m) => parseIngredientLine(m[1]))
      .filter(Boolean)
  }

  if (!draft.title || (!draft.ingredients.length && !draft.steps.length)) return null
  return draft
}
