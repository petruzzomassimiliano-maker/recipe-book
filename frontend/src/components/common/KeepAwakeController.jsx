import { useEffect, useRef, useState } from 'react'
import { useKeepAwakeStore } from '../../store/keepAwakeStore.js'

function isWakeLockSupported() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator
}

/**
 * Keeps the screen on while `enabled` is true (Screen Wake Lock API).
 * Mount once inside the authenticated shell (AuthGuard).
 * Safe no-op when unsupported or when the tab is backgrounded.
 */
export default function KeepAwakeController() {
  const enabled = useKeepAwakeStore((s) => s.enabled)
  const lockRef = useRef(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!enabled || !isWakeLockSupported()) {
      const current = lockRef.current
      lockRef.current = null
      if (current) {
        current.release().catch(() => {})
      }
      return undefined
    }

    let cancelled = false

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return
      try {
        // Release previous sentinel if any
        if (lockRef.current) {
          try {
            await lockRef.current.release()
          } catch {
            // ignore
          }
          lockRef.current = null
        }
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          lock.release().catch(() => {})
          return
        }
        lockRef.current = lock
        lock.addEventListener('release', () => {
          if (lockRef.current === lock) lockRef.current = null
          setTick((n) => n + 1)
        })
        setTick((n) => n + 1)
      } catch (err) {
        console.warn('[keepAwake] request failed:', err?.message || err)
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      const current = lockRef.current
      lockRef.current = null
      if (current) current.release().catch(() => {})
    }
  }, [enabled])

  return null
}

export { isWakeLockSupported }
