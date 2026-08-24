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
# macOS ships bash 3.2 (GPLv2-frozen). Its parser brace-expands a quoted
# command substitution when it's passed as a *function argument* — exactly
# how `check` is called below — splitting the {3,8} interval into two greps
# that each match nothing, so the hex check silently always passes. (A plain
# variable assignment, which is how the CI workflow's own copy runs the same
# grep, is not affected — that's why CI was never at risk.) `+B` disables
# brace expansion outright; nothing here relies on it.
set +B
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
  "$(grep -rnE "#[0-9a-fA-F]{3,8}\b" components app .storybook \
     --include='*.tsx' --include='*.ts' --include='*.mdx' 2>/dev/null \
     | grep -v '^app/global-error\.tsx:' || true)"

# RemoteImage's whole reason to exist is that the optimization decision for a
# remote host lives in one place (lib/images.ts). A call site that reaches for
# `next/image` directly bypasses that decision silently — it compiles, passes
# every other check, and opts its page into billed transformations (or an
# unoptimized fetch that should have been billed) with nobody noticing until a
# Vercel invoice or a broken image does the noticing instead.
check "no next/image import outside RemoteImage" \
  "$(grep -rlE "from ['\"]next/image['\"]" app lib actions components 2>/dev/null \
     | grep -v -e '^components/RemoteImage\.tsx$' -e '\.test\.tsx?$' || true)"

exit $fail
