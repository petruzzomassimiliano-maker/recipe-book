import { Link } from 'react-router-dom'

const difficultyLabel = {
  easy: 'Facile',
  medium: 'Media',
  hard: 'Difficile'
}

function RecipeMeta({ recipe }) {
  const bits = []
  if (recipe.servings) bits.push(`${recipe.servings} porz.`)
  if (recipe.difficulty) bits.push(difficultyLabel[recipe.difficulty] || recipe.difficulty)
  if (recipe.caloriesPerServing != null) bits.push(`${recipe.caloriesPerServing} kcal`)
  return bits.join(' · ') || '—'
}

function isSharedWithViewer(recipe, viewerUserId) {
  if (!viewerUserId) return false
  const author = recipe.author || ''
  if (author === `user-${viewerUserId}` || author === viewerUserId) return false
  const ids = recipe.sharedWithUserIds || []
  return ids.map(String).includes(String(viewerUserId))
}

function isOwnRecipe(recipe, viewerUserId) {
  if (!viewerUserId || !recipe?.author) return false
  return recipe.author === `user-${viewerUserId}` || recipe.author === viewerUserId
}

function sharedOutNames(recipe) {
  const names = (recipe.sharedWith || []).map((p) => p.displayName).filter(Boolean)
  if (names.length) return names
  const n = (recipe.sharedWithUserIds || []).length
  return n ? [`${n} ${n === 1 ? 'persona' : 'persone'}`] : []
}

function ShareBadge({ recipe, viewerUserId }) {
  const sharedIn = isSharedWithViewer(recipe, viewerUserId)
  if (sharedIn) {
    return (
      <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 text-[11px] font-semibold border border-teal-100">
        Condivisa da {recipe.authorDisplayName || 'un familiare'}
      </span>
    )
  }
  if (isOwnRecipe(recipe, viewerUserId)) {
    const names = sharedOutNames(recipe)
    if (!names.length) return null
    return (
      <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-lg bg-stone-100 text-stone-700 text-[11px] font-semibold border border-stone-200">
        Condivisa con {names.join(', ')}
      </span>
    )
  }
  // Staff viewing someone else's recipe that is shared out
  const names = sharedOutNames(recipe)
  if (names.length) {
    return (
      <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-lg bg-stone-100 text-stone-600 text-[11px] font-medium border border-stone-200">
        Condivisa con {names.join(', ')}
      </span>
    )
  }
  return null
}

/**
 * Mobile: single-column list (image left + text) for denser scanning.
 * sm+: visual grid of cards (food catalog pattern).
 */
export default function RecipeList({ recipes, emptyMessage, viewerUserId = null }) {
  if (!recipes?.length) {
    return (
      <div className="rounded-2xl bg-white border border-dashed border-stone-200 p-8 sm:p-14 text-center">
        <h3 className="font-display text-xl font-semibold text-stone-900 mb-2">Nessuna ricetta ancora</h3>
        <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <>
      <ul className="sm:hidden space-y-2.5" aria-label="Elenco ricette">
        {recipes.map((recipe) => {
          const sharedIn = isSharedWithViewer(recipe, viewerUserId)
          return (
            <li key={recipe.id}>
              <Link
                to={`/recipes/${recipe.id}`}
                className={`flex gap-3 items-center min-h-[88px] rounded-2xl border bg-white p-2 pr-3 active:bg-stone-50 transition-colors ${
                  sharedIn ? 'border-teal-200/90' : 'border-stone-200/80'
                }`}
              >
                {recipe.imageUrl ? (
                  <div className="w-[72px] h-[72px] shrink-0 rounded-xl overflow-hidden bg-stone-100">
                    <img
                      src={recipe.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="w-[72px] h-[72px] shrink-0 rounded-xl bg-gradient-to-br from-orange-50 via-stone-50 to-teal-50 flex items-center justify-center">
                    <span className="font-display text-2xl text-stone-300">
                      {recipe.title?.[0] || 'R'}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1 py-0.5">
                  <h3 className="font-display text-[15px] font-semibold text-stone-900 leading-snug line-clamp-2">
                    {recipe.title}
                  </h3>
                  <p className="text-xs text-stone-500 mt-1 truncate">
                    <RecipeMeta recipe={recipe} />
                  </p>
                  <ShareBadge recipe={recipe} viewerUserId={viewerUserId} />
                </div>
                <span className="text-stone-300 shrink-0" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 gap-4">
        {recipes.map((recipe) => {
          const sharedIn = isSharedWithViewer(recipe, viewerUserId)
          return (
            <Link
              key={recipe.id}
              to={`/recipes/${recipe.id}`}
              className={`group card overflow-hidden p-0 hover:-translate-y-0.5 transition-transform ${
                sharedIn ? 'ring-1 ring-teal-200' : ''
              }`}
            >
              {recipe.imageUrl ? (
                <div className="aspect-[16/10] bg-stone-100 overflow-hidden">
                  <img
                    src={recipe.imageUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="aspect-[16/10] bg-gradient-to-br from-orange-50 via-stone-50 to-teal-50 flex items-center justify-center">
                  <span className="font-display text-3xl text-stone-300">{recipe.title?.[0] || 'R'}</span>
                </div>
              )}
              <div className="p-4 sm:p-5">
                <h3 className="font-display text-lg font-semibold text-stone-900 leading-snug group-hover:text-primary transition-colors line-clamp-2">
                  {recipe.title}
                </h3>
                <p className="text-sm text-stone-500 mt-1.5">
                  <RecipeMeta recipe={recipe} />
                </p>
                <ShareBadge recipe={recipe} viewerUserId={viewerUserId} />
                {!!recipe.tags?.length && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {recipe.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-lg bg-stone-100 text-xs font-medium text-stone-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
