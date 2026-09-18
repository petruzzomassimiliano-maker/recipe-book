import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useRecipes } from '../hooks/useRecipes.js'
import RecipeList from '../components/recipe/RecipeList.jsx'

function firstName(name) {
  return String(name || 'Utente').trim().split(/\s+/)[0] || 'Utente'
}

function bareUserId(authorOrId) {
  return String(authorOrId || '')
    .trim()
    .replace(/^user-/, '')
}

function isSharedWithViewer(recipe, viewerUserId) {
  if (!viewerUserId || !recipe) return false
  const author = recipe.author || ''
  const vid = String(viewerUserId)
  if (author === `user-${vid}` || author === vid) return false
  const ids = recipe.sharedWithUserIds || []
  return ids.map(String).includes(vid)
}

function isOwnRecipe(recipe, viewerUserId) {
  if (!viewerUserId || !recipe?.author) return false
  const vid = String(viewerUserId)
  return recipe.author === `user-${vid}` || recipe.author === vid
}

/**
 * Recipes that belong in a family member's tab when staff inspects them:
 * - authored by that person, OR
 * - shared with that person (ownership stays on the sharer).
 */
function recipesForPerson(allRecipes, personUserId) {
  const pid = String(personUserId)
  if (!pid) return []
  const seen = new Set()
  const out = []
  for (const recipe of allRecipes || []) {
    if (!recipe?.id || seen.has(recipe.id)) continue
    const own = isOwnRecipe(recipe, pid)
    const sharedIn = isSharedWithViewer(recipe, pid)
    if (!own && !sharedIn) continue
    seen.add(recipe.id)
    out.push(recipe)
  }
  out.sort((a, b) => {
    const aOwn = isOwnRecipe(a, pid)
    const bOwn = isOwnRecipe(b, pid)
    if (aOwn !== bOwn) return aOwn ? -1 : 1
    return String(a.title || '').localeCompare(String(b.title || ''), 'it', {
      sensitivity: 'base'
    })
  })
  return out
}

/**
 * Build staff tabs for every other family member who either authored
 * recipes or received shares — not only authors.
 */
function buildOtherPersonTabs(recipes, myUserId) {
  const people = new Map()

  const ensure = (userId, name) => {
    const id = bareUserId(userId)
    if (!id || id === String(myUserId)) return null
    if (!people.has(id)) {
      people.set(id, { userId: id, name: name || 'Utente' })
    } else if (name && people.get(id).name === 'Utente') {
      people.get(id).name = name
    } else if (name && name !== 'Utente') {
      people.get(id).name = name
    }
    return people.get(id)
  }

  for (const recipe of recipes || []) {
    const authorId = bareUserId(recipe.author)
    if (authorId) ensure(authorId, recipe.authorDisplayName)

    for (const sw of recipe.sharedWith || []) {
      if (sw?.id) ensure(sw.id, sw.displayName)
    }
    for (const id of recipe.sharedWithUserIds || []) {
      ensure(id, null)
    }
  }

  const tabs = []
  for (const person of people.values()) {
    const list = recipesForPerson(recipes, person.userId)
    if (!list.length) continue
    tabs.push({
      id: `user-${person.userId}`,
      label: firstName(person.name),
      count: list.length,
      recipes: list,
      // Badges as if viewing that person's account
      perspectiveUserId: person.userId,
      sharedInCount: list.filter((r) => isSharedWithViewer(r, person.userId)).length
    })
  }

  tabs.sort((a, b) => a.label.localeCompare(b.label, 'it', { sensitivity: 'base' }))
  return tabs
}

const SHARED_TAB = '__shared__'
const MINE_TAB = '__mine__'

export default function Recipes() {
  const { user, isStaff } = useAuth()
  const { recipes, searchFilter, setSearchFilter, loadRecipes, isLoading, error } = useRecipes()
  const [activeTab, setActiveTab] = useState(null)
  const [query, setQuery] = useState(searchFilter || '')

  useEffect(() => {
    loadRecipes()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const myUserId = user?.id || user?.userId || null

  const sharedWithMe = useMemo(
    () => (recipes || []).filter((r) => isSharedWithViewer(r, myUserId)),
    [recipes, myUserId]
  )

  const myRecipes = useMemo(
    () => (recipes || []).filter((r) => isOwnRecipe(r, myUserId)),
    [recipes, myUserId]
  )

  const otherPersonTabs = useMemo(() => {
    if (!isStaff || !myUserId) return []
    return buildOtherPersonTabs(recipes, myUserId)
  }, [recipes, isStaff, myUserId])

  const tabs = useMemo(() => {
    const list = [
      {
        id: MINE_TAB,
        label: 'Tue',
        count: myRecipes.length,
        recipes: myRecipes,
        perspectiveUserId: myUserId
      }
    ]
    if (sharedWithMe.length > 0) {
      list.push({
        id: SHARED_TAB,
        label: 'Condivise',
        count: sharedWithMe.length,
        recipes: sharedWithMe,
        perspectiveUserId: myUserId
      })
    }
    if (isStaff) {
      list.push(...otherPersonTabs)
    }
    return list
  }, [myRecipes, sharedWithMe, otherPersonTabs, isStaff, myUserId])

  useEffect(() => {
    if (!tabs.length) {
      setActiveTab(null)
      return
    }
    setActiveTab((prev) => {
      if (prev && tabs.some((t) => t.id === prev)) return prev
      return tabs[0].id
    })
  }, [tabs])

  const active = useMemo(
    () => tabs.find((t) => t.id === activeTab) || tabs[0] || null,
    [tabs, activeTab]
  )

  const visibleCount = active?.recipes?.length ?? recipes.length
  const listViewerId = active?.perspectiveUserId || myUserId
  const isOtherPersonTab =
    active && active.id !== MINE_TAB && active.id !== SHARED_TAB && isStaff

  const handleSearch = (e) => {
    e.preventDefault()
    setSearchFilter(query)
    loadRecipes(query)
  }

  const showTabs = tabs.length > 1 || isStaff

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 animate-fade-in">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="page-title">Ricette</h1>
          {!isLoading && (
            <p className="text-xs text-stone-400 mt-0.5 tabular-nums">
              {visibleCount} {visibleCount === 1 ? 'ricetta' : 'ricette'}
              {sharedWithMe.length > 0 ? ` · ${sharedWithMe.length} condivise con te` : ''}
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
      ) : (
        <div className="space-y-4">
          {showTabs && (
            <div
              role="tablist"
              aria-label="Filtra ricette"
              className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-none"
            >
              {tabs.map((tab) => {
                const selected = tab.id === activeTab
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveTab(tab.id)}
                    className={`snap-start shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-full text-sm font-medium transition-colors border ${
                      selected
                        ? tab.id === SHARED_TAB
                          ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                          : 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-white text-stone-700 border-stone-200 active:bg-stone-50'
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`tabular-nums text-xs px-1.5 py-0.5 rounded-full ${
                        selected ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {isOtherPersonTab && (
            <p className="text-xs text-stone-500 leading-relaxed">
              Vista di <span className="font-medium text-stone-700">{active.label}</span>
              : le sue ricette
              {active.sharedInCount > 0
                ? ` + ${active.sharedInCount} ricevute in condivisione`
                : ''}
              .
            </p>
          )}

          <RecipeList
            recipes={active?.recipes || recipes}
            viewerUserId={listViewerId}
            emptyMessage={
              activeTab === SHARED_TAB
                ? 'Nessuna ricetta condivisa con te al momento.'
                : isOtherPersonTab
                  ? 'Nessuna ricetta propria o condivisa per questa persona.'
                  : 'Aggiungi la tua prima ricetta con il pulsante in alto.'
            }
          />
        </div>
      )}
    </main>
  )
}
