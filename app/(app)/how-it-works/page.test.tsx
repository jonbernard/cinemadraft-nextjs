import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const findAll = vi.hoisted(() => vi.fn());
const getWorkedExample = vi.hoisted(() => vi.fn());
const getShowGroups = vi.hoisted(() => vi.fn());
const getSeasonPhases = vi.hoisted(() => vi.fn());

vi.mock('@/lib/repositories/points', () => ({
  pointRepository: { findAll },
}));
const getLandingFacts = vi.hoisted(() => vi.fn());
vi.mock('@/lib/services/how-it-works', () => ({
  getWorkedExample,
  getShowGroups,
  getLandingFacts,
}));
vi.mock('@/lib/services/season', () => ({ getSeasonPhases }));

import { PITCH, PITCH_HEADLINE } from '@/lib/copy';
import type { Point } from '@/lib/repositories/points';
import HowItWorksPage from './page';

function point(over: Partial<Point>): Point {
  return {
    id: 1,
    level: 'Level',
    tier: 1,
    points: 0,
    createdAt: null,
    updatedAt: null,
    ...over,
  } as Point;
}

/**
 * 🔴 Chosen to reproduce trap 1: a tier table full of numbers makes
 * `getByText('5')` genuinely ambiguous — Alphabet is flat at 5 across all
 * three tiers, so "5" appears three times. Every assertion below is scoped to
 * a row, never a bare `getByText` on a number.
 */
const points: Point[] = [
  point({ id: 1, level: 'Oscars', tier: 1, points: 20 }),
  point({ id: 2, level: 'Oscars', tier: 2, points: 15 }),
  point({ id: 3, level: 'Oscars', tier: 3, points: 10 }),
  point({ id: 4, level: 'Alphabet', tier: 1, points: 5 }),
  point({ id: 5, level: 'Alphabet', tier: 2, points: 5 }),
  point({ id: 6, level: 'Alphabet', tier: 3, points: 5 }),
  // 🔴 The negative level is part of the fixture, not an edge case: the page's
  // third rule reads its top tier, and a fixture without one let the rule
  // render an em dash while the test still passed.
  point({ id: 7, level: 'Razzies', tier: 1, points: -20 }),
  point({ id: 8, level: 'Razzies', tier: 2, points: -15 }),
];

const JAN_2026 = Date.UTC(2026, 0, 12);
const MAR_2026 = Date.UTC(2026, 2, 15);

const phases = [
  {
    key: '1-nominations',
    eventId: 1,
    phase: 'nominations' as const,
    name: 'Academy Awards',
    abbreviation: 'oscars',
    date: JAN_2026,
    complete: false,
  },
  {
    key: '2-ceremony',
    eventId: 2,
    phase: 'ceremony' as const,
    name: 'Razzies',
    abbreviation: 'raz',
    date: MAR_2026 - 86_400_000,
    complete: false,
  },
  {
    key: '1-ceremony',
    eventId: 1,
    phase: 'ceremony' as const,
    name: 'Academy Awards',
    abbreviation: 'oscars',
    date: MAR_2026,
    complete: false,
  },
];

const example = {
  year: 2026,
  isActiveSeason: true,
  best: {
    movieId: 7,
    title: 'A Real Film',
    posterUrl: null,
    total: 620,
    lines: [
      {
        nominationId: 1,
        awardName: 'Best Picture',
        eventName: 'Academy Awards',
        points: 20,
        won: true,
        earned: 40,
      },
    ],
  },
  worst: {
    movieId: 8,
    title: 'A Bad Film',
    posterUrl: null,
    total: -185,
    lines: [
      {
        nominationId: 2,
        awardName: 'Worst Picture',
        eventName: 'Razzies',
        points: -20,
        won: false,
        earned: -20,
      },
    ],
  },
};

describe('HowItWorksPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  function withData() {
    findAll.mockResolvedValue(points);
    getWorkedExample.mockResolvedValue(example);
    getShowGroups.mockResolvedValue([
      {
        level: 'Oscars',
        tiers: [{ tier: 1, points: 20 }],
        shows: [
          { eventId: 1, name: 'Academy Awards', abbreviation: 'oscars', imageUrl: null },
        ],
      },
    ]);
    getSeasonPhases.mockResolvedValue(phases);
    getLandingFacts.mockResolvedValue({
      year: 2026,
      isActiveSeason: true,
      shows: 12,
      seasons: 10,
      filmsScored: 129,
      films: [
        { movieId: 7, title: 'A Real Film', posterUrl: null, total: 620 },
        { movieId: 8, title: 'Another Film', posterUrl: null, total: 470 },
        { movieId: 9, title: 'A Third Film', posterUrl: null, total: 320 },
      ],
    });
  }

  it('makes the argument in season order, and ends with the way in', async () => {
    withData();

    render(await HowItWorksPage());

    // The order is the argument: the proof, then what it cost somebody, then
    // the reference, then the action. A page that opened with the rulebook
    // would be a reference page with a pitch attached.
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      'How the scoring works',
      'And somebody drafted this',
      'Twelve shows, and what each pays',
      'Start a league',
    ]);
  });

  it('states the three rules with figures from the points table', async () => {
    withData();

    render(await HowItWorksPage());

    // 20 nomination / 40 win / -20 Razzie, none of them typed: the first two
    // are the top tier of the most valuable level and its double, the third
    // is the top tier of the negative level.
    const rules = screen.getByTestId('scoring-rules');
    expect(within(rules).getByText('20')).toBeInTheDocument();
    expect(within(rules).getByText('40')).toBeInTheDocument();
    expect(within(rules).getByText('-20')).toBeInTheDocument();
  });

  it('puts the Razzie inversion in the lede, above the fold', async () => {
    withData();

    render(await HowItWorksPage());

    // docs/PLAN.md § Phase 18: the twist being the eighth paragraph is why
    // this phase exists. The beat is fourth; the lede carries it first.
    const lede = screen.getByText(/Pick before the nominations land/);
    expect(lede).toHaveTextContent(/Razzie takes points back/);
  });

  it('renders both ledgers from the service, and nothing it worked out itself', async () => {
    withData();

    render(await HowItWorksPage());

    // The winner in the hero, the casualty below it — both from the service.
    const totals = screen.getAllByTestId('worked-example-total');
    expect(totals.map((cell) => cell.textContent)).toEqual(['620', '-185']);
  });

  it('states the season length from the calendar, not from a typed claim', async () => {
    withData();

    render(await HowItWorksPage());

    // The phases span 12 Jan to 15 Mar, so the page says three months. An
    // earlier draft typed "September to March" beside a derived sentence that
    // said three, and the two contradicted each other on the page.
    // 12 Jan to 15 Mar is two months, and the page says what the dates say.
    expect(screen.getByText(/about 2 months/)).toBeInTheDocument();
  });

  it('feeds the rulebook the levels the points table holds', async () => {
    withData();

    render(await HowItWorksPage());

    // The table's own shape is `ScoringTable`'s to test. What matters here is
    // that the page hands it the real levels and does not print a number of
    // its own beside them.
    expect(screen.getByRole('heading', { name: 'Oscars' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Alphabet' })).toBeVisible();
    // The marks ride beside their own figures rather than in a wall of their
    // own: the Oscars group carries a link to its show page.
    expect(screen.getByRole('link', { name: 'Academy Awards' })).toHaveAttribute(
      'href',
      '/award-shows/oscars',
    );
  });

  it('doubles the win figure rather than typing it', async () => {
    withData();

    render(await HowItWorksPage());

    // 40 is 20 doubled, and 20 came from the points table. Neither figure is
    // written in the page.
    const rules = screen.getByTestId('scoring-rules');
    expect(within(rules).getByText('40')).toBeInTheDocument();
    expect(within(rules).getByText(/A win pays it again/)).toBeInTheDocument();
  });

  it('still teaches the game on an empty database', async () => {
    // 🔴 The state a signed-out stranger hits on a fresh deployment: no
    // season, no nominations, no shows. The page must still explain the game
    // rather than rendering a spine of blank nodes or throwing.
    findAll.mockResolvedValue([]);
    getWorkedExample.mockResolvedValue(null);
    getShowGroups.mockResolvedValue([]);
    getSeasonPhases.mockResolvedValue([]);
    getLandingFacts.mockResolvedValue(null);

    render(await HowItWorksPage());

    // The rules and the way in survive; the two ledgers and the rulebook are
    // absent rather than rendering empty shells.
    // The rules and the way in survive an empty database; the ledgers and the
    // rulebook are absent rather than rendering empty shells.
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
    ).toEqual(['How the scoring works', 'Start a league']);
    expect(screen.queryAllByTestId('worked-example-total')).toHaveLength(0);
    // The rules still read, with em dashes where the figures would be, rather
    // than "undefined" or a typed fallback number.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it("opens with the season's own artwork and three counted figures", async () => {
    withData();

    render(await HowItWorksPage());

    // Real posters for real teams' picks, where a landing page would put a
    // stock photograph.
    // Decorative by design: hidden from assistive tech and out of the tab
    // order, so the headline and the action are what a screen reader and a
    // keyboard reach first. Counted through the DOM because that is what
    // `aria-hidden` makes correct.
    // The hero shows the mechanic working on a real film, not the season's
    // leaders — that wall is the signed-out home's job (P18.T10).
    const ledger = screen.getByTestId('hero-ledger');
    expect(within(ledger).getByTestId('worked-example-total')).toHaveTextContent('620');

    // 🔴 Counted, never claimed. A figure here that nothing counts is the one
    // kind of lie this page cannot afford.
    const band = screen.getByTestId('landing-facts');
    expect(within(band).getByText('12')).toBeInTheDocument();
    expect(within(band).getByText('129')).toBeInTheDocument();
    expect(within(band).getByText('10')).toBeInTheDocument();
  });

  it('drops the hero artwork and the figures when there is nothing to count', async () => {
    findAll.mockResolvedValue([]);
    getWorkedExample.mockResolvedValue(null);
    getShowGroups.mockResolvedValue([]);
    getSeasonPhases.mockResolvedValue([]);
    getLandingFacts.mockResolvedValue(null);

    render(await HowItWorksPage());

    expect(screen.queryByTestId('hero-ledger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('landing-facts')).not.toBeInTheDocument();
    // The claim itself survives: it is the one thing on the page that needs
    // no data.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Draft a team of films/,
    );
  });

  it('makes the same claim as the signed-out home, from the same strings', async () => {
    withData();

    render(await HowItWorksPage());

    // 🔴 The pin that keeps one pitch from becoming two (P18.T10). The
    // signed-out `/` hero renders `lib/copy.ts` directly; this page still
    // holds the literals inline, because T10 ran beside an SEO pass on this
    // file and could not edit it. Equality both ways, so editing *either* copy
    // goes red here and the fix is to move the change into `lib/copy.ts` —
    // which is the point. When the branches meet, these literals become the
    // same imports and this test becomes redundant.
    const flat = (element: HTMLElement) =>
      element.textContent?.replace(/\s+/g, ' ').trim();

    expect(flat(screen.getByRole('heading', { level: 1 }))).toBe(PITCH_HEADLINE);
    expect(flat(screen.getByText(/Pick before the nominations land/))).toBe(PITCH);
  });
});
