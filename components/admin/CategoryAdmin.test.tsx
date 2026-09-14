import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CategoryAdmin } from '@/components/admin/CategoryAdmin';

const focusAward = vi.hoisted(() => vi.fn());
vi.mock('@/actions/awards/focus-award', () => ({ focusAward }));
vi.mock('@/actions/awards/attach-nominee', () => ({ attachNominee: vi.fn() }));
vi.mock('@/actions/awards/delete-category', () => ({ deleteCategory: vi.fn() }));
vi.mock('@/actions/awards/remove-nominee', () => ({ removeNominee: vi.fn() }));
vi.mock('@/actions/awards/set-winner', () => ({ setWinner: vi.fn() }));
vi.mock('@/actions/search/find-films', () => ({ findFilmsAction: vi.fn() }));

const PROPS = {
  awardId: 10,
  categoryName: 'Best Picture',
  year: 2026,
  nominees: [],
  requiresNomineeName: false,
};

/**
 * The ceremony pointer's control (P14.T12).
 *
 * 🔴 The state is carried in `aria-pressed` as well as in the label and the
 * colour. An admin running a show off a laptop on a sofa is the reader here,
 * and "which one is up" must not depend on telling carmine from a border.
 */
describe('CategoryAdmin — put on screen', () => {
  beforeEach(() => {
    focusAward.mockReset();
    focusAward.mockResolvedValue({ ok: true, data: null });
  });

  it('offers to put the category up when nothing of it is on screen', () => {
    render(<CategoryAdmin {...PROPS} onScreen={false} />);

    const button = screen.getByRole('button', { name: 'Put on screen' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('says it is up, and is pressed, when it is the one on screen', () => {
    render(<CategoryAdmin {...PROPS} onScreen={true} />);

    const button = screen.getByRole('button', { name: 'On screen' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('puts it on screen', async () => {
    render(<CategoryAdmin {...PROPS} onScreen={false} />);

    await userEvent.click(screen.getByRole('button', { name: 'Put on screen' }));

    expect(focusAward).toHaveBeenCalledWith({ awardId: 10, on: true });
  });

  it('takes it off again when it is already up', async () => {
    // Not a second control: the same button toggles, because there is one
    // selection per show and "nothing on screen" is a state between
    // announcements.
    render(<CategoryAdmin {...PROPS} onScreen={true} />);

    await userEvent.click(screen.getByRole('button', { name: 'On screen' }));

    expect(focusAward).toHaveBeenCalledWith({ awardId: 10, on: false });
  });

  it('shows the refusal rather than pretending the category went up', async () => {
    focusAward.mockResolvedValue({
      ok: false,
      code: 'FORBIDDEN',
      message: 'not an admin',
    });
    render(<CategoryAdmin {...PROPS} onScreen={false} />);

    await userEvent.click(screen.getByRole('button', { name: 'Put on screen' }));

    expect(await screen.findByText('not an admin')).toBeInTheDocument();
  });
});
