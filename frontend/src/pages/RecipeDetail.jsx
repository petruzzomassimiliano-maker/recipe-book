import { useCallback, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import RecipeDetailPane from '../components/recipe/RecipeDetailPane.jsx'
import SplitRecipePicker from '../components/recipe/SplitRecipePicker.jsx'
import { useIsDesktopSplit } from '../hooks/useRecipeById.js'

/**
 * Recipe detail page with optional desktop-only split view.
 * URL: /recipes/:id?split=<otherId|pick>
 * Below lg breakpoint, split params are ignored (single pane).
 */
export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isDesktop = useIsDesktopSplit(1024)

  const splitRaw = searchParams.get('split')
  const splitActive = isDesktop && splitRaw != null && splitRaw !== ''
  const splitId = splitActive && splitRaw !== 'pick' ? splitRaw : null
  const picking = splitActive && (splitRaw === 'pick' || !splitId)

  const openSplitPicker = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('split', 'pick')
        return next
      },
      { replace: false }
    )
  }, [setSearchParams])

  const closeSplit = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('split')
        return next
      },
      { replace: true }
    )
  }, [setSearchParams])

  const setSplitRecipe = useCallback(
    (otherId) => {
      if (!otherId || otherId === id) return
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('split', otherId)
          return next
        },
        { replace: false }
      )
    },
    [id, setSearchParams]
  )

  const swapPanes = useCallback(() => {
    if (!splitId) return
    navigate(`/recipes/${splitId}?split=${encodeURIComponent(id)}`, { replace: false })
  }, [navigate, id, splitId])

  const leftActions = useMemo(() => {
    if (!isDesktop) return null
    if (splitActive) {
      return (
        <>
          {splitId ? (
            <button
              type="button"
              className="btn-secondary !py-2.5 !px-4 text-sm"
              onClick={swapPanes}
              title="Scambia le due ricette"
            >
              Scambia
            </button>
          ) : null}
          <button
            type="button"
            className="btn-secondary !py-2.5 !px-4 text-sm"
            onClick={closeSplit}
          >
            Chiudi split
          </button>
        </>
      )
    }
    return (
      <button
        type="button"
        className="btn-secondary !py-2.5 !px-4 text-sm hidden lg:inline-flex"
        onClick={openSplitPicker}
      >
        Apri a fianco
      </button>
    )
  }, [isDesktop, splitActive, splitId, swapPanes, closeSplit, openSplitPicker])

  if (!splitActive) {
    return (
      <RecipeDetailPane
        recipeId={id}
        showBack
        headerActions={leftActions}
      />
    )
  }

  return (
    <main className="h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] max-w-[100vw] animate-fade-in">
      <div className="grid grid-cols-2 h-full divide-x divide-stone-200/80">
        <section className="min-w-0 h-full overflow-y-auto overscroll-contain px-4 py-4 lg:px-5">
          <RecipeDetailPane
            recipeId={id}
            compact
            showBack
            idPrefix="left"
            headerActions={leftActions}
            onDeleted={() => navigate('/recipes')}
          />
        </section>

        <section className="min-w-0 h-full overflow-y-auto overscroll-contain bg-stone-50/40">
          {picking ? (
            <SplitRecipePicker
              excludeId={id}
              onSelect={setSplitRecipe}
              onCancel={closeSplit}
            />
          ) : (
            <div className="px-4 py-4 lg:px-5">
              <div className="flex items-center justify-end gap-1 mb-1">
                <button
                  type="button"
                  className="inline-flex items-center min-h-[36px] px-2 text-xs font-medium text-stone-500 hover:text-stone-800"
                  onClick={openSplitPicker}
                >
                  Cambia ricetta
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center min-h-[36px] min-w-[36px] rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100"
                  onClick={closeSplit}
                  aria-label="Chiudi split view"
                  title="Chiudi"
                >
                  ✕
                </button>
              </div>
              <RecipeDetailPane
                recipeId={splitId}
                compact
                showBack={false}
                idPrefix="right"
                onDeleted={closeSplit}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
