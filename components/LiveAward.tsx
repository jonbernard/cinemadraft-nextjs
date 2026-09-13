import { PosterFrame } from '@/components/PosterFrame';
import { SectionHead } from '@/components/SectionHead';

/**
 * Structurally what `lib/services/live.ts` produces, declared here rather than
 * imported: that module reaches repositories and the db client, and
 * `components/` may not depend on it (D33). Same pattern as `LiveBoard`.
 */
export type LiveAwardNominee = {
  nominationId: number;
  title: string;
  posterUrl: string | null;
  detailName: string | null;
  isWinner: boolean;
};

/**
 * One award as its nominees' posters (P14.T1).
 *
 * 🔴 **The poster is the content; the words are not readable from the sofa.**
 * Measured against the 10-foot rule rather than assumed: at 1920 on a 55"
 * panel (1218mm wide) three metres away, one CSS pixel subtends 0.73 arcmin. A
 * 224px frame (`2xl`, the television) is therefore 2.7° × 4.1° of arc, which is
 * comfortably above the ~1° at which a film poster is recognised at a glance —
 * while the 15px title under it is 11 arcmin, roughly half the ~20 arcmin that
 * makes text *comfortable* at that distance. So identification is carried by
 * the artwork and the title is the confirmation you lean in for. Below 1536px
 * the frame is 160px, which is the laptop case and is read from a desk.
 *
 * 🔴 **A category with no artwork must not collapse.** Two different empty
 * states, and neither is a blank row: a category whose nominations have not
 * been entered says so in words, and a nominee whose film has no poster still
 * gets a frame — `PosterFrame` draws its initials — so a person category with
 * no stills is a row of named frames rather than nothing at all.
 *
 * Only the winner carries a `status`. Every poster here is a nomination, so
 * `PosterFrame`'s nomination hairline would distinguish nothing (the same
 * reasoning `NomineeGrid` records), and the seal is the one mark that says
 * which of them took it.
 */
export function LiveAward({
  name,
  points,
  nominees,
}: {
  name: string;
  points: number;
  nominees: readonly LiveAwardNominee[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <SectionHead as="h3" right={`${points} pts`} className="pb-0">
        {name}
      </SectionHead>

      {nominees.length === 0 ? (
        <p className="text-text-secondary text-sm">No nominees entered yet.</p>
      ) : (
        <ul className="snap-x scroll-px-1 flex gap-3 overflow-x-auto pb-2 [&>li]:snap-start [&>li]:shrink-0">
          {nominees.map((nominee) => (
            <li key={nominee.nominationId} className="flex w-40 flex-col gap-1 2xl:w-56">
              <PosterFrame
                title={nominee.title}
                posterUrl={nominee.posterUrl}
                status={nominee.isWinner ? 'won' : 'none'}
              />
              {nominee.detailName ? (
                <span className="text-text-secondary text-xs leading-tight">
                  {nominee.detailName}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
