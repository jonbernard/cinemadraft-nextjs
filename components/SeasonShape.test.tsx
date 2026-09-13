import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  SeasonBeat,
  type SeasonPhase,
  SeasonPhaseBeats,
  SeasonShape,
} from './SeasonShape';

const DAY = 86_400_000;
/** 2026-01-05 and 2026-06-05 UTC — five months and a bit apart. */
const JAN = Date.UTC(2026, 0, 5);
const JUN = Date.UTC(2026, 5, 5);

function phase(over: Partial<SeasonPhase>): SeasonPhase {
  return {
    key: 'k',
    eventId: 1,
    phase: 'nominations',
    name: 'Academy Awards',
    abbreviation: 'oscars',
    date: JAN,
    complete: false,
    ...over,
  };
}

function renderPhases(phases: SeasonPhase[], slots?: Record<string, React.ReactNode>) {
  return render(
    <SeasonShape>
      <SeasonPhaseBeats phases={phases} slots={slots} />
    </SeasonShape>,
  );
}

function renderSpan(phases: SeasonPhase[]) {
  return render(
    <SeasonShape phases={phases}>
      <SeasonPhaseBeats phases={phases} />
    </SeasonShape>,
  );
}

describe('the season span', () => {
  it('computes the span from the dates rather than stating one', () => {
    renderSpan([phase({ date: JAN }), phase({ key: 'b', date: JUN })]);
    expect(screen.getByTestId('season-span')).toHaveTextContent('about 5 months');
  });

  it('reports a short season in months too, not a fixed phrase', () => {
    renderSpan([phase({ date: JAN }), phase({ key: 'b', date: JAN + 40 * DAY })]);
    expect(screen.getByTestId('season-span')).toHaveTextContent('about 1 month,');
  });

  it('says nothing about a span it cannot compute from one date', () => {
    renderSpan([phase({ date: JAN }), phase({ key: 'b', date: null })]);
    expect(screen.queryByTestId('season-span')).not.toBeInTheDocument();
  });

  it('says nothing rather than zero when two phases fall in the same week', () => {
    renderSpan([phase({ date: JAN }), phase({ key: 'b', date: JAN + 3 * DAY })]);
    expect(screen.queryByTestId('season-span')).not.toBeInTheDocument();
  });

  it('says nothing at all when there is no season to measure', () => {
    renderSpan([]);
    expect(screen.queryByTestId('season-span')).not.toBeInTheDocument();
  });
});

describe('SeasonShape', () => {
  it('keeps one addressable beat per phase, in the order it was handed', () => {
    renderPhases([
      phase({ key: 'a' }),
      phase({ key: 'b', phase: 'ceremony', date: JUN }),
    ]);
    const beats = within(screen.getByTestId('season-shape')).getAllByRole('listitem');
    expect(beats.map((b) => b.dataset.testid)).toEqual([
      'season-beat-a',
      'season-beat-b',
    ]);
  });

  it('distinguishes a nominations phase from a ceremony in words', () => {
    renderPhases([
      phase({ key: 'a' }),
      phase({ key: 'b', phase: 'ceremony', date: JUN }),
    ]);
    expect(
      within(screen.getByTestId('season-beat-a')).getByText(/nominations/i),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('season-beat-b')).getByText(/ceremony/i),
    ).toBeInTheDocument();
  });

  it('formats in UTC, so the server and the browser agree', () => {
    // 🔴 A date at UTC midnight renders as the 5th, never the 4th, whatever the
    // ambient zone. A formatter following the local zone is a hydration
    // mismatch on this page's most prominent dates.
    renderPhases([phase({ key: 'a', date: JAN })]);
    expect(screen.getByText(/Jan 5/)).toBeInTheDocument();
  });

  it('carries a machine-readable date for each phase', () => {
    const { container } = renderPhases([phase({ key: 'a', date: JAN })]);
    expect(container.querySelector('time')).toHaveAttribute('dateTime', '2026-01-05');
  });

  it('says an unscheduled phase has no date yet instead of leaving it blank', () => {
    renderPhases([phase({ key: 'a', date: null })]);
    const beat = screen.getByTestId('season-beat-a');
    expect(within(beat).getByText(/to be announced/i)).toBeInTheDocument();
    expect(beat.querySelector('time')).toBeNull();
  });

  it('marks a finished phase as paid out and the next one as next, in words', () => {
    renderPhases([
      phase({ key: 'a', complete: true }),
      phase({ key: 'b', date: JUN, phase: 'ceremony' }),
      phase({ key: 'c', date: JUN + 30 * DAY, phase: 'ceremony' }),
    ]);
    expect(
      within(screen.getByTestId('season-beat-a')).getByText('Paid out'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('season-beat-b')).getByText('Next up'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('season-beat-c')).queryByText('Next up'),
    ).not.toBeInTheDocument();
  });

  it('treats the earliest dated incomplete phase as next, not an undated one', () => {
    // 🔴 The service sorts undated phases last, but an undated phase earlier in
    // the array must not steal "next" from a scheduled one — the reader is
    // being told what happens next, and a show with no date happens nowhere.
    renderPhases([
      phase({ key: 'a', date: null }),
      phase({ key: 'b', date: JUN, phase: 'ceremony' }),
    ]);
    expect(
      within(screen.getByTestId('season-beat-a')).queryByText('Next up'),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('season-beat-b')).getByText('Next up'),
    ).toBeInTheDocument();
  });

  it('falls back to the first incomplete phase when nothing ahead is scheduled', () => {
    renderPhases([phase({ key: 'a', date: null }), phase({ key: 'b', date: null })]);
    expect(
      within(screen.getByTestId('season-beat-a')).getByText('Next up'),
    ).toBeInTheDocument();
  });

  it('puts a slot inside the beat it was keyed to and no other', () => {
    renderPhases(
      [phase({ key: 'a' }), phase({ key: 'b', date: JUN, phase: 'ceremony' })],
      { b: <p>the worked example</p> },
    );
    expect(
      within(screen.getByTestId('season-beat-b')).getByText('the worked example'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('season-beat-a')).queryByText('the worked example'),
    ).not.toBeInTheDocument();
  });

  it('tells a reader nothing is scheduled rather than drawing an empty rule', () => {
    // 🔴 A signed-out reader on a fresh database hits this, and an empty
    // vertical line reads as a broken page.
    renderPhases([]);
    const beat = screen.getByTestId('season-beat-empty');
    expect(within(beat).getByText(/no shows scheduled yet/i)).toBeInTheDocument();
    expect(
      within(beat).getByText(/appear here as they are announced/i),
    ).toBeInTheDocument();
  });

  it('renders a beat that is not a phase at all, for the page to slot prose into', () => {
    render(
      <SeasonShape>
        <SeasonBeat label="Draft night" note="Before the season" when="Your league picks">
          <p>ten films each</p>
        </SeasonBeat>
      </SeasonShape>,
    );
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Draft night');
    expect(screen.getByText('ten films each')).toBeInTheDocument();
  });
});
