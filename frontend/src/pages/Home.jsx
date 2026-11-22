import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore.js'
import { useRecipes } from '../hooks/useRecipes.js'
import { useFavoritesStore } from '../store/favoritesStore.js'

const difficultyLabel = {
  easy: 'Facile',
  medium: 'Media',
  hard: 'Difficile'
}

const FEATURED_LABEL = {
  random: 'Ricetta a caso',
  latest: 'Ultima aggiornata',
  oldest: 'Più vecchia'
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

export default function Home() {
  const familyAppName = useAuthStore((s) => s.familyAppName)
  const featuredMode = useAuthStore((s) => s.featuredMode) || 'random'
  const navigate = useNavigate()
  const { recipes, loadRecipes, isLoading } = useRecipes()
  const [randomId, setRandomId] = useState(null)
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

  const quickActions = [
    {
      label: 'URL / YouTube',
      desc: 'Importa',
      to: '/recipes/import',
      accent: 'bg-teal-50 text-teal-800 border-teal-100'
    },
    {
      label: 'Manuale',
      desc: 'Scrivi',
      to: '/recipes/new',
      accent: 'bg-orange-50 text-orange-900 border-orange-100'
    },
    {
      label: 'Cosa cucino?',
      desc: 'Con quello che ho',
      to: '/cosa-cucino',
      accent: 'bg-amber-50 text-amber-900 border-amber-100'
    },
    {
      label: 'Tutte le ricette',
      desc: 'Sfoglia',
      to: '/recipes',
      accent: 'bg-stone-50 text-stone-800 border-stone-200'
    }
  ]

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-10 animate-fade-in">
      <section className="mb-5 sm:mb-8">
        <h1 className="font-display text-2xl sm:text-4xl font-semibold text-stone-900 tracking-tight leading-snug">
          {familyAppName || 'Recipe Book'}
        </h1>
        <p className="mt-1 text-sm sm:text-base text-stone-500">Cosa cuciniamo oggi?</p>
      </section>

      <section className="mb-7 sm:mb-10">
        <div className="flex items-end justify-between mb-3 gap-3">
          <h2 className="section-title !text-lg sm:!text-xl">In evidenza</h2>
          <Link
            to="/recipes"
            className="inline-flex items-center min-h-[44px] text-sm text-primary font-semibold"
          >
            Vedi tutte
          </Link>
        </div>

        {isLoading && !featured ? (
          <p className="text-stone-400">Caricamento…</p>
        ) : !featured ? (
          <div className="rounded-2xl bg-white border border-dashed border-stone-200 p-8 text-center">
            <h3 className="font-display text-xl font-semibold text-stone-900 mb-2">
              Nessuna ricetta ancora
            </h3>
            <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-4">
              Aggiungi la prima ricetta o importane una da URL.
            </p>
            <button
              type="button"
              className="btn-primary !py-2.5 !px-5"
              onClick={() => navigate('/recipes/import')}
            >
              Importa
            </button>
          </div>
        ) : (
          <Link
            to={`/recipes/${featured.id}`}
            className="group block overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm"
          >
            {/* Image only — title lives below so it never covers the photo */}
            <div className="relative aspect-[16/10] sm:aspect-[21/9] bg-stone-100 overflow-hidden">
              {featured.imageUrl ? (
                <img
                  src={featured.imageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
              ) : (
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-br from-primary/80 via-stone-200 to-teal-100 flex items-center justify-center"
                >
                  <span className="font-display text-5xl text-white/90">
                    {featured.title?.[0] || 'R'}
                  </span>
                </div>
              )}
              <span className="absolute top-3 left-3 rounded-lg bg-black/45 backdrop-blur-sm text-white text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1">
                {FEATURED_LABEL[featuredMode] || FEATURED_LABEL.random}
              </span>
            </div>

            <div className="p-4 sm:p-5">
              <h3 className="font-display text-xl sm:text-2xl font-semibold text-stone-900 tracking-tight leading-snug line-clamp-2">
                {featured.title}
              </h3>
              <p className="mt-1.5 text-sm text-stone-500 flex flex-wrap gap-x-2 gap-y-0.5">
                {featured.servings ? <span>{featured.servings} porzioni</span> : null}
                {featured.servings && featured.difficulty ? (
                  <span className="text-stone-300">·</span>
                ) : null}
                {featured.difficulty ? (
                  <span>{difficultyLabel[featured.difficulty] || featured.difficulty}</span>
                ) : null}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Apri ricetta
                <span aria-hidden>→</span>
              </span>
            </div>
          </Link>
        )}
      </section>

      {favorites.length > 0 && (
        <section className="mb-7 sm:mb-10">
          <div className="flex items-end justify-between mb-3 gap-3">
            <h2 className="section-title !text-lg sm:!text-xl">
              <span className="text-amber-500" aria-hidden>★</span> Preferite
            </h2>
            <Link to="/recipes?preferite=1" className="inline-flex items-center min-h-[44px] text-sm text-primary font-semibold">
              Vedi tutte
            </Link>
          </div>
          <ul className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
            {favorites.slice(0, 12).map((r) => (
              <li key={r.id} className="shrink-0 w-36 sm:w-44">
                <Link to={`/recipes/${r.id}`} className="block rounded-2xl border border-stone-200/80 bg-white overflow-hidden active:bg-stone-50">
                  {r.imageUrl ? (
                    <img src={r.imageUrl} alt="" loading="lazy" className="w-full aspect-[4/3] object-cover bg-stone-100" />
                  ) : (
                    <div className="w-full aspect-[4/3] bg-gradient-to-br from-orange-50 via-stone-50 to-teal-50 flex items-center justify-center">
                      <span className="font-display text-2xl text-stone-300">{r.title?.[0] || 'R'}</span>
                    </div>
                  )}
                  <p className="px-2.5 py-2 text-sm font-semibold text-stone-800 leading-snug line-clamp-2 min-h-[3.25rem]">
                    {r.title}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="section-title !text-lg sm:!text-xl mb-3">Inizia da qui</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => navigate(action.to)}
              className={`text-center sm:text-left rounded-2xl border px-2.5 py-3.5 sm:px-5 sm:py-4 min-h-[72px] transition-all active:scale-[0.98] ${action.accent}`}
            >
              <div className="font-semibold text-xs sm:text-[15px] leading-tight">{action.label}</div>
              <div className="hidden sm:block text-sm opacity-70 mt-1">{action.desc}</div>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
