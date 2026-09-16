#!/usr/bin/env node
/**
 * Reset owner (or named user) password on the family Dropbox vault.
 *
 * Usage:
 *   node scripts/reset-owner-password.mjs --list
 *   node scripts/reset-owner-password.mjs --password 'NuovaPass8+'
 *   node scripts/reset-owner-password.mjs --username marco --password 'NuovaPass8+'
 *   node scripts/reset-owner-password.mjs --delete-username mimma
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { webcrypto } from 'node:crypto'

const crypto = webcrypto
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const varsPath = path.join(root, 'worker', '.dev.vars')

function loadDevVars() {
  if (!fs.existsSync(varsPath)) throw new Error(`Manca ${varsPath}`)
  const env = {}
  for (const line of fs.readFileSync(varsPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const i = t.indexOf('=')
    env[t.slice(0, i)] = t.slice(i + 1)
  }
  return env
}

function parseArgs(argv) {
  const out = { list: false, username: null, password: null, deleteUsername: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--list') out.list = true
    else if (a === '--username') out.username = argv[++i]
    else if (a === '--password') out.password = argv[++i]
    else if (a === '--delete-username') out.deleteUsername = argv[++i]
  }
  return out
}

function b64encode(buf) {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return Buffer.from(binary, 'binary').toString('base64url').replace(/=+$/g, '')
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  )
  return `pbkdf2$100000$${b64encode(salt)}$${b64encode(bits)}`
}

async function getAccessToken(env) {
  const refresh = env.FAMILY_DROPBOX_REFRESH_TOKEN?.trim()
  if (!refresh) throw new Error('Manca FAMILY_DROPBOX_REFRESH_TOKEN in .dev.vars')
  const tokenRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: env.DROPBOX_APP_KEY,
      client_secret: env.DROPBOX_APP_SECRET
    })
  })
  const tokens = await tokenRes.json()
  if (!tokenRes.ok) {
    throw new Error(tokens.error_description || 'Dropbox refresh failed')
  }
  return tokens.access_token
}

async function dbxDownload(accessToken, dropboxPath) {
  const res = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath })
    }
  })
  if (res.status === 409) return null
  if (!res.ok) throw new Error(`download ${dropboxPath}: ${res.status} ${await res.text()}`)
  return res.text()
}

async function dbxUpload(accessToken, dropboxPath, content) {
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: dropboxPath,
        mode: 'overwrite',
        mute: true
      })
    },
    body: content
  })
  if (!res.ok) throw new Error(`upload ${dropboxPath}: ${res.status} ${await res.text()}`)
}

const args = parseArgs(process.argv.slice(2))
const env = loadDevVars()
const accessToken = await getAccessToken(env)
const raw = await dbxDownload(accessToken, '/users/users.json')
if (!raw) {
  console.error('Nessun users.json — setup owner non ancora fatto su questo Dropbox.')
  process.exit(1)
}
const users = JSON.parse(raw)
if (!Array.isArray(users) || users.length === 0) {
  console.error('Lista utenti vuota.')
  process.exit(1)
}

console.log('Utenti trovati:')
for (const u of users) {
  console.log(
    `  - @${u.username}  (${u.displayName || '—'})  ruolo=${u.role}  active=${u.active !== false}`
  )
}

if (args.list) process.exit(0)

if (args.deleteUsername) {
  const want = String(args.deleteUsername).trim().toLowerCase()
  const target = users.find((u) => String(u.username || '').toLowerCase() === want)
  if (!target) {
    console.error(`Utente @${want} non trovato.`)
    process.exit(1)
  }
  if (target.role === 'owner') {
    console.error('Non puoi eliminare l’owner.')
    process.exit(1)
  }
  const next = users.filter((u) => u.id !== target.id)
  await dbxUpload(accessToken, '/users/users.json', JSON.stringify(next, null, 2))
  console.log(`\nOK — eliminato @${target.username}. Rimasti: ${next.map((u) => '@' + u.username).join(', ')}`)
  process.exit(0)
}

if (!args.password || args.password.length < 8) {
  console.error('\nPassa --password con almeno 8 caratteri (o --delete-username …)')
  process.exit(1)
}

let target
if (args.username) {
  const want = String(args.username).trim().toLowerCase()
  target = users.find((u) => String(u.username || '').toLowerCase() === want)
} else {
  target = users.find((u) => u.role === 'owner' && u.active !== false) || users.find((u) => u.role === 'owner')
}

if (!target) {
  console.error('Utente non trovato.')
  process.exit(1)
}

target.passwordHash = await hashPassword(args.password)
target.mustChangePassword = false
target.inviteToken = null
target.inviteExpiresAt = null
target.updatedAt = new Date().toISOString()

await dbxUpload(accessToken, '/users/users.json', JSON.stringify(users, null, 2))
console.log(`\nOK — password aggiornata per @${target.username} (${target.role})`)
console.log('Accedi su https://recipe-book-ap1.pages.dev con quello username e la nuova password.')
