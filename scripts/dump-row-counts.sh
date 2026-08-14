#!/usr/bin/env bash
# Exact row count per table *inside a dump file*, without restoring it.
#
#   scripts/dump-row-counts.sh .local/prod-dump.dump
#
# This is the correct expected-value source for verifying a restore.
#
# The obvious alternative — counting rows in live production — is wrong, and
# quietly so. A dump is a point-in-time snapshot of a database that keeps
# taking writes. Our own capture proved it: the dump was taken 2026-08-13
# 22:17 EDT, the production counts were captured twelve hours later, and by
# the following afternoon the users table had gained another row. Comparing a
# restore against production counts therefore tests the wrong thing, and its
# result depends on how much traffic the old app happened to take in between.
#
# Counting inside the dump has neither problem: it is derived from the same
# bytes that get restored, so a mismatch after restore is unambiguously a
# restore failure.
#
# Output is `table_name<TAB>count`, lowercased and sorted, matching the format
# of scripts/row-counts.sh so the two can be compared with diff.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <dump-file>" >&2
  exit 2
fi

DUMP="$1"
[ -f "$DUMP" ] || { echo "no such dump: $DUMP" >&2; exit 2; }

# Must be a client at least as new as the server that produced the dump.
# The system psql/pg_restore here is older and fails with
# "unsupported version (1.16) in file header".
PG_RESTORE="$(brew --prefix libpq)/bin/pg_restore"
[ -x "$PG_RESTORE" ] || PG_RESTORE="pg_restore"

# The data section is a series of COPY blocks terminated by a lone `\.`.
# Count the lines between them, per table.
"$PG_RESTORE" --data-only --no-owner --no-privileges -f - "$DUMP" | awk '
  /^COPY /{
    # COPY public."Movies" (...) FROM stdin;
    # Strip quotes BEFORE the schema prefix — the raw token may start with a
    # quote, so anchoring on ^public. first silently matches nothing.
    table = $2
    gsub(/"/, "", table)
    sub(/^[^.]+\./, "", table)
    n = 0
    inside = 1
    next
  }
  inside && /^\\\.$/{
    print tolower(table) "\t" n
    inside = 0
    next
  }
  inside { n++ }
' | sort
