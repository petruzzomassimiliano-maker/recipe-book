/** SVG line icons for cooking appliances — stroke-based, monochrome. */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
}

export function ApplianceIcon({ id, className = 'w-7 h-7' }) {
  const common = { className, viewBox: '0 0 32 32', 'aria-hidden': true }
  switch (id) {
    case 'friggitrice_aria':
      return (
        <svg {...common}>
          <rect x="7" y="6" width="18" height="18" rx="3" {...stroke} />
          <path d="M11 12h10M11 16h10M11 20h6" {...stroke} />
          <path d="M12 26h8" {...stroke} />
          <path d="M22 9c1.5 1 2.5 2.2 2.5 4s-1 3-2.5 4" {...stroke} opacity="0.7" />
        </svg>
      )
    case 'forno':
      return (
        <svg {...common}>
          <rect x="6" y="5" width="20" height="22" rx="2.5" {...stroke} />
          <rect x="9" y="10" width="14" height="10" rx="1.5" {...stroke} />
          <circle cx="16" cy="23.5" r="1.2" fill="currentColor" stroke="none" />
          <path d="M10 7.5h4" {...stroke} />
        </svg>
      )
    case 'padella':
      return (
        <svg {...common}>
          <ellipse cx="14" cy="18" rx="9" ry="5.5" {...stroke} />
          <path d="M22.5 15.5 28 11" {...stroke} />
          <path d="M8 15c1-3 4-5 6-5s5 2 6 5" {...stroke} />
        </svg>
      )
    case 'bollitura':
      return (
        <svg {...common}>
          <path d="M9 14h14l-1.5 11H10.5L9 14Z" {...stroke} />
          <path d="M8 14h16" {...stroke} />
          <path d="M12 8c0 2 1.5 3 1.5 3M16 6c0 2.5 1.5 4 1.5 4M20 8c0 2 1.2 3 1.2 3" {...stroke} />
        </svg>
      )
    case 'vapore':
      return (
        <svg {...common}>
          <path d="M8 22h16l-1 4H9l-1-4Z" {...stroke} />
          <path d="M10 22V14a6 6 0 0 1 12 0v8" {...stroke} />
          <path d="M13 10c0-1.5.8-2.5.8-2.5M16 8c0-2 1-3 1-3M19 10c0-1.5.7-2.5.7-2.5" {...stroke} />
        </svg>
      )
    case 'grill':
      return (
        <svg {...common}>
          <path d="M6 12h20v10H6Z" {...stroke} />
          <path d="M9 12V9M16 12V8M23 12V9" {...stroke} />
          <path d="M9 15h14M9 18h14M9 21h14" {...stroke} />
          <path d="M8 26h16" {...stroke} />
        </svg>
      )
    case 'microonde':
      return (
        <svg {...common}>
          <rect x="5" y="8" width="22" height="16" rx="2" {...stroke} />
          <rect x="8" y="11" width="12" height="10" rx="1" {...stroke} />
          <circle cx="24" cy="13" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="24" cy="17" r="1.1" fill="currentColor" stroke="none" />
          <path d="M22.5 21h3" {...stroke} />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="9" {...stroke} />
          <path d="M16 11v6M16 20.5v.5" {...stroke} />
        </svg>
      )
  }
}
