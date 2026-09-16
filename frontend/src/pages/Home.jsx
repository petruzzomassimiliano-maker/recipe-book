import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useRecipes } from '../hooks/useRecipes.js'

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
      const ta = Date.parse(a.updatedAt || a.createdAt || 0) || 0
      const tb = Date.parse(b.updatedAt || b.createdAt || 0) || 0
      return ta - tb
    })[0]
  }
  if (randomId) {
    return recipes.find((r) => r.id === randomId) || recipes[0]
  }
  return recipes[Math.floor(Math.random() * recipes.length)]
}

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { recipes, loadRecipes, isLoading } = useRecipes()
  const [randomId, setRandomId] = useState(null)

  useEffect(() => {
    loadRecipes()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const firstName =
    (user?.displayName || user?.name || user?.username || 'Chef').trim().split(/\s+/)[0] || 'Chef'

  const featuredMode = user?.preferences?.featuredMode || 'random'

  useEffect(() => {
    if (featuredMode !== 'random' || !recipes?.length) {
      setRandomId(null)
      return
    }
    const pick = recipes[Math.floor(Math.random() * recipes.length)]
    setRandomId(pick.id)
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
      label: 'Lista spesa',
      desc: 'Ingredienti',
      to: '/shopping-list',
      accent: 'bg-stone-50 text-stone-800 border-stone-200'
    }
  ]

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-10 animate-fade-in">
      <section className="mb-5 sm:mb-8">
        <h1 className="font-display text-2xl sm:text-4xl font-semibold text-stone-900 tracking-tight leading-snug">
          Ciao, {firstName}
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
                {featured.servings && (featured.difficulty || featured.caloriesPerServing != null) ? (
                  <span className="text-stone-300">·</span>
                ) : null}
                {featured.difficulty ? (
                  <span>{difficultyLabel[featured.difficulty] || featured.difficulty}</span>
                ) : null}
                {featured.caloriesPerServing != null ? (
                  <>
                    <span className="text-stone-300">·</span>
                    <span>{featured.caloriesPerServing} kcal</span>
                  </>
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

      <section>
        <h2 className="section-title !text-lg sm:!text-xl mb-3">Inizia da qui</h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
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
