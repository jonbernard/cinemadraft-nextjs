import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SeasonControl } from '@/components/admin/SeasonControl';

const setActiveYear = vi.hoisted(() => vi.fn());
vi.mock('@/actions/admin/set-active-year', () => ({ setActiveYear }));

const SEASONS = [
  { year: 2026, isActive: true },
  { year: 2025, isActive: false },
  { year: 2024, isActive: false },
];

/**
 * 🔴 The one control in the product that re-scopes every page for every user,
 * by its own page's description. `/admin/broadcast` is the standard it is held
 * to: name the blast radius in numbers, say twice that it cannot be undone, and
 * gate the action.
 */
describe('SeasonControl', () => {
  beforeEach(() => {
    setActiveYear.mockReset();
    setActiveYear.mockResolvedValue({ ok: true, data: { year: 2025 } });
  });

  it('does nothing when the confirmation is declined', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    await userEvent.selectOptions(screen.getByLabelText(/season/i), '2025');
    await userEvent.click(screen.getByRole('button', { name: /make 2025 active/i }));

    expect(confirm).toHaveBeenCalled();
    expect(setActiveYear).not.toHaveBeenCalled();
  });

  it('names the year and the number of people in the confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    await userEvent.selectOptions(screen.getByLabelText(/season/i), '2025');
    await userEvent.click(screen.getByRole('button', { name: /make 2025 active/i }));

    const message = confirm.mock.calls[0]?.[0] as string;
    expect(message).toContain('2025');
    expect(message).toContain('60 people');
    // Not an alternation with "re-scope": the message always contains that
    // word, so the pair would hold with "cannot be undone" deleted.
    expect(message).toMatch(/cannot be undone/i);
  });

  it('re-scopes the app once, when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    await userEvent.selectOptions(screen.getByLabelText(/season/i), '2025');
    await userEvent.click(screen.getByRole('button', { name: /make 2025 active/i }));

    expect(setActiveYear).toHaveBeenCalledTimes(1);
    expect(setActiveYear).toHaveBeenCalledWith(2025);
  });

  it('a second click while the first is in flight does not send a second write', async () => {
    // `disabled` is what a pointer meets between a double-click and two
    // re-scopes, and `useTransition`'s pending flag is what sets it. (There is
    // no Enter path to guard: the control is a div, not a form.)
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    let release: (value: unknown) => void = () => {};
    setActiveYear.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    await userEvent.selectOptions(screen.getByLabelText(/season/i), '2025');
    const commit = screen.getByRole('button', { name: /make 2025 active/i });
    await userEvent.click(commit);
    await userEvent.click(screen.getByRole('button'));

    expect(setActiveYear).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button')).toBeDisabled();

    await act(async () => {
      release({ ok: true, data: { year: 2025 } });
    });
  });

  it('says which season is active somewhere a screen reader will reach', async () => {
    // The ten-button version said "Active" in a plain span beside the year.
    // An <option> suffix and a *disabled* button's accessible name are both
    // weaker: a disabled control is out of the tab order and skipped in forms
    // mode.
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    expect(screen.getByText(/2026 is the active season today/)).toBeInTheDocument();
  });

  it('names no season when none is active, rather than a blank', () => {
    // `findActive` is legitimately nullable. The label used to render
    // "Make  active" with a doubled space in that state.
    render(
      <SeasonControl seasons={[{ year: 2026, isActive: false }]} memberCount={60} />,
    );

    expect(screen.getByRole('button', { name: 'Pick a season' })).toBeDisabled();
    expect(screen.getByText(/No season is active today/)).toBeInTheDocument();
  });

  it('offers one control, not one button per season', () => {
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    // Ten adjacent triggers that each re-scope the product is the defect.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('cannot fire for the season that is already active', () => {
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    // 2026 is already active; the control opens on it and the commit is off.
    expect(screen.getByRole('button', { name: /already active/i })).toBeDisabled();
  });

  it('states the blast radius in the form, not only in the dialog', () => {
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    expect(screen.getByText(/60 people/)).toBeInTheDocument();
  });

  it('says "1 person" rather than "1 people"', () => {
    render(<SeasonControl seasons={SEASONS} memberCount={1} />);

    expect(screen.getByText(/1 person/)).toBeInTheDocument();
  });
});
