/**
 * Recipe → shareable PDF (A4), generated in the browser with jsPDF (lazy-loaded).
 * Modern layout: full-bleed photo, site fonts (Fraunces + Outfit), meta chips,
 * two-column ingredient panel, numbered steps, storage cards.
 * Phone: opens the share sheet (WhatsApp, mail…) when the Web Share API accepts files;
 * otherwise the PDF is downloaded.
 */
import { formatScaledQty, scaleIngredients } from './scaleIngredients.js'
import { groupStepsForDisplay } from './groupSteps.js'
import { groupBySection } from './recipeSections.js'
import { detectRecipeMethods } from './cookingDetect.js'
import { normalizeMethodId } from './cookingAppliances.js'

const DIFFICULTY = { easy: 'Facile', medium: 'Media', hard: 'Difficile' }

const PAGE_W = 210
const PAGE_H = 297
const M = 16
const CW = PAGE_W - M * 2
const FOOTER_Y = PAGE_H - 10
const BOTTOM = PAGE_H - 20
const HERO_H = 92
const PT = 0.3528 // mm per pt

const C = {
  accent: [255, 107, 107],
  accentDark: [229, 57, 53],
  accentSoft: [255, 243, 241],
  ink: [28, 25, 23],
  body: [68, 64, 60],
  muted: [120, 113, 108],
  line: [231, 229, 228],
  chip: [245, 245, 244],
  teal: [17, 94, 89],
  tealSoft: [240, 250, 248],
  tealLine: [204, 237, 230],
  stoneSoft: [250, 250, 249],
  amber: [120, 53, 15],
  amberSoft: [255, 251, 235],
  white: [255, 255, 255]
}

const FONT_FILES = {
  title: 'Fraunces-SemiBold.ttf',
  regular: 'Outfit-Regular.ttf',
  medium: 'Outfit-Medium.ttf',
  semibold: 'Outfit-SemiBold.ttf'
}

/** Drop what the fonts can't draw (emoji…) and tidy the spacing it leaves. */
function pdfSafe(text) {
  return String(text ?? '')
    .replace(/ /g, ' ')
    .replace(/[•●▪]/g, '-')
    .replace(/[^\n\x20-\x7E -ſ–—‘’“”…€°]/g, '')
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

function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

/** Register the site fonts; returns false (→ Helvetica) if they can't be loaded. */
async function registerFonts(doc, loadFont) {
  try {
    const entries = await Promise.all(
      Object.entries(FONT_FILES).map(async ([key, file]) => [key, file, await loadFont(file)])
    )
    for (const [key, file, buf] of entries) {
      doc.addFileToVFS(file, bufferToBase64(buf))
      doc.addFont(file, `rb-${key}`, 'normal')
    }
    return true
  } catch (err) {
    console.warn('[pdf] fonts not available, using Helvetica:', err?.message || err)
    return false
  }
}

async function defaultLoadFont(file) {
  const res = await fetch(`/fonts/${file}`)
  if (!res.ok) throw new Error(`font ${file}: ${res.status}`)
  return res.arrayBuffer()
}

function workerUrl() {
  try {
    return String(import.meta.env?.VITE_WORKER_URL || '').replace(/\/$/, '')
  } catch {
    return ''
  }
}

async function fetchImageBlob(url) {
  const tryFetch = async (u) => {
    const res = await fetch(u, { mode: 'cors' })
    if (!res.ok) throw new Error(String(res.status))
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) throw new Error('not an image')
    return blob
  }
  try {
    return await tryFetch(url)
  } catch {
    // External sites rarely allow CORS: go through the Worker proxy (recipe images only)
    if (/\/api\/media\//.test(url)) throw new Error('image unavailable')
    return tryFetch(`${workerUrl()}/api/media/proxy?url=${encodeURIComponent(url)}`)
  }
}

/** Load the photo cropped (cover) to the hero ratio as JPEG. null on failure. */
async function loadHeroImage(url, ratio) {
  if (!url || !/^(https?:|data:)/.test(url) || typeof document === 'undefined') return null
  try {
    const blob = url.startsWith('data:') ? await (await fetch(url)).blob() : await fetchImageBlob(url)
    const objectUrl = URL.createObjectURL(blob)
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = reject
        el.src = objectUrl
      })
      const outW = 1400
      const outH = Math.round(outW / ratio)
      let sw = img.width
      let sh = img.width / ratio
      if (sh > img.height) {
        sh = img.height
        sw = img.height * ratio
      }
      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      canvas
        .getContext('2d')
        .drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, outW, outH)
      return canvas.toDataURL('image/jpeg', 0.85)
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch {
    return null
  }
}

/** Build the PDF and return it as a Blob. */
export async function buildRecipePdf(
  recipe,
  { servings, appName = 'Recipe Book', loadFont = defaultLoadFont, heroImage } = {}
) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const custom = await registerFonts(doc, loadFont)
  const FONT = custom
    ? {
        title: ['rb-title', 'normal'],
        regular: ['rb-regular', 'normal'],
        medium: ['rb-medium', 'normal'],
        semibold: ['rb-semibold', 'normal']
      }
    : {
        title: ['helvetica', 'bold'],
        regular: ['helvetica', 'normal'],
        medium: ['helvetica', 'normal'],
        semibold: ['helvetica', 'bold']
      }

  const meta = recipe.metadata || {}
  const baseServings = Math.max(1, Number(meta.servings) || 1)
  const target = Math.max(1, Number(servings) || baseServings)
  let y = M

  const font = (kind, size, color = C.body) => {
    doc.setFont(...FONT[kind])
    doc.setFontSize(size)
    doc.setTextColor(...color)
  }
  const lineH = (size, gap = 1.42) => size * PT * gap
  const wrap = (text, width) => doc.splitTextToSize(pdfSafe(text), width)
  const ensure = (h) => {
    if (y + h > BOTTOM) {
      doc.addPage()
      y = M + 4
    }
  }

  /** Paragraph flowing across pages. */
  const para = (text, { x = M, width = CW, kind = 'regular', size = 10.5, color = C.body, gap = 1.45 } = {}) => {
    font(kind, size, color)
    const lh = lineH(size, gap)
    for (const ln of wrap(text, width)) {
      ensure(lh)
      doc.text(ln, x, y + lh * 0.72)
      y += lh
    }
  }

  const sectionTitle = (label) => {
    ensure(26)
    y += 7
    font('title', 15, C.ink)
    doc.text(pdfSafe(label), M, y + 5)
    doc.setFillColor(...C.accent)
    doc.roundedRect(M, y + 8, 12, 1.1, 0.55, 0.55, 'F')
    y += 13
  }

  const eyebrow = (label, x, yy, color = C.accent) => {
    font('semibold', 7.5, color)
    doc.text(pdfSafe(label).toUpperCase(), x, yy, { charSpace: 0.55 })
  }

  // ── Hero ──────────────────────────────────────────────────────────────────
  const hero = heroImage !== undefined ? heroImage : await loadHeroImage(recipe.imageUrl, PAGE_W / HERO_H)
  if (hero) {
    doc.addImage(hero, 'JPEG', 0, 0, PAGE_W, HERO_H)
    y = HERO_H + 11
  } else {
    doc.setFillColor(...C.accent)
    doc.rect(0, 0, PAGE_W, 5, 'F')
    y = 20
  }

  eyebrow(appName || 'Ricetta', M, y)
  y += 4
  font('title', 26, C.ink)
  const titleLh = lineH(26, 1.12)
  for (const ln of wrap(recipe.title || 'Ricetta', CW)) {
    doc.text(ln, M, y + titleLh * 0.78)
    y += titleLh
  }
  y += 4

  // ── Meta chips ────────────────────────────────────────────────────────────
  const totalTime = (Number(meta.prepTime) || 0) + (Number(meta.cookTime) || 0)
  const chips = [
    `${target} ${target === 1 ? 'porzione' : 'porzioni'}`,
    meta.prepTime ? `Preparazione ${meta.prepTime} min` : null,
    meta.cookTime ? `Cottura ${meta.cookTime} min` : null,
    meta.prepTime && meta.cookTime ? `Totale ${totalTime} min` : null,
    DIFFICULTY[meta.difficulty] || null
  ].filter(Boolean)
  font('medium', 9, C.body)
  const chipH = 7.2
  let cx = M
  for (const label of chips) {
    const w = doc.getTextWidth(label) + 8
    if (cx + w > M + CW) {
      cx = M
      y += chipH + 2.5
    }
    doc.setFillColor(...C.chip)
    doc.roundedRect(cx, y, w, chipH, chipH / 2, chipH / 2, 'F')
    doc.text(label, cx + 4, y + chipH / 2 + 1.15)
    cx += w + 2.5
  }
  y += chipH + 3

  if (meta.tags?.length) {
    para(meta.tags.map((t) => `#${t}`).join('   '), { size: 9, color: C.muted, kind: 'medium' })
  }

  if (recipe.notes) {
    y += 3
    font('regular', 10.5, C.body)
    const lh = lineH(10.5)
    const lines = wrap(recipe.notes, CW - 6)
    ensure(Math.min(lines.length, 3) * lh)
    let barTop = y
    for (const ln of lines) {
      if (y + lh > BOTTOM) {
        doc.setFillColor(...C.accent)
        doc.rect(M, barTop, 0.9, y - barTop, 'F')
        doc.addPage()
        y = M + 4
        barTop = y
        font('regular', 10.5, C.body)
      }
      doc.text(ln, M + 5, y + lh * 0.72)
      y += lh
    }
    doc.setFillColor(...C.accent)
    doc.rect(M, barTop, 0.9, y - barTop, 'F')
  }

  // ── Ingredients panel (two columns) ───────────────────────────────────────
  const ingredients = scaleIngredients(recipe.ingredients || [], baseServings, target)
  if (ingredients.length) {
    sectionTitle(target !== baseServings ? `Ingredienti per ${target} porzioni` : 'Ingredienti')

    const pad = 6
    const gap = 8
    const twoCols = ingredients.length > 4
    const colW = twoCols ? (CW - pad * 2 - gap) / 2 : CW - pad * 2
    const itemLh = lineH(10, 1.35)
    const rows = []
    for (const group of groupBySection(ingredients)) {
      if (group.section) rows.push({ type: 'section', text: group.section, h: 7 })
      for (const { item } of group.entries) {
        const qty = pdfSafe(formatScaledQty(item.quantity, item.unit) || '')
        font('semibold', 10, C.ink)
        const qtyW = qty ? doc.getTextWidth(qty) + 3 : 0
        font('regular', 10, C.body)
        const lines = wrap(`${item.name}${item.notes ? ` (${item.notes})` : ''}`, colW - 3.5 - qtyW)
        rows.push({ type: 'item', lines, qty, h: lines.length * itemLh + 2.6 })
      }
    }

    // Split rows in two balanced columns, never leaving a section title alone at the bottom
    let left = rows
    let right = []
    if (twoCols) {
      const total = rows.reduce((s, r) => s + r.h, 0)
      let acc = 0
      let cut = rows.length
      for (let i = 0; i < rows.length; i++) {
        if (acc >= total / 2) {
          cut = i
          break
        }
        acc += rows[i].h
      }
      if (cut > 0 && rows[cut - 1]?.type === 'section') cut -= 1
      left = rows.slice(0, cut)
      right = rows.slice(cut)
    }
    const colH = (col) => col.reduce((s, r) => s + r.h, 0)
    const panelH = Math.max(colH(left), colH(right)) + pad * 2 - 2

    const drawCol = (col, x, top) => {
      let yy = top
      col.forEach((r, idx) => {
        if (r.type === 'section') {
          eyebrow(r.text, x, yy + 4.6, C.accentDark)
          yy += r.h
          return
        }
        doc.setFillColor(...C.accent)
        doc.circle(x + 0.9, yy + itemLh * 0.45, 0.75, 'F')
        font('regular', 10, C.body)
        r.lines.forEach((ln, i) => doc.text(ln, x + 3.5, yy + itemLh * 0.72 + i * itemLh))
        if (r.qty) {
          font('semibold', 10, C.ink)
          doc.text(r.qty, x + colW, yy + itemLh * 0.72, { align: 'right' })
        }
        yy += r.h
        if (idx < col.length - 1 && col[idx + 1].type === 'item') {
          doc.setDrawColor(...C.line)
          doc.setLineWidth(0.2)
          doc.line(x + 3.5, yy - 1.2, x + colW, yy - 1.2)
        }
      })
    }

    if (panelH <= BOTTOM - M - 4) {
      ensure(panelH)
      doc.setFillColor(...C.accentSoft)
      doc.roundedRect(M, y, CW, panelH, 3, 3, 'F')
      drawCol(left, M + pad, y + pad - 1)
      if (right.length) drawCol(right, M + pad + colW + gap, y + pad - 1)
      y += panelH
    } else {
      // Very long list: plain single column flowing across pages
      for (const r of rows) {
        if (r.type === 'section') {
          ensure(8)
          eyebrow(r.text, M, y + 4.6, C.accentDark)
          y += r.h
        } else {
          para(`- ${r.lines.join(' ')}${r.qty ? `: ${r.qty}` : ''}`, { size: 10 })
        }
      }
    }
  }

  // ── Steps ─────────────────────────────────────────────────────────────────
  const steps = groupStepsForDisplay(recipe.steps || [])
  if (steps.length) {
    sectionTitle('Preparazione')
    for (const group of groupBySection(steps)) {
      if (group.section) {
        ensure(12)
        y += 1
        eyebrow(group.section, M, y + 4, C.accentDark)
        y += 7
      }
      for (const { item } of group.entries) {
        font('regular', 10.5, C.body)
        const lh = lineH(10.5, 1.5)
        const lines = wrap(item.instruction, CW - 12)
        ensure(Math.min(lines.length, 3) * lh + 2)
        const top = y
        doc.setFillColor(...C.accent)
        doc.circle(M + 3.4, top + 3.4, 3.4, 'F')
        font('semibold', 9, C.white)
        doc.text(String(item.order), M + 3.4, top + 4.55, { align: 'center' })
        font('regular', 10.5, C.body)
        for (const ln of lines) {
          ensure(lh)
          doc.text(ln, M + 12, y + lh * 0.72)
          y += lh
        }
        y = Math.max(y, top + 7) + 3.2
      }
    }
  }

  // ── Storage cards ─────────────────────────────────────────────────────────
  const st = recipe.storage
  if (st && (st.fridge?.how || st.freezer?.how || st.room?.how)) {
    sectionTitle('Come conservarla')
    if (st.warning) {
      font('medium', 9.5, C.amber)
      const lines = wrap(`Attenzione: ${st.warning}`, CW - 10)
      const h = lines.length * lineH(9.5) + 6
      ensure(h)
      doc.setFillColor(...C.amberSoft)
      doc.roundedRect(M, y, CW, h, 2.5, 2.5, 'F')
      font('medium', 9.5, C.amber)
      lines.forEach((ln, i) => doc.text(ln, M + 5, y + 3 + lineH(9.5) * (0.72 + i)))
      y += h + 4
    }
    const gapX = 4
    const cardW = (CW - gapX * 2) / 3
    const inner = cardW - 8
    const durLh = lineH(12, 1.2)
    const txtLh = lineH(9, 1.4)
    const places = [
      ['fridge', 'Frigorifero'],
      ['freezer', 'Congelatore'],
      ['room', 'Ambiente']
    ].map(([key, label]) => {
      const p = st[key] || {}
      const ok = p.ok !== false && Boolean(p.duration || p.how)
      font('semibold', 12, C.ink)
      const durLines = wrap(ok ? p.duration || 'Sì' : 'Sconsigliato', inner)
      font('regular', 9, C.body)
      const textLines = [
        ...(p.how ? wrap(p.how, inner) : []),
        ...(key === 'freezer' && ok && p.thaw ? wrap(`Scongelare: ${p.thaw}`, inner) : [])
      ]
      const h = 11.5 + durLines.length * durLh + 1.5 + textLines.length * txtLh + 5
      return { label, ok, durLines, textLines, h }
    })
    const cardH = Math.max(...places.map((p) => p.h))
    ensure(cardH)
    places.forEach((p, i) => {
      const x = M + i * (cardW + gapX)
      doc.setFillColor(...(p.ok ? C.tealSoft : C.stoneSoft))
      doc.setDrawColor(...(p.ok ? C.tealLine : C.line))
      doc.setLineWidth(0.25)
      doc.roundedRect(x, y, cardW, cardH, 3, 3, 'FD')
      let yy = y + 7
      eyebrow(p.label, x + 4, yy, p.ok ? C.teal : C.muted)
      yy += 4.5
      font('semibold', 12, p.ok ? C.ink : C.muted)
      for (const ln of p.durLines) {
        doc.text(ln, x + 4, yy + durLh * 0.75)
        yy += durLh
      }
      yy += 1.5
      font('regular', 9, C.body)
      for (const ln of p.textLines) {
        doc.text(ln, x + 4, yy + txtLh * 0.72)
        yy += txtLh
      }
    })
    y += cardH + 4
    if (st.reheat) para(`Per riscaldare: ${st.reheat}`, { size: 10 })
    for (const tip of st.tips || []) para(`- ${tip}`, { size: 9.5, color: C.muted })
  }

  // ── Cooking methods (if analysed) ─────────────────────────────────────────
  if (recipe.cookingMethods?.length) {
    sectionTitle('Come cuocerla')
    // Same rule as the app: the recipe's own method (from its text) comes first, with its params
    const detected = detectRecipeMethods(recipe)
    const methods = recipe.cookingMethods
      .map((m) => {
        const own = detected.primary && normalizeMethodId(m.method) === detected.primary
        return {
          ...m,
          recommended: own,
          ...(own && detected.params.temperature ? { temperature: detected.params.temperature } : {}),
          ...(own && detected.params.time ? { time: detected.params.time } : {})
        }
      })
      .sort((a, b) => Number(b.recommended) - Number(a.recommended))
    for (const m of methods) {
      ensure(12)
      const head = [m.label || m.method, m.temperature, m.time].filter(Boolean).join('  ·  ')
      para(`${head}${m.recommended ? '   - metodo della ricetta' : ''}`, {
        kind: 'semibold',
        size: 10.5,
        color: C.ink
      })
      if (m.notes) para(m.notes, { size: 9.5 })
      y += 2
    }
  }

  // ── Source ────────────────────────────────────────────────────────────────
  if (recipe.sourceUrl) {
    ensure(10)
    y += 4
    font('regular', 8.5, C.muted)
    let host = recipe.sourceUrl
    try {
      host = new URL(recipe.sourceUrl).host.replace(/^www\./, '')
    } catch {
      // keep raw
    }
    doc.textWithLink(pdfSafe(`Fonte: ${host}`), M, y + 3, { url: recipe.sourceUrl })
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...C.line)
    doc.setLineWidth(0.25)
    doc.line(M, FOOTER_Y - 4.5, PAGE_W - M, FOOTER_Y - 4.5)
    font('medium', 8, C.muted)
    doc.text(pdfSafe(`${appName}  ·  ${recipe.title || ''}`).slice(0, 90), M, FOOTER_Y)
    if (pages > 1) doc.text(`${i} / ${pages}`, PAGE_W - M, FOOTER_Y, { align: 'right' })
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
