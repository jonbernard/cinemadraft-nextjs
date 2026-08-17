import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * The labelled facts column on a film page.
 *
 * A `<dl>`, not a table: these are name/value pairs rather than a grid with
 * meaningful rows *and* columns, and the pairing is what a screen reader needs
 * to announce "Runtime, 2 hours 9 minutes" instead of two loose strings.
 *
 * 🔴 **A row with nothing to say does not render.** The source passed
 * `text={undefined}` into its `Stat` component and got a label with an empty
 * column beside it, so an older film's page showed "Budget" and "Box Office
 * Gross" as bare headings — which reads as a page that failed to load rather
 * than a film nobody recorded the numbers for. `Fact` returns null instead, and
 * `FilmFacts` renders nothing at all when every row is empty.
 *
 * The label is right-aligned from `md` up, as the screenshot shows, and stacks
 * above its value on a phone: a 30/70 split at 375px leaves about ten characters
 * for "Production companies".
 */
export function FilmFacts({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <dl className={cn('flex flex-col', className)}>{children}</dl>;
}

export function Fact({
  label,
  value,
  children,
}: {
  label: string;
  /** Rendered as text. Absent, empty or null means the row is omitted. */
  value?: string | null;
  /** For values that are not a single string — a list of companies, a chip. */
  children?: ReactNode;
}) {
  if (!value && !children) return null;

  return (
    <div className="border-border-rule flex flex-col gap-1 border-b py-3 last:border-b-0 md:flex-row md:gap-4">
      <dt className="text-text-secondary shrink-0 text-xs uppercase tracking-wide md:w-40 md:text-right md:text-sm md:normal-case md:tracking-normal">
        {label}
      </dt>
      <dd className="text-text-primary min-w-0 text-sm leading-relaxed">
        {value ?? children}
      </dd>
    </div>
  );
}
