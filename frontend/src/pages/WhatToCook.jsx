import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listRecipes } from '../services/recipes.js'
import { suggestWhatToCook } from '../services/gemini.js'
import { useEditAccess } from '../store/authStore.js'
import { useRecipeStore } from '../store/recipeStore.js'
import { rankByIngredients } from '../utils/ingredientMatch.js'
import { useSessionDraft, draftKey } from '../hooks/useSessionDraft.js'

const MAX_SHOWN = 12

function RecipeThumb({ recipe }) {
  return recipe?.imageUrl ? (
    <img src={recipe.imageUrl} alt="" loading="lazy" className="w-16 h-16 shrink-0 rounded-xl object-cover bg-stone-100" />
  ) : (
    <div className="w-16 h-16 shrink-0 rounded-xl bg-gradient-to-br from-orange-50 via-stone-50 to-teal-50 flex items-center justify-center">
      <span className="font-display text-xl text-stone-300">{recipe?.title?.[0] || 'R'}</span>
    </div>
  )
}

export default function WhatToCook() {
  const { requestUnlock } = useEditAccess()
  const { value: have, setValue: setHave } = useSessionDraft(draftKey('what-to-cook'), [])
  const items = Array.isArray(have) ? have : []
  const [input, setInput] = useState('')
  const [all, setAll] = useState(() => useRecipeStore.getState().recipes || [])
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [ai, setAi] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    // Full list (the store may hold the last search only)
    listRecipes('')
      .then((res) => setAll(res.data || []))
      .catch(() => {})
  }, [])

  const add = (raw) => {
    const parts = String(raw || '')
      .split(/[,;\n]+/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (!parts.length) return
    setHave((prev) => {
      const list = Array.isArray(prev) ? prev : []
      const seen = new Set(list.map((x) => x.toLowerCase()))
      return [...list, ...parts.filter((p) => !seen.has(p.toLowerCase()))].slice(0, 30)
    })
    setInput('')
    setAi(null)
  }

  const removeItem = (item) => {
    setHave((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x !== item))
    setAi(null)
  }

  const ranked = useMemo(() => rankByIngredients(all, items), [all, items])
  const byId = useMemo(() => new Map(all.map((r) => [r.id, r])), [all])
  const missingNames = all.some((r) => !r.ingredientNames)

  const askAi = async () => {
    if (!items.length) return
    if (!(await requestUnlock())) return
    setAiBusy(true)
    setAiError(null)
    try {
      const res = await suggestWhatToCook(items)
      setAi(res.data?.suggestions || [])
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-8 animate-fade-in">
      <Link to="/recipes" className="inline-flex items-center min-h-[44px] text-sm text-stone-400 active:text-stone-700">
        ← Ricette
      </Link>
      <h1 className="page-title mt-1">Cosa cucino?</h1>
      <p className="text-sm text-stone-500 mt-1">
        Scrivi cosa hai in frigo o in dispensa: ti mostro le vostre ricette che lo usano.
      </p>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add(input)
          inputRef.current?.focus()
        }}
      >
        <input
          ref={inputRef}
          className="input-field !min-h-[44px] !py-2.5"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Es. zucchine, uova, ricotta"
          aria-label="Ingrediente che hai"
          enterKeyHint="done"
          autoComplete="off"
        />
        <button type="submit" className="btn-secondary shrink-0 !min-h-[44px] !px-4 !py-2.5" disabled={!input.trim()}>
          Aggiungi
        </button>
      </form>

      {items.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => removeItem(item)}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full bg-teal-50 border border-teal-200 text-sm font-medium text-teal-800"
              aria-label={`Togli ${item}`}
            >
              {item} <span aria-hidden className="text-teal-500">×</span>
            </button>
          ))}
          <button
            type="button"
            className="inline-flex items-center min-h-[36px] px-2 text-xs text-stone-400"
            onClick={() => {
              setHave([])
              setAi(null)
            }}
          >
            Svuota
          </button>
        </div>
      )}

      {items.length > 0 && (
        <section className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title !text-lg">
              {ranked.length ? `Ricette che usano i tuoi ingredienti (${ranked.length})` : 'Nessuna ricetta li usa'}
            </h2>
            <button type="button" className="btn-secondary !py-2 !px-3.5 text-sm" onClick={askAi} disabled={aiBusy}>
              {aiBusy ? 'L’IA sta pensando…' : 'Chiedi all’IA'}
            </button>
          </div>
          {missingNames && (
            <p className="text-xs text-stone-400">
              Sto ancora indicizzando gli ingredienti di alcune ricette: riapri la pagina tra poco per risultati completi.
            </p>
          )}

          {aiError && (
            <p className="text-sm text-red-600" role="alert">
              {aiError}
            </p>
          )}
          {ai && (
            <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-3 sm:p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-800 mb-2">Consigli dell’IA</p>
              {ai.length ? (
                <ul className="space-y-2">
                  {ai.map((s) => (
                    <li key={s.id}>
                      <Link to={`/recipes/${s.id}`} className="flex gap-3 items-center rounded-xl bg-white border border-stone-200/80 p-2 pr-3 active:bg-stone-50">
                        <RecipeThumb recipe={byId.get(s.id) || { title: s.title }} />
                        <div className="min-w-0">
                          <p className="font-semibold text-stone-900 leading-snug">{s.title}</p>
                          {s.reason ? <p className="text-sm text-stone-600 mt-0.5">{s.reason}</p> : null}
                          {s.missing?.length ? (
                            <p className="text-xs text-stone-500 mt-0.5">Ti manca: {s.missing.join(', ')}</p>
                          ) : (
                            <p className="text-xs text-teal-700 mt-0.5">Hai tutto</p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-stone-600">L’IA non ha trovato ricette adatte nel vostro ricettario.</p>
              )}
            </div>
          )}

          <ul className="space-y-2">
            {ranked.slice(0, MAX_SHOWN).map(({ recipe, matched, missing }) => (
              <li key={recipe.id}>
                <Link
                  to={`/recipes/${recipe.id}`}
                  className="flex gap-3 items-center rounded-2xl border border-stone-200/80 bg-white p-2 pr-3 active:bg-stone-50"
                >
                  <RecipeThumb recipe={recipe} />
                  <div className="min-w-0">
                    <p className="font-semibold text-stone-900 leading-snug line-clamp-2">{recipe.title}</p>
                    <p className="text-xs text-teal-700 mt-0.5">
                      Usa: {matched.join(', ')}
                      {matched.length < items.length ? ` (${matched.length} su ${items.length})` : ''}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      {missing.length ? `Ti serve anche: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '…' : ''}` : 'Hai tutto (a parte la dispensa)'}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
