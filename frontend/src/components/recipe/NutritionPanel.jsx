import { useState } from 'react'

const SOURCE_LABEL = {
  static: 'DB locale',
  cache: 'Cache',
  mixed: 'Misto',
  manual: 'Manuale',
  none: '—'
}

function MacroGrid({ macros }) {
  if (!macros) return null
  const cells = [
    { key: 'calories', label: 'kcal', value: macros.calories },
    { key: 'protein', label: 'Proteine', value: macros.protein, unit: 'g' },
    { key: 'fat', label: 'Grassi', value: macros.fat, unit: 'g' },
    { key: 'carbs', label: 'Carb.', value: macros.carbs, unit: 'g' }
  ]
  return (
    <div className="grid grid-cols-4 gap-2">
      {cells.map((c) => (
        <div key={c.key} className="rounded-xl bg-gray-50 px-2 py-2.5 text-center">
          <div className="text-base sm:text-lg font-bold text-gray-900 tabular-nums leading-none">
            {c.value ?? '—'}
            {c.unit ? <span className="text-xs font-medium text-gray-400 ml-0.5">{c.unit}</span> : null}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-gray-400 mt-1">{c.label}</div>
        </div>
      ))}
    </div>
  )
}

const emptyFood = () => ({
  name: '',
  calories: '',
  protein: '',
  fat: '',
  carbs: '',
  fiber: ''
})

export default function NutritionPanel({
  nutritionInfo,
  loading = false,
  error = null,
  onCalculate,
  onSaveManual,
  onAddCustomFood
}) {
  const info = nutritionInfo || {}
  const hasData = Boolean(info.perServing)
  const skipped = (info.lines || []).filter((l) => l.skipped)
  const [editing, setEditing] = useState(false)
  const [addingFood, setAddingFood] = useState(false)
  const [foodDraft, setFoodDraft] = useState(emptyFood())
  const [foodMsg, setFoodMsg] = useState(null)
  const [draft, setDraft] = useState({
    calories: '',
    protein: '',
    fat: '',
    carbs: '',
    fiber: ''
  })

  const startEdit = () => {
    const p = info.perServing || {}
    setDraft({
      calories: p.calories ?? '',
      protein: p.protein ?? '',
      fat: p.fat ?? '',
      carbs: p.carbs ?? '',
      fiber: p.fiber ?? ''
    })
    setEditing(true)
  }

  const submitManual = async (e) => {
    e.preventDefault()
    await onSaveManual?.({
      calories: Number(draft.calories) || 0,
      protein: Number(draft.protein) || 0,
      fat: Number(draft.fat) || 0,
      carbs: Number(draft.carbs) || 0,
      fiber: Number(draft.fiber) || 0
    })
    setEditing(false)
  }

  const prefillFromSkipped = (name) => {
    setFoodDraft({ ...emptyFood(), name })
    setAddingFood(true)
    setFoodMsg(null)
  }

  const submitCustomFood = async (e) => {
    e.preventDefault()
    setFoodMsg(null)
    try {
      await onAddCustomFood?.({
        name: foodDraft.name.trim(),
        calories: Number(foodDraft.calories) || 0,
        protein: Number(foodDraft.protein) || 0,
        fat: Number(foodDraft.fat) || 0,
        carbs: Number(foodDraft.carbs) || 0,
        fiber: Number(foodDraft.fiber) || 0
      })
      setFoodMsg(`«${foodDraft.name.trim()}» salvato nel DB — calorie aggiornate.`)
      setFoodDraft(emptyFood())
      setAddingFood(false)
    } catch (err) {
      setFoodMsg(err.message || 'Salvataggio fallito')
    }
  }

  return (
    <section className="card p-5 sm:p-6 mt-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Valori nutrizionali</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Calcolate in automatico al salvataggio
            {info.source ? ` · ${SOURCE_LABEL[info.source] || info.source}` : ''}
            {info.lastCalculated
              ? ` · ${new Date(info.lastCalculated).toLocaleDateString('it-IT')}`
              : ''}
          </p>
        </div>
        {onCalculate ? (
          <div className="flex flex-wrap gap-2">
            {hasData && !editing && (
              <button type="button" className="btn-secondary !py-2 !px-3 text-sm" onClick={startEdit}>
                Modifica totale
              </button>
            )}
            <button
              type="button"
              className="btn-secondary !py-2 !px-3 text-sm"
              onClick={() => {
                setAddingFood((v) => !v)
                setFoodMsg(null)
              }}
            >
              {addingFood ? 'Chiudi form' : '+ Alimento 100 g'}
            </button>
            <button
              type="button"
              className="btn-secondary !py-2 !px-3 text-sm"
              onClick={onCalculate}
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? 'Calcolo…' : hasData ? 'Ricalcola' : 'Calcola calorie'}
            </button>
          </div>
        ) : null}
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {foodMsg && (
        <p className="mb-3 text-sm text-teal-700" role="status">
          {foodMsg}
        </p>
      )}

      {addingFood && (
        <form
          onSubmit={submitCustomFood}
          className="mb-4 rounded-2xl border border-teal-100 bg-teal-50/40 p-4 space-y-3"
        >
          <p className="text-sm text-gray-600">
            Inserisci i valori <strong>per 100 g</strong> (da etichetta o tabella online). Restano
            salvati nel tuo Dropbox e valgono per tutte le ricette.
          </p>
          <label className="block text-xs text-gray-500">
            Nome alimento
            <input
              className="input-field mt-1 !py-2 !px-3 text-sm"
              required
              value={foodDraft.name}
              onChange={(e) => setFoodDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="es. yogurt greco"
            />
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              ['calories', 'kcal / 100 g', true],
              ['protein', 'Proteine g', false],
              ['fat', 'Grassi g', false],
              ['carbs', 'Carb. g', false],
              ['fiber', 'Fibre g', false]
            ].map(([key, label, required]) => (
              <label key={key} className="block text-xs text-gray-500">
                {label}
                <input
                  className="input-field mt-1 !py-2 !px-3 text-sm"
                  type="number"
                  min="0"
                  step="any"
                  required={required}
                  value={foodDraft[key]}
                  onChange={(e) => setFoodDraft((d) => ({ ...d, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <button type="submit" className="btn-primary !py-2 !px-4 text-sm" disabled={loading}>
            Salva nel DB
          </button>
        </form>
      )}

      {editing ? (
        <form onSubmit={submitManual} className="space-y-3">
          <p className="text-sm text-gray-500">Override manuale del totale per porzione</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              ['calories', 'kcal'],
              ['protein', 'Proteine g'],
              ['fat', 'Grassi g'],
              ['carbs', 'Carb. g'],
              ['fiber', 'Fibre g']
            ].map(([key, label]) => (
              <label key={key} className="block text-xs text-gray-500">
                {label}
                <input
                  className="input-field mt-1 !py-2 !px-3 text-sm"
                  type="number"
                  min="0"
                  step="any"
                  value={draft[key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary !py-2 !px-4 text-sm" disabled={loading}>
              Salva
            </button>
            <button
              type="button"
              className="btn-secondary !py-2 !px-4 text-sm"
              onClick={() => setEditing(false)}
            >
              Annulla
            </button>
          </div>
        </form>
      ) : !hasData ? (
        <p className="text-sm text-gray-400">
          Nessun calcolo ancora. Tocca “Calcola calorie”, oppure aggiungi alimenti mancanti con “+
          Alimento 100 g”.
        </p>
      ) : (
        <>
          <MacroGrid macros={info.perServing} />
          {info.perRecipe && (
            <p className="mt-3 text-xs text-gray-400">
              Totale ricetta (~{info.servings || 1} porz.): {info.perRecipe.calories} kcal · P{' '}
              {info.perRecipe.protein}g · F {info.perRecipe.fat}g · C {info.perRecipe.carbs}g
            </p>
          )}
          {skipped.length > 0 && (
            <details className="mt-3 text-sm" open>
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                {skipped.length}{' '}
                {skipped.length === 1 ? 'ingrediente escluso' : 'ingredienti esclusi'}
                {skipped.some((l) => /dato nutrizionale|DB/i.test(l.reason || ''))
                  ? ' — puoi aggiungerli al DB'
                  : ''}
              </summary>
              <ul className="mt-2 space-y-1.5 text-xs text-gray-500">
                {skipped.map((l) => {
                  const canAddToDb = /dato nutrizionale|DB/i.test(l.reason || '')
                  return (
                  <li key={l.ingredientId || l.name} className="flex flex-wrap items-center gap-2">
                    <span>
                      {l.name}
                      {l.reason ? ` — ${l.reason}` : ''}
                    </span>
                    {canAddToDb && (
                    <button
                      type="button"
                      className="text-teal-700 font-medium hover:underline"
                      onClick={() => prefillFromSkipped(l.name)}
                    >
                      Aggiungi 100 g
                    </button>
                    )}
                  </li>
                  )
                })}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  )
}
