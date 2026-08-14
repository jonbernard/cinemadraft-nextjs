#!/usr/bin/env bash
# Exact row count per table, for verifying a restore or a schema migration.
#
#   scripts/row-counts.sh "$DATABASE_URL"
#   scripts/row-counts.sh "$DATABASE_URL" > .local/neon-row-counts.txt
#
# Uses a real count(*) per table via query_to_xml, NOT
# pg_stat_user_tables.n_live_tup. That column is a statistics estimate that
# stays stale until ANALYZE runs, and on the production database it reported
# counts far below the truth — which would have made it useless as a gate.
#
# Output is `table_name<TAB>count`, sorted, with no psql chrome, so two runs
# can be compared with diff. Table names are lowercased so a run against the
# original PascalCase schema and a run against the normalized snake_case
# schema stay comparable — the point of the check is that no ROWS were lost,
# and the rename is verified separately.
#
# The same query must be used on both sides of any comparison. That is the
# whole reason this is a script rather than a command typed twice.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <connection-string> [--raw-names]" >&2
  exit 2
fi

CONN="$1"
LOWER="lower(table_name)"
if [ "${2:-}" = "--raw-names" ]; then
  LOWER="table_name"
fi

# The libpq client, not whatever `psql` resolves to. A client older than the
# server is the mismatch that broke pg_restore during Phase 0.
PSQL="$(brew --prefix libpq)/bin/psql"
[ -x "$PSQL" ] || PSQL="psql"

"$PSQL" "$CONN" --no-align --tuples-only --field-separator=$'\t' -c "
select ${LOWER} as t,
       (xpath('/row/cnt/text()',
              query_to_xml(format('select count(*) as cnt from %I.%I', table_schema, table_name),
                           false, true, '')))[1]::text::bigint as n
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
order by 1;
"
