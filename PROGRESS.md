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
| **Web Scraper (AllRecipes)** | «Sessione 3» + «9» + «11» + «12» + «16» | ✅ Dosi generali + resa g/ml ≠ porzioni + fallback Wayback se il sito blocca |
| **Sezioni ricetta (componenti)** | «Sessione 16» | ✅ Pan di Spagna / Crema… su ingredienti e passi (scraper, Gemini, form, scheda) |
| **Gemini recipe recognition** | «Sessione 3+» | ✅ Cascata in scraper |
| **FatSecret integration** | — | ❌ Rimosso · DB locale + override utente |
| **YouTube transcript parser** | «Sessione 5» + «17» | ✅ Sottotitoli (web → Android) + **Gemini guarda il video** se mancano |
| **Shopping list feature** | «Sessione 3» + «12» | ✅ UX mobile checklist |
| **Material Design 3 UI** | «Sessione X» | ⏳ Pending (mobile HIG/Material touch già applicati) |
| **Multi-user + RBAC** | «Sessione 7» + «10» | ✅ Ownership per utente + assign staff + reset/recovery |
| **PWA + offline sync** | «Sessione 6» + «8» | ✅ Build + SW verificati (`dist/sw.js`) |
| **Foto → Gemini Vision** | «Sessione 8» | ✅ Import da foto |
| **Foto ricetta (upload)** | «Sessione 12» | ✅ Scatta / carica / URL → Dropbox `/recipes/images` |
| **Split view desktop** | «Sessione 13» | ✅ Due ricette affiancate (`?split=`) ≥1024px |
| **Form ricetta desktop** | «Sessione 13» | ✅ Layout largo, sticky Salva, foto + meta, ingredienti/passi a 2 col |
| **Share ricette tra account** | «Sessione 14» | ✅ Ownership invariata; tab Condivise + tab staff con share-in |
| **Schermo sempre acceso** | «Sessione 15» | ✅ Wake Lock + toggle Impostazioni (device-local) |
| **Invite link monouso** | «Sessione 8» + «10» | ✅ Copia messaggio (niente email/Resend) |
| **Deploy prod** | «Sessione 10» + «12»–«17» | ✅ Cloudflare + repo GitHub |
| **Snippet riusabili** | «Biblioteca codice critico» (fine file) | ✅ Pattern da copiare in altri progetti |

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

---

## Sessione 14 — 2026-09-18 — Condivisione ricette tra account

### Segnalazione
Condividere una ricetta da un account a un altro: resta del proprietario, ma l’altra persona la vede nella sua lista.

### Soluzione
- Campo `metadata.sharedWithUserIds` (+ mirror sull’index)
- Indice inverso `/recipes/recipe-shares.json` (userId → [recipeId]) per liste affidabili
- `canViewRecipe`: staff **oppure** autore **oppure** in `sharedWithUserIds` (se non privata)
- `PUT /api/recipes/:id/share` — sostituisce la lista destinatari (ownership invariata)
- `GET /api/users/peers` — membri famiglia per il picker (qualsiasi utente loggato)
- Lista/API espongono anche `sharedWith: [{ id, displayName }]`
- UI: pulsante **Condividi** in scheda; badge con nomi
- Destinatario: sola lettura (niente Modifica / Elimina / IA)
- Tab **Condivise** sul account destinatario

### Fix follow-up (stessa sessione)
1. **Visibilità destinatario** — reverse share map + riparazione sync all’apertura ricetta; tab «Condivise»
2. **Stato chiaro** — owner vede «Condivisa con Mimma»; sul account mamma «Condivisa da {autore}» + riquadro in scheda
3. **Tab staff/owner su un familiare** — prima mostrava solo ricette *autoriali* di quella persona → le condivise restavano solo sotto «Tue». Ora il tab (es. Batti) = **sue ricette + ricevute in condivisione** (come vede lei in Condivise), con nota «Vista di … + N ricevute…»

### File principali
| File | Azione |
|------|--------|
| `worker/src/lib/rbac.js` | **Modificato** — view via share |
| `worker/src/routes/recipes.js` | **Modificato** — share, share-map, `sharedWith` in list/get |
| `worker/src/routes/users.js` | **Modificato** — `/peers` (+ username) |
| `frontend/src/components/recipe/RecipeSharePanel.jsx` | **Nuovo** |
| `frontend/src/components/recipe/RecipeDetailPane.jsx` | **Modificato** — Condividi + banner stato |
| `frontend/src/components/recipe/RecipeList.jsx` | **Modificato** — badge nomi |
| `frontend/src/pages/Recipes.jsx` | **Modificato** — tab Condivise + tab persona con share-in |
| `frontend/src/services/recipes.js` / `users.js` | **Modificato** |
| `frontend/src/store/recipeStore.js` | **Modificato** — `sharedWith` in index shape |

### Todo / note
- [ ] Confermare redirect Dropbox prod se non già fatto
- [ ] Owner: frase di recupero offline
- [ ] Merge branch `cursor/desktop-recipe-form-and-split-view` → `main` + push
- [ ] Material Design 3 formale ancora opzionale
- [ ] (Opzionale) API Token Cloudflare Pages:Edit al posto della Global API Key nei secret

**Deploy:** ✅ Worker + Pages production `recipe-book-ap1.pages.dev` — 2026-09-18

---

## Sessione 15 — 2026-09-24 — Schermo sempre acceso

### Segnalazione
Toggle per tenere lo schermo acceso (utile in cucina).

### Soluzione (minimale, senza backend)
- Preferenza **solo dispositivo** (`localStorage` via zustand persist) — non va su Dropbox
- Screen Wake Lock API; controller montato in `AuthGuard` (solo da loggati)
- Toggle in **Impostazioni → Schermo**; se il browser non supporta, disabilitato con messaggio
- Ri-acquisizione automatica quando l’app torna in primo piano

### File
| File | Azione |
|------|--------|
| `frontend/src/store/keepAwakeStore.js` | **Nuovo** |
| `frontend/src/components/common/KeepAwakeController.jsx` | **Nuovo** |
| `frontend/src/components/auth/AuthGuard.jsx` | **Modificato** — monta controller |
| `frontend/src/pages/Settings.jsx` | **Modificato** — sezione Schermo |
| `PROGRESS.md` | **Modificato** |

**Deploy:** ✅ Pages production `recipe-book-ap1.pages.dev` (bundle `index-M7EXZFpV.js`) — 2026-09-24

---

## Sessione 16 — 2026-09-24 — Sezioni ricetta (componenti) + import da siti che bloccano

### Segnalazione
1. Ricette come [Wedding cake Perugina](https://www.perugina.com/it/ricette/wedding-cake-cioccolato) dividono ingredienti e procedimento per **componente** (Pan di Spagna, Crema al burro al cioccolato, Bagna…): l’app deve mantenere questa struttura se presente.
2. Quel link non veniva importato.

### Diagnosi
- **Download:** Akamai risponde **403** allo user-agent `RecipeBookBot`. Con header da browser risponde 200 **da una VM**, ma **dalla rete Cloudflare è 403 in ogni caso** (verificato con Worker probe temporaneo). Anche Jina Reader è bloccato. **Wayback Machine** (`id_` = HTML originale) funziona anche da Cloudflare.
- **Dati sporchi nel JSON-LD Perugina:**
  - `recipeIngredient` è **una stringa unica** con intestazioni `Pan di spagna:\n\n\n\t300 g farina…`
  - `recipeInstructions` è un array di **frammenti spezzati sulle virgole** (`"…insieme al burro"`, `"lasciatelo raffreddare\n\tMontate…"`)
- Pipeline esistente perdeva qualsiasi campo extra: `improveStepsReadability`, `mergeListFragments`, `polishStepsWithGemini`, `normalizeRecipe`, `setStep` nel form.

### Soluzione
**Modello dati (retro-compatibile)** — campo opzionale `section` su ingredienti e passi; **salvato solo se valorizzato** → le ricette esistenti e i siti senza sezioni restano identici (nessuna chiave `section`).

**Download (Worker)** — `downloadRecipeHtml`:
1. header da browser (Chrome) → 2. vecchio UA bot → 3. **Wayback** `available` + `…/web/{ts}id_/{url}`
- pagine “muro anti-bot” con 200 (Access Denied / captcha) trattate come fallite
- se viene da Wayback: `fetchedVia: 'wayback'` + avviso nel form con la data dello snapshot
- se tutto fallisce: messaggio che suggerisce «Oppure da foto» / inserimento manuale

**Parsing sezioni** — nuovo `worker/src/lib/scrapers/sections.js`:
- stringa multi-riga con intestazioni `Header:` (ingredienti e passi)
- intestazioni come elementi dell’array (`"Per la crema:"`)
- `HowToSection.name` → `section`
- frammenti su virgole → ricuciti con `", "` se ≥30% iniziano in minuscolo
- un passo tipo `Setacciate a parte:\n• farina` **non** diventa sezione (serve riga vuota/indentata dopo l’header)

**Pipeline** — `readableSteps` conserva `section` e **non unisce mai frammenti di sezioni diverse**; `polishStepsWithGemini` salta la riscrittura AI se ci sono sezioni (userebbe una lista piatta); schema Gemini con `section` opzionale (testo, screenshot, foto, YouTube).

**UI**
- Scheda: sottotitoli per componente su Ingredienti e Preparazione; numerazione passi continua
- Form (Nuova / Modifica / Import): **+ Sezione**, titolo sezione modificabile, **+ Ingrediente / + Passo** nella sezione, «Togli titolo»; senza sezioni il form è identico a prima

### Verifiche
| Check | Esito |
|-------|-------|
| Parser su HTML reale Perugina | ✅ 5 componenti ingredienti (26 righe), 6 componenti procedimento, qualità OK senza Gemini |
| Regressioni: ricetta piatta, HowToSection, header in array, “Setacciate a parte:”, no merge cross-sezione | ✅ assert Node |
| Flusso completo con 403 simulato → Wayback + avviso; bloccato senza archivio → errore 502 chiaro | ✅ |
| GialloZafferano carbonara (diretto, nessuna chiave `section`) | ✅ invariato |
| **Scraper reale su rete Cloudflare** (probe temporaneo, poi eliminato) | ✅ via Wayback, sezioni corrette |
| `vite build` frontend | ✅ |

### File
| File | Azione |
|------|--------|
| `worker/src/lib/scrapers/sections.js` | **Nuovo** — parsing sezioni |
| `worker/src/lib/scrapers/jsonld.js` | **Modificato** — usa sections.js |
| `worker/src/lib/scrapers/readableSteps.js` | **Modificato** — section-aware |
| `worker/src/lib/scrapers/geminiExtract.js` | **Modificato** — schema + normalize + polish |
| `worker/src/lib/scrapers/index.js` | **Modificato** — download a cascata + Wayback |
| `worker/src/routes/recipes.js` | **Modificato** — `sectionField` in `normalizeRecipe` |
| `frontend/src/utils/recipeSections.js` | **Nuovo** — run/rinomina/inserisci |
| `frontend/src/utils/groupSteps.js` | **Modificato** — no merge cross-sezione |
| `frontend/src/components/recipe/RecipeDetailPane.jsx` | **Modificato** — visualizzazione per componente |
| `frontend/src/components/recipe/RecipeForm.jsx` | **Modificato** — editor sezioni |

### Todo / note
- [ ] Wayback può essere più vecchio della pagina live: l’avviso lo segnala
- [ ] Siti bloccati **senza** snapshot Wayback: resta l’import da foto (screenshot)
- [ ] Merge branch `cursor/desktop-recipe-form-and-split-view` → `main`

**Deploy:** ✅ Worker + Pages production — 2026-09-24

---

## Sessione 17 — 2026-09-24 — YouTube senza transcript: lo crea Gemini

### Segnalazione
Alcuni video YouTube non restituiscono il transcript. Richiesta: far sì che l’app lo generi (idea da un `PROGRESS.md` di un altro progetto — repo `en-writing-coach` privato, non accessibile da questa sessione: implementata la soluzione standard equivalente).

### Diagnosi
1. **Sottotitoli che esistono ma arrivano vuoti:** le tracce sono nella pagina (`captionTracks`), ma l’URL `timedtext` dal server risponde **200 con 0 byte** (YouTube ora richiede un PO token). L’app diceva “nessuna trascrizione” anche con sottotitoli presenti.
2. **Muro anti-bot per IP:** per molti video (es. “Fatto in Casa da Benedetta”) pagina e API interne (ANDROID, IOS, ANDROID_VR, MWEB, TVHTML5) rispondono `LOGIN_REQUIRED — Accedi per confermare di non essere un bot`: niente titolo, niente descrizione, niente sottotitoli → l’app si fermava con “YouTube non raggiungibile”.
3. **Gemini accetta URL YouTube pubblici** come `fileData`: il video lo scarica Google (non il nostro Worker), quindi il muro anti-bot non conta.

### Soluzione — cascata in `parseRecipeFromYoutube`
1. Trascrizione **incollata** dall’utente
2. Sottotitoli dalla **pagina web**
3. Sottotitoli dal client **ANDROID** innertube (`20.10.38`, URL scaricabili senza PO token) — funziona per molti video, anche da Cloudflare
4. **Gemini guarda e ascolta il video** (audio + testo a schermo) → ricetta JSON diretta
   - `mediaResolution: MEDIA_RESOLUTION_LOW` per stare nei limiti gratuiti
   - video > 45 min: analisi dei primi 45 min (`videoMetadata.endOffset`) con avviso
5. Sola **descrizione** del video
6. Altrimenti `YOUTUBE_TRANSCRIPT_REQUIRED` (il form mostra il campo trascrizione) con il motivo del fallimento IA

Metadati: pagina → Android → **oEmbed** (titolo/canale sempre disponibili). Video privato/rimosso (oEmbed 401/404) → errore chiaro `YOUTUBE_VIDEO_UNAVAILABLE`, senza sprecare chiamate Gemini. Il muro anti-bot (`LOGIN_REQUIRED`) **non** viene trattato come “video privato”.

UI: durante l’import YouTube compare «Se il video non ha sottotitoli l’IA lo guarda e lo ascolta: può servire fino a un minuto.»; avviso nel form: «Nessun sottotitolo: ricetta ricavata dall’IA guardando e ascoltando il video».

### Verifiche
| Check | Esito |
|-------|-------|
| Sottotitoli web vuoti → client Android (locale + **rete Cloudflare**) | ✅ testo completo |
| Formato XML 3 (`<p><s>…</s></p>`) | ✅ |
| Video bot-wall: metadati via oEmbed | ✅ |
| **Gemini video reale con chiavi di produzione** (versione Worker di prova **non deployata**, stessi secret) — “Torta di mele semplice” Benedetta | ✅ 53 s, 8 ingredienti con dosi, 15 passi, temperature forno |
| Rami con stub: video IA, trascrizione manuale, IA fallita → richiesta trascrizione, video non disponibile → nessuna chiamata Gemini | ✅ |
| Produzione: nuova versione al 100%, route di test assente (404) | ✅ |

### File
| File | Azione |
|------|--------|
| `worker/src/lib/youtube/transcript.js` | **Modificato** — Android innertube, oEmbed, XML 3, `transcriptSource` |
| `worker/src/lib/youtube/parseRecipe.js` | **Riscritto** — cascata + Gemini video |
| `worker/src/lib/geminiClient.js` | **Modificato** — opzione `generationConfig` extra |
| `frontend/src/pages/ImportRecipe.jsx` | **Modificato** — messaggio attesa analisi video |

### Todo / note
- [ ] Quota gratuita Gemini video: ~8 h di video al giorno; un video = 1 chiamata
- [ ] Il client Android può cambiare versione minima: se smette, aggiornare `ANDROID_CLIENT_VERSION` (Gemini resta comunque il fallback)
- [ ] La versione di prova `c717072d` del Worker resta nello storico versioni (non riceve traffico; la route di test richiede un token casuale mai pubblicato)

**Deploy:** ✅ Worker + Pages production — 2026-09-24

---

## Biblioteca codice critico (riuso in altri progetti)

> Snippet **stabili e battuti in produzione** su Recipe Book. Copia/adatta; non dipendono dal dominio “ricette” se non dove indicato.
> File sorgente completi restano nel repo — qui solo il cuore.

### 1) API client con JWT + base URL Worker (Vite)

`frontend/src/services/api.js`

```js
const WORKER_URL = (import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '')

function apiUrl(path) {
  if (!path.startsWith('/')) return `${WORKER_URL}/${path}`
  return `${WORKER_URL}${path}`
}

export async function apiFetch(path, options = {}) {
  const { jwt } = useAuthStore.getState() // o il tuo store
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...options.headers
  }
  const res = await fetch(apiUrl(path), { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`)
  return data
}
```

**Prod build:**  
`VITE_WORKER_URL=https://….workers.dev VITE_APP_ENV=production npm run build`

**Deploy Pages (Global API Key, non Bearer token):**  
`CLOUDFLARE_EMAIL=… CLOUDFLARE_API_KEY=… npx wrangler pages deploy dist --project-name=… --branch=main`

---

### 2) RBAC: autore vs staff vs “condiviso con” (ownership invariata)

`worker/src/lib/rbac.js` — pattern generico “risorsa + sharedWithUserIds”

```js
export function sharedWithUserIds(resource) {
  const raw = resource?.metadata?.sharedWithUserIds ?? resource?.sharedWithUserIds
  if (!Array.isArray(raw)) return []
  return raw.map((id) => String(id || '').trim().replace(/^user-/, '')).filter(Boolean)
}

export function canViewResource(user, resource) {
  if (!resource) return false
  if (isStaff(user)) return true
  if (isAuthor(user, resource)) return true
  if (resource?.metadata?.isPrivate || resource?.isPrivate) return false
  return sharedWithUserIds(resource).includes(String(user.userId))
}

// Edit/delete: tipicamente SOLO autore o staff (i destinatari del share = sola lettura)
export function canEditResource(user, resource) {
  if (!resource) return false
  if (isStaff(user)) return true
  return isAuthor(user, resource)
}
```

**Regola prodotto:** `assignToUserId` = cambia ownership; `sharedWithUserIds` = solo view. Non mescolarli.

---

### 3) Indice inverso share (liste affidabili anche se l’index è stale)

`worker/src/routes/recipes.js` — file tipo `/…/resource-shares.json`: `{ [userId]: [resourceId, …] }`

```js
async function syncShareMapForResource(client, resourceId, userIds) {
  const map = await loadShareMap(client) // {} se manca
  const id = String(resourceId)
  const targets = new Set(normalizeIds(userIds))

  for (const [uid, list] of Object.entries(map)) {
    if (!Array.isArray(list)) { delete map[uid]; continue }
    const next = list.filter((rid) => rid !== id)
    if (next.length) map[uid] = next
    else delete map[uid]
  }
  for (const uid of targets) {
    const list = Array.isArray(map[uid]) ? [...map[uid]] : []
    if (!list.includes(id)) list.push(id)
    map[uid] = list
  }
  await saveShareMap(client, map)
  return map
}
```

In **GET lista**, unisci `sharedWithUserIds` dall’index **e** dalla share-map prima di filtrare con `canView*`.

Endpoint tipico: `PUT /api/resources/:id/share` body `{ userIds: string[] }` → aggiorna metadata + index + share-map.

---

### 4) UI staff: tab persona = proprie + ricevute in share

`frontend/src/pages/Recipes.jsx` — quando l’admin apre il tab di un altro utente

```js
function recipesForPerson(allRecipes, personUserId) {
  const pid = String(personUserId)
  const out = []
  const seen = new Set()
  for (const r of allRecipes || []) {
    if (!r?.id || seen.has(r.id)) continue
    const own = isOwnRecipe(r, pid)
    const sharedIn = isSharedWithViewer(r, pid) // in sharedWithUserIds, non autore
    if (!own && !sharedIn) continue
    seen.add(r.id)
    out.push(r)
  }
  // proprie prima, poi ricevute
  out.sort((a, b) => Number(isOwnRecipe(b, pid)) - Number(isOwnRecipe(a, pid)) /* + titolo */)
  return out
}
```

**Bug tipico evitato:** filtrare solo per `author === persona` → le risorse condivise restano invisibili nel tab altrui (anche se il destinatario le vede nel suo account).

Passa `perspectiveUserId` alla lista per i badge (“Condivisa da X” come li vedrebbe quella persona).

---

### 5) Schermo sempre acceso (Wake Lock) — device-local

**Store** `frontend/src/store/keepAwakeStore.js`:

```js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useKeepAwakeStore = create(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (enabled) => set({ enabled: Boolean(enabled) })
    }),
    { name: 'app-keep-awake', partialize: (s) => ({ enabled: s.enabled }) }
  )
)
```

**Controller** (montare **una volta** nello shell autenticato):

```js
useEffect(() => {
  if (!enabled || !('wakeLock' in navigator)) {
    lockRef.current?.release().catch(() => {})
    lockRef.current = null
    return
  }
  let cancelled = false
  const acquire = async () => {
    if (cancelled || document.visibilityState !== 'visible') return
    try {
      const lock = await navigator.wakeLock.request('screen')
      if (cancelled) { lock.release().catch(() => {}); return }
      lockRef.current = lock
    } catch (e) { console.warn('[keepAwake]', e) }
  }
  acquire()
  const onVis = () => { if (document.visibilityState === 'visible') acquire() }
  document.addEventListener('visibilitychange', onVis)
  return () => {
    cancelled = true
    document.removeEventListener('visibilitychange', onVis)
    lockRef.current?.release().catch(() => {})
    lockRef.current = null
  }
}, [enabled])
```

**Note:** HTTPS obbligatorio; in background il lock si rilascia → ri-acquire su `visibilitychange`; preferenza **non** sincronizzare sul server (ogni device ha la sua).

---

### 6) Form desktop 2 colonne Ingredienti | Passi (Tailwind)

```jsx
{/* mobile: 1 col · lg+: 2 col */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
  <section>…ingredienti…</section>
  <section>…passi…</section>
</div>
```

Righe ingredienti desktop: **griglia esplicita** (evitare `display:contents` → nomi verticali):

```jsx
<div className="hidden md:grid grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_2.75rem] gap-2.5 items-center">
  <input className="input-field min-w-0 !w-full" /* nome */ />
  <input /* qty */ />
  <input /* unità */ />
  <button type="button" /* rimuovi */ />
</div>
```

---

### 7) Download robusto da Worker: browser headers → bot UA → Wayback

`worker/src/lib/scrapers/index.js` — utile per qualsiasi scraper su Cloudflare (i CDN tipo Akamai/Incapsula bloccano spesso gli IP datacenter).

```js
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
  'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1', 'Upgrade-Insecure-Requests': '1'
}

const BLOCK_PAGE_RE =
  /(access denied|temporarily unavailable|attention required|are you a robot|captcha|request unsuccessful|incapsula incident|bot detection)/i

function looksBlockedHtml(html) {            // alcuni muri anti-bot rispondono 200
  if (!html) return true
  if (/application\/ld\+json/i.test(html)) return false
  return html.length < 80000 && BLOCK_PAGE_RE.test(html)
}

async function fetchFromWayback(url) {
  const avail = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`)
  const snap = (await avail.json().catch(() => null))?.archived_snapshots?.closest
  if (!snap?.available || String(snap.status) !== '200') return null
  // `id_` = HTML originale senza toolbar Wayback
  const res = await fetch(`https://web.archive.org/web/${snap.timestamp}id_/${url}`, { redirect: 'follow' })
  if (!res.ok) return null
  const html = await res.text()
  return looksBlockedHtml(html) ? null : { html, timestamp: String(snap.timestamp) }
}

async function downloadHtml(url) {
  for (const headers of [BROWSER_HEADERS, BOT_HEADERS]) {
    try {
      const res = await fetch(url, { headers, redirect: 'follow' })
      if (res.ok) {
        const html = await res.text()
        if (!looksBlockedHtml(html)) return { html, via: 'direct' }
      }
    } catch { /* prova il prossimo */ }
  }
  const archived = await fetchFromWayback(url)
  if (archived) return { html: archived.html, via: 'wayback', archivedAt: archived.timestamp }
  throw Object.assign(new Error('Il sito blocca il download e non esiste una copia archiviata'), { status: 502 })
}
```

**Testare dalla rete Cloudflare (non dal PC):** gli header da browser possono funzionare in locale e fallire in produzione. Deploy di un Worker probe temporaneo → `curl` → `wrangler delete --name … --force`.

---

### 8) Sezioni / componenti (JSON-LD sporco → gruppi)

`worker/src/lib/scrapers/sections.js` — riconosce `Header:` senza confonderlo con `Setacciate a parte:` + elenco.

```js
function headerBody(trimmed) {
  if (!/[:：]$/.test(trimmed)) return null
  const body = trimmed.replace(/[:：]$/, '').trim()
  if (body.length < 2 || body.length > 60) return null
  if (body.split(/\s+/).length > 8) return null
  if (/^\d/.test(body)) return null
  return body
}

// Ingredienti: header se senza cifre o seguito da riga vuota/indentata.
// Passi: header SOLO se seguito da riga vuota/indentata.
function isHeaderLine(raw, nextRaw, mode) {
  if (/^[\t ]/.test(raw || '')) return false
  const body = headerBody(String(raw).trim())
  if (!body) return false
  const nextBreaks = nextRaw == null || !nextRaw.trim() || /^[\t ]/.test(nextRaw)
  return mode === 'ingredients' ? nextBreaks || !/\d/.test(body) : nextBreaks
}

export function splitSectionedText(text, { mode = 'ingredients', initialSection = '' } = {}) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let section = initialSection
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed) continue
    if (isHeaderLine(lines[i], lines[i + 1], mode)) { section = cleanSectionName(trimmed); continue }
    out.push({ section, text: trimmed.replace(/^[-•*]\s+/, '') })
  }
  return out
}

// CMS che spezzano un testo sulle virgole in tanti elementi → ricucire
function joinInstructionFragments(items) {
  const nonEmpty = items.map(String).filter((s) => s.trim())
  const lower = nonEmpty.filter((s) => /^[a-zà-ÿ]/.test(s.trim())).length
  return nonEmpty.join(lower / nonEmpty.length >= 0.3 ? ', ' : '\n')
}

// Chiave presente solo se valorizzata → dati vecchi invariati
export function withSection(item, section) {
  const name = cleanSectionName(section)
  if (!name) { const { section: _drop, ...rest } = item; return rest }
  return { ...item, section: name }
}
```

Salvataggio (Worker):

```js
function sectionField(item) {
  const section = String(item?.section || '').replace(/\s+/g, ' ').trim().slice(0, 80)
  return section ? { section } : {}
}
// ingredients.map((i, idx) => ({ id, name, quantity, unit, notes, nutritionId, ...sectionField(i) }))
```

**Regola d’oro pipeline:** ogni trasformazione di liste (leggibilità, merge elenchi, rewrite AI) deve (a) **copiare** `section` e (b) **non unire** elementi con sezioni diverse. Il rewrite AI che restituisce una lista piatta va saltato se ci sono sezioni.

---

### 9) UI: lista piatta + “run” di sezione (React)

`frontend/src/utils/recipeSections.js` — niente struttura annidata: una sezione = elementi consecutivi con lo stesso nome. Semplice da salvare, ordinare e scalare.

```js
export const sectionOf = (item) => String(item?.section || '').trim()

export function groupBySection(items) {
  const groups = []
  ;(items || []).forEach((item, index) => {
    const section = sectionOf(item)
    const last = groups[groups.length - 1]
    if (last && last.section === section) last.entries.push({ item, index })
    else groups.push({ section, startIndex: index, entries: [{ item, index }] })
  })
  return groups
}

export const isRunStart = (items, i) => i === 0 || sectionOf(items[i]) !== sectionOf(items[i - 1])

export function runEndIndex(items, start) {
  const s = sectionOf(items[start]); let end = start
  while (end + 1 < items.length && sectionOf(items[end + 1]) === s) end += 1
  return end
}

export function renameRun(items, start, name) {        // '' = togli titolo
  const end = runEndIndex(items, start)
  return items.map((it, i) => (i < start || i > end ? it : name.trim() ? { ...it, section: name } : (({ section, ...r }) => r)(it)))
}

export function insertIntoRun(items, start, newItem) { // aggiunge in fondo alla sezione
  const end = runEndIndex(items, start)
  const next = [...items]
  next.splice(end + 1, 0, sectionOf(items[start]) ? { ...newItem, section: sectionOf(items[start]) } : newItem)
  return next
}
```

Render (scheda):

```jsx
{groupBySection(items).map((g) => (
  <div key={g.startIndex}>
    {g.section ? <h3 className="text-[13px] font-semibold uppercase tracking-wide text-primary/90">{g.section}</h3> : null}
    <ul>{g.entries.map(({ item }) => <li key={item.id}>{item.name}</li>)}</ul>
  </div>
))}
```

Form: header di sezione solo **all’inizio di ogni run** e solo se la lista ha almeno una sezione → senza sezioni l’editor resta identico. Attenzione agli update: `{ ...row, instruction }` (non `{ instruction }`, che cancella la sezione).

---

### 10) YouTube: sottotitoli robusti + Gemini che guarda il video

`worker/src/lib/youtube/transcript.js` + `parseRecipe.js` — riusabile per riassunti, note, quiz da video.

**a) Sottotitoli senza PO token (client Android innertube):**

```js
const ANDROID_CLIENT_VERSION = '20.10.38'
const ANDROID_UA = `com.google.android.youtube/${ANDROID_CLIENT_VERSION} (Linux; U; Android 11) gzip`

async function fetchAndroidPlayer(videoId) {
  const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': ANDROID_UA },
    body: JSON.stringify({
      context: { client: { clientName: 'ANDROID', clientVersion: ANDROID_CLIENT_VERSION, androidSdkVersion: 30, hl: 'it', gl: 'IT' } },
      videoId
    })
  })
  return res.ok ? res.json().catch(() => null) : null
}
// tracks = player.captions.playerCaptionsTracklistRenderer.captionTracks
// testo: fetch(track.baseUrl + '&fmt=json3', { headers: { 'User-Agent': ANDROID_UA } }) → events[].segs[].utf8
```

Nota: se `playabilityStatus.status === 'LOGIN_REQUIRED'` con motivo “non sei un bot” è un **muro per IP**, non un video privato.

**b) Metadati sempre disponibili (oEmbed):**

```js
const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`)
// 200 → { title, author_name } · 401/404 → video privato/rimosso (non chiamare Gemini)
```

**c) Gemini guarda il video (crea lui la “trascrizione”):**

```js
const videoPart = { fileData: { fileUri: `https://www.youtube.com/watch?v=${videoId}` } }
if (lengthSeconds > 45 * 60) {
  videoPart.videoMetadata = { startOffset: '0s', endOffset: `${45 * 60}s` }  // clip video lunghi
}

const body = {
  contents: [{ role: 'user', parts: [videoPart, { text: 'Guarda e ascolta il video (audio + testo a schermo)… restituisci SOLO JSON {…}' }] }],
  generationConfig: {
    temperature: 0.15,
    responseMimeType: 'application/json',
    mediaResolution: 'MEDIA_RESOLUTION_LOW'   // ~3x meno token: resta nei limiti free tier
  }
}
await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
})
```

- Solo video **pubblici**; free tier ≈ 8 h di video/giorno; ~50 s per un video di 10 min
- Il video lo scarica Google → funziona anche quando il tuo server è bloccato da YouTube
- Ordine consigliato: testo incollato → sottotitoli (web, Android) → **video Gemini** → descrizione → chiedi testo all’utente

**d) Testare con i secret di produzione senza toccare la produzione (Cloudflare):**

```bash
# copia del worker + route di debug protetta da token casuale
npx wrangler versions upload --message "probe (non deployato)"
# → "Version Preview URL: https://<id>-<worker>.<sub>.workers.dev"  (stessi secret, 0% traffico)
curl "https://<id>-<worker>.<sub>.workers.dev/__probe?token=…"
```

---

### 11) Checklist riuso rapido

| Pattern | Dove | Portabile? |
|---------|------|------------|
| `apiFetch` + `VITE_WORKER_URL` | ogni SPA→Worker | sì |
| RBAC author/staff/share | qualsiasi multi-user vault | sì |
| Reverse share map | Dropbox/S3/KV JSON | sì |
| Tab “vista persona” = own+sharedIn | admin dashboard | sì |
| Wake Lock + zustand persist | PWA cucina / kiosk / lettura | sì |
| Grid form 2 col + griglia riga | form lunghi desktop | sì |
| Download browser → bot → Wayback | scraper su Workers / serverless | sì |
| Probe Worker temporaneo per testare egress | debug blocchi CDN | sì (Cloudflare) |
| Sezioni come “run” in lista piatta | ricette, checklist, capitoli, preventivi | sì |
| Sottotitoli YouTube via client Android + oEmbed | qualsiasi app che legge video | sì |
| Gemini `fileData` con URL YouTube (low res + clip) | riassunti/estrazione da video | sì |
| `wrangler versions upload` per test con secret reali | debug prod senza deploy | sì (Cloudflare) |
| Campo opzionale salvato solo se valorizzato | evoluzioni schema senza migrazione | sì |
| Wrangler Pages con Global API Key | `EMAIL`+`API_KEY`, non `API_TOKEN` Bearer | sì (Cloudflare) |

