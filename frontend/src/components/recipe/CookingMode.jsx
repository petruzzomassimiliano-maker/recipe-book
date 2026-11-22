import { useEffect, useRef, useState } from 'react'
import StepInstruction from './StepInstruction.jsx'
import { formatScaledQty } from '../../utils/scaleIngredients.js'
import { groupBySection } from '../../utils/recipeSections.js'
import { useTimerStore } from '../../store/timerStore.js'

/** Keep the screen on while cooking mode is open (independent of the Settings toggle). */
function useScreenOn(active) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined
    let lock = null
    let cancelled = false
    const acquire = async () => {
      if (cancelled || lock || document.visibilityState !== 'visible') return
      try {
        lock = await navigator.wakeLock.request('screen')
        lock.addEventListener('release', () => {
          lock = null
        })
      } catch {
        // ignore: the global keep-awake setting may still be on
      }
    }
    const onVisible = () => acquire()
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [active])
}

/**
 * Full-screen, one step at a time: big text, prev/next (buttons, swipe, ← →),
 * timers in the text, ingredient drawer with check marks. Android "back" closes it.
 */
export default function CookingMode({
  open,
  onClose,
  recipe,
  steps,
  ingredients,
  checkedIng,
  onToggleIngredient,
  onFinished
}) {
  const [index, setIndex] = useState(0)
  const [showIngredients, setShowIngredients] = useState(false)
  const touch = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useScreenOn(open)

  const total = steps.length
  const step = steps[Math.min(index, Math.max(0, total - 1))]
  const isLast = index >= total - 1

  useEffect(() => {
    if (!open) return undefined
    setIndex(0)
    setShowIngredients(false)
    // Back button / gesture closes cooking mode instead of leaving the recipe
    window.history.pushState({ cookingMode: true }, '')
    const onPop = () => closeRef.current()
    window.addEventListener('popstate', onPop)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    useTimerStore.getState().setRaised(true)
    return () => {
      useTimerStore.getState().setRaised(false)
      window.removeEventListener('popstate', onPop)
      document.body.style.overflow = prevOverflow
      if (window.history.state?.cookingMode) window.history.back()
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.target?.closest?.('input, textarea')) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') setIndex((i) => Math.min(total - 1, i + 1))
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') setIndex((i) => Math.max(0, i - 1))
      else if (e.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, total])

  if (!open || !recipe) return null

  const go = (delta) => setIndex((i) => Math.max(0, Math.min(total - 1, i + delta)))

  const onTouchStart = (e) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e) => {
    const start = touch.current
    touch.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1)
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-surface flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      role="dialog"
      aria-modal="true"
      aria-label={`Modalità cucina: ${recipe.title}`}
    >
      <header className="flex items-center gap-2 px-4 py-2 border-b border-stone-200/70">
        <button
          type="button"
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2 rounded-xl text-stone-500 active:bg-stone-100"
          onClick={onClose}
          aria-label="Chiudi modalità cucina"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-stone-800 truncate">{recipe.title}</p>
          <p className="text-xs text-stone-500 tabular-nums">
            Passo {Math.min(index + 1, total)} di {total}
          </p>
        </div>
        <button
          type="button"
          className={`inline-flex items-center min-h-[44px] px-3 rounded-xl text-sm font-semibold border ${
            showIngredients ? 'bg-primary text-white border-primary' : 'bg-white text-stone-700 border-stone-200'
          }`}
          onClick={() => setShowIngredients((v) => !v)}
          aria-expanded={showIngredients}
        >
          Ingredienti
        </button>
      </header>

      <div className="h-1 bg-stone-100" aria-hidden>
        <div className="h-full bg-primary transition-all" style={{ width: `${total ? ((index + 1) / total) * 100 : 0}%` }} />
      </div>

      {showIngredients ? (
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-8">
          <div className="max-w-2xl mx-auto space-y-5">
            {groupBySection(ingredients).map((group, gi) => (
              <div key={`cm-ing-${group.startIndex}`}>
                {group.section || gi > 0 ? (
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-primary/90 mb-1">
                    {group.section || 'Altri ingredienti'}
                  </h3>
                ) : null}
                <ul>
                  {group.entries.map(({ item: ing }) => {
                    const done = checkedIng.has(ing.id)
                    const qty = formatScaledQty(ing.quantity, ing.unit)
                    return (
                      <li key={ing.id} className="border-t border-stone-100 first:border-t-0">
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 min-h-[56px] py-2 text-left"
                          onClick={() => onToggleIngredient(ing.id)}
                          aria-pressed={done}
                        >
                          <span
                            className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                              done ? 'bg-primary border-primary text-white' : 'border-stone-300'
                            }`}
                            aria-hidden
                          >
                            {done ? '✓' : ''}
                          </span>
                          <span className={`text-lg ${done ? 'line-through text-stone-400' : 'text-stone-800'}`}>
                            {qty ? <strong className="font-semibold mr-1.5">{qty}</strong> : null}
                            {ing.name}
                            {ing.notes ? <span className="text-stone-500"> ({ing.notes})</span> : null}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto px-5 py-6 sm:px-10 sm:py-10"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="max-w-3xl mx-auto">
            {step?.section ? (
              <p className="text-sm font-semibold uppercase tracking-wide text-primary/90 mb-3">{step.section}</p>
            ) : null}
            <div className="flex items-start gap-4">
              <span className="shrink-0 w-12 h-12 rounded-full bg-primary/10 text-primary text-xl font-semibold flex items-center justify-center">
                {index + 1}
              </span>
              <StepInstruction
                className="pt-1.5 min-w-0 flex-1"
                text={step?.instruction}
                textClass="text-[22px] sm:text-[26px] leading-[1.55]"
                timer={{ recipeId: recipe.id, recipeTitle: recipe.title, stepLabel: `Passo ${index + 1}` }}
              />
            </div>
            {!isLast && steps[index + 1] ? (
              <p className="mt-10 text-sm text-stone-400 line-clamp-2">
                <span className="font-semibold text-stone-500">Dopo: </span>
                {steps[index + 1].instruction}
              </p>
            ) : null}
          </div>
        </div>
      )}

      <footer className="grid grid-cols-2 gap-3 px-4 py-3 border-t border-stone-200/70 bg-white/80">
        <button
          type="button"
          className="btn-secondary !min-h-[56px] text-base"
          onClick={() => {
            setShowIngredients(false)
            go(-1)
          }}
          disabled={index === 0 && !showIngredients}
        >
          ← Indietro
        </button>
        {isLast && !showIngredients ? (
          <button type="button" className="btn-primary !min-h-[56px] text-base" onClick={onFinished}>
            Fatto! ✓
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary !min-h-[56px] text-base"
            onClick={() => {
              if (showIngredients) setShowIngredients(false)
              else go(1)
            }}
          >
            {showIngredients ? 'Ai passi →' : 'Avanti →'}
          </button>
        )}
      </footer>
    </div>
  )
}
