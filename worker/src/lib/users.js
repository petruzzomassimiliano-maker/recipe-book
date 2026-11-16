/**
 * Family settings stored on family Dropbox (no user accounts any more).
 */

export const FAMILY_SETTINGS_PATH = '/users/family-settings.json'

export function emptyFamilySettings() {
  return {
    familyAppName: 'Recipe Book',
    updatedAt: new Date().toISOString()
  }
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
