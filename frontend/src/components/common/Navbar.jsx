import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { useAuthStore } from '../../store/authStore.js'

const linkClass = ({ isActive }) =>
  `text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
    isActive
      ? 'text-primary bg-primary/10'
      : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100/80'
  }`

export default function Navbar() {
  const { user, logout } = useAuth()
  const familyAppName = useAuthStore((s) => s.familyAppName)
  const brand = user?.preferences?.appLabel || familyAppName || 'Recipe Book'

  return (
    <header className="bg-white/75 backdrop-blur-md border-b border-stone-200/70 sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-6 min-w-0">
          <NavLink to="/" className="flex items-center gap-2.5 group min-w-0">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-sm shrink-0">
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
          <nav className="hidden sm:flex items-center gap-0.5">
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
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <NavLink
            to="/settings"
            className="sm:hidden text-stone-500 hover:text-stone-900 p-2 rounded-lg hover:bg-stone-100"
            aria-label="Impostazioni"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.36.36.9.58 1.51.58H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
              />
            </svg>
          </NavLink>
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-sm font-medium text-stone-900">{user?.displayName || user?.name}</span>
            <span className="text-xs text-stone-400">@{user?.username || user?.role}</span>
          </div>
          <div
            className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-semibold text-sm shadow-sm"
            aria-hidden
          >
            {(user?.displayName || user?.username || '?')[0]?.toUpperCase()}
          </div>
          <button
            id="btn-logout"
            type="button"
            onClick={logout}
            className="text-sm text-stone-500 hover:text-stone-900 px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors"
          >
            Esci
          </button>
        </div>
      </div>
    </header>
  )
}
