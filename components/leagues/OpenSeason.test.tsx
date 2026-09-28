import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Result =
  | { ok: true; data: { opened: boolean } }
  | { ok: false; code: 'CONFLICT'; message: string };
const openSeason = vi.hoisted(() =>
  vi.fn(async (): Promise<Result> => ({ ok: true, data: { opened: true } })),
);
vi.mock('@/actions/leagues/manage-league', () => ({ openSeason }));

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { OpenSeasonButton, OpenSeasonPanel } from './OpenSeason';

beforeEach(() => {
  openSeason.mockClear();
  push.mockClear();
});

describe('OpenSeasonButton', () => {
  it('asks first, and opens the season only after "Open"', async () => {
    render(<OpenSeasonButton leagueId={7} year={2027} />);

    await userEvent.click(screen.getByRole('button', { name: '+ Open 2027' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(
      "Open 2027? It starts empty. You'll add people on the next page. 2026 stays exactly as it is.",
    );
    expect(openSeason).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Open 2027' }));

    expect(openSeason).toHaveBeenCalledExactlyOnceWith({ leagueId: 7, year: 2027 });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/leagues/7/setup?year=2027'));
  });

  it('does nothing on Cancel', async () => {
    render(<OpenSeasonButton leagueId={7} year={2027} />);

    await userEvent.click(screen.getByRole('button', { name: '+ Open 2027' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    );

    expect(openSeason).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('says why it failed, out loud, and stays put', async () => {
    openSeason.mockResolvedValueOnce({
      ok: false,
      code: 'CONFLICT',
      message: 'that season cannot be opened',
    });
    render(<OpenSeasonButton leagueId={7} year={2027} />);

    await userEvent.click(screen.getByRole('button', { name: '+ Open 2027' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Open 2027' }),
    );

    const live = await screen.findByText('that season cannot be opened');
    expect(live.closest('[aria-live]')).not.toBeNull();
    expect(push).not.toHaveBeenCalled();
  });
});

describe('OpenSeasonPanel', () => {
  it('puts focus on Cancel when the confirm opens', async () => {
    render(<OpenSeasonPanel leagueId={7} year={2027} fromYear={2026} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open 2027' }));

    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    ).toHaveFocus();
  });

  it('opens the season and lands on its setup', async () => {
    render(<OpenSeasonPanel leagueId={7} year={2027} fromYear={2026} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open 2027' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Open 2027' }),
    );

    expect(openSeason).toHaveBeenCalledExactlyOnceWith({ leagueId: 7, year: 2027 });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/leagues/7/setup?year=2027'));
  });

  it('links back to the season it follows', () => {
    render(<OpenSeasonPanel leagueId={7} year={2027} fromYear={2026} />);

    expect(screen.getByRole('link', { name: 'See 2026' })).toHaveAttribute(
      'href',
      '/leagues/7?year=2026',
    );
  });
});
