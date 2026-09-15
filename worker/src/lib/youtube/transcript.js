import { youtubeWatchUrl } from './ids.js'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

function extractJsonObject(html, marker) {
  const idx = html.indexOf(marker)
  if (idx < 0) return null
  const start = html.indexOf('{', idx)
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < html.length; i++) {
    const ch = html[i]
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function decodeXmlEntities(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

function parseTranscriptXml(xml) {
  const chunks = []
  const re = /<text[^>]*>([\s\S]*?)<\/text>/gi
  let m
  while ((m = re.exec(xml))) {
    const line = decodeXmlEntities(m[1]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (line) chunks.push(line)
  }
  return chunks.join(' ').replace(/\s+/g, ' ').trim()
}

function parseTranscriptJson3(data) {
  const events = data?.events
  if (!Array.isArray(events)) return ''
  const parts = []
  for (const ev of events) {
    if (!Array.isArray(ev.segs)) continue
    const line = ev.segs.map((s) => s.utf8 || '').join('')
    const cleaned = line.replace(/\n/g, ' ').trim()
    if (cleaned) parts.push(cleaned)
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function pickCaptionTrack(tracks) {
  if (!Array.isArray(tracks) || !tracks.length) return null
  const scored = tracks.map((t) => {
    const lang = String(t.languageCode || '').toLowerCase()
    let score = 0
    if (lang.startsWith('it')) score += 100
    else if (lang.startsWith('en')) score += 50
    if (t.kind !== 'asr') score += 20 // prefer human captions
    if (/italian|italiano/i.test(t.name?.simpleText || '')) score += 10
    return { t, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.t || null
}

async function fetchCaptionText(baseUrl) {
  // Prefer json3; fall back to XML
  const jsonUrl = baseUrl.includes('fmt=') ? baseUrl : `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}fmt=json3`
  try {
    const res = await fetch(jsonUrl, { headers: { 'User-Agent': UA } })
    if (res.ok) {
      const data = await res.json()
      const text = parseTranscriptJson3(data)
      if (text.length > 40) return text
    }
  } catch {
    // continue
  }

  const res = await fetch(baseUrl, { headers: { 'User-Agent': UA } })
  if (!res.ok) return ''
  const xml = await res.text()
  return parseTranscriptXml(xml)
}

/**
 * Fetch title, description, thumbnail hints + auto captions when available.
 */
export async function fetchYoutubeVideoContext(videoId) {
  const watchUrl = youtubeWatchUrl(videoId)
  const res = await fetch(`${watchUrl}&hl=it&gl=IT`, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
      Accept: 'text/html'
    }
  })
  if (!res.ok) {
    const err = new Error(`YouTube non raggiungibile (${res.status})`)
    err.status = 502
    throw err
  }

  const html = await res.text()
  const player =
    extractJsonObject(html, 'ytInitialPlayerResponse') ||
    extractJsonObject(html, 'var ytInitialPlayerResponse =')

  const details = player?.videoDetails || {}
  const title = String(details.title || '').trim()
  const description = String(details.shortDescription || '').trim()
  const channel = String(details.author || '').trim()
  const lengthSeconds = Number(details.lengthSeconds) || 0

  const tracks =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
  const track = pickCaptionTrack(tracks)

  let transcript = ''
  let transcriptLang = null
  if (track?.baseUrl) {
    transcript = await fetchCaptionText(track.baseUrl)
    transcriptLang = track.languageCode || null
  }

  return {
    videoId,
    watchUrl,
    title,
    description,
    channel,
    lengthSeconds,
    transcript,
    transcriptLang,
    hasCaptions: Boolean(transcript),
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  }
}
