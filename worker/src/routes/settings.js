import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { canEditFamilySettings } from '../lib/rbac.js'
import { loadFamilySettings, saveFamilySettings } from '../lib/users.js'

const settings = new Hono()
settings.use('*', authMiddleware)

settings.get('/', async (c) => {
  const data = await loadFamilySettings(c.get('dbx'))
  return c.json({ success: true, data })
})

settings.put('/', async (c) => {
  if (!canEditFamilySettings(c.get('user'))) {
    return c.json({ error: 'Solo owner/admin possono cambiare le impostazioni famiglia' }, 403)
  }
  try {
    const body = await c.req.json()
    const current = await loadFamilySettings(c.get('dbx'))
    const familyAppName =
      body.familyAppName != null
        ? String(body.familyAppName).trim().slice(0, 60) || 'Recipe Book'
        : current.familyAppName
    await saveFamilySettings(c.get('dbx'), { ...current, familyAppName })
    const data = await loadFamilySettings(c.get('dbx'))
    return c.json({ success: true, data })
  } catch (err) {
    console.error('[settings/put]', err.message)
    return c.json({ error: err.message || 'Salvataggio fallito' }, 500)
  }
})

export default settings
