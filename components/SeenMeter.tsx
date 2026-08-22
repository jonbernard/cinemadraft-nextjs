import { cn } from '@/lib/utils/cn';

/**
 * How much of something a member has seen — the watchlist's one recurring fact.
 *
 * A native `<progress>` draws the bar, and it is `aria-hidden` because the
 * sentence beside it already states the same fact in words: the bar is the
 * reinforcement, never the signal (§6.7, §12). Brass rather than carmine —
 * carmine marks *this one*, and every show on the page has a meter.
 */
export function SeenMeter({
  seen,
  total,
  unit = 'films',
  className,
}: {
  seen: number;
  total: number;
  unit?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <progress
        aria-hidden="true"
        value={seen}
        // A zero max renders an indeterminate bar rather than an empty one,
        // which reads as "loading" for a show with nothing nominated yet.
        max={Math.max(total, 1)}
        className="bg-bg-raised rounded-xs h-1.5 w-16 shrink-0 appearance-none overflow-hidden [&::-moz-progress-bar]:bg-brass-fill [&::-webkit-progress-bar]:bg-bg-raised [&::-webkit-progress-value]:bg-brass-fill"
      />
      <p className="text-text-secondary text-xs">
        <span className="tabular font-mono">{seen}</span> of{' '}
        <span className="tabular font-mono">{total}</span> {unit} seen
      </p>
    </div>
  );
}
