/**
 * Extract YouTube video id from common URL shapes.
 */
export function extractYoutubeVideoId(input) {
  const raw = String(input || '').trim()
  if (!raw) return null

  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw

  let url
  try {
    url = new URL(raw)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^www\./, '')
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0]
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    const v = url.searchParams.get('v')
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v

    const parts = url.pathname.split('/').filter(Boolean)
    if (['embed', 'shorts', 'live', 'v'].includes(parts[0]) && parts[1]) {
      const id = parts[1].slice(0, 11)
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
    }
  }

  return null
}

export function isYoutubeUrl(input) {
  return Boolean(extractYoutubeVideoId(input))
}

export function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`
}

export function youtubeThumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}
