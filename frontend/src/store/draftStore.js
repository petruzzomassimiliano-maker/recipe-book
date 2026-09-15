import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Draft persistence — same pattern as EN Writing Coach Writing Practice:
 * Zustand slice + localStorage. Survives route changes AND full reload.
 * Cleared only on explicit save / discard.
 */
export const useDraftStore = create(
  persist(
    (set, get) => ({
      drafts: {},

      setDraft: (key, value) => {
        if (!key) return
        set((state) => ({
          drafts: {
            ...state.drafts,
            [key]: { value, updatedAt: Date.now() }
          }
        }))
      },

      clearDraft: (key) => {
        if (!key) return
        set((state) => {
          if (!(key in state.drafts)) return state
          const drafts = { ...state.drafts }
          delete drafts[key]
          return { drafts }
        })
      },

      getDraft: (key) => {
        if (!key) return null
        return get().drafts[key] || null
      }
    }),
    {
      name: 'recipe-book-drafts',
      partialize: (state) => ({ drafts: state.drafts })
    }
  )
)

export function draftKey(name) {
  return `rb-draft:${name}`
}

export function clearDraft(key) {
  useDraftStore.getState().clearDraft(key)
}

export function readDraft(key) {
  return useDraftStore.getState().getDraft(key)
}

export function writeDraft(key, payload) {
  useDraftStore.getState().setDraft(key, payload?.value !== undefined ? payload.value : payload)
}
