import { useFavoritesStore, useIsFavorite } from '../../store/favoritesStore.js'
import Icon from '../ui/Icon.jsx'

/** Star toggle. `variant="overlay"` sits on top of a photo/card. */
export default function FavoriteButton({ recipeId, title = '', variant = 'plain', className = '' }) {
  const active = useIsFavorite(recipeId)
  const toggle = useFavoritesStore((s) => s.toggle)
  const base =
    variant === 'overlay'
      ? 'bg-surface-container-lowest/90 backdrop-blur-sm shadow-sm border border-outline-variant'
      : 'border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(recipeId)
      }}
      className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full transition-colors duration-state-change ${base} ${
        active ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
      } ${className}`}
      aria-pressed={active}
      aria-label={active ? `Togli ${title} dalle preferite` : `Aggiungi ${title} alle preferite`}
      title={active ? 'Togli dalle preferite' : 'Aggiungi alle preferite'}
    >
      <Icon name="star" size={20} filled={active} />
    </button>
  )
}
