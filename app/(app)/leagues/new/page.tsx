import { CreateLeagueForm } from '@/components/CreateLeagueForm';
import { SectionHead } from '@/components/SectionHead';
import { requireUser } from '@/lib/auth';

/**
 * Start a league (P10.T11).
 *
 * `requireUser` rather than reading the session loosely: creating a league
 * writes the caller's id into the owner column, so there has to be one.
 */
export default async function NewLeaguePage() {
  await requireUser();

  return (
    <main className="text-text-primary p-4 md:p-8">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <SectionHead as="h1">Start a league</SectionHead>

        <p className="text-text-secondary text-sm leading-relaxed">
          You will run this one: entering everyone's picks on draft night, and setting the
          order and groups before it. Once it exists you get a link to send the others.
        </p>

        <CreateLeagueForm />
      </div>
    </main>
  );
}
