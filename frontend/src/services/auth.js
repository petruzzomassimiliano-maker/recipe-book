import { apiFetch } from './api.js'

export async function getAppStatus() {
  const res = await apiFetch('/api/auth/status')
  return res.data
}

/** True when the stored editor token is still accepted by the server. */
export async function checkEditAccess() {
  const res = await apiFetch('/api/auth/me')
  return Boolean(res.data?.canEdit)
}

export async function unlockWithPin(pin) {
  const res = await apiFetch('/api/auth/unlock', {
    method: 'POST',
    body: JSON.stringify({ pin })
  })
  return res.data.token
}
