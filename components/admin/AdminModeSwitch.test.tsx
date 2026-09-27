import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminModeSwitch } from './AdminModeSwitch';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const HREFS = {
  view: '/award-shows/oscars?year=2026&mode=view',
  nominations: '/award-shows/oscars?year=2026&mode=nominations',
  winners: '/award-shows/oscars?year=2026&mode=winners',
};

function radio(name: string) {
  return screen.getByRole('radio', { name });
}

describe('AdminModeSwitch', () => {
  beforeEach(() => push.mockReset());

  it('is a named radio group of three, with the current mode checked', () => {
    render(<AdminModeSwitch mode="nominations" hrefs={HREFS} />);

    expect(screen.getByRole('group', { name: 'Admin mode' })).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('radio')
        .map((r) => (r as HTMLInputElement).labels?.[0]?.textContent),
    ).toEqual(['View', 'Nominations', 'Winners']);
    expect(radio('Nominations')).toBeChecked();
    expect(radio('View')).not.toBeChecked();
  });

  it('goes to the mode chosen, in the URL, without scrolling to the top', async () => {
    render(<AdminModeSwitch mode="view" hrefs={HREFS} />);

    await userEvent.click(radio('Winners'));

    expect(push).toHaveBeenCalledWith(HREFS.winners, { scroll: false });
  });

  it('does nothing when the current mode is pressed again', async () => {
    render(<AdminModeSwitch mode="winners" hrefs={HREFS} />);

    await userEvent.click(radio('Winners'));

    expect(push).not.toHaveBeenCalled();
  });

  it('is one tab stop, on the checked segment', async () => {
    render(
      <>
        <AdminModeSwitch mode="nominations" hrefs={HREFS} />
        <button type="button">after</button>
      </>,
    );

    await userEvent.tab();
    expect(radio('Nominations')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
  });

  it('moves with the arrows, choosing as it goes', async () => {
    render(<AdminModeSwitch mode="view" hrefs={HREFS} />);
    await userEvent.tab();

    await userEvent.keyboard('{ArrowRight}');
    expect(radio('Nominations')).toHaveFocus();
    expect(push).toHaveBeenLastCalledWith(HREFS.nominations, { scroll: false });
  });

  it('wraps from the first segment to the last going left', async () => {
    render(<AdminModeSwitch mode="view" hrefs={HREFS} />);
    await userEvent.tab();

    await userEvent.keyboard('{ArrowLeft}');

    expect(radio('Winners')).toHaveFocus();
    expect(push).toHaveBeenLastCalledWith(HREFS.winners, { scroll: false });
  });
});
