import { useFavoritesStore, useIsFavorite } from '../../store/favoritesStore.js'

/** Star toggle. `variant="overlay"` sits on top of a photo/card. */
export default function FavoriteButton({ recipeId, title = '', variant = 'plain', className = '' }) {
  const active = useIsFavorite(recipeId)
  const toggle = useFavoritesStore((s) => s.toggle)
  const base =
    variant === 'overlay'
      ? 'bg-white/90 backdrop-blur-sm shadow-sm border border-stone-200/70'
      : 'border border-stone-200 bg-white'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(recipeId)
      }}
      className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl ${base} ${
        active ? 'text-amber-500' : 'text-stone-400 hover:text-stone-600'
      } ${className}`}
      aria-pressed={active}
      aria-label={active ? `Togli ${title} dalle preferite` : `Aggiungi ${title} alle preferite`}
      title={active ? 'Togli dalle preferite' : 'Aggiungi alle preferite'}
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75">
        <path strokeLinejoin="round" d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9L12 3.5z" />
      </svg>
    </button>
  )
}
