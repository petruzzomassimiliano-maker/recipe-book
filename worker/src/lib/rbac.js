/**
 * Recipe visibility / mutation checks — family roles.
 * author is stored as `user-${userId}`.
 *
 * Members: only their own recipes.
 * Owner / admin: view and edit all recipes.
 */

import { ROLES } from './users.js'

export function authorKey(user) {
  return `user-${user.userId}`
}

export function isStaff(user) {
  return user?.role === ROLES.OWNER || user?.role === ROLES.ADMIN || user?.role === 'superUser'
}

export function isOwner(user) {
  return user?.role === ROLES.OWNER
}

export function canManageUsers(user) {
  return isStaff(user)
}

export function canPromoteAdmin(user) {
  return isOwner(user)
}

export function canDemoteAdmin(user) {
  return isOwner(user)
}

export function canEditFamilySettings(user) {
  return isStaff(user)
}

/**
 * Owner: reset admin + member (not self).
 * Admin: reset admin + member (not owner, not self).
 */
export function canResetUserPassword(actor, target) {
  if (!actor || !target) return false
  if (actor.userId === target.id) return false
  if (target.role === ROLES.OWNER) return false
  if (!isStaff(actor)) return false
  if (target.role === ROLES.ADMIN || target.role === ROLES.MEMBER) return true
  return false
}

export function isRecipeAuthor(user, recipe) {
  if (!user || !recipe) return false
  const author = recipe.author
  return author === authorKey(user) || author === user.userId
}

/** Shared recipient ids live on recipe.metadata or index entry (bare user UUID). */
export function sharedWithUserIds(recipe) {
  const raw = recipe?.metadata?.sharedWithUserIds ?? recipe?.sharedWithUserIds
  if (!Array.isArray(raw)) return []
  return raw
    .map((id) => String(id || '').trim().replace(/^user-/, ''))
    .filter(Boolean)
}

export function isSharedWithUser(user, recipe) {
  if (!user?.userId || !recipe) return false
  if (recipe?.metadata?.isPrivate || recipe?.isPrivate) return false
  return sharedWithUserIds(recipe).includes(String(user.userId))
}

/**
 * Members: own recipes + those shared with them.
 * Staff: all recipes.
 * Private recipes are never visible via share (author + staff only).
 */
export function canViewRecipe(user, recipe) {
  if (!recipe) return false
  if (isStaff(user)) return true
  if (isRecipeAuthor(user, recipe)) return true
  return isSharedWithUser(user, recipe)
}

/** Author or staff can share; ownership does not change. */
export function canShareRecipe(user, recipe) {
  if (!recipe) return false
  if (isStaff(user)) return true
  return isRecipeAuthor(user, recipe)
}

export function canEditRecipe(user, recipe) {
  if (!recipe) return false
  if (isStaff(user)) return true
  return isRecipeAuthor(user, recipe)
}

export const canDeleteRecipe = canEditRecipe
