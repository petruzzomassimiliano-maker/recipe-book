import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useShoppingListStore = create(
  persist(
    (set, get) => ({
      list: null,
      isLoading: false,
      error: null,
      mutationId: 0,

      setList: (list) => set({ list, error: null, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error, isLoading: false }),

      beginMutation: () => {
        const mutationId = get().mutationId + 1
        set({ mutationId })
        return mutationId
      },

      isLatestMutation: (id) => get().mutationId === id
    }),
    {
      name: 'recipe-book-shopping',
      partialize: (state) => ({ list: state.list })
    }
  )
)
