import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

export default function Setup() {
  const { startFamilySetup, importExistingDropbox, isLoading, error, setupEnvHint } = useAuth()
  const [showPaste, setShowPaste] = useState(false)
  const [pasteToken, setPasteToken] = useState('')
  const [localError, setLocalError] = useState(null)

  const handleImport = async (e) => {
    e.preventDefault()
    setLocalError(null)
    try {
      await importExistingDropbox(pasteToken.trim())
    } catch (err) {
      setLocalError(err.message)
    }
  }

  const displayError = localError || error

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg card p-8 animate-fade-in">
        <h1 className="page-title mb-2">Setup famiglia</h1>
        <p className="text-sm text-stone-500 leading-relaxed mb-4">
          Useremo <strong>lo stesso Dropbox</strong> già collegato (cartella App → Recipe Book) come
          database per tutta la famiglia. Non serve un altro account Dropbox.
        </p>
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-6">
          Il messaggio «Dropbox famiglia non configurato» compare perché manca la riga{' '}
          <code className="text-xs">FAMILY_DROPBOX_REFRESH_TOKEN</code> in{' '}
          <code className="text-xs">worker/.dev.vars</code>. Serve collegarlo una volta (sotto),
          copiare il token e riavviare il worker.
        </p>

        {displayError && (
          <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {displayError}
          </div>
        )}

        {setupEnvHint && (
          <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 break-all">
            Aggiungi in <code>worker/.dev.vars</code> poi riavvia il worker:
            <br />
            <code>{setupEnvHint}</code>
          </div>
        )}

        <ol className="text-sm text-stone-600 space-y-2 mb-6 list-decimal pl-5">
          <li>
            Autorizza Dropbox (è la stessa app: le ricette già salvate restano)
          </li>
          <li>Copia la riga <code>FAMILY_DROPBOX_REFRESH_TOKEN=…</code> in <code>.dev.vars</code></li>
          <li>Riavvia il worker (<code>npm run dev</code> / wrangler)</li>
          <li>Crea username e password owner</li>
        </ol>

        <button
          type="button"
          className="btn-primary w-full"
          onClick={startFamilySetup}
          disabled={isLoading}
        >
          {isLoading ? 'Reindirizzamento…' : 'Collega questo Dropbox (consigliato)'}
        </button>

        <div className="mt-5 pt-5 border-t border-stone-100">
          <button
            type="button"
            className="text-sm text-stone-500 hover:text-stone-800 underline"
            onClick={() => setShowPaste((v) => !v)}
          >
            {showPaste ? 'Nascondi' : 'Ho già un refresh token — incollalo'}
          </button>
          {showPaste && (
            <form onSubmit={handleImport} className="mt-3 space-y-3">
              <textarea
                className="input-field text-xs font-mono min-h-[88px]"
                placeholder="FAMILY_DROPBOX_REFRESH_TOKEN=… oppure solo il token"
                value={pasteToken}
                onChange={(e) => setPasteToken(e.target.value)}
                required
              />
              <button type="submit" className="btn-secondary w-full !py-2.5 text-sm" disabled={isLoading}>
                Usa questo token
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-stone-500 hover:text-stone-800">
            Torna al login
          </Link>
        </p>
      </div>
    </main>
  )
}
