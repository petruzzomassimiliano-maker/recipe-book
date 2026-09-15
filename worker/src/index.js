import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import authRoutes from './routes/auth.js'
import healthRoutes from './routes/health.js'
import recipeRoutes from './routes/recipes.js'
import scraperRoutes from './routes/scrapers.js'
import shoppingRoutes from './routes/shopping.js'
import geminiRoutes from './routes/gemini.js'
import nutritionRoutes from './routes/nutrition.js'
import youtubeRoutes from './routes/youtube.js'
import usersRoutes from './routes/users.js'
import settingsRoutes from './routes/settings.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = new Hono()

// ── Middleware ──────────────────────────────────────────────────────────────
app.use('*', logger())

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return origin
    const allowed = [
      'http://localhost:5173',
      'http://localhost:4173',
      'https://recipe-book.pages.dev',
      'https://recipe-book-ap1.pages.dev'
    ]
    if (allowed.includes(origin)) return origin
    // Preview / alternate Pages hostnames for this project
    if (/^https:\/\/recipe-book([a-z0-9-]*)?\.pages\.dev$/.test(origin)) return origin
    if (/^https:\/\/[a-z0-9-]+\.recipe-book(-[a-z0-9]+)?\.pages\.dev$/.test(origin)) return origin
    return null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}))

app.onError(errorHandler)

// ── Routes ──────────────────────────────────────────────────────────────────
app.route('/api/health', healthRoutes)
app.route('/api/auth', authRoutes)
app.route('/api/recipes', recipeRoutes)
app.route('/api/scraper', scraperRoutes)
app.route('/api/shopping-list', shoppingRoutes)
app.route('/api/gemini', geminiRoutes)
app.route('/api/nutrition', nutritionRoutes)
app.route('/api/youtube', youtubeRoutes)
app.route('/api/users', usersRoutes)
app.route('/api/settings', settingsRoutes)

// ── 404 fallback ────────────────────────────────────────────────────────────
app.notFound((c) => {
  return c.json({ error: 'Route not found' }, 404)
})

export default app
