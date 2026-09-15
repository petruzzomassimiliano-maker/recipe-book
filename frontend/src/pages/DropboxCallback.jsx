import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

export default function DropboxCallback() {
  const [searchParams] = useSearchParams()
  const { finishDropboxSetup, error } = useAuth()
  const calledRef = useRef(false)

  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true

    const code = searchParams.get('code')
    const errorParam = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (errorParam) {
      window.location.href = `/setup?error=${encodeURIComponent(errorDescription || errorParam)}`
      return
    }
    if (!code) {
      window.location.href = '/setup?error=missing_code'
      return
    }
    finishDropboxSetup(code)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-dvh flex items-center justify-center">
      <div className="text-center animate-fade-in">
        {error ? (
          <div className="max-w-sm mx-auto px-4">
            <h2 className="font-display text-xl font-semibold text-stone-900 mb-2">Errore setup</h2>
            <p className="text-stone-500 text-sm mb-6">{error}</p>
            <a href="/setup" className="btn-primary">
              Riprova
            </a>
          </div>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dark shadow-lg mb-6">
              <svg className="animate-spin h-7 w-7 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h2 className="font-display text-xl font-semibold text-stone-900 mb-2">Dropbox famiglia…</h2>
            <p className="text-stone-500 text-sm">Configurazione in corso</p>
          </>
        )}
      </div>
    </div>
  )
}
