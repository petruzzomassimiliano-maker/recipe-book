import { useEffect, useRef } from 'react'
import { useKeepAwakeStore } from '../../store/keepAwakeStore.js'

function isWakeLockSupported() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator
}

function explain(err) {
  if (err?.name === 'NotAllowedError') {
    return 'Il dispositivo ha negato la richiesta (risparmio energetico attivo o permessi del browser).'
  }
  return err?.message || 'Richiesta non riuscita'
}

/**
 * Keeps the screen on while `enabled` is true (Screen Wake Lock API).
 * Mounted once in the app shell. Re-acquires the lock when the app comes back
 * to the foreground, when the system drops it while still visible, and on the
 * first tap if the initial request was refused (some browsers want a gesture).
 * Publishes the real state (active / error) to the store for the Settings UI.
 */
export default function KeepAwakeController() {
  const enabled = useKeepAwakeStore((s) => s.enabled)
  const setStatus = useKeepAwakeStore((s) => s.setStatus)
  const lockRef = useRef(null)

  useEffect(() => {
    if (!enabled || !isWakeLockSupported()) {
      const current = lockRef.current
      lockRef.current = null
      if (current) current.release().catch(() => {})
      setStatus({ active: false, error: null })
      return undefined
    }

    let cancelled = false
    let pending = false
    let retryTimer = null

    const acquire = async () => {
      if (cancelled || pending || lockRef.current) return
      if (document.visibilityState !== 'visible') return
      pending = true
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          lock.release().catch(() => {})
          return
        }
        lockRef.current = lock
        setStatus({ active: true, error: null })
        lock.addEventListener('release', () => {
          if (lockRef.current === lock) lockRef.current = null
          setStatus({ active: false })
          // Dropped by the system while we're still on screen → ask again
          if (!cancelled && document.visibilityState === 'visible') {
            clearTimeout(retryTimer)
            retryTimer = setTimeout(acquire, 1000)
          }
        })
      } catch (err) {
        console.warn('[keepAwake] request failed:', err?.message || err)
        setStatus({ active: false, error: explain(err) })
      } finally {
        pending = false
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire()
    }
    // Some browsers only grant the lock after a user gesture
    const onTap = () => {
      if (!lockRef.current) acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onVisibility)
    window.addEventListener('pointerdown', onTap, { passive: true })

    return () => {
      cancelled = true
      clearTimeout(retryTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onVisibility)
      window.removeEventListener('pointerdown', onTap)
      const current = lockRef.current
      lockRef.current = null
      if (current) current.release().catch(() => {})
      setStatus({ active: false })
    }
  }, [enabled, setStatus])

  return null
}

export { isWakeLockSupported }
