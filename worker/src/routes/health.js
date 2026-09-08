import { Hono } from 'hono'

const health = new Hono()

health.get('/', (c) => {
  return c.json({
    success: true,
    status: 'ok',
    service: 'recipe-book-worker',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    env: c.env.ENVIRONMENT || 'development'
  })
})

// Gemini test endpoint — remove after setup verified
health.post('/test-gemini', async (c) => {
  try {
    const apiKey = c.env.GEMINI_API_KEY
    if (!apiKey) {
      return c.json({ error: 'GEMINI_API_KEY not set in .dev.vars' }, 500)
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say "Recipe Book worker is working!" — nothing else.' }] }]
        })
      }
    )
    const data = await response.json()
    if (!response.ok) return c.json({ error: data }, response.status)
    return c.json({
      success: true,
      response: data.candidates[0].content.parts[0].text
    })
  } catch (err) {
    console.error('[health/test-gemini]', err.message)
    return c.json({ error: err.message }, 500)
  }
})

export default health
