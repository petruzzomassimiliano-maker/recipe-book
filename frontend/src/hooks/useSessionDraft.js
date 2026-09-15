import { useCallback, useEffect, useRef, useState } from 'react'
import { clearDraft, draftKey, readDraft, useDraftStore, writeDraft } from '../store/draftStore.js'

export { clearDraft, draftKey, readDraft, writeDraft }

function waitForHydration() {
  if (useDraftStore.persist.hasHydrated()) return Promise.resolve()
  return new Promise((resolve) => {
    const unsub = useDraftStore.persist.onFinishHydration(() => {
      unsub?.()
      resolve()
    })
  })
}

/**
 * Persist React state in Zustand → localStorage (survives navigation + reload).
 * Waits for Zustand rehydration so we don't overwrite a saved draft with empties.
 * Cleared only via clear() / discardRestored() — same lifecycle as Writing Practice.
 */
export function useSessionDraft(key, initialValue) {
  const clearedRef = useRef(false)
  const [hydrated, setHydrated] = useState(() => useDraftStore.persist.hasHydrated())
  const [state, setState] = useState(() => {
    if (!useDraftStore.persist.hasHydrated()) {
      const value = typeof initialValue === 'function' ? initialValue() : initialValue
      return { value, restored: false, pendingHydration: true }
    }
    const saved = readDraft(key)
    if (saved && Object.prototype.hasOwnProperty.call(saved, 'value')) {
      return { value: saved.value, restored: true, pendingHydration: false }
    }
    const value = typeof initialValue === 'function' ? initialValue() : initialValue
    return { value, restored: false, pendingHydration: false }
  })

  useEffect(() => {
    let cancelled = false
    waitForHydration().then(() => {
      if (cancelled) return
      setHydrated(true)
      if (clearedRef.current) return
      const saved = readDraft(key)
      if (saved && Object.prototype.hasOwnProperty.call(saved, 'value')) {
        setState({ value: saved.value, restored: true, pendingHydration: false })
      } else {
        setState((prev) => ({ ...prev, pendingHydration: false }))
      }
    })
    return () => {
      cancelled = true
    }
  }, [key])

  useEffect(() => {
    if (!hydrated || !key || clearedRef.current || state.pendingHydration) return
    writeDraft(key, { value: state.value })
  }, [hydrated, key, state.value, state.pendingHydration])

  const setValue = useCallback((next) => {
    clearedRef.current = false
    setState((prev) => ({
      value: typeof next === 'function' ? next(prev.value) : next,
      restored: false,
      pendingHydration: false
    }))
  }, [])

  const clear = useCallback(() => {
    clearedRef.current = true
    clearDraft(key)
  }, [key])

  const discardRestored = useCallback(() => {
    clearedRef.current = true
    const value = typeof initialValue === 'function' ? initialValue() : initialValue
    clearDraft(key)
    setState({ value, restored: false, pendingHydration: false })
  }, [key, initialValue])

  return {
    value: state.value,
    setValue,
    restored: state.restored,
    clear,
    discardRestored,
    hydrated
  }
}
