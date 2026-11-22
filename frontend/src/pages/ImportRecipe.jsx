import { Link, useNavigate } from 'react-router-dom'
import RecipeForm from '../components/recipe/RecipeForm.jsx'
import { fetchRecipeFromUrl, isYoutubeUrl, parseYoutubeRecipe } from '../services/scraper.js'
import { extractRecipeFromPhoto } from '../services/gemini.js'
import { readAndCompressImage } from '../services/media.js'
import { useRecipes } from '../hooks/useRecipes.js'
import { clearDraft, draftKey, useSessionDraft } from '../hooks/useSessionDraft.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { listRecipes } from '../services/recipes.js'
import { useRecipeStore } from '../store/recipeStore.js'
import { findDuplicates } from '../utils/duplicates.js'

/** "Questa ricetta c'è già" — links to the existing one(s). */
function DuplicateNotice({ matches }) {
  if (!matches?.length) return null
  const same = matches.some((m) => m.reason === 'same')
  return (
    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900" role="status">
      <p className="font-semibold">
        {same ? 'Questa ricetta è già nel ricettario:' : 'Nel ricettario c’è già una ricetta simile:'}
      </p>
      <ul className="mt-1 space-y-0.5">
        {matches.map(({ recipe }) => (
          <li key={recipe.id}>
            <Link to={`/recipes/${recipe.id}`} target="_blank" rel="noreferrer" className="underline font-medium">
              {recipe.title}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-amber-800">Puoi salvarla lo stesso se è una versione diversa.</p>
    </div>
  )
}

const IMPORT_PAGE_KEY = draftKey('import-page')

function formPersistKey(url) {
  return draftKey(`recipe-form:import:${url || 'pending'}`)
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(new Error('Lettura file fallita'))
    reader.readAsDataURL(file)
  })
}

const MAX_PDF_BYTES = 10 * 1024 * 1024

function isPdf(file) {
  return file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '')
}

export default function ImportRecipe() {
  const navigate = useNavigate()
  const { addRecipe } = useRecipes()
  const cameraRef = useRef(null)
  const fileRef = useRef(null)
  const {
    value: page,
    setValue: setPage,
    restored,
    clear: clearPage,
    discardRestored
  } = useSessionDraft(IMPORT_PAGE_KEY, {
    url: '',
    scrape: null,
    manualTranscript: '',
    needTranscript: false
  })

  const [urlLoading, setUrlLoading] = useState(false)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [error, setError] = useState(null)
  const busy = urlLoading || photoLoading

  const url = page.url || ''
  const scrape = page.scrape
  const manualTranscript = page.manualTranscript || ''
  const needTranscript = Boolean(page.needTranscript)
  const youtube = isYoutubeUrl(url)
  const fromFile = /^(photo|pdf):/.test(url)

  // Full list for the duplicate check (the store may hold only the last search)
  const [allRecipes, setAllRecipes] = useState(() => useRecipeStore.getState().recipes || [])
  useEffect(() => {
    listRecipes('')
      .then((res) => setAllRecipes(res.data || []))
      .catch(() => {})
  }, [])
  const urlDuplicates = useMemo(
    () => (!scrape && !fromFile && url ? findDuplicates({ sourceUrl: url }, allRecipes) : []),
    [scrape, fromFile, url, allRecipes]
  )
  const scrapeDuplicates = useMemo(
    () =>
      scrape
        ? findDuplicates({ sourceUrl: fromFile ? null : scrape.sourceUrl || url, title: scrape.title }, allRecipes)
        : [],
    [scrape, fromFile, url, allRecipes]
  )

  const applyScrape = (data, sourceUrl) => {
    const nextScrape = {
      ...data,
      tags: '',
      ingredients: data.ingredients?.length
        ? data.ingredients
        : [{ name: '', quantity: '', unit: 'g', notes: '' }],
      steps: data.steps?.length ? data.steps : [{ instruction: '' }]
    }
    clearDraft(formPersistKey(sourceUrl))
    setPage((prev) => ({
      ...prev,
      url: sourceUrl || prev.url,
      scrape: nextScrape,
      needTranscript: false
    }))
  }

  const handleFetch = async (e) => {
    e.preventDefault()
    if (!url.trim() || fromFile) {
      setError('Incolla un URL di ricetta o un video YouTube')
      return
    }
    setError(null)
    setUrlLoading(true)
    try {
      const trimmed = url.trim()
      if (isYoutubeUrl(trimmed)) {
        const res = await parseYoutubeRecipe(trimmed, manualTranscript.trim() || undefined)
        applyScrape(res.data, trimmed)
      } else {
        const res = await fetchRecipeFromUrl(trimmed)
        applyScrape(res.data, trimmed)
      }
    } catch (err) {
      const msg = err.message || 'Import fallito'
      setError(msg)
      if (isYoutubeUrl(url) && /trascrizione|transcript|YOUTUBE_TRANSCRIPT/i.test(msg)) {
        setPage((prev) => ({ ...prev, needTranscript: true }))
      }
    } finally {
      setUrlLoading(false)
    }
  }

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const pdf = isPdf(file)
    if (!pdf && file.type && !file.type.startsWith('image/')) {
      setError('Scegli una foto o un PDF')
      return
    }
    if (pdf && file.size > MAX_PDF_BYTES) {
      setError('PDF troppo grande (max 10 MB)')
      return
    }
    setError(null)
    setPhotoLoading(true)
    try {
      let payload
      if (pdf) {
        payload = { imageBase64: await readFileAsBase64(file), mimeType: 'application/pdf' }
      } else {
        // Resize before upload: phone photos easily exceed the Worker limit as base64.
        // 2000px keeps small recipe text legible for Gemini.
        const { base64, mimeType } = await readAndCompressImage(file, { maxEdge: 2000, quality: 0.85 })
        payload = { imageBase64: base64, mimeType }
      }
      const res = await extractRecipeFromPhoto(payload)
      applyScrape(res.data, res.data?.sourceUrl || `${pdf ? 'pdf' : 'photo'}:${file.name}`)
    } catch (err) {
      setError(err.message || (pdf ? 'Analisi PDF fallita' : 'Analisi foto fallita'))
    } finally {
      setPhotoLoading(false)
    }
  }

  const handleSave = async (payload) => {
    const saved = await addRecipe({
      ...payload,
      sourceUrl: scrape?.sourceUrl || (fromFile ? null : url) || null,
      sourceProvider:
        scrape?.sourceProvider ||
        (youtube ? 'youtube' : url.startsWith('pdf:') ? 'pdf' : url.startsWith('photo:') ? 'photo' : 'website'),
      imageUrl: payload.imageUrl || scrape?.imageUrl || null
    })
    clearDraft(formPersistKey(url))
    clearPage()
    navigate(`/recipes/${saved.id}`)
  }

  const handleDiscardImport = () => {
    clearDraft(formPersistKey(url))
    setPage((prev) => ({ ...prev, scrape: null }))
  }

  const handleDiscardAll = () => {
    clearDraft(formPersistKey(url))
    discardRestored()
  }

  return (
    <main className="max-w-3xl lg:max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 animate-fade-in">
      <h1 className="page-title mb-2 lg:hidden">Importa ricetta</h1>
      <p className="text-sm text-stone-500 mb-6 leading-relaxed lg:mt-0">
        URL di un sito, video YouTube, oppure foto di una ricetta (libro / appunti). Controlla sempre
        prima di salvare.
      </p>

      {/* Desktop sticky title when form is open */}
      {scrape ? (
        <h1 className="hidden lg:block font-display text-2xl font-semibold text-stone-900 mb-4">
          Controlla e salva
        </h1>
      ) : (
        <h1 className="hidden lg:block page-title mb-4">Importa ricetta</h1>
      )}

      {restored && (url || scrape) && (
        <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800 flex flex-wrap items-center justify-between gap-2">
          <span>Import in bozza ripristinato.</span>
          <button type="button" className="text-teal-700 font-medium hover:underline" onClick={handleDiscardAll}>
            Scarta tutto
          </button>
        </div>
      )}

      {!scrape && (
        <>
          <div className="max-w-3xl">
            <DuplicateNotice matches={urlDuplicates} />
          </div>
          <form onSubmit={handleFetch} className="card p-5 sm:p-6 mb-4 space-y-4 max-w-3xl">
            <label className="block">
              <span className="text-sm font-medium text-stone-700">URL sito o YouTube</span>
              <input
                className="input-field mt-1"
                type="url"
                value={fromFile ? '' : url}
                onChange={(e) =>
                  setPage((prev) => ({
                    ...prev,
                    url: e.target.value,
                    needTranscript: false
                  }))
                }
                placeholder="https://www.youtube.com/watch?v=… oppure ricetta da sito"
              />
            </label>

            {youtube && (
              <div className="rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2 text-xs text-stone-600">
                Rilevato video YouTube → estrazione da trascrizione / descrizione
              </div>
            )}

            {(youtube || needTranscript) && (
              <label className="block">
                <span className="text-sm font-medium text-stone-700">
                  Trascrizione manuale {needTranscript ? '(richiesta)' : '(opzionale)'}
                </span>
                <textarea
                  className="input-field mt-1 min-h-[120px] font-mono text-sm"
                  value={manualTranscript}
                  onChange={(e) => setPage((prev) => ({ ...prev, manualTranscript: e.target.value }))}
                  placeholder="Se non ci sono sottotitoli automatici, incolla qui la trascrizione o la ricetta dal video…"
                />
              </label>
            )}

            {error && (
              <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}
            <button
              type="submit"
              className="btn-primary"
              disabled={busy || !url.trim() || fromFile}
              aria-busy={urlLoading}
            >
              {urlLoading
                ? youtube
                  ? 'Analisi video…'
                  : 'Estrazione da URL…'
                : youtube
                  ? 'Estrai da YouTube'
                  : 'Estrai da URL'}
            </button>
            {urlLoading && youtube && (
              <p className="text-xs text-stone-500" aria-live="polite">
                Se il video non ha sottotitoli l’IA lo guarda e lo ascolta: può servire fino a un minuto.
              </p>
            )}
          </form>

          <div className="card p-5 sm:p-6 mb-8 space-y-3 max-w-3xl">
            <h2 className="text-sm font-semibold text-stone-800">Oppure da foto o PDF</h2>
            <p className="text-xs text-stone-500">
              Scatta una foto della ricetta (libro, quaderno, schermo) o scegli un’immagine / un PDF
              (max 10 MB). Gemini legge ingredienti e passi.
            </p>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhoto}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf,.pdf"
              className="hidden"
              onChange={handlePhoto}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => cameraRef.current?.click()}
              >
                Scatta foto
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                Scegli foto o PDF
              </button>
            </div>
            {photoLoading && (
              <p className="text-xs text-stone-500" aria-live="polite">
                Analisi in corso… può servire qualche decina di secondi.
              </p>
            )}
          </div>
        </>
      )}

      {scrape && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 lg:hidden">
            <h2 className="section-title">Controlla e salva</h2>
            {scrape.extractMethod && (
              <span className="text-xs px-2 py-1 rounded-lg bg-stone-100 text-stone-600">
                via {scrape.extractMethod}
                {scrape.extractQuality?.score != null ? ` · score ${scrape.extractQuality.score}` : ''}
              </span>
            )}
          </div>
          {scrape.extractMethod && (
            <p className="hidden lg:block text-sm text-stone-500 mb-4">
              via {scrape.extractMethod}
              {scrape.extractQuality?.score != null ? ` · score ${scrape.extractQuality.score}` : ''}
            </p>
          )}
          <DuplicateNotice matches={scrapeDuplicates} />
          {scrape.extractWarning && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              {scrape.extractWarning}
            </div>
          )}
          <RecipeForm
            key={scrape.sourceUrl || url || scrape.title}
            persistKey={formPersistKey(url || scrape.title)}
            pageTitle="Controlla e salva"
            initialRecipe={{
              title: scrape.title,
              notes: scrape.notes,
              imageUrl: scrape.imageUrl || '',
              ingredients: scrape.ingredients,
              steps: scrape.steps,
              metadata: {
                servings: scrape.servings,
                prepTime: scrape.prepTime,
                cookTime: scrape.cookTime,
                difficulty: scrape.difficulty,
                cuisine: scrape.cuisine,
                tags: []
              }
            }}
            onSubmit={handleSave}
            onCancel={handleDiscardImport}
          />
        </>
      )}
    </main>
  )
}
