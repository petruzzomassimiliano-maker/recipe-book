import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Device-local preference: keep the screen awake (Wake Lock API).
 * Not synced to Dropbox — each phone/browser has its own setting.
 */
export const useKeepAwakeStore = create(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (enabled) => set({ enabled: Boolean(enabled) })
    }),
    {
      name: 'recipe-book-keep-awake',
      partialize: (state) => ({ enabled: state.enabled })
    }
  )
)
