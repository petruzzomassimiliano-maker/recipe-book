/**
 * Recipe components ("sezioni"): Pan di Spagna, Crema al burro, Bagna…
 * Ingredients and steps may carry an optional `section` string.
 * Recipes without sections keep the exact old shape (no `section` key).
 */

import { asArray, cleanInstructionText, parseIngredientLine, stripTags } from './_base.js'

const SECTION_MAX_LENGTH = 80
const HEADER_MAX_LENGTH = 60
const HEADER_MAX_WORDS = 8

export function cleanSectionName(raw) {
  return stripTags(String(raw || ''))
    .replace(/[:：]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SECTION_MAX_LENGTH)
}

export function hasSections(items) {
  return (items || []).some((item) => String(item?.section || '').trim())
}

/** Attach `section` only when non-empty so unsectioned data stays unchanged. */
export function withSection(item, section) {
  const name = cleanSectionName(section)
  if (!name) {
    const { section: _drop, ...rest } = item
    return rest
  }
  return { ...item, section: name }
}

function isIndented(rawLine) {
  return /^[\t ]/.test(rawLine || '')
}

function headerBody(trimmed) {
  if (!/[:：]$/.test(trimmed)) return null
  const body = trimmed.replace(/[:：]$/, '').trim()
  if (body.length < 2 || body.length > HEADER_MAX_LENGTH) return null
  if (body.split(/\s+/).length > HEADER_MAX_WORDS) return null
  if (/^\d/.test(body)) return null
  return body
}

/**
 * Ingredient header: "Pan di spagna:" — a short line ending with ":" and no digits,
 * or any short ":" line followed by a blank/indented line.
 * Step header must be followed by a blank or indented line, so an instruction like
 * "Setacciate a parte:\n• farina" is NOT mistaken for a section.
 */
function isHeaderLine(rawLine, nextRawLine, mode) {
  if (isIndented(rawLine)) return false
  const body = headerBody(String(rawLine).trim())
  if (!body) return false
  const nextBreaks = nextRawLine == null || !nextRawLine.trim() || isIndented(nextRawLine)
  if (mode === 'ingredients') return nextBreaks || !/\d/.test(body)
  return nextBreaks
}

/**
 * Split a multi-line text block into items with the current section.
 * @returns {{ section: string, text: string }[]}
 */
export function splitSectionedText(text, { mode = 'ingredients', initialSection = '' } = {}) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let section = initialSection
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (!trimmed) continue
    if (isHeaderLine(raw, lines[i + 1], mode)) {
      section = cleanSectionName(trimmed)
      continue
    }
    out.push({ section, text: trimmed.replace(/^[-•*]\s+/, '') })
  }
  return out
}

/** True when a text block uses "Header:\n\n\t item" layout (Drupal / Perugina style). */
export function looksSectioned(text) {
  const t = String(text || '')
  if (/\n\t/.test(t)) return true
  return /(^|\n)[^\n\t]{2,60}[:：][ \t]*\n[ \t]*\n/.test(t)
}

/**
 * schema.org recipeIngredient → draft ingredients (with optional sections).
 * Handles: array of lines, array with header items ("Per la crema:"),
 * a single string with newlines and headers.
 */
export function ingredientsFromJsonLd(recipeIngredient) {
  const out = []
  let section = ''

  const pushLine = (line, sec) => {
    const parsed = parseIngredientLine(line)
    if (parsed) out.push(withSection(parsed, sec))
  }

  for (const item of asArray(recipeIngredient)) {
    const raw = String(item ?? '')
    if (!raw.trim()) continue

    if (raw.includes('\n')) {
      const parts = splitSectionedText(raw, { mode: 'ingredients', initialSection: section })
      for (const part of parts) {
        section = part.section
        pushLine(part.text, part.section)
      }
      continue
    }

    const cleaned = stripTags(raw)
    const body = headerBody(cleaned)
    if (body && !/\d/.test(body)) {
      section = cleanSectionName(body)
      continue
    }
    pushLine(cleaned, section)
  }

  return out
}

const GENERIC_INGREDIENT_HEADER_RE =
  /^(ingredienti|ingredients|ingrédients|zutaten|ingredientes)(\s+per\s+\d[^]*|\s*\([^)]*\))?$/i

function normalizeForMatch(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function matchTokens(text) {
  return normalizeForMatch(text)
    .split(' ')
    .filter((t) => t.length >= 2 && !/^(di|da|del|della|dei|delle|per|con|il|la|le|lo|gli|un|una|of|the|and)$/.test(t))
}

/**
 * HTML "header followed by list" groups, e.g.
 *   <p class="li-subtitle">Per farcire:</p><ul><li>…</li></ul>
 *   <h4 class="wprm-recipe-group-name">Crema</h4><ul>…</ul>
 *   <p><strong>Per la base</strong></p><ul>…</ul>
 * @returns {{ section: string, items: string[] }[]}
 */
export function htmlListGroups(html) {
  const groups = []
  const re =
    /<(p|h[2-6]|strong|b|span|div|dt)\b[^>]*>((?:(?!<\/?(?:ul|ol|p|div|h[1-6]|li|table)\b)[\s\S]){1,400}?)<\/\1>\s*(?:<br\s*\/?>\s*|<\/(?:strong|b|span|p|div)>\s*)*<(ul|ol)\b[^>]*>([\s\S]*?)<\/\3>/gi
  let match
  while ((match = re.exec(String(html || ''))) !== null) {
    const headerText = stripTags(match[2])
    const body = headerText
      .replace(/[:：]\s*$/, '')
      .replace(/^(.{2,}?)\s*\([^)]*\)\s*$/, '$1')
      .replace(/[:：]\s*$/, '')
      .trim()
    if (body.length < 2 || body.length > HEADER_MAX_LENGTH) continue
    if (body.split(/\s+/).length > HEADER_MAX_WORDS + 4) continue
    if (/^\d/.test(body)) continue
    const items = [...match[4].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((m) => stripTags(m[1]))
      .filter(Boolean)
    if (!items.length) continue
    const section = GENERIC_INGREDIENT_HEADER_RE.test(body) ? '' : cleanSectionName(body)
    groups.push({ section, items })
  }
  return groups
}

function ingredientMatchText(ing) {
  return [ing?.quantity, ing?.unit, ing?.name, ing?.notes].filter((v) => v != null && v !== '').join(' ')
}

function matchScore(ingTokens, itemTokens) {
  if (!ingTokens.length || !itemTokens.length) return 0
  const itemSet = new Set(itemTokens)
  const hits = ingTokens.filter((t) => itemSet.has(t)).length
  return hits / ingTokens.length
}

/**
 * Flat JSON-LD ingredients + HTML list groups → ingredients with sections.
 * Matching is in page order (monotonic) so repeated items like "sale" land in
 * the right group. Returns the input unchanged unless the result is confident:
 * ≥ 2 named sections and ≥ 60% of ingredients matched.
 */
export function applyHtmlIngredientSections(ingredients, html) {
  const list = ingredients || []
  if (!list.length || hasSections(list)) return list

  const flat = htmlListGroups(html).flatMap((g) =>
    g.items.map((text) => ({ section: g.section, tokens: matchTokens(text) }))
  )
  if (!flat.length) return list

  // Order-preserving alignment (weighted LCS): a greedy scan would let an early
  // "50 gr di farina" jump to a later identical line and skip whole groups.
  const n = list.length
  const m = flat.length
  if (n * m > 60000) return list
  const ingTokens = list.map((ing) => matchTokens(ingredientMatchText(ing)))
  const score = (i, j) => {
    const s = matchScore(ingTokens[i], flat[j].tokens)
    return s >= 0.6 ? s : 0
  }
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const s = score(i - 1, j - 1)
      dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1], s ? dp[i - 1][j - 1] + s : 0)
    }
  }
  const assigned = new Array(n).fill(null)
  for (let i = n, j = m; i > 0 && j > 0; ) {
    const s = score(i - 1, j - 1)
    if (s && dp[i][j] === dp[i - 1][j - 1] + s) {
      assigned[i - 1] = flat[j - 1].section
      i--
      j--
    } else if (dp[i][j] === dp[i - 1][j]) {
      i--
    } else {
      j--
    }
  }

  const matched = assigned.filter((s) => s !== null).length
  const named = new Set(assigned.filter(Boolean))
  if (named.size < 2 || matched / list.length < 0.6) return list

  let current = assigned.find((s) => s !== null) || ''
  return list.map((ing, i) => {
    if (assigned[i] !== null) current = assigned[i]
    return withSection(ing, current)
  })
}

/**
 * Some CMS split one instruction string on commas into many array items
 * ("…insieme al burro", "lasciatelo raffreddare\n\tMontate…").
 * If most items start lowercase they are fragments → rejoin with ", ".
 */
function joinInstructionFragments(items) {
  const strings = items.map((s) => String(s ?? ''))
  const nonEmpty = strings.filter((s) => s.trim())
  if (!nonEmpty.length) return ''
  const lowerStarts = nonEmpty.filter((s) => /^[a-zà-ÿ]/.test(s.trim())).length
  const separator = lowerStarts / nonEmpty.length >= 0.3 ? ', ' : '\n'
  return nonEmpty.join(separator)
}

function stepsFromSectionedText(text) {
  return splitSectionedText(text, { mode: 'steps' })
    .map(({ section, text: line }) => {
      const instruction = cleanInstructionText(line)
      return instruction ? withSection({ instruction }, section) : null
    })
    .filter(Boolean)
}

/**
 * schema.org recipeInstructions → draft steps (with optional sections).
 * Supports HowToSection (name → section), strings with "Header:" blocks,
 * and comma-fragmented arrays.
 */
export function stepsFromJsonLd(instructions) {
  if (!instructions) return []

  if (typeof instructions === 'string') {
    if (looksSectioned(instructions)) return stepsFromSectionedText(instructions)
    return instructions
      .split(/\n+|(?<=\.)\s+/)
      .map((s) => cleanInstructionText(s))
      .filter(Boolean)
      .map((instruction) => ({ instruction }))
  }

  const items = asArray(instructions)
  const allStrings = items.every((item) => typeof item === 'string')
  if (allStrings && items.some((s) => looksSectioned(s))) {
    return stepsFromSectionedText(joinInstructionFragments(items))
  }

  return items
    .flatMap((item) => {
      if (typeof item === 'string') {
        return [{ instruction: cleanInstructionText(item) }]
      }
      const type = asArray(item?.['@type']).map((t) => String(t).toLowerCase())
      if (type.includes('howtosection')) {
        const section = cleanSectionName(item.name || '')
        return asArray(item.itemListElement).map((step) =>
          withSection(
            {
              instruction: cleanInstructionText(
                typeof step === 'string' ? step : step?.text || step?.name || ''
              )
            },
            section
          )
        )
      }
      return [{ instruction: cleanInstructionText(item?.text || item?.name || '') }]
    })
    .filter((s) => s.instruction)
}
