import { isAppError } from '@/lib/errors';
import { draftPickRepository } from '@/lib/repositories/draft-picks';
import { draftRepository } from '@/lib/repositories/drafts';
import { movieRepository } from '@/lib/repositories/movies';
import {
  type ProfileFeedComponent,
  profileFeedRepository,
} from '@/lib/repositories/profile-feeds';
import { type Review, reviewRepository } from '@/lib/repositories/reviews';
import { userRepository } from '@/lib/repositories/users';
import { posterUrl } from '@/lib/utils/poster';

/**
 * A member's profile and activity feed (P10.T40).
 *
 * 🔴 Two different predicates live here and neither implies the other. The feed
 * is **about the member named in the URL** — `findByUserUuid(uuid)`, and every
 * row it returns is theirs. Whether the *viewer* may edit it is a separate
 * question answered in `actions/profile/`, against the session, never against
 * this uuid. The source's `Watchlist.getByAwards` collapsed the two — it
 * required a signed-in user and then filtered on nothing — and returned every
 * member's rows to whoever asked.
 */

/** A member as a profile shows one. No email: the source's public projection had none. */
export type ProfileMember = {
  uuid: string;
  name: string;
  image: string | null;
  memberSince: Date | null;
};

export type FeedFilm = {
  movieId: number;
  tmdbId: string | null;
  title: string;
  posterUrl: string | null;
};

/**
 * A resolved `[kind, id]` pair. Kinds outside this union are dropped rather
 * than rendered as a stub — the column is free text (`ProfileFeedComponent`).
 */
export type FeedAttachment =
  | { kind: 'draft'; key: string; draftId: number; films: FeedFilm[]; more: number }
  | {
      kind: 'review';
      key: string;
      film: FeedFilm | null;
      rating: number | null;
      review: string | null;
      updatedAt: Date | null;
    };

export type FeedItem = {
  id: number;
  message: string | null;
  link: string | null;
  createdAt: Date | null;
  attachments: FeedAttachment[];
};

export type MemberProfile = {
  member: ProfileMember;
  feed: FeedItem[];
};

/**
 * The source capped a draft attachment at five posters (`DraftInclude`
 * `maxLength={5}`). Kept: a seat holds a dozen picks and a feed of full rosters
 * buries the messages between them.
 */
const DRAFT_FILMS_SHOWN = 5;

/**
 * Falls back to "A member", not to the email local part.
 *
 * The three copies of this elsewhere (`dashboard.ts`, `draft.ts`,
 * `season-setup.ts`) fall back to the address because they render your own
 * leagues to you. This page renders a stranger to any signed-in member, and an
 * unnamed account would hand out `first.last` from their address.
 */
function displayName(user: { firstName: string | null; lastName: string | null }) {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'A member';
}

function toFilm(movie: {
  id: number;
  tmdbId: string | null;
  title: string | null;
  poster: string | null;
}): FeedFilm {
  return {
    movieId: movie.id,
    tmdbId: movie.tmdbId,
    title: movie.title ?? 'Untitled',
    posterUrl: posterUrl(movie.poster, 'w185'),
  };
}

function idsOfKind(rows: { componentsArray: ProfileFeedComponent[] }[], kind: string) {
  const ids = new Set<number>();
  for (const row of rows) {
    for (const [componentKind, id] of row.componentsArray) {
      if (componentKind === kind && Number.isSafeInteger(id)) ids.add(id);
    }
  }
  return [...ids];
}

/**
 * 🔴 `users.uuid` is `@db.Uuid`, so Postgres rejects a value it cannot parse and
 * Prisma raises rather than returning nothing. Without this the route parameter
 * reaches the driver unchecked and `/members/nope` renders the error boundary
 * instead of a 404. `profile_feeds.user_uuid` is plain text and has no such
 * problem, which is why the repository says a miss is fine there.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toMember(user: {
  uuid: string;
  firstName: string | null;
  lastName: string | null;
  image: string | null;
  createdAt: Date | null;
}): ProfileMember {
  return {
    uuid: user.uuid,
    name: displayName(user),
    image: user.image,
    memberSince: user.createdAt,
  };
}

/** The member alone, for `generateMetadata` — one query rather than the whole feed. */
export async function loadProfileMember(uuid: string): Promise<ProfileMember | null> {
  if (!UUID.test(uuid)) return null;

  const user = await userRepository.findByUuid(uuid);
  // `uuid` is the unique key just looked up, so no row can carry null here; the
  // check narrows `string | null` where a fallback would only ever be dead code.
  return user?.uuid == null ? null : toMember({ ...user, uuid: user.uuid });
}

/**
 * Null when no member has that uuid — a mistyped or stale link, not a broken
 * invariant, so the page 404s rather than erroring.
 *
 * Five queries plus one per review attachment: the member, the feed, the seats
 * they hold, every owned draft's picks in one batch, every referenced film in
 * one batch. Review rows are fetched singly because `reviewRepository` has no
 * batch-by-id method and this task may not add one; nothing writes a `review`
 * component yet, so that loop runs zero times against the restored data.
 */
export async function loadMemberProfile(uuid: string): Promise<MemberProfile | null> {
  if (!UUID.test(uuid)) return null;

  const user = await userRepository.findByUuid(uuid);
  if (user?.uuid == null) return null;

  const [rows, owned] = await Promise.all([
    profileFeedRepository.findByUserUuid(uuid),
    draftRepository.findByUserId(user.id),
  ]);

  // 🔴 Same claim as the review guard below, for the kind that actually has
  // rows: `findManyByDraftIds` scopes on `draftId` alone, so an id pointing at
  // another member's seat would render their roster under this member's name
  // beside a message saying they drafted it.
  const ownedDraftIds = new Set(owned.map((draft) => draft.id));
  const draftIds = idsOfKind(rows, 'draft').filter((id) => ownedDraftIds.has(id));
  const reviewIds = idsOfKind(rows, 'review');

  const [picks, reviews] = await Promise.all([
    draftPickRepository.findManyByDraftIds(draftIds),
    Promise.all(reviewIds.map(findReviewOrNull)),
  ]);

  // 🔴 `findById` is the one review read that takes a bare row id and scopes on
  // nothing, so it answers "the review with this id" and not "this member's
  // review" — two different claims on a page about someone else (R7). The id
  // comes out of `components`, which only the server writes today, but a row
  // pointing anywhere else must not render a stranger's words under this
  // member's name, so ownership is checked here rather than assumed.
  const found = reviews.filter(
    (review): review is Review => review !== null && review.userId === user.id,
  );
  const movieIds = new Set<number>([
    ...picks.map((pick) => pick.movieId),
    ...found.flatMap((review) =>
      review.movieId == null ? [] : [Number(review.movieId)],
    ),
  ]);
  const movies = await movieRepository.findManyByIds([...movieIds]);
  const filmsById = new Map(movies.map((movie) => [movie.id, toFilm(movie)]));

  const picksByDraft = new Map<number, FeedFilm[]>();
  for (const pick of picks) {
    const film = filmsById.get(pick.movieId);
    if (!film) continue;
    const list = picksByDraft.get(pick.draftId);
    if (list) list.push(film);
    else picksByDraft.set(pick.draftId, [film]);
  }

  const reviewsById = new Map(found.map((review) => [review.id, review]));

  return {
    member: toMember({ ...user, uuid: user.uuid }),
    feed: rows.map((row) => ({
      id: row.id,
      message: row.message,
      link: row.link,
      createdAt: row.createdAt,
      attachments: row.componentsArray.flatMap((component) =>
        toAttachment(component, picksByDraft, reviewsById, filmsById),
      ),
    })),
  };
}

async function findReviewOrNull(id: number) {
  try {
    return await reviewRepository.findById(id);
  } catch (error) {
    // A component points at a row id with no foreign key behind it, so a
    // deleted review is an ordinary miss. Anything else is a real failure.
    if (isAppError(error) && error.code === 'NOT_FOUND') return null;
    throw error;
  }
}

function toAttachment(
  [kind, id]: ProfileFeedComponent,
  picksByDraft: Map<number, FeedFilm[]>,
  reviewsById: Map<number, Review>,
  filmsById: Map<number, FeedFilm>,
): FeedAttachment[] {
  const key = `${kind}-${id}`;

  if (kind === 'draft') {
    const films = picksByDraft.get(id) ?? [];
    if (films.length === 0) return [];
    return [
      {
        kind: 'draft',
        key,
        draftId: id,
        films: films.slice(0, DRAFT_FILMS_SHOWN),
        more: Math.max(0, films.length - DRAFT_FILMS_SHOWN),
      },
    ];
  }

  if (kind === 'review') {
    const review = reviewsById.get(id);
    if (!review) return [];
    return [
      {
        kind: 'review',
        key,
        film:
          review.movieId == null ? null : (filmsById.get(Number(review.movieId)) ?? null),
        rating: review.rating,
        review: review.review,
        updatedAt: review.updatedAt,
      },
    ];
  }

  return [];
}
