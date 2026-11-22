import { apiUrl } from '../services/api.js'
import { getRecipe, listRecipes, restoreRecipe } from '../services/recipes.js'
import { uploadRecipeImage } from '../services/media.js'

export const BACKUP_FORMAT = 'recipe-book-backup'
const BACKUP_VERSION = 1

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return out
}

const isOwnMedia = (url) => /\/api\/media\/[A-Za-z0-9._-]+\.(jpe?g|png|webp)$/i.test(String(url || ''))

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function fetchImage(url, { viaProxy }) {
  const target = viaProxy ? apiUrl(`/api/media/proxy?url=${encodeURIComponent(url)}`) : url
  const res = await fetch(target)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  if (!blob.type.startsWith('image/')) throw new Error('non è un’immagine')
  return blobToDataUrl(blob)
}

function imageUrlsOf(recipe) {
  return [recipe.imageUrl, ...(recipe.diary || []).map((e) => e.photoUrl)].filter((u) => /^https?:\/\//i.test(u || ''))
}

/**
 * Download every recipe (and, optionally, its photos as data URLs) into one JSON file.
 * @returns {{ blob: Blob, fileName: string, recipes: number, photos: number, failedPhotos: number }}
 */
export async function createBackup({ includePhotos = true, appName = '', favorites = [], onProgress = () => {} } = {}) {
  onProgress('Leggo l’elenco…')
  const list = (await listRecipes('')).data || []
  let done = 0
  const recipes = (
    await mapLimit(list, 4, async (entry) => {
      try {
        const res = await getRecipe(entry.id)
        return res.data
      } catch (err) {
        console.warn('[backup] recipe', entry.id, err.message)
        return null
      } finally {
        done += 1
        onProgress(`Ricette: ${done} di ${list.length}`)
      }
    })
  ).filter(Boolean)

  const images = {}
  let failedPhotos = 0
  if (includePhotos) {
    const covers = new Set(recipes.map((r) => r.imageUrl).filter(Boolean))
    const urls = [...new Set(recipes.flatMap(imageUrlsOf))]
    let n = 0
    await mapLimit(urls, 4, async (url) => {
      try {
        // Own photos are served with CORS; external covers go through the worker proxy
        images[url] = await fetchImage(url, { viaProxy: !isOwnMedia(url) && covers.has(url) })
      } catch (err) {
        failedPhotos += 1
        console.warn('[backup] photo', url, err.message)
      } finally {
        n += 1
        onProgress(`Foto: ${n} di ${urls.length}`)
      }
    })
  }

  const data = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    appName: appName || '',
    favorites: Array.isArray(favorites) ? favorites : [],
    recipes,
    images
  }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const stamp = new Date().toISOString().slice(0, 10)
  return {
    blob,
    fileName: `ricettario-backup-${stamp}.json`,
    recipes: recipes.length,
    photos: Object.keys(images).length,
    failedPhotos
  }
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** Parse + validate a backup file. Throws a readable error. */
export async function readBackupFile(file) {
  let data
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('Il file non è un backup valido (JSON illeggibile).')
  }
  if (data?.format !== BACKUP_FORMAT || !Array.isArray(data.recipes)) {
    throw new Error('Il file non è un backup del ricettario.')
  }
  const recipes = data.recipes.filter((r) => r && typeof r === 'object' && String(r.title || '').trim())
  return { ...data, recipes, images: data.images && typeof data.images === 'object' ? data.images : {} }
}

async function urlWorks(url) {
  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

function dataUrlParts(dataUrl) {
  const m = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i.exec(String(dataUrl || ''))
  return m ? { mimeType: m[1].toLowerCase(), imageBase64: m[2] } : null
}

/** Our own photo missing (e.g. Dropbox emptied) but saved in the backup → upload it again. */
async function restorePhoto(url, images, cache) {
  if (!url || !isOwnMedia(url) || !images[url]) return url
  if (cache.has(url)) return cache.get(url)
  let result = url
  if (!(await urlWorks(url))) {
    const parts = dataUrlParts(images[url])
    if (parts) {
      try {
        const res = await uploadRecipeImage(parts)
        result = res.data?.imageUrl || url
      } catch (err) {
        console.warn('[restore] photo', url, err.message)
      }
    }
  }
  cache.set(url, result)
  return result
}

/**
 * Restore recipes one by one (sequential: the server index is read-modify-write).
 * @returns {{ restored: number, skipped: number, failed: { title: string, error: string }[] }}
 */
export async function restoreBackup(backup, { overwrite = false, existingIds = new Set(), onProgress = () => {} } = {}) {
  const photoCache = new Map()
  let restored = 0
  let skipped = 0
  const failed = []
  const total = backup.recipes.length
  for (let i = 0; i < total; i += 1) {
    const recipe = backup.recipes[i]
    if (!overwrite && existingIds.has(recipe.id)) {
      skipped += 1
      continue
    }
    onProgress(`Ripristino ${i + 1} di ${total}: ${recipe.title}`)
    try {
      const imageUrl = await restorePhoto(recipe.imageUrl, backup.images, photoCache)
      const diary = await Promise.all(
        (recipe.diary || []).map(async (e) => ({
          ...e,
          photoUrl: await restorePhoto(e.photoUrl, backup.images, photoCache)
        }))
      )
      const res = await restoreRecipe({ ...recipe, imageUrl, diary }, { overwrite })
      if (res.data?.skipped) skipped += 1
      else restored += 1
    } catch (err) {
      if (err.code === 'PIN_REQUIRED') throw err
      failed.push({ title: recipe.title, error: err.message })
    }
  }
  return { restored, skipped, failed }
}
