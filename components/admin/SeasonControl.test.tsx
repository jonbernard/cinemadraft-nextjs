import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SeasonControl } from '@/components/admin/SeasonControl';

const setActiveYear = vi.hoisted(() => vi.fn());
vi.mock('@/actions/admin/set-active-year', () => ({ setActiveYear }));
const startNextSeason = vi.hoisted(() => vi.fn());
vi.mock('@/actions/admin/start-next-season', () => ({ startNextSeason }));

/**
 * 🔴 These drive the real `ConfirmDialog` (P14): the dialog is found, read and
 * answered by clicking its buttons, so deleting a confirmation makes them fail
 * on a missing dialog rather than pass on a stub.
 *
 * jsdom's `<dialog>` needs `showModal` to exist; `vitest.setup.ts` polyfills it.
 */
const dialog = () => screen.getByRole('dialog');
const answer = (name: RegExp | string) =>
  userEvent.click(within(dialog()).getByRole('button', { name }));

const SEASONS = [
  { year: 2026, isActive: true },
  { year: 2025, isActive: false },
  { year: 2024, isActive: false },
  { year: 2023, isActive: false },
];

describe('SeasonControl', () => {
  beforeEach(() => {
    setActiveYear.mockReset();
    setActiveYear.mockResolvedValue({ ok: true, data: { year: 2025 } });
    startNextSeason.mockReset();
    startNextSeason.mockResolvedValue({
      ok: true,
      data: { started: true, season: { year: 2027 } },
    });
  });

  it('offers the year after the active season', () => {
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    expect(screen.getByRole('button', { name: 'Start the 2027 season' })).toBeEnabled();
  });

  it('offers only the season before the active one, and nothing older (D138)', () => {
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    // Two acts in all: start next, switch back one. No per-season buttons.
    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons).toEqual(['Start the 2027 season', 'Switch back to 2025']);
    expect(screen.queryByText(/2024|2023/)).toBeNull();
  });

  it('offers no switch back when the season before has no row', () => {
    render(<SeasonControl seasons={[{ year: 2026, isActive: true }]} memberCount={60} />);

    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('follows the active season, not the newest row', () => {
    // After a switch back from 2027 the newest row is 2027; the next season is
    // still 2027, never 2028.
    render(
      <SeasonControl
        seasons={[
          { year: 2027, isActive: false },
          { year: 2026, isActive: true },
          { year: 2025, isActive: false },
        ]}
        memberCount={60}
      />,
    );

    expect(screen.getByRole('button', { name: 'Start the 2027 season' })).toBeVisible();
  });

  it('names the year, the people and the "not set up yet" notice in the confirmation', async () => {
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    await userEvent.click(screen.getByRole('button', { name: 'Start the 2027 season' }));

    const message = dialog().textContent ?? '';
    expect(message).toContain('Start the 2027 season?');
    expect(message).toContain('60 people');
    expect(message).toMatch(/every league, draft, award show and dashboard/i);
    expect(message).toContain('not set up yet');
  });

  it('starts nothing when the confirmation is declined', async () => {
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    await userEvent.click(screen.getByRole('button', { name: 'Start the 2027 season' }));
    await answer('Cancel');

    expect(startNextSeason).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { hidden: true })).not.toBeVisible();
  });

  it('the confirmation does not default to re-scoping the product', async () => {
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    await userEvent.click(screen.getByRole('button', { name: 'Start the 2027 season' }));

    expect(document.activeElement).toBe(
      within(dialog()).getByRole('button', { name: 'Cancel' }),
    );
  });

  it('starts the named year once, when confirmed', async () => {
    const native = vi.spyOn(window, 'confirm');
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    await userEvent.click(screen.getByRole('button', { name: 'Start the 2027 season' }));
    await answer('Start 2027');

    expect(native).not.toHaveBeenCalled();
    expect(startNextSeason).toHaveBeenCalledTimes(1);
    expect(startNextSeason).toHaveBeenCalledWith(2027);
    expect(await screen.findByText('2027 is now the active season')).toBeVisible();
    native.mockRestore();
  });

  it('a second click while the first is in flight sends no second write', async () => {
    let release: (value: unknown) => void = () => {};
    startNextSeason.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    const commit = screen.getByRole('button', { name: 'Start the 2027 season' });
    await userEvent.click(commit);
    await answer('Start 2027');
    await userEvent.click(commit);

    expect(startNextSeason).toHaveBeenCalledTimes(1);
    expect(commit).toBeDisabled();

    await act(async () => {
      release({ ok: true, data: { started: true, season: { year: 2027 } } });
    });
  });

  it('switches back one season, after a confirmation that names it', async () => {
    render(<SeasonControl seasons={SEASONS} memberCount={1} />);

    await userEvent.click(screen.getByRole('button', { name: 'Switch back to 2025' }));
    const message = dialog().textContent ?? '';
    expect(message).toContain('Switch back to 2025?');
    expect(message).toContain('1 person');
    await answer('Switch to 2025');

    expect(setActiveYear).toHaveBeenCalledWith(2025);
    expect(startNextSeason).not.toHaveBeenCalled();
  });

  it('says which season is active in running text', () => {
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    expect(screen.getByText('2026 is the active season.')).toBeInTheDocument();
  });

  it('states the blast radius on the page, not only in the dialog', () => {
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    expect(screen.getByText(/for all 60 people/)).toBeInTheDocument();
  });
});
