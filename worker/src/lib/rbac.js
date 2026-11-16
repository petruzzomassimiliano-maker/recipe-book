/**
 * No user accounts: every recipe is visible to everyone;
 * only holders of the family PIN ("editor") can change them.
 */

export function isEditor(user) {
  return user?.role === 'editor'
}

export function canViewRecipe(_user, recipe) {
  return Boolean(recipe)
}

export function canEditRecipe(user, recipe) {
  return Boolean(recipe) && isEditor(user)
}

export const canDeleteRecipe = canEditRecipe
