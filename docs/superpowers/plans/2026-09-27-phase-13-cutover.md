# Phase 13 — Cutover (runbook)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. This is a runbook, not a build: steps run **in order**, one at a time, and most are the owner's. Steps use checkbox (`- [ ]`) syntax. **An AGENT step that touches Heroku, Neon, Clerk, Vercel or DNS runs only after the owner has approved the exact command shown.**

**Goal:** `cinemadraft.com` served by Vercel from a Neon database that holds Heroku's last write. Nothing lost, every schema change the port made put back, and Heroku scaled to zero.

**Architecture:** Freeze Heroku. Dump it. Wipe Neon and restore the dump. Re-apply D27's normalization and the four Prisma migrations, then the logo URLs. Swap Clerk to its Production instance. Verify all of it on `next.cinemadraft.com`, and only then move the apex. Until the apex moves, rollback is `heroku maintenance:off`.

**Spec:** `docs/PLAN.md` § Phase 13 (T1–T7), spec §8 (migration sequence, D27) and §9 (claiming, D25/D26), `docs/reference/clerk-instance-settings.md`, and the Phase 0/2/12 notes in `docs/PROGRESS.md`.

## Global Constraints

- 🔴 **Red means stop.** Every step names its check and what red looks like, and those are fixed before the step runs. A red check is never re-read as green. If a check turns out unable to fail, stop, replace it, and write down that you did (AGENTS.md).
- 🔴 **Heroku is the system of record until S25.** Anything that exists only on Neon is lost at S17 unless this plan re-applies it.
- 🔴 **Verify against counts taken from the dump, not from live production** (Phase 0 notes). The live-Heroku comparison at S14 exists for a different reason: it proves the freeze held.
- Postgres clients come from libpq ≥ 17 (`$(brew --prefix libpq)/bin`, 18.6 as of 2026-09-27). The PATH `psql` is older and fails to read the dump.
- `pg_restore` and `prisma migrate` run over the **unpooled** Neon URL. The app keeps the pooled one.
- The restore uses `--no-owner --no-privileges`, because the dump's owner role `ub7c7u1vm0346s` does not exist on Neon.
- 🔴 **Prisma CLI targets are pinned with `DIRECT_URL`.** `prisma.config.ts` loads `.env`, which points at Docker, and resolves `DIRECT_URL` → `DATABASE_URL_UNPOOLED` → `POSTGRES_URL_NON_POOLING` → `DATABASE_URL`. Setting `DIRECT_URL` is the only way to be certain which database a command writes to.
- Credentials live in shell variables, never in files or in this repo. `.env.neon` sits at the root of the main checkout.
- Run the unit suite with `E2E_TEST_AUTH` unset, and never point a test at Neon or at 5432.

## Review Focus

The failures most likely to hurt, and the step that catches each one:

1. **A write lands on Heroku after the dump and is lost.** Maintenance mode does not stop worker dynos, schedulers or direct clients. → S13's write counter and S14's diff of dump counts against live counts.
2. **`nominations.year` comes back as `text` and every film scores zero, with no error anywhere.** → S19's schema checks, and S24's standings compared against the Heroku oracle from S12.
3. **A stale Dev-instance `clerk_id` survives the restore.** The member's first Production sign-in then hits the never-reassign guard, and they get `AccountLinkError` on their own account. → S22 asserts zero claimed rows.
4. **The Prisma CLI migrates Docker or the pooler instead of Neon's direct endpoint.** → `DIRECT_URL` on every command, plus the host check in S19.
5. **The mixed-case email account is locked out.** → S22 compares the count against Heroku's, and S24d is a real sign-in by that member.

---

## Conventions

**Roles.** **OWNER** steps are dashboards, DNS, credentials and anything outward-facing. **AGENT** steps are local, read-only, or a scripted command the owner approves before it runs.

**Shell, set once per session.** Run from the rehearsal worktree S11 creates, which is checked out at the commit Vercel Production deploys:

```bash
export REPO=/Users/jonbernard/Development/cinemadraft-nextjs
export CUT="$REPO/.local/cutover"            # gitignored; every artefact below lands here
export PSQL="$(brew --prefix libpq)/bin/psql" PGR="$(brew --prefix libpq)/bin/pg_restore"
export HEROKU_DB="$(heroku config:get DATABASE_URL -a cinemadraft)"
export NEON_DIRECT="$(grep -m1 '^DATABASE_URL_UNPOOLED=' "$REPO/.env.neon" | cut -d= -f2- | tr -d '"')"
case "$NEON_DIRECT" in *-pooler.*) echo "RED: pooled URL";; *ep-morning-block-aus9jqrt.*) echo ok;; *) echo "RED: not the production endpoint";; esac
mkdir -p "$CUT"
```

The endpoint is `ep-morning-block-aus9jqrt`, from P12.T1. Anything other than `ok` is red.

**Already dry-run, 2026-09-27.** The agent ran the database half of the window (S17 → S20, C3–C8) in a throwaway Docker Postgres: `.local/baseline.dump` stood in for today's Neon, and the August dump for the final one. Results:
- The wipe and restore ran with 0 errors, and C3 was empty.
- Before normalizing, C4 found 146 uppercase identifiers. After, it found 0, and the folded diff was empty.
- `migrate status` listed all 5 migrations as unapplied. `resolve` and `deploy` applied the 4 later ones.
- C5 was 10 × `t`, and went `f` on three mutations: year back to text, trigram index dropped, `focused_award_id` dropped.
- C6 went from `0|12` to `12|12`.
- C7 read claimed 0, mixed-case 1, collisions 0, active 1.

S11 repeats all of this against a fresh Heroku dump.

**Point of no return: S25.** That is the moment the apex resolves to Vercel. The first member write on Neon follows within minutes, and from then on going back to Heroku loses that write. Before S25, every step is free to undo. The rollback ladder is at the end.

---

## What a full restore wipes

**Schema.** These are the six changes from PLAN.md § T3b. They are gone after the wipe in S17, S19 puts them back, and each has its own line in check C5:

| Migration | Change |
|---|---|
| `20260814130000_app_columns` | `available_years.is_active` plus the `available_years_one_active` partial unique index (D22) |
| `20260814130000_app_columns` | `movies.accent_hex` |
| `20260814130000_app_columns` | `users.clerk_id` plus `users_clerk_id_key`. Without it, sign-in is a total outage |
| `20260815160000_movie_title_search` | `pg_trgm` plus the `movies_title_trgm` GIN index |
| `20260816120000_nominations_year_integer` | `nominations.year` as `integer`. The restore brings back `text`, and nothing errors |
| `20260913120000_event_focused_award` | `events.focused_award_id` (D117) |

**Data the port wrote to Neon since the Phase 2 restore** (dump created 2026-08-13 22:17 EDT). S7 measures each of these, and the owner decides on each nonzero line:

| What | After the restore | Verdict |
|---|---|---|
| `events.image`: 12 Blob URLs (Phase 11) | Back to `/images/awards/*.jpg` | **Re-apply**: S20 (PLAN.md § T3's SQL) |
| `users.clerk_id` from staging sign-ins | NULL | 🔴 **Losing these is required, not just acceptable.** They are Development-instance ids, so they can never match a Production identity. A survivor makes that member's first sign-in a collision. S22 asserts 0 |
| `users` rows created by staging sign-ups | Deleted | Fine. Those people register again on Production |
| `available_years.is_active` | The migration marks **2026** | Fine if the season is still 2026. S7 records Neon's current value, and S21 re-applies it if it differs |
| `events.focused_award_id` | NULL | Fine. NULL means "nothing on screen" (D117) |
| `movies.accent_hex` | NULL | Fine. It is filled in lazily (`lib/repositories/movies.ts`) |
| `movies` rows cached from TMDB on staging | Deleted | Fine. They are fetched again on first use, and `award-import.mjs apply` fetches any it needs |
| `nominations` / `winners` entered on Neon, by `award-import.mjs` or the admin UI | Deleted | **Re-apply if S7 finds any.** Replay `.local/award-plans/*.json` with `apply --commit`, which is idempotent: existing nominations are skipped and winners are replaced per category. 🔴 **No `.local/award-plans/` exists in any checkout as of 2026-09-27.** If S7 finds entries with no plan behind them, the owner either re-enters them or accepts the loss |
| `notifications` from `award-import.mjs finish` on Neon | Deleted | Fine. No member reads staging. Whether a replay broadcasts again is the owner's call in S21 |
| `profile_feeds` roster posts (`completeDraft`, P12.T5) | Deleted | Fine. Only staging leagues completed on Neon, and real leagues' posts come from Heroku |
| Leagues, drafts, picks, lists and watchlists made on staging | Deleted | Fine if they are test data. If S7 shows real use, the owner decides. There is no replay tooling |
| Character seats (D121) | No change: they are code, not data | Nothing to do |
| `_prisma_migrations` | Dropped by the wipe | Rebuilt by S19 |

Ceiling on S7: a write that stamps neither `created_at` nor `updated_at` is invisible to its first query, and a delete is invisible to all of them. The targeted probes cover the unstamped writes this port is known to make.

---

## Stage 0 — Pre-flight (days before; nothing outward-facing)

- [ ] **S1 · OWNER — Phase 12 is closed, and Production runs the code you think it does.**
  P12.T2b, the manual PARITY walk, is marked passed in `PROGRESS.md`. `agent/p12-closeout` is merged to `dev` and then to `main`. Production is deployed from `origin/main`.

  ```bash
  git -C "$REPO" fetch origin && git -C "$REPO" rev-parse origin/main
  git -C "$REPO" cat-file -e origin/main:instrumentation.ts && echo "filter shipped"
  ```

  **Red:** the Vercel Production deployment's commit is not `origin/main`, or `cat-file` fails. S28 relies on the `instrumentation.ts` filter being live.

- [ ] **S2 · OWNER — `REVALIDATE_SECRET` is set.** Follow `.claude/skills/award-entry/SKILL.md` § One-time setup: the same value in Vercel Production and in `.env.local`, then redeploy. Verification is AGENT work:

  ```bash
  S="$(grep -m1 '^REVALIDATE_SECRET=' "$REPO/.env.local" | cut -d= -f2-)"
  curl -s -X POST https://next.cinemadraft.com/api/revalidate -H 'content-type: application/json' \
    -d "{\"secret\":\"$S\",\"abbreviation\":\"oscars\"}"
  ```

  **Green:** `{"revalidated":[...]}`. **Red:** `not found`, meaning the secret is unset, not yet deployed, or different in the two places. A wrong secret also returns 404, which is why only the right-secret call counts as the check.

- [ ] **S3 · OWNER — Clerk account linking is confirmed, and the verification log has been run.** Confirm on the Development instance that one email address maps to one Clerk user whether it signs in by code or by Google (Phase 0 note). Then run cases 1–3 in `docs/reference/clerk-instance-settings.md` § Verification log and record the results there. As of 2026-09-13 they had never been run. **Red:** case 2 fails. That is a cutover blocker in `syncClerkIdentity`.

- [ ] **S4 · OWNER — Decisions, in writing, before the window is booked:**
  - (a) Must any award data be entered between the restore and go-live? If so, which show and which kind (see S21). Until S13, the place to enter it is Heroku, the system of record.
  - (b) A verdict on every nonzero line S7 reports.
  - (c) The window: no award show or live draft within 48 hours either side, with members told beforehand. Suggested wording: *"Down for an hour; afterwards sign up with the same email and your leagues come with you."*
  - (d) Who owns the mixed-case email account (look it up with `select id from users where email <> lower(email)` and do not write the address down), and whether they can sign in during the window.
  - (e) Where DNS is hosted, and whether Cloudflare proxying is involved.
  - (f) Whether the Storybook a11y pass listed under "Open questions" blocks the cutover.

- [ ] **S5 · OWNER — Tooling.** 🔴 `heroku` is **not on PATH** on this machine as of 2026-09-27. Install it and log in. `vercel` must be linked to `cinemadraft-nextjs`.

  ```bash
  heroku auth:whoami && heroku apps:info -a cinemadraft
  vercel whoami && "$PGR" --version      # 17 or newer
  ```

- [ ] **S6 · AGENT (read-only) — Record what is there now, for rollback.**

  ```bash
  { date -u; dig +noall +answer cinemadraft.com A cinemadraft.com AAAA www.cinemadraft.com CNAME cinemadraft.com MX cinemadraft.com TXT
    heroku domains -a cinemadraft; heroku ps -a cinemadraft; heroku addons -a cinemadraft; } > "$CUT/before.txt"
  ```

  This is the rollback target for S25, and the dyno formation to restore in R1. **Flag:** any process type other than `web`, or a scheduler add-on. Maintenance mode will not stop either, so S13 must scale it down.

- [ ] **S7 · AGENT (read-only) — Inventory what the port wrote to Neon.** First confirm the cutoff from the dump Neon was restored from:

  ```bash
  "$PGR" --list "$REPO/.local/prod-dump.dump" | grep 'Archive created at'
  ```

  It reads `2026-08-13 22:17:25 EDT`. Then run **C8** with `cutoff='2026-08-14 02:17:25+00'` and save the output to `$CUT/neon-drift.txt`. The owner writes a verdict beside every nonzero line, using the table above. **Red:** C8's `public` object list contains anything beyond these:
  - the 16 app tables and `_prisma_migrations` (relkind `r` 17)
  - 16 sequences (`S`)
  - their indexes (`i`, 47 on the baseline copy)
  - `pg_stat_statements`' 2 views (`v`)
  - the `pg_trgm` and `pg_stat_statements` extensions

  S17 destroys anything unaccounted for.

- [ ] **S8 · OWNER — Lower the DNS TTL.** Set the apex and `www` records to TTL 300. Do it at least one old TTL (from `before.txt`) before the window. **Check:** `dig +noall +answer @1.1.1.1 cinemadraft.com` shows ≤ 300. **Red:** a higher TTL on the day, which makes any DNS rollback that much slower.

- [ ] **S9 · OWNER — Create the Clerk Production instance (T1, first half).** Create it for `cinemadraft.com` and apply every item in `clerk-instance-settings.md` § What must be recreated for Production:
  - email code on, email link off
  - "Require email address" on
  - no password
  - Google enabled with **your own** OAuth client. Clerk's shared development credentials do not carry over to production. Use the redirect URI Clerk shows, and set the Google consent screen to *In production*
  - account linking on

  Add the DNS records Clerk lists (`clerk.`, `accounts.`, `clkmail.` and the DKIM CNAMEs). Leave the apex, `www` and MX alone. If the zone is on Cloudflare, those records are DNS-only.
  **Check:** Clerk → Domains shows every record verified and SSL issued, and `dig +short clerk.cinemadraft.com CNAME` returns the target Clerk shows. **Red:** anything still pending after 24 hours.
  **Rollback:** delete the records and the instance. Nothing serves from them yet.
  **Keys stay out of Vercel until S23.** Staging members' Dev `clerk_id`s would collide with the new instance until S17 clears them.

- [ ] **S10 · OWNER — The apex is attached in Vercel.** Vercel → Domains lists `cinemadraft.com` and `www.cinemadraft.com` on Production. Expect "Invalid Configuration" until S25. Attaching a domain moves no traffic. **Check:** `vercel domains inspect cinemadraft.com` knows the domain.

- [ ] **S11 · AGENT — Rehearse the window end to end, locally.** The owner first takes a rehearsal dump. No maintenance mode is needed, because this is only a read:

  ```bash
  heroku pg:backups:capture -a cinemadraft && heroku pg:backups:download -a cinemadraft --output "$CUT/rehearsal.dump"
  ```

  Then the agent brings up a worktree at `main` and a database in Neon's current shape (snake_case, migrated, baseline rows):

  ```bash
  cd "$REPO" && eval "$(bash scripts/agent-up.sh p13-cutover main)"   # prints DATABASE_URL on 544x
  cd /Users/jonbernard/Development/.cd-wt-p13-cutover                 # the window runs from here too
  export NEON_DIRECT="$DATABASE_URL" DUMP="$CUT/rehearsal.dump"       # a LOCAL database, for the rehearsal only
  ```

  Run S17–S20 and S22 **verbatim** against it, substituting `$DUMP` for `final.dump`. 🔴 **Run each step's check once before its fix, and watch it go red**:
  - C4's uppercase count is > 0 before S18
  - C5 shows `f` rows before S19
  - C6 reads `0|12` before S20

  A check that is already green before the fix is not a check. Then:

  ```bash
  env -u E2E_TEST_AUTH DATABASE_URL="$NEON_DIRECT" npx vitest run lib/services/clerk-identity
  npm run build && DATABASE_URL="$NEON_DIRECT" PORT=6499 npm run start &   # then:
  node scripts/sweep-deployed.mjs http://localhost:6499
  ```

  Save every output to `$CUT/rehearsal.txt`. These are the expected values for the window.
  **Red:** a command fails, or its output differs from what this plan says. Fix the plan, then rehearse again.
  **Ceiling:** the Docker superuser is not `neondb_owner`, so a privilege error on Neon cannot appear here.
  Keep the worktree, which holds the window's checkout. Drop its database afterwards with `npm run agent:down p13-cutover --env-only`.

---

## Stage 1 — The window (Heroku frozen). Budget: 90 minutes from S13 to S25

Before starting, re-export the shell block in Conventions. Confirm `git rev-parse HEAD` in the worktree still equals the Vercel Production commit.

- [ ] **S12 · OWNER — Record the scoring oracle.** On live Heroku, before the freeze, screenshot league 1's standings for the last fully scored season (2025) and for the current one, with each member's total. Save to `$CUT/standings-heroku.png`. S24f compares against these.

- [ ] **S13 · OWNER — Freeze writes.**

  ```bash
  heroku maintenance:on -a cinemadraft
  heroku ps:scale <each non-web type from before.txt>=0 -a cinemadraft     # if S6 flagged any
  ```

  **Check (AGENT):** `curl -s -o /dev/null -w '%{http_code}\n' https://cinemadraft.com/` returns `503`. Run **C1** twice, two minutes apart; the two readings must be equal. Save them.
  **Red:** a `200` means maintenance is not on. A moving counter means something is still writing. Find it with `heroku pg:ps -a cinemadraft`; if it is the web dyno, `heroku ps:scale web=0 -a cinemadraft`. Re-run C1.
  **Rollback (R1):** `heroku maintenance:off -a cinemadraft`, then restore the formation recorded in `before.txt`.

- [ ] **S14 · OWNER — The final dump (T2).**

  ```bash
  heroku pg:backups:capture -a cinemadraft
  heroku pg:backups:download -a cinemadraft --output "$CUT/final.dump"
  heroku pg:backups -a cinemadraft          # note the backup id; T7 keeps it
  ```

  **Check (AGENT):**

  ```bash
  "$PGR" --list "$CUT/final.dump" | head -20          # header names the Heroku source, created just now
  shasum -a 256 "$CUT/final.dump" | tee "$CUT/final.dump.sha256"
  scripts/dump-row-counts.sh "$CUT/final.dump" > "$CUT/dump-row-counts.tsv"
  ```

  Then run **C2**, run C1 once more, and record `select count(*) from "Users" where email <> lower(email)` from `$HEROKU_DB` into `$CUT/heroku-mixed-case.txt`.
  **Red:** C2 is not empty, or C1 has moved since S13. Either means a write landed between the freeze and the dump. Go back to S13's red path, then capture again.

- [ ] **S15 · OWNER — Back up Neon.** In the Neon console, create branch `pre-cutover-<date>` from `main` at the current point in time. Export its **unpooled** URL as `NEON_BACKUP`.
  **Check (AGENT):** `diff <(scripts/row-counts.sh "$NEON_BACKUP") <(scripts/row-counts.sh "$NEON_DIRECT")` is empty. **Red:** any difference, which means the branch is not at the current head.
  This is the only copy of anything S7 found, and staging's way back.

- [ ] **S16 · AGENT (read-only) — Re-run C8 against `$NEON_DIRECT`, and `diff` it against `$CUT/neon-drift.txt`.** **Red:** a new nonzero line that has no owner verdict. Stop and get one.

- [ ] **S17 · AGENT (owner approves) — Wipe and restore (T2).** 🔴 **Wipe first; do not use `--clean`.** `--clean` drops objects by the dump's names (`"Users"` and so on). The port's snake_case tables and `_prisma_migrations` would survive it, S18 would then collide, and `migrate deploy` would find nothing pending.

  ```bash
  "$PSQL" "$NEON_DIRECT" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public CASCADE' -c 'CREATE SCHEMA public'
  "$PGR" --no-owner --no-privileges --exit-on-error -d "$NEON_DIRECT" "$CUT/final.dump"
  ```

  **Check:** the restore exits 0 with no `pg_restore: error` line. Then run **C3**, which must be empty. **Red:** any error, or a non-empty C3. Wipe and run it again. Never continue on a partial restore.

- [ ] **S18 · AGENT (owner approves) — Normalize (D27).** PLAN.md § T2 leaves this step out. Spec §8, D27 and the Phase 2 plan all require it.

  ```bash
  "$PSQL" "$NEON_DIRECT" -v ON_ERROR_STOP=1 -f prisma/normalize.sql
  ```

  **Check:** **C4**. Folded counts must be identical and the uppercase count must be 0. **Red:** a psql error. The file runs in one transaction, so a failure leaves the restore untouched. Look for a Heroku schema change that `normalize.sql` does not know about, since the file is generated from the schema; S11 should already have caught one.

- [ ] **S19 · AGENT (owner approves) — Migrate (T3b).**

  ```bash
  DIRECT_URL="$NEON_DIRECT" npx prisma migrate status          # must name ep-morning-block-aus9jqrt (not -pooler, not localhost) and list all 5 as not yet applied
  DIRECT_URL="$NEON_DIRECT" npx prisma migrate resolve --applied 0_init
  DIRECT_URL="$NEON_DIRECT" npx prisma migrate deploy          # expect the 4 later migrations applied
  DIRECT_URL="$NEON_DIRECT" npx prisma migrate status          # "Database schema is up to date!"
  ```

  **Check:** **C5**, 10 rows, all `t`. Optionally, eyeball PLAN.md § T3b's five `\d` commands; C5 is the gate. **Red:** any `f`, above all row 1 (`nominations.year` still `text`).

- [ ] **S20 · AGENT (owner approves) — Restore the logo URLs (T3).** The SQL is taken from PLAN.md so it cannot drift:

  ```bash
  awk '/^  UPDATE events SET image/ {sub(/^  /, ""); print}' "$REPO/docs/PLAN.md" > "$CUT/logos.sql"
  test "$(wc -l < "$CUT/logos.sql")" -eq 12 && "$PSQL" "$NEON_DIRECT" -v ON_ERROR_STOP=1 -1 -f "$CUT/logos.sql"
  ```

  **Check:** **C6**. It reads `12|12`, and every Blob URL answers `200`. **Red:** `on_blob < shows`, which means an abbreviation mismatch or a 13th event, or any response other than 200. Count by query. Do not grep the HTML: the image optimizer URL-encodes the host.

- [ ] **S21 · AGENT / OWNER — Re-apply what S4 said to.** Do each item only if its verdict says so.
  - **Active season** (S7 recorded a year other than 2026). This must be two statements, because the partial unique index would reject a single-statement swap:

    ```sql
    BEGIN; UPDATE available_years SET is_active = false WHERE is_active;
    UPDATE available_years SET is_active = true WHERE year = <Y>; COMMIT;
    ```

  - **Award entries**, whether replayed from plan files or newly decided in S4a. Follow the award-entry skill with `DATABASE_URL="$NEON_DIRECT"`. 🔴 Also set **`SITE_URL=https://next.cinemadraft.com`** on `refresh`: its default is `https://cinemadraft.com`, which is still Heroku at this point. You would get a 404 from Heroku, and the skill reads a 404 as "secret mismatch".
  - If the owner wants no broadcast, flip the flag by hand instead of running `finish --commit`: `UPDATE events SET nom_active = false, updated_at = now() WHERE abbreviation = '<abbr>'` (use `awards_active` for winners).

  **Check:** `refresh` reports no missing titles. C7's active-year line reads 1 row and the intended year.

- [ ] **S22 · AGENT (read-only) — Data invariants.** Run **C7**.
  - Claimed users = **0**.
  - Mixed-case emails = the number in `$CUT/heroku-mixed-case.txt`.
  - Folded-email collisions = **0**.
  - Active years = **1**.

  **Red:** any line off. A nonzero claimed count means someone signed in to `next.` during the window, so stay signed out until S24. If that is what happened and S24 has not started, clear it with `UPDATE users SET clerk_id = NULL` and re-run C7. A mixed-case count that is off means S17 did not restore the dump you think it did.

- [ ] **S23 · OWNER — Clerk Production goes live on Vercel (T1, second half).** In Vercel Production scope **only**, set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (`pk_live_…`) and `CLERK_SECRET_KEY` (`sk_live_…`). Preview keeps `pk_test_`.
  In Clerk Production → Webhooks, create an endpoint at `https://next.cinemadraft.com/api/webhooks/clerk` subscribed to `user.created` and `user.updated`. It is the same Production deployment the apex will serve. Put its signing secret in `CLERK_WEBHOOK_SIGNING_SECRET` (Production, Sensitive).
  **Redeploy Production without the build cache.** The publishable key is `NEXT_PUBLIC_`, so it is inlined at build time. This redeploy also drops any function that held a connection across S17.
  **Check (AGENT):** run **C9**; it prints exactly one `pk_live_` key, and that key decodes to `clerk.cinemadraft.com$`. In Clerk → Webhooks → Testing, send a **`session.created`** example; it must return `200 {"ignored":"session.created"}`. The signature check runs before the type check, so this proves the secret without writing anything. Do not send a `user.created` example: it would create a row.
  **Red:**
  - `pk_test_` still present: not redeployed.
  - Nothing printed: look in the page's JS, and do not pass on silence.
  - `400 invalid signature`: the secret does not match.
  - `500`: the secret is unset.
  - The card errors on `next.` with a Clerk origin or domain error. Production instances are expected to accept subdomains of their domain, and this is where that gets proven. If they do not, the fix is Clerk's satellite or allowed-origin setting. The alternative is moving S24b–e past the point of no return, and this plan does not accept that.

  **Rollback:** re-add the Development keys and secret (retrievable from the Clerk Dev dashboard) and redeploy. It affects staging only.

- [ ] **S24 · OWNER + AGENT — Go/no-go on `next.cinemadraft.com` (T5, pre-DNS).**
  - a. AGENT: `node scripts/sweep-deployed.mjs` exits 0.
  - b. OWNER, in a private window, signs in with an email code. The dashboard shows your leagues. C7's claimed count becomes **1** and the claimed row is your own (`select id from users where clerk_id is not null` → 3). Clerk shows the `user.created` delivery as `200`.
  - c. OWNER signs out, then signs in with Google at the same address. It is the same account. The claimed count is still **1**, and Clerk has one user with two identifiers, which proves account linking on Production.
  - d. The mixed-case member (S4d) signs in and sees their leagues. Their row is claimed. `vercel logs --environment production --since 30m --query "claim"` shows no `[auth] claim collision` or `claim refused`. If they cannot be reached, move this to S27 and use `/admin`'s relink (`actions/admin/relink.ts`) as the fallback.
  - e. Case 1 of the verification log (a brand-new address) is **not** repeated here: it creates a real row, and S3 proved the code path.
  - f. League 1's standings for the S12 seasons match the screenshot, member by member. **Red:** any difference. All zeros means `nominations.year` is wrong, whatever C5 said.
  - g. In the draft console, the typeahead finds *One Battle After Another* from `battel`. That exercises `pg_trgm`. Make no pick.
  - h. `/award-shows` shows twelve marks.

  **Go:** everything green. **No-go:** fix it forward if that fits the budget, otherwise take R1. Heroku has been frozen since S13 and has lost nothing.

- [ ] **S25 · OWNER — Move the apex (T4). ⟵ POINT OF NO RETURN.** At the DNS host, set `cinemadraft.com` and `www` to the values Vercel → Domains shows for this project (historically `A 76.76.21.21` and `CNAME cname.vercel-dns.com`). Leave MX, TXT and Clerk's records untouched. Note the time in UTC as `$GOLIVE`.
  **Check (AGENT):**

  ```bash
  for r in 1.1.1.1 8.8.8.8; do dig +short @"$r" cinemadraft.com A; dig +short @"$r" www.cinemadraft.com; done
  curl -sI https://cinemadraft.com/ | grep -i -e '^HTTP' -e '^server:'      # 200 and server: Vercel
  ```

  Vercel reports "Valid Configuration".
  **Red:** after 30 minutes, still a Heroku server, a TLS error, or `www` not redirecting. Revert to `before.txt` (R2).

- [ ] **S26 · OWNER — Webhook to the apex.** Edit the S23 endpoint's URL to `https://cinemadraft.com/api/webhooks/clerk`. Editing keeps the signing secret; a *new* endpoint would need a new secret and another redeploy. **Check:** re-send the `session.created` test and get `200`. If the owner keeps `next.` attached permanently, this step is optional.

- [ ] **S27 · OWNER — T5 on the apex.**
  - In a fresh private window, sign in on `cinemadraft.com`.
  - Check the standings, the logos, and that `/live` loads.
  - Complete S24d if it moved here.
  - Tell the league it is live.

  **Red:** any difference from S24. By now that costs R3, so fix forward.

---

## Stage 2 — T6: 48 hours of watching

- [ ] **S28 · OWNER + AGENT — Check at +1h, +6h, +24h and +48h, and write each reading down.**

| Watch | Command or place | Green | Red |
|---|---|---|---|
| Errors | `vercel logs --environment production --level error --since 6h` | Nothing, or only lines already explained | `[live stream]` / `[board stream] poll failed` (the database was unreachable). `The destination stream closed early.` means the P12.T5 `instrumentation.ts` filter is **not** deployed (S1), and it drowns real errors |
| 5xx | `vercel logs --environment production --status-code 5xx --since 6h` | 0 | Any |
| Claim problems | the `--query "claim"` search above | none | Each `[auth] claim collision` or `refused` line is a member to relink through `/admin` |
| Accounts | `select count(*) filter (where clerk_id is not null), count(*) filter (where created_at > '<GOLIVE>') from users` | Claims rise, and new rows are genuinely new people | A new row whose name matches an unclaimed legacy row means the member used a different email (spec §9). Relink it |
| Webhook | Clerk → Webhooks → attempts | No failures | Any failure |
| Neon compute | Neon console → Usage, CU-hrs since S25 | **< 2 in 48h** | **≥ 8 in 48h** means the endpoint is barely suspending, so look for a stream held open (D111). An always-awake endpoint is 0.25 × 48 = 12. D123's staging baseline is about 0.33 per 48h (5% of the allowance). Between 2 and 8, project it: anything above ~28/month plus D123's ceremony-season ceiling of 72 breaks the 100 CU-hr allowance |
| Heroku frozen | C1 against `$HEROKU_DB` | Equal to S14 | It moved: something is writing to the old database, probably through `cinemadraft.herokuapp.com` |

Raise the DNS TTL back at +48h if everything is green.

---

## Stage 3 — T7: Retire Heroku

- [ ] **S29 · OWNER — Keep the evidence first.**
  - `final.dump` sits in `$CUT` and in a second location off this machine, and `shasum -a 256 -c` passes on both copies.
  - `heroku pg:backups -a cinemadraft` still lists S14's backup as Completed.
  - The Neon `pre-cutover-<date>` branch is kept.

  **Check (AGENT):** restore the second copy into a scratch container and diff its counts against `$CUT/dump-row-counts.tsv`. Use the CI-verify recipe from AGENTS.md on port 5435, then run `pg_restore` and `scripts/row-counts.sh`. **Red:** a non-empty diff means that copy is not a backup.

- [ ] **S30 · OWNER — Scale to zero (the phase gate).**

  ```bash
  heroku ps:scale web=0 -a cinemadraft     # and every other type in before.txt
  heroku ps -a cinemadraft                 # expect: No dynos on ⬢ cinemadraft
  ```

  Maintenance stays **on**. **Check:** `https://cinemadraft.herokuapp.com/` returns 503, and C1 still equals S14. **Rollback:** `heroku ps:scale web=1 -a cinemadraft`, using the size from `before.txt`.
  "Scaled to zero" stops dyno billing and nothing else. The Postgres add-on keeps running, and keeps billing, until someone decides to delete it.

- [ ] **S31 · OWNER — Loose ends.**
  - Disable, **not delete**, the Auth0 application the old app signs in with. It is only needed for R3.
  - If Vercel's `OMDB_API_KEY` has the same value as the key hard-coded in the source (PARITY bug 11), rotate it.
  - Record Phase 13 in `PROGRESS.md`.

**Deleting Heroku (the app or the database) is not in this plan.** It is a separate, explicit owner decision, taken only after S29's copies are verified and the owner is satisfied that R3 will never be needed.

---

## Rollback ladder

| Where you are | Rollback | What it costs |
|---|---|---|
| Before S13 | Nothing to undo | Nothing |
| **R1:** S13 through S24 (the apex still on Heroku) | `heroku maintenance:off -a cinemadraft`, restore `before.txt`'s formation. Optionally revert S23's keys | Only the maintenance-page minutes. C1 proved Heroku unchanged, so nothing is lost. Neon is left as it is (staging) |
| **R2:** after S25, before any member write on Neon | Put the `before.txt` records back, then `heroku maintenance:off` | Up to one TTL (≤ 300s) of mixed resolution. Confirm it was clean by running C8 with `cutoff=$GOLIVE`: every per-table `created_since` and `updated_since` must be 0, apart from the S24 claims |
| **R3:** after members have written on Neon | Same as R2 | **Every Neon write since `$GOLIVE` is lost.** There is no Neon → Heroku path: `normalize.sql` is one-way, and Heroku has no `clerk_id` or the port's other columns. Members return to Auth0. Before taking it, save C8's output with `cutoff=$GOLIVE` so the losses are at least known. Forward-fix is the default; R3 is for a total outage that cannot be fixed within hours |
| After S30 | R3 plus `heroku ps:scale web=1` | Same as R3 |
| After Heroku is deleted | None | The final dump is all that is left |

---

## Where this plan departs from PLAN.md § Phase 13

1. **T2 leaves out `prisma/normalize.sql`.** Without it, `migrate deploy` runs against PascalCase tables and fails. The step is S18.
2. **T3b's explanation of the wipe is wrong, and so is its fix as written.**
   - "a restore with `--clean` reverts them" is not what happens. `--clean` drops only the dump's PascalCase names, so the snake_case tables and `_prisma_migrations` survive.
   - `0_init` is the **normalized** schema, not the dump's.
   - The fix is S17's wipe, followed by `migrate resolve --applied 0_init` before `deploy`.
3. **The row-count diff needs folded names after normalization.** `lower("AvailableYears")` is `availableyears`, not `available_years`, and the same goes for `DraftPicks` and `ProfileFeeds`. C4 strips the underscores.
4. **T1 says recreate the webhook, and T4 says point it at the apex.** This plan does both: create it at `next.` in S23, then edit its URL in S26 so the secret carries over.
5. **T5's verification is split.** Everything that can be proven before the point of no return is proven on `next.` (S24). Only the apex-specific checks remain after it (S27).

---

## Appendix — the checks

Every query runs as `"$PSQL" "$NEON_DIRECT" -At` unless marked otherwise.

**C1: write counter (Heroku).** Any change is red. Unlike row counts, it also catches updates and deletes.

```bash
"$PSQL" "$HEROKU_DB" -Atc "select sum(n_tup_ins + n_tup_upd + n_tup_del) from pg_stat_user_tables"
```

**C2: dump against live Heroku.** Must be empty.

```bash
diff "$CUT/dump-row-counts.tsv" <(scripts/row-counts.sh "$HEROKU_DB")
```

**C3: restore against dump, raw names.** Must be empty.

```bash
diff "$CUT/dump-row-counts.tsv" <(scripts/row-counts.sh "$NEON_DIRECT")
```

**C4: normalized.** The diff must be empty and the count must be 0.

```bash
norm() { grep -v -e '^sequelizemeta' -e '^_prisma_migrations' | awk -F'\t' -v OFS='\t' '{gsub(/_/, "", $1); print}' | sort; }
diff <(norm < "$CUT/dump-row-counts.tsv") <(scripts/row-counts.sh "$NEON_DIRECT" | norm)
"$PSQL" "$NEON_DIRECT" -Atc "select (select count(*) from information_schema.columns where table_schema = 'public'
  and (table_name <> lower(table_name) or column_name <> lower(column_name)))
  + (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public' and t.typtype = 'e' and t.typname <> lower(t.typname))"
```

**C5: the T3b schema.** 10 rows, all `t`.

```sql
select name, ok from (values
  ('nominations.year is integer', coalesce((select data_type = 'integer' from information_schema.columns
      where table_schema = 'public' and table_name = 'nominations' and column_name = 'year'), false)),
  ('events.focused_award_id',   exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'events' and column_name = 'focused_award_id')),
  ('available_years.is_active', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'available_years' and column_name = 'is_active')),
  ('movies.accent_hex',         exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'movies' and column_name = 'accent_hex')),
  ('users.clerk_id',            exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'clerk_id')),
  ('available_years_one_active partial unique', exists (select 1 from pg_indexes where schemaname = 'public'
      and indexname = 'available_years_one_active' and indexdef like 'CREATE UNIQUE INDEX%WHERE is_active%')),
  ('users_clerk_id_key unique', exists (select 1 from pg_indexes where schemaname = 'public'
      and indexname = 'users_clerk_id_key' and indexdef like 'CREATE UNIQUE INDEX%')),
  ('movies_title_trgm gin trigram', exists (select 1 from pg_indexes where schemaname = 'public'
      and indexname = 'movies_title_trgm' and indexdef like '%USING gin%gin_trgm_ops%')),
  ('pg_trgm installed', exists (select 1 from pg_extension where extname = 'pg_trgm')),
  -- to_jsonb, so the query still parses (and reads f) when the column is missing
  ('exactly one active year', (select count(*) = 1 from available_years y where (to_jsonb(y) ->> 'is_active')::boolean))
) as t(name, ok);
```

**C6: logos.** Must read `12|12`, then twelve lines each starting `200`.

```bash
"$PSQL" "$NEON_DIRECT" -Atc "select count(*) filter (where image like 'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/award-shows/%'), count(*) from events"
"$PSQL" "$NEON_DIRECT" -Atc "select image from events order by 1" | while read -r u; do curl -s -o /dev/null -w "%{http_code} $u\n" "$u"; done
```

**C7: invariants.** S22 gives the expected value for each line.

```sql
select 'claimed', count(*) from users where clerk_id is not null
union all select 'mixed-case', count(*) from users where email <> lower(email)
union all select 'folded collisions', count(*) from (select 1 from users group by lower(email) having count(*) > 1) d
union all select 'active years', count(*) from available_years where is_active;
```

**C8: drift since a cutoff.** Feed it to psql on stdin (`"$PSQL" "$NEON_DIRECT" -v cutoff='2026-08-14 02:17:25+00' <<'SQL' … SQL`), because psql does not interpolate variables in `-c`.

```sql
select table_name,
  (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I where created_at > %L',
      table_name, :'cutoff'), false, true, '')))[1]::text::int as created_since,
  (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I where updated_at > %L and coalesce(created_at <= %L, true)',
      table_name, :'cutoff', :'cutoff'), false, true, '')))[1]::text::int as updated_since
from information_schema.columns where table_schema = 'public' and column_name = 'created_at' order by 1;

select 'users.clerk_id set', count(*)::text from users where clerk_id is not null
union all select 'events.focused_award_id set', count(*)::text from events where focused_award_id is not null
union all select 'events.image on Blob', count(*)::text from events where image like 'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/%'
union all select 'movies.accent_hex set', count(*)::text from movies where accent_hex is not null
union all select 'active year', coalesce(string_agg(year::text, ','), 'none') from available_years where is_active;

select e.abbreviation, n.year, count(*) as nominations_since from nominations n
  join awards a on a.id = n.award_id join events e on e.id = a.event_id
  where n.created_at > :'cutoff' group by 1, 2 order by 1, 2;
select e.abbreviation, w.year, count(*) as winners_since from winners w
  join awards a on a.id = w.award_id join events e on e.id = a.event_id
  where w.created_at > :'cutoff' group by 1, 2 order by 1, 2;

select c.relkind, count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' group by 1 order by 1;
select extname, extnamespace::regnamespace from pg_extension order by 1;
```

**C9: which Clerk instance the page carries.** Must print exactly one line, `pk_live_…`, and the decode must read `clerk.cinemadraft.com$`.

```bash
PK="$(curl -s https://next.cinemadraft.com/auth/login | grep -Eo 'pk_(test|live)_[A-Za-z0-9+/=]+' | sort -u)"; echo "$PK"
echo "${PK#pk_live_}" | base64 -d; echo
```
