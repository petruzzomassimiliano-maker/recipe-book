import { useEffect, useState } from 'react'
import { getRecipe } from '../services/recipes.js'
import { useRecipeStore } from '../store/recipeStore.js'

/**
 * Load one recipe by id without touching the global selectedRecipe.
 * Enables side-by-side split view (two panes at once).
 */
export function useRecipeById(id) {
  const cacheRecipe = useRecipeStore((s) => s.cacheRecipe)
  const getCachedRecipe = useRecipeStore((s) => s.getCachedRecipe)
  const recipes = useRecipeStore((s) => s.recipes)

  const [recipe, setRecipe] = useState(null)
  const [isLoading, setLoading] = useState(Boolean(id))
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) {
      setRecipe(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const res = await getRecipe(id)
        if (cancelled) return
        setRecipe(res.data)
        cacheRecipe(res.data)
      } catch (err) {
        if (cancelled) return
        const cached = getCachedRecipe(id)
        if (cached) {
          setRecipe(cached)
          setError(null)
        } else {
          setRecipe(null)
          setError(err.message || 'Caricamento fallito')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, cacheRecipe, getCachedRecipe])

  const indexEntry = recipes?.find((r) => r.id === id) || null

  return { recipe, setRecipe, isLoading, error, indexEntry }
}

export function useIsDesktopSplit(minWidth = 1024) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(`(min-width: ${minWidth}px)`).matches
  })

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [minWidth])

  return matches
}
