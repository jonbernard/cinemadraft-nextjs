# Phase 13 — Cutover (runbook)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. This is a runbook, not a build: steps run **in order**, one at a time, and most are the owner's. Steps use checkbox (`- [ ]`) syntax. **An AGENT step that touches Heroku, Neon, Clerk, Vercel or DNS runs only after the owner has approved the exact command shown.**

**Goal:** `cinemadraft.com` served by Vercel from a Neon database that holds Heroku's last write. Nothing lost, every schema change the port made put back, and Heroku scaled to zero.

**Architecture:** Freeze Heroku. Dump it. Wipe Neon and restore the dump. Re-apply D27's normalization and the four Prisma migrations, then the logo URLs. Swap Clerk to its Production instance. Verify all of it on `next.cinemadraft.com`, and only then move the apex. Until the apex moves, rollback is `heroku maintenance:off`.

**Spec:** `docs/PLAN.md` § Phase 13 (T1–T7), spec §8 (migration sequence, D27) and §9 (claiming, D25/D26), `docs/reference/clerk-instance-settings.md`, and the Phase 0/2/12 notes in `docs/PROGRESS.md`.

> 🔴 **The rule: the cutover restore is a full wipe-and-replace from the live Heroku site.** Nothing done on staging (`next.cinemadraft.com` and its Neon database) survives it: not leagues, drafts or award entries made there, and not one Clerk claim. **Staging is disposable.** That is what lets the owner test it hard during Phase 12, and `scripts/restore-from-heroku.sh` puts it back to a copy of the live site in one command, as often as needed (§ Resetting staging during testing). This plan re-applies nothing from Neon.

## Global Constraints

- 🔴 **Red means stop.** Every step names its check and what red looks like, and those are fixed before the step runs. A red check is never re-read as green. If a check turns out unable to fail, stop, replace it, and write down that you did (AGENTS.md).
- 🔴 **Heroku is the system of record until S25.** Every real write happens there. Anything that exists only on Neon is gone after S17, on purpose.
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
2. **`nominations.year` comes back as `text` and every film scores zero, with no error anywhere.** → the script's C5 in S17, and S24's standings compared against the Heroku oracle from S12.
3. **A stale Dev-instance `clerk_id` survives the restore.** The member's first Production sign-in then hits the never-reassign guard, and they get `AccountLinkError` on their own account. → the script's C7 asserts zero claimed rows, and S22 re-reads it.
4. **The Prisma CLI migrates Docker or the pooler instead of Neon's direct endpoint.** → the script passes the target as `DIRECT_URL`, refuses a `-pooler` host, and makes the operator type the host it is about to wipe.
5. **The mixed-case email account is locked out.** → S22 compares the count against Heroku's, and S24d is a real sign-in by that member.

---

## Conventions

**Roles.** **OWNER** steps are dashboards, DNS, credentials and anything outward-facing. **AGENT** steps are local, read-only, or a scripted command the owner approves before it runs.

**Shell, set once per session.** Run from the rehearsal worktree S11 creates, which is checked out at the commit Vercel Production deploys:

```bash
export REPO=/Users/jonbernard/Development/cinemadraft-nextjs
export CUT="$REPO/.local/cutover"            # gitignored; every artefact below lands here
export PSQL="$(brew --prefix libpq)/bin/psql" PGR="$(brew --prefix libpq)/bin/pg_restore"
export HEROKU_DB="$(heroku config:get DATABASE_URL -a cinemadraft)"   # no CLI: `read -rs HEROKU_DB` and paste the URI from the Heroku dashboard
export NEON_DIRECT="$(grep -m1 '^DATABASE_URL_UNPOOLED=' "$REPO/.env.neon" | cut -d= -f2- | tr -d '"')"
case "$NEON_DIRECT" in *-pooler.*) echo "RED: pooled URL";; *ep-morning-block-aus9jqrt.*) echo ok;; *) echo "RED: not the production endpoint";; esac
mkdir -p "$CUT"
```

The endpoint is `ep-morning-block-aus9jqrt`, from P12.T1. Anything other than `ok` is red.

**Already dry-run, 2026-09-27**, twice. First by hand (S17 → S20, C3–C8), with `.local/baseline.dump` standing in for today's Neon and the August dump for the final one: 0 restore errors, 146 uppercase identifiers before normalizing and 0 after, all 5 migrations unapplied before `resolve`, C6 `0|12` → `12|12`, C7 claimed 0 / mixed-case 1 / collisions 0 / active 1.

Then through `scripts/restore-from-heroku.sh`, into a throwaway Docker Postgres 17 on 5460 with the August dump (`.local/prod-dump.dump`, 360K):
- Run 1 on an empty database, confirmed by typing the host at the prompt: green. Run 2 on the result, with `--yes`: green. Run 3 after dirtying it (a junk user and five junk films, a stray table, a stray column on `nominations`, a user given a `clerk_id`, the Oscars logo put back to its old path, no active year, three winners deleted): green, and afterwards every count matched the dump again, the stray table and column were gone, and the logo was back on Blob.
- **1.3 seconds** per run (three timed runs: 1.25, 1.28, 1.24s), including counting the dump.
- Each mutation went red at the check it should: skipping the wipe → C3 (or `pg_restore` itself, when PascalCase tables are already there); skipping `normalize.sql` → C4 (146 uppercase identifiers); skipping `migrate deploy` → C5; skipping the logo SQL → C6 (`0|12`); deleting a winner straight after `pg_restore` → C3; deleting one at the end → C7's recount; `nominations.year` put back to `text` → C5, naming that row; no active year → C7; a claimed user → C7. A truncated dump is refused before the wipe; a mid-step SQL error is reported as `failed during: <step>`.

S11 repeats the script run against a fresh Heroku dump.

**Point of no return: S25.** That is the moment the apex resolves to Vercel. The first member write on Neon follows within minutes, and from then on going back to Heroku loses that write. Before S25, every step is free to undo. The rollback ladder is at the end.

---

## What a full restore wipes

**Schema.** These are the seven changes from PLAN.md § T3b and after. They are gone after the wipe in S17, the script's `migrate deploy` puts them back, and each has its own line in check C5:

| Migration | Change |
|---|---|
| `20260814130000_app_columns` | `available_years.is_active` plus the `available_years_one_active` partial unique index (D22) |
| `20260814130000_app_columns` | `movies.accent_hex` |
| `20260814130000_app_columns` | `users.clerk_id` plus `users_clerk_id_key`. Without it, sign-in is a total outage |
| `20260815160000_movie_title_search` | `pg_trgm` plus the `movies_title_trgm` GIN index |
| `20260816120000_nominations_year_integer` | `nominations.year` as `integer`. The restore brings back `text`, and nothing errors |
| `20260913120000_event_focused_award` | `events.focused_award_id` (D117) |
| `20260928090000_event_has_ceremony` | `events.has_ceremony`, AFI false (D129). Without it the rail waits for an AFI ceremony forever |

**Data: all of it.** Everything on Neon is replaced by the dump. None of it is re-applied. The lines worth knowing:

| What | After the restore |
|---|---|
| `events.image`: 12 Blob URLs (Phase 11) | Back to `/images/awards/*.jpg`, then the script applies `prisma/award-logos.sql` (PLAN.md § T3) and checks 12 of 12 |
| `users.clerk_id` from staging sign-ins | NULL. 🔴 **Required, not just acceptable.** They are Development-instance ids and can never match a Production identity; a survivor makes that member's first sign-in a collision. The script's C7 asserts 0 |
| `available_years.is_active` | The migration marks **2026**, and the script asserts exactly one active year. If the season should be another year by then, S21 sets it |
| `events.focused_award_id`, `movies.accent_hex` | NULL. NULL means "nothing on screen" (D117); accent colours refill lazily |
| Everything created on staging: users, leagues, drafts, picks, lists, watchlists, TMDB-cached films, nominations, winners, notifications, roster posts | Deleted. Test data |
| `_prisma_migrations` | Dropped by the wipe, rebuilt by the script |

---

## Resetting staging during testing

Staging can be put back to a copy of the live site **at any time during Phase 12's manual walk**, with the same script the window uses. Break whatever you like; this undoes it.

**Once first:** a way to dump Heroku. Either install the Heroku CLI and `heroku login` (S5), or copy the database URI from the Heroku dashboard (cinemadraft → Resources → Heroku Postgres → Settings → Database Credentials). Neon's unpooled URL is `DATABASE_URL_UNPOOLED` in `.env.neon`. Run from a checkout that has the script (it lands with this plan's branch) and sits at the commit Vercel Production is deployed from: `migrate deploy` applies that checkout's `prisma/migrations`, and a checkout ahead of Production would add columns the deployed code does not know about.

```bash
REPO=/Users/jonbernard/Development/cinemadraft-nextjs; mkdir -p "$REPO/.local/cutover"
DUMP="$REPO/.local/cutover/staging-$(date +%Y%m%d-%H%M).dump"

# 1. A fresh dump. Either:
heroku pg:backups:capture -a cinemadraft && heroku pg:backups:download -a cinemadraft --output "$DUMP"
# or, without the CLI:
read -rs HEROKU_DB && /opt/homebrew/opt/libpq/bin/pg_dump -Fc -d "$HEROKU_DB" -f "$DUMP"

# 2. Wipe staging and restore it. Close every staging tab first.
NEON_DIRECT="$(grep -m1 '^DATABASE_URL_UNPOOLED=' "$REPO/.env.neon" | cut -d= -f2- | tr -d '"')"
bash scripts/restore-from-heroku.sh "$DUMP" "$NEON_DIRECT"
# It shows the host, database, dump size and dump time, and asks you to type the host:
#   ep-morning-block-aus9jqrt.c-10.us-east-1.aws.neon.tech
```

Green is the last line, `GREEN: restored 17 tables …`. Any `RED:` line names the check that failed; fix the cause and run it again, since every run starts with a wipe.

**What it costs.**
- **Nothing on Heroku changes.** `pg_dump` is a read; `pg:backups:capture` adds one backup to Heroku's list and touches no rows. Members keep using the live site throughout.
- **Time:** 1.3 seconds locally, against Docker. Against Neon it is network-bound and has not been measured; expect well under a minute, plus the dump itself. Staging answers with errors for that long, between the wipe and the end of `migrate deploy`.
- The award-show pages are render-cached (`app/api/revalidate/route.ts`). If one still shows staging-era nominations afterwards, redeploy Production, or run `award-import.mjs refresh <show>` with `SITE_URL=https://next.cinemadraft.com`.

**What you lose: everything done on staging, including every Clerk claim.** Every `users.clerk_id` is NULL again, so every account is unclaimed, exactly as it will be at cutover.

**The Clerk Development instance is not reset**, and does not need to be. It still holds every identity made on staging, each with the id that pointed at a now-wiped `users.clerk_id`. What that means on the next visit (`getCurrentUser` in `lib/auth.ts` → `syncClerkIdentity` → `userRepository.claim`):
- **An identity whose verified email belongs to a Heroku account is re-claimed silently, on its next page load.** The id lookup misses, the email matches, and the conditional write attaches the same Dev id to the same row. A tab that is still signed in does not even need to sign in again. No webhook is needed: this is the lazy path, the same code the Production cutover relies on.
- **The mixed-case email account** is matched case-insensitively (`byEmail`), so it re-claims like any other. Each reset makes it unclaimed again, which is a free rehearsal of S24d if its owner is willing to sign in.
- **An identity whose email is not in Heroku** (a test address registered on staging) gets a brand-new, empty `users` row with a new id. Its old row, and every league it made, went with the reset.
- **Two Clerk identities with one email** (possible if account linking was ever off on the Dev instance) cannot both win: the first to load a page claims the row and the second gets `AccountLinkError`. Delete the duplicate in the Clerk Dev dashboard, or relink through `/admin`.
- If the script's C7 reports claimed users, a staging tab re-claimed its account between `migrate deploy` and the check. It is harmless on staging; close the tab and run again. At cutover it is S22's red.

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
  - (b) *(Removed 2026-09-27: nothing on Neon is kept, so there is nothing to give a verdict on.)*
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

- [ ] **S7 · AGENT (read-only, optional) — What S17 will discard.** For the owner's peace of mind only; nothing is re-applied. `scripts/row-counts.sh "$NEON_DIRECT" > "$CUT/neon-discarded.txt"` records staging's per-table counts, and C8 with `cutoff='2026-08-14 02:17:25+00'` (the August dump's creation time) shows what changed since the last restore. There is no red: whatever it lists is deleted by design.

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

  Run the script against it, twice, exactly as S17 will, but with `--yes` (localhost only):

  ```bash
  bash scripts/restore-from-heroku.sh "$DUMP" "$NEON_DIRECT" --yes    # then again: it must be green both times
  ```

  Its mutations were already watched going red on 2026-09-27 (Conventions); re-do one if the script has changed since. Then:

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

  Without the CLI: `"$(brew --prefix libpq)/bin/pg_dump" -Fc -d "$HEROKU_DB" -f "$CUT/final.dump"`. That leaves no Heroku-side backup for T7, so take one from the Heroku dashboard as well.

  **Check (AGENT):**

  ```bash
  "$PGR" --list "$CUT/final.dump" | head -20          # header names the Heroku source, created just now
  shasum -a 256 "$CUT/final.dump" | tee "$CUT/final.dump.sha256"
  scripts/dump-row-counts.sh "$CUT/final.dump" > "$CUT/dump-row-counts.tsv"
  ```

  Then run **C2**, run C1 once more, and record `select count(*) from "Users" where email <> lower(email)` from `$HEROKU_DB` into `$CUT/heroku-mixed-case.txt`.
  **Red:** C2 is not empty, or C1 has moved since S13. Either means a write landed between the freeze and the dump. Go back to S13's red path, then capture again.

- [ ] **S15 · (Removed 2026-09-27.)** A Neon backup branch existed to keep what S7 found. Nothing on Neon is kept.

- [ ] **S16 · (Removed 2026-09-27.)** It re-ran S7 to catch new staging writes needing a verdict. There are no verdicts.

- [ ] **S17 · AGENT (owner approves) — Wipe, restore, normalize, migrate, logos (T2, T3, T3b).** One command. The owner types the host at its prompt:

  ```bash
  bash scripts/restore-from-heroku.sh "$CUT/final.dump" "$NEON_DIRECT" 2>&1 | tee "$CUT/restore.txt"   # type ep-morning-block-aus9jqrt.c-10.us-east-1.aws.neon.tech
  ```

  It does, in order and stopping at the first red: `DROP SCHEMA public CASCADE` (🔴 not `pg_restore --clean`, which drops only the dump's PascalCase names and leaves the port's snake_case tables and `_prisma_migrations` behind); `pg_restore --no-owner --no-privileges --exit-on-error` and **C3**; `prisma/normalize.sql` (D27, which PLAN.md § T2 leaves out) and **C4**; `migrate resolve --applied 0_init` then `migrate deploy`, with the target passed as `DIRECT_URL`, and **C5**; `prisma/award-logos.sql` and **C6**; then **C7**. The checks are defined in the script.
  **Green:** the last line reads `GREEN: restored 17 tables into ep-morning-block-aus9jqrt…`, and the Prisma output names that host.
  **Red:** any `RED:` line, which names its check. Fix the cause and run it again; every run starts with a wipe, so there is no partial state to clean up. Never continue past a red. A `normalize.sql` error most likely means Heroku's schema changed since the file was generated (`scripts/generate-normalize-sql.mjs`); S11 should have caught it first.
  Then, AGENT, the part the script cannot do: every Blob URL answers `200`.

  ```bash
  "$PSQL" "$NEON_DIRECT" -Atc "select image from events order by 1" | while read -r u; do curl -s -o /dev/null -w "%{http_code} $u\n" "$u"; done
  ```

- [ ] **S18–S20 · (Folded into S17 on 2026-09-27.)** Normalize, migrate and the logo URLs are steps 3–5 of the script.

- [ ] **S21 · AGENT / OWNER — Only what S4a decided.** Usually nothing. Staging data is never re-applied.
  - **Active season**, if it should not be 2026. This must be two statements, because the partial unique index would reject a single-statement swap:

    ```sql
    BEGIN; UPDATE available_years SET is_active = false WHERE is_active;
    UPDATE available_years SET is_active = true WHERE year = <Y>; COMMIT;
    ```

  - **Award entries** that S4a decided must land between the restore and go-live. Follow the award-entry skill with `DATABASE_URL="$NEON_DIRECT"`. 🔴 Also set **`SITE_URL=https://next.cinemadraft.com`** on `refresh`: its default is `https://cinemadraft.com`, which is still Heroku at this point. You would get a 404 from Heroku, and the skill reads a 404 as "secret mismatch".
  - If the owner wants no broadcast, flip the flag by hand instead of running `finish --commit`: `UPDATE events SET nom_active = false, updated_at = now() WHERE abbreviation = '<abbr>'` (use `awards_active` for winners).

  **Check:** `refresh` reports no missing titles. C7's active-year line reads 1 row and the intended year.

- [ ] **S22 · AGENT (read-only) — Data invariants.** The script ran C7 already; run **C7** again here, because S21 may have written since.
  - Claimed users = **0**.
  - Mixed-case emails = the number in `$CUT/heroku-mixed-case.txt`.
  - Folded-email collisions = **0**.
  - Active years = **1**.

  **Red:** any line off. A nonzero claimed count means someone signed in to `next.` during the window, so stay signed out until S24. If that is what happened and S24 has not started, clear it with `UPDATE users SET clerk_id = NULL` and re-run C7. A mixed-case count that is off means S17 did not restore the dump you think it did. The script's last line prints the same count.

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

1. **T2 leaves out `prisma/normalize.sql`.** Without it, `migrate deploy` runs against PascalCase tables and fails. It is step 3 of S17's script.
2. **T3b's explanation of the wipe is wrong, and so is its fix as written.**
   - "a restore with `--clean` reverts them" is not what happens. `--clean` drops only the dump's PascalCase names, so the snake_case tables and `_prisma_migrations` survive.
   - `0_init` is the **normalized** schema, not the dump's.
   - The fix is S17's wipe, followed by `migrate resolve --applied 0_init` before `deploy`.
3. **The row-count diff needs folded names after normalization.** `lower("AvailableYears")` is `availableyears`, not `available_years`, and the same goes for `DraftPicks` and `ProfileFeeds`. The script's C4 strips the underscores.
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

**C3–C6 live in `scripts/restore-from-heroku.sh`**, which runs them after the step each one guards: C3 raw counts against the dump's (`scripts/dump-row-counts.sh` vs `scripts/row-counts.sh`), C4 folded counts and zero uppercase identifiers, C5 the ten T3b schema facts, C6 `12|12` logos on Blob. The script is their only definition.

**C7: invariants.** S22 gives the expected value for each line. The script runs the same four at its end, plus a second folded recount.

```sql
select 'claimed', count(*) from users where clerk_id is not null
union all select 'mixed-case', count(*) from users where email <> lower(email)
union all select 'folded collisions', count(*) from (select 1 from users group by lower(email) having count(*) > 1) d
union all select 'active years', count(*) from available_years where is_active;
```

**C8: drift since a cutoff.** For S7's optional report, and for R2/R3 with `cutoff=$GOLIVE`. Feed it to psql on stdin (`"$PSQL" "$NEON_DIRECT" -v cutoff='2026-08-14 02:17:25+00' <<'SQL' … SQL`), because psql does not interpolate variables in `-c`.

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
