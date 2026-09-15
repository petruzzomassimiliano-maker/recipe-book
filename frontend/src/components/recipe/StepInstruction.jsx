/**
 * Render a preparation step with kitchen-friendly typography:
 * ~1.7 line-height, bullets when present, breathing room between lines.
 */
export default function StepInstruction({ text, className = '' }) {
  const raw = String(text || '').trim()
  if (!raw) return null

  const lines = raw.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim())
  const bulletRe = /^[-•*]\s+/

  if (lines.length <= 1 && !bulletRe.test(lines[0] || '')) {
    return (
      <p className={`text-[15px] sm:text-base leading-[1.7] text-gray-700 dark:text-gray-300 ${className}`}>
        {raw}
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
        <p key={`i-${i}`} className="text-[15px] sm:text-base leading-[1.7] text-gray-700 dark:text-gray-300">
          {line}
        </p>
      ))}
      {bullets.length > 0 && (
        <ul className="space-y-2 pl-1">
          {bullets.map((item, i) => (
            <li key={`b-${i}`} className="flex gap-2.5 text-[15px] sm:text-base leading-[1.7] text-gray-700 dark:text-gray-300">
              <span className="shrink-0 text-primary mt-[0.15em]" aria-hidden>•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
