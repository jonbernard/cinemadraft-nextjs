import { PosterFrame } from '@/components/PosterFrame';
import { StatusChip } from '@/components/StatusChip';
import { cn } from '@/lib/utils/cn';

export type GridNominee = {
  nominationId: number;
  title: string;
  posterUrl: string | null;
  detailName: string | null;
  detailCharacter: string | null;
  isWinner: boolean;
};

/**
 * One category's nominees (§12).
 *
 * 🔴 **One signal per fact, and the fact here is the win.** Every poster in
 * this grid is a nomination, so `PosterFrame`'s nomination marker distinguishes
 * nothing on this page — and it is carmine, which is urgency, not awards (D69).
 * So the frames carry no status and the win is named once, in brass.
 *
 * The source app marked a winner **twice over**: it doubled the poster's size
 * *and* stamped a green check on it. Two signals for one fact is not emphasis,
 * it is ambiguity — a reader who sees only one of them cannot tell whether the
 * other means something different. Green compounds it, because in an interface
 * green reads as "valid", and a losing nominee is not invalid.
 *
 * Nominees keep a uniform size for the same reason: the grid is scanned to
 * learn which films are in play, and resizing one of them makes that harder to
 * do at a glance in exchange for information the chip already carries.
 */
export function NomineeGrid({
  nominees,
  className,
}: {
  nominees: readonly GridNominee[];
  className?: string;
}) {
  if (nominees.length === 0) {
    return (
      <p className={cn('text-text-dim text-sm', className)}>No nominees entered yet.</p>
    );
  }

  return (
    <ul
      className={cn(
        'grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-4',
        className,
      )}
    >
      {nominees.map((nominee) => (
        <li key={nominee.nominationId} className="flex flex-col gap-1">
          <PosterFrame title={nominee.title} posterUrl={nominee.posterUrl} />

          {nominee.isWinner ? (
            <StatusChip tone="brass" className="self-start">
              Winner
            </StatusChip>
          ) : null}

          {/* The person, where the category nominates one. Without this an
              acting category is four identical posters of the same film. */}
          {nominee.detailName ? (
            <span className="text-text-secondary text-xs leading-tight">
              {nominee.detailName}
              {nominee.detailCharacter ? (
                <span className="text-text-dim"> as {nominee.detailCharacter}</span>
              ) : null}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
