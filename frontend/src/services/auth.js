import { generatePKCEPair } from '../utils/pkce.js'

const WORKER_URL = import.meta.env.VITE_WORKER_URL || ''
const REDIRECT_URI = import.meta.env.VITE_DROPBOX_REDIRECT_URI || 'http://localhost:5173/dropbox-callback'

export async function getAuthStatus() {
  const res = await fetch(`${WORKER_URL}/api/auth/status`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Status failed')
  return data.data
}

export async function loginWithPassword(username, password) {
  const res = await fetch(`${WORKER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Login fallito')
  return data
}

export async function changePassword(currentPassword, newPassword, jwt) {
  const res = await fetch(`${WORKER_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`
    },
    body: JSON.stringify({ currentPassword, newPassword })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Cambio password fallito')
  return data
}

export async function recoverPassword({ username, recoveryPhrase, newPassword }) {
  const res = await fetch(`${WORKER_URL}/api/auth/recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, recoveryPhrase, newPassword })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Recupero fallito')
  return data
}

/** Start Dropbox OAuth for family setup / reconnect. */
export async function initiateFamilyDropboxSetup({ forceReapprove = true } = {}) {
  const { codeVerifier, codeChallenge } = await generatePKCEPair()
  localStorage.setItem('pkce_verifier', codeVerifier)
  localStorage.setItem('pkce_redirect_uri', REDIRECT_URI)
  sessionStorage.setItem('auth_flow', 'family_setup')

  const params = new URLSearchParams({
    code_challenge: codeChallenge,
    state: crypto.randomUUID(),
    force_reapprove: forceReapprove ? 'true' : 'false'
  })
  const res = await fetch(`${WORKER_URL}/api/auth/authorize?${params}`)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to get Dropbox auth URL')
  }
  const { authUrl } = await res.json()
  window.location.href = authUrl
}

export async function completeFamilyDropboxSetup(code) {
  const codeVerifier = localStorage.getItem('pkce_verifier')
  const redirectUri = localStorage.getItem('pkce_redirect_uri') || REDIRECT_URI
  if (!codeVerifier) throw new Error('PKCE verifier missing')

  const res = await fetch(`${WORKER_URL}/api/auth/setup/dropbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, codeVerifier, redirectUri })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Setup Dropbox fallito')

  localStorage.removeItem('pkce_verifier')
  localStorage.removeItem('pkce_redirect_uri')
  sessionStorage.removeItem('auth_flow')

  return storeFamilySetupResult(data.data)
}

/** Import an existing Dropbox refresh token (same Dropbox app / App folder). */
export async function importFamilyRefreshToken(refreshToken) {
  const res = await fetch(`${WORKER_URL}/api/auth/setup/import-refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Import refresh fallito')
  return storeFamilySetupResult(data.data)
}

function storeFamilySetupResult(payload) {
  if (payload?.setupTicket) {
    sessionStorage.setItem('family_setup_ticket', payload.setupTicket)
  }
  if (payload?.familyDropboxRefreshToken) {
    sessionStorage.setItem('family_refresh_token', payload.familyDropboxRefreshToken)
  }
  if (payload?.envHint) {
    sessionStorage.setItem('family_env_hint', payload.envHint)
  }
  return payload
}

export async function createOwnerAccount(payload) {
  const setupTicket = payload.setupTicket || sessionStorage.getItem('family_setup_ticket')
  const familyDropboxRefreshToken =
    payload.familyDropboxRefreshToken || sessionStorage.getItem('family_refresh_token')

  const res = await fetch(`${WORKER_URL}/api/auth/setup/owner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      setupTicket,
      familyDropboxRefreshToken
    })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Creazione owner fallita')
  sessionStorage.removeItem('family_setup_ticket')
  return data
}

export async function getInvitePreview(token) {
  const WORKER_URL = import.meta.env.VITE_WORKER_URL || ''
  const res = await fetch(`${WORKER_URL}/api/auth/invite/${encodeURIComponent(token)}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Invito non valido')
  return data.data
}

export async function acceptInvite(token, password) {
  const WORKER_URL = import.meta.env.VITE_WORKER_URL || ''
  const res = await fetch(`${WORKER_URL}/api/auth/accept-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Attivazione fallita')
  return data
}

export async function logoutFromWorker() {
  try {
    await fetch(`${WORKER_URL}/api/auth/logout`, { method: 'POST' })
  } catch {
    // ignore
  }
}
