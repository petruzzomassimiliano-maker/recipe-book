import { Link } from 'react-router-dom'

const difficultyLabel = {
  easy: 'Facile',
  medium: 'Media',
  hard: 'Difficile'
}

export default function RecipeList({ recipes, emptyMessage }) {
  if (!recipes?.length) {
    return (
      <div className="rounded-3xl bg-white border border-dashed border-stone-200 p-10 sm:p-14 text-center">
        <h3 className="font-display text-xl font-semibold text-stone-900 mb-2">Nessuna ricetta ancora</h3>
        <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {recipes.map((recipe) => (
        <Link
          key={recipe.id}
          to={`/recipes/${recipe.id}`}
          className="group card overflow-hidden p-0 hover:-translate-y-0.5 transition-transform"
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
            <h3 className="font-display text-lg font-semibold text-stone-900 leading-snug group-hover:text-primary transition-colors">
              {recipe.title}
            </h3>
            <p className="text-sm text-stone-500 mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
              <span>{recipe.servings ? `${recipe.servings} porzioni` : '—'}</span>
              <span className="text-stone-300">·</span>
              <span>{difficultyLabel[recipe.difficulty] || recipe.difficulty}</span>
              {recipe.caloriesPerServing != null && (
                <>
                  <span className="text-stone-300">·</span>
                  <span>{recipe.caloriesPerServing} kcal</span>
                </>
              )}
            </p>
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
      ))}
    </div>
  )
}
