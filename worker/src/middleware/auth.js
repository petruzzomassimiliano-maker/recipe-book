import { verifyJWT, jwtSecret } from '../lib/jwt.js'
import { getFamilyDropboxClient } from '../lib/familyDropbox.js'
import { pinVersion } from '../lib/editPin.js'

/**
 * No user accounts: everyone may read.
 * Mutations (and anything that spends Gemini quota) need an "editor" token,
 * obtained once with the family PIN (POST /api/auth/unlock).
 */
async function readEditor(c) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return false
  try {
    const payload = await verifyJWT(authHeader.slice(7), jwtSecret(c.env))
    if (!payload || payload.role !== 'editor') return false
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return false
    // Changing EDIT_PIN invalidates every token issued with the old PIN
    const pv = await pinVersion(c.env)
    return Boolean(pv) && payload.pv === pv
  } catch {
    return false
  }
}

/** Attaches the family Dropbox client + `user` ({ role: 'editor' | 'viewer' }). */
export const familyMiddleware = async (c, next) => {
  let dbx
  try {
    dbx = await getFamilyDropboxClient(c.env)
  } catch (err) {
    return c.json(
      { error: err.message, code: err.code || 'FAMILY_DROPBOX_NOT_CONFIGURED' },
      err.status || 503
    )
  }
  const editor = await readEditor(c)
  c.set('user', { role: editor ? 'editor' : 'viewer' })
  c.set('dbx', dbx)
  await next()
}

/** Use after familyMiddleware on routes that change data or call Gemini. */
export const requireEditor = async (c, next) => {
  if (c.get('user')?.role !== 'editor') {
    return c.json({ error: 'Serve il PIN di famiglia per modificare', code: 'PIN_REQUIRED' }, 401)
  }
  await next()
}

/** Shorthand: family Dropbox + editor check. */
export const editorMiddleware = [familyMiddleware, requireEditor]
