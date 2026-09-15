/**
 * Lightweight markdown-ish renderer for AI replies (no HTML injection).
 * Supports: **bold**, bullet lines (- / • / *), numbered lists, blank lines.
 */
export function AiRichText({ text, className = '' }) {
  const blocks = parseBlocks(String(text || ''))

  return (
    <div className={`space-y-3 text-[15px] leading-relaxed text-gray-800 ${className}`}>
      {blocks.map((block, i) => {
        if (block.type === 'list') {
          return (
            <ul key={i} className="space-y-2 pl-0 list-none">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0" aria-hidden />
                  <span className="min-w-0">{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          )
        }
        if (block.type === 'numbered') {
          return (
            <ol key={i} className="space-y-2 list-none pl-0">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="shrink-0 w-6 h-6 rounded-lg bg-orange-50 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                    {j + 1}
                  </span>
                  <span className="min-w-0 pt-0.5">{renderInline(item)}</span>
                </li>
              ))}
            </ol>
          )
        }
        if (block.type === 'heading') {
          return (
            <h4 key={i} className="font-semibold text-gray-900 text-[15px] pt-1">
              {renderInline(block.text)}
            </h4>
          )
        }
        return (
          <p key={i} className="text-gray-700">
            {renderInline(block.text)}
          </p>
        )
      })}
    </div>
  )
}

function parseBlocks(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    if (/^[-•*]\s+/.test(trimmed)) {
      const items = []
      while (i < lines.length && /^[-•*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-•*]\s+/, ''))
        i += 1
      }
      blocks.push({ type: 'list', items })
      continue
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items = []
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''))
        i += 1
      }
      blocks.push({ type: 'numbered', items })
      continue
    }

    // Heading-like: short line ending with : or **Title**
    const bare = trimmed.replace(/\*\*/g, '')
    if (
      (trimmed.endsWith(':') && bare.length < 60) ||
      (/^\*\*.+\*\*:?$/.test(trimmed) && bare.length < 60)
    ) {
      blocks.push({ type: 'heading', text: trimmed.replace(/^#+\s*/, '') })
      i += 1
      continue
    }

    blocks.push({ type: 'paragraph', text: trimmed })
    i += 1
  }

  return blocks
}

function renderInline(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-gray-900">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <span key={idx}>{part}</span>
  })
}
