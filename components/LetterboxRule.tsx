import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * The signature device (§6.1): hairline rules above and below a section
 * header, borrowing cinema's letterbox.
 *
 * Structural rather than decorative — it is how a section announces itself,
 * which is why there is no variant that renders without the rules. If a
 * caller wants a bare heading, it does not want this component.
 *
 * `as` exists because heading level is a document-structure decision the
 * caller owns: a section header inside an already-h2 region has to be an h3
 * or the page's outline breaks for screen readers. It deliberately accepts
 * heading tags only.
 */
export function LetterboxRule({
  children,
  as: Tag = 'h2',
  className,
}: {
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  className?: string;
}) {
  return (
    <div className={cn('border-border-rule border-y py-2', className)}>
      <Tag className="font-display text-text-primary text-sm font-bold uppercase tracking-wide [font-variation-settings:'wdth'_118]">
        {children}
      </Tag>
    </div>
  );
}
