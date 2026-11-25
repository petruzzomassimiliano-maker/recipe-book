import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * No user accounts. This device may hold an "editor" token, obtained once
 * with the family PIN, that unlocks add / edit / delete / import / IA.
 */
let pendingUnlock = []

export const useAuthStore = create(
  persist(
    (set, get) => ({
      editToken: null,
      familyAppName: 'Recipe Book',
      featuredMode: 'random',
      /** Catalog layout on this device: 'dettaglio' (list + preview) or 'caselle' (tiles). */
      recipesView: 'dettaglio',
      unlockOpen: false,

      setEditToken: (editToken) => {
        set({ editToken, unlockOpen: false })
        const resolvers = pendingUnlock
        pendingUnlock = []
        resolvers.forEach((resolve) => resolve(Boolean(editToken)))
      },
      lock: () => set({ editToken: null }),
      setFamilyAppName: (familyAppName) => set({ familyAppName: familyAppName || 'Recipe Book' }),
      setFeaturedMode: (featuredMode) => set({ featuredMode }),
      setRecipesView: (recipesView) => set({ recipesView }),

      /** Opens the PIN dialog; resolves true once unlocked, false if dismissed. */
      requestUnlock: () => {
        if (get().editToken) return Promise.resolve(true)
        return new Promise((resolve) => {
          pendingUnlock.push(resolve)
          set({ unlockOpen: true })
        })
      },
      cancelUnlock: () => {
        set({ unlockOpen: false })
        const resolvers = pendingUnlock
        pendingUnlock = []
        resolvers.forEach((resolve) => resolve(false))
      }
    }),
    {
      name: 'recipe-book-edit',
      partialize: (state) => ({
        editToken: state.editToken,
        familyAppName: state.familyAppName,
        featuredMode: state.featuredMode,
        recipesView: state.recipesView
      })
    }
  )
)

/** Hook: { canEdit, requestUnlock, lock } */
export function useEditAccess() {
  const canEdit = useAuthStore((s) => Boolean(s.editToken))
  const requestUnlock = useAuthStore((s) => s.requestUnlock)
  const lock = useAuthStore((s) => s.lock)
  return { canEdit, requestUnlock, lock }
}
