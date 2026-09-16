import { NavLink } from 'react-router-dom'

const tabs = [
  {
    to: '/',
    end: true,
    label: 'Home',
    icon: (active) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
          stroke="currentColor"
          strokeWidth={active ? 2 : 1.75}
          strokeLinejoin="round"
        />
      </svg>
    )
  },
  {
    to: '/recipes',
    label: 'Ricette',
    icon: (active) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 14c0-4 3-7 8-7s8 3 8 7v1H4v-1Z"
          stroke="currentColor"
          strokeWidth={active ? 2 : 1.75}
          strokeLinejoin="round"
        />
        <path
          d="M8 8V5M12 7V3M16 8V5"
          stroke="currentColor"
          strokeWidth={active ? 2 : 1.75}
          strokeLinecap="round"
        />
      </svg>
    )
  },
  {
    to: '/shopping-list',
    label: 'Lista',
    icon: (active) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"
          stroke="currentColor"
          strokeWidth={active ? 2 : 1.75}
          strokeLinecap="round"
        />
      </svg>
    )
  },
  {
    to: '/settings',
    label: 'Altro',
    icon: (active) => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={active ? 2 : 1.75} />
        <path
          d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.36.36.9.58 1.51.58H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
          stroke="currentColor"
          strokeWidth={active ? 1.75 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
]

/**
 * Bottom navigation for phones (Apple HIG / Material: primary destinations in thumb zone).
 * Hidden from `sm` and up — desktop keeps the top Navbar links.
 */
export default function MobileTabBar() {
  return (
    <nav
      className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-stone-200/80 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="Navigazione principale"
    >
      <ul className="grid grid-cols-4 max-w-lg mx-auto">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 min-h-[52px] px-1 pt-1.5 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-stone-400 active:text-stone-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {tab.icon(isActive)}
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
