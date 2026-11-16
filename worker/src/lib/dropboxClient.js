/**
 * DropboxClient — Wrapper per le chiamate Dropbox API v2.
 * Usato dal Worker (lato server) per lettura/scrittura file JSON + immagini.
 */

function dropboxErrorTag(data) {
  if (!data || typeof data !== 'object') return null
  if (typeof data.error === 'object') return data.error['.tag'] || null
  return typeof data.error === 'string' ? data.error : null
}

function isDropboxAuthFailure(data, status) {
  if (status === 401) return true
  const tag = dropboxErrorTag(data)
  if (tag === 'expired_access_token' || tag === 'invalid_access_token') return true
  const text = `${data?.error_summary || ''} ${typeof data?.error === 'string' ? data.error : ''} ${JSON.stringify(data || {})}`
  return /expired_access_token|invalid_access_token|invalid.?authorization|expired.?access.?token/i.test(text)
}

function throwDropboxError(data, context, status) {
  if (isDropboxAuthFailure(data, status)) {
    const err = new Error('DROPBOX_TOKEN_EXPIRED')
    err.code = 'DROPBOX_TOKEN_EXPIRED'
    throw err
  }
  throw new Error(`${context}: ${JSON.stringify(data)}`)
}

export class DropboxClient {
  constructor(accessToken) {
    this.accessToken = accessToken
    this.apiBase = 'https://api.dropboxapi.com/2'
    this.contentBase = 'https://content.dropboxapi.com/2'
    this.appFolder = '' // App folder mode: paths relative to /Apps/Recipe Book/
    /** Optional hook (set by familyDropbox) called when Dropbox rejects the token. */
    this.onAuthFailure = null
  }

  fail(data, context, status) {
    if (isDropboxAuthFailure(data, status) && typeof this.onAuthFailure === 'function') {
      this.onAuthFailure()
    }
    throwDropboxError(data, context, status)
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
    const data = await res.json().catch(() => ({}))
    if (!res.ok) this.fail(data, `Dropbox API error [${endpoint}]`, res.status)
    return data
  }

  async uploadFile(path, content, mode = 'overwrite') {
    const res = await fetch(`${this.contentBase}/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path,
          mode: typeof mode === 'string' ? { '.tag': mode } : mode,
          autorename: false,
          mute: true
        })
      },
      body: typeof content === 'string' ? content : JSON.stringify(content)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) this.fail(data, `Dropbox upload error [${path}]`, res.status)
    return data
  }

  /**
   * Upload raw bytes (images). `body` must be ArrayBuffer, Uint8Array, or Blob.
   */
  async uploadBinary(path, body, mode = 'overwrite') {
    const res = await fetch(`${this.contentBase}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path,
          mode: typeof mode === 'string' ? { '.tag': mode } : mode,
          autorename: false,
          mute: true
        })
      },
      body
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) this.fail(data, `Dropbox binary upload error [${path}]`, res.status)
    return data
  }

  async downloadBinary(path) {
    const res = await fetch(`${this.contentBase}/files/download`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path })
      }
    })
    if (res.status === 409) return null
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      this.fail(errData, `Dropbox binary download error [${path}]`, res.status)
    }
    const buf = await res.arrayBuffer()
    let apiResult = {}
    try {
      const raw = res.headers.get('Dropbox-API-Result')
      if (raw) apiResult = JSON.parse(raw)
    } catch {
      // ignore
    }
    return { buffer: buf, meta: apiResult }
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
      const errData = await res.json().catch(() => ({}))
      this.fail(errData, `Dropbox download error [${path}]`, res.status)
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
      if (err.code === 'DROPBOX_TOKEN_EXPIRED' || err.message === 'DROPBOX_TOKEN_EXPIRED') {
        throw err
      }
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
    try {
      return await this.apiCall('/files/delete_v2', { path })
    } catch (err) {
      // Already gone — treat as success (orphan index cleanup)
      if (/path\/not_found|not_found/i.test(err.message || '')) return { deleted: false, missing: true }
      throw err
    }
  }

  async moveFile(fromPath, toPath) {
    return this.apiCall('/files/move_v2', { from_path: fromPath, to_path: toPath, autorename: false })
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
