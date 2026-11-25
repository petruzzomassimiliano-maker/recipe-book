import { NavLink } from 'react-router-dom'
import { useAuthStore, useEditAccess } from '../../store/authStore.js'
import Icon from '../ui/Icon.jsx'

const linkClass = ({ isActive }) =>
  `inline-flex items-center px-4 py-1 min-h-[36px] rounded-full font-body text-label-lg transition-colors duration-state-change ${
    isActive
      ? 'bg-primary-tint text-primary-on-tint'
      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
  }`

export default function Navbar() {
  const familyAppName = useAuthStore((s) => s.familyAppName)
  const { canEdit, requestUnlock, lock } = useEditAccess()
  const brand = familyAppName || 'Ricettario'

  return (
    <header className="sticky top-0 z-30 bg-surface-container-lowest border-b border-outline-variant pt-[env(safe-area-inset-top)]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between gap-4">
        <NavLink
          to="/"
          className="flex items-center gap-2 min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
            <Icon name="skillet" size={20} />
          </span>
          <span className="font-headline text-title-lg text-on-surface truncate">{brand}</span>
        </NavLink>

        <nav
          aria-label="Navigazione principale"
          className="hidden sm:flex items-center gap-1 bg-surface-container-low p-1 rounded-full border border-outline-variant"
        >
          <NavLink to="/" end className={linkClass}>
            Home
          </NavLink>
          <NavLink to="/recipes" className={linkClass}>
            Ricette
          </NavLink>
          <NavLink to="/settings" className={linkClass}>
            Impostazioni
          </NavLink>
        </nav>

        <button
          type="button"
          onClick={canEdit ? lock : requestUnlock}
          className={`inline-flex items-center gap-1.5 shrink-0 min-h-[40px] px-4 rounded-full border font-body text-label-lg transition-colors duration-state-change focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            canEdit
              ? 'bg-secondary-container text-secondary-on-container border-secondary/30 hover:bg-teal-200'
              : 'bg-surface-container-lowest text-on-surface border-outline-variant hover:bg-surface-container-low'
          }`}
          title={canEdit ? 'Modifiche sbloccate — tocca per bloccare' : 'Inserisci il PIN per modificare'}
        >
          <Icon
            name={canEdit ? 'lock_open' : 'lock'}
            size={18}
            className={canEdit ? '' : 'text-on-surface-variant'}
          />
          <span>{canEdit ? 'Blocca' : 'Modifica'}</span>
        </button>
      </div>
    </header>
  )
}
