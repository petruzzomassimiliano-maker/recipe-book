import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Device-local preference: keep the screen awake (Wake Lock API).
 * Not synced to Dropbox — each phone/browser has its own setting.
 * `active` / `error` describe the real lock state (not persisted).
 */
export const useKeepAwakeStore = create(
  persist(
    (set) => ({
      enabled: false,
      active: false,
      error: null,
      setEnabled: (enabled) => set({ enabled: Boolean(enabled), error: null }),
      setStatus: (status) => set(status)
    }),
    {
      name: 'recipe-book-keep-awake',
      partialize: (state) => ({ enabled: state.enabled })
    }
  )
)
