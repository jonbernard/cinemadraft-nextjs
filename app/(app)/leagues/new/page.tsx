import { CreateLeagueForm } from '@/components/leagues/CreateLeagueForm';
import { SectionHead } from '@/components/ui/SectionHead';
import { requirePageUser } from '@/lib/auth';

/**
 * Start a league (P10.T11).
 *
 * A session is required, because creating a league writes the caller's id into
 * the owner column — so there has to be one.
 *
 * 🔴 **`requirePageUser`, not `requireUser`.** They differ in exactly the way
 * that matters here: `requireUser` THROWS `ForbiddenError`, which a page turns
 * into a 500, and `requirePageUser` redirects to the sign-in form. This page
 * used the throwing one, so a signed-out visitor who tapped "Start a league"
 * got an error page instead of the way in — confirmed as a **500 on the
 * deployed site**, not just locally.
 *
 * It is on `PUBLIC_ROUTES` deliberately (the proxy lets it through and the page
 * gates itself), and that entry's own comment already says the gate is
 * `requireUser()` — the comment described the mechanism correctly and the
 * mechanism was the wrong one. Throwing is right for an ACTION, where the
 * caller is code; redirecting is right for a PAGE, where the caller is a person
 * who needs somewhere to go.
 *
 * Found by P12.T2's capability sweep, which is what that sweep is for.
 */
export default async function NewLeaguePage() {
  await requirePageUser();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-10">
      <SectionHead as="h1">Start a league</SectionHead>

      <p className="text-text-secondary text-sm leading-relaxed">
        You will run this one: entering everyone's picks on draft night, and setting the
        order and groups before it. Once it exists you get a link to send the others.
      </p>

      <CreateLeagueForm />
    </div>
  );
}
