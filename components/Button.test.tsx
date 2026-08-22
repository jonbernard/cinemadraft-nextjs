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
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  // 🔴 The brief named squared-off buttons directly.
  it('never renders squared or pill', () => {
    render(<Button>Create league</Button>);
    const button = screen.getByRole('button');
    expect(button.className).not.toMatch(/rounded-none|rounded-pill/);
  });
});
