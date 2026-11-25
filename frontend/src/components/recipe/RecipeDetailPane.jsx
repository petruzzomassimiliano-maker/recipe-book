import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore, useEditAccess } from '../../store/authStore.js'
import { useRecipeById } from '../../hooks/useRecipeById.js'
import { useRecipes } from '../../hooks/useRecipes.js'
import StepInstruction from './StepInstruction.jsx'
import CookingMethodsSection from './CookingMethodsSection.jsx'
import RecipeAiChat from './RecipeAiChat.jsx'
import StorageSection from './StorageSection.jsx'
import DiarySection from './DiarySection.jsx'
import FavoriteButton from './FavoriteButton.jsx'
import { TagChip } from './RecipeBits.jsx'
import Icon from '../ui/Icon.jsx'
import { analyzeCookingMethods, generateStorageAdvice } from '../../services/gemini.js'
import { getRecipe } from '../../services/recipes.js'
import { useRecipeStore } from '../../store/recipeStore.js'
import { formatScaledQty, scaleIngredients } from '../../utils/scaleIngredients.js'
import { groupStepsForDisplay } from '../../utils/groupSteps.js'
import { groupBySection } from '../../utils/recipeSections.js'
import { shareRecipePdf } from '../../utils/recipePdf.js'

const SECTION_HEADING_CLASS =
  'font-body text-label-sm uppercase tracking-wider text-primary pb-1.5 mb-1 border-b border-primary/15'

const difficultyLabel = {
  easy: 'Facile',
  medium: 'Media',
  hard: 'Difficile'
}

/**
 * Single recipe panel — usable full-page or inside desktop split view.
 */
export default function RecipeDetailPane({
  recipeId,
  compact = false,
  showBack = true,
  idPrefix = '',
  headerActions = null,
  onDeleted = null
}) {
  const navigate = useNavigate()
  const { canEdit, requestUnlock } = useEditAccess()
  const { recipe, setRecipe, isLoading, error, indexEntry } = useRecipeById(recipeId)
  const { deleteRecipe } = useRecipes()

  const [actionMsg, setActionMsg] = useState(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [storageLoading, setStorageLoading] = useState(false)
  const [storageError, setStorageError] = useState(null)
  const [storagePending, setStoragePending] = useState(false)
  const familyAppName = useAuthStore((s) => s.familyAppName)
  const [servings, setServings] = useState(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [methodsLoading, setMethodsLoading] = useState(false)
  const [methodsError, setMethodsError] = useState(null)
  const [methodsFocus, setMethodsFocus] = useState(null)
  const [removing, setRemoving] = useState(false)
  const [checkedIng, setCheckedIng] = useState(() => new Set())
  const [moreOpen, setMoreOpen] = useState(false)

  const current = recipe?.id === recipeId ? recipe : null
  const baseServings = Math.max(1, Number(current?.metadata?.servings) || 1)
  const aid = (name) => (idPrefix ? `${idPrefix}-${name}` : name)

  /** Run fn only after the family PIN unlocks editing (asks for it if needed). */
  const withEdit = (fn) => async (...args) => {
    if (!(await requestUnlock())) return
    return fn(...args)
  }

  useEffect(() => {
    if (current) setServings(baseServings)
  }, [current?.id, baseServings]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setCheckedIng(new Set())
    setMoreOpen(false)
    setActionMsg(null)
    setStorageError(null)
  }, [recipeId])

  const scaledIngredients = useMemo(() => {
    if (!current?.ingredients) return []
    return scaleIngredients(current.ingredients, baseServings, servings ?? baseServings)
  }, [current, baseServings, servings])

  const displaySteps = useMemo(
    () => groupStepsForDisplay(current?.steps || []),
    [current?.steps]
  )

  const handleDelete = withEdit(async () => {
    if (!current) return
    if (!window.confirm(`Eliminare “${current.title}”?`)) return
    setActionMsg(null)
    try {
      await deleteRecipe(recipeId)
    } catch (err) {
      setActionMsg(`Eliminazione non riuscita: ${err.message}`)
      return
    }
    if (onDeleted) onDeleted(recipeId)
    else navigate('/recipes')
  })

  const handleRemoveOrphan = withEdit(async () => {
    const title = indexEntry?.title || 'questa ricetta'
    if (!window.confirm(`Rimuovere “${title}” dalla lista? Il file non è più disponibile.`)) return
    setRemoving(true)
    try {
      await deleteRecipe(recipeId)
      if (onDeleted) onDeleted(recipeId)
      else navigate('/recipes', { replace: true })
    } catch {
      // ignore
    } finally {
      setRemoving(false)
    }
  })

  const applyStorage = (storage) => {
    setRecipe((prev) => (prev && prev.id === recipeId ? { ...prev, storage } : prev))
    const cached = useRecipeStore.getState().getCachedRecipe(recipeId)
    if (cached) useRecipeStore.getState().cacheRecipe({ ...cached, storage })
  }

  // Just saved → the Worker is generating storage advice in the background: re-check a few times
  const justSaved =
    !!current && !current.storage && Date.now() - (Date.parse(current.updatedAt || 0) || 0) < 90_000
  useEffect(() => {
    if (!justSaved) {
      setStoragePending(false)
      return undefined
    }
    setStoragePending(true)
    let tries = 0
    let stopped = false
    const timer = setInterval(async () => {
      tries += 1
      try {
        const res = await getRecipe(recipeId)
        if (!stopped && res.data?.storage) {
          applyStorage(res.data.storage)
          clearInterval(timer)
          setStoragePending(false)
          return
        }
      } catch {
        // keep trying
      }
      if (tries >= 8) {
        clearInterval(timer)
        if (!stopped) setStoragePending(false)
      }
    }, 4000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [recipeId, justSaved]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerateStorage = withEdit(async () => {
    if (!current || storageLoading) return
    setStorageError(null)
    setStorageLoading(true)
    try {
      const res = await generateStorageAdvice(current.id)
      applyStorage(res.data.storage)
    } catch (err) {
      setStorageError(err.message)
    } finally {
      setStorageLoading(false)
    }
  })

  /** Diary saved/deleted on the server → refresh this view, the cache and the list row. */
  const applyRecipeUpdate = (updated) => {
    if (!updated?.id) return
    setRecipe(updated)
    useRecipeStore.getState().upsertRecipe(updated)
  }

  const handlePdf = async () => {
    if (!current || pdfBusy) return
    setActionMsg(null)
    setPdfBusy(true)
    try {
      await shareRecipePdf(current, { servings: servings ?? baseServings, appName: familyAppName })
    } catch (err) {
      setActionMsg(`PDF non riuscito: ${err.message}`)
    } finally {
      setPdfBusy(false)
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
      setRecipe(res.data.recipe)
      return
    }
    setRecipe({
      ...current,
      cookingMethods: res.data.methods,
      cookingMethodsSummary: res.data.summary
    })
  }

  const handleAnalyzeMethods = withEdit(async () => {
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
  })

  const handleSelectAppliance = withEdit(async (methodId) => {
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
  })

  if (isLoading || !current) {
    if (error && !isLoading) {
      return (
        <div className={compact ? 'p-4' : 'max-w-4xl mx-auto px-4 py-8 animate-fade-in'}>
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
            {showBack && (
              <Link to="/recipes" className="btn-secondary">
                Torna alle ricette
              </Link>
            )}
          </div>
        </div>
      )
    }
    return (
      <div className={compact ? 'p-4' : 'max-w-4xl mx-auto px-4 py-8'}>
        <p className="text-stone-400">Caricamento…</p>
      </div>
    )
  }

  const meta = current.metadata || {}
  const totalTime = (Number(meta.prepTime) || 0) + (Number(meta.cookTime) || 0)
  const activeServings = servings ?? baseServings
  const isScaled = activeServings !== baseServings

  const metaBits = [
    meta.prepTime ? `Prep ${meta.prepTime}'` : null,
    meta.cookTime ? `Cottura ${meta.cookTime}'` : null,
    totalTime > 0 ? `Tot ${totalTime}'` : null,
    difficultyLabel[meta.difficulty] || meta.difficulty || null
  ].filter(Boolean)

  const titleClass = compact
    ? 'font-headline text-headline-md text-on-surface'
    : 'font-headline text-display-sm sm:text-display-lg text-on-surface'

  return (
    <div className={compact ? 'animate-fade-in' : 'max-w-[1200px] mx-auto px-4 sm:px-8 py-4 sm:py-8 animate-fade-in'}>
      {showBack && (
        <Link
          to="/recipes"
          className="inline-flex items-center gap-1 min-h-[44px] font-body text-label-lg text-primary hover:underline"
        >
          <Icon name="arrow_back" size={18} />
          Torna alle ricette
        </Link>
      )}

      <header className={showBack ? 'mt-2' : ''}>
        {current.imageUrl ? (
          <div
            className={`relative overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low shadow-md ${
              compact ? 'aspect-[16/9]' : 'aspect-[16/10] sm:aspect-[21/9]'
            }`}
          >
            <img
              src={current.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        ) : null}

        <div className={current.imageUrl ? 'mt-4' : 'mt-1'}>
          <div className="flex items-start justify-between gap-3">
            <h1 className={titleClass}>{current.title}</h1>
            <FavoriteButton recipeId={current.id} title={current.title} className="shrink-0 -mt-0.5" />
          </div>
          {metaBits.length > 0 && (
            <p className="mt-2 font-mono text-mono-md text-on-surface-variant tabular-nums flex flex-wrap gap-x-2 gap-y-0.5">
              {metaBits.map((bit, i) => (
                <span key={bit} className="inline-flex items-center gap-2">
                  {i > 0 ? <span className="text-stone-300" aria-hidden>·</span> : null}
                  {bit}
                </span>
              ))}
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary !py-2.5 !px-4 text-sm"
            onClick={handlePdf}
            disabled={pdfBusy}
            title="Crea un PDF della ricetta da salvare o condividere"
          >
            <Icon name="ios_share" size={18} />
            {pdfBusy ? 'Creo PDF…' : 'PDF / Condividi'}
          </button>
          <Link
            to={`/recipes/${recipeId}/edit`}
            className="btn-secondary !py-2.5 !px-4 text-sm text-center"
            onClick={async (e) => {
              if (canEdit) return
              e.preventDefault()
              if (await requestUnlock()) navigate(`/recipes/${recipeId}/edit`)
            }}
          >
            <Icon name="edit" size={18} />
            Modifica
          </Link>
          <button
            type="button"
            className="btn-secondary !py-2.5 !px-4 text-sm"
            onClick={withEdit(() => setChatOpen(true))}
          >
            <Icon name="auto_awesome" size={18} />
            Chiedi ad IA
          </button>
          {headerActions}
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1 min-h-[44px] px-3 rounded-full font-body text-label-lg text-on-surface-variant hover:bg-surface-container-low"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
          >
            <Icon name="more_horiz" size={18} />
            Altro
          </button>
        </div>

        {moreOpen && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="btn-secondary !text-red-700 !border-red-200 hover:!bg-red-50"
            >
              <Icon name="delete" size={18} />
              Elimina ricetta
            </button>
          </div>
        )}

        {actionMsg && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {actionMsg}
          </p>
        )}

        {!!meta.tags?.length && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {meta.tags.map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
          </div>
        )}

        {current.notes && (
          <p className="mt-3 font-body text-body-lg text-on-surface-variant text-pretty max-w-3xl">
            {current.notes}
          </p>
        )}
      </header>

      <nav
        className={`sticky z-10 py-2 mt-4 mb-3 bg-surface/95 backdrop-blur-md border-b border-outline-variant ${
          compact
            ? 'top-0 -mx-1 px-1'
            : 'top-[calc(3.5rem+env(safe-area-inset-top))] -mx-4 px-4 sm:static sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:mt-6'
        }`}
        aria-label="Sezioni ricetta"
      >
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          <a
            href={`#${aid('ingredienti')}`}
            className="shrink-0 inline-flex items-center min-h-[40px] px-4 rounded-full bg-surface-container-lowest border border-outline-variant font-body text-label-lg text-on-surface hover:bg-surface-container-low"
          >
            Ingredienti
          </a>
          <a
            href={`#${aid('preparazione')}`}
            className="shrink-0 inline-flex items-center min-h-[40px] px-4 rounded-full bg-surface-container-lowest border border-outline-variant font-body text-label-lg text-on-surface hover:bg-surface-container-low"
          >
            Preparazione
          </a>
          <a
            href={`#${aid('conservazione')}`}
            className="shrink-0 inline-flex items-center min-h-[40px] px-4 rounded-full bg-surface-container-lowest border border-outline-variant font-body text-label-lg text-on-surface-variant hover:bg-surface-container-low"
          >
            Conservazione
          </a>
          <a
            href={`#${aid('extra')}`}
            className="shrink-0 inline-flex items-center min-h-[40px] px-4 rounded-full bg-surface-container-lowest border border-outline-variant font-body text-label-lg text-on-surface-variant hover:bg-surface-container-low"
          >
            Cottura
          </a>
          <a
            href={`#${aid('diario')}`}
            className="shrink-0 inline-flex items-center min-h-[40px] px-4 rounded-full bg-surface-container-lowest border border-outline-variant font-body text-label-lg text-on-surface-variant hover:bg-surface-container-low"
          >
            Diario{current.diary?.length ? ` (${current.diary.length})` : ''}
          </a>
        </div>
      </nav>

      <div
        className={`grid grid-cols-1 gap-4 items-start ${
          compact ? '' : 'lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)] lg:gap-5'
        }`}
      >
        <section
          id={aid('ingredienti')}
          className={`rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-md p-4 scroll-mt-24 ${
            compact ? '' : 'sm:p-6 lg:sticky lg:top-24 sm:scroll-mt-24'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="font-headline text-headline-md text-on-surface">Ingredienti</h2>
            <div className="inline-flex items-center rounded-xl border border-stone-200 bg-stone-50 overflow-hidden">
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] text-lg leading-none text-stone-600 disabled:opacity-40"
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
                className="min-h-[44px] min-w-[44px] text-lg leading-none text-stone-600 disabled:opacity-40"
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
              <button type="button" className="underline" onClick={() => setServings(baseServings)}>
                ripristina
              </button>
            </p>
          )}

          {scaledIngredients.length ? (
            <div className="space-y-5">
            {groupBySection(scaledIngredients).map((group, gi) => (
            <div key={`ing-group-${group.startIndex}`}>
            {group.section || gi > 0 ? (
              <h3 className={SECTION_HEADING_CLASS}>{group.section || 'Altri ingredienti'}</h3>
            ) : null}
            <ul>
              {group.entries.map(({ item: ing }) => {
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
            </div>
            ))}
            </div>
          ) : (
            <p className="text-stone-400 text-sm">Nessun ingrediente</p>
          )}
        </section>

        <section
          id={aid('preparazione')}
          className={`rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-md p-4 scroll-mt-24 ${
            compact ? '' : 'sm:p-6'
          }`}
        >
          <h2 className="font-headline text-headline-md text-on-surface mb-4">Preparazione</h2>
          {displaySteps.length ? (
            <div className="space-y-7">
              {groupBySection(displaySteps).map((group, gi) => (
                <div key={`step-group-${group.startIndex}`}>
                  {group.section || gi > 0 ? (
                    <h3 className={`${SECTION_HEADING_CLASS} mb-4`}>{group.section || 'Altri passi'}</h3>
                  ) : null}
                  <ol className="space-y-5">
                    {group.entries.map(({ item: step }) => (
                      <li key={step.id || step.order} className="flex gap-3.5">
                        <span className="shrink-0 w-9 h-9 rounded-full bg-primary-tint text-primary font-mono text-mono-md flex items-center justify-center">
                          {step.order}
                        </span>
                        <div className="pt-1 min-w-0 flex-1 text-[16px] sm:text-[15px] leading-relaxed">
                          <StepInstruction
                            text={step.instruction}
                            timer={{
                              recipeId: current.id,
                              recipeTitle: current.title,
                              stepLabel: `Passo ${step.order}`
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-stone-400 text-sm">Nessun passo</p>
          )}
        </section>
      </div>

      <div className="mt-6">
        <StorageSection
          id={aid('conservazione')}
          storage={current.storage}
          pending={storagePending}
          loading={storageLoading}
          error={storageError}
          onGenerate={handleGenerateStorage}
        />
      </div>

      <div id={aid('extra')} className="mt-4 space-y-4 scroll-mt-24">
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

      </div>

      <div className="mt-4">
        <DiarySection
          id={aid('diario')}
          recipe={current}
          onRecipeChange={applyRecipeUpdate}
          withEdit={withEdit}
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

    </div>
  )
}
