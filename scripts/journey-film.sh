#!/usr/bin/env bash
# The journeys, run in order, as one watchable recording (P19.T7).
#
# `npm run e2e:journeys` already runs them paced on one worker, which is what
# makes them watchable at all — but it leaves one webm per journey in a
# hash-named directory, and "the whole set as one film" then means the owner
# opening six files in the right order and guessing which is which. This runs
# the same command and stitches the takes.
#
# 🔴 The order is the FILE order, and the file names carry it: Playwright sorts
# test files by path and a single worker executes them in that order, so
# `01-…`, `02-…`, … run in sequence and their output directories sort the same
# way. A journey that skips (journey 4, without TMDB_API_KEY) records nothing
# and simply is not in the film — which is the honest result, not a gap to
# paper over.
#
# 🔴 Everything lands under `.local/`, which is gitignored. A recording is an
# artefact of a run, not a file in the repository.
set -euo pipefail

cd "$(dirname "$0")/.."

out="${JOURNEY_FILM_OUT:-.local/journey-film}"
takes="$out/takes"

rm -rf "$out"
mkdir -p "$takes"

# The same knob `e2e:journeys` turns, so a caller can slow the film down
# further (DEMO_PACE=2) without editing anything. `playwright.config.mts`
# switches video recording on for any non-zero pace.
DEMO_PACE="${DEMO_PACE:-1}" npx playwright test e2e/journeys --workers=1 --output="$takes"

list="$out/takes.txt"
: >"$list"
# 🔴 Absolute paths, and `-safe 0`: ffmpeg's concat demuxer resolves relative
# entries against the LIST's directory, not the working directory, and refuses
# unsafe-looking paths outright.
while IFS= read -r video; do
  printf "file '%s'\n" "$(cd "$(dirname "$video")" && pwd)/$(basename "$video")" >>"$list"
done < <(find "$takes" -name '*.webm' | sort)

if [ ! -s "$list" ]; then
  echo "no recordings — every journey skipped, or DEMO_PACE was 0" >&2
  exit 1
fi

film="$out/journeys.webm"
# Stream copy: every take is VP8 at the same size, because every journey runs
# in the same Playwright project and the video size is fixed when the context
# opens (a journey resizing its viewport mid-test does not change it). A
# re-encode here would cost minutes and buy nothing.
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$list" -c copy "$film"

echo
echo "$(wc -l <"$list" | tr -d ' ') journeys, in order:"
sed 's/^file .*takes\///;s/\/video.webm.$//' "$list"
echo
echo "film: $film ($(du -h "$film" | cut -f1), $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$film" | cut -d. -f1)s)"
