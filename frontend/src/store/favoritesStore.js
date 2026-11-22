import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Favourite recipes — device-local (no accounts): each phone/browser has its own.
 * Stored as an array of recipe ids, newest first.
 */
export const useFavoritesStore = create(
  persist(
    (set, get) => ({
      ids: [],
      isFavorite: (id) => get().ids.includes(id),
      toggle: (id) =>
        set((state) => ({
          ids: state.ids.includes(id) ? state.ids.filter((x) => x !== id) : [id, ...state.ids]
        })),
      setAll: (ids) => set({ ids: [...new Set((ids || []).filter((x) => typeof x === 'string'))] })
    }),
    { name: 'recipe-book-favorites' }
  )
)

export function useIsFavorite(id) {
  return useFavoritesStore((s) => s.ids.includes(id))
}
