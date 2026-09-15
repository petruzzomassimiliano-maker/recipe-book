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
      label: 'Da URL / YouTube',
      desc: 'Sito oppure video ricetta',
      to: '/recipes/import',
      accent: 'bg-teal-50 text-teal-800 border-teal-100'
    },
    {
      label: 'Manuale',
      desc: 'Scrivi la ricetta tu',
      to: '/recipes/new',
      accent: 'bg-orange-50 text-orange-900 border-orange-100'
    },
    {
      label: 'Lista spesa',
      desc: 'Ingredienti da fare',
      to: '/shopping-list',
      accent: 'bg-stone-50 text-stone-800 border-stone-200'
    }
  ]

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 animate-fade-in">
      <section className="mb-8 sm:mb-10">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-stone-200/80 bg-white shadow-sm">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,107,107,0.16),_transparent_55%),radial-gradient(ellipse_at_bottom_left,_rgba(42,157,143,0.12),_transparent_50%)]"
          />
          <div className="relative px-6 sm:px-10 py-8 sm:py-11">
            <h1 className="font-display text-3xl sm:text-5xl font-semibold text-stone-900 tracking-tight leading-[1.15]">
              Ciao, {firstName}, cosa cuciniamo oggi?
            </h1>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-end justify-between mb-4 gap-3">
          <h2 className="section-title">In evidenza</h2>
          <Link to="/recipes" className="text-sm text-primary font-semibold hover:underline">
            Vedi tutte
          </Link>
        </div>

        {isLoading && !featured ? (
          <p className="text-stone-400">Caricamento…</p>
        ) : !featured ? (
          <div className="rounded-3xl bg-white border border-dashed border-stone-200 p-10 text-center">
            <h3 className="font-display text-xl font-semibold text-stone-900 mb-2">Nessuna ricetta ancora</h3>
            <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-4">
              Aggiungi la prima ricetta o importane una da URL.
            </p>
            <button type="button" className="btn-primary !py-2.5 !px-5" onClick={() => navigate('/recipes/import')}>
              Importa
            </button>
          </div>
        ) : (
          <Link
            to={`/recipes/${featured.id}`}
            className="group block relative overflow-hidden rounded-[1.75rem] border border-stone-200/80 bg-stone-900 shadow-sm min-h-[280px] sm:min-h-[380px]"
          >
            {featured.imageUrl ? (
              <img
                src={featured.imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
            ) : (
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-br from-primary/90 via-stone-800 to-teal-900"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/35 to-transparent" />
            <div className="relative flex h-full min-h-[280px] sm:min-h-[380px] flex-col justify-end p-6 sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">
                {FEATURED_LABEL[featuredMode] || FEATURED_LABEL.random}
              </p>
              <h3 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold text-white tracking-tight leading-[1.1] max-w-3xl">
                {featured.title}
              </h3>
              <p className="mt-3 text-sm sm:text-base text-white/80 flex flex-wrap gap-x-2 gap-y-1">
                {featured.servings ? <span>{featured.servings} porzioni</span> : null}
                {featured.servings && (featured.difficulty || featured.caloriesPerServing != null) ? (
                  <span className="text-white/40">·</span>
                ) : null}
                {featured.difficulty ? (
                  <span>{difficultyLabel[featured.difficulty] || featured.difficulty}</span>
                ) : null}
                {featured.caloriesPerServing != null ? (
                  <>
                    <span className="text-white/40">·</span>
                    <span>{featured.caloriesPerServing} kcal</span>
                  </>
                ) : null}
              </p>
              <span className="mt-5 inline-flex w-fit items-center gap-1.5 rounded-xl bg-white text-stone-900 text-sm font-semibold px-4 py-2.5 group-hover:bg-primary group-hover:text-white transition-colors">
                Apri ricetta
                <span aria-hidden>→</span>
              </span>
            </div>
          </Link>
        )}
      </section>

      <section>
        <h2 className="section-title mb-4">Inizia da qui</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => navigate(action.to)}
              className={`text-left rounded-2xl border px-5 py-4 transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 ${action.accent}`}
            >
              <div className="font-semibold text-[15px]">{action.label}</div>
              <div className="text-sm opacity-70 mt-1">{action.desc}</div>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
