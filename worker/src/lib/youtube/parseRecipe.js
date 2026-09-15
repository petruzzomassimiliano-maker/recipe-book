import { geminiGenerateContent, parseGeminiJson } from '../geminiClient.js'
import {
  RECIPE_JSON_SCHEMA_HINT,
  normalizeAiDraft
} from '../scrapers/geminiExtract.js'
import { STEPS_READABILITY_RULES } from '../scrapers/readableSteps.js'
import { extractYoutubeVideoId, youtubeThumbnailUrl, youtubeWatchUrl } from './ids.js'
import { fetchYoutubeVideoContext } from './transcript.js'

/**
 * Build recipe draft from YouTube URL (+ optional manual transcript).
 */
export async function parseRecipeFromYoutube(env, { videoUrl, manualTranscript = null } = {}) {
  const videoId = extractYoutubeVideoId(videoUrl)
  if (!videoId) {
    const err = new Error('URL YouTube non valido')
    err.status = 400
    throw err
  }

  const watchUrl = youtubeWatchUrl(videoId)
  let context
  try {
    context = await fetchYoutubeVideoContext(videoId)
  } catch (err) {
    // Soft fallback: still allow manual transcript + Gemini
    context = {
      videoId,
      watchUrl,
      title: '',
      description: '',
      channel: '',
      lengthSeconds: 0,
      transcript: '',
      transcriptLang: null,
      hasCaptions: false,
      thumbnailUrl: youtubeThumbnailUrl(videoId)
    }
    if (!String(manualTranscript || '').trim()) throw err
  }

  const manual = String(manualTranscript || '').trim()
  const transcript = manual || context.transcript || ''
  const description = context.description || ''

  if (!transcript && description.length < 80) {
    const err = new Error(
      'Nessuna trascrizione disponibile per questo video. Incolla la trascrizione (o la descrizione ricetta) nel campo opzionale e riprova.'
    )
    err.status = 422
    err.code = 'YOUTUBE_TRANSCRIPT_REQUIRED'
    err.meta = {
      videoId,
      title: context.title,
      thumbnailUrl: context.thumbnailUrl,
      watchUrl
    }
    throw err
  }

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

Regole:
- Ricostruisci ingredienti (quantity/unit/name separati) e passaggi in ordine
- Lingua: italiano se il video è in italiano
- quantity: numero o "q.b."; unit vuota se q.b.; name SENZA dose
- Ignora sponsor, saluti, CTA iscriviti/like, commenti
- Se mancano tempi/porzioni, stima in modo ragionevole o usa 0 / 4
- imageUrl: usa questa thumbnail se non hai di meglio: ${context.thumbnailUrl}
${STEPS_READABILITY_RULES}

URL: ${watchUrl}

CONTENUTO:
${sourceBlob}`

  const text = await geminiGenerateContent(env, [{ text: prompt }], {
    temperature: 0.15,
    json: true
  })
  const parsed = parseGeminiJson(text)
  const draft = normalizeAiDraft(parsed, watchUrl, 'youtube')

  if (!draft.title && context.title) draft.title = context.title
  if (!draft.imageUrl) draft.imageUrl = context.thumbnailUrl
  draft.extractMethod = manual
    ? 'youtube-manual-transcript+gemini'
    : transcript && context.hasCaptions
      ? 'youtube-captions+gemini'
      : 'youtube-description+gemini'
  draft.extractWarning = !transcript
    ? 'Ricetta stimata dalla sola descrizione del video: controlla bene ingredienti e passaggi.'
    : manual
      ? null
      : context.transcriptLang && !String(context.transcriptLang).startsWith('it')
        ? `Trascrizione in ${context.transcriptLang}: verifica le quantità.`
        : null
  draft.youtube = {
    videoId,
    channel: context.channel || null,
    transcriptSource: manual ? 'manual' : context.hasCaptions ? 'captions' : 'none',
    transcriptLang: context.transcriptLang
  }

  if (!draft.ingredients.length || !draft.steps.length) {
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
