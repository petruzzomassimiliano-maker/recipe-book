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
