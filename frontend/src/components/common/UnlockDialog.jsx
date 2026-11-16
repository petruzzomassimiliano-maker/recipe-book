import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../../store/authStore.js'
import { unlockWithPin } from '../../services/auth.js'

/** Family PIN prompt — opened via useAuthStore.requestUnlock(). */
export default function UnlockDialog() {
  const open = useAuthStore((s) => s.unlockOpen)
  const cancel = useAuthStore((s) => s.cancelUnlock)
  const setEditToken = useAuthStore((s) => s.setEditToken)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setPin('')
    setError(null)
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    const onKey = (e) => {
      if (e.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, cancel])

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    if (!pin.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const token = await unlockWithPin(pin.trim())
      setEditToken(token)
    } catch (err) {
      setError(err.message)
      setPin('')
      inputRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unlock-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) cancel()
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl animate-fade-in"
      >
        <h2 id="unlock-title" className="font-display text-xl font-semibold text-stone-900">
          PIN di famiglia
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Serve per aggiungere, modificare o importare ricette. Questo dispositivo lo ricorderà.
        </p>
        <input
          ref={inputRef}
          type="password"
          inputMode="text"
          autoComplete="current-password"
          className="input-field mt-4"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          aria-label="PIN di famiglia"
        />
        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="mt-4 flex gap-2 justify-end">
          <button type="button" className="btn-secondary !py-2.5 !px-4 text-sm" onClick={cancel}>
            Annulla
          </button>
          <button
            type="submit"
            className="btn-primary !py-2.5 !px-4 text-sm"
            disabled={busy || !pin.trim()}
          >
            {busy ? 'Verifica…' : 'Sblocca'}
          </button>
        </div>
      </form>
    </div>
  )
}
