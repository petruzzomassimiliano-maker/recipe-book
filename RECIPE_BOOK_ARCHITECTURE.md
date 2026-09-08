# 🍳 RECIPE BOOK PWA — Architectural Blueprint

> **Status:** ✅ Ready for Development (Gemini Code / Cursor / Claude Code)  
> **Ultimo aggiornamento:** 08/09/2026  
> **Documentazione:** Questo file + PROGRESS.md (sessione per sessione)

---

## 📋 Indice

| Sezione | Sottosezioni |
|---------|--------------|
| **1. Overview** | Visione, target users, key features |
| **2. Stack & Architettura** | Monorepo, frontend, backend, hosting |
| **3. Database Dropbox** | Struttura cartelle, schema JSON |
| **4. Autenticazione & Autorizzazione** | Multi-user, super-user, RBAC |
| **5. Integrazioni esterne** | Gemini, FatSecret, web scrapers, Instagram |
| **6. Feature list** | MVP + Future, con task breakdown |
| **7. Schema UI/UX** | Material Design 3, responsive, personalizzazione |
| **8. Workflow dev** | Deploy, PROGRESS.md, regole Cursor |

---

## 1. Overview

### Visione
**Recipe Book PWA** = app ricettario intelligente, multi-utente, con riconoscimento IA da web/video, stima calorie, shopping list, e personalizzazione.

### Target Users
- **Super-user** (tu): gestione account family, admin, ricette personali
- **Utenti secondary** (mamma, papà, sorella?): ricette personali, shopping list, lettura
- **Device**: tablet, smartphone, PC (responsive Material Design 3)

### Key Features (MVP)
1. ✅ **IA Recipe Recognition** — Gemini vision + web scraper da siti cucina, YouTube, possibilmente Instagram
2. ✅ **Calorie Tracking** — FatSecret API / static DB fallback
3. ✅ **Shopping List** — add da ricette o manuale
4. ✅ **Multi-user + RBAC** — super-user admin; secondary users con ricette personali
5. ✅ **Personalizzazione** — colore tema, font, logo app (settings → Dropbox)
6. ✅ **PWA** — offline-first, installabile, sync Dropbox

---

## 2. Stack & Architettura

### Monorepo Structure
```
recipe-book/
├── frontend/                    # Vite + React
│   ├── src/
│   │   ├── components/          # React components (Material Design 3 via shadcn/ui o MUI Joy)
│   │   ├── pages/               # Route pages
│   │   ├── hooks/               # Custom hooks (useRecipes, useShoppingList, useAuth, etc.)
│   │   ├── store/               # Zustand (recipes, users, preferences, auth)
│   │   ├── services/            # API calls, Dropbox, Gemini client logic
│   │   ├── utils/               # helpers, scrapers (web), formatters
│   │   ├── styles/              # Tailwind + CSS modules
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   │   ├── manifest.json        # PWA manifest
│   │   ├── icons/               # App icons, favicons
│   │   └── logo.svg             # Logo customizzabile
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── .env.example
│
├── worker/                      # Hono on Cloudflare Workers (backend API)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js          # OAuth Dropbox, token exchange
│   │   │   ├── recipes.js       # GET/POST/PUT/DELETE recipes
│   │   │   ├── users.js         # User management (super-user only)
│   │   │   ├── scraper.js       # Web scraper orchestration (recipes da URL)
│   │   │   ├── gemini.js        # Gemini API calls (recipe recognition, parsing)
│   │   │   ├── fatsecret.js     # FatSecret proxy (calorie DB)
│   │   │   ├── instagram.js     # Instagram scraper (optional; complex)
│   │   │   └── health.js        # Health check
│   │   ├── middleware/
│   │   │   ├── auth.js          # JWT + Dropbox token validation
│   │   │   ├── rbac.js          # RBAC middleware (superUser, ownRecipe, etc.)
│   │   │   └── errorHandler.js
│   │   ├── lib/
│   │   │   ├── dropboxClient.js # Dropbox SDK wrapper
│   │   │   ├── geminiClient.js  # Gemini API client (vision + text)
│   │   │   ├── fatsecretClient.js
│   │   │   ├── webScraper.js    # Pattern per parsing ricette (AllRecipes, Giallozafferano, etc.)
│   │   │   ├── youtubeParser.js # Estrazione info da video YouTube (description, comments)
│   │   │   └── instagramParser.js # (Futuristic; richiede browser automation)
│   │   ├── index.js             # Hono app setup
│   │   └── env.d.ts
│   ├── wrangler.toml
│   ├── .dev.vars.example
│   └── package.json
│
├── .cursor/
│   ├── rules/
│   │   ├── deploy-github-cloudflare.mdc  # (riutilizzare da EN Writing Coach)
│   │   └── recipe-book-dev.mdc            # Nuova regola per ricettario
│   └── project-context.md
│
├── .github/
│   └── workflows/
│       └── deploy.yml           # GitHub Actions per auto-deploy
│
├── .gitignore
├── PROGRESS.md                  # (Session-by-session; vedi template sotto)
├── README.md
└── package.json                 # Monorepo root (pnpm workspaces)
```

### Tech Stack

| Layer | Tech | Motivazione |
|-------|------|-------------|
| **Frontend** | Vite + React 18 | Fast, già familiare da EN Writing Coach |
| **UI Framework** | shadcn/ui + Tailwind / MUI Joy UI | Material Design 3, responsive, dark mode |
| **State** | Zustand | Persist a localStorage/Dropbox |
| **HTTP** | TanStack Query (React Query) | Sync, caching, retry |
| **Storage** | Dropbox API (frontend + Worker) | OAuth PKCE, app folder, no backend DB |
| **Backend** | Hono on Cloudflare Workers | Serverless, global, gratuito (sotto limiti) |
| **AI** | Gemini 2.0 (vision + text) | Recipe recognition, parsing, description gen |
| **Calorie DB** | FatSecret API / static DB fallback | Nutrient data, stima calorie |
| **PWA** | Workbox (service worker) | Offline-first, pre-caching |
| **Deploy** | Cloudflare Pages (frontend) + Workers (backend) | Git push → auto deploy; zero-config |
| **VCS** | GitHub | Monorepo, branch protection, CI/CD |

### Deployment

**Dev:**
```bash
pnpm install
cd frontend && npm run dev  # Vite dev server :5173
cd ../worker && wrangler dev  # Worker local :8787
```

**Prod:**
```bash
git push origin main
  ↓
GitHub Actions → wrangler deploy (Worker)
              → npm run build + wrangler pages deploy (Frontend)
  ↓
Worker: https://recipe-book-worker.{account}.workers.dev
Pages:  https://recipe-book.pages.dev
```

---

## 3. Database Dropbox

### Struttura Cartelle (app folder)

```
/Apps/Recipe Book/                     # Dropbox app folder root
│
├── users/                             # Multi-user config
│   ├── users.json                     # [{id, email, role, createdAt, lastSync}]
│   ├── user-{userId}/
│   │   ├── profile.json               # {name, avatar, preferences, stats}
│   │   ├── settings.json              # {theme, font, language, notifications}
│   │   └── recipes-index.json         # Metadata per sync veloce
│   │
│   └── user-super/                    # Super-user (tu)
│       └── (same structure + admin perms)
│
├── recipes/                           # Ricette globali (shared + personal)
│   ├── recipes-index.json             # [{id, title, author, tags, isShared}] — fast lookup
│   │
│   ├── recipe-{recipeId}.json         # Ricetta singola (schema sotto)
│   ├── recipe-{recipeId}/
│   │   ├── image.jpg                  # Immagine principale
│   │   └── metadata.json              # {nutritionSource, parsedFrom, scrapedUrl, createdAt}
│   │
│   └── (ripetuto per ogni ricetta)
│
├── shopping-lists/                    # Shopping lists per utente
│   ├── shopping-list-{userId}.json    # [{ingredient, qty, unit, checked, recipeId}]
│   └── shopping-list-history.json     # Archivio liste passate
│
├── nutrition-cache/                   # Cache nutrienti da FatSecret (evita API spam)
│   ├── ingredient-{hash}.json         # {name, calories, protein, fat, carbs, source}
│   └── (LRU eviction su vecchi file)
│
└── app-settings.json                  # Global app config (personalizzazione)
    # {version, appLogo, supportedFonts, themes, defaultLanguage}
```

### Schema JSON — Ricetta

```json
{
  "id": "recipe-uuid-v4",
  "title": "Pasta alla Carbonara",
  "author": "user-{userId}",
  "createdAt": "2026-09-08T10:30:00Z",
  "updatedAt": "2026-09-08T10:30:00Z",
  
  "ingredients": [
    {
      "id": "ing-1",
      "name": "Spaghetti",
      "quantity": 400,
      "unit": "g",
      "notes": "o guanciale tagliato a dadini",
      "nutritionId": "ingredient-hash-xyz"  // link a nutrition cache
    },
    {
      "id": "ing-2",
      "name": "Tuorli d'uovo",
      "quantity": 4,
      "unit": "pezzi",
      "nutritionId": "ingredient-hash-abc"
    }
  ],
  
  "steps": [
    {
      "id": "step-1",
      "order": 1,
      "instruction": "Cuocere la pasta in acqua salata"
    },
    {
      "id": "step-2",
      "order": 2,
      "instruction": "Nel frattempo, rosolare il guanciale"
    }
  ],
  
  "nutritionInfo": {
    "servings": 4,
    "perServing": {
      "calories": 580,
      "protein": 25,  // g
      "fat": 32,
      "carbs": 48,
      "fiber": 2
    },
    "source": "fatsecret",  // o "manual", "estimated_gemini"
    "lastCalculated": "2026-09-08T10:30:00Z"
  },
  
  "metadata": {
    "tags": ["pasta", "italiana", "veloce", "dinner"],
    "servings": 4,
    "prepTime": 10,    // minuti
    "cookTime": 20,
    "difficulty": "easy",  // easy, medium, hard
    "cuisine": "italian",
    "isShared": false,  // true = visibile a altri family members
    "isPublic": false   // true = condividibile via link
  },
  
  "imageUrl": "/Apps/Recipe Book/recipes/recipe-{id}/image.jpg",
  "sourceUrl": "https://www.ricette.it/ricetta/carbonara",  // da scraper
  "sourceProvider": "website",  // "website", "youtube", "instagram", "manual"
  
  "notes": "Ricetta tramandata da nonna. Usare solo guanciale!"
}
```

### Schema JSON — User

```json
{
  "id": "user-{uuid}",
  "email": "mamma@family.it",
  "role": "user",  // "superUser" | "user"
  "name": "Mamma",
  "createdAt": "2026-09-08T10:00:00Z",
  "lastSync": "2026-09-08T14:30:00Z",
  
  "permissions": {
    "canCreateRecipes": true,
    "canDeleteOwnRecipes": true,
    "canDeleteOtherRecipes": false,  // true solo per superUser
    "canInviteUsers": false,         // true solo per superUser
    "canViewSharedRecipes": true
  },
  
  "preferences": {
    "theme": "auto",     // "light" | "dark" | "auto"
    "font": "inter",     // "inter" | "lora" | "opensans"
    "language": "it",
    "appLogo": "default", // custom logo per utente? Or global
    "colorAccent": "#FF6B6B"  // personalizzazione colore
  }
}
```

### Schema JSON — Shopping List

```json
{
  "id": "shopping-list-{userId}",
  "userId": "user-{uuid}",
  "createdAt": "2026-09-08T10:00:00Z",
  "updatedAt": "2026-09-08T14:30:00Z",
  
  "items": [
    {
      "id": "item-1",
      "ingredient": "Uova",
      "quantity": 6,
      "unit": "pezzi",
      "checked": false,
      "recipeIds": ["recipe-carbonara", "recipe-omelette"],  // legame ricette
      "notes": "biologiche se possibile"
    },
    {
      "id": "item-2",
      "ingredient": "Spaghetti",
      "quantity": 800,
      "unit": "g",
      "checked": true,
      "recipeIds": ["recipe-carbonara"],
      "notes": ""
    }
  ]
}
```

---

## 4. Autenticazione & Autorizzazione

### OAuth Flow (Dropbox)

**Identico a EN Writing Coach:**

1. **Frontend**: user clicca "Login with Dropbox"
2. **PKCE**: genera `code_verifier` + `code_challenge`
3. **Redirect** → Dropbox auth page (scope: files.content.read/write)
4. **Callback**: Dropbox → `https://recipe-book.pages.dev/dropbox-callback?code=...`
5. **Exchange**: frontend invia `code` + `code_verifier` + `client_id` al **Worker**
6. **Worker** (`/api/auth/exchange`):
   - Verifica con Dropbox usando `DROPBOX_APP_SECRET` (backend-only)
   - Genera **JWT** (HS256, 30 giorni) con `{ userId, email, role }`
   - Ritorna JWT + Dropbox token
7. **Frontend**: salva JWT + Dropbox token in Zustand + localStorage
8. **Subsequent requests**: aggiungi JWT in header `Authorization: Bearer {jwt}`

### Multi-user + RBAC

**Ruoli:**
- **`superUser`** — tu; gestione utenti, ricette globali, settings app
- **`user`** — mamma/papà/sorella; ricette personali + accesso ricette shared

**Middleware Worker** (`rbac.js`):
```
GET /api/recipes/:id
  → verifica che (user.role === "superUser" OR recipe.author === user.id OR recipe.isShared)

DELETE /api/users/:userId
  → solo superUser

POST /api/recipes
  → qualsiasi user loggato (author = user.id)

PUT /api/recipes/:id
  → superUser OR recipe.author === user.id
```

### Initial Setup

1. **Super-user invita family**:
   - Crea entry in `users.json` con email + role (pending)
   - Invia link con `inviteCode` via email/WhatsApp (manual per MVP)

2. **Family member accede**:
   - Click link → app richiede Dropbox login
   - App crea nuovo `user-{uuid}` con role=`user`
   - Sync avviene automaticamente

---

## 5. Integrazioni esterne

### 5.1 Gemini API (recipe recognition)

**Endpoint Worker:** `POST /api/gemini/recognize-recipe`

**Payload:**
```json
{
  "imageBase64": "...",  // opzionale; recipe foto
  "url": "https://www.allrecipes.com/recipe/...",  // opzionale; recipe URL
  "videoUrl": "https://www.youtube.com/watch?v=...",  // opzionale
  "manualText": "..."    // opzionale; testo manuale da utente
}
```

**Worker Logic:**
1. Se `imageBase64` → Gemini Vision per riconoscere ricetta
2. Se `url` → web scraper + Gemini per parsing (ingredienti, step)
3. Se `videoUrl` → estrai transcript (YouTube Transcript API) + Gemini parsing
4. Se `manualText` → Gemini parsing diretto

**Gemini Prompts:**
```
"Analizza questa foto di ricetta e estrai: ingredienti (nome, qty, unit), step di preparazione, tempo cottura, numero porzioni."

"Dato questo HTML di ricetta, estrai struttura JSON: ingredienti, step, tempo, difficoltà."

"Dato il transcript di un video ricetta, ricostruisci ingredienti e step."
```

**Output:** structured JSON matching `recipe-{recipeId}.json` schema

---

### 5.2 FatSecret API (calorie)

**Endpoint Worker:** `POST /api/fatsecret/search-nutrition`

**Payload:**
```json
{
  "ingredient": "Spaghetti",
  "quantity": 100,
  "unit": "g"
}
```

**Response:**
```json
{
  "ingredient": "Spaghetti",
  "calories": 131,
  "protein": 5,
  "fat": 1.1,
  "carbs": 25,
  "fiber": 1.8,
  "source": "fatsecret"
}
```

**Fallback:** static DB di ingredienti comuni (pasta, olio, sale, etc.)

**Caching:** salva in `nutrition-cache/ingredient-{hash}.json` su Dropbox (LRU eviction)

---

### 5.3 Web Scraper (recipe websites)

**Supported sites (MVP):**
- AllRecipes.com
- Giallozafferano.it
- BBC Good Food
- Jamie Oliver
- Cookaround.com

**Worker Endpoint:** `POST /api/scraper/fetch-recipe`

**Payload:**
```json
{
  "url": "https://www.allrecipes.com/recipe/12345/",
  "parseFormat": "auto"  // auto-detect o manual
}
```

**Worker Logic:**
1. Fetch HTML (con User-Agent)
2. Detect sito (regex URL)
3. CSS selector parsing (hard-code per sito, o schema.org `Recipe` microdata)
4. Extract: title, ingredients, steps, image, time, yield
5. **POST** result al Gemini per validazione/cleanup
6. Return structured JSON

**Fallback:** se scraping fallisce, chiedi utente di aggiungere manualmente o incolla testo ricetta

---

### 5.4 YouTube Parser (video ricette)

**Worker Endpoint:** `POST /api/youtube/parse-recipe`

**Payload:**
```json
{
  "videoUrl": "https://www.youtube.com/watch?v=xyz",
  "manualTranscript": null  // optional; user può fornire transcript
}
```

**Worker Logic:**
1. Extract video ID
2. Fetch transcript (YouTube Transcript API, no auth needed da server)
3. **POST** transcript al Gemini: "Extract recipe from video transcript"
4. Gemini parse ingredienti + step
5. Fetch video thumbnail come image fallback
6. Return structured JSON

**Library:** `youtube-transcript` (npm)

---

### 5.5 Instagram Parser (future; complex)

**Status:** ⏳ Future (richiede browser automation)

**Challenge:**
- Instagram protegge i dati dietro login + CORS
- Possibilità: Selenium/Puppeteer (server-side) + scraping reel description/comments
- Gemini Vision su screenshot dell'ingrediente da screen record

**MVP Workaround:** copia-incolla URL → app chiede trascrizione manuale o foto

---

## 6. Feature List

### MVP (v1.0 — primi 2 mesi dev)

| # | Feature | Component | Priority | Story points |
|---|---------|-----------|----------|--------------|
| **Auth & Setup** | | | | |
| 1 | OAuth Dropbox (PKCE) | Worker auth.js + Frontend Login | 🔴 | 8 |
| 2 | Multi-user invite (super-user only) | Settings/Admin panel | 🔴 | 5 |
| 3 | RBAC middleware (Worker) | rbac.js | 🔴 | 5 |
| **Recipe Management** | | | | |
| 4 | Add recipe manually | RecipeForm.jsx | 🟠 | 8 |
| 5 | Scrape recipe da URL (AllRecipes, Giallo) | Worker scraper.js + Gemini | 🔴 | 13 |
| 6 | Scrape recipe da YouTube video | Worker youtube.js | 🟠 | 8 |
| 7 | Upload foto ricetta → Gemini Vision recognition | RecipeUpload.jsx + Worker gemini.js | 🟠 | 8 |
| 8 | Edit/Delete own recipes | RecipeDetail.jsx | 🟠 | 5 |
| 9 | Search recipes (by title, tags) | RecipeList.jsx + Zustand filter | 🟠 | 3 |
| 10 | Share recipes tra family members | RecipeDetail.jsx + isShared toggle | 🟠 | 3 |
| **Calorie Tracking** | | | | |
| 11 | Auto-calc calorie per ricetta (FatSecret) | Worker fatsecret.js | 🟠 | 8 |
| 12 | Display nutrition info | RecipeDetail.jsx | 🟠 | 3 |
| 13 | Manual override calorie | RecipeDetail.jsx | 🟠 | 2 |
| **Shopping List** | | | | |
| 14 | Add item da ingredienti ricetta | ShoppingListModal.jsx | 🟠 | 5 |
| 15 | Add item manuale | ShoppingListForm.jsx | 🟠 | 3 |
| 16 | Check/uncheck item | ShoppingList.jsx | 🟠 | 2 |
| 17 | Clear/save lista | ShoppingList.jsx + Dropbox sync | 🟠 | 3 |
| **Personalizzazione** | | | | |
| 18 | Theme (light/dark/auto) | Tailwind + Zustand | 🟡 | 3 |
| 19 | Font selection (Inter, Lora, OpenSans) | settings.json + CSS var | 🟡 | 3 |
| 20 | Color accent picker | Settings.jsx | 🟡 | 3 |
| 21 | Custom app logo upload (per family?) | Settings.jsx + Dropbox | 🟡 | 5 |
| **PWA & Offline** | | | | |
| 22 | Service Worker + Workbox | vite-plugin-pwa | 🟠 | 5 |
| 23 | Offline sync (debounce + queue) | Zustand + SW | 🟠 | 8 |
| **Admin & Analytics** | | | | |
| 24 | Super-user dashboard (user management) | AdminDashboard.jsx | 🟠 | 8 |
| 25 | Recipe creation analytics | Dashboard.jsx | 🟡 | 5 |

### Future (v1.1+)

- [ ] Instagram Reels scraper (complex; browser automation)
- [ ] Meal planning (weekly meal schedule)
- [ ] Barcode scan → auto ingredient recognition
- [ ] Recipe ratings + comments (family feedback)
- [ ] Print recipe (PDF export)
- [ ] Recipe export/import (JSON, PDF)
- [ ] Integration Notion/OneNote (backup)
- [ ] Allergen tags (gluten-free, vegan, etc.)
- [ ] Multi-language recipe (EN + IT)
- [ ] Social sharing (share link public recipe)

---

## 7. Schema UI/UX — Material Design 3

### Layout Responsive

**Mobile (< 640px):**
- Bottom tab bar: Home | Recipes | Lists | Settings
- Recipes: vertical stack (card), tap = detail sheet
- Settings: stacked, full-width inputs

**Tablet (640–1024px):**
- Left sidebar collapsible + main content
- 2-col grid recipes (card layout)
- Side panel per recipe detail

**Desktop (> 1024px):**
- 3-col: sidebar + recipes grid (2–3 col) + detail panel

### Color Palette (Material Design 3)

**Light:**
- Primary: #FF6B6B (vibrant coral/red; food-themed)
- Secondary: #4ECDC4 (teal)
- Tertiary: #FFD93D (yellow)
- Surface: #FAFAFA
- On-surface: #1C1C1C

**Dark:**
- Primary: #FF8A80
- Secondary: #4ECDC4
- Tertiary: #FFD93D
- Surface: #121212
- On-surface: #E8E8E8

### Key Screens

1. **Login** — OAuth Dropbox button + welcome message
2. **Home/Dashboard** — recent recipes, quick actions, family feed
3. **Recipes** — grid/list, search, filter by tag/cuisine
4. **Recipe Detail** — full photo, ingredients, steps, nutrition, share button
5. **Add Recipe** — 3-step form (manual) / URL input (scraper)
6. **Shopping List** — checkbox items, add from recipe, notes
7. **Settings** — theme, font, color, language, user management (superUser)
8. **Admin Panel** (superUser only) — manage users, app settings

### Components Library (shadcn/ui + Tailwind)

```
Button, Card, Input, Dialog, Tabs, Badge, Avatar, Menu, Checkbox, 
TextField, Select, Textarea, Toast, Sheet (bottom sheet mobile),
DropdownMenu, Pagination, Skeleton (loading states)
```

---

## 8. Workflow Dev

### Regole Cursor/Claude Code

**File:** `.cursor/rules/recipe-book-dev.mdc`

```markdown
# Recipe Book Dev Rules

## Golden Rules
1. **Update PROGRESS.md** at end of every session (feature, bug fix, deployment)
2. **Commit + push + deploy** = unit of work (not "just commit")
3. **No breaking changes** to Dropbox schema without migration plan
4. **Test OAuth flow** locally (dev Dropbox app credentials) before prod
5. **Rate limit awareness:** Gemini 1M token/month free; FatSecret ~100 req/month free

## File Structure Conventions
- Worker routes in `/worker/src/routes/*.js` (1 file per domain)
- Frontend hooks in `/frontend/src/hooks/use*.js`
- Components in `/frontend/src/components/{feature}/{ComponentName}.jsx`
- Zustand store in `/frontend/src/store/{domain}Store.js`
- Utility scrapers in `/worker/src/lib/scrapers/*.js`

## Deployment Checklist
- [ ] PROGRESS.md updated with feature + test notes
- [ ] `git add -A && git commit -m "feat: description"`
- [ ] `git push origin main`
- [ ] Wait for GitHub Actions CI
- [ ] Verify `wrangler deploy` (Worker) completed
- [ ] Verify `wrangler pages deploy` (Frontend) completed
- [ ] Test prod: login, add recipe, sync Dropbox
- [ ] Update PROGRESS.md: "✅ Prod verified"
```

### PROGRESS.md Template

(Vedi sezione sotto)

### Dev Workflow

1. **Session Start:**
   - Leggi PROGRESS.md (versione produzione)
   - Check GitHub issues / feature board
   - Pull latest `main` branch

2. **Session Work:**
   - Branch feature: `git checkout -b feat/recipe-scraper`
   - Develop feature (commit ogni 2-3 piccoli tasks)
   - Test locale (dev credentials)

3. **Session End:**
   - Update PROGRESS.md con feature summary
   - Commit feature branch
   - Create PR (se team review) o merge to `main`
   - `git push origin main`
   - Deploy: `wrangler deploy` + `wrangler pages deploy`
   - Test produzione (real Dropbox account)
   - Update PROGRESS.md: "✅ Prod" + timestamp

### Environment Variables

**Frontend (`.env`):**
```
VITE_WORKER_URL=https://recipe-book-worker.{account}.workers.dev
VITE_DROPBOX_APP_KEY=xxxxx
VITE_DROPBOX_REDIRECT_URI=https://recipe-book.pages.dev/dropbox-callback
VITE_APP_ENV=production  # or "development"
```

**Worker (`.dev.vars`):**
```
DROPBOX_APP_SECRET=xxxxx
DROPBOX_APP_KEY=xxxxx
GEMINI_API_KEY=xxxxx
FATSECRET_OAUTH_CONSUMER_KEY=xxxxx
FATSECRET_OAUTH_CONSUMER_SECRET=xxxxx
```

---

## Prossimi Passi (Ready for Dev)

- [ ] Setup monorepo `recipe-book/` con Vite + Hono boilerplate
- [ ] Configura Cloudflare Workers + Pages
- [ ] Implementa OAuth Dropbox flow (copia da EN Writing Coach, adatta)
- [ ] Dropbox schema + Zustand store setup
- [ ] Basic recipe CRUD (add manual, edit, delete)
- [ ] Gemini integration (vision + text parsing)
- [ ] Web scraper (start con AllRecipes)
- [ ] FatSecret API integration
- [ ] Shopping list feature
- [ ] UI components + responsive layout (Material Design 3)
- [ ] PWA setup + offline sync
- [ ] Deploy alpha → prod
- [ ] Invite mamma/papà/sorella per beta test

---

## Appendix: Riutilizzo EN Writing Coach

**Copiacolla direttamente da en-writing-coach repo:**

- `worker/src/lib/dropboxClient.js` — OAuth token exchange, file operations
- `frontend/src/store/auth.js` — JWT + Dropbox token storage (Zustand)
- `frontend/src/hooks/useAuth.js` — login/logout logic
- `frontend/src/services/dropbox.js` — client-side Dropbox API calls
- `.cursor/rules/deploy-github-cloudflare.mdc` — deploy workflow
- `frontend/vite.config.js` — base Vite config
- `worker/wrangler.toml` — base Worker config

**Adatta (non copiacolla):**
- Prompt Gemini (non più Writing Analysis, ma recipe parsing)
- Dropbox folder structure (non `/sessions`, ma `/recipes`)
- RBAC logic (più semplice: solo superUser vs user)
- UI theme (Material Design 3 colors, non EN coach style)

---

**Fine Architettura. Prossimo step: PROGRESS.md per sessioni dev.**
