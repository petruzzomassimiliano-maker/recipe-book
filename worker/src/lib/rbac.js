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

/** Members see only their recipes; staff see all. */
export function canViewRecipe(user, recipe) {
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
