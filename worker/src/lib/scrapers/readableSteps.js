/**
 * Make recipe steps easier to follow while cooking:
 * one (or few) actions per step, optional bullets, no wall-of-text.
 * Bullet list items must stay INSIDE the same step as their intro
 * (never become separate numbered steps).
 */

const IT_ACTION_START =
  /^(preiscalda|prepara|mescola|aggiungi|versa|impasta|lascia|metti|togli|cuoci|friggi|rosola|sbatti|incorpora|copri|scopri|stendi|taglia|trita|grattugia|filtra|scol[ae]|inforna|sforna|unisci|forma|lavor[ae]|riposa|continua|ripeti|porta|setaccia|montate|monta|dividete|dividi|nel\s|nella\s|nell['’]|in\s+una|in\s+un|poi\s|quindi\s|dopo\s|infine\s|adesso\s|ora\s)/i

const BULLET_LINE = /^[-•*]\s+/

function cleanStepText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function stripLeadingNumber(text) {
  return text.replace(/^\d{1,2}[\).\:\-]\s*/, '').trim()
}

function stripBullet(text) {
  return String(text || '').trim().replace(BULLET_LINE, '').trim()
}

function splitNumberedBlob(text) {
  const parts = text
    .split(/(?=\b\d{1,2}[\).\:]\s+)/)
    .map((p) => stripLeadingNumber(p.trim()))
    .filter((p) => p.length > 8)
  return parts.length > 1 ? parts : null
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Ý])/u)
    .map((s) => s.trim())
    .filter(Boolean)
}

function looksLikeAction(sentence) {
  return IT_ACTION_START.test(sentence) || sentence.length > 40
}

function splitLongParagraph(text) {
  // Keep intro+bullets blocks intact
  if (text.includes('\n') && BULLET_LINE.test(text)) return [text]
  if (/:\s*$/.test(text.trim()) && text.length < 80) return [text]

  if (text.length < 150 && !/[.!?].+[.!?]/.test(text)) return [text]

  const sentences = splitSentences(text)
  if (sentences.length <= 1) return [text]

  const chunks = []
  let buf = ''
  for (const sentence of sentences) {
    if (!buf) {
      buf = sentence
      continue
    }
    const combined = `${buf} ${sentence}`
    if (looksLikeAction(sentence) && buf.length >= 40) {
      chunks.push(buf)
      buf = sentence
    } else if (combined.length <= 110) {
      buf = combined
    } else {
      chunks.push(buf)
      buf = sentence
    }
  }
  if (buf) chunks.push(buf)
  return chunks.length ? chunks : [text]
}

function maybeBulletize(text) {
  if (text.includes('\n') || BULLET_LINE.test(text)) return text

  const m = text.match(/^(.{6,120}?):\s+(.+)$/s)
  if (!m) return text
  const [, intro, rest] = m
  if (/https?:/i.test(rest)) return text

  const items = rest
    .split(/\s*;\s*|\s+[-–—]\s+|,\s+(?=[a-zà-ú])/i)
    .map((s) => s.replace(/\s+e\s+/i, ' e ').trim())
    .filter((s) => s.length > 2 && s.length < 80)

  if (items.length < 3) return text
  if (items.join(' ').length < rest.length * 0.7) return text

  return `${intro.trim()}:\n${items.map((i) => `• ${i.replace(/\.$/, '')}`).join('\n')}`
}

/** True if step looks like a list fragment that should hang under a previous intro. */
function isListFragment(text) {
  const t = cleanStepText(text)
  if (!t) return false
  if (BULLET_LINE.test(t)) return true
  // Short noun phrase, no strong action verb: "farina", "lievito", "bicarbonato"
  if (t.length <= 48 && !/[.!?]$/.test(t) && !IT_ACTION_START.test(t) && !t.includes('\n')) {
    return true
  }
  return false
}

function endsWithListIntro(text) {
  const t = cleanStepText(text)
  return /:\s*$/.test(t) || /:\n/.test(t)
}

function sectionOf(step) {
  return String(step?.section || '').trim()
}

/** Keep `section` only when present, so unsectioned steps keep their old shape. */
function stepWithSection(instruction, section) {
  return section ? { instruction, section } : { instruction }
}

/**
 * Merge orphan bullets / short list items into the preceding "Intro:" step.
 * Fixes: step4 "Setacciate a parte:" + step5 "farina" + step6 "lievito" → one step.
 * Never merges across different sections.
 */
export function mergeListFragments(steps) {
  const out = []
  for (const step of steps || []) {
    const text = cleanStepText(step?.instruction || step?.text || '')
    if (!text) continue
    const section = sectionOf(step)

    const prev = out[out.length - 1]
    if (
      prev &&
      sectionOf(prev) === section &&
      isListFragment(text) &&
      (endsWithListIntro(prev.instruction) || isListFragment(prev.instruction))
    ) {
      const item = stripBullet(text)
      const prevText = prev.instruction
      // Ensure previous ends with colon line, then bullet
      const base = endsWithListIntro(prevText)
        ? prevText.replace(/\s*$/, '')
        : prevText
      const needsColon = /:\s*$/.test(base) || /:\n/.test(base)
      const intro = needsColon ? base : `${base}:`
      prev.instruction = `${intro}\n• ${item}`.replace(/\n{3,}/g, '\n\n')
      continue
    }

    out.push(stepWithSection(text, section))
  }
  return out
}

/**
 * @param {{ instruction: string }[]} steps
 * @returns {{ instruction: string }[]}
 */
export function improveStepsReadability(steps) {
  const out = []
  for (const step of steps || []) {
    let text = cleanStepText(step?.instruction || step?.text || '')
    if (!text) continue
    const section = sectionOf(step)

    // Already a multi-line bullet block — keep as one step
    if (text.includes('\n') && BULLET_LINE.test(text)) {
      out.push(stepWithSection(text, section))
      continue
    }

    const numbered = splitNumberedBlob(text)
    const pieces = numbered || splitLongParagraph(text)

    for (const piece of pieces) {
      const formatted = maybeBulletize(cleanStepText(piece))
      if (formatted) out.push(stepWithSection(formatted, section))
    }
  }

  const merged = mergeListFragments(out)
  return merged.length ? merged : [{ instruction: '' }]
}

/**
 * Client-side safety net for already-saved recipes with split bullets.
 */
export function groupStepsForDisplay(steps) {
  return mergeListFragments(
    (steps || []).map((s) => ({
      ...s,
      instruction: s.instruction || s.text || ''
    }))
  ).map((s, idx) => ({
    ...s,
    id: s.id || `step-${idx + 1}`,
    order: idx + 1
  }))
}

export const STEPS_READABILITY_RULES = `
Formato passi (leggibilità in cucina):
- Un'azione principale per passo (max 1–2 frasi brevi)
- Inizia con un verbo (Mescola, Aggiungi, Cuoci…)
- Se serve una lista (es. "Setacciate a parte: farina, lievito, bicarbonato"),
  mettila NELLO STESSO passo con righe "• item" — NON creare passi numerati separati per ogni voce
- Esempio corretto di un solo passo:
  "Setacciate a parte:\\n• farina\\n• lievito\\n• bicarbonato"
- Niente muri di testo: spezza i paragrafi lunghi in più passi numerati
- Includi tempi/temperature quando presenti ("cuoci 8–10 minuti")
- Niente marker foto (1)(2)(3)
`.trim()
