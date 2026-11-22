import { apiFetch } from './api.js'

export function extractRecipeFromPhoto({ imageBase64, mimeType }) {
  return apiFetch('/api/gemini/from-photo', {
    method: 'POST',
    body: JSON.stringify({ imageBase64, mimeType })
  })
}

export function analyzeCookingMethods(recipeId, { focusMethod } = {}) {
  return apiFetch('/api/gemini/cooking-methods', {
    method: 'POST',
    body: JSON.stringify({
      recipeId,
      ...(focusMethod ? { focusMethod } : {})
    })
  })
}

export function askAboutRecipe(recipeId, messages) {
  return apiFetch('/api/gemini/ask-recipe', {
    method: 'POST',
    body: JSON.stringify({ recipeId, messages })
  })
}

/** (Re)generate "come conservarla" for a recipe and save it on the recipe. */
export function generateStorageAdvice(recipeId) {
  return apiFetch('/api/gemini/storage', {
    method: 'POST',
    body: JSON.stringify({ recipeId })
  })
}

/** Ingredients at home → recipes of the family book that fit best. */
export function suggestWhatToCook(have) {
  return apiFetch('/api/gemini/what-to-cook', {
    method: 'POST',
    body: JSON.stringify({ have })
  })
}
