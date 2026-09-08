import { Hono } from 'hono'
import { DropboxClient } from '../lib/dropboxClient.js'

const auth = new Hono()

// ── GET /api/auth/authorize ──────────────────────────────────────────────────
// Returns Dropbox OAuth URL for PKCE flow.
// Frontend redirects user to this URL.
auth.get('/authorize', (c) => {
  const clientId = c.env.DROPBOX_APP_KEY
  const redirectUri = c.env.DROPBOX_REDIRECT_URI || 'http://localhost:5173/dropbox-callback'
  const codeChallenge = c.req.query('code_challenge')
  const state = c.req.query('state') || crypto.randomUUID()

  if (!clientId) {
    return c.json({ error: 'DROPBOX_APP_KEY not configured in worker' }, 500)
  }
  if (!codeChallenge) {
    return c.json({ error: 'Missing code_challenge parameter' }, 400)
  }

  const url = new URL('https://www.dropbox.com/oauth2/authorize')
  url.searchParams.append('client_id', clientId)
  url.searchParams.append('redirect_uri', redirectUri)
  url.searchParams.append('response_type', 'code')
  url.searchParams.append('state', state)
  url.searchParams.append('code_challenge', codeChallenge)
  url.searchParams.append('code_challenge_method', 'S256')
  // Scopes for app folder access
  url.searchParams.append('scope', 'files.content.read files.content.write account_info.read')
  url.searchParams.append('token_access_type', 'offline') // enables refresh token

  return c.json({ authUrl: url.toString(), state })
})

// ── POST /api/auth/exchange ──────────────────────────────────────────────────
// Exchanges OAuth code for tokens. Signs JWT.
// Body: { code, codeVerifier, redirectUri }
auth.post('/exchange', async (c) => {
  try {
    const { code, codeVerifier, redirectUri } = await c.req.json()

    if (!code || !codeVerifier) {
      return c.json({ error: 'Missing code or codeVerifier' }, 400)
    }

    // Exchange code for Dropbox tokens
    const tokenRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: c.env.DROPBOX_APP_KEY,
        client_secret: c.env.DROPBOX_APP_SECRET,
        redirect_uri: redirectUri || c.env.DROPBOX_REDIRECT_URI,
        code_verifier: codeVerifier
      })
    })

    const tokens = await tokenRes.json()
    if (!tokenRes.ok) {
      console.error('[auth/exchange] Dropbox token error:', tokens)
      return c.json({ error: tokens.error_description || 'Token exchange failed' }, 400)
    }

    // Fetch Dropbox user info
    const userRes = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json'
      },
      body: 'null'
    })

    const dbxUser = await userRes.json()
    if (!userRes.ok) {
      console.error('[auth/exchange] Dropbox user error:', dbxUser)
      return c.json({ error: 'Failed to fetch Dropbox user info' }, 500)
    }

    const userId = dbxUser.account_id
    const email = dbxUser.email
    const name = dbxUser.name?.display_name || email

    // Initialize Dropbox folder structure on first login
    try {
      const dbxClient = new DropboxClient(tokens.access_token)
      await dbxClient.initFolderStructure(userId)
    } catch (folderErr) {
      // Non-fatal: log but continue
      console.error('[auth/exchange] Folder init error:', folderErr.message)
    }

    // Generate JWT (HS256, 30 days)
    const jwtSecret = c.env.JWT_SECRET || 'dev-secret-change-me'
    const payload = {
      userId,
      email,
      name,
      role: 'user', // superUser role set manually in users.json
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
    }

    const jwt = await signJWT(payload, jwtSecret)

    return c.json({
      success: true,
      jwt,
      dropboxToken: tokens.access_token,
      dropboxRefreshToken: tokens.refresh_token || null,
      tokenExpiresIn: tokens.expires_in || 14400,
      user: {
        id: userId,
        email,
        name,
        role: payload.role
      }
    })
  } catch (err) {
    console.error('[auth/exchange]', err.message)
    return c.json({ error: 'Internal server error during token exchange' }, 500)
  }
})

// ── POST /api/auth/refresh ───────────────────────────────────────────────────
// Refreshes Dropbox access token using stored refresh token.
auth.post('/refresh', async (c) => {
  try {
    const { refreshToken } = await c.req.json()
    if (!refreshToken) return c.json({ error: 'Missing refreshToken' }, 400)

    const tokenRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: c.env.DROPBOX_APP_KEY,
        client_secret: c.env.DROPBOX_APP_SECRET
      })
    })

    const tokens = await tokenRes.json()
    if (!tokenRes.ok) return c.json({ error: tokens.error_description }, 400)

    return c.json({
      success: true,
      dropboxToken: tokens.access_token,
      expiresIn: tokens.expires_in
    })
  } catch (err) {
    console.error('[auth/refresh]', err.message)
    return c.json({ error: 'Token refresh failed' }, 500)
  }
})

// ── POST /api/auth/logout ───────────────────────────────────────────────────
auth.post('/logout', (c) => {
  // JWT is stateless; logout is handled client-side by clearing localStorage.
  // Optionally revoke Dropbox token here.
  return c.json({ success: true, message: 'Logged out' })
})

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Simple JWT signer using Web Crypto API (available in Cloudflare Workers).
 * HS256 implementation without external dependencies.
 */
async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encode = (obj) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const data = `${encode(header)}.${encode(payload)}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return `${data}.${sigBase64}`
}

export default auth
