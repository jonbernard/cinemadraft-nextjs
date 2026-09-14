import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SeasonControl } from '@/components/admin/SeasonControl';

const setActiveYear = vi.hoisted(() => vi.fn());
vi.mock('@/actions/admin/set-active-year', () => ({ setActiveYear }));

/**
 * 🔴 These tests used to stub `window.confirm` and assert it was called (P14).
 * The moment the component stopped calling it, every one of those stubs would
 * have gone on passing while the confirmation itself was gone — `mockReturnValue(true)`
 * and "no dialog at all" are indistinguishable from the outside. They drive the
 * real `ConfirmDialog` now: the dialog is found, read and answered by clicking
 * its buttons, so deleting the confirmation makes them fail on a missing one.
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
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    await userEvent.selectOptions(screen.getByLabelText(/season/i), '2025');
    await userEvent.click(screen.getByRole('button', { name: /make 2025 active/i }));

    await answer('Cancel');
    expect(setActiveYear).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { hidden: true })).not.toBeVisible();
  });

  it('names the year and the number of people in the confirmation', async () => {
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    await userEvent.selectOptions(screen.getByLabelText(/season/i), '2025');
    await userEvent.click(screen.getByRole('button', { name: /make 2025 active/i }));

    // 🔴 Read off the rendered dialog, not off a spy's argument: the dialog
    // existing at all is now half of what this asserts.
    const message = dialog().textContent ?? '';
    expect(message).toContain('2025');
    expect(message).toContain('60 people');
    // Not an alternation with "re-scope": the message always contains that
    // word, so the pair would hold with "cannot be undone" deleted.
    expect(message).toMatch(/cannot be undone/i);
  });

  it('confirms in the app, not in browser chrome', async () => {
    // The defect P14 fixes. `window.confirm` is unstyleable, unplaceable and
    // says "cinemadraft.com says" above the sentence.
    const native = vi.spyOn(window, 'confirm');
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    await userEvent.selectOptions(screen.getByLabelText(/season/i), '2025');
    await userEvent.click(screen.getByRole('button', { name: /make 2025 active/i }));

    expect(native).not.toHaveBeenCalled();
    expect(dialog()).toBeVisible();
    native.mockRestore();
  });

  it('the confirmation does not default to re-scoping the product', async () => {
    // Focus lands on Cancel, so Enter on an unread dialog means no.
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    await userEvent.selectOptions(screen.getByLabelText(/season/i), '2025');
    await userEvent.click(screen.getByRole('button', { name: /make 2025 active/i }));

    expect(document.activeElement).toBe(
      within(dialog()).getByRole('button', { name: 'Cancel' }),
    );
  });

  it('re-scopes the app once, when confirmed', async () => {
    render(<SeasonControl seasons={SEASONS} memberCount={60} />);

    await userEvent.selectOptions(screen.getByLabelText(/season/i), '2025');
    await userEvent.click(screen.getByRole('button', { name: /make 2025 active/i }));
    await answer(/make 2025 active/i);

    expect(setActiveYear).toHaveBeenCalledTimes(1);
    expect(setActiveYear).toHaveBeenCalledWith(2025);
  });

  it('a second click while the first is in flight does not send a second write', async () => {
    // `disabled` is what a pointer meets between a double-click and two
    // re-scopes, and `useTransition`'s pending flag is what sets it. (There is
    // no Enter path to guard: the control is a div, not a form.)
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
    await answer(/make 2025 active/i);
    // The dialog is closed by now, so this is the page's one button again.
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
    // The confirmation renders nothing while closed, so it does not count.
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
