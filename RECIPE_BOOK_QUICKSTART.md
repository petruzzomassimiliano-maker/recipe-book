# 🍳 Recipe Book PWA — Quick Start Guide

> **Start here.** 10–15 minuti di setup → primo run locale completo.

---

## ⚡ TL;DR — 3 Step

```bash
# 1. Clone boilerplate (copia da EN Writing Coach repo + adatta)
git clone https://github.com/yourusername/recipe-book.git
cd recipe-book
pnpm install

# 2. Setup .env + .dev.vars (vedi sezione sotto)
cp frontend/.env.example frontend/.env.local
cp worker/.dev.vars.example worker/.dev.vars

# 3. Run locale
cd frontend && npm run dev  # :5173
# In another terminal:
cd worker && wrangler dev  # :8787

# 4. Test OAuth Dropbox
# Open http://localhost:5173 → Click "Login with Dropbox"
```

---

## 1️⃣ Pre-requisiti

### Software
- Node.js 18+ (`node --version`)
- pnpm 8+ (`pnpm --version`) — o npm 9+
- Git
- Cloudflare account (free tier OK)
- GitHub account

### Accounts (Free)
- [Dropbox](https://www.dropbox.com) — personal account
- [Google Cloud Console](https://console.cloud.google.com) — Gemini API key
- [FatSecret API](https://platform.fatsecret.com) — optional (MVP)

---

## 2️⃣ Dropbox Setup

### Create Dropbox Dev App

1. **Vai a:** https://www.dropbox.com/developers/apps
2. **Click:** "Create app"
3. **Seleziona:**
   - ✅ **Scoped access**
   - ✅ **Full Dropbox** (not "App folder"; later select "app folder")
4. **Configura:**
   - **App name:** `Recipe Book Dev`
   - **Access type:** `Full Dropbox` oppure `App folder` (?)
     > *Consiglio:* usa **App folder** (più isolato; tutti i file in `/Apps/Recipe Book/`)
5. **Permissions (tab Permissions):**
   - ✅ `files.content.read`
   - ✅ `files.content.write`
   - ✅ `files.metadata.read`
6. **Copy OAuth 2.0 credentials:**
   ```
   App key (client ID): xxxxx
   App secret (Client Secret): xxxxx
   ```
7. **Add Redirect URI (tab Settings):**
   ```
   http://localhost:5173/dropbox-callback
   ```
   (Per prod, aggiungerai anche: `https://recipe-book.pages.dev/dropbox-callback`)

### Save in `.dev.vars`

```bash
cat > worker/.dev.vars << 'EOF'
DROPBOX_APP_KEY=xxxxx (app key from step 6)
DROPBOX_APP_SECRET=xxxxx (app secret from step 6)
DROPBOX_REDIRECT_URI=http://localhost:5173/dropbox-callback
EOF
```

---

## 3️⃣ Gemini API Setup

### Create API Key

1. **Vai a:** https://console.cloud.google.com
2. **Crea nuovo progetto:** "Recipe Book"
3. **Enable API:**
   - Search "Generative Language API"
   - Click "Enable"
4. **Crea API key:**
   - Left sidebar → "Credentials"
   - "Create Credentials" → "API Key"
   - Copy key
5. **Setup usage quota** (gratuito, ma monitora):
   - Free tier: 1M token/mese (enough for MVP)

### Save in `.dev.vars`

```bash
cat >> worker/.dev.vars << 'EOF'
GEMINI_API_KEY=AIzaSyD... (da step 4)
EOF
```

---

## 4️⃣ GitHub Setup

### Create Repository

```bash
# Se non esiste:
git init
git remote add origin https://github.com/yourusername/recipe-book.git
git branch -M main
git add .
git commit -m "init: boilerplate setup"
git push -u origin main
```

### GitHub Secrets (per CI/CD future)

**Settings → Secrets and variables → Actions:**

- `CLOUDFLARE_API_TOKEN` (vedi Cloudflare account → API tokens)
- `CLOUDFLARE_ACCOUNT_ID` (tuo account ID)

---

## 5️⃣ Cloudflare Setup

### Create Worker + Pages Project

```bash
# Login
wrangler login

# Create Worker project
wrangler init recipe-book-worker
cd recipe-book
# (aggiorna wrangler.toml con:)
name = "recipe-book-worker"
account_id = "xxxx"  # get da https://dash.cloudflare.com
```

### Pages Project

1. **Vai a:** https://dash.cloudflare.com
2. **Pages** → "Create project" → "Connect to Git"
3. **Seleziona:** GitHub → `recipe-book` repo
4. **Build settings:**
   - Framework: "None"
   - Build command: `cd frontend && npm run build`
   - Build output directory: `frontend/dist`
5. **Environment variables (Production):**
   ```
   VITE_WORKER_URL=https://recipe-book-worker.{account}.workers.dev
   VITE_DROPBOX_APP_KEY=xxxxx
   VITE_DROPBOX_REDIRECT_URI=https://recipe-book.pages.dev/dropbox-callback
   VITE_APP_ENV=production
   ```

---

## 6️⃣ `.env` Files Setup

### Frontend (`.env.local`)

```bash
cat > frontend/.env.local << 'EOF'
VITE_WORKER_URL=http://localhost:8787
VITE_DROPBOX_APP_KEY=xxxxx (from Dropbox dev app)
VITE_DROPBOX_REDIRECT_URI=http://localhost:5173/dropbox-callback
VITE_APP_ENV=development
EOF
```

### Worker (`.dev.vars`)

```bash
cat > worker/.dev.vars << 'EOF'
DROPBOX_APP_KEY=xxxxx
DROPBOX_APP_SECRET=xxxxx
DROPBOX_REDIRECT_URI=http://localhost:5173/dropbox-callback
GEMINI_API_KEY=AIzaSyD...
JWT_SECRET=dev-secret-change-me-in-prod-12345678
FATSECRET_OAUTH_CONSUMER_KEY=optional-fatsecret-key
FATSECRET_OAUTH_CONSUMER_SECRET=optional-fatsecret-secret
EOF
```

### `.gitignore`

```bash
cat >> .gitignore << 'EOF'
# Env
.env.local
.env.production.local
worker/.dev.vars
worker/.wrangler/

# Dependencies
node_modules/
pnpm-lock.yaml
package-lock.json

# Build
dist/
.next/

# IDE
.vscode/
.cursor/
.idea/

# Logs
*.log
EOF
```

---

## 7️⃣ Local Dev Startup

### Terminal 1: Frontend

```bash
cd frontend
npm run dev
# Output: Local: http://localhost:5173/
```

### Terminal 2: Worker

```bash
cd worker
wrangler dev
# Output: Listening at http://localhost:8787
```

### Terminal 3: (optional) Watch files

```bash
# Se vuoi auto-rebuild su cambiamenti
npm run watch
```

---

## 8️⃣ First Test: OAuth Flow

1. **Apri:** http://localhost:5173
2. **Vedi:** "Login with Dropbox" button
3. **Click:** → redirect a Dropbox auth page
4. **Seleziona:** "Allow" per dare permessi
5. **Redirect back:** → http://localhost:5173/dropbox-callback?code=...
6. **App processa:** OAuth exchange → JWT + Dropbox token
7. **Success:** vedi Home page (empty dashboard)
8. **Check Dropbox:** vai su https://www.dropbox.com/home → `/Apps/Recipe Book/` folder creato ✅

**Se fallisce:**
- Check console (DevTools F12 → Console tab)
- Verifica `.env.local` + `.dev.vars` corretti
- Verifica Dropbox app redirect URI matches
- Clear localStorage + cookies → retry

---

## 9️⃣ Test Gemini Integration

**Aggiungi test endpoint temp in `worker/src/routes/health.js`:**

```javascript
app.post('/api/test/gemini', async (c) => {
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + c.env.GEMINI_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: 'Say "Recipe Book is working!"' }]
        }]
      })
    })
    const data = await response.json()
    return c.json({ success: true, response: data.candidates[0].content.parts[0].text })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})
```

**Test:**
```bash
curl -X POST http://localhost:8787/api/test/gemini
# Output: { "success": true, "response": "Recipe Book is working!" }
```

---

## 🔟 Dropbox API Test

**Verifica lettura/scrittura:**

```bash
curl -X GET https://api.dropboxapi.com/2/files/list_folder \
  -H "Authorization: Bearer $DROPBOX_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path": ""}'
```

Se ottieni lista file → ✅ auth funziona.

---

## ✅ Checklist completamento Setup

- [ ] Node.js 18+ installato
- [ ] pnpm installato
- [ ] Dropbox dev app creato + key/secret copiati
- [ ] Gemini API key creato
- [ ] GitHub repo creato
- [ ] Cloudflare account + Pages project setup
- [ ] `.env.local` compilato (frontend)
- [ ] `.dev.vars` compilato (worker)
- [ ] `frontend` runs su :5173 (no errors)
- [ ] `worker` runs su :8787 (no errors)
- [ ] OAuth Dropbox flow testato (login + callback OK)
- [ ] Dropbox folder `/Apps/Recipe Book/` creato
- [ ] Gemini test endpoint responds (curl OK)
- [ ] `.gitignore` setup (no .env committed!)

---

## 🚀 Ready to Code?

**Prossimo step:**

1. **Leggi:** `PROGRESS.md` (template completato)
2. **Leggi:** `RECIPE_BOOK_ARCHITECTURE.md` (design overview)
3. **Leggi:** `recipe-book-cursor-rules.mdc` (dev workflow)
4. **Apri IDE:** Cursor / Claude Code / Gemini Code
5. **Start Sessione 1:** "Setup boilerplate OAuth Dropbox"

---

## 🆘 Troubleshooting

### OAuth redirect loop (infinite)

**Causa:** `code_verifier` non salvato in localStorage tra pagine.

**Soluzione:**
```javascript
// auth.js
const codeVerifier = localStorage.getItem('pkce_verifier')
if (!codeVerifier) {
  // Generate new
  const generated = generateRandomString(128)
  localStorage.setItem('pkce_verifier', generated)
}
```

### Dropbox 401 Unauthorized

**Causa:** Token scaduto o sbagliato.

**Soluzione:**
- Clear localStorage + cookies
- Re-login
- Check `.dev.vars` DROPBOX_APP_SECRET matches

### Gemini 429 (quota exceeded)

**Causa:** API quota giornaliera superata.

**Soluzione:**
- Aspetta 24h
- Upgrade a paid tier (Google Cloud)
- Implementa fallback di IA (Groq future)

### CORS error on `localhost:5173 → localhost:8787`

**Causa:** Proxy non configurato in vite.config.js.

**Soluzione:**
```javascript
// vite.config.js
export default defineConfig({
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

### Workbox (offline) not working

**Causa:** Service worker non registrato.

**Soluzione:**
```javascript
// main.jsx
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
```

---

## 📚 Helpful Links

- [Dropbox OAuth Docs](https://developers.dropbox.com/oauth-guide)
- [Gemini API Docs](https://ai.google.dev)
- [Hono Docs](https://hono.dev)
- [React Docs](https://react.dev)
- [Tailwind Docs](https://tailwindcss.com/docs)
- [Zustand Docs](https://zustand-demo.vercel.app)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages](https://developers.cloudflare.com/pages/)

---

**Ready? 🎉 Go to PROGRESS.md and start Sessione 1!**
