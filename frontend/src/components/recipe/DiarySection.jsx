import { useRef, useState } from 'react'
import { readAndCompressImage, uploadRecipeImage } from '../../services/media.js'
import { addDiaryEntry, deleteDiaryEntry } from '../../services/recipes.js'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number)
  if (!y) return iso
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
}

function Stars({ value, onChange = null, size = 'w-5 h-5' }) {
  return (
    <span className="inline-flex items-center" role={onChange ? 'radiogroup' : undefined} aria-label={onChange ? 'Voto' : `Voto ${value} su 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value
        const star = (
          <svg className={size} viewBox="0 0 24 24" aria-hidden fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6">
            <path strokeLinejoin="round" d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9L12 3.5z" />
          </svg>
        )
        if (!onChange) {
          return (
            <span key={n} className={on ? 'text-amber-500' : 'text-stone-300'}>
              {star}
            </span>
          )
        }
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} su 5`}
            className={`inline-flex items-center justify-center min-h-[44px] min-w-[40px] ${on ? 'text-amber-500' : 'text-stone-300'}`}
            onClick={() => onChange(value === n ? 0 : n)}
          >
            {star}
          </button>
        )
      })}
    </span>
  )
}

/**
 * "Diario": each time the recipe was made — date, rating, note, photo.
 * Writing needs the family PIN (`withEdit`).
 */
export default function DiarySection({ id, recipe, onRecipeChange, withEdit }) {
  const entries = recipe.diary || []
  const [formOpen, setFormOpen] = useState(false)
  const [date, setDate] = useState(today)
  const [rating, setRating] = useState(0)
  const [note, setNote] = useState('')
  const [photoUrl, setPhotoUrl] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const reset = () => {
    setDate(today())
    setRating(0)
    setNote('')
    setPhotoUrl(null)
    setPreview(null)
    setError(null)
  }

  const onPhoto = async (file) => {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const { base64, mimeType, previewUrl } = await readAndCompressImage(file, { maxEdge: 1280 })
      setPreview(previewUrl)
      const res = await uploadRecipeImage({ imageBase64: base64, mimeType })
      setPhotoUrl(res.data?.imageUrl || null)
    } catch (err) {
      setPreview(null)
      setError(err.message || 'Foto non caricata')
    } finally {
      setBusy(false)
    }
  }

  const save = withEdit(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await addDiaryEntry(recipe.id, { date, rating, note, photoUrl })
      onRecipeChange(res.data)
      setFormOpen(false)
      reset()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  })

  const remove = withEdit(async (entry) => {
    if (!window.confirm(`Eliminare la voce del ${formatDate(entry.date)}?`)) return
    try {
      const res = await deleteDiaryEntry(recipe.id, entry.id)
      onRecipeChange(res.data)
    } catch (err) {
      setError(err.message)
    }
  })

  const avg = entries.filter((e) => e.rating).reduce((acc, e, _, arr) => acc + e.rating / arr.length, 0)

  return (
    <section id={id} className="rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-6 scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Diario</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {entries.length
              ? `Fatta ${entries.length} ${entries.length === 1 ? 'volta' : 'volte'}${
                  avg ? ` · voto medio ${avg.toFixed(1).replace('.', ',')}` : ''
                }`
              : 'Annota quando la fate: data, voto, foto e cosa cambiare la prossima volta.'}
          </p>
        </div>
        {!formOpen && (
          <button
            type="button"
            className="btn-secondary !py-2.5 !px-4 text-sm"
            onClick={withEdit(() => {
              reset()
              setFormOpen(true)
            })}
          >
            + L’ho fatta
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {formOpen && (
        <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50/60 p-3 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm">
              <span className="block text-stone-600 mb-1">Quando</span>
              <input
                type="date"
                className="input-field !min-h-[44px] !py-2"
                value={date}
                max={today()}
                onChange={(e) => setDate(e.target.value || today())}
              />
            </label>
            <div className="text-sm">
              <span className="block text-stone-600 mb-0.5">Com’è venuta</span>
              <Stars value={rating} onChange={setRating} size="w-7 h-7" />
            </div>
          </div>
          <label className="block text-sm">
            <span className="block text-stone-600 mb-1">Note</span>
            <textarea
              className="input-field min-h-[80px]"
              value={note}
              maxLength={2000}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Es. meno sale, 5 minuti in più di forno, raddoppiare la crema…"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {preview || photoUrl ? (
              <img src={preview || photoUrl} alt="" className="w-20 h-20 rounded-xl object-cover border border-stone-200" />
            ) : null}
            <button type="button" className="btn-secondary !py-2 !px-3 text-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              {photoUrl ? 'Cambia foto' : 'Aggiungi foto'}
            </button>
            {photoUrl && (
              <button
                type="button"
                className="text-xs text-stone-400 hover:text-stone-600 min-h-[40px]"
                onClick={() => {
                  setPhotoUrl(null)
                  setPreview(null)
                }}
              >
                Togli foto
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                withEdit(() => onPhoto(file))()
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="btn-primary !py-2.5 !px-5 text-sm" onClick={save} disabled={busy}>
              {busy ? 'Attendi…' : 'Salva nel diario'}
            </button>
            <button type="button" className="btn-secondary !py-2.5 !px-4 text-sm" onClick={() => setFormOpen(false)} disabled={busy}>
              Annulla
            </button>
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <ol className="mt-4 space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-3 border-t border-stone-100 pt-3 first:border-t-0 first:pt-0">
              {entry.photoUrl ? (
                <a href={entry.photoUrl} target="_blank" rel="noreferrer" className="shrink-0">
                  <img src={entry.photoUrl} alt="" loading="lazy" className="w-16 h-16 rounded-xl object-cover border border-stone-200" />
                </a>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold text-stone-800">{formatDate(entry.date)}</span>
                  {entry.rating ? <Stars value={entry.rating} size="w-4 h-4" /> : null}
                </div>
                {entry.note ? (
                  <p className="mt-1 text-[15px] leading-relaxed text-stone-600 whitespace-pre-line">{entry.note}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="shrink-0 self-start inline-flex items-center justify-center min-h-[40px] min-w-[40px] rounded-lg text-stone-300 hover:text-red-600 hover:bg-red-50"
                onClick={() => remove(entry)}
                aria-label={`Elimina voce del ${formatDate(entry.date)}`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
