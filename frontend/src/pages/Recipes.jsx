import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useRecipes } from '../hooks/useRecipes.js'
import RecipeList from '../components/recipe/RecipeList.jsx'

function firstName(name) {
  return String(name || 'Utente').trim().split(/\s+/)[0] || 'Utente'
}

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
  const [activeAuthor, setActiveAuthor] = useState(null)
  const [query, setQuery] = useState(searchFilter || '')

  useEffect(() => {
    loadRecipes()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const myAuthorKey = user?.id || user?.userId ? `user-${user.id || user.userId}` : null
  const myUserId = user?.id || user?.userId || null

  const sections = useMemo(() => {
    if (!isStaff) return null
    return groupRecipesByAuthor(recipes, myAuthorKey)
  }, [recipes, isStaff, myAuthorKey])

  useEffect(() => {
    if (!sections?.length) {
      setActiveAuthor(null)
      return
    }
    setActiveAuthor((prev) => {
      if (prev && sections.some((s) => s.author === prev)) return prev
      if (myAuthorKey && sections.some((s) => s.author === myAuthorKey)) return myAuthorKey
      return sections[0].author
    })
  }, [sections, myAuthorKey])

  const activeSection = useMemo(
    () => sections?.find((s) => s.author === activeAuthor) || null,
    [sections, activeAuthor]
  )

  const visibleCount = isStaff ? activeSection?.recipes?.length ?? 0 : recipes.length

  const handleSearch = (e) => {
    e.preventDefault()
    setSearchFilter(query)
    loadRecipes(query)
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 animate-fade-in">
      {/* Header: title + compact actions (thumb-friendly, less vertical bulk) */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="page-title">Ricette</h1>
          {!isLoading && (
            <p className="text-xs text-stone-400 mt-0.5 tabular-nums">
              {visibleCount} {visibleCount === 1 ? 'ricetta' : 'ricette'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/recipes/import"
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl border border-stone-200 bg-white text-stone-700 active:bg-stone-50"
            aria-label="Importa da URL"
            title="Importa"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v10m0 0l-3-3m3 3l3-3" />
            </svg>
          </Link>
          <Link
            to="/recipes/new"
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-xl bg-primary text-white font-semibold text-sm shadow-sm active:scale-[0.98]"
            aria-label="Nuova ricetta"
          >
            <span className="text-lg leading-none">+</span>
            <span className="hidden xs:inline sm:inline">Nuova</span>
          </Link>
        </div>
      </div>

      {/* Sticky search — persistent on mobile scroll */}
      <form
        onSubmit={handleSearch}
        className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 px-4 py-2 mb-3 bg-surface/95 backdrop-blur-md sm:static sm:mx-0 sm:px-0 sm:py-0 sm:mb-5 sm:bg-transparent sm:backdrop-blur-none"
      >
        <div className="flex gap-2">
          <input
            className="input-field !min-h-[44px] !py-2.5"
            placeholder="Cerca titolo o tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cerca ricette"
            enterKeyHint="search"
          />
          <button type="submit" className="btn-secondary shrink-0 !min-h-[44px] !px-4 !py-2.5">
            Cerca
          </button>
        </div>
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
        <p className="text-stone-400">Caricamento…</p>
      ) : isStaff && sections ? (
        sections.length === 0 ? (
          <RecipeList
            recipes={[]}
            viewerUserId={myUserId}
            emptyMessage="Aggiungi la tua prima ricetta con il pulsante in alto."
          />
        ) : (
          <div className="space-y-4">
            {/* Quick author chips — short labels for mobile */}
            <div
              role="tablist"
              aria-label="Filtra per persona"
              className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-none"
            >
              {sections.map((section) => {
                const selected = section.author === activeAuthor
                const label = firstName(section.name)
                return (
                  <button
                    key={section.author}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveAuthor(section.author)}
                    className={`snap-start shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-full text-sm font-medium transition-colors border ${
                      selected
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-white text-stone-700 border-stone-200 active:bg-stone-50'
                    }`}
                  >
                    {label}
                    <span
                      className={`tabular-nums text-xs px-1.5 py-0.5 rounded-full ${
                        selected ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {section.recipes.length}
                    </span>
                  </button>
                )
              })}
            </div>

            {activeSection && (
              <RecipeList
                recipes={activeSection.recipes}
                viewerUserId={myUserId}
                emptyMessage="Nessuna ricetta per questa persona."
              />
            )}
          </div>
        )
      ) : (
        <RecipeList
          recipes={recipes}
          viewerUserId={myUserId}
          emptyMessage="Aggiungi la tua prima ricetta con il pulsante in alto."
        />
      )}
    </main>
  )
}
