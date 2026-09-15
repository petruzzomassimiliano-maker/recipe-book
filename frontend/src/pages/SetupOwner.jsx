import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

export default function SetupOwner() {
  const { completeOwnerSetup, isLoading, error, setupEnvHint } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [familyAppName, setFamilyAppName] = useState('Recipe Book')
  const envHint = setupEnvHint || sessionStorage.getItem('family_env_hint')

  useEffect(() => {
    if (!sessionStorage.getItem('family_setup_ticket')) {
      navigate('/setup', { replace: true })
    }
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await completeOwnerSetup({
        username,
        displayName: displayName || username,
        email,
        password,
        familyAppName
      })
    } catch {
      // store error
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg card p-8 animate-fade-in">
        <h1 className="page-title mb-2">Crea account owner</h1>
        <p className="text-sm text-stone-500 mb-6">
          Sei l’amministratore principale. Solo tu potrai rimuovere altri admin.
        </p>

        {envHint && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950">
            <p className="font-semibold mb-1">Obbligatorio prima di riavviare il worker</p>
            <p className="mb-2">
              Aggiungi questa riga in <code>worker/.dev.vars</code> (è lo stesso Dropbox / stesse
              ricette):
            </p>
            <code className="block break-all bg-white/80 p-2 rounded-lg border border-amber-100">
              {envHint}
            </code>
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                className="text-amber-800 font-medium underline"
                onClick={() => navigator.clipboard?.writeText(envHint)}
              >
                Copia riga
              </button>
              <button
                type="button"
                className="text-amber-800 font-medium underline"
                onClick={() =>
                  navigator.clipboard?.writeText(
                    `node scripts/set-family-dropbox-token.mjs '${envHint.replace(/'/g, "'\\''")}'`
                  )
                }
              >
                Copia comando script
              </button>
            </div>
            <p className="mt-2 text-amber-800/90">
              Poi riavvia il worker. Senza questa riga, al prossimo restart tornerà «Dropbox famiglia
              non configurato».
            </p>
          </div>
        )}

        {error && (
          <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="font-medium text-stone-700">Nome app famiglia</span>
            <input
              className="input-field mt-1"
              value={familyAppName}
              onChange={(e) => setFamilyAppName(e.target.value)}
              placeholder="Ricette di casa"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-700">Username</span>
            <input
              className="input-field mt-1"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              pattern="[a-zA-Z0-9._\-]{3,32}"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-700">Nome visualizzato</span>
            <input
              className="input-field mt-1"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-700">Email (opzionale)</span>
            <input
              className="input-field mt-1"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-700">Password</span>
            <input
              className="input-field mt-1"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          <button type="submit" className="btn-primary w-full" disabled={isLoading}>
            {isLoading ? 'Creazione…' : 'Crea owner e entra'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          <Link to="/setup" className="text-stone-500 hover:underline">
            Indietro
          </Link>
        </p>
      </div>
    </main>
  )
}
