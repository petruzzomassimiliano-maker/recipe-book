import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore.js'
import { useRecipes } from '../hooks/useRecipes.js'
import { useFavoritesStore } from '../store/favoritesStore.js'
import FavoriteButton from '../components/recipe/FavoriteButton.jsx'
import { RecipeCover, recipeMeta } from '../components/recipe/RecipeBits.jsx'
import Icon from '../components/ui/Icon.jsx'

const FEATURED_LABEL = {
  random: 'Ricetta del giorno',
  latest: 'Ultima aggiornata',
  oldest: 'Dal primo giorno'
}

function pickFeatured(recipes, mode, randomId) {
  if (!recipes?.length) return null
  if (mode === 'latest') {
    return [...recipes].sort((a, b) => {
      const ta = Date.parse(a.updatedAt || 0) || 0
      const tb = Date.parse(b.updatedAt || 0) || 0
      return tb - ta
    })[0]
  }
  if (mode === 'oldest') {
    return [...recipes].sort((a, b) => {
      const ta = Date.parse(a.createdAt || a.updatedAt || 0) || 0
      const tb = Date.parse(b.createdAt || b.updatedAt || 0) || 0
      return ta - tb
    })[0]
  }
  if (randomId) {
    return recipes.find((r) => r.id === randomId) || recipes[0]
  }
  return recipes[Math.floor(Math.random() * recipes.length)]
}

const quickActions = [
  {
    label: 'URL / YouTube',
    desc: 'Importa da link',
    to: '/recipes/import',
    icon: 'link',
    tone: 'bg-tertiary-container text-tertiary-on-container'
  },
  {
    label: 'Manuale',
    desc: 'Scrivi ricetta',
    to: '/recipes/new',
    icon: 'edit_note',
    tone: 'bg-primary-tint text-primary-on-tint'
  },
  {
    label: 'Cosa cucino?',
    desc: 'Con la dispensa',
    to: '/cosa-cucino',
    icon: 'kitchen',
    tone: 'bg-amber-tint text-amber-on-tint'
  },
  {
    label: 'Tutte le ricette',
    desc: 'Sfoglia catalogo',
    to: '/recipes',
    icon: 'grid_view',
    tone: 'bg-secondary-container text-secondary-on-container'
  }
]

export default function Home() {
  const familyAppName = useAuthStore((s) => s.familyAppName)
  const featuredMode = useAuthStore((s) => s.featuredMode) || 'random'
  const navigate = useNavigate()
  const { recipes, loadRecipes, isLoading, setSearchFilter } = useRecipes()
  const [randomId, setRandomId] = useState(null)
  const [query, setQuery] = useState('')
  const favoriteIds = useFavoritesStore((s) => s.ids)
  const favorites = useMemo(() => {
    const byId = new Map((recipes || []).map((r) => [r.id, r]))
    return favoriteIds.map((id) => byId.get(id)).filter(Boolean)
  }, [recipes, favoriteIds])

  useEffect(() => {
    // Home always works on the full list, not on the last search in /recipes
    loadRecipes('')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (featuredMode !== 'random' || !recipes?.length) {
      setRandomId(null)
      return
    }
    // Keep the current pick when the list refreshes (cache → server), re-roll only if it vanished
    setRandomId((prev) =>
      prev && recipes.some((r) => r.id === prev)
        ? prev
        : recipes[Math.floor(Math.random() * recipes.length)].id
    )
  }, [recipes, featuredMode])

  const featured = useMemo(
    () => pickFeatured(recipes, featuredMode, randomId),
    [recipes, featuredMode, randomId]
  )

  const search = (e) => {
    e.preventDefault()
    setSearchFilter(query.trim())
    navigate('/recipes')
  }

  const featuredIngredients = (featured?.ingredientNames || []).slice(0, 6)

  return (
    <main className="max-w-[1200px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="page-title">{familyAppName || 'Ricettario'}</h1>
          <p className="font-body text-body-lg text-on-surface-variant">Cosa cuciniamo oggi?</p>
        </div>

        <form onSubmit={search} role="search" className="relative flex items-center w-full md:w-80">
          <label htmlFor="home-search" className="sr-only">
            Cerca una ricetta
          </label>
          <Icon name="search" className="absolute left-4 text-outline pointer-events-none" />
          <input
            id="home-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca ricetta o ingrediente…"
            enterKeyHint="search"
            className="w-full min-h-[44px] rounded-full border border-outline-variant bg-surface-container-lowest pl-11 pr-4 py-2 font-body text-body-md text-on-surface placeholder:text-outline shadow-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </form>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* In evidenza */}
        <section aria-labelledby="featured-heading" className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 id="featured-heading" className="section-title">
              In evidenza
            </h2>
            <Link
              to="/recipes"
              className="inline-flex items-center gap-1 min-h-[44px] text-primary font-body text-label-lg hover:underline"
            >
              Vedi tutte
              <Icon name="arrow_forward" size={18} />
            </Link>
          </div>

          {isLoading && !featured ? (
            <div className="card !shadow-none overflow-hidden" aria-busy="true">
              <div className="aspect-[16/9] bg-surface-container-low animate-pulse" />
              <div className="p-6 sm:p-8 space-y-3">
                <div className="h-4 w-1/3 rounded bg-surface-container-low" />
                <div className="h-7 w-2/3 rounded bg-surface-container-low" />
              </div>
            </div>
          ) : !featured ? (
            <div className="rounded-2xl bg-surface-container-lowest border border-dashed border-outline-variant p-8 text-center">
              <h3 className="font-display text-headline-md text-on-surface mb-2">Nessuna ricetta ancora</h3>
              <p className="font-body text-body-md text-on-surface-variant max-w-sm mx-auto mb-4">
                Aggiungi la prima ricetta o importane una da URL.
              </p>
              <button type="button" className="btn-primary" onClick={() => navigate('/recipes/import')}>
                <Icon name="link" size={18} />
                Importa
              </button>
            </div>
          ) : (
            <article className="card overflow-hidden flex flex-col">
              <Link to={`/recipes/${featured.id}`} className="block group" tabIndex={-1} aria-hidden>
                <RecipeCover
                  recipe={featured}
                  className="aspect-[16/10] sm:aspect-[16/9]"
                  imgClassName="transition-transform duration-surface-enter group-hover:scale-[1.02]"
                  letterClassName="text-6xl"
                />
              </Link>
              <div className="p-5 sm:p-8 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary-container text-secondary-on-container font-body text-label-sm">
                      <Icon name="auto_awesome" size={14} />
                      {FEATURED_LABEL[featuredMode] || FEATURED_LABEL.random}
                    </span>
                    {featured.tags?.[0] ? <span className="chip">{featured.tags[0]}</span> : null}
                  </div>
                  <span className="font-mono text-mono-md text-on-surface-variant tabular-nums">
                    {recipeMeta(featured)}
                  </span>
                </div>

                <h3 className="font-headline text-headline-md sm:text-headline-lg text-on-surface">
                  <Link to={`/recipes/${featured.id}`} className="hover:text-primary transition-colors">
                    {featured.title}
                  </Link>
                </h3>
                {featuredIngredients.length ? (
                  <p className="font-body text-body-md sm:text-body-lg text-on-surface-variant text-pretty line-clamp-2">
                    Con {featuredIngredients.join(', ').toLowerCase()}
                    {featured.ingredientNames.length > featuredIngredients.length ? '…' : '.'}
                  </p>
                ) : null}

                <footer className="pt-4 border-t border-outline-variant flex items-center gap-2">
                  <Link to={`/recipes/${featured.id}`} className="btn-primary !px-6">
                    <Icon name="skillet" size={18} />
                    Inizia a cucinare
                  </Link>
                  <FavoriteButton recipeId={featured.id} title={featured.title} />
                </footer>
              </div>
            </article>
          )}
        </section>

        <aside className="lg:col-span-5 flex flex-col gap-6 lg:gap-8">
          {/* Inizia da qui */}
          <section aria-labelledby="start-here-heading" className="flex flex-col gap-4">
            <h2 id="start-here-heading" className="section-title">
              Inizia da qui
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 items-stretch">
              {quickActions.map((a) => (
                <Link
                  key={a.label}
                  to={a.to}
                  className="group card p-4 flex flex-col justify-between gap-4 min-h-[120px] hover:border-outline"
                >
                  <span className={`icon-badge ${a.tone}`}>
                    <Icon name={a.icon} size={20} />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="font-headline text-title-md text-on-surface group-hover:text-primary transition-colors duration-state-change">
                      {a.label}
                    </span>
                    <span className="font-body text-label-sm text-on-surface-variant">{a.desc}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* Preferite */}
          <section aria-labelledby="favorites-heading" className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 id="favorites-heading" className="font-headline text-title-lg text-on-surface flex items-center gap-1">
                <Icon name="star" size={18} filled className="text-primary" />
                Preferite di casa
              </h2>
              {favorites.length > 0 && (
                <Link
                  to="/recipes?preferite=1"
                  className="inline-flex items-center min-h-[40px] text-primary font-body text-label-sm hover:underline"
                >
                  Tutte ({favorites.length})
                </Link>
              )}
            </div>

            {favorites.length ? (
              <ul className="flex flex-col gap-2">
                {favorites.slice(0, 4).map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/recipes/${r.id}`}
                      className="group card p-2 flex items-center gap-4 hover:border-outline"
                    >
                      <RecipeCover recipe={r} className="w-14 h-14 rounded-xl" letterClassName="text-xl" />
                      <span className="flex-1 min-w-0 flex flex-col gap-1">
                        <span className="font-body text-title-md text-on-surface truncate">{r.title}</span>
                        <span className="font-body text-label-sm text-on-surface-variant tabular-nums">
                          {recipeMeta(r, { difficulty: false })}
                        </span>
                      </span>
                      <Icon
                        name="chevron_right"
                        size={18}
                        className="text-on-surface-variant group-hover:text-primary mr-2"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest px-4 py-3 font-body text-body-md text-on-surface-variant">
                Tocca la <Icon name="star" size={16} className="text-primary" /> su una ricetta per
                ritrovarla qui (vale su questo dispositivo).
              </p>
            )}
          </section>
        </aside>
      </div>
    </main>
  )
}
