import { useAuthStore } from '../store/authStore.js'

const WORKER_URL = (import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '')

function apiUrl(path) {
  if (!path.startsWith('/')) return `${WORKER_URL}/${path}`
  return `${WORKER_URL}${path}`
}

/**
 * Authenticated fetch — JWT only (Dropbox is server-side).
 * In local dev VITE_WORKER_URL is empty and Vite proxies /api → worker.
 * In production it must point at the Worker origin.
 */
export async function apiFetch(path, options = {}) {
  const { jwt } = useAuthStore.getState()
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...options.headers
  }

  const res = await fetch(apiUrl(path), { ...options, headers })
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
