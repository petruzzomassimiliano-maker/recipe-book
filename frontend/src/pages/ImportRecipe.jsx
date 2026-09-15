import { useNavigate } from 'react-router-dom'
import RecipeForm from '../components/recipe/RecipeForm.jsx'
import { fetchRecipeFromUrl, isYoutubeUrl, parseYoutubeRecipe } from '../services/scraper.js'
import { extractRecipeFromPhoto } from '../services/gemini.js'
import { useRecipes } from '../hooks/useRecipes.js'
import { clearDraft, draftKey, useSessionDraft } from '../hooks/useSessionDraft.js'
import { useRef, useState } from 'react'

const IMPORT_PAGE_KEY = draftKey('import-page')

function formPersistKey(url) {
  return draftKey(`recipe-form:import:${url || 'pending'}`)
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Lettura file fallita'))
    reader.readAsDataURL(file)
  })
}

export default function ImportRecipe() {
  const navigate = useNavigate()
  const { addRecipe } = useRecipes()
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
    if (!url.trim() || url.startsWith('photo:')) {
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
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
      setError('Usa una foto JPEG, PNG o WebP')
      return
    }
    if (file.size > 6 * 1024 * 1024) {
      setError('Foto troppo grande (max 6 MB)')
      return
    }
    setError(null)
    setPhotoLoading(true)
    try {
      const imageBase64 = await readFileAsBase64(file)
      const res = await extractRecipeFromPhoto({
        imageBase64,
        mimeType: file.type === 'image/jpg' ? 'image/jpeg' : file.type
      })
      applyScrape(res.data, res.data?.sourceUrl || `photo:${file.name}`)
    } catch (err) {
      setError(err.message || 'Analisi foto fallita')
    } finally {
      setPhotoLoading(false)
    }
  }

  const handleSave = async (payload) => {
    const saved = await addRecipe({
      ...payload,
      sourceUrl: scrape?.sourceUrl || (url.startsWith('photo:') ? null : url) || null,
      sourceProvider: scrape?.sourceProvider || (youtube ? 'youtube' : url.startsWith('photo:') ? 'photo' : 'website'),
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
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      <h1 className="page-title mb-2">Importa ricetta</h1>
      <p className="text-sm text-stone-500 mb-6 leading-relaxed">
        URL di un sito, video YouTube, oppure foto di una ricetta (libro / appunti). Controlla sempre
        prima di salvare.
      </p>

      {restored && (url || scrape) && (
        <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800 flex flex-wrap items-center justify-between gap-2">
          <span>Import in bozza ripristinato.</span>
          <button type="button" className="text-teal-700 font-medium hover:underline" onClick={handleDiscardAll}>
            Scarta tutto
          </button>
        </div>
      )}

      <form onSubmit={handleFetch} className="card p-6 mb-4 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-stone-700">URL sito o YouTube</span>
          <input
            className="input-field mt-1"
            type="url"
            value={url.startsWith('photo:') ? '' : url}
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
          disabled={busy || !url.trim() || url.startsWith('photo:')}
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
      </form>

      <div className="card p-6 mb-8 space-y-3">
        <h2 className="text-sm font-semibold text-stone-800">Oppure da foto</h2>
        <p className="text-xs text-stone-500">
          Scatta o carica una foto della ricetta (max 6 MB). Gemini legge ingredienti e passi.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={handlePhoto}
        />
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {photoLoading ? 'Analisi foto…' : 'Carica / scatta foto'}
        </button>
      </div>

      {scrape && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="section-title">Controlla e salva</h2>
            {scrape.extractMethod && (
              <span className="text-xs px-2 py-1 rounded-lg bg-stone-100 text-stone-600">
                via {scrape.extractMethod}
                {scrape.extractQuality?.score != null ? ` · score ${scrape.extractQuality.score}` : ''}
              </span>
            )}
          </div>
          {scrape.extractWarning && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              {scrape.extractWarning}
            </div>
          )}
          <RecipeForm
            key={scrape.sourceUrl || url || scrape.title}
            persistKey={formPersistKey(url || scrape.title)}
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
                tags: [],
                isShared: true,
                isPrivate: false
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
