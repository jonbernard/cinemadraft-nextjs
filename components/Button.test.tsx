import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('is a button with its label as the accessible name', () => {
    render(<Button>Create league</Button>);
    expect(screen.getByRole('button', { name: 'Create league' })).toBeInTheDocument();
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Create league</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled and inert while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Create league
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    // MUI's disabled styling sets `pointer-events: none`, which is exactly
    // what makes a real disabled button inert — but userEvent v14 treats
    // clicking such an element as a test-authoring mistake and throws by
    // default. `pointerEventsCheck: 0` opts out of that guard so the click
    // is actually dispatched; the assertion below still means something,
    // because a disabled <button> does not invoke onClick even when a click
    // is dispatched at it.
    await userEvent.click(button, { pointerEventsCheck: 0 });
    expect(onClick).not.toHaveBeenCalled();
  });

  // 🔴 The brief named squared-off buttons directly.
  it('never renders squared or pill', () => {
    render(<Button>Create league</Button>);
    const button = screen.getByRole('button');
    expect(button.className).not.toMatch(/rounded-none|rounded-pill/);
  });
});
