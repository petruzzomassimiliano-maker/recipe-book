# PROGRESS.md — Recipe Book PWA

> **Aggiorna questo file alla fine di ogni sessione dev**
> **All'inizio della sessione successiva, leggi QUESTO file prima di qualsiasi altra cosa**

---

## Indice moduli

| Modulo | Sezione principale | Stato |
|--------|-------------------|-------|
| **OAuth Dropbox PKCE** | «Sessione init» | ✅ Done |
| **Dropbox schema + Zustand** | «Sessione init» | ✅ Done |
| **Recipe CRUD (manual add)** | «Sessione 2» | ⏳ Pending |
| **Web Scraper (AllRecipes)** | «Sessione 3» | ⏳ Pending |
| **Gemini recipe recognition** | «Sessione X» | ⏳ Pending |
| **FatSecret integration** | «Sessione X» | ⏳ Pending |
| **Shopping list feature** | «Sessione X» | ⏳ Pending |
| **Material Design 3 UI** | «Sessione X» | ⏳ Pending |
| **Multi-user + RBAC** | «Sessione X» | ⏳ Pending |
| **PWA + offline sync** | «Sessione X» | ⏳ Pending |
| **Deploy prod** | «Sessione X» | ⏳ Pending |

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
| frontend/src/pages/Home.jsx | **Nuovo** |
| frontend/src/pages/DropboxCallback.jsx | **Nuovo** |
| frontend/src/pages/NotFound.jsx | **Nuovo** |
| frontend/src/components/common/Navbar.jsx | **Nuovo** |
| frontend/src/styles/index.css | **Nuovo** |
| frontend/.env.example | **Nuovo** |
| frontend/public/manifest.json | **Nuovo** |

**Deploy:** ✅ Locale setup (richiede credenziali Dropbox reali per test)

---

## Prossimi Passi

- [ ] Utente compila worker/.dev.vars con credenziali Dropbox + Gemini
- [x] npm install in frontend + worker
- [ ] Test OAuth locale: npm run dev (:5173) + wrangler dev (:8787)
- [ ] Verifica Dropbox folder /Apps/Recipe Book/ creato
- [ ] Sessione 2: Recipe CRUD + Dropbox schema
