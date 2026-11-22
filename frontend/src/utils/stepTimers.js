/**
 * Find cooking durations in a step ("20 minuti", "1 ora e 30 minuti",
 * "10-15 min", "un'ora e mezza", "mezz'ora", "30 secondi") so they can become
 * timer buttons. Ranges start the timer on the lower bound (check early).
 */

const NUM = String.raw`(\d+(?:[.,]\d+)?|un|una|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|quindici|venti|trenta|quaranta|cinquanta|sessanta|novanta)`
const WORD_NUMBERS = {
  un: 1, una: 1, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8,
  nove: 9, dieci: 10, quindici: 15, venti: 20, trenta: 30, quaranta: 40, cinquanta: 50,
  sessanta: 60, novanta: 90
}
const UNIT = String.raw`(ore|ora|h|minuti|minuto|min|['’′](?![a-zà-ù])|secondi|secondo|sec)`
const RANGE_SEP = String.raw`\s*(?:-|–|—|\/|o|a|e)\s*`

// N [unit]? (- M)? unit  [e mezza | e N minuti]?
const DURATION_RE = new RegExp(
  String.raw`(?<![\w,.])` +
    String.raw`(?:${NUM}(?:\s*${UNIT})?(?:${RANGE_SEP}${NUM})?\s*${UNIT}|(mezz['’]\s?ora))` +
    String.raw`(?:\s+e\s+(mezz[ao]|un\s+quarto|(\d+)\s*(?:minuti|min)))?` +
    String.raw`(?![\wà-ù])`,
  'gi'
)

function toNumber(raw) {
  if (!raw) return null
  const key = raw.toLowerCase()
  if (key in WORD_NUMBERS) return WORD_NUMBERS[key]
  const n = Number(key.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function unitSeconds(unit) {
  const u = String(unit || '').toLowerCase()
  if (u.startsWith('or') || u === 'h') return 3600
  if (u.startsWith('sec') || u === 's') return 1
  return 60 // minuti, min, m, '
}

/**
 * @returns {{ start: number, end: number, text: string, seconds: number }[]}
 */
export function findDurations(text) {
  const src = String(text || '')
  const out = []
  DURATION_RE.lastIndex = 0
  let m
  while ((m = DURATION_RE.exec(src))) {
    const [full, a, unitA, b, unitB, mezzOra, extra, extraMin] = m
    let seconds
    if (mezzOra) {
      seconds = 1800
    } else {
      const first = toNumber(a)
      const second = toNumber(b)
      const unit = unitB || unitA
      if (first == null) continue
      // A lone "un"/"una" needs an explicit unit word ("un minuto", not "un h")
      if (/^(un|una|uno)$/i.test(a) && !/^(ora|minuto|secondo)$/i.test(unitA || unit)) continue
      if (b != null && unitA && unitSeconds(unitA) > unitSeconds(unitB)) {
        // Compound: "1 ora e 30 minuti"
        seconds = first * unitSeconds(unitA) + (second || 0) * unitSeconds(unitB)
      } else if (b != null) {
        // Range: "10-15 minuti", "1 ora - 1 ora e mezza" → lower bound (any "e mezza" is the upper's)
        seconds = first * unitSeconds(unitA || unit)
        if (second != null && second < first && !unitA) seconds = second * unitSeconds(unit)
      } else {
        seconds = first * unitSeconds(unit)
      }
    }
    if (extra && b == null) {
      const e = extra.toLowerCase()
      if (e.startsWith('mezz')) seconds += 1800
      else if (e.startsWith('un')) seconds += 900
      else if (extraMin) seconds += Number(extraMin) * 60
    }
    // Ignore implausible values (temperatures misread, "1 s" typos, days)
    if (!(seconds >= 5 && seconds <= 48 * 3600)) continue
    out.push({ start: m.index, end: m.index + full.length, text: full, seconds: Math.round(seconds) })
  }
  return out.concat(findApostropheHours(src, out)).sort((x, y) => x.start - y.start)
}

/** "un'ora" / "un’ora e mezza" (apostrophe forms the regex above can't see). */
function findApostropheHours(src, taken) {
  const re = /(?<![\wà-ù])un['’]\s?ora(?:\s+e\s+(mezz[ao]|un\s+quarto))?(?![\wà-ù])/gi
  const out = []
  let m
  while ((m = re.exec(src))) {
    const start = m.index
    if (taken.some((t) => start < t.end && start + m[0].length > t.start)) continue
    let seconds = 3600
    if (m[1]) seconds += m[1].toLowerCase().startsWith('mezz') ? 1800 : 900
    out.push({ start, end: start + m[0].length, text: m[0], seconds })
  }
  return out
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** Human label for a timer length: "20 min", "1 h 30 min", "45 s". */
export function durationLabel(totalSeconds) {
  const s = Math.round(totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const parts = []
  if (h) parts.push(`${h} h`)
  if (m) parts.push(`${m} min`)
  if (sec && !h) parts.push(`${sec} s`)
  return parts.join(' ') || '0 s'
}
