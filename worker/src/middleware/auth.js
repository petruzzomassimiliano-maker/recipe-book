/**
 * JWT auth middleware for Hono.
 * Verifies Bearer token from Authorization header.
 * Attaches decoded payload to c.set('user', payload).
 */
export const authMiddleware = async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized — missing or invalid token' }, 401)
  }

  const token = authHeader.slice(7) // Remove "Bearer "
  const secret = c.env.JWT_SECRET || 'dev-secret-change-me'

  try {
    const payload = await verifyJWT(token, secret)
    if (!payload) return c.json({ error: 'Unauthorized — invalid JWT' }, 401)

    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return c.json({ error: 'Unauthorized — token expired' }, 401)
    }

    c.set('user', payload)
    await next()
  } catch (err) {
    console.error('[authMiddleware]', err.message)
    return c.json({ error: 'Unauthorized — JWT verification failed' }, 401)
  }
}

/**
 * Verify HS256 JWT using Web Crypto API.
 */
async function verifyJWT(token, secret) {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [headerB64, payloadB64, sigB64] = parts
  const data = `${headerB64}.${payloadB64}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  const sig = Uint8Array.from(
    atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  )

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sig,
    new TextEncoder().encode(data)
  )

  if (!valid) return null

  const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
  return payload
}
