import { RelinkPanel } from '@/components/RelinkPanel';
import { SectionHead } from '@/components/SectionHead';
import { requireAdmin } from '@/lib/auth';

/**
 * Relink an account (T49, D25).
 *
 * `requireAdmin()` gates the page independently of `relinkUser` gating the
 * action — a Server Action's id ships in the client bundle regardless of
 * whether this page exists, so the page gate alone would not be gating.
 *
 * No data is fetched here: which account is in question is not known until an
 * admin searches for it, which is `RelinkPanel`'s job.
 */
export default async function AdminRelinkPage() {
  await requireAdmin();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <SectionHead as="h1">Relink an account</SectionHead>

      <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
        Moves one person&rsquo;s drafts, picks, reviews and watchlist to a different
        sign-in — the repair path for a mismatched email or a collision, and the only
        place in the app that can do it. Find the account first; nothing changes until you
        confirm.
      </p>

      <RelinkPanel />
    </div>
  );
}
