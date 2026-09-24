#!/usr/bin/env bash
# Deploy = GitHub push + Cloudflare Worker + Cloudflare Pages.
# Refuses to deploy anything that is not committed AND pushed to GitHub,
# so production always matches a commit on GitHub.
#
# Usage: npm run deploy            (from repo root)
#        SKIP_WORKER=1 npm run deploy   (Pages only)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WORKER_URL="https://recipe-book-worker.petruzzo-massimiliano-b40.workers.dev"
PAGES_PROJECT="recipe-book"
PAGES_URL="https://recipe-book-ap1.pages.dev"
WRANGLER="$ROOT/node_modules/.bin/wrangler"
[ -x "$WRANGLER" ] || WRANGLER="npx wrangler"

# Cloud Agent secret CLOUDFLARE_API_TOKEN actually holds a Global API Key (needs email + key auth).
if [ -z "${CLOUDFLARE_API_KEY:-}" ] && [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -n "${CLOUDFLARE_EMAIL:-}" ]; then
  export CLOUDFLARE_API_KEY="$CLOUDFLARE_API_TOKEN"
  unset CLOUDFLARE_API_TOKEN
fi

echo "▶ 1/4 GitHub"
if [ -n "$(git status --porcelain)" ]; then
  echo "✘ Ci sono modifiche non committate. Fai commit prima del deploy:"
  git status --short
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
pushed=0
for delay in 0 4 8 16 32; do
  [ "$delay" -gt 0 ] && { echo "  push fallito, riprovo tra ${delay}s…"; sleep "$delay"; }
  if git push -u origin "$BRANCH"; then pushed=1; break; fi
done
[ "$pushed" -eq 1 ] || { echo "✘ Push su GitHub non riuscito: deploy annullato."; exit 1; }

git fetch -q origin "$BRANCH"
SHA="$(git rev-parse HEAD)"
if [ "$SHA" != "$(git rev-parse "origin/$BRANCH")" ]; then
  echo "✘ GitHub (origin/$BRANCH) non coincide con il commit locale: deploy annullato."
  exit 1
fi
SHORT="$(git rev-parse --short HEAD)"
SUBJECT="$(git log -1 --format=%s)"
echo "  ✓ GitHub aggiornato: $BRANCH @ $SHORT"

# Production = main: keep GitHub main on the deployed commit (fast-forward only, never force).
if [ "$BRANCH" != "main" ]; then
  git fetch -q origin main || true
  if git merge-base --is-ancestor origin/main HEAD 2>/dev/null; then
    if git push origin "HEAD:main"; then
      echo "  ✓ GitHub main allineato a $SHORT"
    else
      echo "  ⚠ Push su main non riuscito: main resta indietro (il deploy prosegue dal branch $BRANCH)"
    fi
  else
    echo "  ⚠ main su GitHub ha commit non presenti in $BRANCH: nessun merge automatico, allinearlo a mano"
  fi
fi

if [ -z "${SKIP_WORKER:-}" ]; then
  echo "▶ 2/4 Worker"
  (cd worker && $WRANGLER deploy)
else
  echo "▶ 2/4 Worker saltato (SKIP_WORKER=1)"
fi

echo "▶ 3/4 Build frontend"
(cd frontend && \
  VITE_WORKER_URL="$WORKER_URL" \
  VITE_DROPBOX_REDIRECT_URI="$PAGES_URL/dropbox-callback" \
  VITE_APP_ENV=production \
  npx vite build)

echo "▶ 4/4 Pages"
(cd frontend && $WRANGLER pages deploy dist \
  --project-name="$PAGES_PROJECT" \
  --branch=main \
  --commit-hash="$SHA" \
  --commit-message="$SUBJECT" \
  --commit-dirty=false)

echo "✓ Deploy completato da GitHub $BRANCH @ $SHORT — $PAGES_URL"
