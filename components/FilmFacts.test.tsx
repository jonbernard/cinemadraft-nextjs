import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Fact, FilmFacts } from '@/components/FilmFacts';

/**
 * 🔴 The whole subject here is the absent row.
 *
 * The source passed `text={undefined}` into its `Stat` component and got a label
 * with an empty column beside it, so an older film's page showed "Budget" and
 * "Box Office Gross" as bare headings — which reads as a page that failed to
 * load rather than a film nobody recorded the numbers for.
 */
describe('a row with nothing to say', () => {
  it('🔴 does not render its label', () => {
    render(
      <FilmFacts>
        <Fact label="Budget" value={null} />
      </FilmFacts>,
    );

    expect(screen.queryByText('Budget')).toBeNull();
  });

  it('treats an empty string as absent', () => {
    // TMDB returns `""` for an unwritten tagline, not null.
    render(
      <FilmFacts>
        <Fact label="Tagline" value="" />
      </FilmFacts>,
    );

    expect(screen.queryByText('Tagline')).toBeNull();
  });

  it('renders when it has children instead of a value', () => {
    render(
      <FilmFacts>
        <Fact label="Production">
          <span>Summit Entertainment</span>
        </Fact>
      </FilmFacts>,
    );

    expect(screen.getByText('Production')).toBeTruthy();
    expect(screen.getByText('Summit Entertainment')).toBeTruthy();
  });
});

describe('the pairing a screen reader needs', () => {
  it('🔴 uses a definition list, so label and value are associated', () => {
    // A pair of `<div>`s would read as two loose strings. `<dl>` makes it
    // "Runtime, 2 hours 9 minutes".
    const { container } = render(
      <FilmFacts>
        <Fact label="Runtime" value="2 hours 9 minutes" />
      </FilmFacts>,
    );

    expect(container.querySelector('dl')).not.toBeNull();
    expect(container.querySelector('dt')?.textContent).toBe('Runtime');
    expect(container.querySelector('dd')?.textContent).toBe('2 hours 9 minutes');
  });

  it('renders every row that has a value', () => {
    render(
      <FilmFacts>
        <Fact label="Runtime" value="2 hours 9 minutes" />
        <Fact label="Language" value="English" />
        <Fact label="Budget" value={null} />
      </FilmFacts>,
    );

    expect(screen.getAllByRole('term')).toHaveLength(2);
  });
});
