import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes.js'
import { useIsDesktopSplit, useRecipeById } from '../hooks/useRecipeById.js'
import { useFavoritesStore } from '../store/favoritesStore.js'
import { useAuthStore } from '../store/authStore.js'
import { fold, rankByIngredients, tokens } from '../utils/ingredientMatch.js'
import { groupBySection } from '../utils/recipeSections.js'
import { formatScaledQty } from '../utils/scaleIngredients.js'
import FavoriteButton from '../components/recipe/FavoriteButton.jsx'
import { RecipeCover, TagChip, recipeMeta, formatMinutes } from '../components/recipe/RecipeBits.jsx'
import Icon from '../components/ui/Icon.jsx'

/** Staples that make useless pantry chips. */
const SKIP_CHIPS = new Set(
  ['sale', 'pepe', 'olio', 'acqua', 'zucchero', 'farina', 'aceto', 'ghiaccio', 'q', 'qb'].map(
    (w) => tokens(w)[0]
  )
)
const MAX_CHIPS = 10
const MAX_PREVIEW_STEPS = 6
const SECTION_HEADING =
  'font-body text-label-sm uppercase tracking-wider text-primary pb-1 border-b border-primary/15'

/** Most used ingredients across the book → quick "cosa cucino" chips. */
function topIngredients(recipes) {
  const counts = new Map()
  for (const r of recipes || []) {
    const seen = new Set()
    for (const name of r.ingredientNames || []) {
      const key = tokens(name)[0]
      if (!key || SKIP_CHIPS.has(key) || seen.has(key)) continue
      seen.add(key)
      const word = String(name).trim().split(/\s+/)[0].toLowerCase()
      const entry = counts.get(key) || { count: 0, labels: new Map() }
      entry.count += 1
      entry.labels.set(word, (entry.labels.get(word) || 0) + 1)
      counts.set(key, entry)
    }
  }
  return [...counts.values()]
    .filter((e) => e.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_CHIPS)
    .map((e) => {
      const label = [...e.labels.entries()].sort((a, b) => b[1] - a[1])[0][0]
      return label.charAt(0).toUpperCase() + label.slice(1)
    })
}

function matchesQuery(recipe, words) {
  if (!words.length) return true
  const hay = fold([recipe.title, ...(recipe.tags || []), ...(recipe.ingredientNames || [])].join(' '))
  return words.every((w) => hay.includes(w))
}

/* ───────────────────────── building blocks ───────────────────────── */

function SearchField({ value, onChange, className = '', inputClassName = '' }) {
  return (
    <label className={`relative flex items-center w-full ${className}`}>
      <span className="sr-only">Cerca ricetta</span>
      <Icon name="search" className="absolute left-4 text-outline pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Cerca titolo, tag o ingrediente…"
        enterKeyHint="search"
        className={`w-full min-h-[44px] rounded-full border border-outline-variant pl-11 pr-4 py-2 font-body text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ${inputClassName}`}
      />
    </label>
  )
}

function Chip({ active, onClick, children, tone = 'secondary', inactiveBg = 'bg-surface-container-low' }) {
  const on =
    tone === 'primary'
      ? 'bg-primary-tint border-primary text-primary-on-tint'
      : 'bg-secondary-container border-secondary text-secondary-on-container'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 min-h-[36px] px-4 py-1 rounded-full border font-body text-label-sm transition-colors duration-state-change ${
        active ? on : `${inactiveBg} border-outline-variant text-on-surface hover:bg-surface-container`
      }`}
    >
      {children}
    </button>
  )
}

function PantryPicker({ chips, selected, onToggle, onClear, inactiveBg, scrollOnPhone = false }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`flex gap-2 ${
          scrollOnPhone
            ? 'flex-nowrap overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap [&>*]:shrink-0'
            : 'flex-wrap'
        }`}
      >
        {chips.map((c) => (
          <Chip key={c} active={selected.includes(c)} onClick={() => onToggle(c)} inactiveBg={inactiveBg}>
            {selected.includes(c) ? <Icon name="check" size={14} /> : null}
            {c}
          </Chip>
        ))}
        <Link
          to="/cosa-cucino"
          className="inline-flex items-center gap-1 min-h-[36px] px-3 rounded-full font-body text-label-sm text-secondary hover:underline"
        >
          <Icon name="add" size={16} />
          Altro…
        </Link>
      </div>
      {selected.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="self-start inline-flex items-center gap-1 font-body text-label-sm text-on-surface-variant hover:text-on-surface"
        >
          <Icon name="close" size={14} />
          Togli filtro ingredienti
        </button>
      )}
    </div>
  )
}

/** Grid tile. `compact` = smaller text (right column of the "dettaglio" layout). */
function RecipeTile({ recipe, onOpen, compact = false, matched }) {
  const body = (
    <>
      <RecipeCover
        recipe={recipe}
        className="aspect-[16/10] w-full"
        imgClassName="transition-transform duration-surface-enter group-hover:scale-[1.03]"
      />
      <div className={`${compact ? 'p-2' : 'p-4'} flex flex-col gap-1 flex-1 justify-between`}>
        <div className="flex flex-col gap-1">
          {!compact && recipe.tags?.[0] ? <TagChip tag={recipe.tags[0]} /> : null}
          <h2
            className={
              compact
                ? 'font-body text-label-lg text-on-surface line-clamp-2'
                : 'font-headline text-title-md text-on-surface line-clamp-2 group-hover:text-primary transition-colors'
            }
          >
            {recipe.title}
          </h2>
        </div>
        <p className="font-body text-label-sm text-on-surface-variant tabular-nums pt-1">
          {matched?.length ? (
            <span className="text-secondary">Usa: {matched.join(', ')}</span>
          ) : (
            recipeMeta(recipe, { difficulty: !compact }) || '—'
          )}
        </p>
      </div>
    </>
  )
  const cls =
    'group text-left w-full h-full card overflow-hidden flex flex-col hover:border-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
  return (
    <div className="relative h-full">
      {onOpen ? (
        <button type="button" onClick={() => onOpen(recipe.id)} className={cls}>
          {body}
        </button>
      ) : (
        <Link to={`/recipes/${recipe.id}`} className={cls}>
          {body}
        </Link>
      )}
      <FavoriteButton
        recipeId={recipe.id}
        title={recipe.title}
        variant="overlay"
        className={`absolute top-2 right-2 ${compact ? '!min-h-[36px] !min-w-[36px]' : ''}`}
      />
    </div>
  )
}

function RecipeRow({ recipe, active, onOpen, matched }) {
  const time = formatMinutes(recipe.totalTime)
  const cls = `w-full text-left p-2 pr-4 rounded-xl border flex items-center justify-between gap-2 transition-colors duration-state-change ${
    active
      ? 'bg-primary-tint text-primary-on-tint border-primary'
      : 'bg-surface-container-lowest text-on-surface border-outline-variant hover:bg-surface-container'
  }`
  const inner = (
    <>
      <span className="flex items-center gap-2 min-w-0">
        <RecipeCover recipe={recipe} className="w-11 h-11 rounded-md" letterClassName="text-lg" />
        <span className="min-w-0 flex flex-col">
          <span className="font-body text-label-lg truncate">{recipe.title}</span>
          {matched?.length ? (
            <span className="font-body text-label-sm text-secondary truncate">Usa: {matched.join(', ')}</span>
          ) : null}
        </span>
      </span>
      {time ? (
        <span
          className={`font-body text-label-sm tabular-nums shrink-0 ${
            active ? '' : 'text-on-surface-variant'
          }`}
        >
          {time}
        </span>
      ) : null}
    </>
  )
  return onOpen ? (
    <button type="button" className={cls} onClick={() => onOpen(recipe.id)} aria-current={active || undefined}>
      {inner}
    </button>
  ) : (
    <Link to={`/recipes/${recipe.id}`} className={cls}>
      {inner}
    </Link>
  )
}

/** Inline preview opened from the catalog (desktop). */
function RecipePreview({ recipeId, onClose }) {
  const { recipe, isLoading, error, indexEntry } = useRecipeById(recipeId)
  const r = recipe?.id === recipeId ? recipe : null
  const head = indexEntry || (r ? { ...r, ...(r.metadata || {}) } : null)
  const ingredients = (r?.ingredients || []).filter((i) => i?.name)
  const steps = (r?.steps || []).filter((s) => s?.instruction)
  const tags = head?.tags || r?.metadata?.tags || []

  return (
    <article aria-label="Anteprima ricetta" className="card overflow-hidden flex flex-col animate-fade-in">
      <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low flex items-center justify-between gap-4 flex-wrap">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 min-h-[36px] text-primary font-body text-label-lg hover:underline"
        >
          <Icon name="arrow_back" size={18} />
          Torna alle ricette
        </button>
        <div className="flex items-center gap-2">
          {head ? (
            <span className="hidden md:inline font-mono text-mono-md text-on-surface-variant tabular-nums">
              {recipeMeta(head)}
            </span>
          ) : null}
          <Link
            to={`/recipes/${recipeId}`}
            className="inline-flex items-center gap-1 min-h-[36px] px-4 rounded-full bg-primary text-white font-body text-label-lg hover:bg-primary-container transition-colors duration-state-change"
          >
            <Icon name="open_in_new" size={16} />
            Apri completa
          </Link>
        </div>
      </div>

      <RecipeCover recipe={head || r} className="aspect-[16/9] w-full" letterClassName="text-6xl" />

      <div className="p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            {tags.slice(0, 3).map((t) => (
              <TagChip key={t} tag={t} />
            ))}
            <span className="chip">Anteprima rapida</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-headline text-headline-lg text-on-surface">{head?.title || r?.title || '…'}</h2>
            <FavoriteButton recipeId={recipeId} title={head?.title || ''} className="shrink-0" />
          </div>
          {r?.notes ? (
            <p className="font-body text-body-lg text-on-surface-variant text-pretty line-clamp-4">{r.notes}</p>
          ) : null}
        </div>

        {error && !r ? (
          <p className="font-body text-body-md text-red-700" role="alert">
            {error}
          </p>
        ) : isLoading && !r ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-outline-variant" aria-busy="true">
            <div className="h-40 rounded-xl bg-surface-container-low animate-pulse" />
            <div className="h-40 rounded-xl bg-surface-container-low animate-pulse" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-outline-variant">
            <div className="bg-surface-container-low rounded-xl p-4 flex flex-col gap-2">
              <h3 className="font-body text-title-md text-on-surface">
                Ingredienti{ingredients.length ? ` (${ingredients.length})` : ''}
              </h3>
              {ingredients.length ? (
                <div className="flex flex-col gap-3">
                  {groupBySection(ingredients).map((group, gi) => (
                    <div key={`ing-${group.startIndex}`} className="flex flex-col gap-1">
                      {group.section || gi > 0 ? (
                        <h4 className={SECTION_HEADING}>{group.section || 'Altri ingredienti'}</h4>
                      ) : null}
                      <ul className="flex flex-col gap-1 font-body text-body-md text-on-surface-variant">
                        {group.entries.map(({ item: ing, index }) => {
                          const qty = formatScaledQty(ing.quantity, ing.unit)
                          return (
                            <li key={ing.id || index}>
                              {ing.name}
                              {qty ? <span className="tabular-nums"> · {qty}</span> : null}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-body text-body-md text-outline">Nessun ingrediente</p>
              )}
            </div>
            <div className="bg-surface-container-low rounded-xl p-4 flex flex-col gap-2">
              <h3 className="font-body text-title-md text-on-surface">
                Passaggi{steps.length ? ` (${steps.length})` : ''}
              </h3>
              <div className="flex flex-col gap-3">
                {groupBySection(steps.slice(0, MAX_PREVIEW_STEPS)).map((group, gi) => (
                  <div key={`step-${group.startIndex}`} className="flex flex-col gap-1">
                    {group.section || gi > 0 ? (
                      <h4 className={SECTION_HEADING}>{group.section || 'Altri passi'}</h4>
                    ) : null}
                    <ol
                      start={group.startIndex + 1}
                      className="flex flex-col gap-1 font-body text-body-md text-on-surface-variant list-decimal list-inside"
                    >
                      {group.entries.map(({ item: st, index }) => (
                        <li key={st.id || index} className="line-clamp-2">
                          {st.instruction}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
              {steps.length > MAX_PREVIEW_STEPS ? (
                <Link to={`/recipes/${recipeId}`} className="font-body text-label-sm text-primary hover:underline">
                  Tutti i {steps.length} passaggi →
                </Link>
              ) : null}
              {!steps.length ? <p className="font-body text-body-md text-outline">Nessun passo</p> : null}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

function EmptyState({ title, message }) {
  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-dashed border-outline-variant p-8 sm:p-14 text-center">
      <h3 className="font-display text-headline-md text-on-surface mb-2">{title}</h3>
      <p className="font-body text-body-md text-on-surface-variant max-w-sm mx-auto">{message}</p>
    </div>
  )
}

/* ───────────────────────── page ───────────────────────── */

export default function Recipes() {
  const { recipes, searchFilter, setSearchFilter, loadRecipes, isLoading, error } = useRecipes()
  const view = useAuthStore((s) => s.recipesView) || 'dettaglio'
  const setView = useAuthStore((s) => s.setRecipesView)
  const isDesktop = useIsDesktopSplit(1024)
  const navigate = useNavigate()
  const [query, setQuery] = useState(searchFilter || '')
  const [pantry, setPantry] = useState([])
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    // Always the full index: search and filters run here, instantly
    loadRecipes('')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSearchFilter(query.trim())
  }, [query, setSearchFilter])

  const onlyFavorites = params.get('preferite') === '1'
  const previewId = params.get('anteprima')
  const favoriteIds = useFavoritesStore((s) => s.ids)
  const favoriteRecipes = useMemo(() => {
    const byId = new Map((recipes || []).map((r) => [r.id, r]))
    return favoriteIds.map((id) => byId.get(id)).filter(Boolean)
  }, [recipes, favoriteIds])

  const chips = useMemo(() => {
    const top = topIngredients(recipes)
    // Keep selected chips visible even if they drop out of the top list
    return [...new Set([...pantry, ...top])]
  }, [recipes, pantry])

  const { shown, matchedById } = useMemo(() => {
    let list = recipes || []
    if (onlyFavorites) {
      const order = new Map(favoriteIds.map((id, i) => [id, i]))
      list = list.filter((r) => order.has(r.id)).sort((a, b) => order.get(a.id) - order.get(b.id))
    }
    const words = fold(query).trim().split(/\s+/).filter(Boolean)
    list = list.filter((r) => matchesQuery(r, words))
    const matched = new Map()
    if (pantry.length) {
      const ranked = rankByIngredients(list, pantry)
      ranked.forEach((x) => matched.set(x.recipe.id, x.matched))
      list = ranked.map((x) => x.recipe)
    }
    return { shown: list, matchedById: matched }
  }, [recipes, onlyFavorites, favoriteIds, query, pantry])

  const setParam = (key, value, replace = true) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value == null) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace }
    )
  }

  const toggleFavorites = () => setParam('preferite', onlyFavorites ? null : '1')
  const togglePantry = (c) => setPantry((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))
  // Desktop: open the inline preview; phones go straight to the full recipe
  const openRecipe = isDesktop ? (id) => setParam('anteprima', id, false) : null
  const closePreview = () => setParam('anteprima', null)

  useEffect(() => {
    if (!isDesktop && previewId) navigate(`/recipes/${previewId}`, { replace: true })
  }, [isDesktop, previewId, navigate])

  const total = recipes?.length || 0
  const filtered = shown.length !== total
  const emptyTitle = onlyFavorites ? 'Nessuna preferita' : query || pantry.length ? 'Nessun risultato' : 'Nessuna ricetta ancora'
  const emptyMessage = onlyFavorites
    ? 'Tocca la stellina su una ricetta per metterla tra le preferite (vale su questo dispositivo).'
    : query || pantry.length
      ? 'Nessuna ricetta trovata. Prova un’altra parola o togli qualche ingrediente.'
      : 'Aggiungi la prima ricetta con il pulsante in alto.'

  const favoritesChip = (
    <Chip active={onlyFavorites} onClick={toggleFavorites} tone="primary">
      <Icon name="star" size={14} filled={onlyFavorites} />
      Preferite{favoriteIds.length ? ` (${favoriteIds.length})` : ''}
    </Chip>
  )

  const countLabel = (
    <span className="font-body text-label-sm text-on-surface-variant tabular-nums">
      {shown.length} {shown.length === 1 ? 'ricetta' : 'ricette'}
    </span>
  )

  const grid = (compact) =>
    shown.length ? (
      <section
        aria-label="Elenco ricette"
        className={`grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 items-stretch ${compact ? 'gap-3 sm:gap-4' : 'gap-3 sm:gap-6'}`}
      >
        {shown.map((r) => (
          <RecipeTile key={r.id} recipe={r} onOpen={openRecipe} compact={compact || !isDesktop} matched={matchedById.get(r.id)} />
        ))}
      </section>
    ) : (
      <EmptyState title={emptyTitle} message={emptyMessage} />
    )

  const loading = isLoading && !total

  return (
    <main className="max-w-[1200px] w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8 animate-fade-in">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <h1 className="page-title">Ricette</h1>
          {!loading && (
            <span className="font-mono text-mono-md text-on-surface-variant tabular-nums">
              {filtered ? `${shown.length} di ${total}` : total} ricette
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDesktop && (
            <div
              role="radiogroup"
              aria-label="Visualizzazione"
              className="inline-flex items-center gap-1 bg-surface-container-low p-1 rounded-full border border-outline-variant mr-1"
            >
              {[
                ['dettaglio', 'view_sidebar', 'Elenco e anteprima'],
                ['caselle', 'grid_view', 'Caselle']
              ].map(([key, icon, label]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={view === key}
                  title={label}
                  aria-label={label}
                  onClick={() => setView(key)}
                  className={`inline-flex items-center justify-center w-9 h-8 rounded-full transition-colors duration-state-change ${
                    view === key ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <Icon name={icon} size={18} />
                </button>
              ))}
            </div>
          )}
          <Link to="/recipes/import#foto" className="btn-secondary !px-4 hidden sm:inline-flex">
            <Icon name="document_scanner" size={18} />
            Importa da foto/pdf
          </Link>
          <Link to="/recipes/import" className="btn-secondary !px-4" aria-label="Importa da URL">
            <Icon name="link" size={18} />
            <span>Importa URL</span>
          </Link>
          <Link to="/recipes/new" className="btn-primary !px-5">
            <Icon name="add" size={18} />
            Nuova ricetta
          </Link>
        </div>
      </section>

      {error && (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-xl font-body text-body-md text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
              <div className="aspect-[16/10] bg-surface-container-low animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 rounded bg-surface-container-low" />
                <div className="h-3 w-1/2 rounded bg-surface-container-low" />
              </div>
            </div>
          ))}
        </div>
      ) : view === 'dettaglio' && isDesktop ? (
        /* ── Elenco + anteprima ── */
        <div className="grid grid-cols-12 gap-8 items-start">
          <aside className="col-span-4 sticky top-24 max-h-[calc(100dvh-7rem)] bg-surface-container-low border border-outline-variant rounded-2xl p-6 flex flex-col gap-6 shadow-md">
            <div className="flex flex-col gap-2">
              <SearchField value={query} onChange={setQuery} inputClassName="bg-surface-container-lowest" />
              <div className="flex items-center justify-between gap-2">
                {favoritesChip}
                {countLabel}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-4 border-t border-outline-variant">
              <div className="flex items-center gap-1">
                <Icon name="kitchen" size={18} className="text-secondary" />
                <h2 className="font-body text-title-md text-on-surface">Cosa cucino con quello che ho?</h2>
              </div>
              <p className="font-body text-body-md text-on-surface-variant">Seleziona gli ingredienti in dispensa:</p>
              <PantryPicker
                chips={chips}
                selected={pantry}
                onToggle={togglePantry}
                onClear={() => setPantry([])}
                inactiveBg="bg-surface-container-lowest"
              />
            </div>

            <div className="flex flex-col gap-2 pt-4 border-t border-outline-variant min-h-0">
              <div className="flex items-center gap-1">
                <Icon name="star" size={18} filled className="text-primary" />
                <h2 className="font-body text-title-md text-on-surface">Le tue preferite</h2>
                {favoriteRecipes.length ? (
                  <span className="ml-auto font-body text-label-sm text-on-surface-variant tabular-nums">
                    {favoriteRecipes.length}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 overflow-y-auto -mr-3 pr-3 min-h-[120px]">
                {favoriteRecipes.map((r) => (
                  <RecipeRow key={r.id} recipe={r} active={r.id === previewId} onOpen={openRecipe} />
                ))}
                {!favoriteRecipes.length ? (
                  <p className="font-body text-body-md text-on-surface-variant py-2">
                    Nessuna preferita ancora: tocca la <Icon name="star" size={16} className="text-primary" /> su
                    una ricetta per averla sempre qui (vale su questo dispositivo).
                  </p>
                ) : null}
              </div>
            </div>
          </aside>

          <div className="col-span-8 flex flex-col">
            {previewId ? <RecipePreview key={previewId} recipeId={previewId} onClose={closePreview} /> : grid(true)}
          </div>
        </div>
      ) : (
        /* ── Caselle (and phones) ── */
        <>
          <section aria-label="Ricerca e filtri dispensa" className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-stretch">
            <div className="lg:col-span-5 card p-4 sm:p-6 flex flex-col justify-between gap-3 sm:gap-4">
              <div className="hidden sm:flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <Icon name="search" className="text-primary" />
                  <h2 className="font-body text-title-md text-on-surface">Cerca ricetta</h2>
                </div>
                {countLabel}
              </div>
              <SearchField value={query} onChange={setQuery} inputClassName="bg-surface-container-low" />
              <div className="flex items-center justify-between gap-2">
                {favoritesChip}
                <span className="sm:hidden">{countLabel}</span>
              </div>
            </div>

            <div className="lg:col-span-7 card p-4 sm:p-6 flex flex-col justify-between gap-3 sm:gap-4 overflow-hidden">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <Icon name="kitchen" className="text-secondary" />
                  <h2 className="font-body text-label-lg sm:text-title-md text-on-surface">Cosa cucino con quello che ho?</h2>
                </div>
                <span className="hidden sm:inline font-body text-label-sm text-on-surface-variant">
                  Seleziona gli ingredienti in dispensa
                </span>
              </div>
              <PantryPicker
                chips={chips}
                selected={pantry}
                onToggle={togglePantry}
                onClear={() => setPantry([])}
                scrollOnPhone
              />
            </div>
          </section>

          {previewId && isDesktop ? (
            <RecipePreview key={previewId} recipeId={previewId} onClose={closePreview} />
          ) : (
            grid(false)
          )}
        </>
      )}
    </main>
  )
}
