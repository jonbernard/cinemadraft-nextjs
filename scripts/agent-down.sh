#!/usr/bin/env bash
#
# Tear an agent environment down.
#
#   scripts/agent-down.sh <name> --env-only   the AGENT runs this when it finishes:
#                                             kills its server, removes its database,
#                                             frees its ports. Leaves the worktree and
#                                             the branch, which still hold the work.
#
#   scripts/agent-down.sh <name>              the ORCHESTRATOR runs this after merging:
#                                             everything above, plus the worktree and
#                                             the branch.
#
# 🔴 The hazard is not uncommitted changes — `git worktree remove` refuses those
# unless forced, which is why this never passes --force. It is COMMITTED work on
# an unmerged branch: remove the worktree and the branch stays behind, nothing
# complains, and the commits sit invisible until somebody runs `git branch`. So
# the full mode checks and refuses rather than tidying. That is also why the
# agent's own mode cannot touch either.
set -euo pipefail

NAME="${1:?usage: agent-down.sh <name> [--env-only]}"
MODE="${2:-full}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WT="$(dirname "$REPO")/.cd-wt-${NAME}"
CONTAINER="cinemadraft-pg-agent-${NAME}"
BRANCH="agent/${NAME}"

# Any next/playwright server this agent left listening. A stray server is not
# merely untidy: `reuseExistingServer` silently hands the NEXT run the old
# process, carrying the previous run's E2E_TEST_AUTH_SECRET, and every spec
# then fails as "not signed in" for a reason the failure text never names.
# That has cost debugging time here twice.
if [ -f "$WT/.env.local" ]; then
  PORT="$(grep -oE 'localhost:([0-9]+)' "$WT/.env.local" | head -1 | cut -d: -f2 || true)"
fi
for p in $(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk '/node|next/ {print $2}' | sort -u); do
  if ps -p "$p" -o command= 2>/dev/null | grep -q "$WT"; then
    echo "killing server pid $p (started in $WT)"
    kill "$p" 2>/dev/null || true
  fi
done

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "removing database $CONTAINER"
  # No named volume was created, so the data goes with the container and
  # nothing is left for a later run to be restored from by accident.
  docker rm -f "$CONTAINER" >/dev/null
fi

if [ "$MODE" = "--env-only" ]; then
  echo "env released: $NAME (worktree and branch kept — they hold the work)"
  exit 0
fi

if [ -d "$WT" ]; then
  DIRTY="$(git -C "$WT" status --porcelain)"
  if [ -n "$DIRTY" ]; then
    echo "refusing: $WT has uncommitted changes:" >&2
    printf '%s\n' "$DIRTY" >&2
    exit 1
  fi
fi

if git -C "$REPO" show-ref --verify --quiet "refs/heads/$BRANCH"; then
  UNMERGED="$(git -C "$REPO" log "dev..$BRANCH" --oneline)"
  if [ -n "$UNMERGED" ]; then
    echo "refusing: $BRANCH has commits not in dev:" >&2
    printf '%s\n' "$UNMERGED" >&2
    echo "merge it first, then re-run." >&2
    exit 1
  fi
fi

[ -d "$WT" ] && git -C "$REPO" worktree remove "$WT"
# -d, not -D: it refuses if unmerged, and that refusal is the last thing
# standing between "cleaned up" and "deleted a day's work".
git -C "$REPO" show-ref --verify --quiet "refs/heads/$BRANCH" && git -C "$REPO" branch -d "$BRANCH"

echo "torn down: $NAME"
git -C "$REPO" worktree list
