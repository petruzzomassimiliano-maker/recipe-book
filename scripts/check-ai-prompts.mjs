#!/usr/bin/env node
/**
 * Dry run of the AI prompts on real recipes — nothing is saved anywhere.
 *
 * Reads recipes (read-only, no PIN) from the production Worker, builds the SAME
 * prompts the Worker uses ("Come cuocerla" + "Come conservarla"), calls Gemini with
 * the key in worker/.dev.vars and prints/saves what it answers.
 *
 * Usage (from repo root):
 *   node scripts/check-ai-prompts.mjs                 # automatic sample of recipes
 *   node scripts/check-ai-prompts.mjs pesto risotto   # recipes whose title contains these words
 *   OUT=/tmp/ai-check.json node scripts/check-ai-prompts.mjs
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectRecipeMethods } from '../worker/src/lib/cookingDetect.js'
import { buildCookingPrompt } from '../worker/src/lib/cookingPrompt.js'
import { generateStorageAdvice } from '../worker/src/lib/storageAdvice.js'
import { geminiGenerateContent, parseGeminiJson } from '../worker/src/lib/geminiClient.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API = process.env.API || 'https://recipe-book-worker.petruzzo-massimiliano-b40.workers.dev'
const SAMPLE_SIZE = Number(process.env.N || 6)

function readDevVars() {
  const file = path.join(ROOT, 'worker', '.dev.vars')
  const env = {}
  if (!fs.existsSync(file)) return env
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return (await res.json()).data
}

/** One recipe per cooking method when possible, plus risky foods for storage. */
async function pickSample(index) {
  const wanted = ['padella', 'bollitura', 'forno', 'friggitrice_aria', 'vapore', 'grill']
  const risky = /pesto|riso|risott|tiramis|mascarpone|crema|pesce|salmon|tonno|uov|sott.?olio/i
  const picked = new Map()
  const full = []
  for (const row of index) {
    if (picked.size >= SAMPLE_SIZE) break
    const recipe = await getJson(`${API}/api/recipes/${row.id}`)
    const primary = detectRecipeMethods(recipe).primary
    full.push(recipe)
    if (primary && wanted.includes(primary) && ![...picked.values()].some((r) => r.primary === primary)) {
      picked.set(recipe.id, { recipe, primary })
    }
  }
  for (const recipe of full) {
    if (picked.size >= SAMPLE_SIZE) break
    if (!picked.has(recipe.id) && risky.test(recipe.title)) {
      picked.set(recipe.id, { recipe, primary: detectRecipeMethods(recipe).primary })
    }
  }
  return [...picked.values()].map((x) => x.recipe)
}

async function main() {
  const env = readDevVars()
  if (!env.GEMINI_API_KEY && !env.GEMINI_API_KEY_2) {
    console.error('✘ Manca GEMINI_API_KEY in worker/.dev.vars')
    process.exit(1)
  }

  const index = await getJson(`${API}/api/recipes`)
  const words = process.argv.slice(2).map((w) => w.toLowerCase())
  let recipes
  if (words.length) {
    const rows = index.filter((r) => words.some((w) => String(r.title).toLowerCase().includes(w)))
    recipes = await Promise.all(rows.slice(0, 10).map((r) => getJson(`${API}/api/recipes/${r.id}`)))
  } else {
    recipes = await pickSample(index)
  }
  if (!recipes.length) {
    console.error('✘ Nessuna ricetta trovata')
    process.exit(1)
  }

  const results = []
  for (const recipe of recipes) {
    const detected = detectRecipeMethods(recipe)
    console.log(`\n━━ ${recipe.title}  [metodo letto dal testo: ${detected.primary || '—'} ${detected.params.temperature} ${detected.params.time}]`)
    const out = { id: recipe.id, title: recipe.title, detected }

    try {
      const prompt = buildCookingPrompt(recipe, { primary: detected.primary, params: detected.params })
      const text = await geminiGenerateContent(env, [{ text: prompt }], { temperature: 0.2, json: true })
      out.cooking = parseGeminiJson(text)
      for (const m of out.cooking?.methods || []) {
        console.log(`  • ${m.method}: ${m.temperature || '—'} · ${m.time || '—'}`)
        if (m.induction) console.log(`    induzione: ${m.induction}`)
      }
    } catch (err) {
      out.cookingError = err.message
      console.log(`  ✘ cottura: ${err.message}`)
    }

    try {
      out.storage = await generateStorageAdvice(env, recipe)
      const s = out.storage
      console.log(`  frigo: ${s.fridge.duration || (s.fridge.ok ? '?' : 'no')} · freezer: ${s.freezer.duration || (s.freezer.ok ? '?' : 'no')}`)
      if (s.warning) console.log(`  ⚠ ${s.warning}`)
    } catch (err) {
      out.storageError = err.message
      console.log(`  ✘ conservazione: ${err.message}`)
    }
    results.push(out)
  }

  const outFile = process.env.OUT || path.join(os.tmpdir(), 'ai-prompt-check.json')
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2))
  console.log(`\n✓ Risposte complete salvate in ${outFile}`)
}

main().catch((err) => {
  console.error('✘', err.message)
  process.exit(1)
})
