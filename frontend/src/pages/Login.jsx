import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

export default function Login() {
  const { login, isLoading, error, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  // Already logged in → redirect to home
  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-orange-50 via-red-50 to-teal-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 px-4">
      {/* Background blobs */}
      <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-secondary/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-tertiary/10 rounded-full blur-2xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Card */}
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-lg border border-white/40 dark:border-gray-700/40 p-8 sm:p-10">

          {/* Logo + title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-primary-dark shadow-lg mb-4">
              <span className="text-4xl" role="img" aria-label="chef's hat">🍳</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              Recipe Book
            </h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm">
              Il tuo ricettario di famiglia intelligente
            </p>
          </div>

          {/* Feature badges */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {['🤖 IA riconosce ricette', '📊 Calorie auto', '🛒 Lista spesa', '👨‍👩‍👧 Multi-utente'].map((feat) => (
              <span
                key={feat}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-medium text-gray-600 dark:text-gray-400"
              >
                {feat}
              </span>
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div
              role="alert"
              className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400"
            >
              <strong>Errore:</strong> {error}
            </div>
          )}

          {/* Login button */}
          <button
            id="btn-login-dropbox"
            onClick={login}
            disabled={isLoading}
            aria-busy={isLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl
                       bg-gradient-to-r from-primary to-primary-dark text-white font-semibold text-base
                       shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95
                       transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-4 focus:ring-primary/30"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Connessione...</span>
              </>
            ) : (
              <>
                {/* Dropbox icon */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 14.56l-4.44-2.84L12 9l4.44 2.72L12 14.56zm-5.77-3.32L2 8.5l4.23-2.72L12 9l-5.77 2.24zM6.23 15l-4.23-2.72 4.23-2.72 4.23 2.72L6.23 15zm11.54 0l-4.23-2.72 4.23-2.72 4.23 2.72L17.77 15zM12 14.56l5.77 2.24L12 19 6.23 16.8 12 14.56z"/>
                </svg>
                <span>Continua con Dropbox</span>
              </>
            )}
          </button>

          <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-600">
            Connettendo Dropbox autorizzi l'accesso alla cartella{' '}
            <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">/Apps/Recipe Book</code>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-400">
          Recipe Book PWA · Powered by Dropbox + Gemini AI
        </p>
      </div>
    </div>
  )
}
