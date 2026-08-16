#!/usr/bin/env bash
# The five layering checks, exactly as CI runs them.
#
# 🔴 These exist as a script because running them "by hand, roughly" is how two
# CI failures got pushed: a grep typed slightly differently locally passes while
# the workflow's fails. One command, one source of truth.
#
# The workflow still owns the canonical copy; this mirrors it so a developer can
# get the same answer before pushing rather than from a red build.
set -uo pipefail
fail=0

check() {
  local name="$1" offenders="$2"
  if [ -n "$offenders" ]; then
    echo "✗ $name"
    echo "$offenders" | sed 's/^/    /'
    fail=1
  else
    echo "✓ $name"
  fi
}

check "UI layers never reference Prisma" \
  "$(grep -rlE "from ['\"][^'\"]*generated/prisma" app actions components 2>/dev/null || true)"

check "only lib/db.ts and repositories reference Prisma" \
  "$(grep -rlE "from ['\"][^'\"]*generated/prisma" lib 2>/dev/null \
     | grep -v -e '^lib/db\.ts$' -e '^lib/repositories/' || true)"

check "only lib/db.ts imports Prisma as a value" \
  "$(grep -rnE "from ['\"][^'\"]*generated/prisma" app lib actions components 2>/dev/null \
     | grep -v '^lib/db\.ts:' \
     | grep -vE ':[0-9]+:[[:space:]]*import type ' || true)"

check "only repositories import the db client" \
  "$(grep -rln "from '@/lib/db'" app actions components 2>/dev/null \
     | grep -v -E '\.test\.tsx?$' || true)"

check "no raw hex outside the token system" \
  "$(grep -rnE "#[0-9a-fA-F]{3,8}\b" components app \
     --include='*.tsx' --include='*.ts' 2>/dev/null \
     | grep -v '^app/global-error\.tsx:' || true)"

exit $fail
