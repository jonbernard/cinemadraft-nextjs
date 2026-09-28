import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const completeDraft = vi.hoisted(() =>
  vi.fn(
    async (): Promise<{ ok: boolean; data?: null; message?: string }> => ({
      ok: true,
      data: null,
    }),
  ),
);
vi.mock('@/actions/leagues/manage-league', () => ({ completeDraft }));

import { FinishDraftButton } from '@/components/leagues/FinishDraftButton';

/**
 * The finish control as the draft console renders it: no `onDone`, so it
 * announces its own result, and `unfilled` from the console's view.
 *
 * Drives the real `ConfirmDialog` rather than a stub, for the reason
 * `SeasonSetup.test.tsx` gives: a stubbed confirm keeps passing after the
 * confirmation is deleted.
 */
function setup(over: Partial<React.ComponentProps<typeof FinishDraftButton>> = {}) {
  render(
    <FinishDraftButton leagueId={70} year={2027} status="active" canManage {...over} />,
  );
  return userEvent.setup();
}

const trigger = () => screen.queryByRole('button', { name: 'Finish the draft' });
const dialog = () => screen.getByRole('dialog');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FinishDraftButton', () => {
  it('is offered to the owner while the draft is active', () => {
    setup();
    expect(trigger()).toBeInTheDocument();
  });

  it('is not offered to anyone who cannot manage the league', () => {
    setup({ canManage: false });
    expect(trigger()).toBeNull();
  });

  it('is not offered once the draft is complete, or before it starts', () => {
    setup({ status: 'complete' });
    expect(trigger()).toBeNull();

    cleanup();
    setup({ status: 'pending' });
    expect(trigger()).toBeNull();

    cleanup();
    setup({ status: null });
    expect(trigger()).toBeNull();
  });

  it('says how many picks remain, and a refusal writes nothing', async () => {
    const user = setup({ unfilled: 3 });
    await user.click(trigger() as HTMLElement);

    expect(dialog()).toHaveTextContent(
      'Finish the draft? The league will be told it is over. 3 picks are still unfilled.',
    );
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(completeDraft).not.toHaveBeenCalled();
  });

  it('names one remaining pick in the singular, and none when the round is full', async () => {
    const user = setup({ unfilled: 1 });
    await user.click(trigger() as HTMLElement);
    expect(dialog()).toHaveTextContent('1 pick is still unfilled.');

    cleanup();
    const again = setup({ unfilled: 0 });
    await again.click(trigger() as HTMLElement);
    expect(dialog()).toHaveTextContent(
      /^Finish the draft\? The league will be told it is over\.\s*Cancel/,
    );
  });

  it('finishes this season on confirm and announces it', async () => {
    const user = setup();
    await user.click(trigger() as HTMLElement);
    await user.click(within(dialog()).getByRole('button', { name: 'Finish the draft' }));

    expect(completeDraft).toHaveBeenCalledWith({ leagueId: 70, year: 2027 });
    await waitFor(() =>
      expect(screen.getByText('The draft is finished')).toBeInTheDocument(),
    );
  });

  it('reports a refusal rather than pretending it worked', async () => {
    completeDraft.mockResolvedValueOnce({
      ok: false,
      message: 'that season has not been opened',
    });
    const user = setup();
    await user.click(trigger() as HTMLElement);
    await user.click(within(dialog()).getByRole('button', { name: 'Finish the draft' }));

    expect(
      await screen.findByText('that season has not been opened'),
    ).toBeInTheDocument();
  });
});
