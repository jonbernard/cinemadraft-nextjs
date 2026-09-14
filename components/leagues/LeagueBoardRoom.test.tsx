import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LeagueBoardRoom, type LeagueBoardRoomView } from './LeagueBoardRoom';

/**
 * The stop conditions, which are the reason P14.T11 exists as a task rather
 * than as three lines inside the page.
 *
 * 🔴 **What is faked here is the browser, not the component.** jsdom has no
 * `EventSource` at all — the constructor is absent — so this file supplies one
 * that records every instance and whether it was closed. Everything the tests
 * assert is the component's own decision: whether to construct one, when to
 * close it, and whether it ever constructs a second.
 *
 * The harness is `components/awards/LiveRoom.test.tsx`'s, reused rather than
 * reinvented: the effect under test is that one copied verbatim with `onAir`
 * read as `isDrafting`, so the tests that hold it honest are the same tests.
 */

const STREAM = '/api/leagues/7/board/stream?year=2026';

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
  frame(view: LeagueBoardRoomView) {
    act(() => {
      this.onmessage?.({ data: JSON.stringify(view) } as MessageEvent);
    });
  }

  /**
   * `CLOSED` is a non-200 — the 204 the route answers off draft — which a real
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

function pick(pickId: number, round: number, title: string) {
  return { pickId, round, title, posterUrl: null, points: 0, ledger: [] };
}

function view(overrides: Partial<LeagueBoardRoomView> = {}): LeagueBoardRoomView {
  return {
    year: 2026,
    isPending: false,
    isDrafting: true,
    viewerRoster: [],
    viewerSeated: false,
    standings: [
      { userId: 1, name: 'Ada', total: 12, position: 1, isViewer: false },
      { userId: 2, name: 'Grace', total: 8, position: 2, isViewer: false },
    ],
    groups: [
      {
        group: 1,
        rounds: 2,
        seats: [
          {
            draftId: 11,
            name: 'Ada',
            isDummy: false,
            uuid: null,
            total: 12,
            order: 1,
            picks: [pick(101, 1, 'Alpha')],
          },
          {
            draftId: 12,
            name: 'Grace',
            isDummy: false,
            uuid: null,
            total: 8,
            order: 2,
            picks: [pick(102, 1, 'Bravo')],
          },
        ],
      },
    ],
    ...overrides,
  };
}

/** The same board with one more pick on it — what a draft moving looks like. */
function afterAPick(): LeagueBoardRoomView {
  const base = view();
  return {
    ...base,
    groups: base.groups.map((group) => ({
      ...group,
      seats: group.seats.map((seat) =>
        seat.draftId === 11
          ? { ...seat, picks: [...seat.picks, pick(103, 2, 'Charlie')] }
          : seat,
      ),
    })),
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

function room(
  initial: LeagueBoardRoomView,
  wrapper: 'plain' | 'strict' = 'plain',
  tv: { tvMode: boolean; group: number | null } = { tvMode: false, group: null },
) {
  const element = (
    <LeagueBoardRoom
      initial={initial}
      streamUrl={STREAM}
      signedIn={false}
      viewerSeatId={null}
      tvMode={tv.tvMode}
      group={tv.group}
    />
  );
  return render(wrapper === 'strict' ? <StrictMode>{element}</StrictMode> : element);
}

/** A second group, so "only one is on screen" is a claim with two candidates. */
function twoGroups(): LeagueBoardRoomView {
  const base = view();
  const first = base.groups[0] as LeagueBoardRoomView['groups'][number];
  return {
    ...base,
    groups: [
      first,
      {
        group: 2,
        rounds: 2,
        seats: first.seats.map((seat) => ({
          ...seat,
          draftId: seat.draftId + 100,
          name: `${seat.name} two`,
          picks: [pick(201, 1, 'Delta')],
        })),
      },
    ],
  };
}

describe('LeagueBoardRoom', () => {
  it('renders the server frame before any connection', () => {
    // 🔴 The first paint is the page. A stranger, a crawler and a reader whose
    // JavaScript never arrives get the whole board from the server render —
    // this must never become a client-side fetch, and `renderToString` is
    // where that is decided, because effects do not run.
    const html = renderToString(
      <LeagueBoardRoom
        initial={view()}
        streamUrl={STREAM}
        signedIn={false}
        viewerSeatId={null}
      />,
    );

    expect(html).toContain('Alpha');
    expect(html).toContain('Bravo');
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('opens one stream for a league that is drafting', () => {
    room(view());

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(only().url).toBe(STREAM);
  });

  it('replaces the board outright when a frame arrives', () => {
    room(view());
    expect(screen.queryAllByText('Charlie')).toHaveLength(0);

    only().frame(afterAPick());

    // Every frame is complete state, so this is a replacement, not a merge —
    // and the pick that was already there is still there.
    expect(screen.queryAllByText('Charlie').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Alpha').length).toBeGreaterThan(0);
  });

  it('opens no connection at all when the league is not drafting', () => {
    // 🔴 The budget. A league is `active` for an hour a season; every other
    // reload of this public page must cost nothing.
    room(view({ isDrafting: false }));

    expect(FakeEventSource.instances).toHaveLength(0);

    // And a visibility cycle does not find a way in either.
    setHidden(true);
    setHidden(false);
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('opens no connection when the tab is already hidden at mount', () => {
    // 🔴 Not redundant with `visibilitychange`: a restored browser or a
    // background-opened tab fires no event, so nothing would ever close it.
    // This exact gap survived tranche 1's first mutation run (D111).
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    room(view());

    expect(FakeEventSource.instances).toHaveLength(0);

    setHidden(false);
    expect(open()).toHaveLength(1);
  });

  it('closes on visibilitychange and opens exactly one on return', () => {
    room(view());
    expect(open()).toHaveLength(1);

    setHidden(true);
    expect(open()).toHaveLength(0);

    setHidden(false);
    expect(open()).toHaveLength(1);
    // A second connection, not the closed one revived — and its first frame is
    // full state, which is what makes the gap invisible.
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('keeps exactly one stream open across frames', () => {
    // 🔴 The dependency-array guard: the effect must not depend on the view it
    // sets, or it tears the connection down and builds a new one on every
    // frame — the whole connection budget spent in seconds, and the bug would
    // look like the page working perfectly. Two delivered frames, still one
    // connection.
    //
    // 🔴 What this catches is `[streamUrl, view]`, not `[streamUrl,
    // view.isDrafting]` — mutation-checked, and the plan (P14.T11 step 6) has
    // that backwards. `view.isDrafting` is a boolean that does not change
    // between two frames of a running draft, so it re-runs nothing and this
    // count stays at one; that mutation is caught instead by "closes when a
    // frame says the draft has finished", where the boolean does flip. The
    // whole view object is a new identity every frame, which is the reconnect
    // storm the comment on the effect describes, and only this test sees it.
    room(view());
    only().frame(afterAPick());
    only().frame(view());

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(open()).toHaveLength(1);
  });

  it('closes on unmount', () => {
    const { unmount } = room(view());
    unmount();

    expect(open()).toHaveLength(0);
  });

  it('does not reopen after a refusal', () => {
    // readyState CLOSED is final — the 204 off-draft, or a 404 (D111).
    room(view());
    only().fail(FakeEventSource.CLOSED);

    expect(FakeEventSource.instances).toHaveLength(1);

    setHidden(true);
    setHidden(false);
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(open()).toHaveLength(0);
  });

  it('leaves a clean close alone', () => {
    // readyState CONNECTING is the ~50s self-close; the browser reconnects and
    // nothing here interferes.
    room(view());
    only().fail(FakeEventSource.CONNECTING);

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(open()).toHaveLength(1);
  });

  it('closes when a frame says the draft has finished', () => {
    // The route checks `isDrafting` only when a connection opens, so a draft
    // ending mid-stream arrives as one last full frame saying so.
    room(view());
    only().frame({ ...afterAPick(), isDrafting: false });

    expect(open()).toHaveLength(0);
    // And the reader keeps the last board rather than an empty page.
    expect(screen.queryAllByText('Charlie').length).toBeGreaterThan(0);
  });

  it('opens exactly one connection under StrictMode double-invocation', () => {
    // React runs setup → cleanup → setup in StrictMode, which is development.
    // Two live connections here is a leak that only ever shows up as a bill.
    room(view(), 'strict');

    expect(open()).toHaveLength(1);
  });
});

/**
 * TV mode (P14.T19). The owner's requirement is that during a live draft every
 * pick in the group is visible **at once**, on a television, with the chrome
 * gone — so what changes here is what is on the screen, never what is in the
 * frame.
 */
describe('LeagueBoardRoom in TV mode', () => {
  it('stacks every group when TV mode is off', () => {
    // The baseline the two tests below are a change from: without it, "only
    // one group" could be the default renamed.
    room(twoGroups());

    expect(screen.getAllByRole('table', { name: /draft board/i })).toHaveLength(2);
    expect(screen.queryAllByText('Delta').length).toBeGreaterThan(0);
  });

  it('shows only the chosen group on a television', () => {
    room(twoGroups(), 'plain', { tvMode: true, group: 2 });

    expect(screen.getAllByRole('table', { name: /draft board/i })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { name: 'Group 2' })).toHaveLength(1);
    // Group 2's board, and group 1's is not underneath it.
    expect(screen.queryAllByText('Delta').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Alpha')).toHaveLength(0);
  });

  it('falls back to the first group rather than an empty screen', () => {
    // `?group=` is a number a remote can land on. An unknown one must show a
    // board — this page is what a room full of people is looking at.
    room(twoGroups(), 'plain', { tvMode: true, group: 99 });

    expect(screen.getAllByRole('heading', { name: 'Group 1' })).toHaveLength(1);
    expect(screen.queryAllByText('Alpha').length).toBeGreaterThan(0);
  });

  it('keeps the standings and the reader’s roster off the television', () => {
    // 4 seats of poster is the whole of 1080; the standings table and the
    // roster strip are what the height has to come from. Present in the
    // ordinary page, absent here.
    // 🔴 Scoped with `within(container)` rather than `screen`: two renders in
    // one test share `document.body`, so the screen queries would find the
    // first render's standings inside the second and this would pass against a
    // TV mode that changed nothing.
    const plain = room(twoGroups());
    expect(
      within(plain.container).getByRole('heading', { name: 'Standings' }),
    ).toBeInTheDocument();

    const tv = room(twoGroups(), 'plain', { tvMode: true, group: 1 });
    expect(within(tv.container).queryByRole('heading', { name: 'Standings' })).toBeNull();
    expect(
      within(tv.container).queryByRole('heading', { name: 'Your roster' }),
    ).toBeNull();
  });

  it('still streams in TV mode — the mode is chrome, the stream is data', () => {
    // 🔴 The one thing TV mode must not cost. A reader who casts the board and
    // then watches a still picture has lost the whole feature.
    room(view(), 'plain', { tvMode: true, group: 1 });

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(only().url).toBe(STREAM);

    only().frame(afterAPick());
    expect(screen.queryAllByText('Charlie').length).toBeGreaterThan(0);
  });
});

/**
 * The seam between this component and the page that mounts it, read out of the
 * page's source for the reason `components/ui/TvModeLink.test.tsx` gives: the
 * browser proof needs a production build and a database, and this says which
 * side moved in a second.
 */
describe('the league page’s TV seam', () => {
  const page = readFileSync(
    join(process.cwd(), 'app/(app)/leagues/[id]/page.tsx'),
    'utf8',
  );

  it('does not carry tv mode in the stream url', () => {
    // 🔴 `LeagueBoardRoom` is keyed on `streamUrl`. A `tv` — or a `group` —
    // in that string makes every toggle a fresh mount: a dropped
    // `EventSource` and a reconnect in the middle of a live draft (D114). The
    // mode is chrome; the stream is data.
    const at = page.indexOf('const streamUrl = ');
    const streamUrl = page.slice(at, page.indexOf('`;', at));

    expect(streamUrl).not.toMatch(/tv/i);
    expect(streamUrl).not.toMatch(/group/i);
    expect(page).toContain('key={streamUrl}');
  });

  it('sets the marker the stylesheet reads, and only under ?tv=1', () => {
    expect(page).toContain("data-tv-mode={tvMode ? '' : undefined}");
    expect(page).toContain("const tvMode = tv === '1';");
  });

  it('carries tv=1 on every link the group nav renders', () => {
    // 🔴 D114 exactly: the live room's league picker shipped dropping `?tv=1`,
    // taking a reader with a remote out of full screen with no way back. The
    // group nav is the same control in the same trap. `e2e/league-board-live`
    // proves it in a browser; this names the line.
    expect(page).toContain('href={pageUrl({ group: entry.group, tv: true })}');
    expect(page).toMatch(/next\.tv \? '&tv=1' : ''/);
  });
});
