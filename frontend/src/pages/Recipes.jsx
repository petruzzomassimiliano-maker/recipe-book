import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useRecipes } from '../hooks/useRecipes.js'
import RecipeList from '../components/recipe/RecipeList.jsx'

function groupRecipesByAuthor(recipes, currentAuthorKey) {
  const map = new Map()
  for (const recipe of recipes || []) {
    const key = recipe.author || 'unknown'
    if (!map.has(key)) {
      map.set(key, {
        author: key,
        name: recipe.authorDisplayName || 'Utente',
        recipes: []
      })
    }
    const group = map.get(key)
    group.recipes.push(recipe)
    if (recipe.authorDisplayName) group.name = recipe.authorDisplayName
  }

  return [...map.values()].sort((a, b) => {
    if (a.author === currentAuthorKey) return -1
    if (b.author === currentAuthorKey) return 1
    return a.name.localeCompare(b.name, 'it', { sensitivity: 'base' })
  })
}

export default function Recipes() {
  const { user, isStaff } = useAuth()
  const { recipes, searchFilter, setSearchFilter, loadRecipes, isLoading, error } = useRecipes()

  useEffect(() => {
    loadRecipes()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const myAuthorKey = user?.id || user?.userId ? `user-${user.id || user.userId}` : null

  const sections = useMemo(() => {
    if (!isStaff) return null
    return groupRecipesByAuthor(recipes, myAuthorKey)
  }, [recipes, isStaff, myAuthorKey])

  const handleSearch = (e) => {
    e.preventDefault()
    loadRecipes(searchFilter)
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="page-title">Ricette</h1>
        <div className="flex gap-2">
          <Link to="/recipes/import" className="btn-secondary">
            Importa URL
          </Link>
          <Link to="/recipes/new" className="btn-primary">
            + Nuova ricetta
          </Link>
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <input
          className="input-field"
          placeholder="Cerca per titolo o tag…"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          aria-label="Cerca ricette"
        />
        <button type="submit" className="btn-secondary shrink-0">
          Cerca
        </button>
      </form>

      {error && (
        <div
          role="alert"
          className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {isLoading && recipes.length === 0 ? (
        <p className="text-gray-400">Caricamento…</p>
      ) : isStaff && sections ? (
        sections.length === 0 ? (
          <RecipeList
            recipes={[]}
            emptyMessage="Aggiungi la tua prima ricetta con il pulsante in alto."
          />
        ) : (
          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.author}>
                <h2 className="font-display text-xl font-semibold text-stone-900 mb-4">
                  Ricette di {section.name}
                  <span className="ml-2 text-sm font-sans font-normal text-stone-400">
                    {section.recipes.length}
                  </span>
                </h2>
                <RecipeList recipes={section.recipes} emptyMessage="" />
              </section>
            ))}
          </div>
        )
      ) : (
        <RecipeList
          recipes={recipes}
          emptyMessage="Aggiungi la tua prima ricetta con il pulsante in alto."
        />
      )}
    </main>
  )
}
