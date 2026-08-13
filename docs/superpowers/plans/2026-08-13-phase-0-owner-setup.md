# Phase 0 — Owner Setup

**Executed by:** Jon, not an agent. Everything here needs a browser login or a credential only you hold.

**Goal:** Provision Vercel, Neon, Vercel Blob, Clerk and an Auth0 Management application, and capture the two artifacts that become unrecoverable once Heroku is retired — a production database dump and the API contract fixtures.

**Time:** roughly 60–90 minutes. Clerk (Task 5) is the longest and the only one with a real decision embedded in it.

**Gate:** `vercel env ls` shows every key in the checklist at the end, and `.local/prod-dump.dump` plus `fixtures/` exist locally.

> **Sensitive variables cannot be pulled.** Vercel's Sensitive type is write-only. Verification is by *presence* in `vercel env ls`, not by reading values. Connection strings needed locally come from each provider's own console and live in the gitignored `.local/`.

> **Do these in order.** Task 1 creates the Vercel project that Tasks 2–4 attach storage to. Task 7 must happen before anything touches Heroku.

---

## Task 0: Prerequisites

- [x] **Step 1: Install the CLIs**

```bash
npm i -g vercel
```

Postgres client tools are installed in Step 2 — do not install a Postgres server.

- [x] **Step 2: Install a Postgres client that can read the dump**

`heroku pg:backups:capture` runs `pg_dump` **server-side** on Heroku, so your local `pg_dump` version does not matter. What matters is **`pg_restore`**, used locally in Task 7 Step 2 and again in Phase 2 Task 1 to restore into Neon.

`pg_restore` must be **at least** the Postgres major version of the dump's source server. A v15 client reading a v16 dump fails with `unsupported version in file header`.

`pg_restore` is backward-compatible, so a v17-or-newer client covers every case — it reads dumps from 15, 16 or 17, and talks to whatever major version Neon provisions.

**Install `libpq`, not `postgresql@17`.** All local databases in this project run in Docker (see Phase 1). `libpq` is the client-only formula — `psql`, `pg_dump`, `pg_restore` — with no server binaries and nothing that can be started as a background service by accident.

```bash
brew install libpq
brew unlink postgresql@15 2>/dev/null || true
brew unlink postgresql@16 2>/dev/null || true
echo 'export PATH="$(brew --prefix libpq)/bin:$PATH"' >> ~/.zshrc
exec zsh
```

Verify:

```bash
pg_dump --version      # expect 17.x or newer (Homebrew currently ships 18.x)
pg_restore --version   # same
which psql             # expect /opt/homebrew/opt/libpq/bin/psql, not /opt/homebrew/bin/psql
```

If you already installed `postgresql@17`, it does no harm — just never run `brew services start postgresql@17`. To remove it: `brew uninstall postgresql@17`.

> **No native Postgres server runs on this machine.** Local development and test databases are Docker containers. The only local Postgres binaries are client tools.

- [ ] **Step 2b: Set up TablePlus connections (optional but recommended)**

TablePlus is the inspection tool for this project. It **cannot** restore the custom-format `.dump` from Heroku — that stays `pg_restore` — but it is the right tool for reviewing the introspected schema in Phase 2 Task 2, and for spot-checking data after the restore.

Save two connections:

| Name                | Source                                                         | SSL                                                |
| ------------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| `cinemadraft-neon`  | paste `DATABASE_URL` from `.env.local` via **Import from URL** | **require** — Neon rejects unencrypted connections |
| `cinemadraft-local` | `localhost:5432`, credentials from `docker-compose.local.yml`  | off                                                |

The local connection only works after P1.T8 creates the container.

- [x] **Step 3: Log in to Vercel**

```bash
vercel login
```

- [x] **Step 4: Confirm Heroku access**

```bash
heroku auth:whoami
heroku pg:info --app <your-heroku-app-name>
```

Write the app name down — Task 7 needs it.

---

## Task 1: Vercel project

- [ ] **Step 1: Link the repo**

From `/Users/jonbernard/Development/cinemadraft-nextjs`:

```bash
vercel link
```

The project already existed and was linked rather than created. **Project name: `cinemadraft-nextjs`** (id `prj_6AQy9PCklalfMLCMHSuRDtAgEzfK`, org `team_KKQyxHG0EC4qRhCVurwdV3ZX`). It is linked in _repo_ mode — `.vercel/repo.json`, not `project.json`.

Because the project pre-existed the restart, it was audited for leftovers from the abandoned scaffold:

| Env var                   | Age  | Verdict                                                                                                                               |
| ------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SENDGRID_KEY`       | 508d | **Dead** — NextAuth email provider. Clerk handles its own email. Remove with `vercel env rm AUTH_SENDGRID_KEY`, or revoke in SendGrid |
| `NEXT_PUBLIC_ACTIVE_YEAR` | 509d | **Keep** — already on Task 8's list. Verify the value is the current season                                                           |

No `DATABASE_URL` was present, so Task 2 provisions Neon into a clean slate.

- [x] **Step 2: Connect the Git repository**

Vercel dashboard → the `cinemadraft` project → **Settings → Git** → connect the GitHub repo. Set the production branch to `main`.

- [x] **Step 3: Staging domain — `next.cinemadraft.com`**

Already configured. This is the working domain for the entire build, and the parallel-run domain in phase 12.

**`cinemadraft.com` is deliberately NOT added to Vercel yet.** It stays pointed at Heroku, serving the live site, until phase 13. Adding it now would only show as misconfigured and create the temptation to "fix" it.

Using a stable subdomain rather than preview URLs matters for one specific reason: the Clerk webhook (Task 5, Step 6). Vercel preview URLs change on every deployment, so a webhook pointed at one breaks constantly. `next.cinemadraft.com` is stable from phase 4 through cutover.

- [x] **Step 4: Set the Node version**

**Settings → General → Node.js Version** → `24.x`. Already set.

Phase 1 pins the same version in `package.json` `engines` and `.nvmrc`. A mismatch between the Vercel setting and `engines` fails the build rather than silently using the wrong runtime, which is the behavior we want.

---

## Task 2: Neon Postgres ✅ complete — PG 17.10, empty, reachable

- [x] **Step 1: Provision through the Vercel Marketplace**

Vercel dashboard → the project → **Storage** tab → **Create Database** → **Neon**.

Provisioning through the Marketplace rather than neon.tech directly matters: the integration injects `DATABASE_URL` into the Vercel environment automatically, and keeps it in sync.

- [x] **Step 2: Confirm the free plan**

Select the **Free** plan. Confirm before completing — the dialog sometimes preselects a paid tier.

- [x] **Step 3: Enable preview branching**

In the Neon integration settings, enable **Create a database branch for each preview deployment**. This gives every pull request an isolated database and costs nothing on the free tier.

- [x] **Step 4: Verify the variables attached**

```bash
vercel env ls
```

Expected: `DATABASE_URL`, `POSTGRES_PRISMA_URL`, `PGHOST` and friends, all typed **Sensitive**, in **Production and Preview**.

Two things about this that are easy to misread as failures:

**Development is intentionally absent.** Local development and tests run against the Docker container (Phase 1 T8), never Neon. Pointing a local shell at production data is exactly the accident worth preventing.

**`vercel env pull` cannot retrieve the values.** Vercel treats Sensitive variables as write-only — the pulled file contains `DATABASE_URL="[SENSITIVE]"`, and the dashboard will not reveal them either. This does not affect the deployed app, which receives the real values at runtime. It only means the CLI is not how you obtain the connection string.

- [x] **Step 5: Get the connection string from the Neon console**

Vercel **Storage** tab → the Neon store → **Open in Neon** → **Connection Details** → copy the **pooled** connection string.

Save it for the one-off restore work in Phase 2:

Save the whole connection block Neon offers as `.env.neon` in the repo root — it is covered by the existing `.env*` ignore rule. It gives you `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct), and Phase 2 needs both: pooled for the app, **unpooled for `pg_restore` and `prisma migrate`**, which do not work correctly through a connection pooler.

This file is a local convenience for restore and introspection; the deployed app never reads it.

- [x] **Step 6: Confirm you can reach it**

```bash
psql "$(grep '^DATABASE_URL=' .env.neon | cut -d= -f2- | tr -d '"')" -tAc 'select version();'
```

Expected: a PostgreSQL version string. Record the major version in `docs/PROGRESS.md` alongside Heroku's 17.9.

---

## Task 3: Caching ✅ nothing to provision

Originally "provision Upstash Redis". **Removed (D23).**

Upstash no longer offers a free tier through the Vercel Marketplace — the smallest plan is pay-as-you-go and requires a credit card, which violates the free-only constraint.

The **Vercel Runtime Cache** covers the need and is included with the platform: a per-region key-value store with tag-based invalidation, callable from Functions, and targeted natively by Next.js 16 via `'use cache: remote'`. No integration, no keys, no card.

Pub/sub for phase 14 realtime is a separate question, deliberately deferred to that phase. It is not on the cutover path — polling ships at phase 13.

---

## Task 4: Vercel Blob

- [ ] **Step 1: Create the store**

**Storage** tab → **Create** → **Blob**. Name it `cinemadraft-media`.

- [ ] **Step 2: Verify the variables landed**

```bash
vercel env ls | grep -i blob
```

Connecting the store injects `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY`, both non-sensitive, to Production and Preview.

**There is no `BLOB_READ_WRITE_TOKEN`, and none is needed.** Vercel Blob on this account authenticates via **OIDC**: the CLI and SDK use `VERCEL_OIDC_TOKEN` together with `BLOB_STORE_ID`. The CLI is explicit about the pairing — "must both be set, or both be unset."

- [ ] **Step 2b: Enable OIDC for the Development environment**

Blob operations from a local shell fail out of the box:

```
Error: Vercel Blob: OIDC is enabled for this project, but not for the "development" environment.
```

OIDC is scoped per environment and Development is off by default. Two changes make local Blob work:

1. Dashboard → project → **Settings → Security** → the OIDC / Secure Backend Access section → enable **Development**.
2. Add the store id to Development so both halves of the pair are present locally:

```bash
vercel env add BLOB_STORE_ID development
```

Verify:

```bash
vercel env pull .env.local --yes
vercel blob list
```

Expected: an empty listing rather than an auth error.

This matters for phase 11, whose migration script reads existing Cloudinary avatars and uploads them to Blob from a local shell. Without Development OIDC, that script cannot authenticate.

- [ ] **Step 3: Note the public hostname**

The store's public URL looks like `https://<id>.public.blob.vercel-storage.com`. Phase 11 needs it for `next/image` remote patterns. Record it in `docs/PROGRESS.md` under the Phase 0 notes.

---

## Task 5: Clerk

The longest task, and the one where a mistake is expensive. Read Step 3 fully before doing it.

- [ ] **Step 1: Create the application**

[dashboard.clerk.com](https://dashboard.clerk.com) → **Create application**. Name it `Cinemadraft`.

- [ ] **Step 2: Find out what Auth0 is actually using**

Before choosing connections, open the Auth0 dashboard → **Authentication → Social** and → **Authentication → Database**. Write down every enabled connection.

This is the step that protects existing users. If Auth0 has Google enabled and Clerk does not, every Google user who signs in after cutover gets a **brand new identity** instead of their existing account, silently — with no leagues, no drafts, no history. It will look like data loss and it will not be obvious why.

- [ ] **Step 3: Enable exactly those connections in Clerk**

Clerk → **User & Authentication → Social Connections**. Enable each connection you wrote down in Step 2. Match them exactly — not more, not fewer.

Also enable **Email address** as an identifier, since the import and the webhook both key on email.

- [ ] **Step 4: Configure URLs**

Clerk → **Paths**:

| Setting       | Value      |
| ------------- | ---------- |
| Sign-in URL   | `/sign-in` |
| Sign-up URL   | `/sign-up` |
| After sign-in | `/`        |
| After sign-up | `/`        |

- [ ] **Step 5: Capture the API keys**

Clerk → **API Keys**. Copy the publishable key and the secret key, then add them to Vercel:

```bash
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY preview
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY development
vercel env add CLERK_SECRET_KEY production
vercel env add CLERK_SECRET_KEY preview
vercel env add CLERK_SECRET_KEY development
```

Each command prompts for the value. The publishable key is safe to expose; the secret key is not — never commit either.

- [ ] **Step 6: Create the webhook**

Clerk → **Webhooks** → **Add Endpoint**.

- Endpoint URL: `https://next.cinemadraft.com/api/webhooks/clerk`
  Stable through the whole build. At phase 13, either add a second endpoint for `https://cinemadraft.com/api/webhooks/clerk` or repoint this one.
- Subscribe to: **`user.created`** and **`user.updated`** only.

- [ ] **Step 7: Capture the signing secret**

From the webhook's detail page, copy the signing secret:

```bash
vercel env add CLERK_WEBHOOK_SIGNING_SECRET production
vercel env add CLERK_WEBHOOK_SIGNING_SECRET preview
vercel env add CLERK_WEBHOOK_SIGNING_SECRET development
```

The webhook handler in phase 4 verifies every request against this. An unverified webhook endpoint lets anyone create users in your database.

---

## Task 6: Auth0 Management API application

Needed only for the one-off user import in phase 4. Revoke it immediately afterward.

- [ ] **Step 1: Create a Machine-to-Machine application**

Auth0 dashboard → **Applications → Create Application** → **Machine to Machine**. Name it `Cinemadraft Clerk Migration`.

- [ ] **Step 2: Authorize it against the Management API**

Select **Auth0 Management API**. Grant **`read:users`** only. Do not grant write scopes — this application never needs to modify anything.

- [ ] **Step 3: Capture the credentials**

```bash
vercel env add AUTH0_MGMT_DOMAIN development
vercel env add AUTH0_MGMT_CLIENT_ID development
vercel env add AUTH0_MGMT_CLIENT_SECRET development
```

Development scope only — the import runs locally, never in production.

- [ ] **Step 4: Record how many users exist**

Auth0 → **User Management → Users**. Note the total count in `docs/PROGRESS.md`. Phase 4's import reconciles against this number, and a mismatch is how you'll catch a partial import.

---

## Task 7: Capture the irreplaceable artifacts

🔴 **This is the task that cannot be redone later.** Both artifacts come from the live Heroku app, which is retired in phase 13.

- [ ] **Step 1: Dump the production database**

```bash
cd /Users/jonbernard/Development/cinemadraft-nextjs
mkdir -p .local
heroku pg:backups:capture --app <your-heroku-app-name>
heroku pg:backups:download --app <your-heroku-app-name> --output .local/prod-dump.dump
```

- [ ] **Step 2: Verify the dump is real**

```bash
pg_restore --list .local/prod-dump.dump | head -40
ls -lh .local/prod-dump.dump
```

Expected: a table-of-contents listing your tables (`users`, `leagues`, `drafts`, `movies`, …) and a file size in megabytes, not bytes.

- [ ] **Step 3: Confirm `.local/` is ignored**

```bash
grep -q '^\.local/' .gitignore || echo '.local/' >> .gitignore
git check-ignore .local/prod-dump.dump
```

Expected: the path prints, meaning it's ignored. **The dump contains every user's personal data and must never be committed.**

- [ ] **Step 4: Record row counts for later verification**

```bash
heroku pg:psql --app <your-heroku-app-name> -c "
select relname as table, n_live_tup as rows
from pg_stat_user_tables
order by n_live_tup desc;" | tee .local/prod-row-counts.txt
```

Phase 2 restores into Neon and compares against this file. A restore that silently drops rows is otherwise very hard to notice.

- [ ] **Step 5: Capture the API contract fixtures**

These are the golden responses that every ported repository is tested against (spec §13). Create `.local/capture-fixtures.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE="https://cinemadraft.com/api"
TOKEN="${CINEMADRAFT_TOKEN:?set CINEMADRAFT_TOKEN to a valid bearer token}"
OUT="fixtures"
mkdir -p "$OUT"

# Public endpoints
declare -a PUBLIC=(
  "health"
  "years"
  "awards"
  "events"
  "movie/now-playing"
)

# Authenticated endpoints
declare -a AUTHED=(
  "dashboard"
  "league"
  "user"
  "watchlist"
  "lists"
  "reviews"
  "notifications"
  "profile/feed"
  "draft"
  "draftpicks"
  "points"
  "nominations"
  "winners"
)

for ep in "${PUBLIC[@]}"; do
  name="${ep//\//_}"
  echo "GET /$ep"
  curl -sS "$BASE/$ep" > "$OUT/$name.json"
done

for ep in "${AUTHED[@]}"; do
  name="${ep//\//_}"
  echo "GET /$ep (auth)"
  curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/$ep" > "$OUT/$name.json"
done

echo "Captured $(ls "$OUT" | wc -l | tr -d ' ') fixtures"
```

- [ ] **Step 6: Get a bearer token**

Sign in to cinemadraft.com in your browser, open DevTools → **Network**, click any `/api/` request, and copy the `Authorization: Bearer …` header value.

- [ ] **Step 7: Run the capture**

```bash
chmod +x .local/capture-fixtures.sh
CINEMADRAFT_TOKEN='<paste token>' .local/capture-fixtures.sh
```

- [ ] **Step 8: Verify the fixtures are real responses, not errors**

```bash
for f in fixtures/*.json; do
  printf '%-28s %s\n' "$(basename "$f")" "$(head -c 90 "$f")"
done
```

Check every file. Any containing `{"error":"unauthorized"}` or an empty body means that endpoint didn't capture — fix the token or the path and re-run before moving on.

- [ ] **Step 9: Commit the fixtures**

Fixtures are committed (unlike the dump) because they're the test baseline and contain only your own account's data.

```bash
git add fixtures
git commit -m "P0.T7: capture API contract fixtures from production

Golden responses from the live Heroku API. These are the baseline every
ported repository is tested against and cannot be recaptured after
Heroku is retired.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

> If any fixture contains another user's personal data, scrub it before committing, or move `fixtures/` into `.local/` and note the location in `PROGRESS.md` instead.

---

## Task 8: Remaining service credentials

- [ ] **Step 1: Carry over the external API keys from Heroku**

```bash
heroku config --app <your-heroku-app-name>
```

Add each of these to Vercel across all three environments:

| Key                             | Notes                                      |
| ------------------------------- | ------------------------------------------ |
| `TMDB_API_KEY`                  | required — search, posters, discovery      |
| `OMDB_KEY`                      | required — supplementary ratings           |
| `CACHE_DURATION_IN_MINUTES`     | optional, has a default                    |
| `NEXT_PUBLIC_ACTIVE_YEAR`       | renamed from `REACT_APP_ACTIVE_YEAR`       |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | renamed from `REACT_APP_GA_MEASUREMENT_ID` |

```bash
vercel env add TMDB_API_KEY production
# repeat per key, per environment
```

Cloudinary keys are deliberately **not** carried over — phase 11 replaces it with Vercel Blob. Auth0 runtime keys are **not** carried over either; only the Management API credentials from Task 6, which are temporary.

---

## Completion checklist

- [ ] `vercel env ls` lists all of the following (values are Sensitive and cannot be read back):
  - [ ] `DATABASE_URL`
  - [ ] `UPSTASH_REDIS_REST_URL`
  - [ ] `UPSTASH_REDIS_REST_TOKEN`
  - [ ] `BLOB_READ_WRITE_TOKEN`
  - [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - [ ] `CLERK_SECRET_KEY`
  - [ ] `CLERK_WEBHOOK_SIGNING_SECRET`
  - [ ] `AUTH0_MGMT_DOMAIN`, `AUTH0_MGMT_CLIENT_ID`, `AUTH0_MGMT_CLIENT_SECRET`
  - [ ] `TMDB_API_KEY`, `OMDB_KEY`
  - [ ] `NEXT_PUBLIC_ACTIVE_YEAR`
- [ ] `.local/prod-dump.dump` exists, `pg_restore --list` shows the expected tables, and `.local/` is gitignored
- [ ] `.local/prod-row-counts.txt` exists
- [ ] `fixtures/` contains a valid JSON response per endpoint, none of them errors
- [ ] Clerk connections match the Auth0 connections exactly (Task 5, Step 3)
- [ ] Auth0 user count recorded in `docs/PROGRESS.md`
- [ ] Blob public hostname recorded in `docs/PROGRESS.md`
- [ ] `next.cinemadraft.com` resolves to Vercel; `cinemadraft.com` **not yet added to Vercel**, still served by Heroku

Tick Phase 0 in `docs/PROGRESS.md`, then phase 1 can begin.
