import Link from 'next/link';

import { LetterboxRule } from '@/components/LetterboxRule';
import { PointsLedger } from '@/components/PointsLedger';
import type { FilmScoring } from '@/lib/services/film';

/**
 * How a film has scored in the league.
 *
 * 🔴 **Rendered only when the film has actually been nominated.** A panel
 * reading "Total points: 0" on a film that was never in a season states
 * something false — most films on TMDB have never been near this league, and the
 * page is public, so that panel would be the *common* case. The caller passes
 * null and this returns nothing; the genuine empty state belongs to a film that
 * was nominated and scored nothing, which `PointsLedger` already handles.
 *
 * 🔴 **Average draft position is omitted rather than shown as 0.** The source's
 * `average([])` returned 0 and the page printed it, so a film nobody had drafted
 * claimed to have gone first overall in every league — the exact opposite of the
 * truth. `lib/services/film.ts` returns null; this omits the row.
 *
 * The per-show rows link to that show's page, as the source's did. The season is
 * carried in the query string because an award show page defaults to the active
 * season, and a film's points belong to *its* season — following the link
 * without it would land on a different year's nominations and quietly disagree
 * with the number just clicked.
 */
export function FilmPointsPanel({
  scoring,
  title,
}: {
  scoring: FilmScoring;
  /** The film, for the ledger's accessible name. */
  title: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <LetterboxRule as="h2">League points</LetterboxRule>

      <div className="flex flex-wrap gap-6">
        <Stat label={`Total, ${scoring.year} season`} value={String(scoring.total)} />
        {scoring.averageDraftPosition == null ? null : (
          <Stat
            label="Average draft position"
            // One decimal: the average of five picks at round 1 is exactly 1,
            // and printing "1.0" there implies a precision the number does not
            // have. `Intl` drops the decimal when it is zero.
            value={new Intl.NumberFormat('en-US', {
              maximumFractionDigits: 1,
            }).format(scoring.averageDraftPosition)}
          />
        )}
      </div>

      <ul className="flex flex-col">
        {scoring.byEvent.map((event) => (
          <li
            key={event.abbreviation}
            className="border-border-rule border-b last:border-b-0"
          >
            <Link
              href={`/award-shows/${event.abbreviation}?year=${scoring.year}`}
              className="focus-visible:outline-accent-fill hover:bg-bg-raised flex min-h-11 items-center justify-between gap-4 px-2 text-sm focus-visible:outline-2"
            >
              <span className="text-accent-text">{event.name}</span>
              <span className="text-text-primary tabular font-mono">{event.total}</span>
            </Link>
          </li>
        ))}
      </ul>

      {/* The award-by-award detail, one level deeper. Reuses the ledger the
          league board uses (D41) rather than a second breakdown — the two would
          otherwise be able to disagree about the same film. */}
      <PointsLedger
        total={scoring.ledger.total}
        lines={scoring.ledger.lines}
        label={title}
      />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-text-secondary text-xs uppercase tracking-wide">{label}</span>
      <span className="font-display text-text-primary tabular text-3xl font-bold [font-variation-settings:'wdth'_118]">
        {value}
      </span>
    </div>
  );
}
