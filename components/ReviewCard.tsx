import type { MyReview } from '@/lib/services/reviews';
import { cn } from '@/lib/utils/cn';
import { formatDay } from '@/lib/utils/format';
import { Panel } from './Panel';
import { RatingStars } from './RatingStars';

/**
 * A saved review, read back (P10.T39).
 *
 * The source rendered a review as one `<Typography>` per line, which is what
 * this does too — a member writing about a film uses paragraphs, and collapsing
 * the newlines would run them together. Blank lines are dropped rather than
 * rendered as empty paragraphs.
 */
export function ReviewCard({
  review,
  className,
}: {
  review: MyReview;
  className?: string;
}) {
  // Keyed by where the line starts, which is unique even when two paragraphs
  // read identically — an array index is not, and prose repeats.
  const paragraphs: { at: number; line: string }[] = [];
  let at = 0;
  for (const raw of (review.review ?? '').split('\n')) {
    const line = raw.trim();
    if (line !== '') paragraphs.push({ at, line });
    at += raw.length + 1;
  }
  const updated = formatDay(review.updatedAt);

  return (
    <Panel className={cn('flex flex-col gap-3 p-4', className)}>
      {review.rating === null ? null : <RatingStars rating={review.rating} />}

      {paragraphs.length > 0 ? (
        <div className="flex flex-col gap-2">
          {paragraphs.map((paragraph) => (
            <p
              key={paragraph.at}
              className="font-prose text-text-primary max-w-prose text-base leading-relaxed"
            >
              {paragraph.line}
            </p>
          ))}
        </div>
      ) : null}

      {updated ? <p className="text-text-dim text-xs">Saved {updated}</p> : null}
    </Panel>
  );
}
