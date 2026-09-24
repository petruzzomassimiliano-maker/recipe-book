/**
 * Recipe components ("sezioni"): optional `section` on ingredients/steps.
 * Items are kept as a flat ordered list; a section is a run of consecutive
 * items sharing the same name.
 */

export function sectionOf(item) {
  return String(item?.section || '').trim()
}

export function hasSections(items) {
  return (items || []).some((item) => sectionOf(item))
}

/**
 * Consecutive runs by section.
 * @returns {{ section: string, startIndex: number, entries: { item: any, index: number }[] }[]}
 */
export function groupBySection(items) {
  const groups = []
  ;(items || []).forEach((item, index) => {
    const section = sectionOf(item)
    const last = groups[groups.length - 1]
    if (last && last.section === section) {
      last.entries.push({ item, index })
    } else {
      groups.push({ section, startIndex: index, entries: [{ item, index }] })
    }
  })
  return groups
}

export function isRunStart(items, index) {
  if (index === 0) return true
  return sectionOf(items[index]) !== sectionOf(items[index - 1])
}

/** Last index of the run that starts at (or contains) `startIndex`. */
export function runEndIndex(items, startIndex) {
  const section = sectionOf(items[startIndex])
  let end = startIndex
  while (end + 1 < items.length && sectionOf(items[end + 1]) === section) end += 1
  return end
}

function applySection(item, name) {
  const section = String(name || '')
  if (!section.trim()) {
    const { section: _drop, ...rest } = item
    return rest
  }
  return { ...item, section }
}

/** Rename every item in the run starting at `startIndex`. Empty name removes the title. */
export function renameRun(items, startIndex, name) {
  const end = runEndIndex(items, startIndex)
  return items.map((item, i) => (i >= startIndex && i <= end ? applySection(item, name) : item))
}

/** Insert `newItem` at the end of the run starting at `startIndex`, inheriting its section. */
export function insertIntoRun(items, startIndex, newItem) {
  const end = runEndIndex(items, startIndex)
  const section = sectionOf(items[startIndex])
  const next = [...items]
  next.splice(end + 1, 0, applySection(newItem, section))
  return next
}

/** Next default name like "Sezione 3" that is not already used. */
export function nextSectionName(items) {
  const used = new Set((items || []).map(sectionOf).filter(Boolean))
  let n = used.size + 1
  while (used.has(`Sezione ${n}`)) n += 1
  return `Sezione ${n}`
}
