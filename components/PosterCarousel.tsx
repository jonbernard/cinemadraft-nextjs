'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * A film's poster gallery, with the `1/112` counter the source page shows.
 *
 * 🔴 **A scroll-snap strip, not `react-slick`.** The source mounted a slider
 * library for this (`src/pages/movie/index.jsx:380`). A CSS strip with
 * `overflow-x-auto` and `snap-x snap-mandatory` is smaller, works before
 * hydration, and is already scrollable with a trackpad, a touch swipe, a
 * horizontal wheel and the arrow keys once the strip has focus — none of which
 * this component has to implement.
 *
 * 🔴 **`scrollIntoView` rather than a JS animation.** Smoothness is then the
 * browser's decision, which means `prefers-reduced-motion` is honoured by the
 * platform instead of by a check this component could forget (a11y
 * `reduced-motion`).
 *
 * The buttons exist because a strip with no visible control does not announce
 * that it scrolls (a11y `swipe-clarity`), and because a mouse user with no
 * horizontal wheel has no other way through it.
 *
 * The counter is `aria-live="polite"`: the position is the one piece of state a
 * reader cannot infer, and it changes without any DOM being added or removed.
 */
export function PosterCarousel({
  title,
  posterUrls,
  className,
}: {
  /** The film's title, for the alt text and the accessible names. */
  title: string;
  posterUrls: readonly string[];
  className?: string;
}) {
  const strip = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);

  /**
   * Which poster is showing, derived from the scroll position.
   *
   * Read from the DOM rather than tracked as state that the buttons increment:
   * the strip can also be scrolled by swipe, trackpad and keyboard, and a
   * counter that only knows about button presses would drift out of step with
   * what the reader is looking at — which is worse than no counter.
   */
  const syncIndex = useCallback(() => {
    const element = strip.current;
    if (!element) return;
    const width = element.clientWidth;
    if (width === 0) return;
    setIndex(Math.round(element.scrollLeft / width));
  }, []);

  useEffect(() => {
    const element = strip.current;
    if (!element) return;
    element.addEventListener('scroll', syncIndex, { passive: true });
    return () => element.removeEventListener('scroll', syncIndex);
  }, [syncIndex]);

  const go = useCallback((delta: number) => {
    const element = strip.current;
    if (!element) return;
    // The posters are one level down now that the scroll container is the
    // focusable region rather than the list itself.
    const items = [...(element.firstElementChild?.children ?? [])];
    const width = element.clientWidth;
    const current = width === 0 ? 0 : Math.round(element.scrollLeft / width);
    const target = items.at(Math.min(items.length - 1, Math.max(0, current + delta)));
    target?.scrollIntoView({ block: 'nearest', inline: 'start', behavior: 'smooth' });
  }, []);

  // Wrapped rather than inlined as `() => go(-1)`: Biome's `noJsxPropsBind`
  // objects to an arrow in a prop, and it is right that these are stable.
  const goPrevious = useCallback(() => go(-1), [go]);
  const goNext = useCallback(() => go(1), [go]);

  if (posterUrls.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* 🔴 A named, focusable `<section>` **is** the scroll container. WCAG
          2.1.1 requires a scrollable region to be keyboard-reachable, and only a
          focusable element can be scrolled with the arrow keys — so the
          `tabIndex` is load-bearing, not decoration, and Biome's offer to remove
          it would silently delete the keyboard path. A `<section>` with an
          accessible name carries the `region` role natively, which is what makes
          the focus stop announce itself instead of arriving as an anonymous
          `<div>`. The list stays a plain list inside it. */}
      <section
        ref={strip}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: WCAG 2.1.1 requires a scrollable region to be keyboard-reachable, and only a focusable element can be scrolled with the arrow keys. The rule has no exception for that, and its offered fix deletes the keyboard path outright. The named <section> is what makes the focus stop announce itself.
        tabIndex={0}
        aria-label={`Posters for ${title}`}
        className="focus-visible:outline-accent-fill snap-x snap-mandatory overflow-x-auto focus-visible:outline-2"
      >
        <ul className="flex gap-4">
          {posterUrls.map((url, position) => (
            <li key={url} className="w-full shrink-0 snap-start">
              {/* biome-ignore lint/performance/noImgElement: swapped for next/image in Phase 11, which needs the remote host allowlist configured first */}
              <img
                src={url}
                alt={`Poster ${position + 1} for ${title}`}
                // Explicit ratio so the strip does not reflow as images arrive
                // (Core Web Vitals: CLS). Every TMDB poster is 2:3.
                className="poster-radius bg-bg-raised light:border light:border-border-rule aspect-[2/3] w-full object-contain"
                loading={position === 0 ? 'eager' : 'lazy'}
              />
            </li>
          ))}
        </ul>
      </section>

      <div className="flex items-center justify-between">
        <p aria-live="polite" className="text-text-secondary tabular font-mono text-xs">
          {index + 1}/{posterUrls.length}
        </p>

        <div className="flex items-center gap-1">
          <StripButton
            label="Previous poster"
            onClick={goPrevious}
            disabled={index === 0}
            path="M15 5l-7 7 7 7"
          />
          <StripButton
            label="Next poster"
            onClick={goNext}
            disabled={index === posterUrls.length - 1}
            path="M9 5l7 7-7 7"
          />
        </div>
      </div>
    </div>
  );
}

function StripButton({
  label,
  onClick,
  disabled,
  path,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  path: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="border-border-rule text-text-primary hover:bg-bg-raised focus-visible:outline-accent-fill flex min-h-11 min-w-11 items-center justify-center border disabled:opacity-40 focus-visible:outline-2"
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={path} />
      </svg>
      <span className="sr-only">{label}</span>
    </button>
  );
}
