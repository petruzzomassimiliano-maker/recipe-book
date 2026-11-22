import { useAuthStore } from '../store/authStore.js'

const WORKER_URL = (import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '')

export function apiUrl(path) {
  if (!path.startsWith('/')) return `${WORKER_URL}/${path}`
  return `${WORKER_URL}${path}`
}

/**
 * Fetch against the Worker. No login: the editor token (family PIN) is sent
 * when this device has one. In local dev VITE_WORKER_URL is empty and Vite
 * proxies /api → worker; in production it points at the Worker origin.
 */
export async function apiFetch(path, options = {}) {
  const { editToken } = useAuthStore.getState()
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(editToken ? { Authorization: `Bearer ${editToken}` } : {}),
    ...options.headers
  }

  let res
  try {
    res = await fetch(apiUrl(path), { ...options, headers })
  } catch {
    throw new Error('Connessione non riuscita. Controlla la rete e riprova.')
  }
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    if (data.code === 'PIN_REQUIRED') {
      // Token missing, expired or PIN changed on the server → forget it
      if (editToken) useAuthStore.getState().lock()
      const err = new Error('Serve il PIN di famiglia per questa operazione.')
      err.code = 'PIN_REQUIRED'
      throw err
    }
    if (data.code === 'FAMILY_DROPBOX_NOT_CONFIGURED') {
      throw new Error(data.error || 'Dropbox famiglia non configurato')
    }
    const err = new Error(data.error || data.message || `Richiesta fallita (${res.status})`)
    err.status = res.status
    err.code = data.code
    throw err
  }
  return data
}
