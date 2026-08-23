import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RatingInput } from '@/components/RatingInput';

/**
 * R14: the ten steps are radios in a fieldset, not a row of clickable divs.
 * Every assertion goes through the radio role, so a step rendered as a `<div>`
 * — or as text that merely happens to read "3.5" — fails.
 */
function renderInput(value: number | null = null, disabled = false) {
  const onChange = vi.fn();
  render(
    <RatingInput name="rating" value={value} onChange={onChange} disabled={disabled} />,
  );
  return onChange;
}

describe('RatingInput', () => {
  it('offers half a star to five, plus no rating at all', () => {
    renderInput();

    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual([
      'None',
      '0.5',
      '1.0',
      '1.5',
      '2.0',
      '2.5',
      '3.0',
      '3.5',
      '4.0',
      '4.5',
      '5.0',
    ]);
  });

  it('🔴 reports a half step as the number, not the index of the radio', async () => {
    const onChange = renderInput();

    await userEvent.click(screen.getByRole('radio', { name: '3.5 stars' }));

    expect(onChange).toHaveBeenCalledWith(3.5);
  });

  it('reports no rating as null rather than zero', async () => {
    // Zero is the absence of a rating; the action rejects it as a value.
    const onChange = renderInput(4);

    await userEvent.click(screen.getByRole('radio', { name: 'None' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('marks the current value checked, and only that one', () => {
    renderInput(2.5);

    const checked = screen.getAllByRole('radio').filter((radio) => {
      return (radio as HTMLInputElement).checked;
    });
    expect(checked).toHaveLength(1);
    expect(checked[0].getAttribute('value')).toBe('2.5');
  });

  it('previews the chosen value as stars beside the number', () => {
    renderInput(4.5);

    // Scoped to the live region: "4.5" also appears as a radio label, so an
    // unscoped text query would pass with the preview deleted.
    expect(within(screen.getByRole('status')).getByText(/^4\.5$/)).toBeInTheDocument();
  });

  it('says so in words when nothing is rated', () => {
    renderInput(null);

    expect(within(screen.getByRole('status')).getByText('No rating')).toBeInTheDocument();
  });

  it('🔴 announces the figure as a rating, not as a bare number', () => {
    renderInput();

    // "4.5, radio button" says nothing about what 4.5 counts.
    expect(screen.getByRole('radio', { name: '4.5 stars' })).toBeInTheDocument();
  });

  it('🔴 selects the nearest step for a value the ten cannot represent', () => {
    // The column is unconstrained `numeric`, so 4.37 is a storable value; with
    // nothing checked the group would offer no way back to a legal rating.
    renderInput(4.37);

    const checked = screen
      .getAllByRole('radio')
      .filter((radio) => (radio as HTMLInputElement).checked);
    expect(checked).toHaveLength(1);
    expect(checked[0].getAttribute('value')).toBe('4.5');
  });

  it('disables every step at once while a save is in flight', () => {
    renderInput(3, true);

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
  });
});
