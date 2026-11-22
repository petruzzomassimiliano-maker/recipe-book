import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Kitchen timers, device-local. Persisted with absolute end times so they
 * survive a reload or the phone locking the app in the background.
 * A timer is running (`endsAt`), paused (`remainingMs`) or ringing (`ringing`).
 */
let counter = 0
const newId = () => `t${Date.now().toString(36)}${(counter += 1).toString(36)}`

export const useTimerStore = create(
  persist(
    (set) => ({
      timers: [],
      // Cooking mode has a tall bottom bar: lift the dock above it
      raised: false,
      setRaised: (raised) => set({ raised }),
      start: ({ seconds, label, recipeId = null, recipeTitle = '' }) => {
        const id = newId()
        const durationMs = Math.round(seconds * 1000)
        set((s) => ({
          timers: [
            ...s.timers,
            { id, label, recipeId, recipeTitle, durationMs, endsAt: Date.now() + durationMs, remainingMs: null, ringing: false }
          ]
        }))
        return id
      },
      pause: (id) =>
        set((s) => ({
          timers: s.timers.map((t) =>
            t.id === id && t.endsAt ? { ...t, remainingMs: Math.max(0, t.endsAt - Date.now()), endsAt: null } : t
          )
        })),
      resume: (id) =>
        set((s) => ({
          timers: s.timers.map((t) =>
            t.id === id && t.remainingMs != null ? { ...t, endsAt: Date.now() + t.remainingMs, remainingMs: null } : t
          )
        })),
      addTime: (id, ms) =>
        set((s) => ({
          timers: s.timers.map((t) => {
            if (t.id !== id) return t
            if (t.ringing) return { ...t, ringing: false, endsAt: Date.now() + ms, remainingMs: null }
            if (t.endsAt) return { ...t, endsAt: t.endsAt + ms }
            return { ...t, remainingMs: (t.remainingMs || 0) + ms }
          })
        })),
      markRinging: (ids) =>
        set((s) => ({
          timers: s.timers.map((t) => (ids.includes(t.id) ? { ...t, ringing: true, endsAt: null, remainingMs: 0 } : t))
        })),
      remove: (id) => set((s) => ({ timers: s.timers.filter((t) => t.id !== id) }))
    }),
    { name: 'recipe-book-timers', partialize: (s) => ({ timers: s.timers }) }
  )
)

export function remainingMs(timer, now = Date.now()) {
  if (timer.ringing) return 0
  if (timer.endsAt) return Math.max(0, timer.endsAt - now)
  return timer.remainingMs || 0
}

/** Ask once for notification permission (only from a user gesture). */
export function requestTimerNotifications() {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  } catch {
    // ignore
  }
}
