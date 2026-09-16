import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useShoppingList } from '../hooks/useShoppingList.js'
import { draftKey, useSessionDraft } from '../hooks/useSessionDraft.js'

function formatQty(item) {
  const parts = [item.quantity, item.unit].filter((v) => v != null && v !== '')
  return parts.length ? parts.join(' ') : ''
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
  const [showDetails, setShowDetails] = useState(false)
  const [doneOpen, setDoneOpen] = useState(false)
  const ingredientRef = useRef(null)

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
  const pendingCount = items.filter((i) => !i.checked).length
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
      setShowDetails(false)
      // Keep focus for rapid multi-add (checklist UX)
      requestAnimationFrame(() => ingredientRef.current?.focus())
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-8 animate-fade-in pb-28 sm:pb-8">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="page-title">Lista spesa</h1>
          {!isLoading && items.length > 0 && (
            <p className="text-xs text-stone-400 mt-0.5 tabular-nums">
              {pendingCount} da comprare
              {doneCount > 0 ? ` · ${doneCount} presi` : ''}
            </p>
          )}
        </div>
        {doneCount > 0 && (
          <button
            type="button"
            className="shrink-0 inline-flex items-center min-h-[44px] px-3 rounded-xl text-sm font-semibold text-stone-600 bg-white border border-stone-200 active:bg-stone-50"
            onClick={() => clearChecked()}
          >
            Pulisci
          </button>
        )}
      </div>

      {(error || formError) && (
        <div role="alert" className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {formError || error}
        </div>
      )}

      {isLoading && items.length === 0 ? (
        <p className="text-stone-400">Caricamento…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white/60 p-10 text-center">
          <p className="text-stone-500 text-sm leading-relaxed">
            Lista vuota. Aggiungi qui sotto oppure dalla ricetta usa «+ Lista spesa».
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-4">
            {pendingGroups.length === 0 ? (
              <p className="text-sm text-stone-400 py-6 text-center">Tutto preso. Bravo!</p>
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
            <div>
              <button
                type="button"
                className="w-full flex items-center justify-between min-h-[44px] px-1 text-sm font-semibold text-stone-500"
                onClick={() => setDoneOpen((v) => !v)}
                aria-expanded={doneOpen}
              >
                <span>Presi ({doneCount})</span>
                <span className="text-stone-400" aria-hidden>
                  {doneOpen ? '▾' : '▸'}
                </span>
              </button>
              {doneOpen && (
                <div className="space-y-4 mt-2">
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
        </div>
      )}

      {/* Sticky quick-add — always reachable with one thumb (checklist UX) */}
      <form
        onSubmit={handleAdd}
        className="fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom))] sm:bottom-6 inset-x-0 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:max-w-3xl sm:w-full z-20 px-3 sm:px-6"
      >
        <div className="rounded-2xl border border-stone-200/90 bg-white/95 backdrop-blur-md shadow-lg p-2.5 space-y-2">
          <div className="flex gap-2 items-center">
            <input
              ref={ingredientRef}
              className="input-field !min-h-[44px] !py-2.5 flex-1"
              value={addForm.ingredient}
              onChange={(e) => setAddForm((prev) => ({ ...prev, ingredient: e.target.value }))}
              placeholder="Aggiungi ingrediente…"
              enterKeyHint="done"
              autoComplete="off"
            />
            <button
              type="button"
              className="shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl border border-stone-200 text-stone-500 text-sm font-medium active:bg-stone-50"
              onClick={() => setShowDetails((v) => !v)}
              aria-label="Quantità e unità"
              aria-expanded={showDetails}
              title="Qty / unità"
            >
              #
            </button>
            <button
              type="submit"
              className="shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl bg-primary text-white font-semibold text-lg shadow-sm active:scale-[0.98] disabled:opacity-50"
              disabled={saving}
              aria-label="Aggiungi"
            >
              +
            </button>
          </div>
          {showDetails && (
            <div className="flex gap-2">
              <input
                className="input-field !min-h-[44px] !py-2.5 flex-1"
                value={addForm.quantity}
                onChange={(e) => setAddForm((prev) => ({ ...prev, quantity: e.target.value }))}
                placeholder="Qty"
                inputMode="decimal"
              />
              <input
                className="input-field !min-h-[44px] !py-2.5 flex-1"
                value={addForm.unit}
                onChange={(e) => setAddForm((prev) => ({ ...prev, unit: e.target.value }))}
                placeholder="Unità"
              />
            </div>
          )}
        </div>
      </form>
    </main>
  )
}

function RecipeSection({ group, onToggle, onRemove, onRemoveRecipe }) {
  const recipeKey = group.key === '__manual__' ? null : group.recipeId

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white">
      <div className="px-3.5 py-2.5 bg-stone-50/80 border-b border-stone-100 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-stone-800 text-sm min-w-0 truncate">{group.title}</h2>
        <div className="flex items-center gap-1 shrink-0">
          {group.recipeId && (
            <Link
              to={`/recipes/${group.recipeId}`}
              className="inline-flex items-center min-h-[40px] px-2 text-xs font-semibold text-primary"
            >
              Apri
            </Link>
          )}
          <button
            type="button"
            className="inline-flex items-center min-h-[40px] px-2 text-xs text-stone-400 active:text-red-600"
            onClick={() => onRemoveRecipe(recipeKey)}
          >
            Tutti
          </button>
        </div>
      </div>
      <ul>
        {group.items.map((item) => {
          const qty = formatQty(item)
          return (
            <li key={item.id} className="border-t border-stone-100 first:border-t-0">
              <div className="flex items-stretch">
                <button
                  type="button"
                  className="flex-1 flex items-center gap-3 min-h-[52px] px-3.5 py-2.5 text-left active:bg-stone-50"
                  onClick={() => onToggle(item.id, !item.checked)}
                  aria-pressed={!!item.checked}
                >
                  <span
                    className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                      item.checked
                        ? 'bg-teal-600 border-teal-600 text-white'
                        : 'border-stone-300 bg-white'
                    }`}
                    aria-hidden
                  >
                    {item.checked ? (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[15px] font-medium leading-snug ${
                        item.checked ? 'line-through text-stone-400' : 'text-stone-900'
                      }`}
                    >
                      {item.ingredient}
                    </span>
                    {qty ? (
                      <span className={`block text-xs mt-0.5 ${item.checked ? 'text-stone-300' : 'text-stone-400'}`}>
                        {qty}
                      </span>
                    ) : null}
                  </span>
                </button>
                <button
                  type="button"
                  className="shrink-0 inline-flex items-center justify-center min-h-[52px] min-w-[48px] text-stone-300 active:text-red-500 active:bg-red-50"
                  onClick={() => onRemove(item.id)}
                  aria-label={`Rimuovi ${item.ingredient}`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5h6v2m-7 4v6m4-6v6m4-10v12a1 1 0 01-1 1H8a1 1 0 01-1-1V7" />
                  </svg>
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
