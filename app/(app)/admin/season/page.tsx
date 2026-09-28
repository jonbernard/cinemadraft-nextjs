import { SeasonControl } from '@/components/admin/SeasonControl';
import { SectionHead } from '@/components/ui/SectionHead';
import { requirePageAdmin } from '@/lib/auth';
import { availableYearRepository } from '@/lib/repositories/available-years';
import { userRepository } from '@/lib/repositories/users';

/**
 * The season control: start the next season, or switch back one (T48, D22, D138).
 *
 * `requirePageAdmin()` gates the page independently of `setActiveYear` gating the
 * action itself — a Server Action's id ships in the client bundle, so it is
 * reachable without ever loading this page, and page-level gating alone would
 * not be gating at all.
 *
 * 🔴 The member count is read here, server-side, so the confirmation on
 * `SeasonControl` names a real number rather than a guess — the same pattern,
 * and for the same reason, as `/admin/broadcast` (P17.T28).
 *
 * Desktop-first, the stated exception (D49): this is pressed once a year.
 */
export default async function AdminSeasonPage() {
  await requirePageAdmin();

  const [seasons, memberIds] = await Promise.all([
    availableYearRepository.findAll(),
    userRepository.findAllIds(),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10">
      <SectionHead as="h1">Active season</SectionHead>

      <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
        Every league, draft, award show and dashboard follows the active season. A change
        here takes effect straight away, for everyone, with no redeploy.
      </p>

      <SeasonControl
        memberCount={memberIds.length}
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
