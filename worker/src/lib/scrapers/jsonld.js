import {
  asArray,
  emptyDraft,
  firstImage,
  parseDurationMinutes,
  parseIngredientLine,
  parseServings,
  cleanInstructionText,
  stripTags
} from './_base.js'

function findRecipeNodes(node, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const item of node) findRecipeNodes(item, out)
    return out
  }
  const type = node['@type']
  const types = asArray(type).map((t) => String(t).toLowerCase())
  if (types.includes('recipe')) out.push(node)
  if (Array.isArray(node['@graph'])) findRecipeNodes(node['@graph'], out)
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') findRecipeNodes(value, out)
  }
  return out
}

function extractJsonLdBlocks(html) {
  const blocks = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = re.exec(html)) !== null) {
    const raw = match[1].trim()
    if (!raw) continue
    try {
      blocks.push(JSON.parse(raw))
    } catch {
      try {
        blocks.push(JSON.parse(raw.replace(/,\s*([}\]])/g, '$1')))
      } catch {
        // ignore invalid JSON-LD
      }
    }
  }
  return blocks
}

function howToSteps(recipe) {
  const instructions = recipe.recipeInstructions
  if (!instructions) return []
  if (typeof instructions === 'string') {
    return instructions
      .split(/\n+|(?<=\.)\s+/)
      .map((s) => cleanInstructionText(s))
      .filter(Boolean)
      .map((instruction) => ({ instruction }))
  }
  return asArray(instructions).flatMap((item) => {
    if (typeof item === 'string') return [{ instruction: cleanInstructionText(item) }]
    if (item?.['@type'] === 'HowToSection') {
      return asArray(item.itemListElement).map((step) => ({
        instruction: cleanInstructionText(step.text || step.name || '')
      }))
    }
    return [{ instruction: cleanInstructionText(item.text || item.name || '') }]
  }).filter((s) => s.instruction)
}

/**
 * Parse schema.org Recipe from page HTML (JSON-LD).
 * Works for AllRecipes, BBC, many Giallozafferano pages, etc.
 */
export function parseJsonLdRecipe(html, sourceUrl) {
  const recipes = extractJsonLdBlocks(html).flatMap((block) => findRecipeNodes(block))
  if (!recipes.length) return null

  const recipe = recipes[0]
  const draft = emptyDraft(sourceUrl, 'website')
  draft.title = stripTags(recipe.name || '')
  draft.servings = parseServings(recipe.recipeYield || recipe.yield)
  draft.prepTime = parseDurationMinutes(recipe.prepTime)
  draft.cookTime = parseDurationMinutes(recipe.cookTime || recipe.totalTime)
  draft.cuisine = stripTags(asArray(recipe.recipeCuisine)[0] || '')
  draft.tags = [] // user sets tags manually in the form
  draft.imageUrl = firstImage(recipe.image)
  draft.notes = stripTags(recipe.description || '')
  draft.ingredients = asArray(recipe.recipeIngredient)
    .map(parseIngredientLine)
    .filter(Boolean)
  draft.steps = howToSteps(recipe)

  if (!draft.title || (!draft.ingredients.length && !draft.steps.length)) return null
  return draft
}
