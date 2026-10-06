import { useCallback, useEffect, useRef, useState } from 'react'
import { moveItem, moveItemByStep, sectionOf } from '../utils/recipeSections.js'

// Edge zones cover the sticky app header / form toolbar (top) and the mobile
// action bar + bottom nav (bottom), so dragging onto them scrolls the page.
const EDGE_TOP_PX = 120
const EDGE_BOTTOM_PX = 150
const MAX_SCROLL_STEP = 18

/**
 * Drop slots in page coordinates. Besides "before row i", a slot "after row i"
 * exists at the end of each section run, so an item can land at the end of
 * section A or at the start of section B (the header sits between them).
 */
function buildSlots(items, rects) {
  const slots = []
  items.forEach((item, i) => {
    const rect = rects[i]
    if (!rect) return
    const section = sectionOf(item)
    slots.push({ insertAt: i, section, y: rect.top, row: i, edge: 'before' })
    const runEnds = i === items.length - 1 || sectionOf(items[i + 1]) !== section
    if (runEnds) slots.push({ insertAt: i + 1, section, y: rect.bottom, row: i, edge: 'after' })
  })
  return slots
}

function isNoop(items, from, slot) {
  if (!slot) return true
  const at = slot.insertAt > from ? slot.insertAt - 1 : slot.insertAt
  return at === from && sectionOf(items[from]) === slot.section
}

/**
 * Pointer-based (mouse + touch + pen) vertical reordering from a grip handle,
 * section-aware. Keyboard: ArrowUp / ArrowDown on the handle.
 */
export function useDragReorder(items, onChange) {
  const rowEls = useRef([])
  const drag = useRef(null)
  const rafRef = useRef(0)
  const pendingFocus = useRef(null)
  const [state, setState] = useState(null)

  const itemsRef = useRef(items)
  itemsRef.current = items
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (pendingFocus.current == null) return
    const row = rowEls.current[pendingFocus.current]
    pendingFocus.current = null
    const handles = row ? [...row.querySelectorAll('[data-drag-handle]')] : []
    handles.find((el) => el.offsetParent !== null)?.focus()
  }, [items])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const update = useCallback(() => {
    const d = drag.current
    if (!d) return
    const pageY = d.clientY + window.scrollY
    const dy = pageY - d.startPageY
    const center = d.startCenter + dy
    let best = null
    for (const slot of d.slots) {
      if (!best || Math.abs(slot.y - center) < Math.abs(best.y - center)) best = slot
    }
    d.slot = isNoop(itemsRef.current, d.from, best) ? null : best
    setState({ from: d.from, dy, slot: d.slot })
  }, [])

  const autoScroll = useCallback(() => {
    const d = drag.current
    if (!d) return
    const vh = window.innerHeight
    let step = 0
    if (d.clientY < EDGE_TOP_PX) {
      step = -Math.ceil(((EDGE_TOP_PX - d.clientY) / EDGE_TOP_PX) * MAX_SCROLL_STEP)
    } else if (d.clientY > vh - EDGE_BOTTOM_PX) {
      step = Math.ceil(((d.clientY - (vh - EDGE_BOTTOM_PX)) / EDGE_BOTTOM_PX) * MAX_SCROLL_STEP)
    }
    if (step) {
      window.scrollBy(0, step)
      update()
    }
    rafRef.current = requestAnimationFrame(autoScroll)
  }, [update])

  const finish = useCallback(
    (commit) => {
      const d = drag.current
      drag.current = null
      cancelAnimationFrame(rafRef.current)
      setState(null)
      if (!commit || !d?.slot) return
      const next = moveItem(itemsRef.current, d.from, d.slot.insertAt, d.slot.section)
      if (next !== itemsRef.current) onChangeRef.current(next)
    },
    []
  )

  const handleProps = (index) => ({
    'data-drag-handle': '',
    style: { touchAction: 'none' },
    onPointerDown: (e) => {
      if (e.button != null && e.button !== 0) return
      if (itemsRef.current.length < 2) return
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      const scrollY = window.scrollY
      const rects = itemsRef.current.map((_, i) => {
        const r = rowEls.current[i]?.getBoundingClientRect()
        return r ? { top: r.top + scrollY, bottom: r.bottom + scrollY } : null
      })
      const own = rects[index]
      if (!own) return
      drag.current = {
        from: index,
        pointerId: e.pointerId,
        clientY: e.clientY,
        startPageY: e.clientY + scrollY,
        startCenter: (own.top + own.bottom) / 2,
        slots: buildSlots(itemsRef.current, rects),
        slot: null
      }
      setState({ from: index, dy: 0, slot: null })
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(autoScroll)
    },
    onPointerMove: (e) => {
      const d = drag.current
      if (!d || d.pointerId !== e.pointerId) return
      d.clientY = e.clientY
      update()
    },
    onPointerUp: (e) => {
      if (drag.current?.pointerId === e.pointerId) finish(true)
    },
    onPointerCancel: () => finish(false),
    onLostPointerCapture: () => {
      if (drag.current) finish(true)
    },
    onKeyDown: (e) => {
      if (e.key === 'Escape' && drag.current) {
        finish(false)
        return
      }
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      e.preventDefault()
      const direction = e.key === 'ArrowUp' ? -1 : 1
      const list = itemsRef.current
      const next = moveItemByStep(list, index, direction)
      if (next === list) return
      const sectionOnly = sectionOf(list[index]) !== sectionOf(list[index + direction])
      pendingFocus.current = sectionOnly ? index : index + direction
      onChangeRef.current(next)
    }
  })

  const rowRef = (index) => (el) => {
    rowEls.current[index] = el
  }

  const isDragging = (index) => state?.from === index

  const rowStyle = (index) =>
    isDragging(index)
      ? { transform: `translateY(${state.dy}px)`, position: 'relative', zIndex: 30, opacity: 0.92 }
      : undefined

  /** 'before' | 'after' | null — where to draw the drop line for this row. */
  const indicator = (index) => (state?.slot && state.slot.row === index ? state.slot.edge : null)

  return { handleProps, rowRef, rowStyle, isDragging, indicator, active: !!state }
}
