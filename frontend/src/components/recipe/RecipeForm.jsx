import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useDragReorder } from '../../hooks/useDragReorder.js'
import { useSessionDraft } from '../../hooks/useSessionDraft.js'
import { readAndCompressImage, uploadRecipeImage } from '../../services/media.js'
import {
  clearRun,
  finalizeSections,
  groupKey,
  hasSections,
  inNewSection,
  insertIntoRun,
  isRunStart,
  nextSectionName,
  renameRun,
  withSectionIds
} from '../../utils/recipeSections.js'

const emptyIngredient = () => ({ name: '', quantity: '', unit: 'g', notes: '' })
const emptyStep = () => ({ instruction: '' })
/** Keep only the grouping fields of a saved item (section name / edit-time id). */
const sectionFields = (item) => ({
  ...(item?.sid ? { sid: item.sid } : {}),
  ...(item?.section ? { section: item.section } : {})
})

function SectionRunHeader({ value, sectioned, placeholder, addLabel, onRename, onAdd, onClear }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-3 first:pt-0">
      <input
        className="input-field flex-1 min-w-[10rem] !min-h-[40px] !py-1.5 font-semibold text-stone-800"
        value={value}
        onChange={(e) => onRename(e.target.value)}
        placeholder={sectioned ? placeholder : 'Senza sezione — scrivi un nome per crearne una'}
        aria-label="Nome sezione"
      />
      <button
        type="button"
        className="inline-flex items-center min-h-[40px] px-2 text-sm text-primary font-semibold"
        onClick={onAdd}
      >
        {addLabel}
      </button>
      {sectioned ? (
        <button
          type="button"
          className="inline-flex items-center min-h-[40px] px-2 text-xs text-stone-400 hover:text-stone-600"
          onClick={onClear}
          title="Gli elementi restano, ma fuori da ogni sezione"
        >
          Togli sezione
        </button>
      ) : null}
    </div>
  )
}

function DragHandle({ label, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`shrink-0 inline-flex items-center justify-center min-h-[44px] w-8 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-grab active:cursor-grabbing select-none disabled:opacity-30 disabled:cursor-default ${className}`}
      aria-label={label}
      title="Trascina per spostare (oppure frecce ↑ ↓)"
      {...props}
    >
      <svg className="w-4 h-5" viewBox="0 0 16 20" fill="currentColor" aria-hidden>
        <circle cx="5" cy="4" r="1.6" />
        <circle cx="11" cy="4" r="1.6" />
        <circle cx="5" cy="10" r="1.6" />
        <circle cx="11" cy="10" r="1.6" />
        <circle cx="5" cy="16" r="1.6" />
        <circle cx="11" cy="16" r="1.6" />
      </svg>
    </button>
  )
}

/** Shown only while dragging, below the list, when the list ends inside a section. */
function OutsideDropZone({ zone, label }) {
  if (!zone) return null
  return (
    <div
      className={`flex items-center justify-center min-h-[48px] rounded-xl border-2 border-dashed px-3 text-sm font-medium transition-colors ${
        zone.highlighted
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-stone-300 bg-stone-50 text-stone-500'
      }`}
      aria-hidden
    >
      {label}
    </div>
  )
}

/** Drop position line; absolutely positioned so it never shifts the measured layout. */
function DropLine({ edge, offset = 6 }) {
  if (!edge) return null
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-40 h-1 rounded-full bg-primary shadow-[0_0_0_2px_rgba(255,255,255,0.9)]"
      style={edge === 'before' ? { top: -offset, margin: 0 } : { bottom: -offset, margin: 0 }}
      aria-hidden
    />
  )
}

function AutoGrowTextarea({ value, onChange, className = '', minPx = 44, ...props }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, minPx)}px`
  }, [value, minPx])

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={onChange}
      className={`input-field resize-none overflow-hidden ${className}`}
      {...props}
    />
  )
}

function fromRecipe(recipe) {
  if (!recipe) {
    return {
      title: '',
      servings: 4,
      prepTime: 10,
      cookTime: 20,
      difficulty: 'easy',
      cuisine: '',
      tags: '',
      notes: '',
      imageUrl: '',
      ingredients: [emptyIngredient()],
      steps: [emptyStep()]
    }
  }
  return {
    title: recipe.title || '',
    servings: recipe.metadata?.servings || 4,
    prepTime: recipe.metadata?.prepTime || 0,
    cookTime: recipe.metadata?.cookTime || 0,
    difficulty: recipe.metadata?.difficulty || 'easy',
    cuisine: recipe.metadata?.cuisine || '',
    tags: (recipe.metadata?.tags || []).join(', '),
    notes: recipe.notes || '',
    imageUrl: recipe.imageUrl || '',
    ingredients: recipe.ingredients?.length
      ? withSectionIds(
          recipe.ingredients.map((i) => ({
            name: i.name || '',
            quantity: i.quantity ?? '',
            unit: i.unit || '',
            notes: i.notes || '',
            ...sectionFields(i)
          }))
        )
      : [emptyIngredient()],
    steps: recipe.steps?.length
      ? withSectionIds(
          recipe.steps.map((s) => ({ instruction: s.instruction || '', ...sectionFields(s) }))
        )
      : [emptyStep()]
  }
}

function FormActions({ saving, imageBusy, onCancel, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="submit"
        className="btn-primary !py-2.5 !px-5"
        disabled={saving || imageBusy}
        aria-busy={saving || imageBusy}
      >
        {saving ? 'Salvataggio…' : imageBusy ? 'Attendi foto…' : 'Salva ricetta'}
      </button>
      {onCancel && (
        <button type="button" className="btn-secondary !py-2.5 !px-5" onClick={onCancel} disabled={saving}>
          Annulla
        </button>
      )}
    </div>
  )
}

export default function RecipeForm({
  initialRecipe,
  onSubmit,
  onCancel,
  persistKey = null,
  pageTitle = null
}) {
  const getInitial = useCallback(() => fromRecipe(initialRecipe), [initialRecipe])
  const {
    value: form,
    setValue: setForm,
    restored,
    clear,
    discardRestored
  } = useSessionDraft(persistKey, getInitial)

  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState(null)
  // Local preview while uploading — never stored in the form/draft (data: URLs are huge)
  const [imagePreview, setImagePreview] = useState(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  // Drafts saved before section ids existed: give their sections an id once.
  useEffect(() => {
    if (!form) return
    const ingredients = withSectionIds(form.ingredients || [])
    const steps = withSectionIds(form.steps || [])
    if (ingredients !== form.ingredients || steps !== form.steps) {
      setForm((prev) => ({ ...prev, ingredients, steps }))
    }
  }, [form, setForm])

  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleImageFile = async (file) => {
    if (!file) return
    setImageError(null)
    setImageBusy(true)
    try {
      const { base64, mimeType, previewUrl } = await readAndCompressImage(file)
      setImagePreview(previewUrl)
      const res = await uploadRecipeImage({ imageBase64: base64, mimeType })
      const url = res.data?.imageUrl
      if (!url) throw new Error('Upload senza URL')
      update({ imageUrl: url })
    } catch (err) {
      setImageError(err.message || 'Caricamento foto fallito')
    } finally {
      setImagePreview(null)
      setImageBusy(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Il titolo è obbligatorio')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSubmit({
        title: form.title,
        servings: form.servings,
        prepTime: form.prepTime,
        cookTime: form.cookTime,
        difficulty: form.difficulty,
        cuisine: form.cuisine,
        tags: form.tags,
        notes: form.notes,
        imageUrl: (form.imageUrl.trim().startsWith('data:') ? '' : form.imageUrl.trim()) || null,
        ingredients: finalizeSections(form.ingredients),
        steps: finalizeSections(form.steps)
      })
      clear()
    } catch (err) {
      setError(err.message || 'Salvataggio non riuscito')
    } finally {
      setSaving(false)
    }
  }

  const setIngredient = (idx, patch) => {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((row, i) => (i === idx ? { ...row, ...patch } : row))
    }))
  }

  const setStep = (idx, instruction) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((row, i) => (i === idx ? { ...row, instruction } : row))
    }))
  }

  const ingredientDrag = useDragReorder(form.ingredients, (next) => update({ ingredients: next }))
  const stepDrag = useDragReorder(form.steps, (next) => update({ steps: next }))

  const ingredientsSectioned = hasSections(form.ingredients)
  const stepsSectioned = hasSections(form.steps)
  const addAtEnd = (items, item) =>
    items.length ? insertIntoRun(items, items.length - 1, item) : [item]

  const handleCancel = () => {
    clear()
    onCancel?.()
  }

  const shownImage = imagePreview || form.imageUrl.trim()

  const looksFilled =
    !!form.title?.trim() ||
    !!form.notes?.trim() ||
    !!form.imageUrl?.trim() ||
    form.ingredients?.some((i) => i.name?.trim()) ||
    form.steps?.some((s) => s.instruction?.trim())

  const sectionClass =
    'rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-6 lg:p-7 space-y-4 lg:space-y-5'
  const sectionTitleClass = 'font-display text-lg lg:text-xl font-semibold text-stone-900'
  const fieldLabelClass = 'text-sm font-medium text-stone-600'

  return (
    <form onSubmit={handleSubmit} className="space-y-6 lg:space-y-8 pb-24 sm:pb-0">
      {/* Desktop sticky action bar — long-form UX: Save reachable without scrolling to end */}
      <div className="hidden lg:flex sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-1 px-1 py-3 mb-2 items-center justify-between gap-4 bg-surface/95 backdrop-blur-md border-b border-stone-200/70">
        <div className="min-w-0">
          {pageTitle ? (
            <h1 className="font-display text-2xl font-semibold text-stone-900 truncate">{pageTitle}</h1>
          ) : (
            <p className="text-sm text-stone-500 truncate">{form.title.trim() || 'Senza titolo'}</p>
          )}
        </div>
        <FormActions saving={saving} imageBusy={imageBusy} onCancel={onCancel ? handleCancel : null} />
      </div>

      {restored && looksFilled && (
        <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800 flex flex-wrap items-center justify-between gap-2">
          <span>Bozza ripristinata — puoi continuare da dove avevi lasciato.</span>
          <button type="button" className="text-teal-700 font-medium hover:underline" onClick={discardRestored}>
            Scarta bozza
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* —— Identità: title + photo side-by-side on desktop —— */}
      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>Dettagli</h2>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.85fr)] gap-5 lg:gap-8 items-start">
          <div className="space-y-4 lg:space-y-5 min-w-0">
            <label className="block">
              <span className={fieldLabelClass}>Titolo *</span>
              <input
                className="input-field mt-1.5 lg:text-lg lg:!min-h-[52px]"
                value={form.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="Pasta alla carbonara"
                required
              />
            </label>

            {/* Related meta — 2×2 on narrow, 4 across on desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
              <label className="block min-w-0">
                <span className={fieldLabelClass}>Porzioni</span>
                <input
                  type="number"
                  min="1"
                  className="input-field mt-1.5"
                  value={form.servings}
                  onChange={(e) => update({ servings: e.target.value })}
                />
              </label>
              <label className="block min-w-0">
                <span className={fieldLabelClass}>Prep (min)</span>
                <input
                  type="number"
                  min="0"
                  className="input-field mt-1.5"
                  value={form.prepTime}
                  onChange={(e) => update({ prepTime: e.target.value })}
                />
              </label>
              <label className="block min-w-0">
                <span className={`${fieldLabelClass} whitespace-nowrap`}>Cottura (min)</span>
                <input
                  type="number"
                  min="0"
                  className="input-field mt-1.5"
                  value={form.cookTime}
                  onChange={(e) => update({ cookTime: e.target.value })}
                />
              </label>
              <label className="block min-w-0">
                <span className={fieldLabelClass}>Difficoltà</span>
                <select
                  className="input-field mt-1.5"
                  value={form.difficulty}
                  onChange={(e) => update({ difficulty: e.target.value })}
                >
                  <option value="easy">Facile</option>
                  <option value="medium">Media</option>
                  <option value="hard">Difficile</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className={fieldLabelClass}>Tag (separati da virgola)</span>
              <input
                className="input-field mt-1.5"
                value={form.tags}
                onChange={(e) => update({ tags: e.target.value })}
                placeholder="pasta, italiana, veloce"
              />
            </label>
          </div>

          {/* Photo panel — desktop side column */}
          <div className="space-y-3 lg:sticky lg:top-28">
            <span className={fieldLabelClass}>Foto ricetta</span>
            <div
              className={`relative overflow-hidden rounded-2xl border border-dashed border-stone-300 bg-stone-50 ${
                shownImage ? 'border-solid border-stone-200' : ''
              }`}
            >
              {shownImage ? (
                <img
                  key={shownImage}
                  src={shownImage}
                  alt="Anteprima ricetta"
                  className="w-full aspect-[4/3] object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div className="aspect-[4/3] flex flex-col items-center justify-center gap-2 px-4 text-center text-stone-400 text-sm">
                  <span>Nessuna foto</span>
                  <span className="text-xs">Scatta, carica o incolla un URL</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary !py-2 !px-3 text-sm"
                disabled={imageBusy}
                onClick={() => cameraInputRef.current?.click()}
              >
                Scatta
              </button>
              <button
                type="button"
                className="btn-secondary !py-2 !px-3 text-sm"
                disabled={imageBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                Carica
              </button>
              {form.imageUrl.trim() ? (
                <button
                  type="button"
                  className="inline-flex items-center min-h-[40px] px-2 text-sm text-stone-500"
                  disabled={imageBusy}
                  onClick={() => {
                    update({ imageUrl: '' })
                    setImageError(null)
                  }}
                >
                  Rimuovi
                </button>
              ) : null}
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                handleImageFile(file)
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                handleImageFile(file)
              }}
            />

            <input
              className="input-field !min-h-[40px] !py-2 text-sm"
              type="url"
              value={form.imageUrl.startsWith('data:') ? '' : form.imageUrl}
              onChange={(e) => update({ imageUrl: e.target.value })}
              placeholder="URL immagine…"
              disabled={imageBusy}
              aria-label="URL foto ricetta"
            />

            {imageBusy && (
              <p className="text-sm text-stone-500" aria-live="polite">
                Caricamento foto…
              </p>
            )}
            {imageError && (
              <p className="text-sm text-red-600" role="alert">
                {imageError}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Ingredienti | Passi — 2 colonne solo desktop (lg+); mobile in colonna */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
      <section className={sectionClass}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={sectionTitleClass}>Ingredienti</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex items-center min-h-[40px] px-2 text-sm text-stone-500 font-semibold hover:text-stone-800"
              onClick={() =>
                update({
                  ingredients: [
                    ...form.ingredients,
                    inNewSection(emptyIngredient(), nextSectionName(form.ingredients))
                  ]
                })
              }
              title="Dividi in componenti (es. Pan di Spagna, Crema…)"
            >
              + Sezione
            </button>
            <button
              type="button"
              className="inline-flex items-center min-h-[40px] px-2 text-sm text-primary font-semibold"
              onClick={() =>
                update({ ingredients: addAtEnd(form.ingredients, emptyIngredient()) })
              }
            >
              + Aggiungi
            </button>
          </div>
        </div>

        <div
          className="hidden md:grid grid-cols-[2rem_minmax(0,1fr)_5.5rem_6.5rem_2.75rem] gap-2.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400"
          aria-hidden
        >
          <span className="sr-only">Sposta</span>
          <span>Nome</span>
          <span>Qty</span>
          <span>Unità</span>
          <span className="sr-only">Rimuovi</span>
        </div>

        <div className="space-y-2">
          {form.ingredients.map((row, idx) => (
            <Fragment key={idx}>
            {ingredientsSectioned && isRunStart(form.ingredients, idx) && (
              <SectionRunHeader
                value={row.section || ''}
                sectioned={!!groupKey(row)}
                placeholder="Nome sezione (es. Pan di Spagna)"
                addLabel="+ Ingrediente"
                onRename={(name) => update({ ingredients: renameRun(form.ingredients, idx, name) })}
                onAdd={() =>
                  update({ ingredients: insertIntoRun(form.ingredients, idx, emptyIngredient()) })
                }
                onClear={() => update({ ingredients: clearRun(form.ingredients, idx) })}
              />
            )}
            <div
              ref={ingredientDrag.rowRef(idx)}
              style={ingredientDrag.rowStyle(idx)}
              className={`relative rounded-xl ${
                ingredientDrag.isDragging(idx) ? 'bg-white shadow-xl ring-1 ring-primary/30' : ''
              }`}
            >
              <DropLine edge={ingredientDrag.indicator(idx)} />
              {/* Mobile stacked */}
              <div className="md:hidden rounded-xl border border-stone-100 bg-stone-50/50 p-2.5 space-y-2">
                <div className="flex items-start gap-1.5">
                  <DragHandle
                    {...ingredientDrag.handleProps(idx)}
                    className="-ml-1"
                    disabled={form.ingredients.length < 2}
                    label={`Sposta ingrediente ${idx + 1}`}
                  />
                  <input
                    className="input-field flex-1 min-w-0"
                    placeholder="Nome ingrediente"
                    value={row.name}
                    onChange={(e) => setIngredient(idx, { name: e.target.value })}
                    aria-label={`Ingrediente ${idx + 1} nome`}
                  />
                  <button
                    type="button"
                    className="shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-stone-400 active:text-red-600 active:bg-red-50"
                    onClick={() =>
                      update({ ingredients: form.ingredients.filter((_, i) => i !== idx) })
                    }
                    disabled={form.ingredients.length === 1}
                    aria-label={`Rimuovi ingrediente ${idx + 1}`}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="input-field"
                    inputMode="decimal"
                    placeholder="Qty"
                    value={row.quantity}
                    onChange={(e) => setIngredient(idx, { quantity: e.target.value })}
                    aria-label={`Ingrediente ${idx + 1} quantità`}
                  />
                  <input
                    className="input-field"
                    placeholder="Unità"
                    value={row.unit}
                    onChange={(e) => setIngredient(idx, { unit: e.target.value })}
                    aria-label={`Ingrediente ${idx + 1} unità`}
                    list={`unit-suggestions-${idx}`}
                  />
                </div>
              </div>

              {/* Desktop: explicit 4-column grid (no display:contents) */}
              <div className="hidden md:grid grid-cols-[2rem_minmax(0,1fr)_5.5rem_6.5rem_2.75rem] gap-2.5 items-center py-2 border-b border-stone-100">
                <DragHandle
                  {...ingredientDrag.handleProps(idx)}
                  disabled={form.ingredients.length < 2}
                  label={`Sposta ingrediente ${idx + 1}`}
                />
                <input
                  className="input-field !min-h-[44px] !py-2 min-w-0 !w-full"
                  placeholder="Nome ingrediente"
                  value={row.name}
                  onChange={(e) => setIngredient(idx, { name: e.target.value })}
                  aria-label={`Ingrediente ${idx + 1} nome`}
                />
                <input
                  className="input-field !min-h-[44px] !py-2 !w-full"
                  inputMode="decimal"
                  placeholder="Qty"
                  value={row.quantity}
                  onChange={(e) => setIngredient(idx, { quantity: e.target.value })}
                  aria-label={`Ingrediente ${idx + 1} quantità`}
                />
                <input
                  className="input-field !min-h-[44px] !py-2 !w-full"
                  placeholder="Unità"
                  value={row.unit}
                  onChange={(e) => setIngredient(idx, { unit: e.target.value })}
                  aria-label={`Ingrediente ${idx + 1} unità`}
                  list={`unit-suggestions-${idx}`}
                />
                <button
                  type="button"
                  className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] justify-self-center rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50"
                  onClick={() =>
                    update({ ingredients: form.ingredients.filter((_, i) => i !== idx) })
                  }
                  disabled={form.ingredients.length === 1}
                  aria-label={`Rimuovi ingrediente ${idx + 1}`}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                    <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <datalist id={`unit-suggestions-${idx}`}>
                <option value="g" />
                <option value="kg" />
                <option value="ml" />
                <option value="l" />
                <option value="cucchiaio" />
                <option value="cucchiaino" />
                <option value="pz" />
              </datalist>
            </div>
            </Fragment>
          ))}
        </div>
        <OutsideDropZone zone={ingredientDrag.outsideZone} label="Rilascia qui per togliere l’ingrediente dalla sezione" />
      </section>

      <section className={sectionClass}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={sectionTitleClass}>Passi</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex items-center min-h-[40px] px-2 text-sm text-stone-500 font-semibold hover:text-stone-800"
              onClick={() =>
                update({ steps: [...form.steps, inNewSection(emptyStep(), nextSectionName(form.steps))] })
              }
              title="Dividi il procedimento per componente"
            >
              + Sezione
            </button>
            <button
              type="button"
              className="inline-flex items-center min-h-[40px] px-2 text-sm text-primary font-semibold"
              onClick={() => update({ steps: addAtEnd(form.steps, emptyStep()) })}
            >
              + Aggiungi
            </button>
          </div>
        </div>

        <div className="space-y-3 lg:space-y-4">
          {form.steps.map((row, idx) => (
            <Fragment key={idx}>
            {stepsSectioned && isRunStart(form.steps, idx) && (
              <SectionRunHeader
                value={row.section || ''}
                sectioned={!!groupKey(row)}
                placeholder="Nome sezione (es. Crema al burro)"
                addLabel="+ Passo"
                onRename={(name) => update({ steps: renameRun(form.steps, idx, name) })}
                onAdd={() => update({ steps: insertIntoRun(form.steps, idx, emptyStep()) })}
                onClear={() => update({ steps: clearRun(form.steps, idx) })}
              />
            )}
            <div
              ref={stepDrag.rowRef(idx)}
              style={stepDrag.rowStyle(idx)}
              className={`relative rounded-xl border border-stone-100 p-3 lg:p-4 space-y-2 ${
                stepDrag.isDragging(idx) ? 'bg-white shadow-xl ring-1 ring-primary/30' : 'bg-stone-50/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <DragHandle
                    {...stepDrag.handleProps(idx)}
                    className="-ml-1.5"
                    disabled={form.steps.length < 2}
                    label={`Sposta passo ${idx + 1}`}
                  />
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    {idx + 1}
                  </span>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center min-h-[40px] min-w-[40px] rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50"
                  onClick={() => update({ steps: form.steps.filter((_, i) => i !== idx) })}
                  disabled={form.steps.length === 1}
                  aria-label={`Rimuovi passo ${idx + 1}`}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                    <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <AutoGrowTextarea
                className="w-full min-h-[72px] lg:min-h-[88px] leading-[1.65] text-base"
                minPx={72}
                placeholder="Cosa fare in questo passo…"
                value={row.instruction}
                onChange={(e) => setStep(idx, e.target.value)}
                aria-label={`Passo ${idx + 1}`}
              />
              <DropLine edge={stepDrag.indicator(idx)} offset={8} />
            </div>
            </Fragment>
          ))}
        </div>
        <OutsideDropZone zone={stepDrag.outsideZone} label="Rilascia qui per togliere il passo dalla sezione" />
      </section>
      </div>

      {/* —— Note —— */}
      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>Note</h2>
        <textarea
          className="input-field min-h-[100px] lg:min-h-[120px]"
          value={form.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Consigli, varianti, allergie…"
          aria-label="Note"
        />
      </section>

      {/* Mobile sticky actions — desktop uses top bar + this as secondary */}
      <div className="action-row form-sticky-actions sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:static z-10 bg-surface/95 backdrop-blur-sm py-3 -mx-1 px-1 sm:bg-transparent sm:backdrop-blur-none sm:py-0 lg:pt-2">
        <FormActions
          saving={saving}
          imageBusy={imageBusy}
          onCancel={onCancel ? handleCancel : null}
          className="w-full sm:w-auto flex-nowrap [&_button]:flex-1 sm:[&_button]:flex-none"
        />
      </div>
    </form>
  )
}
