'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/utils/cn';

/** One group as the ceremony shows it: the number, and who is in it. */
export type CeremonyGroup = { group: number; names: string[] };

/** The reel spins for this long before the first group lands. */
const REEL_MS = 1600;
/** How fast a name is swapped for the next one in the reel. */
const REEL_TICK_MS = 80;
/** Each group's turn on screen before the next one arrives. */
const REVEAL_MS = 500;
/** Rows inside a group arrive this far apart, so the group *deals* rather than appears. */
const ROW_STAGGER_MS = 40;

/**
 * The moment a league is dealt into groups (P15.T12).
 *
 * 🔴 **The server decided this before the animation started.** `randomiseGroups`
 * runs, writes, and hands back the assignments it wrote; this component
 * animates data it already holds. It rolls nothing, re-rolls nothing, and
 * persists nothing — so a viewer who reloads halfway through the reel finds the
 * page beneath already showing the same groups. Any version of this that
 * shuffles on the client and then saves is a different, wrong feature: two
 * people watching the same league would see two different draws.
 *
 * 🔴 **A native `<dialog>` opened with `showModal()` (D75)** — the third
 * consumer of the pattern `MoreSheet` established and `SearchOverlay` followed,
 * rather than a third implementation of it. The focus trap, the inert
 * background and the backdrop are the platform's job. `Escape` is the one place
 * this component overrides the platform, and only to make the first press mean
 * "stop the animation" rather than "throw away the reveal".
 *
 * 🔴 **One state machine, not nested timeouts.** `step` counts: 0 is the reel,
 * 1..n is group n landing, n+1 is settled. A single effect schedules exactly
 * one timer for the current step and clears it on the way out, so skipping is
 * just `setStep(settled)` — the pending timer dies with the effect. Chained
 * `setTimeout`s would each need their own handle and their own cancellation,
 * and the bug that shape always grows is a skipped animation that finishes
 * anyway a second later and stamps over what the reader is now looking at.
 *
 * The settled listing — an `<ol>` of groups, each an `<h3>` and a list of names
 * — is the real content, not a caption under an animation. The reel above it is
 * `aria-hidden` because it is noise: a rapidly-changing name is meaningless to
 * a screen reader and would fight the live region for the announcement.
 */
export function GroupCeremony({
  groups,
  onDone,
  reducedMotion,
}: {
  groups: readonly CeremonyGroup[];
  /** Dismisses the takeover. The page beneath is already correct by then. */
  onDone: () => void;
  /**
   * Overrides `prefers-reduced-motion`. Tests and stories set it; nothing in
   * the app does, because the reader's own setting is the answer there.
   */
  reducedMotion?: boolean;
}) {
  const still = reducedMotion ?? prefersReducedMotion();
  /** The step at which every group is on screen and the clock has stopped. */
  const settled = groups.length + 1;

  const [step, setStep] = useState(() => (still ? settled : 0));
  const [tick, setTick] = useState(0);

  // The headline is the dialog's accessible name, so it needs an id, and two
  // ceremonies on one page would collide on a literal one.
  const headlineId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const confetti = useRef<HTMLCanvasElement>(null);

  const isSettled = step >= settled;

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  // The clock. One timer for the current step, cleared when the step changes —
  // including when Skip changes it, which is what makes skipping final.
  useEffect(() => {
    if (step >= settled) return;
    const timer = setTimeout(
      () => setStep((current) => current + 1),
      step === 0 ? REEL_MS : REVEAL_MS,
    );
    return () => clearTimeout(timer);
  }, [step, settled]);

  // The reel's own tick, alive only while the reel is. Separate from the clock
  // above because it repeats and the clock advances; folding them together
  // would mean re-deriving "which step am I on" 20 times a second.
  useEffect(() => {
    if (step !== 0) return;
    const ticking = setInterval(() => setTick((current) => current + 1), REEL_TICK_MS);
    return () => clearInterval(ticking);
  }, [step]);

  useConfetti(confetti, isSettled && !still);

  const skip = useCallback(() => setStep(settled), [settled]);

  const done = useCallback(() => {
    dialog.current?.close();
    onDone();
  }, [onDone]);

  /**
   * 🔴 The first `Escape` stops the animation; the second closes.
   *
   * Escape during the reel means "I do not want to watch this", not "I do not
   * want to know" — closing there would hide the result the reader was waiting
   * for. Once settled, Escape is the ordinary dismiss a modal owes its reader,
   * and refusing it twice is how a dialog becomes a trap.
   */
  const onCancel = useCallback(
    (event: React.SyntheticEvent<HTMLDialogElement>) => {
      if (isSettled) {
        onDone();
        return;
      }
      event.preventDefault();
      setStep(settled);
    },
    [isSettled, onDone, settled],
  );

  // Every name, in one flat list, for the reel to cycle through.
  const everyone = groups.flatMap((entry) => entry.names);
  // Groups landed so far. At step 0 this is none — the reel is showing instead.
  const landed = groups.slice(0, Math.min(step, groups.length));
  /**
   * 🔴 As square as the count allows, because the real counts are 3, 4 and 5.
   *
   * The first build wrapped the groups in a flex row of `min-w-56 flex-1`
   * cards inside `max-w-4xl`. Three 224px cards fit that width, so **four
   * groups — the everyday shape, every season since 2018 — put three on one
   * row and stretched the fourth to the full 896px on its own**, one banner
   * under three cards, as if group 4 were the answer. Five gave 3 + 2 with the
   * bottom pair at half width each. The count only ever looked right at the
   * two groups it was built with.
   *
   * `ceil(sqrt(n))` is the column count that keeps the last row as full as the
   * rows above it: 4 → 2×2, 5 → 3+2, 3 → 2+1, 20 → four rows of five, 1 → one
   * card that is one card wide rather than a full-width slab. 2×2 also uses the
   * vertical space a single row of four leaves empty, which is most of the
   * screen.
   */
  const columns = Math.ceil(Math.sqrt(groups.length));

  return (
    <dialog
      ref={dialog}
      aria-labelledby={headlineId}
      onCancel={onCancel}
      className="bg-bg-base text-text-primary m-0 h-full max-h-none w-full max-w-none p-0 backdrop:bg-black/80"
    >
      <div className="relative flex min-h-full flex-col items-center justify-center gap-8 p-6">
        {isSettled && !still ? (
          // The wrapper carries `aria-hidden`, not the canvas: a <canvas> may
          // hold focusable fallback content, so hiding one directly is the bug
          // Biome's noAriaHiddenOnFocusable names, and giving it a
          // non-interactive role trips the mirror rule. Hiding the box around
          // it says the true thing — none of this is content.
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <canvas ref={confetti} className="h-full w-full" />
          </div>
        ) : null}

        {/*
          One element, one announcement. `aria-live` announces a *change*, not
          initial content, so this speaks exactly once — when "Dealing…" becomes
          "Groups are set". Announcing per group would read the whole league
          aloud n times over.
        */}
        <h2
          id={headlineId}
          aria-live="polite"
          className="font-display text-text-primary text-center text-4xl"
        >
          {isSettled ? 'Groups are set' : 'Dealing…'}
        </h2>

        {step === 0 ? (
          <p
            data-testid="shuffle-reel"
            aria-hidden="true"
            className="text-brass-text font-display h-16 text-5xl"
          >
            {everyone[tick % everyone.length] ?? ''}
          </p>
        ) : (
          <ol
            data-testid="group-listing"
            // Two up at phone width whatever the count — three 98px cards do
            // not hold a name — and the square-ish count from `sm` up. Tracks
            // are capped at 18rem so one group is a card, not a billboard, and
            // floored at 0 so five of them still fit a 390px screen.
            style={
              {
                '--cols': columns,
                '--cols-sm': Math.min(columns, 2),
              } as React.CSSProperties
            }
            className="grid w-full max-w-5xl grid-cols-[repeat(var(--cols-sm),minmax(0,18rem))] justify-center gap-6 sm:grid-cols-[repeat(var(--cols),minmax(0,18rem))]"
          >
            {landed.map((entry, index) => (
              <li
                key={entry.group}
                className={cn(
                  'border-border-rule bg-bg-surface rounded-md border p-4',
                  // The last group to land is the one being looked at.
                  !still && index === landed.length - 1 && 'animate-deal-in',
                )}
              >
                <h3 className="text-brass-text font-display mb-2 text-xl">
                  Group {entry.group}
                </h3>
                <ul className="flex flex-col gap-1">
                  {entry.names.map((name, row) => (
                    <li
                      key={name}
                      className={cn(
                        'text-text-secondary text-sm',
                        !still && 'animate-deal-in',
                      )}
                      style={
                        still
                          ? undefined
                          : { animationDelay: `${row * ROW_STAGGER_MS}ms` }
                      }
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}

        <button
          type="button"
          onClick={isSettled ? done : skip}
          className="border-border-rule text-text-primary hover:bg-bg-raised focus-visible:outline-accent-fill min-h-11 border px-6 text-sm focus-visible:outline-2"
        >
          {isSettled ? 'Done' : 'Skip'}
        </button>
      </div>
    </dialog>
  );
}

/**
 * 🔴 Read once, into the initial state, rather than in an effect.
 *
 * An effect runs after the first paint, so a reader who asked for less motion
 * would get one frame of the reel before it vanished — precisely the flash the
 * setting exists to prevent. Reading during render is safe here because this
 * component only ever mounts in response to a click: it is never in
 * server-rendered HTML, so there is no hydration pass to disagree with.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** How many frames the burst lasts, at roughly 60fps. */
const CONFETTI_FRAMES = 90;
const CONFETTI_PIECES = 90;
const CONFETTI_GRAVITY = 0.18;

/**
 * A confetti burst, drawn by hand into a canvas.
 *
 * 🔴 No dependency for one animation. Every confetti library on npm is a
 * physics loop and a colour array — which is the twenty lines below — wrapped
 * in a bundle this app then ships on every page that imports it.
 *
 * The colours come out of the token system at runtime rather than being
 * written here, which keeps the burst correct in both themes and keeps raw hex
 * out of `components/` (the layering check enforces that, and it is right to).
 * An environment with no computed custom properties — jsdom, a canvas the
 * browser refuses a context for — draws nothing, which is the correct amount
 * of decoration to force.
 */
function useConfetti(canvas: React.RefObject<HTMLCanvasElement | null>, run: boolean) {
  useEffect(() => {
    if (!run) return;
    const element = canvas.current;
    if (!element) return;

    const palette = ['brass-fill', 'accent-fill', 'beam', 'text-primary']
      .map((token) =>
        getComputedStyle(document.documentElement)
          .getPropertyValue(`--color-${token}`)
          .trim(),
      )
      .filter((colour) => colour !== '');
    if (palette.length === 0) return;

    const context = element.getContext('2d');
    if (!context) return;

    // The backing store has to match the CSS box or the burst draws stretched.
    const width = element.clientWidth;
    const height = element.clientHeight;
    element.width = width;
    element.height = height;

    const pieces = Array.from({ length: CONFETTI_PIECES }, (_, index) => ({
      x: width / 2,
      y: height / 2,
      // A spray outward from the centre, faster than it falls, so it reads as a
      // burst rather than as snow.
      vx: (Math.random() - 0.5) * 18,
      vy: (Math.random() - 0.9) * 14,
      size: 3 + Math.random() * 5,
      colour: palette[index % palette.length] as string,
    }));

    let frame = 0;
    let handle = 0;

    const draw = () => {
      context.clearRect(0, 0, width, height);
      for (const piece of pieces) {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.vy += CONFETTI_GRAVITY;
        context.fillStyle = piece.colour;
        context.globalAlpha = 1 - frame / CONFETTI_FRAMES;
        context.fillRect(piece.x, piece.y, piece.size, piece.size);
      }
      frame += 1;
      if (frame < CONFETTI_FRAMES) handle = requestAnimationFrame(draw);
    };

    handle = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(handle);
  }, [canvas, run]);
}
