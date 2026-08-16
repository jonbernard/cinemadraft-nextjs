import { SignUp } from '@clerk/nextjs';

import { LetterboxRule } from '@/components/LetterboxRule';

/**
 * 🔴 The most important copy in the migration.
 *
 * Every one of the 51 existing members is *registering*, not logging in —
 * there is no bulk import (D25), so their account does not exist in Clerk
 * until they create it. A returning member who reads this page and concludes
 * the site has lost ten years of their leagues does not persist far enough to
 * discover otherwise.
 *
 * So the page says it plainly, above the form, before they have to decide
 * anything. This is also why registering is the default destination rather
 * than logging in.
 *
 * "Register" rather than "sign up" keeps one vocabulary with "log in" and
 * "log out" (D61) — mixing *sign* and *log* across three adjacent actions is
 * exactly the inconsistency that makes an interface feel assembled from parts.
 */
export default function RegisterPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <LetterboxRule as="h1">Register</LetterboxRule>

      <p className="text-text-secondary text-sm leading-relaxed">
        <span className="text-text-primary font-medium">Played before?</span> Register
        with the same email you already use and your leagues, drafts and points come with
        you. There is no password to remember — we send a code.
      </p>

      <SignUp />
    </div>
  );
}
