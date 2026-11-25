/** Material Symbols icon (the icon set used in the Stitch design). */
export default function Icon({ name, size = 20, filled = false, className = '', ...rest }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined${filled ? ' icon-filled' : ''} ${className}`}
      style={{ fontSize: size }}
      {...rest}
    >
      {name}
    </span>
  )
}
