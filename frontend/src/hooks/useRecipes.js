import { useCallback } from 'react'
import { useRecipeStore } from '../store/recipeStore.js'
import * as recipesApi from '../services/recipes.js'

function isLikelyOffline(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = String(err?.message || '').toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('offline') ||
    msg.includes('load failed')
  )
}

export function useRecipes() {
  const {
    recipes,
    selectedRecipe,
    searchFilter,
    isLoading,
    error,
    offlineFallback,
    setRecipes,
    setSelectedRecipe,
    setSearchFilter,
    setLoading,
    setError,
    setOfflineFallback,
    upsertRecipe,
    removeRecipe,
    cacheRecipe,
    getCachedRecipe
  } = useRecipeStore()

  const loadRecipes = useCallback(
    async (q) => {
      setLoading(true)
      try {
        const res = await recipesApi.listRecipes(q ?? searchFilter)
        setRecipes(res.data || [])
        setOfflineFallback(false)
      } catch (err) {
        console.error('[useRecipes.loadRecipes]', err.message)
        const cached = useRecipeStore.getState().recipes
        if (isLikelyOffline(err) && cached?.length) {
          setOfflineFallback(true)
          setError(null)
        } else {
          setError(err.message)
        }
      } finally {
        setLoading(false)
      }
    },
    [searchFilter, setLoading, setRecipes, setError, setOfflineFallback]
  )

  const loadRecipe = useCallback(
    async (id) => {
      setLoading(true)
      setSelectedRecipe(null)
      try {
        const res = await recipesApi.getRecipe(id)
        setSelectedRecipe(res.data)
        cacheRecipe(res.data)
        setOfflineFallback(false)
        return res.data
      } catch (err) {
        console.error('[useRecipes.loadRecipe]', err.message, { id })
        const cached = getCachedRecipe(id)
        if (cached) {
          setSelectedRecipe(cached)
          setOfflineFallback(true)
          setError(null)
          return cached
        }
        setError(err.message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [
      setLoading,
      setSelectedRecipe,
      setError,
      setOfflineFallback,
      cacheRecipe,
      getCachedRecipe
    ]
  )

  const addRecipe = useCallback(
    async (payload) => {
      const res = await recipesApi.createRecipe(payload)
      upsertRecipe(res.data)
      return res.data
    },
    [upsertRecipe]
  )

  const editRecipe = useCallback(
    async (id, payload) => {
      const res = await recipesApi.updateRecipe(id, payload)
      upsertRecipe(res.data)
      return res.data
    },
    [upsertRecipe]
  )

  const remove = useCallback(
    async (id) => {
      removeRecipe(id)
      try {
        await recipesApi.deleteRecipe(id)
      } catch (err) {
        console.error('[useRecipes.deleteRecipe]', err.message)
        setError(err.message)
        try {
          const res = await recipesApi.listRecipes(searchFilter)
          setRecipes(res.data || [])
        } catch {
          // ignore
        }
        throw err
      }
    },
    [removeRecipe, searchFilter, setError, setRecipes]
  )

  return {
    recipes,
    selectedRecipe,
    searchFilter,
    isLoading,
    error,
    offlineFallback,
    setSearchFilter,
    loadRecipes,
    loadRecipe,
    addRecipe,
    editRecipe,
    deleteRecipe: remove
  }
}
