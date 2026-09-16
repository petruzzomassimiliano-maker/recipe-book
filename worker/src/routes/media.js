import { Hono } from 'hono'
import { DropboxClient } from '../lib/dropboxClient.js'
import { authMiddleware } from '../middleware/auth.js'
import { getFamilyDropboxClient } from '../lib/familyDropbox.js'

const media = new Hono()

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
}
const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
}

function base64ToBytes(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * GET /api/media/:file — public serve (UUID filenames).
 * Allows <img src> without Authorization header.
 */
media.get('/:file', async (c) => {
  const file = String(c.req.param('file') || '')
  if (!/^[a-zA-Z0-9._-]+\.(jpe?g|png|webp)$/i.test(file)) {
    return c.json({ error: 'Nome file non valido' }, 400)
  }
  try {
    const dbx = await getFamilyDropboxClient(c.env)
    const path = `/recipes/images/${file}`
    const downloaded = await dbx.downloadBinary(path)
    if (!downloaded?.buffer) return c.json({ error: 'Immagine non trovata' }, 404)

    const ext = file.split('.').pop().toLowerCase()
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream'
    return new Response(downloaded.buffer, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (err) {
    if (err.code === 'FAMILY_DROPBOX_NOT_CONFIGURED' || err.message === 'DROPBOX_TOKEN_EXPIRED') {
      return c.json({ error: err.message, code: err.code }, err.status || 503)
    }
    console.error('[media/get]', err.message)
    return c.json({ error: 'Download immagine fallito' }, 500)
  }
})

/**
 * POST /api/media — upload recipe photo (auth).
 * Body JSON: { imageBase64, mimeType? }
 * Returns: { data: { imageUrl, fileName, path } }
 */
media.post('/', authMiddleware, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    let imageBase64 = String(body.imageBase64 || body.image || '').trim()
    if (imageBase64.includes(',')) imageBase64 = imageBase64.split(',').pop()
    imageBase64 = imageBase64.replace(/\s/g, '')
    if (!imageBase64) return c.json({ error: 'Immagine obbligatoria (imageBase64)' }, 400)

    let mimeType = String(body.mimeType || 'image/jpeg').toLowerCase()
    if (mimeType === 'image/jpg') mimeType = 'image/jpeg'
    if (!ALLOWED_MIME.has(mimeType)) {
      return c.json({ error: 'Formato non supportato (JPEG, PNG o WebP)' }, 400)
    }

    // ~4.5MB base64 ≈ ~3.3MB binary — keep Worker request size sane
    if (imageBase64.length > 6_000_000) {
      return c.json({ error: 'Immagine troppo grande (max ~4 MB). Prova a ridimensionarla.' }, 400)
    }

    const bytes = base64ToBytes(imageBase64)
    const ext = EXT_BY_MIME[mimeType] || 'jpg'
    const fileName = `${randomId()}.${ext}`
    const path = `/recipes/images/${fileName}`

    const client = new DropboxClient(c.get('dropboxToken'))
    await client.createFolderIfNotExists('/recipes/images')
    await client.uploadBinary(path, bytes)

    // Absolute URL so <img> works from Pages origin (prod) and localhost (dev via Worker)
    const origin = new URL(c.req.url).origin
    const imageUrl = `${origin}/api/media/${fileName}`

    return c.json({
      data: {
        imageUrl,
        fileName,
        path
      }
    })
  } catch (err) {
    console.error('[media/post]', err.message)
    return c.json({ error: err.message || 'Upload fallito' }, err.status || 500)
  }
})

export default media
