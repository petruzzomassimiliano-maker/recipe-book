# Recipe Book

Ricettario di famiglia (PWA): **nessun account**, chiunque apra il sito vede tutte le ricette; per aggiungere/modificare/importare serve un **PIN di famiglia**. Vault su **Dropbox**, API su **Cloudflare Worker**.

**Repo:** https://github.com/petruzzomassimiliano-maker/recipe-book  
**App (prod):** https://recipe-book-ap1.pages.dev  
**API (prod):** https://recipe-book-worker.petruzzo-massimiliano-b40.workers.dev

---

## Cosa fa

- Consultazione libera di tutte le ricette, senza login
- CRUD ricette (manuali + import da sito, YouTube, foto con Gemini) — **con PIN di famiglia**
- Porzioni scalabili, metodi cottura, nutrizione, chat IA sulla ricetta (IA con PIN: consuma quota Gemini)
- Foto ricetta da URL, fotocamera o file (salvate su Dropbox)
- UI mobile-friendly (tab bar, liste dense)

### PIN di famiglia

- Il PIN è il secret `EDIT_PIN` del Worker: `cd worker && npx wrangler secret put EDIT_PIN`
- Senza `EDIT_PIN` il sito è in sola lettura.
- Inserito una volta (pulsante «Modifica» in alto), il dispositivo riceve un token valido 1 anno.
- Cambiare `EDIT_PIN` invalida subito tutti i dispositivi sbloccati.
- Usa un PIN lungo (es. una frase): un tentativo errato costa ~1,5 s ma non c'è un limite di tentativi.

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

Dropbox si collega solo tramite il secret `FAMILY_DROPBOX_REFRESH_TOKEN` (in locale: `node scripts/set-family-dropbox-token.mjs '<token>'`). Il vecchio setup via browser è stato rimosso perché permetteva a chiunque di sostituire il Dropbox di famiglia.

---

## Deploy

**Regola:** ogni deploy su Cloudflare deve corrispondere a un commit già su GitHub.

```bash
git add -A && git commit -m "…"
npm run deploy                 # push GitHub → Worker → build → Pages (con hash del commit)
SKIP_WORKER=1 npm run deploy   # solo frontend
```

`scripts/deploy.sh` si ferma se ci sono modifiche non committate o se il push su GitHub fallisce, così la produzione non contiene mai codice assente da GitHub. Se lavori su un branch, porta anche `main` su GitHub allo stesso commit (solo fast-forward: se `main` ha commit diversi avvisa e non tocca nulla).

I secret del Worker (Dropbox, JWT, Gemini, `FAMILY_DROPBOX_REFRESH_TOKEN`, `EDIT_PIN`, …) vanno impostati con `wrangler secret put`, non nel repo.

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
