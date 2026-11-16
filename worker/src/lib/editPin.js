/**
 * Family edit PIN — stored as Worker secret EDIT_PIN (wrangler secret put EDIT_PIN).
 * No PIN configured → editing is disabled (fail closed).
 */

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function configuredPin(env) {
  const pin = typeof env?.EDIT_PIN === 'string' ? env.EDIT_PIN.trim() : ''
  return pin || null
}

/** Short fingerprint of the current PIN, embedded in editor tokens. */
export async function pinVersion(env) {
  const pin = configuredPin(env)
  if (!pin) return null
  return (await sha256Hex(`${env.JWT_SECRET || ''}:pin:${pin}`)).slice(0, 16)
}

/** Constant-time comparison (hash both sides, then compare digests). */
export async function checkPin(env, candidate) {
  const pin = configuredPin(env)
  if (!pin) return false
  const [a, b] = await Promise.all([
    sha256Hex(String(candidate ?? '').trim()),
    sha256Hex(pin)
  ])
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
