import { apiFetch } from './api.js'

export function fetchRecipeFromUrl(url) {
  return apiFetch('/api/scraper/fetch-recipe', {
    method: 'POST',
    body: JSON.stringify({ url })
  })
}

export function parseYoutubeRecipe(videoUrl, manualTranscript) {
  return apiFetch('/api/youtube/parse-recipe', {
    method: 'POST',
    body: JSON.stringify({
      videoUrl,
      ...(manualTranscript ? { manualTranscript } : {})
    })
  })
}

export function isYoutubeUrl(input) {
  const raw = String(input || '').trim()
  if (!raw) return false
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return true
  try {
    const url = new URL(raw)
    const host = url.hostname.replace(/^www\./, '')
    return (
      host === 'youtu.be' ||
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com'
    )
  } catch {
    return false
  }
}
