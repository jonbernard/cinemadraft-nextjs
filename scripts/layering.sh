#!/usr/bin/env bash
# The six layering checks, exactly as CI runs them.
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

# 🔴 Pacing is a knob, and a knob has exactly one place it is turned.
# `e2e/journeys/support/pace.ts` owns the only `waitForTimeout` in the suite: a
# journey that grows a sleep of its own is a journey CI pays for forever, and a
# slice spec with one is the plain defect it has always been. This is the check
# that keeps P19's deliberate exception from becoming a habit.
check "only the journey pacing helper waits on a clock" \
  "$(grep -rn 'waitForTimeout' e2e 2>/dev/null \
     | grep -v '^e2e/journeys/support/pace\.ts:' || true)"

# P17.T18. The type scale lives in globals.css and nowhere else.
#
# An arbitrary `text-[13px]` compiles, looks fine, and quietly forks the scale
# — which is how 117 elements came to render at 10.4px from a single
# `text-[0.65rem]`, below the 11px Eyebrow floor and outside the scale
# entirely. The exceptions are files that OWN a documented value, and they are
# named here rather than tolerated silently:
#
#   Eyebrow      11px, D74 — the floor itself.
#   SectionHead  the 28/20/17 heading ramp, P17.T1.
#   Wordmark     the lockup, D83 — a mark, not text on the scale.
#   TabBar       11px labels. 🔴 P17.T2 measured this: at 390px the five slots
#                have 78px each and "Award shows" renders 64.8px wide, so the
#                row has no slack. 13px wraps the label and grows the bar
#                48.5px -> 65px. The number is the design, and a check that
#                demands a wrong edit gets deleted.
#   EmptyState   17px, which is SectionHead's h3 value copied into another
#                file. 🔴 The real fix is to compose `SectionHead as="h3"`,
#                which is a structural change this sweep may not make; it is
#                exempted with the debt named rather than downgraded to 16px,
#                the serif-names step (D70), which would be wrong on two axes.
#
# `.test.` and `.stories.` files are exempt because their arbitrary sizes are
# assertions about the files above, not new call sites.
#
# No {n,m} interval: see the `set +B` note at the top of this file.
check "text sizes come from the scale" \
  "$(grep -rnE "text-\[[0-9.]+(px|rem|em)\]" components app .storybook \
     --include='*.tsx' --include='*.ts' --include='*.mdx' 2>/dev/null \
     | grep -v -e '^components/Eyebrow\.tsx:' -e '^components/SectionHead\.tsx:' \
               -e '^components/Wordmark\.tsx:' -e '^components/TabBar\.tsx:' \
               -e '^components/EmptyState\.tsx:' \
               -e '\.test\.tsx\?:' -e '\.stories\.tsx\?:' \
     || true)"

# P17.T24. Space sits on the 4px grid.
#
# Tailwind's integer steps are 0.25rem apart, so every integer is already on
# the grid — the only ways off it are a `.5` step (gap-1.5 = 6px, px-2.5 = 10px,
# gap-0.5 = 2px) and an arbitrary value. Both are grepped here.
#
# 🔴 Deliberately scoped to gap/padding/margin. `w-*` and `h-*` are excluded
# because a 2px score bar and a 6px meter track are drawn objects whose size IS
# the design (PosterFrame, SeenMeter); rounding a hairline to the grid doubles
# it. A check that demands a wrong edit gets deleted, so it does not ask.
#
# 🔴 The leading character class includes `:` as well as a quote and a space,
# so a variant-prefixed `sm:gap-1.5` is caught. None exists today; the plan's
# anchor would have let the first one through.
#
# No {n,m} interval: see the `set +B` note at the top of this file.
check "spacing sits on the 4px grid" \
  "$(grep -rnE "(^|[\"' :])-?(gap|gap-x|gap-y|space-x|space-y|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml)-([0-9]+\.5|\[[0-9.]+(px|rem|em)\])" \
     components app .storybook --include='*.tsx' --include='*.mdx' 2>/dev/null \
     || true)"

# P17.T25. Radius comes from D73's scale, anchored at 6px.
#
# 🔴 Measured pre-sweep on this tree: `sm` (6px) ×116 against `md` (10px) ×94.
# The plan's "md outnumbers sm 58 to 36" does NOT reproduce — the ratio has
# flipped since, but the drift is the same one: Panel, the primitive every page
# composes from, hardcoded `md`, so the documented anchor was not the real one.
# `lg` (16px) has exactly one legitimate consumer, the full-width search
# overlay, and is named here rather than left as an undiscussed dead token.
#
# `rounded-full` and `rounded-pill` are not radius: the first makes circles
# (avatars, dots, toggles), the second is D73's chip treatment. Neither is
# grepped. Neither is `poster-radius`, the proportional clamp.
#
# No {n,m} interval: see the `set +B` note at the top of this file.
check "radius comes from the scale" \
  "$(grep -rnE "rounded-(md|lg)\b|rounded-\[[0-9.]+(px|rem|%)\]" \
     components app .storybook --include='*.tsx' --include='*.mdx' 2>/dev/null \
     | grep -v -e '^components/SearchOverlay\.tsx:' -e '\.test\.tsx\?:' || true)"

exit $fail
