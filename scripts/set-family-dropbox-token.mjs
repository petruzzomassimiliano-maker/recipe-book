#!/usr/bin/env node
/**
 * Writes FAMILY_DROPBOX_REFRESH_TOKEN into worker/.dev.vars (local only).
 *
 * Usage:
 *   node scripts/set-family-dropbox-token.mjs 'sl.xxx...'
 *   node scripts/set-family-dropbox-token.mjs 'FAMILY_DROPBOX_REFRESH_TOKEN=sl.xxx...'
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const varsPath = path.join(root, 'worker', '.dev.vars')

let raw = process.argv[2] || ''
raw = raw.trim()
if (!raw) {
  console.error('Passa il refresh token come argomento.')
  process.exit(1)
}
if (raw.startsWith('FAMILY_DROPBOX_REFRESH_TOKEN=')) {
  raw = raw.slice('FAMILY_DROPBOX_REFRESH_TOKEN='.length).trim()
}

if (!fs.existsSync(varsPath)) {
  console.error(`Manca ${varsPath}. Copia da worker/.dev.vars.example`)
  process.exit(1)
}

let text = fs.readFileSync(varsPath, 'utf8')
const line = `FAMILY_DROPBOX_REFRESH_TOKEN=${raw}`
if (/^FAMILY_DROPBOX_REFRESH_TOKEN=/m.test(text)) {
  text = text.replace(/^FAMILY_DROPBOX_REFRESH_TOKEN=.*$/m, line)
} else {
  if (!text.endsWith('\n')) text += '\n'
  text += `${line}\n`
}
fs.writeFileSync(varsPath, text)
console.log('OK — aggiornato worker/.dev.vars')
console.log('Riavvia il worker (wrangler) perché rilegga .dev.vars')
