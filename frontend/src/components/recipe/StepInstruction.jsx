import { requestTimerNotifications, useTimerStore } from '../../store/timerStore.js'
import { durationLabel, findDurations } from '../../utils/stepTimers.js'

/**
 * Text with cooking durations turned into timer buttons ("⏱ 20 minuti").
 * `timer` = { recipeId, recipeTitle, stepLabel } — without it, plain text.
 */
function TimedText({ text, timer }) {
  const start = useTimerStore((s) => s.start)
  if (!timer) return text
  const found = findDurations(text)
  if (!found.length) return text
  const parts = []
  let pos = 0
  found.forEach((d, i) => {
    if (d.start > pos) parts.push(text.slice(pos, d.start))
    parts.push(
      <button
        key={`t-${i}`}
        type="button"
        className="inline-flex items-baseline gap-1 mx-0.5 px-1.5 rounded-md bg-primary/10 text-primary font-semibold hover:bg-primary/15 active:bg-primary/20 underline decoration-primary/30 underline-offset-2"
        onClick={() => {
          requestTimerNotifications()
          start({
            seconds: d.seconds,
            label: `${timer.stepLabel ? `${timer.stepLabel} · ` : ''}${durationLabel(d.seconds)}`,
            recipeId: timer.recipeId,
            recipeTitle: timer.recipeTitle
          })
        }}
        title={`Avvia un timer da ${durationLabel(d.seconds)}`}
        aria-label={`Avvia timer ${durationLabel(d.seconds)}`}
      >
        <span aria-hidden>⏱</span>
        {d.text}
      </button>
    )
    pos = d.end
  })
  if (pos < text.length) parts.push(text.slice(pos))
  return parts
}

/**
 * Render a preparation step with kitchen-friendly typography:
 * ~1.7 line-height, bullets when present, breathing room between lines.
 * `textClass` overrides the text size.
 */
export default function StepInstruction({ text, className = '', timer = null, textClass = '' }) {
  const raw = String(text || '').trim()
  if (!raw) return null

  const tc = textClass || 'text-[15px] sm:text-base leading-[1.7]'
  const lines = raw.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim())
  const bulletRe = /^[-•*]\s+/

  if (lines.length <= 1 && !bulletRe.test(lines[0] || '')) {
    return (
      <p className={`${tc} text-gray-700 dark:text-gray-300 ${className}`}>
        <TimedText text={raw} timer={timer} />
      </p>
    )
  }

  const intro = []
  const bullets = []
  for (const line of lines) {
    if (bulletRe.test(line.trim())) bullets.push(line.trim().replace(bulletRe, ''))
    else if (bullets.length === 0) intro.push(line)
    else bullets.push(line.trim().replace(bulletRe, ''))
  }

  return (
    <div className={`space-y-2.5 ${className}`}>
      {intro.map((line, i) => (
        <p key={`i-${i}`} className={`${tc} text-gray-700 dark:text-gray-300`}>
          <TimedText text={line} timer={timer} />
        </p>
      ))}
      {bullets.length > 0 && (
        <ul className="space-y-2 pl-1">
          {bullets.map((item, i) => (
            <li key={`b-${i}`} className={`flex gap-2.5 ${tc} text-gray-700 dark:text-gray-300`}>
              <span className="shrink-0 text-primary mt-[0.15em]" aria-hidden>•</span>
              <span>
                <TimedText text={item} timer={timer} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
