import { NavLink } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'

const tabs = [
  { to: '/', end: true, label: 'Home', icon: 'home' },
  { to: '/recipes', label: 'Ricette', icon: 'menu_book' },
  { to: '/settings', label: 'Impostazioni', icon: 'tune' }
]

/**
 * Bottom navigation for phones (primary destinations in thumb zone).
 * Hidden from `sm` and up — desktop keeps the top Navbar pills.
 */
export default function MobileTabBar() {
  return (
    <nav
      className="mobile-tabbar sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-outline-variant bg-surface-container-lowest/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="Navigazione principale"
    >
      <ul className="grid grid-cols-3 max-w-lg mx-auto">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 min-h-[56px] px-1 pt-1.5 font-body text-[11px] font-medium transition-colors ${
                  isActive ? 'text-primary-on-tint' : 'text-on-surface-variant active:text-on-surface'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`inline-flex items-center justify-center w-14 h-7 rounded-full transition-colors duration-state-change ${
                      isActive ? 'bg-primary-tint text-primary' : ''
                    }`}
                  >
                    <Icon name={tab.icon} size={22} filled={isActive} />
                  </span>
                  <span className="leading-none">{tab.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
