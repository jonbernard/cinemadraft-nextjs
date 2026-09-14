import { act, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LiveRoom, type LiveRoomView } from './LiveRoom';

/**
 * The stop conditions, which are the reason P14.T4 exists as a task rather
 * than as three lines inside the page.
 *
 * 🔴 **What is faked here is the browser, not the component.** jsdom has no
 * `EventSource` at all — the constructor is absent — so this file supplies one
 * that records every instance and whether it was closed. Everything the tests
 * assert is the component's own decision: whether to construct one, when to
 * close it, and whether it ever constructs a second.
 *
 * 🔴 Every guard below was mutation-checked — broken in the component, watched
 * go red here, restored. Eight mutations, eight named failures. The run earned
 * its keep: the `document.hidden` check inside `open()` survived every test
 * this file originally had, so "mounts into a hidden tab" was written to catch
 * it. A test that cannot go red is not a test.
 */

const STREAM = '/api/live/oscars/stream?year=2026';

class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  /** Every one ever constructed, in order. Never cleared by `close`. */
  static instances: FakeEventSource[] = [];

  readyState: number = FakeEventSource.OPEN;
  closed = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }

  /** One full frame off the wire, exactly as the route writes it. */
  frame(view: LiveRoomView) {
    act(() => {
      this.onmessage?.({ data: JSON.stringify(view) } as MessageEvent);
    });
  }

  /**
   * `CLOSED` is a non-200 — the 204 the route answers off air — which a real
   * `EventSource` never retries. `CONNECTING` is the ~50s self-close, which it
   * retries on its own.
   */
  fail(readyState: number) {
    this.readyState = readyState;
    act(() => {
      this.onerror?.(new Event('error'));
    });
  }
}

/** Connections that are open right now, which is the number that costs money. */
function open(): FakeEventSource[] {
  return FakeEventSource.instances.filter((source) => !source.closed);
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

beforeEach(() => {
  FakeEventSource.instances = [];
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  globalThis.EventSource = FakeEventSource as unknown as typeof EventSource;
});

afterEach(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});

function view(overrides: Partial<LiveRoomView> = {}): LiveRoomView {
  return {
    onAir: true,
    resolved: 0,
    total: 2,
    categories: [
      {
        awardId: 10,
        name: 'Best Picture',
        points: 7,
        nominees: [
          {
            nominationId: 1,
            title: 'Alpha',
            posterUrl: null,
            detailName: null,
            isWinner: false,
          },
          {
            nominationId: 2,
            title: 'Bravo',
            posterUrl: null,
            detailName: null,
            isWinner: false,
          },
        ],
      },
      {
        awardId: 11,
        name: 'Best Sound',
        points: 7,
        nominees: [
          {
            nominationId: 3,
            title: 'Alpha',
            posterUrl: null,
            detailName: null,
            isWinner: false,
          },
        ],
      },
    ],
    league: null,
    leagueOptions: [],
    focusedAwardId: null,
    ...overrides,
  };
}

/** The same view with Best Picture decided — one award resolved of two. */
function decided(): LiveRoomView {
  const base = view();
  return {
    ...base,
    resolved: 1,
    categories: base.categories.map((category) =>
      category.awardId === 10
        ? {
            ...category,
            nominees: category.nominees.map((nominee) => ({
              ...nominee,
              isWinner: nominee.title === 'Alpha',
            })),
          }
        : category,
    ),
  };
}

/**
 * The connection, or a failure. 🔴 Not `instances[0]?.` — optional chaining
 * would make "no connection was ever opened" a silent no-op, which is the one
 * thing half these tests are about.
 */
function only(): FakeEventSource {
  const source = FakeEventSource.instances[0];
  if (!source) throw new Error('no EventSource was opened');
  return source;
}

function room(initial: LiveRoomView, wrapper: 'plain' | 'strict' = 'plain') {
  const element = (
    <LiveRoom
      initial={initial}
      streamUrl={STREAM}
      abbr="oscars"
      year={2026}
      tvMode={false}
      signedIn={false}
    />
  );
  return render(wrapper === 'strict' ? <StrictMode>{element}</StrictMode> : element);
}

describe('LiveRoom', () => {
  it('renders the whole room on the server, with no connection', () => {
    // 🔴 The first paint is the page. A stranger, a crawler and a reader whose
    // JavaScript never arrives get the categories and the counter from the
    // server render — this must never become a client-side fetch, and
    // `renderToString` is where that is decided, because effects do not run.
    const html = renderToString(
      <LiveRoom
        initial={view()}
        streamUrl={STREAM}
        abbr="oscars"
        year={2026}
        tvMode={false}
        signedIn={false}
      />,
    );

    expect(html).toContain('Best Picture');
    expect(html).toContain('Best Sound');
    expect(html).toContain('0 of 2');
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('opens one stream for a show that is on air', () => {
    room(view());

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(only().url).toBe(STREAM);
  });

  it('replaces the view with the frame that arrives', () => {
    room(view());
    expect(screen.getByText('0 of 2')).toBeInTheDocument();

    only().frame(decided());

    // The counter, and the winner's own word — every frame is complete state,
    // so this is a replacement rather than a merge.
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.queryByText('0 of 2')).not.toBeInTheDocument();
    expect(screen.getByText('Winner')).toBeInTheDocument();
  });

  it('never opens a stream for a show that is not on air', () => {
    // The free-tier guard at its cheapest: a finished ceremony left open in a
    // tab costs nothing at all, because nothing is ever opened.
    room(view({ onAir: false }));

    expect(FakeEventSource.instances).toHaveLength(0);

    // And a visibility cycle does not find a way in either.
    setHidden(true);
    setHidden(false);
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('closes the stream when the tab is hidden', () => {
    // One forgotten monitor holding a stream open is ~180 CU-hrs a month
    // against a 100 CU-hr allowance. This single line is the difference.
    room(view());
    expect(open()).toHaveLength(1);

    setHidden(true);

    expect(open()).toHaveLength(0);
  });

  it('opens nothing at all when it mounts into a hidden tab', () => {
    // 🔴 Added because the mutation run caught this: breaking the `hidden`
    // check inside `open()` left every other test green. A tab restored on
    // browser start, or one opened in the background, mounts hidden and never
    // fires `visibilitychange` — so without this the page opens a stream
    // nobody is looking at and nothing will close until somebody does.
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    room(view());

    expect(FakeEventSource.instances).toHaveLength(0);

    setHidden(false);
    expect(open()).toHaveLength(1);
  });

  it('opens a new stream when the tab comes back', () => {
    room(view());
    setHidden(true);
    setHidden(false);

    expect(open()).toHaveLength(1);
    // A second connection, not the closed one revived — and its first frame is
    // full state, which is what makes the gap invisible.
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('keeps exactly one stream open while the tab is visible', () => {
    // A `visibilitychange` can fire while the tab is already visible, and
    // without the guard each one opens a stream nothing will ever close.
    room(view());
    setHidden(false);
    setHidden(false);

    expect(open()).toHaveLength(1);
  });

  it('opens one stream, not two, under a double-invoked effect', () => {
    // React runs setup → cleanup → setup in StrictMode, which is development.
    // Two live connections here is a leak that only ever shows up as a bill.
    room(view(), 'strict');

    expect(open()).toHaveLength(1);
  });

  it('closes the stream on unmount', () => {
    const { unmount } = room(view());
    unmount();

    expect(open()).toHaveLength(0);
  });

  it('does not retry a connection the server refused', () => {
    // 🔴 `EventSource` fires `error` and stays CLOSED on any non-200 — the 204
    // the route answers off air. A backoff loop written on top of that is
    // exactly the leak the 204 exists to stop, so a refusal is final: not on
    // the spot, and not on the next time the reader looks at the tab.
    room(view());
    only().fail(FakeEventSource.CLOSED);

    expect(FakeEventSource.instances).toHaveLength(1);

    setHidden(true);
    setHidden(false);
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(open()).toHaveLength(0);
  });

  it('leaves the browser to reconnect its own clean close', () => {
    // The other half of the test above, and the one that makes it mean
    // something: the route closes itself every ~50s and the browser
    // reconnects on its own. Treating that as a refusal would leave a live
    // page dead after five minutes, which nothing else here would catch.
    room(view());
    only().fail(FakeEventSource.CONNECTING);

    // Nothing opened, nothing closed: the browser owns this one.
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(open()).toHaveLength(1);
  });

  it('closes the stream when a frame says the show has gone off air', () => {
    // The route reads `onAir` only when a connection opens, so a show that ends
    // mid-stream arrives as one last full frame saying so.
    room(view());
    only().frame({ ...decided(), onAir: false });

    expect(open()).toHaveLength(0);
    // And the reader keeps the last state rather than an empty page.
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
  });

  it('plays the reveal for a winner that arrives, and only for that category', () => {
    // P14.T4's half of the reveal: `LiveAward` already renders it, and what
    // decides it is having seen the category undecided a frame earlier.
    const { container } = room(view());
    only().frame(decided());

    expect(container.querySelectorAll('.animate-reveal-mark')).toHaveLength(1);
  });

  it('never plays a reveal for a result the server already rendered', () => {
    // 🔴 The failure mode of every animation tied to render rather than to an
    // event: a reload of a finished ceremony replaying twenty-four reveals at
    // once. The server's frame is the baseline, not an announcement.
    const { container } = room(decided());

    expect(screen.getByText('Winner')).toBeInTheDocument();
    expect(container.querySelectorAll('.animate-reveal-mark')).toHaveLength(0);

    // Still nothing when a later frame repeats what was already decided.
    only().frame(decided());
    expect(container.querySelectorAll('.animate-reveal-mark')).toHaveLength(0);
  });
  it('marks the category the admin has on screen', () => {
    room(view({ focusedAwardId: 10 }));

    const mark = screen.getByText(/on screen now/i);
    expect(mark.closest('li')?.textContent).toContain('Best Picture');
  });

  it('moves the mark when a frame changes the selection', () => {
    // 🔴 The whole feature: the admin points at a category and every open page
    // follows within one poll. Asserting the mark MOVED, not that one exists —
    // a component that marked everything would pass the weaker version.
    room(view({ focusedAwardId: 10 }));
    only().frame(view({ focusedAwardId: 11 }));

    const marks = screen.getAllByText(/on screen now/i);
    expect(marks).toHaveLength(1);
    expect(marks[0]?.closest('li')?.textContent).toContain('Best Sound');
  });

  it('marks nothing when the admin has selected nothing', () => {
    room(view({ focusedAwardId: null }));
    expect(screen.queryByText(/on screen now/i)).not.toBeInTheDocument();
  });

  it('scrolls the focused category into view when the selection changes, and not on first render', () => {
    // 🔴 Not on first render. A reader who opens the page mid-ceremony has the
    // selection in their first frame; yanking their scroll position before
    // they have looked at anything is the same defect as replaying every
    // reveal on reload (`LiveAward`'s `reveal` default).
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    room(view({ focusedAwardId: 10 }));
    expect(scroll).not.toHaveBeenCalled();

    only().frame(view({ focusedAwardId: 11 }));

    expect(scroll).toHaveBeenCalledTimes(1);
    expect((scroll.mock.contexts[0] as Element).id).toBe('award-11');

    // And a frame repeating the same selection does not scroll again — a
    // re-render every two seconds that re-scrolled would make the page
    // unreadable.
    only().frame(view({ focusedAwardId: 11 }));
    expect(scroll).toHaveBeenCalledTimes(1);

    scroll.mockRestore();
  });
});
