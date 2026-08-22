import { SignIn } from '@clerk/nextjs';

import { SectionHead } from '@/components/SectionHead';

/**
 * Logging in, for members who have already claimed their account.
 *
 * Anyone arriving here for the first time since the migration has no Clerk
 * identity yet and needs to register instead — Clerk's own footer link handles
 * that, so the note here only has to set the expectation that a code is coming
 * rather than a password prompt (D26).
 *
 * The route is `/auth/login` and the word is "log in" throughout (D61). Clerk's
 * component is still called `SignIn`; that is its API, not our vocabulary, and
 * its visible strings are overridden in `app/providers.tsx`.
 */
export default function LoginPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <SectionHead as="h1">Log in</SectionHead>

      <p className="text-text-secondary text-sm leading-relaxed">
        We email you a code — there is no password. First time back since the redesign?
        Register instead, with the same email, and your history follows you.
      </p>

      <SignIn />
    </div>
  );
}
