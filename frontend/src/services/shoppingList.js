import { apiFetch } from './api.js'

export function getShoppingList() {
  return apiFetch('/api/shopping-list')
}

export function addShoppingItem(payload) {
  return apiFetch('/api/shopping-list/items', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function addFromRecipe(recipe) {
  return apiFetch('/api/shopping-list/from-recipe', {
    method: 'POST',
    body: JSON.stringify({ recipe })
  })
}

export function patchShoppingItem(itemId, patch) {
  return apiFetch(`/api/shopping-list/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  })
}

export function deleteShoppingItem(itemId) {
  return apiFetch(`/api/shopping-list/items/${itemId}`, { method: 'DELETE' })
}

export function clearRecipeItems(recipeId) {
  return apiFetch('/api/shopping-list/clear-recipe', {
    method: 'POST',
    body: JSON.stringify({ recipeId: recipeId ?? null })
  })
}

export function clearCheckedItems() {
  return apiFetch('/api/shopping-list/clear-checked', { method: 'POST' })
}
