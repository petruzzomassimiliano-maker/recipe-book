/**
 * App users + family settings stored on family Dropbox.
 */

import { DropboxClient } from './dropboxClient.js'

export const USERS_PATH = '/users/users.json'
export const FAMILY_SETTINGS_PATH = '/users/family-settings.json'
export const FAMILY_AUTH_PATH = '/users/family-auth.json'

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member'
}

export function emptyFamilySettings() {
  return {
    familyAppName: 'Recipe Book',
    updatedAt: new Date().toISOString()
  }
}

export function publicUser(user) {
  if (!user) return null
  return {
    id: user.id,
    username: user.username,
    email: user.email || null,
    displayName: user.displayName || user.username,
    role: user.role,
    active: user.active !== false,
    mustChangePassword: Boolean(user.mustChangePassword),
    preferences: {
      appLabel: user.preferences?.appLabel || '',
      featuredMode: ['random', 'latest', 'oldest'].includes(user.preferences?.featuredMode)
        ? user.preferences.featuredMode
        : 'random'
    },
    invitedBy: user.invitedBy || null,
    createdAt: user.createdAt,
    roleChangedAt: user.roleChangedAt || null,
    invitePending: Boolean(user.inviteToken && !user.inviteUsedAt),
    inviteExpiresAt: user.inviteExpiresAt || null,
    hasRecovery: Boolean(user.recoveryHash)
  }
}

export async function loadUsers(dbx) {
  const raw = await dbx.readJSON(USERS_PATH)
  if (!Array.isArray(raw)) return []
  return raw
}

export async function saveUsers(dbx, users) {
  await dbx.createFolderIfNotExists('/users')
  return dbx.writeJSON(USERS_PATH, users)
}

export async function loadFamilySettings(dbx) {
  const raw = await dbx.readJSON(FAMILY_SETTINGS_PATH)
  return { ...emptyFamilySettings(), ...(raw || {}) }
}

export async function saveFamilySettings(dbx, settings) {
  await dbx.createFolderIfNotExists('/users')
  return dbx.writeJSON(FAMILY_SETTINGS_PATH, {
    ...emptyFamilySettings(),
    ...settings,
    updatedAt: new Date().toISOString()
  })
}

export function findUserByUsername(users, username) {
  const u = String(username || '').trim().toLowerCase()
  return users.find((x) => String(x.username || '').toLowerCase() === u) || null
}

export function findUserById(users, id) {
  return users.find((x) => x.id === id) || null
}

export function findOwner(users) {
  return users.find((x) => x.role === ROLES.OWNER && x.active !== false) || null
}

export function normalizeUsername(username) {
  return String(username || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

export function isValidUsername(username) {
  return /^[a-z0-9._-]{3,32}$/.test(normalizeUsername(username))
}

/**
 * Ensure folder layout exists (family vault uses a stable folder key).
 */
export async function ensureFamilyFolders(accessToken) {
  const dbx = new DropboxClient(accessToken)
  await dbx.initFolderStructure('family')
  return dbx
}
