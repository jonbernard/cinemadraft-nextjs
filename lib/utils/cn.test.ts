import { describe, expect, it } from 'vitest';

import { cn } from './cn';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });

  it('resolves conflicting Tailwind classes in favour of the last', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('keeps non-conflicting Tailwind classes', () => {
    expect(cn('p-2', 'text-sm')).toBe('p-2 text-sm');
  });
});
