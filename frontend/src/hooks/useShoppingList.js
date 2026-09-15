import { useCallback } from 'react'
import { useShoppingListStore } from '../store/shoppingListStore.js'
import * as api from '../services/shoppingList.js'

export function useShoppingList() {
  const { list, isLoading, error, setList, setLoading, setError, beginMutation, isLatestMutation } =
    useShoppingListStore()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getShoppingList()
      setList(res.data)
    } catch (err) {
      console.error('[useShoppingList.load]', err.message)
      const cached = useShoppingListStore.getState().list
      if (cached && (typeof navigator !== 'undefined' && !navigator.onLine)) {
        setLoading(false)
        return
      }
      setError(err.message)
    }
  }, [setList, setLoading, setError])

  const addItem = useCallback(async (payload) => {
    const res = await api.addShoppingItem(payload)
    setList(res.data)
    return res.data
  }, [setList])

  const addRecipeIngredients = useCallback(async (recipe) => {
    const res = await api.addFromRecipe(recipe)
    setList(res.data)
    return res.data
  }, [setList])

  const runOptimistic = useCallback(
    async (applyOptimistic, request) => {
      const prev = useShoppingListStore.getState().list
      if (!prev) return
      const id = beginMutation()
      setList(applyOptimistic(prev))
      try {
        const res = await request()
        if (isLatestMutation(id)) setList(res.data)
      } catch (err) {
        if (isLatestMutation(id)) {
          setList(prev)
          setError(err.message)
        }
        throw err
      }
    },
    [beginMutation, isLatestMutation, setList, setError]
  )

  const toggleItem = useCallback(
    (itemId, checked) =>
      runOptimistic(
        (prev) => ({
          ...prev,
          items: prev.items.map((i) => (i.id === itemId ? { ...i, checked } : i))
        }),
        () => api.patchShoppingItem(itemId, { checked })
      ),
    [runOptimistic]
  )

  const removeItem = useCallback(
    (itemId) =>
      runOptimistic(
        (prev) => ({
          ...prev,
          items: prev.items.filter((i) => i.id !== itemId)
        }),
        () => api.deleteShoppingItem(itemId)
      ),
    [runOptimistic]
  )

  const removeRecipeItems = useCallback(
    (recipeId) =>
      runOptimistic(
        (prev) => ({
          ...prev,
          items: prev.items.filter((i) => {
            const key = i.recipeId || i.recipeIds?.[0] || null
            return key !== (recipeId ?? null)
          })
        }),
        () => api.clearRecipeItems(recipeId ?? null)
      ),
    [runOptimistic]
  )

  const clearChecked = useCallback(
    () =>
      runOptimistic(
        (prev) => ({
          ...prev,
          items: prev.items.filter((i) => !i.checked)
        }),
        () => api.clearCheckedItems()
      ),
    [runOptimistic]
  )

  return {
    list,
    items: list?.items || [],
    isLoading,
    error,
    load,
    addItem,
    addRecipeIngredients,
    toggleItem,
    removeItem,
    removeRecipeItems,
    clearChecked
  }
}
