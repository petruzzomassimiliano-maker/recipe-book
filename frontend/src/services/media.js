import { apiFetch } from './api.js'

/**
 * Compress/resize an image File for upload (max edge + JPEG quality).
 * Returns { base64, mimeType } without data: prefix.
 */
export function readAndCompressImage(file, { maxEdge = 1600, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Nessun file'))
      return
    }
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
      reject(new Error('Usa JPEG, PNG o WebP'))
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error('File troppo grande (max 12 MB)'))
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        let { width, height } = img
        const scale = Math.min(1, maxEdge / Math.max(width, height))
        width = Math.max(1, Math.round(width * scale))
        height = Math.max(1, Math.round(height * scale))

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas non disponibile'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)

        const mimeType = 'image/jpeg'
        const dataUrl = canvas.toDataURL(mimeType, quality)
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
        URL.revokeObjectURL(objectUrl)
        resolve({ base64, mimeType, previewUrl: dataUrl })
      } catch (err) {
        URL.revokeObjectURL(objectUrl)
        reject(err)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Impossibile leggere l’immagine'))
    }
    img.src = objectUrl
  })
}

export function uploadRecipeImage({ imageBase64, mimeType }) {
  return apiFetch('/api/media', {
    method: 'POST',
    body: JSON.stringify({ imageBase64, mimeType })
  })
}
