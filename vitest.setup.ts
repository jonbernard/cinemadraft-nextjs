import { cleanup } from '@testing-library/react';
import { config } from 'dotenv';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

/**
 * Unmount between tests.
 *
 * Testing Library registers this automatically, but only when Vitest's
 * `globals` are enabled — and this project runs without them. Without it every
 * `render` accumulates in the same document, so a test asserting an element is
 * *absent* finds the previous test's copy and fails, while a test asserting
 * presence passes for the wrong reason. The second failure mode is the
 * dangerous one, because it is silent.
 */
afterEach(cleanup);

// Vitest does not read .env files the way Next does, so database tests would
// otherwise start with DATABASE_URL unset.
//
// .env.local first and .env second, matching Next's precedence. Both point at
// the local Docker container — Neon is Preview/Production only, and a suite
// pointed at it would be mutating the only restored copy of production data.
config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

/**
 * 🔴 No test reaches TMDB by accident.
 *
 * `.env.local` carries a real `TMDB_API_KEY`, and search now consults TMDB on
 * every query (D56) — so loading the env above quietly turned nine existing
 * tests into live network calls the moment a key was supplied. One of them
 * started failing immediately, and the rest were slower, flakier and spending
 * quota; worse, the suite had begun behaving differently depending on whether
 * the developer running it happened to have a key.
 *
 * Clearing it here makes the default deterministic and offline: `searchTmdb`
 * returns nothing without a key, so a test that does not care about TMDB gets
 * local results and no socket. The tests that *are* about TMDB set the
 * variable themselves and stub `fetch` — `lib/external/tmdb.test.ts` and
 * `lib/services/film-ingest.test.ts` both do, which is why they still pass.
 *
 * Deliberately after `config()`, so it wins regardless of what the env holds.
 */
delete process.env.TMDB_API_KEY;

/**
 * 🔴 jsdom implements `<dialog>`'s `open` attribute but not `showModal()` or
 * `close()` — verified directly rather than inferred from a stack trace.
 *
 * `AppNav`'s phone drawer is a native dialog precisely because the platform
 * supplies the focus trap, Escape and the backdrop; without these two methods
 * every test touching it throws. Polyfilling here keeps the component free of
 * defensive checks that exist only for a test environment.
 *
 * Faithful to the parts the tests rely on: `open` reflects state, and `close()`
 * fires a `close` event, which is what keeps the trigger's `aria-expanded`
 * honest. It does NOT emulate the focus trap or inertness — those are the
 * browser's, and the E2E suite is where they are actually exercised.
 */
if (typeof HTMLDialogElement !== 'undefined') {
  const dialog = HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal?: () => void;
    show?: () => void;
    close?: (returnValue?: string) => void;
  };

  if (!dialog.showModal) {
    dialog.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!dialog.show) {
    dialog.show = function show(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!dialog.close) {
    dialog.close = function close(this: HTMLDialogElement, returnValue?: string) {
      if (!this.open) return;
      this.open = false;
      if (returnValue !== undefined) this.returnValue = returnValue;
      this.dispatchEvent(new Event('close'));
    };
  }
}

/**
 * 🔴 jsdom has no `scrollIntoView` at all — not a stub, the property is absent,
 * so `vi.spyOn` on it throws "The property is not defined on the object".
 *
 * `PosterCarousel` scrolls the strip by calling it, which is deliberate: letting
 * the browser do the scrolling is what makes `prefers-reduced-motion` the
 * platform's concern rather than a check the component could forget. Defining it
 * as a no-op here is honest about what jsdom can offer — there is no layout, so
 * there is nothing to scroll — and lets a test assert that the component *asked*,
 * which is the part that can regress. Whether a poster moves is an E2E question.
 */
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    // No layout in jsdom, so there is nothing to scroll. Tests spy on the call.
  };
}

/**
 * 🔴 jsdom has no `ResizeObserver` — the constructor is absent, so merely
 * rendering a component that measures itself throws before any assertion runs.
 *
 * `SeasonStepper` measures because it must: its window holds however many 160px
 * boxes the container turns out to fit, and a constant got that wrong by three
 * boxes on a phone. Defined here rather than guarded in the component, for the
 * reason the polyfills above give.
 *
 * Fires once, synchronously, on `observe` — which is what a browser does, and
 * what lets a test assert against a measured render without pumping timers. The
 * rect comes from `getBoundingClientRect`, jsdom's one measurement seam: it
 * answers all-zeros by default, which the stepper reads as "not laid out" and
 * falls back from, and a test that wants a width stubs it. Nothing here
 * observes anything afterwards — a resize a test wants to simulate is another
 * `render`, and whether a real browser re-measures is an E2E question.
 */
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}

    observe(target: Element) {
      this.callback(
        [{ target, contentRect: target.getBoundingClientRect() } as ResizeObserverEntry],
        this,
      );
    }

    unobserve() {}
    disconnect() {}
  };
}

/**
 * 🔴 jsdom has no `matchMedia` — the property is simply absent on `window`.
 *
 * `GroupCeremony` reads `(prefers-reduced-motion: reduce)` in its initial
 * state rather than in an effect, so that a reader who asked for less motion
 * never sees a frame of the reel. That makes the call unconditional, and an
 * environment without `matchMedia` would throw on render.
 *
 * Defined here rather than guarded in the component, for the reason the
 * `<dialog>` polyfill above gives: a component should not carry checks that
 * exist only because a test environment is thinner than a browser. The stub
 * answers "no" to everything, which is the browser default and the state the
 * ceremony's animated path needs; a test that wants the other answer passes
 * the `reducedMotion` prop, which is why that prop exists.
 *
 * The listener methods are real no-ops rather than missing: React and MUI both
 * subscribe to media queries, and an absent `addEventListener` throws where a
 * no-op simply never fires.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
