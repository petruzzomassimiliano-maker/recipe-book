import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes.js'
import RecipeList from '../components/recipe/RecipeList.jsx'
import { useFavoritesStore } from '../store/favoritesStore.js'

export default function Recipes() {
  const { recipes, searchFilter, setSearchFilter, loadRecipes, isLoading, error } = useRecipes()
  const [query, setQuery] = useState(searchFilter || '')

  useEffect(() => {
    loadRecipes(searchFilter || '')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [params, setParams] = useSearchParams()
  const onlyFavorites = params.get('preferite') === '1'
  const favoriteIds = useFavoritesStore((s) => s.ids)
  const shown = useMemo(() => {
    if (!onlyFavorites) return recipes
    const order = new Map(favoriteIds.map((id, i) => [id, i]))
    return recipes.filter((r) => order.has(r.id)).sort((a, b) => order.get(a.id) - order.get(b.id))
  }, [recipes, onlyFavorites, favoriteIds])
  const toggleFavorites = () => {
    const next = new URLSearchParams(params)
    if (onlyFavorites) next.delete('preferite')
    else next.set('preferite', '1')
    setParams(next, { replace: true })
  }

  const visibleCount = shown.length

  const handleSearch = (e) => {
    e.preventDefault()
    setSearchFilter(query)
    loadRecipes(query)
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 animate-fade-in">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="page-title">Ricette</h1>
          {!isLoading && (
            <p className="text-xs text-stone-400 mt-0.5 tabular-nums">
              {visibleCount} {visibleCount === 1 ? 'ricetta' : 'ricette'}
              {searchFilter ? ` per “${searchFilter}”` : ''}
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

      <form
        onSubmit={handleSearch}
        className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 px-4 py-2 mb-3 bg-surface/95 backdrop-blur-md sm:static sm:mx-0 sm:px-0 sm:py-0 sm:mb-5 sm:bg-transparent sm:backdrop-blur-none"
      >
        <div className="flex gap-2">
          <input
            className="input-field !min-h-[44px] !py-2.5"
            placeholder="Cerca titolo, tag o ingrediente…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cerca ricette"
            enterKeyHint="search"
          />
          <button type="submit" className="btn-secondary shrink-0 !min-h-[44px] !px-4 !py-2.5">
            Cerca
          </button>
        </div>
        <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={toggleFavorites}
            aria-pressed={onlyFavorites}
            className={`shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-full border text-sm font-semibold ${
              onlyFavorites
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-white border-stone-200 text-stone-600'
            }`}
          >
            <span aria-hidden>★</span> Preferite{favoriteIds.length ? ` (${favoriteIds.length})` : ''}
          </button>
          <Link
            to="/cosa-cucino"
            className="shrink-0 inline-flex items-center min-h-[40px] px-3.5 rounded-full border border-stone-200 bg-white text-sm font-semibold text-stone-600"
          >
            Cosa cucino con quello che ho?
          </Link>
          {searchFilter ? (
            <button
              type="button"
              className="shrink-0 inline-flex items-center min-h-[40px] px-3 text-sm text-stone-400"
              onClick={() => {
                setQuery('')
                setSearchFilter('')
                loadRecipes('')
              }}
            >
              Azzera ricerca
            </button>
          ) : null}
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
      ) : (
        <RecipeList
          recipes={shown}
          emptyTitle={onlyFavorites ? 'Nessuna preferita' : searchFilter ? 'Nessun risultato' : undefined}
          emptyMessage={
            onlyFavorites
              ? searchFilter
                ? 'Nessuna preferita per questa ricerca.'
                : 'Tocca la stellina su una ricetta per metterla tra le preferite (vale su questo dispositivo).'
              : searchFilter
                ? 'Nessuna ricetta trovata. Prova un’altra parola.'
                : 'Aggiungi la prima ricetta con il pulsante in alto.'
          }
        />
      )}
    </main>
  )
}
