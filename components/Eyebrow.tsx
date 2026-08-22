import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * 🔴 The only uppercase treatment in the product.
 *
 * All-caps at 14px was one of the three faults named in the brief: at that
 * size it reads as a legend key, not a film credit. Confined to 11px with
 * +0.085em, it reads as an eyebrow — which is exactly how Criterion uses it,
 * measured at 16px/+0.075em, and how every other reference product does.
 *
 * An eyebrow must carry real metadata — a round range, a date span, a seat
 * count. If there is nothing to say, there is no eyebrow; the hairline rule
 * this replaced carried nothing, which is why it went.
 */
export function Eyebrow({
  children,
  tone = 'dim',
  className,
}: {
  children: ReactNode;
  tone?: 'brass' | 'dim';
  className?: string;
}) {
  return (
    <p
      className={cn(
        'font-sans text-[11px] font-bold uppercase tracking-[0.085em]',
        tone === 'brass' ? 'text-brass-text' : 'text-text-dim',
        className,
      )}
    >
      {children}
    </p>
  );
}
