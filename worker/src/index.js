import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import authRoutes from './routes/auth.js'
import healthRoutes from './routes/health.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = new Hono()

// ── Middleware ──────────────────────────────────────────────────────────────
app.use('*', logger())

app.use('*', cors({
  origin: (origin) => {
    // Allow localhost dev + production Pages domain
    const allowed = [
      'http://localhost:5173',
      'http://localhost:4173',
      'https://recipe-book.pages.dev'
    ]
    return allowed.includes(origin) ? origin : null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}))

app.onError(errorHandler)

// ── Routes ──────────────────────────────────────────────────────────────────
app.route('/api/health', healthRoutes)
app.route('/api/auth', authRoutes)

// ── 404 fallback ────────────────────────────────────────────────────────────
app.notFound((c) => {
  return c.json({ error: 'Route not found' }, 404)
})

export default app
