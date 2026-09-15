import { Hono } from 'hono'
import { collectGeminiKeys } from '../lib/geminiClient.js'

const health = new Hono()

health.get('/', (c) => {
  const geminiKeys = collectGeminiKeys(c.env)
  return c.json({
    success: true,
    status: 'ok',
    service: 'recipe-book-worker',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    env: c.env.ENVIRONMENT || 'development',
    bindings: {
      GEMINI_API_KEY: Boolean(c.env.GEMINI_API_KEY),
      GEMINI_API_KEY_2: Boolean(c.env.GEMINI_API_KEY_2),
      geminiKeyCount: geminiKeys.length,
      DROPBOX_APP_KEY: Boolean(c.env.DROPBOX_APP_KEY),
      FAMILY_DROPBOX_REFRESH_TOKEN: Boolean(c.env.FAMILY_DROPBOX_REFRESH_TOKEN),
      JWT_SECRET: Boolean(c.env.JWT_SECRET)
    }
  })
})

// Gemini test endpoint — remove after setup verified
health.post('/test-gemini', async (c) => {
  try {
    const { geminiGenerateContent } = await import('../lib/geminiClient.js')
    const keys = collectGeminiKeys(c.env)
    if (!keys.length) {
      return c.json({ error: 'GEMINI_API_KEY not set in .dev.vars' }, 500)
    }

    const text = await geminiGenerateContent(c.env, [
      { text: 'Say "Recipe Book worker is working!" — nothing else.' }
    ], { json: false, temperature: 0 })

    return c.json({
      success: true,
      response: text,
      geminiKeyCount: keys.length
    })
  } catch (err) {
    console.error('[health/test-gemini]', err.message)
    return c.json({ error: err.message }, 500)
  }
})

export default health
