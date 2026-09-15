/**
 * HS256 JWT helpers (Web Crypto).
 */

function encode(obj) {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function decode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  return JSON.parse(atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad))
}

export async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const data = `${encode(header)}.${encode(payload)}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  return `${data}.${sigBase64}`
}

export async function verifyJWT(token, secret) {
  const parts = String(token || '').split('.')
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
  const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data))
  if (!valid) return null
  return decode(payloadB64)
}

export function jwtSecret(env) {
  return env?.JWT_SECRET || 'dev-secret-change-me'
}

export async function issueUserJwt(user, env, { expiresInSec = 30 * 24 * 60 * 60 } = {}) {
  const now = Math.floor(Date.now() / 1000)
  return signJWT(
    {
      userId: user.id,
      username: user.username,
      email: user.email || null,
      name: user.displayName || user.username,
      role: user.role,
      mustChangePassword: Boolean(user.mustChangePassword),
      iat: now,
      exp: now + expiresInSec
    },
    jwtSecret(env)
  )
}
