/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0 flow.
 * Uses Web Crypto API (available in all modern browsers).
 */

/**
 * Generate a cryptographically random string for code_verifier.
 * Length 43–128 chars recommended by PKCE spec (RFC 7636).
 */
export function generateRandomString(length = 128) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)
  return Array.from(randomValues)
    .map((v) => chars[v % chars.length])
    .join('')
}

/**
 * Base64URL encode a buffer (no padding, URL-safe chars).
 */
export function base64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Generate SHA-256 code_challenge from code_verifier.
 * S256 method as required by Dropbox PKCE.
 */
export async function generateCodeChallenge(codeVerifier) {
  const encoded = new TextEncoder().encode(codeVerifier)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return base64url(digest)
}

/**
 * Full PKCE pair: generates verifier + challenge.
 * Returns { codeVerifier, codeChallenge }
 */
export async function generatePKCEPair() {
  const codeVerifier = generateRandomString(128)
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  return { codeVerifier, codeChallenge }
}
