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

export function addDiaryEntry(id, entry) {
  return apiFetch(`/api/recipes/${id}/diary`, {
    method: 'POST',
    body: JSON.stringify(entry)
  })
}

export function deleteDiaryEntry(id, entryId) {
  return apiFetch(`/api/recipes/${id}/diary/${encodeURIComponent(entryId)}`, { method: 'DELETE' })
}

/** Restore one recipe from a backup file (keeps its id). */
export function restoreRecipe(recipe, { overwrite = false } = {}) {
  return apiFetch('/api/recipes/restore', {
    method: 'POST',
    body: JSON.stringify({ recipe, overwrite })
  })
}
