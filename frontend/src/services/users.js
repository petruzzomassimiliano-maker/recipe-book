import { apiFetch } from './api.js'

export function listUsers() {
  return apiFetch('/api/users')
}

export function getMe() {
  return apiFetch('/api/users/me')
}

export function inviteUser(payload) {
  return apiFetch('/api/users/invite', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function updateUser(id, payload) {
  return apiFetch(`/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
}

export function deleteUser(id) {
  return apiFetch(`/api/users/${id}`, {
    method: 'DELETE'
  })
}

export function resetUserPassword(id) {
  return apiFetch(`/api/users/${id}/reset-password`, {
    method: 'POST'
  })
}

export function setMyRecoveryPhrase(payload) {
  return apiFetch('/api/users/me/recovery', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function updateMyPreferences(payload) {
  return apiFetch('/api/users/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
}

export function getFamilySettings() {
  return apiFetch('/api/settings')
}

export function updateFamilySettings(payload) {
  return apiFetch('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(payload)
  })
}
