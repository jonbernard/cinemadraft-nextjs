import Link from 'next/link';

import type { FeedAttachment, FeedItem } from '@/lib/services/profile';
import { cn } from '@/lib/utils/cn';
import { formatDay } from '@/lib/utils/format';
import { ReviewCard } from '../films/ReviewCard';
import { Panel } from '../ui/Panel';
import { PosterFrame } from '../ui/PosterFrame';
import { type DeleteFeedItem, FeedPostActions } from './FeedPostActions';

/**
 * One line of a member's activity feed (P10.T40).
 *
 * The message is prose — a sentence about a person, written by the app or by
 * them — so it sets in Newsreader rather than Archivo, and the name inside it is
 * left as captured. `message` holds real names and is never parsed.
 *
 * `onDelete` is absent for everyone but the author, which is a rendering
 * decision only: `actions/profile/delete-feed-item.ts` re-checks ownership
 * against the session (R15).
 */
export function FeedPost({
  item,
  onDelete,
  className,
}: {
  item: FeedItem;
  onDelete?: DeleteFeedItem;
  className?: string;
}) {
  const when = formatDay(item.createdAt);

  return (
    <Panel as="article" className={cn('flex flex-col gap-3 p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {item.message ? (
            <p className="font-prose text-text-primary max-w-prose text-base leading-relaxed">
              {item.message}
            </p>
          ) : null}
          {when ? <p className="text-text-dim mt-1 text-xs">{when}</p> : null}
        </div>

        {onDelete ? (
          <FeedPostActions
            id={item.id}
            label={when ? `Delete your post from ${when}` : 'Delete this post'}
            onDelete={onDelete}
          />
        ) : null}
      </div>

      {item.attachments.map((attachment) => (
        <Attachment key={attachment.key} attachment={attachment} />
      ))}
    </Panel>
  );
}

function Attachment({ attachment }: { attachment: FeedAttachment }) {
  if (attachment.kind === 'review') {
    return (
      <div className="flex flex-col gap-2">
        {attachment.film ? <FilmName film={attachment.film} /> : null}
        <ReviewCard
          review={{
            rating: attachment.rating,
            review: attachment.review,
            updatedAt: attachment.updatedAt,
          }}
          className="bg-bg-surface"
        />
      </div>
    );
  }

  // Every pick, wrapping, the way `RosterStrip` lays out a seat: rosters run
  // 7 to 10 films and no count is assumed (D34). A scroller hid everything past
  // the panel's edge, and the old five-and-a-count made a member look as if
  // they had drafted five. The 5.5rem floor fits seven across the 3xl column at
  // about the old 6rem poster, so a common roster is one row; `1fr` closes the
  // ragged right edge, and a longer one wraps rather than hiding.
  return (
    <ul
      className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-3"
      aria-label="Drafted films, in draft order"
    >
      {attachment.films.map((film) => (
        <li key={film.movieId}>
          {film.tmdbId ? (
            <Link
              href={`/films/${film.tmdbId}`}
              className="focus-visible:outline-accent-fill block rounded-sm focus-visible:outline-2"
            >
              <PosterFrame title={film.title} posterUrl={film.posterUrl} />
            </Link>
          ) : (
            <PosterFrame title={film.title} posterUrl={film.posterUrl} />
          )}
        </li>
      ))}
    </ul>
  );
}

function FilmName({ film }: { film: { tmdbId: string | null; title: string } }) {
  if (!film.tmdbId) {
    return <p className="text-text-primary font-serif text-lg">{film.title}</p>;
  }

  return (
    <Link
      href={`/films/${film.tmdbId}`}
      className="text-text-primary hover:text-accent-text focus-visible:outline-accent-fill font-serif text-lg focus-visible:outline-2"
    >
      {film.title}
    </Link>
  );
}
