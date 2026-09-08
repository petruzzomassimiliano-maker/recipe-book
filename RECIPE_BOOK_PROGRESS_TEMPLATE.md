# PROGRESS.md — Recipe Book PWA

> **Aggiorna questo file alla fine di ogni sessione dev** (Gemini Code / Cursor / Claude Code)  
> **All'inizio della sessione successiva, leggi QUESTO file prima di qualsiasi altra cosa**

---

## Indice moduli (documentazione in questo file)

| Modulo | Sezione principale | Stato |
|--------|-------------------|-------|
| **OAuth Dropbox PKCE** | «Sessione init» | ⏳ Pending |
| **Dropbox schema + Zustand** | «Sessione init» | ⏳ Pending |
| **Recipe CRUD (manual add)** | «Sessione X» | ⏳ Pending |
| **Web Scraper (AllRecipes)** | «Sessione X» | ⏳ Pending |
| **Gemini recipe recognition** | «Sessione X» | ⏳ Pending |
| **YouTube transcript parsing** | «Sessione X» | ⏳ Pending |
| **FatSecret integration** | «Sessione X» | ⏳ Pending |
| **Shopping list feature** | «Sessione X» | ⏳ Pending |
| **Material Design 3 UI** | «Sessione X» | ⏳ Pending |
| **Multi-user + RBAC** | «Sessione X» | ⏳ Pending |
| **PWA + offline sync** | «Sessione X» | ⏳ Pending |
| **Deploy prod** | «Sessione X» | ⏳ Pending |

---

## Stato attuale: [DATA] — [FEATURE SUMMARY]

> **Template:**
> **Segnalazione:** cosa c'era da fare
> ### Soluzione
> Che cosa è stato fatto
> #### Nuovo file — `path/to/file.js`
> Schema/codice rilevante
> #### Modifiche a `existing-file.js`
> Cosa è cambiato
> ### Cosa non è cambiato
> (Context continuità)
> ### File modificati
> Elenco con azioni (Nuovo / Modificato)
> **Deploy:** status (solo Pages / solo Worker / ambedue) + link prod

---

## Sessione init — Setup Boilerplate + OAuth Dropbox

### Segnalazione

Monorepo non esiste; partire da zero con Vite + Hono, adattando pattern da EN Writing Coach.

### Soluzione

#### 1. Setup monorepo directory

```bash
mkdir recipe-book && cd recipe-book
pnpm init -y

# Workspace root package.json
cat > package.json << 'EOF'
{
  "name": "recipe-book",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["frontend", "worker"]
}
EOF

mkdir frontend worker
```

#### 2. Frontend (Vite + React)

```bash
cd frontend
npm create vite@latest . -- --template react
npm install
npm install zustand axios tailwindcss postcss autoprefixer
npm install -D tailwindcss@latest postcss@latest autoprefixer@latest

# Copia config da en-writing-coach
npx tailwindcss init -p
```

**vite.config.js:**
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
})
```

#### 3. Worker (Hono on Cloudflare)

```bash
cd ../worker
npm create hono@latest . -- --template cloudflare-workers
npm install
npm install hono
```

**wrangler.toml:**
```toml
name = "recipe-book-worker"
type = "javascript"
account_id = ""  # your account id
workers_dev = true
route = ""

[env.production]
vars = { ENVIRONMENT = "production" }

[[env.production.vars]]
name = "WORKER_URL"
```

#### 4. Auth — OAuth Dropbox Setup

**File:** `worker/src/routes/auth.js`

```javascript
import { Hono } from 'hono'
import { sign } from 'hono/jwt'

const auth = new Hono()

// 1. GET /api/auth/authorize — redirect to Dropbox
auth.get('/authorize', (c) => {
  const clientId = c.env.DROPBOX_APP_KEY
  const redirectUri = c.env.VITE_DROPBOX_REDIRECT_URI || 'http://localhost:5173/dropbox-callback'
  const codeChallenge = c.req.query('code_challenge') // from frontend PKCE
  
  const url = new URL('https://www.dropbox.com/oauth2/authorize')
  url.searchParams.append('client_id', clientId)
  url.searchParams.append('redirect_uri', redirectUri)
  url.searchParams.append('response_type', 'code')
  url.searchParams.append('state', 'xyz')  // anti-CSRF
  url.searchParams.append('code_challenge', codeChallenge)
  url.searchParams.append('code_challenge_method', 'S256')
  url.searchParams.append('scope', 'files.content.read files.content.write')
  
  return c.json({ authUrl: url.toString() })
})

// 2. POST /api/auth/exchange — token exchange
auth.post('/exchange', async (c) => {
  const { code, codeVerifier, redirectUri } = await c.req.json()
  
  const tokenUrl = 'https://api.dropboxapi.com/oauth2/token'
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: c.env.DROPBOX_APP_KEY,
      client_secret: c.env.DROPBOX_APP_SECRET,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    })
  })
  
  const tokens = await res.json()
  if (!res.ok) return c.json({ error: tokens.error_description }, 400)
  
  // Extract user info from Dropbox
  const userRes = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  })
  const user = await userRes.json()
  
  // Generate JWT (30 days)
  const jwt = await sign(
    {
      userId: user.account_id,
      email: user.email.email,
      role: 'user',  // default; superUser set in Dropbox
      iat: Math.floor(Date.now() / 1000)
    },
    c.env.JWT_SECRET || 'dev-secret'
  )
  
  return c.json({
    jwt,
    dropboxToken: tokens.access_token,
    user: { id: user.account_id, email: user.email.email }
  })
})

export default auth
```

**File:** `frontend/src/services/auth.js`

```javascript
import { generateRandomString, base64url } from '../utils/pkce'

export async function initiatePKCEFlow() {
  const codeVerifier = generateRandomString(128)
  const codeChallenge = base64url(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
    )
  )
  
  localStorage.setItem('pkce_verifier', codeVerifier)
  
  // Get auth URL from Worker
  const res = await fetch('/api/auth/authorize?code_challenge=' + codeChallenge)
  const data = await res.json()
  
  window.location.href = data.authUrl
}

export async function exchangeCode(code, redirectUri) {
  const codeVerifier = localStorage.getItem('pkce_verifier')
  
  const res = await fetch('/api/auth/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, codeVerifier, redirectUri })
  })
  
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  
  localStorage.setItem('jwt', data.jwt)
  localStorage.setItem('dropbox_token', data.dropboxToken)
  
  return data
}
```

**File:** `frontend/src/utils/pkce.js`

```javascript
export function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function base64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}
```

#### 5. Zustand Store — Auth

**File:** `frontend/src/store/authStore.js`

```javascript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      jwt: null,
      dropboxToken: null,
      user: null,
      isAuthenticated: false,
      
      setAuth: (jwt, dropboxToken, user) => {
        set({
          jwt,
          dropboxToken,
          user,
          isAuthenticated: !!jwt
        })
      },
      
      logout: () => {
        localStorage.removeItem('jwt')
        localStorage.removeItem('dropbox_token')
        set({ jwt: null, dropboxToken: null, user: null, isAuthenticated: false })
      }
    }),
    { name: 'auth-store' }
  )
)
```

#### 6. Dropbox folder initialization

**On first login, Worker initializes:**

```javascript
const initDropboxFolders = async (dropboxToken) => {
  const dbx = new DropboxClient(dropboxToken)
  
  // Create folder structure if not exists
  const folders = ['/users', '/recipes', '/shopping-lists', '/nutrition-cache']
  for (const folder of folders) {
    await dbx.createFolderIfNotExists(folder)
  }
  
  // Create users.json if not exists
  await dbx.createFileIfNotExists('/users/users.json', JSON.stringify([]))
}
```

### Cosa non è cambiato

- Dropbox OAuth pattern (identico a EN Writing Coach)
- JWT structure (HS256, campo `role`)
- Zustand persist strategy

### File modificati

| File | Azione |
|------|--------|
| `worker/src/routes/auth.js` | **Nuovo** |
| `worker/src/lib/dropboxClient.js` | **Nuovo** (copia adatta da en-writing-coach) |
| `frontend/src/services/auth.js` | **Nuovo** |
| `frontend/src/utils/pkce.js` | **Nuovo** |
| `frontend/src/store/authStore.js` | **Nuovo** |
| `worker/wrangler.toml` | Configurato |
| `frontend/vite.config.js` | Proxy API setup |

**Deploy:** 
- Worker: ✅ `wrangler deploy`
- Frontend: ✅ `wrangler pages deploy`
- Test: ✅ OAuth flow locale (dev Dropbox app)

---

## Sessione 2 — Dropbox Schema + Recipe CRUD

[Da compilare nella prossima sessione...]

### Segnalazione

> OAuth funziona; ora serve struttura Dropbox (schema cartelle/JSON) e CRUD ricette base.

### Soluzione

[Qui documenterai: dropbox folder creation, recipes-index.json, recipe-{id}.json schema, implementazione GET/POST/PUT/DELETE recipes nel Worker, hook useRecipes nel frontend...]

### File modificati

[Elenco...]

**Deploy:** status

---

## Sessione 3 — Web Scraper AllRecipes

[Futura sessione...]

---

## URL Produzione

| Servizio | URL |
|----------|-----|
| Frontend (Pages) | `https://recipe-book.pages.dev` |
| Worker (API) | `https://recipe-book-worker.{account}.workers.dev` |
| GitHub | `https://github.com/yourusername/recipe-book` |

---

## Decisioni Architetturali Chiave

- **Monorepo**: Vite frontend + Hono Worker (identico a EN Writing Coach)
- **Storage**: Dropbox app folder (OAuth PKCE, no backend DB)
- **Multi-user**: JWT + Dropbox file ownership; RBAC middleware
- **AI**: Gemini 2.0 vision + text (recipe recognition + parsing)
- **Calorie**: FatSecret API + static DB fallback + nutrition cache Dropbox
- **Web scraping**: per-sito CSS selectors + Gemini validation
- **PWA**: Workbox service worker, offline-first sync (debounce + queue)
- **UI**: Material Design 3 (shadcn/ui + Tailwind)
- **Deploy**: GitHub → Cloudflare Pages (Pages) + Cloudflare Workers (API)

---

## Prossimi Passi (Ready for next session)

- [ ] Dropbox schema implementation (`/users`, `/recipes`, `/shopping-lists`)
- [ ] Recipe CRUD endpoints (`GET/POST/PUT/DELETE /api/recipes`)
- [ ] useRecipes hook (Zustand + TanStack Query)
- [ ] RecipeForm component (manual add)
- [ ] Web scraper AllRecipes (worker/src/lib/scrapers/allrecipes.js)
- [ ] Gemini recipe parsing integration
- [ ] FatSecret API integration
- [ ] Shopping list feature
- [ ] Material Design 3 theme + responsive layout
- [ ] Multi-user admin panel (superUser)
- [ ] PWA service worker setup
- [ ] Deploy alpha

---

## Note importanti

- `.env` + `worker/.dev.vars` in `.gitignore` — mai committare chiavi reali
- **Secrets Worker** (configura via Cloudflare Dashboard):
  - `DROPBOX_APP_KEY` ✅
  - `DROPBOX_APP_SECRET` ✅
  - `GEMINI_API_KEY` ✅
  - `FATSECRET_OAUTH_CONSUMER_KEY` ✅ (opzionale MVP)
  - `FATSECRET_OAUTH_CONSUMER_SECRET` ✅ (opzionale MVP)
  - `JWT_SECRET` ✅
  
- **Variabili Pages** (frontend):
  - `VITE_WORKER_URL` = URL Worker prod
  - `VITE_DROPBOX_APP_KEY` = tuo key
  - `VITE_DROPBOX_REDIRECT_URI` = callback URL

- **Test OAuth locale**: usa Dropbox app dev credentials; redirect URI `http://localhost:5173/dropbox-callback`

- **Dropbox rate limiting**: 300 req/15min per app; monitora 429 errors (backoff exponential)

---

## Riutilizzo EN Writing Coach

**Copiacolla intero:**
- `worker/src/lib/dropboxClient.js` — OAuth, file ops
- `frontend/src/store/*.js` — pattern Zustand persist
- `worker/wrangler.toml` — base config
- `frontend/vite.config.js` — Vite setup

**Adatta / Scrivi nuovo:**
- Prompt Gemini (recipe parsing, non writing analysis)
- RBAC (più semplice: superUser vs user)
- Dropbox folder structure (recipes, non sessions)
- Material Design 3 UI (colori, componenti)

---

**Fine template. Inizia la session 1 quando pronto!**
