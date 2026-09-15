import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { fetchRecipeFromUrl } from '../lib/scrapers/index.js'

const scrapers = new Hono()
scrapers.use('*', authMiddleware)

/**
 * POST /api/scraper/fetch-recipe
 * Body: { url }
 * Returns a recipe draft for the frontend form (does not save to Dropbox).
 */
scrapers.post('/fetch-recipe', async (c) => {
  try {
    const body = await c.req.json()
    const url = String(body.url || '').trim()
    if (!url) return c.json({ error: 'URL obbligatorio' }, 400)

    const draft = await fetchRecipeFromUrl(url, {
      geminiEnv: c.env
    })
    return c.json({ success: true, data: draft })
  } catch (err) {
    console.error('[scraper/fetch-recipe]', err.message)
    const status = err.status || 500
    return c.json({ error: err.message || 'Scraping fallito' }, status)
  }
})

export default scrapers
