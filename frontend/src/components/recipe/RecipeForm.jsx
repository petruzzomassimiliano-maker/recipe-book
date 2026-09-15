import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth.js'
import { useSessionDraft } from '../../hooks/useSessionDraft.js'
import { listUsers } from '../../services/users.js'

const emptyIngredient = () => ({ name: '', quantity: '', unit: 'g', notes: '' })
const emptyStep = () => ({ instruction: '' })

function authorUserIdFromRecipe(recipe) {
  const author = recipe?.author
  if (typeof author === 'string' && author.startsWith('user-')) {
    return author.slice(5)
  }
  return null
}

function AutoGrowTextarea({ value, onChange, className = '', ...props }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 44)}px`
  }, [value])

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
      ? recipe.ingredients.map((i) => ({
          name: i.name || '',
          quantity: i.quantity ?? '',
          unit: i.unit || '',
          notes: i.notes || ''
        }))
      : [emptyIngredient()],
    steps: recipe.steps?.length
      ? recipe.steps.map((s) => ({ instruction: s.instruction || '' }))
      : [emptyStep()]
  }
}

export default function RecipeForm({ initialRecipe, onSubmit, onCancel, persistKey = null }) {
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
        ...(isStaff && form.assignToUserId
          ? { assignToUserId: form.assignToUserId }
          : {})
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
      steps: prev.steps.map((row, i) => (i === idx ? { instruction } : row))
    }))
  }

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

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {restored && looksFilled && (
        <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800 flex flex-wrap items-center justify-between gap-2">
          <span>Bozza ripristinata — puoi continuare da dove avevi lasciato.</span>
          <button
            type="button"
            className="text-teal-700 font-medium hover:underline"
            onClick={discardRestored}
          >
            Scarta bozza
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dettagli</h2>
        <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Titolo *</span>
          <input
            className="input-field mt-1"
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Pasta alla carbonara"
            required
          />
        </label>
        {isStaff && (
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Assegna a
            </span>
            <select
              className="input-field mt-1"
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
            {usersError && (
              <span className="mt-1 block text-xs text-amber-700">{usersError}</span>
            )}
            <span className="mt-1 block text-xs text-stone-500">
              La ricetta compare nella sezione di questa persona. Solo owner e admin possono
              scegliere.
            </span>
          </label>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Porzioni</span>
            <input
              type="number"
              min="1"
              className="input-field mt-1"
              value={form.servings}
              onChange={(e) => update({ servings: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Prep (min)</span>
            <input
              type="number"
              min="0"
              className="input-field mt-1"
              value={form.prepTime}
              onChange={(e) => update({ prepTime: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Cottura (min)</span>
            <input
              type="number"
              min="0"
              className="input-field mt-1"
              value={form.cookTime}
              onChange={(e) => update({ cookTime: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Difficoltà</span>
            <select
              className="input-field mt-1"
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
          <span className="text-sm font-medium text-gray-700">Tag (separati da virgola)</span>
          <input
            className="input-field mt-1"
            value={form.tags}
            onChange={(e) => update({ tags: e.target.value })}
            placeholder="pasta, italiana, veloce"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Foto (URL immagine)</span>
          <input
            className="input-field mt-1"
            type="url"
            value={form.imageUrl}
            onChange={(e) => update({ imageUrl: e.target.value })}
            placeholder="https://…/foto-ricetta.jpg"
          />
          {form.imageUrl.trim() && (
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
              <img
                src={form.imageUrl.trim()}
                alt="Anteprima ricetta"
                className="w-full max-h-48 object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          )}
        </label>
      </section>

      <section className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Ingredienti</h2>
          <button
            type="button"
            className="text-sm text-primary font-medium"
            onClick={() => update({ ingredients: [...form.ingredients, emptyIngredient()] })}
          >
            + Aggiungi
          </button>
        </div>
        <div className="space-y-3">
          {form.ingredients.map((row, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_auto] gap-2 items-start"
            >
              <AutoGrowTextarea
                placeholder="Nome"
                value={row.name}
                onChange={(e) => setIngredient(idx, { name: e.target.value })}
                aria-label={`Ingrediente ${idx + 1} nome`}
              />
              <input
                className="input-field"
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
              />
              <button
                type="button"
                className="sm:mt-3 text-sm text-gray-400 hover:text-red-500 justify-self-start"
                onClick={() => update({ ingredients: form.ingredients.filter((_, i) => i !== idx) })}
                disabled={form.ingredients.length === 1}
              >
                Rimuovi
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Passi</h2>
          <button
            type="button"
            className="text-sm text-primary font-medium"
            onClick={() => update({ steps: [...form.steps, emptyStep()] })}
          >
            + Aggiungi
          </button>
        </div>
        <div className="space-y-4">
          {form.steps.map((row, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <span className="mt-3 text-sm font-semibold text-gray-400 w-6">{idx + 1}.</span>
              <AutoGrowTextarea
                className="flex-1 min-h-[88px] leading-[1.7] text-[15px]"
                placeholder={'Cosa fare in questo passo\n• eventualmente punti elenco'}
                value={row.instruction}
                onChange={(e) => setStep(idx, e.target.value)}
                aria-label={`Passo ${idx + 1}`}
              />
              <button
                type="button"
                className="mt-3 text-sm text-gray-400 hover:text-red-500"
                onClick={() => update({ steps: form.steps.filter((_, i) => i !== idx) })}
                disabled={form.steps.length === 1}
              >
                Rimuovi
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Note</span>
          <textarea
            className="input-field mt-1 min-h-[80px]"
            value={form.notes}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="Consigli, varianti, allergie…"
          />
        </label>
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary" disabled={saving} aria-busy={saving}>
          {saving ? 'Salvataggio…' : 'Salva ricetta'}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={handleCancel} disabled={saving}>
            Annulla
          </button>
        )}
      </div>
    </form>
  )
}
