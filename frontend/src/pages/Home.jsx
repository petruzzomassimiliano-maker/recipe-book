import { useAuth } from '../hooks/useAuth.js'

export default function Home() {
  const { user, logout } = useAuth()

  const quickActions = [
    { emoji: '📸', label: 'Foto → Ricetta', desc: 'Carica immagine · Gemini riconosce', color: 'from-orange-400 to-red-400', disabled: true },
    { emoji: '🔗', label: 'URL → Ricetta', desc: 'Incolla link · scraper auto', color: 'from-teal-400 to-cyan-400', disabled: true },
    { emoji: '✍️', label: 'Aggiungi manuale', desc: 'Form guidato', color: 'from-yellow-400 to-orange-400', disabled: true },
    { emoji: '🛒', label: 'Lista spesa', desc: 'Ingredienti automatici', color: 'from-purple-400 to-indigo-400', disabled: true }
  ]

  return (
    <div className="min-h-dvh bg-surface dark:bg-surface-dark">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍳</span>
            <span className="font-bold text-lg text-gray-900 dark:text-white">Recipe Book</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</span>
              <span className="text-xs text-gray-400">{user?.email}</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-sm shadow">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <button
              id="btn-logout"
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Esci
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
        {/* Welcome banner */}
        <section className="mb-8">
          <div className="rounded-3xl bg-gradient-to-br from-primary to-primary-dark p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
            <div aria-hidden className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full" />
            <div aria-hidden className="absolute -right-4 -bottom-8 w-24 h-24 bg-white/5 rounded-full" />
            <div className="relative">
              <p className="text-sm font-medium opacity-80 mb-1">
                Ciao {user?.name?.split(' ')[0] || 'Chef'} 👋
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold mb-3">
                Cosa cuciniamo oggi?
              </h1>
              <p className="text-sm opacity-70">
                Aggiungi la tua prima ricetta · Usa IA per riconoscerla da foto o URL
              </p>
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Aggiungi ricetta</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                disabled={action.disabled}
                className={`
                  relative p-4 rounded-2xl text-left transition-all duration-200
                  ${action.disabled
                    ? 'bg-gray-50 dark:bg-gray-800/50 opacity-60 cursor-not-allowed'
                    : 'bg-white dark:bg-gray-800 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95 cursor-pointer'
                  }
                `}
              >
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} mb-3 shadow-sm`}>
                  <span className="text-xl">{action.emoji}</span>
                </div>
                <div className="font-semibold text-sm text-gray-900 dark:text-white">{action.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{action.desc}</div>
                {action.disabled && (
                  <span className="absolute top-2 right-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Presto</span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Empty state */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Le tue ricette</h2>
          <div className="rounded-3xl bg-white dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="text-6xl mb-4">🍽️</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Nessuna ricetta ancora</h3>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              Aggiungi la tua prima ricetta usando le azioni rapide sopra, oppure incolla un URL da AllRecipes, Giallozafferano e altri siti.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
