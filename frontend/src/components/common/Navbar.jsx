import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useAuthStore } from '../../store/authStore.js'

const linkClass = ({ isActive }) =>
  `inline-flex items-center min-h-[44px] text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
    isActive
      ? 'text-primary bg-primary/10'
      : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100/80'
  }`

export default function Navbar() {
  const { user, logout } = useAuth()
  const familyAppName = useAuthStore((s) => s.familyAppName)
  const brand = user?.preferences?.appLabel || familyAppName || 'Recipe Book'

  return (
    <header className="bg-white/75 backdrop-blur-md border-b border-stone-200/70 sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-[56px] py-2 flex items-center justify-between gap-3">
        <NavLink to="/" className="flex items-center gap-2.5 group min-w-0 min-h-[44px]">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-sm shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 14c0-4 3-7 8-7s8 3 8 7v1H4v-1Z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
              <path d="M8 8V5M12 7V3M16 8V5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </span>
          <span className="font-display text-lg font-semibold text-stone-900 tracking-tight truncate">
            {brand}
          </span>
        </NavLink>

        <nav className="hidden sm:flex items-center gap-0.5" aria-label="Navigazione desktop">
          <NavLink to="/" end className={linkClass}>
            Home
          </NavLink>
          <NavLink to="/recipes" className={linkClass}>
            Ricette
          </NavLink>
          <NavLink to="/shopping-list" className={linkClass}>
            Lista
          </NavLink>
          <NavLink to="/settings" className={linkClass}>
            Impostazioni
          </NavLink>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-sm font-medium text-stone-900">{user?.displayName || user?.name}</span>
            <span className="text-xs text-stone-400">@{user?.username || user?.role}</span>
          </div>
          <div
            className="hidden sm:flex w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-dark items-center justify-center text-white font-semibold text-sm shadow-sm"
            aria-hidden
          >
            {(user?.displayName || user?.username || '?')[0]?.toUpperCase()}
          </div>
          <button
            id="btn-logout"
            type="button"
            onClick={logout}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-w-0 text-sm text-stone-500 hover:text-stone-900 px-2.5 sm:px-3 rounded-lg hover:bg-stone-100 transition-colors"
            aria-label="Esci"
          >
            <span className="sm:hidden">Esci</span>
            <span className="hidden sm:inline">Esci</span>
          </button>
        </div>
      </div>
    </header>
  )
}
