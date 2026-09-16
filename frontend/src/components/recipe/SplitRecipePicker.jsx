import { useEffect, useMemo, useState } from 'react'
import { useRecipes } from '../../hooks/useRecipes.js'

/**
 * Desktop-only picker to choose the second recipe for split view.
 */
export default function SplitRecipePicker({ excludeId, onSelect, onCancel }) {
  const { recipes, loadRecipes, isLoading } = useRecipes()
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadRecipes().catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (recipes || [])
      .filter((r) => r.id !== excludeId)
      .filter((r) => {
        if (!q) return true
        const hay = `${r.title || ''} ${(r.tags || []).join(' ')}`.toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 40)
  }, [recipes, excludeId, query])

  return (
    <div className="h-full flex flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-stone-900">Apri a fianco</h2>
          <p className="text-sm text-stone-500 mt-0.5">Scegli una seconda ricetta da confrontare.</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center min-h-[40px] min-w-[40px] rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-50"
          onClick={onCancel}
          aria-label="Chiudi split view"
        >
          ✕
        </button>
      </div>

      <input
        className="input-field !min-h-[44px] mb-3"
        placeholder="Cerca ricetta…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      <div className="flex-1 overflow-y-auto rounded-2xl border border-stone-200 bg-white">
        {isLoading && !filtered.length ? (
          <p className="p-4 text-sm text-stone-400">Caricamento…</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-stone-400">Nessuna ricetta trovata.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {filtered.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-stone-50 min-h-[56px]"
                  onClick={() => onSelect(r.id)}
                >
                  <span className="shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
                    {r.imageUrl ? (
                      <img src={r.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center font-display text-lg text-stone-400">
                        {(r.title || '?')[0]}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-stone-900 truncate">{r.title}</span>
                    {r.authorDisplayName ? (
                      <span className="block text-xs text-stone-400 truncate">di {r.authorDisplayName}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
