'use client';

import { useCallback, useId, useState, useTransition } from 'react';

import type { ActionResult } from '@/actions/result';
import type { MyReview } from '@/lib/services/reviews';
import { cn } from '@/lib/utils/cn';
import { Button } from './Button';
import { RatingInput } from './RatingInput';

export type SaveReview = (input: {
  tmdbId: string;
  rating: number | null;
  review: string | null;
}) => Promise<ActionResult<MyReview>>;

export type DeleteReview = (input: { tmdbId: string }) => Promise<ActionResult<null>>;

/**
 * Rating and words for one film, written or edited (P10.T38).
 *
 * One review per member per film, edited in place (R13) — so there is no "new
 * review" state to distinguish, only whether the fields started full. The
 * actions arrive as props for the same reason `WatchedToggle` takes its own: a
 * component that reaches for a Server Action by name cannot be rendered in a
 * test or a story.
 *
 * The source's "Share on your profile" switch is deliberately absent. It wrote a
 * `profile_feeds` row, and the feed is a different row of the matrix (P10.T40).
 */
export function ReviewForm({
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
  const textId = useId();
  const [rating, setRating] = useState<number | null>(review?.rating ?? null);
  const [text, setText] = useState(review?.review ?? '');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Tracked rather than read from the prop: the prop only changes when the page
  // revalidates, so between saving and that arriving the button would still
  // offer to "Save" something already saved.
  const [hasSaved, setHasSaved] = useState(review !== null);

  const onTextChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  }, []);

  const submit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);
      setStatus(null);

      startTransition(async () => {
        const result = await onSave({ tmdbId, rating, review: text });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setHasSaved(true);
        setStatus('Review saved');
      });
    },
    [onSave, rating, text, tmdbId],
  );

  const remove = useCallback(() => {
    if (!onDelete) return;
    setError(null);
    setStatus(null);

    startTransition(async () => {
      const result = await onDelete({ tmdbId });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setRating(null);
      setText('');
      setHasSaved(false);
      setStatus('Review removed');
    });
  }, [onDelete, tmdbId]);

  return (
    <form onSubmit={submit} className={cn('flex flex-col gap-6', className)}>
      <RatingInput
        name={`rating-${tmdbId}`}
        value={rating}
        onChange={setRating}
        disabled={pending}
      />

      <label className="flex flex-col gap-2" htmlFor={textId}>
        <span className="text-text-primary text-sm">Your review of {title}</span>
        <textarea
          id={textId}
          value={text}
          onChange={onTextChange}
          rows={6}
          maxLength={20_000}
          disabled={pending}
          placeholder="What did you make of it?"
          className="border-border-rule bg-bg-raised text-text-primary focus-visible:outline-accent-fill font-prose w-full rounded-sm border px-3 py-2 text-base leading-relaxed focus-visible:outline-2"
        />
      </label>

      {/* One region for both outcomes: a failure and a confirmation are the same
          question answered, and two live regions race each other. */}
      <p aria-live="polite" className="text-text-secondary min-h-5 text-sm">
        {error ?? status}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : hasSaved ? 'Update review' : 'Save review'}
        </Button>

        {hasSaved && onDelete ? (
          <Button type="button" variant="text" onClick={remove} disabled={pending}>
            Remove
          </Button>
        ) : null}
      </div>
    </form>
  );
}
