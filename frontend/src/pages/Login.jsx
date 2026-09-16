import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { getAuthStatus, recoverPassword } from '../services/auth.js'
import { useAuthStore } from '../store/authStore.js'

export default function Login() {
  const { login, isLoading, error, isAuthenticated, familyAppName } = useAuth()
  const setAuth = useAuthStore((s) => s.setAuth)
  const setError = useAuthStore((s) => s.setError)
  const setLoading = useAuthStore((s) => s.setLoading)
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // login | recover
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [recoveryPhrase, setRecoveryPhrase] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [needsSetup, setNeedsSetup] = useState(false)
  const [brand, setBrand] = useState(familyAppName || 'Recipe Book')

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

  useEffect(() => {
    getAuthStatus()
      .then((s) => {
        setNeedsSetup(Boolean(s.needsSetup))
        if (s.familyAppName) setBrand(s.familyAppName)
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await login(username.trim(), password)
    } catch {
      // error in store
    }
  }

  const handleRecover = async (e) => {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirm) {
      setError('Le password non coincidono')
      return
    }
    setLoading(true)
    try {
      const data = await recoverPassword({
        username: username.trim(),
        recoveryPhrase: recoveryPhrase.trim(),
        newPassword
      })
      setAuth({
        jwt: data.jwt,
        user: data.user,
        familyAppName: data.familyAppName || brand,
        mustChangePassword: false
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-secondary/15 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-lg border border-stone-200/80 p-8 sm:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-dark shadow-md mb-4 text-white">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 14c0-4 3-7 8-7s8 3 8 7v1H4v-1Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
                <path d="M8 8V5M12 7V3M16 8V5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="font-display text-3xl font-semibold text-stone-900 tracking-tight">{brand}</h1>
            <p className="mt-2 text-stone-500 text-sm">
              {mode === 'login'
                ? 'Accedi con username e password'
                : 'Recupera l’accesso con la frase di recupero'}
            </p>
          </div>

          {needsSetup && (
            <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
              Prima configurazione richiesta.{' '}
              <Link to="/setup" className="font-semibold underline">
                Collega Dropbox famiglia
              </Link>
            </div>
          )}

          {error && (
            <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
              {/Dropbox famiglia|FAMILY_DROPBOX/i.test(error) && (
                <p className="mt-2">
                  <Link to="/setup" className="font-semibold underline">
                    Vai al setup → collega il Dropbox già configurato
                  </Link>
                </p>
              )}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-stone-700">Username</span>
                <input
                  className="input-field mt-1"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-stone-700">Password</span>
                <input
                  className="input-field mt-1"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <button type="submit" className="btn-primary w-full" disabled={isLoading} aria-busy={isLoading}>
                {isLoading ? 'Accesso…' : 'Entra'}
              </button>
              <p className="text-center">
                <button
                  type="button"
                  className="text-sm text-teal-800 font-medium hover:underline"
                  onClick={() => {
                    setError(null)
                    setMode('recover')
                  }}
                >
                  Password dimenticata?
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRecover} className="space-y-4">
              <p className="text-xs text-stone-500 leading-relaxed rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
                Serve la <strong>frase di recupero</strong> che hai salvato in Impostazioni (vale
                anche per l’account owner). Senza frase, un admin può reimpostarti la password.
              </p>
              <label className="block text-sm">
                <span className="font-medium text-stone-700">Username</span>
                <input
                  className="input-field mt-1"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-stone-700">Frase di recupero</span>
                <input
                  className="input-field mt-1"
                  type="password"
                  autoComplete="off"
                  value={recoveryPhrase}
                  onChange={(e) => setRecoveryPhrase(e.target.value)}
                  required
                  minLength={12}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-stone-700">Nuova password</span>
                <input
                  className="input-field mt-1"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-stone-700">Conferma nuova password</span>
                <input
                  className="input-field mt-1"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </label>
              <button type="submit" className="btn-primary w-full" disabled={isLoading} aria-busy={isLoading}>
                {isLoading ? 'Recupero…' : 'Imposta nuova password ed entra'}
              </button>
              <p className="text-center">
                <button
                  type="button"
                  className="text-sm text-stone-500 hover:underline"
                  onClick={() => {
                    setError(null)
                    setMode('login')
                  }}
                >
                  Torna al login
                </button>
              </p>
            </form>
          )}

          <p className="mt-5 text-center text-xs text-stone-400">
            <Link to="/setup" className="hover:text-stone-700 underline">
              Setup iniziale famiglia
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
