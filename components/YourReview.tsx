import type { MyReview } from '@/lib/services/reviews';
import { cn } from '@/lib/utils/cn';
import { ReviewCard } from './ReviewCard';
import { type DeleteReview, ReviewForm, type SaveReview } from './ReviewForm';
import { SectionHead } from './SectionHead';

/**
 * Rating and reviewing a film, and reading back what you wrote (T38, T39).
 *
 * 🔴 **Your own review only.** The source's `GET /reviews/tmdbId/:tmdbId`
 * required a session and then filtered on the film alone, so a film anyone had
 * reviewed loaded a stranger's words into your form. Nothing here shows another
 * member's review, and there is no id in these props that could address one.
 *
 * The editor sits inside a `<details>` because the common visit to a film page
 * is not a visit to write about it — and a native disclosure opens before
 * hydration, keyboard included, which a built one would not.
 */
export function YourReview({
  tmdbId,
  title,
  review,
  onSave,
  onDelete,
  className,
}: {
  tmdbId: string;
  title: string;
  review: MyReview | null;
  onSave: SaveReview;
  onDelete?: DeleteReview;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <SectionHead as="h2">Your review</SectionHead>

      {review ? <ReviewCard review={review} /> : null}

      <details className="bg-bg-surface rounded-md">
        <summary className="focus-visible:outline-accent-fill text-text-primary flex min-h-11 cursor-pointer items-center px-4 text-sm focus-visible:outline-2">
          {review ? 'Edit your review' : 'Write a review'}
        </summary>
        <div className="px-4 pt-2 pb-4">
          <ReviewForm
            tmdbId={tmdbId}
            title={title}
            review={review}
            onSave={onSave}
            onDelete={onDelete}
          />
        </div>
      </details>
    </section>
  );
}
