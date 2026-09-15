import { useAuthStore } from '../store/authStore.js'

/**
 * Authenticated fetch — JWT only (Dropbox is server-side).
 */
export async function apiFetch(path, options = {}) {
  const { jwt } = useAuthStore.getState()
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...options.headers
  }

  const res = await fetch(path, { ...options, headers })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(data.error || 'Non autorizzato')
    }
    if (data.code === 'FAMILY_DROPBOX_NOT_CONFIGURED') {
      throw new Error(data.error || 'Dropbox famiglia non configurato')
    }
    throw new Error(data.error || data.message || `Richiesta fallita (${res.status})`)
  }
  return data
}
