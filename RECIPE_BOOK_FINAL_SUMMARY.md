# 🍳 Recipe Book PWA — Final Summary & Next Steps

---

## 📦 Cosa hai ricevuto

### 1. **RECIPE_BOOK_ARCHITECTURE.md** (completo)
- Visione progetto + target users
- Tech stack (Vite + Hono + Dropbox + Gemini)
- Architettura monorepo
- Struttura Dropbox (folder + JSON schema)
- Autenticazione multi-user + RBAC
- Integrazioni esterne (Gemini, FatSecret, web scraper)
- Feature list MVP vs Future
- Schema UI/UX Material Design 3
- Workflow dev

**👉 LEGGERE PRIMA DI CODING**

### 2. **RECIPE_BOOK_PROGRESS_TEMPLATE.md**
- Template PROGRESS.md per documentare sessione per sessione
- Sessione init (Setup boilerplate + OAuth) completamente scritta
- Template per sessioni successive

**👉 COPIACOLLA IN `PROGRESS.md` DEL REPO; AGGIORNA OGNI SESSIONE**

### 3. **recipe-book-cursor-rules.mdc**
- Golden rules (non negoziabili)
- File structure conventions (dove mettere ogni file)
- Deployment checklist
- Code style + naming conventions
- Environment variables setup
- Testing checklist
- Git workflow
- Common pitfalls

**👉 IMPORTA IN `.cursor/rules/` DEL REPO; SEGUIRE RIGIDAMENTE**

### 4. **RECIPE_BOOK_QUICKSTART.md**
- Setup in 10–15 minuti
- Credenziali Dropbox/Gemini/GitHub/Cloudflare
- Comandi localhost startup
- First OAuth test
- Troubleshooting

**👉 ESEGUIRE PRIMA DI PRIMO CODING RUN**

---

## 🎯 Raccomandazioni Specifiche (PER TE)

### Cosa riutilizzare da EN Writing Coach

**COPIACOLLA DIRETTAMENTE (no modifiche):**

1. **`worker/src/lib/dropboxClient.js`** — OAuth PKCE, token exchange, file ops
2. **`frontend/src/store/authStore.js`** — Zustand persist pattern
3. **`frontend/src/hooks/useAuth.js`** — login/logout logic
4. **`worker/wrangler.toml`** — base Worker config
5. **`frontend/vite.config.js`** — Vite setup
6. **`.cursor/rules/deploy-github-cloudflare.mdc`** — deploy workflow (aggiorna URLs)
7. **`frontend/tailwind.config.js`** — Tailwind config (adatta colori Material Design 3)
8. **Service worker setup** — workbox precaching pattern

**ADATTA (piccole modifiche):**

1. **Prompts Gemini** — cambiano da "writing analysis" a "recipe parsing"
2. **Dropbox folder structure** — da `/sessions` a `/recipes`, `/shopping-lists`
3. **RBAC** — più semplice (solo superUser vs user, vs EN Writing Coach che ha placement/livelli)
4. **UI colors** — Material Design 3 (FF6B6B primary vs EN Writing Coach blues)
5. **Zustand stores** — recipes, shopping-list, preferences (vs en-writing-coach sessions, profile, etc.)

### IDE Consigliato

Menzioni "Google Anigravity" — non sono sicuro cosa sia. Presumo intendi:

1. **Cursor** — ✅ Consigliato (integra Claude + codebase intelligence)
2. **Claude Code** (desktop app) — ✅ Consigliato (accesso file system completo)
3. **VS Code + Cline extension** — ✅ Funziona, ma Cursor è meglio
4. **Gemini Code Execution** (Google) — ⏳ Possibile, ma meno integrazioni

**Consiglio:** Usa **Cursor** per sessioni di dev; quando serve sessione long-form (refactor, architecture), passa a **Claude Code** (desktop) per accesso file completo.

### Workflow Setup IDE

**Cursor:**

```bash
# Apri progetto in Cursor
cursor recipe-book/

# Che fa Cursor:
# 1. Legge .cursor/rules/*.mdc automaticamente
# 2. Indexa codebase (instant search + jump to def)
# 3. Integra chat Claude inline (Ctrl+K)
```

**Rules da aggiungere in `.cursor/rules/`:**

1. Copia `recipe-book-cursor-rules.mdc` (quello che hai ricevuto)
2. Crea `.cursor/project-context.md`:
   ```markdown
   # Recipe Book PWA — Project Context
   
   - **Architecture:** Vite + React (frontend) + Hono on Cloudflare (backend)
   - **Storage:** Dropbox API (OAuth PKCE) — `/Apps/Recipe Book/`
   - **AI:** Gemini 2.0 (vision + text)
   - **Database:** JSON files in Dropbox (recipes, users, shopping-lists)
   - **Deploy:** GitHub → Cloudflare Pages (frontend) + Workers (API)
   - **Team:** Solo dev (te); multi-user app (mamma, papà, sorella)
   
   ## Quick Links
   - PROGRESS.md — session log
   - RECIPE_BOOK_ARCHITECTURE.md — design doc
   - recipe-book-cursor-rules.mdc — dev rules
   ```

---

## 💡 Features Aggiuntive Suggerite (Beyond MVP)

### Low-hanging fruit (2–3 sessioni extra)

| # | Feature | Stima | Value | Priorità |
|---|---------|-------|-------|----------|
| **a** | Allergen tags (gluten-free, vegan, nut-free) | 2h | Alto | 🟠 |
| **b** | Recipe favorites / star system | 1h | Medio | 🟡 |
| **c** | Quick filters (prep time, difficulty) | 2h | Medio | 🟠 |
| **d** | Print/export recipe (PDF) | 3h | Basso | 🟡 |
| **e** | Ingredient substitution suggestions (Gemini) | 4h | Medio | 🟠 |
| **f** | Weekly meal planner (drag & drop ricette) | 5h | Alto | 🟠 |
| **g** | Barcode scan → auto ingredient recognition | 4h | Medio | 🟡 |
| **h** | Recipe ratings + family comments | 3h | Medio | 🟠 |
| **i** | Auto-schedule shopping based on meal plan | 4h | Alto | 🟠 |
| **j** | Recipe scaling (2 porzioni → 10 porzioni) | 2h | Alto | 🟠 |

### Più complesse (future v1.1+)

- **Instagram Reels scraper** — richiede browser automation (Puppeteer/Selenium)
- **Multi-language recipes** — EN + IT side-by-side
- **Social sharing** — public recipe link (con rate limiting)
- **Notion/OneNote backup** — export recipes
- **Nutritionist integration** — API partner (paid)

---

## ⏰ Roadmap Temporale Stimato

### Sprint 0: Setup (1 sessione, 2–3 ore)

- ✅ Monorepo boilerplate
- ✅ OAuth Dropbox
- ✅ Zustand stores
- ✅ Basic components (Login, Home)

**Output:** App lancia, login funziona, Dropbox connesso

### Sprint 1: Recipe CRUD (2 sessioni, 6–8 ore)

- ✅ Recipe model + schema JSON
- ✅ Add recipe manuale (form 3-step)
- ✅ Edit/Delete ricette
- ✅ Recipe list + search
- ✅ Recipe detail page

**Output:** Puoi aggiungere ricette, vederle, modificarle

### Sprint 2: Web Scraper (2 sessioni, 8–10 ore)

- ✅ AllRecipes.com scraper
- ✅ Gemini validation + cleanup
- ✅ Giallozafferano.it + BBC Good Food
- ✅ URL input form
- ✅ Error handling + retry

**Output:** Paste URL → ricetta auto-estratta

### Sprint 3: Calorie Tracking (1–2 sessioni, 4–6 ore)

- ✅ FatSecret API integration
- ✅ Nutrition cache (Dropbox)
- ✅ Display nutrition info per ricetta
- ✅ Manual override per ingredienti

**Output:** Vedi calorie/protein/fat/carbs per ricetta

### Sprint 4: Shopping List (1 sessione, 3–4 ore)

- ✅ Shopping list CRUD
- ✅ Add da ricetta (multi-select ingredienti)
- ✅ Check/uncheck item
- ✅ Clear/archive lista

**Output:** Shopping list funzionante

### Sprint 5: YouTube Parser (1–2 sessioni, 4–6 ore)

- ✅ YouTube Transcript API
- ✅ Gemini parsing transcript
- ✅ Thumbnail + metadata
- ✅ Error handling (private videos, etc.)

**Output:** Paste video YouTube → ricetta estratta

### Sprint 6: Multi-user + Admin (2 sessioni, 6–8 ore)

- ✅ User invite flow
- ✅ RBAC middleware (Worker)
- ✅ Admin panel (superUser)
- ✅ User settings + preferences
- ✅ Shared recipes toggle

**Output:** Mamma/papà/sorella hanno account; tu puoi managerli

### Sprint 7: Personalizzazione + PWA (1–2 sessioni, 4–6 ore)

- ✅ Theme (light/dark/auto)
- ✅ Font selection
- ✅ Color accent picker
- ✅ Custom logo upload (optional)
- ✅ Service worker + offline sync
- ✅ "Add to home screen" (PWA install)

**Output:** App bella, personalizzabile, funziona offline

### Sprint 8: Polish + Deploy (1 sessione, 3–4 ore)

- ✅ UI review + responsive fix
- ✅ Accessibility check (WCAG)
- ✅ Performance optimization
- ✅ Error boundary + error messages chiari
- ✅ Produzione final deploy
- ✅ Beta test con famiglia

**Output:** Versione 1.0 pronta produzione

---

**Total:** ~10–12 sessioni dev = ~40–50 ore = 1–2 mesi (1–2 sessioni/settimana)

---

## 📋 Checklist Pre-Avvio

Prima di aprire l'IDE:

### 1. Infrastruttura
- [ ] GitHub repo creato (public/private, README?)
- [ ] Cloudflare account attivo
- [ ] Dropbox account personale (famiglia)

### 2. Credenziali
- [ ] Dropbox dev app creato → key + secret salvati
- [ ] Gemini API key creato → salvato
- [ ] GitHub token per CI (future)
- [ ] Cloudflare API token (future)

### 3. Locale
- [ ] Node.js 18+ (`node -v`)
- [ ] pnpm 8+ (`pnpm -v`)
- [ ] Cursor / VS Code + Cline installato
- [ ] Git configurato (`git config --global user.name`)

### 4. Documentazione
- [ ] RECIPE_BOOK_ARCHITECTURE.md letto
- [ ] RECIPE_BOOK_QUICKSTART.md eseguito (test OAuth?)
- [ ] recipe-book-cursor-rules.mdc copiato in `.cursor/rules/`
- [ ] PROGRESS.md template copiato in repo

### 5. IDE
- [ ] Apri `/recipe-book` in Cursor
- [ ] Cursor riconosce `.cursor/rules/*.mdc`
- [ ] Chat Claude (Ctrl+K) funziona

### 6. First Dev Session
- [ ] Leggi PROGRESS.md (la bozza che avrai copiato)
- [ ] Avvia `frontend: npm run dev` + `worker: wrangler dev`
- [ ] Accedi http://localhost:5173 → Dropbox OAuth
- [ ] Verifica Dropbox folder `/Apps/Recipe Book/` creato

---

## 🤔 FAQs

### Q: Posso sviluppare tutto da mobile?
**A:** No. Serve PC/Mac con Node.js, IDE, terminal. Dopo che app è deployata, puoi usarla da mobile.

### Q: Mamma/papà/sorella come accedono?
**A:** Tu estendi invite link (con inviteCode). Loro clicca → OAuth Dropbox → hanno account. Vedi PROGRESS.md Sessione 6 (multi-user).

### Q: Cosa se Gemini quota finisce?
**A:** API free ha 1M token/mese (enough MVP). Se finisce:
- Upgrade a paid tier (Google Cloud)
- Implementa fallback Groq (free)
- Chiedi feedback MVP prima di scale up

### Q: Posso usare database vero (Firebase, Supabase) invece Dropbox?
**A:** Possibile, ma perdi:
- Zero backend infrastructure (tutto Dropbox)
- Family can access files directly (web.dropbox.com)
- No DB costs (Dropbox piano free)
Dropbox è scelta intelligente per MVP family app.

### Q: E se voglio Instagram scraper?
**A:** Complex. Richiede:
- Puppeteer (browser automation server-side)
- Instagram detection (username → profile)
- Reel description parsing
- Screen recording → image → Gemini vision
**Suggerimento:** Fai come MVP workaround: "copia-incolla URL reel + description manualmente". Aggiungi Instagram scraper in v1.1 se c'è demand.

### Q: Offline mode — cosa succede?
**A:** PWA caches UI + app shell. Puoi navigare, cercare ricette local. Quando torni online, Zustand synca automaticamente a Dropbox (debounce 1.2s). Non perdi niente.

### Q: Posso condividere ricetta con amico (non famiglia)?
**A:** MVP solo famiglia (Dropbox app folder). Per v1.1, aggiungi "public link sharing" — ricetta pubblica con slug unico, view-only.

---

## 📞 Getting Help

**Se bloccato:**

1. **Leggi PROGRESS.md** — 80% dei problemi son già stati riscontrati
2. **Check recipe-book-cursor-rules.mdc** — naming, setup, troubleshooting
3. **Google error message** (copy-paste verbatim da console)
4. **Leggi docs:** Dropbox, Gemini, Hono, Zustand, Tailwind
5. **Chiedi Claude** — passa a Claude Code (long-form debug session)

---

## 🚀 You're Ready!

### Prossimi 3 step:

1. **Esegui QUICKSTART.md** — setup locale + first OAuth test
2. **Apri Cursor** + PROGRESS.md template
3. **Start Sessione 1:** "Setup boilerplate OAuth Dropbox" (già scritta in PROGRESS.md)

---

## 📎 Appendice: File Structure @ Start

```
recipe-book/
├── .cursor/
│   ├── rules/
│   │   ├── recipe-book-dev.mdc       (HO CREATO)
│   │   └── project-context.md        (TU CREI)
│   └── .gitignore
├── .github/
│   └── workflows/
│       └── deploy.yml                (FUTURE)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   ├── recipe/
│   │   │   ├── shopping-list/
│   │   │   ├── settings/
│   │   │   └── common/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── store/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── styles/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   │   ├── manifest.json
│   │   └── icons/
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── .env.example
├── worker/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── recipes.js
│   │   │   ├── users.js
│   │   │   ├── gemini.js
│   │   │   ├── scrapers.js
│   │   │   ├── youtube.js
│   │   │   ├── fatsecret.js
│   │   │   └── health.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── rbac.js
│   │   │   └── errorHandler.js
│   │   ├── lib/
│   │   │   ├── dropboxClient.js
│   │   │   ├── geminiClient.js
│   │   │   ├── fatsecretClient.js
│   │   │   ├── scrapers/
│   │   │   ├── youtubeTranscript.js
│   │   │   └── migrations/
│   │   ├── index.js
│   │   └── env.d.ts
│   ├── wrangler.toml
│   ├── .dev.vars.example
│   └── package.json
├── .gitignore                         (TU CREI)
├── package.json                       (root, pnpm workspaces)
├── PROGRESS.md                        (TU CREI da template)
├── README.md                          (TU CREI)
└── ...received docs
    ├── RECIPE_BOOK_ARCHITECTURE.md    (HO CREATO)
    ├── RECIPE_BOOK_PROGRESS_TEMPLATE.md (HO CREATO)
    ├── recipe-book-cursor-rules.mdc   (HO CREATO)
    ├── RECIPE_BOOK_QUICKSTART.md      (HO CREATO)
    └── RECIPE_BOOK_FINAL_SUMMARY.md   (QUESTO FILE)
```

---

**Good luck! 🍳🚀**

> Questions? Re-read ARCHITECTURE.md + QUICKSTART.md.  
> Everything is documented. You got this! 💪
