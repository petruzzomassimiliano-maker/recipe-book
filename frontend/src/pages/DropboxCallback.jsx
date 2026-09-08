import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

/**
 * DropboxCallback — handles Dropbox OAuth redirect.
 * URL: /dropbox-callback?code=xxx&state=yyy
 * Extracts code param → calls handleCallback → redirects to home.
 */
export default function DropboxCallback() {
  const [searchParams] = useSearchParams()
  const { handleCallback, error } = useAuth()
  const calledRef = useRef(false) // Prevent double-invoke in React StrictMode

  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true

    const code = searchParams.get('code')
    const errorParam = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (errorParam) {
      console.error('[DropboxCallback] OAuth error:', errorParam, errorDescription)
      // Redirect to login with error
      window.location.href = `/login?error=${encodeURIComponent(errorDescription || errorParam)}`
      return
    }

    if (!code) {
      window.location.href = '/login?error=missing_code'
      return
    }

    handleCallback(code)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-orange-50 to-teal-50 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center animate-fade-in">
        {error ? (
          <div className="max-w-sm mx-auto px-4">
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Errore di accesso</h2>
            <p className="text-gray-500 text-sm mb-6">{error}</p>
            <a href="/login" className="btn-primary">
              Riprova
            </a>
          </div>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-primary-dark shadow-lg mb-6">
              <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Connessione in corso...
            </h2>
            <p className="text-gray-500 text-sm">
              Verifica delle credenziali Dropbox
            </p>
          </>
        )}
      </div>
    </div>
  )
}
