import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { acceptInvite, getInvitePreview } from '../services/auth.js'
import { useAuthStore } from '../store/authStore.js'

export default function InviteAccept() {
  const { token } = useParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  useEffect(() => {
    if (!token) return
    setLoading(true)
    getInvitePreview(token)
      .then(setPreview)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  if (isAuthenticated) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Le password non coincidono')
      return
    }
    setSaving(true)
    try {
      const data = await acceptInvite(token, password)
      setAuth({
        jwt: data.jwt,
        user: data.user,
        familyAppName: data.familyAppName,
        mustChangePassword: false
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md card p-8 animate-fade-in">
        <h1 className="page-title mb-2">Attiva account</h1>
        {loading ? (
          <p className="text-sm text-stone-500">Verifica invito…</p>
        ) : preview ? (
          <>
            <p className="text-sm text-stone-500 mb-6">
              Benvenuto in <strong>{preview.familyAppName || 'Recipe Book'}</strong>
              {preview.displayName ? ` — ${preview.displayName}` : ''}. Scegli la password per{' '}
              <code className="text-xs bg-stone-100 px-1 rounded">@{preview.username}</code>.
            </p>
            {error && (
              <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-stone-700">Nuova password</span>
                <input
                  className="input-field mt-1"
                  type="password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-stone-700">Conferma</span>
                <input
                  className="input-field mt-1"
                  type="password"
                  minLength={8}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <button type="submit" className="btn-primary w-full" disabled={saving}>
                {saving ? 'Attivazione…' : 'Attiva e entra'}
              </button>
            </form>
          </>
        ) : (
          <div>
            <p className="text-sm text-red-700 mb-4" role="alert">
              {error || 'Invito non valido'}
            </p>
            <Link to="/login" className="text-sm text-stone-500 underline">
              Vai al login
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
