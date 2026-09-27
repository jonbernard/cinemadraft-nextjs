import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LiveSwitch } from './LiveSwitch';

describe('LiveSwitch', () => {
  it('is a switch named "Live", and says whether it is on', () => {
    const { rerender } = render(<LiveSwitch checked={false} onChange={vi.fn()} />);

    const control = screen.getByRole('switch', { name: 'Live' });
    expect(control).not.toBeChecked();

    rerender(<LiveSwitch checked onChange={vi.fn()} />);
    expect(screen.getByRole('switch', { name: 'Live' })).toBeChecked();
  });

  it('toggles by click on its label', async () => {
    const onChange = vi.fn();
    render(<LiveSwitch checked={false} onChange={onChange} />);

    await userEvent.click(screen.getByText('Live'));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggles from the keyboard with Space', async () => {
    const onChange = vi.fn();
    render(<LiveSwitch checked onChange={onChange} />);

    await userEvent.tab();
    expect(screen.getByRole('switch')).toHaveFocus();
    await userEvent.keyboard(' ');

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('is described by its sentence, so a screen reader hears what "live" does', () => {
    render(
      <LiveSwitch
        checked={false}
        onChange={vi.fn()}
        description="On air, /live streams."
      />,
    );

    expect(screen.getByRole('switch')).toHaveAccessibleDescription(
      'On air, /live streams.',
    );
  });
});
