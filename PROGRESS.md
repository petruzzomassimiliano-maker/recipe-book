# PROGRESS.md — Recipe Book PWA

> **Aggiorna questo file alla fine di ogni sessione dev**
> **All'inizio della sessione successiva, leggi QUESTO file prima di qualsiasi altra cosa**

---

## Indice moduli

| Modulo | Sezione principale | Stato |
|--------|-------------------|-------|
| **OAuth Dropbox PKCE** | «Sessione init» | ✅ Localhost verified |
| **Dropbox schema + Zustand** | «Sessione init» | ✅ Localhost verified |
| **Recipe CRUD (manual add)** | «Sessione 2» | ✅ Localhost verified |
| **Web Scraper (AllRecipes)** | «Sessione 3» + «9» + «11» + «12» | ✅ Dosi generali + resa g/ml ≠ porzioni |
| **Gemini recipe recognition** | «Sessione 3+» | ✅ Cascata in scraper |
| **FatSecret integration** | — | ❌ Rimosso · DB locale + override utente |
| **YouTube transcript parser** | «Sessione 5» | ✅ Localhost ready |
| **Shopping list feature** | «Sessione 3» + «12» | ✅ UX mobile checklist |
| **Material Design 3 UI** | «Sessione X» | ⏳ Pending (mobile HIG/Material touch già applicati) |
| **Multi-user + RBAC** | «Sessione 7» + «10» | ✅ Ownership per utente + assign staff + reset/recovery |
| **PWA + offline sync** | «Sessione 6» + «8» | ✅ Build + SW verificati (`dist/sw.js`) |
| **Foto → Gemini Vision** | «Sessione 8» | ✅ Import da foto |
| **Foto ricetta (upload)** | «Sessione 12» | ✅ Scatta / carica / URL → Dropbox `/recipes/images` |
| **Split view desktop** | «Sessione 13» | ✅ Due ricette affiancate (`?split=`) ≥1024px |
| **Form ricetta desktop** | «Sessione 13» | ✅ Layout largo, sticky Salva, foto + meta, ingredienti/passi a 2 col |
| **Invite link monouso** | «Sessione 8» + «10» | ✅ Copia messaggio (niente email/Resend) |
| **Deploy prod** | «Sessione 10» + «12» + «13» | ✅ Cloudflare + repo GitHub |

---

## Sessione init — 2026-09-08 — Setup Boilerplate + OAuth Dropbox

### Segnalazione
Monorepo non esiste; partire da zero. Implementare struttura completa + OAuth PKCE Dropbox.

### File modificati

| File | Azione |
|------|--------|
| package.json (root) | **Nuovo** |
| .gitignore | **Nuovo** |
| worker/package.json | **Nuovo** |
| worker/wrangler.toml | **Nuovo** |
| worker/src/index.js | **Nuovo** |
| worker/src/routes/auth.js | **Nuovo** |
| worker/src/routes/health.js | **Nuovo** |
| worker/src/middleware/auth.js | **Nuovo** |
| worker/src/middleware/errorHandler.js | **Nuovo** |
| worker/src/lib/dropboxClient.js | **Nuovo** |
| worker/.dev.vars.example | **Nuovo** |
| frontend/package.json | **Nuovo** |
| frontend/vite.config.js | **Nuovo** |
| frontend/index.html | **Nuovo** |
| frontend/src/main.jsx | **Nuovo** |
| frontend/src/App.jsx | **Nuovo** |
| frontend/src/services/auth.js | **Nuovo** |
| frontend/src/utils/pkce.js | **Nuovo** |
| frontend/src/store/authStore.js | **Nuovo** |
| frontend/src/hooks/useAuth.js | **Nuovo** |
| frontend/src/pages/Login.jsx | **Nuovo** |
| frontend/src/pages/Home.jsx | **Nuovo** poi **Modificato** (usa Navbar) |
| frontend/src/pages/DropboxCallback.jsx | **Nuovo** |
| frontend/src/pages/NotFound.jsx | **Nuovo** |
| frontend/src/components/common/Navbar.jsx | **Nuovo** (estratto da Home) |
| CODE_MANIFEST.json | **Modificato** (RTF → JSON valido) |
| frontend/src/styles/index.css | **Nuovo** |
| frontend/.env.example | **Nuovo** |
| frontend/public/manifest.json | **Nuovo** |

**Deploy:** ✅ Localhost verified (2026-09-08)

### Test locale (2026-09-08)

| Check | Esito |
|-------|-------|
| `npm install` (workspace root) | ✅ 248 packages |
| Vite `http://localhost:5173` | ✅ Login page render |
| Wrangler `http://localhost:8787` | ✅ Ready |
| `GET /api/health` (worker + Vite proxy) | ✅ `{ status: "ok" }` |
| `GET /api/auth/authorize` PKCE URL | ✅ Dropbox authorize URL (S256, offline, scopes) |
| Login → redirect Dropbox | ✅ PKCE + Worker authorize + browser redirect |
| AuthGuard `/` senza JWT | ✅ Redirect `/login` |
| `/dropbox-callback` senza `code` | ✅ Redirect `/login?error=missing_code` |
| `POST /api/auth/exchange` (code fake) | ✅ 400 `Token exchange failed` |
| Login Dropbox reale (Chrome → Home) | ✅ `POST /api/auth/exchange` 200 |
| Cartella `/Apps/Recipe Book/` | ✅ Creata al re-login dopo permessi file |

**Blocco attuale:** nessuno sul flusso OAuth locale. Folder init ok dopo `files.content.read/write` + `files.metadata.read/write`.

---

## Sessione 2 — 2026-09-08 — Recipe CRUD (manual add)

### Segnalazione
OAuth e cartelle Dropbox ok; serviva CRUD ricette (add/edit/delete/list) su schema JSON Dropbox.

### Soluzione
Worker `GET/POST/PUT/DELETE /api/recipes` con JWT + header `X-Dropbox-Token`. Persistenza in `/recipes/recipe-{id}.json` + indice `/recipes/recipes-index.json`. Frontend: form manuale, lista, dettaglio, ricerca.

#### File modificati

| File | Azione |
|------|--------|
| `worker/src/routes/recipes.js` | **Nuovo** |
| `worker/src/lib/rbac.js` | **Nuovo** |
| `worker/src/middleware/auth.js` | **Modificato** (richiede `X-Dropbox-Token`) |
| `worker/src/index.js` | **Modificato** (mount recipes + CORS header) |
| `worker/src/lib/dropboxClient.js` | **Modificato** (upload mode `.tag`) |
| `frontend/src/services/api.js` | **Nuovo** |
| `frontend/src/services/recipes.js` | **Nuovo** |
| `frontend/src/store/recipeStore.js` | **Nuovo** |
| `frontend/src/hooks/useRecipes.js` | **Nuovo** |
| `frontend/src/components/recipe/RecipeForm.jsx` | **Nuovo** |
| `frontend/src/components/recipe/RecipeList.jsx` | **Nuovo** |
| `frontend/src/pages/Recipes.jsx` | **Nuovo** |
| `frontend/src/pages/AddRecipe.jsx` | **Nuovo** |
| `frontend/src/pages/RecipeDetail.jsx` | **Nuovo** |
| `frontend/src/pages/Home.jsx` | **Modificato** (lista + add manuale) |
| `frontend/src/App.jsx` | **Modificato** (route ricette) |
| `frontend/src/components/auth/AuthGuard.jsx` | **Modificato** (layout + Outlet) |
| `frontend/src/components/common/Navbar.jsx` | **Modificato** (link Home/Ricette) |
| `frontend/src/styles/index.css` | **Modificato** (`text-on-surface` → `text-gray-900`) |

**Deploy:** ✅ Localhost verified (CRUD + token refresh)

### Test locale

| Check | Esito |
|-------|-------|
| `GET /api/recipes` senza JWT | ✅ 401 |
| `GET /api/recipes` loggato (Chrome) | ✅ 200 |
| Add recipe UI → Dropbox | ✅ `POST /api/recipes` 201 |
| Token refresh automatico | ✅ `POST /api/auth/refresh` 200 |
| Flash ricetta precedente | ✅ Fixato (clear selectedRecipe) |

---

## Sessione 3 — 2026-09-09 — Web Scraper + Shopping List

### Segnalazione
Dopo CRUD manuale: import da URL e lista spesa.

### Soluzione
- Scraper Worker: fetch HTML → JSON-LD Recipe (schema.org) + fallback euristico (AllRecipes / Giallozafferano / BBC-like)
- UI `/recipes/import`: estrai → form precompilato → salva
- Shopping list Dropbox `/shopping-lists/shopping-list-{userId}.json` + UI `/shopping-list` + “+ Lista spesa” da dettaglio ricetta

#### File modificati

| File | Azione |
|------|--------|
| `worker/src/lib/scrapers/_base.js` | **Nuovo** |
| `worker/src/lib/scrapers/jsonld.js` | **Nuovo** |
| `worker/src/lib/scrapers/heuristic.js` | **Nuovo** |
| `worker/src/lib/scrapers/index.js` | **Nuovo** |
| `worker/src/routes/scrapers.js` | **Nuovo** |
| `worker/src/routes/shopping.js` | **Nuovo** |
| `worker/src/index.js` | **Modificato** |
| `frontend/src/pages/ImportRecipe.jsx` | **Nuovo** |
| `frontend/src/pages/ShoppingList.jsx` | **Nuovo** |
| `frontend/src/services/scraper.js` | **Nuovo** |
| `frontend/src/services/shoppingList.js` | **Nuovo** |
| `frontend/src/store/shoppingListStore.js` | **Nuovo** |
| `frontend/src/hooks/useShoppingList.js` | **Nuovo** |
| `frontend/src/App.jsx` / `Navbar` / `Home` / `Recipes` / `RecipeDetail` | **Modificato** |

**Deploy:** ⏳ Localhost ready — da testare in Chrome

---

## Prossimi Passi

- [x] CRUD ricette + Dropbox sync
- [x] Import URL (scraper) + lista spesa
- [ ] In Chrome: importa un URL AllRecipes/Giallozafferano e verifica salvataggio
- [ ] In Chrome: aggiungi ingredienti alla lista spesa
- [x] Cascata scraper auto: HTML → Gemini testo → screenshot+Vision (quality gate)
- [x] Calorie: DB locale IT + override utente (per 100 g su Dropbox) + totale manuale — **no FatSecret**
- [x] YouTube transcript parser (captions + Gemini, fallback trascrizione manuale)
- [x] PWA offline: service worker, cache ricette/lista, banner offline, install prompt
- [x] Deploy Cloudflare Worker + Pages (`recipe-book-ap1.pages.dev`)
- [ ] Push GitHub (login non completato)
- [ ] Owner: impostare frase di recupero in Impostazioni
- [ ] Material Design 3 UI

---

## Sessione 7 — 2026-09-09 — Multi-account famiglia (RBAC)

### Segnalazione
Un Dropbox famiglia + login user/password; ruoli owner/admin/member; inviti.  
Il vecchio modello (OAuth Dropbox **per utente** + header `X-Dropbox-Token` dal browser) non va bene per una famiglia: gli invitati non devono collegare Dropbox.

### Architettura (verificata)

```
Browser: login user/pw → JWT { userId, role }
Worker:  JWT + FAMILY_DROPBOX_REFRESH_TOKEN → legge/scrive Dropbox App folder
Dropbox: /users/users.json, /users/family-settings.json, /recipes/...
```

Stesso Dropbox già usato in sessione init (cartella App → Recipe Book): le ricette esistenti restano.

### Soluzione implementata

| Pezzo | Dettaglio |
|-------|-----------|
| Auth | `POST /api/auth/login`, `change-password`, setup Dropbox + owner |
| Dropbox | Solo server (`familyDropbox.js`); niente token Dropbox nel JWT/browser |
| Ruoli | `owner` / `admin` / `member` in `rbac.js` |
| Ricette | Ogni utente vede **solo le sue**; owner/admin vedono e modificano **tutte** (sezioni per utente); orfane → owner |
| Inviti | Link monouso 7g + copia messaggio (WhatsApp/SMS); niente email automatica |
| Settings | Nome famiglia + etichetta personale + gestione utenti |
| UX setup | `/setup`, import refresh token, script `scripts/set-family-dropbox-token.mjs` |

### Bootstrap locale (fatto)

1. `/setup` → OAuth Dropbox (stessa app) **oppure** incolla refresh token  
2. Copia in `worker/.dev.vars`:
   ```bash
   FAMILY_DROPBOX_REFRESH_TOKEN=sl.......
   ```
   oppure: `node scripts/set-family-dropbox-token.mjs 'FAMILY_DROPBOX_REFRESH_TOKEN=…'`
3. **Riavvia il worker** (wrangler rilegge `.dev.vars`)
4. `/setup/owner` → crea username/password owner  
5. Login quotidiano su `/login` → Impostazioni per invitare

**Stato runtime (2026-09-09):**  
`GET /api/auth/status` → `dropboxConfigured: true`, `hasUsers: true`, `familyAppName: "Ricettario"`, `needsSetup: false`.

### File principali

| File | Azione |
|------|--------|
| `worker/src/lib/password.js` | **Nuovo** — PBKDF2 hash |
| `worker/src/lib/jwt.js` | **Nuovo** — HS256 JWT app user |
| `worker/src/lib/users.js` | **Nuovo** — `users.json` + family settings |
| `worker/src/lib/familyDropbox.js` | **Nuovo** — refresh token famiglia |
| `worker/src/lib/mail.js` | **Rimosso** (Sessione 10 — niente Resend) |
| `worker/src/lib/rbac.js` | **Modificato** — owner/admin/member; view = solo proprie / staff tutte |
| `worker/src/middleware/auth.js` | **Modificato** — JWT + inject Dropbox server |
| `worker/src/routes/auth.js` | **Riscritto** — login/setup/import-refresh |
| `worker/src/routes/users.js` | **Nuovo** — invite, roles, preferences |
| `worker/src/routes/settings.js` | **Nuovo** — `familyAppName` |
| `worker/src/routes/recipes.js` | **Modificato** — author + ownership |
| `worker/src/index.js` | **Modificato** — mount users/settings; CORS senza `X-Dropbox-Token` |
| `worker/.dev.vars.example` | **Modificato** — `FAMILY_DROPBOX_*` (no Resend) |
| `scripts/set-family-dropbox-token.mjs` | **Nuovo** — scrive token in `.dev.vars` |
| `frontend/src/store/authStore.js` | **Modificato** — solo JWT/user (no Dropbox client) |
| `frontend/src/services/auth.js` | **Modificato** — login/setup/import |
| `frontend/src/services/api.js` | **Modificato** — solo `Authorization` |
| `frontend/src/services/users.js` | **Nuovo** |
| `frontend/src/hooks/useAuth.js` | **Modificato** |
| `frontend/src/pages/Login.jsx` | **Modificato** — user/pw |
| `frontend/src/pages/Setup.jsx` | **Nuovo** |
| `frontend/src/pages/SetupOwner.jsx` | **Nuovo** |
| `frontend/src/pages/ChangePassword.jsx` | **Nuovo** |
| `frontend/src/pages/Settings.jsx` | **Nuovo** — inviti + nomi |
| `frontend/src/pages/DropboxCallback.jsx` | **Modificato** — solo family setup |
| `frontend/src/components/auth/AuthGuard.jsx` | **Modificato** — force change password |
| `frontend/src/components/common/Navbar.jsx` | **Modificato** — brand da `appLabel` / `familyAppName` |
| `frontend/src/components/recipe/RecipeForm.jsx` | **Modificato** — checkbox privata |
| `frontend/src/services/dropboxToken.js` | **Rimosso** |

### Snippet utili (riferimento)

**Worker — resolve Dropbox famiglia** (`familyDropbox.js`):

```js
export function getConfiguredFamilyRefreshToken(env) {
  return (
    cache().refreshToken ||
    (typeof env?.FAMILY_DROPBOX_REFRESH_TOKEN === 'string' &&
    env.FAMILY_DROPBOX_REFRESH_TOKEN.trim()
      ? env.FAMILY_DROPBOX_REFRESH_TOKEN.trim()
      : null)
  )
}
```

**RBAC — lettura ricette** (`rbac.js`):

```js
export function canViewRecipe(user, recipe) {
  if (!recipe) return false
  if (isStaff(user)) return true
  return isRecipeAuthor(user, recipe) // member: solo le proprie
}

export function canEditRecipe(user, recipe) {
  if (!recipe) return false
  if (isStaff(user)) return true
  return isRecipeAuthor(user, recipe)
}
```

**Env locale** (`worker/.dev.vars` — non commitare):

```bash
# ... DROPBOX_APP_KEY / SECRET / JWT_SECRET ...
FAMILY_DROPBOX_REFRESH_TOKEN=sl.B.......   # obbligatorio dopo setup
# GEMINI_API_KEY=… / GEMINI_API_KEY_2=… (opzionale)
# APP_BASE_URL=http://localhost:5173
```
**API auth rilevanti**

| Method | Path | Note |
|--------|------|------|
| GET | `/api/auth/status` | `needsSetup`, `dropboxConfigured`, `hasUsers` |
| GET | `/api/auth/authorize` | OAuth Dropbox (solo setup/reconnect) |
| POST | `/api/auth/setup/dropbox` | exchange code → refresh + setup ticket |
| POST | `/api/auth/setup/import-refresh` | riusa refresh token esistente |
| POST | `/api/auth/setup/owner` | primo utente `owner` |
| POST | `/api/auth/login` | `{ username, password }` → JWT |
| POST | `/api/auth/change-password` | obbligatorio se `mustChangePassword` |
| GET/PATCH | `/api/users`, `/api/users/invite`, `/me/preferences` | staff / self |
| GET/PUT | `/api/settings` | `familyAppName` (staff) |

### Ruoli (comportamento)

| Ruolo | Ricette | Utenti | Settings famiglia |
|-------|---------|--------|-------------------|
| **owner** | CRUD tutte | Invita, promuove/retira admin, disattiva | Sì + riconnetti Dropbox |
| **admin** | CRUD tutte | Invita member; non rimuove admin | Sì |
| **member** | CRUD solo proprie; legge shared | No | Solo preferenze personali |

### Errori tipici

| Messaggio | Causa | Fix |
|-----------|-------|-----|
| `Dropbox famiglia non configurato` | Manca `FAMILY_DROPBOX_REFRESH_TOKEN` o worker non riavviato | `/setup` + salva in `.dev.vars` + restart |
| `Owner già presente` | Setup owner ripetuto | Usa `/login` |
| `Account disattivato` | Soft-delete utente | Owner/admin → Riattiva in Impostazioni |

### Cosa non in scope (ancora)
- SSO Google / 2FA  
- Multi-famiglia / multi-tenant  

**Deploy:** ✅ Localhost verified — owner creato, Dropbox famiglia attivo (`Ricettario`)

---

## Sessione 8 — 2026-09-09 — PWA verify + foto Vision + invite link

### Segnalazione
Chiudere i pezzi “quasi fatti”: PWA build/SW, upload foto → Gemini, invite monouso 7 giorni.

### Soluzione

**PWA**
- Icone PNG 192/512 + manifest aggiornato
- `npm run preview:web` (build + preview con proxy `/api`)
- Build verificata: `dist/sw.js` + precache Workbox

**Foto → Gemini Vision**
- `POST /api/gemini/from-photo` `{ imageBase64, mimeType }`
- `parseRecipePhotoWithGemini` in `geminiExtract.js`
- UI Importa: «Carica / scatta foto» → stesso form di revisione

**Invite link monouso**
- `inviteToken` + `inviteExpiresAt` (7g) su `users.json`
- `GET /api/auth/invite/:token`, `POST /api/auth/accept-invite`
- Frontend `/invite/:token` + copia link in Impostazioni
- Niente email automatica (Resend rimosso in Sessione 10)

### File principali
| File | Azione |
|------|--------|
| `frontend/public/icons/icon-192.png`, `icon-512.png` | **Nuovo** |
| `frontend/vite.config.js` | **Modificato** (icone + preview proxy) |
| `package.json` | **Modificato** (`preview:web`) |
| `worker/src/routes/gemini.js` | **Modificato** (`/from-photo`) |
| `worker/src/lib/scrapers/geminiExtract.js` | **Modificato** (`parseRecipePhotoWithGemini`) |
| `worker/src/routes/auth.js` | **Modificato** (invite preview + accept) |
| `worker/src/routes/users.js` | **Modificato** (token 7g) |
| `frontend/src/pages/ImportRecipe.jsx` | **Modificato** (foto) |
| `frontend/src/pages/InviteAccept.jsx` | **Nuovo** |
| `frontend/src/pages/Settings.jsx` | **Modificato** (copia link) |

**Test PWA:** `npm run preview:web` (worker su `:8787` in parallelo) → DevTools Application → Service Worker.

**Deploy:** ✅ Localhost ready (SW in prod build)

---

## Sessione 9 — 2026-09-09 — Fix orfani, import UI, dose scraper

### Segnalazione
- Ricetta in lista ma “non trovata” → impossibile eliminarla  
- Import da URL faceva sembrare attivo anche «Carica / scatta foto»  
- GialloZafferano: `Melanzane (violetta, di Vittoria) 1` senza unità → quantità persa  
- (precedente) dopo add alimento al DB locale il banner «ingredienti esclusi» non spariva

### Soluzione

**Orfani indice**
- DELETE ricetta: toglie sempre dall’indice anche se il file Dropbox manca  
- `deleteFile` ignora `path/not_found`  
- Dettaglio in errore: bottone **Rimuovi dalla lista**

**Import UI**
- Stati separati `urlLoading` / `photoLoading` (niente «Analisi foto…» durante estrazione URL)

**Parser dosi** (`parseIngredientLine`)
- Formato GZ: nome (+ note in parentesi) + numero in coda senza unità  
- Es. `Melanzane (…) 1` → qty `1`; evita falsi positivi tipo `farina 00`

**Nutrizione**
- Dopo «Salva nel DB» (custom 100 g) → ricalcolo automatico ricetta  
- Custom DB prima della cache nel resolve

### File principali
| File | Azione |
|------|--------|
| `worker/src/lib/scrapers/_base.js` | **Modificato** (bare count in coda) |
| `worker/src/lib/dropboxClient.js` | **Modificato** (delete missing = ok) |
| `worker/src/routes/recipes.js` | **Modificato** (delete orfano) |
| `frontend/src/pages/RecipeDetail.jsx` | **Modificato** (Rimuovi dalla lista) |
| `frontend/src/pages/ImportRecipe.jsx` | **Modificato** (loading separati) |
| `worker/src/lib/nutrition/calculate.js` | **Modificato** (custom prima di cache) |
| `frontend/src/pages/RecipeDetail.jsx` | **Modificato** (ricalcolo post-custom) |
| `frontend/src/components/recipe/NutritionPanel.jsx` | **Modificato** |

**Test dose:** reimport `https://ricette.giallozafferano.it/Spaghetti-alla-Norma.html` → Melanzane qty `1`.

**Deploy:** ✅ Localhost ready

---

## Sessione 6 — 2026-09-09 — PWA + offline

### Segnalazione
App installabile + lettura ricette già viste senza rete.

### Soluzione
- `vite-plugin-pwa` (Workbox): precache shell, cache immagini/font, API network-only
- Persist Zustand: indice ricette + cache dettaglio (max 40) + lista spesa
- Fallback offline in `useRecipes` / shopping list
- Banner offline + prompt “Installa Recipe Book”

**Deploy:** ✅ Verificato `vite build` → `dist/sw.js` (vedi Sessione 8)

---

## Sessione 5 — 2026-09-09 — YouTube → ricetta

### Segnalazione
Import da video YouTube (trascrizione + Gemini).

### Soluzione
- `POST /api/youtube/parse-recipe` — video id, captions dalla watch page, Gemini → draft
- Fallback: descrizione video o trascrizione incollata dall’utente
- UI Import: rileva URL YouTube, campo trascrizione opzionale/richiesto
- Anche `/api/scraper/fetch-recipe` instrada automaticamente i link YouTube

**Deploy:** ⏳ Localhost ready — prova un video ricetta su Importa

---

## Sessione 4 — 2026-09-09 — Calorie (DB locale + override)

### Segnalazione
Stima nutrizionale senza API US/UK (FatSecret rimosso).

### Soluzione
- DB statico ~50 ingredienti IT + `POST /api/nutrition/custom` (valori per 100 g → Dropbox `nutrition-cache/custom-db.json`)
- Override totale per porzione sulla ricetta
- UI: Calcola / + Alimento 100 g / Modifica totale; link «Aggiungi» sugli ingredienti skippati
- Cottura: solo metodi comuni (aria, forno, padella, bollire); pannello espandi/chiudi al tap sull’icona

**Deploy:** ⏳ Localhost ready

---

## Sessione 10 — 2026-09-15 — Ownership, deploy Cloudflare, password recovery

### Segnalazione
- Togliere inviti email/Resend; solo condivisione manuale del link
- Ogni utente vede solo le sue ricette; owner/admin vedono tutte
- Staff: assegnare ricetta a un utente in creazione/import/modifica
- Lista ricette staff: tab affiancate «Ricette di {nome}»
- Deploy su Cloudflare (Pages + Worker)
- Ricette locali non visibili in prod (bug URL API)
- Reset password utenti da staff + recupero password (anche owner) senza email

### Soluzione

**Inviti senza email**
- Eliminato `mail.js` / Resend; Settings mostra solo testo da copiare (WhatsApp/SMS)
- Puliti `.dev.vars` / example da chiavi Resend

**Ownership ricette**
- `canViewRecipe`: member solo proprie; staff tutte
- Migrazione orfane → owner al list/get
- Staff: campo **Assegna a** in `RecipeForm` (`assignToUserId`)
- UI Ricette: tab per autore (click → elenco)

**Deploy Cloudflare**
- Worker: `https://recipe-book-worker.petruzzo-massimiliano-b40.workers.dev`
- Pages: `https://recipe-book-ap1.pages.dev`
- Secret Worker da `.dev.vars` + `APP_BASE_URL` / `DROPBOX_REDIRECT_URI` prod
- CORS aggiornato per `recipe-book-ap1.pages.dev` (+ preview)
- GitHub: login non completato (repo non ancora su remote)

**Fix prod API**
- `apiFetch` ora prefissa `VITE_WORKER_URL` (login già lo faceva; recipes/shopping no → 404 Pages)

**Password**
- Staff: `POST /api/users/:id/reset-password` → password temp + `mustChangePassword`
- Utente: frase di recupero in Impostazioni (`POST /api/users/me/recovery`)
- Login: «Password dimenticata?» → `POST /api/auth/recover` (username + frase + nuova pw)
- Settings: Cambia password + Frase di recupero + Reimposta password utenti
- Script: `scripts/reset-owner-password.mjs` (`--list`, `--password`, `--delete-username`)

### File principali
| File | Azione |
|------|--------|
| `worker/src/lib/mail.js` | **Rimosso** |
| `worker/src/lib/rbac.js` | **Modificato** — ownership + `canResetUserPassword` |
| `worker/src/routes/recipes.js` | **Modificato** — migrate author, assignToUserId |
| `worker/src/routes/users.js` | **Modificato** — reset-password, me/recovery |
| `worker/src/routes/auth.js` | **Modificato** — `/recover` |
| `worker/src/index.js` | **Modificato** — CORS Pages |
| `worker/.dev.vars.example` | **Modificato** — no Resend |
| `frontend/src/services/api.js` | **Modificato** — `VITE_WORKER_URL` |
| `frontend/src/services/auth.js` | **Modificato** — `recoverPassword` |
| `frontend/src/services/users.js` | **Modificato** — reset + recovery |
| `frontend/src/pages/Login.jsx` | **Modificato** — recupero password |
| `frontend/src/pages/Settings.jsx` | **Modificato** — pw, recovery, reset utenti, invito copia |
| `frontend/src/pages/Recipes.jsx` | **Modificato** — tab per autore |
| `frontend/src/components/recipe/RecipeForm.jsx` | **Modificato** — Assegna a |
| `scripts/reset-owner-password.mjs` | **Nuovo** |

### URL produzione
| Servizio | URL |
|----------|-----|
| App (Pages) | https://recipe-book-ap1.pages.dev |
| API (Worker) | https://recipe-book-worker.petruzzo-massimiliano-b40.workers.dev |

### Todo / note
- [x] Login GitHub + push repo remoto → https://github.com/petruzzomassimiliano-maker/recipe-book
- [ ] In Dropbox App: redirect URI `https://recipe-book-ap1.pages.dev/dropbox-callback`
- [ ] Owner: impostare **frase di recupero** in Impostazioni e salvarla offline
- [ ] Material Design 3 UI ancora pending

**Deploy:** ✅ Cloudflare Worker + Pages (2026-09-15)

---

## Sessione 11 — 2026-09-15 — Parser ingredienti (regola generale)

### Segnalazione
Import: dose lasciata nel nome, es. `piselli 300 g freschi o surgelati` → Qty/Unità vuoti.

### Soluzione — regola generale (`parseIngredientLine`)
1. Se la riga **inizia** con quantità[+unità] → quella è la dose; resto = nome (`300 g di farina`).
2. Altrimenti, se compare **nome + qty + unità** → spezza lì; testo dopo l’unità → **notes** (`piselli 300 g freschi o surgelati`).
3. Casi speciali invariati: `q.b.`, quantità in lettere, conteggio senza unità in coda (`Uova 4`), evita falso positivo `farina 00`.

**Rescue AI:** `refineIngredientFields` ri-applica il parser se Gemini lascia la dose dentro `name`.

### File
| File | Azione |
|------|--------|
| `worker/src/lib/scrapers/_base.js` | **Modificato** — pattern generale + `refineIngredientFields` |
| `worker/src/lib/scrapers/geminiExtract.js` | **Modificato** — refine post-AI |

### Test rapidi
- `piselli 300 g freschi o surgelati` → name `piselli`, qty `300`, unit `g`, notes `freschi o surgelati`
- `Farina Manitoba 200 g`, `zucchero 1 cucchiaio raso`, `farina 00` (qty null) ok

**Deploy:** ✅ Worker Cloudflare aggiornato (reimport per ricette già salvate)

---

## Sessione 12 — 2026-09-16 — Mobile UX, resa vs porzioni, foto ricetta, GitHub

### Segnalazione
- Ottimizzare UI smartphone (Home, Ricette, Spesa, dettaglio, Impostazioni) con linee guida touch
- Giallozafferano «Dosi per: 850 grammi» importato come 850 porzioni
- Aggiungere foto ricetta anche da fotocamera / file, non solo URL
- README + repo su GitHub

### Soluzione

**Mobile UX (HIG / Material touch targets 44–48px)**
- Tab bar inferiore (`MobileTabBar`), safe-area, padding pagine
- Ricette: lista densa mobile + griglia desktop, cerca sticky, chip autori
- Spesa: riga intera tappabile, add sticky, sezione Presi richiudibile
- Dettaglio: titolo sotto foto (no overlay), jump Ingredienti/Preparazione, checkbox ingredienti
- Impostazioni: chip navigazione sezioni, azioni utenti più comode

**Resa ≠ porzioni**
- `resolveRecipeYield`: se HTML/JSON-LD indica g/ml/kg → `Resa: …` in notes, servings default 4
- Es. Hummus GZ `recipeYield:850` + «850 grammi» → 4 porzioni + nota resa

**Upload foto ricetta**
- `POST /api/media` (auth) → Dropbox `/recipes/images/{uuid}.jpg`
- `GET /api/media/:file` pubblico (UUID) per `<img src>`
- Form: Scatta / Carica / URL + compressione client-side

**GitHub**
- Remote: https://github.com/petruzzomassimiliano-maker/recipe-book
- `README.md` di progetto

### File principali
| File | Azione |
|------|--------|
| `frontend/src/components/common/MobileTabBar.jsx` | **Nuovo** |
| `frontend/src/pages/ShoppingList.jsx` | **Modificato** — checklist mobile |
| `frontend/src/pages/RecipeDetail.jsx` | **Modificato** — layout cucina |
| `frontend/src/pages/Recipes.jsx` / `RecipeList.jsx` | **Modificato** — lista/griglia |
| `frontend/src/pages/Settings.jsx` | **Modificato** — jump sezioni |
| `frontend/src/components/recipe/RecipeForm.jsx` | **Modificato** — upload foto |
| `frontend/src/services/media.js` | **Nuovo** |
| `worker/src/routes/media.js` | **Nuovo** |
| `worker/src/lib/dropboxClient.js` | **Modificato** — upload/download binary |
| `worker/src/lib/scrapers/_base.js` / `jsonld.js` / `geminiExtract.js` | **Modificato** — yield |
| `README.md` | **Nuovo** |
| `PROGRESS.md` | **Modificato** — questa sessione |

### URL
| Servizio | URL |
|----------|-----|
| GitHub | https://github.com/petruzzomassimiliano-maker/recipe-book |
| App | https://recipe-book-ap1.pages.dev |
| API | https://recipe-book-worker.petruzzo-massimiliano-b40.workers.dev |

### Todo / note
- [ ] Confermare redirect Dropbox prod se non già fatto
- [ ] Owner: frase di recupero offline
- [ ] Material Design 3 formale ancora opzionale

**Deploy:** ✅ Worker + Pages + push GitHub (2026-09-16)

---

## Sessione 13 — 2026-09-16 — Split view desktop + form ricetta ridisegnato

### Segnalazione
- Confrontare due ricette affiancate solo su desktop
- Nella split view: X per chiudere accanto a «Cambia ricetta»
- Ridisegnare tutta la pagina Nuova/Modifica ricetta per desktop (linee guida form)

### Soluzione

**Split view (≥1024px)**
- URL: `/recipes/:id?split=pick|:otherId`
- Due pannelli indipendenti (`useRecipeById` — non condividono `selectedRecipe`)
- Picker ricerca ricette; Scambia / Cambia / ✕ Chiudi
- Sotto lg: param `split` ignorato (vista singola)

**Form desktop (Carbon / NNG / form lunghi)**
- Contenitore `max-w-6xl`; barra sticky titolo + Salva / Annulla
- Dettagli: titolo/meta a sinistra, anteprima foto a destra
- Ingredienti | Passi affiancati su `xl`
- Ingredienti: riga unica Nome · Qty · Unità · ✕ + intestazioni colonna
- Note + checkbox privata; mobile resta a colonna singola

### Branch
`cursor/desktop-recipe-form-and-split-view` (commit form + split)

### File principali
| File | Azione |
|------|--------|
| `frontend/src/hooks/useRecipeById.js` | **Nuovo** — load per pannello + `useIsDesktopSplit` |
| `frontend/src/components/recipe/RecipeDetailPane.jsx` | **Nuovo** — contenuto scheda ricetta |
| `frontend/src/components/recipe/SplitRecipePicker.jsx` | **Nuovo** — scelta seconda ricetta |
| `frontend/src/pages/RecipeDetail.jsx` | **Modificato** — orchestrazione split |
| `frontend/src/components/recipe/RecipeForm.jsx` | **Modificato** — layout desktop completo |
| `frontend/src/pages/AddRecipe.jsx` | **Modificato** — `max-w-6xl`, titolo in sticky bar |
| `PROGRESS.md` | **Modificato** — questa sessione |

### Fix follow-up
- Import usava `max-w-3xl` e schiacciava il form desktop → allineato a Edit (`lg:max-w-6xl` + `pageTitle`)
- Ripristinato **Ingredienti | Passi a 2 colonne su `lg+`** (Nuova / Modifica / Import condividono `RecipeForm`); mobile resta in colonna
- Griglia riga ingredienti esplicita (niente `display:contents`) per evitare nomi verticali
- Deploy Cloud Agent: il secret `CLOUDFLARE_API_TOKEN` in realtà è una **Global API Key** → wrangler va con `CLOUDFLARE_EMAIL` + `CLOUDFLARE_API_KEY` (non Bearer token)

### Todo / note
- [ ] Confermare redirect Dropbox prod se non già fatto
- [ ] Owner: frase di recupero offline
- [ ] Merge branch `cursor/desktop-recipe-form-and-split-view` → `main` + push
- [ ] Material Design 3 formale ancora opzionale
- [ ] (Opzionale) creare un vero API Token Cloudflare Pages:Edit e sostituire la Global API Key nei secret

**Deploy:** ✅ Pages production `recipe-book-ap1.pages.dev` (bundle `index-lK9ZDsZP.js`) — 2026-09-16 21:33 UTC

