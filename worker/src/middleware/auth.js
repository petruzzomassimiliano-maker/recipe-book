import { verifyJWT, jwtSecret } from '../lib/jwt.js'
import { getFamilyDropboxClient } from '../lib/familyDropbox.js'
import { findUserById, loadUsers, ROLES } from '../lib/users.js'

/**
 * JWT auth + inject family Dropbox client (server-side token).
 */
export const authMiddleware = async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized — missing or invalid token' }, 401)
  }

  const token = authHeader.slice(7)
  try {
    const payload = await verifyJWT(token, jwtSecret(c.env))
    if (!payload) return c.json({ error: 'Unauthorized — invalid JWT' }, 401)
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return c.json({ error: 'Unauthorized — token expired' }, 401)
    }

    // Legacy superUser → treat as owner-equivalent staff
    if (payload.role === 'superUser') payload.role = ROLES.OWNER
    if (payload.role === 'user') payload.role = ROLES.MEMBER

    let dbx
    try {
      dbx = await getFamilyDropboxClient(c.env)
    } catch (err) {
      return c.json(
        { error: err.message, code: err.code || 'FAMILY_DROPBOX_NOT_CONFIGURED' },
        err.status || 503
      )
    }

    // Soft-check active user when possible
    try {
      const users = await loadUsers(dbx)
      const row = findUserById(users, payload.userId)
      if (row && row.active === false) {
        return c.json({ error: 'Account disattivato' }, 403)
      }
      if (row) {
        payload.role = row.role
        payload.mustChangePassword = Boolean(row.mustChangePassword)
        payload.name = row.displayName || row.username
        payload.username = row.username
      }
    } catch {
      // continue with JWT claims
    }

    c.set('user', payload)
    c.set('dbx', dbx)
    // Back-compat for routes still reading dropboxToken
    c.set('dropboxToken', dbx.accessToken)
    await next()
  } catch (err) {
    console.error('[authMiddleware]', err.message)
    return c.json({ error: 'Unauthorized — JWT verification failed' }, 401)
  }
}

/** Optional auth — attaches user if present. */
export const optionalAuthMiddleware = async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = await verifyJWT(authHeader.slice(7), jwtSecret(c.env))
      if (payload?.exp && payload.exp >= Math.floor(Date.now() / 1000)) {
        c.set('user', payload)
      }
    } catch {
      // ignore
    }
  }
  await next()
}
