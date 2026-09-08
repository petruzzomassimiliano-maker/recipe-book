/**
 * DropboxClient — Wrapper per le chiamate Dropbox API v2.
 * Usato dal Worker (lato server) per lettura/scrittura file JSON + immagini.
 */
export class DropboxClient {
  constructor(accessToken) {
    this.accessToken = accessToken
    this.apiBase = 'https://api.dropboxapi.com/2'
    this.contentBase = 'https://content.dropboxapi.com/2'
    this.appFolder = '' // App folder mode: paths relative to /Apps/Recipe Book/
  }

  // ── Low-level helpers ────────────────────────────────────────────────────

  async apiCall(endpoint, body = {}) {
    const res = await fetch(`${this.apiBase}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    if (res.status === 409) return null // Path not found — non-fatal
    const data = await res.json()
    if (!res.ok) throw new Error(`Dropbox API error [${endpoint}]: ${JSON.stringify(data)}`)
    return data
  }

  async uploadFile(path, content, mode = 'overwrite') {
    const res = await fetch(`${this.contentBase}/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({ path, mode, autorename: false, mute: true })
      },
      body: typeof content === 'string' ? content : JSON.stringify(content)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Dropbox upload error [${path}]: ${JSON.stringify(data)}`)
    return data
  }

  async downloadFile(path) {
    const res = await fetch(`${this.contentBase}/files/download`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path })
      }
    })
    if (res.status === 409) return null // File not found
    if (!res.ok) {
      const errData = await res.json()
      throw new Error(`Dropbox download error [${path}]: ${JSON.stringify(errData)}`)
    }
    return res.text()
  }

  // ── JSON helpers ─────────────────────────────────────────────────────────

  async readJSON(path) {
    const content = await this.downloadFile(path)
    if (!content) return null
    try {
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  async writeJSON(path, data) {
    return this.uploadFile(path, JSON.stringify(data, null, 2))
  }

  async createFolderIfNotExists(path) {
    try {
      await this.apiCall('/files/create_folder_v2', { path, autorename: false })
    } catch (err) {
      // Ignore "folder already exists" error
      if (!err.message.includes('path/conflict/folder')) {
        console.warn(`[dropboxClient] createFolder warning [${path}]:`, err.message)
      }
    }
  }

  async createFileIfNotExists(path, content) {
    const existing = await this.readJSON(path)
    if (existing !== null) return existing // Already exists
    return this.uploadFile(path, content, 'add')
  }

  async listFolder(path) {
    return this.apiCall('/files/list_folder', { path, recursive: false })
  }

  async deleteFile(path) {
    return this.apiCall('/files/delete_v2', { path })
  }

  async moveFile(fromPath, toPath) {
    return this.apiCall('/files/move_v2', { from_path: fromPath, to_path: toPath, autorename: false })
  }

  // ── App initialization ───────────────────────────────────────────────────

  /**
   * Creates the full Recipe Book folder structure in Dropbox on first login.
   * Safe to call multiple times (idempotent).
   */
  async initFolderStructure(userId) {
    const folders = [
      '/users',
      `/users/user-${userId}`,
      '/recipes',
      '/shopping-lists',
      '/nutrition-cache'
    ]

    for (const folder of folders) {
      await this.createFolderIfNotExists(folder)
    }

    // Create users.json if not exists
    await this.createFileIfNotExists('/users/users.json', JSON.stringify([], null, 2))

    // Create user profile if not exists
    const profilePath = `/users/user-${userId}/profile.json`
    await this.createFileIfNotExists(profilePath, JSON.stringify({
      id: `user-${userId}`,
      createdAt: new Date().toISOString(),
      preferences: {
        theme: 'auto',
        font: 'inter',
        language: 'it',
        colorAccent: '#FF6B6B'
      }
    }, null, 2))

    // Create recipes-index.json if not exists
    await this.createFileIfNotExists('/recipes/recipes-index.json', JSON.stringify([], null, 2))

    console.log(`[dropboxClient] Folder structure initialized for user-${userId}`)
  }

  // ── Recipe operations ────────────────────────────────────────────────────

  async getRecipesIndex() {
    return (await this.readJSON('/recipes/recipes-index.json')) || []
  }

  async saveRecipesIndex(index) {
    return this.writeJSON('/recipes/recipes-index.json', index)
  }

  async getRecipe(recipeId) {
    return this.readJSON(`/recipes/recipe-${recipeId}.json`)
  }

  async saveRecipe(recipeId, recipeData) {
    return this.writeJSON(`/recipes/recipe-${recipeId}.json`, recipeData)
  }

  async deleteRecipe(recipeId) {
    return this.deleteFile(`/recipes/recipe-${recipeId}.json`)
  }

  // ── Shopping list operations ─────────────────────────────────────────────

  async getShoppingList(userId) {
    return this.readJSON(`/shopping-lists/shopping-list-${userId}.json`)
  }

  async saveShoppingList(userId, list) {
    return this.writeJSON(`/shopping-lists/shopping-list-${userId}.json`, list)
  }

  // ── User operations ──────────────────────────────────────────────────────

  async getUsers() {
    return (await this.readJSON('/users/users.json')) || []
  }

  async getUserProfile(userId) {
    return this.readJSON(`/users/user-${userId}/profile.json`)
  }

  async saveUserProfile(userId, profile) {
    return this.writeJSON(`/users/user-${userId}/profile.json`, profile)
  }

  // ── Nutrition cache operations ───────────────────────────────────────────

  async getNutritionCache(hash) {
    return this.readJSON(`/nutrition-cache/ingredient-${hash}.json`)
  }

  async saveNutritionCache(hash, data) {
    return this.writeJSON(`/nutrition-cache/ingredient-${hash}.json`, {
      ...data,
      cachedAt: new Date().toISOString()
    })
  }
}
