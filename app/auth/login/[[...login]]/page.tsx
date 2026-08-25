import { SignIn } from '@clerk/nextjs';

import { SectionHead } from '@/components/SectionHead';

/**
 * Logging in, for members who have already claimed their account.
 *
 * Anyone arriving here for the first time since the migration has no Clerk
 * identity yet. The instance runs Clerk's **combined sign-in-or-up flow**
 * (P15.T4, recorded in `docs/reference/clerk-instance-settings.md`), so an
 * address Clerk does not recognise continues into registration here rather
 * than erroring with "Couldn't find your account" — and `syncClerkIdentity`
 * then attaches the new identity to the existing row by verified email, so
 * their history follows them in. The note only has to say so, and set the
 * expectation that a code is coming rather than a password prompt (D26).
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
        We email you a code — there is no password. If this is your first time back since
        the redesign, entering your usual address is enough: your leagues, drafts and
        points are waiting on it and will follow you in.
      </p>

      <SignIn />
    </div>
  );
}
