#!/usr/bin/env bash
# Capture golden API responses from the live Heroku app (spec §13).
# These are the contract-test baselines for every ported repository.
#
# Usage:  TOKEN='eyJ...' ./.local/capture-fixtures.sh
#
# The token is read from the environment and never written to disk.
# Output lands in .local/fixtures/ which is gitignored — the responses
# contain real user emails and must be scrubbed before any of it is committed.
#
# GET only. Nothing here mutates production.

set -uo pipefail

: "${TOKEN:?set TOKEN to the Bearer value (without the word 'Bearer')}"

BASE="${BASE:-https://cinemadraft.com/api}"
OUT="$(cd "$(dirname "$0")" && pwd)/fixtures"
mkdir -p "$OUT"

# Resolved from production on 2026-08-14 for user id 3 (jon@jonbernard.net, admin)
UUID="19f25e89-6d1a-4b65-ad83-efb3b1a2fd46"
DRAFT=124        # 2025 draft in league 1
LEAGUE=1
YEAR=2025
LIST_YEAR=2024   # the only year user 3 has Lists rows for
TMDB=313369      # La La Land
EVENT=oscars

fetch() {
  local name="$1" path="$2"
  local code
  code=$(curl -sS -o "$OUT/$name.json" -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Accept: application/json' \
    "$BASE$path")
  local size
  size=$(wc -c <"$OUT/$name.json" | tr -d ' ')
  printf '%-34s %-46s %s  %sB\n' "$name" "$path" "$code" "$size"
  echo "$path" >"$OUT/$name.path"
}

echo "Capturing to $OUT"
printf '%-34s %-46s %s\n' "FIXTURE" "PATH" "HTTP"

fetch health                 "/health"
fetch years                  "/years"
fetch dashboard              "/dashboard"

fetch events                 "/events"
fetch event-by-abbr          "/events/$EVENT"
fetch event-by-abbr-year     "/events/$EVENT/$YEAR"

fetch league-user            "/league/user"
fetch league-by-id-year      "/league/$LEAGUE/$YEAR"
fetch league-draft-year      "/league/$LEAGUE/draft/$YEAR"

fetch draft-by-id            "/draft/$DRAFT"
# NOTE: despite the path, :id here is a LEAGUE id — the handler calls
# Drafts.getUsersByLeagueId. Passing a draft id silently returns [].
fetch draft-users            "/draft/users/$LEAGUE"
fetch user-drafts            "/user/drafts"

fetch points-all             "/points"
fetch points-by-draft        "/points/draft/$DRAFT"
fetch points-by-year         "/points/year/$YEAR"
fetch points-by-movie        "/points/movie/$TMDB"
fetch points-league-total    "/points/league/total/$LEAGUE/$YEAR"
fetch points-league-event    "/points/league/event/$LEAGUE/$YEAR"

fetch winners                "/winners"
fetch notifications          "/notifications"
fetch lists-by-year          "/lists/$LIST_YEAR"

fetch watchlist-awards       "/watchlist/awards/$YEAR"
fetch watchlist-drafts       "/watchlist/drafts/$YEAR"
fetch watchlist-noms         "/watchlist/noms/$YEAR"
# NOTE: only createdAt and releaseDate are valid columnName values. The handler
# passes columnName straight into the Sequelize order array and special-cases
# only releaseDate onto the joined movie table, so title/sortTitle raise 42703.
fetch watchlist-paged        "/watchlist/1/releaseDate/asc"

fetch profile-feed           "/profile/feed/user/$UUID"

fetch movie-by-id            "/movie/$TMDB"
fetch movie-details          "/movie/$TMDB/details"
fetch movie-now-playing      "/movie/now-playing"
fetch movie-discovery        "/movie/discovery/asc/1"

fetch search                 "/search?q=dune"
fetch review-by-tmdb         "/reviews/tmdbId/$TMDB"

echo
echo "Done. $(ls -1 "$OUT"/*.json | wc -l | tr -d ' ') fixtures."
