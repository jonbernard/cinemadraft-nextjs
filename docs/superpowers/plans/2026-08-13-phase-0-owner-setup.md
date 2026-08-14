# Phase 0 — Owner Setup

**Executed by:** Jon, not an agent. Everything here needs a browser login or a credential only you hold.

**Goal:** Provision Vercel, Neon, Vercel Blob, Clerk and an Auth0 Management application, and capture the two artifacts that become unrecoverable once Heroku is retired — a production database dump and the API contract fixtures.

**Time:** roughly 60–90 minutes. Clerk (Task 5) is the longest and the only one with a real decision embedded in it.

**Gate:** `vercel env ls` shows every key in the checklist at the end, and `.local/prod-dump.dump`, `.local/prod-row-counts.txt`, and `.local/fixtures/` all exist locally. Everything irreplaceable lives under `.local/`, which is gitignored.

> **Sensitive variables cannot be pulled.** Vercel's Sensitive type is write-only. Verification is by _presence_ in `vercel env ls`, not by reading values. Connection strings needed locally come from each provider's own console and live in the gitignored `.local/`.

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

## Task 4: Vercel Blob ✅ complete

- [x] **Step 1: Create the store**

**Storage** tab → **Create** → **Blob**. Name it `cinemadraft-media`.

- [x] **Step 2: Verify the variables landed**

```bash
vercel env ls | grep -i blob
```

Connecting the store injects `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY`, both non-sensitive, to Production and Preview.

**There is no `BLOB_READ_WRITE_TOKEN`, and none is needed.** Vercel Blob on this account authenticates via **OIDC**: the CLI and SDK use `VERCEL_OIDC_TOKEN` together with `BLOB_STORE_ID`. The CLI is explicit about the pairing — "must both be set, or both be unset."

- [x] **Step 2b: Local Blob access — optional, phase 11 only**

Blob operations from a local shell fail:

```
Error: Vercel Blob: OIDC is enabled for this project, but not for the "development" environment.
```

**Cause.** OIDC tokens are scoped per environment — the `sub` claim reads `owner:…:project:…:environment:production`. A local `vercel env pull` yields a token scoped `environment:development`, but the Blob store is connected to **Production and Preview only**, so the development identity is not authorized against it.

**Settings → Security is not where this is fixed.** That panel only chooses Issuer Mode (Team vs Global) and has no environment control.

Two ways forward, in order of preference:

1. **Connect the store to Development.** Storage tab → the Blob store → its project-connection settings, and include the Development environment if an environment selector is offered. Then `vercel env pull .env.local --yes && vercel blob list` should return an empty listing.
2. **Skip it.** Run the phase 11 migration as a deployed one-shot route instead of a local script. The deployed function's OIDC identity is production-scoped and already authorized, so nothing needs changing.

Either is fine. This blocks nothing before phase 11 — record which applies in `docs/PROGRESS.md` and move on.

- [x] **Step 3: Note the public hostname**

The store's public URL looks like `https://<id>.public.blob.vercel-storage.com`. Phase 11 needs it for `next/image` remote patterns. Record it in `docs/PROGRESS.md` under the Phase 0 notes.

---

## Task 5: Clerk ✅ complete

The one where a mistake is expensive. Step 3's email-verification requirement is what makes account claiming (D25) safe — read it before enabling anything.

- [x] **Step 1: Create the application**

[dashboard.clerk.com](https://dashboard.clerk.com) → **Create application**. Name it `Cinemadraft`.

- [x] **Step 2: Find out what Auth0 is actually using**

Before choosing connections, open the Auth0 dashboard → **Authentication → Social** and → **Authentication → Database**. Write down every enabled connection.

This is the step that protects existing users. If Auth0 has Google enabled and Clerk does not, every Google user who signs in after cutover gets a **brand new identity** instead of their existing account, silently — with no leagues, no drafts, no history. It will look like data loss and it will not be obvious why.

- [x] **Step 3: Enable exactly those connections in Clerk**

Clerk → **User & Authentication → Social Connections**. Enable each connection you wrote down in Step 2. Match them exactly — not more, not fewer.

Also enable **Email address** as an identifier, since the import and the webhook both key on email.

- [x] **Step 4: URLs — nothing to do here**

The dashboard's **Configure → Paths** section configures Clerk's _hosted_ Account Portal. This project does not use it: P4.T6 builds its own sign-in and sign-up pages using the phase 3 design tokens, so the pages live in the app.

For app-hosted pages, Clerk reads paths from environment variables instead:

```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
```

**These are added in phase 4, not now.** They reference routes that do not exist yet, and pointing at missing routes produces redirect loops.

- [x] **Step 5: Capture the API keys**

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

- [x] **Step 6: Create the webhook**

Clerk → **Webhooks** → **Add Endpoint**.

- Endpoint URL: `https://next.cinemadraft.com/api/webhooks/clerk`
  Stable through the whole build. At phase 13, either add a second endpoint for `https://cinemadraft.com/api/webhooks/clerk` or repoint this one.
- Subscribe to: **`user.created`** and **`user.updated`** only.

- [x] **Step 7: Capture the signing secret**

Clerk does not display anything called `CLERK_WEBHOOK_SIGNING_SECRET` — that is just the environment variable name this project uses. Clerk shows a field labelled **Signing Secret** on the endpoint's detail page, with a value beginning `whsec_` (Clerk uses Svix for webhooks).

**The secret only exists once the endpoint is created**, so this step cannot be done before Step 6.

Copy that value into:

```bash
vercel env add CLERK_WEBHOOK_SIGNING_SECRET production
vercel env add CLERK_WEBHOOK_SIGNING_SECRET preview
vercel env add CLERK_WEBHOOK_SIGNING_SECRET development
```

P4.T3 verifies every incoming request against this secret. This is not optional hardening: the webhook is what claims existing accounts (D25), so an unverified endpoint would let anyone forge a `user.created` for any email address and take over that member's leagues.

---

## Task 6: Auth0 ✅ nothing required

Originally "create a Management API application to export users". **Removed (D25).**

Accounts are claimed on first Clerk sign-in with a verified matching email, so there is no bulk import and nothing to export. Auth0 keeps serving the current site until cutover, then is decommissioned.

---

## Task 7: Capture the irreplaceable artifacts

🔴 **This is the task that cannot be redone later.** Both artifacts come from the live Heroku app, which is retired in phase 13.

- [x] **Step 1: Dump the production database**

```bash
cd /Users/jonbernard/Development/cinemadraft-nextjs
mkdir -p .local
heroku pg:backups:capture --app <your-heroku-app-name>
heroku pg:backups:download --app <your-heroku-app-name> --output .local/prod-dump.dump
```

- [x] **Step 2: Verify the dump is real**

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

- [x] **Step 4: Record row counts for later verification**

Run this in TablePlus against production (or via `heroku pg:psql --app <app> -c "..."`) and save the result to `.local/prod-row-counts.txt`:

```sql
select table_name,
       (xpath('/row/cnt/text()',
              query_to_xml(format('select count(*) as cnt from %I.%I', table_schema, table_name),
                           false, true, '')))[1]::text::bigint as exact_rows
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
order by table_name;
```

**Do not use `pg_stat_user_tables.n_live_tup`.** It is a statistics estimate that goes stale until `ANALYZE` runs, and it reported counts far below the truth on this database. `query_to_xml` runs a real `count(*)` per table without needing to hand-write 17 queries.

Phase 2 restores into Neon and runs the identical query twice — once after the restore (P2.T2) and once after normalization (P2.T4) — comparing both against this file. A restore that silently drops rows is otherwise very hard to notice.

**Captured 2026-08-14.** 17 tables. Two findings worth carrying forward: `Reviews` has **0 rows** (the feature was never used — Phase 7 decides whether it ships), and `SequelizeMeta` is dropped by `normalize.sql`, so the P2.T4 comparison covers 16 tables, not 17.

- [x] **Step 5: Capture the API contract fixtures**

These are the golden responses every ported repository is tested against (spec §13). The capture script is committed at `scripts/capture-fixtures.sh`. It reads the bearer token from `$TOKEN` so the token is never written to disk, and it issues **GET requests only** — nothing in it mutates production.

The route table was built by enumerating `router.get(...)` across all 18 files in `server/routes/` of the source app, then resolving real ids from the production database. Those ids are constants at the top of the script; change them there, not inline.

- [x] **Step 6: Get a bearer token**

Sign in to cinemadraft.com, open DevTools → **Network**, click any `/api/` request, and copy the `Authorization` header value **without** the leading `Bearer `. Auth0 access tokens last 24 hours, so capture in one sitting.

- [x] **Step 7: Run the capture**

```bash
TOKEN='<paste token>' ./scripts/capture-fixtures.sh
```

Output goes to `.local/fixtures/` — 32 files, each with a sibling `.path` file recording the URL it came from. The API rate-limits to 60 requests/minute, so run the script once rather than re-running it piecemeal.

- [x] **Step 8: Verify the fixtures are real responses, not errors**

```bash
cd .local/fixtures
for f in *.json; do python3 -c "import json;json.load(open('$f'))" || echo "INVALID: $f"; done
grep -l '"error"' *.json || echo "no error payloads"
```

Every file must parse and none may contain an `error` key. An endpoint returning `[]` or `{}` is only acceptable if the emptiness is genuine — verify against the database before accepting it, because an empty fixture constrains nothing in the contract tests.

**Captured 2026-08-14.** 32 endpoints, all HTTP 200, all valid JSON, 1.5 MB. Captured as user id 3 (`jon@jonbernard.net`, `admin`).

- [x] **Step 9: Do NOT commit the fixtures**

The original version of this step said to commit them on the assumption they held only your own account's data. That is wrong. The responses contain **18 distinct real users' first and last names**, along with `provider` and `providerId` — the Auth0 subject identifiers. League and draft endpoints necessarily return every member of the league.

Fixtures therefore live in `.local/fixtures/`, which is gitignored. The capture script is committed; its output is not. Phase 2 contract tests read them from that path. Because they cannot be recaptured once Heroku is retired, **back up `.local/` outside the repo before cutover.**

### Bugs found in the source app during capture

Recorded in `PROGRESS.md` and carried into Phase 7. Do not reproduce them in the port.

- `GET /draft/users/:id` takes a **league** id despite the path, and returns `[]` for a valid draft id instead of erroring.
- `GET /watchlist/:page?/:columnName?/:direction` accepts only `createdAt` and `releaseDate`; `title` and `sortTitle` raise Postgres `42703`. Sortable columns must be a validated allowlist.
- 🔴 The error handler returns the **full failing SQL, column list, and Postgres internals** to the client. The port returns opaque errors and logs detail server-side (P2.T10).


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

Cloudinary keys are deliberately **not** carried over — phase 11 replaces it with Vercel Blob. No Auth0 credentials are carried over at all: the runtime keys belong to the old app, and D25 removed the need for Management API access.

---

## Completion checklist

- [x] `vercel env ls` lists all of the following (values are Sensitive and cannot be read back):
  - [x] `DATABASE_URL` / `DATABASE_URL_UNPOOLED` — Production + Preview only; Development uses Docker
  - [x] `BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY` — Blob authenticates via **OIDC**, not a read-write token
  - [x] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - [x] `CLERK_SECRET_KEY`
  - [x] `CLERK_WEBHOOK_SIGNING_SECRET` — our name for the `whsec_` value Clerk labels "Signing Secret"
  - [ ] `TMDB_API_KEY`, `OMDB_KEY`, `CACHE_DURATION_IN_MINUTES`, `NEXT_PUBLIC_GA_MEASUREMENT_ID` (Task 8)
  - [ ] ~~`UPSTASH_REDIS_REST_URL` / `_TOKEN`~~ — removed by D23, nothing to provision
  - [ ] ~~`NEXT_PUBLIC_ACTIVE_YEAR`~~ — carried over for now, **deleted at P5.T0** when the database-backed read path ships (D22)
- [x] `.local/prod-dump.dump` exists, `pg_restore --list` shows the expected tables, and `.local/` is gitignored
- [x] `.local/prod-row-counts.txt` exists — **exact** `count(*)` per table, not `n_live_tup`
- [x] `.local/fixtures/` contains 32 valid JSON responses, none of them errors. **Gitignored** — they carry 18 real users' names and Auth0 `providerId` values. `scripts/capture-fixtures.sh` is committed; its output is not
- [x] Clerk is passwordless with email verification required (Task 5, Step 3) — this is what makes account claiming safe
- [ ] Blob public hostname recorded in `docs/PROGRESS.md` — needed for `next/image` `remotePatterns` in Phase 11
- [ ] Clerk **account linking** confirmed enabled, so one email cannot produce two Clerk identities
- [x] `next.cinemadraft.com` resolves to Vercel; `cinemadraft.com` **not yet added to Vercel**, still served by Heroku

**Back up `.local/` outside the repo before Heroku is retired.** The dump, row counts, and fixtures are all unrecoverable afterwards.

Tick Phase 0 in `docs/PROGRESS.md`, then phase 1 can begin.
