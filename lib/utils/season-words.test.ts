import { describe, expect, it } from 'vitest';

import { countdown, ordinal, plural, showDay, showWeekday } from './season-words';

const OSCARS = Date.UTC(2026, 2, 15);

describe('season words', () => {
  it('names the day in UTC', () => {
    expect([showWeekday(OSCARS), showDay(OSCARS)]).toEqual(['Sun', 'Mar 15']);
  });

  it('counts down in words, and never below zero', () => {
    expect(countdown(OSCARS, Date.UTC(2026, 2, 12, 9))).toBe('in 3 days');
    expect(countdown(OSCARS, Date.UTC(2026, 2, 14, 12))).toBe('tomorrow');
    expect(countdown(OSCARS, Date.UTC(2026, 2, 15, 20))).toBe('today');
    expect(countdown(OSCARS, Date.UTC(2026, 2, 18))).toBe('results still to come');
  });

  it('spells ordinals, the teens included', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 16, 21, 22, 111].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '16th',
      '21st',
      '22nd',
      '111th',
    ]);
  });

  it('agrees in number', () => {
    expect([
      plural(1, 'nomination'),
      plural(188, 'nomination'),
      plural(2, 'category', 'categories'),
    ]).toEqual(['1 nomination', '188 nominations', '2 categories']);
  });
});
