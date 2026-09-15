import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { generateTempPassword, hashPassword } from '../lib/password.js'
import {
  canDemoteAdmin,
  canManageUsers,
  canPromoteAdmin,
  isOwner
} from '../lib/rbac.js'
import {
  findUserById,
  findUserByUsername,
  isValidUsername,
  loadFamilySettings,
  loadUsers,
  normalizeUsername,
  publicUser,
  ROLES,
  saveUsers
} from '../lib/users.js'

const users = new Hono()
users.use('*', authMiddleware)

function requireStaff(c) {
  if (!canManageUsers(c.get('user'))) {
    return c.json({ error: 'Solo owner/admin' }, 403)
  }
  return null
}

users.get('/', async (c) => {
  const denied = requireStaff(c)
  if (denied) return denied
  const list = await loadUsers(c.get('dbx'))
  return c.json({ success: true, data: list.map(publicUser) })
})

users.get('/me', async (c) => {
  const list = await loadUsers(c.get('dbx'))
  const me = findUserById(list, c.get('user').userId)
  if (!me) return c.json({ error: 'Utente non trovato' }, 404)
  const settings = await loadFamilySettings(c.get('dbx'))
  return c.json({
    success: true,
    data: { user: publicUser(me), familyAppName: settings.familyAppName }
  })
})

/**
 * PATCH /api/users/me/preferences
 */
users.patch('/me/preferences', async (c) => {
  try {
    const body = await c.req.json()
    const dbx = c.get('dbx')
    const list = await loadUsers(dbx)
    const idx = list.findIndex((u) => u.id === c.get('user').userId)
    if (idx < 0) return c.json({ error: 'Utente non trovato' }, 404)

    const appLabel =
      body.appLabel != null ? String(body.appLabel).trim().slice(0, 40) : list[idx].preferences?.appLabel || ''
    const displayName =
      body.displayName != null
        ? String(body.displayName).trim().slice(0, 60)
        : list[idx].displayName
    const allowedModes = ['random', 'latest', 'oldest']
    const featuredMode =
      body.featuredMode != null && allowedModes.includes(String(body.featuredMode))
        ? String(body.featuredMode)
        : list[idx].preferences?.featuredMode || 'random'

    list[idx] = {
      ...list[idx],
      displayName: displayName || list[idx].displayName,
      preferences: { ...(list[idx].preferences || {}), appLabel, featuredMode }
    }
    await saveUsers(dbx, list)
    return c.json({ success: true, data: publicUser(list[idx]) })
  } catch (err) {
    console.error('[users/me/preferences]', err.message)
    return c.json({ error: err.message || 'Salvataggio fallito' }, 500)
  }
})

/**
 * POST /api/users/invite
 * Body: { username, displayName?, role?: 'member'|'admin', email? }
 * Crea utente + link monouso (7g). Condividi il link a mano (WhatsApp, ecc.).
 */
users.post('/invite', async (c) => {
  const denied = requireStaff(c)
  if (denied) return denied

  try {
    const body = await c.req.json()
    const actor = c.get('user')
    const username = normalizeUsername(body.username)
    const email = String(body.email || '').trim() || null
    const displayName = String(body.displayName || username).trim()
    let role = body.role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.MEMBER

    if (role === ROLES.ADMIN && !canPromoteAdmin(actor)) {
      return c.json({ error: 'Solo l’owner può nominare admin' }, 403)
    }
    if (!isValidUsername(username)) {
      return c.json({ error: 'Username non valido (3–32: a-z 0-9 . _ -)' }, 400)
    }

    const dbx = c.get('dbx')
    const list = await loadUsers(dbx)
    if (findUserByUsername(list, username)) {
      return c.json({ error: 'Username già in uso' }, 409)
    }

    const placeholderPassword = generateTempPassword(24)
    const inviteToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const user = {
      id: crypto.randomUUID(),
      username,
      email,
      displayName,
      passwordHash: await hashPassword(placeholderPassword),
      role,
      active: true,
      mustChangePassword: true,
      preferences: { appLabel: '', featuredMode: 'random' },
      invitedBy: actor.userId,
      inviteToken,
      inviteExpiresAt,
      inviteUsedAt: null,
      createdAt: new Date().toISOString(),
      roleChangedAt: new Date().toISOString()
    }
    list.push(user)
    await saveUsers(dbx, list)

    const base = c.env.APP_BASE_URL || 'http://localhost:5173'
    const inviteUrl = `${base}/invite/${inviteToken}`

    return c.json({
      success: true,
      data: {
        user: publicUser(user),
        inviteToken,
        inviteUrl,
        inviteExpiresAt
      }
    })
  } catch (err) {
    console.error('[users/invite]', err.message)
    return c.json({ error: err.message || 'Invito fallito' }, 500)
  }
})

/**
 * PATCH /api/users/:id
 * Body: { role?, active?, displayName? }
 */
users.patch('/:id', async (c) => {
  const denied = requireStaff(c)
  if (denied) return denied

  try {
    const actor = c.get('user')
    const id = c.req.param('id')
    const body = await c.req.json()
    const dbx = c.get('dbx')
    const list = await loadUsers(dbx)
    const idx = list.findIndex((u) => u.id === id)
    if (idx < 0) return c.json({ error: 'Utente non trovato' }, 404)

    const target = list[idx]
    if (target.role === ROLES.OWNER) {
      return c.json({ error: 'L’owner non può essere modificato così' }, 403)
    }

    const next = { ...target }

    if (body.displayName != null) {
      next.displayName = String(body.displayName).trim() || target.displayName
    }

    if (body.active === false) {
      next.active = false
    }
    if (body.active === true) {
      next.active = true
    }

    if (body.role && body.role !== target.role) {
      if (body.role === ROLES.ADMIN) {
        if (!canPromoteAdmin(actor)) {
          return c.json({ error: 'Solo l’owner può nominare admin' }, 403)
        }
        next.role = ROLES.ADMIN
        next.roleChangedAt = new Date().toISOString()
      } else if (body.role === ROLES.MEMBER) {
        if (target.role === ROLES.ADMIN && !canDemoteAdmin(actor)) {
          return c.json({ error: 'Solo l’owner può rimuovere un admin' }, 403)
        }
        next.role = ROLES.MEMBER
        next.roleChangedAt = new Date().toISOString()
      } else {
        return c.json({ error: 'Ruolo non valido' }, 400)
      }
    }

    list[idx] = next
    await saveUsers(dbx, list)
    return c.json({ success: true, data: publicUser(next) })
  } catch (err) {
    console.error('[users/patch]', err.message)
    return c.json({ error: err.message || 'Aggiornamento fallito' }, 500)
  }
})

/**
 * DELETE /api/users/:id — elimina definitivamente l’account (non l’owner).
 * Le ricette restano assegnate all’autore (o all’owner se orfane).
 */
users.delete('/:id', async (c) => {
  const denied = requireStaff(c)
  if (denied) return denied

  try {
    const actor = c.get('user')
    const id = c.req.param('id')
    if (id === actor.userId) {
      return c.json({ error: 'Non puoi eliminare il tuo stesso account' }, 403)
    }

    const dbx = c.get('dbx')
    const list = await loadUsers(dbx)
    const idx = list.findIndex((u) => u.id === id)
    if (idx < 0) return c.json({ error: 'Utente non trovato' }, 404)

    const target = list[idx]
    if (target.role === ROLES.OWNER) {
      return c.json({ error: 'L’owner non può essere eliminato' }, 403)
    }
    if (target.role === ROLES.ADMIN && !isOwner(actor)) {
      return c.json({ error: 'Solo l’owner può eliminare un admin' }, 403)
    }

    const removed = list[idx]
    const next = list.filter((u) => u.id !== id)
    await saveUsers(dbx, next)
    return c.json({ success: true, data: { id: removed.id, username: removed.username } })
  } catch (err) {
    console.error('[users/delete]', err.message)
    return c.json({ error: err.message || 'Eliminazione fallita' }, 500)
  }
})

export default users
