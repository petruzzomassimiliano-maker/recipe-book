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
  const [checkedIng, setCheckedIng] = useState(() => new Set())
  const [moreOpen, setMoreOpen] = useState(false)

  const current = recipe?.id === id ? recipe : null
  const indexEntry = recipes?.find((r) => r.id === id)
  const baseServings = Math.max(1, Number(current?.metadata?.servings) || 1)

  useEffect(() => {
    loadRecipe(id).catch(() => {})
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (current) setServings(baseServings)
  }, [current?.id, baseServings]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setCheckedIng(new Set())
    setMoreOpen(false)
  }, [current?.id])

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
    navigate('/recipes')
    try {
      await deleteRecipe(id)
    } catch {
      // Errore già in store
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

  const toggleIngredient = (ingId) => {
    setCheckedIng((prev) => {
      const next = new Set(prev)
      if (next.has(ingId)) next.delete(ingId)
      else next.add(ingId)
      return next
    })
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
  const authorName = current.authorDisplayName || indexEntry?.authorDisplayName

  const metaBits = [
    meta.prepTime ? `Prep ${meta.prepTime}'` : null,
    meta.cookTime ? `Cottura ${meta.cookTime}'` : null,
    totalTime > 0 ? `Tot ${totalTime}'` : null,
    difficultyLabel[meta.difficulty] || meta.difficulty || null
  ].filter(Boolean)

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8 animate-fade-in">
      <Link
        to="/recipes"
        className="inline-flex items-center min-h-[44px] text-sm text-stone-400 active:text-stone-700"
      >
        ← Ricette
      </Link>

      <header className="mt-2">
        {/* Image plane separate from title — kitchen glance + no overlay cover */}
        {current.imageUrl ? (
          <div className="relative overflow-hidden rounded-2xl border border-stone-200/80 bg-stone-100 aspect-[16/10] sm:aspect-[21/9]">
            <img
              src={current.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        ) : null}

        <div className={current.imageUrl ? 'mt-4' : 'mt-1'}>
          <h1 className="font-display text-2xl sm:text-4xl font-semibold text-stone-900 leading-tight tracking-tight">
            {current.title}
          </h1>
          {isStaff && authorName && (
            <p className="mt-1 text-sm text-stone-500">di {authorName}</p>
          )}
          {metaBits.length > 0 && (
            <p className="mt-2 text-sm text-stone-500 flex flex-wrap gap-x-2 gap-y-0.5">
              {metaBits.map((bit, i) => (
                <span key={bit} className="inline-flex items-center gap-2">
                  {i > 0 ? <span className="text-stone-300" aria-hidden>·</span> : null}
                  {bit}
                </span>
              ))}
            </p>
          )}
        </div>

        {/* Primary kitchen actions — full width on phone */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            className="btn-primary !py-2.5 !px-4 text-sm col-span-2 sm:col-span-1 sm:w-auto"
            onClick={handleAddToList}
          >
            + Lista spesa
          </button>
          <Link
            to={`/recipes/${id}/edit`}
            className="btn-secondary !py-2.5 !px-4 text-sm text-center"
          >
            Modifica
          </Link>
          <button
            type="button"
            className="btn-secondary !py-2.5 !px-4 text-sm"
            onClick={() => setChatOpen(true)}
          >
            Chiedi ad IA
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center min-h-[44px] text-sm text-stone-400 active:text-red-600"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
          >
            Altro
          </button>
        </div>

        {moreOpen && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              id="btn-delete-recipe"
              onClick={handleDelete}
              className="btn-secondary !py-2.5 !px-4 text-sm text-red-600 border-red-200"
            >
              Elimina ricetta
            </button>
          </div>
        )}

        {listMsg && <p className="mt-3 text-sm text-teal-700">{listMsg}</p>}

        {!!meta.tags?.length && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {meta.tags.map((tag) => (
              <span key={tag} className="px-2.5 py-0.5 rounded-lg bg-stone-100 text-xs text-stone-600">
                {tag}
              </span>
            ))}
          </div>
        )}

        {current.notes && (
          <p className="mt-3 text-[15px] leading-relaxed text-stone-600 max-w-3xl">
            {current.notes}
          </p>
        )}
      </header>

      {/* Sticky jump links — recipe UX: get to ingredients/steps fast */}
      <nav
        className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 px-4 py-2 mt-4 mb-3 bg-surface/95 backdrop-blur-md border-b border-stone-200/60 sm:static sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:mt-6"
        aria-label="Sezioni ricetta"
      >
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          <a
            href="#ingredienti"
            className="shrink-0 inline-flex items-center min-h-[40px] px-3.5 rounded-full bg-white border border-stone-200 text-sm font-semibold text-stone-700 active:bg-stone-50"
          >
            Ingredienti
          </a>
          <a
            href="#preparazione"
            className="shrink-0 inline-flex items-center min-h-[40px] px-3.5 rounded-full bg-white border border-stone-200 text-sm font-semibold text-stone-700 active:bg-stone-50"
          >
            Preparazione
          </a>
          <a
            href="#extra"
            className="shrink-0 inline-flex items-center min-h-[40px] px-3.5 rounded-full bg-white border border-stone-200 text-sm font-medium text-stone-500 active:bg-stone-50"
          >
            Extra
          </a>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)] gap-4 lg:gap-5 items-start">
        <section
          id="ingredienti"
          className="rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-6 lg:sticky lg:top-24 scroll-mt-28 sm:scroll-mt-24"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold text-stone-900">Ingredienti</h2>
            <div className="inline-flex items-center rounded-xl border border-stone-200 bg-stone-50 overflow-hidden">
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] text-lg leading-none text-stone-600 active:bg-stone-100 disabled:opacity-40"
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
                className="w-11 text-center text-sm font-semibold bg-transparent border-x border-stone-200 py-2 focus:outline-none tabular-nums"
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
                className="min-h-[44px] min-w-[44px] text-lg leading-none text-stone-600 active:bg-stone-100 disabled:opacity-40"
                onClick={() => bumpServings(1)}
                disabled={activeServings >= 99}
                aria-label="Aumenta porzioni"
              >
                +
              </button>
            </div>
          </div>

          {isScaled && (
            <p className="text-xs text-teal-700 mb-2">
              Dosi da {baseServings} → {activeServings} porzioni
              {' · '}
              <button
                type="button"
                className="underline"
                onClick={() => setServings(baseServings)}
              >
                ripristina
              </button>
            </p>
          )}

          {scaledIngredients.length ? (
            <ul>
              {scaledIngredients.map((ing) => {
                const qty = formatScaledQty(ing.quantity, ing.unit)
                const done = checkedIng.has(ing.id)
                return (
                  <li key={ing.id} className="border-t border-stone-100 first:border-t-0">
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 min-h-[48px] py-2.5 text-left active:bg-stone-50"
                      onClick={() => toggleIngredient(ing.id)}
                      aria-pressed={done}
                    >
                      <span
                        className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                          done
                            ? 'bg-teal-600 border-teal-600 text-white'
                            : 'border-stone-300 bg-white'
                        }`}
                        aria-hidden
                      >
                        {done ? (
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
                          className={`block text-[15px] leading-snug ${
                            done ? 'line-through text-stone-400' : 'text-stone-800'
                          }`}
                        >
                          {ing.name}
                        </span>
                        {ing.notes ? (
                          <span className="block text-xs text-stone-400 mt-0.5">{ing.notes}</span>
                        ) : null}
                      </span>
                      <span
                        className={`shrink-0 text-sm font-semibold tabular-nums ${
                          done ? 'text-stone-300' : 'text-stone-900'
                        }`}
                      >
                        {qty || '—'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-stone-400 text-sm">Nessun ingrediente</p>
          )}
        </section>

        <section
          id="preparazione"
          className="rounded-2xl border border-stone-200/80 bg-white p-4 sm:p-6 scroll-mt-28 sm:scroll-mt-24"
        >
          <h2 className="text-lg font-semibold text-stone-900 mb-4">Preparazione</h2>
          {displaySteps.length ? (
            <ol className="space-y-5">
              {displaySteps.map((step) => (
                <li key={step.id || step.order} className="flex gap-3.5">
                  <span className="shrink-0 w-9 h-9 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
                    {step.order}
                  </span>
                  <div className="pt-1 min-w-0 flex-1 text-[16px] sm:text-[15px] leading-relaxed">
                    <StepInstruction text={step.instruction} />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-stone-400 text-sm">Nessun passo</p>
          )}
        </section>
      </div>

      {/* Secondary: appliances + nutrition below the cook flow */}
      <div id="extra" className="mt-6 space-y-4 scroll-mt-28 sm:scroll-mt-24">
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
      </div>

      {current.sourceUrl && (
        <p className="mt-6 text-xs text-stone-400">
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
