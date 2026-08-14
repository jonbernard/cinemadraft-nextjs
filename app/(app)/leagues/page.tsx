import { LetterboxRule } from '@/components/LetterboxRule';
import { requireUser } from '@/lib/auth';

/**
 * A placeholder until Phase 5 builds the real thing.
 *
 * It calls `requireUser` rather than rendering static text, because that is
 * what exercises the lazy claim path (`lib/auth.ts`) on a real page. Locally
 * and in Preview the Clerk webhook posts to the deployed host, so a developer
 * signing in here never receives one — without a page that resolves the
 * session, the account is never provisioned and nothing says so.
 */
export default async function LeaguesPage() {
  const user = await requireUser();

  return (
    <main className="bg-bg-base text-text-primary min-h-dvh p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <LetterboxRule as="h1">Leagues</LetterboxRule>
        <p className="text-text-secondary text-sm">
          Signed in as <span className="text-text-primary">{user.email}</span>
        </p>
      </div>
    </main>
  );
}
