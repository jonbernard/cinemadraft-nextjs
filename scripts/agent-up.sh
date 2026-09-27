#!/usr/bin/env bash
#
# Provision an isolated environment for one agent: a git worktree, its own
# Postgres restored to the baseline, and a port nothing else is using.
#
# 🔴 Why this exists. Agents used to share two fixed databases (5433/5434), so
# exactly two could run at once no matter how unrelated their work was — and
# `lib/db.test.ts` pinned those two ports, so a third was not a matter of
# starting one. The file-level conflicts are real and always will be; the
# infrastructure ceiling was not.
#
# Usage:  bash scripts/agent-up.sh <name> [base-branch]
# Then:   eval "$(bash scripts/agent-up.sh <name>)"   # to get the exports
#
# Tear down with scripts/agent-down.sh <name>.
set -euo pipefail

NAME="${1:?usage: agent-up.sh <name> [base-branch]}"
BASE="${2:-dev}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WT="$(dirname "$REPO")/.cd-wt-${NAME}"
CONTAINER="cinemadraft-pg-agent-${NAME}"
BASELINE="$REPO/.local/baseline.dump"
BRANCH="agent/${NAME}"

# Everything this script says to the operator goes to stderr, so that stdout is
# only the `export` lines and `eval "$(...)"` works.
say() { printf '%s\n' "$*" >&2; }

free_port() {
  local port="$1"
  while lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do port=$((port + 1)); done
  printf '%s' "$port"
}

# 🔴 The baseline is a FILE, not a live database. Cloning from whichever
# database happens to be free inherits whatever scratch rows a browser run left
# in it, and those rows break the exact row-count assertions in lib/db.test.ts
# in the next agent's suite — a failure that looks like a code regression and is
# not. Refresh it deliberately with scripts/agent-baseline.sh.
if [ ! -s "$BASELINE" ]; then
  say "error: no baseline at .local/baseline.dump"
  say "       run: bash scripts/agent-baseline.sh <port-of-a-clean-database>"
  exit 1
fi

if [ -d "$WT" ]; then
  say "error: $WT already exists — tear it down first (scripts/agent-down.sh $NAME)"
  exit 1
fi

PG_PORT="$(free_port 5440)"
# 🔴 DERIVED from the database port, not searched for separately. `free_port`
# only reports what is listening NOW, and a server port is not bound until the
# agent starts one — so two agents provisioned back to back both got 6440, and
# the second to run e2e would have been handed the first's server by
# `reuseExistingServer`, carrying the wrong E2E_TEST_AUTH_SECRET and failing
# every spec as "not signed in". The database container IS bound at this point,
# so 5440->6440, 5441->6441 is unique by construction.
E2E_PORT="$((PG_PORT + 1000))"

say "worktree   $WT  (branch $BRANCH off $BASE)"
git -C "$REPO" worktree add -b "$BRANCH" "$WT" "$BASE" >&2

# Hardlinks, not symlinks: Turbopack rejects a symlinked node_modules outright
# ("points out of the filesystem root"). `generated/` is gitignored Prisma
# output, so a fresh worktree has none and typecheck silently collapses Prisma
# types to `any` without it.
say "deps       hardlinking node_modules and generated"
cp -al "$REPO/node_modules" "$REPO/generated" "$WT/" 2>/dev/null || {
  say "error: could not hardlink node_modules/generated — is the repo on one filesystem?"
  exit 1
}
[ -f "$REPO/.env" ] && cp "$REPO/.env" "$WT/"

say "database   $CONTAINER on $PG_PORT"
docker run -d --name "$CONTAINER" \
  -e POSTGRES_USER=cinemadraft -e POSTGRES_PASSWORD=local -e POSTGRES_DB=cinemadraft \
  -p "$PG_PORT:5432" postgres:17 >/dev/null

# No named volume above, deliberately: the data dies with the container, so a
# torn-down agent leaves nothing behind to be restored from by accident.
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U cinemadraft -d cinemadraft >/dev/null 2>&1; then break; fi
  sleep 1
done

say "restore    baseline.dump"
PGPASSWORD=local pg_restore -h localhost -p "$PG_PORT" -U cinemadraft -d cinemadraft \
  --no-owner --no-privileges "$BASELINE" >/dev/null 2>&1 || true

DB_URL="postgresql://cinemadraft:local@localhost:${PG_PORT}/cinemadraft"

# 🔴 **Bring the schema current, always.** The dump carries the schema as it was
# when it was captured, so any migration added since is missing — and the
# symptom is not a migration error, it is
# `The column events.focused_award_id does not exist` thrown out of an unrelated
# repository call, in an agent that has changed nothing near it. That is exactly
# how this script failed its own first end-to-end run.
#
# Running migrations here rather than re-capturing the baseline on every schema
# change is what makes the baseline a DATA fixture instead of a data-and-schema
# one, so it only has to be refreshed when the ROWS should change.
say "migrate    bringing the schema up to date"
( cd "$REPO" && DATABASE_URL="$DB_URL" npx prisma migrate deploy >/dev/null 2>&1 ) || {
  say "🔴 migrate deploy failed against $PG_PORT — the agent's schema is behind"
  exit 1
}

# The worktree's own .env.local. Process env still wins, but an agent that
# forgets to export is then pointed at its OWN database rather than the owner's.
{
  echo "# Written by scripts/agent-up.sh for agent '${NAME}'. Gitignored (.env*)."
  echo "DATABASE_URL=\"${DB_URL}\""
  grep -v '^DATABASE_URL' "$REPO/.env.local" 2>/dev/null || true
} > "$WT/.env.local"

COUNTS="$(PGPASSWORD=local psql -h localhost -p "$PG_PORT" -U cinemadraft -d cinemadraft -tAc \
  "select (select count(*) from users)||'/'||(select count(*) from leagues)||'/'||(select count(*) from movies)||'/'||(select count(*) from drafts)" 2>/dev/null || echo '?')"
say "verify     $COUNTS  (expect 60/13/1355/156)"
if [ "$COUNTS" != "60/13/1355/156" ]; then
  say "🔴 baseline does not match — the agent's row-count assertions WILL fail."
  say "   refresh it: bash scripts/agent-baseline.sh <port-of-a-clean-database>"
fi

cat <<EOF
export AGENT_NAME="${NAME}"
export AGENT_WORKTREE="${WT}"
export AGENT_BRANCH="${BRANCH}"
export DATABASE_URL="${DB_URL}"
export E2E_PORT="${E2E_PORT}"
EOF
