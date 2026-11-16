import { useEffect, useMemo, useState } from 'react'
import { ApplianceIcon } from './ApplianceIcon.jsx'
import {
  COMMON_COOKING_APPLIANCES,
  COOKING_APPLIANCES,
  normalizeMethodId
} from '../../utils/cookingAppliances.js'
import { detectRecipeMethods } from '../../utils/cookingDetect.js'

export default function CookingMethodsSection({
  recipe,
  methods = [],
  summary = '',
  loading = false,
  error = null,
  loadingMethod = null,
  onAnalyze,
  onSelectAppliance
}) {
  // The recipe's own method comes from its text (same detector as the Worker)
  const detected = useMemo(() => detectRecipeMethods(recipe), [recipe])
  const mentioned = useMemo(() => detected.mentioned.map((method) => ({ method })), [detected])
  const mentionedIds = useMemo(() => new Set(detected.mentioned), [detected])
  const primary = detected.primary

  const savedRecommended = useMemo(
    () => normalizeMethodId((methods || []).find((m) => m.recommended)?.method || ''),
    [methods]
  )
  // Guides saved by the old logic could recommend a method the recipe doesn't use
  const staleGuides = Boolean(primary && methods?.length && savedRecommended && savedRecommended !== primary)
  const recommendedId = primary || savedRecommended || null

  const methodsById = useMemo(() => {
    const map = new Map()
    for (const m of methods || []) {
      const id = normalizeMethodId(m.method)
      // Temperature/time of the recipe's own method are read from the recipe text
      const fromText =
        id === primary
          ? {
              ...(detected.params.temperature ? { temperature: detected.params.temperature } : {}),
              ...(detected.params.time ? { time: detected.params.time } : {})
            }
          : {}
      map.set(id, { ...m, ...fromText, recommended: id === recommendedId })
    }
    return map
  }, [methods, primary, detected, recommendedId])

  // Solo metodi comuni + eventuali metodi non-comuni citati nella ricetta
  const visibleAppliances = useMemo(() => {
    const ids = new Set(COMMON_COOKING_APPLIANCES.map((a) => a.id))
    for (const m of mentioned) {
      if (COOKING_APPLIANCES.some((a) => a.id === m.method)) ids.add(m.method)
    }
    for (const m of methods || []) {
      const id = normalizeMethodId(m.method)
      if (COOKING_APPLIANCES.some((a) => a.id === id) && m.recommended) ids.add(id)
    }
    return COOKING_APPLIANCES.filter((a) => ids.has(a.id))
  }, [mentioned, methods])

  const [selectedId, setSelectedId] = useState(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setSelectedId(null)
    setExpanded(false)
  }, [recipe?.id])

  const selectedMethod = selectedId ? methodsById.get(selectedId) : null
  const selectedMeta = COOKING_APPLIANCES.find((a) => a.id === selectedId)

  const handleClick = (id) => {
    if (expanded && selectedId === id) {
      setExpanded(false)
      setSelectedId(null)
      return
    }

    setSelectedId(id)
    setExpanded(true)

    const existing = methodsById.get(id)
    const thinGuide =
      existing &&
      !existing.temperature &&
      !existing.time &&
      String(existing.notes || '').length < 80
    if ((!existing || thinGuide) && onSelectAppliance) {
      onSelectAppliance(id)
    }
  }

  return (
    <section className="card p-5 sm:p-6 mt-4 border-primary/20 bg-gradient-to-br from-orange-50/70 via-white to-teal-50/40">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Come cuocerla</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Tocca un’icona per aprire i consigli · ritocca per chiudere
          </p>
        </div>
        {onAnalyze ? (
          <button
            type="button"
            className="btn-secondary !py-2 !px-3 text-sm"
            onClick={onAnalyze}
            disabled={loading && !loadingMethod}
            aria-busy={loading && !loadingMethod}
          >
            {loading && !loadingMethod ? 'Analisi…' : methods?.length ? 'Aggiorna tutti' : 'Rileva con IA'}
          </button>
        ) : null}
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {staleGuides && (
        <p className="mb-3 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          Questi consigli sono stati creati con una versione precedente e possono essere imprecisi.
          Tocca «Aggiorna tutti» per rigenerarli.
        </p>
      )}

      {summary && expanded && !staleGuides && (
        <p className="mb-4 text-[15px] leading-relaxed text-gray-700">{summary}</p>
      )}

      <div
        className="flex gap-2 sm:gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory"
        role="listbox"
        aria-label="Metodi di cottura"
      >
        {visibleAppliances.map((app) => {
          const isSelected = expanded && selectedId === app.id
          const inRecipe = mentionedIds.has(app.id)
          const hasGuide = methodsById.has(app.id)
          const isRec = recommendedId === app.id
          const busy = loadingMethod === app.id

          return (
            <button
              key={app.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-expanded={isSelected}
              title={isSelected ? `${app.label} (chiudi)` : app.label}
              onClick={() => handleClick(app.id)}
              disabled={busy}
              className={[
                'snap-start shrink-0 w-[4.75rem] sm:w-24 rounded-2xl border px-2 py-3',
                'flex flex-col items-center gap-1.5 transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                isSelected
                  ? 'border-primary bg-white text-primary shadow-md scale-[1.03]'
                  : inRecipe
                    ? 'border-teal-200 bg-teal-50/80 text-teal-900 hover:border-teal-300'
                    : 'border-gray-100 bg-white/80 text-gray-600 hover:border-gray-200 hover:text-gray-900',
                busy ? 'opacity-70' : ''
              ].join(' ')}
            >
              <span className="relative">
                <ApplianceIcon id={app.id} className="w-8 h-8" />
                {isRec && (
                  <span
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-white"
                    aria-label="Consigliato"
                  />
                )}
              </span>
              <span className="text-[11px] sm:text-xs font-semibold leading-tight text-center">
                {app.short}
              </span>
              {inRecipe && (
                <span className="text-[9px] uppercase tracking-wide text-teal-700/80 font-medium">
                  In ricetta
                </span>
              )}
              {!inRecipe && hasGuide && (
                <span className="text-[9px] uppercase tracking-wide text-gray-400 font-medium">
                  Guida
                </span>
              )}
              {busy && <span className="text-[9px] text-gray-400">…</span>}
            </button>
          )
        })}
      </div>

      {expanded && selectedId && (
        <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 sm:p-6 animate-fade-in max-h-[min(70vh,32rem)] overflow-y-auto">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-50 text-primary shrink-0">
                <ApplianceIcon id={selectedId} className="w-8 h-8" />
              </span>
              <div>
                <h3 className="font-semibold text-gray-900 text-base sm:text-lg">
                  {selectedMethod?.label || selectedMeta?.label || selectedId}
                </h3>
                {recommendedId === selectedId && (
                  <p className="text-xs text-primary font-medium">Metodo della ricetta</p>
                )}
              </div>
            </div>
            <button
              type="button"
              className="text-xs text-gray-400 hover:text-gray-700 shrink-0 px-2 py-1"
              onClick={() => {
                setExpanded(false)
                setSelectedId(null)
              }}
            >
              Chiudi
            </button>
          </div>

          {loadingMethod === selectedId && !selectedMethod ? (
            <p className="text-sm text-gray-400">Sto preparando le indicazioni…</p>
          ) : selectedMethod ? (
            <>
              <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
                {selectedMethod.temperature && (
                  <div className="rounded-xl bg-gray-50 px-3 py-3">
                    <dt className="text-[11px] uppercase tracking-wide text-gray-400">Temperatura</dt>
                    <dd className="font-semibold text-gray-800 mt-1 text-base">
                      {selectedMethod.temperature}
                    </dd>
                  </div>
                )}
                {selectedMethod.time && (
                  <div className="rounded-xl bg-gray-50 px-3 py-3">
                    <dt className="text-[11px] uppercase tracking-wide text-gray-400">Tempo</dt>
                    <dd className="font-semibold text-gray-800 mt-1 text-base">{selectedMethod.time}</dd>
                  </div>
                )}
              </dl>
              {selectedMethod.notes && (
                <p className="text-[15px] sm:text-base text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {selectedMethod.notes}
                </p>
              )}
              {selectedMethod.differences && (
                <p className="mt-4 text-sm text-teal-900 bg-teal-50 rounded-xl px-3.5 py-3 leading-relaxed">
                  {selectedMethod.differences}
                </p>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 leading-relaxed">
                {mentionedIds.has(selectedId)
                  ? 'La ricetta parla di questo metodo, ma non ho ancora i dettagli operativi.'
                  : 'Nessuna guida salvata per questo metodo.'}
              </p>
              <button
                type="button"
                className="btn-primary !py-2 !px-4 text-sm"
                onClick={() => onSelectAppliance?.(selectedId)}
                disabled={loading}
              >
                {loadingMethod === selectedId ? 'Carico…' : 'Chiedi indicazioni all’IA'}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
