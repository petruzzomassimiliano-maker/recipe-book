import { geminiGenerateContent, parseGeminiJson } from '../geminiClient.js'
import {
  RECIPE_JSON_SCHEMA_HINT,
  normalizeAiDraft
} from '../scrapers/geminiExtract.js'
import { STEPS_READABILITY_RULES } from '../scrapers/readableSteps.js'
import { extractYoutubeVideoId, youtubeThumbnailUrl, youtubeWatchUrl } from './ids.js'
import { fetchYoutubeVideoContext } from './transcript.js'

// Free tier: ~8h of YouTube video/day. Long videos are clipped to stay within token limits.
const VIDEO_MAX_SECONDS = 45 * 60

const COMMON_RULES = `Regole:
- Ricostruisci ingredienti (quantity/unit/name separati) e passaggi in ordine
- Lingua: italiano se il video è in italiano
- quantity: numero o "q.b."; unit vuota se q.b.; name SENZA dose
- Ignora sponsor, saluti, CTA iscriviti/like, commenti
- Se mancano tempi/porzioni, stima in modo ragionevole o usa 0 / 4`

function emptyContext(videoId, watchUrl) {
  return {
    videoId,
    watchUrl,
    title: '',
    description: '',
    channel: '',
    lengthSeconds: 0,
    isPrivate: false,
    transcript: '',
    transcriptLang: null,
    transcriptSource: 'none',
    hasCaptions: false,
    thumbnailUrl: youtubeThumbnailUrl(videoId)
  }
}

function hasRecipe(draft) {
  return Boolean(draft?.ingredients?.length && draft?.steps?.length)
}

/**
 * No captions: let Gemini watch + listen to the public video (YouTube URL as fileData).
 * Uses spoken audio AND on-screen text (ingredient cards, overlays).
 */
async function parseRecipeFromVideoWithGemini(env, { watchUrl, context }) {
  const videoPart = { fileData: { fileUri: watchUrl } }
  if (context.lengthSeconds > VIDEO_MAX_SECONDS) {
    videoPart.videoMetadata = { startOffset: '0s', endOffset: `${VIDEO_MAX_SECONDS}s` }
  }

  const prompt = `Guarda e ascolta questo video di cucina YouTube (audio parlato + testo a schermo, es. dosi in sovrimpressione).
Crea tu la trascrizione mentalmente e restituisci SOLO un JSON valido con questo schema:
${RECIPE_JSON_SCHEMA_HINT}

${COMMON_RULES}
- Usa le dosi dette a voce o mostrate a schermo; se una dose non è indicata, quantity null (non inventare)
- imageUrl: ${context.thumbnailUrl}
${STEPS_READABILITY_RULES}

${context.title ? `Titolo video: ${context.title}` : ''}
${context.channel ? `Canale: ${context.channel}` : ''}
${context.description ? `Descrizione (può contenere la lista ingredienti):\n${context.description.slice(0, 6000)}` : ''}`

  const text = await geminiGenerateContent(env, [videoPart, { text: prompt }], {
    temperature: 0.15,
    json: true,
    generationConfig: { mediaResolution: 'MEDIA_RESOLUTION_LOW' }
  })
  return normalizeAiDraft(parseGeminiJson(text), watchUrl, 'youtube')
}

async function parseRecipeFromTextWithGemini(env, { watchUrl, context, transcript, manual }) {
  const description = context.description || ''
  const sourceBlob = [
    context.title ? `Titolo video: ${context.title}` : '',
    context.channel ? `Canale: ${context.channel}` : '',
    description ? `Descrizione:\n${description.slice(0, 8000)}` : '',
    transcript
      ? `Trascrizione${manual ? ' (fornita dall’utente)' : context.transcriptLang ? ` (${context.transcriptLang})` : ''}:\n${transcript.slice(0, 20000)}`
      : ''
  ]
    .filter(Boolean)
    .join('\n\n')

  const prompt = `Sei un estrattore di ricette da video YouTube. Dal titolo, descrizione e trascrizione, restituisci SOLO un JSON valido con questo schema:
${RECIPE_JSON_SCHEMA_HINT}

${COMMON_RULES}
- imageUrl: usa questa thumbnail se non hai di meglio: ${context.thumbnailUrl}
${STEPS_READABILITY_RULES}

URL: ${watchUrl}

CONTENUTO:
${sourceBlob}`

  const text = await geminiGenerateContent(env, [{ text: prompt }], {
    temperature: 0.15,
    json: true
  })
  return normalizeAiDraft(parseGeminiJson(text), watchUrl, 'youtube')
}

/**
 * Build recipe draft from YouTube URL (+ optional manual transcript).
 * Cascade: manual transcript → captions (web / Android) → Gemini watches the video
 * → description only → ask the user to paste a transcript.
 */
export async function parseRecipeFromYoutube(env, { videoUrl, manualTranscript = null } = {}) {
  const videoId = extractYoutubeVideoId(videoUrl)
  if (!videoId) {
    const err = new Error('URL YouTube non valido')
    err.status = 400
    throw err
  }

  const watchUrl = youtubeWatchUrl(videoId)
  const manual = String(manualTranscript || '').trim()

  let context
  try {
    context = await fetchYoutubeVideoContext(videoId)
  } catch (err) {
    // Unavailable video: nothing Gemini can watch either, unless the user pasted text
    if (err.code === 'YOUTUBE_VIDEO_UNAVAILABLE' && !manual) throw err
    // Otherwise (network / bot wall): Gemini fetches the video itself, so keep going
    context = emptyContext(videoId, watchUrl)
  }

  const transcript = manual || context.transcript || ''
  const description = context.description || ''

  let draft = null
  let method = null
  let videoError = null

  if (!transcript && !context.isPrivate) {
    try {
      const videoDraft = await parseRecipeFromVideoWithGemini(env, { watchUrl, context })
      if (hasRecipe(videoDraft)) {
        draft = videoDraft
        method = 'youtube-video+gemini'
      }
    } catch (err) {
      videoError = err
      console.warn('[youtube] gemini video analysis failed:', err.message)
    }
  }

  if (!draft) {
    if (!transcript && description.length < 80) {
      const reason = videoError?.message ? ` (analisi video IA non riuscita: ${videoError.message})` : ''
      const err = new Error(
        `Nessuna trascrizione disponibile per questo video${reason}. Incolla la trascrizione (o la descrizione ricetta) nel campo opzionale e riprova.`
      )
      err.status = 422
      err.code = 'YOUTUBE_TRANSCRIPT_REQUIRED'
      err.meta = { videoId, title: context.title, thumbnailUrl: context.thumbnailUrl, watchUrl }
      throw err
    }

    draft = await parseRecipeFromTextWithGemini(env, { watchUrl, context, transcript, manual })
    method = manual
      ? 'youtube-manual-transcript+gemini'
      : transcript
        ? 'youtube-captions+gemini'
        : 'youtube-description+gemini'
  }

  if (!draft.title && context.title) draft.title = context.title
  if (!draft.imageUrl) draft.imageUrl = context.thumbnailUrl
  draft.extractMethod = method

  if (method === 'youtube-video+gemini') {
    draft.extractWarning =
      context.lengthSeconds > VIDEO_MAX_SECONDS
        ? `Nessun sottotitolo: ricetta ricavata dall’IA guardando i primi ${VIDEO_MAX_SECONDS / 60} minuti del video. Controlla dosi e passaggi.`
        : 'Nessun sottotitolo: ricetta ricavata dall’IA guardando e ascoltando il video. Controlla dosi e passaggi.'
  } else if (!transcript) {
    draft.extractWarning =
      'Ricetta stimata dalla sola descrizione del video: controlla bene ingredienti e passaggi.'
  } else if (!manual && context.transcriptLang && !String(context.transcriptLang).startsWith('it')) {
    draft.extractWarning = `Trascrizione in ${context.transcriptLang}: verifica le quantità.`
  } else {
    draft.extractWarning = null
  }

  draft.youtube = {
    videoId,
    channel: context.channel || null,
    transcriptSource: manual
      ? 'manual'
      : method === 'youtube-video+gemini'
        ? 'gemini-video'
        : context.transcriptSource || 'none',
    transcriptLang: context.transcriptLang
  }

  if (!hasRecipe(draft)) {
    const err = new Error(
      'Non sono riuscito a ricostruire una ricetta completa dal video. Prova ad incollare la trascrizione manualmente.'
    )
    err.status = 422
    err.code = 'YOUTUBE_PARSE_WEAK'
    err.meta = { draft, videoId, watchUrl }
    throw err
  }

  return draft
}
