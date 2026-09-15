/**
 * Family Dropbox access — refresh token lives in Worker env (and optional Dropbox backup).
 */

import { DropboxClient } from './dropboxClient.js'
import { FAMILY_AUTH_PATH } from './users.js'

const g = globalThis
if (!g.__recipeBookFamilyDbx) {
  g.__recipeBookFamilyDbx = { accessToken: null, expiresAt: 0, refreshToken: null }
}

function cache() {
  return g.__recipeBookFamilyDbx
}

export function setFamilyRefreshTokenRuntime(refreshToken) {
  if (refreshToken) cache().refreshToken = refreshToken
}

export function getConfiguredFamilyRefreshToken(env) {
  return (
    cache().refreshToken ||
    (typeof env?.FAMILY_DROPBOX_REFRESH_TOKEN === 'string' &&
    env.FAMILY_DROPBOX_REFRESH_TOKEN.trim()
      ? env.FAMILY_DROPBOX_REFRESH_TOKEN.trim()
      : null)
  )
}

export async function refreshFamilyAccessToken(env, refreshToken) {
  const tokenRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: env.DROPBOX_APP_KEY,
      client_secret: env.DROPBOX_APP_SECRET
    })
  })
  const tokens = await tokenRes.json()
  if (!tokenRes.ok) {
    const err = new Error(tokens.error_description || 'Family Dropbox refresh failed')
    err.code = 'FAMILY_DROPBOX_REFRESH_FAILED'
    err.status = 401
    throw err
  }
  const accessToken = tokens.access_token
  const expiresIn = Number(tokens.expires_in) || 14400
  cache().accessToken = accessToken
  cache().expiresAt = Date.now() + (expiresIn - 120) * 1000
  if (tokens.refresh_token) cache().refreshToken = tokens.refresh_token
  return accessToken
}

export async function getFamilyAccessToken(env) {
  const c = cache()
  if (c.accessToken && c.expiresAt > Date.now()) return c.accessToken

  const refresh = getConfiguredFamilyRefreshToken(env)
  if (!refresh) {
    const err = new Error(
      'Dropbox famiglia non configurato. Completa il setup o imposta FAMILY_DROPBOX_REFRESH_TOKEN.'
    )
    err.code = 'FAMILY_DROPBOX_NOT_CONFIGURED'
    err.status = 503
    throw err
  }
  return refreshFamilyAccessToken(env, refresh)
}

export async function getFamilyDropboxClient(env) {
  const accessToken = await getFamilyAccessToken(env)
  return new DropboxClient(accessToken)
}

export async function persistFamilyAuthBackup(accessToken, refreshToken) {
  if (!accessToken || !refreshToken) return
  const dbx = new DropboxClient(accessToken)
  await dbx.createFolderIfNotExists('/users')
  await dbx.writeJSON(FAMILY_AUTH_PATH, {
    refreshToken,
    updatedAt: new Date().toISOString()
  })
}

export function hasFamilyDropboxConfigured(env) {
  return Boolean(getConfiguredFamilyRefreshToken(env) || cache().accessToken)
}
