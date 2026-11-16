import { Hono } from 'hono'
import { jwtSecret, signJWT } from '../lib/jwt.js'
import { loadFamilySettings } from '../lib/users.js'
import { getFamilyDropboxClient, hasFamilyDropboxConfigured } from '../lib/familyDropbox.js'
import { checkPin, configuredPin, pinVersion } from '../lib/editPin.js'
import { familyMiddleware } from '../middleware/auth.js'

/**
 * No user accounts. Everyone reads; the family PIN unlocks editing on a device.
 * Dropbox is configured only via the FAMILY_DROPBOX_REFRESH_TOKEN Worker secret.
 */
const auth = new Hono()

const EDITOR_TOKEN_TTL = 365 * 24 * 60 * 60

// ── GET /api/auth/status — public app info ───────────────────────────────────
auth.get('/status', async (c) => {
  let familyAppName = 'Recipe Book'
  const dropboxConfigured = hasFamilyDropboxConfigured(c.env)
  if (dropboxConfigured) {
    try {
      const settings = await loadFamilySettings(await getFamilyDropboxClient(c.env))
      familyAppName = settings.familyAppName || familyAppName
    } catch (err) {
      console.warn('[auth/status]', err.message)
    }
  }
  return c.json({
    success: true,
    data: {
      dropboxConfigured,
      pinConfigured: Boolean(configuredPin(c.env)),
      familyAppName
    }
  })
})

// ── GET /api/auth/me — is this device unlocked? ──────────────────────────────
auth.get('/me', familyMiddleware, (c) =>
  c.json({ success: true, data: { canEdit: c.get('user').role === 'editor' } })
)

// ── POST /api/auth/unlock — family PIN → editor token ────────────────────────
auth.post('/unlock', async (c) => {
  if (!configuredPin(c.env)) {
    return c.json(
      { error: 'PIN di famiglia non configurato sul server (secret EDIT_PIN)', code: 'PIN_NOT_CONFIGURED' },
      503
    )
  }
  const body = await c.req.json().catch(() => ({}))
  const ok = await checkPin(c.env, body.pin)
  if (!ok) {
    // Slow down guessing
    await new Promise((r) => setTimeout(r, 1500))
    return c.json({ error: 'PIN errato' }, 401)
  }
  const now = Math.floor(Date.now() / 1000)
  const token = await signJWT(
    { role: 'editor', pv: await pinVersion(c.env), iat: now, exp: now + EDITOR_TOKEN_TTL },
    jwtSecret(c.env)
  )
  return c.json({ success: true, data: { token } })
})

export default auth
