import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { collectGeminiKeys } from '../lib/geminiClient.js'
import { isYoutubeUrl } from '../lib/youtube/ids.js'
import { parseRecipeFromYoutube } from '../lib/youtube/parseRecipe.js'

const youtube = new Hono()
youtube.use('*', authMiddleware)

/**
 * POST /api/youtube/parse-recipe
 * Body: { videoUrl, manualTranscript? }
 */
youtube.post('/parse-recipe', async (c) => {
  try {
    const keys = collectGeminiKeys(c.env)
    if (!keys.length) {
      return c.json({ error: 'GEMINI_API_KEY non configurata' }, 500)
    }

    const body = await c.req.json()
    const videoUrl = String(body.videoUrl || body.url || '').trim()
    const manualTranscript = body.manualTranscript != null ? String(body.manualTranscript) : null

    if (!videoUrl) return c.json({ error: 'URL YouTube obbligatorio' }, 400)
    if (!isYoutubeUrl(videoUrl)) {
      return c.json({ error: 'URL non riconosciuto come YouTube' }, 400)
    }

    const draft = await parseRecipeFromYoutube(c.env, { videoUrl, manualTranscript })
    return c.json({ success: true, data: draft })
  } catch (err) {
    console.error('[youtube/parse-recipe]', err.message)
    const status = err.status || 500
    return c.json(
      {
        error: err.message || 'Parsing YouTube fallito',
        code: err.code || undefined,
        meta: err.meta || undefined
      },
      status
    )
  }
})

export default youtube
