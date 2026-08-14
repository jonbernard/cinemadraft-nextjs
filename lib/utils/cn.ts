import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Join class names, with later Tailwind utilities overriding earlier ones.
 *
 * Plain string concatenation is not enough: conditional styling produces
 * conflicting utilities constantly (`p-2` and `p-4` both landing on one
 * element), and CSS resolves that by source order in the stylesheet, not by
 * the order they appear in the class attribute. twMerge makes last-wins
 * actually hold.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
