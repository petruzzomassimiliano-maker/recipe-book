import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth.js'
import { useSessionDraft } from '../../hooks/useSessionDraft.js'
import { listUsers } from '../../services/users.js'
import { readAndCompressImage, uploadRecipeImage } from '../../services/media.js'
import {
  hasSections,
  insertIntoRun,
  isRunStart,
  nextSectionName,
  renameRun,
  sectionOf
} from '../../utils/recipeSections.js'

const withOptionalSection = (item, section) => (section ? { ...item, section } : item)
const emptyIngredient = (section = '') =>
  withOptionalSection({ name: '', quantity: '', unit: 'g', notes: '' }, section)
const emptyStep = (section = '') => withOptionalSection({ instruction: '' }, section)

function SectionRunHeader({ value, placeholder, addLabel, onRename, onAdd, onClear }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-3 first:pt-0">
      <input
        className="input-field flex-1 min-w-[10rem] !min-h-[40px] !py-1.5 font-semibold text-stone-800"
        value={value}
        onChange={(e) => onRename(e.target.value)}
        placeholder={placeholder}
        aria-label="Nome sezione"
      />
      <button
        type="button"
        className="inline-flex items-center min-h-[40px] px-2 text-sm text-primary font-semibold"
        onClick={onAdd}
      >
        {addLabel}
      </button>
      {value ? (
        <button
          type="button"
          className="inline-flex items-center min-h-[40px] px-2 text-xs text-stone-400 hover:text-stone-600"
          onClick={onClear}
        >
          Togli titolo
        </button>
      ) : null}
    </div>
  )
}

function authorUserIdFromRecipe(recipe) {
  const author = recipe?.author
  if (typeof author === 'string' && author.startsWith('user-')) {
    return author.slice(5)
  }
  return null
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

function fromRecipe(recipe, defaultAssignToUserId) {
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
      isPrivate: false,
      imageUrl: '',
      assignToUserId: defaultAssignToUserId || '',
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
    isPrivate: !!recipe.metadata?.isPrivate || recipe.metadata?.isShared === false,
    imageUrl: recipe.imageUrl || '',
    assignToUserId: authorUserIdFromRecipe(recipe) || defaultAssignToUserId || '',
    ingredients: recipe.ingredients?.length
      ? recipe.ingredients.map((i) =>
          withOptionalSection(
            {
              name: i.name || '',
              quantity: i.quantity ?? '',
              unit: i.unit || '',
              notes: i.notes || ''
            },
            sectionOf(i)
          )
        )
      : [emptyIngredient()],
    steps: recipe.steps?.length
      ? recipe.steps.map((s) => withOptionalSection({ instruction: s.instruction || '' }, sectionOf(s)))
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
  const { user, isStaff } = useAuth()
  const myId = user?.id || user?.userId || ''
  const getInitial = useCallback(
    () => fromRecipe(initialRecipe, myId),
    [initialRecipe, myId]
  )
  const {
    value: form,
    setValue: setForm,
    restored,
    clear,
    discardRestored
  } = useSessionDraft(persistKey, getInitial)

  const [familyUsers, setFamilyUsers] = useState([])
  const [usersError, setUsersError] = useState(null)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  useEffect(() => {
    if (!isStaff) return
    let cancelled = false
    listUsers()
      .then((res) => {
        if (cancelled) return
        const active = (res.data || []).filter((u) => u.active !== false)
        setFamilyUsers(active)
        setUsersError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setUsersError(err.message || 'Impossibile caricare gli utenti')
      })
    return () => {
      cancelled = true
    }
  }, [isStaff])

  useEffect(() => {
    if (!isStaff || !myId) return
    if (form.assignToUserId) return
    setForm((prev) => ({ ...prev, assignToUserId: myId }))
  }, [isStaff, myId, form.assignToUserId, setForm])

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleImageFile = async (file) => {
    if (!file) return
    setImageError(null)
    setImageBusy(true)
    try {
      const { base64, mimeType, previewUrl } = await readAndCompressImage(file)
      update({ imageUrl: previewUrl })
      const res = await uploadRecipeImage({ imageBase64: base64, mimeType })
      const url = res.data?.imageUrl
      if (!url) throw new Error('Upload senza URL')
      update({ imageUrl: url })
    } catch (err) {
      setImageError(err.message || 'Caricamento foto fallito')
    } finally {
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
        isPrivate: form.isPrivate,
        isShared: !form.isPrivate,
        imageUrl: form.imageUrl.trim() || null,
        ingredients: form.ingredients,
        steps: form.steps,
        ...(isStaff && form.assignToUserId ? { assignToUserId: form.assignToUserId } : {})
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

  const ingredientsSectioned = hasSections(form.ingredients)
  const stepsSectioned = hasSections(form.steps)
  const lastIngredientSection = sectionOf(form.ingredients[form.ingredients.length - 1])
  const lastStepSection = sectionOf(form.steps[form.steps.length - 1])

  const handleCancel = () => {
    clear()
    onCancel?.()
  }

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

            {isStaff && (
              <label className="block">
                <span className={fieldLabelClass}>Assegna a</span>
                <select
                  className="input-field mt-1.5"
                  value={form.assignToUserId || myId}
                  onChange={(e) => update({ assignToUserId: e.target.value })}
                >
                  {familyUsers.length === 0 ? (
                    <option value={myId}>
                      {user?.displayName || user?.name || user?.username || 'Me'}
                    </option>
                  ) : (
                    <>
                      {familyUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.displayName || u.username}
                          {u.id === myId ? ' (tu)' : ''}
                        </option>
                      ))}
                      {form.assignToUserId &&
                        !familyUsers.some((u) => u.id === form.assignToUserId) && (
                          <option value={form.assignToUserId}>
                            {initialRecipe?.authorDisplayName || 'Utente attuale'}
                          </option>
                        )}
                    </>
                  )}
                </select>
                {usersError && <span className="mt-1 block text-xs text-amber-700">{usersError}</span>}
                <span className="mt-1 block text-xs text-stone-500">
                  Solo owner e admin possono scegliere a chi assegnare la ricetta.
                </span>
              </label>
            )}

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
                form.imageUrl.trim() ? 'border-solid border-stone-200' : ''
              }`}
            >
              {form.imageUrl.trim() ? (
                <img
                  src={form.imageUrl.trim()}
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
              accept="image/jpeg,image/png,image/webp"
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
              accept="image/jpeg,image/png,image/webp"
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
                  ingredients: [...form.ingredients, emptyIngredient(nextSectionName(form.ingredients))]
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
                update({ ingredients: [...form.ingredients, emptyIngredient(lastIngredientSection)] })
              }
            >
              + Aggiungi
            </button>
          </div>
        </div>

        <div
          className="hidden md:grid grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_2.75rem] gap-2.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400"
          aria-hidden
        >
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
                value={sectionOf(row)}
                placeholder="Nome sezione (es. Pan di Spagna)"
                addLabel="+ Ingrediente"
                onRename={(name) => update({ ingredients: renameRun(form.ingredients, idx, name) })}
                onAdd={() =>
                  update({ ingredients: insertIntoRun(form.ingredients, idx, emptyIngredient()) })
                }
                onClear={() => update({ ingredients: renameRun(form.ingredients, idx, '') })}
              />
            )}
            <div>
              {/* Mobile stacked */}
              <div className="md:hidden rounded-xl border border-stone-100 bg-stone-50/50 p-2.5 space-y-2">
                <div className="flex items-start gap-2">
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
              <div className="hidden md:grid grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_2.75rem] gap-2.5 items-center py-2 border-b border-stone-100">
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
      </section>

      <section className={sectionClass}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={sectionTitleClass}>Passi</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex items-center min-h-[40px] px-2 text-sm text-stone-500 font-semibold hover:text-stone-800"
              onClick={() =>
                update({ steps: [...form.steps, emptyStep(nextSectionName(form.steps))] })
              }
              title="Dividi il procedimento per componente"
            >
              + Sezione
            </button>
            <button
              type="button"
              className="inline-flex items-center min-h-[40px] px-2 text-sm text-primary font-semibold"
              onClick={() => update({ steps: [...form.steps, emptyStep(lastStepSection)] })}
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
                value={sectionOf(row)}
                placeholder="Nome sezione (es. Crema al burro)"
                addLabel="+ Passo"
                onRename={(name) => update({ steps: renameRun(form.steps, idx, name) })}
                onAdd={() => update({ steps: insertIntoRun(form.steps, idx, emptyStep()) })}
                onClear={() => update({ steps: renameRun(form.steps, idx, '') })}
              />
            )}
            <div className="rounded-xl border border-stone-100 bg-stone-50/40 p-3 lg:p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {idx + 1}
                </span>
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
            </div>
            </Fragment>
          ))}
        </div>
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
        <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer select-none">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-stone-300 text-primary focus:ring-primary/30"
            checked={!!form.isPrivate}
            onChange={(e) => update({ isPrivate: e.target.checked })}
          />
          <span className="text-sm text-stone-700">Privata (solo tu e lo staff)</span>
        </label>
      </section>

      {/* Mobile sticky actions — desktop uses top bar + this as secondary */}
      <div className="action-row sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:static z-10 bg-surface/95 backdrop-blur-sm py-3 -mx-1 px-1 sm:bg-transparent sm:backdrop-blur-none sm:py-0 lg:pt-2">
        <FormActions
          saving={saving}
          imageBusy={imageBusy}
          onCancel={onCancel ? handleCancel : null}
          className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto"
        />
      </div>
    </form>
  )
}
