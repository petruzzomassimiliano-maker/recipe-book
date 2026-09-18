import { useEffect, useMemo, useState } from 'react'
import { listPeers } from '../../services/users.js'
import { shareRecipe } from '../../services/recipes.js'

/**
 * Share a recipe with other family accounts (view-only).
 * Ownership stays on the author.
 */
export default function RecipeSharePanel({ recipe, onUpdated, onClose }) {
  const [peers, setPeers] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const initialIds = useMemo(
    () =>
      new Set(
        (recipe?.metadata?.sharedWithUserIds || recipe?.sharedWithUserIds || []).map(String)
      ),
    [recipe]
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listPeers()
      .then((res) => {
        if (cancelled) return
        setPeers(res.data || [])
        setSelected(new Set(initialIds))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Impossibile caricare i membri')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [initialIds])

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await shareRecipe(recipe.id, [...selected])
      onUpdated?.(res.data)
      onClose?.()
    } catch (err) {
      setError(err.message || 'Condivisione fallita')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-recipe-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl border border-stone-200/80 max-h-[85dvh] flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-stone-100">
          <h2 id="share-recipe-title" className="font-display text-xl font-semibold text-stone-900">
            Condividi ricetta
          </h2>
          <p className="mt-1 text-sm text-stone-500 leading-relaxed">
            Resta tua: gli altri la vedono nella loro lista, senza poterla modificare.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && <p className="text-sm text-stone-400">Caricamento membri…</p>}
          {error && (
            <p className="mb-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {!loading && peers.length === 0 && (
            <p className="text-sm text-stone-500">
              Non ci sono altri account in famiglia. Invita qualcuno dalle Impostazioni.
            </p>
          )}
          {!loading && peers.length > 0 && (
            <ul className="space-y-1" aria-label="Membri famiglia">
              {peers.map((peer) => {
                const checked = selected.has(peer.id)
                return (
                  <li key={peer.id}>
                    <label className="flex items-center gap-3 min-h-[48px] px-2 rounded-xl hover:bg-stone-50 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-stone-300 text-primary focus:ring-primary/30"
                        checked={checked}
                        onChange={() => toggle(peer.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-stone-800 truncate">
                          {peer.displayName}
                        </span>
                        <span className="block text-xs text-stone-400 capitalize">{peer.role}</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-4 border-t border-stone-100 flex gap-2 justify-end">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Annulla
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={saving || loading}
            aria-busy={saving}
          >
            {saving ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}
