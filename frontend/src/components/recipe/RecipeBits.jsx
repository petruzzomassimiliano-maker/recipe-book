/* Small building blocks shared by the Stitch-style catalog screens. */

export const difficultyLabel = {
  easy: 'Facile',
  medium: 'Media',
  hard: 'Difficile'
}

/** "6 porz. · Facile · 45 min" */
export function recipeMeta(recipe, { difficulty = true, time = true } = {}) {
  if (!recipe) return ''
  const bits = []
  if (recipe.servings) bits.push(`${recipe.servings} porz.`)
  if (difficulty && recipe.difficulty) bits.push(difficultyLabel[recipe.difficulty] || recipe.difficulty)
  if (time && recipe.totalTime > 0) bits.push(formatMinutes(recipe.totalTime))
  return bits.join(' · ')
}

export function formatMinutes(min) {
  const m = Math.round(Number(min) || 0)
  if (m <= 0) return ''
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} h ${rest} min` : `${h} h`
}

const TAG_TONES = [
  'bg-secondary-container text-secondary-on-container',
  'bg-primary-tint text-primary-on-tint',
  'bg-amber-tint text-amber-on-tint',
  'bg-tertiary-container text-tertiary-on-container'
]

function hash(text) {
  let h = 0
  for (const ch of String(text || '').toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

/** Coloured pill; the same tag always gets the same tone. */
export function TagChip({ tag, className = '' }) {
  if (!tag) return null
  return (
    <span
      className={`inline-flex items-center self-start px-2 py-1 rounded-full font-body text-label-sm ${
        TAG_TONES[hash(tag) % TAG_TONES.length]
      } ${className}`}
    >
      {tag}
    </span>
  )
}

/** Recipe photo with an initial-letter fallback. Fills its (sized) parent. */
export function RecipeCover({ recipe, className = '', imgClassName = '', letterClassName = 'text-3xl' }) {
  return (
    <div className={`relative overflow-hidden bg-surface-container-low ${className}`}>
      {recipe?.imageUrl ? (
        <img
          src={recipe.imageUrl}
          alt=""
          loading="lazy"
          className={`absolute inset-0 w-full h-full object-cover ${imgClassName}`}
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-tint via-surface-container-low to-secondary-container/60"
        >
          <span className={`font-display text-outline/60 ${letterClassName}`}>
            {recipe?.title?.[0]?.toUpperCase() || 'R'}
          </span>
        </div>
      )}
    </div>
  )
}
