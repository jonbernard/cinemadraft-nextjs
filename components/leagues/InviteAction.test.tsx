import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { InviteAction } from '@/components/leagues/InviteAction';

const URL = 'https://cinemadraft.test/join/2f1c6d4e-0000-4000-8000-000000000000';

/**
 * The invite link, behind an action.
 *
 * The uuid is the join credential — whoever holds it can seat themselves — so
 * it is owners-only, and printing it as the second element on the page made it
 * both the loudest thing there and a two-line mono wrap on a phone.
 */
describe('InviteAction', () => {
  it('does not print the join credential until it is asked for', () => {
    render(<InviteAction url={URL} />);

    // `toBeVisible`, not `queryByText(...).toBeNull()`: a closed `<details>`
    // keeps its contents in the DOM, so a presence check would pass against a
    // disclosure that never closed anything.
    expect(screen.getByText(URL)).not.toBeVisible();
    expect(screen.getByText('Invite')).toBeInTheDocument();
  });

  it('reveals the link, and the copy control with it', async () => {
    render(<InviteAction url={URL} />);

    await userEvent.click(screen.getByText('Invite'));

    expect(screen.getByText(URL)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeVisible();
  });

  it('says what the link is for, so it is not pasted by accident', async () => {
    render(<InviteAction url={URL} />);

    await userEvent.click(screen.getByText('Invite'));

    expect(screen.getByText(/anyone with this link can take a seat/i)).toBeVisible();
  });
});
