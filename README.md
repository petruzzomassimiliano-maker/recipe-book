# Recipe Book

Ricettario di famiglia (PWA): ricette per utente, lista spesa, import da URL/YouTube/foto, con vault su **Dropbox** e API su **Cloudflare Worker**.

**Repo:** https://github.com/petruzzomassimiliano-maker/recipe-book  
**App (prod):** https://recipe-book-ap1.pages.dev  
**API (prod):** https://recipe-book-worker.petruzzo-massimiliano-b40.workers.dev

---

## Cosa fa

- CRUD ricette (manuali + import da sito, YouTube, foto con Gemini)
- Porzioni scalabili, metodi cottura, nutrizione
- Lista spesa condivisa sul vault famiglia
- Ruoli **owner / admin / member** (JWT + RBAC)
- Inviti monouso (link da copiare, niente email)
- Reset/recupero password (staff + frase di recupero)
- Foto ricetta da URL, fotocamera o file (salvate su Dropbox)
- UI mobile-friendly (tab bar, liste dense, checklist spesa)

---

## Stack

| Parte | Tecnologia |
|-------|------------|
| Frontend | React + Vite + Tailwind + PWA |
| Backend | Cloudflare Worker (Hono) |
| Storage | Dropbox App Folder (JSON + immagini) |
| AI | Google Gemini (scrape assistito, vision, chat) |
| Hosting | Cloudflare Pages + Workers |

Monorepo npm workspaces: `frontend/` e `worker/`.

---

## Avvio locale

**Requisiti:** Node.js 18+, npm, account Dropbox (app OAuth), chiave Gemini (opzionale ma utile per import).

```bash
git clone https://github.com/petruzzomassimiliano-maker/recipe-book.git
cd recipe-book
npm install

cp frontend/.env.example frontend/.env.local
cp worker/.dev.vars.example worker/.dev.vars
# Compila i valori (Dropbox, JWT, Gemini…)

npm run dev
# Frontend http://localhost:5173
# Worker   http://localhost:8787
```

Nella Dropbox App aggiungi redirect URI:

- Locale: `http://localhost:5173/dropbox-callback`
- Prod: `https://recipe-book-ap1.pages.dev/dropbox-callback`

Al primo accesso completa il setup famiglia (owner + refresh token Dropbox). Dettagli in `RECIPE_BOOK_QUICKSTART.md`.

### Script utili

```bash
# Elenco utenti / reset password owner (usa worker/.dev.vars)
node scripts/reset-owner-password.mjs --list
node scripts/reset-owner-password.mjs --password 'NuovaPass8+'
```

---

## Deploy

**Regola:** ogni deploy su Cloudflare deve corrispondere a un commit già su GitHub.

```bash
git add -A && git commit -m "…"
npm run deploy                 # push GitHub → Worker → build → Pages (con hash del commit)
SKIP_WORKER=1 npm run deploy   # solo frontend
```

`scripts/deploy.sh` si ferma se ci sono modifiche non committate o se il push su GitHub fallisce, così la produzione non contiene mai codice assente da GitHub.

I secret del Worker (Dropbox, JWT, Gemini, `FAMILY_DROPBOX_REFRESH_TOKEN`, …) vanno impostati con `wrangler secret put`, non nel repo.

---

## Struttura

```
frontend/     PWA React (Vite)
worker/       API Hono + scrapers + Dropbox
scripts/      utilità (reset password, token, …)
PROGRESS.md   diario di sviluppo (leggere all’inizio sessione)
```

---

## Documentazione

| File | Contenuto |
|------|-----------|
| [PROGRESS.md](./PROGRESS.md) | Stato moduli + log sessioni |
| [RECIPE_BOOK_QUICKSTART.md](./RECIPE_BOOK_QUICKSTART.md) | Setup dettagliato |
| [RECIPE_BOOK_ARCHITECTURE.md](./RECIPE_BOOK_ARCHITECTURE.md) | Architettura |

---

## Sicurezza

Non committare mai:

- `worker/.dev.vars`
- `frontend/.env.local`
- token Dropbox, JWT secret, API key Gemini

Sono già in `.gitignore`.
