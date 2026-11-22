import { useEffect, useRef, useState } from 'react'
import { remainingMs, useTimerStore } from '../../store/timerStore.js'
import { formatDuration } from '../../utils/stepTimers.js'

let audioCtx = null
function getAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
    return audioCtx
  } catch {
    return null
  }
}

/** Unlock audio on the first tap (mobile browsers only play sound after a gesture). */
function useAudioUnlock() {
  useEffect(() => {
    const unlock = () => getAudio()
    window.addEventListener('pointerdown', unlock, { once: true, passive: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])
}

function beep() {
  const ctx = getAudio()
  if (!ctx) return
  const t0 = ctx.currentTime
  for (let i = 0; i < 3; i += 1) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, t0 + i * 0.28)
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + i * 0.28 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.28 + 0.22)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t0 + i * 0.28)
    osc.stop(t0 + i * 0.28 + 0.24)
  }
}

function notify(timer) {
  try {
    navigator.vibrate?.([300, 150, 300, 150, 300])
  } catch {
    // ignore
  }
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const title = `⏰ ${timer.label}`
    const options = { body: timer.recipeTitle || 'Timer finito', tag: timer.id, renotify: true }
    navigator.serviceWorker?.getRegistration?.().then((reg) => {
      if (reg?.showNotification) reg.showNotification(title, options)
      else new Notification(title, options)
    }).catch(() => {})
  } catch {
    // ignore
  }
}

/**
 * Floating list of kitchen timers (above the mobile tab bar and the cooking mode).
 * Rings with sound + vibration (+ notification if allowed) until dismissed.
 */
export default function TimerDock() {
  const timers = useTimerStore((s) => s.timers)
  const raised = useTimerStore((s) => s.raised)
  const { pause, resume, addTime, remove, markRinging } = useTimerStore.getState()
  const [now, setNow] = useState(() => Date.now())
  const [collapsed, setCollapsed] = useState(false)
  const notified = useRef(new Set())
  useAudioUnlock()

  const anyRunning = timers.some((t) => t.endsAt)
  const anyRinging = timers.some((t) => t.ringing)

  useEffect(() => {
    if (!anyRunning && !anyRinging) return undefined
    const tick = () => {
      const t = Date.now()
      setNow(t)
      const due = useTimerStore.getState().timers.filter((x) => x.endsAt && x.endsAt <= t)
      if (due.length) {
        useTimerStore.getState().markRinging(due.map((x) => x.id))
        setCollapsed(false)
        for (const x of due) {
          if (!notified.current.has(x.id)) {
            notified.current.add(x.id)
            notify(x)
          }
        }
      }
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [anyRunning, anyRinging, markRinging])

  // Keep ringing every ~2.5 s until the user stops it
  useEffect(() => {
    if (!anyRinging) return undefined
    beep()
    const id = setInterval(() => {
      beep()
      try {
        navigator.vibrate?.([300, 150, 300])
      } catch {
        // ignore
      }
    }, 2500)
    return () => clearInterval(id)
  }, [anyRinging])

  // Timer title in the tab while something is running
  useEffect(() => {
    const base = document.title.replace(/^(⏰|⏱ \S+) · /, '')
    const next = timers.find((t) => t.ringing)
      ? `⏰ · ${base}`
      : timers.find((t) => t.endsAt)
        ? `⏱ ${formatDuration(Math.min(...timers.filter((t) => t.endsAt).map((t) => remainingMs(t, now) / 1000)))} · ${base}`
        : base
    if (document.title !== next) document.title = next
  }, [timers, now])

  if (!timers.length) return null

  return (
    <div
      className={`fixed z-[70] right-3 left-3 sm:left-auto sm:w-80 ${
        raised
          ? 'bottom-[calc(6rem+env(safe-area-inset-bottom))]'
          : 'bottom-[calc(4.25rem+env(safe-area-inset-bottom))] sm:bottom-4'
      }`}
      role="region"
      aria-label="Timer"
    >
      <div className="rounded-2xl border border-stone-200 bg-white/95 backdrop-blur-md shadow-xl overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-3.5 min-h-[40px] text-xs font-semibold uppercase tracking-wide text-stone-500"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
        >
          <span>⏱ Timer ({timers.length})</span>
          <span aria-hidden>{collapsed ? '▴' : '▾'}</span>
        </button>
        {!collapsed && (
          <ul className="divide-y divide-stone-100 max-h-[40vh] overflow-y-auto">
            {timers.map((t) => {
              const left = remainingMs(t, now)
              const paused = !t.endsAt && !t.ringing
              return (
                <li
                  key={t.id}
                  className={`px-3.5 py-2.5 ${t.ringing ? 'bg-amber-50 animate-pulse' : ''}`}
                  aria-live={t.ringing ? 'assertive' : 'off'}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-800 truncate">{t.label}</p>
                      {t.recipeTitle ? <p className="text-xs text-stone-400 truncate">{t.recipeTitle}</p> : null}
                    </div>
                    <span className={`font-mono text-xl tabular-nums ${t.ringing ? 'text-amber-700 font-bold' : 'text-stone-900'}`}>
                      {t.ringing ? 'Finito!' : formatDuration(Math.ceil(left / 1000))}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    {t.ringing ? (
                      <button type="button" className="btn-primary !py-2 !px-3 text-sm flex-1" onClick={() => remove(t.id)}>
                        Ferma
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary !py-1.5 !px-3 text-sm"
                        onClick={() => (paused ? resume(t.id) : pause(t.id))}
                      >
                        {paused ? 'Riprendi' : 'Pausa'}
                      </button>
                    )}
                    <button type="button" className="btn-secondary !py-1.5 !px-3 text-sm" onClick={() => addTime(t.id, 60_000)}>
                      +1 min
                    </button>
                    {!t.ringing && (
                      <button
                        type="button"
                        className="ml-auto inline-flex items-center min-h-[36px] px-2 text-xs text-stone-400 hover:text-red-600"
                        onClick={() => remove(t.id)}
                      >
                        Annulla
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
