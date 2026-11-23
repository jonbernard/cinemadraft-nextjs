import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { KEEPS_LEAD, LIVE, TAKES_LEAD, UNDATED_PAST } from './standings-fixtures';
import { WhatMoved } from './WhatMoved';

describe('WhatMoved', () => {
  it('says who took the lead from whom when the leader changed', () => {
    render(<WhatMoved moved={TAKES_LEAD} year={2026} />);
    expect(
      screen.getByText(/Jacob Marlow takes the lead from Sasha Downey/),
    ).toBeInTheDocument();
  });

  it('says the leader keeps it otherwise', () => {
    render(<WhatMoved moved={KEEPS_LEAD} year={2026} />);
    expect(screen.getByText(/Sasha Downey keeps the lead/)).toBeInTheDocument();
    expect(screen.queryByText(/takes the lead/)).toBeNull();
  });

  it('dates the moment in the heading, with a <time>', () => {
    const { container } = render(<WhatMoved moved={KEEPS_LEAD} year={2026} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Academy Awards · ceremony · Sun Mar 15',
    );
    expect(container.querySelector('time')).toHaveAttribute('dateTime', '2026-03-15');
  });

  it('names the season for a moment with no stored date', () => {
    render(<WhatMoved moved={UNDATED_PAST} year={2025} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Academy Awards · ceremony · 2025',
    );
  });

  it('counts the decided categories while live', () => {
    render(<WhatMoved moved={LIVE} year={2026} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'live · 14 of 24 decided',
    );
  });

  it('announces moves in words', () => {
    render(<WhatMoved moved={KEEPS_LEAD} year={2026} />);
    expect(screen.getByText('up 2 places')).toBeInTheDocument();
    expect(screen.getAllByText('down 1 place')).toHaveLength(2);
  });

  it('prints wins as text, not as a pill', () => {
    render(<WhatMoved moved={KEEPS_LEAD} year={2026} />);
    const won = screen.getByText('won 6');
    expect(won.className).toContain('text-brass-text');
    expect(won.className).not.toContain('rounded-pill');
  });
});
