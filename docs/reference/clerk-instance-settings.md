# Clerk instance settings

The settings that live in the Clerk dashboard rather than in this repository,
what each one is for, and what has to be redone when the Production instance is
created at **P13.T1**.

🔴 **Nothing here is applied by code.** Instance configuration is owner work in
the Clerk dashboard. This file is the record of what was set and why, so that
the Production instance can be brought up to match instead of rediscovered.

---

## The combined sign-in-or-up flow (P15.T4)

**Where:** Clerk dashboard → **Configure** → **Sign-up and sign-in** → the
**Sign-in** section → turn on the combined **sign-in or sign-up** flow (Clerk
labels it "Sign-in or sign-up flow" / `<SignIn>` handles both).

**Why.** Every member of this league is unknown to Clerk until their first
login — the accounts came from the Heroku app, and `users.clerk_id` is null for
all of them. With the plain sign-in flow, a returning member types their usual
address on `/auth/login` and gets **"Couldn't find your account"**, with no way
forward except noticing Clerk's own Register link in the card footer. With the
combined flow, `<SignIn>` continues into registration for an address it does not
recognise, so the same form covers both cases.

**What it does not change.** The relink is not Clerk's doing and does not depend
on this setting: `syncClerkIdentity` in `lib/auth.ts` attaches a new Clerk
identity to the existing `users` row by **verified email**, so a member who
registers with the address they always used keeps their leagues, drafts and
points. That code is untouched by this task.

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

- **The combined sign-in-or-up flow** — off by default; turn it on again.
- **Passwordless configuration (D26)** — email code + Google, no password.
- **The webhook endpoint and its signing secret.** Both are per-instance. The
  Development endpoint points at `next.cinemadraft.com`; Production points at
  the apex. The new signing secret goes into Vercel as a Sensitive value —
  the old one does not verify Production deliveries.
- **The API keys** — `pk_live_` / `sk_live_` replace `pk_test_` / `sk_test_`.

---

## Verification log

Run in a private window against `npm run dev`, with the combined flow enabled.
Case 2 is the one that matters: it proves the relink, and a failure there is a
cutover blocker in `syncClerkIdentity`, not a copy defect.

| # | Case | Expected | Result |
|---|---|---|---|
| 1 | An address with no Clerk identity and no `users` row | The card continues to registration, not "Couldn't find your account" | _pending owner_ |
| 2 | A pre-migration member — a `users` row with a null `clerk_id` | Registration completes and the dashboard shows that member's leagues | _pending owner_ |
| 3 | An already-linked member | Ordinary log in | _pending owner_ |
