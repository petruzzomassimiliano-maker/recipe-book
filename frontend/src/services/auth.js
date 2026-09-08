import { generatePKCEPair } from '../utils/pkce.js'

const WORKER_URL = import.meta.env.VITE_WORKER_URL || ''
const REDIRECT_URI = import.meta.env.VITE_DROPBOX_REDIRECT_URI || 'http://localhost:5173/dropbox-callback'

/**
 * Initiates the Dropbox OAuth PKCE flow.
 * 1. Generates PKCE pair
 * 2. Saves code_verifier to localStorage
 * 3. Requests auth URL from Worker
 * 4. Redirects user to Dropbox
 */
export async function initiateDropboxLogin() {
  const { codeVerifier, codeChallenge } = await generatePKCEPair()

  // Save verifier — must be available after redirect back
  localStorage.setItem('pkce_verifier', codeVerifier)
  localStorage.setItem('pkce_redirect_uri', REDIRECT_URI)

  const params = new URLSearchParams({
    code_challenge: codeChallenge,
    state: crypto.randomUUID()
  })

  // Ask Worker for auth URL (Worker keeps APP_KEY + SECRET server-side)
  const res = await fetch(`${WORKER_URL}/api/auth/authorize?${params}`)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to get Dropbox auth URL')
  }

  const { authUrl } = await res.json()
  window.location.href = authUrl
}

/**
 * Exchanges the OAuth callback code for tokens.
 * Called from DropboxCallback page after Dropbox redirects back.
 * Returns { jwt, dropboxToken, user }
 */
export async function exchangeDropboxCode(code) {
  const codeVerifier = localStorage.getItem('pkce_verifier')
  const redirectUri = localStorage.getItem('pkce_redirect_uri') || REDIRECT_URI

  if (!codeVerifier) {
    throw new Error('PKCE verifier missing — localStorage may have been cleared')
  }

  const res = await fetch(`${WORKER_URL}/api/auth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, codeVerifier, redirectUri })
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Token exchange failed')

  // Cleanup PKCE state
  localStorage.removeItem('pkce_verifier')
  localStorage.removeItem('pkce_redirect_uri')

  return data
}

/**
 * Refreshes Dropbox access token using stored refresh token.
 */
export async function refreshDropboxToken(refreshToken) {
  const res = await fetch(`${WORKER_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Token refresh failed')
  return data
}

/**
 * Calls Worker logout endpoint (optional token revocation).
 */
export async function logoutFromWorker() {
  try {
    await fetch(`${WORKER_URL}/api/auth/logout`, { method: 'POST' })
  } catch {
    // Non-fatal; client-side cleanup is what matters
  }
}
