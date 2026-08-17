import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type CreditDepartment, CreditsPanel } from '@/components/CreditsPanel';

/**
 * The credits panel, and the reason it uses `<details>`.
 *
 * 🔴 jsdom does not toggle a `<details>` on Enter or a click of its summary — it
 * implements the element but not the interaction. So the assertion here is that
 * **every hidden name is in the DOM**, which is the property that matters and the
 * one the source app's `useState` counter broke: names it had not revealed yet
 * were absent, so find-in-page could not reach them. Whether the disclosure
 * visually opens is left to the E2E suite, in a real browser.
 */
const DEPARTMENTS: CreditDepartment[] = [
  {
    department: 'Directing',
    people: [
      { name: 'Damien Chazelle', job: 'Director' },
      { name: 'Kelly Cantley', job: 'Second Unit Director' },
      { name: 'Jane Doe', job: 'Script Supervisor' },
      { name: 'Alex Roe', job: 'Assistant Director' },
      { name: 'Sam Poe', job: 'Second Assistant Director' },
      { name: 'Kim Loe', job: 'Third Assistant Director' },
    ],
  },
  {
    department: 'Writing',
    people: [{ name: 'Damien Chazelle', job: 'Writer' }],
  },
];

describe('what it shows', () => {
  it('🔴 keeps each person’s exact job', () => {
    // "Second Unit Director" is what the screenshot shows beside the name, and
    // that specificity is the reason the panel is worth reading — twenty-seven
    // people under "Art" with no jobs is a wall of names.
    render(<CreditsPanel departments={DEPARTMENTS} />);

    expect(screen.getByText('Second Unit Director')).toBeTruthy();
    expect(screen.getByText('Script Supervisor')).toBeTruthy();
  });

  it('names each department', () => {
    render(<CreditsPanel departments={DEPARTMENTS} />);

    expect(screen.getByRole('heading', { name: 'Directing' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Writing' })).toBeTruthy();
  });

  it('lists one person in both departments without a key collision', () => {
    // Damien Chazelle directed and wrote it. React would warn on a duplicate key
    // and the second entry could vanish.
    render(<CreditsPanel departments={DEPARTMENTS} />);

    expect(screen.getAllByText('Damien Chazelle')).toHaveLength(2);
  });
});

describe('🔴 the names behind the disclosure', () => {
  it('are in the DOM, so find-in-page reaches them', () => {
    // The source's `+ More` grew a `useState` count, so unrevealed names did not
    // exist yet — and a "Crew" department with 62 entries is exactly what
    // find-in-page is for.
    render(<CreditsPanel departments={DEPARTMENTS} />);

    expect(screen.getByText('Kim Loe')).toBeTruthy();
  });

  it('are inside a details element, not behind a button', () => {
    // Which is what gives the control its expanded state, keyboard operation and
    // find-in-page for free, with no client component.
    const { container } = render(<CreditsPanel departments={DEPARTMENTS} />);
    const details = container.querySelector('details');

    expect(details).not.toBeNull();
    expect(details?.querySelector('summary')?.textContent).toContain('2 more');
  });

  it('says how many more there are, and where', () => {
    render(<CreditsPanel departments={DEPARTMENTS} />);

    expect(screen.getByText(/Show 2 more in Directing/)).toBeTruthy();
  });

  it('has no disclosure for a department that fits', () => {
    render(<CreditsPanel departments={[DEPARTMENTS[1] as CreditDepartment]} />);

    expect(screen.queryByText(/Show/)).toBeNull();
  });
});

describe('nothing to show', () => {
  it('renders nothing at all rather than an empty heading', () => {
    const { container } = render(<CreditsPanel departments={[]} />);

    expect(container.textContent).toBe('');
  });
});
