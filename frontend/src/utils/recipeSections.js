/**
 * Recipe components ("sezioni"): optional `section` on ingredients/steps.
 * Items are kept as a flat ordered list; a section is a run of consecutive
 * items sharing the same group.
 *
 * Saved recipes only carry the `section` name. While editing, the form adds an
 * internal `sid` (section id) so a group keeps its identity when its name is
 * emptied, contains spaces being typed, or temporarily matches a neighbour's
 * name. `finalizeSections` strips it before saving.
 */

export function sectionOf(item) {
  return String(item?.section || '').trim()
}

/** Grouping key: the edit-time id when present, otherwise the name ('' = no section). */
export function groupKey(item) {
  if (item?.sid) return item.sid
  const name = sectionOf(item)
  return name ? `name:${name}` : ''
}

/** Group descriptor of an item, used as a drop target. */
export function groupOf(item) {
  return { key: groupKey(item), sid: item?.sid || null, section: item?.section || '' }
}

export const NO_GROUP = { key: '', sid: null, section: '' }

let sidCounter = 0
export function newSectionId() {
  sidCounter += 1
  return `s${Date.now().toString(36)}${sidCounter.toString(36)}`
}

export function hasSections(items) {
  return (items || []).some((item) => groupKey(item))
}

/**
 * Consecutive runs by section.
 * @returns {{ section: string, startIndex: number, entries: { item: any, index: number }[] }[]}
 */
export function groupBySection(items) {
  const groups = []
  ;(items || []).forEach((item, index) => {
    const key = groupKey(item)
    const last = groups[groups.length - 1]
    if (last && last.key === key) {
      last.entries.push({ item, index })
    } else {
      groups.push({ key, section: sectionOf(item), startIndex: index, entries: [{ item, index }] })
    }
  })
  return groups
}

export function isRunStart(items, index) {
  if (index === 0) return true
  return groupKey(items[index]) !== groupKey(items[index - 1])
}

/** Last index of the run that starts at (or contains) `startIndex`. */
export function runEndIndex(items, startIndex) {
  const key = groupKey(items[startIndex])
  let end = startIndex
  while (end + 1 < items.length && groupKey(items[end + 1]) === key) end += 1
  return end
}

function setGroup(item, group) {
  const { section: _s, sid: _i, ...rest } = item
  if (!group?.key) return rest
  return {
    ...rest,
    ...(group.sid ? { sid: group.sid } : {}),
    ...(group.section ? { section: group.section } : {})
  }
}

/**
 * Give every sectioned run an edit-time id (idempotent). Unsectioned items stay
 * without one. Returns the same array when nothing changes.
 */
export function withSectionIds(items) {
  if (!(items || []).some((item) => !item.sid && sectionOf(item))) return items
  const next = []
  let prevName = null
  let prevSid = null
  for (const item of items) {
    if (item.sid || !sectionOf(item)) {
      next.push(item)
      prevName = null
      prevSid = null
      continue
    }
    const name = sectionOf(item)
    const sid = prevName === name && prevSid ? prevSid : newSectionId()
    next.push({ ...item, sid })
    prevName = name
    prevSid = sid
  }
  return next
}

/**
 * Rename every item in the run starting at `startIndex`. The name is kept as
 * typed (spaces included); an empty name keeps the section, just untitled.
 * Naming the unsectioned run turns it into a new section.
 */
export function renameRun(items, startIndex, name) {
  const end = runEndIndex(items, startIndex)
  const current = items[startIndex]
  const sid = current?.sid || newSectionId()
  const group = { key: sid, sid, section: String(name ?? '') }
  if (!current?.sid && !groupKey(current) && !group.section.trim()) return items
  return items.map((item, i) => (i >= startIndex && i <= end ? setGroup(item, group) : item))
}

/** Remove the section of the run starting at `startIndex` (items stay, without section). */
export function clearRun(items, startIndex) {
  const end = runEndIndex(items, startIndex)
  return items.map((item, i) => (i >= startIndex && i <= end ? setGroup(item, NO_GROUP) : item))
}

/** Insert `newItem` at the end of the run starting at `startIndex`, inheriting its section. */
export function insertIntoRun(items, startIndex, newItem) {
  const end = runEndIndex(items, startIndex)
  const next = [...items]
  next.splice(end + 1, 0, setGroup(newItem, groupOf(items[startIndex])))
  return next
}

/** New item that starts a fresh section named `name`. */
export function inNewSection(item, name) {
  const sid = newSectionId()
  return setGroup(item, { key: sid, sid, section: name })
}

/**
 * Move item `from` so it is inserted before original index `insertAt` (0..length)
 * and joins `group` (from `groupOf` / `NO_GROUP`). Returns the same array when
 * nothing changes.
 */
export function moveItem(items, from, insertAt, group) {
  if (from < 0 || from >= items.length) return items
  const target = group || NO_GROUP
  const at = insertAt > from ? insertAt - 1 : insertAt
  if (at === from && groupKey(items[from]) === target.key) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(at, next.length)), 0, setGroup(item, target))
  return next
}

/**
 * Arrow-key move: crossing a section boundary first changes section, then
 * position. At either end of the list, a sectioned item first leaves its section.
 */
export function moveItemByStep(items, from, direction) {
  const neighbor = from + direction
  const own = groupKey(items[from])
  if (neighbor < 0 || neighbor >= items.length) {
    return own ? moveItem(items, from, from, NO_GROUP) : items
  }
  const other = groupOf(items[neighbor])
  if (own !== other.key) return moveItem(items, from, from, other)
  return moveItem(items, from, direction < 0 ? neighbor : neighbor + 1, other)
}

/** Next default name like "Sezione 3" that is not already used. */
export function nextSectionName(items) {
  const used = new Set((items || []).map(sectionOf).filter(Boolean))
  let n = used.size + 1
  while (used.has(`Sezione ${n}`)) n += 1
  return `Sezione ${n}`
}

/** For saving: drop edit-time ids, tidy names; untitled sections become no section. */
export function finalizeSections(items) {
  return (items || []).map((item) => {
    const { sid: _i, section: _s, ...rest } = item
    const name = String(item.section || '').replace(/\s+/g, ' ').trim()
    return name ? { ...rest, section: name } : rest
  })
}
