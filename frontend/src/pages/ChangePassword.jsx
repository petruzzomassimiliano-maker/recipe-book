import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useAuthStore } from '../store/authStore.js'

export default function ChangePassword() {
  const { changePassword, isLoading, error, isAuthenticated, mustChangePassword } = useAuth()
  const setError = useAuthStore((s) => s.setError)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  if (!isAuthenticated) return <Navigate to="/login" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirm) {
      setError('Le password non coincidono')
      return
    }
    try {
      await changePassword(mustChangePassword ? '' : currentPassword, newPassword)
    } catch {
      // store
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-md card p-8">
        <h1 className="page-title mb-2">Cambia password</h1>
        <p className="text-sm text-stone-500 mb-6">
          {mustChangePassword
            ? 'Al primo accesso devi impostare una password personale.'
            : 'Aggiorna la tua password.'}
        </p>
        {error && (
          <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!mustChangePassword && (
            <label className="block text-sm">
              <span className="font-medium text-stone-700">Password attuale</span>
              <input
                className="input-field mt-1"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="font-medium text-stone-700">Nuova password</span>
            <input
              className="input-field mt-1"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-700">Conferma</span>
            <input
              className="input-field mt-1"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              required
            />
          </label>
          <button type="submit" className="btn-primary w-full" disabled={isLoading}>
            {isLoading ? 'Salvataggio…' : 'Salva password'}
          </button>
        </form>
      </div>
    </main>
  )
}
