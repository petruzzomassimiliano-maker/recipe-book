/**
 * Recipe → shareable PDF (A4), generated in the browser with jsPDF (lazy-loaded).
 * Phone: opens the share sheet (WhatsApp, mail…) when the Web Share API accepts files;
 * otherwise the PDF is downloaded.
 */
import { formatScaledQty, scaleIngredients } from './scaleIngredients.js'
import { groupStepsForDisplay } from './groupSteps.js'
import { groupBySection } from './recipeSections.js'

const DIFFICULTY = { easy: 'Facile', medium: 'Media', hard: 'Difficile' }

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 16
const CONTENT_W = PAGE_W - MARGIN * 2
const ACCENT = [224, 82, 82]
const TEXT = [41, 37, 36]
const MUTED = [120, 113, 108]

/**
 * The built-in PDF fonts only cover Windows-1252: map common typographic
 * characters and drop anything else (emoji…) instead of printing garbage.
 */
function pdfSafe(text) {
  return String(text ?? '')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•●▪]/g, '-')
    .replace(/⅓/g, '1/3')
    .replace(/⅔/g, '2/3')
    .replace(/⅛/g, '1/8')
    .replace(/ /g, ' ')
    .replace(/[^\n\x20-\x7E -ÿ€]/g, '')
    .replace(/ +([.,;:!?)])/g, '$1')
    .replace(/ {2,}/g, ' ')
}

function fileNameFor(title) {
  const base = String(title || 'ricetta')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60)
  return `${base || 'ricetta'}.pdf`
}

/** Fetch the recipe photo as a JPEG data URL (re-encoded via canvas). null on failure. */
async function loadImage(url, maxEdge = 1200) {
  if (!url || !/^(https?:|data:)/.test(url)) return null
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    const bitmapUrl = URL.createObjectURL(blob)
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = reject
        el.src = bitmapUrl
      })
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: w, height: h }
    } finally {
      URL.revokeObjectURL(bitmapUrl)
    }
  } catch {
    // CORS / network / external host — the PDF works without the photo
    return null
  }
}

/** Build the PDF and return it as a Blob. */
export async function buildRecipePdf(recipe, { servings, appName = 'Recipe Book' } = {}) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const meta = recipe.metadata || {}
  const baseServings = Math.max(1, Number(meta.servings) || 1)
  const target = Math.max(1, Number(servings) || baseServings)
  let y = MARGIN

  const ensureSpace = (needed) => {
    if (y + needed > PAGE_H - MARGIN - 8) {
      doc.addPage()
      y = MARGIN
    }
  }

  const write = (text, { size = 11, style = 'normal', color = TEXT, indent = 0, lineGap = 1.45 } = {}) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lineH = (size * 0.3528) * lineGap
    const lines = doc.splitTextToSize(pdfSafe(text), CONTENT_W - indent)
    for (const line of lines) {
      ensureSpace(lineH)
      doc.text(line, MARGIN + indent, y + lineH * 0.75)
      y += lineH
    }
  }

  const heading = (text) => {
    ensureSpace(16)
    y += 4
    write(text, { size: 14, style: 'bold', color: ACCENT })
    doc.setDrawColor(...ACCENT)
    doc.setLineWidth(0.3)
    doc.line(MARGIN, y + 0.5, MARGIN + CONTENT_W, y + 0.5)
    y += 3
  }

  const subheading = (text) => {
    ensureSpace(10)
    y += 1.5
    write(String(text).toUpperCase(), { size: 9.5, style: 'bold', color: MUTED })
    y += 0.5
  }

  // ── Photo ──
  const photo = await loadImage(recipe.imageUrl)
  if (photo) {
    const ratio = photo.height / photo.width
    const h = Math.min(CONTENT_W * ratio, 90)
    const w = h / ratio
    doc.addImage(photo.dataUrl, 'JPEG', MARGIN + (CONTENT_W - w) / 2, y, w, h)
    y += h + 6
  }

  // ── Title + meta ──
  write(recipe.title || 'Ricetta', { size: 22, style: 'bold', lineGap: 1.25 })
  y += 1.5
  const totalTime = (Number(meta.prepTime) || 0) + (Number(meta.cookTime) || 0)
  const bits = [
    `${target} ${target === 1 ? 'porzione' : 'porzioni'}`,
    meta.prepTime ? `Preparazione ${meta.prepTime} min` : null,
    meta.cookTime ? `Cottura ${meta.cookTime} min` : null,
    totalTime && meta.prepTime && meta.cookTime ? `Totale ${totalTime} min` : null,
    DIFFICULTY[meta.difficulty] || null
  ].filter(Boolean)
  write(bits.join('  ·  '), { size: 10.5, color: MUTED })
  if (meta.tags?.length) write(meta.tags.join(', '), { size: 9.5, color: MUTED })
  if (recipe.notes) {
    y += 2
    write(recipe.notes, { size: 10.5, style: 'italic' })
  }

  // ── Ingredients ──
  const ingredients = scaleIngredients(recipe.ingredients || [], baseServings, target)
  if (ingredients.length) {
    heading(target !== baseServings ? `Ingredienti (per ${target} porzioni)` : 'Ingredienti')
    for (const group of groupBySection(ingredients)) {
      if (group.section) subheading(group.section)
      for (const { item } of group.entries) {
        const qty = formatScaledQty(item.quantity, item.unit)
        const line = `-  ${item.name}${qty ? `: ${qty}` : ''}${item.notes ? ` (${item.notes})` : ''}`
        write(line, { size: 11, indent: 1 })
      }
    }
  }

  // ── Steps ──
  const steps = groupStepsForDisplay(recipe.steps || [])
  if (steps.length) {
    heading('Preparazione')
    for (const group of groupBySection(steps)) {
      if (group.section) subheading(group.section)
      for (const { item } of group.entries) {
        ensureSpace(12)
        const startY = y
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(...ACCENT)
        doc.text(`${item.order}.`, MARGIN, startY + 11 * 0.3528 * 1.45 * 0.75)
        write(item.instruction, { size: 11, indent: 8 })
        y += 2
      }
    }
  }

  // ── Cooking methods (if analysed) ──
  if (recipe.cookingMethods?.length) {
    heading('Metodi di cottura')
    for (const m of recipe.cookingMethods) {
      const head = [m.label || m.method, m.temperature, m.time].filter(Boolean).join(' - ')
      write(head, { size: 11, style: 'bold' })
      if (m.notes) write(m.notes, { size: 10.5, indent: 2 })
      y += 1.5
    }
  }

  if (recipe.sourceUrl) {
    y += 3
    write(`Fonte: ${recipe.sourceUrl}`, { size: 9, color: MUTED })
  }

  // ── Footer on every page ──
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...MUTED)
    doc.text(pdfSafe(appName), MARGIN, PAGE_H - 8)
    if (pages > 1) doc.text(`${i}/${pages}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' })
  }

  doc.setProperties({ title: pdfSafe(recipe.title || 'Ricetta'), creator: pdfSafe(appName) })
  return doc.output('blob')
}

/**
 * Generate and share/download. Returns 'shared' | 'downloaded' | 'cancelled'.
 */
export async function shareRecipePdf(recipe, options = {}) {
  const blob = await buildRecipePdf(recipe, options)
  const name = fileNameFor(recipe.title)
  const file = new File([blob], name, { type: 'application/pdf' })

  const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  if (isTouch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: recipe.title || 'Ricetta' })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
      // fall through to download
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
