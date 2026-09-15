import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useShoppingList } from '../hooks/useShoppingList.js'
import { draftKey, useSessionDraft } from '../hooks/useSessionDraft.js'

function formatQty(item) {
  const parts = [item.quantity, item.unit].filter((v) => v != null && v !== '')
  return parts.length ? parts.join(' ') : '—'
}

function groupByRecipe(items) {
  const map = new Map()
  for (const item of items) {
    const key = item.recipeId || item.recipeIds?.[0] || '__manual__'
    const title = item.recipeTitle || (key === '__manual__' ? 'Altro' : 'Ricetta')
    if (!map.has(key)) map.set(key, { key, title, recipeId: key === '__manual__' ? null : key, items: [] })
    map.get(key).items.push(item)
  }
  return [...map.values()].sort((a, b) => {
    if (a.key === '__manual__') return 1
    if (b.key === '__manual__') return -1
    return a.title.localeCompare(b.title, 'it')
  })
}

export default function ShoppingList() {
  const {
    items,
    isLoading,
    error,
    load,
    addItem,
    toggleItem,
    removeItem,
    removeRecipeItems,
    clearChecked
  } = useShoppingList()

  const {
    value: addForm,
    setValue: setAddForm,
    clear: clearAddForm
  } = useSessionDraft(draftKey('shopping-add'), {
    ingredient: '',
    quantity: '',
    unit: ''
  })

  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pendingGroups = useMemo(
    () => groupByRecipe(items.filter((i) => !i.checked)),
    [items]
  )
  const doneGroups = useMemo(
    () => groupByRecipe(items.filter((i) => i.checked)),
    [items]
  )
  const doneCount = items.filter((i) => i.checked).length

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!addForm.ingredient.trim()) {
      setFormError('Scrivi un ingrediente')
      return
    }
    setFormError(null)
    setSaving(true)
    try {
      await addItem({
        ingredient: addForm.ingredient,
        quantity: addForm.quantity,
        unit: addForm.unit
      })
      clearAddForm()
      setAddForm({ ingredient: '', quantity: '', unit: '' })
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="page-title">Lista spesa</h1>
        {doneCount > 0 && (
          <button type="button" className="btn-secondary text-sm" onClick={() => clearChecked()}>
            Rimuovi completati
          </button>
        )}
      </div>

      <form onSubmit={handleAdd} className="card p-4 mb-6 grid grid-cols-12 gap-2 items-end">
        <label className="col-span-12 sm:col-span-5">
          <span className="text-xs text-gray-500">Ingrediente</span>
          <input
            className="input-field mt-1"
            value={addForm.ingredient}
            onChange={(e) => setAddForm((prev) => ({ ...prev, ingredient: e.target.value }))}
            placeholder="Uova"
          />
        </label>
        <label className="col-span-4 sm:col-span-2">
          <span className="text-xs text-gray-500">Qty</span>
          <input
            className="input-field mt-1"
            value={addForm.quantity}
            onChange={(e) => setAddForm((prev) => ({ ...prev, quantity: e.target.value }))}
            placeholder="6 o q.b."
          />
        </label>
        <label className="col-span-4 sm:col-span-2">
          <span className="text-xs text-gray-500">Unità</span>
          <input
            className="input-field mt-1"
            value={addForm.unit}
            onChange={(e) => setAddForm((prev) => ({ ...prev, unit: e.target.value }))}
            placeholder="pezzi"
          />
        </label>
        <button type="submit" className="btn-primary col-span-4 sm:col-span-3" disabled={saving}>
          Aggiungi
        </button>
      </form>

      {(error || formError) && (
        <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {formError || error}
        </div>
      )}

      {isLoading && items.length === 0 ? (
        <p className="text-gray-400">Caricamento…</p>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
          Lista vuota. Dalla scheda ricetta usa “+ Lista spesa”.
        </div>
      ) : (
        <div className="space-y-8">
          <div className="space-y-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Da comprare</h2>
            {pendingGroups.length === 0 ? (
              <p className="text-sm text-gray-400">Niente da comprare.</p>
            ) : (
              pendingGroups.map((group) => (
                <RecipeSection
                  key={group.key}
                  group={group}
                  onToggle={toggleItem}
                  onRemove={removeItem}
                  onRemoveRecipe={removeRecipeItems}
                />
              ))
            )}
          </div>

          {doneGroups.length > 0 && (
            <div className="space-y-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Presi</h2>
              {doneGroups.map((group) => (
                <RecipeSection
                  key={`done-${group.key}`}
                  group={group}
                  onToggle={toggleItem}
                  onRemove={removeItem}
                  onRemoveRecipe={removeRecipeItems}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}

function RecipeSection({ group, onToggle, onRemove, onRemoveRecipe }) {
  const recipeKey = group.key === '__manual__' ? null : group.recipeId

  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-900 text-sm min-w-0 truncate">{group.title}</h3>
        <div className="flex items-center gap-3 shrink-0">
          {group.recipeId && (
            <Link to={`/recipes/${group.recipeId}`} className="text-xs text-primary">
              Apri
            </Link>
          )}
          <button
            type="button"
            className="text-xs text-gray-400 hover:text-red-500"
            onClick={() => onRemoveRecipe(recipeKey)}
          >
            Rimuovi tutti
          </button>
        </div>
      </div>
      <ul className="divide-y divide-gray-100">
        {group.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <input
              type="checkbox"
              checked={!!item.checked}
              onChange={(e) => onToggle(item.id, e.target.checked)}
              aria-label={`Segna ${item.ingredient}`}
            />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${item.checked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                {item.ingredient}
              </p>
              <p className="text-xs text-gray-400">{formatQty(item)}</p>
            </div>
            <button
              type="button"
              className="text-xs text-gray-400 hover:text-red-500"
              onClick={() => onRemove(item.id)}
            >
              Rimuovi
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
