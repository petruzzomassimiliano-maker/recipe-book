import { apiFetch } from './api.js'

export function calculateRecipeNutrition(recipeId) {
  return apiFetch('/api/nutrition/calculate', {
    method: 'POST',
    body: JSON.stringify({ recipeId })
  })
}

export function saveManualNutrition(recipeId, perServing) {
  return apiFetch('/api/nutrition/calculate', {
    method: 'POST',
    body: JSON.stringify({ recipeId, perServing })
  })
}

export function searchNutrition(ingredient, quantity, unit) {
  return apiFetch('/api/nutrition/search', {
    method: 'POST',
    body: JSON.stringify({ ingredient, quantity, unit })
  })
}

/** Aggiungi/aggiorna alimento nel DB utente (valori per 100 g). */
export function upsertCustomFood(payload) {
  return apiFetch('/api/nutrition/custom', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}
