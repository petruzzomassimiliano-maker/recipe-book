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
