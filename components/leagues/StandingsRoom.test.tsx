import { act, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { StandingsView } from '@/lib/services/season-ledger';
import { StandingsRoom } from './StandingsRoom';
import { KEEPS_LEAD, LIVE } from './standings-fixtures';

/**
 * The stop conditions (P16.T20, D135), with `LeagueBoardRoom.test.tsx`'s
 * harness: jsdom has no `EventSource`, so this file supplies one that records
 * every instance and whether it was closed. What is asserted is the
 * component's own decision to open, close, or never open.
 */
const STREAM = '/api/leagues/7/standings/stream?year=2026';

class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
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

  frame(next: StandingsView) {
    act(() => {
      this.onmessage?.({ data: JSON.stringify(next) } as MessageEvent);
    });
  }

  fail(readyState: number) {
    this.readyState = readyState;
    act(() => {
      this.onerror?.(new Event('error'));
    });
  }
}

const open = () => FakeEventSource.instances.filter((source) => !source.closed);

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

function view(overrides: Partial<StandingsView> = {}): StandingsView {
  return {
    leagueId: 7,
    leagueName: 'L',
    year: 2026,
    onAir: true,
    shows: [{ abbreviation: 'oscars', name: 'Academy Awards' }],
    rows: [
      {
        draftId: 1,
        name: 'Ada',
        isViewer: false,
        position: 1,
        byShow: { oscars: 12 },
        last: 12,
        move: 0,
        total: 12,
      },
    ],
    whatMoved: LIVE,
    firstDate: null,
    ...overrides,
  };
}

function only(): FakeEventSource {
  const source = FakeEventSource.instances[0];
  if (!source) throw new Error('no EventSource was opened');
  return source;
}

function room(initial: StandingsView, wrapper: 'plain' | 'strict' = 'plain') {
  const element = <StandingsRoom initial={initial} streamUrl={STREAM} />;
  return render(wrapper === 'strict' ? <StrictMode>{element}</StrictMode> : element);
}

describe('StandingsRoom', () => {
  it('renders the server frame before any connection', () => {
    const html = renderToString(<StandingsRoom initial={view()} streamUrl={STREAM} />);
    expect(html).toContain('What moved');
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('opens one stream while a show is on air', () => {
    room(view());
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(only().url).toBe(STREAM);
  });

  it('opens no connection at all off air', () => {
    room(view({ onAir: false, whatMoved: KEEPS_LEAD }));
    expect(FakeEventSource.instances).toHaveLength(0);
    setHidden(true);
    setHidden(false);
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('opens no connection when the tab is already hidden at mount', () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    room(view());
    expect(FakeEventSource.instances).toHaveLength(0);

    setHidden(false);
    expect(open()).toHaveLength(1);
  });

  it('closes on hidden and opens exactly one on return', () => {
    room(view());
    setHidden(true);
    expect(open()).toHaveLength(0);
    setHidden(false);
    expect(open()).toHaveLength(1);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('replaces the standings when a frame arrives, on one connection', () => {
    room(view());
    only().frame(
      view({
        rows: [
          { ...view().rows[0], last: 30, total: 30 } as StandingsView['rows'][number],
        ],
      }),
    );
    expect(screen.getAllByText('30').length).toBeGreaterThan(0);
    only().frame(view());
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('closes on a frame that says the show is off air, keeping the last view', () => {
    room(view());
    only().frame(view({ onAir: false, whatMoved: KEEPS_LEAD }));
    expect(open()).toHaveLength(0);
    expect(screen.getByText(/keeps the lead/)).toBeInTheDocument();
  });

  it('does not reopen after a refusal', () => {
    room(view());
    only().fail(FakeEventSource.CLOSED);
    setHidden(true);
    setHidden(false);
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(open()).toHaveLength(0);
  });

  it('leaves a clean close alone', () => {
    room(view());
    only().fail(FakeEventSource.CONNECTING);
    expect(open()).toHaveLength(1);
  });

  it('closes on unmount, and opens one under StrictMode', () => {
    const { unmount } = room(view(), 'strict');
    expect(open()).toHaveLength(1);
    unmount();
    expect(open()).toHaveLength(0);
  });
});
