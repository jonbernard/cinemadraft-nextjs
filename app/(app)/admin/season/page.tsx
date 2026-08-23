import { SeasonControl } from '@/components/SeasonControl';
import { SectionHead } from '@/components/SectionHead';
import { requireAdmin } from '@/lib/auth';
import { availableYearRepository } from '@/lib/repositories/available-years';

/**
 * The active-season control (T48, D22).
 *
 * `requireAdmin()` gates the page independently of `setActiveYear` gating the
 * action itself — a Server Action's id ships in the client bundle, so it is
 * reachable without ever loading this page, and page-level gating alone would
 * not be gating at all.
 *
 * Desktop-first, the stated exception (D49): this is pressed once a year.
 */
export default async function AdminSeasonPage() {
  await requireAdmin();

  const seasons = await availableYearRepository.findAll();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <SectionHead as="h1">Active season</SectionHead>

      <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
        Nearly every page in the app scopes to this year — leagues, drafts, award shows,
        the whole dashboard. Changing it re-scopes them immediately, without a redeploy.
      </p>

      <SeasonControl
        seasons={seasons
          // A null year cannot be activated by number; the season picker
          // elsewhere in the app drops the same rows for the same reason.
          .filter((season) => season.year != null)
          .map((season) => ({
            year: season.year as number,
            isActive: season.isActive === true,
          }))}
      />
    </div>
  );
}
