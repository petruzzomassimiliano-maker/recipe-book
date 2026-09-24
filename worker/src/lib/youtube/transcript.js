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
  // format 1: <text …>…</text> · format 3 (Android/innertube): <p t d><s>…</s></p>
  const re = /<(text|p)\b[^>]*>([\s\S]*?)<\/\1>/gi
  let m
  while ((m = re.exec(xml))) {
    const line = decodeXmlEntities(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
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

async function fetchCaptionText(baseUrl, userAgent = UA) {
  // Prefer json3; fall back to XML
  const base = String(baseUrl).replace(/([?&])fmt=[^&]*&?/, '$1').replace(/[?&]$/, '')
  const jsonUrl = `${base}${base.includes('?') ? '&' : '?'}fmt=json3`
  try {
    const res = await fetch(jsonUrl, { headers: { 'User-Agent': userAgent } })
    if (res.ok) {
      const raw = await res.text()
      if (raw.trim()) {
        const text = parseTranscriptJson3(JSON.parse(raw))
        if (text.length > 40) return text
      }
    }
  } catch {
    // continue
  }

  try {
    const res = await fetch(base, { headers: { 'User-Agent': userAgent } })
    if (!res.ok) return ''
    return parseTranscriptXml(await res.text())
  } catch {
    return ''
  }
}

// Web caption URLs now need a PO token and return an empty body server-side.
// The Android client still gets directly downloadable caption tracks.
const ANDROID_CLIENT_VERSION = '20.10.38'
const ANDROID_UA = `com.google.android.youtube/${ANDROID_CLIENT_VERSION} (Linux; U; Android 11) gzip`

async function fetchAndroidPlayer(videoId) {
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': ANDROID_UA },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: ANDROID_CLIENT_VERSION,
            androidSdkVersion: 30,
            hl: 'it',
            gl: 'IT'
          }
        },
        videoId
      })
    })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

async function fetchWatchPagePlayer(watchUrl) {
  try {
    const res = await fetch(`${watchUrl}&hl=it&gl=IT`, {
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
        Accept: 'text/html'
      }
    })
    if (!res.ok) return { player: null, status: res.status }
    const html = await res.text()
    const player =
      extractJsonObject(html, 'ytInitialPlayerResponse') ||
      extractJsonObject(html, 'var ytInitialPlayerResponse =')
    return { player, status: res.status }
  } catch {
    return { player: null, status: 0 }
  }
}

/** Public oEmbed: title + channel even when the player is behind a bot check. */
async function fetchOembed(watchUrl) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
      { headers: { 'User-Agent': UA } }
    )
    if (!res.ok) return { ok: false, status: res.status }
    const data = await res.json().catch(() => null)
    return data ? { ok: true, title: data.title, channel: data.author_name } : { ok: false, status: res.status }
  } catch {
    return { ok: false, status: 0 }
  }
}

function captionTracksOf(player) {
  return player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []
}

/**
 * Fetch title, description, thumbnail hints + auto captions when available.
 * Captions: watch page tracks → Android client tracks.
 */
export async function fetchYoutubeVideoContext(videoId) {
  const watchUrl = youtubeWatchUrl(videoId)
  const web = await fetchWatchPagePlayer(watchUrl)
  let android = null

  let transcript = ''
  let transcriptLang = null
  let transcriptSource = 'none'

  const webTrack = pickCaptionTrack(captionTracksOf(web.player))
  if (webTrack?.baseUrl) {
    transcript = await fetchCaptionText(webTrack.baseUrl)
    if (transcript) {
      transcriptLang = webTrack.languageCode || null
      transcriptSource = 'captions'
    }
  }

  if (!transcript || !web.player?.videoDetails) {
    android = await fetchAndroidPlayer(videoId)
  }

  if (!transcript) {
    const androidTrack = pickCaptionTrack(captionTracksOf(android))
    if (androidTrack?.baseUrl) {
      transcript = await fetchCaptionText(androidTrack.baseUrl, ANDROID_UA)
      if (transcript) {
        transcriptLang = androidTrack.languageCode || null
        transcriptSource = 'captions-android'
      }
    }
  }

  let details = web.player?.videoDetails || android?.videoDetails || null
  if (!details) {
    const oembed = await fetchOembed(watchUrl)
    if (!oembed.ok) {
      const err = new Error(
        oembed.status === 401 || oembed.status === 403 || oembed.status === 404
          ? 'Video YouTube privato, rimosso o non incorporabile'
          : `YouTube non raggiungibile (${web.status || oembed.status || 'rete'})`
      )
      err.status = oembed.status === 404 ? 404 : 502
      err.code = oembed.status === 404 || oembed.status === 401 ? 'YOUTUBE_VIDEO_UNAVAILABLE' : undefined
      throw err
    }
    details = { title: oembed.title, author: oembed.channel, shortDescription: '', lengthSeconds: 0 }
  }

  // "Confirm you're not a bot" is also LOGIN_REQUIRED: only a real private video counts.
  const reasons = [web.player?.playabilityStatus?.reason, android?.playabilityStatus?.reason]
    .filter(Boolean)
    .join(' ')

  return {
    videoId,
    watchUrl,
    title: String(details.title || '').trim(),
    description: String(details.shortDescription || '').trim(),
    channel: String(details.author || '').trim(),
    lengthSeconds: Number(details.lengthSeconds) || 0,
    isPrivate: Boolean(details.isPrivate) || /\bprivat[oe]\b|\bprivate video\b/i.test(reasons),
    transcript,
    transcriptLang,
    transcriptSource,
    hasCaptions: Boolean(transcript),
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  }
}
