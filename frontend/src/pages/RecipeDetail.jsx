import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useRecipes } from '../hooks/useRecipes.js'
import { useShoppingList } from '../hooks/useShoppingList.js'
import { useRecipeStore } from '../store/recipeStore.js'
import StepInstruction from '../components/recipe/StepInstruction.jsx'
import CookingMethodsSection from '../components/recipe/CookingMethodsSection.jsx'
import NutritionPanel from '../components/recipe/NutritionPanel.jsx'
import RecipeAiChat from '../components/recipe/RecipeAiChat.jsx'
import { analyzeCookingMethods } from '../services/gemini.js'
import { calculateRecipeNutrition, saveManualNutrition, upsertCustomFood } from '../services/nutrition.js'
import { formatScaledQty, scaleIngredients } from '../utils/scaleIngredients.js'
import { groupStepsForDisplay } from '../utils/groupSteps.js'

const difficultyLabel = {
  easy: 'Facile',
  medium: 'Media',
  hard: 'Difficile'
}

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isStaff } = useAuth()
  const { loadRecipe, selectedRecipe: recipe, deleteRecipe, isLoading, error, recipes } =
    useRecipes()
  const setSelectedRecipe = useRecipeStore((s) => s.setSelectedRecipe)
  const { addRecipeIngredients } = useShoppingList()
  const [listMsg, setListMsg] = useState(null)
  const [servings, setServings] = useState(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [methodsLoading, setMethodsLoading] = useState(false)
  const [methodsError, setMethodsError] = useState(null)
  const [methodsFocus, setMethodsFocus] = useState(null)
  const [nutritionLoading, setNutritionLoading] = useState(false)
  const [nutritionError, setNutritionError] = useState(null)
  const [removing, setRemoving] = useState(false)

  const current = recipe?.id === id ? recipe : null
  const indexEntry = recipes?.find((r) => r.id === id)
  const baseServings = Math.max(1, Number(current?.metadata?.servings) || 1)

  useEffect(() => {
    loadRecipe(id).catch(() => {})
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (current) setServings(baseServings)
  }, [current?.id, baseServings]) // eslint-disable-line react-hooks/exhaustive-deps

  const scaledIngredients = useMemo(() => {
    if (!current?.ingredients) return []
    return scaleIngredients(current.ingredients, baseServings, servings ?? baseServings)
  }, [current, baseServings, servings])

  const displaySteps = useMemo(
    () => groupStepsForDisplay(current?.steps || []),
    [current?.steps]
  )

  const handleDelete = async () => {
    if (!current) return
    if (!window.confirm(`Eliminare “${current.title}”?`)) return
    // Leave immediately; delete is optimistic + Dropbox in background
    navigate('/recipes')
    try {
      await deleteRecipe(id)
    } catch {
      // Errore già in store; lista ricaricata se il delete Fallisce
    }
  }

  const handleRemoveOrphan = async () => {
    const title = indexEntry?.title || 'questa ricetta'
    if (!window.confirm(`Rimuovere “${title}” dalla lista? Il file non è più disponibile.`)) return
    setRemoving(true)
    try {
      await deleteRecipe(id)
      navigate('/recipes', { replace: true })
    } catch {
      // error in store
    } finally {
      setRemoving(false)
    }
  }

  const handleAddToList = async () => {
    if (!current) return
    setListMsg(null)
    try {
      await addRecipeIngredients({
        ...current,
        ingredients: scaledIngredients,
        metadata: {
          ...current.metadata,
          servings: servings ?? baseServings
        }
      })
      const label = servings ?? baseServings
      setListMsg(
        label !== baseServings
          ? `Ingredienti aggiunti (per ${label} porzioni)`
          : 'Ingredienti aggiunti alla lista spesa'
      )
    } catch (err) {
      setListMsg(err.message)
    }
  }

  const bumpServings = (delta) => {
    setServings((prev) => Math.max(1, Math.min(99, (prev ?? baseServings) + delta)))
  }

  const applyMethodsResult = (res) => {
    if (res.data?.recipe) {
      setSelectedRecipe(res.data.recipe)
      return
    }
    setSelectedRecipe({
      ...current,
      cookingMethods: res.data.methods,
      cookingMethodsSummary: res.data.summary
    })
  }

  const handleAnalyzeMethods = async () => {
    if (!current) return
    setMethodsError(null)
    setMethodsLoading(true)
    setMethodsFocus(null)
    try {
      const res = await analyzeCookingMethods(current.id)
      applyMethodsResult(res)
    } catch (err) {
      setMethodsError(err.message)
    } finally {
      setMethodsLoading(false)
    }
  }

  const handleSelectAppliance = async (methodId) => {
    if (!current) return
    setMethodsError(null)
    setMethodsLoading(true)
    setMethodsFocus(methodId)
    try {
      const res = await analyzeCookingMethods(current.id, { focusMethod: methodId })
      applyMethodsResult(res)
    } catch (err) {
      setMethodsError(err.message)
    } finally {
      setMethodsLoading(false)
      setMethodsFocus(null)
    }
  }

  const handleCalculateNutrition = async () => {
    if (!current) return
    setNutritionError(null)
    setNutritionLoading(true)
    try {
      const res = await calculateRecipeNutrition(current.id)
      if (res.data?.recipe) {
        setSelectedRecipe(res.data.recipe)
      } else {
        setSelectedRecipe({
          ...current,
          nutritionInfo: {
            servings: res.data.servings,
            perServing: res.data.perServing,
            perRecipe: res.data.perRecipe,
            source: res.data.source,
            lastCalculated: res.data.lastCalculated,
            lines: res.data.lines,
            skippedCount: res.data.skippedCount,
            matchedCount: res.data.matchedCount
          }
        })
      }
    } catch (err) {
      setNutritionError(err.message)
    } finally {
      setNutritionLoading(false)
    }
  }

  const handleSaveManualNutrition = async (perServing) => {
    if (!current) return
    setNutritionError(null)
    setNutritionLoading(true)
    try {
      const res = await saveManualNutrition(current.id, perServing)
      if (res.data?.recipe) {
        setSelectedRecipe(res.data.recipe)
      } else {
        setSelectedRecipe({
          ...current,
          nutritionInfo: {
            ...(current.nutritionInfo || {}),
            servings: res.data.servings,
            perServing: res.data.perServing,
            perRecipe: res.data.perRecipe,
            source: 'manual',
            lastCalculated: res.data.lastCalculated
          }
        })
      }
    } catch (err) {
      setNutritionError(err.message)
    } finally {
      setNutritionLoading(false)
    }
  }

  const handleAddCustomFood = async (payload) => {
    if (!current) return
    setNutritionError(null)
    setNutritionLoading(true)
    try {
      await upsertCustomFood(payload)
      const res = await calculateRecipeNutrition(current.id)
      if (res.data?.recipe) {
        setSelectedRecipe(res.data.recipe)
      } else {
        setSelectedRecipe({
          ...current,
          nutritionInfo: {
            servings: res.data.servings,
            perServing: res.data.perServing,
            perRecipe: res.data.perRecipe,
            source: res.data.source,
            lastCalculated: res.data.lastCalculated,
            lines: res.data.lines,
            skippedCount: res.data.skippedCount,
            matchedCount: res.data.matchedCount
          }
        })
      }
    } catch (err) {
      setNutritionError(err.message)
      throw err
    } finally {
      setNutritionLoading(false)
    }
  }

  if (isLoading || !current) {
    if (error && !isLoading) {
      return (
        <main className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
          <p className="text-red-600 mb-2" role="alert">
            {/not found|non trovata/i.test(error)
              ? 'Ricetta non trovata — probabilmente è rimasta solo nella lista (file mancante).'
              : error}
          </p>
          {indexEntry?.title && (
            <p className="text-sm text-stone-500 mb-6">
              Voce in elenco: <strong>{indexEntry.title}</strong>
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary"
              disabled={removing}
              onClick={handleRemoveOrphan}
            >
              {removing ? 'Rimozione…' : 'Rimuovi dalla lista'}
            </button>
            <Link to="/recipes" className="btn-secondary">
              Torna alle ricette
            </Link>
          </div>
        </main>
      )
    }
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-400">Caricamento…</p>
      </main>
    )
  }

  const meta = current.metadata || {}
  const totalTime = (Number(meta.prepTime) || 0) + (Number(meta.cookTime) || 0)
  const activeServings = servings ?? baseServings
  const isScaled = activeServings !== baseServings

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fade-in">
      <Link to="/recipes" className="text-sm text-gray-400 hover:text-gray-700">← Ricette</Link>

      <header className="mt-4">
        {current.imageUrl ? (
          <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-gray-100 aspect-[16/10] sm:aspect-[21/9]">
            <img
              src={current.imageUrl}
              alt={current.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
              <h1 className="font-display text-2xl sm:text-4xl font-semibold text-white drop-shadow-sm leading-tight">
                {current.title}
              </h1>
              {isStaff && (current.authorDisplayName || indexEntry?.authorDisplayName) && (
                <p className="mt-1 text-sm text-white/85">
                  di {current.authorDisplayName || indexEntry.authorDisplayName}
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 leading-tight">
              {current.title}
            </h1>
            {isStaff && (current.authorDisplayName || indexEntry?.authorDisplayName) && (
              <p className="mt-1 text-sm text-stone-500">
                di {current.authorDisplayName || indexEntry.authorDisplayName}
              </p>
            )}
          </>
        )}

        <div className={`flex flex-wrap items-start justify-between gap-4 ${current.imageUrl ? 'mt-5' : 'mt-3'}`}>
          <div className="flex flex-wrap gap-2">
            {!!meta.prepTime && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-white border border-gray-100 text-sm text-gray-700 shadow-sm">
                Prep {meta.prepTime} min
              </span>
            )}
            {!!meta.cookTime && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-white border border-gray-100 text-sm text-gray-700 shadow-sm">
                Cottura {meta.cookTime} min
              </span>
            )}
            {totalTime > 0 && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-sm font-medium">
                Totale {totalTime} min
              </span>
            )}
            <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-white border border-gray-100 text-sm text-gray-700 shadow-sm">
              {difficultyLabel[meta.difficulty] || meta.difficulty}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary !py-2.5 !px-4 text-sm"
              onClick={() => setChatOpen(true)}
            >
              Chiedi ad IA
            </button>
            <button type="button" className="btn-secondary !py-2.5 !px-4 text-sm" onClick={handleAddToList}>
              + Lista spesa
            </button>
            <Link to={`/recipes/${id}/edit`} className="btn-secondary !py-2.5 !px-4 text-sm">
              Modifica
            </Link>
            <button
              type="button"
              id="btn-delete-recipe"
              onClick={handleDelete}
              className="btn-secondary !py-2.5 !px-4 text-sm text-red-600 border-red-200"
            >
              Elimina
            </button>
          </div>
        </div>

        {listMsg && <p className="mt-3 text-sm text-teal-600">{listMsg}</p>}

        {!!meta.tags?.length && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {meta.tags.map((tag) => (
              <span key={tag} className="px-2.5 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">
                {tag}
              </span>
            ))}
          </div>
        )}

        {current.notes && (
          <p className="mt-4 text-[15px] leading-relaxed text-gray-600 max-w-3xl">
            {current.notes}
          </p>
        )}
      </header>

      <CookingMethodsSection
        recipe={current}
        methods={current.cookingMethods || []}
        summary={current.cookingMethodsSummary || ''}
        loading={methodsLoading}
        loadingMethod={methodsFocus}
        error={methodsError}
        onAnalyze={handleAnalyzeMethods}
        onSelectAppliance={handleSelectAppliance}
      />

      <NutritionPanel
        nutritionInfo={current.nutritionInfo}
        loading={nutritionLoading}
        error={nutritionError}
        onCalculate={handleCalculateNutrition}
        onSaveManual={handleSaveManualNutrition}
        onAddCustomFood={handleAddCustomFood}
      />

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)] gap-4 lg:gap-5 items-start">
        <section className="card p-5 sm:p-6 lg:sticky lg:top-20">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold">Ingredienti</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 hidden sm:inline">Porzioni</span>
              <div className="inline-flex items-center rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
                <button
                  type="button"
                  className="px-3 py-1.5 text-lg leading-none text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                  onClick={() => bumpServings(-1)}
                  disabled={activeServings <= 1}
                  aria-label="Diminuisci porzioni"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={99}
                  className="w-12 text-center text-sm font-semibold bg-transparent border-x border-gray-200 py-1.5 focus:outline-none tabular-nums"
                  value={activeServings}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (!Number.isFinite(n)) return
                    setServings(Math.max(1, Math.min(99, Math.round(n))))
                  }}
                  aria-label="Numero porzioni"
                />
                <button
                  type="button"
                  className="px-3 py-1.5 text-lg leading-none text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                  onClick={() => bumpServings(1)}
                  disabled={activeServings >= 99}
                  aria-label="Aumenta porzioni"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {isScaled && (
            <p className="text-xs text-teal-700 mb-3">
              Dosi ricalcolate da {baseServings} → {activeServings} porzioni
              {' · '}
              <button
                type="button"
                className="underline hover:no-underline"
                onClick={() => setServings(baseServings)}
              >
                ripristina
              </button>
            </p>
          )}

          {scaledIngredients.length ? (
            <ul className="divide-y divide-gray-100">
              {scaledIngredients.map((ing) => {
                const qty = formatScaledQty(ing.quantity, ing.unit)
                return (
                  <li key={ing.id} className="flex items-baseline justify-between gap-4 py-2.5 text-[15px]">
                    <span className="text-gray-800 leading-snug min-w-0">
                      {ing.name}
                      {ing.notes ? (
                        <span className="block text-xs text-gray-400 mt-0.5 font-normal">{ing.notes}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-semibold text-gray-900 tabular-nums">
                      {qty || '—'}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm">Nessun ingrediente</p>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="text-lg font-semibold mb-5">Preparazione</h2>
          {displaySteps.length ? (
            <ol className="space-y-6">
              {displaySteps.map((step) => (
                <li key={step.id || step.order} className="flex gap-3.5">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
                    {step.order}
                  </span>
                  <div className="pt-0.5 min-w-0 flex-1">
                    <StepInstruction text={step.instruction} />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-gray-400 text-sm">Nessun passo</p>
          )}
        </section>
      </div>

      {current.sourceUrl && (
        <p className="mt-6 text-xs text-gray-400">
          Fonte:{' '}
          <a
            href={current.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline break-all"
          >
            {current.sourceUrl}
          </a>
        </p>
      )}

      <RecipeAiChat
        recipeId={current.id}
        recipeTitle={current.title}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </main>
  )
}
