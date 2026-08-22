import type { ElementType, ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * The floating surface (D67, D72).
 *
 * 🔴 Separation is a surface-value step, never a hairline border. Cards used
 * to carry a 1px rule on all four sides, and that — not the typography — was
 * the largest reason the product read as a monitoring dashboard. Measured on
 * Spotify's desktop shell, floating panels on a darker ground are what makes a
 * dense list UI read as a media player instead of an admin console.
 *
 * The step from ground to panel is ~1.1:1, far below any contrast threshold.
 * That is correct and intentional: it separates surfaces, it does not carry
 * information. Anything that carries information needs text, an icon or a
 * border.
 */
export function Panel({
  children,
  as: Tag = 'div' as ElementType,
  tone = 'surface',
  className,
}: {
  children: ReactNode;
  as?: ElementType;
  tone?: 'surface' | 'raised';
  className?: string;
}) {
  return (
    <Tag
      className={cn(
        'rounded-md',
        tone === 'raised' ? 'bg-bg-raised' : 'bg-bg-surface',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
