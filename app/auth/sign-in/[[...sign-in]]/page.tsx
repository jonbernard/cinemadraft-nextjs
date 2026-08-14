import { SignIn } from '@clerk/nextjs';

import { LetterboxRule } from '@/components/LetterboxRule';

/**
 * Sign-in exists for members who have already claimed their account.
 *
 * Anyone arriving here for the first time since the migration has no Clerk
 * identity yet and needs sign-up instead — Clerk's own footer link handles
 * that, so the note here only has to set the expectation that a code is
 * coming rather than a password prompt (D26).
 */
export default function SignInPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <LetterboxRule as="h1">Sign in</LetterboxRule>

      <p className="text-text-secondary text-sm leading-relaxed">
        We email you a code — there is no password. First time back since the redesign?
        Sign up instead, with the same email, and your history follows you.
      </p>

      <SignIn />
    </div>
  );
}
