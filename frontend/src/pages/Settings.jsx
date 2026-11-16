import { useEffect, useState } from 'react'
import { useAuthStore, useEditAccess } from '../store/authStore.js'
import { useKeepAwakeStore } from '../store/keepAwakeStore.js'
import { isWakeLockSupported } from '../components/common/KeepAwakeController.jsx'
import { apiFetch } from '../services/api.js'

export default function Settings() {
  const familyAppName = useAuthStore((s) => s.familyAppName)
  const setFamilyAppName = useAuthStore((s) => s.setFamilyAppName)
  const featuredMode = useAuthStore((s) => s.featuredMode)
  const setFeaturedMode = useAuthStore((s) => s.setFeaturedMode)
  const { canEdit, requestUnlock, lock } = useEditAccess()

  const [familyName, setFamilyName] = useState(familyAppName || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  const keepAwake = useKeepAwakeStore((s) => s.enabled)
  const setKeepAwake = useKeepAwakeStore((s) => s.setEnabled)
  const keepAwakeActive = useKeepAwakeStore((s) => s.active)
  const keepAwakeError = useKeepAwakeStore((s) => s.error)
  const wakeLockOk = isWakeLockSupported()

  useEffect(() => {
    setFamilyName(familyAppName || '')
  }, [familyAppName])

  const saveFamilyName = async (e) => {
    e.preventDefault()
    setMsg(null)
    setErr(null)
    if (!(await requestUnlock())) return
    setBusy(true)
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ familyAppName: familyName })
      })
      setFamilyAppName(res.data.familyAppName)
      setMsg('Nome salvato')
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-8 animate-fade-in space-y-5 sm:space-y-8">
      <h1 className="page-title">Impostazioni</h1>

      {msg && (
        <p className="text-sm text-teal-700 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2">{msg}</p>
      )}
      {err && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2" role="alert">
          {err}
        </p>
      )}

      <section className="card p-4 sm:p-6 space-y-3">
        <h2 className="section-title">Modifiche</h2>
        <p className="text-sm text-stone-500 leading-relaxed">
          Tutti possono consultare le ricette. Per aggiungere, modificare, importare o usare l’IA
          serve il PIN di famiglia; questo dispositivo lo ricorda finché non lo blocchi.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-medium ${
              canEdit ? 'bg-teal-50 text-teal-800' : 'bg-stone-100 text-stone-600'
            }`}
          >
            {canEdit ? 'Sbloccato su questo dispositivo' : 'Solo lettura'}
          </span>
          {canEdit ? (
            <button type="button" className="btn-secondary !py-2.5 !px-4 text-sm" onClick={lock}>
              Blocca modifiche
            </button>
          ) : (
            <button type="button" className="btn-primary !py-2.5 !px-4 text-sm" onClick={requestUnlock}>
              Inserisci PIN
            </button>
          )}
        </div>
      </section>

      <section className="card p-4 sm:p-6 space-y-3">
        <h2 className="section-title">Home</h2>
        <label className="block text-sm">
          <span className="text-stone-600">Ricetta in evidenza (vale solo su questo dispositivo)</span>
          <select
            className="input-field mt-1"
            value={featuredMode || 'random'}
            onChange={(e) => setFeaturedMode(e.target.value)}
          >
            <option value="random">Casuale a ogni visita</option>
            <option value="latest">Ultima aggiornata</option>
            <option value="oldest">Più vecchia</option>
          </select>
        </label>
      </section>

      <section className="card p-4 sm:p-6 space-y-3">
        <h2 className="section-title">Schermo</h2>
        <p className="text-sm text-stone-500 leading-relaxed">
          Utile mentre cucini: evita che il telefono si spenga da solo. Vale solo su questo
          dispositivo.
        </p>
        <label
          className={`flex items-center justify-between gap-4 min-h-[52px] rounded-xl border px-3.5 py-2.5 ${
            wakeLockOk
              ? 'border-stone-200 bg-stone-50/80 cursor-pointer'
              : 'border-stone-100 bg-stone-50/50 opacity-70'
          }`}
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium text-stone-800">Tieni lo schermo acceso</span>
            <span className="block text-xs text-stone-500 mt-0.5">
              {!wakeLockOk
                ? 'Non supportato da questo browser (su iPhone serve iOS 16.4 o successivo)'
                : !keepAwake
                  ? 'Disattivo'
                  : keepAwakeActive
                    ? 'Attivo: lo schermo resta acceso mentre l’app è aperta'
                    : keepAwakeError
                      ? 'Non attivo: tocca lo schermo per riprovare'
                      : 'In attivazione…'}
            </span>
          </span>
          <input
            type="checkbox"
            className="sr-only peer"
            checked={keepAwake}
            disabled={!wakeLockOk}
            onChange={(e) => setKeepAwake(e.target.checked)}
            aria-label="Tieni lo schermo acceso"
          />
          <span
            aria-hidden
            className={`relative shrink-0 w-11 h-7 rounded-full transition-colors ${
              keepAwake && wakeLockOk ? 'bg-primary' : 'bg-stone-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                keepAwake && wakeLockOk ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </span>
        </label>
        {wakeLockOk && keepAwake && keepAwakeError && (
          <p className="text-xs text-amber-700 leading-relaxed" role="alert">
            {keepAwakeError}
          </p>
        )}
        {wakeLockOk && keepAwake && (
          <p className="text-xs text-stone-400 leading-relaxed">
            Se metti l’app in background lo schermo può spegnersi; tornando qui si riattiva da solo.
          </p>
        )}
      </section>

      <section className="card p-4 sm:p-6 space-y-3">
        <h2 className="section-title">Nome dell’app</h2>
        <form onSubmit={saveFamilyName} className="space-y-3">
          <label className="block text-sm">
            <span className="text-stone-600">Visibile a tutti in alto (richiede PIN)</span>
            <input
              className="input-field mt-1"
              value={familyName}
              maxLength={60}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="Recipe Book"
            />
          </label>
          <button
            type="submit"
            className="btn-primary !py-2.5 !px-4 text-sm w-full sm:w-auto"
            disabled={busy || !familyName.trim() || familyName.trim() === familyAppName}
          >
            {busy ? 'Salvataggio…' : 'Salva nome'}
          </button>
        </form>
      </section>
    </main>
  )
}
