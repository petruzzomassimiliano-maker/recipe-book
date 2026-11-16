import { apiFetch } from './api.js'

export function listRecipes(q) {
  const query = q ? `?q=${encodeURIComponent(q)}` : ''
  return apiFetch(`/api/recipes${query}`)
}

export function getRecipe(id) {
  return apiFetch(`/api/recipes/${id}`)
}

export function createRecipe(payload) {
  return apiFetch('/api/recipes', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function updateRecipe(id, payload) {
  return apiFetch(`/api/recipes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  })
}

export function deleteRecipe(id) {
  return apiFetch(`/api/recipes/${id}`, { method: 'DELETE' })
}
