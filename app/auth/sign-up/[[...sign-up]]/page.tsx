import { SignUp } from '@clerk/nextjs';

import { LetterboxRule } from '@/components/LetterboxRule';

/**
 * 🔴 The most important copy in the migration.
 *
 * Every one of the 51 existing members is *signing up*, not signing in —
 * there is no bulk import (D25), so their account does not exist in Clerk
 * until they create it. A returning member who reads "Sign up" reasonably
 * concludes the site has lost ten years of their leagues and drafts, and the
 * ones who conclude that do not persist far enough to discover otherwise.
 *
 * So the page says it plainly, above the form, before they have to decide
 * anything. This is also why sign-up is the default destination rather than
 * sign-in.
 */
export default function SignUpPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <LetterboxRule as="h1">Sign up</LetterboxRule>

      <p className="text-text-secondary text-sm leading-relaxed">
        <span className="text-text-primary font-medium">Played before?</span> Sign up with
        the same email you already use and your leagues, drafts and points come with you.
        There is no password to remember — we send a code.
      </p>

      <SignUp />
    </div>
  );
}
