#!/usr/bin/env bash
#
# Replace a database with a Heroku dump, in the shape the new app expects.
#
#   scripts/restore-from-heroku.sh <dump-file> <target-database-url> [--yes]
#
# 🔴 This WIPES the target's `public` schema. Nothing in it survives. That is
# the point: it is the cutover's restore (Phase 13 S17–S20, S22) and the way to
# reset staging to a fresh copy of the live site during testing.
#
# In order, stopping at the first red:
#   1. wipe `public`                        (S17; never `pg_restore --clean`, see the plan)
#   2. pg_restore --no-owner --no-privileges, then C3: counts equal the dump's
#   3. prisma/normalize.sql (D27),           then C4: folded counts, no uppercase left
#   4. prisma migrate resolve --applied 0_init, migrate deploy, then C5: T3b schema
#   5. prisma/award-logos.sql (T3),          then C6: 12 of 12 logos on Blob
#   6. C7: counts still the dump's, 0 claimed, 0 folded-email collisions, exactly 1 active year
#
# The target must be a postgres:// URL. For Neon, use the UNPOOLED one
# (`DATABASE_URL_UNPOOLED` in .env.neon); a `-pooler` host is refused, because
# migrate's advisory lock and DDL do not survive PgBouncer.
#
# Guards: refuses localhost:5432 (the owner's database, AGENTS.md), refuses a
# dump `pg_restore --list` cannot read, and asks the operator to type the
# target host. `--yes` skips that prompt for localhost targets only.
# The URL's password is never printed.
#
# ── Getting the dump. Neither is run by this script. ─────────────────────────
#
#   a) Heroku CLI (not installed on this machine as of 2026-09-27):
#        heroku pg:backups:capture  -a cinemadraft
#        heroku pg:backups:download -a cinemadraft --output .local/cutover/final.dump
#
#   b) No CLI: pg_dump straight from Heroku's URL. Get it from the Heroku
#      dashboard → cinemadraft → Resources → Heroku Postgres → Settings →
#      Database Credentials → URI. Heroku rotates it, so copy it fresh.
#        read -rs HEROKU_DB    # paste; keeps it out of shell history
#        /opt/homebrew/opt/libpq/bin/pg_dump -Fc -d "$HEROKU_DB" -f .local/cutover/final.dump
#
#   Either is a read. Neither needs maintenance mode unless it is the cutover's
#   final dump (plan S13–S14).
set -Eeuo pipefail

BIN=/opt/homebrew/opt/libpq/bin # ≥ 17: the PATH psql is older and cannot read the dump
PSQL="$BIN/psql" PGR="$BIN/pg_restore"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRISMA="$REPO/node_modules/.bin/prisma"

say() { printf '%s\n' "$*" >&2; }
red() { say "RED: $*"; exit 1; }
CURRENT="argument checks"
trap 'say "RED: failed during: $CURRENT"' ERR

YES=0
ARGS=()
for a in "$@"; do
  if [ "$a" = "--yes" ]; then YES=1; else ARGS+=("$a"); fi
done
[ "${#ARGS[@]}" -eq 2 ] || { say "usage: $0 <dump-file> <target-database-url> [--yes]"; exit 2; }
DUMP="${ARGS[0]}" URL="${ARGS[1]}"

# ── Where is the target? Parsed from the URL so it can be shown without the
# password. Userinfo is stripped at the last `@`, before anything else.
case "$URL" in postgres://* | postgresql://*) ;; *) red "the target must be a postgres:// URL" ;; esac
rest="${URL#*://}"
rest="${rest%%\?*}"
rest="${rest##*@}"
hostport="${rest%%/*}"
DBNAME="${rest#"$hostport"}"
DBNAME="${DBNAME#/}"
if [ "${hostport#\[}" != "$hostport" ]; then # [::1]:5432
  HOST="${hostport%%]*}]"
  PORT="${hostport#"$HOST"}"
else
  HOST="${hostport%%:*}"
  PORT="${hostport#"$HOST"}"
fi
PORT="${PORT#:}"
PORT="${PORT:-5432}"

case "$HOST" in
  "" | localhost | 127.* | "[::1]") LOCAL=1 ;;
  *) LOCAL=0 ;;
esac
[ "$LOCAL" = 1 ] && [ "$PORT" = 5432 ] && red "localhost:5432 is the owner's database (AGENTS.md). Refusing."
case "$HOST" in *-pooler.*) red "$HOST is Neon's pooler; use the unpooled URL" ;; esac

# ── Is the dump a dump?
[ -f "$DUMP" ] || red "no such dump: $DUMP"
LISTING="$("$PGR" --list "$DUMP" 2>&1 || true)"
grep -q '^; Archive created at' <<<"$LISTING" || red "pg_restore --list cannot read $DUMP: $LISTING"
CREATED="$(sed -n 's/^; Archive created at //p' <<<"$LISTING")"
SOURCE="$(sed -n 's/^;[[:space:]]*dbname: //p' <<<"$LISTING")"

say ""
say "  target    host $HOST  port $PORT  database ${DBNAME:-(default)}"
say "  dump      $DUMP"
say "            $(du -h "$DUMP" | cut -f1), created $CREATED, from database $SOURCE"
say ""
say "  Everything in the target's public schema is about to be deleted."
say ""
if [ "$YES" = 1 ]; then
  [ "$LOCAL" = 1 ] || red "--yes is only for localhost targets. Type the host instead."
else
  read -r -p "  Type the target host to continue: " ANSWER </dev/tty || red "no answer"
  [ "$ANSWER" = "$HOST" ] || red "that is not $HOST. Nothing was changed."
fi

cd "$REPO"
START=$SECONDS
EXPECTED="$(mktemp)"
trap 'rm -f "$EXPECTED"' EXIT
# Reads every data block, so a truncated dump is refused here, before the wipe.
CURRENT="counting the dump's rows (nothing changed yet)"
bash scripts/dump-row-counts.sh "$DUMP" >"$EXPECTED"
[ -s "$EXPECTED" ] || red "dump-row-counts.sh found no tables in the dump"

q() { "$PSQL" "$URL" -X -q -At -v ON_ERROR_STOP=1 "$@"; }
step() {
  CURRENT="$1"
  say "== $1"
}
# The underscore-stripping fix (plan, "departs from PLAN.md" 3): lower("DraftPicks")
# is draftpicks, not draft_picks. SequelizeMeta is dropped by normalize.sql;
# _prisma_migrations is not in the dump.
norm() { grep -v -e '^sequelizemeta' -e '^_prisma_migrations' | awk -F'\t' -v OFS='\t' '{gsub(/_/, "", $1); print}' | sort; }
folded_counts() {
  DIFF="$(diff <(norm <"$EXPECTED") <(bash scripts/row-counts.sh "$URL" | norm))" || red "$1: folded row counts differ from the dump's:
$DIFF"
}

step "1/6 wipe public"
# lock_timeout: the running app may hold locks; fail rather than hang.
q -c "SET lock_timeout = '60s'" -c 'DROP SCHEMA public CASCADE' -c 'CREATE SCHEMA public'

step "2/6 pg_restore"
"$PGR" --no-owner --no-privileges --exit-on-error -d "$URL" "$DUMP"
CURRENT="check C3 (row counts after restore)"
DIFF="$(diff "$EXPECTED" <(bash scripts/row-counts.sh "$URL"))" || red "C3: row counts differ from the dump's:
$DIFF"

step "3/6 normalize.sql"
q -f prisma/normalize.sql
CURRENT="check C4 (normalized)"
folded_counts C4
UPPER="$(q -c "select (select count(*) from information_schema.columns where table_schema = 'public'
  and (table_name <> lower(table_name) or column_name <> lower(column_name)))
  + (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public' and t.typtype = 'e' and t.typname <> lower(t.typname))")"
[ "$UPPER" = 0 ] || red "C4: $UPPER uppercase identifiers left; normalize.sql did not run"

step "4/6 prisma migrate"
DIRECT_URL="$URL" "$PRISMA" migrate resolve --applied 0_init
DIRECT_URL="$URL" "$PRISMA" migrate deploy
CURRENT="check C5 (T3b schema)"
BAD="$(q <<'SQL'
select name from (values
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
  ('pg_trgm installed', exists (select 1 from pg_extension where extname = 'pg_trgm'))
) as t(name, ok) where not ok;
SQL
)"
[ -z "$BAD" ] || red "C5: schema checks failed:
$BAD"

step "5/6 award logos"
q -1 -f prisma/award-logos.sql
CURRENT="check C6 (logos)"
LOGOS="$(q -c "select count(*) filter (where image like 'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/award-shows/%') || '|' || count(*) from events")"
[ "$LOGOS" = "12|12" ] || red "C6: $LOGOS events on Blob, expected 12|12"

step "6/6 invariants"
CURRENT="check C7 (invariants)"
folded_counts "C7 (row counts, again, after migrating)"
read -r CLAIMED COLLISIONS ACTIVE MIXED < <(q -F ' ' -c "select
  (select count(*) from users where clerk_id is not null),
  (select count(*) from (select 1 from users group by lower(email) having count(*) > 1) d),
  (select count(*) from available_years where is_active),
  (select count(*) from users where email <> lower(email))")
[ "$ACTIVE" = 1 ] || red "C7: $ACTIVE active years, expected exactly 1"
[ "$COLLISIONS" = 0 ] || red "C7: $COLLISIONS emails collide once case-folded; claim() will refuse them"
[ "$CLAIMED" = 0 ] || red "C7: $CLAIMED users claimed already: someone signed in to the target during the restore. Close every tab on it and run again"

CURRENT="done"
say ""
say "GREEN: restored $(wc -l <"$EXPECTED" | tr -d ' ') tables into $HOST/${DBNAME:-(default)} in $((SECONDS - START))s."
say "       active year $(q -c 'select year from available_years where is_active'), mixed-case emails $MIXED (compare with Heroku's, plan S22)."
