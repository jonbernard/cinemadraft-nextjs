#!/usr/bin/env bash
#
# Capture the restore baseline every agent database is built from.
#
# 🔴 Take it from a database NOTHING has run a browser suite against since its
# last restore. The e2e specs register real accounts and create leagues, shows
# and films; a baseline carrying those rows makes lib/db.test.ts's exact counts
# fail in every agent afterwards, and that failure reads as a code regression.
# The script refuses rather than capturing a drifted source.
set -euo pipefail

PORT="${1:?usage: agent-baseline.sh <port of a clean local database>}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$REPO/.local/baseline.dump"

if [ "$PORT" = "5432" ]; then
  echo "refusing: 5432 is the owner's database and carries their own leagues" >&2
  exit 1
fi

COUNTS="$(PGPASSWORD=local psql -h localhost -p "$PORT" -U cinemadraft -d cinemadraft -tAc \
  "select (select count(*) from users)||'/'||(select count(*) from leagues)||'/'||(select count(*) from movies)||'/'||(select count(*) from drafts)")"
if [ "$COUNTS" != "60/13/1355/156" ]; then
  echo "refusing: port $PORT reads $COUNTS, not the baseline 60/13/1355/156." >&2
  echo "          Something has written to it. Restore it first." >&2
  exit 1
fi

mkdir -p "$REPO/.local"
PGPASSWORD=local pg_dump -h localhost -p "$PORT" -U cinemadraft -d cinemadraft -Fc -f "$OUT"

# 🔴 pg_dump writes a 0-byte file and exits 0 when it cannot authenticate —
# PGPASSWORD set only on the restore side has produced exactly that here before.
if [ ! -s "$OUT" ]; then
  echo "refusing: the dump is empty" >&2
  rm -f "$OUT"
  exit 1
fi

echo "baseline captured from :$PORT — $COUNTS — $(wc -c < "$OUT" | tr -d ' ') bytes -> .local/baseline.dump"
