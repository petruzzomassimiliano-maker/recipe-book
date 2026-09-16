import { Hono } from 'hono'
import { DropboxClient } from '../lib/dropboxClient.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { issueUserJwt, jwtSecret, signJWT, verifyJWT } from '../lib/jwt.js'
import {
  ensureFamilyFolders,
  findOwner,
  findUserByUsername,
  isValidUsername,
  loadUsers,
  normalizeUsername,
  publicUser,
  ROLES,
  saveUsers,
  emptyFamilySettings,
  saveFamilySettings,
  loadFamilySettings
} from '../lib/users.js'
import {
  getConfiguredFamilyRefreshToken,
  getFamilyDropboxClient,
  hasFamilyDropboxConfigured,
  persistFamilyAuthBackup,
  setFamilyRefreshTokenRuntime
} from '../lib/familyDropbox.js'
import { authMiddleware } from '../middleware/auth.js'

const auth = new Hono()

function appBaseUrl(env) {
  return env.APP_BASE_URL || env.DROPBOX_REDIRECT_URI?.replace(/\/dropbox-callback$/, '') || 'http://localhost:5173'
}

// ── GET /api/auth/status ─────────────────────────────────────────────────────
auth.get('/status', async (c) => {
  let hasUsers = false
  let familyName = 'Recipe Book'
  const dropboxConfigured = hasFamilyDropboxConfigured(c.env)

  if (dropboxConfigured) {
    try {
      const dbx = await getFamilyDropboxClient(c.env)
      const users = await loadUsers(dbx)
      hasUsers = users.some((u) => u.active !== false)
      const settings = await loadFamilySettings(dbx)
      familyName = settings.familyAppName || familyName
    } catch (err) {
      console.warn('[auth/status]', err.message)
    }
  }

  return c.json({
    success: true,
    data: {
      needsSetup: !dropboxConfigured || !hasUsers,
      dropboxConfigured,
      familyTokenInEnv: Boolean(
        typeof c.env.FAMILY_DROPBOX_REFRESH_TOKEN === 'string' &&
          c.env.FAMILY_DROPBOX_REFRESH_TOKEN.trim()
      ),
      hasUsers,
      familyAppName: familyName
    }
  })
})

// ── GET /api/auth/authorize — Dropbox OAuth for family setup / reconnect ─────
auth.get('/authorize', (c) => {
  const clientId = c.env.DROPBOX_APP_KEY
  const redirectUri = c.env.DROPBOX_REDIRECT_URI || 'http://localhost:5173/dropbox-callback'
  const codeChallenge = c.req.query('code_challenge')
  const state = c.req.query('state') || crypto.randomUUID()

  if (!clientId) return c.json({ error: 'DROPBOX_APP_KEY not configured in worker' }, 500)
  if (!codeChallenge) return c.json({ error: 'Missing code_challenge parameter' }, 400)

  const url = new URL('https://www.dropbox.com/oauth2/authorize')
  url.searchParams.append('client_id', clientId)
  url.searchParams.append('redirect_uri', redirectUri)
  url.searchParams.append('response_type', 'code')
  url.searchParams.append('state', state)
  url.searchParams.append('code_challenge', codeChallenge)
  url.searchParams.append('code_challenge_method', 'S256')
  url.searchParams.append('token_access_type', 'offline')
  url.searchParams.append(
    'scope',
    'account_info.read files.content.read files.content.write files.metadata.read files.metadata.write'
  )
  if (c.req.query('force_reapprove') === 'true') {
    url.searchParams.append('force_reapprove', 'true')
  }

  return c.json({ authUrl: url.toString(), state })
})

async function finishFamilyDropboxSetup(c, { accessToken, refreshToken }) {
  setFamilyRefreshTokenRuntime(refreshToken)
  await persistFamilyAuthBackup(accessToken, refreshToken)
  await ensureFamilyFolders(accessToken)

  const setupTicket = await signJWT(
    {
      purpose: 'family_setup',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 15 * 60
    },
    jwtSecret(c.env)
  )

  return {
    setupTicket,
    familyDropboxRefreshToken: refreshToken,
    envHint: `FAMILY_DROPBOX_REFRESH_TOKEN=${refreshToken}`,
    message:
      'Salva FAMILY_DROPBOX_REFRESH_TOKEN in worker/.dev.vars e riavvia il worker. Poi crea l’account owner.'
  }
}

// ── POST /api/auth/setup/dropbox — exchange OAuth, store family refresh ───────
auth.post('/setup/dropbox', async (c) => {
  try {
    const { code, codeVerifier, redirectUri } = await c.req.json()
    if (!code || !codeVerifier) return c.json({ error: 'Missing code or codeVerifier' }, 400)

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
      return c.json({ error: tokens.error_description || 'Token exchange failed' }, 400)
    }
    if (!tokens.refresh_token) {
      return c.json(
        {
          error:
            'Dropbox non ha restituito un refresh token. Ricollega con force_reapprove e permesso offline.'
        },
        400
      )
    }

    const data = await finishFamilyDropboxSetup(c, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token
    })
    return c.json({ success: true, data })
  } catch (err) {
    console.error('[auth/setup/dropbox]', err.message)
    return c.json({ error: err.message || 'Setup Dropbox fallito' }, 500)
  }
})

/**
 * POST /api/auth/setup/import-refresh
 * Reuse an existing Dropbox refresh token (same app) without a new browser OAuth if you already have it.
 */
auth.post('/setup/import-refresh', async (c) => {
  try {
    const body = await c.req.json()
    let refreshToken = String(body.refreshToken || '').trim()
    if (refreshToken.startsWith('FAMILY_DROPBOX_REFRESH_TOKEN=')) {
      refreshToken = refreshToken.slice('FAMILY_DROPBOX_REFRESH_TOKEN='.length).trim()
    }
    if (!refreshToken) return c.json({ error: 'Incolla il refresh token Dropbox' }, 400)

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
    if (!tokenRes.ok) {
      return c.json(
        {
          error:
            tokens.error_description ||
            'Refresh token non valido. Usa «Collega Dropbox» (stessa app già configurata).'
        },
        400
      )
    }

    const data = await finishFamilyDropboxSetup(c, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || refreshToken
    })
    return c.json({ success: true, data })
  } catch (err) {
    console.error('[auth/setup/import-refresh]', err.message)
    return c.json({ error: err.message || 'Import refresh fallito' }, 500)
  }
})

// ── POST /api/auth/setup/owner — create first owner ──────────────────────────
auth.post('/setup/owner', async (c) => {
  try {
    const body = await c.req.json()
    const setupTicket = body.setupTicket
    const username = normalizeUsername(body.username)
    const password = String(body.password || '')
    const displayName = String(body.displayName || body.username || '').trim()
    const email = String(body.email || '').trim() || null
    const familyAppName = String(body.familyAppName || 'Recipe Book').trim() || 'Recipe Book'
    const refreshFromBody = body.familyDropboxRefreshToken
      ? String(body.familyDropboxRefreshToken).trim()
      : null

    if (refreshFromBody) setFamilyRefreshTokenRuntime(refreshFromBody)

    if (!setupTicket) return c.json({ error: 'setupTicket obbligatorio' }, 400)
    const ticket = await verifyJWT(setupTicket, jwtSecret(c.env))
    if (!ticket || ticket.purpose !== 'family_setup') {
      return c.json({ error: 'Setup ticket non valido' }, 400)
    }
    if (ticket.exp < Math.floor(Date.now() / 1000)) {
      return c.json({ error: 'Setup ticket scaduto — ricollega Dropbox' }, 400)
    }

    if (!isValidUsername(username)) {
      return c.json({ error: 'Username non valido (3–32: a-z 0-9 . _ -)' }, 400)
    }
    if (password.length < 8) return c.json({ error: 'Password minimo 8 caratteri' }, 400)

    const dbx = await getFamilyDropboxClient(c.env)
    const users = await loadUsers(dbx)
    if (findOwner(users)) {
      return c.json({ error: 'Owner già presente — usa il login' }, 409)
    }

    const owner = {
      id: crypto.randomUUID(),
      username,
      email,
      displayName: displayName || username,
      passwordHash: await hashPassword(password),
      role: ROLES.OWNER,
      active: true,
      mustChangePassword: false,
      preferences: { appLabel: '' },
      invitedBy: null,
      createdAt: new Date().toISOString(),
      roleChangedAt: new Date().toISOString()
    }

    await saveUsers(dbx, [owner, ...users.filter((u) => u.role !== ROLES.OWNER)])
    await saveFamilySettings(dbx, { ...emptyFamilySettings(), familyAppName })

    const jwt = await issueUserJwt(owner, c.env)
    return c.json({
      success: true,
      jwt,
      user: publicUser(owner),
      familyAppName,
      envHint: getConfiguredFamilyRefreshToken(c.env)
        ? `FAMILY_DROPBOX_REFRESH_TOKEN=${getConfiguredFamilyRefreshToken(c.env)}`
        : null
    })
  } catch (err) {
    console.error('[auth/setup/owner]', err.message)
    return c.json({ error: err.message || 'Creazione owner fallita' }, 500)
  }
})

// ── GET /api/auth/invite/:token — preview invite (public) ─────────────────────
auth.get('/invite/:token', async (c) => {
  try {
    const token = String(c.req.param('token') || '').trim()
    if (!token || token.length < 16) return c.json({ error: 'Link non valido' }, 400)

    const dbx = await getFamilyDropboxClient(c.env)
    const users = await loadUsers(dbx)
    const user = users.find((u) => u.inviteToken === token)
    if (!user) return c.json({ error: 'Invito non trovato' }, 404)
    if (user.inviteUsedAt) return c.json({ error: 'Invito già usato' }, 410)
    if (user.inviteExpiresAt && Date.parse(user.inviteExpiresAt) < Date.now()) {
      return c.json({ error: 'Invito scaduto (max 7 giorni)' }, 410)
    }
    if (user.active === false) return c.json({ error: 'Account disattivato' }, 403)

    const settings = await loadFamilySettings(dbx)
    return c.json({
      success: true,
      data: {
        username: user.username,
        displayName: user.displayName,
        familyAppName: settings.familyAppName,
        expiresAt: user.inviteExpiresAt
      }
    })
  } catch (err) {
    console.error('[auth/invite GET]', err.message)
    return c.json({ error: err.message || 'Invito non disponibile', code: err.code }, err.status || 500)
  }
})

/**
 * POST /api/auth/accept-invite
 * Body: { token, password } — monouso, scade in 7 giorni
 */
auth.post('/accept-invite', async (c) => {
  try {
    const body = await c.req.json()
    const token = String(body.token || '').trim()
    const password = String(body.password || '')
    if (!token) return c.json({ error: 'Token obbligatorio' }, 400)
    if (password.length < 8) return c.json({ error: 'Password minimo 8 caratteri' }, 400)

    const dbx = await getFamilyDropboxClient(c.env)
    const users = await loadUsers(dbx)
    const idx = users.findIndex((u) => u.inviteToken === token)
    if (idx < 0) return c.json({ error: 'Invito non trovato' }, 404)

    const row = users[idx]
    if (row.inviteUsedAt) return c.json({ error: 'Invito già usato' }, 410)
    if (row.inviteExpiresAt && Date.parse(row.inviteExpiresAt) < Date.now()) {
      return c.json({ error: 'Invito scaduto (max 7 giorni)' }, 410)
    }
    if (row.active === false) return c.json({ error: 'Account disattivato' }, 403)

    users[idx] = {
      ...row,
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
      inviteToken: null,
      inviteUsedAt: new Date().toISOString()
    }
    await saveUsers(dbx, users)

    const jwt = await issueUserJwt(users[idx], c.env)
    const settings = await loadFamilySettings(dbx)
    return c.json({
      success: true,
      jwt,
      user: publicUser(users[idx]),
      familyAppName: settings.familyAppName,
      mustChangePassword: false
    })
  } catch (err) {
    console.error('[auth/accept-invite]', err.message)
    return c.json({ error: err.message || 'Attivazione fallita', code: err.code }, err.status || 500)
  }
})

// ── POST /api/auth/login ─────────────────────────────────────────────────────
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json()
    const username = normalizeUsername(body.username)
    const password = String(body.password || '')
    if (!username || !password) return c.json({ error: 'Username e password obbligatori' }, 400)

    const dbx = await getFamilyDropboxClient(c.env)
    const users = await loadUsers(dbx)
    const user = findUserByUsername(users, username)
    if (!user || user.active === false) {
      return c.json({ error: 'Credenziali non valide' }, 401)
    }
    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) return c.json({ error: 'Credenziali non valide' }, 401)

    const jwt = await issueUserJwt(user, c.env)
    const settings = await loadFamilySettings(dbx)
    return c.json({
      success: true,
      jwt,
      user: publicUser(user),
      familyAppName: settings.familyAppName,
      mustChangePassword: Boolean(user.mustChangePassword)
    })
  } catch (err) {
    console.error('[auth/login]', err.message)
    const status = err.status || 500
    return c.json({ error: err.message || 'Login fallito', code: err.code }, status)
  }
})

// ── POST /api/auth/change-password ───────────────────────────────────────────
auth.post('/change-password', authMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const currentPassword = String(body.currentPassword || '')
    const newPassword = String(body.newPassword || '')
    if (newPassword.length < 8) return c.json({ error: 'Nuova password minimo 8 caratteri' }, 400)

    const dbx = c.get('dbx')
    const me = c.get('user')
    const users = await loadUsers(dbx)
    const idx = users.findIndex((u) => u.id === me.userId)
    if (idx < 0) return c.json({ error: 'Utente non trovato' }, 404)

    const row = users[idx]
    if (!row.mustChangePassword) {
      const ok = await verifyPassword(currentPassword, row.passwordHash)
      if (!ok) return c.json({ error: 'Password attuale non corretta' }, 401)
    }

    users[idx] = {
      ...row,
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false
    }
    await saveUsers(dbx, users)
    const jwt = await issueUserJwt(users[idx], c.env)
    return c.json({ success: true, jwt, user: publicUser(users[idx]) })
  } catch (err) {
    console.error('[auth/change-password]', err.message)
    return c.json({ error: err.message || 'Cambio password fallito' }, 500)
  }
})

/**
 * POST /api/auth/recover
 * Body: { username, recoveryPhrase, newPassword }
 * Recupero senza email (frase di recupero impostata in Impostazioni).
 */
auth.post('/recover', async (c) => {
  try {
    const body = await c.req.json()
    const username = normalizeUsername(body.username)
    const phrase = String(body.recoveryPhrase || '').trim()
    const newPassword = String(body.newPassword || '')
    if (!username || !phrase) {
      return c.json({ error: 'Username e frase di recupero obbligatori' }, 400)
    }
    if (newPassword.length < 8) {
      return c.json({ error: 'Nuova password minimo 8 caratteri' }, 400)
    }

    const dbx = await getFamilyDropboxClient(c.env)
    const users = await loadUsers(dbx)
    const idx = users.findIndex(
      (u) => String(u.username || '').toLowerCase() === username
    )
    if (idx < 0 || users[idx].active === false) {
      return c.json({ error: 'Credenziali di recupero non valide' }, 401)
    }
    const row = users[idx]
    if (!row.recoveryHash) {
      return c.json(
        {
          error:
            'Nessuna frase di recupero impostata per questo account. Chiedi a un admin di reimpostare la password, oppure impostala in Impostazioni dopo il login.'
        },
        400
      )
    }

    const ok = await verifyPassword(phrase.toLowerCase(), row.recoveryHash)
    if (!ok) return c.json({ error: 'Credenziali di recupero non valide' }, 401)

    users[idx] = {
      ...row,
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      updatedAt: new Date().toISOString()
    }
    await saveUsers(dbx, users)

    const jwt = await issueUserJwt(users[idx], c.env)
    const settings = await loadFamilySettings(dbx)
    return c.json({
      success: true,
      jwt,
      user: publicUser(users[idx]),
      familyAppName: settings.familyAppName,
      mustChangePassword: false
    })
  } catch (err) {
    console.error('[auth/recover]', err.message)
    const status = err.status || 500
    return c.json({ error: err.message || 'Recupero fallito', code: err.code }, status)
  }
})

// ── POST /api/auth/logout ────────────────────────────────────────────────────
auth.post('/logout', (c) => c.json({ success: true, message: 'Logged out' }))

// Legacy no-op refresh (client no longer holds Dropbox tokens)
auth.post('/refresh', (c) =>
  c.json({ success: true, message: 'Dropbox token is managed server-side' })
)

export default auth
