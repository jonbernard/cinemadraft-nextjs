# Clerk instance settings

The settings that live in the Clerk dashboard rather than in this repository,
what each one is for, and what has to be redone when the Production instance is
created at **P13.T1**.

🔴 **Nothing here is applied by code.** Instance configuration is owner work in
the Clerk dashboard. This file is the record of what was set and why, so that
the Production instance can be brought up to match instead of rediscovered.

---

## The combined sign-in-or-up flow (P15.T4)

🔴 **Corrected 2026-09-13. This section was wrong, and the wrongness cost the
owner a trip through the Clerk dashboard looking for a toggle that does not
exist.** It said the combined flow was a dashboard setting under *Configure →
Sign-up and sign-in*. It is not a dashboard setting at all.

**Where it actually is: `app/providers.tsx`.** In Clerk 7 the combined flow is
the **default** for `<SignIn>` — it registers an unrecognised address in place.
Defining a sign-up URL is the documented way to opt *out*
(<https://clerk.com/changelog/2025-01-16-sign-in-or-up>), and
`<ClerkProvider signUpUrl={SIGN_UP_URL}>` did exactly that. So the flow was off,
in code, on every environment, from the day P15.T4 believed it had turned it on.

**What that looked like.** A returning member types their usual address on
`/auth/login` and gets **"Couldn't find your account."** — reported by the owner
with a screenshot on 2026-09-13. Every member of this league is in that
position: the accounts came from the Heroku app and `users.clerk_id` is null for
all 51 of them (D25 — there is no bulk import). The only way forward was to
notice Clerk's footer "Register" link.

**The fix** is the absence of one prop. `app/providers.tsx` passes `signInUrl`
and **not** `signUpUrl`; the reasoning is written at the call site and must not
be undone without reading it.

🔴 **`proxy.ts` keeps its `signUpUrl` and must.** `lib/auth-routes.ts` records
why these constants exist at all: unset, Clerk falls back to its hosted portal
on `*.accounts.dev`, a different origin, and every RSC prefetch of a protected
route died in CORS on a site whose auth looked fine locally. That was about the
**redirect target**, which `clerkMiddleware` still supplies. The client never
navigates to a sign-up URL now — the card registers in place — so the fallback
is unreachable from the component.

**`/auth/register` stays.** Clerk's own guidance is to delete the `<SignUp>`
page, but it is linked from `/`, `/how-it-works`, `/join/[uuid]` and the shell's
"Start a league", and asserted by eight tests. It is a fine direct door for
somebody who knows they are new. Only the *advertisement* of it to `<SignIn>`
was the problem.

**What none of this changes.** The relink is not Clerk's doing:
`syncClerkIdentity` in `lib/services/clerk-identity.ts` attaches a new Clerk
identity to the existing `users` row by **verified email**, so a member who
registers with the address they always used keeps their leagues, drafts and
points. That code was always correct and is untouched.

🔴 **Nothing in this repository can test it.** The e2e suite runs under
`E2E_TEST_AUTH` with no Clerk at all (D82/D84) and a unit test cannot reach a
hosted flow. This is the same class of gap as D115's `maxDuration`: it failed
against the live instance having passed everything else. The verification log
below is the only check there is — run it.

## Email verification: code, not link (D26)

🔴 **Found wrong on the Development instance, 2026-09-13.** Under *User &
authentication → Email → Verify at sign-up → Verification methods*, **Email
verification code was unchecked** and only **Email verification link** was
ticked (Clerk flags it with a warning). D26 is email code + Google, and both
auth pages tell a member in so many words that "we send a code" — so sign-up was
emailing a link the copy does not mention.

**Set:** Email verification code **on**, Email verification link **off**.

🔴 **Also found off: "Require email address".** Every relink in
`syncClerkIdentity` matches on a verified email address. A Clerk user with no
email has nothing to match against, and that member silently gets a fresh empty
account instead of their history. **Turn it on.**

## Email code is the only factor (D26)

Password is disabled; the strategies are the email verification code and
Google. Every session is therefore email-verified by construction, which is
what makes the email-matched relink above safe. Do not enable password on
either instance — a password would let someone claim an address they have never
proved they own.

## "Development mode" on the card is not a defect

The badge Clerk renders on its components is a `pk_test_` artefact. It
disappears when P13.T1 swaps in the `pk_live_` / `sk_live_` keys for the
Production instance. It has been reported as a visual defect once already;
it is expected until cutover.

## What must be recreated for Production (P13.T1)

The Production instance is a separate instance, not a promoted copy:

- ~~The combined sign-in-or-up flow~~ — **not a dashboard setting**; it lives
  in `app/providers.tsx` and travels with the code. Nothing to redo.
- **Email verification code on, verification link off, and "Require email
  address" on** (see above) — these ARE per-instance and must be set again.
- **Passwordless configuration (D26)** — email code + Google, no password.
- **The webhook endpoint and its signing secret.** Both are per-instance. The
  Development endpoint points at `next.cinemadraft.com`; Production points at
  the apex. The new signing secret goes into Vercel as a Sensitive value —
  the old one does not verify Production deliveries.
- **The API keys** — `pk_live_` / `sk_live_` replace `pk_test_` / `sk_test_`.

---

## Verification log

Run in a private window against `npm run dev` (real Clerk keys, so NOT the
e2e server). 🔴 Still `_pending owner_` as of 2026-09-13 — it has never been run,
which is why the flow being off went unnoticed for a whole phase.
Case 2 is the one that matters: it proves the relink, and a failure there is a
cutover blocker in `syncClerkIdentity`, not a copy defect.

| # | Case | Expected | Result |
|---|---|---|---|
| 1 | An address with no Clerk identity and no `users` row | The card continues to registration, not "Couldn't find your account" | _pending owner_ |
| 2 | A pre-migration member — a `users` row with a null `clerk_id` | Registration completes and the dashboard shows that member's leagues | _pending owner_ |
| 3 | An already-linked member | Ordinary log in | _pending owner_ |
