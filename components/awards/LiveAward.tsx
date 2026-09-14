import { PosterFrame } from '@/components/ui/PosterFrame';
import { SectionHead } from '@/components/ui/SectionHead';
import { StatusChip } from '@/components/ui/StatusChip';
import { WinnerSeal } from '@/components/ui/WinnerSeal';
import { cn } from '@/lib/utils/cn';

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
 * reasoning `NomineeGrid` records).
 *
 * 🔴 **The seal alone is not the winner treatment on this screen.** It is a
 * 24px corner triangle, which is the right weight on a roster read from a desk
 * and invisible on a television across a room — the owner's call, and the
 * arithmetic agrees: at 3m that triangle subtends under 0.3°, below what the
 * eye resolves as a shape at a glance. So a decided category states it four
 * ways, and only one of them is colour:
 *
 *   1. the winning poster is the only one at full opacity — the rest recede
 *      to 45%, which is the strongest signal at distance because it changes
 *      the whole row rather than one corner;
 *   2. it carries a brass rule under it with the word **Winner**, in words
 *      rather than a mark, so it survives a monochrome screen and a screen
 *      reader;
 *   3. the category's own heading changes from its point value to the name of
 *      the film that took it;
 *   4. the seal, which stays, because it is what the rest of the product uses.
 *
 * 🔴 **Dimming is not disabling.** The losing nominees stay legible at 45% —
 * they are still the nominees, and a reader arriving late needs to see who was
 * in the running. Anything lower reads as an error state.
 */
export function LiveAward({
  name,
  points,
  nominees,
  reveal = false,
  onScreen = false,
}: {
  name: string;
  points: number;
  nominees: readonly LiveAwardNominee[];
  /**
   * Play the reveal rather than showing the settled result.
   *
   * 🔴 Off by default, and that is the important half. A reload of a finished
   * ceremony would otherwise replay twenty-four reveals at once, which is the
   * failure mode of every animation tied to render rather than to an event.
   * The client sets it for the one category whose winner arrived while the
   * page was open (P14.T4); everything else renders already-won.
   */
  reveal?: boolean;
  /**
   * This is the category the admin has put up right now (P14.T13).
   *
   * 🔴 **Carmine, not brass.** Brass is an award outcome (D85/D99), and "being
   * announced right now" is not one — it is the same register as the `Live`
   * chip in the header, and borrowing brass would teach two meanings for one
   * colour on the one page where the colour is the message.
   *
   * 🔴 **And not only colour.** This screen is read from three metres (the
   * arithmetic above): a border tint subtends nothing at that distance. The
   * chip says it in words, which is also what survives a monochrome panel and
   * a screen reader.
   */
  onScreen?: boolean;
}) {
  const decided = nominees.some((nominee) => nominee.isWinner);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <SectionHead
        as="h3"
        // 🔴 The point value stays once a category is decided. An earlier
        // version swapped it for the winner's name, which read well and cost
        // the page its only statement of what the category is worth — and
        // `e2e/live.spec.ts` caught it, because that figure is the resolved
        // value rather than the `awards.points` foreign key (D41) and this is
        // one of two surfaces that could print the key and be believed. The
        // winner is named under its own poster instead.
        right={
          onScreen ? (
            <span className="flex items-center gap-2">
              <StatusChip tone="carmine">On screen now</StatusChip>
              {`${points} pts`}
            </span>
          ) : (
            `${points} pts`
          )
        }
        className="pb-0"
      >
        {name}
      </SectionHead>

      {nominees.length === 0 ? (
        <p className="text-text-secondary text-sm">No nominees entered yet.</p>
      ) : (
        <ul className="snap-x scroll-px-1 flex gap-3 overflow-x-auto pb-2 [&>li]:snap-start [&>li]:shrink-0">
          {nominees.map((nominee) => (
            <li
              key={nominee.nominationId}
              data-testid={nominee.isWinner ? 'live-winner' : undefined}
              className={cn(
                'flex w-40 flex-col gap-1 2xl:w-56',
                decided &&
                  !nominee.isWinner &&
                  (reveal
                    ? 'animate-reveal-recede motion-reduce:animate-none motion-reduce:opacity-45'
                    : 'opacity-45'),
              )}
            >
              <div
                className={cn(
                  'relative',
                  nominee.isWinner &&
                    reveal &&
                    'animate-reveal-frame motion-reduce:animate-none',
                )}
              >
                <PosterFrame
                  title={nominee.title}
                  posterUrl={nominee.posterUrl}
                  // 🔴 The frame's own corner seal is suppressed on this
                  // screen entirely, reveal or not: `WinnerSeal` is the mark
                  // here, and two seals in one corner is one too many. The
                  // roster elsewhere keeps the frame's.
                  status="none"
                />

                {/* The brass wash. Under the mark, over the poster, never
                    opaque — the point is which film won, not that something
                    happened. Only during a reveal: a settled result is not a
                    tinted poster. */}
                {nominee.isWinner && reveal ? (
                  <span
                    aria-hidden="true"
                    className="bg-brass-fill animate-reveal-wash motion-reduce:animate-none poster-radius pointer-events-none absolute inset-0 opacity-0"
                  />
                ) : null}

                {nominee.isWinner ? (
                  <WinnerSeal
                    className={cn(
                      'absolute h-8 w-8',
                      reveal
                        ? 'animate-reveal-mark motion-reduce:animate-none motion-reduce:left-auto motion-reduce:right-1.5 motion-reduce:top-1.5'
                        : 'right-1.5 top-1.5',
                    )}
                  />
                ) : null}
              </div>

              {nominee.isWinner ? (
                <span
                  className={cn(
                    'bg-brass-fill text-brass-contrast rounded-sm px-2 py-1 text-center text-xs font-semibold',
                    reveal && 'animate-reveal-word motion-reduce:animate-none',
                  )}
                >
                  Winner
                </span>
              ) : null}
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
