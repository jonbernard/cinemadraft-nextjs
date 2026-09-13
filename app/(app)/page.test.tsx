import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentUser = vi.hoisted(() => vi.fn());
const getDashboard = vi.hoisted(() => vi.fn());
const getLeaderboard = vi.hoisted(() => vi.fn());
const availableSeasons = vi.hoisted(() => vi.fn());
const getLandingFacts = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({ getCurrentUser }));
vi.mock('@/lib/services/dashboard', () => ({ getDashboard }));
vi.mock('@/lib/services/leaderboard', () => ({ getLeaderboard, availableSeasons }));
vi.mock('@/lib/services/how-it-works', () => ({ getLandingFacts }));

import { PITCH, PITCH_HEADLINE } from '@/lib/copy';
import DashboardPage from './page';

/** The page's own props: `/` takes no params and this suite passes no `?year=`. */
function props() {
  return {
    params: Promise.resolve({}),
    searchParams: Promise.resolve({}),
  } as Parameters<typeof DashboardPage>[0];
}

// Ten, the number the page asks `getLandingFacts` for: the wall is a
// 1|2|3|4 staircase and the last column holds four.
const films = Array.from({ length: 10 }, (_, index) => ({
  movieId: index + 1,
  title: `Film ${index + 1}`,
  posterUrl: `https://image.tmdb.org/t/p/w342/${index + 1}.jpg`,
  total: 100 - index,
}));

const facts = {
  year: 2026,
  isActiveSeason: true,
  shows: 12,
  seasons: 10,
  filmsScored: 129,
  films,
};

beforeEach(() => {
  vi.resetAllMocks();
  getCurrentUser.mockResolvedValue(null);
  getDashboard.mockResolvedValue({
    year: 2026,
    leagues: [],
    events: [],
    nowPlaying: [],
  });
  getLeaderboard.mockResolvedValue({ year: 2026, events: [], rows: [] });
  availableSeasons.mockResolvedValue([2026]);
  getLandingFacts.mockResolvedValue(facts);
});

describe('the signed-out dashboard', () => {
  it('opens on the shared pitch, the way in, and says it once', async () => {
    render(await DashboardPage(props()));

    const hero = screen.getByTestId('signed-out-hero');
    // The claim is `lib/copy.ts`'s, not this page's — asserted against the
    // constant, so a page that typed its own copy of the sentence fails here
    // rather than drifting away from `/how-it-works` in silence.
    expect(within(hero).getByRole('heading', { level: 1 })).toHaveTextContent(
      PITCH_HEADLINE,
    );
    expect(within(hero).getByText(PITCH)).toBeInTheDocument();
    // The Razzie clause specifically: it is the beat the phase exists to
    // raise, and a lede that dropped it would still contain a pitch.
    expect(within(hero).getByText(/Razzie takes points back/)).toBeInTheDocument();

    expect(within(hero).getByRole('link', { name: 'Start a league' })).toHaveAttribute(
      'href',
      '/auth/register',
    );
    expect(within(hero).getByRole('link', { name: 'How it works' })).toHaveAttribute(
      'href',
      '/how-it-works',
    );

    // 🔴 Once. The whole task is that the argument was made twice — a lede at
    // the top and an `EmptyState` headed "Play the season" at the foot — so a
    // second copy anywhere on this page is the defect returning.
    expect(screen.getAllByText(/Draft a team of films/)).toHaveLength(1);
    expect(screen.queryByText('Play the season')).not.toBeInTheDocument();
  });

  it('keeps the returning member’s sentence, beside the action', async () => {
    render(await DashboardPage(props()));

    // The one sentence the deleted block carried that the lede did not. It
    // sits in the hero, next to the register link somebody is deciding about.
    const hero = screen.getByTestId('signed-out-hero');
    expect(
      within(hero).getByText(/Register with the same email and your leagues/),
    ).toBeInTheDocument();
  });

  it('puts the season rail under the hero, not a second pitch', async () => {
    render(await DashboardPage(props()));

    // Document order, not merely presence: the hero leads and the season
    // heading follows it (D44 — a live season is the page's evidence).
    const headings = screen
      .getAllByRole('heading')
      .map((heading) => `${heading.tagName}:${heading.textContent}`);
    expect(headings[0]).toBe(`H1:${PITCH_HEADLINE}`);
    expect(headings[1]).toBe('H2:Season');
    // One h1 on the page: the hero's. "Season" steps down to h2 beneath it.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('renders the season’s own films as artwork, every one of them announced', async () => {
    render(await DashboardPage(props()));

    const wall = screen.getByTestId('hero-films');

    // 🔴 Not `aria-hidden`, and that changed deliberately. The wall started as
    // decoration — posters only — and the owner asked for the names and the
    // totals back. A caption reading "One Battle After Another, 620" is
    // content, and hiding content from assistive technology to keep a tab
    // order tidy is the wrong trade. What kept the tab stops out was the
    // absence of links, and that still holds.
    expect(wall).not.toHaveAttribute('aria-hidden');
    expect(within(wall).queryAllByRole('link')).toHaveLength(0);
    expect(wall.querySelectorAll('a, button, [tabindex]')).toHaveLength(0);

    // 🔴 No visible captions anywhere: a title under the narrow columns
    // truncated, and captions broke the equal-height alignment by adding a
    // line to some columns and not others. Every film is still announced.
    // The lead film too: its name is announced, never drawn.
    expect(within(wall).queryByText(films[0].title, { exact: true })).toBeNull();
    expect(
      within(wall).getByText(`${films[0].title}, ${films[0].total} points`),
    ).toHaveClass('sr-only');
    expect(
      within(wall).getByText(`${films[4].title}, ${films[4].total} points`),
    ).toHaveClass('sr-only');

    // Four columns holding 1, 2, 3 and 4 — the staircase, not a block.
    expect(wall.children).toHaveLength(4);
    expect([...wall.children].map((column) => column.childElementCount)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it('still makes the argument when no season has a board', async () => {
    // The state a fresh deploy is in, and the one a new season opens in:
    // `getLandingFacts` walks back and finds nothing to show.
    getLandingFacts.mockResolvedValue(null);

    render(await DashboardPage(props()));

    const hero = screen.getByTestId('signed-out-hero');
    expect(within(hero).getByRole('heading', { level: 1 })).toHaveTextContent(
      PITCH_HEADLINE,
    );
    expect(within(hero).getByRole('link', { name: 'Start a league' })).toBeVisible();
    expect(screen.queryByTestId('hero-films')).not.toBeInTheDocument();
  });
});

describe('the signed-in dashboard', () => {
  beforeEach(() => {
    getCurrentUser.mockResolvedValue({ id: 42 });
  });

  it('is untouched: no hero, the season keeps the h1, and no extra query', async () => {
    render(await DashboardPage(props()));

    expect(screen.queryByTestId('signed-out-hero')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hero-films')).not.toBeInTheDocument();
    // The season is still this page's own `h1`, at its own level: the hero's
    // heading is the only thing that displaced it, and it is not rendered.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Season');

    // 🔴 The landing facts score a whole season. A member never sees them, so
    // the page must not pay for them — this pins that the signed-in request
    // issues exactly the queries it issued before P18.T10.
    expect(getLandingFacts).not.toHaveBeenCalled();
  });
});
