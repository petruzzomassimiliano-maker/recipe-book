/**
 * Client helpers to keep bullet lists under one preparation step.
 * Mirrors worker mergeListFragments for already-saved recipes.
 */

const IT_ACTION_START =
  /^(preiscalda|prepara|mescola|aggiungi|versa|impasta|lascia|metti|togli|cuoci|friggi|rosola|sbatti|incorpora|copri|scopri|stendi|taglia|trita|grattugia|filtra|scol[ae]|inforna|sforna|unisci|forma|lavor[ae]|riposa|continua|ripeti|porta|setaccia|montate|monta|dividete|dividi|nel\s|nella\s|nell['’]|in\s+una|in\s+un|poi\s|quindi\s|dopo\s|infine\s|adesso\s|ora\s)/i

const BULLET_LINE = /^[-•*]\s+/

function clean(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function stripBullet(text) {
  return clean(text).replace(BULLET_LINE, '').trim()
}

function sectionOf(step) {
  return String(step?.section || '').trim()
}

function isListFragment(text) {
  const t = clean(text)
  if (!t) return false
  if (BULLET_LINE.test(t)) return true
  if (t.length <= 48 && !/[.!?]$/.test(t) && !IT_ACTION_START.test(t) && !String(text).includes('\n')) {
    return true
  }
  return false
}

function endsWithListIntro(text) {
  return /:\s*$/.test(clean(text)) || /:\n/.test(String(text || ''))
}

/**
 * Group orphan list items into the previous "Intro:" step for display.
 * Never merges across different sections.
 */
export function groupStepsForDisplay(steps) {
  const out = []
  for (const step of steps || []) {
    const text = String(step?.instruction || '').trim()
    if (!text) continue

    const prev = out[out.length - 1]
    if (
      prev &&
      sectionOf(prev) === sectionOf(step) &&
      isListFragment(text) &&
      (endsWithListIntro(prev.instruction) || isListFragment(prev.instruction))
    ) {
      const item = stripBullet(text)
      const base = String(prev.instruction).replace(/\s*$/, '')
      const intro = endsWithListIntro(base) ? base : `${base}:`
      prev.instruction = `${intro}\n• ${item}`
      continue
    }

    out.push({
      ...step,
      instruction: text
    })
  }

  return out.map((s, idx) => ({
    ...s,
    order: idx + 1
  }))
}
